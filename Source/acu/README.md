# ACU solution

This directory contains the ACU-side system: the .NET gateway, the operator
frontend, the Android robot client, and the Docker Compose deployment that ties
the gateway to the internal model adapter and offline TTS.

For the project overview, safety notes, and the full quick start, read the
[repository README](../../README.md). For the conversation and privacy
contracts, read [CONVERSATION_PIPELINE.md](CONVERSATION_PIPELINE.md). For the
complete dependency inventory and rebuild procedure, read
[`docs/DEPENDENCIES.md`](../../docs/DEPENDENCIES.md) and
[`docs/REPRODUCIBILITY.md`](../../docs/REPRODUCIBILITY.md). Deployment trust
boundaries and hardening notes are in
[`docs/SECURITY.md`](../../docs/SECURITY.md).

`docker-compose.yml` in this directory is the authoritative stack. The files
`ApiGateway/docker-compose.yml` and `ACU.FE/docker-compose.yml` are legacy
single-service helpers for backend-only or frontend-only debugging.

## Components

| Component | Technology | Role |
| --- | --- | --- |
| `ApiGateway/` | ASP.NET Core 10 | Robot registry and approval, workflow assignments, conversation sessions, TTS |
| `BE/AcuStorage/` | .NET class library | JSON persistence shared by the gateway |
| `BE/MdnsAdvertiser/` | .NET worker | Optional mDNS advertisement (`lan` profile) |
| `ACU.FE/` | React 18 + TypeScript + Vite | Operator console: devices, requests, workflows, settings |
| `Robot.Pwa.App/` | Expo 54 / React Native 0.81 | Android robot: on-device VAD + Whisper, text-only transport, WAV playback |
| `docker-compose.yml` | Compose v2 | ACU-side runtime |
| `Modelfile.txt` | Ollama model definition | `ct-robot` from `qwen2.5:1.5b` |

The internal adapter (`helpdesk_api/`) and the stand-in gateway (`acu_standin/`)
live outside this directory because they are separate Python services.

## Pinned toolchain and dependency files

| Area | Pin | File |
| --- | --- | --- |
| .NET | `net10.0`, SDK/ASP.NET images `10.0` | `ApiGateway/ApiGateway.csproj`, `ApiGateway/Dockerfile` |
| Frontend | Node `22.20+`, npm lockfile v3 | `ACU.FE/package.json`, `ACU.FE/package-lock.json` |
| Robot | Expo `54.0.37`, React Native `0.81.4`, Node `22.20+` | `Robot.Pwa.App/package.json`, `Robot.Pwa.App/package-lock.json` |
| Piper TTS | `piper-tts==1.8.0` plus ONNX Runtime transitives | `ApiGateway/Tts/requirements-piper.lock` |
| Ollama | image `0.40.8`, base model `qwen2.5:1.5b` | `docker-compose.yml`, `Modelfile.txt` |

The full table, including transitive counts, is in
[`docs/DEPENDENCIES.md`](../../docs/DEPENDENCIES.md).

## Prerequisites

- Docker Engine or Docker Desktop with Compose v2.
- Optional for native development: .NET SDK 10, Node.js 22.20+ and npm.
- Optional for the robot APK: Android Studio, JDK 17, Android SDK, and a
  microphone-capable device or emulator.
- About 8 GB free disk for the `ai` profile (Ollama image, Qwen model, Piper
  voices, build cache).

## Compose services and ports

| Service | Profile | Host port | Notes |
| --- | --- | --- | --- |
| `frontend` | default | `3100` | nginx serves the built UI and proxies `/api` to `backend` |
| `backend` | default | `3000` | Public robot/API contract; Swagger UI at `/docs`, JSON at `/swagger/v1/swagger.json` |
| `piper-model-init` | default (one-shot) | — | Downloads and verifies Piper voices into `piper-models` |
| `helpdesk-api` | `ai` | — | Internal only; FastAPI → Ollama |
| `ollama` | `ai` | — | Internal only; port `11434` not published |
| `ollama-model-init` | `ai` (one-shot) | — | Creates `ct-robot` from `Modelfile.txt` |
| `mdns` | `lan` | host network | Linux hosts only; advertises `_acu._tcp` on `3000` |

The frontend container is deliberately the only browser-facing service. The
gateway is published for the robot and for Swagger; the adapter and Ollama must
never be exposed to robots or the public network.

## Start and verify

```bash
cd Source/acu
docker compose --profile ai up -d --build
docker compose --profile ai ps
curl -fsS http://localhost:3000/api/health
curl -fsS -o /dev/null -w 'UI HTTP %{http_code}\n' http://localhost:3100/
```

On a clean machine, `--build` is required because `piper-model-init` reuses the
`acu-backend` image. The Compose project name is fixed to `acu` in
`docker-compose.yml`, so that image reference stays valid regardless of the
checkout directory. The first AI start also pulls `qwen2.5:1.5b` and downloads
three Piper voices; expect a multi-minute first run.

Without the `ai` profile, the gateway still serves devices, workflows, and the
operator UI, but `/api/chat` returns `503` until a model adapter is available:

```bash
docker compose up -d --build
```

### Changing the model prompt

`Modelfile.txt` is mounted into `ollama-model-init` as a read-only file. After
editing it, recreate the initializer so the stored model is rebuilt:

```bash
docker compose --profile ai up -d --force-recreate ollama-model-init
```

