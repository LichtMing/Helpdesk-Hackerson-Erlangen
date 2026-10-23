# ACU conversation pipeline

This repository implements the complete text conversation boundary from the Android robot to the local Qwen model.

The existing event API reference is `Doc/api-guide.pdf`. That guide was checked against the gateway on 2026-10-22, before the conversation endpoints in this branch were added. After deployment, the running `/docs` Swagger UI remains the final contract.

## Runtime flow

1. The Android robot app performs VAD and Whisper transcription locally.
2. The robot sends only recognized text to `POST /api/chat`.
3. ApiGateway validates that the device ID and MAC belong to an approved robot.
4. `ConversationService` holds a bounded conversation history in process memory.
5. `HelpdeskChatModelClient` sends the bounded text history and requesting device ID to the internal `helpdesk-api`, which calls the local `ct-robot` Ollama model. Raw audio, robot credentials, and persistent patient data are not sent to that service.
6. The helpdesk adapter calls `gateway_client.publish_answer` to assign a text/TTS response workflow to that robot through ApiGateway. If this delivery fails, the answer is still returned to the requesting app.
7. On successful delivery, the Android app starts its assigned workflow, uses the workflow's TTS text, and marks the workflow complete after playback. If delivery or retrieval fails, it uses the answer returned by `/api/chat` instead.
8. The selected text is sent to `POST /api/tts`; the ACU runs offline Piper neural TTS and streams a WAV response without creating an audio file.
9. The robot stores the WAV only in its cache, pauses listening while it plays, deletes it, and resumes listening.
10. `POST /api/reset`, the five-minute idle timeout, or gateway shutdown clears the application-level session memory.

The ApiGateway continues to listen on port `3000`. Port `8000` is internal to the Compose network and must not be used by robots.

## Container boundaries

The repository uses Docker Compose for ACU-side services, not for the Android robot runtime:

```text
Robot Android app
  -> ApiGateway:3000 (public robot/API contract)
       -> helpdesk-api:8000 (internal text-only model adapter)
            -> Ollama:11434 (internal model runtime)
       -> offline Piper TTS
Optional ACU operator browser -> frontend:3100 (`dashboard` profile only)
```

- `backend`, `helpdesk-api`, `ollama`, and the one-shot model initialization services form the default headless runtime. Only the gateway's port 3000 is published.
- `frontend` is preserved under the optional `dashboard` profile and is not required for robot conversations.
- `mdns` is opt-in through the `lan` profile because host multicast behavior differs on Docker Desktop.
- `Robot.Pwa.App` remains an Android application because it needs microphone, native Whisper/VAD, and audio playback access.
- `ai_engine/` currently contains retrieval experiments and evaluation material; it is not a runtime service.

Validate the Compose definition without starting containers:

```text
docker compose config
```

Start the complete headless conversation server:

```text
docker compose up --build -d
docker compose logs --follow backend helpdesk-api ollama
```

`ollama-model-init` creates `ct-robot` from `Modelfile.txt` and pulls its Qwen 2.5 1.5B base automatically when absent. `piper-model-init` downloads the configured English, German, and Chinese ONNX voices into the persistent `piper-models` volume when absent.

The Ollama image and `qwen2.5:1.5b` model are too large to assume they fit the challenge's stated 4 GB storage limit alongside the remaining stack. Measure the final target image before deploying to the constrained ACU.

## Compatibility with the event API guide

- The new routes use the guide's `/api` prefix, camelCase JSON, standard status codes, and existing approved-device checks.
- `/api/chat`, `/api/tts`, and `/api/reset` are branch extensions and will not exist on an organizer gateway until this work is merged and deployed.
- Before using the extensions on an event gateway, check `GET /api/health`, then confirm the assigned robot with `GET /api/bot/registration-status/{deviceId}`. A robot must report `approved`; do not register, approve, reject, or unregister a shared robot without organizer permission.
- Use a gateway base URL such as `http://192.168.1.100:3000`, without `/api` or `/docs`. The client adds `/api` exactly once and never retries state-changing requests automatically.
- Client error handling checks the HTTP status first and understands the guide's three error shapes: `{ "error": ... }`, Problem Details `{ "detail": ... }`, and framework validation `{ "errors": ... }`.
- The device ID and MAC checks are application-state checks, not authentication. Run the gateway only on the organizer's trusted LAN/VPN or behind its access-controlled reverse proxy.
- The workflow model's existing `TTS` property is authored workflow content. It is separate from the new runtime `/api/tts` synthesis endpoint.
- Robot identities must be assigned/approved according to the guide; do not register over or unregister a shared event robot.

