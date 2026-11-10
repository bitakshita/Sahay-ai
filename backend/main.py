import os, json, pathlib
from typing import Optional
from dotenv import load_dotenv
load_dotenv()
from fastapi import FastAPI, UploadFile, File, Form, HTTPException
from fastapi.responses import Response
from pydantic import BaseModel
import gnani, llm, db, parse, safety, tax, rag

app = FastAPI(title="Sahay AI"); db.init()
DATA = pathlib.Path(__file__).parent / "data"
TTS_LANG = {"hi": "hi-IN", "en": "en-IN", "hinglish": "hi-en"}

@app.get("/api/status")
def status():
    return {"gnani": gnani.configured(), "llm": llm.configured(), "stt_model": os.getenv("GNANI_STT_MODEL", "prisma-v3.0"),
            "tts_model": os.getenv("GNANI_TTS_MODEL", "timbre-v2.5"), **rag.stats()}

# ---------- Voice (real Gnani calls; errors are passed through honestly) ----------
@app.post("/api/voice/stt")
async def voice_stt(audio: UploadFile = File(...), language_code: str = Form("hi-IN,en-IN")):
    try: r = await gnani.stt(await audio.read(), audio.filename or "speech.wav", language_code)
    except gnani.GnaniError as e: raise HTTPException(e.status, e.msg)
    return {"transcript": r.get("transcript", ""), "detected_language_code": r.get("detected_language_code"), "engine": "gnani " + r.get("model", "")}

class TTSIn(BaseModel): text: str; lang: str = "hinglish"; slow: bool = False
@app.post("/api/voice/tts")
async def voice_tts(b: TTSIn):
    try: audio = await gnani.tts(b.text, TTS_LANG.get(b.lang, "hi-IN"), b.slow)
    except gnani.GnaniError as e: raise HTTPException(e.status, e.msg)
    return Response(audio, media_type="audio/wav")

# ---------- Finance ----------
class TxIn(BaseModel): kind: str; category: str; amount: float; note: str = ""
class TxBatch(BaseModel): items: list[TxIn]; source: str = "manual"
@app.post("/api/transactions")
def add_tx(b: TxBatch): db.add([i.model_dump() for i in b.items], b.source if b.source in ("voice", "manual") else "manual"); return {"ok": True}
@app.get("/api/summary")
def summary(lang: str = "hinglish"): return db.summary(lang)
@app.delete("/api/transactions")
def wipe(): db.delete_all(); return {"ok": True}

# ---------- Tax ----------
class TaxIn(BaseModel):
    age: Optional[int] = None; pension_annual: Optional[float] = None; fd_interest_annual: Optional[float] = None
    other_income_annual: float = 0; other_deductions_old: float = 0
@app.post("/api/tax/estimate")
def tax_estimate(b: TaxIn): return tax.estimate(b.age, b.pension_annual, b.fd_interest_annual, b.other_income_annual, b.other_deductions_old)

# ---------- Schemes / Explain ----------
@app.get("/api/schemes")
def schemes(): return json.loads((DATA / "schemes.json").read_text(encoding="utf-8"))

class ExplainIn(BaseModel): text: str; lang: str = "hinglish"
@app.post("/api/explain")
async def explain(b: ExplainIn):
    a = safety.analyze(b.text, b.lang)
    ai = await llm.ask(f"Explain this message to a senior citizen: what it means, whether any action is needed, any deadline. "
                       f"Warning signs found by a checker: {a['flags']}. Message: {b.text}", b.lang)
    a["explanation"] = ai or {"en": "Automatic plain-language explanation needs an LLM key. Warning-sign check is shown below.",
        "hi": "आसान भाषा में पूरा विवरण के लिए LLM कुंजी चाहिए। नीचे चेतावनी की जाँच दिखाई गई है।",
        "hinglish": "Poori saral vyakhya ke liye LLM key chahiye. Neeche warning-sign ki jaanch hai."}[b.lang]
    a["ai_used"] = bool(ai); return a

