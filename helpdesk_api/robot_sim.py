"""Simulated KettyBot: registers with the ACU gateway, sends heartbeats,
and shows whatever workflow gets published to it."""
import json, os, time
import requests

GATEWAY = os.getenv("GATEWAY_URL", "http://10.27.239.122:3000").rstrip("/")
DEVICE = os.getenv("ROBOT_DEVICE_ID", "erlangen-helpdesk-sim")
MAC = os.getenv("ROBOT_MAC", "02:00:00:00:13:37")

# Check these three in the gateway's Swagger page and adjust if needed
STATUS_PATH = f"/api/bot/registration-status/{DEVICE}"
TELEMETRY_PATH = f"/api/bot/devicestatus/{DEVICE}"
WORKFLOW_PATH = f"/api/bot/robot-workflows/{DEVICE}/workflow"

def register():
    r = requests.post(f"{GATEWAY}/api/bot/register", timeout=10, json={
        "deviceId": DEVICE, "name": "Erlangen Helpdesk Simulator",
        "mac": MAC, "firmware": "sim-1"})
    if r.status_code == 409:
        print("Already registered.")
    else:
        r.raise_for_status()
        print("Registered, waiting for approval:", r.json())

def main():
    register()
    last_shown = None
    while True:
        try:
            status = requests.get(GATEWAY + STATUS_PATH, timeout=5).json().get("status")
            if status != "approved":
                print(f"Status: {status} – ask the organizers to approve '{DEVICE}'")
            else:
                requests.post(GATEWAY + TELEMETRY_PATH, timeout=5, json={
                    "mac": MAC, "battery": 100, "lastSeenLocation": "CT Reception"})
                workflows = requests.get(GATEWAY + WORKFLOW_PATH, timeout=5).json().get("Workflows", [])
                current = json.dumps(workflows, sort_keys=True)
                if workflows and current != last_shown:
                    last_shown = current
                    for step in workflows[0].get("Steps", []):
                        print("\n" + "=" * 50)
                        print("🤖 ROBOT SCREEN:", step.get("Title"))
                        if step.get("TTS"):
                            print("🔊 SPEAKS:     ", step["TTS"])
                        for a in step.get("Audio", []):
                            print("🔊 PLAYS AUDIO:", GATEWAY + a["AudioPath"])
                        print("=" * 50)
        except Exception as e:
            print("Error:", e)
        time.sleep(3)

if __name__ == "__main__":
    main()
