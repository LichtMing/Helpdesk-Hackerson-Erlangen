export type SpeechLanguage = "auto" | "en" | "de" | "zh";

export type SpeechState =
  | "initializing"
  | "listening"
  | "speech-detected"
  | "transcribing"
  | "delivering"
  | "stopped";

export interface HandsFreeSpeechOptions {
  getLanguage: () => SpeechLanguage;
  onStateChange: (state: SpeechState) => void;
  onTranscript: (text: string, language: SpeechLanguage) => Promise<void>;
  onError: (error: Error) => void;
}

export interface SpeechToText {
  start(options: HandsFreeSpeechOptions): Promise<void>;
  stop(): Promise<void>;
  release(): Promise<void>;
  isListening(): boolean;
}

export const WHISPER_MODEL_ASSET = "models/ggml-base.bin";
export const VAD_MODEL_ASSET = "models/ggml-silero-v6.2.0.bin";
