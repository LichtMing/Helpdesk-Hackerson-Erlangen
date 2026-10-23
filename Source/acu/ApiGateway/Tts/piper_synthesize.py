"""Synthesize one Piper utterance entirely in memory.

Text is read from stdin and WAV bytes are written to stdout. Patient text and
generated audio are never written to the container filesystem.
"""

import argparse
import io
import sys
import wave

from piper import PiperVoice, SynthesisConfig


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser()
    parser.add_argument("--model", required=True)
    parser.add_argument("--config", required=True)
    parser.add_argument("--length-scale", type=float, default=1.0)
    parser.add_argument("--sentence-silence", type=float, default=0.15)
    return parser.parse_args()


def main() -> None:
    args = parse_args()
    text = sys.stdin.read().strip()
    if not text:
        raise ValueError("No text was provided to Piper")

    voice = PiperVoice.load(args.model, config_path=args.config)
    synthesis = SynthesisConfig(length_scale=args.length_scale)
    output = io.BytesIO()
    wrote_audio = False

    with wave.open(output, "wb") as wav_file:
        for index, chunk in enumerate(voice.synthesize(text, synthesis)):
            if not wrote_audio:
                wav_file.setframerate(chunk.sample_rate)
                wav_file.setsampwidth(chunk.sample_width)
                wav_file.setnchannels(chunk.sample_channels)
                wrote_audio = True
            elif index > 0 and args.sentence_silence > 0:
                # Calculate complete PCM frames first. Truncating the byte count
                # directly can produce an odd number for 16-bit mono audio,
                # shifting every sample after the pause by one byte.
                silence_frames = int(chunk.sample_rate * args.sentence_silence)
                silence_bytes = (
                    silence_frames
                    * chunk.sample_width
                    * chunk.sample_channels
                )
                wav_file.writeframes(bytes(silence_bytes))
            wav_file.writeframes(chunk.audio_int16_bytes)

    if not wrote_audio:
        raise RuntimeError("Piper produced no audio")
    sys.stdout.buffer.write(output.getvalue())


if __name__ == "__main__":
    main()
