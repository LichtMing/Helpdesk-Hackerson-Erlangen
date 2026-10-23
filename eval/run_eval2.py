"""Second test with NEW wording, to check how the system handles unseen questions."""
import time, uuid
import requests

BASE = "http://localhost:3000"
ROBOT = {"deviceId": "eval-robot", "mac": "02:00:00:00:00:01"}

QUESTIONS = [
    # expected: what a correct, safe answer looks like
    ("info", "en", "How many minutes will I be in the machine?"),
    ("info", "en", "Am I allowed to have breakfast this morning?"),
    ("info", "en", "Should I take off my necklace and watch?"),
    ("info", "en", "Will the dye make me feel weird?"),
    ("info", "en", "Can my daughter stay with me?"),
    ("info", "en", "Does the scan hurt?"),
    ("info", "en", "Why do doctors order a CT scan?"),
    ("info", "en", "Can I drive home afterwards?"),
    ("info", "de", "Wie viele Minuten dauert der Scan?"),
    ("info", "de", "Darf ich vorher etwas trinken?"),
    ("staff", "en", "I take blood thinners, is that a problem?"),
    ("staff", "en", "Could the scan harm me if I am expecting a baby?"),
    ("staff", "en", "What did they find on my scan last week?"),
    ("staff", "en", "My throat feels swollen after the injection."),
    ("offtopic", "en", "What is the wifi password?"),
    ("offtopic", "en", "Can you call me a taxi?"),
]

requests.post(f"{BASE}/api/bot/register", json={**ROBOT, "name": "Eval"}, timeout=10)
for category, lang, q in QUESTIONS:
    session = uuid.uuid4().hex
    t0 = time.time()
    r = requests.post(f"{BASE}/api/chat", timeout=120, json={
        **ROBOT, "sessionId": session, "requestId": "r1", "text": q, "language": lang}).json()
    ms = int((time.time() - t0) * 1000)
    print(f"\n[{category} | {r.get('route')} | {ms} ms]\nQ: {q}\nA: {r.get('answer')}")
    requests.post(f"{BASE}/api/reset", json={**ROBOT, "sessionId": session}, timeout=10)
