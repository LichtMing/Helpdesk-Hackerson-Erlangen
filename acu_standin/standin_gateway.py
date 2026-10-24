"""ACU stand-in gateway for the robot app (runs on a laptop, no Docker or .NET needed).

Answers exactly the requests the robot app makes: health, register, registration status,
instructions, device status (help button), chat, tts, reset; plus /api/acu/devices and
/api/acu/accept/{deviceId} for the operator. Answers come from the team's "ct-robot" model
in Ollama with the whole CT guide as reference; without Ollama, from the guide directly.
Speech: Piper voices in helpdesk_api/voices, else the Mac's built-in voices.
Conversations live in memory only and are never logged.

Start from the repo root:  python acu_standin/standin_gateway.py
"""
from __future__ import annotations

import io
import math
import os
import re
import subprocess
import tempfile
import threading
import time
import wave
from datetime import datetime, timezone
from pathlib import Path

import requests
import uvicorn
from fastapi import FastAPI, Request
from fastapi.responses import JSONResponse, Response

ROOT = Path(__file__).resolve().parent.parent
GUIDE_PATH = Path(os.getenv("GUIDE_PATH", ROOT / "data" / "siemens_ct_guide.txt"))
VOICE_DIR = Path(os.getenv("VOICE_DIR", ROOT / "helpdesk_api" / "voices"))
OLLAMA_URL = os.getenv("OLLAMA_URL", "http://localhost:11434").rstrip("/")
OLLAMA_MODEL = os.getenv("OLLAMA_MODEL", "ct-robot")
AUTO_APPROVE = os.getenv("AUTO_APPROVE", "1") == "1"
PORT = int(os.getenv("PORT", "3000"))
MAX_TURNS = 6
SESSION_IDLE_SECONDS = 5 * 60

app = FastAPI(title="ACU stand-in gateway")

DEVICES: dict[str, dict] = {}
SESSIONS: dict[tuple[str, str], dict] = {}
LOCK = threading.Lock()


def now_iso() -> str:
    return datetime.now(timezone.utc).isoformat()


def error(status: int, message: str) -> JSONResponse:
    return JSONResponse({"error": message}, status_code=status)


def check_robot(device_id: str, mac: str | None) -> JSONResponse | None:
    device = DEVICES.get(device_id or "")
    if device is None:
        return error(404, "Device not found")
    if mac is not None and device["mac"].lower() != str(mac).lower():
        return error(403, "MAC address does not match the registered device")
    if device["status"] != "approved":
        return error(403, "Device is not approved")
    device["lastSeen"] = now_iso()
    return None


# ---------------------------------------------------------------- CT guide
STOPWORDS = set(
    "a an the is are was be to of and or in on at for with do does did i my me you your it "
    "can will would should how what when where why who which there this that if have has "
    "am not no yes ct get need".split()
)


def load_guide() -> list[str]:
    if not GUIDE_PATH.exists():
        return []
    blocks, current = [], []
    for line in GUIDE_PATH.read_text(encoding="utf-8").splitlines():
        line = line.strip()
        if not line:
            if current:
                blocks.append(" ".join(current))
                current = []
            continue
        current.append(line)
    if current:
        blocks.append(" ".join(current))
    merged, carry = [], ""
    for block in blocks:
        text = f"{carry} {block}".strip()
        if len(text) < 160:
            carry = text
        else:
            merged.append(text)
            carry = ""
    if carry:
        merged.append(carry)
    return merged


GUIDE = load_guide()
GUIDE_TEXT = GUIDE_PATH.read_text(encoding="utf-8").strip() if GUIDE_PATH.exists() else ""


def stem(word: str) -> str:
    for suffix in ("ing", "es", "ed", "s"):
        if word.endswith(suffix) and len(word) - len(suffix) >= 3:
            return word[: -len(suffix)]
    return word


def words(text: str) -> set[str]:
    return {stem(w) for w in re.findall(r"[a-zäöüß]+", text.lower()) if w not in STOPWORDS and len(w) > 2}


