'use client'
// ════════════════════════════════════════════════════════════════════
// 📈 ANALISI SEGNALI · ScoreTrend e Hunterbet (04/10/2026)
// Colpo d'occhio (torte), segmenti con margine d'errore, tempo al gol,
// simulazione della cassa e verifica su dati nuovi (prima metà / seconda metà).
// Legge scoretrend_segnali e hunterbet_segnali (solo lettura).
// ════════════════════════════════════════════════════════════════════
import { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { supabase } from '../../supabaseClient'

type Riga = { id: number; data: string; competizione: string; esito: string | null; quota: number | null; profitto: number | null; unita: number
  live: string; minuto: number | null; mercato: string; casaOspiti: string | null; risultato: string | null; minutiAlGol: number | null }

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
  const [canale, setCanale] = useState<'scoretrend' | 'hunterbet'>('scoretrend')
  const [righe, setRighe] = useState<Riga[]>([])
  const [errore, setErrore] = useState('')
  const [quotaIpotesi, setQuotaIpotesi] = useState('1.70')
  const [soloSopra140, setSoloSopra140] = useState(false)

  useEffect(() => {
    (async () => {
      setErrore(''); setRighe([])
      const tab = canale === 'scoretrend' ? 'scoretrend_segnali' : 'hunterbet_segnali'
      const out: any[] = []
      for (let from = 0; ; from += 1000) {
        const { data, error } = await supabase.from(tab).select('*').order('data_msg', { ascending: true }).range(from, from + 999)
        if (error) { setErrore(error.message); return }
        out.push(...(data || [])); if (!data || data.length < 1000) break
      }
      setRighe(out.map((x: any): Riga => canale === 'scoretrend' ? {
        id: x.msg_id, data: x.data_msg, competizione: x.competizione || 'n.d.', esito: x.esito, quota: x.quota != null ? Number(x.quota) : null,
        profitto: x.profitto != null ? Number(x.profitto) : null, unita: Number(x.unita || 1), live: x.live || 'n.d.', minuto: x.minuto,
        mercato: `${x.mercato || ''}${x.linea != null ? ' ' + String(x.linea).replace('.', ',') : ''}${x.tempo && x.tempo !== 'finale' ? ' ' + x.tempo : ''}`.trim(),
        casaOspiti: null, risultato: null, minutiAlGol: null,
      } : {
        id: x.msg_id, data: x.data_msg, competizione: x.competizione || 'n.d.', esito: x.esito, quota: null, profitto: null, unita: 1, live: 'live',
        minuto: x.minuto_segnale, mercato: x.tipo_segnale === 'GOL_CASA' ? 'Gol casa' : 'Gol ospiti', casaOspiti: x.tipo_segnale === 'GOL_CASA' ? 'Casa' : 'Ospiti',
        risultato: x.score_casa_segnale != null ? `${x.score_casa_segnale}-${x.score_ospite_segnale}` : null, minutiAlGol: x.minuti_al_gol,
      }))
    })()
  }, [canale])

  const tutte = useMemo(() => righe.filter(r => !soloSopra140 || r.quota == null || r.quota >= 1.4), [righe, soloSopra140])
  const chiuse = useMemo(() => tutte.filter(r => r.esito === 'VINTA' || r.esito === 'PERSA'), [tutte])
  const conQuota = canale === 'scoretrend'
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

  const blocchi: [string, Seg[]][] = [
    ['Per competizione', segmenta(chiuse, r => r.competizione)],
    ['Per minuto del segnale', segmenta(chiuse, r => fasciaMinuto(r.minuto))],
    ...(conQuota ? [['Per fascia di quota', segmenta(chiuse, r => fasciaQuota(r.quota))] as [string, Seg[]], ['Live o prepartita', segmenta(chiuse, r => r.live)] as [string, Seg[]]]
      : [['Casa o ospiti', segmenta(chiuse, r => r.casaOspiti || 'n.d.')] as [string, Seg[]], ['Risultato al segnale', segmenta(chiuse, r => r.risultato || 'n.d.')] as [string, Seg[]]]),
    ['Per giorno', segmenta(chiuse, r => giorno(r.data))],
    ['Per fascia oraria', segmenta(chiuse, r => fasciaOra(r.data))],
  ]

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
          {(['scoretrend', 'hunterbet'] as const).map(c => (
            <button key={c} onClick={() => setCanale(c)} style={{ background: canale === c ? '#0c4a6e' : '#0f172a', color: '#f8fafc', border: `1px solid ${canale === c ? '#38bdf8' : '#334155'}`, borderRadius: 10, padding: '7px 14px', fontWeight: 900, cursor: 'pointer' }}>{c === 'scoretrend' ? 'ScoreTrend' : 'Hunterbet'}</button>))}
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
          <Torta titolo={conQuota ? 'Mercati (bet chiuse)' : 'Tipo di segnale (bet chiuse)'} fette={tortaMercati} />
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
