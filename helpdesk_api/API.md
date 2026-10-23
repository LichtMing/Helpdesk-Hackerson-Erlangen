# Helpdesk API

The integration layer of the smart patient companion. It takes a patient's question
(voice or text), gets an answer, turns it into speech and sends it to the robot via the
ACU gateway.

    Patient voice (WAV) -> stt -> answer model -> tts -> ACU gateway -> KettyBot

Runs on http://localhost:8000 — interactive docs at http://localhost:8000/docs,
push-to-talk test page at http://localhost:8000/

## Endpoints (for the UI)

### POST /api/chat/audio — voice question

Request: multipart/form-data

| Field | Required | Description |
|---|---|---|
| audio | yes | WAV file, 16-bit PCM |
| lang | no | "de" or "en"; leave out to auto-detect |
| session_id | no | reuse the value from the previous response to keep a conversation |

Response:

~~~json
{
  "session_id": "8239dd9ef18d406580569f8509498adf",
  "lang": "de",
  "transcript": "Wie lange dauert die Untersuchung?",
  "answer": "Die Untersuchung selbst dauert meist nur wenige Minuten.",
  "route": "placeholder",
  "robot_delivery": "sent_to_robot_with_audio",
  "audio_url": "http://localhost:3000/api/bot/robot-workflows/media/<id>.wav",
  "stt_ms": 640,
  "latency_ms": 820
}
~~~

If nothing was understood: transcript is "", answer is null, route is "no_speech".

### POST /api/chat — typed question

~~~json
{ "message": "How long does it take?", "lang": "en", "session_id": null }
~~~

Response: same fields as above, without transcript and stt_ms.

### POST /api/reset — end a patient session (GDPR)

~~~json
{ "session_id": "8239dd9ef18d406580569f8509498adf" }
~~~

Response: { "session_id": "...", "wiped": true }. Call this when a patient is done.

### GET /api/health

Response: { "status": "ok", "active_sessions": 0, "gateway": "...", "robot": "..." }

### Field meanings

- robot_delivery: sent_to_robot_with_audio (normal), sent_to_robot_text_only (speech
  generation failed, robot reads the text), or robot_delivery_failed
- audio_url: the spoken answer; the UI can play it when no real robot is connected
- route: where the answer came from (set by the answer model, e.g. faq, llm, escalate)

## Module interfaces (for teammates)

The API calls each part through one function. Keep these names and inputs/outputs,
and you can change everything inside them without breaking the API.

| Module | Owner | Function | Returns |
|---|---|---|---|
| stt.py | STT/TTS | transcribe(audio_bytes, lang=None) | (text, "de" or "en") |
| tts.py | STT/TTS | synthesize(text, lang="en") | WAV file as bytes |
| answer model | Model | answer(question, lang) | dict with at least "answer", ideally "route" |
| gateway_client.py | API | publish_answer(text, audio_path=None) | nothing (raises on error) |

The answer model is plugged in in main.py, function get_answer (currently a placeholder).

## Running locally

~~~bash
cd helpdesk_api
python3 -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
~~~

Voices for text-to-speech (about 60 MB each, not in Git):

~~~bash
mkdir -p voices
for f in en/en_US/lessac/medium/en_US-lessac-medium de/de_DE/thorsten/medium/de_DE-thorsten-medium; do
  curl -L -o voices/$(basename $f).onnx      https://huggingface.co/rhasspy/piper-voices/resolve/main/$f.onnx
  curl -L -o voices/$(basename $f).onnx.json https://huggingface.co/rhasspy/piper-voices/resolve/main/$f.onnx.json
done
~~~

The Whisper model (about 145 MB) downloads automatically on first use into models_cache/.

Start, in two terminals:

~~~bash
uvicorn mock_gateway:app --port 3000      # fake ACU gateway for local testing
uvicorn main:app --reload --port 8000     # the helpdesk API
~~~

### Using the real gateway and robot

~~~bash
GATEWAY_URL=http://10.27.239.122:3000 ROBOT_DEVICE_ID=<our-device-id> uvicorn main:app --reload --port 8000
~~~

| Variable | Default | Meaning |
|---|---|---|
| GATEWAY_URL | http://localhost:3000 | ACU gateway (mock by default) |
| ROBOT_DEVICE_ID | mock-robot-001 | our robot's device ID from the organizers |
| WORKFLOW_ID | erlangen-helpdesk-answer | workflow used to deliver answers |
| WHISPER_MODEL | base | speech recognition model size |
| VOICE_DIR | ./voices | folder with the Piper voice files |

## Privacy

- Sessions and audio are kept in memory only, never written to disk.
- Raw audio is discarded right after transcription.
- POST /api/reset deletes a session immediately.

## Known issues

- faster-whisper + newest av library: av 19 breaks faster-whisper's audio decoding
  ("unexpected keyword argument 'metadata_errors'"). stt.py avoids this by reading WAV
  directly with Python's wave module, so input must be WAV.
- Robot speech language is a global gateway setting (default de-DE). We avoid it by
  generating our own audio in the right language and sending it as an Audio item.
