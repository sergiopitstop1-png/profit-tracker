'use client'
// 💬 Chat con Lucy (15/10/2026) — legge tutto; dal 28/10/2026 registra un'operazione solo dopo il tuo sì e legge gli screenshot (📎 o incolla). La cronologia resta solo in questo browser (le immagini no).
import { useEffect, useRef, useState } from 'react'
import Link from 'next/link'

type Msg = { role: 'user' | 'assistant'; content: string; images?: string[] }
const MAX_FOTO = 4
// rimpicciolisce lo screenshot (lato max 1400 px, JPEG) così il messaggio resta leggero
async function preparaFoto(file: File): Promise<string> {
  const url = URL.createObjectURL(file)
  try {
    const img: HTMLImageElement = await new Promise((ok, ko) => { const i = new Image(); i.onload = () => ok(i); i.onerror = () => ko(new Error('immagine non leggibile')); i.src = url })
    const sc = Math.min(1, 1400 / Math.max(img.naturalWidth, img.naturalHeight))
    const c = document.createElement('canvas')
    c.width = Math.max(1, Math.round(img.naturalWidth * sc)); c.height = Math.max(1, Math.round(img.naturalHeight * sc))
    c.getContext('2d')!.drawImage(img, 0, 0, c.width, c.height)
    return c.toDataURL('image/jpeg', 0.8)
  } finally { URL.revokeObjectURL(url) }
}
const CHIAVE = 'lucy_chat_cronologia'

