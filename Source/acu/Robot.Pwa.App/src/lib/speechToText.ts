import type { HandsFreeSpeechOptions, SpeechToText } from "./speechTypes";

class UnsupportedSpeechToText implements SpeechToText {
  async start(_options: HandsFreeSpeechOptions): Promise<void> {
    throw new Error("Hands-free local speech recognition is only available in the Android build.");
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
