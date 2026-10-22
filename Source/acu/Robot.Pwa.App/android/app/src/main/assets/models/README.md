# Whisper model deployment

The model binaries are intentionally not committed to Git. Before building the Android app, put both models at:

```text
android/app/src/main/assets/models/ggml-base.bin
android/app/src/main/assets/models/ggml-silero-v6.2.0.bin
```

Download `ggml-base.bin` from the official whisper.cpp model repository. Do not use `base.en`: the robot needs multilingual English, German, and Chinese recognition.

The Silero model performs local voice activity detection: speech starts capture automatically and 700 ms of silence ends the utterance. The base model then transcribes it locally. Only the resulting text is sent to ACU.
