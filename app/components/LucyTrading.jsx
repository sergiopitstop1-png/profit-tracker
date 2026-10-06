// ════════════════════════════════════════════════════════════════════
// LUCY · TRADING PREMATCH (06/10/2026) · scheda in Dashboard
// Mostra a che punto è l'analisi sullo storico Betfair e, SOLO se qualche strategia ha superato tutti i controlli,
// i consigli di adesso (entra a questo prezzo, esci prima dell'inizio). Altrimenti dice chiaramente perché non consiglia nulla.
// Legge lucy_trading_stato e lucy_trading_consigli (le scrive trading_prematch.py sul PC tramite il sito).
// Mettilo accanto a BetfairStato.jsx e PromoBonus.jsx.
// ════════════════════════════════════════════════════════════════════
import React, { useEffect, useState } from 'react'
import { supabase } from '../profit-tracker/supabaseClient'

// Funzione pura (si prova da sola): dallo stato dell'analisi al tipo di messaggio da mostrare
export function valutaLucy(stato, consigli = [], oraMs = Date.now()) {
  if (!stato) return { livello: 'nessuno', etaMin: null, testo: 'Nessuna analisi ricevuta ancora. Sul PC avvia trading_prematch.py (vedi le istruzioni).' }
  const t = Date.parse(stato.aggiornato)
  const etaMin = Number.isFinite(t) ? Math.max(0, Math.round((oraMs - t) / 60000)) : null
  if (etaMin != null && etaMin > 90) return { livello: 'fermo', etaMin, testo: `L'analisi è ferma da ${etaMin >= 120 ? Math.floor(etaMin / 60) + ' ore' : etaMin + ' minuti'}: controlla che il PC sia acceso e trading_prematch.py in funzione.` }
  if (consigli.length > 0) return { livello: 'consigli', etaMin, testo: `${consigli.length} ${consigli.length === 1 ? 'consiglio' : 'consigli'} di adesso` }
  if (Number(stato.giorni_dati) < Number(stato.min_giorni)) return { livello: 'raccolta', etaMin, testo: stato.messaggio || 'Raccolta dati in corso.' }
  return { livello: 'niente', etaMin, testo: stato.messaggio || 'Nessun vantaggio dimostrato.' }
}
// FINE valutaLucy

