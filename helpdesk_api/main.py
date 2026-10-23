import time, uuid
from fastapi import FastAPI
from pydantic import BaseModel
import gateway_client, tts

app = FastAPI(title="ACU Helpdesk API")
SESSIONS: dict[str, dict] = {}   # kept in memory only, never written to disk

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
        audio_path = gateway_client.upload_audio(audio)
        gateway_client.publish_answer(answer, audio_path)
        return "sent_to_robot_with_audio"
    except Exception as audio_error:
        try:
            gateway_client.publish_answer(answer)
            return f"sent_to_robot_text_only (audio failed: {audio_error})"
        except Exception as e:
            return f"robot_delivery_failed: {e}"

@app.get("/api/health")
def health():
    return {"status": "ok", "active_sessions": len(SESSIONS),
            "gateway": gateway_client.GATEWAY_URL, "robot": gateway_client.DEVICE_ID}

@app.post("/api/chat")
def chat(body: ChatIn):
    sid = body.session_id or uuid.uuid4().hex
    session = SESSIONS.setdefault(sid, {"history": [], "created": time.time()})
    lang = body.lang if body.lang in ("de", "en") else "en"
    t0 = time.time()
    result = get_answer(body.message, lang)
    session["history"].append({"q": body.message, "a": result["answer"]})
    delivery = deliver_to_robot(result["answer"], lang)
    return {"session_id": sid, "lang": lang, "robot_delivery": delivery,
            "latency_ms": int((time.time() - t0) * 1000), **result}

@app.post("/api/reset")
def reset(body: ResetIn):
    wiped = SESSIONS.pop(body.session_id, None) is not None
    return {"session_id": body.session_id, "wiped": wiped}
