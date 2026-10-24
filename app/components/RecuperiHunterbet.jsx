"use client";
// ════════════════════════════════════════════════════════════════════
// RECUPERI CON HUNTERBET PRE-LIVE · Masaniello (23/10/2026)
// Stesso schema del pilota PronoX (RecuperiPronox.jsx), ma le partite sono i segnali Pre-live
// «12 + MG 1-3» di Hunterbet. Nasce SPENTO: lo accende Sergio col tasto in alto.
//   ▸ capitale 500 €, 30 vincite su 50 partite, quota di riferimento 1,60, stop a −200 €
//   ▸ tutte le pre-live che arrivano (dal 24/10/2026); si gioca solo se la quota trovata è ≥ 1,60
//   ▸ per ogni bet: 📱 apre il book · ✓ piazzata (quota reale) · ✗ saltata
//   ▸ l'esito arriva da solo (il programma sul PC scrive il risultato, il sito chiude vinta/persa)
// Tabelle: recupero_hb_piano, recupero_hb_bets (supabase/recupero_hunterbet.sql). Calcoli: lib/recupero/masanielloHunterbet.js
// ════════════════════════════════════════════════════════════════════
import React, { useState, useEffect, useMemo, useCallback } from 'react'
import { supabase } from '../profit-tracker/supabaseClient'
import { dividiTraConti } from '../../lib/recupero/masanielloRecupero'
import { PIANO_HB, schedaHB, eventiHB } from '../../lib/recupero/masanielloHunterbet'
import { contiPerRecupero, usoConti } from './RecuperiPronox'

const euro = (n) => (Number(n) || 0).toLocaleString('it-IT', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + ' €'
const quando = (iso) => new Date(iso).toLocaleString('it-IT', { timeZone: 'Europe/Rome', weekday: 'short', day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })
const virg = (n) => Number(n).toFixed(2).replace('.', ',')

// Scelta libera di UN conto (per giocare tutto da un solo telefono): cerca per nome del book o del cliente
function SceltaConto({ books, onScegli, onAnnulla, btn }) {
  const [q, setQ] = useState('')
  const norm = (x) => String(x || '').toLowerCase()
  const trovati = (books || []).filter(b => !norm(b.note).includes('chiuso') && norm(`${b.nome} ${b.intestatario}`).includes(norm(q).trim())).slice(0, 8)
  return (
    <div style={{ background: 'rgba(15,23,42,.8)', border: '1px solid #475569', borderRadius: 10, padding: 8, marginTop: 6 }}>
      <input autoFocus value={q} onChange={e => setQ(e.target.value)} placeholder="Cerca conto: nome del book o del cliente…" style={{ width: '100%', boxSizing: 'border-box', background: '#0f172a', color: '#e2e8f0', border: '1px solid #334155', borderRadius: 8, padding: '5px 8px', fontSize: 12 }} />
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4, marginTop: 6 }}>
        {trovati.map(b => <button key={b.id} onClick={() => onScegli(b)} style={btn('#0369a1')}>{b.nome} · {b.intestatario || '—'}</button>)}
        {!trovati.length && <span style={{ color: '#94a3b8', fontSize: 12 }}>Nessun conto trovato</span>}
        <button onClick={onAnnulla} style={btn('#64748b')}>Annulla</button>
      </div>
      <div style={{ color: '#94a3b8', fontSize: 11, marginTop: 4 }}>Il conto scelto da te non ha i controlli di Lucy (tetto settimanale, stato del recupero): decidi tu.</div>
    </div>
  )
}

const pianoDaDb = (p) => p ? { capitale: Number(p.capitale), N: Number(p.n_eventi), K: Number(p.k_vincite), quotaRif: Number(p.quota_rif), eventi_extra: Number(p.eventi_extra || 0), attivo: !!p.attivo, saltati: Array.isArray(p.saltati) ? p.saltati : [] } : null
const PIANO_NUOVO = { attivo: false, capitale: PIANO_HB.capitale, n_eventi: PIANO_HB.N, k_vincite: PIANO_HB.K, quota_rif: PIANO_HB.quotaRif, eventi_extra: 0, saltati: [] }

