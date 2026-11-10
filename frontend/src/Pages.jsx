import { useEffect, useState } from 'react'
import { PieChart, Pie, Cell, Tooltip, BarChart, Bar, XAxis, YAxis, Legend, ResponsiveContainer } from 'recharts'
import { Volume2 } from 'lucide-react'
import { api } from './api'
import { speak } from './voice'
import { Button, Field, Modal, Notice, PageIntro, Stat, inr, labelize } from './ui'
const COLORS = ['#496B55', '#6E8B78', '#8C4E3A', '#C98770', '#A8B8A6', '#5E6158', '#D7CBBF']
const CATS = ['pension', 'fd_interest', 'rental', 'family_support', 'groceries', 'healthcare', 'utilities', 'household', 'transport', 'recurring', 'other']
const monthLabel = m => {
  const [y, mo] = String(m).split('-')
  const d = new Date(Number(y), Number(mo) - 1, 1)
  return Number.isNaN(d.getTime()) ? m : d.toLocaleDateString('en-IN', { month: 'short', year: 'numeric' })
}
function Transactions({ rows }) {
  if (!rows?.length) return <p className="empty">No entries yet.</p>
  return <ul className="tx-list">{rows.map(r => <li key={r.id}>
    <div>
      <p className="tx-title">{labelize(r.category)}</p>
      <p className="tx-meta">{r.date} · {r.kind === 'income' ? 'Income' : 'Expense'}{r.source === 'demo' ? ' · Demo' : r.source === 'voice' ? ' · Voice' : ''}</p>
    </div>
    <p className="tx-amt">{r.kind === 'income' ? '+' : '−'}{inr(r.amount)}</p>
  </li>)}</ul>
}
export function Finances({ sum, onChange, preset }) {
  const [f, setF] = useState({ kind: 'expense', category: 'groceries', amount: '' })
              {CATS.map(c => <option key={c} value={c}>{labelize(c)}</option>)}
          const [note, setNote] = useState('')
  const [err, setErr] = useState('')
  const [ask, setAsk] = useState(false)
  useEffect(() => { if (preset?.kind) setF(s => ({ ...s, kind: preset.kind })) }, [preset])
  if (!sum) return <p className="empty">Your finances are still loading.</p>
  const add = async e => {
    e.preventDefault()
    setErr(''); setNote('')
    if (!+f.amount) { setErr('Enter an amount before saving.'); return }
    try {
      await api.post('/api/transactions', { items: [{ ...f, amount: +f.amount }], source: 'manual' })
      setF({ ...f, amount: '' }); setNote('Entry added.'); onChange()
    } catch (ex) { setErr('Could not save that entry. ' + ex.message) }
  }
  const wipe = async () => {
    try { await api.del('/api/transactions'); setAsk(false); setNote('All stored entries were deleted.'); onChange() }
    catch (ex) { setAsk(false); setErr('Could not delete entries. ' + ex.message) }
  }
  const months = sum.monthly.map(row => ({ ...row, label: monthLabel(row.month) }))
  return <div className="stack">
    <PageIntro title="My finances">Income, expenses, and balance for this month, from the entries Sahay already stores.</PageIntro>
    <section className="stats" aria-label="This month">
      <Stat label="Total income" value={inr(sum.income)} note="This month" />
      <Stat label="Total expenses" value={inr(sum.expense)} note="This month" />
      <Stat label="Available balance" value={inr(sum.balance)} note="Income minus expenses" />
    </section>
     <p className="muted">{sum.demo_count} demo entries · {sum.recorded_count} entries recorded by you. Insights compare both kinds.</p>
    {sum.insight && <Notice title="This month">{sum.insight}</Notice>}
    {note && <Notice tone="good" title={note} />}
    {err && <Notice tone="caution" title="Something needs attention">{err}</Notice>}
<section className="card">
      <h2>Expenses by category</h2>
      {sum.by_category.length === 0 ? <p className="empty">No expenses recorded this month.</p> : <div className="chart">
        <ResponsiveContainer>
          <PieChart>
            <Pie data={sum.by_category.map(d => ({ ...d, name: labelize(d.name) }))} dataKey="value" nameKey="name" outerRadius={88}>
              {sum.by_category.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
            </Pie>
            <Tooltip formatter={v => inr(v)} />
            <Legend />
          </PieChart>
        </ResponsiveContainer>
      </div>}
    </section>
    <section className="card">
      <h2>Last 3 months</h2>
      <div className="chart">
        <ResponsiveContainer>
          <BarChart data={months}>
            <XAxis dataKey="label" tick={{ fill: '#5E6158', fontSize: 14 }} />
            <YAxis tick={{ fill: '#5E6158', fontSize: 14 }} />
            <Tooltip formatter={v => inr(v)} />
            <Legend />
            <Bar dataKey="income" fill="#496B55" radius={[4, 4, 0, 0]} />
            <Bar dataKey="expense" fill="#C98770" radius={[4, 4, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </div>
    </section>
    <section className="card">
      <h2>Add an entry</h2>
      <form onSubmit={add} className="form-grid cols-4" style={{ marginTop: '.9rem' }}>
        <Field label="Type">
          <select className="field" value={f.kind} onChange={e => setF({ ...f, kind: e.target.value })}>
            <option value="expense">Expense</option>
            <option value="income">Income</option>
          </select>
        </Field>
        <Field label="Category">
          <select className="field" value={f.category} onChange={e => setF({ ...f, category: e.target.value })}>
            {CATS.map(c => <option key={c} value={c}>{labelize(c)}</option>)}
          </select>
          </Field>
        <Field label="Amount">
          <input id="amount" className="field" type="number" inputMode="decimal" min="0" placeholder="0" value={f.amount} onChange={e => setF({ ...f, amount: e.target.value })} />
        </Field>
        <Button type="submit">Add</Button>
      </form>
    </section>
    <section className="card"><h2>Recent entries</h2><div style={{ marginTop: '.4rem' }}><Transactions rows={sum.recent} /></div></section>
    <div><Button variant="danger" onClick={() => setAsk(true)}>Delete all my data</Button></div>
    {ask && <Modal title="Delete all stored entries?" onClose={() => setAsk(false)}>
      <p className="lede">This removes every entry, including demo entries. This cannot be undone.</p>
      <div className="modal-actions">
        <Button variant="danger" onClick={wipe}>Delete everything</Button>
        <Button variant="ghost" onClick={() => setAsk(false)}>Keep my entries</Button>
      </div>
      </Modal>}
  </div>
}
export function Tax() {
  const [f, setF] = useState({ age: '', pension: '', fd: '', other: '' })
  const [res, setRes] = useState(null)
  const [err, setErr] = useState('')
  const go = async e => {
    e.preventDefault(); setErr('')
    try {
      setRes(await api.post('/api/tax/estimate', {
        age: f.age ? +f.age : null, pension_annual: f.pension ? +f.pension : null,
        fd_interest_annual: f.fd ? +f.fd : null, other_income_annual: +f.other || 0,
      }))
    } catch (ex) { setErr('The estimate could not be prepared. ' + ex.message) }
  }
  const L = (t, k) => <Field label={t}><input className="field" type="number" inputMode="numeric" value={f[k]} onChange={e => setF({ ...f, [k]: e.target.value })} /></Field>
  return <section className="card" aria-labelledby="tax-title">
    <h2 id="tax-title">Tax estimate</h2>
    <p className="lede">Illustrative only. Confirm the result on the official income tax website.</p>
    <form onSubmit={go} className="form-grid split" style={{ marginTop: '1rem' }}>
      {L('Your age', 'age')}{L('Pension in a year (₹)', 'pension')}{L('FD interest in a year (₹)', 'fd')}{L('Other income in a year (₹, optional)', 'other')}
      <Button type="submit">Show estimate</Button>
    </form>
    {err && <div style={{ marginTop: '1rem' }}><Notice tone="caution" title="Could not estimate">{err}</Notice></div>}
    {res?.missing && <div style={{ marginTop: '1rem' }}><Notice tone="caution" title="A few details are missing">Please add: {res.missing.join(', ')}.</Notice></div>}
    {res?.new_regime && <div className="stack" style={{ marginTop: '1rem' }}>
      <Notice tone="caution" title={res.status}>Financial year in file: {res.fy}. Verified on: {res.verified_on || 'not yet'}.</Notice>
      <div className="stats">
        <Stat label="New regime tax" value={inr(res.new_regime.tax_with_cess)} note={`Taxable income ${inr(res.new_regime.taxable_income)}`} />
        <Stat label="Old regime tax" value={inr(res.old_regime.tax_with_cess)} note={`Taxable income ${inr(res.old_regime.taxable_income)}`} />
      </div>
      <div>
        <p className="tx-title">Assumptions</p>
        <ul>{res.assumptions.map((a, i) => <li key={i}>{a}</li>)}</ul>
      </div>
      <a href={res.official_link} target="_blank" rel="noreferrer">Official site: incometax.gov.in</a>
    </div>}
  </section>
}
export function Govt() {
  const [err, setErr] = useState('')
  useEffect(() => { api.get('/api/schemes').then(setD).catch(e => setErr(e.message)) }, [])
  return <div className="stack" id="schemes">
    <section className="card">
      <h2>Government schemes</h2>
      <p className="lede">Information from Sahay’s scheme file. Check each official website before you rely on it.</p>
    </section>
    {err && <Notice tone="caution" title="Schemes could not be loaded">{err}</Notice>}
    {!d && !err && <p className="empty">Loading schemes.</p>}
    {d?.schemes.map(s => <article key={s.name} className="card">
      <h3 style={{ fontSize: '1.25rem', fontWeight: 600 }}>{s.name}</h3>
      <p className="muted">{s.level} · {s.category}</p>
      <p style={{ marginTop: '.6rem' }}>{s.summary}</p>
      <dl className="defs" style={{ marginTop: '.9rem' }}>
        {s.eligibility && <div><dt>Who it is for</dt><dd>{s.eligibility}</dd></div>}
        {s.documents && <div><dt>Documents usually needed</dt><dd>{s.documents}</dd></div>}
        {s.how_to_apply && <div><dt>How to apply</dt><dd>{s.how_to_apply}</dd></div>}
      </dl>
      <p className="muted" style={{ marginTop: '.8rem' }}>{s.verified_on ? `Last verified: ${s.verified_on}` : 'Not yet verified. Check the official website before you rely on this.'}</p>
      <p style={{ marginTop: '.45rem' }}><a href={s.official_link} target="_blank" rel="noreferrer">Official website</a></p>
    </article>)}
    {d?.note && <p className="muted">{d.note}</p>}
  </div>
}
export function Safety({ lang, fam, setFam }) {
  const [t, setT] = useState('')
  const [r, setR] = useState(null)
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState('')
  const go = async () => {
    setBusy(true); setErr('')
    try { setR(await api.post('/api/explain', { text: t, lang })) }
    catch (e) { setErr('That message could not be checked. ' + e.message) }
    finally { setBusy(false) }
  }
  const readOut = () => speak([r.risk_label, ...r.flags, ...r.verify_steps].join(' '), lang)
   const shared = [['summary', 'Monthly summary'], ['reminders', 'Important reminders'], ['alerts', 'Safety alerts']].filter(([k]) => fam[k])
  return <div className="stack">
    <PageIntro title="Family and safety">Choose what a trusted person may see, and ask Sahay to explain a message in plain language.</PageIntro>
    <section className="card">
      <h2>Family sharing</h2>
      <p className="lede">Nothing is shared by default, and this choice stays on this device. It is not connected to a family member.</p>
      {shared.length === 0
        ? <p style={{ marginTop: '.8rem' }}>Nothing is shared.</p>
        : <p style={{ marginTop: '.8rem' }}>You have chosen to share: {shared.map(([, l]) => l).join(', ')}. This is still not sent to anyone.</p>}
      <div style={{ marginTop: '.6rem' }}>
        {[['summary', 'Monthly summary'], ['reminders', 'Important reminders'], ['alerts', 'Safety alerts']].map(([k, l]) =>
          <label key={k} className="check"><input type="checkbox" checked={fam[k]} onChange={e => setFam({ ...fam, [k]: e.target.checked })} />{l}</label>)}
      </div>
      <div style={{ marginTop: '.6rem' }}><Button variant="ghost" onClick={() => setFam({ summary: false, reminders: false, alerts: false })}>Stop sharing everything</Button></div>
    </section>
    <section className="card">
      <h2>Explain this message</h2>
      <p className="lede">Paste a bank SMS, notice, or other message. Sahay looks for common warning signs. This is a text check, not a guarantee.</p>
      <div style={{ marginTop: '.9rem' }} className="stack">
        <Field label="Message">
          <textarea value={t} onChange={e => setT(e.target.value)} rows={5} placeholder="Paste the message here" className="field" />
        </Field>
        <div><Button onClick={go} disabled={!t.trim() || busy}>{busy ? 'Checking' : 'Explain it'}</Button></div>
        {err && <Notice tone="caution" title="Could not check the message">{err}</Notice>}
        {r && <div className="stack">
          <Notice tone={r.level ? 'caution' : 'good'} title={r.level ? 'Warning signs found' : 'No common warning signs'}>{r.risk_label}</Notice>
          <p>{r.explanation}</p>
          {r.flags.length > 0 && <div><p className="tx-title">What stood out</p><ul>{r.flags.map((x, i) => <li key={i}>{x}</li>)}</ul></div>}
          <div><p className="tx-title">Safe next steps</p><ol>{r.verify_steps.map((x, i) => <li key={i}>{x}</li>)}</ol></div>
          <p className="muted">{r.disclaimer}</p>
           <div><Button variant="secondary" onClick={readOut}><Volume2 size={18} aria-hidden="true" /> Read aloud</Button></div>
        </div>}
      </div>
    </section>
  </div>
}
export function TransactionsPreview({ rows }) {
  return <Transactions rows={rows} />
}

      