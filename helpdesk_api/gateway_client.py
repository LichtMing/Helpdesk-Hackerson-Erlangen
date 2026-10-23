"""Sends helpdesk answers to the robot via the ACU gateway (real or mock)."""
import os
import requests
from urllib.parse import quote

GATEWAY_URL = os.getenv("GATEWAY_URL", "http://localhost:3000")   # mock by default
DEVICE_ID = os.getenv("ROBOT_DEVICE_ID", "mock-robot-001")
WORKFLOW_ID = os.getenv("WORKFLOW_ID", "erlangen-helpdesk-answer")

def _url(path):
    return GATEWAY_URL.rstrip("/") + path

def upload_audio(wav_bytes, filename="answer.wav"):
    r = requests.post(_url("/api/acu/robot-workflows/media"), data={"kind": "Audio"},
                      files={"file": (filename, wav_bytes, "audio/wav")}, timeout=20)
    r.raise_for_status()
    return r.json()["path"]

def build_workflow(text, audio_path=None):
    step = {"StepId": "Step-1", "ScreenId": "Confirmation", "Title": text}
    if audio_path:
        step["Audio"] = [{"AudioPath": audio_path}]
    else:
        step["TTS"] = text
    return {"WorkflowID": WORKFLOW_ID, "WorkflowName": "Helpdesk answer",
            "Description": "Answer to a patient question", "RobotId": DEVICE_ID, "Steps": [step]}

def publish_answer(text, audio_path=None):
    wf = build_workflow(text, audio_path)
    wid = quote(WORKFLOW_ID, safe="")
    r = requests.put(_url(f"/api/acu/robot-workflows/{wid}"), json=wf, timeout=10)
    if r.status_code == 404:
        r = requests.post(_url("/api/workflows/robot"), json=wf, timeout=10)
    r.raise_for_status()
    r = requests.post(_url(f"/api/acu/robot-workflows/{wid}/assignments/{quote(DEVICE_ID, safe='')}"), timeout=10)
    r.raise_for_status()
