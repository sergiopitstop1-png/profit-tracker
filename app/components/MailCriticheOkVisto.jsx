'use client'
// 22/10/2026 · Popup in Dashboard per le mail CRITICHE dei clienti (inibizione bonus, limitazione, conto sospeso/bloccato, KYC).
// Compare a ogni caricamento, ogni 2 minuti e quando torni sulla scheda, e RESTA finché non premi «Ok visto».
// Aprire la mail in Lucy Mail non lo fa sparire. Lo vedono admin e VIP (collaboratori); il «visto» è personale. Per gli altri non appare nulla.
import { useCallback, useEffect, useState } from 'react'

const quando = iso => new Date(iso).toLocaleString('it-IT', { timeZone: 'Europe/Rome', day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })
const ETICHETTA = { LIMITAZIONE: 'LIMITAZIONE', SOSPENSIONE: 'CONTO SOSPESO', KYC: 'DOCUMENTI / KYC' }

export default function MailCriticheOkVisto() {
  const [nuove, setNuove] = useState([])
  const [errore, setErrore] = useState('')
  const [salvo, setSalvo] = useState(false)

  const carica = useCallback(async () => {
    try {
      const r = await fetch('/api/lucy-mail/critiche', { cache: 'no-store' })
      if (!r.ok) { return }
      const j = await r.json()
      setNuove(Array.isArray(j.nuove) ? j.nuove : [])
    } catch { /* rete assente: riprovo al prossimo giro */ }
  }, [])

  useEffect(() => {
    carica()
    const t = setInterval(carica, 2 * 60000)
    const onVis = () => { if (document.visibilityState === 'visible') carica() }
    document.addEventListener('visibilitychange', onVis)
    return () => { clearInterval(t); document.removeEventListener('visibilitychange', onVis) }
  }, [carica])

  const okVisto = async (lista) => {
    const ids = lista.map(m => m.id)
    setSalvo(true); setErrore('')
    try {
      const r = await fetch('/api/lucy-mail/critiche', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ ids }) })
      if (!r.ok) { const j = await r.json().catch(() => null); throw new Error(j?.error || `errore ${r.status}`) }
      const fatti = new Set(ids)
      setNuove(prev => prev.filter(m => !fatti.has(m.id)))
    } catch (e) { setErrore(`Salvataggio non riuscito: ${e?.message || e}`) }
    setSalvo(false)
  }

  if (!nuove.length) return null
  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 10000, background: 'rgba(0,0,0,0.7)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}>
      <div style={{ width: 'min(680px, 100%)', maxHeight: '85vh', overflowY: 'auto', background: '#14080a', border: '1px solid rgba(239,68,68,0.7)', borderRadius: 14, padding: 16, color: '#e2e8f0' }}>
        <div style={{ fontWeight: 900, fontSize: 16, color: '#fca5a5', marginBottom: 4 }}>🚨 {nuove.length === 1 ? 'Mail importante su un conto' : `${nuove.length} mail importanti sui conti`}</div>
        <div style={{ fontSize: 12, color: '#94a3b8', marginBottom: 12 }}>Inibizione bonus, limitazioni, conti sospesi o documenti richiesti. Resta qui finché non premi «Ok visto».</div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {nuove.map(m => (
            <div key={m.id} style={{ border: '1px solid rgba(239,68,68,0.4)', borderRadius: 10, padding: 10, background: 'rgba(0,0,0,0.35)' }}>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, alignItems: 'center', fontSize: 12 }}>
                <span style={{ color: '#94a3b8' }}>{quando(m.data)}</span>
                {m.book && <span style={{ background: 'rgba(239,68,68,0.2)', color: '#fecaca', borderRadius: 6, padding: '1px 8px', fontWeight: 800 }}>{m.book}</span>}
                <span style={{ background: 'rgba(245,158,11,0.2)', color: '#fde68a', borderRadius: 6, padding: '1px 8px', fontWeight: 800 }}>{ETICHETTA[m.categoria] || m.categoria}</span>
                {m.cliente && <span style={{ marginLeft: 'auto', fontWeight: 800, color: '#f8fafc' }}>{m.cliente}</span>}
              </div>
              <div style={{ fontSize: 14, fontWeight: 700, margin: '4px 0' }}>{m.oggetto || '[senza oggetto]'}</div>
              {m.riassunto && <div style={{ fontSize: 12, color: '#cbd5e1', marginBottom: 6, lineHeight: 1.4 }}>{m.riassunto}</div>}
              <div style={{ display: 'flex', gap: 10, alignItems: 'center', fontSize: 12 }}>
                <a href="/profit-tracker?tab=lucy-mail&vista=problemi" style={{ color: '#fca5a5', textDecoration: 'underline' }}>apri in Lucy Mail</a>
                <button onClick={() => okVisto([m])} disabled={salvo} style={{ marginLeft: 'auto', border: '1px solid rgba(239,68,68,0.7)', background: 'rgba(239,68,68,0.15)', color: '#fecaca', borderRadius: 8, padding: '3px 10px', cursor: 'pointer', fontWeight: 800 }}>✅ Ok visto</button>
              </div>
            </div>
          ))}
        </div>
        {errore && <div style={{ marginTop: 8, fontSize: 12, color: '#fca5a5' }}>{errore}</div>}
        {nuove.length > 1 && (
          <div style={{ display: 'flex', marginTop: 12 }}>
            <button onClick={() => okVisto(nuove)} disabled={salvo} style={{ marginLeft: 'auto', border: '1px solid rgba(239,68,68,0.9)', background: 'rgba(239,68,68,0.3)', color: '#fee2e2', borderRadius: 8, padding: '6px 14px', cursor: 'pointer', fontWeight: 900 }}>Ok visto tutte</button>
          </div>
        )}
      </div>
    </div>
  )
}
