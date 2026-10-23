# ACU conversation pipeline

This branch implements the parts of the patient conversation pipeline that do not depend on Qwen or Ollama.

The existing event API reference is `Doc/api-guide.pdf`. That guide was checked against the gateway on 2026-10-22, before the conversation endpoints in this branch were added. After deployment, the running `/docs` Swagger UI remains the final contract.

## Runtime flow

1. The Android robot app performs VAD and Whisper transcription locally.
2. The robot sends only recognized text to `POST /api/chat`.
3. ApiGateway validates that the device ID and MAC belong to an approved robot.
4. `ConversationService` holds a bounded conversation history in process memory.
5. `IChatModelClient` generates an answer. The current development adapter returns a safe response marked `isMock: true`; it is not a patient answer.
6. The robot sends the answer text to `POST /api/tts`.
7. The ACU runs offline eSpeak NG and streams a WAV response without creating an audio file.
8. The robot stores the WAV only in its cache, pauses listening while it plays, deletes it, and resumes listening.
9. `POST /api/reset`, the five-minute idle timeout, or gateway shutdown clears the application-level session memory.

The ApiGateway continues to listen on port `3000`. The screenshot's suggested port `8000` is not used by this repository.

## Container boundaries

The repository uses Docker Compose for ACU-side services, not for the Android robot runtime:

```text
Robot Android app
  -> ApiGateway:3000 (public robot/API contract)
       -> helpdesk-api:8000 (internal AI boundary; placeholder today)
            -> Ollama:11434 (internal model runtime)
       -> offline TTS
ACU operator browser -> frontend:3100
```

- `backend` and `frontend` are the default development services.
- `helpdesk-api` and `ollama` are opt-in through the `ai` Compose profile. Neither internal port is published to the host.
- `mdns` is opt-in through the `lan` profile because host multicast behavior differs on Docker Desktop.
- `Robot.Pwa.App` remains an Android application because it needs microphone, native Whisper/VAD, and audio playback access.
- `ai_engine/` currently contains retrieval experiments and evaluation material; it is not a runtime service.

Validate the default stack without downloading the model runtime:

```text
docker compose config
docker compose build backend
docker compose up backend
```

For AI-team development only:

```text
docker compose --profile ai up --build -d ollama helpdesk-api
docker compose --profile ai exec ollama ollama pull qwen2.5:1.5b-instruct
```

The Ollama image and `qwen2.5:1.5b-instruct` model are too large to assume they fit the challenge's stated 4 GB storage limit alongside the remaining stack. The `ai` profile is therefore a workstation integration environment until the target storage image is measured.

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

The successful response is `audio/wav` with `Cache-Control: no-store`. The current Docker image installs eSpeak NG as the prototype offline engine. `ISpeechSynthesizer` is the replacement boundary for Piper or another approved engine.

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
Tts__Executable=espeak-ng
```

`appsettings.Development.json` and the development Docker Compose file explicitly enable the marked mock answer so the pipeline can be exercised before Ollama is connected. A production deployment must use `ASPNETCORE_ENVIRONMENT=Production` and leave that flag disabled.

## Ollama handoff

The teammate implementing Qwen should add an `OllamaChatModelClient : IChatModelClient` and replace this registration in `ApiGateway/Program.cs`:

```csharp
builder.Services.AddSingleton<IChatModelClient, DevelopmentChatModelClient>();
```

The adapter receives the bounded `IReadOnlyList<ConversationMessage>`, language, and cancellation token. It should not add a second persistent conversation store or log message contents. Ollama/model container wiring is intentionally deferred until that implementation is ready.

## Privacy boundary

- Raw microphone audio remains on the robot.
- Patient text is not added to `DeviceStore`, workflow JSON, or application logs.
- Conversation history is process-local, bounded, resettable, and expires automatically.
- Generated WAV is not written to ACU disk; the robot deletes its temporary cache file after playback.
- Managed .NET strings cannot provide forensic byte-for-byte RAM erasure. The implemented guarantee is no application-level persistence and prompt release of references, not literal physical-memory zeroization.

Before distributing a product image, review the eSpeak NG/Piper engine and selected voice licenses under the organization's third-party software policy.
