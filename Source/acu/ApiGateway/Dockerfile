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

# Offline prototype TTS. The gateway reads WAV bytes from stdout and never
# writes patient text or generated audio to the container filesystem.
RUN apt-get update \
    && apt-get install -y --no-install-recommends espeak-ng \
    && rm -rf /var/lib/apt/lists/*

COPY --from=build /app/publish .

VOLUME ["/data"]
EXPOSE 3000
ENV ASPNETCORE_URLS=http://+:3000

ENTRYPOINT ["dotnet", "Acu.ApiGateway.dll"]
