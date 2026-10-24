# Reproducibility guide

This guide records the exact toolchain, pinned assets, build commands, and
verification results for the final demo revision. Follow it from a clean clone
to rebuild the same system.

Last verified: **2026-10-24** on Linux (Ubuntu, WSL2) with Docker Desktop.

## 1. Clone

```bash
git clone git@github.com:LichtMing/Helpdesk-Hackerson-Erlangen.git
cd Helpdesk-Hackerson-Erlangen
git switch main
git rev-parse HEAD        # record this in the demo log
```

No generated models, APKs, `dist/`, `bin/`, `obj/`, `node_modules/`, or virtual
environments are committed. Every large asset below is downloaded by a script
or container and verified before use.

## 2. Toolchain matrix

| Tool | Version used | Notes |
| --- | --- | --- |
| Docker Engine / Desktop | Compose v2 | Required for the ACU stack |
| .NET SDK | `10.0` (container image) | Backend is built inside Docker; native builds need the SDK locally |
| Node.js | `22.22.3` | Robot README requires 22.20+; frontend uses Vite 8 |
| npm | `10.9.8` | Lockfiles are committed |
| Python (adapter) | `3.12` (container image) | `helpdesk_api/Dockerfile` |
| Python (host scripts) | `3.10.12` tested | Stand-in and eval scripts |
| Ollama | image `ollama/ollama:0.40.8` | Pinned in `docker-compose.yml` |
| Base model | `qwen2.5:1.5b` | Pulled by `ollama-model-init` |
| Piper TTS | `piper-tts==1.8.0` | Installed in the backend image |
| FastAPI | `0.159.1` | `helpdesk_api/requirements.txt` |
| Uvicorn | `0.53.0` | `helpdesk_api/requirements.txt` |
| requests | `2.32.5` | Adapter and stand-in |
| React / Vite | `18.2` / `8.3.1` | `ACU.FE/package.json` |
| Expo / React Native | `~54.0.0` / `0.81.4` | `Robot.Pwa.App/package.json` |

Lockfiles: `Source/acu/ACU.FE/package-lock.json`,
`Source/acu/Robot.Pwa.App/package-lock.json`.

## 3. Pinned model assets

### Android robot (`Robot.Pwa.App`)

`npm run models:prepare` downloads and verifies:

| Asset | Size (bytes) | SHA-256 |
| --- | --- | --- |
| `ggml-base.bin` (Whisper base) | `147951465` | `60ed5bc3dd14eea856493d334349b405782ddcaf0028d4b5df4088345fba2efe` |
| `ggml-silero-v5.1.2.bin` (Silero VAD) | `885098` | `2aa269b785eeb53a82983a20501ddf7c1d9c48e33ab63a41391ac6c9f7fb6987` |

Files land in `Source/acu/Robot.Pwa.App/android/app/src/main/assets/models/`
and are ignored by Git. `npm run models:check` re-verifies both.

### Piper voices

`piper-model-init` verifies size + MD5 before the backend starts:

| Voice | Files | Voice MD5 |
| --- | --- | --- |
| `en_US-lessac-medium` | `.onnx` + `.onnx.json` | `2fc642b535197b6305c7c8f92dc8b24f` |
| `de_DE-thorsten-medium` | `.onnx` + `.onnx.json` | `a129b00fb3078df43c96bab6c94535c0` |
| `zh_CN-huayan-medium` | `.onnx` + `.onnx.json` | `40cdb7930ff91b81574d5f0489e076ea` |

Each `.onnx` file is 63,201,294 bytes. The exact checks are in
`Source/acu/ApiGateway/Tts/prepare_piper_voices.py`.

### Ollama model

`Source/acu/Modelfile.txt` defines `ct-robot`:

- base: `qwen2.5:1.5b`
- `temperature 0.3`, `top_p 0.9`, `num_ctx 2048`, `num_predict 192`
- language, safety, tone, brevity, and breathing-guidance system prompt

The model is stored in the `ollama-data` volume. It is not committed.

## 4. Rebuild the ACU stack

```bash
cd Source/acu
docker compose --profile ai build
docker compose --profile ai up -d
```

