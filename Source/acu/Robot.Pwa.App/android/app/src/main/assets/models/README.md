# Whisper model deployment

The model binary is intentionally not committed to Git. Before building the Android app, put the multilingual whisper.cpp base model at:

```text
android/app/src/main/assets/models/ggml-base.bin
```

Download `ggml-base.bin` from the official whisper.cpp model repository. Do not use `base.en`: the robot needs multilingual English, German, and Chinese recognition.

The app loads this exact Android asset path through `whisper.rn`. With the model present, transcription stays on the robot and only the resulting text is sent to ACU.
