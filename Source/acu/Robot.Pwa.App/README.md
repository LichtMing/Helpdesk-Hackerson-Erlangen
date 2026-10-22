# Robot PWA App

Robot PWA is the robot-facing Android companion app for Alfred Control Unit (ACU). The current implementation is a focused speech-to-text and text-transport verification client.

## Current STT integration

The `feat/robot-stt-to-acu` branch contains a focused Android verification flow:

1. After the one-time Android microphone permission, the app starts listening automatically.
2. Local Silero VAD detects speech and ends an utterance after about 700 ms of silence.
3. `whisper.rn` runs the multilingual whisper.cpp `base` model locally on the robot.
4. The recognized text is posted automatically to `POST /api/bot/transcripts/{deviceId}`.
5. ACU validates the registered/approved robot and echoes the exact text plus `requestId`; the client rejects a mismatched echo and then resumes listening.

This endpoint is only a transport boundary. It does not store the patient's text and does not call Qwen yet.

### Prepare the model

The model binaries are intentionally excluded from Git. Before building, download the official multilingual Whisper model and Silero VAD model to these exact paths:

```powershell
$ModelDirectory = ".\android\app\src\main\assets\models"
New-Item -ItemType Directory -Force $ModelDirectory
Invoke-WebRequest `
  "https://huggingface.co/ggerganov/whisper.cpp/resolve/main/ggml-base.bin" `
  -OutFile "$ModelDirectory\ggml-base.bin"
Invoke-WebRequest `
  "https://huggingface.co/ggml-org/whisper-vad/resolve/main/ggml-silero-v6.2.0.bin" `
  -OutFile "$ModelDirectory\ggml-silero-v6.2.0.bin"
```

Do not use `ggml-base.en.bin`; that variant is English-only. Both `.bin` files are ignored by Git, while the deployment instructions remain tracked.

### Run the focused checks

```powershell
npm ci
npm run typecheck
npm run test:transcript
npm run android
```

The Android app defaults to `http://10.0.2.2:3000`, which reaches the host machine from the standard Android emulator. On a physical robot, replace it with the ACU's LAN address. The entered device ID and MAC must already be registered and approved in ACU.

> Despite its historical name, this is an Expo/React Native Android app. Local speech recognition uses native modules, so it will not run inside Expo Go; use an Android development build or APK.

## Implemented structure

```text
src/App.tsx
  ├── hands-free conversation status and last transcript
  ├── ACU URL, device ID, MAC, and language inputs
  └── send button and exact-text receipt status

src/lib/speechToText.android.ts
  ├── Android microphone permission
  ├── 16 kHz, mono, 16-bit PCM capture
  ├── Silero VAD automatic speech boundaries
  └── local whisper.cpp inference through whisper.rn

src/lib/transcriptApi.ts
  └── POST /api/bot/transcripts/{deviceId} with timeout and receipt validation
```

`speechToText.ts` is a non-Android stub so the UI can still be bundled for the web, but recording and Whisper inference are Android-only.

## Requirements

- Node.js 22.20 or newer and npm.
- Android Studio with a JDK and Android SDK/platform tools.
- An Android emulator or connected robot with microphone access.
- A running ACU ApiGateway reachable over the network.
- A robot record already registered and approved in ACU; the test endpoint uses the existing device ID and MAC validation.

## Install and run

From the repository root in PowerShell:

```powershell
Set-Location .\Source\acu\Robot.Pwa.App
npm ci
# Download the model as described above.
npm run typecheck
npm run test:transcript
npm run android
```

The checked-in Android project contains native-module autolinking and microphone permission. Do not run `npm run prebuild` casually: Expo regenerates `android/`, so review and restore project-specific manifest or Gradle settings afterward.

On the app screen:

1. Enter the reachable ACU URL plus an approved device ID and matching MAC.
2. Select `auto`, `en`, `de`, or `zh`.
3. Speak normally; no recording button is required.
4. A short silence ends the sentence, triggers local transcription, and sends the text automatically.
5. After ACU returns the same `requestId` and exact text, the robot listens for the next sentence.

## Checks

- `npm run typecheck` performs strict TypeScript checking.
- `npm run test:transcript` starts a temporary HTTP server and verifies the JSON route, Unicode text, exact echo, and rejected-device error path.
- `npm run web` previews the screen layout only; browser recording is intentionally unsupported.

For Android diagnostics, use `adb logcat`. The release build currently uses the debug keystore and must be given a production signing configuration before distribution.
