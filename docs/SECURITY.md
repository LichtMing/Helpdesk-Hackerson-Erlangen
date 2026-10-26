# Security and privacy notes

This document describes the intended deployment boundary of the ACU demo. It is
not a production security certification. The system was built for a trusted
hospital LAN/VPN and a controlled hackathon demonstration.

## Trust boundaries

| Boundary | Intended exposure | Notes |
| --- | --- | --- |
| Android robot → ApiGateway `:3000` | Hospital LAN/VPN | Robot sends recognized text and device identity; raw audio stays on the device |
| Operator browser → frontend `:3100` | Hospital LAN/VPN | nginx serves the UI and proxies `/api` to the backend |
| ApiGateway → `helpdesk-api:8000` | Internal Compose network only | No host port is published |
| `helpdesk-api` → Ollama `:11434` | Internal Compose network only | No host port is published |
| ApiGateway → Piper / eSpeak | Local process | WAV is streamed to the robot and not persisted |
| Operator → `acu-data` volume | Docker host | Devices, workflows, and settings are JSON files |

Only ports `3000` (gateway) and `3100` (operator UI) are published by the
authoritative Compose file. Do not expose `8000` or `11434` to robots or the
public network.

## Identity and authentication

Device ID + MAC validation and operator approval are **application-state
checks**, not cryptographic authentication. They prevent accidental
cross-device use in the demo; they do not resist an attacker who can spoof a
MAC or reach the API. For production, add mutual TLS, per-device credentials, or
a network access control layer.

The `acu_standin` gateway auto-approves robots by default (`AUTO_APPROVE=1`).
Use `AUTO_APPROVE=0` when demonstrating approval, and never use the stand-in as
a production gateway.

## Data handling

- Raw microphone audio remains on the Android robot.
- Only recognized text is sent to the ACU.
- Conversation history is in memory, bounded by `Conversation__MaxTurns`, and
  expires after `Conversation__SessionIdleTimeoutMinutes` (default 5).
- Generated WAV audio is streamed and not persisted by the gateway; the robot
  deletes its temporary file after playback.
- Patient text is not written to `devices.json`, `workflows.json`, or
  application logs.
- The stand-in does not log question/answer text unless `LOG_TEXT=1` is set.
- Managed .NET and Python strings cannot guarantee forensic RAM erasure. The
  implemented guarantee is no application-level persistence and prompt
  reference release, not physical-memory zeroization.

## Model safety

The system prompt in `Source/acu/Modelfile.txt` forbids diagnosis,
patient-specific advice, medication instructions, invented logistics, and
safety guarantees. Clinical questions are routed to radiology staff. This is
prompt-level guidance, not a clinical decision support system.

The `helpdesk-api` adapter returns `503` when Ollama is unavailable or returns
an empty answer. Docker Compose disables development mock answers, so a missing
model never produces a pretend medical answer through the container path.

## Secrets and signing keys

- The repository contains no production secrets.
- `Source/acu/Robot.Pwa.App/android/app/debug.keystore` is a debug signing key
  only. Replace it with an organization-controlled release key before
  distributing an APK.
- `.env` files are ignored by Git. Use `.env.example` as a template.
- Do not commit Hugging Face tokens, Ollama credentials, or hospital
  certificates.

## Logging

- The gateway logs request metadata, not patient text.
- `helpdesk-api` does not log patient text.
- The stand-in prints `STAFF ATTENTION` events without question text by default.
- Review logs before sharing them outside the deployment team.

## Dependency advisories (2026-10-26 snapshot)

`npm audit` results change as advisories are published and packages are
updated. Re-run the audit after every dependency change. The snapshot below is
informational; no automatic major upgrades were applied in this audit.

### Frontend (`Source/acu/ACU.FE`)

After removing the unused `swagger-ui-react` and
`@types/swagger-ui-react` packages, `npm audit` reports **5 advisories**
(2 moderate, 3 high, no critical):

| Package | Severity | Notes |
| --- | --- | --- |
| `vite` | high | Direct dev dependency |
| `vitest` | moderate | Direct dev dependency |
| `follow-redirects` | high | Transitive; review the axios update path |
| `source-map-js` | high | Transitive |
| `@vitest/mocker` | moderate | Transitive via Vitest |

The removed Swagger UI React chain had also pulled a **critical** `dompurify`
advisory and 162 transitive packages. The operator UI does not import Swagger
UI React; the gateway serves Swagger at `/docs`. Run `npm audit fix`, then
`npm test` and `npm run build` before committing an upgrade.

With `npm audit --omit=dev`, the frontend has **1 high** advisory
(`follow-redirects`, transitive through axios); the Vite/Vitest findings are
development-only.

### Robot app (`Source/acu/Robot.Pwa.App`)

`npm audit` reports **12 advisories** (5 moderate, 7 high, no critical), mostly
in Expo/React Native build tooling: `@expo/cli`,
`@expo/code-signing-certificates`, `@expo/metro-config`, `postcss`,
`node-forge`, `image-size`, `undici`, `fast-uri`, `uuid`, and `xcode`. Many are
build-time or bundler-path issues rather than robot runtime exposure. The audit
suggestion is a semver-major Expo change; review it against the Expo 54/RN 0.81
upgrade path instead of applying it blindly. Re-run `npm ci && npm audit` after
the upgrade. `npm audit --omit=dev` still reports all 12 because Expo CLI is a
runtime dependency in this project.

### Python

The Python lockfiles pin known versions, but this audit did not run a Python
vulnerability scanner. Add `pip-audit` or an equivalent check to CI for a
release build.

## Hardening checklist for a real deployment

- [ ] Put the ACU behind the hospital VPN or an access-controlled reverse proxy.
- [ ] Replace optional device checks with mutual TLS or per-device credentials.
- [ ] Publish only the required ports; keep the adapter and Ollama internal.
- [ ] Use an organization-controlled Android release key.
- [ ] Pin container image digests and NuGet/Python dependencies for the release.
- [ ] Review the third-party licences in [`THIRD_PARTY.md`](THIRD_PARTY.md).
- [ ] Validate the model prompt and approved answers with radiology staff.
- [ ] Decide whether conversation text must be retained for audit; if so, design
      a compliant storage and retention policy before enabling it.
- [ ] Review the organizer-provided API guide and challenge rules for any
      additional constraints.

## Related documents

- [`../Source/acu/CONVERSATION_PIPELINE.md`](../Source/acu/CONVERSATION_PIPELINE.md)
- [`../README.md`](../README.md)
- [`REPRODUCIBILITY.md`](REPRODUCIBILITY.md)
- [`DEPENDENCIES.md`](DEPENDENCIES.md)