_PASSAGE_WORDS = [words(p) for p in GUIDE]
_DOC_FREQ: dict[str, int] = {}
for _ws in _PASSAGE_WORDS:
    for _w in _ws:
        _DOC_FREQ[_w] = _DOC_FREQ.get(_w, 0) + 1


def retrieve(question: str, k: int = 2) -> list[str]:
    q = words(question)
    if not q:
        return []
    scored = []
    for passage, pw in zip(GUIDE, _PASSAGE_WORDS):
        score = sum(math.log(1 + len(GUIDE) / _DOC_FREQ[w]) for w in q & pw)
        if score >= 1.0:
            scored.append((score, passage))
    scored.sort(key=lambda item: item[0], reverse=True)
    return [passage for _, passage in scored[:k]]


# ---------------------------------------------------------------- language
GERMAN_HINTS = {"ich", "der", "die", "das", "und", "ist", "wie", "lange", "muss", "darf", "kann",
                "nicht", "untersuchung", "kontrastmittel", "essen", "trinken", "wann", "was"}


def normalize_language(language: str, text: str) -> str:
    lang = (language or "").strip().lower().split("-", 1)[0]
    if lang in {"en", "de", "zh"}:
        return lang
    lowered = text.lower()
    if any(ch in lowered for ch in "äöüß") or len(set(lowered.split()) & GERMAN_HINTS) >= 2:
        return "de"
    return "en"


FALLBACK = {
    "en": "I’m not sure about that. Please ask a member of the radiology team, they will be happy to help.",
    "de": "Das weiß ich leider nicht sicher. Bitte fragen Sie das Radiologie-Team, es hilft Ihnen gerne.",
    "zh": "这个问题我不确定。请询问放射科工作人员，他们会很乐意帮助您。",
}


# ---------------------------------------------------------------- safety layer
# Checked BEFORE the model is asked. Medical, urgent and location questions get a
# fixed, safe answer, because a small model does not reliably follow such rules.
SAFETY_RULES = [
    ("urgent", [
        r"chest pain", r"brustschmerz", r"dizzy", r"schwindel", r"faint", r"ohnm[aä]cht",
        r"can'?t breathe", r"cannot breathe", r"short of breath", r"atemnot", r"keine luft",
        r"itch", r"juck", r"swell", r"swollen", r"throat", r"rash", r"hives", r"tight chest", r"\bhurts\b", r"in pain", r"tut (mir )?weh", r"geschwollen", r"hals", r"ausschlag", r"bleed", r"blut(et|ung)",  # SAFETY_V2
        r"feel (very )?(unwell|sick|ill)", r"mir ist (schlecht|übel)", r"emergency", r"notfall",
    ]),
    ("clinical", [
        r"medic", r"medikament", r"tablet", r"pill", r"metformin", r"insulin", r"aspirin",
        r"warfarin", r"blood thinner", r"blutverd[uü]nn", r"\bdose\b", r"stop taking", r"absetzen",
        r"pregnan", r"expecting", r"\bbaby\b", r"schwanger", r"breastfeed", r"stillen", r"reaction", r"what did (they|you|the doctors?) find", r"my scan (show|found)", r"reaktion",
        r"tumou?r", r"cancer", r"krebs", r"diagnos", r"befund",
        r"what do my results", r"results (show|mean)", r"ergebnis(se)? (bedeute|zeig)",
        r"allerg", r"kidney", r"niere", r"diabet", r"asthma", r"thyroid", r"schilddr[uü]se",
        r"radiation (risk|dose)", r"strahlen(risiko|dosis)",
    ]),
    ("location", [
        r"cafeteria", r"canteen", r"\bcaf[eé]\b", r"kantine", r"toilet", r"restroom", r"bathroom",
        r"toilette", r"\bwc\b", r"parking", r"\bpark\b", r"parkplatz", r"wi-?fi", r"wlan",
        r"room number", r"which room", r"welcher raum", r"where is", r"wo ist", r"wo finde",
    ]),
]

