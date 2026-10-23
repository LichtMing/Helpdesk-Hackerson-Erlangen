"""Publish model answers to a robot through the ACU gateway.

This preserves the module contract from the helpdesk-api branch:
``publish_answer(text, audio_path=None)``.  The optional ``robot_id`` keyword
lets ApiGateway route a reply back to the robot that initiated the chat,
instead of guessing when several approved robots are registered.
"""

import logging
import os
from urllib.parse import quote

import requests

GATEWAY_URL = os.getenv("GATEWAY_URL", "http://localhost:3000").rstrip("/")
DEVICE_ID = os.getenv("ROBOT_DEVICE_ID", "auto")
WORKFLOW_ID = os.getenv("WORKFLOW_ID", "erlangen-helpdesk-answer")
GATEWAY_TIMEOUT_SECONDS = float(os.getenv("GATEWAY_TIMEOUT_SECONDS", "10"))

_found_device: str | None = None
logger = logging.getLogger("acu.communication.gateway")


def _url(path: str) -> str:
    return f"{GATEWAY_URL}{path}"


def device_id() -> str:
    """Return the configured robot, or choose an approved robot on the gateway."""
    global _found_device
    if DEVICE_ID != "auto":
        return DEVICE_ID
    if _found_device:
        return _found_device

    response = requests.get(_url("/api/acu/devices"), timeout=GATEWAY_TIMEOUT_SECONDS)
    response.raise_for_status()
    robots = [
        robot
        for robot in response.json()
        if robot.get("status") == "approved" and robot.get("deviceId")
    ]
    robots.sort(key=lambda robot: not bool(robot.get("online")))
    if not robots:
        raise RuntimeError("No approved robot found on the ACU gateway")

    _found_device = str(robots[0]["deviceId"])
    logger.info(
        "COMM direction=acu_internal event=robot_selected robotId=%s online=%s",
        _found_device,
        bool(robots[0].get("online")),
    )
    return _found_device


def build_workflow(text: str, audio_path: str | None = None, robot_id: str | None = None) -> dict:
    target = robot_id or device_id()
    logger.info(
        "COMM direction=acu_to_robot event=workflow_publish_started robotId=%s workflowId=%s answerChars=%d",
        target,
        WORKFLOW_ID,
        len(text),
    )
    step: dict = {
        "StepId": "Step-1",
        "ScreenId": "Confirmation",
        "Title": text,
    }
    if audio_path:
        step["Audio"] = [{"AudioPath": audio_path}]
    else:
        step["TTS"] = text

    return {
        "WorkflowID": WORKFLOW_ID,
        "WorkflowName": "Helpdesk answer",
        "Description": "Answer to a patient question",
        "RobotId": target,
        "Steps": [step],
    }


def publish_answer(
    text: str,
    audio_path: str | None = None,
    *,
    robot_id: str | None = None,
) -> str:
    """Create/update the answer workflow and assign it to the selected robot.

    Returns the selected device ID. HTTP and validation failures are raised to
    the caller so it can report or apply a fallback delivery path.
    """
    target = robot_id or device_id()
    workflow = build_workflow(text, audio_path, target)
    workflow_id = quote(WORKFLOW_ID, safe="")

    response = requests.put(
        _url(f"/api/acu/robot-workflows/{workflow_id}"),
        json=workflow,
        timeout=GATEWAY_TIMEOUT_SECONDS,
    )
    if response.status_code == 404:
        response = requests.post(
            _url("/api/workflows/robot"),
            json=workflow,
            timeout=GATEWAY_TIMEOUT_SECONDS,
        )
    response.raise_for_status()

    response = requests.post(
        _url(
            f"/api/acu/robot-workflows/{workflow_id}/assignments/"
            f"{quote(target, safe='')}"
        ),
        timeout=GATEWAY_TIMEOUT_SECONDS,
    )
    response.raise_for_status()
    logger.info(
        "COMM direction=acu_to_robot event=workflow_assigned robotId=%s workflowId=%s",
        target,
        WORKFLOW_ID,
    )
    return target
