# AI retrieval experiments

This directory contains the AI teammate's local retrieval prototype, source
material, and evaluation questions. It is **not** a runtime service and is not
started by Docker Compose. The production text path is
`helpdesk_api/` → Ollama, reached only through the .NET `ApiGateway`.

## Contents

| Path | Purpose |
| --- | --- |
| `test_embed.py` | Builds a small local embedding index and runs retrieval checks |
| `requirements.txt` | Pinned experiment dependencies |
| `docs/ct_patient_info.txt` | Patient-facing reference text |
| `eval/questions.txt` | Evaluation question set |

Dependencies are pinned: `fastembed==0.9.0`, `numpy==2.5.4`.

## Setup and run

Use an isolated environment:

```bash
python3 -m venv .venv
source .venv/bin/activate
python -m pip install --requirement ai_engine/requirements.txt
python ai_engine/test_embed.py
```

The first run downloads the embedding model from Hugging Face. Later runs reuse
the cache. No network access is needed for the retrieval logic itself.

## Generated files

`test_embed.py` writes the embedding cache and any generated index under the
repository. The following are intentionally ignored by Git:

- `models_cache/`
- `ai_engine/index/`
- `.venv/`
- Python caches (`__pycache__/`, `*.pyc`)

Do not commit downloaded model files or generated indexes; they are large and
reproducible from the pinned requirements.

## Relationship to the runtime

- `helpdesk_api/` is the production integration boundary.
- `ApiGateway` reaches it through `IChatModelClient`; robots never call it
  directly.
- Experimental answers must not be exposed to the robot or the operator UI.
- The current prompt and safety rules live in `Source/acu/Modelfile.txt`, not in
  this experiment.

## Evaluation material

`eval/questions.txt` is the question set used for offline review. The runnable
end-to-end evaluation scripts are in [`../eval/`](../eval/) and target a running
stand-in or ACU gateway. See [`../eval/README.md`](../eval/README.md).