# ---------- Conversation ----------
T = {"hinglish": {"found": "Maine ye samjha: {items}. Kya main ise save kar doon?", "income": "aay", "expense": "kharch",
        "fallback": "Main kharch likhne, tax samjhane, sarkari yojana batane ya koi message samjhane mein madad kar sakta hoon. Boliye."},
     "hi": {"found": "मैंने ये समझा: {items}। क्या मैं इसे सेव कर दूं?", "income": "आय", "expense": "खर्च",
        "fallback": "मैं खर्च लिखने, टैक्स समझाने, सरकारी योजना बताने या कोई मैसेज समझाने में मदद कर सकता हूं। बोलिए।"},
     "en": {"found": "Here is what I understood: {items}. Shall I save this?", "income": "income", "expense": "expense",
        "fallback": "I can help you record expenses, understand tax, find government schemes, or explain a message. Please tell me."}}
TAX_FALLBACK = {"en": "Whether you owe tax depends on the financial year, your age, the tax regime, all your income and deductions. Open the Tax Assistant tab, enter your annual pension and FD interest, and I will show an illustrative estimate. Please confirm on incometax.gov.in.",
    "hi": "टैक्स लगेगा या नहीं, यह वित्त वर्ष, आपकी उम्र, टैक्स व्यवस्था, कुल आय और कटौतियों पर निर्भर है। टैक्स असिस्टेंट टैब में पेंशन और FD ब्याज भरें, मैं अनुमान दिखाऊंगा। कृपया incometax.gov.in पर पुष्टि करें।",
    "hinglish": "Tax lagega ya nahi, ye financial year, aapki umar, tax regime, kul aay aur deductions par nirbhar hai. Tax Assistant tab mein pension aur FD interest bharein, main andaza dikhaunga. Kripya incometax.gov.in par confirm karein."}

RAG_RULE = ("Answer ONLY from the SOURCES below. If the answer is not in them, say you do not have verified information "
            "and point to the official website. Tell the user to confirm details on the official site. SOURCES:\n")
NO_INFO = {"en": "I do not have verified information on that. Please check the Government Guide tab or the official website.",
           "hi": "मेरे पास इसकी सत्यापित जानकारी नहीं है। कृपया सरकारी गाइड टैब या आधिकारिक वेबसाइट देखें।",
           "hinglish": "Mere paas iski verified jaankari nahi hai. Government Guide tab ya official website dekhein."}
def _src(hits): return [{"title": h["title"], "link": h["source"], "verified_on": h.get("verified_on")} for h in hits]

@app.get("/api/rag/search")
def rag_search(q: str): return {"hits": _src(rag.search(q))}

class ChatIn(BaseModel): message: str; lang: str = "hinglish"
@app.post("/api/chat")
async def chat(b: ChatIn):
    m, lang = b.message, b.lang if b.lang in T else "hinglish"
    low, hits = m.lower(), rag.search(b.message)
    if any(k in low for k in ("tax", "itr", "tds", "form 16", "टैक्स", "कर ")):
        extra = "Tax question. Explain simply, ask for missing info, do not give a bare yes/no."
        if hits: extra += " " + RAG_RULE + rag.context(hits)
        r = await llm.ask(m, lang, extra)
        return {"reply": r or (hits[0]["text"] if hits else TAX_FALLBACK[lang]), "transactions": [], "intent": "tax", "sources": _src(hits)}
    if any(k in low for k in ("otp", "link", "click", "kyc", "block", "scam", "fraud", "message aaya", "मैसेज", "धोखा")):
        a = safety.analyze(m, lang)
        return {"reply": a["risk_label"] + " " + " ".join(a["verify_steps"][:3]), "transactions": [], "intent": "safety"}
    ask_scheme = any(k in low for k in ("yojana", "scheme", "योजना"))
    txs = parse.parse_transactions(m)
    if txs and not ask_scheme:
        items = "; ".join(f"₹{t['amount']:,.0f} {t['category'].replace('_', ' ')} ({T[lang][t['kind']]})" for t in txs)
        return {"reply": T[lang]["found"].format(items=items), "transactions": txs, "intent": "finance"}
    if hits or ask_scheme:
        if not hits: return {"reply": NO_INFO[lang], "transactions": [], "intent": "rag"}
        r = await llm.ask(m, lang, RAG_RULE + rag.context(hits))
        return {"reply": r or hits[0]["text"], "transactions": [], "intent": "rag", "sources": _src(hits)}
    r = await llm.ask(m, lang)
    return {"reply": r or T[lang]["fallback"], "transactions": [], "intent": "general"}
