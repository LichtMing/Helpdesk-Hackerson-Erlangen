# Reproducibility guide

This guide records the exact toolchain, pinned assets, build commands, and
verification results for the final demo revision. Follow it from a clean clone
to rebuild the same system.

Repository: `git@github.com:LichtMing/Helpdesk-Hackerson-Erlangen.git`
Base revision audited: `4e0bd64f522be1284e7c3edb8bba732d198aead7` (branch `main`)
Full dependency inventory: [`DEPENDENCIES.md`](DEPENDENCIES.md)
Third-party review checklist: [`THIRD_PARTY.md`](THIRD_PARTY.md)

This audit adds Python lockfiles and documentation on top of that revision.
Until those files are committed and pushed, a clean clone of `main` still has
only the three `requirements.txt` files.

Last verified: **2026-10-26** for the local Node/Python paths and
**2026-10-24** for the full Docker stack (Linux/Ubuntu WSL2, Docker Desktop).

## 0. Reproducibility verdict

A fresh clone can rebuild the system functionally, but not bit-for-bit:

| Layer | Status | Notes |
| --- | --- | --- |
| Source code, Compose files, Dockerfiles, prompts | Reproducible | Everything needed is tracked in Git |
| Frontend and robot npm dependencies | Reproducible | `package-lock.json` v3 committed |
| Python runtime dependencies | Reproducible | `requirements.lock` files committed |
| Whisper, Silero, and Piper assets | Reproducible with network | Pinned URLs plus SHA-256/MD5 verification |
| Ollama model | Reproducible with network | `qwen2.5:1.5b` tag is not digest-pinned |
| .NET backend | Buildable, not fully locked | Direct NuGet versions pinned; transitives resolve at restore |
| Container base images | Buildable, not fully locked | Version tags, no digest pins |
| Android APK | Buildable with local Android SDK/JDK | Maven/Gradle deps resolve from remote repositories |
| Playwright E2E | Partial | Default gateway bootstrap is Windows/PowerShell; one spec needs a missing `RobotSimulator` project |

The primary supported path is the full Docker Compose stack, followed by the
Node tests/builds and the Python stand-in. The Android APK and Docker stack
require external toolchains that are not installed by `npm ci` or `pip`.

## 1. Clone

```bash
git clone git@github.com:LichtMing/Helpdesk-Hackerson-Erlangen.git
cd Helpdesk-Hackerson-Erlangen
git switch main
git rev-parse HEAD        # expected: 4e0bd64f522be1284e7c3edb8bba732d198aead7
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
| Python (backend TTS) | `3.12` (Ubuntu 24.04 `apt` in the ASP.NET image) | Piper lockfile |
| Python (host scripts) | `3.10.12` tested | Stand-in, eval, and `ai_engine` |
| Ollama | image `ollama/ollama:0.40.8` | Pinned in `docker-compose.yml` |
| Base model | `qwen2.5:1.5b` | Pulled by `ollama-model-init` |
| Piper TTS | `piper-tts==1.8.0` | Locked in `requirements-piper.lock` |
| FastAPI | `0.159.1` | Adapter and stand-in |
| Uvicorn | `0.53.0` | Adapter and stand-in |
| requests | `2.32.5` | Adapter and stand-in |
| Pydantic | `2.14.1` | Adapter and stand-in |
| React / Vite | `18.3.1` / `8.3.1` | Resolved in `ACU.FE/package-lock.json` |
| Expo / React Native | `54.0.37` / `0.81.4` | Resolved in `Robot.Pwa.App/package-lock.json` |
| JDK / Gradle | `17` / `8.14.3` | Android APK build |
| Android SDK | Expo 54 managed levels | Android APK build |
| uv (optional lock regeneration) | `0.11.17` verified | `uv pip compile` |

Lockfiles:

- `Source/acu/ACU.FE/package-lock.json` (npm v3)
- `Source/acu/Robot.Pwa.App/package-lock.json` (npm v3)
- `helpdesk_api/requirements.lock` (Python 3.12, 18 packages)
- `acu_standin/requirements.lock` (Python 3.10+, 19 packages)
- `ai_engine/requirements.lock` (Python 3.10+, 34 packages)
- `Source/acu/ApiGateway/Tts/requirements-piper.lock` (Python 3.12, 7 packages)

The `.NET` projects use direct `PackageReference` versions but have no
`packages.lock.json`; see the known gaps below.

When audited on 2026-10-26, `mcr.microsoft.com/dotnet/aspnet:10.0` resolved to
Ubuntu 24.04 and .NET `10.0.14`; `apt` therefore provides Python 3.12, matching
the Piper lockfile. The tag is mutable, so re-check this if the base image moves.

## 3. Pinned model assets

### Android robot (`Robot.Pwa.App`)

`npm run models:prepare` downloads and verifies:

| Asset | Size (bytes) | SHA-256 |
| --- | --- | --- |
| `ggml-base.bin` (Whisper base) | `147951465` | `60ed5bc3dd14eea856493d334349b405782ddcaf0028d4b5df4088345fba2efe` |
| `ggml-silero-v6.2.0.bin` (Silero VAD) | `885098` | `2aa269b785eeb53a82983a20501ddf7c1d9c48e33ab63a41391ac6c9f7fb6987` |

Files land in `Source/acu/Robot.Pwa.App/android/app/src/main/assets/models/`
and are ignored by Git. `npm run models:check` re-verifies both. The pinned URL
and hashes live in `Source/acu/Robot.Pwa.App/scripts/prepare-speech-models.mjs`.

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
`pull_policy: never`. The Compose file sets the project name to `acu`, so the
built image is always `acu-backend` even if the checkout directory is renamed:

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

The adapter image installs `helpdesk_api/requirements.lock`, which pins Python
3.12 and all transitive packages:

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

Without Docker, the same lockfile can be installed into a Python 3.12 virtual
environment:

```bash
python3.12 -m venv .venv-helpdesk
. .venv-helpdesk/bin/activate
python -m pip install --requirement helpdesk_api/requirements.lock
cd helpdesk_api && python -m unittest discover -s tests -v
```

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

Use this when only a laptop, Python 3.10+, and optionally Ollama are available.
Install the fully pinned lockfile rather than only the direct dependencies:

```bash
python3 -m pip install --requirement acu_standin/requirements.lock
python3 acu_standin/standin_gateway.py
```

Optional Piper TTS for the stand-in (the lock targets Python 3.12, matching the
backend image):

```bash
python3.12 -m pip install --requirement Source/acu/ApiGateway/Tts/requirements-piper.lock
```

On Python 3.10, install `piper-tts==1.8.0` instead; pip resolves a compatible
ONNX Runtime/NumPy set, but it will not match the 3.12 lock.

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
python -m pip install --requirement ai_engine/requirements.lock
python ai_engine/test_embed.py
```

