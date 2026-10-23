"""Fake ACU gateway for local testing. Mimics the routes from the organizers' API guide."""
import copy, os, uuid
from datetime import datetime, timezone
from fastapi import FastAPI, File, Form, HTTPException, Response, UploadFile

app = FastAPI(title="MOCK ACU Gateway")
DEVICE_ID = "mock-robot-001"
WORKFLOWS, ASSIGNMENTS, MEDIA = {}, {}, {}

@app.get("/api/health")
def health():
    return {"status": "ok", "timestamp": datetime.now(timezone.utc).isoformat()}

@app.get("/api/acu/devices")
def devices():
    return [{"deviceId": DEVICE_ID, "name": "Mock KettyBot", "status": "approved", "online": True}]

@app.post("/api/workflows/robot", status_code=201)
def create_workflow(wf: dict):
    wid = wf.get("WorkflowID")
    if not wid or not wf.get("Steps") or not wf.get("RobotId"):
        raise HTTPException(400, "WorkflowID, RobotId and Steps are required")
    if wid in WORKFLOWS:
        raise HTTPException(409, "Workflow already exists")
    WORKFLOWS[wid] = wf
    return wf

@app.put("/api/acu/robot-workflows/{wid}")
def update_workflow(wid: str, wf: dict):
    if wid not in WORKFLOWS:
        raise HTTPException(404, "Workflow not found")
    if wf.get("WorkflowID") != wid:
        raise HTTPException(400, "WorkflowID in body must match URL")
    WORKFLOWS[wid] = wf
    return wf

@app.post("/api/acu/robot-workflows/{wid}/assignments/{device_id}")
def publish(wid: str, device_id: str):
    if wid not in WORKFLOWS:
        raise HTTPException(404, "Workflow not found")
    ASSIGNMENTS[device_id] = copy.deepcopy(WORKFLOWS[wid])
    step = ASSIGNMENTS[device_id]["Steps"][0]
    print(f"\n🤖 ROBOT {device_id} WOULD NOW SHOW: {step.get('Title')!r}")
    print(f"   speaks/plays: {step.get('TTS') or step.get('Audio')}\n")
    return Response(status_code=204)

@app.get("/api/bot/robot-workflows/{device_id}/workflow")
def robot_reads_workflow(device_id: str):
    wf = ASSIGNMENTS.get(device_id)
    return {"Workflows": [wf] if wf else []}

@app.post("/api/acu/robot-workflows/media", status_code=201)
async def upload_media(kind: str = Form(...), file: UploadFile = File(...)):
    name = uuid.uuid4().hex + os.path.splitext(file.filename or "")[1]
    MEDIA[name] = await file.read()
    return {"path": f"/api/bot/robot-workflows/media/{name}"}

@app.get("/api/bot/robot-workflows/media/{name}")
def get_media(name: str):
    if name not in MEDIA:
        raise HTTPException(404, "Not found")
    return Response(MEDIA[name], media_type="audio/wav")
