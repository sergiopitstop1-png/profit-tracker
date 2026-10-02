"use client";
// ════════════════════════════════════════════════════════════════════
// 📘 TESTO SCORREVOLE IN CIMA AL PROFIT TRACKER (03/10/2026)
// Cliccandolo si apre il manuale operativo (/profit-tracker/manuale).
// Si può nascondere per 7 giorni con ✕. Si ferma passandoci sopra.
// Per un messaggio nuovo: cambia TESTO e VERSIONE (riappare a tutti).
// ════════════════════════════════════════════════════════════════════
import React, { useEffect, useState } from 'react'

const TESTO = '📘 È disponibile il MANUALE OPERATIVO di ProfitTracker · Lucy · PronoX: Prepara bet, Archivio operazioni, sessioni live, regole di mantenimento e routine consigliate — clicca qui per aprirlo'
const VERSIONE = 'manuale-2026-10-02'
const CHIAVE = 'profittracker_avviso_nascosto'

export default function AvvisoManuale() {
  const [visibile, setVisibile] = useState(false)
  useEffect(() => {
    try {
      const v = JSON.parse(localStorage.getItem(CHIAVE) || 'null')
      setVisibile(!(v && v.versione === VERSIONE && Date.now() < v.fino))
    } catch { setVisibile(true) }
  }, [])
  if (!visibile) return null
  const nascondi = (e) => {
    e.preventDefault(); e.stopPropagation()
    try { localStorage.setItem(CHIAVE, JSON.stringify({ versione: VERSIONE, fino: Date.now() + 7 * 86400000 })) } catch {}
    setVisibile(false)
  }
  return (
    <a href="/profit-tracker/manuale" target="_blank" rel="noopener" title="Apri il manuale operativo"
      style={{ display: 'flex', alignItems: 'center', gap: 10, textDecoration: 'none', background: 'linear-gradient(90deg,#0c4a6e,#1e3a8a)', border: '1px solid #38bdf8', borderRadius: 10, padding: '6px 10px', margin: '0 0 12px', overflow: 'hidden' }}>
      <style>{`@keyframes ptScorri{from{transform:translateX(0)}to{transform:translateX(-100%)}} .pt-scorri:hover span{animation-play-state:paused}`}</style>
      <div className="pt-scorri" style={{ flex: 1, overflow: 'hidden', whiteSpace: 'nowrap' }}>
        <span style={{ display: 'inline-block', paddingLeft: '100%', animation: 'ptScorri 28s linear infinite', color: '#e0f2fe', fontWeight: 800, fontSize: 13 }}>{TESTO}</span>
      </div>
      <button onClick={nascondi} title="Nascondi per 7 giorni" style={{ background: 'transparent', border: 0, color: '#bae6fd', fontSize: 15, cursor: 'pointer', flex: '0 0 auto' }}>✕</button>
    </a>
  )
}
