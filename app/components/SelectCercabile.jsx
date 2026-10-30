'use client'
// ════════════════════════════════════════════════════════════════════
// SelectCercabile (30/10/2026) · al posto del menu a tendina normale: scrivi e restano solo le voci che contengono quello che hai scritto.
// Es. scrivi «pal» → compaiono tutti i wallet con «pal» nel nome (PayPal — …).  Si possono scrivere anche più parole: «pay ann» trova «PayPal — Annarosa».
// Si usa come un <select>: stessi name / value / onChange (onChange riceve { target: { name, value } }), stesso stile.
// Tastiera: ↓ ↑ per scorrere, Invio sceglie, Esc chiude. Un clic fuori chiude.
// ════════════════════════════════════════════════════════════════════
import React, { useEffect, useMemo, useRef, useState } from 'react'

const pulisci = (t) => String(t || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '')

export default function SelectCercabile({ name, value, onChange, options, placeholder = 'Seleziona…', style }) {
  const [aperto, setAperto] = useState(false)
  const [testo, setTesto] = useState('')
  const [evid, setEvid] = useState(0)
  const radice = useRef(null)
  const lista = useRef(null)

  const scelta = useMemo(() => (options || []).find((o) => String(o.value) === String(value)) || null, [options, value])

  const filtrate = useMemo(() => {
    const parole = pulisci(testo).split(/\s+/).filter(Boolean)
    if (!parole.length) return options || []
    return (options || []).filter((o) => { const l = pulisci(o.label); return parole.every((p) => l.includes(p)) })
  }, [options, testo])

  useEffect(() => { setEvid(0) }, [testo, aperto])

  // clic fuori = chiude
  useEffect(() => {
    if (!aperto) return undefined
    const fuori = (e) => { if (radice.current && !radice.current.contains(e.target)) { setAperto(false); setTesto('') } }
    document.addEventListener('mousedown', fuori)
    document.addEventListener('touchstart', fuori)
    return () => { document.removeEventListener('mousedown', fuori); document.removeEventListener('touchstart', fuori) }
  }, [aperto])

  // tiene visibile la voce evidenziata
  useEffect(() => {
    if (!aperto || !lista.current) return
    const el = lista.current.children[evid + (value ? 1 : 0)]
    if (el && el.scrollIntoView) el.scrollIntoView({ block: 'nearest' })
  }, [evid, aperto, value])

  function scegli(v) {
    onChange && onChange({ target: { name, value: String(v) } })   // sempre testo, come un <select> normale
    setAperto(false)
    setTesto('')
  }

  function tasto(e) {
    if (e.key === 'ArrowDown') { e.preventDefault(); if (!aperto) setAperto(true); else setEvid((i) => Math.min(filtrate.length - 1, i + 1)) }
    else if (e.key === 'ArrowUp') { e.preventDefault(); setEvid((i) => Math.max(0, i - 1)) }
    else if (e.key === 'Enter') { if (aperto) { e.preventDefault(); if (filtrate[evid]) scegli(filtrate[evid].value) } }
    else if (e.key === 'Escape') { setAperto(false); setTesto('') }
  }

  const { marginBottom, ...stileCampo } = style || {}
  const voce = (attiva) => ({ padding: '9px 12px', cursor: 'pointer', fontSize: 14, color: '#f8fafc', background: attiva ? 'rgba(56,189,248,0.22)' : 'transparent' })

  return (
    <div ref={radice} style={{ position: 'relative', marginBottom: marginBottom ?? 12 }}>
      <input
        type="text"
        autoComplete="off"
        value={aperto ? testo : (scelta ? scelta.label : '')}
        placeholder={aperto ? `🔎 Scrivi per cercare… (${scelta ? scelta.label : placeholder})` : placeholder}
        onFocus={() => setAperto(true)}
        onClick={() => setAperto(true)}
        onChange={(e) => { setTesto(e.target.value); setAperto(true) }}
        onKeyDown={tasto}
        style={{ ...stileCampo, marginBottom: 0, cursor: 'text', borderColor: aperto ? 'rgba(56,189,248,0.8)' : stileCampo.borderColor }}
      />
      <span style={{ position: 'absolute', right: 14, top: '50%', transform: 'translateY(-50%)', pointerEvents: 'none', color: '#94a3b8', fontSize: 11 }}>{aperto ? '▲' : '▼'}</span>
      {aperto && (
        <div ref={lista} style={{ position: 'absolute', zIndex: 60, left: 0, right: 0, top: 'calc(100% + 4px)', maxHeight: 300, overflowY: 'auto', background: '#0b1220', border: '1px solid rgba(56,189,248,0.6)', borderRadius: 12, boxShadow: '0 12px 30px rgba(0,0,0,.55)' }}>
          {value ? <div onMouseDown={(e) => { e.preventDefault(); scegli('') }} style={{ ...voce(false), color: '#94a3b8', fontStyle: 'italic' }}>✕ Togli la selezione</div> : null}
          {filtrate.length === 0 && <div style={{ padding: '10px 12px', color: '#94a3b8', fontSize: 13 }}>Nessun risultato per «{testo}»</div>}
          {filtrate.map((o, i) => (
            <div key={o.value} onMouseDown={(e) => { e.preventDefault(); scegli(o.value) }} onMouseEnter={() => setEvid(i)}
              style={{ ...voce(i === evid), fontWeight: String(o.value) === String(value) ? 800 : 400 }}>{o.label}</div>
          ))}
        </div>
      )}
    </div>
  )
}
