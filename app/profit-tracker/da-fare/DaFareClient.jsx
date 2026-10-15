"use client";
// ════════════════════════════════════════════════════════════════════
// OGGI DA FARE (14/10/2026)
// Tutto ciò che c'è da fare oggi in un'unica pagina, per sezione, con ✓ Fatto e ⏭ Rimanda (con la data).
// Le voci non si copiano: vengono ricalcolate dalle fonti che esistono già.
//   • Bet e incroci di Lucy, sessioni Live, conti da movimentare, avvisi, profilazioni mirate → fotografia che il Profit Tracker
//     salva nel browser (localStorage). Il tastino "Oggi da fare" fa partire anche "Prepara bet" se le bet di oggi non ci sono ancora.
//   • Masaniello di recupero → bet già confermate (recupero_bets) + scheda che Lucy propone (calcolata qui con la stessa funzione del pannello)
//   • Promo che scadono oggi → tabella promo_bonus, letta qui
//   • Le mail NON ci sono: si controllano dalla tab Lucy Mail
// Di nuovo salvato c'è solo lo stato: tabella oggi_da_fare_stato (supabase/oggi_da_fare.sql).
// "Fatto" qui è la lista di controllo di oggi: non scrive nelle tabelle di Lucy, degli avvisi o delle bet.
// Le voci già chiuse dal Profit Tracker (bet confermate, bet del Masaniello piazzate) passano da sole in "Fatte"; una promo segnata nella tab Promo sparisce.
// ════════════════════════════════════════════════════════════════════
import React, { useCallback, useEffect, useMemo, useState } from 'react'
import { supabase } from '../supabaseClient'
import { ricordaPosizioneFinestra } from '../../../lib/finestraOggiDaFare'   // 14/10/2026: finestra separata, ricorda dove l'hai messa
import { costruisciLista, dataIso, domaniIso, dataIt, dataLunga, rinvioValido, aggiungiGiorni, vociMasaniello, vociSchedaMasaniello, vociPromo } from '../../../lib/oggiDaFare'
import { eventiDalleBet, usoConti } from '../../components/RecuperiPronox'
import { schedaDelGiorno } from '../../../lib/recupero/masanielloRecupero'
import { MODEL_VERSION } from '../../../lib/pronox/footballModel'

const CHIAVE_FOTO = 'profittracker_oggi_da_fare'
const APRI = {
  bet_mant: { dove: 'tabella_bet', testo: '📊 Apri la Tabella bet (con Apri telefoni)' },
  bet_prof: { dove: 'tabella_bet', testo: '📊 Apri la Tabella bet (con Apri telefoni)' },
  masaniello: { dove: 'tabella_bet', testo: '📊 Apri la Tabella bet (con Apri telefoni)' },
  profiliamo: { dove: 'profiliamo-oggi', testo: '📣 Profiliamo oggi' },
  conti: { dove: 'agenda', testo: "📋 Agenda di oggi" },
  live: { dove: 'tabella_live', testo: '🎰 Tabella Live' },
  mirate: { dove: 'mirate', testo: '🎯 Profilazioni mirate' },
}
const NOME_PARTE = { bet_mant: 'mantenimento', bet_prof: 'profilazione e recupero', masaniello: 'Masaniello', profiliamo: 'Profiliamo', conti: 'conti', live: 'Live', mirate: 'mirate' }

const CHIAVE_APRI = 'profittracker_oggi_apri'   // la pagina chiede al Profit Tracker di aprire una scheda (Tabella bet, Live, Masaniello...)
const CHIAVE_RICHIESTA = 'profittracker_oggi_richiesta'   // la pagina chiede al Profit Tracker di preparare le bet
const ETA_MAX_MIN = 30   // oltre questo tempo la fotografia del Profit Tracker si considera vecchia

const card = { border: '1px solid rgba(71,85,105,0.7)', borderRadius: 14, background: 'rgba(15,23,42,0.85)', marginBottom: 14, overflow: 'hidden' }
const btnBase = { border: '1px solid transparent', borderRadius: 9, padding: '8px 14px', fontWeight: 900, fontSize: 13, cursor: 'pointer' }

function leggiFoto() {
  try {
    const f = JSON.parse(localStorage.getItem(CHIAVE_FOTO) || 'null')
    return f && Array.isArray(f.voci) ? f : null
  } catch { return null }
}