SAFE_ANSWERS = {
    "urgent": {
        "en": "Please stay where you are. I am alerting a staff member right now, and someone will be with you in a moment.",
        "de": "Bitte bleiben Sie, wo Sie sind. Ich informiere sofort das Personal, gleich ist jemand bei Ihnen.",
        "zh": "请留在原地。我正在立即通知工作人员，马上会有人来帮助您。",
    },
    "clinical": {
        "en": "That is an important question that depends on your personal situation, so the radiology team should answer it. Please tell them before your scan, and I will let them know you have a question.",
        "de": "Das ist eine wichtige Frage, die von Ihrer persönlichen Situation abhängt. Bitte besprechen Sie sie vor der Untersuchung mit dem Radiologie-Team. Ich gebe Bescheid, dass Sie eine Frage haben.",
        "zh": "这是一个与您个人情况有关的重要问题，应由放射科团队回答。请在检查前告诉他们，我会通知他们您有问题。",
    },
    "location": {
        "en": "I don’t have that information here. Please ask at the reception desk, they will be happy to help you.",
        "de": "Diese Information habe ich leider nicht. Bitte fragen Sie am Empfang, dort hilft man Ihnen gerne.",
        "zh": "我这里没有这个信息。请到前台询问，他们会很乐意帮助您。",
    },
}


