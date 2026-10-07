'use client'
// ════════════════════════════════════════════════════════════════════
// 🎾 PRONOX TENNIS · scheda della pagina Segnali (07/10/2026)
// Legge pronox_tennis_segnali, dove /oggi registra ogni segnale tennis (VALUE e pronostici).
// Vincitore e punteggio si scrivono a mano; l'esito si calcola da solo.
// ════════════════════════════════════════════════════════════════════
import { useCallback, useEffect, useMemo, useState } from 'react'
import { supabase } from '../supabaseClient'
import { quotaTennis, type EventoBF, type CellaTennis } from './betfair'   // 07/10/2026: quote Betfair

type Tennis = {
  id: number; data_partita: string; inizio: string | null; ora: string | null; torneo: string | null; circuito: string | null
  giocatore_a: string; giocatore_b: string; selezione: string; tipo: 'VALUE' | 'PRONOSTICO'
  prob: number | null; quota: number | null; quota_a: number | null; quota_b: number | null; ev: number | null
  vincitore: string | null; punteggio: string | null; esito: string | null
}
type Voce = { voce: string; bet: number; vinte: number; unita: number; puntato: number; quota: number }

const n2 = (x: number) => x.toLocaleString('it-IT', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
const pc = (x: number | null | undefined, d = 0) => x == null ? '' : `${(100 * Number(x)).toFixed(d).replace('.', ',')}%`
const quando = (t: Tennis) => t.inizio ? new Date(t.inizio).toLocaleString('it-IT', { timeZone: 'Europe/Rome', day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })
  : `${t.data_partita.split('-').reverse().slice(0, 2).join('/')} ${t.ora || ''}`
const profitto = (t: { esito: string | null; quota: number | null }) =>
  t.quota == null || !t.esito ? null : t.esito === 'VINTA' ? Number(t.quota) - 1 : t.esito === 'PERSA' ? -1 : 0
const fasciaQuota = (q: number | null) => q == null ? 'senza quota' : q < 1.4 ? '1,00-1,40' : q < 1.6 ? '1,40-1,60' : q < 1.8 ? '1,60-1,80' : q < 2.1 ? '1,80-2,10' : q < 3 ? '2,10-3,00' : '3,00+'
const fasciaProb = (p: number | null) => p == null ? '—' : p >= 0.8 ? '80%+' : p >= 0.7 ? '70-80%' : p >= 0.6 ? '60-70%' : 'sotto 60%'

const fq = (x: number | null | undefined) => (x == null ? '–' : x.toFixed(2).replace('.', ','))
function CellaBetfairTennis({ c, td }: { c: CellaTennis | undefined; td: any }) {
  if (!c) return <td style={td}></td>
  if (c.stato === 'nd') return <td style={{ ...td, color: '#64748b' }} title={c.motivo}>—</td>
  if (c.iniziata) return <td style={{ ...td, color: '#64748b', fontSize: 11 }} title={`Partita iniziata: ${c.evento}`}>in corso</td>
  return (
    <td style={{ ...td, whiteSpace: 'nowrap' }} title={`${c.evento}${c.vecchia ? ' · prezzi non aggiornati: il servizio Betfair non risponde' : ''}`}>
      <b style={{ color: c.vecchia ? '#fbbf24' : '#f8fafc' }}>{fq(c.back)} / {fq(c.lay)}</b>{c.vecchia ? ' ⚠️' : ''}
      {c.deltaBook != null && <div style={{ fontSize: 10.5, color: '#94a3b8' }}>book {c.deltaBook >= 0 ? '+' : ''}{(100 * c.deltaBook).toFixed(1).replace('.', ',')}%</div>}
    </td>)
}

function RigaTennis({ t, td, bf, onSalvato }: { t: Tennis; td: any; bf: CellaTennis | undefined; onSalvato: (r: Tennis) => void }) {
  const [vinc, setVinc] = useState(t.vincitore || '')
  const [punt, setPunt] = useState(t.punteggio || '')
  const [stato, setStato] = useState('')
  const esito = vinc ? (vinc === 'NULLA' ? 'NULLA' : vinc === t.selezione ? 'VINTA' : 'PERSA') : null
  const cambiato = vinc !== (t.vincitore || '') || punt !== (t.punteggio || '')
  async function salva() {
    setStato('salvo…')
    const patch = { vincitore: vinc || null, punteggio: punt.trim() || null, esito, esito_manuale: true, aggiornato: new Date().toISOString() }
    const { error } = await supabase.from('pronox_tennis_segnali').update(patch).eq('id', t.id)
    if (error) { setStato('errore: ' + error.message); return }
    setStato('✓'); onSalvato({ ...t, ...patch } as Tennis)
  }
  const inp = { background: '#020617', color: '#f8fafc', border: '1px solid #334155', borderRadius: 6, padding: '3px 6px', fontSize: 12 }
  const u = profitto({ esito, quota: t.quota })
  return (
    <tr>
      <td style={{ ...td, whiteSpace: 'nowrap' }}>{quando(t)}</td>
      <td style={{ ...td, fontWeight: 800 }}>{t.giocatore_a} – {t.giocatore_b}</td>
      <td style={{ ...td, color: '#94a3b8' }}>{t.torneo}{t.circuito ? ` · ${t.circuito}` : ''}</td>
      <td style={{ ...td, fontWeight: 700, whiteSpace: 'nowrap' }}>{t.tipo === 'VALUE' ? '💎 ' : '→ '}{t.selezione} vince</td>
      <td style={{ ...td, fontWeight: 800 }}>{pc(t.prob, 1)}</td>
      <td style={{ ...td, fontWeight: 800, color: t.quota != null && Number(t.quota) < 1.4 ? '#fbbf24' : '#f8fafc' }} title={t.quota != null && Number(t.quota) < 1.4 ? 'Sotto la regola di 1,40' : ''}>{t.quota != null ? String(t.quota).replace('.', ',') : ''}</td>
      <CellaBetfairTennis c={bf} td={td} />
      <td style={{ ...td, color: t.ev != null && t.ev > 0.03 ? '#86efac' : '#94a3b8' }}>{t.ev != null ? `${t.ev >= 0 ? '+' : ''}${pc(t.ev, 1)}` : ''}</td>
      <td style={td}>
        <select style={inp} value={vinc} onChange={e => setVinc(e.target.value)}>
          <option value="">— da giocare —</option><option value={t.giocatore_a}>{t.giocatore_a}</option><option value={t.giocatore_b}>{t.giocatore_b}</option><option value="NULLA">ritirato / non giocata</option>
        </select>
        <input style={{ ...inp, width: 110, marginLeft: 4 }} placeholder="6-4 3-6 7-5" value={punt} onChange={e => setPunt(e.target.value)} />
      </td>
      <td style={{ ...td, fontWeight: 900, color: esito === 'VINTA' ? '#86efac' : esito === 'PERSA' ? '#fca5a5' : '#94a3b8', whiteSpace: 'nowrap' }}>
        {esito ? (esito === 'VINTA' ? '🟢 vinta' : esito === 'PERSA' ? '🔴 persa' : '⚪ nulla') : '⏳ da giocare'}
        {u != null && <div style={{ fontSize: 11, color: u >= 0 ? '#86efac' : '#fca5a5' }}>{u >= 0 ? '+' : ''}{n2(u)} u</div>}
      </td>
      <td style={td}>
        <button onClick={salva} disabled={!cambiato} style={{ background: cambiato ? '#059669' : '#1e293b', color: 'white', border: 0, borderRadius: 6, padding: '4px 10px', fontWeight: 800, fontSize: 12, cursor: cambiato ? 'pointer' : 'default' }}>Salva</button>
        {stato && <div style={{ fontSize: 10.5, color: stato.startsWith('✓') ? '#86efac' : stato === 'salvo…' ? '#94a3b8' : '#fca5a5' }}>{stato}</div>}
      </td>
    </tr>)
}

export default function SchedaTennis({ sel, th, td, eventiBF = [] }: { sel: any; th: any; td: any; eventiBF?: EventoBF[] }) {
  const [righe, setRighe] = useState<Tennis[]>([])
  const [errore, setErrore] = useState('')
  const [tipo, setTipo] = useState('')
  const [stato, setStato] = useState('')
  const [sopra140, setSopra140] = useState(false)
  const [cerca, setCerca] = useState('')

  const carica = useCallback(async () => {
    const out: Tennis[] = []
    for (let from = 0; ; from += 1000) {
      const { data, error } = await supabase.from('pronox_tennis_segnali').select('*').order('data_partita', { ascending: false }).order('inizio', { ascending: false }).range(from, from + 999)
      if (error) { setErrore(error.message + ' (hai lanciato pronox_tennis_segnali.sql?)'); return }
      out.push(...((data || []) as Tennis[]))
      if (!data || data.length < 1000) break
    }
    setErrore(''); setRighe(out)
  }, [])
  useEffect(() => { carica(); const t = setInterval(carica, 60000); return () => clearInterval(t) }, [carica])

  const visibili = useMemo(() => {
    const q = cerca.trim().toLowerCase()
    return righe.filter(t => (!tipo || t.tipo === tipo) && (!stato || (stato === 'corso' ? !t.esito : t.esito === stato)) &&
      (!sopra140 || (t.quota != null && Number(t.quota) >= 1.4)) && (!q || `${t.torneo} ${t.giocatore_a} ${t.giocatore_b}`.toLowerCase().includes(q)))
  }, [righe, tipo, stato, sopra140, cerca])

  const celleBF = useMemo(() => { const mp = new Map<number, CellaTennis>(); for (const t of visibili) mp.set(t.id, quotaTennis(t, eventiBF)); return mp }, [visibili, eventiBF])
  const conBF = [...celleBF.values()].filter(c => c.stato === 'ok').length

  const chiuse = visibili.filter(t => t.esito === 'VINTA' || t.esito === 'PERSA')
  const vinte = chiuse.filter(t => t.esito === 'VINTA').length
  const conQuota = chiuse.filter(t => t.quota != null)
  const unita = conQuota.reduce((a, t) => a + (profitto(t) || 0), 0)

  const raggruppa = (chiave: (t: Tennis) => string): Voce[] => {
    const m = new Map<string, Voce & { nq: number; sq: number }>()
    for (const t of chiuse) {
      const k = chiave(t) || '—'
      const r = m.get(k) || { voce: k, bet: 0, vinte: 0, unita: 0, puntato: 0, quota: 0, nq: 0, sq: 0 }
      r.bet++; if (t.esito === 'VINTA') r.vinte++
      if (t.quota != null) { r.nq++; r.sq += Number(t.quota); r.puntato += 1; r.unita += profitto(t) || 0 }
      m.set(k, r)
    }
    return [...m.values()].map(r => ({ voce: r.voce, bet: r.bet, vinte: r.vinte, unita: r.unita, puntato: r.puntato, quota: r.nq ? (r.sq / r.nq) * r.bet : 0 })).sort((a, b) => b.bet - a.bet)
  }
  const blocchi: [string, Voce[]][] = [
    ['Value o pronostico', raggruppa(t => t.tipo === 'VALUE' ? '💎 VALUE' : '→ Pronostico')],
    ['Per probabilità del modello', raggruppa(t => fasciaProb(t.prob)).sort((a, b) => a.voce.localeCompare(b.voce))],
    ['Per fascia di quota', raggruppa(t => fasciaQuota(t.quota)).sort((a, b) => a.voce.localeCompare(b.voce))],
    ['Per torneo', raggruppa(t => t.torneo || '—')],
  ]
  const tabella = (v: Voce[]) => (
    <table style={{ borderCollapse: 'collapse', width: '100%' }}>
      <thead><tr>{['Voce', 'Bet', '% vinte', 'Quota media', 'Unità', 'Rendimento'].map(h => <th key={h} style={th}>{h}</th>)}</tr></thead>
      <tbody>{v.map(r => (
        <tr key={r.voce}>
          <td style={{ ...td, fontWeight: 700 }}>{r.voce}</td><td style={td}>{r.bet}</td>
          <td style={td}>{(100 * r.vinte / r.bet).toFixed(1).replace('.', ',')}%</td>
          <td style={td}>{r.bet && r.quota ? (r.quota / r.bet).toFixed(2).replace('.', ',') : ''}</td>
          <td style={{ ...td, color: r.unita >= 0 ? '#86efac' : '#fca5a5', fontWeight: 800 }}>{r.puntato ? `${r.unita >= 0 ? '+' : ''}${n2(r.unita)}` : ''}</td>
          <td style={{ ...td, color: r.unita >= 0 ? '#86efac' : '#fca5a5' }}>{r.puntato ? `${r.unita >= 0 ? '+' : ''}${(100 * r.unita / r.puntato).toFixed(1).replace('.', ',')}%` : ''}</td>
        </tr>))}</tbody>
    </table>)

  return (<>
    {errore && <div style={{ color: '#fca5a5', marginBottom: 12, fontSize: 13 }}>Tennis non disponibile: {errore}</div>}
    <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center', marginBottom: 14 }}>
      <select style={sel} value={tipo} onChange={e => setTipo(e.target.value)}><option value="">Value e pronostici</option><option value="VALUE">Solo 💎 VALUE</option><option value="PRONOSTICO">Solo pronostici</option></select>
      <select style={sel} value={stato} onChange={e => setStato(e.target.value)}>
        <option value="">Tutti gli esiti</option><option value="corso">Da giocare / senza risultato</option><option value="VINTA">Vinte</option><option value="PERSA">Perse</option><option value="NULLA">Nulle</option>
      </select>
      <label style={{ fontSize: 12, color: '#cbd5e1', display: 'flex', gap: 5, alignItems: 'center' }}><input type="checkbox" checked={sopra140} onChange={e => setSopra140(e.target.checked)} /> solo quota ≥ 1,40</label>
      <input style={{ ...sel, width: 220 }} placeholder="🔎 Giocatore, torneo…" value={cerca} onChange={e => setCerca(e.target.value)} />
      <button style={{ ...sel, cursor: 'pointer', fontWeight: 800 }} onClick={carica}>↻ Aggiorna</button>
    </div>
    <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', marginBottom: 16 }}>
      {[['Segnali', String(visibili.length)], ['Chiusi', String(chiuse.length)], ['Vinte', chiuse.length ? `${vinte} (${pc(vinte / chiuse.length, 1)})` : '—'],
        ['Unità', conQuota.length ? `${unita >= 0 ? '+' : ''}${n2(unita)}` : '—'], ['Rendimento', conQuota.length ? `${unita >= 0 ? '+' : ''}${(100 * unita / conQuota.length).toFixed(1).replace('.', ',')}%` : '—'],
        ['Da giocare', String(visibili.filter(t => !t.esito).length)]].map(([t, v]) => (
        <div key={t} style={{ background: 'rgba(15,23,42,.8)', border: '1px solid #1e293b', borderRadius: 12, padding: '10px 14px', minWidth: 120 }}>
          <div style={{ fontSize: 11, color: '#94a3b8' }}>{t}</div>
          <div style={{ fontSize: 20, fontWeight: 900, color: t === 'Unità' || t === 'Rendimento' ? (conQuota.length ? (unita >= 0 ? '#86efac' : '#fca5a5') : '#f8fafc') : '#f8fafc' }}>{v}</div>
        </div>))}
    </div>
    <div style={{ background: 'rgba(15,23,42,.6)', border: '1px solid #1e293b', borderRadius: 14, padding: 12, marginBottom: 18, overflowX: 'auto' }}>
      <div style={{ fontWeight: 900, marginBottom: 4 }}>PronoX tennis · {visibili.length}</div>
      <div style={{ fontSize: 11.5, color: '#94a3b8', marginBottom: 8 }}>I segnali si registrano quando analizzi il tennis in /oggi: solo 💎 VALUE e pronostici "X vince", una volta sola e senza più modifiche (esclusi quelli già iniziati). Quando la partita finisce, il vincitore arriva da solo da Betfair (puoi sempre correggerlo a mano). Colonna Betfair = prezzo ora (back / lay): {conBF} segnali su {visibili.length} abbinati · "—" = partita non trovata su Betfair · "book" = quota PronoX rispetto al back.</div>
      {!errore && !righe.length && <div style={{ fontSize: 12, color: '#fbbf24', marginBottom: 8 }}>Ancora nessun segnale: apri /oggi, spunta 🎾 Tennis e premi Analizza.</div>}
      <div style={{ maxHeight: 520, overflowY: 'auto' }}>
        <table style={{ borderCollapse: 'collapse', width: '100%' }}>
          <thead><tr>{['Partita il', 'Partita', 'Torneo', 'Segnale', 'Modello', 'Quota', 'Betfair', 'EV', 'Vincitore e punteggio', 'Esito', ''].map((h, i) => <th key={i} style={{ ...th, position: 'sticky', top: 0, background: '#0f172a' }}>{h}</th>)}</tr></thead>
          <tbody>{visibili.map(t => <RigaTennis key={t.id} t={t} td={td} bf={celleBF.get(t.id)} onSalvato={r => setRighe(v => v.map(x => x.id === r.id ? r : x))} />)}</tbody>
        </table>
      </div>
    </div>
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(420px, 1fr))', gap: 14 }}>
      {blocchi.map(([titolo, v]) => (
        <div key={titolo} style={{ background: 'rgba(15,23,42,.6)', border: '1px solid #1e293b', borderRadius: 14, padding: 12 }}>
          <div style={{ fontWeight: 900, marginBottom: 8, color: '#7dd3fc' }}>📊 {titolo}</div>
          {v.length ? tabella(v) : <div style={{ fontSize: 12, color: '#64748b' }}>Ancora nessun segnale chiuso.</div>}
        </div>))}
    </div>
    <p style={{ fontSize: 11, color: '#64748b', marginTop: 16 }}>1 unità per segnale. Con poche decine di partite i numeri oscillano molto: per giudicare servono almeno 100 segnali chiusi.</p>
  </>)
}
