"""Download and verify the Piper voices used by the ACU gateway.

Piper's downloader only checks whether a file is non-empty. A download that is
interrupted can therefore leave a truncated ONNX file that can appear installed
on later starts. This one-shot container entry point verifies the official
file sizes and MD5 integrity values before allowing ApiGateway to start.
"""

import argparse
import hashlib
from pathlib import Path

from piper.download_voices import download_voice


VOICE_FILES = {
    "en_US-lessac-medium": {
        ".onnx": (63_201_294, "2fc642b535197b6305c7c8f92dc8b24f"),
        ".onnx.json": (4_885, "c1f2b7bddefe113f3255ff9ef234cfd3"),
    },
    "de_DE-thorsten-medium": {
        ".onnx": (63_201_294, "a129b00fb3078df43c96bab6c94535c0"),
        ".onnx.json": (4_819, "843a7bd7272724f750534dd5a26d1aad"),
    },
    "zh_CN-huayan-medium": {
        ".onnx": (63_201_294, "40cdb7930ff91b81574d5f0489e076ea"),
        ".onnx.json": (4_822, "1fda3ec1d0d3a5a74064397ea8fe0af0"),
    },
}


def digest(path: Path) -> str:
    checksum = hashlib.md5(usedforsecurity=False)
    with path.open("rb") as stream:
        for chunk in iter(lambda: stream.read(1024 * 1024), b""):
            checksum.update(chunk)
    return checksum.hexdigest()


def voice_is_valid(data_dir: Path, voice: str) -> bool:
    for suffix, (expected_size, expected_digest) in VOICE_FILES[voice].items():
        path = data_dir / f"{voice}{suffix}"
        if not path.is_file() or path.stat().st_size != expected_size:
            return False
        if digest(path) != expected_digest:
            return False
    return True


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--data-dir", type=Path, default=Path("/models"))
    parser.add_argument("voices", nargs="*", choices=VOICE_FILES)
    args = parser.parse_args()

    voices = args.voices or list(VOICE_FILES)
    args.data_dir.mkdir(parents=True, exist_ok=True)

    for voice in voices:
        if voice_is_valid(args.data_dir, voice):
            print(f"Piper voice verified: {voice}", flush=True)
            continue

        print(f"Downloading Piper voice: {voice}", flush=True)
        download_voice(voice, args.data_dir, force_redownload=True)
        if not voice_is_valid(args.data_dir, voice):
            raise RuntimeError(f"Piper voice failed integrity validation: {voice}")
        print(f"Piper voice downloaded and verified: {voice}", flush=True)


if __name__ == "__main__":
    main()
