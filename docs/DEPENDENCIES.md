# Dependency inventory

This file lists the libraries, runtimes, container images, and model assets
required to build and run the ACU project. The base revision audited is
`4e0bd64f522be1284e7c3edb8bba732d198aead7` (branch `main`, final demo
revision). The Python lockfiles and this inventory were added by the
2026-10-26 reproducibility audit.

Use this document as the readable inventory. The authoritative exact versions
for Node.js are in the two `package-lock.json` files; the authoritative exact
versions for Python are in the `*.lock` files listed below. NuGet and container
base images are pinned by version tag where possible, but are not fully locked;
see [Known pinning gaps](#known-pinning-gaps).

## Toolchain

| Tool | Version used | Where it is required |
| --- | --- | --- |
| Docker Engine / Docker Desktop | Compose v2 | Full ACU stack |
| .NET SDK | `10.0` (`mcr.microsoft.com/dotnet/sdk:10.0`) | Backend image and native backend development |
| .NET ASP.NET runtime | `10.0` (`mcr.microsoft.com/dotnet/aspnet:10.0`) | Backend image |
| .NET runtime | `10.0` (`mcr.microsoft.com/dotnet/runtime:10.0`) | mDNS image |
| Node.js | `22.22.3` verified; `22.20+` required | Frontend and robot app |
| npm | `10.9.8` verified | Both Node.js projects |
| Python (containers) | `3.12` | `helpdesk-api` (`python:3.12-slim`) and backend Ubuntu 24.04 `python3` for Piper |
| Python (host scripts) | `3.10.12` verified; `3.10+` supported | `acu_standin`, `eval`, `ai_engine` |
| Ollama | `ollama/ollama:0.40.8` | Local model runtime |
| JDK | `17` | Android APK build |
| Gradle | `8.14.3` (wrapper) | Android APK build |
| Android SDK / Build Tools | Managed by Expo 54 / React Native 0.81 | Android APK build |
| Android NDK | Managed by the Expo root project (`ndkVersion`) | Native Whisper/audio modules |

## Container images

| Service | Image | Pinning |
| --- | --- | --- |
| `backend` | built from `mcr.microsoft.com/dotnet/sdk:10.0` and `mcr.microsoft.com/dotnet/aspnet:10.0` | Major/minor tag; digest not pinned |
| `frontend` | `node:22-alpine` build stage, `nginx:alpine` runtime | Major tag; digest not pinned |
| `helpdesk-api` | built from `python:3.12-slim` | Minor tag; digest not pinned |
| `ollama` | `ollama/ollama:0.40.8` | Exact tag; digest not pinned |
| `ollama-model-init` | `ollama/ollama:0.40.8` | Exact tag; digest not pinned |
| `mdns` | built from `mcr.microsoft.com/dotnet/sdk:10.0` and `mcr.microsoft.com/dotnet/runtime:10.0` | Major/minor tag; digest not pinned |

The Compose file is `Source/acu/docker-compose.yml`. It sets `name: acu`, so
built images use the stable `acu-*` prefix and the one-shot
`piper-model-init` can reference `acu-backend` regardless of the checkout
directory. The files `Source/acu/ApiGateway/docker-compose.yml` and
`Source/acu/ACU.FE/docker-compose.yml` are legacy single-service helpers; the
root Compose file is authoritative.

When audited on 2026-10-26, the default
`mcr.microsoft.com/dotnet/aspnet:10.0` tag resolved to Ubuntu 24.04
(`org.opencontainers.image.version=24.04`, .NET `10.0.14`). Its `apt` `python3`
is Python 3.12, which matches
`Source/acu/ApiGateway/Tts/requirements-piper.lock`. The tag is mutable; re-check
this if the base image moves to a newer Ubuntu release with a different Python
version.

## .NET backend

### Direct NuGet packages

| Project | Package | Version | Purpose |
| --- | --- | --- | --- |
| `ApiGateway` | `Swashbuckle.AspNetCore` | `6.9.0` | Swagger/OpenAPI UI |
| `AcuStorage` | `Microsoft.Extensions.Configuration.Abstractions` | `10.0.0` | Configuration contracts |
| `AcuStorage` | `Microsoft.Extensions.Configuration.Binder` | `10.0.0` | Bind JSON settings |
| `MdnsAdvertiser` | `Makaretu.Dns.Multicast` | `0.27.0` | Managed mDNS/DNS-SD responder |

### Notable transitive NuGet packages

These are resolved by NuGet, not pinned in a repository lockfile:

| Package | Version | Pulled by |
| --- | --- | --- |
| `Swashbuckle.AspNetCore.Swagger` | `6.9.0` | `Swashbuckle.AspNetCore` |
| `Swashbuckle.AspNetCore.SwaggerGen` | `6.9.0` | `Swashbuckle.AspNetCore` |
| `Swashbuckle.AspNetCore.SwaggerUI` | `6.9.0` | `Swashbuckle.AspNetCore` |
| `Microsoft.Extensions.ApiDescription.Server` | `6.0.5` | `Swashbuckle.AspNetCore` |
| `Microsoft.OpenApi` | `1.6.14` | Swashbuckle |
| `Microsoft.Extensions.Configuration` | `10.0.0` | `AcuStorage` configuration |
| `Microsoft.Extensions.Primitives` | `10.0.0` | Configuration packages |
| `Common.Logging` | `3.4.1` | `Makaretu.Dns.Multicast` |
| `IPNetwork2` | `2.1.2` | `Makaretu.Dns.Multicast` |
| `Makaretu.Dns` | `2.0.1` | `Makaretu.Dns.Multicast` |
| `Tmds.LibC` | `0.2.0` | `Makaretu.Dns.Multicast` (.NET Standard 2.0) |

The ASP.NET Core shared framework (`Microsoft.AspNetCore.App` 10.0) and the .NET
runtime are supplied by the base images, not by NuGet.

## Python services

All Python services declare direct dependencies in `requirements.txt` and lock
the complete transitive set in a matching `*.lock` file. Install the lockfile,
not the direct file, when you need the verified environment.

### `helpdesk_api` — Python 3.12

Direct dependencies: `fastapi==0.159.1`, `uvicorn==0.53.0`, `requests==2.32.5`,
`pydantic==2.14.1`.

Full lockfile: [`helpdesk_api/requirements.lock`](../helpdesk_api/requirements.lock)
(18 packages).

| Package | Version | Role |
| --- | --- | --- |
| `fastapi` | `0.159.1` | HTTP API framework |
| `uvicorn` | `0.53.0` | ASGI server |
| `requests` | `2.32.5` | Ollama HTTP client |
| `pydantic` | `2.14.1` | Request/response validation |
| `pydantic-core` | `2.50.1` | Pydantic runtime |
| `starlette` | `1.10.0` | FastAPI ASGI toolkit |
| `anyio` | `4.15.1` | Async compatibility layer |
| `annotated-doc` | `0.0.5` | FastAPI dependency |
| `annotated-types` | `0.8.0` | Pydantic dependency |
| `certifi` | `2026.10.23` | CA bundle |
| `charset-normalizer` | `3.5.2` | Requests dependency |
| `click` | `8.5.0` | Uvicorn CLI |
| `h11` | `0.16.0` | HTTP/1.1 protocol |
| `idna` | `3.20` | Internationalized domains |
| `opentelemetry-api` | `1.45.1` | FastAPI instrumentation API |
| `typing-extensions` | `4.16.0` | Typing backports |
| `typing-inspection` | `0.4.4` | Pydantic typing support |
| `urllib3` | `2.8.0` | Requests HTTP transport |

### `acu_standin` — Python 3.10+

Direct dependencies: `fastapi==0.159.1`, `uvicorn==0.53.0`, `requests==2.32.5`,
`pydantic==2.14.1`.

Full lockfile: [`acu_standin/requirements.lock`](../acu_standin/requirements.lock)
(19 packages). It contains the same set as `helpdesk_api` plus
`exceptiongroup==1.3.1`, and resolves `starlette==1.7.0` because the lock was
generated for Python 3.10.

Optional TTS: `piper-tts==1.8.0` (see the Piper lockfile below) or the macOS
`say`/`afconvert` tools. Without a TTS backend, `/api/tts` returns `503`; chat
still works.

### `eval` — Python 3.10+

Direct dependency: `requests==2.32.5`. See
[`eval/requirements.txt`](../eval/requirements.txt). Installing the stand-in
lockfile also provides this package.

### `ai_engine` — Python 3.10+

Direct dependencies: `fastembed==0.9.0`, `numpy==2.2.6`.

Full lockfile: [`ai_engine/requirements.lock`](../ai_engine/requirements.lock)
(34 packages).

`numpy` is intentionally held at `2.2.6`: FastEmbed 0.9.0 requires
`numpy<2.3` on Python 3.10, while NumPy 2.5.x is only selected on Python 3.11+.
The experiment was verified on Python 3.10.12 with this lock.

Key transitive packages include `onnxruntime==1.23.2`, `tokenizers==0.23.3`,
`huggingface-hub==1.33.0`, `pillow==12.3.0`, `protobuf==7.36.2`,
`requests==2.34.2`, `sympy==1.14.0`, and `httpx==0.28.1`. The complete list is in
the lockfile.

The BAAI/bge-small-en-v1.5 embedding model is downloaded by FastEmbed on first
use and is not pinned by the repository. See
[`ai_engine/README.md`](../ai_engine/README.md).

### Piper TTS — Python 3.12

Direct dependency: `piper-tts==1.8.0`.

Full lockfile:
[`Source/acu/ApiGateway/Tts/requirements-piper.lock`](../Source/acu/ApiGateway/Tts/requirements-piper.lock)
(7 packages): `piper-tts 1.8.0`, `onnxruntime 1.31.1`, `numpy 2.5.4`,
`flatbuffers 25.12.19`, `packaging 26.3`, `pathvalidate 3.3.1`,
`protobuf 7.36.2`.

The backend image also installs Debian's `espeak-ng`, `python3`, and
`python3-pip`. eSpeak NG is only the explicit fallback
(`Tts__Provider=Espeak`).

### Python standard library

The services use only the standard library beyond the packages above:
`argparse`, `base64`, `hashlib`, `io`, `json`, `os`, `pathlib`, `re`,
`statistics`, `subprocess`, `sys`, `tempfile`, `threading`, `time`, `unittest`,
`urllib`, `uuid`, and `wave`.

## Frontend (`Source/acu/ACU.FE`)

Lockfile: `package-lock.json` v3 (165 package entries). Direct dependencies:
4 runtime + 11 development. The operator UI does not embed Swagger UI React; the
gateway serves Swagger at `/docs`.

### Runtime dependencies

| Package | Resolved version | Purpose |
| --- | --- | --- |
| `axios` | `1.20.0` | HTTP client |
| `react` | `18.3.1` | Operator UI |
| `react-dom` | `18.3.1` | DOM renderer |
| `react-icons` | `5.7.0` | Material Design icons |

### Development dependencies

| Package | Resolved version | Purpose |
| --- | --- | --- |
| `@playwright/test` | `1.63.0` | End-to-end tests |
| `@testing-library/jest-dom` | `6.9.1` | DOM assertions |
| `@testing-library/react` | `16.3.3` | Component tests |
| `@types/node` | `22.20.4` | Node types |
| `@types/react` | `18.3.31` | React types |
| `@types/react-dom` | `18.3.7` | React DOM types |
| `@vitejs/plugin-react` | `6.1.1` | Vite React plugin |
| `jsdom` | `25.0.1` | Browser environment for Vitest |
| `typescript` | `5.9.3` | Type checking |
| `vite` | `8.3.1` | Build tool |
| `vitest` | `5.0.2` | Unit test runner |

## Robot app (`Source/acu/Robot.Pwa.App`)

Lockfile: `package-lock.json` v3 (662 package entries). Direct dependencies:
19 runtime + 6 development.

### Runtime dependencies

| Package | Resolved version | Purpose |
| --- | --- | --- |
| `@expo-google-fonts/source-sans-3` | `0.4.2` | Bundled font |
| `@expo/metro-runtime` | `6.1.2` | Expo Metro runtime |
| `@fugood/react-native-audio-pcm-stream` | `1.1.4` | 16 kHz PCM microphone capture |
| `@react-native-async-storage/async-storage` | `2.1.2` | On-device configuration |
| `@react-native-community/slider` | `5.0.1` | Setup UI slider |
| `ajv` | `8.20.0` | JSON schema validation |
| `crypto-js` | `4.2.0` | Hashing utilities |
| `expo` | `54.0.37` | Expo SDK |
| `expo-asset` | `12.0.14` | Bundled asset loading |
| `expo-audio` | `1.1.1` | Audio playback |
| `expo-file-system` | `19.0.24` | Temporary WAV files |
| `expo-font` | `14.0.12` | Font loading |
| `expo-linear-gradient` | `15.0.8` | Patient screen styling |
| `expo-video` | `3.0.16` | Video/visual assets |
| `react` | `19.1.0` | React Native runtime |
| `react-dom` | `19.1.0` | Web preview |
| `react-native` | `0.81.4` | Android runtime |
| `react-native-web` | `0.21.3` | Web preview |
| `whisper.rn` | `0.7.4` | On-device whisper.cpp bindings |

### Development dependencies

| Package | Resolved version | Purpose |
| --- | --- | --- |
| `@babel/core` | `7.29.7` | Transpilation |
| `@playwright/test` | `1.63.0` | Web preview tests |
| `@types/crypto-js` | `4.2.2` | CryptoJS types |
| `@types/react` | `19.1.17` | React types |
| `babel-preset-expo` | `54.0.12` | Expo Babel preset |
| `typescript` | `5.9.3` | Type checking |

### Native build dependencies

The Android project is committed under `android/` and uses:

- Gradle wrapper `8.14.3`
- Android Gradle Plugin and Kotlin plugin from the Expo 54 / React Native 0.81
  BOM (resolved from Google Maven and Maven Central)
- `com.facebook.react:react-android`, `com.facebook.react:hermes-android`
- Android SDK platforms/build tools selected by Expo 54
- JDK 17
- The checked-in debug keystore (`android/app/debug.keystore`), which must not be
  used for production signing

## On-device and runtime model assets

| Asset | Size | Integrity | Location |
| --- | --- | --- | --- |
| Whisper `ggml-base.bin` | 147,951,465 bytes | SHA-256 `60ed5bc3dd14eea856493d334349b405782ddcaf0028d4b5df4088345fba2efe` | Android assets, downloaded by `npm run models:prepare` |
| Silero VAD `ggml-silero-v6.2.0.bin` | 885,098 bytes | SHA-256 `2aa269b785eeb53a82983a20501ddf7c1d9c48e33ab63a41391ac6c9f7fb6987` | Android assets, downloaded by `npm run models:prepare` |
| Piper `en_US-lessac-medium` | 63,201,294 bytes (`.onnx`) | MD5 `2fc642b535197b6305c7c8f92dc8b24f` | `piper-models` volume |
| Piper `de_DE-thorsten-medium` | 63,201,294 bytes (`.onnx`) | MD5 `a129b00fb3078df43c96bab6c94535c0` | `piper-models` volume |
| Piper `zh_CN-huayan-medium` | 63,201,294 bytes (`.onnx`) | MD5 `40cdb7930ff91b81574d5f0489e076ea` | `piper-models` volume |
| Qwen base model | about 1 GB | Ollama registry digest (tag `qwen2.5:1.5b`) | `ollama-data` volume |
| `ct-robot` model | derived from Qwen | Created from `Source/acu/Modelfile.txt` | `ollama-data` volume |
| FastEmbed model `BAAI/bge-small-en-v1.5` | downloaded on first use | Hugging Face revision not pinned | `ai_engine/models_cache` (ignored) |

The Piper `.onnx.json` files are also verified by MD5 in
`Source/acu/ApiGateway/Tts/prepare_piper_voices.py`.

## Totals

| Area | Direct | Full resolved set |
| --- | --- | --- |
| .NET NuGet | 4 packages | Resolved by NuGet at restore time (not locked) |
| Python `helpdesk_api` | 4 | 18 |
| Python `acu_standin` | 4 | 19 |
| Python `ai_engine` | 2 | 34 |
| Python Piper TTS | 1 | 7 |
| Frontend npm | 15 (4 runtime + 11 dev) | 165 lockfile entries |
| Robot npm | 25 (19 runtime + 6 dev) | 662 lockfile entries |
| Container images | 6 distinct images/services | Base image digests not pinned |

## Update procedure

Update direct versions first, then regenerate the locks:

```bash
# Frontend and robot
cd Source/acu/ACU.FE && npm install && npm audit
cd ../Robot.Pwa.App && npm install && npm audit

# Python (run from the repository root; uv 0.11+)
uv pip compile helpdesk_api/requirements.txt --python-version 3.12 \
  --output-file helpdesk_api/requirements.lock
uv pip compile acu_standin/requirements.txt --python-version 3.10 \
  --output-file acu_standin/requirements.lock
uv pip compile ai_engine/requirements.txt --python-version 3.10 \
  --output-file ai_engine/requirements.lock
uv pip compile Source/acu/ApiGateway/Tts/requirements-piper.txt --python-version 3.12 \
  --output-file Source/acu/ApiGateway/Tts/requirements-piper.lock
```

For .NET, update the `PackageReference` versions in the `.csproj` files and
rebuild the backend image. To inspect the current transitive NuGet graph on a
machine with the .NET 10 SDK:

```bash
dotnet list Source/acu/ApiGateway/ApiGateway.csproj package --include-transitive
dotnet list Source/acu/BE/MdnsAdvertiser/MdnsAdvertiser.csproj package --include-transitive
```

## Known pinning gaps

These are the reasons a fresh clone is functionally reproducible but not
bit-for-bit reproducible:

- Container base images are tagged by version, not digest (`dotnet:10.0`,
  `node:22-alpine`, `nginx:alpine`, `python:3.12-slim`).
- NuGet has no committed `packages.lock.json`; transitive packages resolve at
  restore time.
- Android Gradle/Maven dependencies are resolved by Gradle from Google Maven and
  Maven Central; the Gradle wrapper version is pinned, but the Android Gradle
  Plugin/Kotlin/BOM versions come from the Expo 54 / React Native 0.81 project
  configuration.
- Ollama models use mutable registry tags (`ollama/ollama:0.40.8`,
  `qwen2.5:1.5b`); the created `ct-robot` model is deterministic only for a
  fixed base-model digest and Modelfile.
- FastEmbed downloads `BAAI/bge-small-en-v1.5` without a pinned Hugging Face
  revision.
- Debian/Ubuntu packages installed in images (`espeak-ng`, `python3`, `pip`)
  are not version-pinned.

For a stricter build, pin image digests, add NuGet lockfiles
(`RestorePackagesWithLockFile`), pin the Ollama base-model digest, and record
the Hugging Face revision used by FastEmbed.
