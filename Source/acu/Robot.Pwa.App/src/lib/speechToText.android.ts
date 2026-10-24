import { PermissionsAndroid } from "react-native";
import {
  initWhisper,
  initWhisperVad,
  type WhisperContext,
  type WhisperVadContext,
} from "whisper.rn/index";
import { AudioPcmStreamAdapter } from "whisper.rn/realtime-transcription/adapters/AudioPcmStreamAdapter";
import { RingBufferVad } from "whisper.rn/realtime-transcription/RingBufferVad";

import {
  VAD_MODEL_ASSET,
  WHISPER_MODEL_ASSET,
  type HandsFreeSpeechOptions,
  type SpeechLanguage,
  type SpeechToText,
} from "./speechTypes";

const SAMPLE_RATE = 16_000;
const CHANNELS = 1;
const BITS_PER_SAMPLE = 16;
const MIN_RECORDING_BYTES = SAMPLE_RATE * (BITS_PER_SAMPLE / 8);
const MAX_RECORDING_BYTES = MIN_RECORDING_BYTES * 30;

class AndroidHandsFreeSpeechToText implements SpeechToText {
  private whisperContext: WhisperContext | null = null;
  private vadContext: WhisperVadContext | null = null;
  private vad: RingBufferVad | null = null;
  private initialization: Promise<void> | null = null;
  private readonly audioStream = new AudioPcmStreamAdapter();
  private options: HandsFreeSpeechOptions | null = null;
  private chunks: Uint8Array[] = [];
  private byteCount = 0;
  private startRequested = false;
  private running = false;
  private processing = false;
  private streamError: string | null = null;
  private activeTranscriptionStop: (() => Promise<void>) | null = null;
  private processingPromise: Promise<void> | null = null;
  private lastStopAt = 0;

  private initialize(): Promise<void> {
    if (this.whisperContext && this.vadContext && this.vad) {
      return Promise.resolve();
    }
    if (this.initialization) return this.initialization;

    // Initialize sequentially because both contexts share the same JSI bridge.
    const initialization = (async () => {
      this.whisperContext = await initWhisper({
        filePath: WHISPER_MODEL_ASSET,
        isBundleAsset: true,
        useGpu: true,
        useFlashAttn: true,
      });
      this.vadContext = await initWhisperVad({
        filePath: VAD_MODEL_ASSET,
        isBundleAsset: true,
        useGpu: false,
        nThreads: 2,
      });

      this.vad = new RingBufferVad(this.vadContext, {
        sampleRate: SAMPLE_RATE,
        preRecordingBufferMs: 1_000,
        inferenceIntervalMs: 500,
        speechRateThreshold: 0.3,
        vadOptions: {
          threshold: 0.5,
          minSpeechDurationMs: 250,
          minSilenceDurationMs: 700,
          maxSpeechDurationS: 30,
          speechPadMs: 100,
          samplesOverlap: 0.1,
        },
      });
      this.bindVadCallbacks(this.vad);
    })()
      .catch((error: unknown) => {
        const detail = error instanceof Error ? error.message : String(error);
        throw new Error(
          `无法加载离线语音模型。请按 android/app/src/main/assets/models/README.md 部署 ${WHISPER_MODEL_ASSET} 和 ${VAD_MODEL_ASSET}。${detail}`,
        );
      })
      .finally(() => {
        this.initialization = null;
      });

    this.initialization = initialization;
    return initialization;
  }

  async start(options: HandsFreeSpeechOptions): Promise<void> {
    if (this.startRequested) return;
    this.startRequested = true;
    this.options = options;
    this.options.onStateChange("initializing");

    try {
      const permission = await PermissionsAndroid.request(
        PermissionsAndroid.PERMISSIONS.RECORD_AUDIO,
        {
          title: "Microphone permission",
          message: "The robot listens locally so patients can speak without pressing a button.",
          buttonPositive: "Allow",
          buttonNegative: "Cancel",
        },
      );
      if (permission !== PermissionsAndroid.RESULTS.GRANTED) {
        throw new Error("麦克风权限未授予，免按键对话无法启动。");
      }

      await this.initialize();
      if (!this.startRequested) return;
      if (!this.vad) throw new Error("语音活动检测尚未初始化。");

      this.running = true;
      this.resetUtterance();
      await this.openMicrophone();
      this.options.onStateChange("listening");
    } catch (error) {
      this.startRequested = false;
      this.running = false;
      throw error;
    }
  }

