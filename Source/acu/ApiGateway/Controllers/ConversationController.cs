using System.Diagnostics;
using System.Text.Json;
using AcuApiGateway.Models;
using AcuApiGateway.Services;
using Acu.Storage.Store;
using Microsoft.AspNetCore.Mvc;

namespace AcuApiGateway.Controllers;

/// <summary>Temporary patient conversation, reset, and offline speech endpoints.</summary>
[ApiController]
[Route("api")]
[Tags("conversation")]
[Produces("application/json")]
public sealed class ConversationController(
    DeviceStore deviceStore,
    ConversationService conversationService,
    ConversationSessionStore sessionStore,
    ISpeechSynthesizer speechSynthesizer,
    IConfiguration configuration,
    ILogger<ConversationController> logger) : ControllerBase
{
    private readonly bool includeCommunicationText =
        configuration.GetValue("CommunicationLogging:IncludeText", false);

    /// <summary>
    /// Sends one transcribed patient utterance through the configured chat provider.
    /// Patient text is held only in process memory for the duration of the session.
    /// </summary>
    [HttpPost("chat")]
    [Consumes("application/json")]
    [ProducesResponseType(typeof(object), StatusCodes.Status200OK)]
    [ProducesResponseType(typeof(object), StatusCodes.Status400BadRequest)]
    [ProducesResponseType(typeof(object), StatusCodes.Status403Forbidden)]
    [ProducesResponseType(typeof(object), StatusCodes.Status404NotFound)]
    [ProducesResponseType(typeof(object), StatusCodes.Status409Conflict)]
    [ProducesResponseType(typeof(object), StatusCodes.Status503ServiceUnavailable)]
    public async Task<IActionResult> Chat(
        [FromBody] ChatRequest body,
        CancellationToken cancellationToken)
    {
        if (ValidateRobot(body.DeviceId, body.Mac) is { } identityError)
            return identityError;
        if (string.IsNullOrWhiteSpace(body.Text))
            return BadRequest(new { error = "Chat text must not be empty" });
        if (string.IsNullOrWhiteSpace(body.SessionId) || string.IsNullOrWhiteSpace(body.RequestId))
            return BadRequest(new { error = "Session ID and request ID must not be empty" });
        if (string.IsNullOrWhiteSpace(body.Language))
            return BadRequest(new { error = "Chat language must not be empty" });

        var timer = Stopwatch.StartNew();
        logger.LogInformation(
            "COMM direction=robot_to_acu event=chat_received deviceId={DeviceId} sessionId={SessionId} requestId={RequestId} language={Language} textChars={TextChars}",
            body.DeviceId, body.SessionId, body.RequestId, body.Language, body.Text.Trim().Length);
        if (includeCommunicationText)
        {
            logger.LogInformation(
                "COMM_TEXT event=chat_received_text deviceId={DeviceId} requestId={RequestId} textJson={TextJson}",
                body.DeviceId, body.RequestId, JsonSerializer.Serialize(body.Text.Trim()));
        }
        try
        {
            var reply = await conversationService.ReplyAsync(
                body.DeviceId,
                body.SessionId,
                body.Text.Trim(),
                body.Language,
                cancellationToken);

            logger.LogInformation(
                "COMM direction=acu_to_robot event=chat_answer deviceId={DeviceId} sessionId={SessionId} requestId={RequestId} language={Language} answerChars={AnswerChars} delivery={Delivery} elapsedMs={ElapsedMs}",
                body.DeviceId, body.SessionId, body.RequestId, reply.Language, reply.Text.Length,
                reply.RobotDelivery, timer.ElapsedMilliseconds);
            if (includeCommunicationText)
            {
                logger.LogInformation(
                    "COMM_TEXT event=chat_generated_text deviceId={DeviceId} requestId={RequestId} textJson={TextJson}",
                    body.DeviceId, body.RequestId, JsonSerializer.Serialize(reply.Text));
            }
            return Ok(new
            {
                sessionId = body.SessionId,
                requestId = body.RequestId,
                answer = reply.Text,
                language = reply.Language,
                isMock = reply.IsMock,
                robotDelivery = reply.RobotDelivery,
                generatedAt = DateTime.UtcNow.ToString("o")
            });
        }
        catch (ChatModelUnavailableException error)
        {
            logger.LogWarning(
                "COMM direction=acu_internal event=model_unavailable deviceId={DeviceId} requestId={RequestId} elapsedMs={ElapsedMs} reason={Reason}",
                body.DeviceId, body.RequestId, timer.ElapsedMilliseconds, error.Message);
            return StatusCode(StatusCodes.Status503ServiceUnavailable, new { error = error.Message });
        }
        catch (OperationCanceledException) when (!cancellationToken.IsCancellationRequested)
        {
            logger.LogWarning(
                "COMM direction=acu_internal event=chat_reset_during_inference deviceId={DeviceId} requestId={RequestId} elapsedMs={ElapsedMs}",
                body.DeviceId, body.RequestId, timer.ElapsedMilliseconds);
            return Conflict(new { error = "The conversation was reset before the answer completed." });
        }
    }

    /// <summary>Idempotently removes one patient's temporary conversation from ACU memory.</summary>
    [HttpPost("reset")]
    [Consumes("application/json")]
    [ProducesResponseType(typeof(object), StatusCodes.Status200OK)]
    [ProducesResponseType(typeof(object), StatusCodes.Status400BadRequest)]
    [ProducesResponseType(typeof(object), StatusCodes.Status403Forbidden)]
    [ProducesResponseType(typeof(object), StatusCodes.Status404NotFound)]
    public async Task<IActionResult> Reset(
        [FromBody] ResetConversationRequest body,
        CancellationToken cancellationToken)
    {
        if (ValidateRobot(body.DeviceId, body.Mac) is { } identityError)
            return identityError;
        if (string.IsNullOrWhiteSpace(body.SessionId))
            return BadRequest(new { error = "Session ID must not be empty" });

        var cleared = await sessionStore.ResetAsync(
            body.DeviceId, body.SessionId, cancellationToken);
        logger.LogInformation(
            "COMM direction=robot_to_acu event=session_reset deviceId={DeviceId} sessionId={SessionId} cleared={Cleared}",
            body.DeviceId, body.SessionId, cleared);
        return Ok(new
        {
            sessionId = body.SessionId,
            cleared,
            resetAt = DateTime.UtcNow.ToString("o")
        });
    }

    /// <summary>
    /// Generates offline speech and streams it as a WAV response. Audio is never persisted.
    /// </summary>
    [HttpPost("tts")]
    [Consumes("application/json")]
    [Produces("audio/wav", "application/json")]
    [ProducesResponseType(StatusCodes.Status200OK)]
    [ProducesResponseType(typeof(object), StatusCodes.Status400BadRequest)]
    [ProducesResponseType(typeof(object), StatusCodes.Status403Forbidden)]
    [ProducesResponseType(typeof(object), StatusCodes.Status404NotFound)]
    [ProducesResponseType(typeof(object), StatusCodes.Status503ServiceUnavailable)]
    public async Task<IActionResult> Synthesize(
        [FromBody] SynthesizeSpeechRequest body,
        CancellationToken cancellationToken)
    {
        if (ValidateRobot(body.DeviceId, body.Mac) is { } identityError)
            return identityError;
        if (string.IsNullOrWhiteSpace(body.Text))
            return BadRequest(new { error = "Speech text must not be empty" });
        if (string.IsNullOrWhiteSpace(body.Language))
            return BadRequest(new { error = "Speech language must not be empty" });

        try
        {
            var timer = Stopwatch.StartNew();
            logger.LogInformation(
                "COMM direction=robot_to_acu event=tts_requested deviceId={DeviceId} language={Language} textChars={TextChars}",
                body.DeviceId, body.Language, body.Text.Trim().Length);
            var audio = await speechSynthesizer.SynthesizeAsync(
                body.Text.Trim(), body.Language, cancellationToken);
            logger.LogInformation(
                "COMM direction=acu_to_robot event=audio_stream deviceId={DeviceId} contentType={ContentType} bytes={Bytes} elapsedMs={ElapsedMs}",
                body.DeviceId, audio.ContentType, audio.WaveData.Length, timer.ElapsedMilliseconds);
            Response.Headers["Cache-Control"] = "no-store";
            Response.Headers["Content-Disposition"] = "inline";
            return File(audio.WaveData, audio.ContentType);
        }
        catch (SpeechSynthesizerUnavailableException error)
        {
            logger.LogWarning(
                "COMM direction=acu_internal event=tts_unavailable deviceId={DeviceId} reason={Reason}",
                body.DeviceId, error.Message);
            return StatusCode(StatusCodes.Status503ServiceUnavailable, new { error = error.Message });
        }
    }

    private IActionResult? ValidateRobot(string deviceId, string mac)
    {
        var devices = deviceStore.Read();
        if (!devices.TryGetValue(deviceId, out var device))
            return NotFound(new { error = "Device not found" });
        if (!string.Equals(device.Mac, mac, StringComparison.OrdinalIgnoreCase))
            return StatusCode(StatusCodes.Status403Forbidden,
                new { error = "MAC address does not match the registered device" });
        if (device.Status != "approved")
            return StatusCode(StatusCodes.Status403Forbidden, new { error = "Device not approved" });
        return null;
    }
}
