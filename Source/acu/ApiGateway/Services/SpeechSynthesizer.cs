using System.ComponentModel;
using System.Diagnostics;
using System.Globalization;

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
/// Offline neural speech adapter for Piper. A short-lived process receives text through
/// standard input and returns WAV bytes through standard output, so patient text and
/// generated audio are never written to disk.
/// </summary>
public sealed class PiperSpeechSynthesizer(IConfiguration configuration) : ISpeechSynthesizer
{
    private readonly bool enabled = configuration.GetValue("Tts:Enabled", true);
    private readonly string executable =
        configuration.GetValue<string>("Tts:PiperExecutable") ?? "python3";
    private readonly string script =
        configuration.GetValue<string>("Tts:PiperScript") ?? "/app/piper_synthesize.py";
    private readonly string modelDirectory =
        configuration.GetValue<string>("Tts:ModelDirectory") ?? "/models";
    private readonly string englishVoice =
        configuration.GetValue<string>("Tts:EnglishVoice") ?? "en_US-lessac-medium";
    private readonly string germanVoice =
        configuration.GetValue<string>("Tts:GermanVoice") ?? "de_DE-thorsten-medium";
    private readonly string chineseVoice =
        configuration.GetValue<string>("Tts:ChineseVoice") ?? "zh_CN-huayan-medium";
    private readonly double lengthScale = Math.Clamp(
        configuration.GetValue("Tts:LengthScale", 1.0), 0.5, 2.0);
    private readonly double sentenceSilenceSeconds = Math.Clamp(
        configuration.GetValue("Tts:SentenceSilenceSeconds", 0.15), 0.0, 2.0);
    private readonly int timeoutSeconds = Math.Clamp(
        configuration.GetValue("Tts:TimeoutSeconds", 60), 5, 180);

    public async Task<SynthesizedSpeech> SynthesizeAsync(
        string text,
        string language,
        CancellationToken cancellationToken)
    {
        if (!enabled)
            throw new SpeechSynthesizerUnavailableException("Local text-to-speech is disabled.");

        var voice = MapVoice(language);
        var modelPath = Path.Combine(modelDirectory, $"{voice}.onnx");
        var configPath = $"{modelPath}.json";
        if (!File.Exists(modelPath) || !File.Exists(configPath))
        {
            throw new SpeechSynthesizerUnavailableException(
                $"Piper voice '{voice}' is not installed in '{modelDirectory}'.");
        }

        var startInfo = new ProcessStartInfo
        {
            FileName = executable,
            RedirectStandardInput = true,
            RedirectStandardOutput = true,
            RedirectStandardError = true,
            UseShellExecute = false,
            CreateNoWindow = true
        };
        startInfo.ArgumentList.Add(script);
        startInfo.ArgumentList.Add("--model");
        startInfo.ArgumentList.Add(modelPath);
        startInfo.ArgumentList.Add("--config");
        startInfo.ArgumentList.Add(configPath);
        startInfo.ArgumentList.Add("--length-scale");
        startInfo.ArgumentList.Add(lengthScale.ToString(CultureInfo.InvariantCulture));
        startInfo.ArgumentList.Add("--sentence-silence");
        startInfo.ArgumentList.Add(sentenceSilenceSeconds.ToString(CultureInfo.InvariantCulture));

        using var process = new Process { StartInfo = startInfo };
        try
        {
            if (!process.Start())
                throw new SpeechSynthesizerUnavailableException("The Piper process could not be started.");
        }
        catch (Win32Exception error)
        {
            throw new SpeechSynthesizerUnavailableException(
                $"The configured Piper executable '{executable}' was not found.", error);
        }

        using var timeout = CancellationTokenSource.CreateLinkedTokenSource(cancellationToken);
        timeout.CancelAfter(TimeSpan.FromSeconds(timeoutSeconds));
        try
        {
            var standardErrorTask = process.StandardError.ReadToEndAsync(timeout.Token);
            await process.StandardInput.WriteAsync(text.AsMemory(), timeout.Token);
            process.StandardInput.Close();

            await using var output = new MemoryStream();
            var copyTask = process.StandardOutput.BaseStream.CopyToAsync(output, timeout.Token);
            await Task.WhenAll(copyTask, process.WaitForExitAsync(timeout.Token));
            var standardError = await standardErrorTask;

            if (process.ExitCode != 0)
            {
                throw new SpeechSynthesizerUnavailableException(
                    $"Piper failed with exit code {process.ExitCode}: {SanitizeError(standardError)}");
            }

            var wave = output.ToArray();
            if (!IsWave(wave))
                throw new SpeechSynthesizerUnavailableException("Piper returned invalid WAV data.");

            return new SynthesizedSpeech(wave);
        }
        catch (OperationCanceledException) when (!cancellationToken.IsCancellationRequested)
        {
            Kill(process);
            throw new SpeechSynthesizerUnavailableException(
                $"Piper did not finish within {timeoutSeconds} seconds.");
        }
        catch (OperationCanceledException)
        {
            Kill(process);
            throw;
        }
    }

    private string MapVoice(string language)
    {
        var primary = language
            .Split('-', StringSplitOptions.RemoveEmptyEntries)
            .FirstOrDefault()?.ToLowerInvariant() ?? "en";
        return primary switch
        {
            "de" => germanVoice,
            "zh" => chineseVoice,
            _ => englishVoice
        };
    }

    private static bool IsWave(byte[] wave) =>
        wave.Length >= 44 && wave[0] == (byte)'R' && wave[1] == (byte)'I' &&
        wave[2] == (byte)'F' && wave[3] == (byte)'F';

    private static void Kill(Process process)
    {
        if (!process.HasExited)
            process.Kill(entireProcessTree: true);
    }

    private static string SanitizeError(string error)
    {
        var value = error.Replace('\r', ' ').Replace('\n', ' ').Trim();
        return value.Length <= 300 ? value : value[..300];
    }
}

/// <summary>
/// Explicit low-resource fallback adapter for eSpeak NG. Audio is read from the child
/// process directly into memory; neither input text nor generated WAV is written to disk.
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
