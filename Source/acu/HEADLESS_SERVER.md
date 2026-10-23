# Headless ACU server

This branch keeps every existing source project, including `ACU.FE`, but the
default runtime is a command-line-only host server. The operator dashboard is
an optional Compose profile and is not built or started by default.

## Start the complete server

```bash
cd Source/acu
docker compose up --build -d
docker compose ps
```

The default stack starts:

- `backend`: public robot gateway on TCP port 3000;
- `helpdesk-api`: private text-only adapter;
- `ollama`: private Qwen runtime;
- `ollama-model-init`: one-shot creation of `ct-robot` from Qwen2.5 1.5B;
- `piper-model-init`: one-shot download of the offline neural voices.

Only port 3000 is published. Ports 8000 and 11434 remain inside the Compose
network. Ollama and Piper models are stored in named volumes, not Git.

## Monitor communication

```bash
docker compose logs --follow --tail=100 backend helpdesk-api ollama
```

Filter the structured communication events:

```bash
docker compose logs --follow backend helpdesk-api | grep "COMM "
```

Show only received and generated text:

```bash
docker compose logs --follow backend | grep "COMM_TEXT"
```

The monitor records device IDs, request/session IDs, languages, character
counts, byte counts, delivery states, and latency. In this branch,
`CommunicationLogging__IncludeText=true` also prints the complete robot
transcript and Qwen answer as JSON-escaped strings. These lines contain patient
data and must not be retained in production logs. Set the variable to `false`
to disable text logging. MAC addresses and WAV bytes are never printed.

## Robot flow

1. The Android app connects to `http://<ACU-LAN-IP>:3000`.
2. It registers and sends a heartbeat every ten seconds.
3. Local Whisper/VAD converts patient speech to text on the robot.
4. The robot posts text to `POST /api/chat`.
5. The server runs `ct-robot` (Qwen2.5 1.5B) through Ollama.
6. The server assigns a text/TTS answer workflow to that robot.
7. The robot starts the workflow, calls `POST /api/tts`; Piper creates WAV
   bytes in memory, and the robot receives and
   plays them, deletes its temporary cache file, and completes the workflow.

Raw microphone audio is never uploaded to the ACU.

The internal Ollama request timeout is 120 seconds and the outer ApiGateway
timeout is 150 seconds. This ordering allows a Qwen model unloaded after an
idle period to cold-start without the gateway abandoning the request first.

## Optional preserved dashboard

The existing frontend remains available when explicitly requested:

```bash
docker compose --profile dashboard up --build -d frontend
```

It is then available on `http://localhost:3100`. This profile is not required
for robot registration or conversation APIs; approval can also be performed
through the documented REST API.

For example, after the robot registers itself:

```bash
curl http://localhost:3000/api/acu/devices
curl -X POST http://localhost:3000/api/acu/accept/<device-id>
```

## Stop

```bash
docker compose down
```

Do not add `--volumes` unless the stored device/workflow state and downloaded
Ollama and Piper models should intentionally be deleted.
