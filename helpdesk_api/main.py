"""Internal text-only adapter between ACU ApiGateway and local Ollama.

Raw microphone audio must never be sent to this service. Speech recognition is
performed by the Android robot before ApiGateway calls this adapter.
"""

import logging
import os
import time
from typing import Literal

import requests
from fastapi import FastAPI, HTTPException
from pydantic import BaseModel, ConfigDict, Field, field_validator, model_validator

import gateway_client

OLLAMA_BASE_URL = os.getenv("OLLAMA_BASE_URL", "http://localhost:11434").rstrip("/")
OLLAMA_MODEL = os.getenv("OLLAMA_MODEL", "ct-robot")
OLLAMA_TIMEOUT_SECONDS = float(os.getenv("OLLAMA_TIMEOUT_SECONDS", "120"))

logging.basicConfig(
    level=os.getenv("LOG_LEVEL", "INFO").upper(),
    format="%(asctime)s %(levelname)s %(name)s %(message)s",
)
logger = logging.getLogger("acu.communication")

app = FastAPI(
    title="ACU Internal Model Adapter",
    description="Private text-only Ollama adapter. Robot clients must use ApiGateway:3000.",
)


class ChatMessage(BaseModel):
    role: Literal["user", "assistant"]
    content: str = Field(min_length=1, max_length=2_000)

    @field_validator("content")
    @classmethod
    def content_must_not_be_blank(cls, value: str) -> str:
        value = value.strip()
        if not value:
            raise ValueError("message content must not be blank")
        return value


class ChatRequest(BaseModel):
    model_config = ConfigDict(populate_by_name=True)

    messages: list[ChatMessage] = Field(min_length=1, max_length=20)
    language: str = Field(default="en", max_length=16)
    robot_id: str | None = Field(default=None, alias="robotId", min_length=1, max_length=200)

    @model_validator(mode="after")
    def conversation_must_fit_context(self):
        if sum(len(message.content) for message in self.messages) > 12_000:
            raise ValueError("conversation text is too long")
        return self


class ChatResponse(BaseModel):
    answer: str
    language: str
    is_mock: bool = False
    robot_delivery: str


def normalize_language(language: str) -> str:
    normalized = language.strip().lower().split("-", 1)[0]
    return normalized if normalized in {"en", "de", "zh"} else "en"


def ollama_chat(messages: list[ChatMessage]) -> str:
    started = time.monotonic()
    logger.info(
        "COMM direction=acu_to_model event=ollama_request model=%s turns=%d textChars=%d",
        OLLAMA_MODEL,
        len(messages),
        sum(len(message.content) for message in messages),
    )
    payload = {
        "model": OLLAMA_MODEL,
        "messages": [message.model_dump() for message in messages],
        "stream": False,
        "keep_alive": "10m",
    }
    try:
        response = requests.post(
            f"{OLLAMA_BASE_URL}/api/chat",
            json=payload,
            timeout=OLLAMA_TIMEOUT_SECONDS,
        )
        response.raise_for_status()
        content = response.json().get("message", {}).get("content", "").strip()
    except (requests.RequestException, ValueError) as error:
        logger.warning(
            "COMM direction=acu_internal event=ollama_unavailable elapsedMs=%d errorType=%s",
            int((time.monotonic() - started) * 1000),
            type(error).__name__,
        )
        raise HTTPException(status_code=503, detail="Local language model is unavailable") from error

    if not content:
        raise HTTPException(status_code=503, detail="Local language model returned an empty answer")
    logger.info(
        "COMM direction=model_to_acu event=ollama_response answerChars=%d elapsedMs=%d",
        len(content),
        int((time.monotonic() - started) * 1000),
    )
    return content


def deliver_to_robot(answer: str, robot_id: str | None) -> str:
    """Publish the text answer using the helpdesk-api gateway module contract."""
    try:
        gateway_client.publish_answer(answer, robot_id=robot_id)
        return "sent_to_robot_text_only"
    except Exception:
        # ApiGateway still returns the answer to the requesting Android app,
        # which can use its direct /api/tts playback path as a safe fallback.
        logger.exception(
            "COMM direction=acu_to_robot event=workflow_delivery_failed robotId=%s",
            robot_id or "auto",
        )
        return "robot_delivery_failed"


@app.get("/api/health")
def health() -> dict:
    try:
        response = requests.get(f"{OLLAMA_BASE_URL}/api/tags", timeout=3)
        response.raise_for_status()
        models = response.json().get("models", [])
        installed = {str(model.get("name", "")).split(":", 1)[0] for model in models}
        if OLLAMA_MODEL.split(":", 1)[0] not in installed:
            raise HTTPException(status_code=503, detail="Configured Ollama model is not installed")
    except (requests.RequestException, ValueError) as error:
        raise HTTPException(status_code=503, detail="Ollama is unavailable") from error
    return {"status": "ok", "provider": "ollama", "model": OLLAMA_MODEL}


@app.post("/internal/chat", response_model=ChatResponse)
def chat(body: ChatRequest) -> ChatResponse:
    logger.info(
        "COMM direction=acu_internal event=chat_adapter_received robotId=%s language=%s turns=%d",
        body.robot_id or "auto",
        body.language,
        len(body.messages),
    )
    language = normalize_language(body.language)
    answer = ollama_chat(body.messages)
    return ChatResponse(
        answer=answer,
        language=language,
        robot_delivery=deliver_to_robot(answer, body.robot_id),
    )
