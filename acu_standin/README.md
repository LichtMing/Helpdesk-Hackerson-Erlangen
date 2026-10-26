# ACU stand-in gateway

A single-file Python gateway that lets the Android robot run a demo without
Docker, .NET, or the full ACU stack. It implements the subset of the ACU API
that the robot and the operator UI use, auto-approves robots by default, and
answers from the team's CT guide, approved templates, and optionally a local
Ollama model.

This is a demo substitute. It is not the production gateway and does not provide
authentication, durable storage, or the full workflow engine.

## Runtime path

```text
Robot app
  -> http://<laptop>:3000/api/health
  -> POST /api/bot/register
  -> GET  /api/bot/registration-status/{deviceId}
  -> POST /api/chat
  -> POST /api/tts
  -> POST /api/reset
```

## Requirements

- Python 3.10+
- `pip install --requirement acu_standin/requirements.lock` (19 pinned packages;
  direct dependencies are listed in `requirements.txt`). The full inventory is
  in [`../docs/DEPENDENCIES.md`](../docs/DEPENDENCIES.md).
- Optional: a local Ollama server with the `ct-robot` model
- Optional TTS:
  - Piper voices in `helpdesk_api/voices/` (`en_US-lessac-medium.onnx`,
    `de_DE-thorsten-medium.onnx`) with `piper-tts==1.8.0` installed. The exact
    Python 3.12 set is in
    `Source/acu/ApiGateway/Tts/requirements-piper.lock`, or
  - macOS `say` + `afconvert` for the built-in voices.

To download and verify the Piper voices for the stand-in on Python 3.12 (the
version the lockfile targets):

```bash
python3.12 -m pip install --requirement Source/acu/ApiGateway/Tts/requirements-piper.lock
python3.12 Source/acu/ApiGateway/Tts/prepare_piper_voices.py \
  --data-dir helpdesk_api/voices en_US-lessac-medium de_DE-thorsten-medium
```

On Python 3.10, install `piper-tts==1.8.0` instead and let pip resolve a
compatible ONNX Runtime/NumPy set; the exact 3.12 lock does not install there.

Without either TTS backend, `/api/tts` returns `503`. Chat still works. Chinese
TTS is not implemented in the stand-in; use the full ACU backend for `zh_CN`.

## Run

From the repository root:

```bash
python3 -m pip install --requirement acu_standin/requirements.lock
python3 acu_standin/standin_gateway.py
```

The server listens on `0.0.0.0:3000`. Use the laptop's LAN address in the robot
setup screen (not `localhost`).

Optional Ollama setup:

```bash
ollama create ct-robot -f Source/acu/Modelfile.txt
OLLAMA_MODEL=ct-robot python3 acu_standin/standin_gateway.py
```

## Environment variables

| Variable | Default | Purpose |
| --- | --- | --- |
| `PORT` | `3000` | Listen port |
| `AUTO_APPROVE` | `1` | Register robots as `approved`; set `0` to test approval |
| `OLLAMA_URL` | `http://localhost:11434` | Local Ollama address |
| `OLLAMA_MODEL` | `ct-robot` | Model name |
| `GUIDE_PATH` | `data/siemens_ct_guide.txt` | Reference text for retrieval |
| `VOICE_DIR` | `helpdesk_api/voices` | Piper voice directory |
| `LOG_LEVEL` | `warning` | Uvicorn log level |
| `LOG_TEXT` | unset | Set to `1` to print question/answer text; leave unset for privacy |

## Endpoints

| Method | Path | Purpose |
| --- | --- | --- |
| `GET` | `/api/health` | Health probe |
| `POST` | `/api/bot/register` | Register a robot |
| `GET` | `/api/bot/registration-status/{deviceId}` | Approval status |
| `GET` | `/api/bot/instructions/{deviceId}` | Instruction command (currently empty) |
| `POST` | `/api/bot/device-status/{deviceId}` | Robot events, including help requests |
| `GET` | `/api/acu/devices` | Operator device list |
| `POST` | `/api/acu/accept/{deviceId}` | Approve a pending robot |
| `POST` | `/api/chat` | Text answer with `route` metadata |
| `POST` | `/api/tts` | WAV speech |
| `POST` | `/api/reset` | Clear an in-memory session |

The chat response adds a `route` field such as `approved:duration`,
`safety:staff`, or `model` so the evaluation scripts can inspect behaviour.

## Answer strategy

1. Small talk and safety-critical phrases are handled by explicit templates.
2. Common patient questions use approved answers from the CT guide.
3. Claustrophobia / small-space wording gets a reviewed calming answer.
4. Otherwise the guide is retrieved, the model is asked, and the answer is
   cleaned for spoken output. If Ollama is unavailable, the guide answer is
   returned directly.

Conversations are kept in memory per `(deviceId, sessionId)`, are bounded, and
expire after five idle minutes. Patient text is not persisted or logged unless
`LOG_TEXT=1`.

## Evaluation

With the stand-in running on `localhost:3000`:

```bash
python3 eval/run_eval.py
python3 eval/run_eval2.py
```

See [`../eval/README.md`](../eval/README.md) for expected output and the
recorded results.

## Differences from the production gateway

- No authentication or durable JSON storage; restarting forgets devices.
- No workflow CRUD or mDNS advertisement.
- `AUTO_APPROVE=1` by default, which is convenient for demos and unsafe for a
  shared event robot.
- TTS depends on local Piper voices or macOS `say`; `/api/tts` can return `503`
  on a bare Linux laptop.
- Chinese TTS is not implemented in the stand-in; chat still answers in Chinese
  when the model does.
