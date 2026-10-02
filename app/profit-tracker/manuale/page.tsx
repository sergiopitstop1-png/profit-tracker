'use client'
// ════════════════════════════════════════════════════════════════════
// 📘 MANUALE OPERATIVO · ProfitTracker · Lucy · PronoX (03/10/2026)
// Pagina riservata (/profit-tracker/manuale). Il testo è in ./contenuto.ts
// ════════════════════════════════════════════════════════════════════
import { useMemo, useState } from 'react'
import Link from 'next/link'
import { PARTI, AGGIORNATO, type Sezione, type Nota } from './contenuto'

const testoDi = (s: Sezione) => [s.titolo, s.intro, ...s.blocchi.flatMap(b => [b.titolo, b.testo, b.nota?.testo, ...(b.punti || []), ...(b.passi || []), ...((b.tabella || []).flat())])].join(' ').toLowerCase()
const STILE_NOTA: Record<Nota['tipo'], { bordo: string; fondo: string; icona: string; titolo: string }> = {
  regola: { bordo: '#22c55e', fondo: 'rgba(34,197,94,.08)', icona: '⭐', titolo: 'Regola' },
  attenzione: { bordo: '#f59e0b', fondo: 'rgba(245,158,11,.08)', icona: '⚠️', titolo: 'Attenzione' },
  consiglio: { bordo: '#38bdf8', fondo: 'rgba(56,189,248,.08)', icona: '💡', titolo: 'Consiglio' },
}

