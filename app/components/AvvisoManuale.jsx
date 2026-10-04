"use client";
// ════════════════════════════════════════════════════════════════════
// 📘 TESTO SCORREVOLE IN CIMA AL PROFIT TRACKER (03/10/2026)
// Cliccandolo si apre il manuale operativo (/profit-tracker/manuale).
// Si può nascondere per 7 giorni con ✕. Si ferma passandoci sopra.
// Per un messaggio nuovo: cambia TESTO e VERSIONE (riappare a tutti).
// ════════════════════════════════════════════════════════════════════
import React, { useEffect, useState } from 'react'
import Link from 'next/link'

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
    <Link href="/profit-tracker/manuale" target="_blank" rel="noopener" title="Apri il manuale operativo"
      className="pt-matrix-alert"
      style={{ display: 'flex', alignItems: 'center', gap: 10, textDecoration: 'none', background: '#020804', border: '1px solid #00ff66', borderRadius: 8, padding: '7px 10px', margin: '0 0 12px', overflow: 'hidden', boxShadow: '0 0 10px rgba(0,255,102,.28), inset 0 0 16px rgba(0,255,102,.05)', position: 'relative' }}>
      <style>{`
        @keyframes ptScorri{from{transform:translateX(0)}to{transform:translateX(-100%)}}
        @keyframes ptMatrixPulse{0%,100%{opacity:.45}50%{opacity:1}}
        @keyframes ptMatrixScan{0%{transform:translateX(-120%)}100%{transform:translateX(120%)}}
        .pt-scorri:hover span{animation-play-state:paused}
        .pt-matrix-alert:before{content:"01001101 01000001 01010100 01010010 01001001 01011000";position:absolute;inset:0;color:rgba(0,255,102,.055);font-family:monospace;font-size:10px;letter-spacing:5px;line-height:28px;overflow:hidden;pointer-events:none}
        .pt-matrix-alert:after{content:"";position:absolute;top:0;bottom:0;width:22%;background:linear-gradient(90deg,transparent,rgba(0,255,102,.08),transparent);animation:ptMatrixScan 6s linear infinite;pointer-events:none}
      `}</style>
      <div style={{ color: '#00ff66', fontFamily: 'monospace', fontWeight: 900, fontSize: 14, textShadow: '0 0 8px #00ff66', animation: 'ptMatrixPulse 1.8s ease-in-out infinite', flex: '0 0 auto', zIndex: 1 }}>[ PT:// ]</div>
      <div className="pt-scorri" style={{ flex: 1, overflow: 'hidden', whiteSpace: 'nowrap', zIndex: 1 }}>
        <span style={{ display: 'inline-block', paddingLeft: '100%', animation: 'ptScorri 28s linear infinite', color: '#7CFF9B', textShadow: '0 0 7px rgba(0,255,102,.8)', fontFamily: 'monospace', fontWeight: 800, fontSize: 13, letterSpacing: '.25px' }}>{TESTO}</span>
      </div>
      <button onClick={nascondi} title="Nascondi per 7 giorni" style={{ background: 'rgba(0,255,102,.06)', border: '1px solid rgba(0,255,102,.35)', borderRadius: 5, color: '#00ff66', textShadow: '0 0 6px #00ff66', fontFamily: 'monospace', fontSize: 13, cursor: 'pointer', flex: '0 0 auto', zIndex: 2 }}>✕</button>
    </Link>
  )
}
