'use client'
// 💬 Chat con Lucy (15/10/2026) — sola lettura. La cronologia resta solo in questo browser.
import { useEffect, useRef, useState } from 'react'
import Link from 'next/link'

type Msg = { role: 'user' | 'assistant'; content: string }
const CHIAVE = 'lucy_chat_cronologia'

export default function LucyChatPage() {
  const [msgs, setMsgs] = useState<Msg[]>([])
  const [testo, setTesto] = useState('')
  const [attesa, setAttesa] = useState(false)
  const [errore, setErrore] = useState('')
  const fondo = useRef<HTMLDivElement>(null)

  useEffect(() => { try { const v = JSON.parse(localStorage.getItem(CHIAVE) || '[]'); if (Array.isArray(v)) setMsgs(v) } catch {} }, [])
  useEffect(() => { try { localStorage.setItem(CHIAVE, JSON.stringify(msgs.slice(-40))) } catch {}; fondo.current?.scrollIntoView({ behavior: 'smooth' }) }, [msgs, attesa])

  const invia = async () => {
    const t = testo.trim()
    if (!t || attesa) return
    const nuovi: Msg[] = [...msgs, { role: 'user', content: t }]
    setMsgs(nuovi); setTesto(''); setAttesa(true); setErrore('')
    try {
      const r = await fetch('/api/lucy-chat', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ messages: nuovi }) })
      const j = await r.json()
      if (!r.ok) throw new Error(j?.error || `errore ${r.status}`)
      setMsgs([...nuovi, { role: 'assistant', content: j.risposta }])
    } catch (e: any) { setErrore(e?.message || 'Errore') }
    setAttesa(false)
  }

  return (
    <div style={{ minHeight: '100dvh', background: '#0b1220', color: '#e2e8f0', fontFamily: 'system-ui, -apple-system, Segoe UI, sans-serif', display: 'flex', flexDirection: 'column' }}>
      <div style={{ maxWidth: 780, width: '100%', margin: '0 auto', padding: '14px 12px', display: 'flex', flexDirection: 'column', flex: 1, boxSizing: 'border-box' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap', marginBottom: 8 }}>
          <Link href="/profit-tracker" style={{ color: '#7dd3fc', fontWeight: 800, textDecoration: 'none', fontSize: 14 }}>← Profit Tracker</Link>
          <button onClick={() => { if (confirm('Cancellare la cronologia di questa chat?')) setMsgs([]) }} style={{ marginLeft: 'auto', background: 'transparent', color: '#94a3b8', border: '1px solid #334155', borderRadius: 8, padding: '4px 10px', fontSize: 12, cursor: 'pointer' }}>🗑 Nuova chat</button>
        </div>
        <h1 style={{ fontSize: 22, margin: '4px 0' }}>💬 Chat con Lucy</h1>
        <div style={{ fontSize: 12.5, color: '#94a3b8', marginBottom: 10, lineHeight: 1.5 }}>Lucy legge le operazioni degli ultimi 7 giorni, le voci rimandate e gli avvisi aperti. In questa chat <b>non può modificare nulla</b>: risponde e ti indica dove fare le cose.</div>
        <div style={{ flex: 1, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 8, paddingBottom: 8 }}>
          {!msgs.length && <div style={{ color: '#64748b', fontSize: 14, padding: 10 }}>Prova a chiederle: «cosa ho rimandato questa settimana?» oppure «quali avvisi sono ancora aperti?»</div>}
          {msgs.map((m, i) => (
            <div key={i} style={{ alignSelf: m.role === 'user' ? 'flex-end' : 'flex-start', maxWidth: '88%', background: m.role === 'user' ? 'rgba(56,189,248,.18)' : 'rgba(15,23,42,.9)', border: '1px solid ' + (m.role === 'user' ? 'rgba(56,189,248,.4)' : '#1e293b'), borderRadius: 12, padding: '8px 12px', whiteSpace: 'pre-wrap', overflowWrap: 'anywhere', lineHeight: 1.55, fontSize: 14.5 }}>
              {m.role === 'assistant' && <b style={{ color: '#4ade80' }}>Lucy: </b>}{m.content}
            </div>
          ))}
          {attesa && <div style={{ color: '#94a3b8', fontSize: 13 }}>Lucy sta scrivendo…</div>}
          {errore && <div style={{ color: '#fca5a5', fontSize: 13 }}>⚠️ {errore}</div>}
          <div ref={fondo} />
        </div>
        <div style={{ display: 'flex', gap: 8, position: 'sticky', bottom: 0, background: '#0b1220', paddingTop: 6 }}>
          <textarea value={testo} onChange={e => setTesto(e.target.value)} rows={2} placeholder="Scrivi a Lucy…" maxLength={4000}
            onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); invia() } }}
            style={{ flex: 1, background: '#020617', color: '#f8fafc', border: '1px solid #334155', borderRadius: 10, padding: '8px 10px', fontSize: 16, fontFamily: 'inherit', resize: 'none' }} />
          <button onClick={invia} disabled={attesa || !testo.trim()} style={{ background: 'rgba(34,197,94,.2)', color: '#4ade80', border: '1px solid rgba(34,197,94,.5)', borderRadius: 10, padding: '0 16px', fontWeight: 800, cursor: 'pointer', opacity: attesa || !testo.trim() ? .5 : 1 }}>Invia</button>
        </div>
      </div>
    </div>
  )
}
