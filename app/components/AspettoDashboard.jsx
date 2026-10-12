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

const CHIAVE = 'profittracker_aspetto_v1'
export const ASPETTO_PREDEFINITO = { numeriSu: true, oggiUnico: true, rossoCompatto: true, pulsantiGruppi: true, headerCompatto: true }
const VOCI = [
  ['numeriSu', '💶 Numeri in alto', 'Panoramica, Cassa e Accantonamenti subito sotto la barra; gli avvisi vanno sotto'],
  ['oggiUnico', '📋 Strisce in una scheda "Oggi"', 'Quote, Lucy Trading, promo in scadenza e profilazioni mirate raccolte in un riquadro che si chiude'],
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
  ['lucy-mail', '📬 Lucy Mail'], ['segnali', '📡 Segnali'],
]
const GRUPPI = [
  { id: 'soldi', nome: '💰 Soldi', voci: [['accantonamenti', '💰 Accantonamenti'], ['wallets', 'Wallets'], ['transactions', 'Transactions'], ['periodi', 'Periodi'], ['punti-monete', '🏆 Punti & Monete'], ['stime-cassa', 'Contabilità']] },
  { id: 'conti', nome: '🗂 Conti e team', voci: [['matrice', 'Matrice'], ['credenziali', '🔑 Credenziali'], ['team', '👥 Team']] },
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

/* ---------- scheda "Oggi" che raccoglie le strisce ---------- */
export function OggiCard({ children, attiva }) {
  const [aperta, setAperta] = useState(true)
  useEffect(() => { try { const v = localStorage.getItem('profittracker_oggi_card'); if (v != null) setAperta(v === '1') } catch {} }, [])
  const cambia = () => setAperta(v => { const n = !v; try { localStorage.setItem('profittracker_oggi_card', n ? '1' : '0') } catch {} return n })
  if (!attiva) return <>{children}</>
  return (
    <div style={{ border: '1px solid rgba(71,85,105,0.7)', borderRadius: 14, background: 'rgba(15,23,42,0.55)', padding: '8px 12px', marginBottom: 12 }}>
      <div onClick={cambia} style={{ cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 10, color: '#e2e8f0', fontWeight: 900, fontSize: 13 }}>
        <span>📋 Oggi</span>
        <span style={{ color: '#64748b', fontWeight: 600, fontSize: 11.5 }}>Lucy Trading · promo in scadenza · profilazioni mirate</span>
        <span style={{ marginLeft: 'auto', color: '#94a3b8', fontSize: 12 }}>{aperta ? '▲ chiudi' : '▼ apri'}</span>
      </div>
      {/* resta montata anche da chiusa: i pannelli continuano a caricarsi e a lampeggiare dentro le loro sezioni */}
      <div style={{ display: aperta ? 'block' : 'none', marginTop: 8 }}>{children}</div>
    </div>
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
