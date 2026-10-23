using AcuApiGateway.Models;

namespace AcuApiGateway.Services;

public interface IChatModelClient
{
    Task<ChatModelReply> CompleteAsync(
        IReadOnlyList<ConversationMessage> messages,
        string language,
        string deviceId,
        CancellationToken cancellationToken);
}

public sealed class ChatModelUnavailableException(string message) : Exception(message);

/// <summary>
/// Safe integration placeholder. It is deliberately disabled unless an operator explicitly
/// enables Conversation:EnableDevelopmentResponses. Replace this registration with the
/// Ollama implementation when the model work is ready.
/// </summary>
public sealed class DevelopmentChatModelClient(IConfiguration configuration) : IChatModelClient
{
    private readonly bool enabled = configuration.GetValue(
        "Conversation:EnableDevelopmentResponses", false);

    public Task<ChatModelReply> CompleteAsync(
        IReadOnlyList<ConversationMessage> messages,
        string language,
        string deviceId,
        CancellationToken cancellationToken)
    {
        cancellationToken.ThrowIfCancellationRequested();
        if (!enabled)
        {
            throw new ChatModelUnavailableException(
                "The local language model is not connected. Enable the development response only for pipeline testing.");
        }

        var normalizedLanguage = language
            .Split('-', StringSplitOptions.RemoveEmptyEntries)
            .FirstOrDefault()?.ToLowerInvariant() ?? "en";
        var text = normalizedLanguage switch
        {
            "de" => "Das lokale Sprachmodell ist noch nicht verbunden. Diese Antwort testet nur die Gesprächspipeline.",
            "zh" => "本地语言模型尚未连接。此回答仅用于测试对话链路。",
            _ => "The local language model is not connected yet. This response only verifies the conversation pipeline."
        };

        return Task.FromResult(new ChatModelReply(text, normalizedLanguage == "auto" ? "en" : normalizedLanguage, true));
    }
}
