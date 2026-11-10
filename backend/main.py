
import os
import json
import pathlib

from typing import Optional

from dotenv import load_dotenv
load_dotenv()

from fastapi import FastAPI, UploadFile, File, Form, HTTPException
from fastapi.responses import Response
from pydantic import BaseModel

import gnani
import llm
import db
import parse
import safety
import tax
import rag


# ==================================================
# APP CONFIGURATION
# ==================================================

app = FastAPI(title="Sahay AI")

db.init()

DATA = pathlib.Path(__file__).parent / "data"

TTS_LANG = {
    "hi": "hi-IN",
    "en": "en-IN",
    "hinglish": "hi-en"
}


# ==================================================
# LANGUAGE HANDLING
# ==================================================

SUPPORTED_LANGUAGES = ("hi", "en", "hinglish")


def normalize_lang(lang: Optional[str]) -> str:
    """
    Normalize language values received from frontend.
    """

    if not lang:
        return "hinglish"

    lang = lang.strip().lower()

    aliases = {
        "hindi": "hi",
        "english": "en",
        "roman hindi": "hinglish",
        "hi-in": "hi",
        "en-in": "en"
    }

    lang = aliases.get(lang, lang)

    if lang not in SUPPORTED_LANGUAGES:
        return "hinglish"

    return lang


# ==================================================
# STATUS
# ==================================================

@app.get("/api/status")
def status():

    return {
        "gnani": gnani.configured(),

        "llm": llm.configured(),

        "llm_provider": "Gemini",

        "llm_model": os.getenv(
            "GEMINI_MODEL",
            "gemini-2.5-flash"
        ),

        "stt_model": os.getenv(
            "GNANI_STT_MODEL",
            "prisma-v3.0"
        ),

        "tts_model": os.getenv(
            "GNANI_TTS_MODEL",
            "timbre-v2.5"
        ),

        **rag.stats()
    }


# ==================================================
# VOICE - SPEECH TO TEXT
# ==================================================

@app.post("/api/voice/stt")
async def voice_stt(
    audio: UploadFile = File(...),
    language_code: str = Form("hi-IN,en-IN")
):

    try:

        audio_data = await audio.read()

        result = await gnani.stt(
            audio_data,
            audio.filename or "speech.wav",
            language_code
        )

    except gnani.GnaniError as error:

        raise HTTPException(
            status_code=error.status,
            detail=error.msg
        )

    return {
        "transcript": result.get("transcript", ""),

        "detected_language_code": result.get(
            "detected_language_code"
        ),

        "engine": "gnani " + result.get("model", "")
    }


# ==================================================
# VOICE - TEXT TO SPEECH
# ==================================================

class TTSIn(BaseModel):

    text: str

    lang: str = "hinglish"

    slow: bool = False


@app.post("/api/voice/tts")
async def voice_tts(b: TTSIn):

    lang = normalize_lang(b.lang)

    try:

        audio = await gnani.tts(
            b.text,
            TTS_LANG[lang],
            b.slow
        )

    except gnani.GnaniError as error:

        raise HTTPException(
            status_code=error.status,
            detail=error.msg
        )

    return Response(
        audio,
        media_type="audio/wav"
    )


# ==================================================
# GNANI CONNECTION CHECK
# ==================================================

@app.get("/api/gnani/check")
async def gnani_check():

    if not gnani.configured():

        return {
            "ok": False,
            "step": "key",
            "detail": "GNANI_API_KEY is not configured."
        }

    try:

        audio = await gnani.tts(
            "नमस्ते",
            "hi-IN"
        )

    except gnani.GnaniError as error:

        return {
            "ok": False,
            "step": "tts",
            "status": error.status,
            "detail": error.msg
        }

    return {
        "ok": True,
        "tts_bytes": len(audio),

        "tts_model": os.getenv(
            "GNANI_TTS_MODEL",
            "timbre-v2.5"
        ),

        "stt_model": os.getenv(
            "GNANI_STT_MODEL",
            "prisma-v3.0"
        )
    }


# ==================================================
# FINANCE - TRANSACTIONS
# ==================================================

class TxIn(BaseModel):

    kind: str

    category: str

    amount: float

    note: str = ""


class TxBatch(BaseModel):

    items: list[TxIn]

    source: str = "manual"


@app.post("/api/transactions")
def add_tx(b: TxBatch):

    db.add(
        [item.model_dump() for item in b.items],

        b.source if b.source in ("voice", "manual")
        else "manual"
    )

    return {"ok": True}


@app.get("/api/summary")
def summary(lang: str = "hinglish"):

    return db.summary(normalize_lang(lang))


