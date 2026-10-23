# Speech model assets

The model binaries are intentionally not committed to Git. From `Robot.Pwa.App`, download the pinned versions and verify both file size and SHA-256 with:

~~~text
npm run models:prepare
npm run models:check
~~~

The expected paths are:

~~~text
android/app/src/main/assets/models/ggml-base.bin
android/app/src/main/assets/models/ggml-silero-v6.2.0.bin
~~~

Do not replace `ggml-base.bin` with `ggml-base.en.bin`; the robot needs multilingual English, German, and Chinese recognition.

Silero performs local voice activity detection. About 700 ms of silence ends an utterance, then Whisper transcribes it locally. Only the resulting text is sent to ACU.
