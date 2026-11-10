import sqlite3, pathlib, datetime as dt
P = pathlib.Path(__file__).parent / "sahay.db"
def conn():
    c = sqlite3.connect(P); c.row_factory = sqlite3.Row; return c

def _month(offset):
    d = dt.date.today().replace(day=15)
    for _ in range(offset): d = (d.replace(day=1) - dt.timedelta(days=1)).replace(day=15)
    return d

def init():
    first = not P.exists()
    with conn() as c:
        c.execute("CREATE TABLE IF NOT EXISTS tx(id INTEGER PRIMARY KEY AUTOINCREMENT, kind TEXT, category TEXT, amount REAL, note TEXT, date TEXT, source TEXT)")
        if first:  # DEMO data, flagged source='demo'
            for off, health in ((2, 700), (1, 600), (0, 1800)):
                d = _month(off).isoformat()
                for k, cat, amt in (("income", "pension", 25000), ("income", "fd_interest", 5000), ("expense", "groceries", 6000),
                                    ("expense", "healthcare", health), ("expense", "utilities", 2200), ("expense", "transport", 900)):
                    c.execute("INSERT INTO tx(kind,category,amount,note,date,source) VALUES(?,?,?,?,?,'demo')", (k, cat, amt, "demo entry", d))

def add(items, source):
    with conn() as c:
        for t in items:
            c.execute("INSERT INTO tx(kind,category,amount,note,date,source) VALUES(?,?,?,?,?,?)",
                      (t["kind"], t["category"], float(t["amount"]), t.get("note", ""), t.get("date") or dt.date.today().isoformat(), source))

def delete_all():
    with conn() as c: c.execute("DELETE FROM tx")

def summary(lang="hinglish"):
    rows = [dict(r) for r in conn().execute("SELECT * FROM tx ORDER BY date DESC, id DESC")]
    ms = [_month(i).strftime("%Y-%m") for i in (2, 1, 0)]
    tot = lambda m, k, cat=None: sum(r["amount"] for r in rows if r["date"][:7] == m and r["kind"] == k and (cat is None or r["category"] == cat))
    cur, prev = ms[2], ms[1]
    cats = {}
    for r in rows:
        if r["date"][:7] == cur and r["kind"] == "expense": cats[r["category"]] = cats.get(r["category"], 0) + r["amount"]
    diff = tot(cur, "expense", "healthcare") - tot(prev, "expense", "healthcare")
    if diff:
        amt = f"₹{abs(diff):,.0f}"
        insight = (f"Healthcare spending is about {amt} {'more' if diff > 0 else 'less'} than last month." if lang == "en" else
                   f"Is mahine dawai/ilaaj par pichhle mahine se lagbhag {amt} {'zyada' if diff > 0 else 'kam'} kharch hua.")
    else: insight = ""
    return {"month": cur, "income": tot(cur, "income"), "expense": tot(cur, "expense"),
            "balance": tot(cur, "income") - tot(cur, "expense"),
            "by_category": [{"name": k, "value": v} for k, v in cats.items()],
            "monthly": [{"month": m, "income": tot(m, "income"), "expense": tot(m, "expense")} for m in ms],
            "insight": insight, "demo_count": sum(r["source"] == "demo" for r in rows),
            "recorded_count": sum(r["source"] != "demo" for r in rows), "recent": rows[:8]}