# ---------------------------------------------------------------- approved answers
# Common questions get a fixed answer taken from the CT guide, so the wording is
# exactly what the hospital approved. Checked after the safety layer, before the model.
# Order matters: the first matching entry wins.
APPROVED_ANSWERS = [
    ("results",
     [r"result", r"ergebnis"],
     {"en": "It usually takes 1 to 2 weeks to get your CT scan results, but it can take up to 4 weeks. "
            "A radiologist looks at the images and writes to the doctor who referred you, who will talk to you about them.",
      "de": "Die Ergebnisse dauern meist 1 bis 2 Wochen, manchmal bis zu 4 Wochen. "
            "Ein Radiologe wertet die Bilder aus und schreibt an die Ärztin oder den Arzt, die Sie überwiesen haben. Dort werden die Ergebnisse mit Ihnen besprochen."}),
    ("after",
     [r"stay after", r"after the scan", r"wait after", r"go home", r"leave (the hospital|after|afterwards)",
      r"\bdrive\b", r"\bdriving\b", r"nach der untersuchung", r"nach hause", r"danach", r"auto fahren"],
     {"en": "If you are an outpatient, you can usually go home soon after the scan. "
            "If you were given contrast medium, you may be asked to wait up to 30 minutes to make sure you do not have a reaction. "
            "Please tell the radiographer if you feel unwell.",
      "de": "Ambulante Patienten können meist kurz nach der Untersuchung nach Hause gehen. "
            "Wenn Sie Kontrastmittel bekommen haben, warten Sie eventuell bis zu 30 Minuten, um sicherzugehen, dass keine Reaktion auftritt. "
            "Bitte sagen Sie Bescheid, wenn Sie sich unwohl fühlen."}),
    ("duration",
     [r"how long", r"how many minutes", r"how much time", r"wie lange", r"wie viel zeit", r"dauer"],
     {"en": "A CT scan usually takes between 10 and 20 minutes.",
      "de": "Eine CT-Untersuchung dauert normalerweise zwischen 10 und 20 Minuten."}),
    ("eating",
     [r"\beat\b", r"\beating\b", r"\bdrink", r"\bfast(ing)?\b", r"\bfood\b", r"empty stomach",
      r"breakfast", r"lunch", r"dinner", r"\bmeal", r"coffee", r"\btea\b", r"\bwater\b", r"\bessen\b", r"trinken", r"n[uü]chtern", r"fr[uü]hst[uü]ck", r"kaffee", r"wasser"],
     {"en": "The hospital will tell you if there is anything you need to do before your scan. "
            "For example, you may be asked not to eat or drink anything for several hours beforehand. "
            "If you are not sure, please ask the radiology team.",
      "de": "Das Krankenhaus sagt Ihnen, ob Sie vor der Untersuchung etwas beachten müssen. "
            "Zum Beispiel kann es sein, dass Sie einige Stunden vorher nichts essen oder trinken dürfen. "
            "Wenn Sie unsicher sind, fragen Sie bitte das Radiologie-Team."}),
    ("companion",
     [r"someone (come|with me)", r"come with me", r"bring (someone|a friend|my)", r"companion", r"accompan",
      r"stay with me", r"with me (during|in)", r"(daughter|son|husband|wife|partner|mother|father|mum|mom|dad|friend|family) (come|stay|be with|join)", r"begleit", r"mitbringen", r"mitkommen", r"bei mir bleiben"],
     {"en": "You can ask the hospital whether you can bring someone to support you during the scan.",
      "de": "Sie können im Krankenhaus fragen, ob jemand Sie während der Untersuchung begleiten und unterstützen darf."}),
    ("metal",
     [r"jewel", r"metal", r"earring", r"necklace", r"\bring\b", r"\bzip", r"hair clip", r"\bbra\b",
      r"schmuck", r"metall", r"ohrring", r"kette", r"rei[sß]verschluss"],
     {"en": "Please do not wear anything with metal in it, such as jewellery, clothes with zips or poppers, bras or hair clips.",
      "de": "Bitte tragen Sie nichts mit Metall, zum Beispiel Schmuck, Kleidung mit Reißverschlüssen oder Druckknöpfen, BHs oder Haarklammern."}),
    ("pain",
     [r"does (it|the scan|a ct( scan)?) hurt", r"will (it|the scan) hurt", r"is (it|the scan) painful",
      r"tut (es|das|die untersuchung) weh", r"schmerzhaft"],
     {"en": "During the scan you lie still on a flat bed while the scanner, a large ring, moves around part of your body. "
            "The radiographer can hear and speak to you the whole time. If you get contrast medium as an injection, "
            "you may feel hot and flushed for a moment. Please tell the radiographer if anything feels uncomfortable.",
      "de": "Während der Untersuchung liegen Sie still auf einer flachen Liege, und der Scanner, ein großer Ring, bewegt sich um einen Teil Ihres Körpers. "
            "Das Personal kann Sie die ganze Zeit hören und mit Ihnen sprechen. Wenn Sie Kontrastmittel gespritzt bekommen, "
            "kann Ihnen kurz warm werden. Bitte sagen Sie Bescheid, wenn sich etwas unangenehm anfühlt."}),
    ("contrast",
     [r"contrast", r"\bdye\b", r"injection", r"kontrastmittel", r"spritze"],
     {"en": "Contrast medium is a dye that shows more detail in the pictures. It can be given as a drink or injected into a vein. "
            "If it is injected, you may feel hot and flushed, notice a metal taste in your mouth, or feel like you are peeing even though you are not. "
            "These feelings usually pass quickly.",
      "de": "Kontrastmittel ist ein Farbstoff, der mehr Details auf den Bildern zeigt. Es kann getrunken oder in eine Vene gespritzt werden. "
            "Bei einer Spritze kann Ihnen warm werden, Sie können einen metallischen Geschmack spüren oder das Gefühl haben, Wasser zu lassen. "
            "Diese Gefühle vergehen meist schnell."}),
    ("anxiety",
     [r"small spaces?", r"claustro", r"anxious", r"nervous", r"scared", r"afraid", r"worried",
      r"platzangst", r"\bangst\b", r"nerv[oö]s", r"sorge"],
     {"en": "It is completely normal to feel nervous. The CT scanner is a ring, not a long tunnel, and the radiographer can hear and speak to you the whole time. "
            "If you feel anxious or have a fear of small spaces, please tell the radiology team. They may be able to give you a medicine to help you relax.",
      "de": "Es ist ganz normal, nervös zu sein. Der CT-Scanner ist ein Ring, keine lange Röhre, und das Personal kann Sie die ganze Zeit hören und mit Ihnen sprechen. "
            "Wenn Sie Angst haben oder unter Platzangst leiden, sagen Sie bitte dem Radiologie-Team Bescheid. Man kann Ihnen eventuell ein Medikament zur Beruhigung geben."}),
    ("during",
     [r"what happens", r"during the scan", r"hold my breath", r"breath", r"lie still",
      r"was passiert", r"w[aä]hrend", r"atem", r"luft anhalten"],
     {"en": "You will lie on a flat bed while the scanner, a large ring, moves around part of your body. "
            "The radiographer controls it from another room but can hear and speak to you. "
            "Please lie still, and you may be asked to breathe in, breathe out or hold your breath.",
      "de": "Sie liegen auf einer flachen Liege, während sich der Scanner, ein großer Ring, um einen Teil Ihres Körpers bewegt. "
            "Das Personal steuert ihn aus einem anderen Raum, kann Sie aber hören und mit Ihnen sprechen. "
            "Bitte liegen Sie still. Eventuell werden Sie gebeten, ein- oder auszuatmen oder die Luft anzuhalten."}),
]


