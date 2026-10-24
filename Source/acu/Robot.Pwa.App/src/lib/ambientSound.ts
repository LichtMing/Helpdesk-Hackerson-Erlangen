export type AmbientSoundLevel = "listening" | "speaking" | "paused";

// Non-Android platforms (web/iOS) keep the conversation silent; the robot
// ambience is only bundled and played in the Android app.
export async function startAmbientSound(): Promise<void> {}

export async function pauseAmbientSound(): Promise<void> {}

export async function resumeAmbientSound(): Promise<void> {}

export async function stopAmbientSound(): Promise<void> {}

export function setAmbientSoundLevel(_level: AmbientSoundLevel): void {}
