# Sahay AI — Your Voice-First Life Assistance Companion

## Windows setup
Install **Python 3.10+** (tick "Add to PATH") and **Node.js LTS**.

**Terminal 1 (backend)**
```
cd sahay-ai\backend
py -m venv .venv
.venv\Scripts\activate          # if blocked: Set-ExecutionPolicy -Scope Process Bypass
pip install -r requirements.txt
copy .env.example .env          # open .env, paste GNANI_API_KEY and LLM_API_KEY
uvicorn main:app --reload --port 8000
```
**Terminal 2 (frontend)**
```
cd sahay-ai\frontend
npm install
npm run dev
```
Open http://localhost:5173 in Chrome. Restart the backend after editing `.env`.

## Keys
- `GNANI_API_KEY` from https://app.gnani.ai/voice — real Gnani Prisma speech-to-text and Timbre text-to-speech.
- `LLM_API_KEY` — an Anthropic (Claude) key. Without it the app still works in basic mode.

## How RAG works here
1. Your verified facts live in `backend/data/schemes.json` and `backend/data/tax_facts.json`.
2. `backend/rag.py` finds the entries that match the question (Hindi, English and Hinglish keywords).
3. Claude may answer ONLY from those entries; the chat shows each source link and its verified date.
4. If nothing matches, Sahay says it has no verified information.
Edit the JSON files (no restart needed), check each fact on the official site, then set `verified_on` to the date.

## Before the demo
- All starter entries are UNVERIFIED drafts. Verify them and set `verified_on`.
- `backend/data/tax_rules.json` is marked UNVERIFIED too. Confirm it on incometax.gov.in.
- Demo data, reminders and Family Connect toggles are clearly labelled DEMO.
- Use **Talk → Test voice**: it shows "Gnani Timbre" only if Gnani really spoke, otherwise "Browser voice (not Gnani)".