export default function LucyChatPage() {
  const [msgs, setMsgs] = useState<Msg[]>([])
  const [testo, setTesto] = useState('')
  const [attesa, setAttesa] = useState(false)
  const [errore, setErrore] = useState('')
  const [foto, setFoto] = useState<string[]>([])
  const fileRef = useRef<HTMLInputElement>(null)
  const fondo = useRef<HTMLDivElement>(null)

  useEffect(() => { try { const v = JSON.parse(localStorage.getItem(CHIAVE) || '[]'); if (Array.isArray(v)) setMsgs(v) } catch {} }, [])
  useEffect(() => { try { localStorage.setItem(CHIAVE, JSON.stringify(msgs.slice(-40).map(m => ({ role: m.role, content: m.images?.length ? `${m.content} [📷 ${m.images.length} screenshot]`.trim() : m.content })))) } catch {}; fondo.current?.scrollIntoView({ behavior: 'smooth' }) }, [msgs, attesa])

  const aggiungiFile = async (files: File[]) => {
    const immagini = files.filter(f => f.type.startsWith('image/'))
    if (!immagini.length) return
    setErrore('')
    try {
      const pronte: string[] = []
      for (const f of immagini.slice(0, MAX_FOTO)) pronte.push(await preparaFoto(f))
      setFoto(prev => [...prev, ...pronte].slice(0, MAX_FOTO))
    } catch (e: any) { setErrore(e?.message || 'Immagine non letta') }
  }

  const invia = async () => {
    const t = testo.trim()
    if ((!t && !foto.length) || attesa) return
    const nuovi: Msg[] = [...msgs, { role: 'user', content: t, ...(foto.length ? { images: foto } : {}) }]
    setMsgs(nuovi); setTesto(''); setFoto([]); setAttesa(true); setErrore('')
    try {
      // le immagini viaggiano solo con l'ultimo messaggio
      const payload = nuovi.map((m, i) => ({ role: m.role, content: m.images?.length && i < nuovi.length - 1 ? `${m.content} [📷 screenshot]`.trim() : m.content, ...(i === nuovi.length - 1 && m.images?.length ? { images: m.images } : {}) }))
      const r = await fetch('/api/lucy-chat', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ messages: payload }) })
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
        <div style={{ fontSize: 12.5, color: '#94a3b8', marginBottom: 10, lineHeight: 1.5 }}>Lucy può leggere tutti i dati del Profit Tracker (conti, clienti, operazioni, avvisi, mail e SMS), tranne password, chiavi e codici OTP. Registra un’operazione solo dopo il tuo «sì». Puoi allegare o incollare uno <b>screenshot</b> delle bet fatte (📎).</div>
        <div style={{ flex: 1, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 8, paddingBottom: 8 }}>
          {!msgs.length && <div style={{ color: '#64748b', fontSize: 14, padding: 10 }}>Prova a chiederle: «cosa ho rimandato questa settimana?» oppure «quali avvisi sono ancora aperti?»</div>}
          {msgs.map((m, i) => (
            <div key={i} style={{ alignSelf: m.role === 'user' ? 'flex-end' : 'flex-start', maxWidth: '88%', background: m.role === 'user' ? 'rgba(56,189,248,.18)' : 'rgba(15,23,42,.9)', border: '1px solid ' + (m.role === 'user' ? 'rgba(56,189,248,.4)' : '#1e293b'), borderRadius: 12, padding: '8px 12px', whiteSpace: 'pre-wrap', overflowWrap: 'anywhere', lineHeight: 1.55, fontSize: 14.5 }}>
              {m.images?.length ? <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: m.content ? 6 : 0 }}>{m.images.map((src, k) => <img key={k} src={src} alt="screenshot" style={{ maxWidth: 140, maxHeight: 140, borderRadius: 8, border: '1px solid #334155' }} />)}</div> : null}
              {m.role === 'assistant' && <b style={{ color: '#4ade80' }}>Lucy: </b>}{m.role === 'assistant' ? m.content.replace(/\*\*/g, '') : m.content}
            </div>
          ))}
          {attesa && <div style={{ color: '#94a3b8', fontSize: 13 }}>Lucy sta scrivendo…</div>}
          {errore && <div style={{ color: '#fca5a5', fontSize: 13 }}>⚠️ {errore}</div>}
          <div ref={fondo} />
        </div>
        {foto.length > 0 && (
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', paddingTop: 6 }}>
            {foto.map((src, k) => (
              <div key={k} style={{ position: 'relative' }}>
                <img src={src} alt="da inviare" style={{ height: 64, borderRadius: 8, border: '1px solid #334155' }} />
                <button onClick={() => setFoto(prev => prev.filter((_, j) => j !== k))} title="Togli" style={{ position: 'absolute', top: -6, right: -6, width: 20, height: 20, borderRadius: 10, border: 0, background: '#ef4444', color: 'white', fontSize: 12, cursor: 'pointer', lineHeight: '20px', padding: 0 }}>×</button>
              </div>
            ))}
          </div>
        )}
        <div style={{ display: 'flex', gap: 8, position: 'sticky', bottom: 0, background: '#0b1220', paddingTop: 6 }}>
          <input ref={fileRef} type="file" accept="image/*" multiple hidden onChange={e => { aggiungiFile(Array.from(e.target.files || [])); e.target.value = '' }} />
          <button onClick={() => fileRef.current?.click()} disabled={attesa || foto.length >= MAX_FOTO} title="Allega uno screenshot (puoi anche incollarlo)" style={{ background: 'rgba(56,189,248,.15)', color: '#7dd3fc', border: '1px solid rgba(56,189,248,.4)', borderRadius: 10, padding: '0 12px', fontSize: 18, cursor: 'pointer', opacity: attesa || foto.length >= MAX_FOTO ? .5 : 1 }}>📎</button>
          <textarea value={testo} onChange={e => setTesto(e.target.value)} rows={2} placeholder="Scrivi a Lucy… (o incolla uno screenshot)" maxLength={4000}
            onPaste={e => { const f = Array.from(e.clipboardData?.files || []).filter(x => x.type.startsWith('image/')); if (f.length) { e.preventDefault(); aggiungiFile(f) } }}
            onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); invia() } }}
            style={{ flex: 1, background: '#020617', color: '#f8fafc', border: '1px solid #334155', borderRadius: 10, padding: '8px 10px', fontSize: 16, fontFamily: 'inherit', resize: 'none' }} />
          <button onClick={invia} disabled={attesa || (!testo.trim() && !foto.length)} style={{ background: 'rgba(34,197,94,.2)', color: '#4ade80', border: '1px solid rgba(34,197,94,.5)', borderRadius: 10, padding: '0 16px', fontWeight: 800, cursor: 'pointer', opacity: attesa || (!testo.trim() && !foto.length) ? .5 : 1 }}>Invia</button>
        </div>
      </div>
    </div>
  )
}
