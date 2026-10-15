"use client";
// ════════════════════════════════════════════════════════════════════
// 12/10/2026 · ASPETTO DELLA DASHBOARD — meno confusione, con un interruttore per ogni modifica.
// Ogni punto si può spegnere dal pannello "⚙ Aspetto": spento = com'era prima. Si ricorda per browser (localStorage).
//   numeriSu       → Panoramica, Cassa e Accantonamenti subito dopo la barra, gli avvisi sotto
//   oggiUnico      → le strisce (quote, Lucy Trading, promo, mirate) in un'unica scheda "Oggi" che si chiude
//   rossoCompatto  → il riquadro rosso degli avvisi mostra 3 righe e un tasto "mostra tutti"
//   pulsantiGruppi → barra con i pulsanti usati sempre + 3 menu (Soldi, Conti e team, Strumenti)
//   headerCompatto → logo più piccolo e Home / Esito manuale / Iscritti / © in un menu
// ════════════════════════════════════════════════════════════════════
import React, { useEffect, useRef, useState, Children } from 'react'
import { apriOggiDaFare } from '../../lib/finestraOggiDaFare'   // 14/10/2026: Oggi da fare in finestra separata

const CHIAVE = 'profittracker_aspetto_v1'
export const ASPETTO_PREDEFINITO = { numeriSu: true, oggiUnico: true, rossoCompatto: true, pulsantiGruppi: true, headerCompatto: true }
const VOCI = [
  ['numeriSu', '💶 Numeri in alto', 'Panoramica, Cassa e Accantonamenti subito sotto la barra; gli avvisi vanno sotto'],
  ['oggiUnico', '📋 Bottone "Oggi" accanto a Salva Periodo', 'Lucy Trading, promo in scadenza e profilazioni mirate in una finestra mobile; il bottone lampeggia in giallo se c\'è qualcosa da fare oggi'],
  ['rossoCompatto', '🔔 Riquadro rosso corto', 'Mostra 3 avvisi e un tasto per vederli tutti'],
  ['pulsantiGruppi', '🗂 Pulsanti in gruppi', 'I più usati restano in vista, gli altri stanno in 3 menu'],
  ['headerCompatto', '🏠 Intestazione compatta', 'Home, Esito manuale, Iscritti e © in un menu'],
]

export function useAspetto() {
  const [aspetto, setAspetto] = useState(ASPETTO_PREDEFINITO)
  useEffect(() => {
    try {
      const salvato = JSON.parse(localStorage.getItem(CHIAVE) || 'null')
      if (salvato && typeof salvato === 'object') setAspetto({ ...ASPETTO_PREDEFINITO, ...salvato })
    } catch {}
  }, [])
  const cambia = (nuovo) => {
    setAspetto(nuovo)
    try { localStorage.setItem(CHIAVE, JSON.stringify(nuovo)) } catch {}
  }
  return [aspetto, cambia]
}

// chiude un menu quando si clicca fuori
function useFuori(aperto, chiudi) {
  const ref = useRef(null)
  useEffect(() => {
    if (!aperto) return
    const gestore = (e) => { if (ref.current && !ref.current.contains(e.target)) chiudi() }
    document.addEventListener('mousedown', gestore)
    return () => document.removeEventListener('mousedown', gestore)
  }, [aperto, chiudi])
  return ref
}

const popover = { position: 'absolute', top: 'calc(100% + 6px)', zIndex: 3000, minWidth: 230, background: '#0f172a', border: '1px solid rgba(71,85,105,0.9)', borderRadius: 12, padding: 8, boxShadow: '0 12px 32px rgba(0,0,0,0.55)' }

