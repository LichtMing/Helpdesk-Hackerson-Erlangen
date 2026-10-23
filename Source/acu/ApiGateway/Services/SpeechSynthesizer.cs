using System.ComponentModel;
using System.Diagnostics;

namespace AcuApiGateway.Services;

public sealed record SynthesizedSpeech(byte[] WaveData, string ContentType = "audio/wav");

public interface ISpeechSynthesizer
{
    Task<SynthesizedSpeech> SynthesizeAsync(
        string text,
        string language,
        CancellationToken cancellationToken);
}

public sealed class SpeechSynthesizerUnavailableException(string message, Exception? inner = null)
    : Exception(message, inner);

/// <summary>
/// Offline prototype adapter for eSpeak NG. Audio is read from the child process directly
/// into memory; neither the input text nor the generated WAV is written to disk.
/// This adapter can later be replaced by Piper without changing the HTTP contract.
/// </summary>
public sealed class EspeakSpeechSynthesizer(IConfiguration configuration) : ISpeechSynthesizer
{
    private readonly bool enabled = configuration.GetValue("Tts:Enabled", true);
    private readonly string executable = configuration.GetValue<string>("Tts:Executable") ?? "espeak-ng";
    private readonly int wordsPerMinute = Math.Clamp(configuration.GetValue("Tts:WordsPerMinute", 155), 80, 300);

    public async Task<SynthesizedSpeech> SynthesizeAsync(
        string text,
        string language,
        CancellationToken cancellationToken)
    {
        if (!enabled)
            throw new SpeechSynthesizerUnavailableException("Local text-to-speech is disabled.");

        var startInfo = new ProcessStartInfo
        {
            FileName = executable,
            RedirectStandardInput = true,
            RedirectStandardOutput = true,
            RedirectStandardError = true,
            UseShellExecute = false,
            CreateNoWindow = true
        };
        startInfo.ArgumentList.Add("--stdout");
        startInfo.ArgumentList.Add("--stdin");
        startInfo.ArgumentList.Add("-v");
        startInfo.ArgumentList.Add(MapVoice(language));
        startInfo.ArgumentList.Add("-s");
        startInfo.ArgumentList.Add(wordsPerMinute.ToString(System.Globalization.CultureInfo.InvariantCulture));

        using var process = new Process { StartInfo = startInfo };
        try
        {
            if (!process.Start())
                throw new SpeechSynthesizerUnavailableException("The local text-to-speech process could not be started.");
        }
        catch (Win32Exception error)
        {
            throw new SpeechSynthesizerUnavailableException(
                $"The configured text-to-speech executable '{executable}' was not found.", error);
        }

        try
        {
            var errorTask = process.StandardError.ReadToEndAsync(cancellationToken);
            await process.StandardInput.WriteAsync(text.AsMemory(), cancellationToken);
            process.StandardInput.Close();

            await using var output = new MemoryStream();
            var copyTask = process.StandardOutput.BaseStream.CopyToAsync(output, cancellationToken);
            await Task.WhenAll(copyTask, process.WaitForExitAsync(cancellationToken));
            var standardError = await errorTask;

            if (process.ExitCode != 0)
            {
                throw new SpeechSynthesizerUnavailableException(
                    $"Local text-to-speech failed with exit code {process.ExitCode}: {SanitizeError(standardError)}");
            }

            var wave = output.ToArray();
            if (wave.Length < 44 || wave[0] != (byte)'R' || wave[1] != (byte)'I' ||
                wave[2] != (byte)'F' || wave[3] != (byte)'F')
            {
                throw new SpeechSynthesizerUnavailableException(
                    "Local text-to-speech returned invalid WAV data.");
            }

            return new SynthesizedSpeech(wave);
        }
        catch (OperationCanceledException)
        {
            if (!process.HasExited)
                process.Kill(entireProcessTree: true);
            throw;
        }
    }

    private static string MapVoice(string language)
    {
        var primary = language
            .Split('-', StringSplitOptions.RemoveEmptyEntries)
            .FirstOrDefault()?.ToLowerInvariant() ?? "en";
        return primary switch
        {
            "de" => "de",
            "zh" => "cmn",
            _ => "en-us"
        };
    }

    private static string SanitizeError(string error)
    {
        var value = error.Replace('\r', ' ').Replace('\n', ' ').Trim();
        return value.Length <= 300 ? value : value[..300];
    }
}
