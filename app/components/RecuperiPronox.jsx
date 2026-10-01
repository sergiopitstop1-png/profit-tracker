"use client";
// ════════════════════════════════════════════════════════════════════
// RECUPERI CON PRONOX · Masaniello pilota (01/10/2026)
// Lucy prepara la scheda con le partite di PronoX (fotografie del giorno),
// calcola le puntate col Masaniello del recupero e le divide tra i conti
// limitati. Sergio conferma la scheda, poi per ogni bet:
//   📱 apre il book sul telefono del cliente · ✓ piazzata (quota reale) · ✗ saltata
// Una bet saltata non si perde: Lucy propone subito un altro conto.
// Gli esiti arrivano da soli (selection_outcomes, cron pronox-outcomes).
// Tabelle: recupero_piano, recupero_bets (vedi recupero_pronox.sql).
// La logica dei calcoli è in lib/recupero/masanielloRecupero.js.
// ════════════════════════════════════════════════════════════════════
import React, { useState, useEffect, useMemo, useCallback } from 'react'
import { supabase } from '../profit-tracker/supabaseClient'
import { contiInRecupero } from './RecuperoConti'
import { MODEL_VERSION } from '../../lib/pronox/footballModel'
import { PIANO_PILOTA, statoPiano, schedaDelGiorno, dividiTraConti } from '../../lib/recupero/masanielloRecupero'

