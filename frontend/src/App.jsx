import { useCallback, useEffect, useState } from 'react'
import { ArrowDownLeft, ArrowUpRight, CircleAlert, CircleCheck, Home, Landmark, Mic, Settings, Users, Wallet } from 'lucide-react'
import { api } from './api'
import Talk from './Talk'
import { Finances, Govt, Safety, Tax, TransactionsPreview } from './Pages'
import { Button, LanguageSwitch, Notice, PageIntro, Stat, inr } from './ui'
const NAV = [
  ['home', 'Home', Home],
  ['talk', 'Voice', Mic],
  ['fin', 'Finances', Wallet],
  ['tax', 'Taxes and schemes', Landmark],
  ['safe', 'Family and safety', Users],
  ['settings', 'Settings', Settings],
]
function greeting(lang) {
  const h = new Date().getHours()
  const part = h < 12 ? 'morning' : h < 17 ? 'afternoon' : 'evening'
  const copy = {
    en: { morning: 'Good morning.', afternoon: 'Good afternoon.', evening: 'Good evening.', help: 'How can I help you today?', sub: 'Your personal assistant for everyday finances and important decisions.' },
    hi: { morning: 'सुप्रभात।', afternoon: 'नमस्कार।', evening: 'शुभ संध्या।', help: 'आज मैं आपकी कैसे मदद कर सकता हूँ?', sub: 'रोजमर्रा के वित्त और महत्वपूर्ण फैसलों के लिए आपका निजी सहायक।' },
    hinglish: { morning: 'Good morning.', afternoon: 'Good afternoon.', evening: 'Good evening.', help: 'Aaj main aapki kaise madad kar sakta hoon?', sub: 'Rozmarra ke finances aur zaroori faislon ke liye aapka personal assistant.' },
  }
  const c = copy[lang] || copy.hinglish
  return { hello: c[part], help: c.help, sub: c.sub }
}
function StatusList({ st }) {
  if (!st || !Object.keys(st).length) return <p className="empty">Checking services.</p>
  const rows = [
    [!!st.gnani, st.gnani ? 'Voice service is ready' : 'Voice service is not configured', st.gnani ? 'Gnani can listen and speak.' : 'Speech uses the browser voice until a Gnani key is set.'],
    [!!st.llm, st.llm ? 'Explainer is available' : 'Explainer is in basic mode', st.llm ? 'Answers can use the language model.' : 'Answers use the built-in explanations.'],
    [(st.rag_verified ?? 0) > 0, `Fact file: ${st.rag_total ?? 0} entries`, `${st.rag_verified ?? 0} verified.`],
  ]
  return <div className="status-list">{rows.map(([ok, title, detail]) => <div key={title} className={`status-row ${ok ? '' : 'warn'}`}>
    {ok ? <CircleCheck size={22} aria-hidden="true" /> : <CircleAlert size={22} aria-hidden="true" />}
    <div><p className="tx-title">{ok ? 'Ready' : 'Needs attention'} · {title}</p><p className="muted">{detail}</p></div>
  </div>)}</div>
}
export default function App() {
  const [tab, setTab] = useState('home')
  const [lang, setLang] = useState('hinglish')
  const [sum, setSum] = useState(null)
  const [sumErr, setSumErr] = useState('')
  const [st, setSt] = useState({})
  const [big, setBig] = useState(false)
  const [preset, setPreset] = useState(null)
  const [fam, setFam] = useState({ summary: false, reminders: false, alerts: false })
  const refresh = useCallback(() => {
    api.get(`/api/summary?lang=${lang}`).then(s => { setSum(s); setSumErr('') }).catch(() => setSumErr('Your finances could not be loaded. Check that Sahay is running, then try again.'))
  }, [lang])
  useEffect(() => { refresh() }, [refresh])
  useEffect(() => { api.get('/api/status').then(setSt).catch(() => {}) }, [])
    useEffect(() => {
    const name = NAV.find(([id]) => id === tab)?.[1] || 'Sahay'
    document.title = `${name} · Sahay`
    document.getElementById('main')?.scrollTo?.({ top: 0 })
    window.scrollTo({ top: 0 })
  }, [tab])
  const g = greeting(lang)
  const openFin = kind => { setPreset({ kind, n: Date.now() }); setTab('fin') }
  const openSchemes = () => { setTab('tax'); setTimeout(() => document.getElementById('schemes')?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 60) }
  const shared = [['summary', 'Monthly summary'], ['reminders', 'Important reminders'], ['alerts', 'Safety alerts']].filter(([k]) => fam[k]).map(([, l]) => l)
  const actions = [
    ['Add income', 'Record money received', ArrowDownLeft, () => openFin('income')],
    ['Add expense', 'Record money spent', ArrowUpRight, () => openFin('expense')],
    ['Family sharing', 'Choose what can be shared', Users, () => setTab('safe')],
    ['Understand taxes', 'See an illustrative estimate', Landmark, () => setTab('tax')],
    ['Government schemes', 'Read official scheme notes', Landmark, openSchemes],
    ['Ask Sahay', 'Speak or type a question', Mic, () => setTab('talk')],
  ]
 const nav = label => <nav className={label} aria-label="Sections">
    {NAV.map(([id, name, Icon]) => <button key={id} type="button" className="nav-item" aria-current={tab === id ? 'page' : undefined} onClick={() => setTab(id)}>
      <Icon size={20} strokeWidth={1.75} aria-hidden="true" />{name}
    </button>)}
  </nav>
  return <div className="app">
    <a className="skip" href="#main">Skip to content</a>
    <aside className="sidebar">
      <div className="brand"><div className="mark" aria-hidden="true">S</div><div><p className="brand-name">Sahay</p><p className="brand-sub">Personal companion</p></div></div>
      {nav('nav')}
      <div className="sidebar-foot"><Button variant="ghost" onClick={() => setBig(b => !b)} aria-pressed={big}>{big ? 'Standard text' : 'Larger text'}</Button></div>
    </aside>
    <div className="column">
      <header className="topbar">
<div className="brand" style={{ padding: 0 }}><div className="mark" aria-hidden="true">S</div><div><p className="brand-name">Sahay</p><p className="brand-sub">Personal companion</p></div></div>
        <Button variant="ghost" onClick={() => setBig(b => !b)} aria-pressed={big}>{big ? 'Standard text' : 'Larger text'}</Button>
      </header>
      {nav('mobile-nav')}
      <main id="main" className="workspace">
        {tab === 'home' && <div className="home-grid">
          <header className="welcome span-all">
            <h1>{g.hello}</h1>
            <p className="lede" style={{ fontSize: '1.2rem', color: 'var(--color-ink)' }}>{g.help}</p>
            <p className="lede">{g.sub}</p>
          </header>
           <Talk key={lang} lang={lang} setLang={setLang} onSaved={refresh} />
          <div className="stack">
            <section className="card" aria-labelledby="quick-title">
              <h2 id="quick-title">Quick actions</h2>
              <div className="qa-grid" style={{ marginTop: '.85rem' }}>
                {actions.map(([label, hint, Icon, go]) => <button key={label} type="button" className="qa" onClick={go}>
                  <Icon size={22} strokeWidth={1.75} aria-hidden="true" />
                  <span><span className="qa-label">{label}</span><span className="qa-hint">{hint}</span></span>
                </button>)}
              </div>
            </section>
            <section className="card" aria-labelledby="family-title">
              <div className="section-head"><h2 id="family-title">Family</h2><button type="button" className="btn btn-ghost" onClick={() => setTab('safe')}>Manage</button></div>
              <p>{shared.length ? `You have chosen to share: ${shared.join(', ')}.` : 'Nothing is shared.'}</p>
              <p className="muted">This stays on this device. It is not sent to a family member.</p>
            </section>
          </div>
          <section className="card span-all" aria-labelledby="money-title">
            <div className="section-head"><h2 id="money-title">This month</h2><button type="button" className="btn btn-ghost" onClick={() => setTab('fin')}>Review finances</button></div>
            {sumErr && <Notice tone="caution" title="Finances are unavailable">{sumErr} <button type="button" className="btn btn-ghost" onClick={refresh}>Try again</button></Notice>}
            {!sum && !sumErr && <p className="empty">Loading your finances.</p>}
            {sum && <>
              <div className="stats">
<Stat label="Total income" value={inr(sum.income)} note="This month" />
                <Stat label="Total expenses" value={inr(sum.expense)} note="This month" />
                <Stat label="Available balance" value={inr(sum.balance)} note="Income minus expenses" />
              </div>
              {sum.insight && <div style={{ marginTop: '1rem' }}><Notice title="A note from your entries">{sum.insight}</Notice></div>}
              <p className="muted" style={{ marginTop: '.8rem' }}>{sum.demo_count} demo entries · {sum.recorded_count} entries recorded by you.</p>
              <h3 style={{ marginTop: '1.1rem', fontSize: '1.15rem', fontWeight: 600 }}>Recent transactions</h3>
              <TransactionsPreview rows={sum.recent.slice(0, 4)} />
            </>}
            </section>
          <section className="card span-all" aria-labelledby="remind-title">
            <h2 id="remind-title">Sample reminders</h2>
            <ul><li>Electricity bill due soon</li><li>Medicine refill this week</li></ul>
            <p className="muted">Demo notes only. Sahay is not tracking these bills.</p>
          </section>
        </div>}
        {tab === 'talk' && <div className="stack">
          <PageIntro title="Voice assistant">Press the microphone and speak in Hinglish, Hindi, or English.</PageIntro>
          <Talk key={lang} lang={lang} setLang={setLang} onSaved={refresh} heading="" />
        </div>}
         {tab === 'fin' && <div className="stack">
          {!sum && !sumErr && <p className="empty">Loading your finances.</p>}
          {!sum && sumErr && <>
            <PageIntro title="My finances">Income, expenses, and balance from the entries Sahay already stores.</PageIntro>
            <Notice tone="caution" title="Finances are unavailable">{sumErr}</Notice>
            <div><Button variant="ghost" onClick={refresh}>Try again</Button></div>
          </>}
          {sum && <Finances sum={sum} onChange={refresh} preset={preset} />}
        </div>}
        {tab === 'tax' && <div className="stack">
          <PageIntro title="Taxes and schemes">An illustrative tax estimate, then the government schemes already in Sahay’s file.</PageIntro>
          <p>You can also ask by voice: “FD ke interest par tax lagta hai kya?”</p>
          <Tax />
          <Govt />
        </div>}
        {tab === 'safe' && <Safety lang={lang} fam={fam} setFam={setFam} />}
        {tab === 'settings' && <div className="stack">

        <PageIntro title="Settings">Language, text size, and the status of Sahay’s services.</PageIntro>
          <section className="card"><h2>Language</h2><p className="lede">Used for the voice assistant and monthly insight.</p><div style={{ marginTop: '.8rem' }}><LanguageSwitch lang={lang} setLang={setLang} /></div></section>
          <section className="card"><h2>Text size</h2><p className="lede">Larger text is easier to read. It applies across Sahay.</p><div style={{ marginTop: '.8rem' }}><Button variant={big ? 'primary' : 'secondary'} onClick={() => setBig(b => !b)} aria-pressed={big}>{big ? 'Using larger text' : 'Use larger text'}</Button></div></section>
          <section className="card"><h2>Services</h2><div style={{ marginTop: '.8rem' }}><StatusList st={st} /></div></section>
        </div>}
      </main>
    </div>
  </div>
}
