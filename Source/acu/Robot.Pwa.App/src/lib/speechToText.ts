import type { SpeechLanguage, SpeechToText } from "./speechTypes";

class UnsupportedSpeechToText implements SpeechToText {
  async initialize(): Promise<void> {
    throw new Error("本地 Whisper 语音识别目前只集成到 Android 构建中。");
  }

  async start(): Promise<void> {
    return this.initialize();
  }

  async stop(_language?: SpeechLanguage): Promise<string> {
    return this.initialize().then(() => "");
  }

  async release(): Promise<void> {}

  isRecording(): boolean {
    return false;
  }
}

export function createSpeechToText(): SpeechToText {
  return new UnsupportedSpeechToText();
}

