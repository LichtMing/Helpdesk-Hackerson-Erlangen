import { PermissionsAndroid } from "react-native";
import { initWhisper, type WhisperContext } from "whisper.rn/index";
import { AudioPcmStreamAdapter } from "whisper.rn/realtime-transcription/adapters/AudioPcmStreamAdapter";

import {
  WHISPER_MODEL_ASSET,
  type SpeechLanguage,
  type SpeechToText,
} from "./speechTypes";

const SAMPLE_RATE = 16_000;
const CHANNELS = 1;
const BITS_PER_SAMPLE = 16;
const MAX_RECORDING_BYTES = SAMPLE_RATE * (BITS_PER_SAMPLE / 8) * 60;

class AndroidWhisperSpeechToText implements SpeechToText {
  private context: WhisperContext | null = null;
  private initialization: Promise<void> | null = null;
  private readonly audioStream = new AudioPcmStreamAdapter();
  private chunks: Uint8Array[] = [];
  private byteCount = 0;
  private recording = false;
  private streamError: string | null = null;

  initialize(): Promise<void> {
    if (this.context) return Promise.resolve();
    if (this.initialization) return this.initialization;

    const initialization = initWhisper({
      filePath: WHISPER_MODEL_ASSET,
      isBundleAsset: true,
      useGpu: true,
      useFlashAttn: true,
    })
      .then((context) => {
        this.context = context;
      })
      .catch((error: unknown) => {
        const detail = error instanceof Error ? error.message : String(error);
        throw new Error(
          `无法加载 Whisper 模型 ${WHISPER_MODEL_ASSET}。请先按 android/app/src/main/assets/models/README.md 部署模型。${detail}`,
        );
      })
      .finally(() => {
        this.initialization = null;
      });

    this.initialization = initialization;
    return initialization;
  }

  async start(): Promise<void> {
    if (this.recording) return;

    const permission = await PermissionsAndroid.request(
      PermissionsAndroid.PERMISSIONS.RECORD_AUDIO,
      {
        title: "Microphone permission",
        message: "The robot needs microphone access to transcribe a patient's question locally.",
        buttonPositive: "Allow",
        buttonNegative: "Cancel",
      },
    );

    if (permission !== PermissionsAndroid.RESULTS.GRANTED) {
      throw new Error("麦克风权限未授予，无法开始语音识别。");
    }

    await this.initialize();

    this.chunks = [];
    this.byteCount = 0;
    this.streamError = null;

    this.audioStream.onData(({ data }) => {
      if (this.byteCount + data.byteLength > MAX_RECORDING_BYTES) {
        this.streamError = "单次录音最长 60 秒，请停止后重新提问。";
        return;
      }

      // The native recorder may reuse its buffer, so retain an owned copy.
      const copy = new Uint8Array(data.byteLength);
      copy.set(data);
      this.chunks.push(copy);
      this.byteCount += copy.byteLength;
    });
    this.audioStream.onError((error) => {
      this.streamError = error;
    });

    await this.audioStream.initialize({
      sampleRate: SAMPLE_RATE,
      channels: CHANNELS,
      bitsPerSample: BITS_PER_SAMPLE,
      audioSource: 6,
      bufferSize: 16 * 1024,
    });
    await this.audioStream.start();
    this.recording = true;
  }

  async stop(language: SpeechLanguage = "auto"): Promise<string> {
    if (!this.recording) {
      throw new Error("当前没有正在进行的录音。");
    }

    await this.audioStream.stop();
    this.recording = false;

    if (this.streamError) throw new Error(this.streamError);
    if (!this.context) throw new Error("Whisper 模型尚未初始化。");
    if (this.byteCount < SAMPLE_RATE * (BITS_PER_SAMPLE / 8)) {
      throw new Error("录音不足 1 秒，请重新录制完整问题。");
    }

    const pcm = new ArrayBuffer(this.byteCount);
    const output = new Uint8Array(pcm);
    let offset = 0;
    for (const chunk of this.chunks) {
      output.set(chunk, offset);
      offset += chunk.byteLength;
    }

    this.chunks = [];
    this.byteCount = 0;

    const { promise } = this.context.transcribeData(pcm, {
      language,
      translate: false,
      maxThreads: 4,
    });
    const result = await promise;
    const text = result.result.trim();

    if (!text) throw new Error("没有识别到语音，请靠近麦克风后重试。");
    return text;
  }

  isRecording(): boolean {
    return this.recording;
  }

  async release(): Promise<void> {
    if (this.recording) await this.audioStream.stop();
    this.recording = false;
    await this.audioStream.release();
    if (this.context) await this.context.release();
    this.context = null;
  }
}

export function createSpeechToText(): SpeechToText {
  return new AndroidWhisperSpeechToText();
}
