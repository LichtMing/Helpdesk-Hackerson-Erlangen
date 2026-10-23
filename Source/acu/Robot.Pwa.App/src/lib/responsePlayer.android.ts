import { createAudioPlayer, setAudioModeAsync } from "expo-audio";
import { File, Paths } from "expo-file-system";

export async function prepareWavePlayback(): Promise<void> {}

export async function playWaveResponse(audio: ArrayBuffer, requestId: string): Promise<void> {
  const safeId = requestId.replace(/[^a-zA-Z0-9_-]/g, "").slice(0, 80) || "response";
  const file = new File(Paths.cache, `acu-${safeId}.wav`);
  if (file.exists) file.delete();
  file.create();
  let player: ReturnType<typeof createAudioPlayer> | null = null;

  try {
    file.write(new Uint8Array(audio));
    await setAudioModeAsync({
      playsInSilentMode: true,
      interruptionMode: "doNotMix",
      allowsRecording: false,
      shouldPlayInBackground: false,
      shouldRouteThroughEarpiece: false,
    });

    player = createAudioPlayer(file.uri, {
      updateInterval: 100,
      keepAudioSessionActive: false,
    });

    await new Promise<void>((resolve, reject) => {
      let settled = false;
      let timeout: ReturnType<typeof setTimeout> | null = null;
      let subscription: { remove(): void } | null = null;
      const finish = (error?: Error) => {
        if (settled) return;
        settled = true;
        if (timeout) clearTimeout(timeout);
        subscription?.remove();
        if (error) reject(error); else resolve();
      };
      subscription = player?.addListener("playbackStatusUpdate", (status) => {
        if (status.didJustFinish) finish();
      }) ?? null;
      timeout = setTimeout(
        () => finish(new Error("回答音频播放超时。")),
        120_000,
      );

      try {
        player?.play();
      } catch (error) {
        finish(error instanceof Error ? error : new Error(String(error)));
      }
    });
  } finally {
    player?.remove();
    if (file.exists) file.delete();
  }
}
