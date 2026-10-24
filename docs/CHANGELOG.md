# Changelog

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
