import { useEffect, useRef } from 'react'

export const inr = n => '₹' + Math.round(Number(n) || 0).toLocaleString('en-IN')

const CATS = {
  pension: 'Pension', fd_interest: 'FD interest', rental: 'Rent received', family_support: 'Family support',
  groceries: 'Groceries', healthcare: 'Healthcare', utilities: 'Utilities', household: 'Household',
  transport: 'Transport', recurring: 'Recurring', other: 'Other',
}
export const labelize = s => CATS[s] || String(s || '').replaceAll('_', ' ')

export const LANGS = [['hinglish', 'Hinglish'], ['hi', 'हिन्दी'], ['en', 'English']]

export function Button({ variant = 'primary', className = '', children, ...props }) {
  return <button type="button" className={`btn btn-${variant} ${className}`} {...props}>{children}</button>
}

export function Field({ label, children, ...props }) {
  const control = children || <input className="field" {...props} />
  if (!label) return control
  return <label className="field-label">{label}{control}</label>
}

export function LanguageSwitch({ lang, setLang }) {
  return <div className="lang" role="group" aria-label="Language">
    {LANGS.map(([k, name]) => <button key={k} type="button" aria-pressed={lang === k} onClick={() => setLang(k)}>{name}</button>)}
  </div>
}

export function PageIntro({ title, children }) {
  return <header className="page-intro"><h1 id="page-title">{title}</h1>{children && <p className="lede">{children}</p>}</header>
}

export function Notice({ tone = 'info', title, children, role }) {
  return <div className={`notice notice-${tone}`} role={role || (tone === 'caution' ? 'alert' : 'status')}>
    {title && <p className="notice-title">{title}</p>}{children}
  </div>
}

export function Stat({ label, value, note }) {
  return <div className="stat"><p className="stat-label">{label}</p><p className="stat-value">{value}</p>{note && <p className="stat-note">{note}</p>}</div>
}

export function Modal({ title, children, onClose }) {
  const ref = useRef(null)
  useEffect(() => {
    const prev = document.activeElement
    ref.current?.focus()
    const onKey = e => { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', onKey)
    return () => { window.removeEventListener('keydown', onKey); prev?.focus?.() }
  }, [onClose])
  return <div className="modal-back" onMouseDown={onClose}>
    <div className="modal" role="alertdialog" aria-modal="true" aria-labelledby="modal-title" onMouseDown={e => e.stopPropagation()}>
      <h2 id="modal-title" ref={ref} tabIndex={-1}>{title}</h2>
      {children}
    </div>
  </div>
}
