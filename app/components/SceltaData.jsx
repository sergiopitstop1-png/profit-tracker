"use client";
// 14/10/2026 · Finestra unica per scegliere una data (rimandare, fissare la prossima…): calendario vero + giorno della settimana
// per esteso + pulsanti dei prossimi 14 giorni. Si usa al posto delle finestrelle in cui scrivere la data a mano.
// props: titolo, sottotitolo, valore (AAAA-MM-GG), minimo (default oggi), etichettaAuto (se c'è, mostra il tasto per togliere la data),
//        onConferma(iso | null), onAnnulla()
import React, { useState } from 'react'

const oggiRoma = () => new Date().toLocaleDateString('sv-SE', { timeZone: 'Europe/Rome' })
const piuGiorni = (iso, n) => { const d = new Date(iso + 'T12:00:00'); d.setDate(d.getDate() + n); return d.toLocaleDateString('sv-SE') }
export const giornoLungo = (iso) => iso ? new Date(iso + 'T12:00:00').toLocaleDateString('it-IT', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' }) : ''
const giornoBreve = (iso) => new Date(iso + 'T12:00:00').toLocaleDateString('it-IT', { weekday: 'short', day: '2-digit', month: '2-digit' })
const btn = (bg, on = true) => ({ background: on ? bg : '#334155', color: 'white', border: 0, borderRadius: 8, padding: '5px 10px', fontWeight: 800, fontSize: 12, cursor: on ? 'pointer' : 'default' })

export default function SceltaData({ titolo, sottotitolo, valore, minimo, etichettaAuto, onConferma, onAnnulla }) {
  const oggi = oggiRoma()
  const min = minimo || oggi
  const [v, setV] = useState(valore && valore >= min ? valore : '')
  const valida = !!v && v >= min
  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 10000, background: 'rgba(0,0,0,0.65)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }} onClick={onAnnulla}>
      <div style={{ width: 'min(520px, 100%)', background: '#0f172a', border: '1px solid rgba(250,204,21,0.5)', borderRadius: 14, padding: 16, color: '#e2e8f0' }} onClick={e => e.stopPropagation()}>
        <div style={{ fontWeight: 900, fontSize: 15, color: '#fde047', marginBottom: 2 }}>{titolo}</div>
        <div style={{ fontSize: 12, color: '#94a3b8', marginBottom: 10 }}>{sottotitolo ? `${sottotitolo} ` : ''}Oggi è {giornoLungo(oggi)}.</div>
        <input type="date" min={min} value={v} onChange={e => setV(e.target.value)}
          style={{ background: '#0b1220', color: '#f8fafc', border: '1px solid #475569', borderRadius: 8, padding: '8px 10px', fontSize: 16, colorScheme: 'dark', width: '100%' }} />
        <div style={{ marginTop: 8, fontSize: 15, fontWeight: 800, color: valida ? '#86efac' : '#64748b', minHeight: 22 }}>{valida ? `➜ ${giornoLungo(v)}` : 'nessun giorno scelto'}</div>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginTop: 10 }}>
          {Array.from({ length: 14 }, (_, i) => piuGiorni(oggi, i + 1)).filter(iso => iso >= min).map(iso => (
            <button key={iso} onClick={() => setV(iso)}
              style={{ ...btn(v === iso ? '#7c3aed' : '#1e293b'), border: `1px solid ${v === iso ? '#a78bfa' : '#334155'}`, textTransform: 'capitalize' }}>{giornoBreve(iso)}</button>))}
        </div>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginTop: 14 }}>
          <button disabled={!valida} onClick={() => onConferma(v)} style={{ ...btn('#059669', valida), padding: '7px 14px' }}>✓ Conferma questa data</button>
          {etichettaAuto && <button onClick={() => onConferma(null)} style={btn('#64748b')}>{etichettaAuto}</button>}
          <button onClick={onAnnulla} style={{ ...btn('#475569'), marginLeft: 'auto' }}>Annulla</button>
        </div>
      </div>
    </div>
  )
}
