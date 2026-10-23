import os, time, uuid
from fastapi import FastAPI, File, Form, UploadFile
from fastapi.responses import HTMLResponse
from pydantic import BaseModel
import gateway_client, tts, stt

app = FastAPI(title="ACU Helpdesk API")
SESSIONS: dict[str, dict] = {}   # kept in memory only, never written to disk
HERE = os.path.dirname(__file__)

class ChatIn(BaseModel):
    message: str
    session_id: str | None = None
    lang: str | None = None      # "de" or "en"

class ResetIn(BaseModel):
    session_id: str

def get_answer(text, lang):
    # Placeholder until the AI engine is plugged in
    if lang == "de":
        return {"answer": "Die Untersuchung selbst dauert meist nur wenige Minuten.", "route": "placeholder"}
    return {"answer": "The scan itself usually takes only a few minutes.", "route": "placeholder"}

def deliver_to_robot(answer, lang):
    """Generate speech, upload it, publish to the robot. Falls back to text if audio fails."""
    try:
        audio = tts.synthesize(answer, lang)
        path = gateway_client.upload_audio(audio)
        gateway_client.publish_answer(answer, path)
        return "sent_to_robot_with_audio", gateway_client.GATEWAY_URL.rstrip("/") + path
    except Exception as audio_error:
        try:
            gateway_client.publish_answer(answer)
            return f"sent_to_robot_text_only (audio failed: {audio_error})", None
        except Exception as e:
            return f"robot_delivery_failed: {e}", None

def handle_question(text, lang, session_id):
    sid = session_id or uuid.uuid4().hex
    session = SESSIONS.setdefault(sid, {"history": [], "created": time.time()})
    result = get_answer(text, lang)
    session["history"].append({"q": text, "a": result["answer"]})
    delivery, audio_url = deliver_to_robot(result["answer"], lang)
    return {"session_id": sid, "lang": lang, "robot_delivery": delivery, "audio_url": audio_url, **result}

@app.get("/", response_class=HTMLResponse)
def talk_page():
    with open(os.path.join(HERE, "talk.html"), encoding="utf-8") as f:
        return f.read()

@app.get("/api/health")
def health():
    return {"status": "ok", "active_sessions": len(SESSIONS),
            "gateway": gateway_client.GATEWAY_URL, "robot": gateway_client.DEVICE_ID}

@app.post("/api/chat")
def chat(body: ChatIn):
    t0 = time.time()
    lang = body.lang if body.lang in ("de", "en") else "en"
    res = handle_question(body.message, lang, body.session_id)
    res["latency_ms"] = int((time.time() - t0) * 1000)
    return res

@app.post("/api/chat/audio")
def chat_audio(audio: UploadFile = File(...), session_id: str | None = Form(None),
               lang: str | None = Form(None)):
    t0 = time.time()
    data = audio.file.read()
    text, detected = stt.transcribe(data, lang if lang in ("de", "en") else None)
    del data                                   # raw audio is never stored
    stt_ms = int((time.time() - t0) * 1000)
    if not text:
        return {"session_id": session_id, "transcript": "", "answer": None,
                "route": "no_speech", "latency_ms": stt_ms}
    res = handle_question(text, detected, session_id)
    res.update(transcript=text, stt_ms=stt_ms, latency_ms=int((time.time() - t0) * 1000))
    return res

@app.post("/api/reset")
def reset(body: ResetIn):
    wiped = SESSIONS.pop(body.session_id, None) is not None
    return {"session_id": body.session_id, "wiped": wiped}
