import { useEffect, useRef, useState } from 'react'
import { Mic, Square, RotateCcw, Gauge, Volume2 } from 'lucide-react'
import { api } from './api'
import { Recorder, transcribe, speak, stopSpeaking, onSpeakingEnd } from './voice'
import { Button, LanguageSwitch, Notice } from './ui'
const GREET = {
  hinglish: 'Namaste. Main Sahay hoon. Mic dabakar boliye.',
  hi: 'नमस्ते। मैं सहाय हूँ। माइक दबाकर बोलिए।',
  en: 'Hello. I am Sahay. Press the microphone and speak.',
}
const PHASE = {
  ready: 'Ready. Press the microphone and speak.',
  listening: 'Listening. Press stop when you finish.',
  processing: 'Working on what you said.',
  speaking: 'Sahay is speaking.',
}
const thread = {}
export default function Talk({ lang, setLang, onSaved, heading = 'Voice assistant' }) {
  const saved = thread[lang]
  const [msgs, setMsgs] = useState(saved?.msgs || [{ r: 'bot', t: GREET[lang] }])
  const [pending, setPending] = useState(saved?.pending || [])
  const [phase, setPhase] = useState('ready')
  const [text, setText] = useState('')
  const [engine, setEngine] = useState('')
  const [err, setErr] = useState('')
  const R = useRef(new Recorder())
  const box = useRef(null)
  const stopping = useRef(false)
  const last = [...msgs].reverse().find(m => m.r === 'bot')?.t
   useEffect(() => { thread[lang] = { msgs, pending } }, [lang, msgs, pending])
  useEffect(() => { if (box.current) box.current.scrollTop = box.current.scrollHeight }, [msgs, pending])
  useEffect(() => {
    const off = onSpeakingEnd(() => setPhase(p => (p === 'speaking' ? 'ready' : p)))
    const rec = R.current
    return () => { off(); rec.cancel(); stopSpeaking() }
  }, [])
  async function say(t, slow) {
    if (!t) { setPhase('ready'); return }
    setPhase('speaking')
    const used = await speak(t, lang, slow)
    if (used !== 'cancelled') setEngine(used)
  }
  async function send(m) {
    if (!m.trim() || phase === 'processing') return
    setMsgs(x => [...x, { r: 'me', t: m }])
    setPhase('processing'); setErr('')
    try {
      const res = await api.post('/api/chat', { message: m, lang })
         setMsgs(x => [...x, { r: 'bot', t: res.reply, src: res.sources }])
      setPending(res.transactions || [])
      await say(res.reply)
    } catch (e) {
      setErr('Something went wrong: ' + e.message)
      setPhase('ready')
    }
  }
  async function stopAndSend() {
     if (stopping.current) return
    stopping.current = true
    setPhase('processing'); setErr('')
    try {
      const out = await transcribe(await R.current.stop(), lang)
      if (!out.transcript) {
        setErr('I could not hear anything. Please try again.')
        setPhase('ready')
        return
      }
      await send(out.transcript)
    } catch (e) {
      setPhase('ready')
      setErr('Voice error (Gnani): ' + e.message)
    } finally { stopping.current = false }
  }
  
  async function onMic() {
    if (phase === 'processing') return
    if (phase === 'speaking') { stopSpeaking(); setPhase('ready'); return }
    if (phase === 'listening') return stopAndSend()
    try { await R.current.start(stopAndSend); setPhase('listening'); setErr('') }
    catch { setErr('Microphone permission is needed. Allow the microphone, then try again.') }
  }
  async function save() {
    await api.post('/api/transactions', { items: pending, source: 'voice' })
    setPending([]); onSaved()
    const t = { hinglish: 'Save ho gaya.', hi: 'सेव हो गया।', en: 'Saved.' }[lang]
    setMsgs(x => [...x, { r: 'bot', t }]); say(t)
  }
  const locked = phase === 'processing' || phase === 'listening'
  const micLabel = phase === 'listening' ? 'Stop and send' : phase === 'speaking' ? 'Stop speaking' : 'Start speaking'
  return <section className="card voice-card" aria-labelledby={heading ? 'voice-heading' : 'page-title'}>
    <div className="voice-top">
      <div>
        {heading && <h2 id="voice-heading">{heading}</h2>}
        <p className="phase" role="status">{PHASE[phase]}</p>
      </div>
      {setLang && <LanguageSwitch lang={lang} setLang={setLang} />}
    </div>
     <div className="transcript" ref={box} aria-live="polite">
      {msgs.map((m, i) => <div key={i} className={`bubble ${m.r === 'me' ? 'me' : ''}`}>
        <p className="who">{m.r === 'me' ? 'You' : 'Sahay'}</p>
        <p>{m.t}</p>
        {m.src?.map(s => <a key={s.link + s.title} href={s.link} target="_blank" rel="noreferrer" className="source">
          Source: {s.title}. Verified: {s.verified_on || 'not yet'}.
        </a>)}
      </div>)}
    </div>
     {pending.length > 0 && <Notice tone="caution" title="Please confirm before saving">
      {pending.map((t, i) => <p key={i}>₹{t.amount.toLocaleString('en-IN')} — {String(t.category).replaceAll('_', ' ')} ({t.kind})</p>)}
      <div className="mic-actions" style={{ marginTop: '.8rem' }}>
        <Button onClick={save}>Save</Button>
        <Button variant="ghost" onClick={() => setPending([])}>Cancel</Button>
      </div>
    </Notice>}
    <div className="mic-wrap">
      <button type="button" className={`mic ${phase === 'listening' ? 'is-listening' : ''} ${phase === 'speaking' ? 'is-speaking' : ''}`}
        onClick={onMic} disabled={phase === 'processing'} aria-label={micLabel} aria-pressed={phase === 'listening'}>
        {phase === 'listening' || phase === 'speaking' ? <Square size={32} strokeWidth={1.75} aria-hidden="true" /> : <Mic size={36} strokeWidth={1.75} aria-hidden="true" />}
      </button>
      <p>{micLabel}</p>
      <div className="mic-actions">
        <Button variant="secondary" onClick={() => say(last)} disabled={!last || locked}><RotateCcw size={18} aria-hidden="true" /> Repeat</Button>
        <Button variant="secondary" onClick={() => say(last, true)} disabled={!last || locked}><Gauge size={18} aria-hidden="true" /> Slowly</Button>
        <Button variant="ghost" onClick={() => say(GREET[lang])} disabled={locked}><Volume2 size={18} aria-hidden="true" /> Test voice</Button>
      </div>
      {engine && <p className="muted">Voice: {engine === 'Gnani Timbre' ? 'Gnani Timbre' : 'browser voice, not Gnani'}.</p>}
    </div>
    <form className="composer" onSubmit={e => { e.preventDefault(); send(text); setText('') }}>
      <label className="sr-only" htmlFor="typed">Type a message</label>
      <input id="typed" value={text} onChange={e => setText(e.target.value)} placeholder="Or type here" className="field" />
      <Button type="submit" disabled={locked || !text.trim()}>Send</Button>
    </form>
    {err && <Notice tone="caution" title="Please try again">{err}</Notice>}
  </section>
}