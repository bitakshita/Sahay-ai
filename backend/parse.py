"""Rule-based extraction of income/expense from speech text. Deterministic on purpose: money values are never LLM-guessed."""
import re
NUM = re.compile(r"(\d[\d,]*(?:\.\d+)?)\s*(lakh|lac|लाख|crore|करोड़|hazaar|hazar|हज़ार|हजार|thousand|k)?", re.I)
MULT = {"lakh": 1e5, "lac": 1e5, "लाख": 1e5, "crore": 1e7, "करोड़": 1e7, "hazaar": 1e3, "hazar": 1e3, "हज़ार": 1e3, "हजार": 1e3, "thousand": 1e3, "k": 1e3}
INCOME = [("pension", r"pension|पेंशन"), ("fd_interest", r"\bfd\b|interest|byaj|ब्याज|एफडी"), ("rental", r"kiraya|किराया|rental"),
          ("family_support", r"beta|beti|son\b|बेटा|बेटी|family support")]
EXPENSE = [("healthcare", r"medicine|dawai|dawa|doctor|hospital|health|दवा|दवाई|डॉक्टर|अस्पताल"),
           ("groceries", r"grocery|sabzi|sabji|ration|kirana|doodh|सब्ज़ी|सब्जी|राशन|किराना|दूध"),
           ("utilities", r"bijli|electric|bill|water|gas|बिजली|बिल|पानी"), ("transport", r"auto|taxi|cab|bus|petrol|ऑटो|टैक्सी|बस|पेट्रोल"),
           ("household", r"ghar|household|repair|घर|मरम्मत"), ("recurring", r"emi|premium|insurance|प्रीमियम|बीमा")]
EXP_WORDS = re.compile(r"kharch|spent|spend|paid|diye|diya|bought|kharid|खर्च|दिया|दिये|खरीद", re.I)
INC_WORDS = re.compile(r"aati|aata|milta|mila|mili|aaya|received|income|credited|आती|आता|मिलता|मिला|मिली|आया", re.I)

def _cat(text, table):
    for name, rx in table:
        if re.search(rx, text, re.I): return name
    return None

def parse_transactions(text: str):
    out = []
    for clause in re.split(r"(?<!\d),|,(?!\d)|;|\baur\b|\band\b|और", text, flags=re.I):
        m = NUM.search(clause)
        if not m: continue
        amt = float(m.group(1).replace(",", "")) * MULT.get((m.group(2) or "").lower(), 1)
        if amt <= 0: continue
        inc_cat, exp_cat = _cat(clause, INCOME), _cat(clause, EXPENSE)
        if EXP_WORDS.search(clause) or (exp_cat and not INC_WORDS.search(clause)): kind, cat = "expense", exp_cat or "other"
        elif INC_WORDS.search(clause) or inc_cat: kind, cat = "income", inc_cat or "other"
        else: continue
        out.append({"kind": kind, "category": cat, "amount": amt, "note": clause.strip()})
    return out
