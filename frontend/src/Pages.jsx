import { useEffect, useState } from 'react'
import { PieChart, Pie, Cell, Tooltip, BarChart, Bar, XAxis, YAxis, Legend, ResponsiveContainer } from 'recharts'
import { api } from './api'
import { speak } from './voice'
const COLORS = ['#F5A524', '#4FB286', '#8E7CC3', '#E8707E', '#5AA9E6', '#9BC53D', '#A08C7D']
const inr = n => '₹' + Math.round(n).toLocaleString('en-IN')
const Card = ({ title, children }) => <section className="card space-y-3"><h2 className="text-2xl font-extrabold">{title}</h2>{children}</section>
const Btn = ({ c = 'bg-sun', ...p }) => <button {...p} className={`btn ${c}`} />
const Inp = p => <input {...p} className="field" />

export function Finances({ sum, onChange }) {
  const [f, setF] = useState({ kind: 'expense', category: 'groceries', amount: '' })
  if (!sum) return null
  const add = async e => { e.preventDefault(); if (!+f.amount) return; await api.post('/api/transactions', { items: [{ ...f, amount: +f.amount }], source: 'manual' }); setF({ ...f, amount: '' }); onChange() }
  return <div className="space-y-4">
    <Card title="This month">
      <p className="text-xl">Income {inr(sum.income)} · Expenses {inr(sum.expense)} · Balance <b>{inr(sum.balance)}</b></p>
      {sum.insight && <p className="rounded-xl bg-butter/60 p-3 text-lg">💡 {sum.insight}</p>}
      <p className="text-sm text-slate-600">{sum.demo_count} DEMO entries · {sum.recorded_count} entries recorded by you. Insights compare entries of both kinds.</p></Card>
    <Card title="Expenses by category">
      <div className="h-64"><ResponsiveContainer><PieChart><Pie data={sum.by_category} dataKey="value" nameKey="name" label={e => e.name}>
        {sum.by_category.map((_, i) => <Cell key={i} fill={COLORS[i % 7]} />)}</Pie><Tooltip formatter={v => inr(v)} /></PieChart></ResponsiveContainer></div></Card>
    <Card title="Last 3 months"><div className="h-64"><ResponsiveContainer><BarChart data={sum.monthly}><XAxis dataKey="month" /><YAxis /><Tooltip formatter={v => inr(v)} /><Legend />
      <Bar dataKey="income" fill="#4FB286" /><Bar dataKey="expense" fill="#F5A524" /></BarChart></ResponsiveContainer></div></Card>
    <Card title="Add an entry"><form onSubmit={add} className="grid gap-3 sm:grid-cols-4">
      <select className="field" value={f.kind} onChange={e => setF({ ...f, kind: e.target.value })}><option value="expense">Expense</option><option value="income">Income</option></select>
      <select className="field" value={f.category} onChange={e => setF({ ...f, category: e.target.value })}>
        {['pension', 'fd_interest', 'rental', 'family_support', 'groceries', 'healthcare', 'utilities', 'household', 'transport', 'recurring', 'other'].map(c => <option key={c}>{c}</option>)}</select>
      <Inp type="number" inputMode="numeric" placeholder="Amount ₹" value={f.amount} onChange={e => setF({ ...f, amount: e.target.value })} /><Btn type="submit">Add</Btn></form></Card>
    <Card title="Recent entries">{sum.recent.map(r => <p key={r.id} className="text-lg">{r.date} · {r.category.replace('_', ' ')} · {r.kind === 'income' ? '+' : '−'}{inr(r.amount)} {r.source === 'demo' && <span className="rounded bg-peach px-2 text-sm">DEMO</span>}</p>)}</Card>
    <Btn c="bg-rose" onClick={async () => { if (confirm('Delete ALL stored entries (including demo)?')) { await api.del('/api/transactions'); onChange() } }}>🗑️ Delete all my data</Btn>
  </div>
}

