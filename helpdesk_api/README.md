# Internal Ollama adapter

This FastAPI service is a private text-only boundary between the .NET ACU
ApiGateway and Ollama:

~~~text
Robot Android app
  local microphone + Silero VAD + Whisper
  -> recognized text
  -> ApiGateway:3000 (identity, sessions, reset, TTS)
  -> helpdesk-api:8000/internal/chat
  -> Ollama:11434 (ct-robot)
~~~

It is not a robot-facing API. It does not accept audio, perform STT, discover a
robot, publish workflows, synthesize speech, or retain conversation sessions.
Those responsibilities already exist in the robot app and ApiGateway.

## Endpoints

- `GET /api/health`: verifies that Ollama is reachable.
- `POST /internal/chat`: accepts bounded `user`/`assistant` text messages
  and returns one model answer.

Example request:

~~~json
{
  "messages": [
    { "role": "user", "content": "How long does the scan take?" }
  ],
  "language": "en"
}
~~~

The service is started through the Compose `ai` profile. Port 8000 is exposed
only to the internal Compose network.

~~~bash
cd Source/acu
docker compose --profile ai up --build
~~~

Raw audio remains on the robot. ApiGateway owns temporary conversation history
and clears it through `POST /api/reset`.
