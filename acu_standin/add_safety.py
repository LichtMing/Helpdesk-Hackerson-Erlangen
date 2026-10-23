"""Adds a safety layer to acu_standin/standin_gateway.py (run from the repo root)."""
import sys
path = sys.argv[1] if len(sys.argv) > 1 else "acu_standin/standin_gateway.py"
s = open(path, encoding="utf-8").read()
if "SAFETY_RULES" in s:
    raise SystemExit("Safety layer is already installed.")

def rep(old, new):
    global s
    if s.count(old) != 1:
        raise SystemExit(f"Could not find the expected code: {old[:60]!r}")
    s = s.replace(old, new)

SAFETY = r'''

# ---------------------------------------------------------------- safety layer
# Checked BEFORE the model is asked. Medical, urgent and location questions get a
# fixed, safe answer, because a small model does not reliably follow such rules.
SAFETY_RULES = [
    ("urgent", [
        r"chest pain", r"brustschmerz", r"dizzy", r"schwindel", r"faint", r"ohnm[aä]cht",
        r"can'?t breathe", r"cannot breathe", r"short of breath", r"atemnot", r"keine luft",
        r"itch", r"juck", r"swell", r"geschwollen", r"bleed", r"blut(et|ung)",
        r"feel (very )?(unwell|sick|ill)", r"mir ist (schlecht|übel)", r"emergency", r"notfall",
    ]),
    ("clinical", [
        r"medic", r"medikament", r"tablet", r"pill", r"metformin", r"insulin", r"aspirin",
        r"warfarin", r"blood thinner", r"blutverd[uü]nn", r"\bdose\b", r"stop taking", r"absetzen",
        r"pregnan", r"schwanger", r"breastfeed", r"stillen",
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


def safety_check(question: str) -> str | None:
    lowered = question.lower()
    for category, patterns in SAFETY_RULES:
        if any(re.search(p, lowered) for p in patterns):
            return category
    return None
'''

rep('    "zh": "这个问题我不确定。请询问放射科工作人员，他们会很乐意帮助您。",\n}\n',
    '    "zh": "这个问题我不确定。请询问放射科工作人员，他们会很乐意帮助您。",\n}\n' + SAFETY)

rep('''    try:
        answer, route = ask_model(history, question), "model"''',
'''    category = safety_check(question)
    if category:
        answer, route = SAFE_ANSWERS[category].get(language, SAFE_ANSWERS[category]["en"]), f"safety:{category}"
        if category in ("urgent", "clinical"):
            print(f"\\n>>> STAFF ATTENTION ({category}) requested by robot {device_id}\\n", flush=True)
        with LOCK:
            if key in SESSIONS:
                SESSIONS[key]["history"].extend([{"role": "user", "content": question},
                                                 {"role": "assistant", "content": answer}])
        return answer, route
    try:
        answer, route = ask_model(history, question), "model"''')

rep(r'''"relevant, and do not add facts that are not in it:\n"''',
    r'''"relevant, answer only the exact question asked, and do not add facts, numbers "
            "or advice that are not in it:\n"''')

rep('"keep_alive": "30m", "options": {"num_ctx": 4096}}',
    '"keep_alive": "30m", "options": {"num_ctx": 4096, "temperature": 0.1}}')

rep('"language": language, "isMock": False, "generatedAt": now_iso()',
    '"language": language, "isMock": False, "generatedAt": now_iso(), "route": route')

open(path, "w", encoding="utf-8").write(s)
print("Safety layer installed.")
