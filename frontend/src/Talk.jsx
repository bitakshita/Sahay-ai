import { useRef, useState } from 'react'
import { api } from './api'
import { Recorder, transcribe, speak } from './voice'
const GREET = { hinglish: 'Namaste! Main Sahay hoon. Mic dabakar boliye.', hi: 'नमस्ते! मैं सहाय हूं। माइक दबाकर बोलिए।', en: 'Hello! I am Sahay. Press the mic and speak.' }
const Btn = ({ c = 'bg-sun', ...p }) => <button {...p} className={`btn ${c}`} />

export default function Talk({ lang, onSaved }) {
  const [msgs, setMsgs] = useState([{ r: 'bot', t: GREET[lang] }])
  const [pending, setPending] = useState([]), [rec, setRec] = useState(false), [busy, setBusy] = useState(false)
  const [text, setText] = useState(''), [engine, setEngine] = useState(''), [err, setErr] = useState('')
  const R = useRef(new Recorder())
  const last = [...msgs].reverse().find(m => m.r === 'bot')?.t
  const say = async (t, slow) => setEngine(await speak(t, lang, slow))

  async function send(m) {
    if (!m.trim()) return
    setMsgs(x => [...x, { r: 'me', t: m }]); setBusy(true); setErr('')
    try {
      const res = await api.post('/api/chat', { message: m, lang })
      setMsgs(x => [...x, { r: 'bot', t: res.reply, src: res.sources }]); setPending(res.transactions || []); await say(res.reply)
    } catch (e) { setErr('Something went wrong: ' + e.message) } finally { setBusy(false) }
  }
  async function stopAndSend() {
    setRec(false); setBusy(true); setErr('')
    try {
      const out = await transcribe(await R.current.stop(), lang)
      if (!out.transcript) { setErr('I could not hear anything. Please try again.'); setBusy(false); return }
      setBusy(false); await send(out.transcript)
    } catch (e) { setBusy(false); setErr('Voice error (Gnani): ' + e.message) }
  }
  async function toggle() {
    if (rec) return stopAndSend()
    try { await R.current.start(stopAndSend); setRec(true); setErr('') } catch { setErr('Microphone permission is needed.') }
  }
  async function save() {
    await api.post('/api/transactions', { items: pending, source: 'voice' }); setPending([]); onSaved()
    const t = { hinglish: 'Save ho gaya.', hi: 'सेव हो गया।', en: 'Saved.' }[lang]; setMsgs(x => [...x, { r: 'bot', t }]); say(t)
  }
  return <div className="space-y-5">
    <div className="card min-h-64 space-y-3" aria-live="polite">
      {msgs.map((m, i) => <div key={i}>
        <p className={`rounded-3xl p-4 text-xl ${m.r === 'me' ? 'ml-8 bg-butter' : 'mr-8 bg-sky/70'}`}>{m.t}</p>
        {m.src?.map(s => <a key={s.link + s.title} href={s.link} target="_blank" rel="noreferrer" className="mr-8 mt-1 block text-sm font-semibold text-blue-800 underline">
          Source: {s.title} · verified: {s.verified_on || 'not yet'}</a>)}</div>)}
    </div>
    {pending.length > 0 && <div className="card !border-sun-deep">
      <p className="text-lg font-extrabold">Please confirm before saving:</p>
      {pending.map((t, i) => <p key={i} className="text-xl">₹{t.amount.toLocaleString('en-IN')} — {t.category.replace('_', ' ')} ({t.kind})</p>)}
      <div className="mt-3 flex gap-3"><Btn c="bg-mint" onClick={save}>✅ Save</Btn><Btn c="bg-peach" onClick={() => setPending([])}>❌ Cancel</Btn></div></div>}
    <div className="flex flex-col items-center gap-3">
      <button onClick={toggle} disabled={busy} aria-label={rec ? 'Stop recording' : 'Start speaking'}
        className={`h-36 w-36 rounded-full text-6xl shadow-xl ring-8 ring-white disabled:opacity-50 ${rec ? 'animate-pulse bg-coral text-white' : 'bg-gradient-to-br from-sun to-sun-deep'}`}>{rec ? '⏹' : '🎙️'}</button>
      <p className="text-xl font-bold">{busy ? 'Please wait…' : rec ? 'Listening… tap to stop' : 'Tap and speak'}</p>
      <div className="flex flex-wrap justify-center gap-3">
        <Btn c="bg-lilac" onClick={() => say(last)}>🔁 Repeat</Btn><Btn c="bg-lilac" onClick={() => say(last, true)}>🐢 Slowly</Btn>
        <Btn c="bg-mint" onClick={() => say(GREET[lang])}>🔊 Test voice</Btn></div>
      {engine && <p className="text-sm text-ink-soft">Voice engine used: <b>{engine}</b></p>}
    </div>
    <form onSubmit={e => { e.preventDefault(); send(text); setText('') }} className="flex gap-2">
      <input value={text} onChange={e => setText(e.target.value)} placeholder="Or type here…" className="field flex-1" />
      <Btn type="submit" disabled={busy}>Send</Btn></form>
    {err && <p className="rounded-2xl bg-rose p-4 font-semibold">{err}</p>}
  </div>
}
