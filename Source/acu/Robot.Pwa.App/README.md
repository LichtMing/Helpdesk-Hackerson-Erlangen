# Robot PWA App

Robot PWA is the robot-facing companion app for Alfred Control Unit (ACU). It provides a setup and registration flow, shows Pudu Cloud destinations, and lets an Android robot launch navigation through the Pudu vendor app.

## Current STT integration

The `feat/robot-stt-to-acu` branch contains a focused Android verification flow:

1. The robot records 16 kHz mono PCM audio after the user grants microphone permission.
2. `whisper.rn` runs the multilingual whisper.cpp `base` model locally on the robot.
3. The recognized text remains editable, then is posted to `POST /api/bot/transcripts/{deviceId}`.
4. ACU validates the registered/approved robot and echoes the exact text plus `requestId`; the client rejects a mismatched echo.

This endpoint is only a transport boundary. It does not store the patient's text and does not call Qwen yet.

### Prepare the model

The model is about 142 MB and is intentionally excluded from Git. Before building, download the official multilingual model to this exact path:

```powershell
$ModelDirectory = ".\android\app\src\main\assets\models"
New-Item -ItemType Directory -Force $ModelDirectory
Invoke-WebRequest `
  "https://huggingface.co/ggerganov/whisper.cpp/resolve/main/ggml-base.bin" `
  -OutFile "$ModelDirectory\ggml-base.bin"
```

Do not use `ggml-base.en.bin`; that variant is English-only. The `.bin` model is ignored by Git, while the deployment instructions remain tracked.

### Run the focused checks

```powershell
npm ci
npm run typecheck
npm run test:transcript
npm run android
```

The Android app defaults to `http://10.0.2.2:3000`, which reaches the host machine from the standard Android emulator. On a physical robot, replace it with the ACU's LAN address. The entered device ID and MAC must already be registered and approved in ACU.

> **Implementation note:** Despite the project name, the current app is built with Expo and React Native, not the former Vite/Capacitor stack. The same React Native UI can run in a browser through React Native Web, but robot control, device information, and mDNS discovery require the Android app.

## Architecture

```text
React Native UI (Expo)
  App.tsx
    ├── ConfigPage ── AsyncStorage: ACU URL + Pudu configuration
    ├── RegisterPage ── POST device details to ACU
    └── DestinationsPage
          ├── GET destination points from Pudu Cloud
          ├── POST heartbeat / navigation events to ACU
          └── Android RobotArrival bridge ── robot:// Intent ──► Pudu vendor app

Android native modules
  ├── AcuDeviceInfo     Reads device IP, MAC, and firmware
  ├── AcuDiscovery      Finds ACU on the LAN using Android NSD/mDNS
  └── RobotArrival      Starts navigation and forwards arrival callbacks to JavaScript
```

### Application layers

- **UI and flow:** `src/App.tsx` selects the configuration, registration, or destination screen according to saved setup state. Shared styling and light/dark palettes live in `src/theme.tsx`.
- **Persistence:** `src/lib/storage.ts` stores configuration and registered device details in React Native AsyncStorage. Reads and writes are asynchronous.
- **ACU API:** `src/lib/acu.ts` registers a device at `POST /api/bot/register` and sends status/heartbeat requests to `POST /api/bot/device-status/{deviceId}`. The destination screen sends heartbeats every five seconds and reports navigation and arrival events.
- **Pudu Cloud:** `src/lib/puduRequest.ts` builds the signed destination request; `src/lib/puduCloud.ts` fetches and maps destination points. In Expo development mode, it returns sample destinations so UI development does not require a live robot or Pudu Cloud connection.
- **HTTP:** `src/lib/acuHttp.ts` is the shared JSON request helper. React Native uses its native networking stack; browser preview requests are subject to browser networking and CORS rules.
- **Android bridge:** Native modules are registered in `android/app/src/main/java/com/acu/robotpwa/RobotPwaPackage.java`. `MainActivity.java` forwards robot arrival Intents to the `RobotArrival` module, which emits events to JavaScript.
- **Browser preview:** Expo serves the React Native UI through React Native Web. Selecting a destination in the browser simulates the navigation screen; it does not move a robot.

