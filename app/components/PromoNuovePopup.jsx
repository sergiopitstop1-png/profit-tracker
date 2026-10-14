'use client'
// 14/10/2026 · Popup in Dashboard: promo nuove segnalate su Telegram (topic "Segnalazione Promo") non ancora segnate «ok visto».
// Compare a ogni caricamento/refresh e ogni 5 minuti finché non premi «Ok visto». Solo admin: per gli altri non appare nulla.
import { useCallback, useEffect, useState } from 'react'

const quando = iso => new Date(iso).toLocaleString('it-IT', { timeZone: 'Europe/Rome', day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })

export default function PromoNuovePopup() {
  const [nuove, setNuove] = useState([])
  const [errore, setErrore] = useState('')
  const [salvo, setSalvo] = useState(false)

  const carica = useCallback(async () => {
    try {
      const r = await fetch('/api/accademia/promo-abbinate?nuove=1', { cache: 'no-store' })
      if (!r.ok) { setNuove([]); return }
      const j = await r.json()
      setNuove(Array.isArray(j.nuove) ? j.nuove : [])
    } catch { /* rete assente: riprovo al prossimo giro */ }
  }, [])

  useEffect(() => {
    carica()
    const t = setInterval(carica, 5 * 60000)
    return () => clearInterval(t)
  }, [carica])

  const okVisto = async (lista) => {
    const ids = lista.flatMap(p => p.ids || [p.id])
    setSalvo(true); setErrore('')
    try {
      const r = await fetch('/api/accademia/promo-abbinate', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ ids }) })
      if (!r.ok) { const j = await r.json().catch(() => null); throw new Error(j?.error || `errore ${r.status}`) }
      const fatti = new Set(ids)
      setNuove(prev => prev.filter(p => !(p.ids || [p.id]).some(i => fatti.has(i))))
    } catch (e) { setErrore(`Salvataggio non riuscito: ${e?.message || e}`) }
    setSalvo(false)
  }

  if (!nuove.length) return null
  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 9999, background: 'rgba(0,0,0,0.65)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}>
      <div style={{ width: 'min(640px, 100%)', maxHeight: '85vh', overflowY: 'auto', background: '#07100a', border: '1px solid rgba(34,197,94,0.6)', borderRadius: 14, padding: 16, color: '#e2e8f0' }}>
        <div style={{ fontWeight: 900, fontSize: 16, color: '#86efac', marginBottom: 4 }}>🎯 {nuove.length === 1 ? 'Nuova promo segnalata' : `${nuove.length} nuove promo segnalate`}</div>
        <div style={{ fontSize: 12, color: '#94a3b8', marginBottom: 12 }}>Dal topic «Segnalazione Promo». Resta qui finché non premi «Ok visto».</div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {nuove.map(p => (
            <div key={p.id} style={{ border: '1px solid rgba(34,197,94,0.35)', borderRadius: 10, padding: 10, background: 'rgba(0,0,0,0.35)' }}>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, alignItems: 'center', fontSize: 12 }}>
                <span style={{ color: '#94a3b8' }}>{quando(p.data)}</span>
                {(p.book || []).map(b => <span key={b} style={{ background: 'rgba(34,197,94,0.2)', color: '#bbf7d0', borderRadius: 6, padding: '1px 8px', fontWeight: 800 }}>{b}</span>)}
                {p.doppioni > 0 && <span style={{ color: '#94a3b8' }}>segnalata {p.doppioni + 1} volte</span>}
                <span style={{ marginLeft: 'auto', fontWeight: 800 }}>
                  <span style={{ color: '#86efac' }}>✅ {p.arrivata_a.length}</span>{' '}
                  {p.forse_arrivata_a.length > 0 && <span style={{ color: '#fcd34d' }}>❓ {p.forse_arrivata_a.length} </span>}
                  <span style={{ color: '#fca5a5' }}>❌ {p.non_arrivata_a.length}</span>
                </span>
              </div>
              <div style={{ fontSize: 14, fontWeight: 700, margin: '4px 0' }}>{p.titolo || '[segnalazione in immagine]'}</div>
              <div style={{ display: 'flex', gap: 10, alignItems: 'center', fontSize: 12 }}>
                {p.link && <a href={p.link} target="_blank" rel="noopener noreferrer" style={{ color: '#4ade80', textDecoration: 'underline' }}>apri su Telegram</a>}
                <button onClick={() => okVisto([p])} disabled={salvo} style={{ marginLeft: 'auto', border: '1px solid rgba(34,197,94,0.6)', background: 'rgba(34,197,94,0.15)', color: '#bbf7d0', borderRadius: 8, padding: '3px 10px', cursor: 'pointer', fontWeight: 800 }}>✅ Ok visto</button>
              </div>
            </div>
          ))}
        </div>
        {errore && <div style={{ marginTop: 8, fontSize: 12, color: '#fca5a5' }}>{errore}</div>}
        <div style={{ display: 'flex', gap: 10, alignItems: 'center', marginTop: 12 }}>
          <a href="/profit-tracker?tab=lucy-mail&sezione=telegram" style={{ fontSize: 12, color: '#4ade80', textDecoration: 'underline' }}>vedi chi l&apos;ha ricevuta (Archivio Lucy → Telegram → Promo segnalate)</a>
          <button onClick={() => okVisto(nuove)} disabled={salvo} style={{ marginLeft: 'auto', border: '1px solid rgba(34,197,94,0.8)', background: 'rgba(34,197,94,0.25)', color: '#dcfce7', borderRadius: 8, padding: '6px 14px', cursor: 'pointer', fontWeight: 900 }}>{nuove.length > 1 ? 'Ok visto tutte' : 'Ok visto'}</button>
        </div>
      </div>
    </div>
  )
}
