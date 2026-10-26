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

| Method | Path | Purpose |
| --- | --- | --- |
| `GET` | `/api/health` | Verifies that Ollama is reachable |
| `POST` | `/internal/chat` | Accepts bounded `user`/`assistant` text and returns one model answer |

Example request:

~~~json
{
  "messages": [
    { "role": "user", "content": "How long does the scan take?" }
  ],
  "language": "en"
}
~~~

Response:

~~~json
{
  "answer": "A CT scan usually takes between 10 and 20 minutes.",
  "language": "en",
  "is_mock": false
}
~~~

The complete internal contract, including validation limits, is in
[`API.md`](API.md).

## Configuration

| Variable | Default | Purpose |
| --- | --- | --- |
| `OLLAMA_BASE_URL` | `http://localhost:11434` | Ollama address |
| `OLLAMA_MODEL` | `ct-robot` | Model created from `Source/acu/Modelfile.txt` |
| `OLLAMA_TIMEOUT_SECONDS` | `45` | Upstream request timeout |

Direct dependencies are declared in [`requirements.txt`](requirements.txt) and
fully resolved in [`requirements.lock`](requirements.lock) for Python 3.12
(18 packages): FastAPI `0.159.1`, Uvicorn `0.53.0`, requests `2.32.5`,
Pydantic `2.14.1`, plus their transitive packages. The Docker image installs the
lockfile. See [`../docs/DEPENDENCIES.md`](../docs/DEPENDENCIES.md) for the full
inventory.

## Run with Compose

The service is started through the Compose `ai` profile. Port 8000 is exposed
only to the internal Compose network.

~~~bash
cd Source/acu
docker compose --profile ai up -d --build
docker compose --profile ai logs -f helpdesk-api
~~~

## Run locally

Requires Python 3.12. Install the fully pinned lockfile:

~~~bash
cd helpdesk_api
python3.12 -m pip install --requirement requirements.lock
OLLAMA_BASE_URL=http://localhost:11434 OLLAMA_MODEL=ct-robot \
  uvicorn main:app --host 0.0.0.0 --port 8000
~~~

## Tests

The tests use the Python standard library's `unittest` and mock the Ollama HTTP
call. Run them inside the pinned container so the dependency versions match:

~~~bash
cd Source/acu
docker compose --profile ai build helpdesk-api
docker compose --profile ai run --rm --no-deps \
  -v "$PWD/../../helpdesk_api:/app" helpdesk-api \
  python -m unittest discover -s tests -v
~~~

Expected: **4 tests pass**.

## Limits and failure behaviour

- Only `user` and `assistant` roles are accepted.
- Each message is limited to 2,000 characters; at most 20 messages and 12,000
  total characters are accepted.
- Empty model output becomes `503`; the service never invents a fallback answer.
- Only `en`, `de`, and `zh` are recognized; other language tags normalize to
  `en`.

## Privacy

Raw audio remains on the robot. ApiGateway owns temporary conversation history
and clears it through `POST /api/reset`. This adapter keeps no session store and
does not log patient text. See
[`../Source/acu/CONVERSATION_PIPELINE.md`](../Source/acu/CONVERSATION_PIPELINE.md)
for the end-to-end safety boundary.
