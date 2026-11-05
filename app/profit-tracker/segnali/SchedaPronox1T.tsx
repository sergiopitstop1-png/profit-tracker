'use client'
// ════════════════════════════════════════════════════════════════════
// 🕐 PRONOX · OVER 0.5 1T e NOGOL · scheda di monitoraggio della pagina Segnali (05/11/2026)
// Legge la vista pronox_monitor_1t_nogol (sola lettura), alimentata dalle fotografie giornaliere di PronoX e dal cron degli esiti.
// Serve a una cosa sola: vedere, partita dopo partita, se PronoX azzecca l'Over 0.5 1T e il NoGol più di quanto
// serve per andare in pari alla quota vera del bookmaker. Non genera segnali da giocare.
// ════════════════════════════════════════════════════════════════════
import { useCallback, useEffect, useMemo, useState } from 'react'
import { supabase } from '../supabaseClient'

type Riga = {
  event_id: string; mercato: 'OU0.5HT' | 'NOGOL'; data_partita: string | null; competizione: string | null
  casa: string | null; ospite: string | null; prob: number | null; quota: number | null
  esito: 'VINTA' | 'PERSA' | 'NULLA' | null
  ht_casa: number | null; ht_ospite: number | null; ft_casa: number | null; ft_ospite: number | null
  minuto_primo_gol_1t?: number | null
}

