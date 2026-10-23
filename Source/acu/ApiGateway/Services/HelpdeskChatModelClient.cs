using System.Net.Http.Json;
using AcuApiGateway.Models;

namespace AcuApiGateway.Services;

/// <summary>
/// Sends bounded conversation text to the internal helpdesk/Ollama adapter.
/// It never sends raw audio, robot credentials, or persistent patient data.
/// </summary>
public sealed class HelpdeskChatModelClient(HttpClient httpClient) : IChatModelClient
{
    public async Task<ChatModelReply> CompleteAsync(
        IReadOnlyList<ConversationMessage> messages,
        string language,
        CancellationToken cancellationToken)
    {
        try
        {
            using var response = await httpClient.PostAsJsonAsync(
                "internal/chat",
                new
                {
                    messages = messages.Select(message => new
                    {
                        role = message.Role,
                        content = message.Content
                    }),
                    language
                },
                cancellationToken);

            if (!response.IsSuccessStatusCode)
            {
                throw new ChatModelUnavailableException(
                    $"The local language model returned HTTP {(int)response.StatusCode}.");
            }

            var result = await response.Content.ReadFromJsonAsync<HelpdeskReply>(
                cancellationToken: cancellationToken);
            if (result is null || string.IsNullOrWhiteSpace(result.Answer))
                throw new ChatModelUnavailableException("The local language model returned an empty answer.");

            return new ChatModelReply(
                result.Answer.Trim(),
                NormalizeLanguage(string.IsNullOrWhiteSpace(result.Language) ? language : result.Language),
                false);
        }
        catch (ChatModelUnavailableException)
        {
            throw;
        }
        catch (OperationCanceledException) when (!cancellationToken.IsCancellationRequested)
        {
            throw new ChatModelUnavailableException("The local language model timed out.");
        }
        catch (HttpRequestException)
        {
            throw new ChatModelUnavailableException("The local language model is unavailable.");
        }
        catch (System.Text.Json.JsonException)
        {
            throw new ChatModelUnavailableException("The local language model returned invalid JSON.");
        }
    }

    private static string NormalizeLanguage(string language)
    {
        var normalized = language
            .Split('-', StringSplitOptions.RemoveEmptyEntries)
            .FirstOrDefault()?.ToLowerInvariant();
        return normalized is "de" or "zh" ? normalized : "en";
    }

    private sealed record HelpdeskReply(string Answer, string Language, bool IsMock);
}
