import { useCallback, useEffect, useState } from 'react'
import { api } from './api'
import Talk from './Talk'
import { Finances, Tax, Govt, Safety } from './Pages'
const TABS = [['home', 'Home', '🏠', 'bg-butter'], ['talk', 'Talk to Sahay', '🎙️', 'bg-peach'], ['fin', 'My Finances', '💰', 'bg-mint'],
              ['tax', 'Tax Assistant', '🧾', 'bg-sky'], ['gov', 'Government Guide', '🏛️', 'bg-lilac'], ['safe', 'Safety & Family', '🛡️', 'bg-rose']]
const inr = n => '₹' + Math.round(n).toLocaleString('en-IN')
const Badge = ({ ok, t }) => <span className={`rounded-full px-3 py-1 text-sm font-semibold ${ok ? 'bg-mint' : 'bg-butter'}`}>{ok ? '✅' : '⚠️'} {t}</span>

export default function App() {
  const [tab, setTab] = useState('home'), [lang, setLang] = useState('hinglish'), [sum, setSum] = useState(null), [st, setSt] = useState({}), [big, setBig] = useState(false)
  const refresh = useCallback(() => api.get(`/api/summary?lang=${lang}`).then(setSum).catch(() => {}), [lang])
  useEffect(() => { refresh() }, [refresh])
  useEffect(() => { api.get('/api/status').then(setSt).catch(() => {}) }, [])
  useEffect(() => { document.documentElement.style.setProperty('--fs', big ? '23px' : '19px') }, [big])
  return <div className="mx-auto max-w-3xl space-y-5 p-4 pb-20">
    <header className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="grid h-14 w-14 place-items-center rounded-2xl bg-sun text-3xl shadow">🌼</div>
          <div><h1 className="text-3xl font-extrabold leading-tight">Sahay AI</h1><p className="text-ink-soft text-sm">Your Voice-First Life Assistance Companion</p></div></div>
        <div className="flex gap-2">
          <div className="flex overflow-hidden rounded-2xl border-2 border-peach bg-white">{[['hinglish', 'Hinglish'], ['hi', 'हिन्दी'], ['en', 'English']].map(([k, l]) =>
            <button key={k} onClick={() => setLang(k)} className={`px-3 py-2 font-bold ${lang === k ? 'bg-sun' : ''}`}>{l}</button>)}</div>
          <button onClick={() => setBig(!big)} className="btn bg-white border-2 border-peach !min-h-0 !px-4" aria-label="Larger text">A+</button></div></div>
      <div className="flex flex-wrap gap-2">
        <Badge ok={st.gnani} t={st.gnani ? `Gnani voice key set` : 'Gnani voice: not configured'} />
        <Badge ok={st.llm} t={st.llm ? 'AI explainer on' : 'AI explainer off (basic mode)'} />
        <Badge ok={st.rag_verified > 0} t={`Fact file: ${st.rag_total ?? 0} entries, ${st.rag_verified ?? 0} verified`} /></div>
      <nav className="grid grid-cols-2 gap-3 sm:grid-cols-3">{TABS.map(([k, l, i, c]) =>
        <button key={k} onClick={() => setTab(k)} className={`btn flex items-center justify-center gap-2 ${tab === k ? 'bg-sun ring-4 ring-ink/20' : c}`}><span className="text-2xl">{i}</span>{l}</button>)}</nav></header>
    <main>
      {tab === 'home' && <div className="space-y-5">
        <h2 className="text-3xl font-extrabold">{lang === 'en' ? 'Hello!' : 'Namaste!'} 🙏</h2>
        <button onClick={() => setTab('talk')} className="btn w-full !rounded-3xl bg-gradient-to-br from-sun to-peach !py-8 text-3xl shadow-lg">🎙️ Talk to Sahay<span className="block text-base font-semibold text-ink-soft">Speak. Understand. Decide.</span></button>
        {sum && <div className="grid grid-cols-3 gap-3 text-center">{[['Income', sum.income, 'bg-mint'], ['Expenses', sum.expense, 'bg-peach'], ['Balance', sum.balance, 'bg-butter']].map(([l, v, c]) =>
          <div key={l} className={`rounded-3xl p-4 shadow ${c}`}><p className="font-semibold">{l}</p><p className="text-xl font-extrabold">{inr(v)}</p></div>)}</div>}
        {sum && <p className="text-sm text-ink-soft">This includes {sum.demo_count} DEMO entries.</p>}
        <div className="card !bg-sky/60"><p className="text-lg font-extrabold">🔔 Reminders (DEMO)</p><p>Electricity bill due soon · Medicine refill this week</p></div>
        <div className="card"><p className="mb-2 text-lg font-extrabold">Recent activity</p>{sum?.recent.slice(0, 4).map(r =>
          <p key={r.id} className="text-lg">{r.date} · {r.category.replace('_', ' ')} · <b>{inr(r.amount)}</b></p>)}</div></div>}
      {tab === 'talk' && <Talk key={lang} lang={lang} onSaved={refresh} />}
      {tab === 'fin' && <Finances sum={sum} onChange={refresh} />}
      {tab === 'tax' && <Tax />}{tab === 'gov' && <Govt />}{tab === 'safe' && <Safety lang={lang} />}
    </main></div>
}
