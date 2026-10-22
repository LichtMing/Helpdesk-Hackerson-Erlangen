export type SpeechLanguage = "auto" | "en" | "de" | "zh";

export interface SpeechToText {
  initialize(): Promise<void>;
  start(): Promise<void>;
  stop(language?: SpeechLanguage): Promise<string>;
  release(): Promise<void>;
  isRecording(): boolean;
}

export const WHISPER_MODEL_ASSET = "models/ggml-base.bin";