## API contracts

### `POST /api/chat`

```json
{
  "deviceId": "robot-001",
  "mac": "AA:BB:CC:DD:EE:FF",
  "sessionId": "session-uuid",
  "requestId": "request-uuid",
  "text": "How long will the scan take?",
  "language": "en"
}
```

Development response:

```json
{
  "sessionId": "session-uuid",
  "requestId": "request-uuid",
  "answer": "The local language model is not connected yet. This response only verifies the conversation pipeline.",
  "language": "en",
  "isMock": true,
  "generatedAt": "2026-10-23T12:00:00.0000000Z"
}
```

When development responses are disabled and no real model adapter has been registered, the endpoint returns `503` and does not pretend to provide medical information.

### `POST /api/tts`

```json
{
  "deviceId": "robot-001",
  "mac": "AA:BB:CC:DD:EE:FF",
  "text": "The scan usually takes about twenty minutes.",
  "language": "en"
}
```

The successful response is `audio/wav` with `Cache-Control: no-store`. Piper receives text through stdin, builds the WAV in memory, and returns it through stdout. Set `Tts__Provider=Espeak` only when the low-resource fallback is explicitly required; the HTTP contract does not change.

### `POST /api/reset`

```json
{
  "deviceId": "robot-001",
  "mac": "AA:BB:CC:DD:EE:FF",
  "sessionId": "session-uuid"
}
```

Reset is idempotent. `cleared: false` means the session had already expired or had already been reset.

## Configuration

Production-safe defaults in `ApiGateway/appsettings.json` keep development model responses disabled:

```text
Conversation__EnableDevelopmentResponses=false
Conversation__SessionIdleTimeoutMinutes=5
Conversation__MaxTurns=6
Tts__Enabled=true
Tts__Provider=Piper
Tts__PiperExecutable=python3
Tts__PiperScript=/app/piper_synthesize.py
Tts__ModelDirectory=/models
Tts__EnglishVoice=en_US-lessac-medium
Tts__GermanVoice=de_DE-thorsten-medium
Tts__ChineseVoice=zh_CN-huayan-medium
Tts__Executable=espeak-ng
```

`appsettings.Development.json` enables the marked mock answer only for direct local .NET development when the helpdesk adapter is disabled. Docker Compose disables mock answers so a missing model produces `503` instead of a pretend patient answer.

Docker Compose disables mock answers and enables the internal model adapter:

```text
Helpdesk__Enabled=true
Helpdesk__BaseUrl=http://helpdesk-api:8000
Conversation__EnableDevelopmentResponses=false
```

## Ollama integration

- ApiGateway owns device validation, request correlation, bounded in-memory sessions, reset, and TTS.
- `HelpdeskChatModelClient` sends only `user`/`assistant` text and the requested language to `POST /internal/chat`.
- `helpdesk-api` adds no second session store and does not expose audio, STT, robot discovery, workflow publication, or public chat routes.
- The model prompt forbids diagnosis, patient-specific medical advice, invented logistics, and unsupported safety claims.
- Provider failures and timeouts become a safe `503` response from ApiGateway.

## Privacy boundary

- Raw microphone audio remains on the robot.
- Patient text is not added to `DeviceStore` or workflow JSON. The development Compose configuration deliberately prints `COMM_TEXT` lines for debugging; disable `CommunicationLogging__IncludeText` before handling real patient data.
- Conversation history is process-local, bounded, resettable, and expires automatically.
- Generated WAV is not written to ACU disk; the robot deletes its temporary cache file after playback.
- Managed .NET strings cannot provide forensic byte-for-byte RAM erasure. The implemented guarantee is no application-level persistence and prompt release of references, not literal physical-memory zeroization.

Before distributing a product image, review Piper's GPL-3.0-or-later license and every selected voice model/dataset license under the organization's third-party software policy. The German Thorsten dataset is CC0; the Huayan model card currently lists its dataset license as unknown, so replace or clear that voice before production distribution if the organization cannot approve it.