def approved_answer(question: str, language: str) -> tuple[str, str] | None:
    if language not in ("en", "de"):
        return None
    lowered = question.lower()
    for name, patterns, answers in APPROVED_ANSWERS:
        if any(re.search(p, lowered) for p in patterns):
            return answers[language], name
    return None


def safety_check(question: str) -> str | None:
    lowered = question.lower()
    for category, patterns in SAFETY_RULES:
        if any(re.search(p, lowered) for p in patterns):
            return category
    return None


# ---------------------------------------------------------------- answering
def ask_model(history: list[dict], question: str) -> str:
    content = question
    if GUIDE_TEXT:
        content = (
            "Reference information from the hospital's CT patient guide. Use it when it is "
            "relevant, answer only the exact question asked, and do not add facts, numbers "
            "or advice that are not in it:\n"
            f"{GUIDE_TEXT}\n\nPatient question: {question}"
        )
    messages = history[-6:] + [{"role": "user", "content": content}]
    response = requests.post(
        f"{OLLAMA_URL}/api/chat",
        json={"model": OLLAMA_MODEL, "messages": messages, "stream": False,
              "keep_alive": "30m", "options": {"num_ctx": 4096, "temperature": 0.1, "num_predict": 70, "repeat_penalty": 1.2}},
        timeout=60,
    )
    response.raise_for_status()
    answer = response.json().get("message", {}).get("content", "").strip()
    if not answer:
        raise ValueError("empty model answer")
    return tidy_answer(answer)


def tidy_answer(text: str, max_sentences: int = 3) -> str:
    """Spoken answers must be short: drop list markers and repeats, keep a few sentences."""
    lines, seen = [], set()
    for line in text.splitlines():
        line = re.sub(r"^\s*([-*•]|\d+[.)])\s*", "", line).strip()
        if line and line.lower() not in seen:
            seen.add(line.lower())
            lines.append(line if line.endswith((".", "!", "?", ":")) else line + ".")
    sentences = re.split(r"(?<=[.!?])\s+", " ".join(lines))
    short = " ".join(sentences[:max_sentences]).replace(":.", ".").strip()
    return short.rstrip(":") or text


def first_sentences(text: str, n: int = 3) -> str:
    parts = re.split(r"(?<=[.!?])\s+", text.strip())
    return " ".join(parts[:n])


def answer_question(device_id: str, session_id: str, question: str, language: str) -> tuple[str, str]:
    key = (device_id, session_id)
    with LOCK:
        session = SESSIONS.setdefault(key, {"history": [], "seen": time.time()})
        session["seen"] = time.time()
        history = list(session["history"])
    category = safety_check(question)
    if category:
        answer, route = SAFE_ANSWERS[category].get(language, SAFE_ANSWERS[category]["en"]), f"safety:{category}"
        if category in ("urgent", "clinical"):
            print(f"\n>>> STAFF ATTENTION ({category}) requested by robot {device_id}\n", flush=True)
        with LOCK:
            if key in SESSIONS:
                SESSIONS[key]["history"].extend([{"role": "user", "content": question},
                                                 {"role": "assistant", "content": answer}])
        return answer, route
    approved = approved_answer(question, language)
    if approved:
        answer, name = approved
        with LOCK:
            if key in SESSIONS:
                SESSIONS[key]["history"].extend([{"role": "user", "content": question},
                                                 {"role": "assistant", "content": answer}])
        return answer, f"approved:{name}"
    try:
        answer, route = ask_model(history, question), "model"
    except Exception:
        passages = retrieve(question, 1)
        if passages and language == "en":
            answer, route = first_sentences(passages[0]), "guide"
        else:
            answer, route = FALLBACK.get(language, FALLBACK["en"]), "fallback"
    with LOCK:
        if key in SESSIONS:
            h = SESSIONS[key]["history"]
            h.extend([{"role": "user", "content": question}, {"role": "assistant", "content": answer}])
            del h[: max(0, len(h) - 2 * MAX_TURNS)]
    return answer, route