export default function RecuperiHunterbetPanel({ books, recuperi, getRecuperoProtocollo, sitoBook, apriSuTelefoni, onMessage, onError, apriContiSuTelefoni }) {
  const [piano, setPiano] = useState(null)       // riga del DB (null = non ancora creata)
  const [bets, setBets] = useState([])
  const [betPilota, setBetPilota] = useState([]) // bet del Masaniello PronoX: contano solo per il tetto settimanale dei conti
  const [segnali, setSegnali] = useState([])
  const [esiti, setEsiti] = useState(new Map())
  const [carico, setCarico] = useState(true)
  const [lavoro, setLavoro] = useState(false)
  const [mancaSql, setMancaSql] = useState(false)
  const [contoScelto, setContoScelto] = useState({})   // msg_id → conto scelto da te per giocare tutto lì (prima di confermare)
  const [sceglieOra, setSceglieOra] = useState(null)      // msg_id (proposta) o 'sposta|msg_id' (bet già confermate) per cui sto scegliendo il conto
  const msg = onMessage || (() => {}), err = onError || ((e) => console.error(e))

  const carica = useCallback(async () => {
    setCarico(true)
    try {
      const { data: p, error: e1 } = await supabase.from('recupero_hb_piano').select('*').maybeSingle()
      if (e1) { setMancaSql(true); throw new Error('recupero_hb_piano: lancia supabase/recupero_hunterbet.sql (' + e1.message + ')') }
      setMancaSql(false)
      const { data: b, error: e2 } = await supabase.from('recupero_hb_bets').select('*').order('event_start', { ascending: true })
      if (e2) throw new Error('recupero_hb_bets: ' + e2.message)
      const { data: bp } = await supabase.from('recupero_bets').select('book_id,event_start,importo,stato')
      // segnali recenti (ultime 24 ore) + esiti dei segnali già in piano
      const da = new Date(Date.now() - 24 * 3600000).toISOString()
      const { data: sg, error: e3 } = await supabase.from('hunterbet_segnali').select('msg_id,data_msg,competizione,casa,ospite,tipo_segnale,fase,esito,ft_casa,ft_ospite,stato_match,af_stato').gte('data_msg', da).order('data_msg', { ascending: true }).limit(500)
      if (e3) throw new Error('segnali Hunterbet: ' + e3.message)
      const ids = [...new Set((b || []).map(x => x.msg_id))]
      const mappa = new Map()
      for (let i = 0; i < ids.length; i += 100) {
        const { data, error } = await supabase.from('hunterbet_segnali').select('msg_id,esito').in('msg_id', ids.slice(i, i + 100))
        if (error) throw new Error('esiti: ' + error.message)
        for (const o of data || []) if (o.esito) mappa.set(String(o.msg_id), o.esito)
      }
      setPiano(p); setBets(b || []); setBetPilota(bp || []); setSegnali(sg || []); setEsiti(mappa)
    } catch (e) { err(String(e.message || e)) }
    setCarico(false)
  }, [])
  useEffect(() => { carica() }, [carica])

  const conti = useMemo(() => contiPerRecupero(books, recuperi, getRecuperoProtocollo), [books, recuperi, getRecuperoProtocollo])
  const eventi = useMemo(() => eventiHB(bets, esiti), [bets, esiti])
  const { uso, ultima } = useMemo(() => usoConti([...bets, ...betPilota]), [bets, betPilota])
  const pianoDb = pianoDaDb(piano || PIANO_NUOVO)
  const scheda = useMemo(() => schedaHB({ pianoDb, eventi, segnali, conti, usoSettimana: uso, ultimaBet: ultima, bets }), [piano, eventi, segnali, conti, uso, ultima, bets])
  const stato = scheda.stato
  const bookDi = (b) => (books || []).find(x => String(x.id) === String(b.book_id)) || { id: b.book_id, nome: b.book_nome || b.nome, intestatario: b.intestatario }

  // ─── azioni ─────────────────────────────────────────────────────────
  async function assicuraPiano() {
    if (piano) return piano
    const { data, error } = await supabase.from('recupero_hb_piano').insert({ ...PIANO_NUOVO }).select('*').single()
    if (error) throw new Error(error.message)
    setPiano(data); return data
  }
  async function accendi(si) {
    const testo = si
      ? `Accendo il Masaniello Hunterbet Pre-live?\n\nCapitale ${euro(PIANO_HB.capitale)}, ${PIANO_HB.K} vincite su ${PIANO_HB.N} partite, quota di riferimento ${virg(PIANO_HB.quotaRif)}, stop a −${PIANO_HB.perditaMax} €.\nDa adesso Lucy propone tutte le partite pre-live che arrivano.`
      : 'Spengo il piano? Le bet già fatte restano e si chiudono, ma Lucy non propone più partite nuove.'
    if (!window.confirm(testo)) return
    setLavoro(true)
    try {
      const p = await assicuraPiano()
      const { error } = await supabase.from('recupero_hb_piano').update({ attivo: si, aggiornato: new Date().toISOString() }).eq('id', p.id)
      if (error) throw new Error(error.message)
      msg(si ? '✅ Masaniello Hunterbet acceso' : '⏸ Masaniello Hunterbet spento')
      await carica()
    } catch (e) { err(String(e.message || e)) }
    setLavoro(false)
  }
  async function confermaScheda() {
    if (!scheda.bets.length) return
    const rows = []
    for (const bet0 of scheda.bets) {
      const c = contoScelto[bet0.msg_id]
      const bet = c ? { ...bet0, pezzi: [{ book_id: c.id, nome: c.nome, intestatario: c.intestatario || '', tipo: 'libero', importo: bet0.puntata }] } : bet0
      for (const z of bet.pezzi) rows.push({
      msg_id: bet.msg_id, event_start: bet.event_start, partita: bet.partita, competizione: bet.competition, tipo_segnale: '12 + MG 1-3',
      book_id: String(z.book_id), book_nome: z.nome, intestatario: z.intestatario, tipo: z.tipo, importo: z.importo,
      puntata_evento: bet.puntata, quota_minima: bet.quotaMinima,
    })
    }
    if (!rows.length) return err('Nessun conto libero per questa puntata: non posso confermare la scheda')
    if (!window.confirm(`Confermo la scheda: ${scheda.bets.length} partita, ${rows.length} bet, ${euro(scheda.bets.reduce((a, b) => a + b.puntata, 0))}?`)) return
    setLavoro(true)
    const { error } = await supabase.from('recupero_hb_bets').insert(rows)
    setLavoro(false)
    if (error) return err('Scheda non salvata: ' + error.message)
    msg(`✅ Scheda confermata: ${rows.length} bet da piazzare`)
    carica()
  }
  async function nonGioco(msgId) {
    if (!window.confirm('Non giochi questa partita? Lucy passa al prossimo segnale (se ce n\'è uno).')) return
    setLavoro(true)
    try {
      const p = await assicuraPiano()
      const saltati = [...new Set([...(Array.isArray(p.saltati) ? p.saltati : []), String(msgId)])]
      const { error } = await supabase.from('recupero_hb_piano').update({ saltati }).eq('id', p.id)
      if (error) throw new Error(error.message)
      await carica()
    } catch (e) { err(String(e.message || e)) }
    setLavoro(false)
  }
  async function piazzata(b) {
    const t = window.prompt(`Quota reale presa su ${b.book_nome} (${b.intestatario})?\nQuota minima: ${virg(b.quota_minima)}`, virg(b.quota_minima))
    if (t === null) return
    const q = parseFloat(String(t).replace(',', '.'))
    if (!Number.isFinite(q) || q <= 1 || q >= 100) return err('Quota non valida')
    if (q < Number(b.quota_minima) && !window.confirm(`La quota ${virg(q)} è sotto la minima (${virg(b.quota_minima)}): il valore atteso è negativo. La segno comunque?`)) return
    const { error } = await supabase.from('recupero_hb_bets').update({ stato: 'piazzata', quota_reale: q, piazzata_at: new Date().toISOString() }).eq('id', b.id)
    if (error) return err(error.message)
    const nuove = bets.map(x => x.id === b.id ? { ...x, stato: 'piazzata', quota_reale: q } : x)
    setBets(nuove)
    salvaQuotaSegnale(b.msg_id, nuove)
  }
  // la quota che scrivi qui finisce anche nella colonna «Quota» dei Segnali (e spunta «Giocata»): media pesata sugli importi delle bet piazzate di quella partita
  async function salvaQuotaSegnale(msgId, lista) {
    const pz = lista.filter(x => String(x.msg_id) === String(msgId) && x.stato === 'piazzata' && Number(x.quota_reale) > 1)
    const tot = pz.reduce((a, x) => a + Number(x.importo), 0)
    if (!tot) return
    const media = Math.round(pz.reduce((a, x) => a + Number(x.importo) * Number(x.quota_reale), 0) / tot * 100) / 100
    try {
      const r = await fetch('/api/segnali/hunterbet-esito', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ msg_id: msgId, patch: { quota: media, giocata: true } }) })
      if (!r.ok) { const j = await r.json().catch(() => ({})); err('Quota non riportata nei Segnali: ' + (/giocata/i.test(j.error || '') ? 'lancia hunterbet_quota_giocata.sql in Supabase' : (j.error || r.status))) }
      else msg(`Quota media ${virg(media)} riportata nei Segnali`)
    } catch (e) { err('Quota non riportata nei Segnali: ' + String(e.message || e)) }
  }
  // sposta TUTTA la puntata di una partita (bet ancora da fare) su un solo conto scelto da te
  async function spostaTutto(gr, conto) {
    const tot = gr.reduce((a, x) => a + Number(x.importo), 0)
    if (!window.confirm(`Sposto tutta la puntata (${euro(tot)}) su ${conto.nome} · ${conto.intestatario || '—'}? Le ${gr.length} bet attuali vengono annullate.`)) return
    setLavoro(true)
    try {
      const ids = gr.map(x => x.id)
      for (const id of ids) { const { error } = await supabase.from('recupero_hb_bets').update({ stato: 'saltata' }).eq('id', id); if (error) throw new Error(error.message) }
      const g0 = gr[0]
      const { error: e2 } = await supabase.from('recupero_hb_bets').insert([{ msg_id: g0.msg_id, event_start: g0.event_start, partita: g0.partita, competizione: g0.competizione, tipo_segnale: g0.tipo_segnale, puntata_evento: g0.puntata_evento, quota_minima: g0.quota_minima, book_id: String(conto.id), book_nome: conto.nome, intestatario: conto.intestatario || '', tipo: 'libero', importo: tot }])
      if (e2) throw new Error(e2.message)
      setSceglieOra(null); msg(`✅ Puntata spostata su ${conto.nome}`); await carica()
    } catch (e) { err(String(e.message || e)) }
    setLavoro(false)
  }
  async function saltata(b) {
    if (!window.confirm(`Segno come SALTATA la bet di ${euro(b.importo)} su ${b.book_nome} (${b.intestatario})?`)) return
    const { error } = await supabase.from('recupero_hb_bets').update({ stato: 'saltata' }).eq('id', b.id)
    if (error) return err(error.message)
    const nuove = bets.map(x => x.id === b.id ? { ...x, stato: 'saltata' } : x)
    setBets(nuove)
    if (new Date(b.event_start).getTime() <= Date.now()) return
    const giaUsati = new Set(bets.filter(x => x.msg_id === b.msg_id).map(x => String(x.book_id)))
    const { uso: u, ultima: ul } = usoConti([...nuove, ...betPilota])
    const { pezzi } = dividiTraConti(Number(b.importo), { event_id: b.msg_id + '|r' }, conti, u, ul, { giaUsati })
    if (!pezzi.length) return msg('Nessun altro conto libero per questa bet: resta saltata')
    const testo = pezzi.map(z => `${z.nome} · ${z.intestatario} · ${euro(z.importo)}`).join('\n')
    if (!window.confirm(`Lucy propone di spostarla su:\n${testo}\nConfermi?`)) return
    const rows = pezzi.map(z => ({ msg_id: b.msg_id, event_start: b.event_start, partita: b.partita, competizione: b.competizione, tipo_segnale: b.tipo_segnale, puntata_evento: b.puntata_evento, quota_minima: b.quota_minima, book_id: String(z.book_id), book_nome: z.nome, intestatario: z.intestatario, tipo: z.tipo, importo: z.importo }))
    const { error: e2 } = await supabase.from('recupero_hb_bets').insert(rows)
    if (e2) return err(e2.message)
    carica()
  }

  // 🔔 notifiche del browser (quelle di Windows): si abilitano una volta sola
  const [notifiche, setNotifiche] = useState(() => { try { return typeof Notification === 'undefined' ? 'no' : Notification.permission } catch { return 'no' } })
  async function attivaNotifiche() {
    try {
      const r = await Notification.requestPermission(); setNotifiche(r)
      if (r === 'granted') { try { new Notification('🎯 Notifiche attive', { body: 'Così ti avviso quando arriva una partita Hunterbet da giocare.' }) } catch { /* notifica di prova non mostrata */ } msg('🔔 Notifiche attivate') }
      else err('Notifiche non attivate: abilitale dal lucchetto accanto all\'indirizzo del sito (Impostazioni sito → Notifiche → Consenti)')
    } catch (e) { err('Notifiche non supportate da questo browser') }
  }

  // 📞 prova della telefonata: chiama subito il tuo numero con una partita di finta (stesso testo e stessi limiti: 5 al giorno, 4 minuti tra una e l'altra)
  async function provaChiamata() {
    if (!window.confirm('Faccio partire ADESSO una telefonata di prova al tuo cellulare (costa pochi centesimi se rispondi)?')) return
    setLavoro(true)
    try {
      const r = await fetch('/api/avvisi/chiamata', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ partita: 'Prova Casa – Prova Ospite', inizio: new Date(Date.now() + 3600000).toISOString() }) })
      const j = await r.json().catch(() => ({}))
      if (r.ok && j.ok) msg('📞 Chiamata partita: tra qualche secondo ti squilla il telefono')
      else if (r.status === 503) err('Telefonata non configurata: mancano le variabili Twilio su Vercel (o manca il Redeploy)')
      else err('Chiamata non partita: ' + (j.error || r.status))
    } catch (e) { err('Chiamata non partita: ' + String(e.message || e)) }
    setLavoro(false)
  }

  // ─── viste ──────────────────────────────────────────────────────────
  const ora = Date.now()
  const daFare = bets.filter(b => b.stato === 'da_fare' && ora - new Date(b.creato || ora).getTime() < 18 * 3600000)
  const scadute = bets.filter(b => b.stato === 'da_fare' && ora - new Date(b.creato || ora).getTime() >= 18 * 3600000)
  const perPartita = (lista) => { const m = new Map(); for (const b of lista) { const k = String(b.msg_id); if (!m.has(k)) m.set(k, []); m.get(k).push(b) } return [...m.values()] }
  const nomePartita = (id) => bets.find(b => String(b.msg_id) === String(id))
  const sviluppo = (() => {
    let cap = Number(stato?.capitaleIniziale ?? PIANO_HB.capitale)
    return eventi.map(e => {
      const b0 = nomePartita(e.event_id)
      const piazz = bets.filter(b => String(b.msg_id) === String(e.event_id) && b.stato === 'piazzata')
      const tot = piazz.reduce((a, b) => a + Number(b.importo), 0)
      const quota = tot > 0 ? piazz.reduce((a, b) => a + Number(b.importo) * Number(b.quota_reale || 0), 0) / tot : null
      const chiusa = e.esito !== 'attesa'
      const diff = chiusa ? e.incasso - e.puntata : null
      if (chiusa && e.esito !== 'nulla') cap += diff
      return { e, b0, quota, diff, cap: chiusa ? cap : null }
    })
  })()
  const box = { background: 'rgba(15,23,42,0.6)', border: '1px solid rgba(148,163,184,0.25)', borderRadius: 12, padding: '10px 12px', marginBottom: 10 }
  const btn = (bg) => ({ background: bg, color: 'white', border: 0, borderRadius: 8, padding: '4px 9px', fontWeight: 800, fontSize: 12, cursor: 'pointer', marginLeft: 4 })
  const spento = !piano?.attivo

  return (
    <div style={{ background: 'rgba(56,189,248,0.07)', border: '1px solid rgba(56,189,248,0.35)', borderRadius: 16, padding: '14px 16px', marginBottom: 16 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
        <div style={{ fontWeight: 900, color: '#7dd3fc' }}>🎯 Masaniello Hunterbet Pre-live {stato ? `· ${euro(stato.capitale)} · ${stato.vinte}V ${stato.perse}P` : ''} {daFare.length ? <span style={{ color: '#fbbf24' }}>· {daFare.length} bet da fare</span> : null}</div>
        <button disabled={lavoro || carico || mancaSql} onClick={() => accendi(spento)} style={btn(spento ? '#059669' : '#64748b')}>{spento ? '▶ Accendi il piano' : '⏸ Spegni il piano'}</button>
      </div>

      {spento && !carico && !mancaSql && <div style={{ background: 'rgba(251,191,36,.12)', border: '1px solid #b45309', borderRadius: 10, padding: '6px 10px', margin: '8px 0', fontSize: 12, color: '#fcd34d', fontWeight: 800 }}>⏸ Piano SPENTO: nessuna partita proposta finché non lo accendi. Regole: {euro(PIANO_HB.capitale)}, {PIANO_HB.K} vincite su {PIANO_HB.N}, quota di riferimento {virg(PIANO_HB.quotaRif)}, tutte le pre-live che arrivano, stop a −{PIANO_HB.perditaMax} €.</div>}
      {mancaSql && !carico && <div style={{ color: '#fca5a5', marginTop: 8 }}>Tabelle non trovate: lancia supabase/recupero_hunterbet.sql nel SQL Editor di Supabase, poi aggiorna la pagina.</div>}

      {carico ? <div style={{ color: '#94a3b8', marginTop: 8 }}>Carico piano, segnali ed esiti…</div> : !mancaSql && (
        <div style={{ marginTop: 10 }}>
          <div style={{ ...box, display: 'flex', flexWrap: 'wrap', gap: 16, fontSize: 13, color: '#cbd5e1' }}>
            <span>Capitale <b>{euro(stato.capitale)}</b> (da {euro(stato.capitaleIniziale)})</span>
            <span>Obiettivo <b>{euro(stato.obiettivo)}</b></span>
            <span>Vincite mancanti <b>{stato.vinciteMancanti}</b> su <b>{stato.eventiRimasti}</b> partite ({(stato.richiesta * 100).toFixed(1)}%)</span>
            <span>In attesa <b>{stato.inAttesa}</b> · nulle {stato.nulle}</span>
            <span>Conti disponibili <b>{conti.length}</b></span>
            <span style={{ color: '#94a3b8' }}>Stato: {stato.stato}</span>
          </div>
          {stato.avviso.livello !== 'ok' && (
            <div style={{ ...box, borderColor: stato.avviso.livello === 'rosso' ? '#ef4444' : '#f59e0b', color: stato.avviso.livello === 'rosso' ? '#fca5a5' : '#fcd34d' }}>
              {stato.avviso.livello === 'rosso' ? '🛑 ' : '⚠️ '}{stato.avviso.testo}
            </div>
          )}
          {scheda.chiusoDiFatto && <div style={{ ...box, color: '#cbd5e1', fontSize: 12 }}>ℹ️ La puntata richiesta dal Masaniello è sotto i 2 €: nessun conto può giocarla, il piano è praticamente chiuso. Valuta se fermarlo.</div>}

          {/* proposta */}
          {scheda.bets.length > 0 && (
            <div style={{ ...box, borderColor: 'rgba(56,189,248,0.5)' }}>
              <div style={{ fontWeight: 800, color: '#7dd3fc', marginBottom: 6 }}>💡 Lucy propone {scheda.bets.length} partita · {euro(scheda.bets.reduce((a, b) => a + b.puntata, 0))}</div>
              {scheda.bets.map(b => (
                <div key={b.msg_id} style={{ fontSize: 12, color: '#cbd5e1', marginBottom: 6 }}>
                  <span style={{ color: '#94a3b8' }}>segnale di <b>{quando(b.event_start)}</b></span> · {b.partita} · <b>{b.esito}</b> · quota min <b>{virg(b.quotaMinima)}</b> · puntata <b>{euro(b.puntata)}</b>
                  {b.limitataDalTetto && <div style={{ color: '#fcd34d' }}>⚠️ Il Masaniello chiederebbe {euro(b.puntataMasaniello)}: limitata a {euro(b.puntata)} per non superare la perdita massima di {PIANO_HB.perditaMax} €.</div>}
                  <div style={{ color: '#94a3b8', display: 'flex', flexWrap: 'wrap', gap: '4px 10px', alignItems: 'center', marginTop: 3 }}>
                    {apriContiSuTelefoni && b.pezzi.length > 1 && <button onClick={() => apriContiSuTelefoni(b.pezzi.map(z => bookDi(z)), `${b.partita} (${b.pezzi.length} conti)`)} style={btn('#0ea5e9')}>📱 Apri tutti ({b.pezzi.length})</button>}
                    {b.pezzi.map(z => (
                      <span key={z.book_id} onClick={() => apriSuTelefoni(z.nome, sitoBook(bookDi(z)), [z.intestatario])} title="Clic: apri questo book sul suo telefono" style={{ cursor: 'pointer', textDecoration: 'underline dotted' }}>
                        📱 {z.nome} · {z.intestatario} {euro(z.importo)}{z.tipo === 'sport' ? ' (sport)' : ''}
                      </span>))}
                  </div>
                  {b.nonCollocato > 0 && <div style={{ color: '#fca5a5' }}>⚠️ {euro(b.nonCollocato)} non collocati: conti al tetto settimanale</div>}
                  <div style={{ marginTop: 4 }}>
                    <button disabled={lavoro || !b.pezzi.length} onClick={confermaScheda} style={btn('#059669')}>✓ Conferma scheda</button>
                    <button disabled={lavoro} onClick={() => nonGioco(b.msg_id)} style={btn('#64748b')}>✗ Non gioco questa</button>
                    <button disabled={lavoro} onClick={() => setSceglieOra(b.msg_id)} style={btn('#0369a1')}>🔀 Gioca tutto su un altro conto</button>
                    {contoScelto[b.msg_id] && <button disabled={lavoro} onClick={() => setContoScelto(p => { const n = { ...p }; delete n[b.msg_id]; return n })} style={btn('#475569')}>↩ Torna ai conti di Lucy</button>}
                  </div>
                  {contoScelto[b.msg_id] && <div style={{ color: '#7dd3fc', marginTop: 4 }}>✔ Tutta la puntata ({euro(b.puntata)}) sarà giocata su <b>{contoScelto[b.msg_id].nome} · {contoScelto[b.msg_id].intestatario || '—'}</b></div>}
                  {sceglieOra === b.msg_id && <SceltaConto books={books} btn={btn} onAnnulla={() => setSceglieOra(null)} onScegli={(c) => { setContoScelto(p => ({ ...p, [b.msg_id]: c })); setSceglieOra(null) }} />}
                </div>
              ))}
            </div>
          )}
          {!spento && scheda.bets.length === 0 && !daFare.length && !scheda.chiusoDiFatto && <div style={{ ...box, color: '#94a3b8', fontSize: 13 }}>Nessun segnale Pre-live «12 + MG 1-3» disponibile adesso (oggi la partita è già assegnata, oppure non ne sono arrivati di giocabili).</div>}

          {/* bet da fare */}
          {perPartita(daFare).map(gr => (
            <div key={gr[0].msg_id} style={box}>
              <div style={{ fontSize: 13, color: '#e2e8f0', marginBottom: 4, display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
                <span><span style={{ color: '#94a3b8' }}>segnale di <b>{quando(gr[0].event_start)}</b></span> · {gr[0].partita} · <b>12 + Multigol 1-3</b> · quota min <b>{virg(gr[0].quota_minima)}</b></span>
                {apriContiSuTelefoni && gr.length > 1 && <button onClick={() => apriContiSuTelefoni(gr.map(b => bookDi(b)), `${gr[0].partita} (${gr.length} conti)`)} style={btn('#0ea5e9')}>📱 Apri tutti ({gr.length})</button>}
                <button disabled={lavoro} onClick={() => setSceglieOra('sposta|' + gr[0].msg_id)} style={btn('#0369a1')}>🔀 Sposta tutto su un altro conto</button>
              </div>
              {sceglieOra === 'sposta|' + gr[0].msg_id && <SceltaConto books={books} btn={btn} onAnnulla={() => setSceglieOra(null)} onScegli={(c) => spostaTutto(gr, c)} />}
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
          {scadute.length > 0 && <div style={{ ...box, color: '#94a3b8', fontSize: 12 }}>⏱️ {scadute.length} bet non piazzate entro 18 ore: non contano nel piano.</div>}

          {sviluppo.length > 0 && (
            <details style={box}>
              <summary style={{ fontWeight: 800, color: '#cbd5e1', cursor: 'pointer' }}>📈 Sviluppo del Masaniello · {sviluppo.length} partite · {stato.vinte}V {stato.perse}P{stato.nulle ? ` ${stato.nulle}N` : ''} · capitale {euro(stato.capitale)}</summary>
              <div style={{ overflowX: 'auto', marginTop: 6 }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12, color: '#e2e8f0' }}>
                  <thead><tr style={{ color: '#94a3b8', textAlign: 'left' }}>
                    {['Segnale del', 'Partita', 'Quota', 'Importo', 'Esito', '+/−', 'Capitale'].map(h => <th key={h} style={{ padding: '3px 6px', borderBottom: '1px solid #334155', whiteSpace: 'nowrap' }}>{h}</th>)}
                  </tr></thead>
                  <tbody>
                    {sviluppo.map(({ e, b0, quota, diff, cap }) => (
                      <tr key={e.event_id}>
                        <td style={{ padding: '3px 6px', whiteSpace: 'nowrap' }}>{quando(e.event_start)}</td>
                        <td style={{ padding: '3px 6px' }}>{b0?.partita}</td>
                        <td style={{ padding: '3px 6px' }}>{quota ? quota.toFixed(2).replace('.', ',') : '—'}</td>
                        <td style={{ padding: '3px 6px', whiteSpace: 'nowrap' }}>{euro(e.puntata)}</td>
                        <td style={{ padding: '3px 6px' }}>{e.esito === 'vinta' ? '✅ vinta' : e.esito === 'persa' ? '❌ persa' : e.esito === 'nulla' ? '➖ rimborsata' : '⏳ in attesa'}</td>
                        <td style={{ padding: '3px 6px', whiteSpace: 'nowrap', color: diff == null ? '#94a3b8' : diff >= 0 ? '#6ee7b7' : '#fca5a5', fontWeight: 800 }}>{diff == null ? '—' : `${diff >= 0 ? '+' : ''}${euro(diff)}`}</td>
                        <td style={{ padding: '3px 6px', whiteSpace: 'nowrap' }}>{cap == null ? '—' : euro(cap)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </details>
          )}
          <button onClick={carica} style={btn('#334155')}>↻ Aggiorna</button>
          <button disabled={lavoro} onClick={provaChiamata} style={btn('#7c3aed')}>📞 Prova la telefonata</button>
          {notifiche === 'default' && <button onClick={attivaNotifiche} style={btn('#0ea5e9')}>🔔 Attiva notifiche</button>}
          {notifiche === 'granted' && <span style={{ marginLeft: 8, fontSize: 12, color: '#6ee7b7' }}>🔔 notifiche attive</span>}
          {notifiche === 'denied' && <span style={{ marginLeft: 8, fontSize: 12, color: '#fcd34d' }}>🔕 notifiche bloccate dal browser: sblocca dal lucchetto accanto all'indirizzo (Notifiche → Consenti)</span>}
        </div>
      )}
    </div>
  )
}
