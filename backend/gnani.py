
"""
Gnani Voice API integration for Sahay AI.

Features:
- Speech-to-Text using Gnani Prisma
- Text-to-Speech using Gnani Timbre
- Retry handling for temporary errors
- Optional STT keyterms
- Small in-memory TTS cache
"""

import os
import json
import hashlib
import asyncio
from typing import Optional

import httpx


# --------------------------------------------------
# CONFIGURATION
# --------------------------------------------------

BASE_URL = "https://api.vachana.ai"

RETRY_STATUS = {
    429,
    500,
    502,
    503,
    504
}

REQUEST_TIMEOUT = 60

CACHE_MAX = 50

TTS_CACHE = {}


class GnaniError(Exception):
    """Custom exception for Gnani API errors."""

    def __init__(self, status: int, message: str):
        self.status = status
        self.message = message
        super().__init__(message)


# --------------------------------------------------
# ENVIRONMENT CONFIGURATION
# --------------------------------------------------

def get_api_key() -> str:
    return os.getenv("GNANI_API_KEY", "").strip()


def configured() -> bool:
    return bool(get_api_key())


def get_stt_model() -> str:
    return os.getenv(
        "GNANI_STT_MODEL",
        "prisma-v3.0"
    ).strip()


def get_tts_model() -> str:
    return os.getenv(
        "GNANI_TTS_MODEL",
        "timbre-v2.5"
    ).strip()


# --------------------------------------------------
# ERROR HANDLING
# --------------------------------------------------

def get_error_message(response: httpx.Response) -> str:
    """Extract a readable error from Gnani responses."""

    try:
        data = response.json()

        if isinstance(data.get("error"), dict):
            error = data["error"]

            return (
                f"{error.get('type', 'API Error')}: "
                f"{error.get('message', 'Unknown error')}"
            )

        if isinstance(data.get("detail"), dict):
            detail = data["detail"]

            return (
                f"{detail.get('error_code', 'API Error')}: "
                f"{detail.get('message', 'Unknown error')}"
            )

        if "detail" in data:
            return str(data["detail"])[:300]

        if "message" in data:
            return str(data["message"])[:300]

    except Exception:
        pass

    return response.text[:300]


# --------------------------------------------------
# COMMON API REQUEST FUNCTION
# --------------------------------------------------

async def post_request(
    url: str,
    retries: int = 2,
    **kwargs
) -> httpx.Response:

    if not configured():
        raise GnaniError(
            503,
            "GNANI_API_KEY is not configured."
        )

    headers = kwargs.pop("headers", {})

    headers["X-API-Key-ID"] = get_api_key()

    last_error: Optional[GnaniError] = None

    async with httpx.AsyncClient(
        timeout=REQUEST_TIMEOUT
    ) as client:

        for attempt in range(retries + 1):

            try:

                response = await client.post(
                    url,
                    headers=headers,
                    **kwargs
                )

                if response.status_code == 200:
                    return response

                last_error = GnaniError(
                    response.status_code,
                    get_error_message(response)
                )

                if response.status_code not in RETRY_STATUS:
                    raise last_error

            except httpx.HTTPError as error:

                last_error = GnaniError(
                    504,
                    f"Network error communicating with Gnani: {error}"
                )

            if attempt < retries:
                await asyncio.sleep(1 + attempt)

    raise last_error or GnaniError(
        500,
        "Unknown Gnani API error."
    )


# --------------------------------------------------
# SPEECH TO TEXT - STT
# --------------------------------------------------

KEYTERMS = [
    "Ayushman",
    "Vay Vandana",
    "PM-JAY",
    "SCSS",
    "NSAP",
    "Form 15H",
    "80TTB",
    "pension",
    "FD",
    "TDS",
    "ITR",
    "Jan Aadhaar",
    "e-Mitra"
]


async def stt(
    audio: bytes,
    filename: str = "recording.wav",
    language_code: str = "hi-IN,en-IN"
) -> dict:

    """
    Convert uploaded audio into text.

    Args:
        audio: Audio file bytes.
        filename: Uploaded audio filename.
        language_code: Supported language code(s).

    Returns:
        Gnani transcription response.
    """

    if not audio:
        raise GnaniError(
            400,
            "No audio data received."
        )

    if not configured():
        raise GnaniError(
            503,
            "GNANI_API_KEY is not configured."
        )

    model = get_stt_model()

    data = {
        "language_code": language_code,
        "format": "transcribe"
    }

    if model == "prisma-v3.0":

        data["model"] = model

        enable_keyterms = os.getenv(
            "GNANI_KEYTERMS",
            "off"
        ).lower() in ("on", "1", "true")

        if enable_keyterms:
            data["keyterms"] = json.dumps(
                KEYTERMS,
                ensure_ascii=False
            )

    else:

        # Older model configuration.
        data["language_code"] = language_code.split(",")[0]

    response = await post_request(
        f"{BASE_URL}/stt/v3",
        files={
            "audio_file": (
                filename,
                audio,
                "audio/wav"
            )
        },
        data=data
    )

    return response.json()


# --------------------------------------------------
# TEXT TO SPEECH - TTS
# --------------------------------------------------

VOICES_V25 = {
    "hi-IN": "Chitra",
    "en-IN": "Kaveri",
    "hi-en": "Poorvi"
}


def get_voice(model: str, language: str) -> str:

    configured_voice = os.getenv(
        "GNANI_TTS_VOICE",
        ""
    ).strip()

    if configured_voice:
        return configured_voice

    if model == "timbre-v3.0":
        return "Shivani"

    return VOICES_V25.get(
        language,
        "Chitra"
    )


async def tts(
    text: str,
    language: str = "hi-IN",
    slow: bool = False
) -> bytes:

    """
    Convert text into speech.

    Args:
        text: Text to speak.
        language: Speech language.
        slow: Whether to use slower speech.

    Returns:
        WAV audio bytes.
    """

    if not text or not text.strip():
        raise GnaniError(
            400,
            "Text cannot be empty."
        )

    if not configured():
        raise GnaniError(
            503,
            "GNANI_API_KEY is not configured."
        )

    model = get_tts_model()

    voice = get_voice(
        model,
        language
    )

    # Numeric speech speed.
    speed = 0.85 if slow else 1.0

    # Generate cache key.
    cache_string = (
        f"{model}|{voice}|{language}|{speed}|{text}"
    )

    cache_key = hashlib.sha1(
        cache_string.encode("utf-8")
    ).hexdigest()

    # Return cached audio if available.
    if cache_key in TTS_CACHE:
        return TTS_CACHE[cache_key]

    # Gnani TTS request.
    payload = {
        "text": text,
        "voice": voice,
        "model": model,
        "language": language,
        "speed": speed,
        "audio_config": {
            "sample_rate": 24000,
            "num_channels": 1,
            "sample_width": 2,
            "encoding": "linear_pcm",
            "container": "wav"
        }
    }

    response = await post_request(
        f"{BASE_URL}/api/v1/tts/inference",
        json=payload
    )

    audio_data = response.content

    if not audio_data:
        raise GnaniError(
            502,
            "Gnani returned an empty audio response."
        )

    # Maintain a small cache.
    if len(TTS_CACHE) >= CACHE_MAX:
        oldest_key = next(iter(TTS_CACHE))
        TTS_CACHE.pop(oldest_key)

    TTS_CACHE[cache_key] = audio_data

    return audio_data
