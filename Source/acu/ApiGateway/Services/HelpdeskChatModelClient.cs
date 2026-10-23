using System.Net.Http.Json;
using System.Diagnostics;
using System.Text.Json.Serialization;
using AcuApiGateway.Models;

namespace AcuApiGateway.Services;

/// <summary>
/// Sends bounded conversation text to the internal helpdesk/Ollama adapter.
/// It never sends raw audio, robot credentials, or persistent patient data.
/// </summary>
public sealed class HelpdeskChatModelClient(
    HttpClient httpClient,
    ILogger<HelpdeskChatModelClient> logger) : IChatModelClient
{
    public async Task<ChatModelReply> CompleteAsync(
        IReadOnlyList<ConversationMessage> messages,
        string language,
        string deviceId,
        CancellationToken cancellationToken)
    {
        var timer = Stopwatch.StartNew();
        logger.LogInformation(
            "COMM direction=acu_to_model event=inference_requested deviceId={DeviceId} language={Language} turns={Turns} textChars={TextChars}",
            deviceId, language, messages.Count, messages.Sum(message => message.Content.Length));
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
                    language,
                    robotId = deviceId
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

            logger.LogInformation(
                "COMM direction=model_to_acu event=inference_completed deviceId={DeviceId} answerChars={AnswerChars} delivery={Delivery} elapsedMs={ElapsedMs}",
                deviceId, result.Answer.Length, result.RobotDelivery, timer.ElapsedMilliseconds);
            return new ChatModelReply(
                result.Answer.Trim(),
                NormalizeLanguage(string.IsNullOrWhiteSpace(result.Language) ? language : result.Language),
                false,
                string.IsNullOrWhiteSpace(result.RobotDelivery)
                    ? "robot_delivery_failed"
                    : result.RobotDelivery);
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

    private sealed record HelpdeskReply(
        string Answer,
        string Language,
        bool IsMock,
        [property: JsonPropertyName("robot_delivery")] string RobotDelivery);
}