### Stop and clean up

```bash
docker compose --profile ai stop          # keep containers, data, and models
docker compose --profile ai down          # remove containers and network
docker compose --profile ai down -v       # also delete data and model volumes
```

`down -v` deletes registered devices, workflows, Piper voices, and the Ollama
model volume. Use it only when you intend to start from a clean state.

## Native backend development

Requires the .NET 10 SDK. The gateway listens on `http://localhost:3000` and
uses development data paths next to the build output:

```bash
dotnet run --project ApiGateway/ApiGateway.csproj
```

`appsettings.Development.json` enables clearly marked mock answers
(`Conversation.EnableDevelopmentResponses=true`) and disables the helpdesk
adapter. This is only for local .NET debugging. Never ship this configuration as
a patient-facing answer source.

To use the real adapter from a native backend, start `helpdesk-api` and Ollama,
then set:

```bash
Helpdesk__Enabled=true
Helpdesk__BaseUrl=http://localhost:8000
Conversation__EnableDevelopmentResponses=false
```

## Native frontend development

```bash
cd ACU.FE
npm ci
npm run dev
```

Vite proxies `/api` to `http://localhost:3000` (see `vite.config.ts`). Set
`VITE_API_BASE_URL` if the gateway is elsewhere; leave it empty in the Docker
build so nginx performs the proxy.

Useful checks:

```bash
npm test          # Vitest + Testing Library
npm run build     # tsc -b && vite build
npm run test:e2e  # Playwright (see ACU.FE/README.md for limitations)
```

## Persisted data

Compose uses the `acu-data` volume mounted at `/data`:

| File | Content |
| --- | --- |
| `devices.json` | Registered robots and approval state |
| `workflows.json` | Operator-authored workflows |
| `robot-workflows.json` | Workflow assignments per robot |
| `acu-settings.json` | ACU-wide settings such as robot speech language |

Conversation history is **not** persisted. It lives in `ConversationSessionStore`
memory, is bounded by `Conversation__MaxTurns`, and expires after
`Conversation__SessionIdleTimeoutMinutes` (default 5). Generated WAV audio is
streamed, not written to the volume.

## Configuration reference

`ApiGateway/appsettings.json` contains production-safe defaults. Compose
overrides the values that depend on container networking:

| Variable | Compose value | Purpose |
| --- | --- | --- |
| `DataPath` | `/data/devices.json` | Device registry |
| `WorkflowDataPath` | `/data/workflows.json` | Workflow definitions |
| `RobotWorkflowDataPath` | `/data/robot-workflows.json` | Robot assignments |
| `AcuSettingsDataPath` | `/data/acu-settings.json` | ACU settings |
| `Conversation__EnableDevelopmentResponses` | `false` | No mock patient answers |
| `Conversation__SessionIdleTimeoutMinutes` | `5` | Session expiry |
| `Conversation__MaxTurns` | `6` | History bound |
| `Helpdesk__Enabled` | `true` | Use the internal adapter |
| `Helpdesk__BaseUrl` | `http://helpdesk-api:8000` | Adapter address |
| `Tts__Provider` | `Piper` | Neural TTS; use `Espeak` for the fallback |
| `Tts__ModelDirectory` | `/models` | Piper voice volume |
| `Tts__LengthScale` | `1.0` | Speaking rate |

The full list of TTS voices and integrity checks is in
`ApiGateway/Tts/prepare_piper_voices.py`.

## API surface

- `GET /api/health` — readiness probe.
- `POST /api/bot/register`, `GET /api/bot/registration-status/{deviceId}` —
  robot registration and approval polling.
- Operator endpoints for devices, requests, workflows, and settings.
- `POST /api/chat`, `POST /api/tts`, `POST /api/reset` — conversation pipeline;
  see [CONVERSATION_PIPELINE.md](CONVERSATION_PIPELINE.md).
- Swagger UI: `http://localhost:3000/docs` (JSON: `http://localhost:3000/swagger/v1/swagger.json`).

Robot requests are validated against the approved device registry (device ID
and MAC). This is an application-state check, not authentication.

## Verification commands

```bash
cd Source/acu
docker compose --profile ai config --quiet
docker compose build backend
docker compose --profile ai build helpdesk-api
cd ACU.FE && npm test && npm run build
cd ../Robot.Pwa.App && npm run typecheck
```

The helpdesk test command, the Python lockfile install path, and the expected
test counts are in
[`docs/REPRODUCIBILITY.md`](../../docs/REPRODUCIBILITY.md). The full dependency
inventory is in [`docs/DEPENDENCIES.md`](../../docs/DEPENDENCIES.md).

## Troubleshooting

| Symptom | Check |
| --- | --- |
| `/api/chat` returns `503` | Start the `ai` profile; inspect `docker compose logs helpdesk-api ollama` |
| UI loads but shows offline | Gateway not reachable; check `curl http://localhost:3000/api/health` |
| TTS returns silence or 500 | `docker compose logs backend`; verify the `piper-models` volume completed |
| First answer is very slow | Ollama is loading the model; keep it warm with `keep_alive` |
| Robot cannot reach ACU | Use the host's LAN address, not `localhost`; open port `3000` |
| Piper download failed | Re-run `docker compose up -d --force-recreate piper-model-init` |
| Model prompt changes ignored | Recreate `ollama-model-init` as shown above |
