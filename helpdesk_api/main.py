"""Internal text-only adapter between ACU ApiGateway and local Ollama.

Raw microphone audio must never be sent to this service. Speech recognition is
performed by the Android robot before ApiGateway calls this adapter.
"""

import os
from typing import Literal

import requests
from fastapi import FastAPI, HTTPException
from pydantic import BaseModel, Field, field_validator, model_validator

OLLAMA_BASE_URL = os.getenv("OLLAMA_BASE_URL", "http://localhost:11434").rstrip("/")
OLLAMA_MODEL = os.getenv("OLLAMA_MODEL", "ct-robot")
OLLAMA_TIMEOUT_SECONDS = float(os.getenv("OLLAMA_TIMEOUT_SECONDS", "45"))

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
    messages: list[ChatMessage] = Field(min_length=1, max_length=20)
    language: str = Field(default="en", max_length=16)

    @model_validator(mode="after")
    def conversation_must_fit_context(self):
        if sum(len(message.content) for message in self.messages) > 12_000:
            raise ValueError("conversation text is too long")
        return self


class ChatResponse(BaseModel):
    answer: str
    language: str
    is_mock: bool = False


def normalize_language(language: str) -> str:
    normalized = language.strip().lower().split("-", 1)[0]
    return normalized if normalized in {"en", "de", "zh"} else "en"


def ollama_chat(messages: list[ChatMessage]) -> str:
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
        raise HTTPException(status_code=503, detail="Local language model is unavailable") from error

    if not content:
        raise HTTPException(status_code=503, detail="Local language model returned an empty answer")
    return content


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
    language = normalize_language(body.language)
    return ChatResponse(
        answer=ollama_chat(body.messages),
        language=language,
    )
