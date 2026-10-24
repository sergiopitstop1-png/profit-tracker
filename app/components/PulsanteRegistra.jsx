'use client'
// 24/10/2026 — Pulsante tondo "Registra al volo": sempre visibile, si trascina col mouse (o col dito) e ricorda dove l'hai messo.
// Un clic (senza trascinare) chiama onClick. Lo usa il Profit Tracker per aprire il Registro manuale; sulle altre pagine porta lì.
import { useEffect, useRef, useState } from 'react'

const CHIAVE_POS = 'pt_pulsante_registra_pos'
const D = 54          // diametro del pulsante
const MARGINE = 6

function dentro(x, y) {
  const w = typeof window === 'undefined' ? 1200 : window.innerWidth
  const h = typeof window === 'undefined' ? 800 : window.innerHeight
  return { x: Math.min(Math.max(MARGINE, x), Math.max(MARGINE, w - D - MARGINE)), y: Math.min(Math.max(MARGINE, y), Math.max(MARGINE, h - D - MARGINE)) }
}

export default function PulsanteRegistra({ onClick, titolo = 'Registra al volo (Alt+R) · trascinami dove vuoi' }) {
  const [pos, setPos] = useState(null)       // null finché non si conosce la finestra (evita differenze tra server e browser)
  const trascino = useRef(null)

  useEffect(() => {
    let p = null
    try { const s = JSON.parse(localStorage.getItem(CHIAVE_POS) || 'null'); if (s && Number.isFinite(s.x) && Number.isFinite(s.y)) p = s } catch {}
    setPos(dentro(p ? p.x : window.innerWidth - D - 22, p ? p.y : window.innerHeight - D - 22))
    const aggiusta = () => setPos(q => (q ? dentro(q.x, q.y) : q))
    window.addEventListener('resize', aggiusta)
    return () => window.removeEventListener('resize', aggiusta)
  }, [])

  if (!pos) return null

  const giu = e => {
    if (e.button !== undefined && e.button !== 0) return
    trascino.current = { px: e.clientX, py: e.clientY, x0: pos.x, y0: pos.y, mosso: false }
    try { e.currentTarget.setPointerCapture(e.pointerId) } catch {}
  }
  const muovi = e => {
    const t = trascino.current
    if (!t) return
    const dx = e.clientX - t.px, dy = e.clientY - t.py
    if (!t.mosso && Math.hypot(dx, dy) < 5) return      // meno di 5 px = è un clic, non un trascinamento
    t.mosso = true
    setPos(dentro(t.x0 + dx, t.y0 + dy))
  }
  const su = e => {
    const t = trascino.current
    trascino.current = null
    try { e.currentTarget.releasePointerCapture(e.pointerId) } catch {}
    if (!t) return
    if (t.mosso) { try { localStorage.setItem(CHIAVE_POS, JSON.stringify(pos)) } catch {} }
    else if (onClick) onClick()
  }

  return (
    <button type="button" title={titolo} aria-label="Registra al volo"
      onPointerDown={giu} onPointerMove={muovi} onPointerUp={su} onPointerCancel={() => { trascino.current = null }}
      style={{ position: 'fixed', left: pos.x, top: pos.y, width: D, height: D, borderRadius: '50%', zIndex: 900, border: '2px solid rgba(255,255,255,0.35)',
        background: 'linear-gradient(135deg,#9333ea,#6d28d9)', color: 'white', fontSize: 24, fontWeight: 900, cursor: 'grab', touchAction: 'none',
        boxShadow: '0 6px 18px rgba(0,0,0,0.45)', display: 'flex', alignItems: 'center', justifyContent: 'center', userSelect: 'none', padding: 0 }}>
      ✍️
    </button>
  )
}
