"""Tiny keyword RAG. Finds the right verified facts; the LLM may only explain THESE facts.
Files are re-read on every search, so edits to data/*.json work without restarting."""
import json, pathlib, re
DATA = pathlib.Path(__file__).parent / "data"
STOP = {"kya","hai","hain","ke","ki","ka","ko","mujhe","mere","meri","mera","batao","bataiye","me","mein","se","par","aur","kaise","kaun","kab","kitna",
        "chahiye","hota","hoti","banta","the","is","are","a","an","of","to","for","what","how","and","my","me","can","i","do","does",
        "का","की","के","को","है","हैं","में","से","पर","और","क्या","कैसे","कौन","मुझे","मेरी","मेरा","बताओ"}

def _tokens(t): return set(re.findall(r"[\w\u0900-\u097F]+", t.lower())) - STOP

def _docs():
    docs = []
    for x in json.loads((DATA / "schemes.json").read_text(encoding="utf-8"))["schemes"]:
        parts = [x.get("summary", "")]
        for label, k in (("Who can get it", "eligibility"), ("Documents", "documents"), ("How to apply", "how_to_apply")):
            if x.get(k): parts.append(f"{label}: {x[k]}")
        docs.append({"title": x["name"], "text": " ".join(parts), "keywords": x.get("keywords", []),
                     "source": x["official_link"], "verified_on": x.get("verified_on")})
    p = DATA / "tax_facts.json"
    if p.exists(): docs += json.loads(p.read_text(encoding="utf-8"))
    return docs

def search(query: str, k: int = 3):
    q, out = _tokens(query), []
    for d in _docs():
        head, body = _tokens(d["title"] + " " + " ".join(d.get("keywords", []))), _tokens(d["text"])
        if q & head: out.append((3 * len(q & head) + len(q & body), d))
    return [d for _, d in sorted(out, key=lambda x: -x[0])[:k]]

def context(hits):
    return "\n\n".join(f"[{h['title']}] {h['text']} (source: {h['source']}, verified: {h.get('verified_on') or 'NOT VERIFIED'})" for h in hits)

def stats():
    d = _docs(); return {"rag_total": len(d), "rag_verified": sum(1 for x in d if x.get("verified_on"))}