The lock is resolved for Python 3.10 and also works on Python 3.12. It pins
`numpy==2.2.6` because FastEmbed 0.9.0 requires `numpy<2.3` on Python 3.10.
The BAAI/bge-small-en-v1.5 embedding model is downloaded from Hugging Face on
first use; its revision is not pinned.

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

## 11. Verification log

### 2026-10-26 — dependency and documentation audit

Run on Linux/WSL2 with Node 22.22.3, npm 10.9.8, Python 3.10.12, and uv 0.11.17.
The Docker daemon and Android SDK were not available in this environment, so
the full Compose stack and APK build were not re-run here.

| Check | Result |
| --- | --- |
| `python3 -m py_compile acu_standin/*.py eval/*.py ai_engine/test_embed.py` | pass |
| `cd ACU.FE && npm ci` | pass; no extraneous packages |
| `cd ACU.FE && npm test` | 49/49 pass in 11 files |
| `cd ACU.FE && npm run build` | pass (109 modules, 296.43 kB JS) |
| `cd Robot.Pwa.App && npm ci` | pass; no extraneous packages |
| `cd Robot.Pwa.App && npm run typecheck` | pass |
| Robot unit tests (4 commands) | 11/11 pass |
| `cd Robot.Pwa.App && npm run models:check` | both assets valid |
| `npm audit` snapshot | frontend 5 advisories (no critical); robot 12 (no critical) |
| helpdesk unittest with Python 3.12 lock | 4/4 pass |
| stand-in health and `eval/run_eval.py` | 15 questions, 4/4 medical cases routed to staff |
| stand-in `eval/run_eval2.py` | 16 unseen paraphrases completed |
| `ai_engine/test_embed.py` with Python 3.10 lock | pass (5 retrieval queries) |
| Piper lockfile import (`piper`, `onnxruntime`) | pass |
| Piper voice download + MD5 verification + WAV synthesis | pass (`en_US-lessac-medium`, 22,050 Hz mono 16-bit) |

A clean `git clone` of `main` at `4e0bd64` confirmed that the GitHub revision
had only the three `requirements.txt` files, no Python lockfiles, and a Silero
documentation mismatch (`v5.1.2` in docs, `v6.2.0` in the download script). The
lockfiles and corrections in this audit are follow-up changes on top of that
revision.

### 2026-10-24 — full Docker verification (historical)

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

These do not block a functional rebuild, but they prevent byte-for-byte
reproduction:

- Container base images use version tags rather than digests
  (`dotnet:10.0`, `node:22-alpine`, `nginx:alpine`, `python:3.12-slim`).
- NuGet has no committed `packages.lock.json`; transitive packages resolve at
  restore time.
- Android Gradle/Maven dependencies resolve from Google Maven and Maven Central.
  The Gradle wrapper is pinned at 8.14.3, but the Android Gradle Plugin, Kotlin
  plugin, and BOM versions come from Expo 54 / React Native 0.81.
- Ollama uses mutable registry tags (`ollama/ollama:0.40.8`,
  `qwen2.5:1.5b`); the `ct-robot` model is deterministic only for a fixed
  base-model digest and Modelfile.
- FastEmbed downloads `BAAI/bge-small-en-v1.5` without a pinned Hugging Face
  revision.
- Debian/Ubuntu packages in images (`espeak-ng`, `python3`, `pip`) are not
  version-pinned.
- `ACU.FE` Playwright config starts the gateway through
  `e2e/scripts/start-gateway.ps1`, so the default `npm run test:e2e` path needs
  Windows + PowerShell + .NET SDK. On Linux, start the backend separately and
  reuse it (`reuseExistingServer` is enabled outside CI).
- `e2e/specs/live-workflow-simulator.spec.ts` expects
  `Source/acu/tests/simulator/RobotSimulator/RobotSimulator.csproj`, which is
  not present in this repository snapshot.
- The Android APK build requires a local Android SDK, JDK 17, and Gradle; it is
  not exercised by `npm ci`, and it was not built in the 2026-10-26 audit.
- The `ai` profile has not been validated against the 4 GB target device
  storage budget.
- A stricter rebuild should pin image digests, add NuGet lockfiles, pin the
  Ollama base-model digest, and record the FastEmbed model revision. See
  [`DEPENDENCIES.md`](DEPENDENCIES.md#known-pinning-gaps).
