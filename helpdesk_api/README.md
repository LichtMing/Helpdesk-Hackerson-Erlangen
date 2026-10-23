# Internal helpdesk API

This directory contains the AI teammate's FastAPI integration boundary. It is an internal service, not the robot-facing gateway.

The intended deployment path is:

```text
Robot -> .NET ApiGateway:3000 -> helpdesk-api:8000 -> Ollama:11434
```

`main.py` currently returns a placeholder answer and does not call Ollama. Consequently, the .NET gateway deliberately continues to use its explicitly marked development adapter. Do not expose port 8000 to robots or use the placeholder as patient guidance.

The optional Compose `ai` profile packages this service and Ollama so the AI team can develop the internal integration without changing the public gateway contract.