def session_reaper() -> None:
    while True:
        time.sleep(30)
        cutoff = time.time() - SESSION_IDLE_SECONDS
        with LOCK:
            for key in [k for k, s in SESSIONS.items() if s["seen"] < cutoff]:
                SESSIONS.pop(key, None)


threading.Thread(target=session_reaper, daemon=True).start()


# ---------------------------------------------------------------- speech
PIPER_VOICES = {"en": "en_US-lessac-medium.onnx", "de": "de_DE-thorsten-medium.onnx"}
MAC_VOICES = {"en": "Samantha", "de": "Anna", "zh": "Tingting"}
_piper_cache: dict[str, object] = {}


def synthesize_piper(text: str, lang: str) -> bytes:
    from piper import PiperVoice

    if lang not in _piper_cache:
        _piper_cache[lang] = PiperVoice.load(str(VOICE_DIR / PIPER_VOICES[lang]))
    voice = _piper_cache[lang]
    buf = io.BytesIO()
    with wave.open(buf, "wb") as wav_file:
        if hasattr(voice, "synthesize_wav"):
            voice.synthesize_wav(text, wav_file)
        else:
            voice.synthesize(text, wav_file)
    return buf.getvalue()


def synthesize_mac(text: str, lang: str) -> bytes:
    with tempfile.TemporaryDirectory() as tmp:
        aiff, wav = Path(tmp) / "out.aiff", Path(tmp) / "out.wav"
        subprocess.run(["say", "-v", MAC_VOICES.get(lang, "Samantha"), "-o", str(aiff), text],
                       check=True, capture_output=True, timeout=30)
        subprocess.run(["afconvert", "-f", "WAVE", "-d", "LEI16@22050", str(aiff), str(wav)],
                       check=True, capture_output=True, timeout=30)
        return wav.read_bytes()


def synthesize(text: str, lang: str) -> bytes:
    if lang in PIPER_VOICES and (VOICE_DIR / PIPER_VOICES[lang]).exists():
        try:
            return synthesize_piper(text, lang)
        except Exception:
            pass
    return synthesize_mac(text, lang)


# ---------------------------------------------------------------- endpoints
@app.get("/api/health")
def health():
    return {"status": "ok", "timestamp": now_iso()}


@app.post("/api/bot/register")
async def register(request: Request):
    body = await request.json()
    device_id, mac = str(body.get("deviceId", "")).strip(), str(body.get("mac", "")).strip()
    if not device_id or not mac:
        return error(400, "deviceId and mac are required")
    with LOCK:
        existing = DEVICES.get(device_id)
        if existing and existing["mac"].lower() != mac.lower():
            return error(409, f"Device '{device_id}' is already registered with another MAC")
        if not existing:
            DEVICES[device_id] = {
                "deviceId": device_id, "mac": mac, "name": body.get("name", ""),
                "ip": body.get("ip", ""), "firmware": body.get("firmware", ""),
                "status": "approved" if AUTO_APPROVE else "pending",
                "registeredAt": now_iso(), "lastSeen": now_iso(), "recentEvents": [],
            }
            print(f"Robot registered: {device_id} ({DEVICES[device_id]['status']})", flush=True)
    return {"message": "Registered", "deviceId": device_id, "status": DEVICES[device_id]["status"]}


@app.get("/api/bot/registration-status/{device_id}")
def registration_status(device_id: str):
    device = DEVICES.get(device_id)
    return {"deviceId": device_id, "status": device["status"] if device else "unregistered"}


