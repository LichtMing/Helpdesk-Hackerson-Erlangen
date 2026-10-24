import { createAudioPlayer, setAudioModeAsync } from "expo-audio";

import ambienceLoop from "../../assets/audio/ambience-loop.wav";
import type { AmbientSoundLevel } from "./ambientSound";

// The loop itself peaks around -12 dBFS. Keeping the player volume low makes
// the pad a background bed instead of competing with the robot's voice.
const LEVEL_VOLUME: Record<AmbientSoundLevel, number> = {
  listening: 0.30,
  speaking: 0.12,
  paused: 0,
};

const FADE_STEP_MS = 25;
const FADE_STEPS = 12;

let player: ReturnType<typeof createAudioPlayer> | null = null;
let preparing: Promise<void> | null = null;
let level: AmbientSoundLevel = "listening";
let active = false;
let fadeTimer: ReturnType<typeof setInterval> | null = null;
let fadeToken = 0;
let lifecycleToken = 0;

function stopFade(): void {
  fadeToken += 1;
  if (fadeTimer) {
    clearInterval(fadeTimer);
    fadeTimer = null;
  }
}

function fadeTo(target: number, pauseWhenDone = false): void {
  const current = player;
  if (!current) return;

  stopFade();
  const token = fadeToken;
  const start = current.volume;
  let step = 0;

  fadeTimer = setInterval(() => {
    if (!player || token !== fadeToken) {
      if (fadeTimer) clearInterval(fadeTimer);
      fadeTimer = null;
      return;
    }

    step += 1;
    player.volume = start + (target - start) * (step / FADE_STEPS);

    if (step >= FADE_STEPS) {
      if (fadeTimer) clearInterval(fadeTimer);
      fadeTimer = null;
      if (pauseWhenDone) player.pause();
    }
  }, FADE_STEP_MS);
}

async function preparePlayer(): Promise<void> {
  if (player) return;
  if (preparing) return preparing;

  const token = lifecycleToken;
  preparing = (async () => {
    // Mix with other audio so the TTS player keeps priority, and route to the
    // main speaker instead of the earpiece.
    await setAudioModeAsync({
      playsInSilentMode: true,
      interruptionMode: "mixWithOthers",
      allowsRecording: true,
      shouldPlayInBackground: false,
      shouldRouteThroughEarpiece: false,
    });

    const next = createAudioPlayer(ambienceLoop, {
      updateInterval: 1000,
      keepAudioSessionActive: true,
    });
    next.loop = true;
    next.volume = 0;
    next.play();

    // stopAmbientSound() may have run while the async setup was in flight.
    if (token !== lifecycleToken) {
      next.pause();
      next.remove();
      return;
    }
    player = next;
  })().finally(() => {
    preparing = null;
  });

  return preparing;
}

export async function startAmbientSound(): Promise<void> {
  active = true;
  try {
    await preparePlayer();
  } catch {
    // Ambience is optional: never block the conversation if playback fails.
    active = false;
    return;
  }
  if (!active || !player) return;
  player.play();
  fadeTo(LEVEL_VOLUME[level]);
}

export async function pauseAmbientSound(): Promise<void> {
  active = false;
  // Pause immediately when the app goes to the background: JS timers can be
  // throttled there, so a fade-out might never finish.
  stopFade();
  player?.pause();
}

export async function resumeAmbientSound(): Promise<void> {
  active = true;
  try {
    await preparePlayer();
  } catch {
    active = false;
    return;
  }
  if (!active || !player) return;
  if (level === "paused") return;
  player.play();
  fadeTo(LEVEL_VOLUME[level]);
}

export async function stopAmbientSound(): Promise<void> {
  active = false;
  lifecycleToken += 1;
  stopFade();
  player?.pause();
  player?.remove();
  player = null;
}

export function setAmbientSoundLevel(next: AmbientSoundLevel): void {
  level = next;
  if (!active || !player) return;
  if (next !== "paused" && !player.playing) player.play();
  fadeTo(LEVEL_VOLUME[next], next === "paused");
}
