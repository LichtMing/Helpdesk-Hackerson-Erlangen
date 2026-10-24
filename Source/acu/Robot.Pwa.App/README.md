# Robot PWA App

Robot PWA is the Android robot client for Alfred Control Unit (ACU). It listens without a record button, transcribes speech locally, sends only text to ACU, plays the returned speech, and resumes listening.

Despite the historical name, this is an Expo/React Native Android application. Its native microphone and Whisper modules do not run in Expo Go.

## Runtime flow

1. On first launch, enter the ACU URL and robot identity.
2. The app checks ACU health, registers the robot, and polls until an ACU operator approves it.
3. The validated configuration is stored on the device. Later launches recheck ACU availability, approval, and the matching MAC.
4. After Android microphone permission is granted, 16 kHz mono PCM capture starts automatically.
5. Local Silero VAD detects speech and ends the utterance after about 700 ms of silence.
6. The multilingual whisper.cpp base model transcribes the utterance locally through `whisper.rn`.
7. The app sends the text to `POST /api/chat`. Raw microphone audio never goes to ACU.
8. The app requests `POST /api/tts`, pauses listening, plays the returned WAV, deletes the temporary audio, and resumes listening.
9. A bundled ambient loop plays quietly while the robot is listening, ducks while it speaks, and fades out while paused. It is optional: playback failure never blocks the conversation.
10. Moving the app to the background pauses the microphone. Returning to the foreground resumes it.
11. Leaving the conversation releases native resources and requests `POST /api/reset`.

Development mode can return an explicitly marked `isMock: true` response until the Ollama adapter is connected. It must not be treated as a patient answer.

## Prepare the project

Requirements:

- Node.js 22.20 or newer and npm (verified with Node 22.22.3 / npm 10.9.8)
- Android Studio, JDK 17, Android SDK, and platform tools
- An Android emulator or target robot with a microphone
- A reachable ACU ApiGateway

From this directory:

~~~text
npm ci
npm run models:prepare
npm run models:check
npm run typecheck
npm run test:config
npm run test:device
npm run test:transcript
npm run test:conversation
~~~

`models:prepare` downloads pinned Whisper and Silero VAD assets and verifies their sizes and SHA-256 hashes:

| Asset | Size (bytes) | SHA-256 |
| --- | --- | --- |
| `ggml-base.bin` | 147,951,465 | `60ed5bc3dd14eea856493d334349b405782ddcaf0028d4b5df4088345fba2efe` |
| `ggml-silero-v5.1.2.bin` | 885,098 | `2aa269b785eeb53a82983a20501ddf7c1d9c48e33ab63a41391ac6c9f7fb6987` |

The binaries live in `android/app/src/main/assets/models/` and are intentionally ignored by Git.

The Android emulator reaches the host ACU through `http://10.0.2.2:3000`. A physical robot must use the ACU computer's reachable LAN address, for example `http://192.168.1.100:3000`.

Do not run `npm run prebuild` casually. Expo regenerates `android/`, so project-specific native changes must be reviewed afterward.

## Implemented modules

~~~text
src/App.tsx
  first-run setup, registration/approval, app lifecycle,
  hands-free status, transcript, answer, and session reset

src/lib/configStorage.ts
  validated on-device robot configuration

src/lib/deviceApi.ts
  ACU health, registration, approval polling, and MAC verification

src/lib/speechToText.android.ts
  microphone permission, PCM capture, Silero VAD, and local Whisper

src/lib/conversationApi.ts
  POST /api/chat, POST /api/tts, and POST /api/reset

src/lib/responsePlayer.android.ts
  temporary WAV playback and immediate cache deletion

src/lib/ambientSound.android.ts
  low-volume looping ambience with level changes and fades

src/lib/ambientSound.ts
  silent web/iOS stub for the same interface

src/lib/transcriptApi.ts
  retained UTF-8 transport test for the older transcript endpoint

assets/audio/ambience-loop.wav
  bundled room-tone loop (about 1.1 MB)
~~~

`speechToText.ts`, `responsePlayer.ts`, and `ambientSound.ts` are non-Android
stubs. The web command previews layout only; it does not test native recording,
inference, or ambience playback.

## Later development APK build

The project is prepared for, but this work does not run, the APK build:

~~~text
npm run build:apk
~~~

That command first verifies both model assets, runs Gradle `assembleDebug`, and copies the result to `dist/acu-robot-development.apk`. The APK is debug-signed for development only. Production distribution requires an organization-controlled signing key and release configuration.

## Testing and diagnostics

- `npm run typecheck`: strict TypeScript validation.
- `npm run test:config`: robot configuration normalization and corrupted-data handling (3 tests).
- `npm run test:device`: ACU health, registration, approval, MAC verification, and error propagation (2 tests).
- `npm run test:transcript`: Unicode transcript transport and rejected-device handling (2 tests).
- `npm run test:conversation`: chat correlation, WAV validation, reset, and unavailable-model errors (4 tests).
- `npm run models:check`: missing/corrupted embedded model detection.
- `npm run test:web`: Playwright layout checks for the web preview.
- `adb logcat`: native Android, microphone, Whisper, playback, and ambience diagnostics.

The four node test commands total **11 passing tests** in the final revision.

On a real device, verify microphone permission, supported CPU ABI, available RAM/storage, LAN access to ACU, and sustained inference temperature before treating the APK as robot-compatible. Review the ambience asset's licence before distributing a product image.
