import json, pathlib
RULES = json.loads((pathlib.Path(__file__).parent / "data" / "tax_rules.json").read_text(encoding="utf-8"))

def _slab(slabs, income):
    tax, prev = 0.0, 0
    for upper, rate in slabs:
        top = income if upper is None else min(income, upper)
        if top > prev: tax += (top - prev) * rate
        if upper is None or income <= upper: break
        prev = upper
    return tax

def estimate(age, pension, fd, other=0, ded_old=0):
    missing = [n for n, v in (("age", age), ("pension_annual", pension), ("fd_interest_annual", fd)) if v is None]
    if missing: return {"missing": missing}
    gross, std_p = pension + fd + other, pension
    n, o, cess = RULES["new"], RULES["old"], RULES["cess"]
    t_new = max(0, gross - min(n["std_deduction"], std_p))
    tax_new = _slab(n["slabs"], t_new)
    if t_new <= n["rebate_limit"]: tax_new -= min(tax_new, n["rebate_max"])
    br = "below60" if age < 60 else "60to79" if age < 80 else "80plus"
    ttb = min(fd, o["sec_80ttb_max"]) if age >= 60 else 0
    t_old = max(0, gross - min(o["std_deduction"], std_p) - ttb - ded_old)
    tax_old = _slab(o["slabs_by_age"][br], t_old)
    if t_old <= o["rebate_limit"]: tax_old -= min(tax_old, o["rebate_max"])
    f = lambda t, taxable: {"taxable_income": round(taxable), "tax_with_cess": round(t * (1 + cess))}
    return {"fy": RULES["fy"], "status": RULES["status"], "verified_on": RULES["verified_on"],
            "new_regime": f(tax_new, t_new), "old_regime": f(tax_old, t_old),
            "assumptions": ["Illustrative only. Not considered: surcharge, marginal relief, advance tax, TDS already deducted, other deductions (except 80TTB on FD interest and the standard deduction on pension), special-rate incomes.",
                            "Slab values come from data/tax_rules.json and must be checked against incometax.gov.in for the relevant year."],
            "official_link": "https://www.incometax.gov.in"}