### Setup and runtime flow

1. **Configure:** Enter Pudu API settings and the ACU URL. On Android, the app can discover ACU on the local network; in a browser, enter the URL manually.
2. **Register:** Enter or confirm the device details and register the robot with ACU. ACU may require an operator to approve the device.
3. **Operate:** The app loads destination points, checks ACU connectivity, and offers destinations. Android launches the Pudu vendor app through a `robot://` Intent and receives the arrival callback.

## Requirements

- Node.js (22 LTS or newer) and npm.
- For Android: Android Studio, Android SDK/platform tools, a configured JDK, and an Android emulator or connected robot.
- For browser tests: the Playwright Chromium browser (installation command below).

The development browser preview does not require an Android device. Native discovery and hardware metadata are unavailable there.

## Install and run

Run these commands in PowerShell from the repository root:

```powershell
Set-Location .\Robot.Pwa.App
npm ci
npm run typecheck
```

Start the Expo development server and choose a target from its terminal menu:

```powershell
npm start
```

If startup fails with `TypeError: fetch failed` in a restricted or unavailable network, run Expo in offline mode:

```powershell
npm start -- --offline
```

Offline mode skips Expo's network-dependent checks and can serve the local app, but does not make ACU or Pudu Cloud services available; the Android device/browser still needs network access to those services when used.

Or start a specific target:

```powershell
npm run web       # Browser preview
npm run android   # Build/install and launch on an Android emulator or device
```

For Android, start an emulator or connect the robot with USB debugging enabled before running `npm run android`. The Android device and ACU must be able to reach each other over the network. Use the app’s Settings screen to clear saved configuration and registration and return to the initial setup screen.

## Build the Android APK

From `Robot.Pwa.App`:

```powershell
npm run build:apk
```

This builds a standalone release APK (Siemens petrol theme) at:

```text
android/app/build/outputs/apk/ACU-Robot-Siemens-Petrol.apk
```

Install it on a connected device:

```powershell
adb devices
adb install -r .\android\app\build\outputs\apk\ACU-Robot-Siemens-Petrol.apk
adb shell am start -n com.acu.robotpwa/.MainActivity
```

The release variant currently uses the debug keystore; configure a production keystore before public distribution.

The build script uses the existing Android project and does not run `expo prebuild`, which would regenerate native files and remove custom manifest changes (such as cleartext traffic). Review generated changes before building after any intentional prebuild.

## Tests and checks

Run from `Robot.Pwa.App`:

```powershell
npm run typecheck
npm run test:pudu
npx playwright install chromium   # One-time browser setup for Playwright
npm run test:web
```

The browser test command starts the web app on port `8082` and runs the Playwright desktop and phone projects. To run a subset of tests, pass Playwright options, for example:

```powershell
npm run test:web -- --grep "registration"
```

## Available npm scripts

| Command | Purpose |
| --- | --- |
| `npm start` / `npm run start` | Start the Expo development server. |
| `npm run web` | Start the browser preview. |
| `npm run android` | Run the app on Android. |
| `npm run prebuild` | Generate the Android native project with Expo. |
| `npm run build:apk` | Build the standalone Siemens petrol release APK. |
| `npm run typecheck` | Run TypeScript without emitting files. |
| `npm run test:web` | Run Playwright browser tests. |
| `npm run test:pudu` | Run Pudu request unit tests with Node’s test runner. |
| `npm run ios` | Run on iOS; requires macOS and Xcode. |

## Useful Android troubleshooting commands

```powershell
adb logcat
adb shell pm clear com.acu.robotpwa
adb shell am start -n com.acu.robotpwa/.MainActivity --es tableNum T-101
```

`pm clear` removes the app’s saved setup and registered-device data. The final command sends a sample arrival Intent to the app for testing the Android arrival callback; it does not simulate physical robot movement.