export function Tax() {
  const [f, setF] = useState({ age: '', pension: '', fd: '', other: '' }), [res, setRes] = useState(null)
  const go = async e => { e.preventDefault()
    setRes(await api.post('/api/tax/estimate', { age: f.age ? +f.age : null, pension_annual: f.pension ? +f.pension : null, fd_interest_annual: f.fd ? +f.fd : null, other_income_annual: +f.other || 0 })) }
  const L = (t, k) => <label className="block"><span className="text-lg">{t}</span><Inp type="number" inputMode="numeric" value={f[k]} onChange={e => setF({ ...f, [k]: e.target.value })} /></label>
  return <div className="space-y-4"><Card title="Tax estimate (illustrative)"><form onSubmit={go} className="space-y-3">
    {L('Your age', 'age')}{L('Pension in a year (₹)', 'pension')}{L('FD interest in a year (₹)', 'fd')}{L('Other income in a year (₹, optional)', 'other')}<Btn type="submit">Show estimate</Btn></form>
    {res?.missing && <p className="rounded-xl bg-butter p-3 text-lg">I need a bit more information first: {res.missing.join(', ')}.</p>}
    {res?.new_regime && <div className="space-y-2 text-lg">
      <p className="rounded-xl bg-red-100 p-3 text-red-900">⚠️ {res.status}. Financial year in file: {res.fy}. Verified on: {res.verified_on || 'not yet'}.</p>
      <p>New regime: taxable {inr(res.new_regime.taxable_income)} → tax about <b>{inr(res.new_regime.tax_with_cess)}</b></p>
      <p>Old regime: taxable {inr(res.old_regime.taxable_income)} → tax about <b>{inr(res.old_regime.tax_with_cess)}</b></p>
      <ul className="list-disc pl-6 text-base">{res.assumptions.map((a, i) => <li key={i}>{a}</li>)}</ul>
      <a className="text-blue-700 underline" href={res.official_link} target="_blank" rel="noreferrer">Official: incometax.gov.in</a></div>}</Card>
    <p className="text-lg">You can also ask by voice in <b>Talk to Sahay</b>: “FD ke interest par tax lagta hai kya?”</p></div>
}

export function Govt() {
  const [d, setD] = useState(null); useEffect(() => { api.get('/api/schemes').then(setD) }, [])
  return <div className="space-y-4">{d?.schemes.map(s => <Card key={s.name} title={s.name}>
    <p className="text-lg">{s.summary}</p><p>{s.level} · {s.category}</p>
    <p className="text-sm">Last verified: {s.verified_on || 'NOT YET VERIFIED — check the official site'}</p>
    <a className="text-blue-700 underline text-lg" href={s.official_link} target="_blank" rel="noreferrer">Official website</a></Card>)}
    <p className="text-sm text-slate-600">{d?.note}</p></div>
}

export function Safety({ lang }) {
  const [t, setT] = useState(''), [r, setR] = useState(null), [busy, setBusy] = useState(false)
  const [fam, setFam] = useState({ summary: false, reminders: false, alerts: false })
  const go = async () => { setBusy(true); try { setR(await api.post('/api/explain', { text: t, lang })) } finally { setBusy(false) } }
  const readOut = () => speak([r.risk_label, ...r.flags, ...r.verify_steps].join(' '), lang)
  return <div className="space-y-4">
    <Card title="Explain this message to me">
      <textarea value={t} onChange={e => setT(e.target.value)} rows={5} placeholder="Paste the bank SMS, notice or message here…" className="field" />
      <Btn onClick={go} disabled={!t.trim() || busy}>{busy ? 'Checking…' : 'Explain it'}</Btn>
      {r && <div className="space-y-3 text-lg">
        <p className={`rounded-xl p-3 font-semibold ${r.level ? 'bg-rose' : 'bg-mint'}`}>{r.risk_label}</p>
        <p>{r.explanation}</p>
        {r.flags.length > 0 && <ul className="list-disc pl-6">{r.flags.map((x, i) => <li key={i}>{x}</li>)}</ul>}
        <p className="font-bold">Safe next steps</p><ol className="list-decimal pl-6">{r.verify_steps.map((x, i) => <li key={i}>{x}</li>)}</ol>
        <p className="text-sm text-slate-600">{r.disclaimer}</p><Btn c="bg-peach" onClick={readOut}>🔊 Read aloud</Btn></div>}</Card>
    <Card title="Family Connect (DEMO — not connected to anyone)">
      <p className="text-lg">You decide what a trusted family member can see. Nothing is shared by default.</p>
      {[['summary', 'Monthly summary'], ['reminders', 'Important reminders'], ['alerts', 'Safety alerts']].map(([k, l]) =>
        <label key={k} className="flex items-center gap-3 text-xl"><input type="checkbox" className="h-7 w-7" checked={fam[k]} onChange={e => setFam({ ...fam, [k]: e.target.checked })} />{l}</label>)}
      <Btn c="bg-peach" onClick={() => setFam({ summary: false, reminders: false, alerts: false })}>Stop sharing everything</Btn></Card></div>
}
