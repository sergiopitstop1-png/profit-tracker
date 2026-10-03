'use client'
// ════════════════════════════════════════════════════════════════════
// 📡 SEGNALI SCORETREND · pagina condivisa (03/10/2026)
// I segnali li manda il lettore sul PC (scoretrend.py) → tabella scoretrend_segnali.
// La vedono tutti gli utenti loggati, in tempo reale (aggiornamento ogni 30 secondi).
// ════════════════════════════════════════════════════════════════════
import { useCallback, useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { supabase } from '../supabaseClient'

type Segnale = {
  msg_id: number; data_msg: string | null; data_partita: string | null; ora: string | null; competizione: string | null
  casa: string | null; ospite: string | null; live: string | null; minuto: number | null; mercato: string | null; linea: number | null
  tempo: string | null; quota: number | null; selezione: string | null; unita: number | null; esito: string | null; profitto: number | null; link: string | null
}

const n2 = (x: number) => x.toLocaleString('it-IT', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
const quando = (iso: string | null) => iso ? new Date(iso).toLocaleString('it-IT', { timeZone: 'Europe/Rome', day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' }) : ''
const mercatoDi = (s: Segnale) => `${s.mercato || ''}${s.linea != null ? ' ' + String(s.linea).replace('.', ',') : ''}${s.tempo && s.tempo !== 'finale' ? ' ' + s.tempo : ''}`.trim()
const fascia = (q: number) => q < 1.4 ? '1,00-1,40' : q < 1.6 ? '1,40-1,60' : q < 1.8 ? '1,60-1,80' : q < 2.1 ? '1,80-2,10' : q < 3 ? '2,10-3,00' : '3,00+'

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
  const [dati, setDati] = useState<Segnale[]>([])
  const [errore, setErrore] = useState('')
  const [aggiornato, setAggiornato] = useState<Date | null>(null)
  const [periodo, setPeriodo] = useState('30')
  const [stato, setStato] = useState('')
  const [tipo, setTipo] = useState('')
  const [mercato, setMercato] = useState('')
  const [soloSopra140, setSoloSopra140] = useState(false)
  const [cerca, setCerca] = useState('')

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
    setErrore(''); setDati(out); setAggiornato(new Date())
  }, [periodo])
  useEffect(() => { carica(); const t = setInterval(carica, 30000); return () => clearInterval(t) }, [carica])

  const mercati = useMemo(() => [...new Set(dati.map(mercatoDi))].sort(), [dati])
  const visibili = useMemo(() => {
    const q = cerca.trim().toLowerCase()
    return dati.filter(s =>
      (!stato || (stato === 'corso' ? !s.esito : s.esito === stato)) &&
      (!tipo || s.live === tipo) && (!mercato || mercatoDi(s) === mercato) &&
      (!soloSopra140 || Number(s.quota) >= 1.4) &&
      (!q || `${s.competizione} ${s.casa} ${s.ospite} ${s.selezione}`.toLowerCase().includes(q)))
  }, [dati, stato, tipo, mercato, soloSopra140, cerca])

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
        <h1 style={{ fontSize: 28, margin: '8px 0 2px', color: '#f8fafc' }}>📡 Segnali ScoreTrend</h1>
        <div style={{ fontSize: 13, color: '#94a3b8', marginBottom: 14 }}>
          Arrivano dal canale in tempo reale · aggiornamento ogni 30 secondi{aggiornato ? ` · ultimo alle ${aggiornato.toLocaleTimeString('it-IT', { hour: '2-digit', minute: '2-digit', second: '2-digit' })}` : ''}
        </div>

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
          <div style={{ maxHeight: 460, overflowY: 'auto' }}>
            <table style={{ borderCollapse: 'collapse', width: '100%' }}>
              <thead><tr>{['Arrivato', 'Partita', 'Competizione', 'Tipo', 'Mercato', 'Giocata', 'Quota', 'Esito', 'Unità', ''].map(h => <th key={h} style={{ ...th, position: 'sticky', top: 0, background: '#0f172a' }}>{h}</th>)}</tr></thead>
              <tbody>{visibili.map(s => (
                <tr key={s.msg_id} style={{ background: recenti(s.data_msg) && !s.esito ? 'rgba(56,189,248,.08)' : undefined }}>
                  <td style={{ ...td, whiteSpace: 'nowrap' }}>{recenti(s.data_msg) && !s.esito ? '🆕 ' : ''}{quando(s.data_msg)}</td>
                  <td style={{ ...td, fontWeight: 800 }}>{s.casa} – {s.ospite}<div style={{ fontSize: 11, color: '#94a3b8', fontWeight: 400 }}>ore {s.ora}</div></td>
                  <td style={{ ...td, color: '#94a3b8' }}>{s.competizione}</td>
                  <td style={td}>{s.live === 'live' ? `🔴 live ${s.minuto ?? ''}'` : 'prepartita'}</td>
                  <td style={td}>{mercatoDi(s)}</td>
                  <td style={{ ...td, fontWeight: 700 }}>{s.selezione}</td>
                  <td style={{ ...td, fontWeight: 800, color: Number(s.quota) < 1.4 ? '#fbbf24' : '#f8fafc' }} title={Number(s.quota) < 1.4 ? 'Sotto la regola di 1,40' : ''}>{String(s.quota ?? '').replace('.', ',')}</td>
                  <td style={{ ...td, fontWeight: 900, color: s.esito === 'VINTA' ? '#86efac' : s.esito === 'PERSA' ? '#fca5a5' : '#94a3b8' }}>{s.esito ? (s.esito === 'VINTA' ? '🟢 vinta' : s.esito === 'PERSA' ? '🔴 persa' : '⚪ nulla') : '⏳ in corso'}</td>
                  <td style={{ ...td, color: Number(s.profitto) >= 0 ? '#86efac' : '#fca5a5' }}>{s.profitto != null ? `${s.profitto >= 0 ? '+' : ''}${n2(Number(s.profitto))}` : ''}</td>
                  <td style={td}>{s.link && <a href={s.link} target="_blank" rel="noopener noreferrer" style={{ color: '#7dd3fc', fontSize: 11 }}>apri</a>}</td>
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
        <footer style={{ marginTop: 22, textAlign: 'center', fontSize: 12, color: '#64748b' }}>© Sergio Apicella — Tutti i diritti riservati · uso interno riservato</footer>
      </div>
    </div>
  )
}
