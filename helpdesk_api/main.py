import time, uuid
from fastapi import FastAPI
from pydantic import BaseModel

app = FastAPI(title="ACU Helpdesk API")

SESSIONS: dict[str, dict] = {}   # kept in memory only, never written to disk

class ChatIn(BaseModel):
    message: str
    session_id: str | None = None
    lang: str | None = None      # "de" or "en"

class ResetIn(BaseModel):
    session_id: str

def get_answer(text: str, lang: str) -> dict:
    # Placeholder until the AI engine is plugged in
    if lang == "de":
        return {"answer": "Das ist eine Testantwort.", "route": "placeholder"}
    return {"answer": "This is a test answer.", "route": "placeholder"}

@app.get("/api/health")
def health():
    return {"status": "ok", "active_sessions": len(SESSIONS)}

@app.post("/api/chat")
def chat(body: ChatIn):
    sid = body.session_id or uuid.uuid4().hex
    session = SESSIONS.setdefault(sid, {"history": [], "created": time.time()})
    lang = body.lang or "en"
    result = get_answer(body.message, lang)
    session["history"].append({"q": body.message, "a": result["answer"]})
    return {"session_id": sid, "lang": lang, **result}

@app.post("/api/reset")
def reset(body: ResetIn):
    wiped = SESSIONS.pop(body.session_id, None) is not None
    return {"session_id": body.session_id, "wiped": wiped}
