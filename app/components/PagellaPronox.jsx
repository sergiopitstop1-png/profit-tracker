"use client";
// ════════════════════════════════════════════════════════════════════
// PAGELLA PRONOX (01/10/2026)
// Confronta le fotografie dei pronostici con gli esiti reali.
// Domanda a cui risponde: "quando PronoX dice 70%, succede davvero 7 volte su 10?"
// e "PronoX fa meglio di un pronostico ingenuo (la media storica)?".
// I dati arrivano dalle funzioni SQL pronox_pagella_mercati / _fasce
// (vedi pronox_pagella.sql). Il confronto con le quote arriverà con Betfair.
// ════════════════════════════════════════════════════════════════════
import React, { useState, useEffect, useCallback, useMemo } from 'react'
import { supabase } from '../profit-tracker/supabaseClient'
import { FOOTBALL_MARKETS } from '../../lib/pronox/footballModel'

const MIN_ESITI = 100 // sotto questa soglia il giudizio non è affidabile
const ETICHETTE = new Map(FOOTBALL_MARKETS.map(m => [m.id, m.label]))
ETICHETTE.set('BTTS|yes', 'Goal (entrambe segnano)')
const VERSIONI = { '': 'Tutte le versioni', dc_v2_raw: 'Modello grezzo', dc_v2_cal: 'Calibrato (quello di /oggi)', dc_v2_mk_v1: 'Nuovi mercati' }
const nomeVersione = (v) => VERSIONI[v] || v
const pct = (x, d = 1) => (Number(x) * 100).toFixed(d).replace('.', ',') + '%'

// giudizio di un mercato (esportato per i test)
export function giudica(r) {
  const n = Number(r.n), p = Number(r.prob_media), f = Number(r.freq_reale)
  const scarto = f - p
  const rumore = 1.96 * Math.sqrt(Math.max(p * (1 - p), 0.0001) / Math.max(n, 1))
  const bi = Number(r.brier_ingenuo)
  const skill = bi > 0 ? 1 - Number(r.brier) / bi : 0
  let voto
  if (n < MIN_ESITI) voto = { icona: '⏳', testo: `pochi dati (${n}/${MIN_ESITI})`, colore: '#94a3b8' }
  else if (scarto < -rumore) voto = { icona: '🔴', testo: 'troppo ottimista', colore: '#f87171' }
  else if (scarto > rumore) voto = { icona: '🟡', testo: 'troppo prudente', colore: '#fbbf24' }
  else if (skill > 0) voto = { icona: '🟢', testo: 'affidabile', colore: '#4ade80' }
  else voto = { icona: '⚪', testo: 'onesto ma non aggiunge nulla', colore: '#cbd5e1' }
  return { scarto, rumore, skill, voto }
}

