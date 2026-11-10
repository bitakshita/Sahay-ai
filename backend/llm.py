"""Swappable LLM layer. Only this file knows the provider (Anthropic Messages API here)."""
import os, httpx
def configured(): return bool(os.getenv("LLM_API_KEY"))

SYSTEM = ("You are Sahay, a calm, respectful assistant for Indian senior citizens. Use short, simple sentences "
 "(under 80 words, it will be read aloud). Never ask for OTP, UPI PIN, passwords or card details. Never invent schemes, "
 "rules or numbers. For tax or legal questions do not give a bare yes/no: say what depends on what, list what you need, "
 "and point to official sources (incometax.gov.in). Never say a message is definitely genuine or definitely fraud.")
LANG = {"hi": "Reply in simple Hindi (Devanagari script).", "en": "Reply in simple English.",
        "hinglish": "Reply in simple Hinglish (Hindi written in English letters)."}

async def ask(user: str, lang: str = "hinglish", extra: str = "") -> str | None:
    if not configured(): return None
    try:
        async with httpx.AsyncClient(timeout=40) as c:
            r = await c.post("https://api.anthropic.com/v1/messages",
                headers={"x-api-key": os.environ["LLM_API_KEY"], "anthropic-version": "2023-06-01"},
                json={"model": os.getenv("LLM_MODEL", "claude-sonnet-4-6"), "max_tokens": 500,
                      "system": f"{SYSTEM} {LANG.get(lang, LANG['en'])} {extra}",
                      "messages": [{"role": "user", "content": user}]})
        r.raise_for_status()
        return "".join(b.get("text", "") for b in r.json()["content"]).strip()
    except Exception:
        return None
