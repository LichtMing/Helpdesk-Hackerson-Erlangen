import { createHash } from "node:crypto";
import {
  createReadStream,
  createWriteStream,
  existsSync,
  mkdirSync,
  renameSync,
  rmSync,
  statSync,
} from "node:fs";
import { fileURLToPath } from "node:url";
import { join } from "node:path";
import { Readable } from "node:stream";
import { pipeline } from "node:stream/promises";

const projectRoot = fileURLToPath(new URL("..", import.meta.url));
const modelDirectory = join(projectRoot, "android", "app", "src", "main", "assets", "models");
const checkOnly = process.argv.includes("--check");

const models = [
  {
    name: "ggml-tiny.bin",
    url: "https://huggingface.co/ggerganov/whisper.cpp/resolve/5359861c739e955e79d9a303bcbc70fb988958b1f/ggml-tiny.bin",
    size: 77_691_713,
    sha256: "be07e048e1e599ad46341c8d2a135645097a538221678b7acdd1b1919c6e1b21",
  },
  {
    name: "ggml-silero-v6.2.0.bin",
    url: "https://huggingface.co/ggml-org/whisper-vad/resolve/9ffd54a1e1ee413ddf265af9913beaf518d1639b/ggml-silero-v6.2.0.bin",
    size: 885_098,
    sha256: "2aa269b785eeb53a82983a20501ddf7c1d9c48e33ab63a41391ac6c9f7fb6987",
  },
];

async function sha256(path) {
  const hash = createHash("sha256");
  for await (const chunk of createReadStream(path)) hash.update(chunk);
  return hash.digest("hex");
}

async function verify(model, path) {
  if (!existsSync(path)) return { valid: false, reason: "missing" };
  const actualSize = statSync(path).size;
  if (actualSize !== model.size) {
    return { valid: false, reason: `size ${actualSize}, expected ${model.size}` };
  }
  const actualHash = await sha256(path);
  if (actualHash !== model.sha256) {
    return { valid: false, reason: `SHA-256 ${actualHash}, expected ${model.sha256}` };
  }
  return { valid: true };
}

async function download(model, destination) {
  const temporary = `${destination}.download`;
  rmSync(temporary, { force: true });
  const response = await fetch(model.url, { redirect: "follow" });
  if (!response.ok || !response.body) {
    throw new Error(`Download failed for ${model.name}: HTTP ${response.status}`);
  }

  try {
    await pipeline(Readable.fromWeb(response.body), createWriteStream(temporary));
    const result = await verify(model, temporary);
    if (!result.valid) throw new Error(`Verification failed for ${model.name}: ${result.reason}`);
    rmSync(destination, { force: true });
    renameSync(temporary, destination);
  } catch (error) {
    rmSync(temporary, { force: true });
    throw error;
  }
}

mkdirSync(modelDirectory, { recursive: true });
let failed = false;

for (const model of models) {
  const destination = join(modelDirectory, model.name);
  const result = await verify(model, destination);
  if (result.valid) {
    console.log(`OK ${model.name}`);
    continue;
  }

  if (checkOnly) {
    console.error(`MISSING/INVALID ${model.name}: ${result.reason}`);
    failed = true;
    continue;
  }

  console.log(`Downloading ${model.name}…`);
  await download(model, destination);
  console.log(`OK ${model.name}`);
}

if (failed) {
  console.error("Run 'npm run models:prepare' before building the Android app.");
  process.exitCode = 1;
}
