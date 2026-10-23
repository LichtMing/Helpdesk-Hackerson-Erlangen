let audioContext: AudioContext | null = null;

function getAudioContext(): AudioContext {
  if (!audioContext) audioContext = new AudioContext();
  return audioContext;
}

export async function prepareWavePlayback(): Promise<void> {
  const context = getAudioContext();
  if (context.state === "suspended") await context.resume();
}

export async function playWaveResponse(audio: ArrayBuffer, _requestId: string): Promise<void> {
  const context = getAudioContext();
  if (context.state === "suspended") await context.resume();

  const decoded = await context.decodeAudioData(audio.slice(0));
  const source = context.createBufferSource();
  source.buffer = decoded;
  source.connect(context.destination);

  await new Promise<void>((resolve, reject) => {
    source.addEventListener("ended", () => resolve(), { once: true });
    try {
      source.start();
    } catch (error) {
      reject(error instanceof Error ? error : new Error(String(error)));
    }
  });
}
