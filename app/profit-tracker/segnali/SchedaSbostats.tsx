'use client'
// ════════════════════════════════════════════════════════════════════
// 📊 SBOSTATS · Match Analysis · scheda della pagina Segnali (09/11/2026)
// Legge la tabella sbostats_segnali (sola lettura), alimentata dal lettore sul PC (pc/sbostats).
// Serve a verificare quanto la «frequenza» di SBOStats si avvicina alla percentuale di vincite reale,
// e a quale quota vera del bookmaker un pronostico conviene (quota di pareggio = 1 / % vinte reale).
// La «quota teorica» di SBOStats è solo 100 / frequenza: non è una quota di mercato.
// ════════════════════════════════════════════════════════════════════
import { useCallback, useEffect, useMemo, useState } from 'react'
import { supabase } from '../supabaseClient'

type Riga = {
  chiave: string; data_partita: string | null; data_testo: string | null; partita: string | null; campionato: string | null
  pronostico: string | null; frequenza: number | null; quota_teorica: number | null; risultato: string | null
  esito: 'VINTA' | 'PERSA' | 'NULLA' | null
}

const n2 = (x: number) => x.toLocaleString('it-IT', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
const n3 = (x: number) => x.toLocaleString('it-IT', { minimumFractionDigits: 3, maximumFractionDigits: 3 })
const pc1 = (x: number | null) => x == null || !Number.isFinite(x) ? '—' : `${x.toFixed(1).replace('.', ',')}%`
const quando = (r: Riga) => r.data_partita
  ? new Date(r.data_partita).toLocaleString('it-IT', { timeZone: 'Europe/Rome', day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })
  : (r.data_testo || '')
const fascia = (f: number | null) => f == null ? '—' : f < 70 ? 'sotto 70%' : f < 72 ? '70-72%' : f < 74 ? '72-74%' : f < 76 ? '74-76%' : f < 78 ? '76-78%'
  : f < 80 ? '78-80%' : f < 82 ? '80-82%' : f < 85 ? '82-85%' : f < 90 ? '85-90%' : '90%+'
const ORDINE_FASCE = ['sotto 70%', '70-72%', '72-74%', '74-76%', '76-78%', '78-80%', '80-82%', '82-85%', '85-90%', '90%+']

function riepilogo(v: Riga[]) {
  const chiuse = v.filter(r => r.esito === 'VINTA' || r.esito === 'PERSA')
  const n = chiuse.length
  const vinte = chiuse.filter(r => r.esito === 'VINTA').length
  const win = n ? vinte / n : null
  const dich = n ? chiuse.reduce((a, r) => a + Number(r.frequenza || 0), 0) / n : null
  const roi = n ? chiuse.reduce((a, r) => a + (r.esito === 'VINTA' ? Number(r.quota_teorica || 0) - 1 : -1), 0) / n : null
  return { n, vinte, win: win == null ? null : 100 * win, dich, gap: win != null && dich != null ? 100 * win - dich : null, roi: roi == null ? null : 100 * roi, pareggio: win ? 1 / win : null }
}

function raggruppa(v: Riga[], chiave: (r: Riga) => string) {
  const m = new Map<string, Riga[]>()
  for (const r of v) { const k = chiave(r); (m.get(k) || m.set(k, []).get(k)!).push(r) }
  return [...m.entries()].map(([voce, righe]) => ({ voce, ...riepilogo(righe) })).filter(x => x.n > 0)
}

export default function SchedaSbostats({ sel, th, td }: { sel: any; th: any; td: any }) {
  const [dati, setDati] = useState<Riga[]>([])
  const [errore, setErrore] = useState('')
  const [caricato, setCaricato] = useState(false)
  const [periodo, setPeriodo] = useState('tutto')
  const [pronostico, setPronostico] = useState('')
  const [cerca, setCerca] = useState('')

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
  const visibili = useMemo(() => {
    const q = cerca.trim().toLowerCase()
    const da = periodo === 'tutto' ? 0 : Date.now() - Number(periodo) * 86400000
    return dati.filter(r =>
      (!da || (r.data_partita && new Date(r.data_partita).getTime() >= da)) &&
      (!pronostico || r.pronostico === pronostico) &&
      (!q || `${r.partita} ${r.campionato} ${r.pronostico}`.toLowerCase().includes(q)))
  }, [dati, periodo, pronostico, cerca])

  const tot = useMemo(() => riepilogo(visibili), [visibili])
  const perPronostico = useMemo(() => raggruppa(visibili, r => r.pronostico || '—').sort((a, b) => b.n - a.n), [visibili])
  const perFascia = useMemo(() => raggruppa(visibili, r => fascia(r.frequenza)).sort((a, b) => ORDINE_FASCE.indexOf(a.voce) - ORDINE_FASCE.indexOf(b.voce)), [visibili])
  const inAttesa = useMemo(() => visibili.filter(r => !r.esito && r.data_partita).sort((a, b) => String(a.data_partita).localeCompare(String(b.data_partita))).slice(0, 60), [visibili])
  const chiusi = useMemo(() => visibili.filter(r => r.esito).slice(0, 60), [visibili])
  const nAttesa = useMemo(() => visibili.filter(r => !r.esito).length, [visibili])

  const col = (x: number | null) => x == null ? '#e2e8f0' : x >= 0 ? '#86efac' : '#fca5a5'
  const tessera = (titolo: string, valore: string, colore = '#f8fafc', nota = '') => (
    <div style={{ background: '#0f172a', border: '1px solid #334155', borderRadius: 10, padding: '8px 12px', minWidth: 120 }}>
      <div style={{ fontSize: 11, color: '#94a3b8' }}>{titolo}</div>
      <div style={{ fontSize: 18, fontWeight: 800, color: colore }}>{valore}</div>
      {nota && <div style={{ fontSize: 10.5, color: '#64748b' }}>{nota}</div>}
    </div>)

  const tabella = (righe: ReturnType<typeof raggruppa>, titolo: string) => (
    <div style={{ marginBottom: 18 }}>
      <div style={{ fontWeight: 800, fontSize: 13, margin: '0 0 6px', color: '#cbd5e1' }}>{titolo}</div>
      <div style={{ overflowX: 'auto' }}>
        <table style={{ borderCollapse: 'collapse', width: '100%' }}>
          <thead><tr>{['Voce', 'Chiusi', '% vinti', 'Dichiarata', 'Scarto', 'Quota di pareggio', 'ROI a quota teorica'].map(h => <th key={h} style={th}>{h}</th>)}</tr></thead>
          <tbody>{righe.map(r => (
            <tr key={r.voce} style={{ opacity: r.n < 100 ? 0.6 : 1 }}>
              <td style={{ ...td, fontWeight: 700 }}>{r.voce}</td><td style={td}>{r.n}</td>
              <td style={td}>{pc1(r.win)}</td><td style={td}>{pc1(r.dich)}</td>
              <td style={{ ...td, color: col(r.gap), fontWeight: 700 }}>{r.gap == null ? '—' : `${r.gap >= 0 ? '+' : ''}${n2(r.gap)}`}</td>
              <td style={td}>{r.pareggio ? n3(r.pareggio) : '—'}</td>
              <td style={{ ...td, color: col(r.roi), fontWeight: 700 }}>{r.roi == null ? '—' : `${r.roi >= 0 ? '+' : ''}${n2(r.roi)}%`}</td>
            </tr>))}</tbody>
        </table>
      </div>
    </div>)

  return (
    <div>
      <div style={{ fontSize: 12.5, color: '#94a3b8', marginBottom: 12, lineHeight: 1.5 }}>
        Pronostici di SBOStats · Match Analysis, letti dal PC. La «quota teorica» è solo 100 ÷ frequenza, non una quota di mercato: un pronostico conviene
        solo se la quota vera del bookmaker supera la <b>quota di pareggio</b> (1 ÷ % vinti reale). Le righe sbiadite hanno meno di 100 pronostici chiusi: pochi per fidarsi.
      </div>
      {errore && <div style={{ color: '#fca5a5', fontSize: 13, marginBottom: 12 }}>{errore}</div>}
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center', marginBottom: 14 }}>
        <select value={periodo} onChange={e => setPeriodo(e.target.value)} style={sel}>
          <option value="30">ultimi 30 giorni</option><option value="90">ultimi 90 giorni</option>
          <option value="365">ultimo anno</option><option value="tutto">tutto</option>
        </select>
        <select value={pronostico} onChange={e => setPronostico(e.target.value)} style={sel}>
          <option value="">tutti i pronostici</option>{pronostici.map(p => <option key={p} value={p}>{p}</option>)}
        </select>
        <input value={cerca} onChange={e => setCerca(e.target.value)} placeholder="cerca squadra o campionato" style={{ ...sel, minWidth: 200 }} />
        <span style={{ fontSize: 12, color: '#64748b' }}>{caricato ? `${dati.length} pronostici in archivio` : 'carico…'}</span>
      </div>

      <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', marginBottom: 18 }}>
        {tessera('Chiusi', String(tot.n), '#f8fafc', `${tot.vinte} vinti`)}
        {tessera('% vinti', pc1(tot.win))}
        {tessera('Frequenza dichiarata', pc1(tot.dich))}
        {tessera('Scarto', tot.gap == null ? '—' : `${tot.gap >= 0 ? '+' : ''}${n2(tot.gap)} pt`, col(tot.gap))}
        {tessera('ROI a quota teorica', tot.roi == null ? '—' : `${tot.roi >= 0 ? '+' : ''}${n2(tot.roi)}%`, col(tot.roi))}
        {tessera('Quota di pareggio', tot.pareggio ? n3(tot.pareggio) : '—')}
        {tessera('In attesa', String(nAttesa))}
      </div>

      {tabella(perPronostico, 'Per pronostico')}
      {tabella(perFascia, 'Per fascia di frequenza dichiarata')}

      <div style={{ fontWeight: 800, fontSize: 13, margin: '0 0 6px', color: '#cbd5e1' }}>In attesa (prossime partite)</div>
      <div style={{ overflowX: 'auto', marginBottom: 18 }}>
        <table style={{ borderCollapse: 'collapse', width: '100%' }}>
          <thead><tr>{['Data', 'Partita', 'Campionato', 'Pronostico', 'Frequenza', 'Quota teorica'].map(h => <th key={h} style={th}>{h}</th>)}</tr></thead>
          <tbody>{inAttesa.map(r => (
            <tr key={r.chiave}>
              <td style={td}>{quando(r)}</td><td style={{ ...td, fontWeight: 700 }}>{r.partita}</td><td style={td}>{r.campionato}</td>
              <td style={td}>{r.pronostico}</td><td style={td}>{pc1(r.frequenza)}</td><td style={td}>{r.quota_teorica != null ? n2(Number(r.quota_teorica)) : ''}</td>
            </tr>))}
            {!inAttesa.length && <tr><td style={td} colSpan={6}>Nessun pronostico in attesa.</td></tr>}
          </tbody>
        </table>
      </div>

      <div style={{ fontWeight: 800, fontSize: 13, margin: '0 0 6px', color: '#cbd5e1' }}>Ultimi chiusi</div>
      <div style={{ overflowX: 'auto' }}>
        <table style={{ borderCollapse: 'collapse', width: '100%' }}>
          <thead><tr>{['Data', 'Partita', 'Campionato', 'Pronostico', 'Frequenza', 'Risultato', 'Esito'].map(h => <th key={h} style={th}>{h}</th>)}</tr></thead>
          <tbody>{chiusi.map(r => (
            <tr key={r.chiave}>
              <td style={td}>{quando(r)}</td><td style={{ ...td, fontWeight: 700 }}>{r.partita}</td><td style={td}>{r.campionato}</td>
              <td style={td}>{r.pronostico}</td><td style={td}>{pc1(r.frequenza)}</td><td style={td}>{r.risultato}</td>
              <td style={{ ...td, fontWeight: 800, color: r.esito === 'VINTA' ? '#86efac' : r.esito === 'PERSA' ? '#fca5a5' : '#94a3b8' }}>{r.esito}</td>
            </tr>))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
