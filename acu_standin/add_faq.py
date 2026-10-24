"""Adds pre-approved answers (from the CT guide) to acu_standin/standin_gateway.py.
Run from the repo root, after add_safety.py."""
import sys
path = sys.argv[1] if len(sys.argv) > 1 else "acu_standin/standin_gateway.py"
s = open(path, encoding="utf-8").read()
if "APPROVED_ANSWERS" in s:
    raise SystemExit("Approved answers are already installed.")
if "SAFETY_RULES" not in s:
    raise SystemExit("Please run add_safety.py first.")

def rep(old, new):
    global s
    if s.count(old) != 1:
        raise SystemExit(f"Could not find the expected code: {old[:60]!r}")
    s = s.replace(old, new)

FAQ = r'''

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
      r"nach der untersuchung", r"nach hause", r"danach"],
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
      r"\bessen\b", r"trinken", r"n[uü]chtern"],
     {"en": "The hospital will tell you if there is anything you need to do before your scan. "
            "For example, you may be asked not to eat or drink anything for several hours beforehand. "
            "If you are not sure, please ask the radiology team.",
      "de": "Das Krankenhaus sagt Ihnen, ob Sie vor der Untersuchung etwas beachten müssen. "
            "Zum Beispiel kann es sein, dass Sie einige Stunden vorher nichts essen oder trinken dürfen. "
            "Wenn Sie unsicher sind, fragen Sie bitte das Radiologie-Team."}),
    ("companion",
     [r"someone (come|with me)", r"come with me", r"bring (someone|a friend|my)", r"companion", r"accompan",
      r"begleit", r"mitbringen", r"mitkommen"],
     {"en": "You can ask the hospital whether you can bring someone to support you during the scan.",
      "de": "Sie können im Krankenhaus fragen, ob jemand Sie während der Untersuchung begleiten und unterstützen darf."}),
    ("metal",
     [r"jewel", r"metal", r"earring", r"necklace", r"\bring\b", r"\bzip", r"hair clip", r"\bbra\b",
      r"schmuck", r"metall", r"ohrring", r"kette", r"rei[sß]verschluss"],
     {"en": "Please do not wear anything with metal in it, such as jewellery, clothes with zips or poppers, bras or hair clips.",
      "de": "Bitte tragen Sie nichts mit Metall, zum Beispiel Schmuck, Kleidung mit Reißverschlüssen oder Druckknöpfen, BHs oder Haarklammern."}),
    ("contrast",
     [r"contrast", r"\bdye\b", r"injection", r"kontrastmittel", r"spritze"],
     {"en": "Contrast medium is a dye that shows more detail in the pictures. It can be given as a drink or injected into a vein. "
            "If it is injected, you may feel hot and flushed, notice a metal taste in your mouth, or feel like you are peeing even though you are not. "
            "These feelings usually pass quickly.",
      "de": "Kontrastmittel ist ein Farbstoff, der mehr Details auf den Bildern zeigt. Es kann getrunken oder in eine Vene gespritzt werden. "
            "Bei einer Spritze kann Ihnen warm werden, Sie können einen metallischen Geschmack spüren oder das Gefühl haben, Wasser zu lassen. "
            "Diese Gefühle vergehen meist schnell."}),
    ("anxiety",
     [r"small spaces?", r"claustro", r"platzangst", r"\bangst\b"],
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
'''

rep("\n\ndef safety_check(question: str) -> str | None:", FAQ + "\n\ndef safety_check(question: str) -> str | None:")

rep('''    try:
        answer, route = ask_model(history, question), "model"''',
'''    approved = approved_answer(question, language)
    if approved:
        answer, name = approved
        with LOCK:
            if key in SESSIONS:
                SESSIONS[key]["history"].extend([{"role": "user", "content": question},
                                                 {"role": "assistant", "content": answer}])
        return answer, f"approved:{name}"
    try:
        answer, route = ask_model(history, question), "model"''')

open(path, "w", encoding="utf-8").write(s)
print("Approved answers installed.")
