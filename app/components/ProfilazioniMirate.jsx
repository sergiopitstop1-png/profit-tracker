"use client";
// ════════════════════════════════════════════════════════════════════
// PROFILAZIONI MIRATE (28/09/2026) — gruppi di conti (book + cliente) per operazioni di casinò live.
// Ogni gruppo si ripete ogni N giorni; con ✅ Fatta si registra l'operazione (storico con i conti coinvolti).
// I conti di un gruppo NON ricevono più la profilazione casinò normale (la sostituisce): il filtro è in
// ProfitTrackerClient (getAzioniOggiBase → togliCasinoMirate). Tabelle: profilazioni_mirate, profilazioni_mirate_fatte.
// 05/10/2026: UNA PERSONA = UN CONTO per gruppo. Al casinò live ci si collega con un solo conto alla volta:
// la stessa persona con due book nello stesso gruppo viene bloccata (aggiunta, salvataggio) e segnalata nei gruppi salvati.
// 05/10/2026: 📝 NOTE del gruppo (cosa fare la prossima volta) — colonna profilazioni_mirate.note (profilazioni_mirate_note.sql).
// 05/10/2026: ELENCO SEMPLICE — una riga per gruppo con i dati essenziali; clic → finestra con tutti i dettagli e i pulsanti.
// 15/10/2026: SEZIONI — Casinò live (come prima), Sport, Slot, Bingo. Il tipo sta in profilazioni_mirate.tipo (vuoto = casinò live).
//   Solo i gruppi di CASINÒ LIVE sostituiscono la profilazione casinò normale e hanno la regola "una persona = un conto" e il pulsante Numeri.
//   Sport, Slot e Bingo sono promemoria ricorrenti (ogni N giorni, ✅ Fatta, storico, note) che compaiono anche in Oggi da fare e in Dashboard.
// ════════════════════════════════════════════════════════════════════
import React, { useState, useEffect, useCallback } from 'react'
import { createPortal } from 'react-dom'
import { supabase } from '../profit-tracker/supabaseClient'
import SceltaData from './SceltaData' // 14/10/2026: calendario unico per scegliere le date
import SessioneLivePanel, { plRoulette } from './SessioneLive' // 02/10/2026: numeri a conto nella profilazione mirata

