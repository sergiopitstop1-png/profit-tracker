'use client'
// ════════════════════════════════════════════════════════════════════
// 📈 ANALISI SEGNALI · ScoreTrend, Hunterbet e PronoX (04/10/2026)
// Colpo d'occhio (torte), segmenti con margine d'errore, tempo al gol,
// simulazione della cassa e verifica su dati nuovi (prima metà / seconda metà).
// Legge scoretrend_segnali, hunterbet_segnali e la vista pronox_segnali (solo lettura).
// 04/10/2026: PronoX come terzo canale + calibrazione (grezza / calibrata / bookmaker,
// Brier score) + confronto dei tre canali con le stesse regole.
// ════════════════════════════════════════════════════════════════════
import { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { supabase } from '../../supabaseClient'

type Gol = { m: number; s: 'casa' | 'ospite'; autogol?: boolean }
type Riga = { id: number; data: string; competizione: string; esito: string | null; quota: number | null; profitto: number | null; unita: number
  live: string; minuto: number | null; mercato: string; casaOspiti: string | null; risultato: string | null; minutiAlGol: number | null
  tipo: string; ht: [number, number] | null; ft: [number, number] | null; gol: Gol[] | null
  pG?: number | null; pC?: number | null; pM?: number | null; value?: boolean; forte?: boolean }
type Canale = 'scoretrend' | 'hunterbet' | 'pronox' | 'tennis'
const NOMI: Record<Canale, string> = { scoretrend: 'ScoreTrend', hunterbet: 'Hunterbet', pronox: 'PronoX', tennis: 'PronoX 🎾 Tennis' }

// ─── 04/10/2026 · DOVE FINISCONO I SEGNALI: mercati verificati sul risultato vero della partita ───
type Mercato = { id: string; gruppo: string; test: (r: Riga) => boolean | null }
const ft = (r: Riga) => r.ft, ht = (r: Riga) => r.ht
const sTot = (x: [number, number]) => x[0] + x[1]
// gol dopo il segnale: solo se la lista dei gol è completa (stesso numero del risultato finale)
const dopo = (r: Riga) => (r.ft && r.gol && r.gol.length === sTot(r.ft)) ? r.gol.filter(g => g.m > (r.minuto ?? 0)) : null
const M = (id: string, gruppo: string, test: (r: Riga) => boolean | null): Mercato => ({ id, gruppo, test })
const conFT = (f: (h: number, a: number) => boolean) => (r: Riga) => r.ft ? f(r.ft[0], r.ft[1]) : null
const conHT = (f: (h: number, a: number) => boolean) => (r: Riga) => r.ht ? f(r.ht[0], r.ht[1]) : null
const MERCATI: Mercato[] = [
  M('1', 'Finale', conFT((h, a) => h > a)), M('X', 'Finale', conFT((h, a) => h === a)), M('2', 'Finale', conFT((h, a) => h < a)),
  M('1X', 'Finale', conFT((h, a) => h >= a)), M('X2', 'Finale', conFT((h, a) => h <= a)), M('12', 'Finale', conFT((h, a) => h !== a)),
  M('Over 0,5', 'Finale', conFT((h, a) => h + a >= 1)), M('Over 1,5', 'Finale', conFT((h, a) => h + a >= 2)), M('Over 2,5', 'Finale', conFT((h, a) => h + a >= 3)),
  M('Over 3,5', 'Finale', conFT((h, a) => h + a >= 4)), M('Under 2,5', 'Finale', conFT((h, a) => h + a <= 2)), M('Under 3,5', 'Finale', conFT((h, a) => h + a <= 3)),
  M('Goal', 'Finale', conFT((h, a) => h > 0 && a > 0)), M('No Goal', 'Finale', conFT((h, a) => !(h > 0 && a > 0))),
  M('Segna casa', 'Finale', conFT(h => h > 0)), M('Segna ospite', 'Finale', conFT((h, a) => a > 0)),
  M('Multigol 1-3', 'Finale', conFT((h, a) => h + a >= 1 && h + a <= 3)), M('Multigol 2-4', 'Finale', conFT((h, a) => h + a >= 2 && h + a <= 4)),
  M('1 + Over 1,5', 'Finale', conFT((h, a) => h > a && h + a >= 2)), M('1X + Over 1,5', 'Finale', conFT((h, a) => h >= a && h + a >= 2)),
  M('Over 0,5 1°T', '1° tempo', conHT((h, a) => h + a >= 1)), M('Over 1,5 1°T', '1° tempo', conHT((h, a) => h + a >= 2)),
  M('1°T: 1', '1° tempo', conHT((h, a) => h > a)), M('1°T: X', '1° tempo', conHT((h, a) => h === a)), M('1°T: 2', '1° tempo', conHT((h, a) => h < a)),
  M('Gol nel 2°T', '2° tempo', r => r.ft && r.ht ? sTot(r.ft) - sTot(r.ht) >= 1 : null),
  M('Over 1,5 nel 2°T', '2° tempo', r => r.ft && r.ht ? sTot(r.ft) - sTot(r.ht) >= 2 : null),
  M('Almeno 1 gol dopo il segnale', 'Dopo il segnale', r => { const d = dopo(r); return d ? d.length >= 1 : null }),
  M('Almeno 2 gol dopo il segnale', 'Dopo il segnale', r => { const d = dopo(r); return d ? d.length >= 2 : null }),
  M('Segna casa dopo il segnale', 'Dopo il segnale', r => { const d = dopo(r); return d ? d.some(g => g.s === 'casa') : null }),
  M('Segna ospite dopo il segnale', 'Dopo il segnale', r => { const d = dopo(r); return d ? d.some(g => g.s === 'ospite') : null }),
]
const MAPPA = ['Over 1,5', 'Over 2,5', 'Goal', 'Over 0,5 1°T', 'Gol nel 2°T', '1', 'X', '2', 'Almeno 1 gol dopo il segnale']
const simNome = (a: string, b: string) => { const n = (x: string) => x.toLowerCase().normalize('NFD').replace(/[^a-z0-9 ]/g, ' ').trim(); const A = n(a), B = n(b); return !!A && !!B && (A === B || A.includes(B) || B.includes(A)) }

const MIN_N = 20 // sotto questa soglia un segmento è "pochi dati"
const COLORI = ['#38bdf8', '#a78bfa', '#f472b6', '#fbbf24', '#34d399', '#f87171', '#60a5fa', '#c084fc', '#fb923c', '#94a3b8']
const pct = (x: number, d = 1) => `${(100 * x).toFixed(d).replace('.', ',')}%`
const n2 = (x: number) => x.toLocaleString('it-IT', { minimumFractionDigits: 2, maximumFractionDigits: 2 })

// intervallo di Wilson al 95%: la percentuale "vera" sta probabilmente qui dentro
function wilson(v: number, n: number) {
  if (!n) return [0, 0]
  const z = 1.96, p = v / n, d = 1 + z * z / n
  const c = (p + z * z / (2 * n)) / d, m = (z * Math.sqrt(p * (1 - p) / n + z * z / (4 * n * n))) / d
  return [Math.max(0, c - m), Math.min(1, c + m)]
}
const fasciaMinuto = (m: number | null) => m == null ? 'prepartita / n.d.' : m < 15 ? "0-14'" : m < 30 ? "15-29'" : m < 45 ? "30-44'" : m < 60 ? "45-59'" : m < 75 ? "60-74'" : "75'+"
const fasciaQuota = (q: number | null) => q == null ? 'n.d.' : q < 1.4 ? '< 1,40' : q < 1.6 ? '1,40-1,59' : q < 1.8 ? '1,60-1,79' : q < 2.1 ? '1,80-2,09' : '2,10+'
const giorno = (iso: string) => ['Domenica', 'Lunedì', 'Martedì', 'Mercoledì', 'Giovedì', 'Venerdì', 'Sabato'][new Date(iso).getDay()]
const fasciaOra = (iso: string) => { const h = Number(new Date(iso).toLocaleString('it-IT', { timeZone: 'Europe/Rome', hour: '2-digit', hour12: false })); return h < 12 ? 'mattina (0-12)' : h < 17 ? 'pomeriggio (12-17)' : h < 21 ? 'sera (17-21)' : 'notte (21-24)' }

// ─── grafici SVG ─────────────────────────────────────────────────────
function Torta({ fette, titolo }: { fette: { nome: string; valore: number; colore: string }[]; titolo: string }) {
  const tot = fette.reduce((a, f) => a + f.valore, 0)
  let ang = -Math.PI / 2
  const R = 80, r = 48, cx = 95, cy = 95
  const archi = fette.filter(f => f.valore > 0).map(f => {
    const a0 = ang, a1 = ang + (f.valore / (tot || 1)) * Math.PI * 2; ang = a1
    const largo = a1 - a0 > Math.PI ? 1 : 0
    const p = (a: number, rr: number) => `${cx + rr * Math.cos(a)},${cy + rr * Math.sin(a)}`
    const d = a1 - a0 >= Math.PI * 2 - 1e-6
      ? `M ${cx - R},${cy} A ${R},${R} 0 1 1 ${cx + R},${cy} A ${R},${R} 0 1 1 ${cx - R},${cy} M ${cx - r},${cy} A ${r},${r} 0 1 0 ${cx + r},${cy} A ${r},${r} 0 1 0 ${cx - r},${cy}`
      : `M ${p(a0, R)} A ${R},${R} 0 ${largo} 1 ${p(a1, R)} L ${p(a1, r)} A ${r},${r} 0 ${largo} 0 ${p(a0, r)} Z`
    return <path key={f.nome} d={d} fill={f.colore} fillRule="evenodd"><title>{`${f.nome}: ${f.valore} (${pct(f.valore / (tot || 1))})`}</title></path>
  })
  return (
    <div style={{ background: 'rgba(15,23,42,.6)', border: '1px solid #1e293b', borderRadius: 14, padding: 12, display: 'flex', gap: 14, alignItems: 'center', flexWrap: 'wrap' }}>
      <svg width={190} height={190}>{archi}<text x={95} y={92} textAnchor="middle" fill="#f8fafc" fontSize="22" fontWeight="900">{tot}</text><text x={95} y={110} textAnchor="middle" fill="#94a3b8" fontSize="11">segnali</text></svg>
      <div>
        <div style={{ fontWeight: 900, color: '#7dd3fc', marginBottom: 6 }}>{titolo}</div>
        {fette.filter(f => f.valore > 0).map(f => (
          <div key={f.nome} style={{ fontSize: 12.5, color: '#e2e8f0', display: 'flex', gap: 8, alignItems: 'center', marginBottom: 3 }}>
            <span style={{ width: 11, height: 11, borderRadius: 3, background: f.colore, display: 'inline-block' }} />{f.nome}: <b>{f.valore}</b> <span style={{ color: '#94a3b8' }}>({pct(f.valore / (tot || 1))})</span>
          </div>))}
      </div>
    </div>)
}

function Linea({ punti, titolo }: { punti: number[]; titolo: string }) {
  const W = 620, H = 200, P = 30
  if (punti.length < 2) return null
  const min = Math.min(0, ...punti), max = Math.max(0, ...punti), sp = max - min || 1
  const X = (i: number) => P + (i / (punti.length - 1)) * (W - 2 * P), Y = (v: number) => H - P - ((v - min) / sp) * (H - 2 * P)
  const ultimo = punti[punti.length - 1]
  return (
    <div style={{ background: 'rgba(15,23,42,.6)', border: '1px solid #1e293b', borderRadius: 14, padding: 12 }}>
      <div style={{ fontWeight: 900, color: '#7dd3fc', marginBottom: 6 }}>{titolo}</div>
      <svg viewBox={`0 0 ${W} ${H}`} style={{ width: '100%', maxWidth: W }}>
        <line x1={P} x2={W - P} y1={Y(0)} y2={Y(0)} stroke="#475569" strokeDasharray="4 4" />
        <polyline fill="none" stroke={ultimo >= 0 ? '#34d399' : '#f87171'} strokeWidth="2.5" points={punti.map((v, i) => `${X(i)},${Y(v)}`).join(' ')} />
        <text x={P} y={14} fill="#94a3b8" fontSize="11">max {n2(max)}</text><text x={P} y={H - 6} fill="#94a3b8" fontSize="11">min {n2(min)}</text>
        <text x={W - P} y={Y(ultimo) - 6} textAnchor="end" fill={ultimo >= 0 ? '#34d399' : '#f87171'} fontSize="12" fontWeight="900">{ultimo >= 0 ? '+' : ''}{n2(ultimo)}</text>
      </svg>
    </div>)
}

// ─── 04/10/2026 · CALIBRAZIONE PRONOX: quando dice 70%, vince il 70%? ───
type Fonte = { id: 'pG' | 'pC' | 'pM'; nome: string; colore: string }
const FONTI: Fonte[] = [
  { id: 'pG', nome: 'Modello (grezza)', colore: '#38bdf8' },
  { id: 'pC', nome: '/oggi (calibrata)', colore: '#a78bfa' },
  { id: 'pM', nome: 'Bookmaker (senza margine)', colore: '#fbbf24' },
]
const FASCE_P: [number, number][] = [[0, 0.5], [0.5, 0.6], [0.6, 0.7], [0.7, 0.8], [0.8, 1.01]]
const nomeFascia = ([a, b]: [number, number]) => a === 0 ? 'sotto 50%' : b > 1 ? '80% e oltre' : `${Math.round(a * 100)}-${Math.round(b * 100)}%`
type Bin = { fascia: string; n: number; dichiarata: number; reale: number; lo: number; hi: number }
function calibra(lista: Riga[], f: Fonte['id']): Bin[] {
  return FASCE_P.map(fa => {
    const g = lista.filter(r => r[f] != null && Number(r[f]) >= fa[0] && Number(r[f]) < fa[1])
    const v = g.filter(r => r.esito === 'VINTA').length, [lo, hi] = wilson(v, g.length)
    return { fascia: nomeFascia(fa), n: g.length, dichiarata: g.length ? g.reduce((a, r) => a + Number(r[f]), 0) / g.length : 0, reale: g.length ? v / g.length : 0, lo, hi }
  }).filter(b => b.n > 0)
}
// Brier: media di (probabilità − esito)², più basso = più preciso. 0,25 = tirare a indovinare al 50%.
const brier = (lista: Riga[], f: Fonte['id']) => lista.length ? lista.reduce((a, r) => a + (Number(r[f]) - (r.esito === 'VINTA' ? 1 : 0)) ** 2, 0) / lista.length : null

function GraficoCalibrazione({ serie }: { serie: { fonte: Fonte; bins: Bin[] }[] }) {
  const W = 420, H = 320, P = 40
  const X = (v: number) => P + v * (W - 2 * P), Y = (v: number) => H - P - v * (H - 2 * P)
  const tacche = [0, 0.2, 0.4, 0.6, 0.8, 1]
  return (
    <svg viewBox={`0 0 ${W} ${H}`} style={{ width: '100%', maxWidth: W }}>
      {tacche.map(t => <g key={t}>
        <line x1={X(t)} x2={X(t)} y1={Y(0)} y2={Y(1)} stroke="#1e293b" /><line x1={X(0)} x2={X(1)} y1={Y(t)} y2={Y(t)} stroke="#1e293b" />
        <text x={X(t)} y={H - P + 16} textAnchor="middle" fill="#94a3b8" fontSize="10">{Math.round(t * 100)}%</text>
        <text x={P - 6} y={Y(t) + 3} textAnchor="end" fill="#94a3b8" fontSize="10">{Math.round(t * 100)}%</text>
      </g>)}
      <line x1={X(0)} y1={Y(0)} x2={X(1)} y2={Y(1)} stroke="#64748b" strokeDasharray="5 5" />
      <text x={X(0.98)} y={Y(0.98) + 14} textAnchor="end" fill="#64748b" fontSize="10">perfetta</text>
      {serie.map(({ fonte, bins }) => <g key={fonte.id}>
        {bins.length > 1 && <polyline fill="none" stroke={fonte.colore} strokeWidth="2" points={bins.map(b => `${X(b.dichiarata)},${Y(b.reale)}`).join(' ')} />}
        {bins.map(b => <g key={b.fascia}>
          <line x1={X(b.dichiarata)} x2={X(b.dichiarata)} y1={Y(b.lo)} y2={Y(b.hi)} stroke={fonte.colore} strokeOpacity=".35" strokeWidth="5" />
          <circle cx={X(b.dichiarata)} cy={Y(b.reale)} r={Math.min(9, 3 + Math.sqrt(b.n))} fill={fonte.colore} fillOpacity={b.n < MIN_N ? 0.45 : 1}>
            <title>{`${fonte.nome} · ${b.fascia}: dichiarata ${pct(b.dichiarata)}, vinte ${pct(b.reale)} su ${b.n} (margine ${pct(b.lo, 0)}–${pct(b.hi, 0)})`}</title>
          </circle>
        </g>)}
      </g>)}
      <text x={W / 2} y={H - 4} textAnchor="middle" fill="#cbd5e1" fontSize="11">probabilità dichiarata</text>
      <text x={12} y={H / 2} textAnchor="middle" fill="#cbd5e1" fontSize="11" transform={`rotate(-90 12 ${H / 2})`}>vinte davvero</text>
    </svg>)
}

// ─── caricamento e normalizzazione dei tre canali ───────────────────
function normalizza(canale: Canale, x: any): Riga {
  const htR: [number, number] | null = x.ht_casa != null && x.ht_ospite != null ? [x.ht_casa, x.ht_ospite] : null
  const ftR: [number, number] | null = x.ft_casa != null && x.ft_ospite != null ? [x.ft_casa, x.ft_ospite] : null
  if (canale === 'scoretrend') return {
    id: x.msg_id, data: x.data_msg, competizione: x.competizione || 'n.d.', esito: x.esito, quota: x.quota != null ? Number(x.quota) : null,
    profitto: x.profitto != null ? Number(x.profitto) : null, unita: Number(x.unita || 1), live: x.live || 'n.d.', minuto: x.minuto,
    mercato: `${x.mercato || ''}${x.linea != null ? ' ' + String(x.linea).replace('.', ',') : ''}${x.tempo && x.tempo !== 'finale' ? ' ' + x.tempo : ''}`.trim(),
    casaOspiti: null, risultato: null, minutiAlGol: null,
    tipo: x.mercato === '1X2' ? (simNome(String(x.selezione || ''), String(x.casa || '')) ? 'Segno 1 (casa)' : simNome(String(x.selezione || ''), String(x.ospite || '')) ? 'Segno 2 (ospite)' : 'Segno X')
      : `${/under/i.test(String(x.selezione || '')) ? 'Under' : 'Over'} ${x.linea != null ? String(x.linea).replace('.', ',') : ''}${x.tempo && x.tempo !== 'finale' ? ' ' + x.tempo : ''}`.trim(),
    ht: htR, ft: ftR, gol: Array.isArray(x.gol) ? x.gol : null,
  }
  if (canale === 'hunterbet') return {
    id: x.msg_id, data: x.data_msg, competizione: x.competizione || 'n.d.', esito: x.esito,
    quota: x.quota != null ? Number(x.quota) : null,
    profitto: x.quota != null && x.esito ? (x.esito === 'VINTA' ? Number(x.quota) - 1 : x.esito === 'PERSA' ? -1 : 0) : null, unita: 1,
    live: (x.fase || (String(x.tipo_segnale || '').startsWith('GOL_') ? 'LIVE' : 'PRE-LIVE')) === 'LIVE' ? 'live' : 'prepartita',
    minuto: x.minuto_segnale, mercato: x.tipo_segnale === 'GOL_CASA' ? 'Gol casa' : x.tipo_segnale === 'GOL_OSPITI' ? 'Gol ospiti' : `Pre-live · ${x.tipo_segnale || '?'}`,
    casaOspiti: x.tipo_segnale === 'GOL_CASA' ? 'Casa' : x.tipo_segnale === 'GOL_OSPITI' ? 'Ospiti' : 'Pre-live',
    risultato: x.score_casa_segnale != null ? `${x.score_casa_segnale}-${x.score_ospite_segnale}` : null, minutiAlGol: x.minuti_al_gol,
    tipo: x.tipo_segnale === 'GOL_CASA' ? 'Gol casa' : x.tipo_segnale === 'GOL_OSPITI' ? 'Gol ospiti' : `Pre-live · ${x.tipo_segnale || '?'}`,
    ht: htR, ft: ftR, gol: Array.isArray(x.gol) ? x.gol : null,
  }
  // 07/10/2026 — TENNIS PronoX (tabella pronox_tennis_segnali): 1 unità per segnale con quota; nessun risultato partita (ht/ft)
  if (canale === 'tennis') {
    const q = x.quota != null ? Number(x.quota) : null
    const qa = x.quota_a != null ? Number(x.quota_a) : null, qb = x.quota_b != null ? Number(x.quota_b) : null
    const qSel = x.selezione === x.giocatore_a ? qa : qb, qAlt = x.selezione === x.giocatore_a ? qb : qa
    const pM = qSel && qAlt ? (1 / qSel) / (1 / qSel + 1 / qAlt) : null      // probabilità del bookmaker senza margine
    const etichetta = x.tipo === 'VALUE' ? '💎 VALUE' : '→ Pronostico'
    return {
      id: x.id, data: x.inizio || x.data_partita, competizione: x.torneo || 'n.d.', esito: x.esito, quota: q,
      profitto: q != null && x.esito ? (x.esito === 'VINTA' ? q - 1 : x.esito === 'PERSA' ? -1 : 0) : null, unita: q != null ? 1 : 0,
      live: 'prepartita', minuto: null, mercato: etichetta, casaOspiti: null, risultato: null, minutiAlGol: null, tipo: etichetta,
      ht: null, ft: null, gol: null,
      pG: x.prob != null ? Number(x.prob) : null, pC: null, pM, value: x.tipo === 'VALUE', forte: false,
    }
  }
  // PronoX: 1 unità solo dove c'è la quota (il BTTS non ha quota: conta nelle % vinte, non nelle unità)
  const q = x.quota != null ? Number(x.quota) : null
  return {
    id: x.msg_id, data: x.data_partita, competizione: x.competizione || 'n.d.', esito: x.esito, quota: q,
    profitto: x.profitto != null ? Number(x.profitto) : null, unita: q != null ? 1 : 0, live: 'prepartita', minuto: null,
    mercato: x.etichetta, casaOspiti: null, risultato: null, minutiAlGol: null, tipo: x.etichetta, ht: htR, ft: ftR, gol: null,
    pG: x.prob_grezza != null ? Number(x.prob_grezza) : null, pC: x.prob_calibrata != null ? Number(x.prob_calibrata) : null,
    pM: x.prob_mercato != null ? Number(x.prob_mercato) : null, value: !!x.value, forte: !!x.forte,
  }
}
async function caricaCanale(canale: Canale): Promise<{ righe: Riga[]; errore: string }> {
  const tab = canale === 'scoretrend' ? 'scoretrend_segnali' : canale === 'hunterbet' ? 'hunterbet_segnali' : canale === 'tennis' ? 'pronox_tennis_segnali' : 'pronox_segnali'
  const ordine = canale === 'pronox' || canale === 'tennis' ? 'data_partita' : 'data_msg'
  const out: any[] = []
  for (let from = 0; ; from += 1000) {
    const { data, error } = await supabase.from(tab).select('*').order(ordine, { ascending: true }).range(from, from + 999)
    if (error) return { righe: [], errore: `${NOMI[canale]}: ${error.message}` }
    out.push(...(data || [])); if (!data || data.length < 1000) break
  }
  return { righe: out.map(x => normalizza(canale, x)), errore: '' }
}
const fasciaProb = (p: number | null | undefined) => p == null ? 'n.d.' : p < 0.6 ? 'sotto 60%' : p < 0.7 ? '60-69%' : p < 0.8 ? '70-79%' : '80%+'

// ─── statistiche ─────────────────────────────────────────────────────
type Seg = { voce: string; n: number; v: number; p: number; lo: number; hi: number; unita: number; puntato: number; quotaPareggio: number }
function segmenta(lista: Riga[], chiave: (r: Riga) => string): Seg[] {
  const m = new Map<string, Riga[]>()
  for (const r of lista) { const k = chiave(r) || 'n.d.'; m.set(k, [...(m.get(k) || []), r]) }
  return [...m.entries()].map(([voce, g]) => {
    const n = g.length, v = g.filter(r => r.esito === 'VINTA').length, [lo, hi] = wilson(v, n)
    return { voce, n, v, p: v / n, lo, hi, unita: g.reduce((a, r) => a + (r.profitto || 0), 0), puntato: g.reduce((a, r) => a + (r.unita || 1), 0), quotaPareggio: v ? n / v : Infinity }
  }).sort((a, b) => b.n - a.n)
}
function simula(lista: Riga[], quotaFissa: number | null) {
  let cassa = 0, picco = 0, dd = 0, striscia = 0, peggiore = 0
  const curva = [0]
  for (const r of lista) {
    const pr = quotaFissa ? (r.esito === 'VINTA' ? quotaFissa - 1 : -1) : (r.profitto || 0)
    cassa += pr; curva.push(cassa); picco = Math.max(picco, cassa); dd = Math.max(dd, picco - cassa)
    striscia = pr < 0 ? striscia + 1 : 0; peggiore = Math.max(peggiore, striscia)
  }
  return { curva, finale: cassa, drawdown: dd, strisciaPeggiore: peggiore }
}

export default function AnalisiSegnali() {
  const [canale, setCanale] = useState<Canale>('scoretrend')
  const [dati, setDati] = useState<Record<Canale, Riga[]>>({ scoretrend: [], hunterbet: [], pronox: [], tennis: [] })
  const [errore, setErrore] = useState('')
  const [quotaIpotesi, setQuotaIpotesi] = useState('1.70')
  const [soloSopra140, setSoloSopra140] = useState(false)
  const [tipoScelto, setTipoScelto] = useState('Tutti i segnali')

  useEffect(() => {
    (async () => {
      const canali: Canale[] = ['scoretrend', 'hunterbet', 'pronox', 'tennis']
      const ris = await Promise.all(canali.map(caricaCanale))
      setDati({ scoretrend: ris[0].righe, hunterbet: ris[1].righe, pronox: ris[2].righe, tennis: ris[3].righe })
      setErrore(ris.map(r => r.errore).filter(Boolean).join(' · '))
    })()
  }, [])
  const righe = dati[canale]

  const tutte = useMemo(() => righe.filter(r => !soloSopra140 || r.quota == null || r.quota >= 1.4), [righe, soloSopra140])
  const chiuse = useMemo(() => tutte.filter(r => r.esito === 'VINTA' || r.esito === 'PERSA'), [tutte])
  const conQuota = canale !== 'hunterbet'
  const isPronox = canale === 'pronox'
  const isTennis = canale === 'tennis'          // 07/10/2026
  const conProb = isPronox || isTennis          // canali con probabilità del modello (calibrazione)
  const qIp = Math.max(1.01, Number(quotaIpotesi.replace(',', '.')) || 1.7)
  const sim = simula(chiuse, conQuota ? null : qIp)
  const metà = Math.floor(chiuse.length / 2)
  const prima = segmenta(chiuse.slice(0, metà), () => 'tutti')[0], seconda = segmenta(chiuse.slice(metà), () => 'tutti')[0]
  const totale = segmenta(chiuse, () => 'tutti')[0]

  const esitiTorta = [
    { nome: 'Vinte', valore: tutte.filter(r => r.esito === 'VINTA').length, colore: '#34d399' },
    { nome: 'Perse', valore: tutte.filter(r => r.esito === 'PERSA').length, colore: '#f87171' },
    { nome: 'Nulle', valore: tutte.filter(r => r.esito === 'NULLA').length, colore: '#94a3b8' },
    { nome: 'In corso', valore: tutte.filter(r => !r.esito).length, colore: '#fbbf24' },
  ]
  const segMercato = segmenta(chiuse, r => r.mercato)
  const tortaMercati = segMercato.slice(0, 8).map((s, i) => ({ nome: `${s.voce} · ${pct(s.p, 0)} vinte`, valore: s.n, colore: COLORI[i % COLORI.length] }))
  const gol = tutte.map(r => r.minutiAlGol).filter((x): x is number => x != null).sort((a, b) => a - b)
  const golTorta = gol.length ? [['entro 5\'', 0, 5], ['6-10\'', 6, 10], ['11-20\'', 11, 20], ['21-30\'', 21, 30], ['oltre 30\'', 31, 999]].map(([nome, a, b], i) =>
    ({ nome: String(nome), valore: gol.filter(g => g >= Number(a) && g <= Number(b)).length, colore: COLORI[i] })) : []

  // DOVE FINISCONO: per ogni tipo di segnale, quante volte si è verificato ogni mercato
  const conRisultato = tutte.filter(r => r.ft)
  const tipi = ['Tutti i segnali', ...[...new Set(conRisultato.map(r => r.tipo))].sort()]
  const incrocio = (lista: Riga[], m: Mercato) => { const val = lista.map(m.test).filter((x): x is boolean => x !== null); const v = val.filter(Boolean).length; const [lo, hi] = wilson(v, val.length); return { n: val.length, v, p: val.length ? v / val.length : 0, lo, hi } }
  const listaTipo = tipoScelto === 'Tutti i segnali' ? conRisultato : conRisultato.filter(r => r.tipo === tipoScelto)
  const classifica = MERCATI.map(m => ({ m, ...incrocio(listaTipo, m) })).filter(x => x.n > 0).sort((a, b) => b.p - a.p || b.n - a.n)
  const coloreP = (p: number, n: number) => n < 5 ? 'rgba(51,65,85,.4)' : `hsla(${Math.round(p * 120)}, 70%, 40%, ${0.35 + 0.5 * Math.min(1, n / MIN_N)})`

  const blocchi: [string, Seg[]][] = isTennis ? [
    ['Value o pronostico', segmenta(chiuse, r => r.value ? '💎 VALUE (EV > 3%)' : '→ Pronostico')],
    ['Per probabilità del modello', segmenta(chiuse, r => fasciaProb(r.pG)).sort((a, b) => a.voce.localeCompare(b.voce))],
    ['Per fascia di quota', segmenta(chiuse, r => fasciaQuota(r.quota))],
    ['Per torneo', segmenta(chiuse, r => r.competizione)],
    ['Per giorno', segmenta(chiuse, r => giorno(r.data))],
  ] : isPronox ? [
    ['Value bet o no', segmenta(chiuse, r => r.value ? '💎 VALUE (EV > 3%)' : 'Senza value')],
    ['Forte o normale', segmenta(chiuse, r => r.forte ? '🔥 Forte' : '→ Normale')],
    ['Per probabilità del modello', segmenta(chiuse, r => fasciaProb(r.pG)).sort((a, b) => a.voce.localeCompare(b.voce))],
    ['Per fascia di quota', segmenta(chiuse, r => fasciaQuota(r.quota))],
    ['Per competizione', segmenta(chiuse, r => r.competizione)],
    ['Per giorno', segmenta(chiuse, r => giorno(r.data))],
  ] : [
    ['Per competizione', segmenta(chiuse, r => r.competizione)],
    ['Per minuto del segnale', segmenta(chiuse, r => fasciaMinuto(r.minuto))],
    ...(conQuota ? [['Per fascia di quota', segmenta(chiuse, r => fasciaQuota(r.quota))] as [string, Seg[]], ['Live o prepartita', segmenta(chiuse, r => r.live)] as [string, Seg[]]]
      : [['Casa o ospiti', segmenta(chiuse, r => r.casaOspiti || 'n.d.')] as [string, Seg[]], ['Risultato al segnale', segmenta(chiuse, r => r.risultato || 'n.d.')] as [string, Seg[]]]),
    ['Per giorno', segmenta(chiuse, r => giorno(r.data))],
    ['Per fascia oraria', segmenta(chiuse, r => fasciaOra(r.data))],
  ]

  // 04/10/2026 · calibrazione (PronoX e tennis): Brier sulle stesse bet per tutte le fonti disponibili (il tennis non ha la probabilità "calibrata")
  const FA = isTennis ? FONTI.filter(f => f.id !== 'pC') : FONTI
  const serieCal = conProb ? FA.map(f => ({ fonte: f, bins: calibra(chiuse, f.id) })) : []
  const comuni = conProb ? chiuse.filter(r => FA.every(f => r[f.id] != null)) : []
  const brierComuni = FA.map(f => ({ fonte: f, b: brier(comuni, f.id) }))
  const brierTutte = FA.map(f => { const l = chiuse.filter(r => r[f.id] != null); return { fonte: f, n: l.length, b: brier(l, f.id) } })
  const migliore = comuni.length ? [...brierComuni].sort((a, b) => (a.b ?? 9) - (b.b ?? 9))[0] : null

  // 04/10/2026 · confronto dei tre canali con le stesse regole (rispetta "solo quota ≥ 1,40")
  const confronto = (['scoretrend', 'hunterbet', 'pronox', 'tennis'] as Canale[]).map(c => {
    const ch = dati[c].filter(r => !soloSopra140 || r.quota == null || r.quota >= 1.4).filter(r => r.esito === 'VINTA' || r.esito === 'PERSA')
    const v = ch.filter(r => r.esito === 'VINTA').length, [lo, hi] = wilson(v, ch.length)
    const cq = ch.filter(r => r.quota != null && (c !== 'pronox' || r.unita > 0))
    const sm = simula(cq, null)
    return { c, n: ch.length, v, p: ch.length ? v / ch.length : 0, lo, hi, nq: cq.length, unita: sm.finale,
      resa: cq.length ? sm.finale / cq.length : null, quotaMedia: cq.length ? cq.reduce((a, r) => a + Number(r.quota), 0) / cq.length : null,
      dd: sm.drawdown, pareggio: v ? ch.length / v : null }
  })

  const th = { textAlign: 'left' as const, padding: '6px 8px', fontSize: 11, color: '#94a3b8', borderBottom: '1px solid #334155', whiteSpace: 'nowrap' as const }
  const td = { padding: '6px 8px', fontSize: 12.5, color: '#e2e8f0', borderBottom: '1px solid rgba(51,65,85,.5)' }
  const card = (t: string, v: string, col = '#f8fafc', sotto = '') => (
    <div key={t} style={{ background: 'rgba(15,23,42,.8)', border: '1px solid #1e293b', borderRadius: 12, padding: '10px 14px', minWidth: 130 }}>
      <div style={{ fontSize: 11, color: '#94a3b8' }}>{t}</div><div style={{ fontSize: 20, fontWeight: 900, color: col }}>{v}</div>
      {sotto && <div style={{ fontSize: 10.5, color: '#64748b' }}>{sotto}</div>}
    </div>)
  const tabella = (righeSeg: Seg[]) => (
    <table style={{ borderCollapse: 'collapse', width: '100%' }}>
      <thead><tr>{['Voce', 'Bet', '% vinte', 'Margine (95%)', conQuota ? 'Unità' : 'Quota di pareggio', conQuota ? 'Rendimento' : `Con quota ${String(qIp).replace('.', ',')}`].map(h => <th key={h} style={th}>{h}</th>)}</tr></thead>
      <tbody>{righeSeg.map(s => {
        const pochi = s.n < MIN_N
        const resa = conQuota ? (s.puntato ? s.unita / s.puntato : 0) : s.p * qIp - 1
        const col = pochi ? '#64748b' : resa >= 0 ? '#86efac' : '#fca5a5'
        return (
          <tr key={s.voce} style={{ opacity: pochi ? 0.55 : 1 }}>
            <td style={{ ...td, fontWeight: 700 }}>{s.voce}{pochi && <span style={{ fontSize: 10, color: '#94a3b8' }}> · pochi dati</span>}</td>
            <td style={td}>{s.n}</td><td style={{ ...td, fontWeight: 800 }}>{pct(s.p)}</td>
            <td style={{ ...td, color: '#94a3b8' }}>{pct(s.lo, 0)} – {pct(s.hi, 0)}</td>
            <td style={{ ...td, color: conQuota ? col : '#fbbf24', fontWeight: 800 }}>{conQuota ? `${s.unita >= 0 ? '+' : ''}${n2(s.unita)}` : (Number.isFinite(s.quotaPareggio) ? `≥ ${s.quotaPareggio.toFixed(2).replace('.', ',')}` : '—')}</td>
            <td style={{ ...td, color: col, fontWeight: 800 }}>{resa >= 0 ? '+' : ''}{pct(resa)}</td>
          </tr>)
      })}</tbody>
    </table>)

  return (
    <div style={{ minHeight: '100vh', background: '#0b1220', color: '#e2e8f0', fontFamily: 'system-ui, -apple-system, Segoe UI, sans-serif' }}>
      <div style={{ maxWidth: 1300, margin: '0 auto', padding: '22px 18px 60px' }}>
        <Link href="/profit-tracker/segnali" style={{ color: '#7dd3fc', fontSize: 12, textDecoration: 'none', fontWeight: 700 }}>← Torna ai segnali</Link>
        <h1 style={{ fontSize: 28, margin: '8px 0 10px', color: '#f8fafc' }}>📈 Analisi segnali</h1>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center', marginBottom: 14 }}>
          {(['scoretrend', 'hunterbet', 'pronox', 'tennis'] as const).map(c => (
            <button key={c} onClick={() => setCanale(c)} style={{ background: canale === c ? '#0c4a6e' : '#0f172a', color: '#f8fafc', border: `1px solid ${canale === c ? '#38bdf8' : '#334155'}`, borderRadius: 10, padding: '7px 14px', fontWeight: 900, cursor: 'pointer' }}>{NOMI[c]}</button>))}
          {conQuota && <label style={{ fontSize: 12, color: '#cbd5e1', display: 'flex', gap: 5, alignItems: 'center' }}><input type="checkbox" checked={soloSopra140} onChange={e => setSoloSopra140(e.target.checked)} /> solo quota ≥ 1,40 (la tua regola)</label>}
          {!conQuota && <label style={{ fontSize: 12, color: '#cbd5e1' }}>Quota ipotetica per la simulazione: <input value={quotaIpotesi} onChange={e => setQuotaIpotesi(e.target.value.replace(/[^0-9.,]/g, ''))} style={{ width: 60, background: '#020617', color: '#f8fafc', border: '1px solid #334155', borderRadius: 8, padding: '4px 6px' }} /></label>}
        </div>
        {errore && <div style={{ color: '#fca5a5', marginBottom: 10 }}>{errore}</div>}

        {totale && (
          <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', marginBottom: 16 }}>
            {card('Bet chiuse', String(totale.n))}
            {card('% vinte', pct(totale.p), '#f8fafc', `margine ${pct(totale.lo, 0)} – ${pct(totale.hi, 0)}`)}
            {conQuota ? card('Unità', `${sim.finale >= 0 ? '+' : ''}${n2(sim.finale)}`, sim.finale >= 0 ? '#86efac' : '#fca5a5', `rendimento ${pct(totale.puntato ? totale.unita / totale.puntato : 0)}`)
              : card('Quota minima per guadagnare', Number.isFinite(totale.quotaPareggio) ? totale.quotaPareggio.toFixed(2).replace('.', ',') : '—', '#fbbf24', 'sotto questa quota si perde')}
            {card('Calo massimo', `${n2(sim.drawdown)} unità`, '#fca5a5', 'dal punto più alto')}
            {card('Striscia peggiore', `${sim.strisciaPeggiore} perse di fila`, '#fca5a5')}
            {card('Cassa minima consigliata', `${Math.ceil(Math.max(sim.drawdown, sim.strisciaPeggiore) * 2)} unità`, '#7dd3fc', 'il doppio del peggior momento storico')}
          </div>
        )}
        {totale && totale.n < 100 && <div style={{ fontSize: 12, color: '#fbbf24', marginBottom: 12 }}>⚠️ {totale.n} bet chiuse: i numeri sono ancora molto incerti (guarda il margine). Diventano affidabili da circa 100 bet, e per i singoli segmenti da {MIN_N} in su.</div>}

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(380px, 1fr))', gap: 14, marginBottom: 14 }}>
          <Torta titolo="Esiti" fette={esitiTorta} />
          <Torta titolo={conQuota && !conProb ? 'Mercati (bet chiuse)' : 'Tipo di segnale (bet chiuse)'} fette={tortaMercati} />
          {!conQuota && golTorta.some(f => f.valore) && <Torta titolo={`Minuti tra segnale e gol (mediana ${gol[Math.floor(gol.length / 2)]}')`} fette={golTorta} />}
        </div>

        <div style={{ marginBottom: 14 }}>
          <Linea punti={sim.curva} titolo={conQuota ? 'Andamento della cassa (1 unità a bet)' : `Andamento della cassa se prendessi tutto a quota ${String(qIp).replace('.', ',')} (1 unità a bet)`} />
        </div>

        {prima && seconda && chiuse.length >= 20 && (
          <div style={{ background: 'rgba(15,23,42,.6)', border: '1px solid #1e293b', borderRadius: 14, padding: 12, marginBottom: 14, fontSize: 13 }}>
            <b style={{ color: '#7dd3fc' }}>🔁 Regge sui dati nuovi?</b> Prima metà: <b>{pct(prima.p)}</b> vinte su {prima.n} · seconda metà: <b>{pct(seconda.p)}</b> su {seconda.n}.{' '}
            {Math.abs(prima.p - seconda.p) <= (prima.hi - prima.lo) / 2 ? <span style={{ color: '#86efac' }}>Coerente: la differenza sta dentro il margine del caso.</span> : <span style={{ color: '#fbbf24' }}>Attenzione: il rendimento è cambiato più di quanto spiegherebbe il caso.</span>}
          </div>
        )}

        {/* ─── 04/10/2026 · ⚖️ CONFRONTO DEI TRE CANALI ─── */}
        <div style={{ background: 'rgba(15,23,42,.6)', border: '1px solid #334155', borderRadius: 14, padding: 14, marginBottom: 14, overflowX: 'auto' }}>
          <div style={{ fontWeight: 900, fontSize: 16, color: '#f8fafc', marginBottom: 4 }}>⚖️ Confronto dei canali</div>
          <div style={{ fontSize: 12, color: '#94a3b8', marginBottom: 10 }}>Stesse regole per tutti: 1 unità a bet, bet chiuse (vinte o perse){soloSopra140 ? ', solo quota ≥ 1,40' : ''}. Unità e rendimento solo sulle bet con quota.</div>
          <table style={{ borderCollapse: 'collapse', width: '100%' }}>
            <thead><tr>{['Canale', 'Bet chiuse', '% vinte', 'Margine (95%)', 'Bet con quota', 'Quota media', 'Unità', 'Rendimento', 'Calo massimo', 'Quota di pareggio'].map(h => <th key={h} style={th}>{h}</th>)}</tr></thead>
            <tbody>{confronto.map(x => { const col = x.resa == null ? '#94a3b8' : x.resa >= 0 ? '#86efac' : '#fca5a5'; return (
              <tr key={x.c} onClick={() => setCanale(x.c)} style={{ cursor: 'pointer', background: x.c === canale ? 'rgba(56,189,248,.08)' : undefined, opacity: x.n < MIN_N ? 0.6 : 1 }}>
                <td style={{ ...td, fontWeight: 900, color: x.c === canale ? '#7dd3fc' : '#f8fafc' }}>{NOMI[x.c]}{x.n < MIN_N && <span style={{ fontSize: 10, color: '#94a3b8', fontWeight: 400 }}> · pochi dati</span>}</td>
                <td style={td}>{x.n}</td>
                <td style={{ ...td, fontWeight: 800 }}>{x.n ? pct(x.p) : '—'}</td>
                <td style={{ ...td, color: '#94a3b8' }}>{x.n ? `${pct(x.lo, 0)} – ${pct(x.hi, 0)}` : '—'}</td>
                <td style={td}>{x.nq}</td>
                <td style={td}>{x.quotaMedia != null ? x.quotaMedia.toFixed(2).replace('.', ',') : '—'}</td>
                <td style={{ ...td, color: col, fontWeight: 800 }}>{x.nq ? `${x.unita >= 0 ? '+' : ''}${n2(x.unita)}` : '—'}</td>
                <td style={{ ...td, color: col, fontWeight: 800 }}>{x.resa != null ? `${x.resa >= 0 ? '+' : ''}${pct(x.resa)}` : '—'}</td>
                <td style={{ ...td, color: '#fca5a5' }}>{x.nq ? `${n2(x.dd)} unità` : '—'}</td>
                <td style={{ ...td, color: '#fbbf24', fontWeight: 800 }}>{x.pareggio != null ? `≥ ${x.pareggio.toFixed(2).replace('.', ',')}` : '—'}</td>
              </tr>) })}</tbody>
          </table>
          <div style={{ fontSize: 11.5, color: '#64748b', marginTop: 8 }}>Clicca un canale per vederne l'analisi completa. La <b>quota di pareggio</b> (1 ÷ % vinte) è la quota media minima a cui il canale smette di perdere. Hunterbet ha unità solo sulle bet di cui hai scritto la quota; PronoX solo su 1X2 e Over/Under 2,5 (il BTTS non ha quota).</div>
        </div>

        {/* ─── 04/10/2026 · 🎯 CALIBRAZIONE PRONOX ─── */}
        {conProb && (
          <div style={{ background: 'rgba(15,23,42,.6)', border: '1px solid #334155', borderRadius: 14, padding: 14, marginBottom: 14 }}>
            <div style={{ fontWeight: 900, fontSize: 16, color: '#f8fafc', marginBottom: 4 }}>🎯 Calibrazione: quando dice 70%, vince il 70%?</div>
            <div style={{ fontSize: 12, color: '#94a3b8', marginBottom: 10 }}>Ogni punto è una fascia di probabilità: in orizzontale quella dichiarata, in verticale quante sono state vinte davvero. Sulla diagonale = previsione onesta; <b>sotto</b> = troppo ottimista; <b>sopra</b> = troppo prudente. La barra verticale è il margine (95%); i punti sbiaditi hanno meno di {MIN_N} bet.</div>
            {chiuse.length === 0 ? <div style={{ fontSize: 13, color: '#64748b' }}>Ancora nessun segnale chiuso: la calibrazione si riempie da sola con gli esiti della cron.</div> : (
              <div style={{ display: 'flex', gap: 18, flexWrap: 'wrap', alignItems: 'flex-start' }}>
                <div style={{ flex: '1 1 380px', maxWidth: 440 }}>
                  <GraficoCalibrazione serie={serieCal} />
                  <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', fontSize: 12 }}>{FA.map(f => <span key={f.id} style={{ display: 'flex', gap: 5, alignItems: 'center' }}><span style={{ width: 11, height: 11, borderRadius: 6, background: f.colore, display: 'inline-block' }} />{f.nome}</span>)}</div>
                </div>
                <div style={{ flex: '1 1 420px', overflowX: 'auto' }}>
                  <div style={{ fontSize: 13, fontWeight: 800, color: '#7dd3fc', marginBottom: 6 }}>Brier score (più basso = più preciso · 0,25 = tirare a indovinare)</div>
                  <table style={{ borderCollapse: 'collapse', width: '100%', marginBottom: 10 }}>
                    <thead><tr>{['Fonte', `Stesse bet (${comuni.length})`, 'Tutte le sue bet'].map(h => <th key={h} style={th}>{h}</th>)}</tr></thead>
                    <tbody>{FA.map((f, i) => { const bc = brierComuni[i].b, bt = brierTutte[i]; return (
                      <tr key={f.id}>
                        <td style={{ ...td, fontWeight: 800, color: f.colore }}>{f.nome}{migliore && migliore.fonte.id === f.id && comuni.length >= MIN_N ? ' 🏆' : ''}</td>
                        <td style={{ ...td, fontWeight: 800 }}>{bc != null ? bc.toFixed(3).replace('.', ',') : '—'}</td>
                        <td style={{ ...td, color: '#94a3b8' }}>{bt.b != null ? `${bt.b.toFixed(3).replace('.', ',')} su ${bt.n}` : '—'}</td>
                      </tr>) })}</tbody>
                  </table>
                  <table style={{ borderCollapse: 'collapse', width: '100%' }}>
                    <thead><tr>{['Fonte', 'Fascia', 'Bet', 'Dichiarata', 'Vinte davvero', 'Margine (95%)'].map(h => <th key={h} style={th}>{h}</th>)}</tr></thead>
                    <tbody>{serieCal.flatMap(({ fonte, bins }) => bins.map(b => (
                      <tr key={fonte.id + b.fascia} style={{ opacity: b.n < MIN_N ? 0.6 : 1 }}>
                        <td style={{ ...td, color: fonte.colore, fontWeight: 700 }}>{fonte.nome}</td><td style={td}>{b.fascia}</td><td style={td}>{b.n}</td>
                        <td style={td}>{pct(b.dichiarata)}</td>
                        <td style={{ ...td, fontWeight: 800, color: b.n < MIN_N ? '#94a3b8' : b.lo <= b.dichiarata && b.dichiarata <= b.hi ? '#86efac' : b.reale < b.dichiarata ? '#fca5a5' : '#7dd3fc' }}>{pct(b.reale)}</td>
                        <td style={{ ...td, color: '#94a3b8' }}>{pct(b.lo, 0)} – {pct(b.hi, 0)}</td>
                      </tr>)))}</tbody>
                  </table>
                  <div style={{ fontSize: 11.5, color: '#64748b', marginTop: 8, lineHeight: 1.6 }}>
                    Verde: la probabilità dichiarata sta dentro il margine (onesta). Rosso: vince <b>meno</b> di quanto dichiara (ottimista). Azzurro: vince di più (prudente). Il confronto che conta è sulle <b>stesse bet</b>: se il bookmaker ha il Brier più basso, il modello non sa ancora più del mercato e le VALUE sono in gran parte illusorie. Il BTTS non ha quota: entra solo nelle righe Modello e /oggi.
                  </div>
                </div>
              </div>)}
          </div>
        )}

        {/* ─── 🔀 DOVE FINISCONO I SEGNALI ─── */}
        {!isTennis && (
        <div style={{ background: 'rgba(15,23,42,.6)', border: '1px solid #334155', borderRadius: 14, padding: 14, marginBottom: 14 }}>
          <div style={{ fontWeight: 900, fontSize: 16, color: '#f8fafc', marginBottom: 4 }}>🔀 Dove finiscono i segnali</div>
          <div style={{ fontSize: 12, color: '#94a3b8', marginBottom: 10 }}>
            Per ogni tipo di segnale: in quante partite si è verificato ogni altro mercato (sul risultato vero). Risultati disponibili per <b>{conRisultato.length}</b> segnali su {tutte.length}
            {conRisultato.length < tutte.length ? (isPronox ? ' — gli altri arrivano da soli con la cron degli esiti, a partita finita.' : ' — gli altri arrivano con il programma "risultati partite" (o la partita non è stata trovata).') : '.'}
          </div>
          {conRisultato.length === 0 ? <div style={{ fontSize: 13, color: '#64748b' }}>{isPronox ? 'Ancora nessun risultato: arrivano da soli a partita finita.' : 'Ancora nessun risultato: avvia risultati_partite.py sul PC.'}</div> : <>
            <div style={{ overflowX: 'auto', marginBottom: 14 }}>
              <div style={{ fontSize: 12, fontWeight: 800, color: '#7dd3fc', marginBottom: 6 }}>Mappa a colori · clicca un tipo di segnale per il dettaglio</div>
              <table style={{ borderCollapse: 'separate', borderSpacing: 3 }}>
                <thead><tr><th style={th}>Segnale</th>{MAPPA.map(id => <th key={id} style={{ ...th, whiteSpace: 'normal', maxWidth: 90, textAlign: 'center' }}>{id}</th>)}</tr></thead>
                <tbody>{tipi.map(t => { const lista = t === 'Tutti i segnali' ? conRisultato : conRisultato.filter(r => r.tipo === t); return (
                  <tr key={t} onClick={() => setTipoScelto(t)} style={{ cursor: 'pointer' }}>
                    <td style={{ ...td, fontWeight: 800, whiteSpace: 'nowrap', color: t === tipoScelto ? '#7dd3fc' : '#e2e8f0' }}>{t === tipoScelto ? '▶ ' : ''}{t} <span style={{ color: '#64748b', fontWeight: 400 }}>({lista.length})</span></td>
                    {MAPPA.map(id => { const m = MERCATI.find(x => x.id === id)!; const x = incrocio(lista, m); return (
                      <td key={id} title={x.n ? `${x.v} su ${x.n} · margine ${pct(x.lo, 0)}–${pct(x.hi, 0)}` : 'nessun dato'} style={{ background: x.n ? coloreP(x.p, x.n) : 'transparent', borderRadius: 6, textAlign: 'center', padding: '6px 8px', fontSize: 12.5, fontWeight: 800, color: '#f8fafc', minWidth: 62 }}>
                        {x.n ? pct(x.p, 0) : '—'}{x.n ? <div style={{ fontSize: 9.5, fontWeight: 400, color: '#cbd5e1' }}>{x.n}</div> : null}
                      </td>) })}
                  </tr>) })}</tbody>
              </table>
            </div>
            <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap', marginBottom: 8 }}>
              <b style={{ fontSize: 13 }}>Dettaglio:</b>
              <select value={tipoScelto} onChange={e => setTipoScelto(e.target.value)} style={{ background: '#020617', color: '#f8fafc', border: '1px solid #334155', borderRadius: 8, padding: '5px 8px', fontSize: 12 }}>
                {tipi.map(t => <option key={t}>{t}</option>)}
              </select>
              <span style={{ fontSize: 12, color: '#94a3b8' }}>{listaTipo.length} partite con risultato · dal mercato più frequente al meno frequente</span>
            </div>
            <div style={{ overflowX: 'auto' }}>
              <table style={{ borderCollapse: 'collapse', width: '100%' }}>
                <thead><tr>{['Mercato', 'Quando', 'Si è verificato', '', 'Margine (95%)', 'Quota minima per guadagnare'].map(h => <th key={h} style={th}>{h}</th>)}</tr></thead>
                <tbody>{classifica.map(x => { const pochi = x.n < MIN_N; return (
                  <tr key={x.m.id} style={{ opacity: pochi ? 0.6 : 1 }}>
                    <td style={{ ...td, fontWeight: 800 }}>{x.m.id}</td>
                    <td style={{ ...td, color: '#94a3b8' }}>{x.m.gruppo}</td>
                    <td style={{ ...td, fontWeight: 900 }}>{pct(x.p)} <span style={{ color: '#94a3b8', fontWeight: 400 }}>({x.v}/{x.n})</span></td>
                    <td style={{ ...td, width: 160 }}><div style={{ height: 8, borderRadius: 4, background: '#1e293b' }}><div style={{ width: `${Math.round(100 * x.p)}%`, height: 8, borderRadius: 4, background: coloreP(x.p, Math.max(x.n, MIN_N)) }} /></div></td>
                    <td style={{ ...td, color: '#94a3b8' }}>{pct(x.lo, 0)} – {pct(x.hi, 0)}{pochi && <span style={{ fontSize: 10 }}> · pochi dati</span>}</td>
                    <td style={{ ...td, color: '#fbbf24', fontWeight: 800 }}>{x.v ? `≥ ${(x.n / x.v).toFixed(2).replace('.', ',')}` : '—'}</td>
                  </tr>) })}</tbody>
              </table>
            </div>
            <div style={{ fontSize: 11.5, color: '#64748b', marginTop: 8, lineHeight: 1.6 }}>
              Come usarla: se un mercato alternativo si verifica spesso e il bookmaker lo paga più della <b>quota minima</b> indicata, quel mercato conviene più del segnale originale. Per i segnali live, il risultato finale comprende anche i gol segnati prima dell'avviso: per sapere cosa succede DA QUANDO entri guarda il gruppo "Dopo il segnale".
            </div>
          </>}
        </div>
        )}

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(520px, 1fr))', gap: 14 }}>
          {[['Per mercato', segMercato] as [string, Seg[]], ...blocchi].map(([t, s]) => (
            <div key={t} style={{ background: 'rgba(15,23,42,.6)', border: '1px solid #1e293b', borderRadius: 14, padding: 12, overflowX: 'auto' }}>
              <div style={{ fontWeight: 900, marginBottom: 8, color: '#7dd3fc' }}>📊 {t}</div>
              {s.length ? tabella(s) : <div style={{ fontSize: 12, color: '#64748b' }}>Ancora nessuna bet chiusa.</div>}
            </div>))}
        </div>

        <div style={{ fontSize: 11.5, color: '#64748b', marginTop: 16, lineHeight: 1.6 }}>
          Come leggere: il <b>margine (95%)</b> è l'intervallo in cui sta probabilmente la percentuale vera; se è largo, il segmento non è ancora affidabile. Le voci in grigio hanno meno di {MIN_N} bet.
          {!conQuota && <> Per Hunterbet il canale non dà le quote: la <b>quota di pareggio</b> è la quota minima a cui devi prendere il segnale per non perdere (1 ÷ % vinte); l'ultima colonna mostra il rendimento se lo prendessi alla quota ipotetica scelta in alto.</>}
        </div>
        <footer style={{ marginTop: 22, textAlign: 'center', fontSize: 12, color: '#64748b' }}>© Sergio Apicella — Tutti i diritti riservati · uso interno riservato</footer>
      </div>
    </div>
  )
}