const NOME: Record<string, string> = { 'OU0.5HT': 'Over 0.5 1T', NOGOL: 'NoGol finale' }
const n2 = (x: number) => x.toLocaleString('it-IT', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
const pc = (x: number | null | undefined, d = 1) => x == null || !Number.isFinite(x) ? '—' : `${(100 * Number(x)).toFixed(d).replace('.', ',')}%`
const quando = (iso: string | null) => iso ? new Date(iso).toLocaleString('it-IT', { timeZone: 'Europe/Rome', day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' }) : ''
const punteggio = (a: number | null, b: number | null) => a != null && b != null ? `${a}-${b}` : ''
const fasciaProb = (p: number | null) => p == null ? '—' : p >= 0.8 ? '80%+' : p >= 0.75 ? '75-80%' : p >= 0.7 ? '70-75%' : p >= 0.65 ? '65-70%' : p >= 0.5 ? '50-65%' : 'sotto 50%'
// minuto del primo gol del 1° tempo, sulle partite finite con Over 0.5 1T (VINTA) di cui il minuto è già stato letto
function minutiPrimoGol(v: Riga[]) {
  const m = v.filter(r => r.mercato === 'OU0.5HT' && r.esito === 'VINTA' && r.minuto_primo_gol_1t != null).map(r => Number(r.minuto_primo_gol_1t)).sort((a, b) => a - b)
  const n = m.length
  const media = n ? m.reduce((t, x) => t + x, 0) / n : null
  const mediana = n ? (n % 2 ? m[(n - 1) / 2] : (m[n / 2 - 1] + m[n / 2]) / 2) : null
  const fasce = [['entro il 15\'', 1, 15], ['16\'-30\'', 16, 30], ['31\'-45\'+', 31, 45]].map(([nome, a, b]) => ({ nome: String(nome), n: m.filter(x => x >= Number(a) && x <= Number(b)).length }))
  const senza = v.filter(r => r.mercato === 'OU0.5HT' && r.esito === 'VINTA' && r.minuto_primo_gol_1t == null).length
  return { n, media, mediana, fasce, senza }
}
const ORDINE_FASCE = ['sotto 50%', '50-65%', '65-70%', '70-75%', '75-80%', '80%+']

// riepilogo di un gruppo di partite (di solito: tutte quelle di un mercato)
function riepilogo(v: Riga[]) {
  const chiuse = v.filter(r => r.esito === 'VINTA' || r.esito === 'PERSA')
  const vinte = chiuse.filter(r => r.esito === 'VINTA').length
  const conQuota = chiuse.filter(r => r.quota != null && Number(r.quota) > 1)
  const unita = conQuota.reduce((t, r) => t + (r.esito === 'VINTA' ? Number(r.quota) - 1 : -1), 0)
  const pareggio = conQuota.length ? conQuota.reduce((t, r) => t + 1 / Number(r.quota), 0) / conQuota.length : null
  const conProb = chiuse.filter(r => r.prob != null)
  const probMedia = conProb.length ? conProb.reduce((t, r) => t + Number(r.prob), 0) / conProb.length : null
  const quotaMedia = conQuota.length ? conQuota.reduce((t, r) => t + Number(r.quota), 0) / conQuota.length : null
  const vinteConQuota = conQuota.filter(r => r.esito === 'VINTA').length
  return {
    totali: v.length, daGiocare: v.filter(r => !r.esito).length, chiuse: chiuse.length, vinte,
    perc: chiuse.length ? vinte / chiuse.length : null, probMedia, conQuota: conQuota.length, quotaMedia, pareggio,
    percConQuota: conQuota.length ? vinteConQuota / conQuota.length : null, unita,
    rendimento: conQuota.length ? unita / conQuota.length : null,
  }
}

export default function SchedaPronox1T({ sel, th, td }: { sel: any; th: any; td: any }) {
  const [righe, setRighe] = useState<Riga[]>([])
  const [errore, setErrore] = useState('')
  const [caricato, setCaricato] = useState(false)
  const [mercato, setMercato] = useState('')
  const [stato, setStato] = useState('')
  const [soloQuota, setSoloQuota] = useState(false)
  const [cerca, setCerca] = useState('')

  const carica = useCallback(async () => {
    const out: Riga[] = []
    for (let from = 0; ; from += 1000) {
      const { data, error } = await supabase.from('pronox_monitor_1t_nogol').select('*').order('data_partita', { ascending: false }).range(from, from + 999)
      if (error) { setErrore(error.message + ' — hai eseguito supabase/pronox_monitor_1t_nogol.sql nell’editor SQL di Supabase?'); setCaricato(true); return }
      out.push(...((data || []) as Riga[]))
      if (!data || data.length < 1000) break
    }
    setErrore(''); setRighe(out); setCaricato(true)
  }, [])
  useEffect(() => { carica() }, [carica])

  const visibili = useMemo(() => righe.filter(r => {
    if (mercato && r.mercato !== mercato) return false
    if (stato === 'corso' && r.esito) return false
    if ((stato === 'VINTA' || stato === 'PERSA' || stato === 'NULLA') && r.esito !== stato) return false
    if (soloQuota && !(r.quota != null && Number(r.quota) > 1)) return false
    if (cerca) { const t = `${r.casa || ''} ${r.ospite || ''} ${r.competizione || ''}`.toLowerCase(); if (!t.includes(cerca.toLowerCase())) return false }
    return true
  }), [righe, mercato, stato, soloQuota, cerca])

  const minuti = useMemo(() => minutiPrimoGol(righe), [righe])
  const perMercato = useMemo(() => (['OU0.5HT', 'NOGOL'] as const).map(m => [m, riepilogo(righe.filter(r => r.mercato === m))] as const), [righe])

  // quando dice X%, quante volte succede davvero? (per mercato)
  const calibrazione = useMemo(() => (['OU0.5HT', 'NOGOL'] as const).map(m => {
    const chiuse = righe.filter(r => r.mercato === m && (r.esito === 'VINTA' || r.esito === 'PERSA') && r.prob != null)
    const righeF = ORDINE_FASCE.map(f => {
      const s = chiuse.filter(r => fasciaProb(r.prob) === f)
      return { fascia: f, n: s.length, dichiarato: s.length ? s.reduce((t, r) => t + Number(r.prob), 0) / s.length : null, reale: s.length ? s.filter(r => r.esito === 'VINTA').length / s.length : null }
    }).filter(x => x.n > 0)
    return [m, righeF] as const
  }), [righe])

  const giudizio = (r: ReturnType<typeof riepilogo>) => {
    if (r.chiuse < 100) return `Ancora pochi dati: ${r.chiuse} partite chiuse, ne servono almeno 100 per giudicare (meglio 300).`
    if (r.pareggio == null || r.percConQuota == null) return 'Mancano le quote del bookmaker: il pareggio non si può calcolare.'
    const diff = r.percConQuota - r.pareggio
    return diff >= 0
      ? `Vince il ${pc(r.percConQuota)} contro un pareggio del ${pc(r.pareggio)}: oggi va in pari o in guadagno (${diff >= 0 ? '+' : ''}${(diff * 100).toFixed(1).replace('.', ',')} punti).`
      : `Vince il ${pc(r.percConQuota)} contro un pareggio del ${pc(r.pareggio)}: oggi perde (${(diff * 100).toFixed(1).replace('.', ',')} punti), il book prezza meglio di PronoX.`
  }

  return (<>
    {errore && <div style={{ color: '#fca5a5', marginBottom: 12, fontSize: 13 }}>Monitoraggio non disponibile: {errore}</div>}
    <div style={{ fontSize: 12, color: '#94a3b8', marginBottom: 12, lineHeight: 1.5 }}>
      Ogni giorno PronoX fotografa, per ogni partita dei campionati che copre, la sua probabilità di <b>Over 0.5 1T</b> (almeno un gol nel primo tempo) e di <b>NoGol</b> (almeno una squadra a zero a fine partita), insieme alla quota media dei bookmaker.
      Il test storico dice che PronoX non sceglie meglio della media: qui lo si controlla dal vivo. Non sono segnali da giocare.
    </div>
    <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center', marginBottom: 14 }}>
      <select style={sel} value={mercato} onChange={e => setMercato(e.target.value)}><option value="">Over 0.5 1T e NoGol</option><option value="OU0.5HT">Solo Over 0.5 1T</option><option value="NOGOL">Solo NoGol</option></select>
      <select style={sel} value={stato} onChange={e => setStato(e.target.value)}>
        <option value="">Tutti gli esiti</option><option value="corso">Da giocare / senza risultato</option><option value="VINTA">Vinte</option><option value="PERSA">Perse</option><option value="NULLA">Nulle</option>
      </select>
      <label style={{ fontSize: 12, color: '#cbd5e1', display: 'flex', gap: 5, alignItems: 'center' }}><input type="checkbox" checked={soloQuota} onChange={e => setSoloQuota(e.target.checked)} /> solo con quota</label>
      <input style={{ ...sel, width: 220 }} placeholder="🔎 Squadra, campionato…" value={cerca} onChange={e => setCerca(e.target.value)} />
      <button style={{ ...sel, cursor: 'pointer', fontWeight: 800 }} onClick={carica}>↻ Aggiorna</button>
    </div>

    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(340px, 1fr))', gap: 14, marginBottom: 16 }}>
      {perMercato.map(([m, r]) => (
        <div key={m} style={{ background: 'rgba(15,23,42,.8)', border: '1px solid #1e293b', borderRadius: 14, padding: 12 }}>
          <div style={{ fontWeight: 900, marginBottom: 8, color: '#7dd3fc' }}>{m === 'OU0.5HT' ? '🕐' : '🚫'} {NOME[m]}</div>
          {[
            ['Partite fotografate', String(r.totali)], ['Chiuse (vinte o perse)', String(r.chiuse)], ['Da giocare', String(r.daGiocare)],
            ['Vinte', r.chiuse ? `${r.vinte} (${pc(r.perc)})` : '—'], ['PronoX diceva in media', pc(r.probMedia)],
            ['Quota media del book', r.quotaMedia != null ? n2(r.quotaMedia) : '—'], ['Pareggio (1 ÷ quota)', pc(r.pareggio)],
            ['Unità (1 per partita con quota)', r.conQuota ? `${r.unita >= 0 ? '+' : ''}${n2(r.unita)}` : '—'],
            ['Rendimento', r.rendimento != null ? `${r.rendimento >= 0 ? '+' : ''}${(100 * r.rendimento).toFixed(1).replace('.', ',')}%` : '—'],
          ].map(([k, v]) => (
            <div key={k} style={{ display: 'flex', justifyContent: 'space-between', padding: '3px 0', borderBottom: '1px solid #1e293b', fontSize: 13 }}><span style={{ color: '#94a3b8' }}>{k}</span><b>{v}</b></div>
          ))}
          <div style={{ marginTop: 8, fontSize: 12, color: '#cbd5e1', lineHeight: 1.5 }}>{giudizio(r)}</div>
        </div>))}
    </div>

    <div style={{ background: 'rgba(15,23,42,.8)', border: '1px solid #1e293b', borderRadius: 14, padding: 12, marginBottom: 16 }}>
      <div style={{ fontWeight: 900, marginBottom: 8, color: '#7dd3fc' }}>⏱ Over 0.5 1T · quando arriva il primo gol</div>
      {minuti.n ? (<>
        <div style={{ display: 'flex', gap: 24, flexWrap: 'wrap', fontSize: 13, marginBottom: 8 }}>
          <span style={{ color: '#94a3b8' }}>Minuto medio <b style={{ color: '#f8fafc' }}>{minuti.media!.toFixed(1).replace('.', ',')}'</b></span>
          <span style={{ color: '#94a3b8' }}>Mediana <b style={{ color: '#f8fafc' }}>{minuti.mediana}'</b></span>
          <span style={{ color: '#94a3b8' }}>Partite con minuto letto <b style={{ color: '#f8fafc' }}>{minuti.n}</b></span>
        </div>
        <table style={{ borderCollapse: 'collapse' }}>
          <thead><tr>{['Primo gol', 'Partite', 'Quota sul totale'].map((h, i) => <th key={i} style={th}>{h}</th>)}</tr></thead>
          <tbody>{minuti.fasce.map(f => <tr key={f.nome}><td style={td}>{f.nome}</td><td style={td}>{f.n}</td><td style={td}>{pc(f.n / minuti.n)}</td></tr>)}</tbody>
        </table>
      </>) : <div style={{ fontSize: 12, color: '#64748b' }}>Ancora nessun minuto: si compila da solo dopo le partite (cron ogni 6 ore).</div>}
      {minuti.senza > 0 && <div style={{ fontSize: 11, color: '#64748b', marginTop: 6 }}>{minuti.senza} partite con Over 0.5 1T vinto non hanno ancora il minuto (si aggiornano da sole o la partita non è stata trovata su API-Football).</div>}
    </div>

    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(340px, 1fr))', gap: 14, marginBottom: 16 }}>
      {calibrazione.map(([m, v]) => (
        <div key={m} style={{ background: 'rgba(15,23,42,.6)', border: '1px solid #1e293b', borderRadius: 14, padding: 12 }}>
          <div style={{ fontWeight: 900, marginBottom: 6, color: '#7dd3fc' }}>📊 {NOME[m]} · quando PronoX dice X%, quante volte succede?</div>
          {v.length ? (
            <table style={{ borderCollapse: 'collapse', width: '100%' }}>
              <thead><tr>{['Fascia', 'Partite', 'Diceva', 'Reale'].map((h, i) => <th key={i} style={th}>{h}</th>)}</tr></thead>
              <tbody>{v.map(x => <tr key={x.fascia}><td style={td}>{x.fascia}</td><td style={td}>{x.n}</td><td style={td}>{pc(x.dichiarato)}</td><td style={td}>{pc(x.reale)}</td></tr>)}</tbody>
            </table>
          ) : <div style={{ fontSize: 12, color: '#64748b' }}>Ancora nessuna partita chiusa.</div>}
        </div>))}
    </div>

    <div style={{ background: 'rgba(15,23,42,.6)', border: '1px solid #1e293b', borderRadius: 14, padding: 12, overflowX: 'auto' }}>
      <div style={{ fontWeight: 900, marginBottom: 4 }}>Partite · {visibili.length}</div>
      {caricato && !errore && !righe.length && <div style={{ fontSize: 12, color: '#fbbf24', marginBottom: 8 }}>Ancora nessuna partita: le prime fotografie arrivano con la corsa delle 09:00 UTC (10:00 o 11:00 in Italia) del giorno dopo l’attivazione.</div>}
      <div style={{ maxHeight: 520, overflowY: 'auto' }}>
        <table style={{ borderCollapse: 'collapse', width: '100%' }}>
          <thead><tr>{['Partita il', 'Campionato', 'Partita', 'Mercato', 'PronoX', 'Quota', '1T', '1° gol', 'Finale', 'Esito'].map((h, i) => <th key={i} style={{ ...th, position: 'sticky', top: 0, background: '#0f172a' }}>{h}</th>)}</tr></thead>
          <tbody>{visibili.map(r => (
            <tr key={`${r.event_id}|${r.mercato}`}>
              <td style={td}>{quando(r.data_partita)}</td><td style={td}>{r.competizione || ''}</td><td style={td}>{r.casa} – {r.ospite}</td>
              <td style={td}>{NOME[r.mercato] || r.mercato}</td><td style={td}>{pc(r.prob, 0)}</td><td style={td}>{r.quota != null ? n2(Number(r.quota)) : ''}</td>
              <td style={td}>{punteggio(r.ht_casa, r.ht_ospite)}</td><td style={td}>{r.minuto_primo_gol_1t != null ? `${r.minuto_primo_gol_1t}'` : ''}</td><td style={td}>{punteggio(r.ft_casa, r.ft_ospite)}</td>
              <td style={{ ...td, fontWeight: 800, color: r.esito === 'VINTA' ? '#86efac' : r.esito === 'PERSA' ? '#fca5a5' : '#94a3b8' }}>{r.esito || ''}</td>
            </tr>))}</tbody>
        </table>
      </div>
    </div>
    <p style={{ fontSize: 11, color: '#64748b', marginTop: 16 }}>
      Il pareggio è la media di 1 ÷ quota delle partite chiuse con quota: la % di vittorie che serve per non perdere a quel prezzo. Per l’Over 0.5 1T con assicurazione del 10% sullo 0-0 servono circa 2-3 punti in più.
      Con poche decine di partite i numeri oscillano molto: per giudicare servono almeno 100 partite chiuse.
    </p>
  </>)
}