// 26/10/2026 · Finestra dei dettagli: di solito è un pannello sopra la pagina; con "↗ Finestra" si apre in una
// finestra vera del browser (win) che si può trascinare su un altro schermo. Il contenuto resta lo stesso e
// continua a funzionare (React lo disegna nell'altra finestra), quindi pulsanti e salvataggi non cambiano.
function FinestraDettaglio({ win, titolo, onChiudi, children }) {
  const [cont, setCont] = useState(null)
  useEffect(() => {
    if (!win) { setCont(null); return }
    let el = null
    try {
      const d = win.document
      d.title = titolo || 'Profilazione'
      d.head.innerHTML = ''
      document.querySelectorAll('link[rel="stylesheet"], style').forEach(n => d.head.appendChild(n.cloneNode(true)))
      const meta = d.createElement('meta'); meta.name = 'viewport'; meta.content = 'width=device-width, initial-scale=1'; d.head.appendChild(meta)
      d.body.className = document.body.className
      d.body.style.cssText = 'margin:0;padding:12px;background:#0b1220;color:#e2e8f0;font-family:' + (getComputedStyle(document.body).fontFamily || 'sans-serif')
      d.body.innerHTML = ''
      el = d.createElement('div')
      d.body.appendChild(el)
      setCont(el)
    } catch (e) { onChiudi() }
    const chiudiTutto = () => onChiudi()
    win.addEventListener('pagehide', chiudiTutto)
    return () => { try { win.removeEventListener('pagehide', chiudiTutto); win.close() } catch (e) {} }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [win])
  if (win) return cont ? createPortal(children, cont) : null
  return (
    <div onClick={onChiudi} style={{ position: 'fixed', inset: 0, background: 'rgba(2,6,23,0.75)', zIndex: 1000, display: 'flex', alignItems: 'flex-start', justifyContent: 'center', padding: '6vh 16px', overflowY: 'auto' }}>
      <div onClick={e => e.stopPropagation()} style={{ width: '100%', maxWidth: 980, background: '#0b1220', border: '1px solid rgba(250,204,21,0.45)', borderRadius: 16, padding: 16, boxShadow: '0 20px 60px rgba(0,0,0,.6)' }}>
        {children}
      </div>
    </div>
  )
}

const oggiISO = () => new Date().toLocaleDateString('sv-SE')
const addGiorni = (iso, n) => { const d = new Date(iso + 'T00:00:00'); d.setDate(d.getDate() + n); return d.toLocaleDateString('sv-SE') }
const diffGiorni = (da, a) => Math.round((new Date(a + 'T00:00:00') - new Date(da + 'T00:00:00')) / 86400000)
// 05/10/2026: stessa persona presente più volte nello stesso gruppo → [{ persona, conti: [book, …] }]
const normNome = s => String(s || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9]/g, '')
function personeDoppie(contiBook) {
  const m = new Map()
  for (const b of contiBook || []) { if (!b) continue; const k = normNome(b.intestatario); if (!k) continue; if (!m.has(k)) m.set(k, []); m.get(k).push(b) }
  return [...m.values()].filter(l => l.length > 1).map(l => ({ persona: l[0].intestatario, conti: l }))
}
const dataIt = (iso) => iso ? iso.split('-').reverse().join('/') : ''
const giornoLungo = (iso) => iso ? new Date(iso + 'T12:00:00').toLocaleDateString('it-IT', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' }) : ''
const inp = { background: '#020617', color: '#f8fafc', border: '1px solid #475569', borderRadius: 8, padding: '6px 9px', fontSize: 13 }
const btn = (c) => ({ padding: '5px 10px', borderRadius: 8, border: `1px solid ${c}66`, background: `${c}1a`, color: c, fontWeight: 700, fontSize: 12, cursor: 'pointer' })

// 15/10/2026 — le sezioni della schermata
export const TIPI_MIRATE = [
  { k: 'casino live', nome: 'Casinò live', icona: '🎰', colore: '#facc15', descr: 'operazione di casinò live', prefisso: 'Profilazione',
    vuoto: 'Nessun gruppo. Crea "Profilazione 1" con i conti che hai taggato su Panda: da quel momento quei conti non ricevono più la profilazione casinò normale.' },
  { k: 'sport', nome: 'Sport', icona: '⚽', colore: '#38bdf8', descr: 'operazione sport', prefisso: 'Sport',
    vuoto: 'Nessun gruppo sport. Crea un gruppo con i conti su cui fare l\'operazione sport ogni N giorni.' },
  { k: 'slot', nome: 'Slot', icona: '🎲', colore: '#c084fc', descr: 'sessione slot', prefisso: 'Slot',
    vuoto: 'Nessun gruppo slot. Crea un gruppo con i conti su cui fare la sessione slot ogni N giorni.' },
  { k: 'bingo', nome: 'Bingo', icona: '🔢', colore: '#34d399', descr: 'operazione bingo', prefisso: 'Bingo',
    vuoto: 'Nessun gruppo bingo. Crea un gruppo con i conti su cui fare il bingo ogni N giorni.' },
]
export const tipoMirata = g => (TIPI_MIRATE.some(t => t.k === g?.tipo) ? g.tipo : 'casino live')   // vuoto o sconosciuto = casinò live
const infoMirata = g => TIPI_MIRATE.find(t => t.k === tipoMirata(g)) || TIPI_MIRATE[0]

// prossima data di un gruppo: ultima fatta + N giorni (+ giorni di pausa totale); mai fatta = oggi
export function prossimaMirata(g, fatte, giorniPausa) {
  const ultime = fatte.filter(f => f.gruppo_id === g.id).map(f => f.data).sort()
  const ultima = ultime[ultime.length - 1] || null
  // 02/10/2026: data scelta a mano da Sergio (vale finché non registri una nuova "Fatta" dopo quella data)
  if (g.prossima_manuale && (!ultima || g.prossima_manuale > ultima)) return { ultima, prossima: g.prossima_manuale, manuale: true }
  if (!ultima) return { ultima: null, prossima: oggiISO() }
  const n = Number(g.ogni_giorni || 7)
  return { ultima, prossima: addGiorni(ultima, n + (giorniPausa ? giorniPausa(ultima, oggiISO()) : 0)) }
}

// 23/10/2026 — PAUSA DELLA PROFILAZIONE MIRATA: posizione di ogni conto e avviso quando un conto ha raggiunto la soglia.
//  • Casinò live · baccarat campionato: 4 sessioni (risultato reale di ogni conto, già salvato in live_sessioni).
//  • Casinò live · roulette: 12 sessioni (ognuna da 3 giri). Il P/L reale viene dai numeri usciti scritti nella sessione (payout 1:35 o quello scelto);
//    il costo teorico considera il puntato e il payout (con 1:35 è 1/37). Un conto messo a 0 numeri in un giro non ha giocato: quel giro non conta.
//  • Sport e Slot: 1.000 € giocati in totale per conto (si sommano gli importi indicati in ✅ Fatta).
// Il conteggio parte da g.conteggio_dal (se l'hai azzerato con 🔄), altrimenti da sempre. Il gruppo di casinò live si riconosce dal nome.
export const SOGLIA_BACCARAT = 4
export const SOGLIA_ROULETTE = 12
export const SOGLIA_EURO = 1000   // sport e slot
const arrotonda2 = n => Math.round(n * 100) / 100
export const euroIt = n => (Number(n) || 0).toLocaleString('it-IT', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + ' €'
export const segnoEuro = n => (n > 0 ? '+' : '') + euroIt(n)
// sessioni = righe di live_sessioni delle mirate · fatte = profilazioni_mirate_fatte · datiConto(id) = { nome, intestatario }
export function posizioneGruppo(g, sessioni, fatte, datiConto) {
  const tipo = tipoMirata(g)
  const dal = g?.conteggio_dal ? new Date(g.conteggio_dal) : null
  const dalT = dal ? dal.getTime() : 0
  const dalGiorno = dal ? dal.toLocaleDateString('sv-SE') : ''
  const per = new Map()
  const conto = (id, p) => {
    const k = String(id)
    if (!per.has(k)) { const d = p || (datiConto && datiConto(k)) || {}; per.set(k, { id: k, nome: d.nome, intestatario: d.intestatario, bacc: { sessioni: 0, puntato: 0, netto: 0 }, roul: { sessioni: 0, puntato: 0, costo: 0, netto: 0, conNumeri: 0 }, giocato: 0, operazioni: 0, senzaImporto: 0 }) }
    return per.get(k)
  }
  let operazioni = 0
  if (tipo === 'casino live') {
    const mie = (sessioni || []).filter(s => s?.gruppo === g?.nome && (!dalT || new Date(s.creato || s.giorno).getTime() >= dalT))
    for (const s of mie) {
      if (s.gioco === 'baccarat') {
        if (s.operazione !== 'campionato') continue   // il baccarat spot non ha un risultato per conto
        let giocata = false
        for (const p of s.partecipanti || []) { if (!p?.campionato) continue; const r = conto(p.id, p); r.bacc.sessioni += 1; r.bacc.netto += Number(p.risultato) || 0; r.bacc.puntato += Number(p.puntato_totale) || 0; giocata = true }
        if (giocata) operazioni += 1
      } else {   // roulette (le righe vecchie senza "gioco" sono roulette)
        const giri = Number(s.giri_fatti) || 0
        let giocata = false
        for (const p of s.partecipanti || []) {
          const n = (p?.numeri || []).length
          if (!n) continue   // 0 numeri = quel conto in questo giro non ha giocato
          const puntato = n * (Number(p.stake) || 0) * giri
          const paga = Number(p.paga) > 0 ? Number(p.paga) : 35   // roulette particolari: 1:29, 1:21…
          const r = conto(p.id, p); r.roul.sessioni += 1; r.roul.puntato += puntato; r.roul.costo += puntato * (36 - paga) / 37; giocata = true
          if (Array.isArray(p.usciti) && p.usciti.length && Number.isFinite(Number(p.risultato))) { r.roul.netto += Number(p.risultato); r.roul.conNumeri += 1 }
        }
        if (giocata) operazioni += 1
      }
    }
  } else if (tipo === 'sport' || tipo === 'slot') {
    const mie = (fatte || []).filter(f => String(f.gruppo_id) === String(g?.id) && (!dalGiorno || String(f.data) >= dalGiorno))
    operazioni = mie.length
    for (const f of mie) for (const id of f.conti || []) {
      const r = conto(id); r.operazioni += 1
      const imp = Number(f.importo_per_conto)
      if (Number.isFinite(imp) && imp > 0) r.giocato += imp; else r.senzaImporto += 1
    }
  }
  const verbo = tipo === 'slot' ? 'girati' : 'scommessi'
  const righe = [...per.values()].map(r => {
    const x = { ...r, bacc: { ...r.bacc, puntato: arrotonda2(r.bacc.puntato), netto: arrotonda2(r.bacc.netto) }, roul: { ...r.roul, puntato: arrotonda2(r.roul.puntato), costo: arrotonda2(r.roul.costo), netto: arrotonda2(r.roul.netto) }, giocato: arrotonda2(r.giocato) }
    x.motivi = []
    if (x.bacc.sessioni >= SOGLIA_BACCARAT) x.motivi.push(`${x.bacc.sessioni} campionati baccarat · netto ${segnoEuro(x.bacc.netto)}`)
    if (x.roul.sessioni >= SOGLIA_ROULETTE) x.motivi.push(`${x.roul.sessioni} sessioni roulette · puntato ${euroIt(x.roul.puntato)}, ${x.roul.conNumeri ? `P/L ${segnoEuro(x.roul.netto)} (${x.roul.conNumeri}/${x.roul.sessioni} con numeri usciti)` : `costo teorico ${euroIt(x.roul.costo)}`}`)
    if ((tipo === 'sport' || tipo === 'slot') && x.giocato >= SOGLIA_EURO) x.motivi.push(`${euroIt(x.giocato)} ${verbo} in ${x.operazioni} ${x.operazioni === 1 ? 'operazione' : 'operazioni'}`)
    x.daPausare = x.motivi.length > 0
    return x
  }).sort((a, b) => String(a.intestatario || '').localeCompare(String(b.intestatario || ''), 'it', { sensitivity: 'base' }) || String(a.nome || '').localeCompare(String(b.nome || ''), 'it', { sensitivity: 'base' }))
  const somma = f => arrotonda2(righe.reduce((a, r) => a + f(r), 0))
  return {
    tipo, operazioni, righe, daPausare: righe.filter(r => r.daPausare),
    haBacc: righe.some(r => r.bacc.sessioni > 0), haRoul: righe.some(r => r.roul.sessioni > 0),
    totBacc: somma(r => r.bacc.netto), totRoul: somma(r => r.roul.costo), totRoulNetto: somma(r => r.roul.netto), totRoulPuntato: somma(r => r.roul.puntato), totGiocato: somma(r => r.giocato),
    senzaImporto: righe.reduce((a, r) => a + r.senzaImporto, 0),
  }
}

export default function ProfilazioniMiratePanel({ books, terminato, gruppi, setGruppi, fatte, setFatte, giorniPausa, onProfilazione, onProfilazioneTutti, onApri, sitoBook, onMessage, onError }) {
  const [aperto, setAperto] = useState(true)
  const [chiuse, setChiuse] = useState({})          // 15/10/2026: sezioni ripiegate { 'sport': true }
  const [edit, setEdit] = useState(null)          // { id?, nome, ogni_giorni, conti: [book_id], cerca }
  const [storico, setStorico] = useState(null)    // id gruppo con lo storico aperto
  const [numeri, setNumeri] = useState(null)      // 02/10/2026: id gruppo con la tabella numeri aperta
  const [nota, setNota] = useState(null)          // 05/10/2026: { id, testo } nota in modifica
  const [dettaglio, setDettaglio] = useState(null) // 05/10/2026: id del gruppo aperto nella finestra
  const [finestra, setFinestra] = useState(null)   // 26/10/2026: finestra del browser separata (null = pannello sopra la pagina)
  const [scegliData, setScegliData] = useState(null) // 14/10/2026: { g, valore } calendario per la data della prossima
  const oggi = oggiISO()
  const bookDi = id => (books || []).find(b => String(b.id) === String(id))
  // 23/10/2026: sessioni (campionati baccarat e roulette) delle profilazioni mirate, per la posizione e l'avviso di pausa
  const [sessioniMirate, setSessioniMirate] = useState([])
  const caricaSessioniMirate = useCallback(async () => {
    const { data, error } = await supabase.from('live_sessioni').select('id,giorno,numero,creato,gruppo,gioco,operazione,giri_fatti,partecipanti').eq('origine', 'mirata')
    if (error) return []
    setSessioniMirate(data || [])
    return data || []
  }, [])
  useEffect(() => { caricaSessioniMirate() }, [caricaSessioniMirate])
  // 23/10/2026: numeri usciti di una roulette già salvata (scritti dopo, o corretti): ricalcola il P/L di ogni conto e aggiorna la sessione
  const [numeriOggi, setNumeriOggi] = useState({})   // { idSessione: ['12', '5', '30'] } in modifica
  async function salvaNumeriUsciti(sess, valori) {
    const giri = Number(sess.giri_fatti) || 0
    const validi = Array.from({ length: giri }, (_, i) => { const v = valori?.[i]; return v === '' || v == null ? NaN : Number(v) })
    if (!giri || validi.some(v => !Number.isInteger(v) || v < 0 || v > 36)) { onError(`Scrivi tutti i ${giri || ''} numeri usciti (da 0 a 36)`); return }
    const nuovi = (sess.partecipanti || []).map(p => {
      const n = (p?.numeri || []).length
      if (!n) return p
      const stake = Number(p.stake) || 0, paga = Number(p.paga) > 0 ? Number(p.paga) : 35
      return { ...p, paga, usciti: validi, risultato: plRoulette(p.numeri, stake, paga, validi), puntato_totale: arrotonda2(n * stake * giri) }
    })
    const { data, error } = await supabase.from('live_sessioni').update({ partecipanti: nuovi }).eq('id', sess.id).select('id')
    if (error || !data?.length) { onError('Numeri non salvati' + (error ? ': ' + error.message : ': la tabella live_sessioni non permette la modifica (lancia live_sessioni_modifica.sql)')); return }
    await caricaSessioniMirate()
    setNumeriOggi(prev => { const n = { ...prev }; delete n[sess.id]; return n })
    onMessage(`🎯 Sessione ${sess.numero}: numeri usciti salvati, P/L dei conti aggiornato`)
  }
  // dopo ogni sessione salvata o ✅ Fatta: se qualche conto ha raggiunto la soglia, te lo dice con la sua posizione
  async function avvisoPausa(g, fatteAgg) {
    const p = posizioneGruppo(g, await caricaSessioniMirate(), fatteAgg || fatte, bookDi)
    if (!p.daPausare.length) return
    const n = p.daPausare.length
    window.alert(`⏸ ${g.nome}: ${n} ${n === 1 ? 'conto ha raggiunto' : 'conti hanno raggiunto'} la soglia.\n\nMetti in pausa la profilazione mirata per ${n === 1 ? 'questo conto' : 'questi conti'}:\n\n${p.daPausare.map(r => `${r.nome} – ${r.intestatario || '—'}: ${r.motivi.join(' + ')}`).join('\n')}`)
  }
  // 🔄 dopo la pausa, quando i conti ripartono: il conteggio riparte da zero (le sessioni e le operazioni restano in Archivio)
  async function ripartiConteggio(g) {
    if (!window.confirm(`Riparto da zero il conteggio di "${g.nome}"?\n\nLe sessioni e le operazioni già fatte restano in Archivio: da adesso si contano solo le nuove.`)) return
    const dal = new Date().toISOString()
    const { error } = await supabase.from('profilazioni_mirate').update({ conteggio_dal: dal }).eq('id', g.id)
    if (error) { onError('Conteggio non azzerato: lancia profilazioni_mirate_conteggio.sql (' + error.message + ')'); return }
    setGruppi(prev => prev.map(x => x.id === g.id ? { ...x, conteggio_dal: dal } : x))
    onMessage(`🔄 ${g.nome}: conteggio ripartito da zero`)
  }

  const righe = (gruppi || []).map(g => ({ g, ...prossimaMirata(g, fatte || [], giorniPausa) }))
    .sort((a, b) => a.prossima.localeCompare(b.prossima))
  const daFare = righe.filter(r => r.prossima <= oggi).length

  async function salva() {
    const e = edit
    if (!e.nome.trim()) { onError('Dai un nome al gruppo'); return }
    if (!e.conti.length) { onError('Aggiungi almeno un conto'); return }
    // 05/10/2026: una persona = un conto per gruppo (dal 15/10 vale solo per il casinò live)
    const tipoE = e.tipo || 'casino live'
    const doppie = tipoE === 'casino live' ? personeDoppie(e.conti.map(bookDi)) : []
    if (doppie.length) { onError(`⛔ Non salvato: ${doppie.map(d => `${d.persona} è presente ${d.conti.length} volte (${d.conti.map(b => b.nome).join(', ')})`).join(' · ')}. Al casinò live ci si collega con un solo conto per persona: togline uno.`); return }
    const riga = { nome: e.nome.trim(), ogni_giorni: Math.max(1, Number(e.ogni_giorni) || 7), conti: e.conti.map(String), tipo: tipoE }
    const q = e.id ? supabase.from('profilazioni_mirate').update(riga).eq('id', e.id).select().single()
      : supabase.from('profilazioni_mirate').insert([riga]).select().single()
    const { data, error } = await q
    if (error) { onError('Gruppo non salvato: lancia profilazioni_mirate.sql (' + error.message + ')'); return }
    setGruppi(prev => e.id ? prev.map(x => x.id === data.id ? data : x) : [...prev, data])
    setEdit(null)
    onMessage(`🎯 ${data.nome}: ${data.conti.length} conti, ogni ${data.ogni_giorni} giorni`)
  }
  // ─── 30/09/2026 — APRI I BOOK SUI TELEFONI (agente telefoni: tabella comandi_telefoni, script book_lavorati.py) ───
  // un comando per book, con i clienti di quel book; una sola conferma per tutto il gruppo
  const urlDi = b => sitoBook ? sitoBook(b)
    : `https://www.${String(b.nome || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9-]/g, '')}.it/`
  async function apriSuTelefoni(conti, titolo) {
    const perBook = new Map()
    for (const b of conti) {
      if (!b?.intestatario) continue
      if (!perBook.has(b.nome)) perBook.set(b.nome, { nome: b.nome, url: urlDi(b), intestatari: [] })
      const r = perBook.get(b.nome)
      if (!r.intestatari.includes(b.intestatario)) r.intestatari.push(b.intestatario)
    }
    const lista = [...perBook.values()]
    if (!lista.length) { onError('Nessun conto con intestatario da aprire'); return }
    const testo = lista.map(r => `${r.nome} → ${r.intestatari.join(', ')}`).join('\n')
    if (!window.confirm(`📱 Apro ${titolo} sui telefoni:\n\n${testo}\n\n(il login lo fai tu)`)) return
    const { data, error } = await supabase.from('comandi_telefoni')
      .insert(lista.map(r => ({ azione: 'apri', url: r.url, intestatari: r.intestatari }))).select('id')
    if (error) { onError('Comandi non inviati: ' + error.message); return }
    const tot = lista.reduce((n, r) => n + r.intestatari.length, 0)
    onMessage(`📱 Inviati ${lista.length} comandi per ${tot} telefoni: aspetto la risposta…`)
    attendiEsiti((data || []).map(r => r.id), tot)
  }
  // controlla l'esito ogni 5 secondi per un minuto: nessun telefono saltato senza saperlo
  async function attendiEsiti(ids, tot) {
    if (!ids.length) return
    for (let giro = 0; giro < 12; giro++) {
      await new Promise(r => setTimeout(r, 5000))
      const { data } = await supabase.from('comandi_telefoni').select('id,stato,esito').in('id', ids)
      if (!data || data.some(c => c.stato !== 'fatto')) continue
      const esiti = data.flatMap(c => Object.entries(c.esito || {}))
      const ko = esiti.filter(([, e]) => e !== 'aperto')
      if (!ko.length) onMessage(`✅ Aperto su tutti i ${esiti.length} telefoni`)
      else onError(`📱 Aperti ${esiti.length - ko.length} su ${esiti.length}. Non aperti:\n${ko.map(([n, e]) => `${n}: ${e}`).join('\n')}`)
      return
    }
    onError(`📱 Nessuna risposta dallo script sul PC dopo un minuto: controlla che book_lavorati sia avviato (${tot} telefoni in attesa)`)
  }

  async function elimina(g) {
    if (!window.confirm(`Elimino il gruppo "${g.nome}"?\nLo storico delle operazioni fatte resta salvato.${tipoMirata(g) === 'casino live' ? ' I suoi conti tornano alla profilazione casinò normale.' : ''}`)) return
    const { error } = await supabase.from('profilazioni_mirate').delete().eq('id', g.id)
    if (error) { onError(error.message); return }
    setGruppi(prev => prev.filter(x => x.id !== g.id))
  }
  // 02/10/2026 — 📅 la prossima la decide Sergio (vuoto = automatica, ogni N giorni); dal 14/10 si sceglie sul calendario
  // 05/10/2026 — 📝 note del gruppo: restano finché non le cancelli tu
  async function salvaNota() {
    const testo = String(nota?.testo || '').trim()
    const { error } = await supabase.from('profilazioni_mirate').update({ note: testo || null }).eq('id', nota.id)
    if (error) { onError('Nota non salvata: lancia profilazioni_mirate_note.sql (' + error.message + ')'); return }
    setGruppi(prev => prev.map(x => x.id === nota.id ? { ...x, note: testo || null } : x))
    onMessage(testo ? '📝 Nota salvata' : '📝 Nota cancellata')
    setNota(null)
  }
  // 14/10/2026 — 📅 ora si sceglie la data su un calendario vero (con il giorno della settimana), non scrivendola a mano
  function scegliProssima(g, proposta) { setScegliData({ g, valore: proposta || '' }) }
  async function salvaProssima(g, iso) {
    const { error } = await supabase.from('profilazioni_mirate').update({ prossima_manuale: iso }).eq('id', g.id)
    if (error) { onError('Data non salvata: ' + error.message + ' (hai lanciato sessioni_live_baccarat.sql?)'); return }
    setGruppi(prev => prev.map(x => x.id === g.id ? { ...x, prossima_manuale: iso } : x))
    onMessage(iso ? `📅 ${g.nome}: prossima ${giornoLungo(iso)}` : `📅 ${g.nome}: cadenza automatica ogni ${g.ogni_giorni} giorni`)
    setScegliData(null)
  }
  async function fatta(g, daSessione = false) {
    const nomi = g.conti.map(bookDi).filter(Boolean).map(b => `${b.nome} – ${b.intestatario || '—'}`)
    if (!window.confirm(`✅ Operazione fatta su "${g.nome}" oggi?\n\n${nomi.join('\n')}`)) return
    // 02/10/2026: l'importo resta nell'archivio. Se arrivi da 🎰 Numeri gli importi sono già nella sessione salvata.
    let importo = null
    if (!daSessione) {
      const contaPausa = tipoMirata(g) === 'sport' || tipoMirata(g) === 'slot'
      const t = window.prompt(`Quanto ha ${tipoMirata(g) === 'slot' ? 'girato' : 'giocato'} OGNI conto di "${g.nome}" in questa operazione? (€)\n${contaPausa ? `Serve all'archivio e a contare i ${euroIt(SOGLIA_EURO)} dopo i quali il conto va in pausa: scrivilo sempre.` : 'Serve per l\'archivio. Lascia vuoto se non vuoi indicarlo.'}`, '')
      if (t === null) return
      const v = Number(String(t).replace(',', '.'))
      importo = String(t).trim() && Number.isFinite(v) && v > 0 ? v : null
    }
    const riga = { gruppo_id: g.id, nome_gruppo: g.nome, data: oggi, conti: g.conti }
    if (importo != null) riga.importo_per_conto = importo
    const { data, error } = await supabase.from('profilazioni_mirate_fatte').insert([riga]).select().single()
    if (error) { onError('Non registrata: ' + error.message); return }
    setFatte(prev => [...prev, data])
    onMessage(`✅ ${g.nome} registrata`)
    await scegliProssima({ ...g, prossima_manuale: null }, addGiorni(oggi, g.ogni_giorni)) // decidi tu la prossima data
    // i conti del gruppo non ancora in profilazione: chiedo se metterli dentro (così entrano anche nel giro sport)
    const fuori = g.conti.map(bookDi).filter(b => b && b.profilo_livello !== 'attivo')
    if (fuori.length && onProfilazioneTutti && window.confirm(`${fuori.length} conti del gruppo non sono in profilazione:\n${fuori.map(b => `${b.nome} – ${b.intestatario || '—'}`).join('\n')}\n\nLi metto in profilazione?`)) await onProfilazioneTutti(fuori.map(b => b.id))
    if (!daSessione) await avvisoPausa(g, [...(fatte || []), data])   // 23/10/2026: sport e slot arrivano alla soglia con le operazioni registrate qui (le sessioni live avvisano al salvataggio)
  }
  async function annullaFatta(f) {
    if (!window.confirm(`Tolgo dallo storico l'operazione del ${dataIt(f.data)}?`)) return
    const { error } = await supabase.from('profilazioni_mirate_fatte').delete().eq('id', f.id)
    if (error) { onError(error.message); return }
    setFatte(prev => prev.filter(x => x.id !== f.id))
  }

  // ─── editor del gruppo ───
  const editor = edit && (() => {
    const unaPersona = (edit.tipo || 'casino live') === 'casino live'   // 15/10/2026: la regola vale solo per il casinò live
    const infoTipo = TIPI_MIRATE.find(t => t.k === (edit.tipo || 'casino live')) || TIPI_MIRATE[0]
    const q = edit.cerca.trim().toLowerCase()
    // ricerca a più parole: "snai laura" trova Snai di Laura Corà
    const parole = q.split(/\s+/).filter(Boolean)
    // niente clienti terminati; tutti i risultati (con scorrimento) + "aggiungi tutti"
    const trovati = q.length < 2 ? [] : (books || []).filter(b => { const t = `${b.nome} ${b.intestatario || ''}`.toLowerCase(); return parole.every(w => t.includes(w)) && !edit.conti.includes(String(b.id)) && !(terminato && terminato(b.intestatario)) })
      .sort((a, b) => String(a.nome).localeCompare(String(b.nome)) || String(a.intestatario || '').localeCompare(String(b.intestatario || '')))
    const inAltri = id => (gruppi || []).find(g => g.id !== edit.id && (g.conti || []).map(String).includes(String(id)))
    // 03/10/2026 — conto già presente in altri gruppi: chiede conferma prima di aggiungerlo
    const gruppiDi = id => (gruppi || []).filter(g => g.id !== edit.id && (g.conti || []).map(String).includes(String(id))).map(g => g.nome)
    const etichetta = id => { const b = (books || []).find(x => String(x.id) === String(id)); return b ? `${b.nome} · ${b.intestatario || '—'}` : `conto ${id}` }
    // 05/10/2026: persona già nel gruppo con un altro conto → quel conto non si aggiunge
    const personaGiaNelGruppo = id => { if (!unaPersona) return null; const b = bookDi(id); const k = normNome(b?.intestatario); return k ? edit.conti.map(bookDi).find(x => x && normNome(x.intestatario) === k) : null }
    // 16/10/2026: cliccando un singolo conto la ricerca resta (tieniRicerca) e l'elenco non sparisce: si possono scegliere più conti di fila
    const aggiungiConti = (ids, tieniRicerca = false) => {
      let nuovi = ids.map(String).filter(id => !edit.conti.includes(id))
      // 05/10/2026: una persona = un conto: scarta chi è già nel gruppo e, tra i nuovi, tiene il primo conto di ogni persona
      const visti = new Set(edit.conti.map(bookDi).filter(Boolean).map(b => normNome(b.intestatario)))
      const scartati = []
      nuovi = nuovi.filter(id => { if (!unaPersona) return true; const k = normNome(bookDi(id)?.intestatario); if (k && visti.has(k)) { scartati.push(id); return false } if (k) visti.add(k); return true })
      if (scartati.length) onError(`⛔ Una persona = un conto per sessione. Non aggiunti: ${scartati.map(id => { const g = personaGiaNelGruppo(id); return `${etichetta(id)}${g ? ` (c'è già ${g.nome})` : ''}` }).join(', ')}`)
      if (!nuovi.length) { setEdit({ ...edit, cerca: tieniRicerca ? edit.cerca : '' }); return }
      const doppi = nuovi.filter(id => gruppiDi(id).length)
      let daAggiungere = nuovi
      if (doppi.length === 1 && nuovi.length === 1) {
        if (!window.confirm(`⚠️ ${etichetta(doppi[0])} è già in: ${gruppiDi(doppi[0]).join(', ')}.\n\nLo aggiungo anche a "${edit.nome || 'questo gruppo'}"?`)) return
      } else if (doppi.length) {
        const elenco = doppi.map(id => `• ${etichetta(id)} → già in ${gruppiDi(id).join(', ')}`).join('\n')
        const anche = window.confirm(`⚠️ ${doppi.length} di questi conti sono già in altre profilazioni mirate:\n\n${elenco}\n\nOK = aggiungo anche questi\nAnnulla = aggiungo solo i ${nuovi.length - doppi.length} conti nuovi`)
        if (!anche) daAggiungere = nuovi.filter(id => !doppi.includes(id))
      }
      setEdit({ ...edit, conti: [...edit.conti, ...daAggiungere], cerca: tieniRicerca ? edit.cerca : '' })
    }
    return (
      <div style={{ marginTop: 10, padding: 12, borderRadius: 12, border: '1px solid rgba(250,204,21,0.45)', background: 'rgba(250,204,21,0.05)' }}>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center', marginBottom: 8 }}>
          <input placeholder="Nome (es. Profilazione 1)" value={edit.nome} onChange={e => setEdit({ ...edit, nome: e.target.value })} style={{ ...inp, minWidth: 200 }} />
          <span style={{ fontSize: 12, color: '#cbd5e1' }}>ogni</span>
          <input type="number" min={1} value={edit.ogni_giorni} onChange={e => setEdit({ ...edit, ogni_giorni: e.target.value })} style={{ ...inp, width: 70 }} />
          <span style={{ fontSize: 12, color: '#cbd5e1' }}>giorni · {infoTipo.descr}</span>
          {TIPI_MIRATE.map(t => <button key={t.k} title={`Sposta il gruppo nella sezione ${t.nome}`} style={{ ...btn(t.colore), opacity: t.k === infoTipo.k ? 1 : 0.45, fontWeight: t.k === infoTipo.k ? 900 : 700 }} onClick={() => setEdit({ ...edit, tipo: t.k })}>{t.icona} {t.nome}</button>)}
        </div>
        <input placeholder="Aggiungi conti: cerca book o cliente (es. snai laura)" value={edit.cerca} onChange={e => setEdit({ ...edit, cerca: e.target.value })} style={{ ...inp, width: '100%' }} />
        {trovati.length > 0 && (
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 6, fontSize: 12, color: '#94a3b8' }}>
            <span>{trovati.length} conti trovati</span>
            <button style={btn('#facc15')} onClick={() => aggiungiConti(trovati.map(b => b.id))}>➕ Aggiungi tutti ({trovati.length})</button>
          </div>
        )}
        {trovati.length > 0 && (
          <div style={{ marginTop: 4, border: '1px solid #334155', borderRadius: 8, overflowY: 'auto', maxHeight: 320 }}>
            {trovati.map(b => {
              return <div key={b.id} onClick={() => aggiungiConti([b.id], true)} style={{ padding: '5px 10px', cursor: 'pointer', display: 'flex', gap: 8, fontSize: 12, borderTop: '1px solid #1e293b' }}>
                <b>{b.nome}</b><span style={{ color: '#94a3b8' }}>{b.intestatario || '—'}</span>
                {inAltri(b.id) && <span style={{ marginLeft: 'auto', color: '#fbbf24' }}>⚠️ già in {gruppiDi(b.id).join(', ')}</span>}
                {personaGiaNelGruppo(b.id) && <span style={{ marginLeft: inAltri(b.id) ? 8 : 'auto', color: '#f87171', fontWeight: 700 }}>⛔ {b.intestatario} è già nel gruppo con {personaGiaNelGruppo(b.id).nome}</span>}
              </div>
            })}
          </div>
        )}
        {(() => { const d = unaPersona ? personeDoppie(edit.conti.map(bookDi)) : []; return d.length > 0 && (
          <div style={{ marginTop: 8, padding: '6px 10px', borderRadius: 8, border: '1px solid rgba(248,113,113,0.6)', background: 'rgba(248,113,113,0.10)', color: '#fca5a5', fontSize: 12, fontWeight: 700 }}>
            ⛔ {d.map(x => `${x.persona} è presente ${x.conti.length} volte (${x.conti.map(b => b.nome).join(' + ')})`).join(' · ')}. Al casinò live ci si collega con un solo conto per persona: togline uno con ✕ prima di salvare.
          </div>) })()}
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4, marginTop: 8 }}>
          {edit.conti.map(id => { const b = bookDi(id); const doppio = unaPersona && b && personeDoppie(edit.conti.map(bookDi)).some(x => x.conti.some(c => String(c.id) === String(id))); return (
            <span key={id} style={{ fontSize: 12, padding: '3px 8px', borderRadius: 999, background: doppio ? 'rgba(248,113,113,0.15)' : 'rgba(250,204,21,0.12)', border: `1px solid ${doppio ? 'rgba(248,113,113,0.7)' : 'rgba(250,204,21,0.35)'}`, color: doppio ? '#fca5a5' : '#fde68a' }}>
              {doppio ? '⛔ ' : ''}              {b ? `${b.nome} · ${b.intestatario || '—'}` : `conto ${id}`} <span onClick={() => setEdit({ ...edit, conti: edit.conti.filter(x => x !== id) })} style={{ cursor: 'pointer', marginLeft: 4, color: '#f87171' }}>✕</span>
            </span>) })}
        </div>
        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 6, marginTop: 10 }}>
          <button style={btn('#94a3b8')} onClick={() => setEdit(null)}>Annulla</button>
          <button style={btn('#facc15')} onClick={salva}>💾 Salva gruppo ({edit.conti.length} conti)</button>
        </div>
      </div>
    )
  })()

  // riga di un gruppo (elenco semplice + finestra dettagli): la usano tutte le sezioni
  const renderRiga = ({ g, ultima, prossima, manuale }) => {
          const ritardo = prossima < oggi ? diffGiorni(prossima, oggi) : 0
          const stato = prossima <= oggi ? (ritardo ? `in ritardo di ${ritardo} gg` : 'da fare oggi') : `tra ${diffGiorni(oggi, prossima)} gg (${dataIt(prossima)})`
          const conti = (g.conti || []).map(bookDi).filter(Boolean)
          const nonProf = conti.filter(b => b.profilo_livello !== 'attivo')
          const libri = [...new Set(conti.map(b => b.nome))]
          const doppie = tipoMirata(g) === 'casino live' ? personeDoppie(conti) : []   // 05/10/2026 (dal 15/10 solo casinò live)
          // 05/10/2026 · riga semplice dell'elenco
          const tra = diffGiorni(oggi, prossima)
          const colore = tra <= 0 ? '#f87171' : tra === 1 ? '#fbbf24' : '#64748b'
          const quando = tra < 0 ? `in ritardo di ${-tra} gg` : tra === 0 ? 'OGGI' : tra === 1 ? 'domani' : `tra ${tra} gg`
          const problemi = (doppie.length ? 1 : 0) + (nonProf.length ? 1 : 0)
          const pos = posizioneGruppo(g, sessioniMirate, fatte, bookDi)   // 23/10/2026: posizione dei conti e soglie di pausa
          return (
            <React.Fragment key={g.id}>
            <div onClick={() => { setFinestra(null); setDettaglio(g.id) }} title="Clic per aprire tutti i dettagli"
              style={{ display: 'grid', gridTemplateColumns: '14px minmax(110px,1.2fr) minmax(130px,1fr) minmax(120px,1.4fr) 70px minmax(0,2fr)', gap: 10, alignItems: 'center',
                padding: '9px 12px', borderRadius: 10, cursor: 'pointer', background: 'rgba(11,18,32,0.75)', border: `1px solid ${tra <= 0 ? 'rgba(248,113,113,0.45)' : 'rgba(51,65,85,0.7)'}` }}>
              <span style={{ width: 11, height: 11, borderRadius: 6, background: colore, display: 'inline-block' }} />
              <b style={{ color: '#fde047', fontSize: 13.5 }}>{g.nome}</b>
              <span style={{ fontSize: 13, color: colore === '#64748b' ? '#cbd5e1' : colore, fontWeight: 800 }}>{quando} <span style={{ color: '#94a3b8', fontWeight: 400 }}>· {dataIt(prossima)}</span></span>
              <span style={{ fontSize: 12.5, color: '#cbd5e1', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{libri.join(', ') || '—'}</span>
              <span style={{ fontSize: 12.5, color: '#94a3b8' }}>{conti.length} conti</span>
              <span style={{ fontSize: 12, color: '#fde68a', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {problemi > 0 && <span style={{ color: doppie.length ? '#f87171' : '#fbbf24', marginRight: 8 }}>{doppie.length ? '⛔' : '⚠️'}</span>}
                {pos.daPausare.length > 0 && <span title={`${pos.daPausare.length} conti hanno raggiunto la soglia: metti in pausa la profilazione mirata`} style={{ color: '#f59e0b', fontWeight: 800, marginRight: 8 }}>⏸ {pos.daPausare.length} in pausa?</span>}
                {g.note ? `📝 ${g.note.replace(/\s+/g, ' ')}` : ''}
              </span>
            </div>
            {dettaglio === g.id && (
            <FinestraDettaglio win={finestra} titolo={`Profilazione · ${g.nome}`} onChiudi={() => { setFinestra(null); setDettaglio(null) }}>
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 6, marginBottom: 6 }}>
              {!finestra && <button style={btn('#38bdf8')} title="Apre il pannello in una finestra separata: la trascini sull'altro schermo"
                onClick={() => {
                  const w = window.open('', 'pt-dettaglio-mirata', 'popup=yes,width=1050,height=820')
                  if (!w) { window.alert('Il browser ha bloccato la nuova finestra: consenti i popup per questo sito (icona in alto a destra nella barra degli indirizzi) e riprova.'); return }
                  setFinestra(w)
                }}>↗ Finestra</button>}
              <button style={btn('#94a3b8')} onClick={() => { setFinestra(null); setDettaglio(null) }}>✕ Chiudi</button>
            </div>
            <div style={{ background: 'rgba(11,18,32,0.75)', border: `1px solid ${prossima <= oggi ? 'rgba(248,113,113,0.5)' : 'rgba(51,65,85,0.7)'}`, borderRadius: 12, padding: '8px 12px' }}>
              <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
                <b style={{ color: '#fde047', fontSize: 13 }}>{infoMirata(g).icona} {g.nome}</b>
                <span style={{ fontSize: 12, color: '#cbd5e1' }}>{conti.length} conti · {manuale ? `📅 data scelta da te (${dataIt(prossima)})` : `ogni ${g.ogni_giorni} gg`} · ultima {ultima ? dataIt(ultima) : 'mai'}</span>
                <span style={{ fontSize: 12, fontWeight: 800, color: prossima <= oggi ? '#f87171' : '#94a3b8' }}>{stato}</span>
                <span style={{ marginLeft: 'auto', display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                  {libri.length > 1 && <button style={{ ...btn('#0ea5e9'), fontWeight: 900 }} title="Apre tutti i book del gruppo sui telefoni giusti" onClick={() => apriSuTelefoni(conti, `tutti i book di "${g.nome}"`)}>📱 Apri tutti ({conti.length})</button>}
                  {onApri && libri.map(nb => <button key={nb} style={btn('#38bdf8')} title={`Apri ${nb} sui telefoni di questi conti`} onClick={() => onApri(nb, conti.filter(b => b.nome === nb))}>📱 {nb}</button>)}
                  {tipoMirata(g) === 'casino live' && <button style={{ ...btn('#a78bfa'), fontWeight: 900 }} title="Quanti numeri gioca ogni conto: copertura della roulette, sestine per Lottomatica/GoldBet" onClick={() => setNumeri(numeri === g.id ? null : g.id)}>🎰 Numeri</button>}
                  <button style={btn('#22c55e')} onClick={() => fatta(g)}>✅ Fatta</button>
                  <button style={btn('#94a3b8')} title="Scegli tu la data della prossima" onClick={() => scegliProssima(g, prossima)}>📅</button>
                  <button style={{ ...btn(g.note ? '#fbbf24' : '#94a3b8'), fontWeight: g.note ? 900 : 700 }} title={g.note ? 'Modifica la nota' : 'Aggiungi una nota (cosa fare la prossima volta)'} onClick={() => setNota(nota?.id === g.id ? null : { id: g.id, testo: g.note || '' })}>📝</button>
                  <button style={btn('#94a3b8')} onClick={() => setStorico(storico === g.id ? null : g.id)}>📜</button>
                  <button style={btn('#facc15')} onClick={() => { setDettaglio(null); setEdit({ id: g.id, tipo: tipoMirata(g), nome: g.nome, ogni_giorni: g.ogni_giorni, conti: (g.conti || []).map(String), cerca: '' }) }}>✏️</button>
                  <button style={btn('#f87171')} onClick={() => elimina(g)}>🗑</button>
                </span>
              </div>
              <div style={{ fontSize: 11, color: '#94a3b8', marginTop: 4, display: 'flex', flexWrap: 'wrap', gap: '2px 10px' }}>
                {conti.map(b => <span key={b.id} onClick={() => apriSuTelefoni([b], `${b.nome} di ${b.intestatario || '—'}`)} title="Clic: apri solo questo book sul suo telefono" style={{ cursor: 'pointer', textDecoration: 'underline dotted', textUnderlineOffset: 3 }}>📱 {b.nome} · {b.intestatario || '—'}</span>)}
              </div>
              {/* 05/10/2026 · 📝 nota del gruppo */}
              {g.note && nota?.id !== g.id && (
                <div onClick={() => setNota({ id: g.id, testo: g.note })} title="Clic per modificare"
                  style={{ marginTop: 6, padding: '6px 10px', borderRadius: 8, border: '1px solid rgba(251,191,36,0.5)', background: 'rgba(251,191,36,0.08)', color: '#fde68a', fontSize: 12.5, whiteSpace: 'pre-wrap', cursor: 'pointer' }}>
                  📝 {g.note}
                </div>
              )}
              {nota?.id === g.id && (
                <div style={{ marginTop: 6 }}>
                  <textarea autoFocus rows={3} value={nota.testo} onChange={e => setNota({ ...nota, testo: e.target.value })}
                    placeholder="Cosa devi fare la prossima volta? (es. alzare la puntata a Paolo, controllare il bonus di Federica…)"
                    style={{ ...inp, width: '100%', resize: 'vertical', fontFamily: 'inherit' }} />
                  <div style={{ display: 'flex', gap: 6, justifyContent: 'flex-end', marginTop: 4 }}>
                    {g.note && <button style={btn('#f87171')} onClick={() => setNota({ ...nota, testo: '' })}>Svuota</button>}
                    <button style={btn('#94a3b8')} onClick={() => setNota(null)}>Annulla</button>
                    <button style={btn('#fbbf24')} onClick={salvaNota}>💾 Salva nota</button>
                  </div>
                </div>
              )}
              {doppie.length > 0 && (
                <div style={{ fontSize: 12, color: '#fca5a5', fontWeight: 700, marginTop: 4 }}>
                  ⛔ {doppie.map(x => `${x.persona} ha ${x.conti.length} conti in questo gruppo (${x.conti.map(b => b.nome).join(' + ')})`).join(' · ')}: al casinò live solo un conto per persona. Correggi con ✏️.
                </div>
              )}
              {/* 23/10/2026 · posizione per conto e avviso di pausa (campionati baccarat, roulette, sport, slot) */}
              {pos.righe.length > 0 && (() => {
                const sp = pos.tipo === 'sport' || pos.tipo === 'slot'
                const th = (t, i) => <th key={t} style={{ textAlign: i ? 'right' : 'left', padding: '3px 8px', color: '#94a3b8', fontSize: 11, borderBottom: '1px solid #334155' }}>{t}</th>
                const td = (v, extra = {}) => ({ padding: '3px 8px', fontSize: 12, textAlign: 'right', color: '#cbd5e1', ...extra })
                const colNetto = n => n < 0 ? '#fca5a5' : n > 0 ? '#86efac' : '#cbd5e1'
                const intestazioni = sp ? ['Conto', 'Operazioni', `${tipoMirata(g) === 'slot' ? 'Girato' : 'Scommesso'} (pausa a ${euroIt(SOGLIA_EURO)})`]
                  : ['Conto', ...(pos.haBacc ? ['Campionati', 'Netto'] : []), ...(pos.haRoul ? ['Roulette', 'Puntato', 'P/L reale', 'Costo teorico'] : [])]
                return (
                <div style={{ marginTop: 8, padding: '8px 10px', borderRadius: 10, border: `1px solid ${pos.daPausare.length ? 'rgba(245,158,11,0.7)' : 'rgba(51,65,85,0.7)'}`, background: pos.daPausare.length ? 'rgba(245,158,11,0.08)' : 'rgba(11,18,32,0.5)' }}>
                  <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
                    <b style={{ fontSize: 12.5, color: '#fde68a' }}>{sp ? (tipoMirata(g) === 'slot' ? '🎲 Slot · girato per conto' : '⚽ Sport · scommesso per conto') : '🏁 Campionati e roulette · posizione per conto'}</b>
                    <span style={{ fontSize: 11, color: '#94a3b8' }}>{pos.operazioni} {sp ? (pos.operazioni === 1 ? 'operazione' : 'operazioni') : (pos.operazioni === 1 ? 'sessione' : 'sessioni')}{g.conteggio_dal ? ` dal ${dataIt(String(g.conteggio_dal).slice(0, 10))}` : ''}</span>
                    <button style={{ ...btn('#94a3b8'), marginLeft: 'auto', padding: '2px 8px', fontSize: 11 }} title="Dopo la pausa, quando i conti ripartono: il conteggio riparte da zero" onClick={() => ripartiConteggio(g)}>🔄 Riparto da zero</button>
                  </div>
                  {pos.daPausare.length > 0 && (
                    <div style={{ marginTop: 6, fontSize: 12.5, fontWeight: 800, color: '#fbbf24' }}>
                      ⏸ Metti in pausa la profilazione mirata per {pos.daPausare.length} {pos.daPausare.length === 1 ? 'conto' : 'conti'}:
                      {pos.daPausare.map(r => <div key={r.id} style={{ fontWeight: 600, color: '#fde68a' }}>• {r.nome} · {r.intestatario || '—'}: {r.motivi.join(' + ')}</div>)}
                    </div>
                  )}
                  {pos.senzaImporto > 0 && <div style={{ marginTop: 4, fontSize: 11.5, color: '#fbbf24' }}>⚠️ {pos.senzaImporto} {pos.senzaImporto === 1 ? 'registrazione senza importo non conta' : 'registrazioni senza importo non contano'} nel totale: indica sempre quanto ha giocato ogni conto in ✅ Fatta.</div>}
                  <table style={{ borderCollapse: 'collapse', width: '100%', marginTop: 6 }}>
                    <thead><tr>{intestazioni.map(th)}</tr></thead>
                    <tbody>
                      {pos.righe.map(r => (
                        <tr key={r.id}>
                          <td style={{ padding: '3px 8px', fontSize: 12, color: '#e2e8f0' }}>{r.daPausare ? '⏸ ' : ''}<b>{r.nome}</b> · {r.intestatario || '—'}</td>
                          {sp ? <>
                            <td style={td()}>{r.operazioni}</td>
                            <td style={td(0, { fontWeight: 800, color: r.giocato >= SOGLIA_EURO ? '#fbbf24' : '#cbd5e1' })}>{euroIt(r.giocato)}</td>
                          </> : <>
                            {pos.haBacc && <>
                              <td style={td(0, { color: r.bacc.sessioni >= SOGLIA_BACCARAT ? '#fbbf24' : '#cbd5e1', fontWeight: r.bacc.sessioni >= SOGLIA_BACCARAT ? 800 : 400 })}>{r.bacc.sessioni || '—'}</td>
                              <td style={td(0, { fontWeight: 800, color: colNetto(r.bacc.netto) })}>{r.bacc.sessioni ? segnoEuro(r.bacc.netto) : '—'}</td>
                            </>}
                            {pos.haRoul && <>
                              <td style={td(0, { color: r.roul.sessioni >= SOGLIA_ROULETTE ? '#fbbf24' : '#cbd5e1', fontWeight: r.roul.sessioni >= SOGLIA_ROULETTE ? 800 : 400 })}>{r.roul.sessioni || '—'}</td>
                              <td style={td(0, { color: '#94a3b8' })}>{r.roul.sessioni ? euroIt(r.roul.puntato) : '—'}</td>
                              <td style={td(0, { fontWeight: 800, color: colNetto(r.roul.netto) })}>{r.roul.conNumeri ? <>{segnoEuro(r.roul.netto)} <span style={{ color: '#64748b', fontWeight: 400 }}>({r.roul.conNumeri}/{r.roul.sessioni})</span></> : '—'}</td>
                              <td style={td(0, { color: r.roul.sessioni ? '#fca5a5' : '#cbd5e1' })}>{r.roul.sessioni ? `-${euroIt(r.roul.costo)}` : '—'}</td>
                            </>}
                          </>}
                        </tr>))}
                      <tr>
                        <td style={{ padding: '4px 8px', fontSize: 12, textAlign: 'right', color: '#94a3b8', borderTop: '1px solid #334155' }}>Totale gruppo</td>
                        {sp ? <>
                          <td style={{ borderTop: '1px solid #334155' }} />
                          <td style={td(0, { fontWeight: 900, borderTop: '1px solid #334155' })}>{euroIt(pos.totGiocato)}</td>
                        </> : <>
                          {pos.haBacc && <><td style={{ borderTop: '1px solid #334155' }} /><td style={td(0, { fontWeight: 900, borderTop: '1px solid #334155', color: colNetto(pos.totBacc) })}>{segnoEuro(pos.totBacc)}</td></>}
                          {pos.haRoul && <><td style={{ borderTop: '1px solid #334155' }} /><td style={td(0, { borderTop: '1px solid #334155', color: '#94a3b8' })}>{euroIt(pos.totRoulPuntato)}</td><td style={td(0, { fontWeight: 900, borderTop: '1px solid #334155', color: colNetto(pos.totRoulNetto) })}>{pos.totRoulNetto ? segnoEuro(pos.totRoulNetto) : '—'}</td><td style={td(0, { fontWeight: 900, borderTop: '1px solid #334155', color: '#fca5a5' })}>-{euroIt(pos.totRoul)}</td></>}
                        </>}
                      </tr>
                    </tbody>
                  </table>
                  {!sp && pos.haRoul && <div style={{ marginTop: 4, fontSize: 11, color: '#64748b' }}>Roulette: il P/L reale viene dai numeri usciti scritti nelle sessioni (tra parentesi: sessioni con i numeri su quelle giocate). Il costo teorico considera tutto il puntato e il payout di ogni sessione (con 1:35 è 1/37).</div>}
                </div>)
              })()}
              {/* 23/10/2026 · 🎯 numeri usciti delle roulette di oggi: da scrivere o correggere dopo il salvataggio */}
              {tipoMirata(g) === 'casino live' && (() => {
                const oggiR = (sessioniMirate || []).filter(x => x.gruppo === g.nome && x.giorno === oggi && x.gioco !== 'baccarat' && (x.partecipanti || []).some(p => (p?.numeri || []).length)).sort((a, b) => (Number(a.numero) || 0) - (Number(b.numero) || 0))
                if (!oggiR.length) return null
                return (
                  <div style={{ marginTop: 8, padding: '8px 10px', borderRadius: 10, border: '1px solid rgba(167,139,250,0.5)', background: 'rgba(167,139,250,0.06)' }}>
                    <b style={{ fontSize: 12.5, color: '#c4b5fd' }}>🎯 Numeri usciti · roulette di oggi</b>
                    {oggiR.map(x => {
                      const giri = Number(x.giri_fatti) || 0
                      const salvati = (x.partecipanti || []).find(p => Array.isArray(p?.usciti))?.usciti || []
                      const completa = giri > 0 && salvati.length === giri
                      const val = numeriOggi[x.id] ?? Array.from({ length: giri }, (_, i) => salvati[i] !== undefined ? String(salvati[i]) : '')
                      const paga = (x.partecipanti || []).find(p => Number(p?.paga) > 0)?.paga
                      return (
                        <div key={x.id} style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap', marginTop: 6, fontSize: 12 }}>
                          <span style={{ color: '#e2e8f0', minWidth: 120 }}>Sessione {x.numero} · {giri} {giri === 1 ? 'giro' : 'giri'}{paga ? ` · paga 1:${paga}` : ''}</span>
                          {val.map((v, i) => <input key={i} inputMode="numeric" placeholder="0-36" value={v} onChange={e => { const t = e.target.value.replace(/[^0-9]/g, '').slice(0, 2); if (t !== '' && Number(t) > 36) return; setNumeriOggi(prev => { const n = [...val]; n[i] = t; return { ...prev, [x.id]: n } }) }} style={{ ...inp, width: 46, textAlign: 'center', padding: '4px 6px' }} />)}
                          <button style={{ ...btn('#a78bfa'), padding: '3px 10px' }} onClick={() => salvaNumeriUsciti(x, val)}>💾 Salva</button>
                          <span style={{ color: completa ? '#86efac' : '#fbbf24' }}>{completa ? '✓ numeri inseriti' : '⚠️ numeri mancanti: il P/L non è calcolato'}</span>
                        </div>)
                    })}
                  </div>)
              })()}
              {numeri === g.id && (
                <div style={{ marginTop: 8 }}>
                  <SessioneLivePanel books={books} contiIniziali={conti} origine="mirata" gruppo={g.nome}
                    apriContiSuTelefoni={apriSuTelefoni} onMessage={onMessage} onError={onError}
                    onSalvata={async (opz) => { if (!opz?.rigioca) setNumeri(null); if (!(fatte || []).some(f => String(f.gruppo_id) === String(g.id) && f.data === oggi)) await fatta(g, true); await avvisoPausa(g) }} />
                </div>
              )}
              {nonProf.length > 0 && (
                <div style={{ fontSize: 11, color: '#fbbf24', marginTop: 4, display: 'flex', gap: 6, flexWrap: 'wrap', alignItems: 'center' }}>
                  ⚠️ non in profilazione: {onProfilazioneTutti && nonProf.length > 1 && <button style={{ ...btn('#22c55e'), padding: '2px 8px', fontSize: 11, fontWeight: 900 }} onClick={() => { if (window.confirm(`Metto in profilazione tutti i ${nonProf.length} conti?`)) onProfilazioneTutti(nonProf.map(b => b.id)) }}>🟢 Tutti ({nonProf.length})</button>}{nonProf.map(b => <button key={b.id} style={{ ...btn('#22c55e'), padding: '2px 6px', fontSize: 11 }} onClick={() => onProfilazione(b.id)}>🟢 {b.nome} · {b.intestatario}</button>)}
                </div>
              )}
              {storico === g.id && (
                <div style={{ marginTop: 6, borderTop: '1px solid rgba(51,65,85,0.6)', paddingTop: 6 }}>
                  {(fatte || []).filter(f => f.gruppo_id === g.id).sort((a, b) => b.data.localeCompare(a.data)).map(f => (
                    <div key={f.id} style={{ fontSize: 11, color: '#cbd5e1', display: 'flex', gap: 8, alignItems: 'center' }}>
                      <span style={{ minWidth: 70 }}>{dataIt(f.data)}</span>
                      <span style={{ flex: 1 }}>{(f.conti || []).map(bookDi).filter(Boolean).map(b => `${b.nome} · ${b.intestatario}`).join(', ')}</span>
                      <span onClick={() => annullaFatta(f)} style={{ cursor: 'pointer', color: '#f87171' }}>✕</span>
                    </div>))}
                  {!(fatte || []).some(f => f.gruppo_id === g.id) && <div style={{ fontSize: 11, color: '#64748b' }}>Ancora nessuna operazione registrata.</div>}
                </div>
              )}
            </div>
            </FinestraDettaglio>
            )}
            </React.Fragment>
          )
  }

  return (
    <div style={{ background: 'rgba(250,204,21,0.05)', border: '1px solid rgba(250,204,21,0.35)', borderRadius: 16, padding: '12px 16px', marginBottom: 16 }}>
      <div onClick={() => setAperto(!aperto)} style={{ fontSize: 14, fontWeight: 900, color: '#fde047', cursor: 'pointer' }}>
        🎯 Profilazioni mirate · {(gruppi || []).length} gruppi{daFare ? <span style={{ color: '#f87171' }}> · {daFare} da fare</span> : ''} {aperto ? '▾' : '▸'}
      </div>
      {aperto && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginTop: 10 }}>
          {TIPI_MIRATE.map(t => {
            const dellaSezione = righe.filter(r => tipoMirata(r.g) === t.k)
            const daFareT = dellaSezione.filter(r => r.prossima <= oggi).length
            const chiusa = !!chiuse[t.k]
            const inModifica = !!edit && (edit.tipo || 'casino live') === t.k
            return (
              <div key={t.k} style={{ border: `1px solid ${t.colore}55`, background: `${t.colore}0d`, borderRadius: 12, padding: '8px 12px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                  <div onClick={() => setChiuse({ ...chiuse, [t.k]: !chiusa })} style={{ fontSize: 13.5, fontWeight: 900, color: t.colore, cursor: 'pointer' }}>
                    {t.icona} {t.nome} · {dellaSezione.length} gruppi{daFareT ? <span style={{ color: '#f87171' }}> · {daFareT} da fare</span> : ''} {chiusa ? '▸' : '▾'}
                  </div>
                  {!edit && <button style={btn(t.colore)} onClick={() => setEdit({ tipo: t.k, nome: `${t.prefisso} ${dellaSezione.length + 1}`, ogni_giorni: 7, conti: [], cerca: '' })}>➕ Nuovo gruppo</button>}
                </div>
                {inModifica && editor}
                {!chiusa && (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginTop: 8 }}>
                    {dellaSezione.length === 0 && !inModifica && <div style={{ fontSize: 12, color: '#94a3b8' }}>{t.vuoto}</div>}
                    {dellaSezione.map(renderRiga)}
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}
      {scegliData && (
        <SceltaData titolo={`📅 ${scegliData.g.nome}: quando fai la prossima?`} valore={scegliData.valore} etichettaAuto={`Cadenza automatica (${scegliData.g.ogni_giorni} gg)`}
          onConferma={iso => salvaProssima(scegliData.g, iso)} onAnnulla={() => setScegliData(null)} />
      )}
    </div>
  )
}
