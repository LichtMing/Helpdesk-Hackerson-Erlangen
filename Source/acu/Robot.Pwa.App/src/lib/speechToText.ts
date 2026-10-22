import type { HandsFreeSpeechOptions, SpeechToText } from "./speechTypes";

class UnsupportedSpeechToText implements SpeechToText {
  async start(_options: HandsFreeSpeechOptions): Promise<void> {
    throw new Error("免按键本地语音识别目前只集成到 Android 构建中。");
  }

  async stop(): Promise<void> {}

  async release(): Promise<void> {}

  isListening(): boolean {
    return false;
  }
}

export function createSpeechToText(): SpeechToText {
  return new UnsupportedSpeechToText();
}
