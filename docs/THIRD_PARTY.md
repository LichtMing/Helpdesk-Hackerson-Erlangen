# Third-party components and licences

This is a review checklist, not legal advice. Before distributing a product
image, confirm the exact licence text and attribution requirements for every
component and model asset in the shipped artifact.

The project itself does not include a root `LICENSE` file. Add the
organization-approved licence before publishing a product distribution.

## Runtime and build components

| Component | Upstream licence (verify) | Notes |
| --- | --- | --- |
| .NET / ASP.NET Core | MIT | Base runtime images |
| Swashbuckle.AspNetCore | MIT | Swagger generation and UI |
| Makaretu.Dns.Multicast | MIT | mDNS advertiser |
| FastAPI | MIT | Internal model adapter |
| Uvicorn | BSD-3-Clause | ASGI server |
| Pydantic | MIT | Request validation |
| Requests | Apache-2.0 | Ollama HTTP client |
| Starlette | BSD-3-Clause | FastAPI dependency |
| FastEmbed | Apache-2.0 | Retrieval experiment only |
| NumPy | BSD-3-Clause | Retrieval experiment and ONNX runtime |
| ONNX Runtime | MIT | Piper and FastEmbed |
| React / React DOM | MIT | Operator UI and robot app |
| Vite / Vitest | MIT | Frontend build and tests |
| axios | MIT | Frontend HTTP client |
| Swagger UI React | Apache-2.0 | Embedded API explorer |
| react-icons | MIT | Icon set |
| Expo | MIT | Android robot app |
| React Native | MIT | Android robot app |
| whisper.rn | MIT | Whisper bindings |
| whisper.cpp | MIT | On-device speech recognition |
| Silero VAD | MIT | On-device voice activity detection |
| Piper | MIT | Offline neural TTS engine |
| eSpeak NG | GPL-3.0-or-later | Fallback TTS; copyleft obligations may apply |
| Ollama | MIT | Local model runtime |
| Qwen2.5 1.5B | Apache-2.0 | Base model for `ct-robot` |
| nginx | BSD-2-Clause | Frontend runtime image |
| Node.js | MIT | Build and runtime image |
| Python | PSF-2.0 | Backend and adapter images |

## Model and voice assets

Model weights and voice datasets have their own terms and may require
attribution or restrict commercial use. Check the source card and licence file
before shipping:

| Asset | Source | Action |
| --- | --- | --- |
| `ggml-base.bin` (Whisper base) | `ggerganov/whisper.cpp` on Hugging Face | Confirm the whisper.cpp model licence and attribution |
| `ggml-silero-v6.2.0.bin` (Silero VAD) | `ggml-org/whisper-vad` on Hugging Face | Confirm the Silero VAD licence |
| `en_US-lessac-medium` | Piper voice repository | Check the voice card/licence before distribution |
| `de_DE-thorsten-medium` | Piper voice repository | Check the voice card/licence before distribution |
| `zh_CN-huayan-medium` | Piper voice repository | Check the voice card/licence before distribution |
| `BAAI/bge-small-en-v1.5` | Hugging Face (FastEmbed) | Experiment only; not part of the runtime stack |
| Qwen2.5 1.5B / `ct-robot` | Ollama registry / local Modelfile | Include the upstream model licence and attribution |

## Application and challenge material

| Item | Notes |
| --- | --- |
| `Doc/2026 10 22 C1_Smart Patient Robotic Companion_Problem statments.pdf` | Organizer-provided challenge statement; check organizer terms before redistribution |
| `Doc/KettyBot Pro Brochure.pdf` | Vendor brochure; check vendor terms |
| `Doc/PUDU KettyBot Pro configuration .jpg` | Vendor material; check vendor terms |
| `Doc/api-guide.pdf` | Organizer-provided API guide; check organizer terms |
| `Source/acu/Robot.Pwa.App/assets/audio/ambience-loop.wav` | Bundled audio; confirm the source and licence before product distribution |
| `Source/acu/Robot.Pwa.App/android/app/debug.keystore` | Debug signing key only; never use for production |

## Review checklist

- [ ] Add an organization-approved root `LICENSE`.
- [ ] Collect the upstream licence text for every component in the shipped
      image and APK.
- [ ] Confirm whether eSpeak NG's GPL-3.0-or-later obligations are acceptable
      for the product distribution; if not, ship only the Piper path.
- [ ] Confirm the licences and attribution requirements for all Whisper, Silero,
      Piper voice, Qwen, and ambience assets.
- [ ] Confirm that the organizer-provided PDFs and vendor images may be
      redistributed with the repository.
- [ ] Replace the debug keystore with an organization-controlled release key
      before publishing an APK.
