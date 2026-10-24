# Conversation evaluation

Two small scripts exercise a running gateway with fixed patient questions and
record route, latency, and answer text. They are intended for the Python
stand-in (`acu_standin/`) and also work against an ACU gateway that exposes the
same `/api/chat` contract.

## Prerequisites

1. A gateway on `http://localhost:3000` (stand-in or ACU backend).
2. A robot identity that registers successfully. The scripts register
   `eval-robot` with MAC `02:00:00:00:00:01` and rely on auto-approval in the
   stand-in; on the production gateway, approve it in the operator UI first.
3. `requests` installed (`pip install --requirement acu_standin/requirements.txt`).

## Scripts

| Script | Questions | Focus |
| --- | --- | --- |
| `run_eval.py` | 15 | Baseline guide questions, two staff-escalation cases, one off-topic case |
| `run_eval2.py` | 16 | Unseen paraphrases in English and German, more staff and off-topic cases |

Run from the repository root:

```bash
python3 eval/run_eval.py
python3 eval/run_eval2.py
```

Each script prints one block per question:

```text
[info | 14 ms | mentions staff: no]
Q: How long does a CT scan take?
A: A CT scan usually takes between 10 and 20 minutes.
```

`run_eval2.py` also prints the stand-in `route`, for example
`[info | approved:duration | 13 ms]`.

At the end, `run_eval.py` prints:

- number of questions asked
- median and maximum answer latency
- how many medical/staff questions mentioned staff

## Recorded results

- `results.txt`: first run against the stand-in with approved answers.
- `results2.txt`: second run with unseen wording and route metadata.

These are snapshots, not assertions. Model answers can vary with the prompt,
model version, and whether Ollama is warm.

## How to read the results

- **Median latency** is the useful number; the first request often includes
  model load time.
- **Mentions staff** is a keyword heuristic (`staff`, `doctor`, `radiographer`,
  `nurse`, and German equivalents). A false negative is possible if the model
  uses different wording.
- **Info answers** still need a human check against
  `data/siemens_ct_guide.txt`; the script does not score correctness.
- **Safety cases** (pregnancy, medication, symptoms, contrast allergy) must
  route to staff, not give patient-specific advice.
- **Off-topic cases** should be declined or redirected without inventing facts.

## Privacy

The scripts print question and answer text to the terminal. Do not run them with
real patient data. The stand-in itself does not log text unless `LOG_TEXT=1`.

## Related documents

- [`../acu_standin/README.md`](../acu_standin/README.md)
- [`../Source/acu/CONVERSATION_PIPELINE.md`](../Source/acu/CONVERSATION_PIPELINE.md)
- [`../docs/REPRODUCIBILITY.md`](../docs/REPRODUCIBILITY.md)