export default function ManualePage() {
  const [cerca, setCerca] = useState('')
  const q = cerca.trim().toLowerCase()
  const parti = useMemo(() => PARTI.map(p => ({ ...p, sezioni: p.sezioni.filter(s => !q || testoDi(s).includes(q)) })).filter(p => p.sezioni.length), [q])
  let numero = 0
  const numeri = new Map<string, number>()
  PARTI.forEach(p => p.sezioni.forEach(s => numeri.set(s.id, ++numero)))
  const ev = (t?: string) => {
    if (!t) return null
    if (!q) return t
    const i = t.toLowerCase().indexOf(q)
    if (i < 0) return t
    return <>{t.slice(0, i)}<mark style={{ background: '#facc15', color: '#0f172a', borderRadius: 3 }}>{t.slice(i, i + q.length)}</mark>{t.slice(i + q.length)}</>
  }
  const cella = { border: '1px solid #1e293b', padding: '6px 9px', fontSize: 13, verticalAlign: 'top' as const, lineHeight: 1.5 }

  return (
    <div style={{ minHeight: '100vh', background: '#0b1220', color: '#e2e8f0', fontFamily: 'system-ui, -apple-system, Segoe UI, sans-serif' }}>
      <div style={{ maxWidth: 1220, margin: '0 auto', padding: '24px 18px 80px', display: 'flex', gap: 28, alignItems: 'flex-start', flexWrap: 'wrap' }}>
        <nav style={{ position: 'sticky', top: 16, flex: '0 0 270px', maxHeight: 'calc(100vh - 32px)', overflowY: 'auto', background: 'rgba(15,23,42,.92)', border: '1px solid #1e293b', borderRadius: 14, padding: 14 }}>
          <Link href="/profit-tracker" style={{ color: '#7dd3fc', fontSize: 12, textDecoration: 'none', fontWeight: 700 }}>← Torna al Profit Tracker</Link>
          <div style={{ fontWeight: 900, margin: '12px 0 8px', fontSize: 13, color: '#f8fafc' }}>📘 Indice</div>
          <input value={cerca} onChange={e => setCerca(e.target.value)} placeholder="🔎 Cerca nel manuale…"
            style={{ width: '100%', boxSizing: 'border-box', background: '#020617', color: '#f8fafc', border: '1px solid #334155', borderRadius: 8, padding: '6px 8px', fontSize: 12, marginBottom: 8 }} />
          {parti.map(p => (
            <div key={p.id} style={{ marginBottom: 10 }}>
              <a href={`#${p.id}`} style={{ display: 'block', fontSize: 11, fontWeight: 900, color: '#38bdf8', textDecoration: 'none', letterSpacing: .5, margin: '6px 0 3px' }}>{p.titolo.toUpperCase()}</a>
              {p.sezioni.map(s => (
                <a key={s.id} href={`#${s.id}`} style={{ display: 'block', color: '#cbd5e1', textDecoration: 'none', fontSize: 12.5, lineHeight: 1.75, paddingLeft: 6 }}>{numeri.get(s.id)}. {s.titolo}</a>
              ))}
            </div>
          ))}
          {q && !parti.length && <div style={{ fontSize: 12, color: '#94a3b8' }}>Nessun risultato.</div>}
        </nav>

        <main style={{ flex: '1 1 640px', minWidth: 0 }}>
          <header style={{ marginBottom: 22 }}>
            <div style={{ fontSize: 12, letterSpacing: 2, color: '#38bdf8', fontWeight: 800 }}>PROFITTRACKER · LUCY · PRONOX</div>
            <h1 style={{ fontSize: 32, margin: '6px 0', color: '#f8fafc' }}>Manuale operativo</h1>
            <div style={{ fontSize: 14, color: '#94a3b8', lineHeight: 1.6 }}>Dal primo accesso al lavoro di tutti i giorni, pulsante per pulsante. Aggiornato al {AGGIORNATO}.</div>
          </header>

          {parti.map(p => (
            <div key={p.id}>
              <div id={p.id} style={{ scrollMarginTop: 16, margin: '28px 0 12px', padding: '12px 16px', borderRadius: 12, background: 'linear-gradient(90deg,#0c4a6e,#1e293b)', border: '1px solid #0369a1' }}>
                <div style={{ fontSize: 20, fontWeight: 900, color: '#f0f9ff' }}>{p.titolo}</div>
                <div style={{ fontSize: 13, color: '#bae6fd' }}>{p.sottotitolo}</div>
              </div>
              {p.sezioni.map(s => (
                <section key={s.id} id={s.id} style={{ scrollMarginTop: 16, background: 'rgba(15,23,42,.6)', border: '1px solid #1e293b', borderRadius: 14, padding: '18px 20px', marginBottom: 16 }}>
                  <h2 style={{ fontSize: 20, margin: '0 0 8px', color: '#f8fafc' }}>{numeri.get(s.id)}. {ev(s.titolo)}</h2>
                  {s.intro && <p style={{ margin: '0 0 10px', lineHeight: 1.65, color: '#cbd5e1' }}>{ev(s.intro)}</p>}
                  {s.blocchi.map((b, i) => (
                    <div key={i} style={{ marginTop: 12 }}>
                      {b.titolo && <h3 style={{ fontSize: 15, margin: '6px 0 6px', color: '#7dd3fc' }}>{ev(b.titolo)}</h3>}
                      {b.testo && <p style={{ margin: '0 0 8px', lineHeight: 1.65, color: '#cbd5e1' }}>{ev(b.testo)}</p>}
                      {b.punti && <ul style={{ margin: 0, paddingLeft: 20, lineHeight: 1.7, color: '#cbd5e1' }}>{b.punti.map((x, j) => <li key={j}>{ev(x)}</li>)}</ul>}
                      {b.passi && <ol style={{ margin: 0, paddingLeft: 22, lineHeight: 1.7, color: '#cbd5e1' }}>{b.passi.map((x, j) => <li key={j} style={{ marginBottom: 3 }}>{ev(x)}</li>)}</ol>}
                      {b.tabella && (
                        <div style={{ overflowX: 'auto' }}>
                          <table style={{ borderCollapse: 'collapse', width: '100%' }}>
                            <thead><tr>{b.tabella[0].map((h, j) => <th key={j} style={{ ...cella, textAlign: 'left', background: '#0f172a', color: '#7dd3fc', fontSize: 12 }}>{h}</th>)}</tr></thead>
                            <tbody>{b.tabella.slice(1).map((r, j) => <tr key={j}>{r.map((c, k) => <td key={k} style={{ ...cella, color: k === 0 ? '#f8fafc' : '#cbd5e1', fontWeight: k === 0 ? 700 : 400 }}>{ev(c)}</td>)}</tr>)}</tbody>
                          </table>
                        </div>
                      )}
                      {b.nota && (() => { const st = STILE_NOTA[b.nota.tipo]; return (
                        <div style={{ borderLeft: `4px solid ${st.bordo}`, background: st.fondo, borderRadius: 8, padding: '9px 12px', color: '#e2e8f0', lineHeight: 1.6, fontSize: 14 }}>
                          <b style={{ color: st.bordo }}>{st.icona} {st.titolo}: </b>{ev(b.nota.testo)}
                        </div>) })()}
                    </div>
                  ))}
                  <div style={{ textAlign: 'right', marginTop: 8 }}><a href="#" style={{ color: '#64748b', fontSize: 11, textDecoration: 'none' }}>↑ torna su</a></div>
                </section>
              ))}
            </div>
          ))}
          <p style={{ fontSize: 12, color: '#64748b' }}>Il manuale descrive il sistema al {AGGIORNATO}: quando il Profit Tracker cambia, va aggiornato (il testo è nel file contenuto.ts).</p>
        </main>
      </div>
    </div>
  )
}
