"""Gnani (Vachana) STT/TTS client. Endpoints and fields follow docs.gnani.ai (verified 5 Aug 2026 page)."""
import os, httpx
BASE = "https://api.vachana.ai"

class GnaniError(Exception):
    def __init__(self, status, msg): self.status, self.msg = status, msg

def _key(): return os.getenv("GNANI_API_KEY", "")
def configured(): return bool(_key())

async def stt(audio: bytes, filename: str, language_code: str = "hi-IN,en-IN") -> dict:
    if not configured(): raise GnaniError(503, "GNANI_API_KEY is not set")
    model = os.getenv("GNANI_STT_MODEL", "prisma-v3.0")
    data = {"language_code": language_code, "format": "transcribe"}  # transcribe = numbers/₹ in written form
    if model == "prisma-v3.0": data["model"] = model
    else: data["language_code"] = language_code.split(",")[0]       # Prisma v2.5 accepts one language only
    async with httpx.AsyncClient(timeout=60) as c:
        r = await c.post(f"{BASE}/stt/v3", headers={"X-API-Key-ID": _key()},
                         files={"audio_file": (filename, audio, "audio/wav")}, data=data)
    if r.status_code != 200: raise GnaniError(r.status_code, r.text[:300])
    return r.json()

VOICES_V25 = {"hi-IN": "Chitra", "en-IN": "Kaveri", "hi-en": "Poorvi"}  # from Gnani voice catalog

async def tts(text: str, language: str = "hi-IN", slow: bool = False) -> bytes:
    if not configured(): raise GnaniError(503, "GNANI_API_KEY is not set")
    model = os.getenv("GNANI_TTS_MODEL", "timbre-v2.5")
    voice = os.getenv("GNANI_TTS_VOICE") or ("Shivani" if model == "timbre-v3.0" else VOICES_V25.get(language, "Chitra"))
    body = {"text": text, "voice": voice, "model": model, "language": language,
            "speed": "slow" if slow else 1.0,
            "audio_config": {"sample_rate": 24000, "num_channels": 1, "sample_width": 2,
                             "encoding": "linear_pcm", "container": "wav"}}
    async with httpx.AsyncClient(timeout=60) as c:
        r = await c.post(f"{BASE}/api/v1/tts/inference", headers={"X-API-Key-ID": _key()}, json=body)
    if r.status_code != 200: raise GnaniError(r.status_code, r.text[:300])
    return r.content
