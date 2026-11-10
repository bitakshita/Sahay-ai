
import os
from google import genai
from google.genai import types


def configured():
    return bool(os.getenv("GEMINI_API_KEY", "").strip())


SYSTEM = """
You are Sahay, a helpful and respectful AI assistant
for Indian senior citizens.

Your job is to explain government schemes, pensions,
taxation, banking and digital safety in simple language.

IMPORTANT LANGUAGE RULES:
1. Follow the requested response language strictly.
2. Never automatically switch to English.
3. Do not translate the user's language preference.
4. Keep sentences short and easy to understand.
5. Never invent government schemes, eligibility rules,
   financial figures or deadlines.
6. Never ask for OTP, UPI PIN, passwords or card details.
"""


LANG = {
    "hi": """
    RESPONSE LANGUAGE: HINDI ONLY.
    Write every sentence in Hindi using Devanagari script.
    Avoid English sentences. Explain unavoidable technical
    terms using simple Hindi.
    """,

    "en": """
    RESPONSE LANGUAGE: ENGLISH ONLY.
    Write every sentence in English.
    """,

    "hinglish": """
    RESPONSE LANGUAGE: HINGLISH ONLY.
    Write Hindi words using English/Roman letters.
    Mix commonly understood Hindi and English naturally.
    Do NOT write Hindi in Devanagari script.
    Do NOT respond entirely in English.
    """
}


async def ask(user: str, lang: str = "hinglish", extra: str = ""):

    if not configured():
        print("Gemini API key is missing.")
        return None

    if not user or not user.strip():
        return None

    # Validate requested language.
    lang = lang.lower().strip()

    if lang not in LANG:
        lang = "hinglish"

    try:

        client = genai.Client(
            api_key=os.getenv("GEMINI_API_KEY")
        )

        prompt = f"""
{SYSTEM}

{LANG[lang]}

ADDITIONAL CONTEXT:
{extra if extra else "No additional context provided."}

USER MESSAGE:
{user}

FINAL INSTRUCTION:
Respond ONLY in the requested language.
Do not begin with an English introduction.
Do not explain which language you are using.
"""

        response = await client.aio.models.generate_content(
            model=os.getenv(
                "GEMINI_MODEL",
                "gemini-2.5-flash"
            ),
            contents=prompt,
            config=types.GenerateContentConfig(
                temperature=0.3,
                max_output_tokens=500
            )
        )

        answer = response.text

        if not answer:
            return None

        return answer.strip()

    except Exception as error:
        print("Gemini LLM Error:", error)
        return None