  // The native recorder frees itself every time it stops, so it must be
  // created again before each new question (otherwise only question 1 works).
  private async openMicrophone(): Promise<void> {
    const sinceStop = Date.now() - this.lastStopAt;
    if (sinceStop < 800) await new Promise((resolve) => setTimeout(resolve, 800 - sinceStop));
    await this.audioStream.initialize({
      sampleRate: SAMPLE_RATE,
      channels: CHANNELS,
      bitsPerSample: BITS_PER_SAMPLE,
      audioSource: 6,
      bufferSize: 16 * 1024,
    });
    this.audioStream.onData(({ data }) => {
      if (this.running && !this.processing) this.vad?.processAudio(data);
    });
    this.audioStream.onError((error) => this.reportError(new Error(error)));
    await this.audioStream.start();
  }

  private bindVadCallbacks(vad: RingBufferVad): void {
    vad.onSpeechStart((_confidence, data) => {
      if (!this.running || this.processing) return;
      this.resetUtterance();
      this.appendAudio(data);
      this.options?.onStateChange("speech-detected");
    });
    vad.onSpeechContinue((_confidence, data) => {
      if (!this.running || this.processing) return;
      this.appendAudio(data);
    });
    vad.onSpeechEnd(() => {
      if (!this.running || this.processing) return;
      this.processingPromise = this.processUtterance().finally(() => {
        this.processingPromise = null;
      });
    });
    vad.onError((error) => this.reportError(new Error(error)));
  }

  private appendAudio(data: Uint8Array): void {
    if (this.byteCount + data.byteLength > MAX_RECORDING_BYTES) {
      this.streamError = "单句话最长 30 秒，请停顿后重新提问。";
      return;
    }
    const copy = new Uint8Array(data.byteLength);
    copy.set(data);
    this.chunks.push(copy);
    this.byteCount += copy.byteLength;
  }

  private async processUtterance(): Promise<void> {
    this.processing = true;
    try {
      await this.audioStream.stop();
      this.lastStopAt = Date.now();
      if (this.streamError) throw new Error(this.streamError);
      if (!this.whisperContext) throw new Error("Whisper 模型尚未初始化。");
      if (this.byteCount < MIN_RECORDING_BYTES) return;

      this.options?.onStateChange("transcribing");
      const pcm = new ArrayBuffer(this.byteCount);
      const output = new Uint8Array(pcm);
      let offset = 0;
      for (const chunk of this.chunks) {
        output.set(chunk, offset);
        offset += chunk.byteLength;
      }

      const transcription = this.whisperContext.transcribeData(pcm, {
        language: this.options?.getLanguage() ?? "auto",
        translate: false,
        maxThreads: 4,
      });
      this.activeTranscriptionStop = transcription.stop;
      const result = await transcription.promise;
      this.activeTranscriptionStop = null;
      const text = result.result.trim();
      if (!text) throw new Error("检测到说话，但没有识别出文字。");
      const configuredLanguage = this.options?.getLanguage() ?? "auto";
      const detectedLanguage =
        configuredLanguage === "auto" && isSpeechLanguage(result.language)
          ? result.language
          : configuredLanguage;

      this.options?.onStateChange("delivering");
      await this.options?.onTranscript(text, detectedLanguage);
    } catch (error) {
      this.reportError(error instanceof Error ? error : new Error(String(error)));
    } finally {
      this.activeTranscriptionStop = null;
      this.resetUtterance();
      await this.vad?.reset();
      this.processing = false;

      if (this.running) {
        try {
          await this.openMicrophone();
          this.options?.onStateChange("listening");
        } catch (error) {
          this.running = false;
          this.reportError(error instanceof Error ? error : new Error(String(error)));
        }
      }
    }
  }

  private resetUtterance(): void {
    this.chunks = [];
    this.byteCount = 0;
    this.streamError = null;
  }

  private reportError(error: Error): void {
    this.options?.onError(error);
  }

  async stop(): Promise<void> {
    this.startRequested = false;
    this.running = false;
    if (this.initialization) {
      try {
        await this.initialization;
      } catch {
        // The original start call reports initialization failures.
      }
    }
    if (this.audioStream.isRecording()) {
      await this.audioStream.stop();
      this.lastStopAt = Date.now();
    }
    if (this.activeTranscriptionStop) await this.activeTranscriptionStop();
    if (this.processingPromise) await this.processingPromise;
    await this.vad?.reset();
    this.options?.onStateChange("stopped");
  }

  isListening(): boolean {
    return this.running;
  }

  async release(): Promise<void> {
    await this.stop();
    await this.audioStream.release();
    await this.vadContext?.release();
    await this.whisperContext?.release();
    this.vad = null;
    this.vadContext = null;
    this.whisperContext = null;
    this.options = null;
  }
}

export function createSpeechToText(): SpeechToText {
  return new AndroidHandsFreeSpeechToText();
}

function isSpeechLanguage(value: string): value is Exclude<SpeechLanguage, "auto"> {
  return value === "en" || value === "de" || value === "zh";
}