@app.get("/api/bot/instructions/{device_id}")
def instructions(device_id: str, mac: str | None = None):
    if (problem := check_robot(device_id, mac)) is not None:
        return problem
    return {"command": ""}


@app.post("/api/bot/device-status/{device_id}")
async def device_status(device_id: str, request: Request):
    body = await request.json()
    if (problem := check_robot(device_id, body.get("mac"))) is not None:
        return problem
    event = body.get("event")
    if event:
        DEVICES[device_id]["recentEvents"] = (
            DEVICES[device_id]["recentEvents"] + [{"event": event, "receivedAt": now_iso()}]
        )[-50:]
        if event == "patient_help_requested":
            print("\n" + "!" * 60 + "\n  PATIENT NEEDS HELP at robot " + device_id + "\n" + "!" * 60 + "\n", flush=True)
    return {"message": "Status updated", "status": "approved", "deviceId": device_id, "online": True}


@app.get("/api/acu/devices")
def devices():
    return list(DEVICES.values())


@app.post("/api/acu/accept/{device_id}")
def accept(device_id: str):
    if device_id not in DEVICES:
        return error(404, "Device not found")
    DEVICES[device_id]["status"] = "approved"
    return {"message": "Device approved", "deviceId": device_id}


@app.post("/api/chat")
async def chat(request: Request):
    body = await request.json()
    if (problem := check_robot(body.get("deviceId", ""), body.get("mac"))) is not None:
        return problem
    text = str(body.get("text", "")).strip()
    session_id, request_id = str(body.get("sessionId", "")), str(body.get("requestId", ""))
    if not text or not session_id or not request_id:
        return error(400, "text, sessionId and requestId are required")
    language = normalize_language(str(body.get("language", "")), text)
    t0 = time.time()
    import anyio
    answer, route = await anyio.to_thread.run_sync(answer_question, body["deviceId"], session_id, text, language)
    print(f"Answered ({route}, {language}) in {int((time.time() - t0) * 1000)} ms", flush=True)
    if os.getenv("LOG_TEXT") == "1":
        print(f"   Q: {text}\n   A: {answer}", flush=True)
    return {"sessionId": session_id, "requestId": request_id, "answer": answer,
            "language": language, "isMock": False, "generatedAt": now_iso(), "route": route}


@app.post("/api/tts")
async def tts(request: Request):
    body = await request.json()
    if (problem := check_robot(body.get("deviceId", ""), body.get("mac"))) is not None:
        return problem
    text = str(body.get("text", "")).strip()
    if not text:
        return error(400, "Speech text must not be empty")
    language = normalize_language(str(body.get("language", "")), text)
    try:
        import anyio
        audio = await anyio.to_thread.run_sync(synthesize, text, language)
    except Exception as exc:
        return error(503, f"Text-to-speech failed: {exc}")
    return Response(audio, media_type="audio/wav", headers={"Cache-Control": "no-store"})


@app.post("/api/reset")
async def reset(request: Request):
    body = await request.json()
    if (problem := check_robot(body.get("deviceId", ""), body.get("mac"))) is not None:
        return problem
    with LOCK:
        cleared = SESSIONS.pop((body["deviceId"], str(body.get("sessionId", ""))), None) is not None
    return {"sessionId": body.get("sessionId"), "cleared": cleared, "resetAt": now_iso()}



# ---------------------------------------------------------------- DEMO POLISH (small talk, unwell, contrast feelings, short model answers)
_URGENT_HINT = re.compile(r"breath|atem|luft|chest|brust|swell|swollen|throat|hals|rash|hives|ausschlag|pain|schmerz|bleed|blut", re.I)
_THANKS = re.compile(r"\b(thanks?|thank you|cheers|danke|dankesch\u00f6n|vielen dank)\b", re.I)
_BYE = re.compile(r"\b(bye|goodbye|see you|tsch\u00fcss|auf wiedersehen)\b", re.I)
_HELLO = re.compile(r"^\W*(hello|hi|hey|good (morning|afternoon)|hallo|guten (morgen|tag))\b", re.I)
_UNWELL = re.compile(r"sleepy|drowsy|\btired\b|dizzy|faint|\bsick\b|unwell|nause|not feel(ing)? (well|good)|feel (bad|weird|strange)|m\u00fcde|schwindel|\u00fcbel|schlecht|unwohl", re.I)
_WARM = re.compile(r"\bwarm|\bhot\b|flush|metal(lic)? taste|taste of metal|like (i'?m|i am) (peeing|weeing)|wet myself|geschmack|hei\u00df", re.I)
_CONTRAST = re.compile(r"contrast|\bdye\b|inject|substance|liquid|vein|kontrast|spritze|vene|mittel|taste|geschmack|peeing|weeing|wet myself", re.I)