If the `acu-backend` image does not exist yet, the first `up --build` is
required because `piper-model-init` reuses that image name with
`pull_policy: never`:

```bash
docker compose --profile ai up -d --build
```

Wait for the one-shot initializers:

```bash
docker compose --profile ai ps
docker compose logs piper-model-init
docker compose logs ollama-model-init
```

Expected end state:

- `backend`, `frontend`, `helpdesk-api`, `ollama` are `Up`.
- `piper-model-init` and `ollama-model-init` exited with code `0`.
- `docker compose exec -T ollama ollama list` includes `ct-robot:latest`.

### End-to-end smoke test

```bash
curl -fsS http://localhost:3000/api/health
curl -fsS -o /dev/null -w 'UI HTTP %{http_code}\n' http://localhost:3100/
curl -fsS http://localhost:3000/swagger/v1/swagger.json > /dev/null
```

Register a diagnostic robot and ask one question:

```bash
curl -sS -X POST http://localhost:3000/api/bot/register \
  -H 'Content-Type: application/json' \
  -d '{"deviceId":"diag-001","name":"Diagnostic","ip":"127.0.0.1","mac":"02:00:00:00:00:99","firmware":"repro"}'

# Approve it in the operator UI (Requests tab), then:
curl -sS -X POST http://localhost:3000/api/chat \
  -H 'Content-Type: application/json' \
  -d '{"deviceId":"diag-001","mac":"02:00:00:00:00:99","sessionId":"repro","requestId":"r1","text":"How long does a CT scan take?","language":"en"}'
```

A non-mock answer confirms the full text model path. A `503` means the `ai`
profile or adapter is not ready.

### TTS smoke test

```bash
curl -sS -o /tmp/acu-tts.wav -w 'HTTP %{http_code} type=%{content_type} bytes=%{size_download}\n' \
  -X POST http://localhost:3000/api/tts \
  -H 'Content-Type: application/json' \
  -d '{"deviceId":"diag-001","mac":"02:00:00:00:00:99","text":"Reproducibility check.","language":"en"}'

python3 - <<'PY'
import wave
w = wave.open('/tmp/acu-tts.wav')
print(w.getframerate(), 'Hz', w.getnchannels(), 'ch', 8 * w.getsampwidth(), 'bit')
PY
```

Expected: `HTTP 200`, `audio/wav`, a valid WAV header (typically 22,050 Hz,
mono, 16-bit).

## 5. Rebuild the frontend and run its checks

```bash
cd Source/acu/ACU.FE
npm ci
npm test
npm run build
```

Expected: **49 tests in 11 files pass**; Vite emits `dist/index.html`,
`dist/assets/*.css`, `dist/assets/*.js`. The build prints one informational
warning about a dynamically imported `deviceApi` module; it is not an error.

The frontend Docker image rebuilds from source and sets
`VITE_API_BASE_URL=""` so nginx proxies `/api` to `backend:3000`:

```bash
cd Source/acu
docker compose build frontend
docker compose up -d frontend
```

## 6. Rebuild and verify the model adapter

```bash
cd Source/acu
docker compose --profile ai build helpdesk-api
docker compose --profile ai run --rm --no-deps \
  -v "$PWD/../../helpdesk_api:/app" helpdesk-api \
  python -m unittest discover -s tests -v
```

Expected: **4 tests pass**. The adapter accepts only bounded `user`/`assistant`
text, calls Ollama's `/api/chat`, and returns `503` when the model output is
empty or unavailable.

## 7. Rebuild the robot app

```bash
cd Source/acu/Robot.Pwa.App
npm ci
npm run models:prepare
npm run models:check
npm run typecheck
npm run test:config
npm run test:device
npm run test:transcript
npm run test:conversation
```

Expected: type check clean; **11 tests pass** (3 + 2 + 2 + 4).

APK (requires Android SDK, JDK 17, and Gradle):

```bash
npm run build:apk
# output: Source/acu/Robot.Pwa.App/dist/acu-robot-development.apk
```

The APK is debug-signed. Production distribution requires an
organization-controlled signing key.

