// Gnani STT accepts WAV/MP3/OGG/FLAC/AAC/M4A (not WebM) and max 30 s, so we record, then convert to 16 kHz mono WAV here.
async function toWav(audio) {
  const off = new OfflineAudioContext(1, Math.ceil(audio.duration * 16000), 16000)
  const src = off.createBufferSource(); src.buffer = audio; src.connect(off.destination); src.start()
  const data = (await off.startRendering()).getChannelData(0)
  const buf = new ArrayBuffer(44 + data.length * 2), v = new DataView(buf)
  const w = (o, s) => [...s].forEach((c, i) => v.setUint8(o + i, c.charCodeAt(0)))
  w(0, 'RIFF'); v.setUint32(4, 36 + data.length * 2, true); w(8, 'WAVEfmt '); v.setUint32(16, 16, true)
  v.setUint16(20, 1, true); v.setUint16(22, 1, true); v.setUint32(24, 16000, true); v.setUint32(28, 32000, true)
  v.setUint16(32, 2, true); v.setUint16(34, 16, true); w(36, 'data'); v.setUint32(40, data.length * 2, true)
  data.forEach((s, i) => v.setInt16(44 + i * 2, Math.max(-1, Math.min(1, s)) * 0x7fff, true))
  return new Blob([buf], { type: 'audio/wav' })
}
export class Recorder {
  async start(onLimit) {
    this.stream = await navigator.mediaDevices.getUserMedia({ audio: true })
    this.chunks = []; this.mr = new MediaRecorder(this.stream)
    this.mr.ondataavailable = e => this.chunks.push(e.data); this.mr.start()
    this.timer = setTimeout(() => onLimit?.(), 28000)
  }
  stop() {
    return new Promise(res => {
      clearTimeout(this.timer)
      this.mr.onstop = async () => {
        this.stream.getTracks().forEach(t => t.stop())
        const ctx = new AudioContext()
        const audio = await ctx.decodeAudioData(await new Blob(this.chunks).arrayBuffer())
        ctx.close(); res(await toWav(audio))
      }
      this.mr.stop()
    })
  }
}
export async function transcribe(blob, lang) {
  const f = new FormData(); f.append('audio', blob, 'speech.wav')
  f.append('language_code', lang === 'en' ? 'en-IN' : 'hi-IN,en-IN')
  const r = await fetch('/api/voice/stt', { method: 'POST', body: f })
  if (!r.ok) throw new Error((await r.text()).slice(0, 200))
  return r.json()
}
let cur
// Returns the engine actually used, so the UI never mislabels browser speech as Gnani.
export async function speak(text, lang, slow = false) {
  cur?.pause(); speechSynthesis.cancel()
  try {
    const r = await fetch('/api/voice/tts', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ text, lang, slow }) })
    if (!r.ok) throw new Error('tts ' + r.status)
    cur = new Audio(URL.createObjectURL(await r.blob())); await cur.play(); return 'Gnani Timbre'
  } catch {
    const u = new SpeechSynthesisUtterance(text); u.lang = lang === 'en' ? 'en-IN' : 'hi-IN'; u.rate = slow ? 0.7 : 0.9
    speechSynthesis.speak(u); return 'Browser voice (not Gnani)'
  }
}
