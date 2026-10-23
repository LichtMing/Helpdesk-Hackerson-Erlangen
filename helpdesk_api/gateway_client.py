"""Sends helpdesk answers to the robot via the ACU gateway (real or mock)."""
import os
import requests
from urllib.parse import quote

GATEWAY_URL = os.getenv("GATEWAY_URL", "http://localhost:3000")   # mock by default
DEVICE_ID = os.getenv("ROBOT_DEVICE_ID", "auto")    # "auto" = use the approved robot on the gateway
WORKFLOW_ID = os.getenv("WORKFLOW_ID", "erlangen-helpdesk-answer")
_found_device = None

def _url(path):
    return GATEWAY_URL.rstrip("/") + path

def device_id():
    """Return the robot's ID. With 'auto', look up the approved robot on the gateway."""
    global _found_device
    if DEVICE_ID != "auto":
        return DEVICE_ID
    if _found_device:
        return _found_device
    r = requests.get(_url("/api/acu/devices"), timeout=5)
    r.raise_for_status()
    robots = [d for d in r.json() if d.get("status") == "approved"]
    robots.sort(key=lambda d: not d.get("online"))     # prefer robots that are online
    if not robots:
        raise RuntimeError("No approved robot found on the gateway")
    _found_device = robots[0]["deviceId"]
    return _found_device

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
            "Description": "Answer to a patient question", "RobotId": device_id(), "Steps": [step]}

def publish_answer(text, audio_path=None):
    wf = build_workflow(text, audio_path)
    wid = quote(WORKFLOW_ID, safe="")
    r = requests.put(_url(f"/api/acu/robot-workflows/{wid}"), json=wf, timeout=10)
    if r.status_code == 404:
        r = requests.post(_url("/api/workflows/robot"), json=wf, timeout=10)
    r.raise_for_status()
    r = requests.post(_url(f"/api/acu/robot-workflows/{wid}/assignments/{quote(device_id(), safe='')}"), timeout=10)
    r.raise_for_status()