/* ---------- ⚙ pannello con gli interruttori ---------- */
export function PannelloAspetto({ aspetto, setAspetto, stile }) {
  const [aperto, setAperto] = useState(false)
  const ref = useFuori(aperto, () => setAperto(false))
  const tuttoSpento = VOCI.every(([k]) => !aspetto[k])
  return (
    <div ref={ref} style={{ position: 'relative', display: 'inline-block', marginLeft: 'auto' }}>
      <button style={{ ...stile, opacity: 0.9 }} onClick={() => setAperto(v => !v)} title="Come vuoi vedere la Dashboard">⚙ Aspetto</button>
      {aperto && (
        <div style={{ ...popover, right: 0, width: 340 }}>
          <div style={{ color: '#f8fafc', fontWeight: 800, fontSize: 13, padding: '2px 6px 8px' }}>Aspetto della Dashboard</div>
          {VOCI.map(([k, nome, desc]) => (
            <label key={k} style={{ display: 'flex', gap: 10, alignItems: 'flex-start', padding: '7px 6px', borderRadius: 8, cursor: 'pointer' }}>
              <input type="checkbox" checked={!!aspetto[k]} onChange={e => setAspetto({ ...aspetto, [k]: e.target.checked })} style={{ marginTop: 3 }} />
              <span>
                <span style={{ color: '#e2e8f0', fontWeight: 700, fontSize: 13 }}>{nome}</span><br />
                <span style={{ color: '#94a3b8', fontSize: 11.5 }}>{desc}</span>
              </span>
            </label>
          ))}
          <div style={{ display: 'flex', gap: 8, padding: '8px 6px 2px', borderTop: '1px solid rgba(51,65,85,0.8)', marginTop: 4 }}>
            <button onClick={() => setAspetto(Object.fromEntries(VOCI.map(([k]) => [k, false])))} disabled={tuttoSpento}
              style={{ ...stile, fontSize: 12, opacity: tuttoSpento ? 0.5 : 1 }}>↩ Ripristina com&apos;era</button>
            <button onClick={() => setAspetto({ ...ASPETTO_PREDEFINITO })} style={{ ...stile, fontSize: 12 }}>✓ Tutto nuovo</button>
          </div>
        </div>
      )}
    </div>
  )
}

/* ---------- barra a gruppi ---------- */
const PREFERITI = [
  ['dashboard', 'Dashboard'], ['profilazione', 'Profilazione'], ['books', 'Books'], ['clienti', 'Clienti'],
  ['lucy-mail', '📬 Lucy Mail'], ['segnali', '📡 Segnali'], ['lucy-chat', '💬 Chat Lucy'],
]
const GRUPPI = [
  { id: 'soldi', nome: '💰 Soldi', voci: [['accantonamenti', '💰 Accantonamenti'], ['wallets', '👛 Wallets'], ['transactions', '🔄 Transactions'], ['periodi', '📅 Periodi'], ['punti-monete', '🏆 Punti & Monete'], ['stime-cassa', '🧾 Contabilità']] },
  { id: 'conti', nome: '🗂 Conti e team', voci: [['matrice', '🧮 Matrice'], ['credenziali', '🔑 Credenziali'], ['team', '👥 Team']] },
  { id: 'strumenti', nome: '🧰 Strumenti', voci: [['slot-consigliate', '🎰 Lista slot'], ['promo', '🎁 Promo'], ['masaniello', '🎲 Masaniello'], ['prop-hedge', '📈 Prop Hedge'], ['memo', '📝 Memo'], ['post-it', '📌 Post-it']] },
]