_POLISH_TEXT = {
    "thanks": {"en": "You're welcome. I'm here if you have any more questions about your scan.",
               "de": "Gern geschehen. Ich bin hier, wenn Sie noch Fragen zu Ihrer Untersuchung haben."},
    "bye": {"en": "Goodbye, and all the best for your scan.",
            "de": "Auf Wiedersehen und alles Gute f\u00fcr Ihre Untersuchung."},
    "hello": {"en": "Hello! I can answer questions about your CT scan. What would you like to know?",
              "de": "Hallo! Ich beantworte gern Fragen zu Ihrer CT-Untersuchung. Was m\u00f6chten Sie wissen?"},
    "unwell": {"en": "Thank you for telling me. Please tell the radiology team how you are feeling. I will let them know now.",
               "de": "Danke, dass Sie es mir sagen. Bitte sagen Sie dem Radiologie-Team, wie es Ihnen geht. Ich gebe ihnen jetzt Bescheid."},
    "contrast_feel": {"en": "That is normal. When the contrast medium is injected, you may feel hot and flushed, notice a metal taste in your mouth, or feel like you are peeing when you are not. These feelings usually pass quickly. If you feel unwell, please tell the radiographer.",
                      "de": "Das ist normal. Wenn das Kontrastmittel gespritzt wird, kann Ihnen warm werden, Sie k\u00f6nnen einen metallischen Geschmack im Mund haben oder das Gef\u00fchl, Wasser zu lassen, obwohl das nicht so ist. Diese Gef\u00fchle gehen meist schnell vorbei. Wenn Sie sich unwohl f\u00fchlen, sagen Sie es bitte dem Radiologie-Team."},
}


def _polish_route(question: str) -> str | None:
    q = question.strip()
    if _URGENT_HINT.search(q):
        return None  # leave anything possibly urgent to the safety layer
    if _WARM.search(q) and _CONTRAST.search(q):
        return "contrast_feel"
    if _UNWELL.search(q):
        return "unwell"
    if len(q.split()) <= 6:
        if _THANKS.search(q):
            return "thanks"
        if _BYE.search(q):
            return "bye"
        if _HELLO.search(q):
            return "hello"
    return None


def _shorten(answer: str, max_sentences: int = 2) -> str:
    parts = [x for x in re.split(r"(?<=[.!?])\s+", answer.strip()) if x]
    if len(parts) > 1 and not parts[-1].rstrip().endswith((".", "!", "?")):
        parts = parts[:-1]  # drop a sentence that was cut off
    return " ".join(parts[:max_sentences]).strip() or answer.strip()


_answer_question_inner = answer_question


def answer_question(device_id, session_id, question, language):
    kind = _polish_route(question)
    if kind is not None:
        lang = "de" if str(language).startswith("de") else "en"
        if kind == "unwell":
            print(f"\n>>> STAFF ATTENTION (unwell) requested by robot {device_id}\n", flush=True)
            return _POLISH_TEXT[kind][lang], "safety:unwell"
        return _POLISH_TEXT[kind][lang], f"approved:{kind}"
    answer, route = _answer_question_inner(device_id, session_id, question, language)
    if route == "model":
        answer = _shorten(answer)
    return answer, route


if __name__ == "__main__":
    print(f"Guide passages loaded: {len(GUIDE)} | model: {OLLAMA_MODEL} | auto-approve: {AUTO_APPROVE}")
    uvicorn.run(app, host="0.0.0.0", port=PORT, log_level=os.getenv("LOG_LEVEL", "warning"))
