'use client'
// 🧮 Calcolatore Over 0.5 1T + assicurazione sullo 0-0 finale (04/11/2026)
// Solo calcolo nel browser: non legge né scrive nulla nel database. La matematica sta in lib/calcolatore1t.ts.
import { useMemo, useState } from 'react'
import Link from 'next/link'
import { copertura, pianoMasaniello, probTarget, stimaQuotaIntervallo, guadagnoChiusura } from '../../../lib/calcolatore1t'

const num = (s: string) => { const v = parseFloat(String(s).replace(',', '.')); return Number.isFinite(v) ? v : NaN }
const eur = (x: number) => (Number.isFinite(x) ? x.toLocaleString('it-IT', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + ' €' : '—')
const pct = (x: number, d = 1) => (Number.isFinite(x) ? (x * 100).toLocaleString('it-IT', { minimumFractionDigits: d, maximumFractionDigits: d }) + '%' : '—')
const sgn = (x: number) => (x > 0 ? '+' : '') + eur(x)

const card: React.CSSProperties = { background: 'rgba(15,23,42,.9)', border: '1px solid #1e293b', borderRadius: 12, padding: '12px 14px', marginBottom: 14 }
const lab: React.CSSProperties = { fontSize: 12, color: '#94a3b8', display: 'block', marginBottom: 3 }
const inp: React.CSSProperties = { width: '100%', background: '#020617', color: '#f8fafc', border: '1px solid #334155', borderRadius: 8, padding: '7px 9px', fontSize: 16, fontFamily: 'inherit', boxSizing: 'border-box' }
const griglia: React.CSSProperties = { display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: 10 }
const riga: React.CSSProperties = { display: 'flex', justifyContent: 'space-between', gap: 10, padding: '5px 0', borderBottom: '1px solid #1e293b', fontSize: 14.5 }

function Campo({ etichetta, valore, onChange, aiuto }: { etichetta: string; valore: string; onChange: (v: string) => void; aiuto?: string }) {
  return (
    <label>
      <span style={lab}>{etichetta}</span>
      <input value={valore} onChange={e => onChange(e.target.value)} inputMode="decimal" style={inp} />
      {aiuto && <span style={{ fontSize: 11, color: '#64748b' }}>{aiuto}</span>}
    </label>
  )
}

export default function Calcolatore1T() {
  // — copertura sullo 0-0 —
  const [X, setX] = useState('100')
  const [qOver, setQOver] = useState('1.33')
  const [qBack, setQBack] = useState('14.5')
  const [qChiu, setQChiu] = useState('4.5')          // quota 0-0 all'intervallo scritta a mano (se togli la stima automatica)
  const [auto, setAuto] = useState(true)               // stima automatica della quota all'intervallo
  const [qUnder, setQUnder] = useState('3.00')         // Under 0.5 1T: serve per togliere il margine al «0 gol nel 1T»
  const [qLay, setQLay] = useState('16.5')             // 0-0 finale in banca (per il prezzo medio)
  const [spreadH, setSpreadH] = useState('2')          // quanto paghi in più del prezzo giusto quando lo chiudi (%)
  const [corr, setCorr] = useState('0')                // correzione: nelle partite 0-0 all'intervallo spesso si segna meno (%)
  const [comm, setComm] = useState('4.5')
  const [rec, setRec] = useState('21.2')
  const [liq, setLiq] = useState('424')
  // — Masaniello —
  const [K, setK] = useState('1000')
  const [N, setN] = useState('100')
  const [V, setV] = useState('75')
  const [nRim, setNRim] = useState('100')
  const [vMan, setVMan] = useState('75')
  const [incassi, setIncassi] = useState('0')
  const [tasso, setTasso] = useState('75')

  const stima = useMemo(() => stimaQuotaIntervallo(num(qOver), num(qUnder), num(qBack), num(qLay), num(spreadH), num(corr)), [qOver, qUnder, qBack, qLay, spreadH, corr])
  const stimaOk = !('errore' in stima)
  // quota dello 0-0 all'intervallo usata nei calcoli: la stima, oppure quella scritta a mano
  const qChiuUsata = auto && !('errore' in stima) ? stima.quota : num(qChiu)
  const cop = useMemo(() => copertura(num(X), num(qOver), num(qBack), qChiuUsata, num(comm), num(rec)), [X, qOver, qBack, qChiuUsata, comm, rec])
  // come cambia la stima se cambia la quota iniziale dello 0-0 (stesse quote Over/Under 1T, stesso rapporto punta/banca)
  const tabella = useMemo(() => {
    const b0 = num(qBack), l0 = num(qLay)
    if (!stimaOk || !(b0 > 1)) return []
    const rap = l0 > 1 ? l0 / b0 : 1
    return [10, 12, 14.5, 17, 19, 22, 26].map(B => {
      const e = stimaQuotaIntervallo(num(qOver), num(qUnder), B, B * rap, num(spreadH), num(corr))
      return 'errore' in e ? null : { B, quota: e.quota, g: guadagnoChiusura(B, e.quota, num(comm)) }
    }).filter(Boolean) as { B: number; quota: number; g: number }[]
  }, [qOver, qUnder, qBack, qLay, spreadH, corr, comm, stimaOk])
  const qEff = cop ? cop.quotaEfficace : NaN
  // Masaniello con la quota efficace calcolata sopra (stessa logica delle simulazioni: l'assicurazione costa circa il 10% della vincita)
  const piano = useMemo(() => pianoMasaniello(num(K), qEff, Math.round(num(nRim)), Math.round(num(vMan))), [K, qEff, nRim, vMan])
  const pTarget = useMemo(() => probTarget(Math.round(num(N)), Math.round(num(V)), num(tasso) / 100), [N, V, tasso])
  const targetPartenza = useMemo(() => pianoMasaniello(num(K), qEff, Math.round(num(N)), Math.round(num(V))), [K, qEff, N, V])

  const stakeProssima = piano.stato === 'ok' ? piano.stake : NaN
  // copertura per la PROSSIMA giocata del Masaniello (stessa percentuale di recupero)
  const copProssima = useMemo(() => (Number.isFinite(stakeProssima) ? copertura(stakeProssima, num(qOver), num(qBack), qChiuUsata, num(comm), num(rec)) : null), [stakeProssima, qOver, qBack, qChiuUsata, comm, rec])
  const valoreOra = num(K) + (Number.isFinite(num(incassi)) ? num(incassi) : 0)
  const liquidita = num(liq)

  return (
    <div style={{ minHeight: '100dvh', background: '#0b1220', color: '#e2e8f0', fontFamily: 'system-ui, -apple-system, Segoe UI, sans-serif' }}>
      <div style={{ maxWidth: 820, margin: '0 auto', padding: '14px 12px 40px' }}>
        <Link href="/profit-tracker" style={{ color: '#7dd3fc', fontWeight: 800, textDecoration: 'none', fontSize: 14 }}>← Profit Tracker</Link>
        <h1 style={{ fontSize: 22, margin: '8px 0 4px' }}>🧮 Over 0.5 1T + assicurazione sullo 0-0</h1>
        <div style={{ fontSize: 12.5, color: '#94a3b8', lineHeight: 1.55, marginBottom: 12 }}>
          Punti X sull’<b>Over 0.5 primo tempo</b> e ti assicuri con una piccola puntata sullo <b>0-0 finale</b> (exchange). Se è 0-0 al 45’ lo 0-0 finale scende e lo chiudi in banca per recuperare una parte di X.
          Tutti i numeri sono stime con i valori che inserisci: la <b>quota di chiusura all’intervallo</b> è una previsione, non una quota vera. Questa pagina non salva nulla.
        </div>

        {/* 1 — COPERTURA */}
        <div style={card}>
          <div style={{ fontWeight: 800, marginBottom: 8 }}>1 · Quanto coprire sullo 0-0</div>
          <div style={griglia}>
            <Campo etichetta="Puntata X sull’Over 0.5 1T (€)" valore={X} onChange={setX} aiuto="lo stake che ti dà il Masaniello" />
            <Campo etichetta="Quota Over 0.5 1T" valore={qOver} onChange={setQOver} />
            <Campo etichetta="Quota 0-0 finale (punta)" valore={qBack} onChange={setQBack} aiuto="quella a cui entri" />
            <Campo etichetta="Quota Under 0.5 1T" valore={qUnder} onChange={setQUnder} aiuto="serve per togliere il margine del book" />
            <Campo etichetta="Quota 0-0 finale (banca)" valore={qLay} onChange={setQLay} aiuto="il prezzo in banca di oggi (se non la sai, uguale a quella in punta)" />
            <Campo etichetta="Commissione exchange (%)" valore={comm} onChange={setComm} />
            <Campo etichetta="Recupero desiderato (% di X)" valore={rec} onChange={setRec} aiuto="quanto di X vuoi riprenderti se è 0-0 al 45’" />
          </div>

          {/* Stima della quota dello 0-0 al 45' */}
          <div style={{ marginTop: 12, padding: '10px 12px', border: '1px solid #334155', borderRadius: 10, background: 'rgba(2,6,23,.6)' }}>
            <div style={{ fontWeight: 800, fontSize: 14, marginBottom: 4 }}>Quota dello 0-0 finale al 45’ (se è 0-0)</div>
            <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, color: '#cbd5e1', marginBottom: 8 }}>
              <input type="checkbox" checked={auto} onChange={e => setAuto(e.target.checked)} /> Stima automatica dalle quote qui sopra
            </label>
            {'errore' in stima ? (
              <div style={{ color: '#fca5a5', fontSize: 13 }}>⚠️ {stima.errore}</div>
            ) : (
              <div>
                <div style={riga}><span>Probabilità di 0 gol nel 1T (margine tolto)</span><b>{pct(stima.p1)}</b></div>
                <div style={riga}><span>Probabilità di 0-0 finale (prezzo medio punta/banca)</span><b>{pct(stima.p00)}</b></div>
                <div style={riga}><span>Probabilità di nessun gol nel 2T, dato 0-0 al 45’</span><b>{pct(stima.p2)}</b></div>
                <div style={riga}><span>Quota giusta al 45’</span><b>{stima.quotaGiusta.toLocaleString('it-IT', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</b></div>
                <div style={{ ...riga, borderBottom: 0 }}><span>Quota a cui la banchi (con spread e correzione)</span><b style={{ color: '#4ade80', fontSize: 17 }}>{stima.quota.toLocaleString('it-IT', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</b></div>
              </div>
            )}
            <div style={{ ...griglia, marginTop: 8 }}>
              <Campo etichetta="Spread di chiusura (%)" valore={spreadH} onChange={setSpreadH} aiuto="quanto paghi sopra il prezzo giusto" />
              <Campo etichetta="Correzione partite con pochi gol (%)" valore={corr} onChange={setCorr} aiuto="positiva = la quota scende di più" />
              <Campo etichetta="Oppure scrivila tu (solo senza stima)" valore={qChiu} onChange={setQChiu} aiuto="usata se togli la spunta" />
            </div>
            <div style={{ fontSize: 11.5, color: '#64748b', marginTop: 6, lineHeight: 1.5 }}>
              Modello: primo e secondo tempo indipendenti, quindi a 0-0 al 45’ la quota dello 0-0 finale = quota iniziale × probabilità di 0 gol nel 1T. È una stima: nelle partite 0-0 all’intervallo si segna spesso meno del normale.
            </div>

            {tabella.length > 0 && (
              <div style={{ marginTop: 10, overflowX: 'auto' }}>
                <div style={{ fontSize: 12, color: '#94a3b8', marginBottom: 4 }}>Se cambia la quota iniziale dello 0-0 (stesse quote Over/Under 1T):</div>
                <table style={{ borderCollapse: 'collapse', fontSize: 13, width: '100%' }}>
                  <thead>
                    <tr style={{ color: '#94a3b8', textAlign: 'right' }}>
                      <th style={{ textAlign: 'left', padding: '3px 6px', fontWeight: 600 }}>0-0 iniziale</th>
                      <th style={{ padding: '3px 6px', fontWeight: 600 }}>stima al 45’</th>
                      <th style={{ padding: '3px 6px', fontWeight: 600 }}>calo</th>
                      <th style={{ padding: '3px 6px', fontWeight: 600 }}>guadagno per € (g)</th>
                    </tr>
                  </thead>
                  <tbody>
                    {tabella.map(r => (
                      <tr key={r.B} style={{ textAlign: 'right', borderTop: '1px solid #1e293b' }}>
                        <td style={{ textAlign: 'left', padding: '3px 6px' }}>{r.B.toLocaleString('it-IT')}</td>
                        <td style={{ padding: '3px 6px' }}>{r.quota.toLocaleString('it-IT', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
                        <td style={{ padding: '3px 6px' }}>{pct(1 - r.quota / r.B, 0)}</td>
                        <td style={{ padding: '3px 6px' }}>{r.g.toLocaleString('it-IT', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                <div style={{ fontSize: 11.5, color: '#64748b', marginTop: 4, lineHeight: 1.5 }}>
                  La quota scende sempre dello stesso rapporto: il recupero per euro (g) cambia solo se cambia la probabilità di 0 gol nel 1T, cioè se cambiano le quote Over/Under 0.5 1T. Una partita con lo 0-0 finale più alto, di solito, ha anche l’Over 0.5 1T più basso.
                </div>
              </div>
            )}
          </div>
          {!cop ? (
            <div style={{ marginTop: 10, color: '#fca5a5', fontSize: 13 }}>⚠️ Controlla i numeri: le quote devono essere maggiori di 1 e la quota di chiusura più bassa di quella di ingresso.</div>
          ) : (
            <div style={{ marginTop: 10 }}>
              <div style={riga}><span>Puntata sullo 0-0 finale</span><b style={{ color: '#4ade80', fontSize: 17 }}>{eur(cop.s)}</b></div>
              <div style={riga}><span>Se segna nel 1T (Over vince, perdi la copertura)</span><b>{sgn(cop.vinceSeSegna)}</b></div>
              <div style={riga}><span>Se è 0-0 al 45’ (perdi X, chiudi lo 0-0)</span><b>{sgn(cop.perdeSeZero)}</b></div>
              <div style={riga}><span>Guadagno netto per € sullo 0-0 chiuso (g)</span><b>{cop.g.toLocaleString('it-IT', { maximumFractionDigits: 3 })}</b></div>
              <div style={riga}><span>Quota efficace da usare nel Masaniello</span><b>{cop.quotaEfficace.toLocaleString('it-IT', { minimumFractionDigits: 3, maximumFractionDigits: 3 })}</b></div>
              <div style={{ ...riga, borderBottom: 0 }}><span>Tasso di vittoria di pareggio (sotto questo perdi in media)</span><b style={{ color: '#fbbf24' }}>{pct(cop.pareggio)}</b></div>
              <div style={{ marginTop: 8, display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                <label style={{ ...lab, margin: 0 }}>Disponibile sullo 0-0 (€)</label>
                <input value={liq} onChange={e => setLiq(e.target.value)} inputMode="decimal" style={{ ...inp, width: 90 }} />
                {Number.isFinite(liquidita) && cop.s > liquidita && <span style={{ color: '#fca5a5', fontSize: 13 }}>⚠️ la copertura ({eur(cop.s)}) supera la liquidità: non la trovi tutta a quella quota</span>}
              </div>
            </div>
          )}
        </div>

        {/* 2 — MASANIELLO */}
        <div style={card}>
          <div style={{ fontWeight: 800, marginBottom: 2 }}>2 · Masaniello con la quota efficace</div>
          <div style={{ fontSize: 12, color: '#94a3b8', marginBottom: 8 }}>
            Masaniello classico (eventi, vittorie da fare) calcolato con la quota efficace del punto 1: il costo dell’assicurazione è già dentro la quota. Gli incassi dell’assicurazione stanno fuori dal capitale e si sommano.
          </div>
          <div style={griglia}>
            <Campo etichetta="Capitale del Masaniello (€)" valore={K} onChange={setK} aiuto="il capitale di adesso" />
            <Campo etichetta="Eventi del ciclo" valore={N} onChange={setN} />
            <Campo etichetta="Vittorie da fare nel ciclo" valore={V} onChange={setV} />
            <Campo etichetta="Partite ancora da giocare" valore={nRim} onChange={setNRim} aiuto="a inizio ciclo = eventi" />
            <Campo etichetta="Vittorie ancora da fare" valore={vMan} onChange={setVMan} aiuto="a inizio ciclo = vittorie" />
            <Campo etichetta="Incassi assicurazione finora (€)" valore={incassi} onChange={setIncassi} />
          </div>
          {!cop && <div style={{ marginTop: 10, color: '#fca5a5', fontSize: 13 }}>⚠️ Prima compila bene il punto 1: serve la quota efficace.</div>}
          {cop && piano.stato === 'errore' && <div style={{ marginTop: 10, color: '#fca5a5', fontSize: 13 }}>⚠️ {piano.motivo}</div>}
          {cop && piano.stato === 'raggiunto' && <div style={{ marginTop: 10, color: '#4ade80', fontSize: 14 }}>✅ Le vittorie previste sono già fatte: nessuna puntata. Valore ora (capitale + incassi): <b>{eur(valoreOra)}</b>.</div>}
          {cop && piano.stato === 'impossibile' && <div style={{ marginTop: 10, color: '#fbbf24', fontSize: 14 }}>⚠️ Con le partite rimaste non si arriva più al target. Valore ora (capitale + incassi): <b>{eur(valoreOra)}</b>.</div>}
          {cop && piano.stato === 'ok' && (
            <div style={{ marginTop: 10 }}>
              <div style={riga}><span>Puntata Over 0.5 1T della prossima partita</span><b style={{ color: '#4ade80', fontSize: 17 }}>{eur(piano.stake)}</b></div>
              {copProssima && <div style={riga}><span>… con copertura sullo 0-0 finale di</span><b style={{ color: '#4ade80', fontSize: 17 }}>{eur(copProssima.s)}</b></div>}
              {copProssima && Number.isFinite(liquidita) && copProssima.s > liquidita && <div style={{ color: '#fca5a5', fontSize: 13, padding: '4px 0' }}>⚠️ La copertura supera la liquidità indicata ({eur(liquidita)}).</div>}
              <div style={riga}><span>Rendimento del Masaniello se centri il target (da qui)</span><b>{pct(piano.rendimentoTarget)}</b></div>
              <div style={{ ...riga, borderBottom: 0 }}><span>Valore ora (capitale + incassi assicurazione)</span><b>{eur(valoreOra)}</b></div>
              <div style={{ fontSize: 12, color: '#94a3b8', marginTop: 6, lineHeight: 1.5 }}>
                Se non giochi la prossima e ricominci, ti porti a casa <b>{eur(valoreOra)}</b>. Giocarla conviene solo se il tuo tasso reale di vittoria supera il pareggio del punto 1.
              </div>
            </div>
          )}
        </div>

        {/* 3 — PROBABILITÀ DI CENTRARE IL TARGET */}
        <div style={card}>
          <div style={{ fontWeight: 800, marginBottom: 8 }}>3 · Quante volte centri il target?</div>
          <div style={{ maxWidth: 240 }}>
            <Campo etichetta="Tuo tasso reale di Over 0.5 1T (%)" valore={tasso} onChange={setTasso} aiuto="la % di partite scelte in cui segna nel 1T" />
          </div>
          <div style={{ marginTop: 8 }}>
            <div style={riga}><span>Probabilità di fare almeno {V || '…'} vittorie su {N || '…'} partite</span><b style={{ color: '#4ade80', fontSize: 17 }}>{pct(pTarget, 0)}</b></div>
            {cop && targetPartenza.stato === 'ok' && <div style={{ ...riga, borderBottom: 0 }}><span>Rendimento del Masaniello a quel target (dall’inizio)</span><b>{pct(targetPartenza.rendimentoTarget)}</b></div>}
            {cop && Number.isFinite(cop.pareggio) && Number.isFinite(num(tasso)) && (
              <div style={{ marginTop: 6, fontSize: 13, color: num(tasso) / 100 >= cop.pareggio ? '#4ade80' : '#fca5a5', lineHeight: 1.5 }}>
                {num(tasso) / 100 >= cop.pareggio
                  ? `Il tuo tasso (${pct(num(tasso) / 100)}) è sopra il pareggio (${pct(cop.pareggio)}): in media guadagni.`
                  : `Il tuo tasso (${pct(num(tasso) / 100)}) è sotto il pareggio (${pct(cop.pareggio)}): in media perdi, anche con l’assicurazione.`}
              </div>
            )}
          </div>
        </div>

        <div style={{ fontSize: 11.5, color: '#64748b', lineHeight: 1.55 }}>
          Ipotesi: partite indipendenti, stessa quota Over e stessa quota 0-0 per tutte, chiusura dello 0-0 all’intervallo alla quota indicata e con liquidità sufficiente. Se fallisce il target il Masaniello perde il capitale rimasto, ma gli incassi dell’assicurazione sulle partite perse restano.
          Lo 0-0 qui è il risultato esatto <b>finale</b>.
        </div>
      </div>
    </div>
  )
}
