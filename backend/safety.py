"""Heuristic warning-sign finder. It NEVER declares a message genuine or fraudulent."""
import re
FLAGS = [
 ("urgency", r"urgent|immediately|turant|within \d+ ?(hours?|hrs?|minutes?)|24 ?(hours?|hrs)|block(ed)?|suspend|expire|band ho|तुरंत|ब्लॉक|बंद",
  {"en": "It tries to rush or scare you (urgency, 'account will be blocked').", "hi": "यह आपको जल्दबाज़ी या डर में डालने की कोशिश करता है।"}),
 ("link", r"https?://|www\.|bit\.ly|tinyurl|\b\S+\.(xyz|top|click|link|cc)\b",
  {"en": "It contains a link. Links in such messages can lead to fake websites.", "hi": "इसमें एक लिंक है। ऐसे लिंक नकली वेबसाइट पर ले जा सकते हैं।"}),
 ("secret", r"\botp\b|\bpin\b|cvv|password|passcode|ओटीपी|पिन",
  {"en": "It mentions OTP/PIN/password. A real bank never asks you to share these.", "hi": "इसमें OTP/पिन/पासवर्ड की बात है। असली बैंक ये कभी नहीं मांगता।"}),
 ("kyc", r"kyc|pan (update|card)|aadhaar (update|link)|केवाईसी",
  {"en": "It asks for a KYC/PAN/Aadhaar update through the message. Scammers often use this.", "hi": "यह मैसेज के ज़रिए KYC/PAN/आधार अपडेट मांगता है। ठग अक्सर ऐसा करते हैं।"}),
 ("money", r"processing fee|lottery|prize|you won|reward|cashback|refund|inam|इनाम|लॉटरी",
  {"en": "It promises money or asks for a fee. Be careful.", "hi": "यह पैसे का लालच देता है या फीस मांगता है। सावधान रहें।"}),
]
STEPS = {
 "en": ["Do not click any link and do not reply.", "Never share OTP, UPI PIN, password or card details with anyone.",
        "Call your bank on the number printed on your card, passbook or the bank's official website.",
        "If money is lost, call 1930 (national cyber crime helpline) or visit cybercrime.gov.in quickly."],
 "hi": ["कोई लिंक न खोलें और जवाब न दें।", "OTP, UPI पिन, पासवर्ड या कार्ड की जानकारी किसी को न बताएं।",
        "अपने बैंक को कार्ड, पासबुक या बैंक की आधिकारिक वेबसाइट पर लिखे नंबर पर फ़ोन करें।",
        "अगर पैसे कट गए हों तो तुरंत 1930 (साइबर क्राइम हेल्पलाइन) पर फ़ोन करें या cybercrime.gov.in पर जाएं।"],
 "hinglish": ["Koi link na kholein aur reply na karein.", "OTP, UPI PIN, password ya card ki jaankari kisi ko na batayein.",
        "Apne bank ko card, passbook ya official website par likhe number par call karein.",
        "Paise kat gaye hon to turant 1930 (cyber crime helpline) par call karein ya cybercrime.gov.in par jayein."]}
LABEL = {"en": ["No common warning signs found, but this does NOT prove the message is genuine.", "Some warning signs found.", "Several warning signs found."],
         "hi": ["आम चेतावनी के संकेत नहीं मिले, लेकिन इसका मतलब यह नहीं कि मैसेज असली है।", "कुछ चेतावनी संकेत मिले।", "कई चेतावनी संकेत मिले।"],
         "hinglish": ["Aam warning signs nahi mile, lekin ye pakka nahi ki message asli hai.", "Kuch warning signs mile.", "Kai warning signs mile."]}

def analyze(text: str, lang: str = "hinglish"):
    found = [(k, d) for k, rx, d in FLAGS if re.search(rx, text, re.I)]
    n = min(len(found), 2)
    fl = "hi" if lang == "hi" else "en"
    return {"flags": [d[fl] for _, d in found], "risk_label": LABEL[lang][n], "level": n,
            "verify_steps": STEPS[lang], "disclaimer": {"en": "This is a text check only, not a guarantee. Always verify through official channels.",
              "hi": "यह सिर्फ़ टेक्स्ट की जाँच है, गारंटी नहीं। हमेशा आधिकारिक माध्यम से पुष्टि करें।",
              "hinglish": "Ye sirf text ki jaanch hai, guarantee nahi. Hamesha official tareeke se confirm karein."}[lang]}