function Gruppo({ gruppo, activeTab, onTab, tabButton, activeTabButton }) {
  const [aperto, setAperto] = useState(false)
  const ref = useFuori(aperto, () => setAperto(false))
  const attiva = gruppo.voci.find(([k]) => k === activeTab)
  return (
    <div ref={ref} style={{ position: 'relative', display: 'inline-block' }}>
      <button style={attiva ? activeTabButton : tabButton} onClick={() => setAperto(v => !v)}>
        {gruppo.nome}{attiva ? ` · ${attiva[1]}` : ''} ▾
      </button>
      {aperto && (
        <div style={{ ...popover, left: 0 }}>
          {gruppo.voci.map(([k, nome]) => (
            <button key={k} onClick={() => { setAperto(false); onTab(k) }}
              style={{ display: 'block', width: '100%', textAlign: 'left', padding: '8px 12px', marginBottom: 2, borderRadius: 8, border: 'none', cursor: 'pointer', fontWeight: 700, fontSize: 13,
                background: k === activeTab ? 'rgba(56,189,248,0.18)' : 'transparent', color: k === activeTab ? '#7dd3fc' : '#e2e8f0' }}>
              {nome}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}

export function NavRaggruppata({ activeTab, onTab, tabButton, activeTabButton, tabsBar, extra }) {
  return (
    <nav style={{ ...tabsBar, alignItems: 'center' }}>
      {PREFERITI.map(([k, nome]) => (
        <button key={k} style={activeTab === k ? activeTabButton : tabButton} onClick={() => onTab(k)}>{nome}</button>
      ))}
      {GRUPPI.map(g => <Gruppo key={g.id} gruppo={g} activeTab={activeTab} onTab={onTab} tabButton={tabButton} activeTabButton={activeTabButton} />)}
      {extra}
    </nav>
  )
}

/* ---------- menu dell'intestazione compatta ---------- */
export function MenuIntestazione({ stile, testoCopyright }) {
  const [aperto, setAperto] = useState(false)
  const ref = useFuori(aperto, () => setAperto(false))
  const voce = { display: 'block', padding: '9px 12px', borderRadius: 8, color: '#e2e8f0', fontWeight: 700, fontSize: 13, textDecoration: 'none' }
  return (
    <div ref={ref} style={{ position: 'relative' }}>
      <button style={stile} onClick={() => setAperto(v => !v)}>☰ Menu</button>
      {aperto && (
        <div style={{ ...popover, right: 0, minWidth: 250 }}>
          <a href="/" style={voce}>🏠 Home</a>
          <a href="/admin/pronostici-manuale" style={{ ...voce, color: '#c8f135' }}>🎾 Esito manuale pronostici</a>
          <a href="/iscritti" style={{ ...voce, color: '#388BFD' }}>👥 Iscritti</a>
          <div style={{ color: '#64748b', fontSize: 11, padding: '8px 12px 4px', borderTop: '1px solid rgba(51,65,85,0.8)', marginTop: 4 }}>{testoCopyright}</div>
        </div>
      )}
    </div>
  )
}

/* ---------- scheda "Oggi": bottone accanto a "Salva Periodo" + finestra mobile ----------
   13/10/2026: da chiusa è solo un bottone; al clic si apre un popup che si trascina col mouse (dall'intestazione) e si richiude con ✕ o Esc.
   Il bottone lampeggia in giallo finché dentro c'è qualcosa da fare oggi: le sezioni segnalano "da fare" con l'attributo data-da-fare="1"
   (promo che scadono oggi, profilazioni mirate di oggi o scadute) e il segnale sparisce da solo quando le cose sono state fatte.
   Il contenuto resta montato anche da chiuso, così i pannelli continuano a caricarsi. */
export function OggiCard({ children, attiva, onApri }) {
  const [aperta, setAperta] = useState(false)
  const [daFare, setDaFare] = useState(false)
  const [contaOggi, setContaOggi] = useState(0)   // 14/10/2026: voci ancora da fare nella pagina "Oggi da fare"
  const [pos, setPos] = useState(null)
  const finestra = useRef(null)
  const trascina = useRef(null)

  // posizione iniziale (o l'ultima scelta), sempre dentro lo schermo
  useEffect(() => {
    let p = null
    try { p = JSON.parse(localStorage.getItem('profittracker_oggi_pos') || 'null') } catch {}
    const w = typeof window !== 'undefined' ? window.innerWidth : 1200
    setPos(p && Number.isFinite(p.x) && Number.isFinite(p.y) ? { x: Math.min(Math.max(0, p.x), Math.max(0, w - 120)), y: Math.max(0, p.y) } : { x: Math.max(12, Math.round(w / 2 - 320)), y: 90 })
  }, [])

  // controlla se c'è qualcosa da fare (le sezioni dentro si aggiornano da sole: promo, mirate...)
  useEffect(() => {
    const el = finestra.current
    if (!el) return
    const controlla = () => setDaFare(!!el.querySelector('[data-da-fare="1"]'))
    controlla()
    let obs = null
    if (typeof MutationObserver !== 'undefined') { obs = new MutationObserver(controlla); obs.observe(el, { subtree: true, childList: true, attributes: true, attributeFilter: ['data-da-fare'] }) }
    const t = setInterval(controlla, 30000)
    return () => { if (obs) obs.disconnect(); clearInterval(t) }
  }, [attiva])

  // contatore sul tastino: se la pagina "Oggi da fare" è stata aperta oggi vale il suo numero (tolte fatte e rimandate),
  // altrimenti le voci della fotografia che il Profit Tracker prepara. Si aggiorna da solo anche quando lavori nell'altra scheda.
  useEffect(() => {
    const leggi = () => {
      const oggiIso = new Date().toLocaleDateString('sv-SE')
      let n = 0
      try {
        const c = JSON.parse(localStorage.getItem('profittracker_oggi_conteggio') || 'null')
        const f = JSON.parse(localStorage.getItem('profittracker_oggi_da_fare') || 'null')
        if (c && c.giorno === oggiIso && Number.isFinite(c.n) && (!f || !f.aggiornato || String(c.aggiornato) >= String(f.aggiornato))) n = c.n
        else if (f && f.giorno === oggiIso && Array.isArray(f.voci)) n = f.voci.filter(v => !v.fatta).length
      } catch {}
      setContaOggi(n)
    }
    leggi()
    const su = (e) => { if (e.key === null || e.key === 'profittracker_oggi_conteggio' || e.key === 'profittracker_oggi_da_fare') leggi() }
    window.addEventListener('storage', su)
    window.addEventListener('focus', leggi)
    const t = setInterval(leggi, 20000)
    return () => { window.removeEventListener('storage', su); window.removeEventListener('focus', leggi); clearInterval(t) }
  }, [])

  useEffect(() => {
    if (!aperta) return
    const esc = e => { if (e.key === 'Escape') setAperta(false) }
    window.addEventListener('keydown', esc)
    return () => window.removeEventListener('keydown', esc)
  }, [aperta])

  if (!attiva) return <>{children}</>

  const inizia = e => {
    if (e.target.closest && e.target.closest('button')) return   // il ✕ non avvia il trascinamento
    const p = pos || { x: 0, y: 0 }
    trascina.current = { dx: e.clientX - p.x, dy: e.clientY - p.y }
    try { e.currentTarget.setPointerCapture(e.pointerId) } catch {}
    e.preventDefault()
  }
  const muovi = e => {
    const t = trascina.current
    if (!t) return
    const w = window.innerWidth, h = window.innerHeight
    setPos({ x: Math.min(Math.max(-200, e.clientX - t.dx), w - 120), y: Math.min(Math.max(0, e.clientY - t.dy), h - 50) })
  }
  const fine = e => {
    if (!trascina.current) return
    trascina.current = null
    try { e.currentTarget.releasePointerCapture(e.pointerId) } catch {}
    try { if (pos) localStorage.setItem('profittracker_oggi_pos', JSON.stringify(pos)) } catch {}
  }

  return (
    <>
      <style>{`@keyframes oggiGiallo { 0%,100% { background: rgba(250,204,21,.18); box-shadow: 0 0 0 0 rgba(250,204,21,0); border-color: rgba(250,204,21,.7); color: #fde68a } 50% { background: rgba(250,204,21,.95); box-shadow: 0 0 16px 3px rgba(250,204,21,.6); border-color: #fde047; color: #1c1917 } } .oggi-lampeggia { animation: oggiGiallo 1.1s ease-in-out infinite }`}</style>
      {/* 14/10/2026: il tastino apre in una nuova scheda la lista completa di oggi (promo, avvisi, bet, incroci, Masaniello, Live, mirate, conti) con Fatto / Rimanda e prepara le bet se non sono già pronte.
          La finestra mobile di prima (Lucy Trading, promo in scadenza, profilazioni mirate) resta nel bottone accanto. */}
      <button type="button" onClick={() => { apriOggiDaFare().catch(() => { try { window.open('/profit-tracker/da-fare', '_blank') } catch {} }) ; try { if (onApri) onApri() } catch {} }} className={daFare || contaOggi > 0 ? 'oggi-lampeggia' : undefined}
        title={daFare || contaOggi > 0 ? 'Ci sono cose da fare oggi: apri la lista completa in una nuova scheda' : 'Apre in una nuova scheda tutto quello che c\'è da fare oggi, con Fatto e Rimanda'}
        style={{ padding: '10px 16px', borderRadius: 12, border: '1px solid rgba(71,85,105,0.9)', background: 'rgba(15,23,42,0.75)', color: '#e2e8f0', fontWeight: 900, fontSize: 14, cursor: 'pointer' }}>
        📋 Oggi da fare{contaOggi > 0 ? <span style={{ marginLeft: 8, background: '#ef4444', color: 'white', borderRadius: 999, padding: '1px 8px', fontSize: 12, fontWeight: 900 }}>{contaOggi}</span> : null}
      </button>
      <button type="button" onClick={() => setAperta(v => !v)}
        title="Finestra rapida: Lucy Trading, promo in scadenza e profilazioni mirate"
        style={{ padding: '10px 12px', borderRadius: 12, border: '1px solid rgba(71,85,105,0.9)', background: aperta ? 'rgba(56,189,248,.18)' : 'rgba(15,23,42,0.75)', color: '#cbd5e1', fontWeight: 800, fontSize: 13, cursor: 'pointer' }}>
        🪟 Rapido
      </button>
      <div ref={finestra} style={{ display: aperta ? 'block' : 'none', position: 'fixed', left: pos ? pos.x : 20, top: pos ? pos.y : 90, zIndex: 9000, width: 'min(680px, 96vw)', maxHeight: '78vh', overflow: 'hidden', borderRadius: 14, border: '1px solid rgba(100,116,139,0.8)', background: 'rgba(8,13,28,0.98)', boxShadow: '0 18px 50px rgba(0,0,0,.65)' }}>
        <div onPointerDown={inizia} onPointerMove={muovi} onPointerUp={fine} onPointerCancel={fine}
          style={{ cursor: 'move', touchAction: 'none', userSelect: 'none', display: 'flex', alignItems: 'center', gap: 10, padding: '9px 12px', background: 'rgba(30,41,59,0.95)', borderBottom: '1px solid rgba(71,85,105,0.8)', color: '#e2e8f0', fontWeight: 900, fontSize: 13 }}>
          <span>📋 Oggi</span>
          <span style={{ color: '#64748b', fontWeight: 600, fontSize: 11.5 }}>Lucy Trading · promo in scadenza · profilazioni mirate</span>
          <span style={{ marginLeft: 'auto', color: '#64748b', fontSize: 11, fontWeight: 600 }}>trascina per spostare</span>
          <button type="button" onClick={() => setAperta(false)} title="Chiudi" style={{ border: '1px solid rgba(148,163,184,.5)', background: 'rgba(15,23,42,.8)', color: '#e2e8f0', borderRadius: 8, padding: '2px 10px', fontWeight: 900, cursor: 'pointer' }}>✕</button>
        </div>
        <div style={{ padding: 12, overflowY: 'auto', maxHeight: 'calc(78vh - 48px)' }}>{children}</div>
      </div>
    </>
  )
}

/* ---------- elenco che mostra solo le prime righe ---------- */
export function ListaCompatta({ max = 3, children }) {
  const [tutti, setTutti] = useState(false)
  const voci = Children.toArray(children)
  if (!max || voci.length <= max) return <>{voci}</>
  return (
    <>
      {(tutti ? voci : voci.slice(0, max))}
      <button onClick={() => setTutti(v => !v)}
        style={{ marginTop: 6, padding: '3px 12px', borderRadius: 8, border: '1px solid rgba(252,165,165,0.5)', background: 'rgba(252,165,165,0.1)', color: '#fca5a5', fontWeight: 800, fontSize: 12, cursor: 'pointer' }}>
        {tutti ? '▲ mostra meno' : `▼ mostra tutti (${voci.length})`}
      </button>
    </>
  )
}
