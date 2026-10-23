"""Text-to-speech with Piper: turns an answer into a WAV file in English or German."""
import io, os, wave
from piper import PiperVoice

VOICE_DIR = os.getenv("VOICE_DIR", os.path.join(os.path.dirname(__file__), "voices"))
VOICES = {"en": "en_US-lessac-medium.onnx", "de": "de_DE-thorsten-medium.onnx"}
_loaded = {}

def _voice(lang):
    lang = lang if lang in VOICES else "en"
    if lang not in _loaded:
        _loaded[lang] = PiperVoice.load(os.path.join(VOICE_DIR, VOICES[lang]))
    return _loaded[lang]

def synthesize(text: str, lang: str = "en") -> bytes:
    voice = _voice(lang)
    buf = io.BytesIO()                      # in memory, nothing written to disk
    with wave.open(buf, "wb") as wav_file:
        if hasattr(voice, "synthesize_wav"):    # newer Piper versions
            voice.synthesize_wav(text, wav_file)
        else:                                   # older Piper versions
            voice.synthesize(text, wav_file)
    return buf.getvalue()
