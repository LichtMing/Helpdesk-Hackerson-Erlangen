export async function prepareWavePlayback(): Promise<void> {}

export async function playWaveResponse(_audio: ArrayBuffer, _requestId: string): Promise<void> {
  throw new Error("Answer audio playback is only available in the Android app.");
}
