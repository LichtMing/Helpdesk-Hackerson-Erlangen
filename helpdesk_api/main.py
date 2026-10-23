import time, uuid
from fastapi import FastAPI
from pydantic import BaseModel
import gateway_client

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
        return {"answer": "Das ist eine Testantwort.", "route": "placeholder"}
    return {"answer": "This is a test answer.", "route": "placeholder"}

@app.get("/api/health")
def health():
    return {"status": "ok", "active_sessions": len(SESSIONS),
            "gateway": gateway_client.GATEWAY_URL, "robot": gateway_client.DEVICE_ID}

@app.post("/api/chat")
def chat(body: ChatIn):
    sid = body.session_id or uuid.uuid4().hex
    session = SESSIONS.setdefault(sid, {"history": [], "created": time.time()})
    lang = body.lang or "en"
    result = get_answer(body.message, lang)
    session["history"].append({"q": body.message, "a": result["answer"]})
    try:
        gateway_client.publish_answer(result["answer"])
        delivery = "sent_to_robot"
    except Exception as e:
        delivery = f"robot_delivery_failed: {e}"
    return {"session_id": sid, "lang": lang, "robot_delivery": delivery, **result}

@app.post("/api/reset")
def reset(body: ResetIn):
    wiped = SESSIONS.pop(body.session_id, None) is not None
    return {"session_id": body.session_id, "wiped": wiped}