The app points at the ACU configured on first launch. From the Android
emulator use `http://10.0.2.2:3000`; from a physical robot use the ACU host's
LAN address. The robot must be approved in the operator UI before `/api/chat`
works.

## 8. No-Docker demo path (stand-in gateway)

Use this when only a laptop, Python, and optionally Ollama are available:

```bash
python3 -m pip install --requirement acu_standin/requirements.txt
python3 acu_standin/standin_gateway.py
```

Optional environment variables:

| Variable | Default | Purpose |
| --- | --- | --- |
| `PORT` | `3000` | Listen port |
| `AUTO_APPROVE` | `1` | Auto-approve registering robots |
| `OLLAMA_URL` | `http://localhost:11434` | Local Ollama |
| `OLLAMA_MODEL` | `ct-robot` | Model name |
| `GUIDE_PATH` | `data/siemens_ct_guide.txt` | Reference text |
| `VOICE_DIR` | `helpdesk_api/voices` | Optional Piper voices |
| `LOG_LEVEL` | `warning` | Uvicorn log level |

Verify:

```bash
curl -fsS http://localhost:3000/api/health
python3 eval/run_eval.py
```

The stand-in keeps conversations in memory, never logs patient text, and uses
the approved-answer safety layer before falling back to the model. It is a demo
substitute, not a production gateway.

## 9. Optional retrieval experiment

`ai_engine/` is not part of the runtime. It downloads a FastEmbed model on first
use:

```bash
python3 -m venv .venv
source .venv/bin/activate
pip install --requirement ai_engine/requirements.txt
python ai_engine/test_embed.py
```

Model caches, generated indexes, and virtual environments are ignored by Git.
See [`ai_engine/README.md`](../ai_engine/README.md).

## 10. Storage and time expectations

| Item | Approximate size |
| --- | --- |
| Ollama image | several GB |
| `qwen2.5:1.5b` model | ~1 GB |
| Piper voices (3) | ~190 MB |
| Whisper base + Silero VAD | ~149 MB |
| Robot `node_modules` | several hundred MB |
| Frontend `node_modules` + `dist` | several hundred MB |
| Docker build cache | several GB |

First full stack start: typically 5–20 minutes depending on network and cache.
The first model answer after a cold start includes model load time; keep Ollama
warm (`keep_alive` is set by the adapter path) for demo responsiveness.

## 11. Verification log (2026-10-24)

| Check | Result |
| --- | --- |
| `docker compose --profile ai config --quiet` | pass |
| `docker compose build backend` | pass |
| `docker compose build helpdesk-api` | pass |
| `cd ACU.FE && npm run build` | pass (109 modules, 296.43 kB JS) |
| `cd ACU.FE && npm test` | 49/49 pass |
| `cd Robot.Pwa.App && npm run typecheck` | pass |
| Robot unit tests | 11/11 pass |
| helpdesk unittest | 4/4 pass |
| `python3 -m py_compile` on stand-in/eval/ai_engine | pass |
| Frontend rebuild served by nginx | HTTP 200 on `:3100` |

The operator patient-preview component (`DeviceList.tsx`) was removed in this
revision; the UI now exposes only Devices, Requests, Workflows, and Settings.

## 12. Clean-room reset

```bash
cd Source/acu
docker compose --profile ai down -v
docker image rm acu-backend acu-frontend acu-helpdesk-api 2>/dev/null || true
cd ACU.FE && rm -rf dist node_modules
cd ../Robot.Pwa.App && rm -rf node_modules dist
```

This removes the `acu-data`, `piper-models`, and `ollama-data` volumes. The next
start re-downloads voices and the model.

## 13. Known reproducibility gaps

- `ACU.FE` Playwright config starts the gateway through
  `e2e/scripts/start-gateway.ps1`, so the default `npm run test:e2e` path needs
  Windows + PowerShell + .NET SDK. On Linux, start the backend separately and
  reuse it (`reuseExistingServer` is enabled outside CI).
- `e2e/specs/live-workflow-simulator.spec.ts` expects
  `Source/acu/tests/simulator/RobotSimulator/RobotSimulator.csproj`, which is
  not present in this repository snapshot.
- The `ai` profile has not been validated against the 4 GB target device
  storage budget.