// book dove il recupero NON passa dalle scommesse sport
const ESCLUSI = ['bet365', 'betfair', 'admiral']
const norm = (s) => String(s || '').toLowerCase().replace(/[^a-z0-9]/g, '')
const euro = (n) => (Number(n) || 0).toLocaleString('it-IT', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + ' €'
const quando = (iso) => new Date(iso).toLocaleString('it-IT', { timeZone: 'Europe/Rome', weekday: 'short', day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })
const iniziata = (iso) => new Date(iso).getTime() <= Date.now()

// ─── funzioni pure (esportate per i test) ───────────────────────────
// Conti utilizzabili: tutti i limitati (anche in coda), un conto una volta sola (lo sport ha la precedenza)
export function contiPerRecupero(books, recuperi, getRecuperoProtocollo) {
  const per = new Map()
  for (const it of contiInRecupero(books, recuperi, getRecuperoProtocollo)) {
    if (!it.proto?.disponibile) continue
    if (ESCLUSI.some(x => norm(it.book.nome).includes(x))) continue
    const id = String(it.book.id)
    if (per.has(id) && per.get(id).tipo === 'sport') continue
    per.set(id, { book_id: id, nome: it.book.nome, intestatario: it.book.intestatario, tipo: it.tipo === 'sport' ? 'sport' : 'bonus' })
  }
  return [...per.values()]
}

// Eventi del piano dalle bet: una riga per partita, con l'esito se c'è
export function eventiDalleBet(bets, esiti) {
  const per = new Map()
  for (const b of bets || []) {
    if (!per.has(b.event_id)) per.set(b.event_id, [])
    per.get(b.event_id).push(b)
  }
  const out = []
  for (const [event_id, righe] of per) {
    const r0 = righe[0]
    const piazzate = righe.filter(b => b.stato === 'piazzata')
    const daFare = righe.filter(b => b.stato === 'da_fare')
    const k = `${event_id}|${r0.market}|${r0.selection}`
    if (!iniziata(r0.event_start)) {
      const impegno = [...piazzate, ...daFare].reduce((a, b) => a + Number(b.importo), 0)
      if (impegno > 0) out.push({ event_id, event_start: r0.event_start, puntata: impegno, incasso: 0, esito: 'attesa' })
      continue
    }
    if (!piazzate.length) continue // iniziata senza bet piazzate: non entra nel piano
    const puntata = piazzate.reduce((a, b) => a + Number(b.importo), 0)
    if (!esiti.has(k)) { out.push({ event_id, event_start: r0.event_start, puntata, incasso: 0, esito: 'attesa' }); continue }
    const won = esiti.get(k)
    if (won === null) out.push({ event_id, event_start: r0.event_start, puntata, incasso: puntata, esito: 'nulla' })
    else if (won) out.push({ event_id, event_start: r0.event_start, puntata, incasso: piazzate.reduce((a, b) => a + Number(b.importo) * Number(b.quota_reale || 0), 0), esito: 'vinta' })
    else out.push({ event_id, event_start: r0.event_start, puntata, incasso: 0, esito: 'persa' })
  }
  return out.sort((a, b) => String(a.event_start).localeCompare(String(b.event_start)))
}

// € del piano giocati da ogni conto nella settimana corrente (da lunedì) e data dell'ultima bet
export function usoConti(bets, oggi = new Date()) {
  const lun = new Date(oggi); lun.setHours(0, 0, 0, 0); lun.setDate(lun.getDate() - ((lun.getDay() + 6) % 7))
  const uso = new Map(), ultima = new Map()
  for (const b of bets || []) {
    if (b.stato === 'saltata') continue
    const id = String(b.book_id)
    if (new Date(b.event_start) >= lun) uso.set(id, (uso.get(id) || 0) + Number(b.importo))
    if (!ultima.has(id) || String(b.event_start) > ultima.get(id)) ultima.set(id, String(b.event_start))
  }
  return { uso, ultima }
}

const pianoDaDb = (p) => p ? { capitale: Number(p.capitale), N: Number(p.n_eventi), K: Number(p.k_vincite), quotaRif: Number(p.quota_rif), eventi_extra: Number(p.eventi_extra || 0) } : null

// ─── componente ─────────────────────────────────────────────────────
export default function RecuperiPronoxPanel({ books, recuperi, getRecuperoProtocollo, sitoBook, apriSuTelefoni, onMessage, onError, incorporato = false, onDaFare }) {
  const [apertoProprio, setAperto] = useState(true)
  const aperto = incorporato || apertoProprio // dentro una sezione a scomparsa: niente intestazione propria
  const [piano, setPiano] = useState(null)
  const [bets, setBets] = useState([])
  const [righe, setRighe] = useState([])
  const [esiti, setEsiti] = useState(new Map())
  const [carico, setCarico] = useState(true)
  const [lavoro, setLavoro] = useState(false)
  const msg = onMessage || (() => {}), err = onError || ((e) => console.error(e))

  const carica = useCallback(async () => {
    setCarico(true)
    try {
      const { data: p, error: e1 } = await supabase.from('recupero_piano').select('*').eq('id', 1).maybeSingle()
      if (e1) throw new Error('recupero_piano: lancia recupero_pronox.sql (' + e1.message + ')')
      const { data: b, error: e2 } = await supabase.from('recupero_bets').select('*').order('event_start', { ascending: true })
      if (e2) throw new Error('recupero_bets: ' + e2.message)
      // fotografie delle prossime 48 ore
      const da = new Date(Date.now() + 10 * 60000).toISOString(), a = new Date(Date.now() + 48 * 3600000).toISOString()
      const tutte = []
      for (let from = 0; ; from += 1000) {
        const { data, error } = await supabase.from('prediction_snapshots')
          .select('event_id,event_start,competition,home_team,away_team,market,selection,model_version,model_prob')
          .gte('event_start', da).lte('event_start', a).like('model_version', `${MODEL_VERSION}_%`)
          .order('id', { ascending: true }).range(from, from + 999)
        if (error) throw new Error('fotografie PronoX: ' + error.message)
        tutte.push(...(data || []))
        if (!data || data.length < 1000) break
      }
      // esiti delle partite del piano
      const ids = [...new Set((b || []).map(x => x.event_id))]
      const mappa = new Map()
      for (let i = 0; i < ids.length; i += 100) {
        const { data, error } = await supabase.from('selection_outcomes').select('event_id,market,selection,won').in('event_id', ids.slice(i, i + 100))
        if (error) throw new Error('esiti: ' + error.message)
        for (const o of data || []) mappa.set(`${o.event_id}|${o.market}|${o.selection}`, o.won)
      }
      setPiano(p); setBets(b || []); setRighe(tutte); setEsiti(mappa)
    } catch (e) { err(String(e.message || e)) }
    setCarico(false)
  }, [])
  useEffect(() => { carica() }, [carica])

  const conti = useMemo(() => contiPerRecupero(books, recuperi, getRecuperoProtocollo), [books, recuperi, getRecuperoProtocollo])
  const eventi = useMemo(() => eventiDalleBet(bets, esiti), [bets, esiti])
  const { uso, ultima } = useMemo(() => usoConti(bets), [bets])
  const pianoDb = pianoDaDb(piano)
  const scheda = useMemo(() => {
    if (!piano) return null
    return schedaDelGiorno({ pianoDb, eventi, righeSnapshot: righe, conti, usoSettimana: uso, ultimaBet: ultima, giaInPiano: new Set(bets.map(x => x.event_id)) })
  }, [piano, eventi, righe, conti, uso, ultima, bets])
  const stato = scheda?.stato

  const bookDi = (b) => (books || []).find(x => String(x.id) === String(b.book_id)) || { id: b.book_id, nome: b.book_nome, intestatario: b.intestatario }

  // ✓ conferma della scheda proposta
  async function confermaScheda() {
    if (!scheda?.bets?.length) return
    const rows = []
    for (const bet of scheda.bets) for (const z of bet.pezzi) rows.push({
      event_id: bet.event_id, event_start: bet.event_start, competition: bet.competition, partita: bet.partita,
      market: bet.market, selection: bet.selection, esito_label: bet.esito, prob: bet.prob, quota_minima: bet.quotaMinima,
      puntata_evento: bet.puntata, book_id: String(z.book_id), book_nome: z.nome, intestatario: z.intestatario, tipo: z.tipo, importo: z.importo,
    })
    if (!window.confirm(`Confermo la scheda di Lucy: ${scheda.bets.length} partite, ${rows.length} bet, ${euro(scheda.bets.reduce((a, b) => a + b.puntata, 0))}?`)) return
    setLavoro(true)
    const { error } = await supabase.from('recupero_bets').insert(rows)
    setLavoro(false)
    if (error) return err('Scheda non salvata: ' + error.message)
    msg(`✅ Scheda confermata: ${rows.length} bet da piazzare`)
    carica()
  }

  async function piazzata(b) {
    const t = window.prompt(`Quota reale presa su ${b.book_nome} (${b.intestatario})?\nQuota minima: ${String(b.quota_minima).replace('.', ',')}`, String(b.quota_minima).replace('.', ','))
    if (t === null) return
    const q = parseFloat(String(t).replace(',', '.'))
    if (!Number.isFinite(q) || q <= 1) return err('Quota non valida')
    if (q < Number(b.quota_minima) && !window.confirm(`La quota ${String(q).replace('.', ',')} è sotto la minima (${String(b.quota_minima).replace('.', ',')}): il valore atteso è negativo. La segno comunque?`)) return
    const { error } = await supabase.from('recupero_bets').update({ stato: 'piazzata', quota_reale: q, piazzata_at: new Date().toISOString() }).eq('id', b.id)
    if (error) return err(error.message)
    setBets(prev => prev.map(x => x.id === b.id ? { ...x, stato: 'piazzata', quota_reale: q } : x))
  }

  async function saltata(b) {
    if (!window.confirm(`Segno come SALTATA la bet di ${euro(b.importo)} su ${b.book_nome} (${b.intestatario})?`)) return
    const { error } = await supabase.from('recupero_bets').update({ stato: 'saltata' }).eq('id', b.id)
    if (error) return err(error.message)
    const nuove = bets.map(x => x.id === b.id ? { ...x, stato: 'saltata' } : x)
    setBets(nuove)
    if (iniziata(b.event_start)) return
    // Lucy propone subito un altro conto per la stessa cifra
    const giaUsati = new Set(bets.filter(x => x.event_id === b.event_id).map(x => String(x.book_id)))
    const { uso: u, ultima: ul } = usoConti(nuove)
    const { pezzi } = dividiTraConti(Number(b.importo), { event_id: b.event_id + '|r' }, conti, u, ul, { giaUsati })
    if (!pezzi.length) return msg('Nessun altro conto libero per questa bet: resta saltata')
    const testo = pezzi.map(z => `${z.nome} · ${z.intestatario} · ${euro(z.importo)}`).join('\n')
    if (!window.confirm(`Lucy propone di spostarla su:\n${testo}\nConfermi?`)) return
    const rows = pezzi.map(z => ({ ...Object.fromEntries(['event_id', 'event_start', 'competition', 'partita', 'market', 'selection', 'esito_label', 'prob', 'quota_minima', 'puntata_evento'].map(k => [k, b[k]])), book_id: String(z.book_id), book_nome: z.nome, intestatario: z.intestatario, tipo: z.tipo, importo: z.importo }))
    const { error: e2 } = await supabase.from('recupero_bets').insert(rows)
    if (e2) return err(e2.message)
    carica()
  }

  async function allunga(extra) {
    if (!window.confirm(`Allungo il piano di ${extra} eventi? Le puntate e l'obiettivo si abbassano.`)) return
    const { error } = await supabase.from('recupero_piano').update({ eventi_extra: Number(piano.eventi_extra || 0) + extra }).eq('id', 1)
    if (error) return err(error.message)
    msg(`Piano allungato di ${extra} eventi`)
    carica()
  }

  // ─── viste ──────────────────────────────────────────────────────────
  const daFare = bets.filter(b => b.stato === 'da_fare' && !iniziata(b.event_start))
  useEffect(() => { if (onDaFare) onDaFare(daFare.length) }, [daFare.length])
  const scadute = bets.filter(b => b.stato === 'da_fare' && iniziata(b.event_start))
  const perPartita = (lista) => { const m = new Map(); for (const b of lista) { if (!m.has(b.event_id)) m.set(b.event_id, []); m.get(b.event_id).push(b) } return [...m.values()] }
  const conclusi = eventi.filter(e => e.esito !== 'attesa').slice(-20).reverse()
  const nomePartita = (id) => bets.find(b => b.event_id === id)
  const box = { background: 'rgba(15,23,42,0.6)', border: '1px solid rgba(148,163,184,0.25)', borderRadius: 12, padding: '10px 12px', marginBottom: 10 }
  const btn = (bg) => ({ background: bg, color: 'white', border: 0, borderRadius: 8, padding: '4px 9px', fontWeight: 800, fontSize: 12, cursor: 'pointer', marginLeft: 4 })

  return (
    <div style={{ background: 'rgba(16,185,129,0.07)', border: '1px solid rgba(16,185,129,0.35)', borderRadius: 16, padding: '14px 16px', marginBottom: 16 }}>
      {!incorporato && (<div onClick={() => setAperto(!aperto)} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', cursor: 'pointer' }}>
        <div style={{ fontWeight: 900, color: '#6ee7b7' }}>🎯 Recuperi con PronoX · Masaniello pilota {stato ? `· ${euro(stato.capitale)} · ${stato.vinte}V ${stato.perse}P` : ''} {daFare.length ? <span style={{ color: '#fbbf24' }}>· {daFare.length} bet da fare</span> : null}</div>
        <div style={{ color: '#94a3b8' }}>{aperto ? '▲' : '▼'}</div>
      </div>)}
      {aperto && (carico ? <div style={{ color: '#94a3b8', marginTop: 8 }}>Carico piano, fotografie ed esiti…</div> : !stato ? <div style={{ color: '#fca5a5', marginTop: 8 }}>Piano non trovato: lancia recupero_pronox.sql in Supabase.</div> : (
        <div style={{ marginTop: 10 }}>
          {/* stato del piano */}
          <div style={{ ...box, display: 'flex', flexWrap: 'wrap', gap: 16, fontSize: 13, color: '#cbd5e1' }}>
            <span>Capitale <b>{euro(stato.capitale)}</b> (da {euro(stato.capitaleIniziale)})</span>
            <span>Obiettivo <b>{euro(stato.obiettivo)}</b></span>
            <span>Vincite mancanti <b>{stato.vinciteMancanti}</b> su <b>{stato.eventiRimasti}</b> eventi ({(stato.richiesta * 100).toFixed(1)}%)</span>
            <span>In attesa <b>{stato.inAttesa}</b> · nulle {stato.nulle}</span>
            <span>Conti disponibili <b>{conti.length}</b></span>
            <span style={{ color: '#94a3b8' }}>Stato: {stato.stato}</span>
          </div>
          {stato.avviso.livello !== 'ok' && (
            <div style={{ ...box, borderColor: stato.avviso.livello === 'rosso' ? '#ef4444' : '#f59e0b', color: stato.avviso.livello === 'rosso' ? '#fca5a5' : '#fcd34d' }}>
              {stato.avviso.livello === 'rosso' ? '🛑 ' : '⚠️ '}{stato.avviso.testo}
              {stato.avviso.livello === 'giallo' && stato.avviso.extraProposti > 0 && <button onClick={() => allunga(stato.avviso.extraProposti)} style={btn('#d97706')}>Allunga di {stato.avviso.extraProposti}</button>}
            </div>
          )}

          {/* proposta di Lucy */}
          {scheda.bets.length > 0 && (
            <div style={{ ...box, borderColor: 'rgba(16,185,129,0.5)' }}>
              <div style={{ fontWeight: 800, color: '#6ee7b7', marginBottom: 6 }}>💡 Lucy propone {scheda.bets.length} partite · {euro(scheda.bets.reduce((a, b) => a + b.puntata, 0))}</div>
              {scheda.bets.map(b => (
                <div key={b.event_id} style={{ fontSize: 12, color: '#cbd5e1', marginBottom: 6 }}>
                  <b>{quando(b.event_start)}</b> · {b.partita} · <b>{b.esito}</b> · prob {(b.prob * 100).toFixed(1)}% · quota min <b>{String(b.quotaMinima).replace('.', ',')}</b> · puntata <b>{euro(b.puntata)}</b>
                  <div style={{ color: '#94a3b8' }}>{b.pezzi.map(z => `${z.nome} · ${z.intestatario} ${euro(z.importo)}${z.tipo === 'sport' ? ' (sport)' : ''}`).join('  |  ')}</div>
                  {b.nonCollocato > 0 && <div style={{ color: '#fca5a5' }}>⚠️ {euro(b.nonCollocato)} non collocati: conti al tetto settimanale</div>}
                </div>
              ))}
              <button disabled={lavoro} onClick={confermaScheda} style={btn('#059669')}>✓ Conferma scheda</button>
            </div>
          )}
          {scheda.bets.length === 0 && !daFare.length && <div style={{ ...box, color: '#94a3b8', fontSize: 13 }}>Nessuna partita PronoX nella fascia 1,40-1,60 nelle prossime 48 ore.</div>}

          {/* bet da fare */}
          {perPartita(daFare).map(gr => (
            <div key={gr[0].event_id} style={box}>
              <div style={{ fontSize: 13, color: '#e2e8f0', marginBottom: 4 }}><b>{quando(gr[0].event_start)}</b> · {gr[0].partita} · <b>{gr[0].esito_label}</b> · quota min <b>{String(gr[0].quota_minima).replace('.', ',')}</b></div>
              {gr.map(b => (
                <div key={b.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: 12, color: '#cbd5e1', padding: '3px 0' }}>
                  <span>{b.book_nome} · {b.intestatario} · <b>{euro(b.importo)}</b>{b.tipo === 'sport' ? ' (sport)' : ''}</span>
                  <span>
                    <button onClick={() => apriSuTelefoni(b.book_nome, sitoBook(bookDi(b)), [b.intestatario])} title="Apri sul suo telefono" style={btn('#0ea5e9')}>📱</button>
                    <button onClick={() => piazzata(b)} style={btn('#059669')}>✓</button>
                    <button onClick={() => saltata(b)} style={btn('#64748b')}>✗</button>
                  </span>
                </div>
              ))}
            </div>
          ))}
          {scadute.length > 0 && <div style={{ ...box, color: '#94a3b8', fontSize: 12 }}>⏱️ {scadute.length} bet non piazzate prima del fischio d'inizio: non contano nel piano.</div>}

          {/* ultimi esiti */}
          {conclusi.length > 0 && (
            <div style={box}>
              <div style={{ fontWeight: 800, color: '#cbd5e1', marginBottom: 4 }}>Ultimi esiti</div>
              {conclusi.map(e => { const b = nomePartita(e.event_id); const diff = e.incasso - e.puntata; return (
                <div key={e.event_id} style={{ fontSize: 12, color: '#cbd5e1' }}>
                  {e.esito === 'vinta' ? '✅' : e.esito === 'persa' ? '❌' : '➖'} {b?.partita} · {b?.esito_label} · puntata {euro(e.puntata)} · <b style={{ color: diff >= 0 ? '#6ee7b7' : '#fca5a5' }}>{diff >= 0 ? '+' : ''}{euro(diff)}</b>
                </div>) })}
            </div>
          )}
          <button onClick={carica} style={btn('#334155')}>↻ Aggiorna</button>
        </div>
      ))}
    </div>
  )
}
