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
  -> gateway_client.publish_answer
  -> ApiGateway robot workflow assignment
~~~

It is not a robot-facing API. It does not accept audio, perform STT, synthesize
speech, or retain conversation sessions. After inference it uses the teammate
module contract in `gateway_client.py` to publish a text/TTS workflow through
ApiGateway. The delivery result is returned through ApiGateway; the Android app
starts the assigned workflow, speaks its TTS text, and marks it complete. It
uses the direct response only when workflow delivery or retrieval is unavailable.

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

The service is part of the default headless Compose runtime. Port 8000 is
exposed only to the internal Compose network.

~~~bash
cd Source/acu
docker compose up --build -d
~~~

Raw audio remains on the robot. ApiGateway owns temporary conversation history
and clears it through `POST /api/reset`. Set `GATEWAY_URL` to the ACU gateway
and use `ROBOT_DEVICE_ID=auto` to prefer an approved online robot when the
caller does not supply its device ID. `OLLAMA_TIMEOUT_SECONDS` defaults to 120
seconds so an idle Qwen model has enough time to reload; the ApiGateway timeout
must remain higher than this value.