export default function PagellaPronox({ onError }) {
  const [periodo, setPeriodo] = useState('tutto')
  const [versione, setVersione] = useState('')
  const [mercati, setMercati] = useState([])
  const [fasce, setFasce] = useState([])
  const [carico, setCarico] = useState(false)
  const [errore, setErrore] = useState('')

  const carica = useCallback(async () => {
    setCarico(true); setErrore('')
    const dal = periodo === 'tutto' ? null : new Date(Date.now() - Number(periodo) * 86400000).toLocaleDateString('sv-SE')
    const args = { dal, versione: versione || null }
    const [m, f] = await Promise.all([
      supabase.rpc('pronox_pagella_mercati', args),
      supabase.rpc('pronox_pagella_fasce', args),
    ])
    if (m.error || f.error) {
      const e = (m.error || f.error).message
      setErrore('Pagella non disponibile: lancia pronox_pagella.sql in Supabase (' + e + ')')
      if (onError) onError(e)
    } else { setMercati(m.data || []); setFasce(f.data || []) }
    setCarico(false)
  }, [periodo, versione])
  useEffect(() => { carica() }, [carica])

  const righe = useMemo(() => mercati.map(r => ({ ...r, ...giudica(r) }))
    .sort((a, b) => Number(b.n) - Number(a.n)), [mercati])
  const totale = righe.reduce((a, r) => a + Number(r.n), 0)

  // fasce aggregate su tutte le versioni scelte
  const perFascia = useMemo(() => {
    const m = new Map()
    for (const r of fasce) {
      const k = Number(r.fascia)
      const x = m.get(k) || { fascia: k, n: 0, sp: 0, sf: 0 }
      x.n += Number(r.n); x.sp += Number(r.prob_media) * Number(r.n); x.sf += Number(r.freq_reale) * Number(r.n)
      m.set(k, x)
    }
    return [...m.values()].map(x => ({ fascia: x.fascia, n: x.n, previsto: x.sp / x.n, reale: x.sf / x.n })).sort((a, b) => a.fascia - b.fascia)
  }, [fasce])
  const recupero = perFascia.filter(x => x.fascia >= 0.6 && x.fascia < 0.75)
    .reduce((a, x) => ({ n: a.n + x.n, sp: a.sp + x.previsto * x.n, sf: a.sf + x.reale * x.n }), { n: 0, sp: 0, sf: 0 })

  // grafico di calibrazione
  const W = 320, H = 240, P = 30
  const X = (v) => P + v * (W - 2 * P), Y = (v) => H - P - v * (H - 2 * P)
  const maxN = Math.max(1, ...perFascia.map(x => x.n))

  const sel = { background: '#0b1220', color: '#f8fafc', border: '1px solid #334155', borderRadius: 8, padding: '5px 8px', fontSize: 12 }
  const th = { textAlign: 'left', padding: '5px 8px', color: '#94a3b8', fontSize: 11, fontWeight: 800, borderBottom: '1px solid #334155', whiteSpace: 'nowrap' }
  const td = { padding: '5px 8px', fontSize: 12, color: '#e2e8f0', borderBottom: '1px solid rgba(51,65,85,.5)', whiteSpace: 'nowrap' }

  return (
    <div style={{ background: 'rgba(99,102,241,0.07)', border: '1px solid rgba(99,102,241,0.35)', borderRadius: 16, padding: '14px 16px' }}>
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center', marginBottom: 10 }}>
        <select style={sel} value={periodo} onChange={e => setPeriodo(e.target.value)}>
          <option value="30">Ultimi 30 giorni</option>
          <option value="90">Ultimi 90 giorni</option>
          <option value="tutto">Tutto lo storico</option>
        </select>
        <select style={sel} value={versione} onChange={e => setVersione(e.target.value)}>
          {Object.entries(VERSIONI).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
        </select>
        <button onClick={carica} style={{ ...sel, cursor: 'pointer', fontWeight: 800 }}>↻ Aggiorna</button>
        <span style={{ fontSize: 12, color: '#94a3b8' }}>{carico ? 'carico…' : `${totale.toLocaleString('it-IT')} esiti decisi`}</span>
      </div>

      {errore && <div style={{ color: '#fca5a5', fontSize: 12, marginBottom: 8 }}>{errore}</div>}
      {!errore && !carico && totale === 0 && (
        <div style={{ color: '#94a3b8', fontSize: 13 }}>Ancora nessun esito: la pagella si riempie da sola dopo le partite fotografate (servono almeno {MIN_ESITI} esiti per mercato per un giudizio affidabile).</div>
      )}

      {totale > 0 && (
        <>
          {recupero.n > 0 && (
            <div style={{ fontSize: 13, color: '#e2e8f0', marginBottom: 10, padding: '8px 10px', borderRadius: 10, background: 'rgba(52,211,153,.08)', border: '1px solid rgba(52,211,153,.35)' }}>
              🎯 <b>Fascia del recupero</b> (probabilità 60-75%, quote circa 1,33-1,67): PronoX prevede in media <b>{pct(recupero.sp / recupero.n)}</b>, è successo nel <b>{pct(recupero.sf / recupero.n)}</b> dei casi, su {recupero.n} esiti
              {recupero.n < MIN_ESITI ? ' — ancora pochi per giudicare.' : (recupero.sf / recupero.n) < (recupero.sp / recupero.n) - 0.03 ? ' — PronoX è troppo ottimista qui: alza la quota minima.' : ' — coerente.'}
            </div>
          )}

          <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap', alignItems: 'flex-start' }}>
            <div style={{ overflowX: 'auto', flex: '1 1 520px' }}>
              <table style={{ borderCollapse: 'collapse', width: '100%' }}>
                <thead><tr>
                  <th style={th}>Mercato</th><th style={th}>Versione</th><th style={th}>Esiti</th>
                  <th style={th}>Previsto</th><th style={th}>Reale</th><th style={th} title="Reale meno previsto, con il margine dovuto al caso">Scarto</th>
                  <th style={th} title="Quanto PronoX sbaglia meno di chi pronostica sempre la media storica (Brier)">vs ingenuo</th><th style={th}>Giudizio</th>
                </tr></thead>
                <tbody>
                  {righe.map(r => (
                    <tr key={`${r.model_version}|${r.market}|${r.selection}`}>
                      <td style={td}>{ETICHETTE.get(`${r.market}|${r.selection}`) || `${r.market} ${r.selection}`}</td>
                      <td style={{ ...td, color: '#94a3b8' }}>{nomeVersione(r.model_version)}</td>
                      <td style={td}>{r.n}</td>
                      <td style={td}>{pct(r.prob_media)}</td>
                      <td style={td}>{pct(r.freq_reale)}</td>
                      <td style={{ ...td, color: Math.abs(r.scarto) > r.rumore ? '#fca5a5' : '#94a3b8' }}>{r.scarto >= 0 ? '+' : ''}{(r.scarto * 100).toFixed(1).replace('.', ',')} <span style={{ fontSize: 10 }}>± {(r.rumore * 100).toFixed(1).replace('.', ',')}</span></td>
                      <td style={{ ...td, color: r.skill > 0 ? '#86efac' : '#fca5a5' }}>{r.skill >= 0 ? '+' : ''}{(r.skill * 100).toFixed(1).replace('.', ',')}%</td>
                      <td style={{ ...td, color: r.voto.colore, fontWeight: 800 }}>{r.voto.icona} {r.voto.testo}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div style={{ flex: '0 0 auto' }}>
              <svg width={W} height={H} style={{ background: 'rgba(15,23,42,.6)', borderRadius: 10 }}>
                <rect x={X(0.6)} y={Y(1)} width={X(0.75) - X(0.6)} height={Y(0) - Y(1)} fill="rgba(52,211,153,.10)" />
                <line x1={X(0)} y1={Y(0)} x2={X(1)} y2={Y(1)} stroke="#475569" strokeDasharray="4 4" />
                <line x1={X(0)} y1={Y(0)} x2={X(1)} y2={Y(0)} stroke="#334155" />
                <line x1={X(0)} y1={Y(0)} x2={X(0)} y2={Y(1)} stroke="#334155" />
                {[0, 0.25, 0.5, 0.75, 1].map(v => <text key={'x' + v} x={X(v)} y={H - 10} fill="#64748b" fontSize="10" textAnchor="middle">{v * 100}%</text>)}
                {[0.5, 1].map(v => <text key={'y' + v} x={8} y={Y(v) + 3} fill="#64748b" fontSize="10">{v * 100}%</text>)}
                {perFascia.map(x => (
                  <circle key={x.fascia} cx={X(x.previsto)} cy={Y(x.reale)} r={3 + 7 * Math.sqrt(x.n / maxN)}
                    fill={Math.abs(x.reale - x.previsto) <= 1.96 * Math.sqrt(x.previsto * (1 - x.previsto) / x.n) ? '#818cf8' : '#f87171'} opacity="0.85">
                    <title>{`Previsto ${pct(x.previsto)} · reale ${pct(x.reale)} · ${x.n} esiti`}</title>
                  </circle>
                ))}
              </svg>
              <div style={{ fontSize: 11, color: '#94a3b8', maxWidth: W, marginTop: 4 }}>
                Previsto (orizzontale) contro reale (verticale). Più i punti stanno sulla diagonale, più PronoX è affidabile. In rosso le fasce fuori dal margine del caso; in verde la zona del recupero.
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  )
}
