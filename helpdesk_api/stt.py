"""Speech-to-text with faster-whisper. Detects German or English.
Reads WAV audio directly (no ffmpeg/av needed)."""
import io, os, wave
import numpy as np
from faster_whisper import WhisperModel

MODEL_SIZE = os.getenv("WHISPER_MODEL", "base")   # multilingual model
_model = None

def _get_model():
    global _model
    if _model is None:
        _model = WhisperModel(MODEL_SIZE, device="cpu", compute_type="int8",
                              download_root=os.path.join(os.path.dirname(__file__), "models_cache"))
    return _model

def _wav_to_16k_float(audio_bytes: bytes) -> np.ndarray:
    """Convert 16-bit WAV bytes to the mono 16 kHz float array Whisper expects."""
    with wave.open(io.BytesIO(audio_bytes)) as w:
        rate, channels, width = w.getframerate(), w.getnchannels(), w.getsampwidth()
        frames = w.readframes(w.getnframes())
    if width != 2:
        raise ValueError("Expected 16-bit WAV audio")
    audio = np.frombuffer(frames, dtype=np.int16).astype(np.float32) / 32768.0
    if channels > 1:
        audio = audio.reshape(-1, channels).mean(axis=1)
    if rate != 16000 and len(audio) > 0:
        n = int(len(audio) * 16000 / rate)
        audio = np.interp(np.linspace(0, len(audio) - 1, n), np.arange(len(audio)), audio)
    return audio.astype(np.float32)

def transcribe(audio_bytes: bytes, lang: str | None = None) -> tuple[str, str]:
    """Returns (text, language). Audio is processed in memory only."""
    audio = _wav_to_16k_float(audio_bytes)
    segments, info = _get_model().transcribe(audio, language=lang, beam_size=1, vad_filter=True)
    text = " ".join(s.text.strip() for s in segments).strip()
    detected = info.language if info.language in ("de", "en") else "en"
    return text, detected
