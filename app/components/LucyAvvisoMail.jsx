"use client";
// ═════════════════════════════════════════════════════════════════
// 🔔 LUCY AVVISO MAIL (07/10/2026)
// Striscia sottile in Dashboard: compare SOLO se ci sono nuove opportunità, bonus accreditati o PROBLEMI
// (mail non ancora lette e non archiviate, ultimi 15 giorni). Scompare da sola quando le apri o le archivi.
// I problemi (KYC, limitazioni, sospensioni, prelievi...) rendono la striscia ambra e il ✕ NON li nasconde.
// Un solo giro di richiesta ogni 90 secondi: /api/lucy-mail/archive?nuove=1
// ✕ nasconde opportunità e accreditati finché non ne arrivano altre.
// ═════════════════════════════════════════════════════════════════
import React, { useCallback, useEffect, useState } from 'react'

const CHIAVE = 'profittracker_lucy_avviso_visto'

const leggiVisto = () => {
  try { const v = JSON.parse(localStorage.getItem(CHIAVE) || 'null'); return v && typeof v === 'object' ? v : { opp: 0, acc: 0 } } catch { return { opp: 0, acc: 0 } }
}
const scriviVisto = (v) => { try { localStorage.setItem(CHIAVE, JSON.stringify(v)) } catch {} }

export default function LucyAvvisoMail() {
  const [n, setN] = useState(null)          // { opportunita, accreditati }
  const [visto, setVisto] = useState({ opp: 0, acc: 0 })

  const carica = useCallback(async () => {
    try {
      const r = await fetch('/api/lucy-mail/archive?nuove=1', { cache: 'no-store' })
      if (!r.ok) return
      const j = await r.json()
      const nuovo = { opportunita: Number(j.opportunita) || 0, accreditati: Number(j.accreditati) || 0, problemi: Number(j.problemi) || 0 }
      setN(nuovo)
      // se i numeri scendono (hai letto/archiviato), "visto" scende con loro: le prossime arrivate si vedranno
      const v = leggiVisto()
      const agg = { opp: Math.min(v.opp || 0, nuovo.opportunita), acc: Math.min(v.acc || 0, nuovo.accreditati) }
      if (agg.opp !== v.opp || agg.acc !== v.acc) scriviVisto(agg)
      setVisto(agg)
    } catch (e) { /* silenzioso: l'avviso è solo un di più */ }
  }, [])

  useEffect(() => {
    carica()
    const t = setInterval(carica, 90 * 1000)
    const onVis = () => { if (document.visibilityState === 'visible') carica() }
    document.addEventListener('visibilitychange', onVis)
    return () => { clearInterval(t); document.removeEventListener('visibilitychange', onVis) }
  }, [carica])

  if (!n) return null
  const mostraOpp = n.opportunita > visto.opp
  const mostraAcc = n.accreditati > visto.acc
  const mostraProb = n.problemi > 0
  if (!mostraOpp && !mostraAcc && !mostraProb) return null
  const conProblemi = mostraProb
  const colore = conProblemi ? '245,158,11' : '34,197,94'   // ambra con problemi, verde altrimenti

  const vai = (vista) => { window.location.href = '/profit-tracker/archivio-lucy?vista=' + vista }
  const chip = { cursor: 'pointer', background: 'transparent', border: 'none', color: '#e2e8f0', fontSize: 13, fontWeight: 700, padding: 0, whiteSpace: 'nowrap' }

  return (
    <>
      <style>{`
        @keyframes lucyAvvisoPuls { 0%,100% { box-shadow: 0 0 0 0 rgba(${colore},.0); border-color: rgba(${colore},.35) } 50% { box-shadow: 0 0 14px 1px rgba(${colore},${conProblemi ? '.5' : '.35'}); border-color: rgba(${colore},.85) } }
        @keyframes lucyAvvisoPunto { 0%,100% { opacity: 1; transform: scale(1) } 50% { opacity: .35; transform: scale(.7) } }
      `}</style>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap', background: 'rgba(15,23,42,.7)', border: `1px solid rgba(${colore},.5)`, borderRadius: 12, padding: '7px 12px', marginBottom: 12, animation: `lucyAvvisoPuls ${conProblemi ? 1.8 : 2.4}s ease-in-out infinite` }}>
        <span style={{ width: 9, height: 9, borderRadius: '50%', background: conProblemi ? '#f59e0b' : '#22c55e', animation: 'lucyAvvisoPunto 1.2s ease-in-out infinite' }} />
        <span style={{ fontSize: 12, fontWeight: 800, color: conProblemi ? '#fcd34d' : '#86efac' }}>🧠 Lucy</span>
        {mostraProb && (
          <button style={{ ...chip, color: '#fcd34d' }} onClick={() => vai('problemi')} title="Apri i problemi">
            🚨 {n.problemi} {n.problemi === 1 ? 'problema da vedere' : 'problemi da vedere'}
          </button>
        )}
        {mostraOpp && (
          <button style={chip} onClick={() => vai('opportunita')} title="Apri le opportunità">
            🔥 {n.opportunita} {n.opportunita === 1 ? 'nuova opportunità' : 'nuove opportunità'}
          </button>
        )}
        {mostraAcc && (
          <button style={chip} onClick={() => vai('accreditati')} title="Apri i bonus accreditati">
            💰 {n.accreditati} {n.accreditati === 1 ? 'bonus accreditato' : 'bonus accreditati'}
          </button>
        )}
        <span style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 8 }}>
          <button style={{ ...chip, color: conProblemi ? '#fcd34d' : '#86efac', fontSize: 12 }}
            onClick={() => vai(mostraProb ? 'problemi' : mostraOpp ? 'opportunita' : 'accreditati')}>Apri →</button>
          {(mostraOpp || mostraAcc) && (
            <button style={{ ...chip, color: '#64748b', fontSize: 14 }} title="Nascondi opportunità e accreditati finché non ne arrivano altre (i problemi restano)"
              onClick={() => { const v = { opp: n.opportunita, acc: n.accreditati }; scriviVisto(v); setVisto(v) }}>✕</button>
          )}
        </span>
      </div>
    </>
  )
}
