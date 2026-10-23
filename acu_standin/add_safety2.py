"""Extends the safety layer and approved answers after the second test (run from the repo root)."""
import sys
path = sys.argv[1] if len(sys.argv) > 1 else "acu_standin/standin_gateway.py"
s = open(path, encoding="utf-8").read()
if "SAFETY_V2" in s:
    raise SystemExit("Safety update 2 is already installed.")
if "APPROVED_ANSWERS" not in s:
    raise SystemExit("Please run add_safety.py and add_faq.py first.")

def rep(old, new):
    global s
    if s.count(old) != 1:
        raise SystemExit(f"Could not find the expected code: {old[:60]!r}")
    s = s.replace(old, new)

rep('r"itch", r"juck", r"swell", r"geschwollen", r"bleed", r"blut(et|ung)",',
    'r"itch", r"juck", r"swell", r"swollen", r"throat", r"rash", r"hives", r"tight chest", '
    'r"\\bhurts\\b", r"in pain", r"tut (mir )?weh", r"geschwollen", r"hals", r"ausschlag", '
    'r"bleed", r"blut(et|ung)",  # SAFETY_V2')

rep('r"pregnan", r"schwanger", r"breastfeed", r"stillen",',
    'r"pregnan", r"expecting", r"\\bbaby\\b", r"schwanger", r"breastfeed", r"stillen", '
    'r"reaction", r"what did (they|you|the doctors?) find", r"my scan (show|found)", r"reaktion",')

rep('r"\\bessen\\b", r"trinken", r"n[uü]chtern"],',
    'r"breakfast", r"lunch", r"dinner", r"\\bmeal", r"coffee", r"\\btea\\b", r"\\bwater\\b", '
    'r"\\bessen\\b", r"trinken", r"n[uü]chtern", r"fr[uü]hst[uü]ck", r"kaffee", r"wasser"],')
rep('r"begleit", r"mitbringen", r"mitkommen"],',
    'r"stay with me", r"with me (during|in)", '
    'r"(daughter|son|husband|wife|partner|mother|father|mum|mom|dad|friend|family) (come|stay|be with|join)", '
    'r"begleit", r"mitbringen", r"mitkommen", r"bei mir bleiben"],')
rep('r"nach der untersuchung", r"nach hause", r"danach"],',
    'r"\\bdrive\\b", r"\\bdriving\\b", r"nach der untersuchung", r"nach hause", r"danach", r"auto fahren"],')

rep('    ("contrast",\n',
'''    ("pain",
     [r"does (it|the scan|a ct( scan)?) hurt", r"will (it|the scan) hurt", r"is (it|the scan) painful",
      r"tut (es|das|die untersuchung) weh", r"schmerzhaft"],
     {"en": "During the scan you lie still on a flat bed while the scanner, a large ring, moves around part of your body. "
            "The radiographer can hear and speak to you the whole time. If you get contrast medium as an injection, "
            "you may feel hot and flushed for a moment. Please tell the radiographer if anything feels uncomfortable.",
      "de": "Während der Untersuchung liegen Sie still auf einer flachen Liege, und der Scanner, ein großer Ring, bewegt sich um einen Teil Ihres Körpers. "
            "Das Personal kann Sie die ganze Zeit hören und mit Ihnen sprechen. Wenn Sie Kontrastmittel gespritzt bekommen, "
            "kann Ihnen kurz warm werden. Bitte sagen Sie Bescheid, wenn sich etwas unangenehm anfühlt."}),
    ("contrast",
''')

open(path, "w", encoding="utf-8").write(s)
print("Safety update 2 installed.")
