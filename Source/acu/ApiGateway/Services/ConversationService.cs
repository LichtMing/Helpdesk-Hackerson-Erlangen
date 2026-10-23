using AcuApiGateway.Models;

namespace AcuApiGateway.Services;

public sealed class ConversationService(
    ConversationSessionStore sessionStore,
    IChatModelClient modelClient)
{
    public async Task<ChatModelReply> ReplyAsync(
        string deviceId,
        string sessionId,
        string text,
        string language,
        CancellationToken cancellationToken)
    {
        var session = sessionStore.GetOrCreate(deviceId, sessionId);
        await session.Gate.WaitAsync(cancellationToken);
        try
        {
            if (Volatile.Read(ref session.IsReset) != 0)
                throw new OperationCanceledException("The conversation was reset.");

            session.Messages.Add(new ConversationMessage("user", text));
            sessionStore.Trim(session);

            try
            {
                using var linkedCancellation = CancellationTokenSource.CreateLinkedTokenSource(
                    cancellationToken, session.ResetSource.Token);
                var reply = await modelClient.CompleteAsync(
                    session.Messages.ToArray(), language, deviceId, linkedCancellation.Token);
                session.Messages.Add(new ConversationMessage("assistant", reply.Text));
                sessionStore.Trim(session);
                return reply;
            }
            catch
            {
                // A failed provider call must not leave a patient's unanswered prompt in memory.
                if (session.Messages.Count > 0 && session.Messages[^1].Role == "user")
                    session.Messages.RemoveAt(session.Messages.Count - 1);
                throw;
            }
        }
        finally
        {
            session.LastAccessUtc = DateTime.UtcNow;
            session.Gate.Release();
        }
    }
}