@app.delete("/api/transactions")
def wipe():

    db.delete_all()

    return {"ok": True}


# ==================================================
# TAX ESTIMATION
# ==================================================

class TaxIn(BaseModel):

    age: Optional[int] = None

    pension_annual: Optional[float] = None

    fd_interest_annual: Optional[float] = None

    other_income_annual: float = 0

    other_deductions_old: float = 0


@app.post("/api/tax/estimate")
def tax_estimate(b: TaxIn):

    return tax.estimate(
        b.age,
        b.pension_annual,
        b.fd_interest_annual,
        b.other_income_annual,
        b.other_deductions_old
    )


# ==================================================
# GOVERNMENT SCHEMES
# ==================================================

@app.get("/api/schemes")
def schemes():

    return json.loads(
        (DATA / "schemes.json").read_text(
            encoding="utf-8"
        )
    )


# ==================================================
# EXPLAIN MESSAGE
# ==================================================

class ExplainIn(BaseModel):

    text: str

    lang: str = "hinglish"


EXPLAIN_FALLBACK = {

    "en": (
        "A plain-language explanation requires an "
        "LLM connection. The warning-sign check is "
        "available below."
    ),

    "hi": (
        "आसान भाषा में पूरी जानकारी के लिए AI सेवा "
        "की आवश्यकता है। नीचे चेतावनी की जाँच देखें।"
    ),

    "hinglish": (
        "Simple explanation ke liye AI service ki "
        "zaroorat hai. Neeche warning-sign check dekhein."
    )
}


@app.post("/api/explain")
async def explain(b: ExplainIn):

    lang = normalize_lang(b.lang)

    result = safety.analyze(
        b.text,
        lang
    )

    prompt = (
        "Explain this message to a senior citizen. "
        "Describe what it means, whether any action "
        "is needed, and whether there is a deadline. "
        f"Warning signs: {result['flags']}. "
        f"Message: {b.text}"
    )

    ai = await llm.ask(
        prompt,
        lang
    )

    result["explanation"] = ai or EXPLAIN_FALLBACK[lang]

    result["ai_used"] = bool(ai)

    return result


# ==================================================
# CONVERSATION LANGUAGE RESPONSES
# ==================================================

T = {

    "hinglish": {

        "found": "Maine ye samjha: {items}. Kya main ise save kar doon?",

        "income": "aay",

        "expense": "kharch",

        "fallback": (
            "Main kharch likhne, tax samjhane, "
            "sarkari yojana batane ya koi message "
            "samjhane mein madad kar sakta hoon. Boliye."
        )
    },

    "hi": {

        "found": "मैंने ये समझा: {items}। क्या मैं इसे सेव कर दूं?",

        "income": "आय",

        "expense": "खर्च",

        "fallback": (
            "मैं खर्च लिखने, टैक्स समझाने, सरकारी "
            "योजनाओं की जानकारी देने या कोई संदेश "
            "समझाने में मदद कर सकता हूं। बताइए।"
        )
    },

    "en": {

        "found": "Here is what I understood: {items}. Shall I save this?",

        "income": "income",

        "expense": "expense",

        "fallback": (
            "I can help you record expenses, understand "
            "tax, find government schemes, or explain "
            "messages. How can I help?"
        )
    }
}


# ==================================================
# TAX FALLBACK RESPONSES
# ==================================================

TAX_FALLBACK = {

    "en": (
        "Whether you owe tax depends on the financial year, "
        "your age, the tax regime, your total income and "
        "deductions. Open the Tax Assistant tab to enter "
        "your details and get an illustrative estimate. "
        "Confirm details on incometax.gov.in."
    ),

    "hi": (
        "टैक्स लगेगा या नहीं, यह वित्त वर्ष, आपकी उम्र, "
        "टैक्स व्यवस्था, कुल आय और कटौतियों पर निर्भर करता है। "
        "टैक्स असिस्टेंट टैब में अपनी जानकारी भरें। "
        "अंतिम पुष्टि incometax.gov.in पर करें।"
    ),

    "hinglish": (
        "Tax lagega ya nahi, ye financial year, aapki "
        "umar, tax regime, total income aur deductions "
        "par depend karta hai. Tax Assistant tab mein "
        "apni details bharein. Confirm incometax.gov.in par karein."
    )
}


# ==================================================
# RAG CONFIGURATION
# ==================================================

RAG_RULE = (
    "Answer ONLY from the SOURCES below. "
    "If the answer is not available in the sources, "
    "say that you do not have verified information "
    "and direct the user to the official website. "
    "Always advise confirming details on the official site. "
    "SOURCES:\n"
)


