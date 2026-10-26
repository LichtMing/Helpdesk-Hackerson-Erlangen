# Changelog

## 2026-10-26 — reproducibility and dependency audit

### Documentation

- Added [`DEPENDENCIES.md`](DEPENDENCIES.md): complete toolchain, container
  image, NuGet, Python, npm, model, and voice inventory with resolved versions
  and update commands.
- Added [`SECURITY.md`](SECURITY.md): trust boundaries, data handling, signing
  keys, and a deployment hardening checklist.
- Added [`THIRD_PARTY.md`](THIRD_PARTY.md): third-party licence review
  checklist.
- Expanded the root README with a reproducibility verdict and dependency
  summary.
- Corrected the Silero VAD asset version in the reproducibility guide and robot
  README (`v5.1.2` → `v6.2.0`).
- Documented the current verification results and the remaining pinning gaps.

### Dependency pinning

- Added fully resolved Python lockfiles:
  `helpdesk_api/requirements.lock` (Python 3.12, 18 packages),
  `acu_standin/requirements.lock` (Python 3.10+, 19 packages),
  `ai_engine/requirements.lock` (Python 3.10+, 34 packages), and
  `Source/acu/ApiGateway/Tts/requirements-piper.lock` (Python 3.12, 7 packages).
- Declared `pydantic` explicitly in the adapter and stand-in requirements.
- Changed `ai_engine` from `numpy==2.5.4` to `numpy==2.2.6` so FastEmbed 0.9.0
  installs on the documented Python 3.10 host.
- Updated the helpdesk Dockerfile and backend Piper install to use lockfiles.
- Added `eval/requirements.txt`.
- Removed the unused `swagger-ui-react` and `@types/swagger-ui-react` frontend
  dependencies. The UI never imported them, the gateway serves Swagger at
  `/docs`, and the removal dropped 162 transitive packages plus the critical
  DOMPurify advisory. The frontend lockfile now has 165 entries.

### Configuration and build fixes

- Replaced the machine-specific hostname in `ACU.FE/.env.example` and the
  `deviceApi` comment with `http://localhost:3000`.
- Corrected the Swagger UI documentation to `/docs`; the OpenAPI JSON remains at
  `/swagger/v1/swagger.json`.
- Fixed the Compose project name to `acu` so `piper-model-init` can always reuse
  the locally built `acu-backend` image, even if the checkout directory is
  renamed.
- Made the legacy single-service Compose files functional and marked the root
  `Source/acu/docker-compose.yml` as authoritative.
- Included the helpdesk lockfile in the root `.dockerignore` build context.

### Verification

- Frontend: 49/49 tests and production build pass.
- Robot: type check, 11/11 tests, and both model assets pass.
- helpdesk: 4/4 tests with the Python 3.12 lockfile.
- Stand-in: health, `run_eval.py` (15 questions), and `run_eval2.py`
  (16 paraphrases) pass.
- `ai_engine/test_embed.py` passes on Python 3.10 with the lockfile.
- Piper lockfile imports successfully; a downloaded `en_US-lessac-medium` voice
  passed MD5 verification and produced a valid 22,050 Hz mono 16-bit WAV.
- `npm ci` completed for the robot app and removed stale extraneous packages.
- `npm audit` snapshot (2026-10-26): frontend 5 advisories (2 moderate, 3 high,
  no critical) after removing Swagger UI React; robot 12 advisories (5 moderate,
  7 high, no critical), mostly Expo build tooling. See `docs/SECURITY.md`.
- The Docker stack and Android APK were not re-built in this environment
  because Docker and the Android SDK were unavailable.

## 2026-10-24 — final demo revision

### Operator frontend

- Removed the patient-preview tab and deleted the unused
  `ACU.FE/src/features/DeviceList.tsx` preview component. The operator UI is now
  limited to Devices, Requests, Workflows, and Settings.
- Confirmed the console remains a live monitoring surface: device status,
  approval requests, assigned workflows, and workflow timeline events.
- Frontend unit suite: 49 tests in 11 files.

### Speech and conversation

- Piper neural TTS is the default gateway provider; eSpeak NG remains an
  explicit fallback selected with `Tts__Provider=Espeak`.
- Added `ApiGateway/Tts/piper_synthesize.py` and
  `ApiGateway/Tts/prepare_piper_voices.py`.
- `piper-model-init` downloads and verifies three voices into the
  `piper-models` volume before the backend starts.
- Expanded `Modelfile.txt` with tone, brevity, and breathing-guidance rules
  while keeping the clinical safety rules.
- `helpdesk-api` remains a private text-only adapter; raw audio never leaves the
  robot.

### Robot app

- Added the optional ambient-sound loop, with level changes while listening,
  speaking, and paused.
- Added a cross-platform fix for the Windows Gradle wrapper in
  `scripts/build-apk.mjs`.
- Pinned Whisper and Silero VAD assets remain verified by size and SHA-256.
- Robot tests: 11 passing.

### Demo tooling

- Added `acu_standin/requirements.txt` and documentation for the no-Docker
  stand-in gateway.
- Documented the evaluation scripts and recorded results.
- Added `docs/REPRODUCIBILITY.md` with pinned versions, checksums, rebuild
  steps, verification results, and known gaps.
- Added solution-level and module-level READMEs, and fixed stale links.

### Configuration

- `appsettings.Development.json` now uses a portable
  `bin/Debug/net10.0/robot-workflows.json` path instead of a Windows-only
  `D:/data/...` path.
- Docker Compose keeps development mock answers disabled and enables the
  internal helpdesk adapter.

### Verification

- `docker compose --profile ai config --quiet`: pass.
- `docker compose build backend`: pass.
- `docker compose build helpdesk-api`: pass.
- `ACU.FE` production build: pass.
- `ACU.FE` unit tests: 49/49 pass.
- Robot type check and tests: pass (11/11).
- helpdesk unittest: 4/4 pass.
- Python script syntax checks: pass.
