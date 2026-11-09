'use client'
// ════════════════════════════════════════════════════════════════════
// 📊 SBOSTATS · Match Analysis · scheda della pagina Segnali (09/11/2026)
// Legge la tabella sbostats_segnali (sola lettura), alimentata dal lettore sul PC (pc/sbostats).
// Qui solo le PARTITE (prossime in cima, poi le chiuse). Tutte le statistiche (% vinti reale, quota di pareggio,
// simulazione a quota ipotetica) stanno nella pagina Analisi > SBOStats.
// ════════════════════════════════════════════════════════════════════
import { useCallback, useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { supabase } from '../supabaseClient'

type Riga = {
  chiave: string; data_partita: string | null; data_testo: string | null; partita: string | null; campionato: string | null
  pronostico: string | null; frequenza: number | null; quota_teorica: number | null; risultato: string | null
  esito: 'VINTA' | 'PERSA' | 'NULLA' | null
}

const n2 = (x: number) => x.toLocaleString('it-IT', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
const pc1 = (x: number | null) => x == null || !Number.isFinite(Number(x)) ? '—' : `${Number(x).toFixed(1).replace('.', ',')}%`
const quando = (r: Riga) => r.data_partita
  ? new Date(r.data_partita).toLocaleString('it-IT', { timeZone: 'Europe/Rome', weekday: 'short', day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })
  : (r.data_testo || '')
const ORE = 3600000

export default function SchedaSbostats({ sel, th, td }: { sel: any; th: any; td: any }) {
  const [dati, setDati] = useState<Riga[]>([])
  const [errore, setErrore] = useState('')
  const [caricato, setCaricato] = useState(false)
  const [pronostico, setPronostico] = useState('')
  const [campionato, setCampionato] = useState('')
  const [cerca, setCerca] = useState('')
  const [minFreq, setMinFreq] = useState('')
  const [nChiusi, setNChiusi] = useState(100)

  const carica = useCallback(async () => {
    const out: Riga[] = []
    for (let from = 0; from < 40000; from += 1000) {
      const { data, error } = await supabase.from('sbostats_segnali')
        .select('chiave,data_partita,data_testo,partita,campionato,pronostico,frequenza,quota_teorica,risultato,esito')
        .order('data_partita', { ascending: false }).range(from, from + 999)
      if (error) { setErrore('SBOStats non disponibile: ' + error.message + ' (hai lanciato sbostats_segnali.sql in Supabase?)'); return }
      out.push(...((data || []) as Riga[]))
      if (!data || data.length < 1000) break
    }
    setErrore(''); setDati(out); setCaricato(true)
  }, [])
  useEffect(() => { carica(); const t = setInterval(carica, 120000); return () => clearInterval(t) }, [carica])

  const pronostici = useMemo(() => [...new Set(dati.map(r => r.pronostico || '—'))].sort(), [dati])
  const campionati = useMemo(() => [...new Set(dati.map(r => r.campionato || '—'))].sort(), [dati])
  const visibili = useMemo(() => {
    const q = cerca.trim().toLowerCase()
    const f = Number(minFreq.replace(',', '.')) || 0
    return dati.filter(r =>
      (!pronostico || r.pronostico === pronostico) && (!campionato || r.campionato === campionato) &&
      (!f || Number(r.frequenza || 0) >= f) &&
      (!q || `${r.partita} ${r.campionato} ${r.pronostico}`.toLowerCase().includes(q)))
  }, [dati, pronostico, campionato, cerca, minFreq])

  // prossime: senza esito e con partita non ancora finita (da 3 ore prima dell'inizio in poi), in ordine di orario
  const adesso = Date.now()
  const prossime = useMemo(() => visibili.filter(r => !r.esito && r.data_partita && new Date(r.data_partita).getTime() >= adesso - 3 * ORE)
    .sort((a, b) => String(a.data_partita).localeCompare(String(b.data_partita))), [visibili, adesso])
  // senza esito ma partita iniziata da più di 3 ore: aspettano l'esito (o la partita è stata rinviata)
  const senzaEsito = useMemo(() => visibili.filter(r => !r.esito && (!r.data_partita || new Date(r.data_partita).getTime() < adesso - 3 * ORE))
    .sort((a, b) => String(b.data_partita).localeCompare(String(a.data_partita))), [visibili, adesso])
  const chiusi = useMemo(() => visibili.filter(r => r.esito), [visibili])

  const intest = (cols: string[]) => <thead><tr>{cols.map(h => <th key={h} style={th}>{h}</th>)}</tr></thead>
  const titolo = (t: string, n?: number) => <div style={{ fontWeight: 800, fontSize: 14, margin: '0 0 6px', color: '#cbd5e1' }}>{t}{n != null && <span style={{ color: '#64748b', fontWeight: 600 }}> · {n}</span>}</div>

  return (
    <div>
      <div style={{ fontSize: 12.5, color: '#94a3b8', marginBottom: 12, lineHeight: 1.5 }}>
        Pronostici di SBOStats · Match Analysis, letti dal PC. Le statistiche (% vinti reale, quota di pareggio, simulazione a quota ipotetica) sono nella pagina{' '}
        <Link href="/profit-tracker/segnali/analisi?canale=sbostats" style={{ color: '#c4b5fd', fontWeight: 800, textDecoration: 'none' }}>📈 Analisi › SBOStats</Link>.
        La «quota teorica» è solo 100 ÷ frequenza, non una quota di mercato.
      </div>
      {errore && <div style={{ color: '#fca5a5', fontSize: 13, marginBottom: 12 }}>{errore}</div>}
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center', marginBottom: 14 }}>
        <select value={pronostico} onChange={e => setPronostico(e.target.value)} style={sel}>
          <option value="">tutti i pronostici</option>{pronostici.map(p => <option key={p} value={p}>{p}</option>)}
        </select>
        <select value={campionato} onChange={e => setCampionato(e.target.value)} style={sel}>
          <option value="">tutti i campionati</option>{campionati.map(p => <option key={p} value={p}>{p}</option>)}
        </select>
        <input value={minFreq} onChange={e => setMinFreq(e.target.value.replace(/[^0-9.,]/g, ''))} placeholder="freq. min %" style={{ ...sel, width: 90 }} />
        <input value={cerca} onChange={e => setCerca(e.target.value)} placeholder="cerca squadra" style={{ ...sel, minWidth: 160 }} />
        <span style={{ fontSize: 12, color: '#64748b' }}>{caricato ? `${dati.length} pronostici in archivio` : 'carico…'}</span>
      </div>

      {titolo('Prossime partite', prossime.length)}
      <div style={{ overflowX: 'auto', marginBottom: 20 }}>
        <table style={{ borderCollapse: 'collapse', width: '100%' }}>
          {intest(['Data', 'Partita', 'Campionato', 'Pronostico', 'Frequenza', 'Quota teorica'])}
          <tbody>{prossime.map(r => (
            <tr key={r.chiave}>
              <td style={{ ...td, whiteSpace: 'nowrap' }}>{quando(r)}</td><td style={{ ...td, fontWeight: 700 }}>{r.partita}</td><td style={td}>{r.campionato}</td>
              <td style={{ ...td, fontWeight: 700 }}>{r.pronostico}</td><td style={td}>{pc1(r.frequenza)}</td><td style={td}>{r.quota_teorica != null ? n2(Number(r.quota_teorica)) : ''}</td>
            </tr>))}
            {!prossime.length && <tr><td style={td} colSpan={6}>{caricato ? 'Nessuna partita in programma con questi filtri.' : 'Carico…'}</td></tr>}
          </tbody>
        </table>
      </div>

      {titolo('Chiusi (dal più recente)', chiusi.length)}
      <div style={{ overflowX: 'auto', marginBottom: 8 }}>
        <table style={{ borderCollapse: 'collapse', width: '100%' }}>
          {intest(['Data', 'Partita', 'Campionato', 'Pronostico', 'Frequenza', 'Risultato', 'Esito'])}
          <tbody>{chiusi.slice(0, nChiusi).map(r => (
            <tr key={r.chiave}>
              <td style={{ ...td, whiteSpace: 'nowrap' }}>{quando(r)}</td><td style={{ ...td, fontWeight: 700 }}>{r.partita}</td><td style={td}>{r.campionato}</td>
              <td style={{ ...td, fontWeight: 700 }}>{r.pronostico}</td><td style={td}>{pc1(r.frequenza)}</td><td style={td}>{r.risultato}</td>
              <td style={{ ...td, fontWeight: 800, color: r.esito === 'VINTA' ? '#86efac' : r.esito === 'PERSA' ? '#fca5a5' : '#94a3b8' }}>{r.esito}</td>
            </tr>))}
          </tbody>
        </table>
      </div>
      {chiusi.length > nChiusi && (
        <button onClick={() => setNChiusi(n => n + 200)} style={{ ...sel, cursor: 'pointer', fontWeight: 800, marginBottom: 20 }}>Mostra altri 200 (ne restano {chiusi.length - nChiusi})</button>
      )}

      {senzaEsito.length > 0 && (
        <details style={{ marginTop: 16 }}>
          <summary style={{ cursor: 'pointer', fontWeight: 800, fontSize: 13, color: '#94a3b8' }}>Senza esito, partita già iniziata da più di 3 ore · {senzaEsito.length}</summary>
          <div style={{ fontSize: 11.5, color: '#64748b', margin: '6px 0' }}>L'esito arriva da SBOStats a partita finita; se resta qui per giorni la partita è stata probabilmente rinviata. Non contano nelle statistiche.</div>
          <div style={{ overflowX: 'auto' }}>
            <table style={{ borderCollapse: 'collapse', width: '100%' }}>
              {intest(['Data', 'Partita', 'Campionato', 'Pronostico', 'Frequenza'])}
              <tbody>{senzaEsito.slice(0, 200).map(r => (
                <tr key={r.chiave} style={{ opacity: 0.7 }}>
                  <td style={{ ...td, whiteSpace: 'nowrap' }}>{quando(r)}</td><td style={td}>{r.partita}</td><td style={td}>{r.campionato}</td>
                  <td style={td}>{r.pronostico}</td><td style={td}>{pc1(r.frequenza)}</td>
                </tr>))}
              </tbody>
            </table>
          </div>
        </details>
      )}
    </div>
  )
}
