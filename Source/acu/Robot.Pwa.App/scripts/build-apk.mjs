import { copyFileSync, existsSync, mkdirSync } from "node:fs";
import { join } from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const projectRoot = fileURLToPath(new URL("..", import.meta.url));
const androidDirectory = join(projectRoot, "android");
const modelScript = join(projectRoot, "scripts", "prepare-speech-models.mjs");

function run(command, args, cwd) {
  const result = spawnSync(command, args, { cwd, stdio: "inherit" });
  if (result.error) throw result.error;
  if (result.status !== 0) process.exit(result.status ?? 1);
}

run(process.execPath, [modelScript, "--check"], projectRoot);

if (process.platform === "win32") {
  // Node cannot spawn .bat files directly on Windows (EINVAL), so run the
  // wrapper through the command processor.
  run("cmd.exe", ["/d", "/s", "/c", "gradlew.bat", "assembleDebug"], androidDirectory);
} else {
  run("bash", ["gradlew", "assembleDebug"], androidDirectory);
}

const source = join(androidDirectory, "app", "build", "outputs", "apk", "debug", "app-debug.apk");
if (!existsSync(source)) throw new Error(`Gradle completed but did not create ${source}`);

const outputDirectory = join(projectRoot, "dist");
const destination = join(outputDirectory, "acu-robot-development.apk");
mkdirSync(outputDirectory, { recursive: true });
copyFileSync(source, destination);
console.log(`Development APK created at ${destination}`);
