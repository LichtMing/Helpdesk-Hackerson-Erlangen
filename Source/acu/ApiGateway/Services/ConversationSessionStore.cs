using System.Collections.Concurrent;
using AcuApiGateway.Models;

namespace AcuApiGateway.Services;

/// <summary>
/// Process-local conversation memory. No patient text handled here is written to disk.
/// Sessions expire after an idle timeout and can be removed explicitly through /api/reset.
/// </summary>
public sealed class ConversationSessionStore(
    IConfiguration configuration,
    ILogger<ConversationSessionStore> logger) : BackgroundService
{
    private readonly ConcurrentDictionary<SessionKey, SessionState> sessions = new();
    private readonly TimeSpan idleTimeout = TimeSpan.FromMinutes(
        Math.Clamp(configuration.GetValue("Conversation:SessionIdleTimeoutMinutes", 5), 1, 120));
    private readonly int maxMessages = Math.Clamp(
        configuration.GetValue("Conversation:MaxTurns", 6), 1, 20) * 2;

    internal SessionState GetOrCreate(string deviceId, string sessionId) =>
        sessions.GetOrAdd(new SessionKey(deviceId, sessionId), _ => new SessionState());

    internal void Trim(SessionState session)
    {
        while (session.Messages.Count > maxMessages)
            session.Messages.RemoveAt(0);
        session.LastAccessUtc = DateTime.UtcNow;
    }

    public async Task<bool> ResetAsync(
        string deviceId,
        string sessionId,
        CancellationToken cancellationToken = default)
    {
        if (!sessions.TryRemove(new SessionKey(deviceId, sessionId), out var session))
            return false;

        Interlocked.Exchange(ref session.IsReset, 1);
        session.ResetSource.Cancel();
        await session.Gate.WaitAsync(cancellationToken);
        try
        {
            session.Messages.Clear();
        }
        finally
        {
            session.Gate.Release();
        }
        session.ResetSource.Dispose();
        return true;
    }

    public async Task<int> RemoveExpiredAsync(DateTime utcNow)
    {
        var removed = 0;
        foreach (var entry in sessions)
        {
            if (utcNow - entry.Value.LastAccessUtc < idleTimeout)
                continue;
            if (!sessions.TryRemove(entry.Key, out var session))
                continue;

            Interlocked.Exchange(ref session.IsReset, 1);
            session.ResetSource.Cancel();
            await session.Gate.WaitAsync();
            try
            {
                session.Messages.Clear();
            }
            finally
            {
                session.Gate.Release();
            }
            session.ResetSource.Dispose();
            removed++;
        }
        return removed;
    }

    protected override async Task ExecuteAsync(CancellationToken stoppingToken)
    {
        using var timer = new PeriodicTimer(TimeSpan.FromMinutes(1));
        try
        {
            while (await timer.WaitForNextTickAsync(stoppingToken))
            {
                var removed = await RemoveExpiredAsync(DateTime.UtcNow);
                if (removed > 0)
                    logger.LogInformation("Expired {SessionCount} conversation session(s).", removed);
            }
        }
        catch (OperationCanceledException) when (stoppingToken.IsCancellationRequested)
        {
            // Normal application shutdown.
        }
        finally
        {
            foreach (var key in sessions.Keys)
                await ResetAsync(key.DeviceId, key.SessionId, CancellationToken.None);
        }
    }

    internal sealed class SessionState
    {
        public SemaphoreSlim Gate { get; } = new(1, 1);
        public List<ConversationMessage> Messages { get; } = [];
        public DateTime LastAccessUtc { get; set; } = DateTime.UtcNow;
        public CancellationTokenSource ResetSource { get; } = new();
        public int IsReset;
    }

    private sealed record SessionKey(string DeviceId, string SessionId);
}