export default function DaFareClient() {
  const [oggi, setOggi] = useState(() => dataIso())
  const [foto, setFoto] = useState(null)
  const [righe, setRighe] = useState([])
  const [dati, setDati] = useState(null)             // dati del Masaniello di recupero: { piano, bets, righe, esiti }
  const [promo, setPromo] = useState([])              // righe di promo_bonus che scadono oggi
  const [richiesta, setRichiesta] = useState(false)   // ho chiesto al Profit Tracker di preparare le bet
  const [errori, setErrori] = useState([])
  const [tabellaMancante, setTabellaMancante] = useState(false)
  const [caricamento, setCaricamento] = useState(true)
  const [salvando, setSalvando] = useState('')
  const [rinvio, setRinvio] = useState(null)        // { key, data }
  const [mostraFatte, setMostraFatte] = useState(false)
  const [ops, setOps] = useState([])                 // registro operazioni di profilazione (ultimi 30 giorni)
  const [betFatte, setBetFatte] = useState([])         // bet confermate negli ultimi 30 giorni (per lo storico del cliente)
  const [mostraRimandate, setMostraRimandate] = useState(true)
  const [ora, setOra] = useState(() => Date.now())

  const carica = useCallback(async () => {
    const giorno = dataIso()
    setOggi(giorno)
    setFoto(leggiFoto())
    setCaricamento(true)
    const err = []

    // 1. stato salvato: fatte di recente + tutte le rimandate
    try {
      const da = aggiungiGiorni(giorno, -30)
      const { data, error } = await supabase.from('oggi_da_fare_stato').select('*').or(`giorno.gte.${da},stato.eq.rimandato`)
      if (error) {
        if (/oggi_da_fare_stato|relation|schema cache/i.test(error.message || '')) setTabellaMancante(true)
        else err.push('Stato salvato: ' + error.message)
      } else { setTabellaMancante(false); setRighe(data || []) }
    } catch (e) { err.push('Stato salvato: ' + (e?.message || e)) }

    // 1b. registro delle operazioni di profilazione + bet confermate (storico per cliente)
    try {
      const da = aggiungiGiorni(giorno, -30)
      const r = await supabase.from('profilazione_operazioni').select('*').gte('giorno', da).order('giorno', { ascending: false })
      if (r.error) { if (!/profilazione_operazioni|relation|schema cache/i.test(r.error.message || '')) err.push('Registro operazioni: ' + r.error.message) } else setOps(r.data || [])
      const b = await supabase.from('lucy_bet_confermate').select('rec,data').gte('data', da).limit(3000)
      if (!b.error) setBetFatte((b.data || []).map(x => x.rec).filter(Boolean))
    } catch { /* storico non disponibile: la pagina funziona lo stesso */ }

    // 2. Masaniello di recupero: piano, tutte le bet, fotografie PronoX delle prossime 48 ore ed esiti (stesse letture del pannello Recuperi con PronoX)
    try {
      const { data: piano, error: e1 } = await supabase.from('recupero_piano').select('*').eq('id', 1).maybeSingle()
      if (e1) throw new Error('recupero_piano: ' + e1.message)
      const { data: bets, error: e2 } = await supabase.from('recupero_bets').select('*').order('event_start', { ascending: true })
      if (e2) throw new Error('recupero_bets: ' + e2.message)
      const da = new Date(Date.now() + 10 * 60000).toISOString(), a = new Date(Date.now() + 48 * 3600000).toISOString()
      const righe = []
      for (let from = 0; ; from += 1000) {
        const { data, error } = await supabase.from('prediction_snapshots')
          .select('event_id,event_start,competition,home_team,away_team,market,selection,model_version,model_prob')
          .gte('event_start', da).lte('event_start', a).like('model_version', `${MODEL_VERSION}_%`)
          .order('id', { ascending: true }).range(from, from + 999)
        if (error) throw new Error('fotografie PronoX: ' + error.message)
        righe.push(...(data || []))
        if (!data || data.length < 1000) break
      }
      const esiti = new Map()
      const ids = [...new Set((bets || []).map(x => x.event_id))]
      for (let i = 0; i < ids.length; i += 100) {
        const { data, error } = await supabase.from('selection_outcomes').select('event_id,market,selection,won').in('event_id', ids.slice(i, i + 100))
        if (error) throw new Error('esiti: ' + error.message)
        for (const o of data || []) esiti.set(`${o.event_id}|${o.market}|${o.selection}`, o.won)
      }
      setDati({ piano, bets: bets || [], righe, esiti })
    } catch (e) { err.push('Masaniello: ' + (e?.message || e)) }

    // 3. promo che scadono oggi e sono ancora da fare
    try {
      const { data, error } = await supabase.from('promo_bonus').select('id,cliente,book,tipo,bonus,scadenza,note,versamento,rollover,da_giocare').eq('stato', 'da fare').eq('scadenza', giorno)
      if (error) err.push('Promo: ' + error.message)
      else setPromo(data || [])
    } catch (e) { err.push('Promo: ' + (e?.message || e)) }

    setErrori(err)
    setCaricamento(false)
  }, [])

  useEffect(() => { carica() }, [carica])
  useEffect(() => ricordaPosizioneFinestra(), [])

  // la fotografia cambia quando lavori nel Profit Tracker in un'altra scheda; ogni minuto si aggiorna anche l'età
  useEffect(() => {
    const suStorage = (e) => { if (e.key === CHIAVE_FOTO || e.key === null) setFoto(leggiFoto()) }
    window.addEventListener('storage', suStorage)
    const t = setInterval(() => setOra(Date.now()), 60000)
    const suFocus = () => { setFoto(leggiFoto()); if (dataIso() !== oggi) carica() }
    window.addEventListener('focus', suFocus)
    return () => { window.removeEventListener('storage', suStorage); window.removeEventListener('focus', suFocus); clearInterval(t) }
  }, [oggi, carica])

  const fotoDiOggi = foto && foto.giorno === oggi ? foto : null
  const etaMin = fotoDiOggi?.aggiornato ? Math.max(0, Math.round((ora - new Date(fotoDiOggi.aggiornato).getTime()) / 60000)) : null

  // scheda di Masaniello che Lucy propone (non ancora confermata): stessa funzione e stessi dati del pannello Recuperi con PronoX
  const schedaMas = useMemo(() => {
    const conti = fotoDiOggi?.contiRecupero
    if (!dati?.piano || !Array.isArray(conti)) return null
    const p = dati.piano
    const pianoDb = { capitale: Number(p.capitale), N: Number(p.n_eventi), K: Number(p.k_vincite), quotaRif: Number(p.quota_rif), eventi_extra: Number(p.eventi_extra || 0) }
    try {
      const eventi = eventiDalleBet(dati.bets, dati.esiti)
      const { uso, ultima } = usoConti(dati.bets)
      return schedaDelGiorno({ pianoDb, eventi, righeSnapshot: dati.righe, conti, usoSettimana: uso, ultimaBet: ultima, giaInPiano: new Set(dati.bets.map(x => x.event_id)) })
    } catch (e) { return { errore: String(e?.message || e), bets: [] } }
  }, [dati, fotoDiOggi])

  const lista = useMemo(() => {
    const inizioOggi = new Date(oggi + 'T00:00:00').getTime()
    const voci = [
      ...vociPromo(promo, oggi),
      ...(fotoDiOggi?.voci || []),
      ...vociMasaniello(dati?.bets || [], ora, inizioOggi),
      ...vociSchedaMasaniello(schedaMas, ora),
    ]
    return costruisciLista({ voci, righe, oggi })
  }, [fotoDiOggi, dati, schedaMas, promo, righe, oggi, ora])

  // il Profit Tracker (altra scheda) legge questo numero per scriverlo sul tastino "Oggi da fare"
  useEffect(() => {
    if (caricamento || tabellaMancante) return
    try { localStorage.setItem('profittracker_oggi_conteggio', JSON.stringify({ giorno: oggi, n: lista.totali.daFare, aggiornato: new Date().toISOString() })) } catch { /* storage bloccato */ }
  }, [caricamento, tabellaMancante, lista, oggi])

  // Apre nel Profit Tracker la scheda vera (Tabella bet con "Apri telefoni", Live, PronoX...). Se il Profit Tracker è già aperto in un'altra scheda
  // si porta lì quella scheda (le bet di oggi stanno nella memoria di quella scheda); altrimenti lo apre e ci arriva da solo.
  function apriNelProfitTracker(dove) {
    try { localStorage.setItem(CHIAVE_APRI, JSON.stringify({ dove, t: Date.now() })) } catch { setErrori(prev => [...prev, 'Non riesco a contattare il Profit Tracker: aprilo a mano dalla Dashboard.']); return }
    let w = null
    try { w = window.open('', 'profittracker_main') } catch { w = null }
    try { if (w) w.focus() } catch { /* il browser non permette di portare avanti la scheda */ }
    try { if (w && w.location.href === 'about:blank') w.location.href = '/profit-tracker' } catch { /* scheda già aperta: ci pensa il Profit Tracker */ }
  }
  // schede da aprire per ogni parte della lista (null = resta una semplice lista con Fatto / Rimanda)
  function destinazioni(sez) {
    if (sez.id === 'bet') return [APRI.bet_mant]
    if (sez.id === 'conti_sessioni') {
      const visti = new Set()
      return sez.parti.map(x => ({ ...APRI[x.id], testo: `${APRI[x.id].testo} (${x.voci.length})` })).filter(d => !visti.has(d.dove) && visti.add(d.dove))
    }
    return null
  }
  const [espanse, setEspanse] = useState({})
  // Meno schede, meno tempo perso: tutte le bet vanno nella stessa Tabella bet; Profiliamo, conti, Live e mirate sono la "giornata di lavoro" sui conti
  const sezioniVista = useMemo(() => {
    const GRUPPI = [
      { id: 'bet', titolo: 'Bet da piazzare', icona: '📊', colore: '#38bdf8', ids: ['bet_mant', 'bet_prof', 'masaniello'] },
      { id: 'conti_sessioni', titolo: 'Conti, Profiliamo e sessioni di oggi', icona: '🗂️', colore: '#a78bfa', ids: ['profiliamo', 'conti', 'live', 'mirate'] },
    ]
    // le bet si comandano dalla Tabella bet: qui si vedono soltanto, con l'esito (fatta / saltata / rimandata) che arriva da lì
    const chiuse = lista.fatte.filter(v => GRUPPI[0].ids.includes(v.sezione)).map(v => ({ ...v, statoRO: /saltata/i.test(v.nota || '') ? 'saltata' : /rimandata/i.test(v.nota || '') ? 'rimandata' : 'fatta' }))
    const out = []
    const messi = new Set()
    const costruisci = (g, parti) => {
      const voci = parti.flatMap(y => y.voci)
      const base = { id: g.id, titolo: g.titolo, icona: g.icona, colore: g.colore, parti, voci }
      if (g.id !== 'bet') return { ...base, riepilogo: parti.map(y => `${y.voci.length} ${NOME_PARTE[y.id]}`).join(' · ') }
      const n = (st) => chiuse.filter(v => v.statoRO === st).length
      return { ...base, chiuse, riepilogo: `${voci.length} da fare · ✅ ${n('fatta')} fatte · ⏭ ${n('saltata')} saltate · 🔁 ${n('rimandata')} rimandate${parti.length ? ` — ${parti.map(y => `${y.voci.length} ${NOME_PARTE[y.id]}`).join(' · ')} ancora da fare` : ''}` }
    }
    for (const x of lista.sezioni) {
      const g = GRUPPI.find(gr => gr.ids.includes(x.id))
      if (!g) { out.push(x); continue }
      if (messi.has(g.id)) continue
      messi.add(g.id)
      out.push(costruisci(g, lista.sezioni.filter(y => g.ids.includes(y.id))))
    }
    if (!messi.has('bet') && chiuse.length) {   // tutte le bet sono già chiuse: la scheda resta, con i numeri
      const i = out.findIndex(x => x.id === 'conti_sessioni')
      out.splice(i < 0 ? out.length : i, 0, costruisci(GRUPPI[0], []))
    }
    return out
  }, [lista])
  const fatteAltre = useMemo(() => lista.fatte.filter(v => !['bet_mant', 'bet_prof', 'masaniello'].includes(v.sezione)), [lista])

  const statoBet = fotoDiOggi?.bet?.stato || null
  const betNonPronte = !fotoDiOggi || statoBet === 'in_corso' || statoBet === 'da_preparare'
  // se le bet non sono ancora state preparate le chiedo io, una sola volta (le quote passano dalla cache del server)
  useEffect(() => {
    if (statoBet === 'da_preparare' && !richiesta) {
      try { localStorage.setItem(CHIAVE_RICHIESTA, String(Date.now())); setRichiesta(true) } catch { /* storage bloccato: resta il pulsante manuale */ }
    }
  }, [statoBet, richiesta])
  function chiediPreparaBet() {
    try { localStorage.setItem(CHIAVE_RICHIESTA, String(Date.now())); setRichiesta(true) } catch { setErrori(prev => [...prev, 'Non riesco a contattare il Profit Tracker: apri la Dashboard e premi Prepara bet.']) }
  }

  // Registro delle operazioni di profilazione: ogni "Fatto" sulle righe Profiliamo diventa memoria per cliente
  const bookIdProfiliamo = (key) => { const p = String(key).split('|'); return p[0] === 'profiliamo' ? (p[1] === 'residuo' ? p[3] : p[2]) : null }
  async function registraOperazione(v, completa, residuo) {
    const bookId = bookIdProfiliamo(v.key)
    if (!bookId) return
    const [nome, ...resto] = String(v.titolo || '').split(' · ')
    const { data: u } = await supabase.auth.getUser()
    const riga = { user_id: u?.user?.id, chiave: v.key, book_id: String(bookId), book_nome: nome || null, intestatario: resto.join(' · ') || null, giorno: oggi, origine: 'profiliamo', azione: String(v.dettaglio || '').slice(0, 600), completa, residuo: residuo || null }
    const { data, error } = await supabase.from('profilazione_operazioni').upsert(riga, { onConflict: 'user_id,chiave' }).select().single()
    if (error) { setErrori(prev => [...prev, /profilazione_operazioni|relation|schema cache/i.test(error.message || '') ? 'Manca il registro delle operazioni: esegui supabase/profilazione_operazioni.sql nel SQL Editor di Supabase (il Fatto è stato salvato lo stesso nella lista).' : 'Registro operazioni: ' + error.message]); return }
    setOps(prev => [...prev.filter(x => x.chiave !== v.key), data])
  }
  async function togliOperazione(v) {
    if (!bookIdProfiliamo(v.key)) return
    const { error } = await supabase.from('profilazione_operazioni').delete().eq('chiave', v.key)
    if (!error) setOps(prev => prev.filter(x => x.chiave !== v.key))
  }
  // ½ Parziale: il cliente ha fatto solo una parte. Il passo di oggi si chiude, quello che manca slitta a domani e resta in lista finché non lo fa
  async function parziale(v) {
    const resto = window.prompt(`${v.titolo}\n\nCosa NON è stato fatto? (resta in lista e slitta a domani)`, '')
    if (resto === null || !resto.trim()) return
    setSalvando(v.key)
    try {
      const { data: u, error: eu } = await supabase.auth.getUser()
      if (eu || !u?.user?.id) throw new Error('utente non autenticato')
      const adesso = new Date().toISOString()
      const fatta = { user_id: u.user.id, chiave: v.key, stato: 'fatto', giorno: oggi, rimanda_a: null, sezione: v.sezione, titolo: v.titolo, dettaglio: v.dettaglio || null, tag: v.tag || null, aggiornato: adesso }
      const bookId = bookIdProfiliamo(v.key)
      const residua = { user_id: u.user.id, chiave: `profiliamo|residuo|${oggi}|${bookId}`, stato: 'rimandato', giorno: oggi, rimanda_a: domaniIso(oggi), sezione: 'profiliamo', titolo: v.titolo, dettaglio: `Rimasto da ieri: ${resto.trim()}`, tag: 'residuo', aggiornato: adesso }
      const { data, error } = await supabase.from('oggi_da_fare_stato').upsert([fatta, residua], { onConflict: 'user_id,chiave' }).select()
      if (error) throw error
      setRighe(prev => [...prev.filter(r => r.chiave !== fatta.chiave && r.chiave !== residua.chiave), ...(data || [])])
      await registraOperazione(v, false, resto.trim())
    } catch (e) { setErrori(prev => [...prev, 'Non salvato: ' + (e?.message || e)]) }
    setSalvando('')
  }
  // ultime operazioni di un cliente: registro + bet confermate (stessa fonte della Tabella bet)
  function storicoDi(bookId) {
    if (!bookId) return []
    const a = ops.filter(x => String(x.book_id) === String(bookId)).map(x => ({ giorno: x.giorno, testo: x.completa ? 'passo fatto' : `passo parziale · manca: ${x.residuo || '—'}`, chiave: x.chiave }))
    const b = betFatte.filter(x => String(x.bookId) === String(bookId)).map(x => ({ giorno: x.data, testo: `bet ${x.esito || ''} ${Number(x.stake || 0).toFixed(0)}€ confermata` }))
    return [...a.filter(x => x.chiave !== undefined), ...b].sort((x, y) => String(y.giorno).localeCompare(String(x.giorno))).slice(0, 3)
  }

  async function salva(v, stato, rimandaA) {
    setSalvando(v.key)
    try {
      const { data: u, error: eu } = await supabase.auth.getUser()
      if (eu || !u?.user?.id) throw new Error('utente non autenticato')
      const riga = { user_id: u.user.id, chiave: v.key, stato, giorno: oggi, rimanda_a: rimandaA || null, sezione: v.sezione, titolo: v.titolo, dettaglio: v.dettaglio || null, tag: v.tag || null, aggiornato: new Date().toISOString() }
      const { data, error } = await supabase.from('oggi_da_fare_stato').upsert(riga, { onConflict: 'user_id,chiave' }).select().single()
      if (error) throw error
      setRighe(prev => [...prev.filter(r => r.chiave !== v.key), data])
      setRinvio(null)
      if (stato === 'fatto') await registraOperazione(v, true)
    } catch (e) {
      setErrori(prev => [...prev, 'Non salvato: ' + (e?.message || e)])
    }
    setSalvando('')
  }

  async function togli(v) {
    setSalvando(v.key)
    try {
      const { error } = await supabase.from('oggi_da_fare_stato').delete().eq('chiave', v.key)
      if (error) throw error
      setRighe(prev => prev.filter(r => r.chiave !== v.key))
      await togliOperazione(v)
    } catch (e) {
      setErrori(prev => [...prev, 'Non annullato: ' + (e?.message || e)])
    }
    setSalvando('')
  }

  const puoSalvare = !tabellaMancante
  const t = lista.totali

  const chip = (testo, colore) => <span style={{ border: `1px solid ${colore}`, color: colore, borderRadius: 999, padding: '3px 11px', fontWeight: 800, fontSize: 12 }}>{testo}</span>

  // funzione di disegno (non un componente): così il campo data non perde il focus a ogni tasto
  function riga(v, tipo = 'fare') {
    const azioni = true
    const aperto = rinvio && rinvio.key === v.key
    const occupato = salvando === v.key
    return (
      <div style={{ padding: '10px 14px', borderTop: '1px solid rgba(51,65,85,0.6)' }}>
        <div style={{ display: 'flex', gap: 10, alignItems: 'flex-start', flexWrap: 'wrap' }}>
          <div style={{ flex: '1 1 260px', minWidth: 0 }}>
            <div style={{ fontWeight: 800, fontSize: 14, color: tipo === 'fatta' ? '#94a3b8' : '#f1f5f9', textDecoration: tipo === 'fatta' ? 'line-through' : 'none' }}>
              {v.tag ? <span style={{ background: 'rgba(100,116,139,0.25)', color: '#cbd5e1', borderRadius: 6, padding: '1px 7px', fontSize: 10.5, fontWeight: 800, marginRight: 7, textDecoration: 'none', display: 'inline-block' }}>{String(v.tag).toUpperCase()}</span> : null}
              {v.titolo}
            </div>
            {v.dettaglio ? <div style={{ fontSize: 12.5, color: '#94a3b8', marginTop: 2, lineHeight: 1.4 }}>{v.dettaglio}</div> : null}
            {v.sezione === 'promo' && v.promoCerca !== undefined ? (
              <div style={{ marginTop: 5 }}>
                {v.notaPromo
                  ? <div style={{ fontSize: 13, color: '#fde68a', background: 'rgba(250,204,21,0.08)', border: '1px solid rgba(250,204,21,0.3)', borderRadius: 8, padding: '5px 9px', lineHeight: 1.45, whiteSpace: 'pre-wrap' }}>📝 {v.notaPromo}</div>
                  : <div style={{ fontSize: 12, color: '#64748b', fontStyle: 'italic' }}>nessuna nota scritta in questa promo</div>}
                <a href={`/profit-tracker?tab=promo&cerca=${encodeURIComponent(v.promoCerca || '')}`} target="_blank" rel="noreferrer"
                  style={{ display: 'inline-block', marginTop: 5, fontSize: 12, fontWeight: 800, color: '#7dd3fc', textDecoration: 'none', border: '1px solid rgba(125,211,252,0.4)', borderRadius: 8, padding: '3px 9px' }}>🎁 Apri la promo</a>
              </div>
            ) : null}
            {bookIdProfiliamo(v.key) && storicoDi(bookIdProfiliamo(v.key)).length > 0 && <div style={{ fontSize: 11.5, color: '#64748b', marginTop: 3 }}>🕘 Ultime operazioni: {storicoDi(bookIdProfiliamo(v.key)).map(x => `${dataIt(x.giorno).slice(0, 5)} ${x.testo}`).join(' · ')}</div>}
            {v.rimandataDal ? <div style={{ fontSize: 11.5, color: '#fbbf24', marginTop: 3, fontWeight: 700 }}>⏭ rimandata il {dataIt(v.rimandataDal)}: torna oggi</div> : null}
            {tipo === 'fatta' && v.nota ? <div style={{ fontSize: 11.5, color: '#4ade80', marginTop: 3, fontWeight: 700 }}>✓ {v.nota}</div> : null}
            {tipo === 'rimandata' ? <div style={{ fontSize: 12, color: '#fbbf24', marginTop: 3, fontWeight: 800 }}>⏭ rimandata al {dataIt(v.rimanda_a)} · {dataLunga(v.rimanda_a)}</div> : null}
          </div>
          {azioni && tipo === 'fare' && (
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
              <button type="button" disabled={!puoSalvare || occupato} onClick={() => salva(v, 'fatto')}
                style={{ ...btnBase, background: '#16a34a', color: 'white', opacity: !puoSalvare || occupato ? 0.5 : 1 }}>✓ Fatto</button>
              <button type="button" disabled={!puoSalvare || occupato} onClick={() => setRinvio(aperto ? null : { key: v.key, data: domaniIso(oggi) })}
                style={{ ...btnBase, background: aperto ? '#78350f' : 'rgba(251,191,36,0.15)', color: '#fcd34d', borderColor: 'rgba(251,191,36,0.55)', opacity: !puoSalvare || occupato ? 0.5 : 1 }}>⏭ Rimanda</button>
              {bookIdProfiliamo(v.key) && <button type="button" disabled={!puoSalvare || occupato} onClick={() => parziale(v)} title="Il cliente ha fatto solo una parte: il resto slitta a domani"
                style={{ ...btnBase, background: 'rgba(167,139,250,0.15)', color: '#c4b5fd', borderColor: 'rgba(167,139,250,0.55)', opacity: !puoSalvare || occupato ? 0.5 : 1 }}>½ Parziale</button>}
            </div>
          )}
          {tipo === 'fatta' && v.segnataQui && (
            <button type="button" disabled={occupato} onClick={() => togli(v)} title="Rimetti tra le cose da fare" style={{ ...btnBase, background: 'transparent', color: '#cbd5e1', borderColor: 'rgba(148,163,184,0.5)', padding: '5px 10px', fontSize: 12 }}>↩ Annulla</button>
          )}
          {tipo === 'rimandata' && (
            <button type="button" disabled={occupato} onClick={() => togli(v)} title="Riporta tra le cose da fare oggi" style={{ ...btnBase, background: 'transparent', color: '#cbd5e1', borderColor: 'rgba(148,163,184,0.5)', padding: '5px 10px', fontSize: 12 }}>↩ Riporta a oggi</button>
          )}
        </div>
        {aperto && (
          <div style={{ marginTop: 10, padding: '10px 12px', borderRadius: 10, background: 'rgba(251,191,36,0.08)', border: '1px solid rgba(251,191,36,0.4)', display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
            <label style={{ color: '#fde68a', fontWeight: 800, fontSize: 13 }}>Rimanda al giorno:</label>
            <input type="date" value={rinvio.data} min={domaniIso(oggi)} onChange={e => setRinvio({ key: v.key, data: e.target.value })}
              style={{ background: '#020617', color: '#f8fafc', border: '1px solid #475569', borderRadius: 8, padding: '6px 8px', fontWeight: 800, colorScheme: 'dark' }} />
            <span style={{ color: '#94a3b8', fontSize: 12.5 }}>{rinvioValido(rinvio.data, oggi) ? dataLunga(rinvio.data) : 'scegli una data da domani in poi'}</span>
            <button type="button" disabled={!rinvioValido(rinvio.data, oggi) || occupato} onClick={() => salva(v, 'rimandato', rinvio.data)}
              style={{ ...btnBase, background: rinvioValido(rinvio.data, oggi) ? '#d97706' : '#334155', color: 'white', padding: '6px 14px' }}>Conferma</button>
            <button type="button" onClick={() => setRinvio(null)} style={{ ...btnBase, background: 'transparent', color: '#cbd5e1', borderColor: 'rgba(148,163,184,0.5)', padding: '6px 12px' }}>Annulla</button>
          </div>
        )}
      </div>
    )
  }

  return (
    <div className="pt-mobile" style={{ minHeight: '100vh', background: '#050b18', color: '#e2e8f0', fontFamily: 'system-ui, -apple-system, Segoe UI, sans-serif', padding: '18px 14px 60px' }}>
      <div style={{ maxWidth: 920, margin: '0 auto' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap', marginBottom: 6 }}>
          <a href="/profit-tracker" style={{ color: '#7dd3fc', fontWeight: 800, textDecoration: 'none', fontSize: 14 }}>← Profit Tracker</a>
          <button type="button" onClick={carica} disabled={caricamento} style={{ ...btnBase, marginLeft: 'auto', background: 'rgba(56,189,248,0.15)', color: '#7dd3fc', borderColor: 'rgba(56,189,248,0.5)' }}>{caricamento ? '⏳ Aggiorno…' : '🔄 Aggiorna'}</button>
        </div>
        <style>{`@keyframes attendiLucy { 0%,100% { opacity: 1 } 50% { opacity: .25 } } .attendi-lucy { animation: attendiLucy 1s ease-in-out infinite }`}</style>
        <h1 style={{ fontSize: 26, fontWeight: 900, margin: '8px 0 2px' }}>📋 Oggi da fare</h1>
        <div style={{ color: '#94a3b8', fontSize: 14, textTransform: 'capitalize', marginBottom: 12 }}>{dataLunga(oggi)}</div>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 16 }}>
          {chip(`${t.daFare} da fare`, t.daFare ? '#fbbf24' : '#4ade80')}
          {chip(`${t.fatte} fatte`, '#4ade80')}
          {chip(`${t.rimandate} rimandate`, '#94a3b8')}
        </div>

        {tabellaMancante && (
          <div style={{ ...card, borderColor: 'rgba(248,113,113,0.7)', padding: '12px 14px', color: '#fecaca', fontSize: 13.5, lineHeight: 1.5 }}>
            <b>Manca la tabella per salvare Fatto e Rimanda.</b> Esegui una volta il file <code>supabase/oggi_da_fare.sql</code> nel SQL Editor di Supabase, poi premi Aggiorna. Intanto la lista si vede, ma i bottoni sono spenti.
          </div>
        )}
        {errori.map((e, i) => (
          <div key={i} style={{ ...card, borderColor: 'rgba(248,113,113,0.6)', padding: '9px 14px', color: '#fecaca', fontSize: 13 }}>⚠️ {e}</div>
        ))}
        {fotoDiOggi && statoBet === 'in_corso' && (
          <div style={{ ...card, borderColor: 'rgba(56,189,248,0.6)', padding: '10px 14px', color: '#bae6fd', fontSize: 13.5 }}>
            ⏳ Lucy sta preparando le bet di oggi (calendari e quote): tra poco compaiono qui da sole.
          </div>
        )}
        {fotoDiOggi && statoBet === 'da_preparare' && (
          <div style={{ ...card, borderColor: 'rgba(251,191,36,0.6)', padding: '12px 14px', color: '#fde68a', fontSize: 13.5, lineHeight: 1.5, display: 'flex', gap: 12, alignItems: 'center', flexWrap: 'wrap' }}>
            <span style={{ flex: '1 1 260px' }}>⚽ Le bet e gli incroci di oggi non sono ancora stati preparati{richiesta ? ': ho chiesto al Profit Tracker di farlo, se non parte controlla che sia aperto in un\'altra scheda.' : '. Di solito li prepara il tastino Oggi da fare della Dashboard.'}</span>
            <button type="button" onClick={chiediPreparaBet} style={{ ...btnBase, background: '#0ea5e9', color: 'white' }}>⚽ Prepara bet ora</button>
          </div>
        )}
        {fotoDiOggi && statoBet === 'nessuna' && (
          <div style={{ ...card, padding: '9px 14px', color: '#94a3b8', fontSize: 13 }}>⚽ Oggi Lucy non trova bet sport da incrociare.</div>
        )}
        {fotoDiOggi && statoBet === 'errore' && (
          <div style={{ ...card, borderColor: 'rgba(248,113,113,0.6)', padding: '12px 14px', color: '#fecaca', fontSize: 13.5, display: 'flex', gap: 12, alignItems: 'center', flexWrap: 'wrap' }}>
            <span style={{ flex: '1 1 260px' }}>⚠️ Le bet non si sono preparate: {fotoDiOggi.bet?.errore || 'errore sconosciuto'}</span>
            <button type="button" onClick={chiediPreparaBet} style={{ ...btnBase, background: '#0ea5e9', color: 'white' }}>↻ Riprova</button>
          </div>
        )}
        {schedaMas?.errore && (
          <div style={{ ...card, borderColor: 'rgba(248,113,113,0.6)', padding: '9px 14px', color: '#fecaca', fontSize: 13 }}>⚠️ Masaniello: non riesco a calcolare la scheda proposta ({schedaMas.errore})</div>
        )}
        {!caricamento && !fotoDiOggi && (
          <div style={{ ...card, borderColor: 'rgba(251,191,36,0.6)', padding: '12px 14px', color: '#fde68a', fontSize: 13.5, lineHeight: 1.5 }}>
            ⚠️ Mancano bet, incroci, conti e avvisi di oggi: li prepara il Profit Tracker.{' '}
            {foto ? `L'ultima fotografia è del ${dataIt(foto.giorno)}.` : "Non ce n'è ancora nessuna."} Apri il <a href="/profit-tracker" style={{ color: '#7dd3fc', fontWeight: 800 }}>Profit Tracker</a> (anche in un&apos;altra scheda) e questa pagina si aggiorna da sola.
          </div>
        )}
        {fotoDiOggi && etaMin != null && etaMin > ETA_MAX_MIN && (
          <div style={{ ...card, borderColor: 'rgba(251,191,36,0.5)', padding: '9px 14px', color: '#fde68a', fontSize: 13 }}>
            ⏱ Bet, conti e avvisi sono aggiornati a {etaMin} minuti fa: tieni aperto il Profit Tracker per averli sempre freschi.
          </div>
        )}

        {!caricamento && t.daFare === 0 && (fotoDiOggi || t.fatte > 0) && (
          <div style={{ ...card, borderColor: 'rgba(74,222,128,0.5)', padding: '16px 14px', textAlign: 'center', color: '#86efac', fontWeight: 800, fontSize: 16 }}>✅ Non c&apos;è altro da fare per oggi</div>
        )}

        {sezioniVista.map(s => {
          const dest = destinazioni(s)
          const aperta = !!espanse[s.id]
          return (
          <React.Fragment key={s.id}>
          <div style={card}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 14px', background: 'rgba(30,41,59,0.9)', borderLeft: `4px solid ${s.colore}` }}>
              <span style={{ fontWeight: 900, fontSize: 15 }}>{s.icona} {s.titolo}</span>
              <span style={{ marginLeft: 'auto', color: s.colore, fontWeight: 900, fontSize: 13 }}>{s.voci.length}</span>
            </div>
            {dest ? (
              <div style={{ padding: '10px 14px', borderTop: '1px solid rgba(51,65,85,0.6)' }}>
                <div style={{ fontSize: 12.5, color: '#94a3b8', lineHeight: 1.45, marginBottom: 9 }}>
                  {s.riepilogo || (s.voci.slice(0, 5).map(v => v.titolo).join(' · ') + (s.voci.length > 5 ? ` … e altre ${s.voci.length - 5}` : ''))}
                </div>
                <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
                  {dest.map(d => {
                    const inAttesa = (d.dove === 'tabella_bet' || d.dove === 'tabella_live') && betNonPronte   // la Tabella bet si apre solo quando Lucy ha finito di preparare le bet
                    return (
                      <button key={d.dove} type="button" disabled={inAttesa} onClick={() => apriNelProfitTracker(d.dove)}
                        style={{ ...btnBase, background: inAttesa ? '#334155' : '#0ea5e9', color: inAttesa ? '#94a3b8' : 'white', padding: '9px 16px', fontSize: 14, cursor: inAttesa ? 'not-allowed' : 'pointer', opacity: inAttesa ? 0.7 : 1 }}>{d.testo} →</button>
                    )
                  })}
                  {betNonPronte && dest.some(d => d.dove === 'tabella_bet' || d.dove === 'tabella_live') && (
                    <span className="attendi-lucy" style={{ fontWeight: 900, fontSize: 13, color: '#fde047' }}>
                      {statoBet === 'in_corso' ? '⏳ Attendi: Lucy sta preparando le bet…' : '⏳ Le bet non sono ancora pronte: premi «Prepara bet ora» qui sopra'}
                    </span>
                  )}
                  <button type="button" onClick={() => setEspanse(p => ({ ...p, [s.id]: !aperta }))} style={{ ...btnBase, background: 'transparent', color: '#cbd5e1', borderColor: 'rgba(148,163,184,0.5)', padding: '7px 12px', fontSize: 12.5 }}>{aperta ? '▾ nascondi elenco' : `▸ vedi l'elenco (${s.id === 'bet' ? s.voci.length + (s.chiuse || []).length : s.voci.length})`}</button>
                </div>
              </div>
            ) : null}
            {(!dest || aperta) && s.id !== 'bet' && s.voci.map(v => <React.Fragment key={v.key}>{riga(v)}</React.Fragment>)}
            {aperta && s.id === 'bet' && [...s.voci.map(v => ({ ...v, statoRO: 'da_fare' })), ...(s.chiuse || [])].map(v => {
              const st = { fatta: ['✅ fatta', '#4ade80'], saltata: ['⏭ saltata', '#fb923c'], rimandata: ['🔁 rimandata', '#fbbf24'], da_fare: ['• da fare', '#7dd3fc'] }[v.statoRO]
              return (
                <div key={v.key} style={{ display: 'flex', gap: 10, alignItems: 'baseline', padding: '6px 14px', borderTop: '1px solid rgba(51,65,85,0.5)', fontSize: 12.5 }}>
                  <div style={{ flex: 1, minWidth: 0, color: '#94a3b8', lineHeight: 1.4 }}><b style={{ color: '#e2e8f0' }}>{v.titolo}</b> · {v.dettaglio}</div>
                  <div style={{ color: st[1], fontWeight: 800, whiteSpace: 'nowrap' }}>{st[0]}</div>
                </div>
              )
            })}
            {s.id === 'avvisi' && <div style={{ padding: '9px 14px', borderTop: '1px solid rgba(51,65,85,0.6)' }}><button type="button" onClick={() => apriNelProfitTracker('avvisi')} style={{ ...btnBase, background: 'rgba(56,189,248,0.15)', color: '#7dd3fc', borderColor: 'rgba(56,189,248,0.5)' }}>🔔 Apri gli Avvisi nel Profit Tracker →</button></div>}
            {s.id === 'bet' && <div style={{ padding: '7px 14px', borderTop: '1px solid rgba(51,65,85,0.6)', fontSize: 12, color: '#64748b' }}>Le bet si comandano dalla Tabella bet: quando lì le confermi, le salti o le rimandi, qui compare l&apos;esito (e resta nell&apos;Archivio operazioni del Profit Tracker). In fondo alla Tabella c&apos;è il Masaniello: ✓ Conferma scheda, poi 📱 Apri telefoni.</div>}
            {s.id === 'promo' && <div style={{ padding: '7px 14px', borderTop: '1px solid rgba(51,65,85,0.6)', fontSize: 12, color: '#64748b' }}>Se la promo è già stata fatta e la segni nella tab Promo, qui sparisce da sola.</div>}
          </div>
          </React.Fragment>
        )})}

        {false && lista.rimandate.length > 0 && ( // 15/10/2026: le rimandate ora stanno nell'Archivio operazioni (pagina Profilazione)
          <div style={card}>
            <button type="button" onClick={() => setMostraRimandate(v => !v)} style={{ width: '100%', textAlign: 'left', cursor: 'pointer', border: 0, display: 'flex', alignItems: 'center', gap: 10, padding: '10px 14px', background: 'rgba(30,41,59,0.9)', color: '#e2e8f0', borderLeft: '4px solid #94a3b8' }}>
              <span style={{ fontWeight: 900, fontSize: 15 }}>⏭ Rimandate</span>
              <span style={{ marginLeft: 'auto', color: '#94a3b8', fontWeight: 900, fontSize: 13 }}>{lista.rimandate.length} {mostraRimandate ? '▾' : '▸'}</span>
            </button>
            {mostraRimandate && lista.rimandate.map(v => <React.Fragment key={v.key}>{riga(v, 'rimandata')}</React.Fragment>)}
          </div>
        )}

        {fatteAltre.length > 0 && (
          <div style={card}>
            <button type="button" onClick={() => setMostraFatte(v => !v)} style={{ width: '100%', textAlign: 'left', cursor: 'pointer', border: 0, display: 'flex', alignItems: 'center', gap: 10, padding: '10px 14px', background: 'rgba(30,41,59,0.9)', color: '#e2e8f0', borderLeft: '4px solid #4ade80' }}>
              <span style={{ fontWeight: 900, fontSize: 15 }}>✓ Fatte oggi</span>
              <span style={{ marginLeft: 'auto', color: '#4ade80', fontWeight: 900, fontSize: 13 }}>{fatteAltre.length} {mostraFatte ? '▾' : '▸'}</span>
            </button>
            {mostraFatte && fatteAltre.map(v => <React.Fragment key={v.key}>{riga(v, 'fatta')}</React.Fragment>)}
          </div>
        )}

        <div style={{ color: '#64748b', fontSize: 12, lineHeight: 1.5, marginTop: 8 }}>
          Le voci si ricalcolano ogni volta dalle stesse fonti del Profit Tracker. ✓ Fatto e ⏭ Rimanda segnano solo questa lista: una voce rimandata ricompare nel giorno scelto, anche se Lucy nel frattempo ricalcola le bet.
          {fotoDiOggi?.aggiornato ? ` Bet, conti e avvisi aggiornati alle ${new Date(fotoDiOggi.aggiornato).toLocaleTimeString('it-IT', { hour: '2-digit', minute: '2-digit' })}.` : ''}
        </div>
      </div>
    </div>
  )
}
