'use client'
// 09/10/2026 · Striscia in Dashboard: prossima diretta dell'Accademia. Solo per l'admin: per gli altri non appare nulla.
// 30/10/2026 · compare da 10 giorni prima (prima solo nelle ultime 48 ore e una diretta annunciata per la settimana dopo non si vedeva):
//   più di 48 ore = riga azzurra tranquilla · entro 48 ore = verde · entro 1 ora = rosa. Il calendario resta nell'Archivio Lucy.
import { useEffect, useState } from 'react'

const fmt = iso => new Intl.DateTimeFormat('it-IT', { timeZone: 'Europe/Rome', weekday: 'short', day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' }).format(new Date(iso))

function tra(ms) {
  const m = Math.round(ms / 60000)
  if (m <= 0) return 'in corso o appena iniziata'
  if (m < 60) return `tra ${m} minuti`
  const h = Math.floor(m / 60)
  return h < 24 ? `tra ${h} h ${m % 60 ? `${m % 60} min` : ''}`.trim() : `tra ${Math.round(h / 24)} giorni`
}

export default function DiretteAvviso() {
  const [lista, setLista] = useState([])
  const [adesso, setAdesso] = useState(() => Date.now())

  useEffect(() => {
    let vivo = true
    const carica = async () => {
      try {
        const r = await fetch('/api/accademia/dirette')
        if (!r.ok) { if (vivo) setLista([]); return }
        const j = await r.json()
        if (vivo) setLista(Array.isArray(j.dirette) ? j.dirette : [])
      } catch { if (vivo) setLista([]) }
    }
    carica()
    const a = setInterval(carica, 120000)
    const b = setInterval(() => setAdesso(Date.now()), 30000)
    return () => { vivo = false; clearInterval(a); clearInterval(b) }
  }, [])

  const prossime = lista.filter(d => { const t = new Date(d.inizio).getTime(); return t > adesso - 60 * 60000 && t < adesso + 10 * 86400000 })
  if (!prossime.length) return null
  const d = prossime[0]
  const manca = new Date(d.inizio).getTime() - adesso
  const urgente = manca < 60 * 60000
  const lontana = manca >= 48 * 3600000
  return (
    <div style={{ margin: '0 0 12px', padding: '8px 12px', borderRadius: 12, fontSize: 13, fontWeight: 800,
      border: `1px solid ${urgente ? 'rgba(244,114,182,0.7)' : lontana ? 'rgba(56,189,248,0.45)' : 'rgba(34,197,94,0.45)'}`,
      background: urgente ? 'rgba(244,114,182,0.12)' : lontana ? 'rgba(56,189,248,0.08)' : 'rgba(34,197,94,0.08)', color: urgente ? '#f9a8d4' : lontana ? '#7dd3fc' : '#86efac' }}>
      📡 Diretta Accademia {tra(manca)} · {fmt(d.inizio)} · {d.titolo}
      {d.link && <> · <a href={d.link} target="_blank" rel="noopener noreferrer" style={{ textDecoration: 'underline' }}>apri</a></>}
      {prossime.length > 1 && <span style={{ fontWeight: 600, opacity: 0.8 }}> (+{prossime.length - 1} nei prossimi 10 giorni)</span>}
      {' · '}<a href="/profit-tracker?tab=lucy-mail&sezione=telegram" style={{ textDecoration: 'underline', fontWeight: 600 }}>calendario</a>
    </div>
  )
}