const STILI = {
  nessuno: { color: '#94a3b8', border: 'rgba(100,116,139,0.45)', bg: 'rgba(100,116,139,0.08)' },
  fermo: { color: '#fca5a5', border: 'rgba(239,68,68,0.6)', bg: 'rgba(239,68,68,0.10)' },
  raccolta: { color: '#7dd3fc', border: 'rgba(56,189,248,0.4)', bg: 'rgba(56,189,248,0.07)' },
  niente: { color: '#cbd5e1', border: 'rgba(100,116,139,0.5)', bg: 'rgba(15,23,42,0.6)' },
  consigli: { color: '#86efac', border: 'rgba(34,197,94,0.6)', bg: 'rgba(34,197,94,0.08)' },
}
const roma = (iso) => (iso ? new Date(iso).toLocaleString('it-IT', { timeZone: 'Europe/Rome', day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' }) : '—')
const f2 = (x) => (x == null ? '—' : Number(x).toFixed(2).replace('.', ','))
const pc = (x) => (x == null ? '—' : `${Number(x) >= 0 ? '+' : ''}${Number(x).toFixed(2).replace('.', ',')}%`)

function Barra({ valore, massimo, etichetta }) {
  const p = Math.max(0, Math.min(1, massimo ? valore / massimo : 0))
  return (
    <div style={{ minWidth: 200, flex: 1 }}>
      <div style={{ fontSize: 11, color: '#94a3b8', marginBottom: 3 }}>{etichetta}</div>
      <div style={{ height: 7, background: 'rgba(51,65,85,0.7)', borderRadius: 99 }}><div style={{ width: `${p * 100}%`, height: 7, borderRadius: 99, background: p >= 1 ? '#22c55e' : '#38bdf8' }} /></div>
    </div>)
}

export default function LucyTrading() {
  const [stato, setStato] = useState(undefined)   // undefined = carico, null = nessuna riga
  const [consigli, setConsigli] = useState([])
  const [, setTick] = useState(0)

  useEffect(() => {
    let vivo = true
    const carica = async () => {
      try {
        const s = await supabase.from('lucy_trading_stato').select('*').limit(1).maybeSingle()
        const c = await supabase.from('lucy_trading_consigli').select('*').order('rend_atteso_pct', { ascending: false }).limit(30)
        if (!vivo) return
        setStato(s.error ? null : (s.data || null))
        setConsigli(c.error ? [] : (c.data || []))
      } catch { if (vivo) { setStato(null); setConsigli([]) } }
    }
    carica()
    const a = setInterval(carica, 60000), b = setInterval(() => setTick(n => n + 1), 30000)
    return () => { vivo = false; clearInterval(a); clearInterval(b) }
  }, [])

  if (stato === undefined) return null
  const v = valutaLucy(stato, consigli)
  const st = STILI[v.livello]
  return (
    <div style={{ margin: '0 0 12px', padding: '10px 14px', borderRadius: 14, border: `1px solid ${st.border}`, background: st.bg }}>
      <div style={{ display: 'flex', gap: 10, alignItems: 'baseline', flexWrap: 'wrap' }}>
        <span style={{ fontWeight: 900, color: '#f8fafc', fontSize: 13 }}>🧠 Lucy · Trading prematch</span>
        <span style={{ fontSize: 12, color: st.color, fontWeight: 700 }}>{v.testo}</span>
      </div>
      {stato && (
        <div style={{ display: 'flex', gap: 14, flexWrap: 'wrap', marginTop: 8 }}>
          <Barra valore={Number(stato.giorni_dati) || 0} massimo={Number(stato.min_giorni) || 1} etichetta={`Giorni di storico: ${f2(stato.giorni_dati)} su ${stato.min_giorni}`} />
          <Barra valore={Number(stato.partite_complete) || 0} massimo={Number(stato.min_partite) * 5 || 1} etichetta={`Partite complete: ${stato.partite_complete}`} />
        </div>)}
      {v.livello === 'consigli' && (
        <div style={{ overflowX: 'auto', marginTop: 10 }}>
          <table style={{ borderCollapse: 'collapse', width: '100%', fontSize: 12 }}>
            <thead><tr>{['Partita', 'Mercato · selezione', 'Operazione', 'Entra a', 'Esci entro', 'Atteso (min 95%)', 'Base'].map(h => <th key={h} style={{ textAlign: 'left', padding: '4px 8px', color: '#94a3b8', fontSize: 11, borderBottom: '1px solid #334155' }}>{h}</th>)}</tr></thead>
            <tbody>{consigli.map(c => (
              <tr key={c.id}>
                <td style={{ padding: '5px 8px', fontWeight: 800 }}>{c.evento}<div style={{ fontSize: 10.5, color: '#94a3b8', fontWeight: 400 }}>inizio {roma(c.inizio)}</div></td>
                <td style={{ padding: '5px 8px' }}>{c.tipo} · <b>{c.selezione}</b></td>
                <td style={{ padding: '5px 8px', fontWeight: 800, color: c.direzione === 'BACK poi LAY' ? '#7dd3fc' : '#f9a8d4' }}>{c.direzione}</td>
                <td style={{ padding: '5px 8px', fontWeight: 800 }}>{f2(c.prezzo_entrata)}<div style={{ fontSize: 10.5, color: '#94a3b8', fontWeight: 400 }}>disp. {Math.round(c.size_entrata || 0)} €</div></td>
                <td style={{ padding: '5px 8px' }}>{roma(c.uscita_alle)}</td>
                <td style={{ padding: '5px 8px', color: '#86efac', fontWeight: 800 }}>{pc(c.rend_atteso_pct)}<div style={{ fontSize: 10.5, color: '#94a3b8', fontWeight: 400 }}>min {pc(c.rend_min_pct)}</div></td>
                <td style={{ padding: '5px 8px', color: '#94a3b8' }} title={c.segmento}>{c.n} partite</td>
              </tr>))}</tbody>
          </table>
          <div style={{ fontSize: 10.5, color: '#64748b', marginTop: 6 }}>Prezzi con il ritardo della chiave "delayed" di Betfair: sono uno studio, controlla sempre la quota reale sull'Exchange prima di muoverti. Le percentuali sono nette dopo la commissione ({f2(stato?.commissione_pct)}%) e riferite alla media storica di quella strategia, non a questa singola partita.</div>
        </div>)}
      {stato && stato.migliori && stato.migliori.length > 0 && (
        <details style={{ marginTop: 8, fontSize: 12, color: '#94a3b8' }}>
          <summary style={{ cursor: 'pointer', color: '#7dd3fc', fontWeight: 700 }}>Le strategie più promettenti finora (non sono consigli: non hanno ancora superato i controlli)</summary>
          <div style={{ padding: '6px 4px', lineHeight: 1.6 }}>
            {stato.migliori.map((m, i) => <div key={i}>• {m.strategia} <span style={{ color: '#64748b' }}>— media netta {pc(m.media_pct)} su {m.n} partite · z {f2(m.z)}</span></div>)}
            <div style={{ marginTop: 6, color: '#64748b' }}>Strategie provate: {stato.segmenti_testati} · valide: {stato.segmenti_validi} · soglia di significatività richiesta: z ≥ {f2(stato.z_richiesto)}</div>
          </div>
        </details>)}
    </div>)
}
