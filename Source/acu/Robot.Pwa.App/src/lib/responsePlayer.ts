export async function prepareWavePlayback(): Promise<void> {}

export async function playWaveResponse(_audio: ArrayBuffer, _requestId: string): Promise<void> {
  throw new Error("回答语音播放仅支持 Android 应用。");
}
