# Speech model assets

The model binaries are intentionally not committed to Git. From `Robot.Pwa.App`, download the pinned versions and verify both file size and SHA-256 with:

~~~text
npm run models:prepare
npm run models:check
~~~

The expected paths are:

~~~text
android/app/src/main/assets/models/ggml-tiny.bin
android/app/src/main/assets/models/ggml-silero-v6.2.0.bin
~~~

`ggml-tiny.bin` is the selected multilingual model for the 4 GB robot target. It reduces APK size and on-device latency compared with Base while retaining English, German, and Chinese recognition. Do not replace it with `ggml-tiny.en.bin`, which is English-only.

To switch back to Base for an accuracy comparison, update both `WHISPER_MODEL_ASSET` in `src/lib/speechTypes.ts` and the pinned model entry in `scripts/prepare-speech-models.mjs`; these values must always refer to the same file.

Silero performs local voice activity detection. About 700 ms of silence ends an utterance, then Whisper transcribes it locally. Only the resulting text is sent to ACU.
