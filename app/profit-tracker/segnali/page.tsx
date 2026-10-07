'use client'
// ════════════════════════════════════════════════════════════════════
// 📡 SEGNALI SCORETREND · pagina condivisa (03/10/2026)
// I segnali li manda il lettore sul PC (scoretrend.py) → tabella scoretrend_segnali.
// La vedono tutti gli utenti loggati, in tempo reale (aggiornamento ogni 30 secondi).
// 04/10/2026: terza scheda PronoX (vista pronox_segnali, sola lettura).
// ════════════════════════════════════════════════════════════════════
import { useCallback, useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { supabase } from '../supabaseClient'
import { caricaBetfair, caricaCongelati, quotaPerSegnale, riassuntoBF } from './betfair'   // 06/10/2026: quota Betfair accanto ai segnali
import type { CellaBF, EventoBF, RigaCongelata } from './betfair'
import SchedaTennis from './SchedaTennis'   // 07/10/2026: tennis PronoX

type Segnale = {
  msg_id: number; data_msg: string | null; data_partita: string | null; ora: string | null; competizione: string | null
  casa: string | null; ospite: string | null; live: string | null; minuto: number | null; mercato: string | null; linea: number | null
  tempo: string | null; quota: number | null; selezione: string | null; unita: number | null; esito: string | null; profitto: number | null; link: string | null
  ht_casa?: number | null; ht_ospite?: number | null; ft_casa?: number | null; ft_ospite?: number | null
}

// 04/10/2026 — risultato della partita scritto a mano (1° tempo e finale): serve all'analisi "Dove finiscono i segnali"
function CelleRisultato({ s, td }: { s: Segnale; td: any }) {
  const fmt = (a?: number | null, b?: number | null) => a != null && b != null ? `${a}-${b}` : ''
  const [ht, setHt] = useState(fmt(s.ht_casa, s.ht_ospite))
  const [ft, setFt] = useState(fmt(s.ft_casa, s.ft_ospite))
  const [salvati, setSalvati] = useState({ ht: fmt(s.ht_casa, s.ht_ospite), ft: fmt(s.ft_casa, s.ft_ospite) })
  const [stato, setStato] = useState('')
  const leggi = (t: string): [number, number] | null => { const m = t.trim().match(/^(\d{1,2})\s*[-–:]\s*(\d{1,2})$/); return m ? [Number(m[1]), Number(m[2])] : null }
  const cambiato = ht !== salvati.ht || ft !== salvati.ft
  async function salva() {
    const rHt = ht ? leggi(ht) : null, rFt = ft ? leggi(ft) : null
    if ((ht && !rHt) || (ft && !rFt)) { setStato('scrivi es. 2-1'); return }
    setStato('salvo…')
    const { error } = await supabase.from('scoretrend_segnali').update({ ht_casa: rHt?.[0] ?? null, ht_ospite: rHt?.[1] ?? null, ft_casa: rFt?.[0] ?? null, ft_ospite: rFt?.[1] ?? null }).eq('msg_id', s.msg_id)
    if (error) { setStato('errore: ' + error.message + ' (hai lanciato scoretrend_manuale.sql?)'); return }
    setSalvati({ ht, ft }); setStato('✓')
  }
  const inp = { background: '#020617', color: '#f8fafc', border: '1px solid #334155', borderRadius: 6, padding: '3px 5px', fontSize: 12, width: 44 }
  return (<>
    <td style={td}><input style={inp} placeholder="1-0" value={ht} onChange={e => setHt(e.target.value)} /></td>
    <td style={td}><input style={inp} placeholder="2-1" value={ft} onChange={e => setFt(e.target.value)} /></td>
    <td style={td}>{cambiato ? <button onClick={salva} style={{ background: '#059669', color: 'white', border: 0, borderRadius: 6, padding: '3px 8px', fontWeight: 800, fontSize: 11, cursor: 'pointer' }}>Salva</button> : <span style={{ fontSize: 11, color: stato.startsWith('errore') ? '#fca5a5' : '#86efac' }}>{stato}</span>}
      {cambiato && stato && <div style={{ fontSize: 10, color: '#fca5a5' }}>{stato}</div>}</td>
  </>)
}

const n2 = (x: number) => x.toLocaleString('it-IT', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
const quando = (iso: string | null) => iso ? new Date(iso).toLocaleString('it-IT', { timeZone: 'Europe/Rome', day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' }) : ''
// 06/10/2026 — cella "Betfair": prezzo dell'Exchange (back / lay) oppure quota calcolata ("derivata") o stimata dal modello
function CellaBetfair({ c, td }: { c: CellaBF | undefined; td: any }) {
  if (!c) return <td style={td} />
  if (c.stato === 'nd') return <td style={{ ...td, color: '#475569' }} title={c.motivo}>—</td>
  const colore = c.tipo === 'mercato' ? '#e2e8f0' : c.tipo === 'derivata' ? '#c4b5fd' : '#fdba74'
  return (
    <td style={{ ...td, whiteSpace: 'nowrap' }} title={c.dettaglio}>
      <div style={{ fontWeight: 800, color: colore }}>{c.testo}</div>
      <div style={{ fontSize: 10.5, color: '#94a3b8' }}>
        {c.tipo !== 'mercato' ? c.tipo : ''}
        {c.deltaBook != null ? `${c.tipo !== 'mercato' ? ' · ' : ''}book ${c.deltaBook >= 0 ? '+' : ''}${c.deltaBook.toFixed(1).replace('.', ',')}%` : ''}
        {c.vecchia ? <span style={{ color: '#fbbf24' }}>{c.iniziata ? ' · partita iniziata: prezzo di prima' : ' · ferma da ' + c.vecchiaMin + ' min'}</span> : null}
      </div>
    </td>)
}

// 06/10/2026 — cella "Al segnale": prezzo Betfair congelato quando è arrivato il segnale (non cambia più) e prezzo di chiusura
function CellaCongelata({ r, td }: { r: RigaCongelata | undefined; td: any }) {
  if (!r) return <td style={{ ...td, color: '#475569' }} title="nessuna quota Betfair congelata per questo segnale (partita non trovata, oppure segnale arrivato prima dell'avvio)">—</td>
  const f2 = (x: number | null | undefined) => (x == null ? '–' : Number(x).toFixed(2).replace('.', ','))
  const pct = (x: number) => `${x >= 0 ? '+' : ''}${x.toFixed(1).replace('.', ',')}%`
  const quando = (iso: string | null) => (iso ? new Date(iso).toLocaleString('it-IT', { timeZone: 'Europe/Rome', day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' }) : '—')
  const colore = r.tipo === 'mercato' ? '#e2e8f0' : r.tipo === 'derivata' ? '#c4b5fd' : '#fdba74'
  const rif = r.tipo === 'mercato' ? r.bf_back : r.bf_fair
  const book = r.quota_book != null && rif ? (Number(r.quota_book) / Number(rif) - 1) * 100 : null
  const ch = r.ch_il ? (r.ch_tipo === 'mercato' ? r.ch_back : r.ch_fair) : null
  const clv = r.quota_book != null && ch ? (Number(r.quota_book) / Number(ch) - 1) * 100 : null
  const prepartita = r.iniziata && r.vecchia
  const titolo = `Prezzo Betfair congelato il ${quando(r.congelato_il)} (segnale delle ${quando(r.segnale_il)}) · dati con il ritardo della chiave delayed`
    + (r.ch_il ? ` · chiusura letta il ${quando(r.ch_il)}: la percentuale tra parentesi dice quanto la quota del segnale batte la chiusura di Betfair` : '')
    + (prepartita ? ' · la partita era già iniziata: è il prezzo di prima del calcio d\'inizio' : '')
  return (
    <td style={{ ...td, whiteSpace: 'nowrap' }} title={titolo}>
      <div style={{ fontWeight: 800, color: colore }}>{r.testo}</div>
      <div style={{ fontSize: 10.5, color: '#94a3b8' }}>
        {r.tipo !== 'mercato' ? r.tipo : ''}
        {book != null ? `${r.tipo !== 'mercato' ? ' · ' : ''}book ${pct(book)}` : ''}
        {ch ? ` · chiusura ${f2(ch)}${clv != null ? ` (${pct(clv)})` : ''}` : ''}
        {prepartita ? <span style={{ color: '#fbbf24' }}> · prepartita</span> : null}
        {r.vecchia && !r.iniziata ? <span style={{ color: '#fbbf24' }}>{' · prezzo già vecchio di ' + r.eta_min + ' min'}</span> : null}
      </div>
    </td>)
}

// 06/10/2026 — perché alcuni segnali non hanno la quota Betfair: conteggio dei motivi e partite vicine per orario
function DiagnosiBF({ canale, righe, celle, eventi }: { canale: 'scoretrend' | 'pronox' | 'hunter'; righe: any[]; celle: Map<number, CellaBF>; eventi: EventoBF[] }) {
  const r = useMemo(() => riassuntoBF(canale, righe, celle, eventi), [canale, righe, celle, eventi])
  return (
    <details style={{ fontSize: 12, color: '#94a3b8', marginBottom: 8 }}>
      <summary style={{ cursor: 'pointer', color: '#7dd3fc', fontWeight: 700 }}>🔎 Betfair: {r.ok} segnali su {r.totale} con quota · perché gli altri no</summary>
      <div style={{ padding: '6px 4px', lineHeight: 1.6 }}>
        <div>Partite Betfair caricate: <b>{r.nEventi}</b>{r.nEventi ? ` (dal ${r.betfairDal} al ${r.betfairAl})` : ''} · segnale più recente: <b>{r.segnaleRecente || '—'}</b></div>
        {Object.entries(r.motivi).sort((a, b) => b[1] - a[1]).map(([m, n]) => <div key={m}><b>{n}</b> × {m}</div>)}
        {r.esempi.length > 0 && <div style={{ marginTop: 6, color: '#cbd5e1' }}>Segnali recenti con partita non trovata → partite Betfair vicine per orario:</div>}
        {r.esempi.map((e, i) => <div key={i}>• <b>{e.segnale}</b> <span style={{ color: '#64748b' }}>({e.quando})</span> → {e.vicini.length ? e.vicini.join(' | ') : 'nessuna partita Betfair in quell\'orario'}</div>)}
      </div>
    </details>)
}

const mercatoDi = (s: Segnale) => `${s.mercato || ''}${s.linea != null ? ' ' + String(s.linea).replace('.', ',') : ''}${s.tempo && s.tempo !== 'finale' ? ' ' + s.tempo : ''}`.trim()
const fascia = (q: number) => q < 1.4 ? '1,00-1,40' : q < 1.6 ? '1,40-1,60' : q < 1.8 ? '1,60-1,80' : q < 2.1 ? '1,80-2,10' : q < 3 ? '2,10-3,00' : '3,00+'

type Hunter = {
  msg_id:number; data_msg:string|null; competizione:string|null; casa:string|null; ospite:string|null; tipo_segnale:string|null;
  score_casa_segnale:number|null; score_ospite_segnale:number|null; minuto_segnale:number|null; fixture_id:number|null;
  score_casa_attuale:number|null; score_ospite_attuale:number|null; stato_match:string|null; esito:string|null; data_esito:string|null; minuti_al_gol:number|null
  fase?:string|null; quota?:number|null; ht_casa?:number|null; ht_ospite?:number|null; ft_casa?:number|null; ft_ospite?:number|null; esito_manuale?:boolean
}

// ─── 04/10/2026 · HUNTERBET: risultati, quota ed esito inseriti a mano ───
// L'esito si calcola dal risultato finale: "Gol casa/ospiti" = la squadra ha segnato DOPO il segnale
// (gol finali > gol al momento del segnale); per i PRE-LIVE si leggono i mercati (es. "12 + MG 1-3").
function valutaHunter(s: Hunter, fc: number, fo: number): 'VINTA' | 'PERSA' | null {
  if (s.tipo_segnale === 'GOL_CASA') return fc > (s.score_casa_segnale ?? 0) ? 'VINTA' : 'PERSA'
  if (s.tipo_segnale === 'GOL_OSPITI') return fo > (s.score_ospite_segnale ?? 0) ? 'VINTA' : 'PERSA'
  const tot = fc + fo
  const pezzi = String(s.tipo_segnale || '').toUpperCase().split('+').map(x => x.trim()).filter(Boolean)
  if (!pezzi.length) return null
  for (const p of pezzi) {
    let ok: boolean | null = null, m: RegExpMatchArray | null
    if (p === '1') ok = fc > fo; else if (p === 'X') ok = fc === fo; else if (p === '2') ok = fc < fo
    else if (p === '12') ok = fc !== fo; else if (p === '1X') ok = fc >= fo; else if (p === 'X2') ok = fc <= fo
    else if (/^(GG|GOAL)$/.test(p)) ok = fc > 0 && fo > 0; else if (/^(NG|NO ?GOAL)$/.test(p)) ok = !(fc > 0 && fo > 0)
    else if ((m = p.match(/^(?:OVER|O)\s*(\d+(?:[.,]5)?)$/))) ok = tot > Number(m[1].replace(',', '.'))
    else if ((m = p.match(/^(?:UNDER|U)\s*(\d+(?:[.,]5)?)$/))) ok = tot < Number(m[1].replace(',', '.'))
    else if ((m = p.match(/^(?:MG|MULTIGOL)\s*(\d+)\s*-\s*(\d+)$/))) ok = tot >= Number(m[1]) && tot <= Number(m[2])
    if (ok === null) return null          // mercato non riconosciuto: esito da scegliere a mano
    if (!ok) return 'PERSA'
  }
  return 'VINTA'
}
const leggiRis = (t: string): [number, number] | null => { const m = t.trim().match(/^(\d{1,2})\s*[-–:]\s*(\d{1,2})$/); return m ? [Number(m[1]), Number(m[2])] : null }

function RigaHunter({ s, td, bf, cg, onSalvato }: { s: Hunter; td: any; bf?: CellaBF; cg?: RigaCongelata; onSalvato: (r: Hunter) => void }) {
  const fmt = (a?: number | null, b?: number | null) => a != null && b != null ? `${a}-${b}` : ''
  const [ft, setFt] = useState(fmt(s.ft_casa, s.ft_ospite))
  const [ht, setHt] = useState(fmt(s.ht_casa, s.ht_ospite))
  const [quota, setQuota] = useState(s.quota != null ? String(s.quota).replace('.', ',') : '')
  const [esito, setEsito] = useState<string>(s.esito_manuale ? (s.esito || '') : 'auto')
  const [stato, setStato] = useState('')
  const rFt = leggiRis(ft)
  const auto = rFt ? valutaHunter(s, rFt[0], rFt[1]) : null
  const esitoFinale = esito === 'auto' ? (auto || s.esito || null) : (esito || null)
  const cambiato = ft !== fmt(s.ft_casa, s.ft_ospite) || ht !== fmt(s.ht_casa, s.ht_ospite) || quota !== (s.quota != null ? String(s.quota).replace('.', ',') : '') || (esito === 'auto' ? !!s.esito_manuale || (auto != null && auto !== s.esito) : esito !== (s.esito || ''))
  async function salva() {
    if (ft && !rFt) { setStato('risultato finale: scrivi es. 2-1'); return }
    const rHt = ht ? leggiRis(ht) : null
    if (ht && !rHt) { setStato('1° tempo: scrivi es. 1-0'); return }
    const q = quota ? Number(quota.replace(',', '.')) : null
    if (quota && !(q && q > 1)) { setStato('quota non valida'); return }
    const patch: Record<string, any> = { ft_casa: rFt?.[0] ?? null, ft_ospite: rFt?.[1] ?? null, ht_casa: rHt?.[0] ?? null, ht_ospite: rHt?.[1] ?? null, quota: q,
      esito: esitoFinale, esito_manuale: esito !== 'auto', stato_match: rFt ? 'FINITA' : s.stato_match,
      data_esito: esitoFinale && !s.data_esito ? new Date().toISOString() : s.data_esito, aggiornato: new Date().toISOString() }
    if (rFt) { patch.score_casa_attuale = rFt[0]; patch.score_ospite_attuale = rFt[1] }
    setStato('salvo…')
    const { error } = await supabase.from('hunterbet_segnali').update(patch).eq('msg_id', s.msg_id)
    if (error) { setStato('errore: ' + error.message + ' (hai lanciato hunterbet_manuale.sql?)'); return }
    setStato('✓ salvato'); onSalvato({ ...s, ...patch })
  }
  const inp = { background: '#020617', color: '#f8fafc', border: '1px solid #334155', borderRadius: 6, padding: '3px 6px', fontSize: 12, width: 52 }
  const live = (s.fase || (s.tipo_segnale?.startsWith('GOL_') ? 'LIVE' : 'PRE-LIVE')) === 'LIVE'
  return (
    <tr>
      <td style={td}>{quando(s.data_msg)}</td>
      <td style={{ ...td, fontWeight: 800, color: live ? '#f87171' : '#a78bfa' }}>{live ? '🔴 LIVE' : '🕐 PRE-LIVE'}</td>
      <td style={{ ...td, fontWeight: 800 }}>{s.casa} – {s.ospite}</td>
      <td style={{ ...td, color: '#94a3b8' }}>{s.competizione}</td>
      <td style={td}>{s.tipo_segnale === 'GOL_CASA' ? '🏠 Gol casa' : s.tipo_segnale === 'GOL_OSPITI' ? '✈️ Gol ospiti' : <b>{s.tipo_segnale}</b>}</td>
      <td style={td}>{s.score_casa_segnale != null ? `${s.score_casa_segnale}–${s.score_ospite_segnale}` : '—'}</td>
      <td style={td}><input style={inp} placeholder="1-0" value={ht} onChange={e => setHt(e.target.value)} /></td>
      <td style={td}><input style={{ ...inp, borderColor: rFt || !ft ? '#334155' : '#f87171' }} placeholder="2-1" value={ft} onChange={e => setFt(e.target.value)} /></td>
      <td style={td}><input style={inp} placeholder="1,70" value={quota} onChange={e => setQuota(e.target.value.replace(/[^0-9.,]/g, ''))} /></td>
      <CellaBetfair c={bf} td={td} />
      <CellaCongelata r={cg} td={td} />
      <td style={td}>
        <select value={esito} onChange={e => setEsito(e.target.value)} style={{ ...inp, width: 'auto' }}>
          <option value="auto">auto{auto ? ` (${auto === 'VINTA' ? 'vinta' : 'persa'})` : ''}</option><option value="VINTA">vinta</option><option value="PERSA">persa</option><option value="NULLA">nulla</option><option value="">in corso</option>
        </select>
        <div style={{ fontWeight: 900, fontSize: 11, color: esitoFinale === 'VINTA' ? '#86efac' : esitoFinale === 'PERSA' ? '#fca5a5' : '#94a3b8' }}>{esitoFinale ? (esitoFinale === 'VINTA' ? '🟢 vinta' : esitoFinale === 'PERSA' ? '🔴 persa' : '⚪ nulla') : '⏳ in corso'}{esitoFinale && quota && Number(quota.replace(',', '.')) > 1 ? ` · ${esitoFinale === 'VINTA' ? '+' + (Number(quota.replace(',', '.')) - 1).toFixed(2).replace('.', ',') : esitoFinale === 'PERSA' ? '−1' : '0'} u` : ''}</div>
      </td>
      <td style={td}>
        <button onClick={salva} disabled={!cambiato} style={{ background: cambiato ? '#059669' : '#1e293b', color: 'white', border: 0, borderRadius: 6, padding: '4px 10px', fontWeight: 800, fontSize: 12, cursor: cambiato ? 'pointer' : 'default' }}>Salva</button>
        {stato && <div style={{ fontSize: 10.5, color: stato.startsWith('✓') ? '#86efac' : stato === 'salvo…' ? '#94a3b8' : '#fca5a5' }}>{stato}</div>}
      </td>
    </tr>)
}

// ─── 04/10/2026 · PRONOX: segnali sopra soglia di /oggi, letti dalla vista pronox_segnali ───
// Sola lettura: esiti e risultati li scrive la cron pronox-outcomes (football-data.org).
// Le unità si contano solo dove c'è la quota (1X2 e Over/Under 2,5); il BTTS conta nelle % vinte.
type Pronox = {
  msg_id: number; data_msg: string | null; data_partita: string | null; event_id: string; competizione: string | null
  casa: string | null; ospite: string | null; fotografia: string | null; mercato: string; selezione: string; etichetta: string
  forte: boolean | null; prob_grezza: number | null; prob_calibrata: number | null; prob_mercato: number | null
  quota: number | null; bookmaker: string | null; ev: number | null; value: boolean; unita: number
  esito: string | null; profitto: number | null; ht_casa: number | null; ht_ospite: number | null; ft_casa: number | null; ft_ospite: number | null
}
const pc = (x: number | null | undefined, d = 1) => x == null ? '' : `${(100 * Number(x)).toFixed(d).replace('.', ',')}%`

function raggruppaPronox(lista: Pronox[], chiave: (s: Pronox) => string): Riga[] {
  const m = new Map<string, Riga & { nq: number; sq: number }>()
  for (const s of lista) {
    if (s.esito !== 'VINTA' && s.esito !== 'PERSA') continue
    const k = chiave(s) || '—'
    const r = m.get(k) || { voce: k, bet: 0, vinte: 0, unita: 0, puntato: 0, quota: 0, nq: 0, sq: 0 }
    r.bet++; if (s.esito === 'VINTA') r.vinte++
    if (s.quota != null) { r.nq++; r.sq += Number(s.quota); r.puntato += 1; r.unita += Number(s.profitto || 0) }
    m.set(k, r)
  }
  // la tabella fa quota / bet: la quota media è calcolata solo sulle bet con quota
  return [...m.values()].map(r => ({ voce: r.voce, bet: r.bet, vinte: r.vinte, unita: r.unita, puntato: r.puntato, quota: r.nq ? (r.sq / r.nq) * r.bet : 0 }))
    .sort((a, b) => b.bet - a.bet)
}

function SchedaPronox({ dati, sel, th, td, tabellaPagella, eventiBF, congelati }: { dati: Pronox[]; sel: any; th: any; td: any; tabellaPagella: (r: Riga[]) => any; eventiBF: EventoBF[]; congelati: Map<string, RigaCongelata> }) {
  const [etichetta, setEtichetta] = useState('')
  const [stato, setStato] = useState('')
  const [soloValue, setSoloValue] = useState(false)
  const [soloForti, setSoloForti] = useState(false)
  const [cerca, setCerca] = useState('')
  const etichette = useMemo(() => [...new Set(dati.map(s => s.etichetta))].sort(), [dati])
  const visibili = useMemo(() => {
    const q = cerca.trim().toLowerCase()
    return dati.filter(s =>
      (!etichetta || s.etichetta === etichetta) && (!stato || (stato === 'corso' ? !s.esito : s.esito === stato)) &&
      (!soloValue || s.value) && (!soloForti || s.forte) &&
      (!q || `${s.competizione} ${s.casa} ${s.ospite}`.toLowerCase().includes(q)))
  }, [dati, etichetta, stato, soloValue, soloForti, cerca])
  const cellePx = useMemo(() => { const mp = new Map<number, CellaBF>(); for (const s of visibili) mp.set(s.msg_id, quotaPerSegnale('pronox', s, eventiBF)); return mp }, [visibili, eventiBF])   // 06/10/2026

  const chiuse = visibili.filter(s => s.esito === 'VINTA' || s.esito === 'PERSA')
  const vinte = chiuse.filter(s => s.esito === 'VINTA').length
  const conQuota = chiuse.filter(s => s.quota != null)
  const unita = conQuota.reduce((a, s) => a + Number(s.profitto || 0), 0)
  const probMedia = chiuse.length ? chiuse.reduce((a, s) => a + Number(s.prob_grezza || 0), 0) / chiuse.length : null
  const ris = (a: number | null, b: number | null) => a != null && b != null ? `${a}-${b}` : ''
  const blocchi: [string, Riga[]][] = [
    ['Per segnale', raggruppaPronox(visibili, s => s.etichetta)],
    ['Value bet o no', raggruppaPronox(visibili, s => s.value ? '💎 VALUE (EV > 3%)' : 'Senza value')],
    ['Forte o normale', raggruppaPronox(visibili, s => s.forte ? '🔥 Forte' : '→ Normale')],
    ['Per competizione', raggruppaPronox(visibili, s => s.competizione || '—')],
  ]

  return (<>
    <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center', marginBottom: 14 }}>
      <select style={sel} value={etichetta} onChange={e => setEtichetta(e.target.value)}>
        <option value="">Tutti i segnali</option>{etichette.map(m => <option key={m}>{m}</option>)}
      </select>
      <select style={sel} value={stato} onChange={e => setStato(e.target.value)}>
        <option value="">Tutti gli esiti</option><option value="corso">Da giocare / in corso</option><option value="VINTA">Vinte</option><option value="PERSA">Perse</option><option value="NULLA">Nulle</option>
      </select>
      <label style={{ fontSize: 12, color: '#cbd5e1', display: 'flex', gap: 5, alignItems: 'center' }}><input type="checkbox" checked={soloValue} onChange={e => setSoloValue(e.target.checked)} /> solo VALUE</label>
      <label style={{ fontSize: 12, color: '#cbd5e1', display: 'flex', gap: 5, alignItems: 'center' }}><input type="checkbox" checked={soloForti} onChange={e => setSoloForti(e.target.checked)} /> solo forti 🔥</label>
      <input style={{ ...sel, width: 220 }} placeholder="🔎 Squadra, competizione…" value={cerca} onChange={e => setCerca(e.target.value)} />
    </div>

    <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', marginBottom: 16 }}>
      {[['Segnali', String(visibili.length)], ['Chiusi', String(chiuse.length)],
        ['Vinte', chiuse.length ? `${vinte} (${pc(vinte / chiuse.length)})` : '—'],
        ['Prob. media dichiarata', probMedia != null ? pc(probMedia) : '—'],
        ['Unità (con quota)', conQuota.length ? `${unita >= 0 ? '+' : ''}${n2(unita)}` : '—'],
        ['Rendimento', conQuota.length ? `${unita >= 0 ? '+' : ''}${(100 * unita / conQuota.length).toFixed(1).replace('.', ',')}%` : '—'],
        ['Da giocare', String(visibili.filter(s => !s.esito).length)]].map(([t, v]) => (
        <div key={t} style={{ background: 'rgba(15,23,42,.8)', border: '1px solid #1e293b', borderRadius: 12, padding: '10px 14px', minWidth: 120 }}>
          <div style={{ fontSize: 11, color: '#94a3b8' }}>{t}</div>
          <div style={{ fontSize: 20, fontWeight: 900, color: t.startsWith('Unità') || t === 'Rendimento' ? (conQuota.length ? (unita >= 0 ? '#86efac' : '#fca5a5') : '#f8fafc') : '#f8fafc' }}>{v}</div>
        </div>))}
    </div>

    <div style={{ background: 'rgba(15,23,42,.6)', border: '1px solid #1e293b', borderRadius: 14, padding: 12, marginBottom: 18, overflowX: 'auto' }}>
      <div style={{ fontWeight: 900, marginBottom: 4 }}>PronoX · {visibili.length}</div>
      <DiagnosiBF canale="pronox" righe={visibili} celle={cellePx} eventi={eventiBF} />
      <div style={{ fontSize: 11.5, color: '#94a3b8', marginBottom: 8 }}>Ogni esito sopra la soglia di /oggi, preso dalla fotografia del giorno prima (t24h). Tre probabilità: <b>modello</b> (grezza, decide il segnale), <b>/oggi</b> (calibrata, usata per il VALUE), <b>bookmaker</b> (senza margine). Esiti e risultati arrivano da soli.</div>
      <div style={{ maxHeight: 460, overflowY: 'auto' }}>
        <table style={{ borderCollapse: 'collapse', width: '100%' }}>
          <thead><tr>{['Partita il', 'Partita', 'Competizione', 'Segnale', 'Modello', '/oggi', 'Bookmaker', 'Quota', 'Betfair', 'Al segnale', 'EV', 'Esito', 'Unità', '1° tempo', 'Finale'].map((h, i) => <th key={i} style={{ ...th, position: 'sticky', top: 0, background: '#0f172a' }}>{h}</th>)}</tr></thead>
          <tbody>{visibili.map(s => (
            <tr key={s.msg_id}>
              <td style={{ ...td, whiteSpace: 'nowrap' }}>{quando(s.data_partita)}</td>
              <td style={{ ...td, fontWeight: 800 }}>{s.casa || s.ospite ? `${s.casa ?? '?'} – ${s.ospite ?? '?'}` : <span style={{ color: '#64748b', fontWeight: 400 }}>nomi alla fotografia t24h</span>}</td>
              <td style={{ ...td, color: '#94a3b8' }}>{s.competizione}</td>
              <td style={{ ...td, fontWeight: 700, whiteSpace: 'nowrap' }}>{s.forte ? '🔥 ' : ''}{s.etichetta}{s.value ? ' 💎' : ''}</td>
              <td style={{ ...td, fontWeight: 800 }}>{pc(s.prob_grezza)}</td>
              <td style={td}>{pc(s.prob_calibrata)}</td>
              <td style={{ ...td, color: '#94a3b8' }}>{pc(s.prob_mercato)}</td>
              <td style={{ ...td, fontWeight: 800, color: s.quota != null && Number(s.quota) < 1.4 ? '#fbbf24' : '#f8fafc' }} title={s.quota != null && Number(s.quota) < 1.4 ? 'Sotto la regola di 1,40' : ''}>{s.quota != null ? String(s.quota).replace('.', ',') : ''}</td>
              <CellaBetfair c={cellePx.get(s.msg_id)} td={td} />
              <CellaCongelata r={congelati.get('pronox|' + s.msg_id)} td={td} />
              <td style={{ ...td, color: s.ev != null && s.ev > 0.03 ? '#86efac' : '#94a3b8' }}>{s.ev != null ? `${s.ev >= 0 ? '+' : ''}${pc(s.ev)}` : ''}</td>
              <td style={{ ...td, fontWeight: 900, color: s.esito === 'VINTA' ? '#86efac' : s.esito === 'PERSA' ? '#fca5a5' : '#94a3b8' }}>{s.esito ? (s.esito === 'VINTA' ? '🟢 vinta' : s.esito === 'PERSA' ? '🔴 persa' : '⚪ nulla') : '⏳ da giocare'}</td>
              <td style={{ ...td, color: Number(s.profitto) >= 0 ? '#86efac' : '#fca5a5' }}>{s.profitto != null ? `${s.profitto >= 0 ? '+' : ''}${n2(Number(s.profitto))}` : ''}</td>
              <td style={td}>{ris(s.ht_casa, s.ht_ospite)}</td>
              <td style={{ ...td, fontWeight: 700 }}>{ris(s.ft_casa, s.ft_ospite)}</td>
            </tr>))}</tbody>
        </table>
      </div>
    </div>

    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(420px, 1fr))', gap: 14 }}>
      {blocchi.map(([titolo, righe]) => (
        <div key={titolo} style={{ background: 'rgba(15,23,42,.6)', border: '1px solid #1e293b', borderRadius: 14, padding: 12 }}>
          <div style={{ fontWeight: 900, marginBottom: 8, color: '#7dd3fc' }}>📊 {titolo}</div>
          {righe.length ? tabellaPagella(righe) : <div style={{ fontSize: 12, color: '#64748b' }}>Ancora nessun segnale chiuso.</div>}
        </div>))}
    </div>
    <p style={{ fontSize: 11, color: '#64748b', marginTop: 16 }}>1 unità per segnale. Unità e rendimento contano solo i segnali con quota (1X2 e Over/Under 2,5); il BTTS entra nelle % vinte. La calibrazione (quando dice 70%, vince il 70%?) è nella pagina 📈 Analisi.</p>
  </>)
}

type Riga = { voce: string; bet: number; vinte: number; unita: number; puntato: number; quota: number }
function raggruppa(lista: Segnale[], chiave: (s: Segnale) => string): Riga[] {
  const m = new Map<string, Riga>()
  for (const s of lista) {
    if (s.esito !== 'VINTA' && s.esito !== 'PERSA') continue
    const k = chiave(s) || '—'
    const r = m.get(k) || { voce: k, bet: 0, vinte: 0, unita: 0, puntato: 0, quota: 0 }
    r.bet++; if (s.esito === 'VINTA') r.vinte++
    r.unita += Number(s.profitto || 0); r.puntato += Number(s.unita || 1); r.quota += Number(s.quota || 0)
    m.set(k, r)
  }
  return [...m.values()].sort((a, b) => b.bet - a.bet)
}

export default function SegnaliPage() {
  const [tab, setTab] = useState<'scoretrend'|'hunterbet'|'pronox'>('scoretrend')
  const [dati, setDati] = useState<Segnale[]>([])
  const [hunter, setHunter] = useState<Hunter[]>([])
  const [pronox, setPronox] = useState<Pronox[]>([])
  const [errore, setErrore] = useState('')
  const [aggiornato, setAggiornato] = useState<Date | null>(null)
  const [periodo, setPeriodo] = useState('30')
  const [stato, setStato] = useState('')
  const [tipo, setTipo] = useState('')
  const [mercato, setMercato] = useState('')
  const [soloSopra140, setSoloSopra140] = useState(false)
  const [cerca, setCerca] = useState('')
  const [sportPronox, setSportPronox] = useState<'calcio' | 'tennis'>('calcio')   // 07/10/2026

  const carica = useCallback(async () => {
    const out: Segnale[] = []
    const da = periodo === 'tutto' ? null : new Date(Date.now() - Number(periodo) * 86400000).toISOString()
    for (let from = 0; ; from += 1000) {
      let q = supabase.from('scoretrend_segnali').select('*').order('data_msg', { ascending: false }).range(from, from + 999)
      if (da) q = q.gte('data_msg', da)
      const { data, error } = await q
      if (error) { setErrore('Segnali non disponibili: ' + error.message + ' (hai lanciato scoretrend_segnali.sql?)'); return }
      out.push(...((data || []) as Segnale[]))
      if (!data || data.length < 1000) break
    }
    setErrore(''); setDati(out)
    const h=await supabase.from('hunterbet_segnali').select('*').order('data_msg',{ascending:false}).limit(5000)
    if(!h.error) setHunter((h.data||[]) as Hunter[])
    const p = await supabase.from('pronox_segnali').select('*').order('data_partita', { ascending: false }).limit(5000)
    if (!p.error) setPronox((p.data || []) as Pronox[])
    setAggiornato(new Date())
  }, [periodo])
  useEffect(() => { carica(); const t = setInterval(carica, 30000); return () => clearInterval(t) }, [carica])

  // 06/10/2026 — quote Betfair (solo lettura): partite delle ultime 48 ore con i loro mercati, riletto ogni minuto
  const [eventiBF, setEventiBF] = useState<EventoBF[]>([])
  const [erroreBF, setErroreBF] = useState('')
  const [congelati, setCongelati] = useState<Map<string, RigaCongelata>>(new Map())
  useEffect(() => {
    let vivo = true
    const leggi = async () => {
      try { const e = await caricaBetfair(supabase); if (vivo) { setEventiBF(e); setErroreBF('') } } catch (x: any) { if (vivo) setErroreBF(String(x?.message || x)) }
      try { const c = await caricaCongelati(supabase); if (vivo) setCongelati(c) } catch { /* tabella betfair_segnali_quote non ancora creata */ }
    }
    leggi(); const t = setInterval(leggi, 60000)
    return () => { vivo = false; clearInterval(t) }
  }, [])

  const mercati = useMemo(() => [...new Set(dati.map(mercatoDi))].sort(), [dati])
  const visibili = useMemo(() => {
    const q = cerca.trim().toLowerCase()
    return dati.filter(s =>
      (!stato || (stato === 'corso' ? !s.esito : s.esito === stato)) &&
      (!tipo || s.live === tipo) && (!mercato || mercatoDi(s) === mercato) &&
      (!soloSopra140 || Number(s.quota) >= 1.4) &&
      (!q || `${s.competizione} ${s.casa} ${s.ospite} ${s.selezione}`.toLowerCase().includes(q)))
  }, [dati, stato, tipo, mercato, soloSopra140, cerca])

  const cellaST = useMemo(() => { const mp = new Map<number, CellaBF>(); for (const s of visibili) mp.set(s.msg_id, quotaPerSegnale('scoretrend', s, eventiBF)); return mp }, [visibili, eventiBF])
  const cellaHT = useMemo(() => { const mp = new Map<number, CellaBF>(); for (const s of hunter) mp.set(s.msg_id, quotaPerSegnale('hunter', s, eventiBF)); return mp }, [hunter, eventiBF])

  const totale = raggruppa(visibili, () => 'Totale')[0]
  const blocchi: [string, Riga[]][] = [
    ['Per mercato', raggruppa(visibili, mercatoDi)],
    ['Live o prepartita', raggruppa(visibili, s => s.live || '—')],
    ['Per fascia di quota', raggruppa(visibili, s => fascia(Number(s.quota || 0))).sort((a, b) => a.voce.localeCompare(b.voce))],
    ['Per competizione (almeno 5 bet)', raggruppa(visibili, s => s.competizione || '—').filter(r => r.bet >= 5)],
  ]
  const recenti = (iso: string | null) => iso && Date.now() - new Date(iso).getTime() < 30 * 60000

  const sel = { background: '#020617', color: '#f8fafc', border: '1px solid #334155', borderRadius: 8, padding: '6px 9px', fontSize: 12 }
  const th = { textAlign: 'left' as const, padding: '6px 8px', fontSize: 11, color: '#94a3b8', borderBottom: '1px solid #334155', whiteSpace: 'nowrap' as const }
  const td = { padding: '6px 8px', fontSize: 12.5, color: '#e2e8f0', borderBottom: '1px solid rgba(51,65,85,.5)', verticalAlign: 'top' as const }
  const tabellaPagella = (righe: Riga[]) => (
    <table style={{ borderCollapse: 'collapse', width: '100%' }}>
      <thead><tr>{['Voce', 'Bet', '% vinte', 'Quota media', 'Unità', 'Rendimento'].map(h => <th key={h} style={th}>{h}</th>)}</tr></thead>
      <tbody>{righe.map(r => (
        <tr key={r.voce}>
          <td style={{ ...td, fontWeight: 700 }}>{r.voce}</td><td style={td}>{r.bet}</td>
          <td style={td}>{(100 * r.vinte / r.bet).toFixed(1).replace('.', ',')}%</td>
          <td style={td}>{(r.quota / r.bet).toFixed(2).replace('.', ',')}</td>
          <td style={{ ...td, color: r.unita >= 0 ? '#86efac' : '#fca5a5', fontWeight: 800 }}>{r.unita >= 0 ? '+' : ''}{n2(r.unita)}</td>
          <td style={{ ...td, color: r.unita >= 0 ? '#86efac' : '#fca5a5' }}>{r.puntato ? `${r.unita >= 0 ? '+' : ''}${(100 * r.unita / r.puntato).toFixed(1).replace('.', ',')}%` : ''}</td>
        </tr>))}</tbody>
    </table>)

  return (
    <div style={{ minHeight: '100vh', background: '#0b1220', color: '#e2e8f0', fontFamily: 'system-ui, -apple-system, Segoe UI, sans-serif' }}>
      <div style={{ maxWidth: 1300, margin: '0 auto', padding: '22px 18px 60px' }}>
        <Link href="/profit-tracker" style={{ color: '#7dd3fc', fontSize: 12, textDecoration: 'none', fontWeight: 700 }}>← Torna al Profit Tracker</Link>
        <h1 style={{ fontSize: 28, margin: '8px 0 2px', color: '#f8fafc' }}>📡 Segnali</h1>
        <div style={{display:'flex',gap:8,margin:'12px 0 14px'}}>
          <button onClick={()=>setTab('scoretrend')} style={{...sel,cursor:'pointer',fontWeight:900,borderColor:tab==='scoretrend'?'#38bdf8':'#334155'}}>ScoreTrend</button>
          <button onClick={()=>setTab('hunterbet')} style={{...sel,cursor:'pointer',fontWeight:900,borderColor:tab==='hunterbet'?'#38bdf8':'#334155'}}>Hunterbet</button>
          <button onClick={()=>setTab('pronox')} style={{...sel,cursor:'pointer',fontWeight:900,borderColor:tab==='pronox'?'#38bdf8':'#334155'}}>PronoX</button>
          {/* 04/10/2026 — pagina di analisi: torte, segmenti, simulazione */}
          <Link href="/profit-tracker/segnali/analisi" style={{...sel,cursor:'pointer',fontWeight:900,textDecoration:'none',borderColor:'#a78bfa',color:'#c4b5fd'}}>📈 Analisi</Link>
        </div>
        <div style={{ fontSize: 13, color: '#94a3b8', marginBottom: 14 }}>
          Arrivano dal canale in tempo reale · aggiornamento ogni 30 secondi{aggiornato ? ` · ultimo alle ${aggiornato.toLocaleTimeString('it-IT', { hour: '2-digit', minute: '2-digit', second: '2-digit' })}` : ''}
        </div>
        <div style={{ fontSize: 12, color: erroreBF ? '#fca5a5' : '#64748b', marginBottom: 14 }}>
          {erroreBF ? `Quote Betfair non leggibili: ${erroreBF}` : eventiBF.length ? `Quote Betfair: ${eventiBF.length} partite caricate · colonna "Betfair" = prezzo ora (back / lay) · "derivata" e "stimata" = calcolate, non giocabili · "—" = partita non trovata o mercato non disponibile` : 'Quote Betfair: nessun dato disponibile'}
        </div>

{tab==='pronox' ? (
        <>
          <div style={{ display: 'flex', gap: 8, marginBottom: 14 }}>
            <button onClick={() => setSportPronox('calcio')} style={{ ...sel, cursor: 'pointer', fontWeight: 900, borderColor: sportPronox === 'calcio' ? '#38bdf8' : '#334155' }}>⚽ Calcio</button>
            <button onClick={() => setSportPronox('tennis')} style={{ ...sel, cursor: 'pointer', fontWeight: 900, borderColor: sportPronox === 'tennis' ? '#38bdf8' : '#334155' }}>🎾 Tennis</button>
          </div>
          {sportPronox === 'tennis' ? <SchedaTennis sel={sel} th={th} td={td} eventiBF={eventiBF} />
            : <SchedaPronox dati={pronox} sel={sel} th={th} td={td} tabellaPagella={tabellaPagella} eventiBF={eventiBF} congelati={congelati} />}
        </>
        ) : tab==='hunterbet' ? (
        <div style={{ background:'rgba(15,23,42,.6)', border:'1px solid #1e293b', borderRadius:14, padding:12, overflowX:'auto' }}>
          <div style={{fontWeight:900,marginBottom:4}}>Hunterbet · {hunter.length}</div>
          <DiagnosiBF canale="hunter" righe={hunter} celle={cellaHT} eventi={eventiBF} />
          <div style={{fontSize:11.5,color:'#94a3b8',marginBottom:8}}>Scrivi il risultato finale (es. 2-1) e, se lo sai, quello del 1° tempo: l'esito si calcola da solo ("auto"). Puoi sceglierlo a mano se il mercato non viene riconosciuto. La quota serve per la pagella; arriverà da Betfair quando sarà collegato.</div>
          <table style={{borderCollapse:'collapse',width:'100%'}}>
            <thead><tr>{['Arrivato','Fase','Partita','Competizione','Segnale','Ris. al segnale','1° tempo','Finale','Quota','Betfair','Al segnale','Esito',''].map(h=><th key={h} style={th}>{h}</th>)}</tr></thead>
            <tbody>{hunter.map(s=><RigaHunter key={s.msg_id} s={s} td={td} bf={cellaHT.get(s.msg_id)} cg={congelati.get('hunter|' + s.msg_id)} onSalvato={r=>setHunter((v:Hunter[])=>v.map(x=>x.msg_id===r.msg_id?r:x))} />)}</tbody>
          </table>
        </div>
        ) : (<>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center', marginBottom: 14 }}>
          <select style={sel} value={periodo} onChange={e => setPeriodo(e.target.value)}>
            <option value="1">Ultime 24 ore</option><option value="7">Ultimi 7 giorni</option><option value="30">Ultimi 30 giorni</option><option value="90">Ultimi 90 giorni</option><option value="tutto">Tutto lo storico</option>
          </select>
          <select style={sel} value={stato} onChange={e => setStato(e.target.value)}>
            <option value="">Tutti gli esiti</option><option value="corso">In corso</option><option value="VINTA">Vinte</option><option value="PERSA">Perse</option><option value="NULLA">Nulle</option>
          </select>
          <select style={sel} value={tipo} onChange={e => setTipo(e.target.value)}>
            <option value="">Live e prepartita</option><option value="live">Solo live</option><option value="prepartita">Solo prepartita</option>
          </select>
          <select style={sel} value={mercato} onChange={e => setMercato(e.target.value)}>
            <option value="">Tutti i mercati</option>{mercati.map(m => <option key={m}>{m}</option>)}
          </select>
          <label style={{ fontSize: 12, color: '#cbd5e1', display: 'flex', gap: 5, alignItems: 'center' }}><input type="checkbox" checked={soloSopra140} onChange={e => setSoloSopra140(e.target.checked)} /> solo quota ≥ 1,40</label>
          <input style={{ ...sel, width: 220 }} placeholder="🔎 Squadra, competizione…" value={cerca} onChange={e => setCerca(e.target.value)} />
          <button style={{ ...sel, cursor: 'pointer', fontWeight: 800 }} onClick={carica}>↻ Aggiorna</button>
        </div>
        {errore && <div style={{ color: '#fca5a5', marginBottom: 12, fontSize: 13 }}>{errore}</div>}

        {totale && (
          <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', marginBottom: 16 }}>
            {[['Bet chiuse', String(totale.bet)], ['Vinte', `${totale.vinte} (${(100 * totale.vinte / totale.bet).toFixed(1).replace('.', ',')}%)`], ['Quota media', (totale.quota / totale.bet).toFixed(2).replace('.', ',')],
              ['Unità', `${totale.unita >= 0 ? '+' : ''}${n2(totale.unita)}`], ['Rendimento', `${totale.unita >= 0 ? '+' : ''}${(100 * totale.unita / totale.puntato).toFixed(1).replace('.', ',')}%`],
              ['In corso', String(visibili.filter(s => !s.esito).length)]].map(([t, v]) => (
              <div key={t} style={{ background: 'rgba(15,23,42,.8)', border: '1px solid #1e293b', borderRadius: 12, padding: '10px 14px', minWidth: 120 }}>
                <div style={{ fontSize: 11, color: '#94a3b8' }}>{t}</div>
                <div style={{ fontSize: 20, fontWeight: 900, color: t === 'Unità' || t === 'Rendimento' ? (totale.unita >= 0 ? '#86efac' : '#fca5a5') : '#f8fafc' }}>{v}</div>
              </div>))}
          </div>
        )}

        <div style={{ background: 'rgba(15,23,42,.6)', border: '1px solid #1e293b', borderRadius: 14, padding: 12, marginBottom: 18, overflowX: 'auto' }}>
          <div style={{ fontWeight: 900, marginBottom: 8 }}>Segnali · {visibili.length}</div>
          <DiagnosiBF canale="scoretrend" righe={visibili} celle={cellaST} eventi={eventiBF} />
          <div style={{ maxHeight: 460, overflowY: 'auto' }}>
            <table style={{ borderCollapse: 'collapse', width: '100%' }}>
              <thead><tr>{['Arrivato', 'Partita', 'Competizione', 'Tipo', 'Mercato', 'Giocata', 'Quota', 'Betfair', 'Al segnale', 'Esito', 'Unità', '', '1° tempo', 'Finale', ''].map((h, i) => <th key={i} style={{ ...th, position: 'sticky', top: 0, background: '#0f172a' }}>{h}</th>)}</tr></thead>
              <tbody>{visibili.map(s => (
                <tr key={s.msg_id} style={{ background: recenti(s.data_msg) && !s.esito ? 'rgba(56,189,248,.08)' : undefined }}>
                  <td style={{ ...td, whiteSpace: 'nowrap' }}>{recenti(s.data_msg) && !s.esito ? '🆕 ' : ''}{quando(s.data_msg)}</td>
                  <td style={{ ...td, fontWeight: 800 }}>{s.casa} – {s.ospite}<div style={{ fontSize: 11, color: '#94a3b8', fontWeight: 400 }}>ore {s.ora}</div></td>
                  <td style={{ ...td, color: '#94a3b8' }}>{s.competizione}</td>
                  <td style={td}>{s.live === 'live' ? `🔴 live ${s.minuto ?? ''}'` : 'prepartita'}</td>
                  <td style={td}>{mercatoDi(s)}</td>
                  <td style={{ ...td, fontWeight: 700 }}>{s.selezione}</td>
                  <td style={{ ...td, fontWeight: 800, color: Number(s.quota) < 1.4 ? '#fbbf24' : '#f8fafc' }} title={Number(s.quota) < 1.4 ? 'Sotto la regola di 1,40' : ''}>{String(s.quota ?? '').replace('.', ',')}</td>
                  <CellaBetfair c={cellaST.get(s.msg_id)} td={td} />
                  <CellaCongelata r={congelati.get('scoretrend|' + s.msg_id)} td={td} />
                  <td style={{ ...td, fontWeight: 900, color: s.esito === 'VINTA' ? '#86efac' : s.esito === 'PERSA' ? '#fca5a5' : '#94a3b8' }}>{s.esito ? (s.esito === 'VINTA' ? '🟢 vinta' : s.esito === 'PERSA' ? '🔴 persa' : '⚪ nulla') : '⏳ in corso'}</td>
                  <td style={{ ...td, color: Number(s.profitto) >= 0 ? '#86efac' : '#fca5a5' }}>{s.profitto != null ? `${s.profitto >= 0 ? '+' : ''}${n2(Number(s.profitto))}` : ''}</td>
                  <td style={td}>{s.link && <a href={s.link} target="_blank" rel="noopener noreferrer" style={{ color: '#7dd3fc', fontSize: 11 }}>apri</a>}</td>
                  <CelleRisultato s={s} td={td} />
                </tr>))}</tbody>
            </table>
          </div>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(420px, 1fr))', gap: 14 }}>
          {blocchi.map(([titolo, righe]) => (
            <div key={titolo} style={{ background: 'rgba(15,23,42,.6)', border: '1px solid #1e293b', borderRadius: 14, padding: 12 }}>
              <div style={{ fontWeight: 900, marginBottom: 8, color: '#7dd3fc' }}>📊 {titolo}</div>
              {righe.length ? tabellaPagella(righe) : <div style={{ fontSize: 12, color: '#64748b' }}>Ancora nessuna bet chiusa.</div>}
            </div>))}
        </div>
        <p style={{ fontSize: 11, color: '#64748b', marginTop: 16 }}>Le unità sono quelle dichiarate dal canale (1 unità = la puntata indicata). Con poche decine di bet i numeri oscillano molto: per giudicare un mercato servono almeno 100 bet chiuse.</p>
        </>)}
        <footer style={{ marginTop: 22, textAlign: 'center', fontSize: 12, color: '#64748b' }}>© Sergio Apicella — Tutti i diritti riservati · uso interno riservato</footer>
      </div>
    </div>
  )
}