NO_INFO = {

    "en": (
        "I do not have verified information on that. "
        "Please check the Government Guide tab or official website."
    ),

    "hi": (
        "मेरे पास इसकी सत्यापित जानकारी नहीं है। "
        "कृपया सरकारी गाइड टैब या आधिकारिक वेबसाइट देखें।"
    ),

    "hinglish": (
        "Mere paas iski verified jaankari nahi hai. "
        "Government Guide tab ya official website dekhein."
    )
}


def get_sources(hits):

    return [
        {
            "title": hit["title"],

            "link": hit["source"],

            "verified_on": hit.get("verified_on")
        }

        for hit in hits
    ]


# ==================================================
# RAG SEARCH
# ==================================================

@app.get("/api/rag/search")
def rag_search(q: str):

    hits = rag.search(q)

    return {
        "hits": get_sources(hits)
    }


# ==================================================
# MAIN CHAT
# ==================================================

class ChatIn(BaseModel):

    message: str

    lang: str = "hinglish"


@app.post("/api/chat")
async def chat(b: ChatIn):

    message = b.message.strip()

    lang = normalize_lang(b.lang)

    if not message:

        raise HTTPException(
            status_code=400,
            detail="Message cannot be empty."
        )

    low = message.lower()

    # Search RAG sources.
    hits = rag.search(message)

    # --------------------------------------------------
    # TAX QUESTIONS
    # --------------------------------------------------

    if any(
        keyword in low
        for keyword in (
            "tax",
            "itr",
            "tds",
            "form 16",
            "टैक्स",
            "कर "
        )
    ):

        extra = (
            "This is a tax-related question. "
            "Explain the subject simply. Ask for missing "
            "information where necessary. Do not provide "
            "a bare yes/no answer."
        )

        if hits:

            extra += (
                "\n\n"
                + RAG_RULE
                + rag.context(hits)
            )

        response = await llm.ask(
            message,
            lang,
            extra
        )

        return {
            "reply": response or (
                hits[0]["text"]
                if hits
                else TAX_FALLBACK[lang]
            ),

            "transactions": [],

            "intent": "tax",

            "sources": get_sources(hits)
        }

    # --------------------------------------------------
    # SAFETY / FRAUD QUESTIONS
    # --------------------------------------------------

    if any(
        keyword in low
        for keyword in (
            "otp",
            "link",
            "click",
            "kyc",
            "block",
            "scam",
            "fraud",
            "message aaya",
            "मैसेज",
            "धोखा"
        )
    ):

        result = safety.analyze(
            message,
            lang
        )

        return {
            "reply": (
                result["risk_label"]
                + " "
                + " ".join(result["verify_steps"][:3])
            ),

            "transactions": [],

            "intent": "safety"
        }

    # --------------------------------------------------
    # SCHEME QUESTIONS
    # --------------------------------------------------

    ask_scheme = any(
        keyword in low
        for keyword in (
            "yojana",
            "scheme",
            "योजना"
        )
    )

    # --------------------------------------------------
    # FINANCIAL TRANSACTION DETECTION
    # --------------------------------------------------

    transactions = parse.parse_transactions(
        message
    )

    if transactions and not ask_scheme:

        items = "; ".join(

            f"₹{item['amount']:,.0f} "
            f"{item['category'].replace('_', ' ')} "
            f"({T[lang][item['kind']]})"

            for item in transactions
        )

        return {

            "reply": T[lang]["found"].format(
                items=items
            ),

            "transactions": transactions,

            "intent": "finance"
        }

    # --------------------------------------------------
    # RAG-BASED ANSWERS
    # --------------------------------------------------

    if hits or ask_scheme:

        if not hits:

            return {

                "reply": NO_INFO[lang],

                "transactions": [],

                "intent": "rag"
            }

        extra = (
            RAG_RULE
            + rag.context(hits)
        )

        response = await llm.ask(
            message,
            lang,
            extra
        )

        return {

            "reply": response or hits[0]["text"],

            "transactions": [],

            "intent": "rag",

            "sources": get_sources(hits)
        }

    # --------------------------------------------------
    # GENERAL GEMINI CONVERSATION
    # --------------------------------------------------

    response = await llm.ask(
        message,
        lang
    )

    return {

        "reply": response or T[lang]["fallback"],

        "transactions": [],

        "intent": "general"
    }


# ==================================================
# HEALTH CHECK
# ==================================================

@app.get("/")
def root():

    return {

        "app": "Sahay AI",

        "status": "running",

        "llm_provider": "Gemini",

        "supported_languages": [
            "Hindi",
            "English",
            "Hinglish"
        ]

    }
