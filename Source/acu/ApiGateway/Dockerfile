# ── Stage 1: build ────────────────────────────────────────────────────────────
FROM mcr.microsoft.com/dotnet/sdk:10.0 AS build
WORKDIR /src

# Shared MSBuild property sheet imported by ApiGateway.csproj
COPY _Globals/PropertySheets/ _Globals/PropertySheets/

# Copy nuget.config first so restore uses the right package sources
COPY ApiGateway/nuget.config ApiGateway/

# Copy project files and restore (fresh restore inside Linux container)
COPY ApiGateway/ApiGateway.csproj ApiGateway/
COPY BE/AcuStorage/AcuStorage.csproj BE/AcuStorage/
RUN dotnet restore ApiGateway/ApiGateway.csproj --configfile ApiGateway/nuget.config

# Copy source and publish
COPY ApiGateway/ ApiGateway/
COPY BE/AcuStorage/ BE/AcuStorage/

RUN dotnet publish ApiGateway/ApiGateway.csproj \
        -c Release \
        -o /app/publish

# ── Stage 2: runtime ──────────────────────────────────────────────────────────
FROM mcr.microsoft.com/dotnet/aspnet:10.0 AS runtime
WORKDIR /app

# Piper is the default offline neural TTS. eSpeak NG remains an explicit
# low-resource fallback. Both return WAV through stdout without persisting text.
# The lockfile pins Piper and its ONNX Runtime transitives for Python 3.12.
COPY ApiGateway/Tts/requirements-piper.lock /tmp/piper-requirements.lock

RUN apt-get update \
    && apt-get install -y --no-install-recommends espeak-ng python3 python3-pip \
    && python3 -m pip install --break-system-packages --no-cache-dir \
        --requirement /tmp/piper-requirements.lock \
    && rm -rf /var/lib/apt/lists/* /tmp/piper-requirements.lock

COPY --from=build /app/publish .
COPY ApiGateway/Tts/piper_synthesize.py /app/piper_synthesize.py
COPY ApiGateway/Tts/prepare_piper_voices.py /app/prepare_piper_voices.py

VOLUME ["/data"]
EXPOSE 3000
ENV ASPNETCORE_URLS=http://+:3000

ENTRYPOINT ["dotnet", "Acu.ApiGateway.dll"]
