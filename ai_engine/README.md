# AI retrieval experiments

This directory contains the AI teammate's local retrieval prototype, source material, and evaluation questions. It is not a production service and is not started by Docker Compose.

Create an isolated Python environment before running the experiment:

```text
python -m venv .venv
source .venv/bin/activate
pip install --requirement ai_engine/requirements.txt
python ai_engine/test_embed.py
```

`test_embed.py` downloads the embedding model into `models_cache/`. Model files, generated indexes, and virtual environments are intentionally excluded from Git.

The runtime integration boundary is `helpdesk_api/`. When the AI implementation is ready, that internal service should call Ollama and the .NET gateway should reach it through an `IChatModelClient` adapter. Do not expose experimental answers directly to the robot.
