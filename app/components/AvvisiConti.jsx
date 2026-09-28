"use client";
// ════════════════════════════════════════════════════════════════════
// AVVISI CONTI (27/09/2026) — sistema unico degli avvisi, tabella avvisi_conti.
// Regola fondamentale di Sergio: OGNI avviso si può rimandare e non si perde MAI finché non lo segna ✅ Fatto,
// e il Fatto chiede sempre una conferma. Un avviso non gestito resta in cima con "in ritardo da X giorni".
// Unica eccezione: se Sergio toglie a mano la parola chiave dalla nota, gli avvisi aperti di quel flusso si annullano.
//
// Flussi (dalle parole chiave delle note, vedi noteConti.js):
//   recupero (limitato bonus / sport) · assistenza · riapertura (chiudere e riaprire, max 2 a settimana)
//   documento (per intestatario, 3 invii al giorno) · live (appuntamento con la persona, 1 al giorno)
// Popup "Book con note da attenzionare": note senza parole chiave; il flag cancella la nota (testo nello storico).
// ════════════════════════════════════════════════════════════════════
import React, { useEffect, useRef, useState } from 'react'
import { supabase } from '../profit-tracker/supabaseClient'
import { paroleChiave, motivoAssistenza, togliParola, aggiornaNotaBook, notaDaAttenzionare, pulisciNota, annullaAvvisiFlusso, aggiungiParola, soloParoleChiave, testoExtra, improntaNota } from './noteConti'
import { contiInRecupero, avvisiRecupero, limitazioniDaNota, registraEsitoRecupero, MAX_RECUPERI_ATTIVI, recuperoSport } from './RecuperoConti'

// ─── PARAMETRI ──────────────────────────────────────────────────────
export const RIAPERTURE_SETTIMANA = 2      // chiudere e riaprire: massimo 2 conti a settimana
export const INVII_DOCUMENTO_GIORNO = 3    // inviare documento: 3 book al giorno, lun-ven
export const GIORNI_VERIFICA_DOCUMENTO = 3 // dopo l'invio (o la seduta live): verifica l'esito dopo 3 giorni
export const GIORNI_ATTESA_ASSISTENZA = 7  // assistenza "in attesa di risposta": ricontrolla dopo 7 giorni
export const GIORNI_RIFIUTO_ASSISTENZA = 30 // assistenza "rifiutato": nuovo tentativo dopo 30 giorni
// 27/09/2026 — tetto giornaliero per le cose "una tantum" nate tutte insieme (es. il primo giorno):
// le eccedenze vengono spalmate sui giorni feriali successivi. Il recupero settimanale non è toccato.
// I recuperi SPORT li colloca SEMPRE Lucy negli incroci: non compaiono mai in plancia da fare a mano.
// Se Lucy non riesce a collocarli restano in coda da lei (in fondo al giro) finché non conferma la bet.
export const TETTO_GIORNO = { assistenza: 2, live: 1, documento: 1, nota: 3 }
export const NOTE_AI_PER_SESSIONE = 40      // massimo di note lette dall'AI per ogni apertura (tetto di sicurezza sui costi)

// ─── DATE ───────────────────────────────────────────────────────────
const oggiISO = () => new Date().toLocaleDateString('sv-SE')
const addGiorni = (iso, n) => { const d = new Date(iso + 'T00:00:00'); d.setDate(d.getDate() + n); return d.toLocaleDateString('sv-SE') }
const diffGiorni = (da, a) => Math.round((new Date(a + 'T00:00:00') - new Date(da + 'T00:00:00')) / 86400000)
const dataIt = (iso) => iso ? iso.split('-').reverse().join('/') : ''
const lunediDi = (iso) => { const d = new Date(iso + 'T00:00:00'); const g = (d.getDay() + 6) % 7; return addGiorni(iso, -g) }
const feriale = (iso) => { const g = new Date(iso + 'T00:00:00').getDay(); return g >= 1 && g <= 5 }
const prossimoFeriale = (iso) => { let d = addGiorni(iso, 1); while (!feriale(d)) d = addGiorni(d, 1); return d }
const hashStr = (t) => { let h = 2166136261; const s = String(t); for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619) } h ^= h >>> 15; h = Math.imul(h, 2246822507); h ^= h >>> 13; return h >>> 0 }
const norm = (s) => String(s || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/\s+/g, ' ').trim()

// Chiudere e riaprire: due giorni feriali diversi e casuali per ogni settimana
function giorniSlotSettimana(lunedi) {
  const a = hashStr(`${lunedi}|riap|a`) % 5
  let b = hashStr(`${lunedi}|riap|b`) % 4
  if (b >= a) b++
  return [a, b].sort((x, y) => x - y).map(g => addGiorni(lunedi, g))
}
// Primo posto libero da dataMin: max 2 a settimana, mai lo stesso intestatario o lo stesso book nella stessa settimana
function prossimoSlot(dataMin, book, occupati) {
  let lun = lunediDi(dataMin)
  for (let w = 0; w < 156; w++, lun = addGiorni(lun, 7)) {
    const dom = addGiorni(lun, 6)
    const sett = occupati.filter(o => o.data >= lun && o.data <= dom)
    if (sett.length >= RIAPERTURE_SETTIMANA) continue
    if (sett.some(o => norm(o.intestatario) === norm(book.intestatario) || norm(o.nome) === norm(book.nome))) continue
    const liberi = giorniSlotSettimana(lun).filter(d => d >= dataMin && !sett.some(o => o.data === d))
    if (liberi.length) return liberi[0]
  }
  return addGiorni(dataMin, 7)
}
// Primo giorno feriale da dataMin con meno di 3 invii documento
function prossimoGiornoInvio(dataMin, occupati) {
  let d = feriale(dataMin) ? dataMin : prossimoFeriale(dataMin)
  for (let i = 0; i < 400; i++) {
    if (occupati.filter(x => x === d).length < INVII_DOCUMENTO_GIORNO) return d
    d = prossimoFeriale(d)
  }
  return d
}

const ICONA = { lucy: '🎯', nota: '🤖', recupero: '🔧', assistenza: '🎧', riapertura: '🔁', documento: '📄', live: '🎥' }
const NOME_FLUSSO = { lucy: 'Bet di Lucy non fatte da più di 3 giorni', nota: 'Dalle note (letti dall\'AI)', recupero: 'Recupero conti limitati', assistenza: 'Sentire assistenza', riapertura: 'Chiudere e riaprire', documento: 'Inviare documento', live: 'Riconoscimento live' }

// Esiti da scegliere quando si preme Fatto (null = basta la conferma)
function esitiDi(a) {
  const m = a.meta || {}
  if (a.tipo === 'recupero' && m.azione === 'contatto') return [{ k: 'attesa', l: 'In attesa di risposta' }, { k: 'no', l: 'Rifiutato' }, { k: 'ok', l: 'Sbloccato' }]
  if (a.tipo === 'recupero' && m.azione === 'verifica_sport') return [{ k: 'ancora', l: 'Ancora limitato' }, { k: 'tolta', l: 'Limitazione tolta' }]
  if (a.tipo === 'assistenza') return [{ k: 'risolto', l: 'Risolto' }, { k: 'attesa', l: `In attesa (ricontrollo tra ${GIORNI_ATTESA_ASSISTENZA} gg)` }, { k: 'rifiutato', l: `Rifiutato (riprovo tra ${GIORNI_RIFIUTO_ASSISTENZA} gg)` }]
  if (a.tipo === 'riapertura' && m.passo === 'login') return [{ k: 'ok', l: 'Si apre, tutto normale' }, { k: 'nonapre', l: 'Non si apre → riapertura' }, { k: 'strano', l: 'Avvisi strani → chiusura e riapertura' }]
  if (a.tipo === 'documento' && m.passo === 'verifica') return [{ k: 'approvato', l: 'Approvato' }, { k: 'rifiutato', l: 'Rifiutato → reinvio' }]
  if (a.tipo === 'live' && m.passo === 'verifica') return [{ k: 'approvato', l: 'Approvato' }, { k: 'rifiutato', l: 'Rifiutato → nuovo appuntamento' }]
  if (a.tipo === 'live' && m.passo === 'appuntamento') return 'data'
  return null
}

const inp = { background: '#0b1220', color: '#f8fafc', border: '1px solid rgba(51,65,85,0.9)', borderRadius: 8, padding: '5px 8px', fontSize: 12 }
const btn = (c) => ({ padding: '5px 10px', borderRadius: 8, border: `1px solid ${c}66`, background: `${c}1a`, color: c, fontWeight: 700, fontSize: 12, cursor: 'pointer' })

// ════════════════════════════════════════════════════════════════════
export default function AvvisiContiPanel({ books, setBooks, avvisi, setAvvisi, recuperi, setRecuperi, getRecuperoProtocollo, lucyColloca, onMessage, onError }) {
  const oggi = oggiISO()
  const [mostra, setMostra] = useState(true)
  const [mostraFuturi, setMostraFuturi] = useState(false)
  const [azione, setAzione] = useState(null)      // { id, modo: 'fatto' | 'rimanda', data }
  const [salvando, setSalvando] = useState(false)
  const [popupNote, setPopupNote] = useState(false)
  const [sequenza, setSequenza] = useState(false)
  // ─── NOTE LETTE DALL'AI (tabella note_ai, route /api/note-ai) ───
  const [noteAi, setNoteAi] = useState(null)          // null = non ancora caricate
  const [aiInCorso, setAiInCorso] = useState(0)
  const [aiErrore, setAiErrore] = useState('')
  const [bozze, setBozze] = useState({})              // modifiche alla proposta prima della conferma, per book
  const aiLette = useRef(0)
  const aiAttivo = useRef(false)   // 🧹 "Ho tempo": tutte le cose da fare in sequenza, anche quelle future
  const tentate = useRef(new Set())
  const bookDi = (id) => (books || []).find(b => String(b.id) === String(id)) || null
  const aperti = (avvisi || []).filter(a => a.stato === 'aperto')

  // ─── scrittura ────────────────────────────────────────────────────
  async function inserisci(righe) {
    const nuove = righe.filter(r => !(avvisi || []).some(a => a.chiave === r.chiave))
    if (!nuove.length) return []
    const payload = nuove.map(r => ({ chiave: r.chiave, tipo: r.tipo, book_id: r.book_id != null ? String(r.book_id) : null, titolo: r.titolo, sottotitolo: r.sottotitolo || null, data_prevista: r.data_prevista || oggi, stato: 'aperto', meta: r.meta || {} }))
    const { data, error } = await supabase.from('avvisi_conti').upsert(payload, { onConflict: 'user_id,chiave', ignoreDuplicates: true }).select()
    if (error) { onError('Errore avvisi: ' + error.message + ' (hai lanciato avvisi_conti.sql?)'); return [] }
    if (data && data.length) setAvvisi(prev => [...prev, ...data.filter(d => !prev.some(p => p.id === d.id))])
    return data || []
  }
  async function aggiornaAvviso(a, campi) {
    const { data, error } = await supabase.from('avvisi_conti').update(campi).eq('id', a.id).select().single()
    if (error) { onError('Errore avvisi: ' + error.message); return null }
    setAvvisi(prev => prev.map(x => x.id === a.id ? data : x))
    return data
  }

  // ─── occupazione dei calendari ────────────────────────────────────
  const slotOccupati = (escludiId = null, extra = []) => [
    ...(avvisi || []).filter(a => a.meta?.slot && a.stato !== 'annullato' && a.id !== escludiId)
      .map(a => { const b = bookDi(a.book_id); return { data: a.data_prevista, nome: b?.nome || a.meta?.nome, intestatario: b?.intestatario || a.meta?.intestatario } }),
    ...extra
  ]
  const inviiOccupati = (extra = []) => [...(avvisi || []).filter(a => a.tipo === 'documento' && a.meta?.passo === 'invio' && a.stato !== 'annullato').map(a => a.data_prevista), ...extra]

  const apertoPer = (flusso, bookId) => aperti.some(a => (a.meta?.flusso === flusso) && (String(a.book_id) === String(bookId) || (a.meta?.book_ids || []).map(String).includes(String(bookId))))

  // ─── GENERAZIONE: dalle note e dal recupero nascono gli avvisi che mancano ───
  useEffect(() => {
    if (!books || !books.length || !Array.isArray(avvisi)) return
    const nuovi = []
    const chiaviEsistenti = new Set(avvisi.map(a => a.chiave))
    const aggiungi = (r) => { if (!chiaviEsistenti.has(r.chiave) && !tentate.current.has(r.chiave)) { tentate.current.add(r.chiave); chiaviEsistenti.add(r.chiave); nuovi.push(r) } }

    // recupero conti limitati
    for (const it of contiInRecupero(books, recuperi, getRecuperoProtocollo))
      for (const r of avvisiRecupero(it, oggi)) aggiungi({ ...r, book_id: it.book.id })

    const conFlusso = (f) => books.filter(b => paroleChiave(b.note).includes(f) && !apertoPer(f, b.id))

    // sentire assistenza
    for (const b of conFlusso('assistenza')) {
      const motivo = motivoAssistenza(b.note)
      aggiungi({ chiave: `ass|${b.id}|${oggi}`, tipo: 'assistenza', book_id: b.id, titolo: `Sentire l'assistenza: ${motivo || 'motivo non indicato nella nota (avviso generico)'}`, meta: { flusso: 'assistenza', passo: 'contatto' } })
    }

    // chiudere e riaprire: calendario max 2 a settimana, AdmiralBet (non in uso) in fondo alla coda
    const riap = conFlusso('riapertura').sort((a, b) => (norm(a.nome).includes('admiral') - norm(b.nome).includes('admiral')) || norm(a.nome).localeCompare(norm(b.nome)) || norm(a.intestatario).localeCompare(norm(b.intestatario)))
    const extraSlot = []
    for (const b of riap) {
      const d = prossimoSlot(oggi, b, slotOccupati(null, extraSlot))
      extraSlot.push({ data: d, nome: b.nome, intestatario: b.intestatario })
      aggiungi({ chiave: `riap|${b.id}|${oggi}`, tipo: 'riapertura', book_id: b.id, data_prevista: d, titolo: 'Fai il login e controlla il conto', sottotitolo: 'Se non si apre → riapertura · se dà avvisi strani → chiusura e riapertura', meta: { flusso: 'riapertura', passo: 'login', slot: true, nome: b.nome, intestatario: b.intestatario } })
    }

    // inviare documento e riconoscimento live: raggruppati per intestatario
    for (const [flusso, pref] of [['documento', 'doc|prepara'], ['live', 'live|appuntamento']]) {
      const gruppi = {}
      for (const b of conFlusso(flusso)) { const k = norm(b.intestatario) || `book${b.id}`; (gruppi[k] = gruppi[k] || []).push(b) }
      for (const [k, lista] of Object.entries(gruppi)) {
        const intest = lista[0].intestatario || '—'
        const elenco = lista.map(b => b.nome).join(', ')
        if (flusso === 'documento') aggiungi({ chiave: `${pref}|${k}|${oggi}`, tipo: 'documento', book_id: null, titolo: `Procura un documento valido di ${intest}`, sottotitolo: `Poi lo invii a: ${elenco} (${INVII_DOCUMENTO_GIORNO} book al giorno)`, meta: { flusso, passo: 'prepara', book_ids: lista.map(b => String(b.id)), intestatario: intest } })
        else aggiungi({ chiave: `${pref}|${k}|${oggi}`, tipo: 'live', book_id: null, titolo: `Fissa l'appuntamento con ${intest} per il riconoscimento live`, sottotitolo: `Nella stessa seduta: ${elenco}`, meta: { flusso, passo: 'appuntamento', book_ids: lista.map(b => String(b.id)), intestatario: intest } })
      }
    }
    if (nuovi.length) inserisci(nuovi)

    // Annullo automatico SOLO per lo sport bloccato per sempre (il pulsante 🚫 ha già chiesto la conferma).
    // Una parola chiave tolta a mano dalla nota NON annulla niente: l'avviso va tra quelli da confermare.
    const daAnnullare = aperti.filter(a => a.meta?.flusso === 'sport' && a.book_id && bookDi(a.book_id)?.sport_bloccato)
    // …e per i recuperi rimasti in CODA (tetto ai recuperi attivi): le loro azioni non vanno fatte finché non tornano attivi
    // (solo quando i posti attivi sono pieni: altrimenti la promozione è ancora in corso e il conto potrebbe entrare)
    const postiPieni = (recuperi || []).filter(x => x.attivo_dal).length >= MAX_RECUPERI_ATTIVI
    for (const a of aperti) {
      if (a.tipo !== 'recupero' || daAnnullare.includes(a)) continue
      const rr = (recuperi || []).find(x => String(x.book_id) === String(a.book_id) && x.tipo === a.meta?.flusso)
      if (!postiPieni && !rr?.in_attesa_manuale) continue
      const r = (recuperi || []).find(x => String(x.book_id) === String(a.book_id) && x.tipo === a.meta?.flusso)
      if (r && !r.attivo_dal) daAnnullare.push(a)
    }
    if (daAnnullare.length) {
      supabase.from('avvisi_conti').update({ stato: 'annullato', esito: 'parola chiave tolta dalla nota' }).in('id', daAnnullare.map(a => a.id)).select()
        .then(({ data }) => { if (data) setAvvisi(prev => prev.map(x => data.find(d => d.id === x.id) || x)) })
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [books, avvisi, recuperi])

  // ─── RIPARTIZIONE: se oggi sono nati troppi avvisi dello stesso tipo, sposta gli eccedenti sui prossimi giorni feriali ───
  const ripartito = useRef(false)
  useEffect(() => {
    if (!Array.isArray(avvisi) || !avvisi.length || ripartito.current) return
    ripartito.current = true
    const tipoTetto = (a) => a.tipo === 'assistenza' ? 'assistenza' : a.tipo === 'nota' ? 'nota' : (a.tipo === 'live' && a.meta?.passo === 'appuntamento') ? 'live' : (a.tipo === 'documento' && a.meta?.passo === 'prepara') ? 'documento' : null
    const nuoviDiOggi = (avvisi || []).filter(a => a.stato === 'aperto' && a.data_prevista === oggi && !(a.rimandi > 0) && tipoTetto(a) && new Date(a.creato).toLocaleDateString('sv-SE') === oggi)
    const occupati = {}   // tipo|data → quanti
    for (const a of avvisi) { const t = tipoTetto(a); if (t && a.stato !== 'annullato') { const k = `${t}|${a.data_prevista}`; occupati[k] = (occupati[k] || 0) + 1 } }
    const spostamenti = []
    for (const t of Object.keys(TETTO_GIORNO)) {
      const lista = nuoviDiOggi.filter(a => tipoTetto(a) === t).sort((x, y) => x.id - y.id)
      let oggiUsati = occupati[`${t}|${oggi}`] || 0
      for (const a of lista.slice().reverse()) {          // i più recenti sono i primi a spostarsi
        if (oggiUsati <= TETTO_GIORNO[t]) break
        let d = prossimoFeriale(oggi)
        while ((occupati[`${t}|${d}`] || 0) >= TETTO_GIORNO[t]) d = prossimoFeriale(d)
        occupati[`${t}|${d}`] = (occupati[`${t}|${d}`] || 0) + 1
        oggiUsati--
        spostamenti.push({ id: a.id, data: d })
      }
    }
    if (!spostamenti.length) return
    ;(async () => {
      const aggiornati = []
      for (const sp of spostamenti) {
        const { data } = await supabase.from('avvisi_conti').update({ data_prevista: sp.data }).eq('id', sp.id).select().single()
        if (data) aggiornati.push(data)
      }
      if (aggiornati.length) setAvvisi(prev => prev.map(x => aggiornati.find(d => d.id === x.id) || x))
    })()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [avvisi])

  // ─── azioni collegate agli esiti ──────────────────────────────────
  async function togliDallaNota(book, flusso, motivo) {
    if (!book) return
    await aggiornaNotaBook(book, togliParola(book.note, flusso), motivo, setBooks)
    await annullaAvvisiFlusso(book.id, flusso, `flusso chiuso: ${motivo}`, setAvvisi)   // gli altri avvisi di quel flusso non servono più
  }

  // ─── AVVISI "ORFANI": la parola chiave non c'è più nella nota, ma nessuno ha confermato ───
  const libriDi = (a) => (a.book_id ? [a.book_id] : (a.meta?.book_ids || [])).map(bookDi).filter(Boolean)
  const haParola = (b, f) => (f === 'bonus' || f === 'sport') ? limitazioniDaNota(b.note).includes(f) : paroleChiave(b.note).includes(f)
  const orfano = (a) => { const f = a.meta?.flusso; const lib = libriDi(a); return !!f && lib.length > 0 && !lib.some(b => haParola(b, f)) }
  const NOME_PAROLA = { bonus: 'limitato bonus', sport: 'limitato sport', assistenza: 'sentire assistenza', riapertura: 'chiudere e riaprire', documento: 'inviare documento', live: 'riconoscimento live' }

  async function annullaOrfano(a) {
    const lib = libriDi(a)
    const chi = lib.map(b => `${b.nome} – ${b.intestatario || '—'}`).join(', ')
    if (!window.confirm(`⚠️ Qualcuno ha tolto "${NOME_PAROLA[a.meta.flusso]}" dalla nota di:\n${chi}\n\nAvviso: ${a.titolo}\n\nConfermi che è stato fatto apposta e che l'avviso va ANNULLATO?`)) return
    if (!window.confirm(`Ultima conferma: annullo l'avviso "${a.titolo}"? Non verrà più riproposto.`)) return
    setSalvando(true)
    await aggiornaAvviso(a, { stato: 'annullato', esito: 'parola chiave tolta dalla nota, annullo confermato' })
    setSalvando(false)
    onMessage(`Avviso annullato: ${a.titolo}`)
  }
  async function ripristinaOrfano(a) {
    const lib = libriDi(a)
    if (!window.confirm(`Rimetto "${NOME_PAROLA[a.meta.flusso].toUpperCase()}" nella nota di:\n${lib.map(b => `${b.nome} – ${b.intestatario || '—'}`).join('\n')}\n\nL'avviso resta attivo com'era.`)) return
    setSalvando(true)
    try {
      for (const b of lib) await aggiornaNotaBook(b, aggiungiParola(b.note, a.meta.flusso), 'parola chiave ripristinata dopo cancellazione', setBooks)
      onMessage(`↩️ Parola chiave ripristinata: ${lib.map(b => b.nome).join(', ')}`)
    } catch (e) { onError('Errore: ' + e.message) }
    setSalvando(false)
  }
  async function rigaRecupero(book, tipo) {
    const r = (recuperi || []).find(x => String(x.book_id) === String(book.id) && x.tipo === tipo)
    if (r) return r
    const { data, error } = await supabase.from('recupero_conti').upsert([{ book_id: book.id, tipo, iniziato: oggi }], { onConflict: 'book_id,tipo' }).select().single()
    if (error) throw error
    setRecuperi(prev => [...prev.filter(x => x.id !== data.id), data])
    return data
  }
  async function chiudiRecupero(book, tipo, motivo) {
    await togliDallaNota(book, tipo, motivo)
    const r = (recuperi || []).find(x => String(x.book_id) === String(book.id) && x.tipo === tipo)
    await registraEsitoRecupero(book, tipo, r, 'recuperato')
    if (r) { await supabase.from('recupero_conti').delete().eq('id', r.id); setRecuperi(prev => prev.filter(x => x.id !== r.id)) }
  }

  async function dopoFatto(a, esito, dataScelta) {
    const m = a.meta || {}
    const book = bookDi(a.book_id)
    const et = book ? `${book.nome} (${book.intestatario || '—'})` : (m.intestatario || '')
    // RECUPERO
    if (a.tipo === 'recupero' && m.azione === 'contatto' && book) {
      const r = await rigaRecupero(book, m.flusso)
      const tentativi = [...(r.tentativi || []), { data: oggi, esito, nota: 'registrato dagli avvisi' }]
      const { data } = await supabase.from('recupero_conti').update({ tentativi }).eq('id', r.id).select().single()
      if (data) setRecuperi(prev => prev.map(x => x.id === data.id ? data : x))
      if (esito === 'ok') await chiudiRecupero(book, m.flusso, `recuperato ${m.flusso} il ${dataIt(oggi)} (sbloccato dal supporto)`)
      return
    }
    if (a.tipo === 'recupero' && m.azione === 'verifica_sport' && book && esito === 'tolta') return chiudiRecupero(book, 'sport', `limitazione sport tolta, verificata il ${dataIt(oggi)}`)
    // ASSISTENZA
    if (a.tipo === 'assistenza') {
      if (esito === 'risolto') return togliDallaNota(book, 'assistenza', `assistenza risolta il ${dataIt(oggi)}`)
      const gg = esito === 'attesa' ? GIORNI_ATTESA_ASSISTENZA : GIORNI_RIFIUTO_ASSISTENZA
      return inserisci([{ chiave: `ass|${a.book_id}|${oggi}|${esito}`, tipo: 'assistenza', book_id: a.book_id, data_prevista: addGiorni(oggi, gg), titolo: esito === 'attesa' ? `Ricontrolla la risposta dell'assistenza (${a.titolo.replace(/^Sentire l'assistenza: /, '')})` : `Nuovo tentativo con l'assistenza (${a.titolo.replace(/^Sentire l'assistenza: |^Nuovo tentativo con l'assistenza \(|^Ricontrolla la risposta dell'assistenza \(/, '').replace(/\)$/, '')})`, meta: { flusso: 'assistenza', passo: 'contatto' } }])
    }
    // CHIUDERE E RIAPRIRE
    if (a.tipo === 'riapertura') {
      if (m.passo === 'login' && esito === 'ok') return togliDallaNota(book, 'riapertura', `login ok il ${dataIt(oggi)}, conto a posto`)
      if (m.passo === 'riapri') return togliDallaNota(book, 'riapertura', `conto riaperto il ${dataIt(oggi)}`)
      if (m.passo === 'login' && esito === 'strano')
        return inserisci([{ chiave: `riap|chiudi|${a.book_id}|${oggi}`, tipo: 'riapertura', book_id: a.book_id, titolo: 'Chiudi il conto (poi la riapertura va in calendario)', meta: { flusso: 'riapertura', passo: 'chiudi', nome: book?.nome, intestatario: book?.intestatario } }])
      // non si apre, oppure chiusura fatta → riapertura nel primo posto libero della settimana dopo
      const d = prossimoSlot(addGiorni(lunediDi(oggi), 7), book || m, slotOccupati(a.id))
      return inserisci([{ chiave: `riap|riapri|${a.book_id}|${oggi}`, tipo: 'riapertura', book_id: a.book_id, data_prevista: d, titolo: 'Riapri il conto', meta: { flusso: 'riapertura', passo: 'riapri', slot: true, nome: book?.nome, intestatario: book?.intestatario } }])
    }
    // INVIARE DOCUMENTO
    if (a.tipo === 'documento') {
      if (m.passo === 'prepara') {
        const extra = []
        const righe = (m.book_ids || []).map(bookDi).filter(b => b && paroleChiave(b.note).includes('documento')).map(b => {
          const d = prossimoGiornoInvio(addGiorni(oggi, 1), inviiOccupati(extra)); extra.push(d)
          return { chiave: `doc|invio|${b.id}|${oggi}`, tipo: 'documento', book_id: b.id, data_prevista: d, titolo: 'Invia il documento', meta: { flusso: 'documento', passo: 'invio' } }
        })
        return inserisci(righe)
      }
      if (m.passo === 'invio') return inserisci([{ chiave: `doc|verifica|${a.book_id}|${oggi}`, tipo: 'documento', book_id: a.book_id, data_prevista: addGiorni(oggi, GIORNI_VERIFICA_DOCUMENTO), titolo: 'Verifica se il documento è stato approvato', meta: { flusso: 'documento', passo: 'verifica' } }])
      if (m.passo === 'verifica' && esito === 'approvato') return togliDallaNota(book, 'documento', `documento approvato il ${dataIt(oggi)}`)
      if (m.passo === 'verifica') return inserisci([{ chiave: `doc|invio|${a.book_id}|${oggi}|reinvio`, tipo: 'documento', book_id: a.book_id, data_prevista: prossimoGiornoInvio(addGiorni(oggi, 1), inviiOccupati()), titolo: 'Reinvia il documento (il precedente è stato rifiutato)', meta: { flusso: 'documento', passo: 'invio' } }])
    }
    // RICONOSCIMENTO LIVE
    if (a.tipo === 'live') {
      if (m.passo === 'appuntamento') return inserisci([{ chiave: `live|seduta|${norm(m.intestatario)}|${dataScelta}|${oggi}`, tipo: 'live', book_id: null, data_prevista: dataScelta, titolo: `Riconoscimento live con ${m.intestatario}`, sottotitolo: `Book: ${(m.book_ids || []).map(bookDi).filter(Boolean).map(b => b.nome).join(', ')}`, meta: { ...m, passo: 'seduta' } }])
      if (m.passo === 'seduta') return inserisci((m.book_ids || []).map(bookDi).filter(Boolean).map(b => ({ chiave: `live|verifica|${b.id}|${oggi}`, tipo: 'live', book_id: b.id, data_prevista: addGiorni(oggi, GIORNI_VERIFICA_DOCUMENTO), titolo: "Verifica l'esito del riconoscimento live", meta: { flusso: 'live', passo: 'verifica', intestatario: m.intestatario } })))
      if (m.passo === 'verifica' && esito === 'approvato') return togliDallaNota(book, 'live', `riconoscimento live approvato il ${dataIt(oggi)}`)
      if (m.passo === 'verifica' && !apertoPer('live', a.book_id))
        return inserisci([{ chiave: `live|appuntamento|${norm(m.intestatario)}|${oggi}|${a.book_id}`, tipo: 'live', book_id: null, titolo: `Fissa un nuovo appuntamento con ${m.intestatario || book?.intestatario} per il riconoscimento live`, sottotitolo: `Rifiutato su ${book?.nome || ''}`, meta: { flusso: 'live', passo: 'appuntamento', book_ids: [String(a.book_id)], intestatario: m.intestatario || book?.intestatario } }])
    }
    return null
  }

  async function confermaFatto(a, esito, esitoLbl, dataScelta) {
    const book = bookDi(a.book_id)
    const chi = book ? `${book.nome} – ${book.intestatario || '—'}` : (a.meta?.intestatario || '')
    if (a.tipo === 'live' && a.meta?.passo === 'appuntamento') {
      if (!dataScelta) { onError('Scegli la data dell\'appuntamento'); return }
      const stessoGiorno = aperti.find(x => x.tipo === 'live' && x.meta?.passo === 'seduta' && x.data_prevista === dataScelta && norm(x.meta?.intestatario) !== norm(a.meta?.intestatario))
      if (stessoGiorno && !window.confirm(`Il ${dataIt(dataScelta)} c'è già il riconoscimento live con ${stessoGiorno.meta?.intestatario}: la regola è una persona al giorno. Vuoi fissarlo lo stesso?`)) return
    }
    const anticipo = a.data_prevista > oggi
    if (anticipo && a.meta?.slot) {
      // chiudere e riaprire anticipato: controlla il limite di 2 a settimana
      const lun = lunediDi(oggi), dom = addGiorni(lun, 6)
      const giaSett = (avvisi || []).filter(x => x.meta?.slot && x.stato === 'fatto' && x.data_prevista >= lun && x.data_prevista <= dom).length
        + aperti.filter(x => x.meta?.slot && x.id !== a.id && x.data_prevista >= lun && x.data_prevista <= dom).length
      if (giaSett >= RIAPERTURE_SETTIMANA && !window.confirm(`Questa settimana hai già ${giaSett} tra login e riaperture (la regola è massimo ${RIAPERTURE_SETTIMANA}). Vuoi anticiparlo lo stesso?`)) return
    }
    if (anticipo && a.tipo === 'documento' && a.meta?.passo === 'invio') {
      const giaOggi = (avvisi || []).filter(x => x.tipo === 'documento' && x.meta?.passo === 'invio' && x.id !== a.id && x.data_prevista === oggi && x.stato !== 'annullato').length
      if (giaOggi >= INVII_DOCUMENTO_GIORNO && !window.confirm(`Oggi hai già ${giaOggi} invii di documento (la regola è ${INVII_DOCUMENTO_GIORNO} al giorno). Vuoi anticiparlo lo stesso?`)) return
    }
    const testo = `Confermi di aver fatto${anticipo ? ` IN ANTICIPO (era previsto il ${dataIt(a.data_prevista)})` : ''}:\n${a.titolo}\n${chi}${esitoLbl ? `\n\nEsito: ${esitoLbl}` : ''}${dataScelta ? `\nAppuntamento: ${dataIt(dataScelta)}` : ''}`
    if (!window.confirm(testo)) return
    setSalvando(true)
    try {
      const campiAnticipo = anticipo ? { data_prevista: oggi, meta: { ...(a.meta || {}), anticipato_da: a.data_prevista } } : {}
      const ok = await aggiornaAvviso(a, { stato: 'fatto', fatto_il: oggi, esito: esito || (dataScelta ? `appuntamento ${dataScelta}` : 'fatto'), ...campiAnticipo })
      if (ok) { await dopoFatto(a, esito, dataScelta); onMessage(`✅ ${a.titolo}${chi ? ` · ${chi}` : ''}`) }
    } catch (e) { onError('Errore: ' + (e.message || e)) }
    setSalvando(false)
    setAzione(null)
  }

  function dataRimandoProposta(a) {
    if (a.meta?.slot) { const book = bookDi(a.book_id) || a.meta; return prossimoSlot(addGiorni(lunediDi(oggi), 7), book, slotOccupati(a.id)) }
    if (a.tipo === 'documento' && a.meta?.passo === 'invio') return prossimoGiornoInvio(addGiorni(oggi, 1), inviiOccupati())
    return addGiorni(oggi, 1)
  }
  async function confermaRimanda(a, data) {
    if (!data || data <= oggi) { onError('Scegli una data da domani in poi'); return }
    setSalvando(true)
    await aggiornaAvviso(a, { data_prevista: data, rimandi: (a.rimandi || 0) + 1 })
    setSalvando(false)
    setAzione(null)
    onMessage(`⏭ Rimandato al ${dataIt(data)}: ${a.titolo}`)
  }

  // ─── VISTA ────────────────────────────────────────────────────────
  const orfani = aperti.filter(orfano)
  // recupero sport che Lucy sta ancora cercando di collocare (entro GIORNI_LUCY_RECUPERO giorni)
  const perLucy = (a) => {
    // 28/09/2026: anche l'operazione spot (saldo fermo) la colloca Lucy, se sul book fa sport
    if (a.meta?.origine === 'saldo_fermo') { const b = bookDi(a.book_id); return !!b && !!lucyColloca && lucyColloca(b) }
    if (a.tipo !== 'recupero' || a.meta?.azione !== 'periodica' || !recuperoSport(a.titolo)) return false
    const b = bookDi(a.book_id)
    return !!b && !!lucyColloca && lucyColloca(b)
  }
  const lucyScaduto = () => false
  const aLucy = aperti.filter(a => a.data_prevista <= oggi && perLucy(a))
  const daFare = aperti.filter(a => a.data_prevista <= oggi && !orfano(a) && !perLucy(a)).sort((x, y) => x.data_prevista.localeCompare(y.data_prevista) || x.tipo.localeCompare(y.tipo))
  const futuri = aperti.filter(a => a.data_prevista > oggi && !orfano(a)).sort((x, y) => x.data_prevista.localeCompare(y.data_prevista))
  const inRitardo = daFare.filter(a => a.data_prevista < oggi).length
  // Una nota va vista se: non ha parole chiave, oppure ha testo in più per cui l'AI propone qualcosa.
  // Sparisce quando la proposta è confermata / tenuta / scartata (per QUELLA versione della nota).
  const rigaAi = (b) => (noteAi || []).find(r => r.book_id === String(b.id) && r.impronta === improntaNota(b.note)) || null
  const noteAtt = (books || []).filter(b => {
    if (!testoExtra(b.note)) return false
    const r = rigaAi(b)
    if (r && r.stato !== 'proposta') return false
    if (notaDaAttenzionare(b.note)) return true
    return !!(r && ((r.risultato?.avvisi || []).length || r.risultato?.parola_chiave))
  })

  // carica le letture già fatte
  useEffect(() => {
    supabase.from('note_ai').select('*').order('id', { ascending: true })
      .then(({ data, error }) => { if (error) setAiErrore('Tabella note_ai mancante: lancia note_ai.sql'); else setNoteAi(data || []) })
  }, [])

  // legge con l'AI le note nuove o cambiate (una alla volta, al massimo NOTE_AI_PER_SESSIONE per apertura)
  useEffect(() => {
    if (!Array.isArray(noteAi) || !books?.length || aiAttivo.current || aiErrore) return
    const daLeggere = books.filter(b => testoExtra(b.note) && !rigaAi(b))
    if (!daLeggere.length || aiLette.current >= NOTE_AI_PER_SESSIONE) return
    aiAttivo.current = true
    ;(async () => {
      const { data: sess } = await supabase.auth.getSession()
      const token = sess?.session?.access_token
      for (const b of daLeggere) {
        if (aiLette.current >= NOTE_AI_PER_SESSIONE) break
        aiLette.current++
        setAiInCorso(daLeggere.length)
        try {
          const r = await fetch('/api/note-ai', { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` }, body: JSON.stringify({ nota: pulisciNota(b.note), nome: b.nome, intestatario: b.intestatario, oggi }) })
          const risultato = await r.json()
          if (!r.ok) { setAiErrore(`Lettura AI non riuscita: ${risultato.error || r.status}`); break }
          const { data, error } = await supabase.from('note_ai').upsert([{ book_id: String(b.id), impronta: improntaNota(b.note), testo: pulisciNota(b.note), risultato, stato: 'proposta' }], { onConflict: 'user_id,book_id,impronta' }).select()
          if (error) { setAiErrore('Errore note_ai: ' + error.message); break }
          setNoteAi(prev => [...(prev || []).filter(x => !(data || []).some(d => d.id === x.id)), ...(data || [])])
        } catch (e) { setAiErrore('Lettura AI non riuscita: ' + (e.message || e)); break }
      }
      setAiInCorso(0)
      aiAttivo.current = false
    })()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [books, noteAi, aiErrore])

  const bozzaDi = (b) => {
    if (bozze[b.id]) return bozze[b.id]
    const r = rigaAi(b)?.risultato || {}
    return { avvisi: (r.avvisi || []).map(a => ({ ...a, on: true })), pk: !!r.parola_chiave, cancella: !r.informazione }
  }
  const setBozza = (b, campi) => setBozze(prev => ({ ...prev, [b.id]: { ...bozzaDi(b), ...campi } }))
  async function statoAi(b, stato) {
    const r = rigaAi(b)
    if (!r) return
    const { data } = await supabase.from('note_ai').update({ stato }).eq('id', r.id).select().single()
    if (data) setNoteAi(prev => prev.map(x => x.id === data.id ? data : x))
  }
  // la nuova versione della nota (dopo la conferma) non va riletta dall'AI: la segno già come confermata
  async function segnaLetta(b, nuovaNota) {
    if (!testoExtra(nuovaNota)) return
    const { data } = await supabase.from('note_ai').upsert([{ book_id: String(b.id), impronta: improntaNota(nuovaNota), testo: pulisciNota(nuovaNota), risultato: { sintesi: 'nota riscritta dopo una conferma' }, stato: 'confermata' }], { onConflict: 'user_id,book_id,impronta' }).select()
    if (data) setNoteAi(prev => [...(prev || []).filter(x => !data.some(d => d.id === x.id)), ...data])
  }
  async function confermaAi(b) {
    const r = rigaAi(b); const ris = r?.risultato || {}; const bz = bozzaDi(b)
    const scelti = bz.avvisi.filter(a => a.on && a.titolo && a.data)
    const pk = bz.pk ? ris.parola_chiave : null
    const righe = [...scelti.map(a => `• ${a.titolo} (${dataIt(a.data)})`), pk ? `• parola chiave: ${pk.toUpperCase()}` : null, bz.cancella && !pk ? '• la nota viene tolta dal book (resta nello storico)' : null].filter(Boolean)
    if (!window.confirm(`${b.nome} – ${b.intestatario || '—'}\n"${pulisciNota(b.note)}"\n\nConfermi?\n${righe.join('\n') || '• nessun avviso'}`)) return
    setSalvando(true)
    try {
      const imp = improntaNota(b.note)
      if (scelti.length) await inserisci(scelti.map((a, i) => ({ chiave: `nota|${b.id}|${imp}|${i}`, tipo: 'nota', book_id: b.id, data_prevista: a.data, titolo: a.titolo, sottotitolo: `Dalla nota: "${pulisciNota(b.note).slice(0, 90)}"`, meta: { origine: 'nota_ai', impronta: imp } })))
      await statoAi(b, 'confermata')
      if (pk) {
        const nuova = pk === 'sentire assistenza' ? `SENTIRE ASSISTENZA - ${pulisciNota(b.note)}` : aggiungiParola(soloParoleChiave(b.note), paroleChiave(pk)[0])
        await segnaLetta(b, nuova)
        await aggiornaNotaBook(b, nuova, `parola chiave "${pk}" aggiunta dall'AI, confermata il ${dataIt(oggi)}`, setBooks)
      } else if (bz.cancella) {
        await aggiornaNotaBook(b, soloParoleChiave(b.note), `nota gestita con l'AI il ${dataIt(oggi)}`, setBooks)
      }
      onMessage(`🤖 ${b.nome} (${b.intestatario || '—'}): ${scelti.length} avvisi creati${pk ? `, aggiunta "${pk}"` : ''}`)
    } catch (e) { onError('Errore: ' + (e.message || e)) }
    setSalvando(false)
  }

  // popup note da attenzionare: si apre da solo una volta al giorno se ce ne sono
  useEffect(() => {
    if (!noteAtt.length) return
    try { if (localStorage.getItem('pt_note_attenzionare_giorno') === oggi) return; localStorage.setItem('pt_note_attenzionare_giorno', oggi) } catch { return }
    setPopupNote(true)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [noteAtt.length])

  const riga = (a) => {
    const book = bookDi(a.book_id)
    const ritardo = a.data_prevista < oggi ? diffGiorni(a.data_prevista, oggi) : 0
    const es = esitiDi(a)
    const aperta = azione && azione.id === a.id
    return (
      <div key={a.id} style={{ background: 'rgba(11,18,32,0.75)', border: `1px solid ${ritardo ? 'rgba(248,113,113,0.55)' : 'rgba(51,65,85,0.7)'}`, borderRadius: 12, padding: '8px 12px' }}>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
          <span>{ICONA[a.tipo] || '🔔'}</span>
          <b style={{ color: '#f8fafc', fontSize: 13 }}>{book ? book.nome : (a.meta?.intestatario || '')}</b>
          {book && <span style={{ color: '#94a3b8', fontSize: 12 }}>{book.intestatario || '—'}</span>}
          <span style={{ color: '#e2e8f0', fontSize: 12 }}>{a.titolo}</span>
          <span style={{ marginLeft: 'auto', fontSize: 11, color: ritardo ? '#f87171' : '#64748b', whiteSpace: 'nowrap' }}>
            {ritardo ? `in ritardo da ${ritardo} gg` : a.data_prevista > oggi ? dataIt(a.data_prevista) : 'oggi'}{a.rimandi ? ` · rimandato ${a.rimandi}×` : ''}
          </span>
        </div>
        {a.sottotitolo && <div style={{ fontSize: 11, color: '#94a3b8', margin: '2px 0 0 24px' }}>{a.sottotitolo}</div>}
        {lucyScaduto(a) && <div style={{ fontSize: 11, color: '#fbbf24', margin: '2px 0 0 24px' }}>⚠️ Lucy non è riuscita a collocarlo negli incroci: fallo a mano</div>}
        <div style={{ display: 'flex', gap: 6, marginTop: 6, flexWrap: 'wrap', alignItems: 'center', paddingLeft: 24 }}>
          {!aperta && <>
            <button style={btn('#94a3b8')} disabled={salvando} onClick={() => setAzione({ id: a.id, modo: 'rimanda', data: dataRimandoProposta(a) })}>⏭ Rimanda</button>
            <button style={btn('#22c55e')} disabled={salvando} onClick={() => es ? setAzione({ id: a.id, modo: 'fatto', data: addGiorni(oggi, 1) }) : confermaFatto(a)}>✅ Fatto</button>
          </>}
          {aperta && azione.modo === 'rimanda' && <>
            <span style={{ fontSize: 12, color: '#cbd5e1' }}>Rimanda al</span>
            <input type="date" value={azione.data} min={addGiorni(oggi, 1)} onChange={e => setAzione({ ...azione, data: e.target.value })} style={inp} />
            <button style={btn('#38bdf8')} disabled={salvando} onClick={() => confermaRimanda(a, azione.data)}>Conferma</button>
            <button style={btn('#64748b')} onClick={() => setAzione(null)}>Annulla</button>
          </>}
          {aperta && azione.modo === 'fatto' && es === 'data' && <>
            <span style={{ fontSize: 12, color: '#cbd5e1' }}>Appuntamento il</span>
            <input type="date" value={azione.data} min={oggi} onChange={e => setAzione({ ...azione, data: e.target.value })} style={inp} />
            <button style={btn('#22c55e')} disabled={salvando} onClick={() => confermaFatto(a, null, null, azione.data)}>Fissa</button>
            <button style={btn('#64748b')} onClick={() => setAzione(null)}>Annulla</button>
          </>}
          {aperta && azione.modo === 'fatto' && Array.isArray(es) && <>
            <span style={{ fontSize: 12, color: '#cbd5e1' }}>Com'è andata?</span>
            {es.map(e => <button key={e.k} style={btn(e.k === 'ok' || e.k === 'tolta' || e.k === 'risolto' || e.k === 'approvato' ? '#22c55e' : e.k === 'attesa' || e.k === 'ancora' ? '#fbbf24' : '#f87171')} disabled={salvando} onClick={() => confermaFatto(a, e.k, e.l)}>{e.l}</button>)}
            <button style={btn('#64748b')} onClick={() => setAzione(null)}>Annulla</button>
          </>}
        </div>
      </div>
    )
  }

  const perFlusso = {}
  for (const a of daFare) (perFlusso[a.tipo] = perFlusso[a.tipo] || []).push(a)

  return (
    <>
      <div style={{ background: 'rgba(56,189,248,0.06)', border: '1px solid rgba(56,189,248,0.35)', borderRadius: 16, padding: '14px 16px', marginBottom: 16 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
          <div onClick={() => setMostra(!mostra)} style={{ fontSize: 14, fontWeight: 900, color: '#7dd3fc', cursor: 'pointer' }}>
            🔔 Avvisi conti · {daFare.length} da fare{inRitardo ? <span style={{ color: '#f87171' }}> ({inRitardo} in ritardo)</span> : ''}{orfani.length ? <span style={{ color: '#f87171' }}> · ⚠️ {orfani.length} da confermare</span> : ''} {mostra ? '▾' : '▸'}
          </div>
          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
            <button style={btn('#a78bfa')} onClick={() => setSequenza(true)}>🧹 Ho tempo: cosa posso sistemare</button>
            <button style={btn(noteAtt.length ? '#fbbf24' : '#64748b')} onClick={() => setPopupNote(true)}>📝 Note da attenzionare ({noteAtt.length})</button>
            <button style={btn('#94a3b8')} onClick={() => setMostraFuturi(!mostraFuturi)}>📅 In programma ({futuri.length})</button>
          </div>
        </div>
        {mostra && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginTop: 10 }}>
            {orfani.length > 0 && (
              <div style={{ background: 'rgba(248,113,113,0.08)', border: '1px solid rgba(248,113,113,0.55)', borderRadius: 12, padding: '10px 12px' }}>
                <div style={{ fontSize: 13, fontWeight: 900, color: '#fca5a5' }}>⚠️ Parola chiave tolta dalla nota · {orfani.length} avvisi da confermare</div>
                <div style={{ fontSize: 11, color: '#94a3b8', margin: '2px 0 8px' }}>Qualcuno ha cancellato la parola chiave a mano. Gli avvisi restano finché non confermi: se è stato un errore, ripristina la parola chiave.</div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                  {orfani.map(a => (
                    <div key={a.id} style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap', background: 'rgba(11,18,32,0.75)', borderRadius: 10, padding: '7px 10px' }}>
                      <span>{ICONA[a.tipo] || '🔔'}</span>
                      <b style={{ color: '#f8fafc', fontSize: 13 }}>{libriDi(a).map(b => `${b.nome} · ${b.intestatario || '—'}`).join(', ')}</b>
                      <span style={{ color: '#e2e8f0', fontSize: 12 }}>{a.titolo}</span>
                      <span style={{ fontSize: 11, color: '#fca5a5' }}>manca "{NOME_PAROLA[a.meta?.flusso]}"</span>
                      <span style={{ marginLeft: 'auto', display: 'flex', gap: 6 }}>
                        <button style={btn('#38bdf8')} disabled={salvando} onClick={() => ripristinaOrfano(a)}>↩️ Ripristina parola chiave</button>
                        <button style={btn('#f87171')} disabled={salvando} onClick={() => annullaOrfano(a)}>🗑 Annulla avviso</button>
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}
            {aLucy.length > 0 && <div style={{ fontSize: 12, color: '#7dd3fc', background: 'rgba(14,165,233,0.08)', border: '1px solid rgba(14,165,233,0.3)', borderRadius: 10, padding: '6px 10px' }}>🎯 {new Set(aLucy.map(a => a.book_id)).size} recuperi sport in coda a Lucy{(() => { const v = aLucy.reduce((m, a) => a.data_prevista < m ? a.data_prevista : m, oggi); const g = diffGiorni(v, oggi); return g > 0 ? ` · il più vecchio aspetta da ${g} gg` : '' })()}. Li colloca lei negli incroci, prima quelli di oggi e poi i rimasti indietro; si chiudono da soli quando confermi la bet.</div>}
            {daFare.length === 0 && <div style={{ fontSize: 12, color: '#64748b' }}>Nessun avviso da gestire oggi.</div>}
            {Object.entries(perFlusso).map(([tipo, lista]) => (
              <div key={tipo}>
                <div style={{ fontSize: 12, fontWeight: 800, color: '#cbd5e1', margin: '2px 0 6px' }}>{ICONA[tipo]} {NOME_FLUSSO[tipo] || tipo} · {lista.length}</div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>{lista.map(riga)}</div>
              </div>
            ))}
            {mostraFuturi && (
              <div>
                <div style={{ fontSize: 12, fontWeight: 800, color: '#94a3b8', margin: '6px 0' }}>📅 In programma</div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>{futuri.map(riga)}</div>
              </div>
            )}
          </div>
        )}
      </div>

      {sequenza && (() => {
        const ritardo = daFare.filter(a => a.data_prevista < oggi)
        const diOggi = daFare.filter(a => a.data_prevista === oggi)
        const blocco = (titolo, colore, nota, lista) => lista.length > 0 && (
          <div style={{ marginBottom: 14 }}>
            <div style={{ fontSize: 13, fontWeight: 900, color: colore }}>{titolo} · {lista.length}</div>
            {nota && <div style={{ fontSize: 11, color: '#94a3b8', margin: '2px 0 6px' }}>{nota}</div>}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginTop: 6 }}>{lista.map(riga)}</div>
          </div>
        )
        const tutto = ritardo.length + diOggi.length + orfani.length + noteAtt.length + futuri.length
        return (
          <div style={{ position: 'fixed', inset: 0, background: 'rgba(2,6,23,0.85)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 2050, padding: 16 }} onClick={() => setSequenza(false)}>
            <div onClick={e => e.stopPropagation()} style={{ background: '#0f172a', border: '1px solid rgba(167,139,250,0.5)', borderRadius: 16, padding: 18, width: 'min(860px, 100%)', maxHeight: '88vh', overflowY: 'auto' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
                <div style={{ fontSize: 16, fontWeight: 900, color: '#c4b5fd' }}>🧹 Tutto quello che puoi sistemare, in ordine</div>
                <button style={btn('#94a3b8')} onClick={() => setSequenza(false)}>Chiudi</button>
              </div>
              <div style={{ fontSize: 12, color: '#94a3b8', marginBottom: 12 }}>Parti dall'alto e scendi finché hai voglia. Le cose future si possono fare in anticipo: il Fatto te lo segnala e controlla i limiti (2 riaperture a settimana, 3 invii di documento al giorno).</div>
              {tutto === 0 && <div style={{ color: '#64748b', fontSize: 13 }}>Niente da sistemare: tutto in ordine 👌</div>}
              {blocco('1. In ritardo', '#f87171', null, ritardo)}
              {blocco('2. Di oggi', '#fbbf24', null, diOggi)}
              {orfani.length > 0 && (
                <div style={{ marginBottom: 14 }}>
                  <div style={{ fontSize: 13, fontWeight: 900, color: '#fca5a5' }}>3. Parole chiave tolte dalla nota · {orfani.length}</div>
                  <div style={{ fontSize: 11, color: '#94a3b8', margin: '2px 0 6px' }}>Da confermare o ripristinare: li trovi nel riquadro rosso degli avvisi.</div>
                </div>
              )}
              {noteAtt.length > 0 && (
                <div style={{ marginBottom: 14, display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
                  <div style={{ fontSize: 13, fontWeight: 900, color: '#fde68a' }}>4. Note da attenzionare · {noteAtt.length}</div>
                  <button style={btn('#fbbf24')} onClick={() => { setSequenza(false); setPopupNote(true) }}>Apri le note</button>
                </div>
              )}
              {blocco('5. Si possono anticipare', '#a78bfa', 'In ordine di data prevista.', futuri)}
            </div>
          </div>
        )
      })()}

      {popupNote && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(2,6,23,0.85)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 2100, padding: 16 }} onClick={() => setPopupNote(false)}>
          <div onClick={e => e.stopPropagation()} style={{ background: '#0f172a', border: '1px solid rgba(251,191,36,0.45)', borderRadius: 16, padding: 18, width: 'min(760px, 100%)', maxHeight: '85vh', overflowY: 'auto' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
              <div style={{ fontSize: 16, fontWeight: 900, color: '#fbbf24' }}>📝 Book con note da attenzionare · {noteAtt.length}</div>
              <button style={btn('#94a3b8')} onClick={() => setPopupNote(false)}>Chiudi</button>
            </div>
            <div style={{ fontSize: 12, color: '#94a3b8', marginBottom: 10 }}>Note senza parole chiave, oppure con testo in più per cui l'AI propone qualcosa. 🤖 legge la nota e propone gli avvisi: li puoi correggere prima di confermare. Il testo originale resta sempre nello storico.</div>
            {aiInCorso > 0 && <div style={{ fontSize: 12, color: '#c4b5fd', marginBottom: 8 }}>🤖 Sto leggendo le note nuove… ({aiInCorso})</div>}
            {aiErrore && <div style={{ fontSize: 12, color: '#fca5a5', marginBottom: 8 }}>⚠️ {aiErrore}</div>}
            {noteAtt.length === 0 && <div style={{ color: '#64748b', fontSize: 13 }}>Nessuna nota da attenzionare 👌</div>}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {noteAtt.sort((a, b) => norm(a.nome).localeCompare(norm(b.nome)) || norm(a.intestatario).localeCompare(norm(b.intestatario))).map(b => {
                const r = rigaAi(b); const ris = r?.risultato; const bz = bozzaDi(b)
                return (
                <div key={b.id} style={{ background: 'rgba(11,18,32,0.75)', border: '1px solid rgba(51,65,85,0.7)', borderRadius: 10, padding: '8px 10px' }}>
                  <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
                    <b style={{ color: '#f8fafc', fontSize: 13 }}>{b.nome}</b>
                    <span style={{ color: '#94a3b8', fontSize: 12 }}>{b.intestatario || '—'}</span>
                    <span style={{ color: '#fde68a', fontSize: 12, flex: 1, minWidth: 180 }}>{pulisciNota(b.note)}</span>
                  </div>
                  {!ris && <div style={{ fontSize: 11, color: '#64748b', marginTop: 4 }}>🤖 {aiErrore ? 'lettura non disponibile' : 'in attesa di lettura…'}</div>}
                  {ris && (
                    <div style={{ marginTop: 6, padding: '6px 8px', borderRadius: 8, background: 'rgba(167,139,250,0.08)', border: '1px solid rgba(167,139,250,0.3)', fontSize: 12, color: '#e2e8f0' }}>
                      <div>🤖 {ris.sintesi || '—'}</div>
                      {ris.informazione && <div style={{ color: '#fde68a', marginTop: 2 }}>📌 Da conservare: {ris.informazione}</div>}
                      {bz.avvisi.map((a, i) => (
                        <div key={i} style={{ display: 'flex', gap: 6, alignItems: 'center', marginTop: 4, flexWrap: 'wrap' }}>
                          <input type="checkbox" checked={a.on} onChange={e => setBozza(b, { avvisi: bz.avvisi.map((x, k) => k === i ? { ...x, on: e.target.checked } : x) })} />
                          <input value={a.titolo} onChange={e => setBozza(b, { avvisi: bz.avvisi.map((x, k) => k === i ? { ...x, titolo: e.target.value } : x) })} style={{ ...inp, flex: 1, minWidth: 180 }} />
                          <input type="date" value={a.data} min={oggi} onChange={e => setBozza(b, { avvisi: bz.avvisi.map((x, k) => k === i ? { ...x, data: e.target.value } : x) })} style={inp} />
                        </div>
                      ))}
                      {bz.avvisi.length === 0 && <div style={{ color: '#94a3b8', marginTop: 2 }}>Nessun avviso proposto.</div>}
                      {ris.parola_chiave && (
                        <label style={{ display: 'flex', gap: 6, alignItems: 'center', marginTop: 4, cursor: 'pointer' }}>
                          <input type="checkbox" checked={bz.pk} onChange={e => setBozza(b, { pk: e.target.checked })} />
                          <span>Aggiungi la parola chiave <b style={{ color: '#7dd3fc' }}>{ris.parola_chiave.toUpperCase()}</b>{ris.parola_chiave === 'sentire assistenza' ? ' (il testo della nota diventa il motivo)' : ''}</span>
                        </label>
                      )}
                      {!bz.pk && (
                        <label style={{ display: 'flex', gap: 6, alignItems: 'center', marginTop: 4, cursor: 'pointer', color: '#94a3b8' }}>
                          <input type="checkbox" checked={bz.cancella} onChange={e => setBozza(b, { cancella: e.target.checked })} />
                          <span>Dopo la conferma togli il testo dalla nota{paroleChiave(b.note).length ? ' (le parole chiave restano)' : ''}</span>
                        </label>
                      )}
                    </div>
                  )}
                  <div style={{ display: 'flex', gap: 6, marginTop: 6, flexWrap: 'wrap', justifyContent: 'flex-end' }}>
                    {ris && <button style={btn('#a78bfa')} disabled={salvando} onClick={() => confermaAi(b)}>✅ Conferma proposta</button>}
                    <button style={btn('#fbbf24')} disabled={salvando || !r} title={!r ? 'Disponibile dopo la lettura' : ''} onClick={async () => {
                      if (!window.confirm(`${b.nome} – ${b.intestatario || '—'}\n"${pulisciNota(b.note)}"\n\nTengo la nota così com'è e non la ripropongo (finché qualcuno non la modifica)?`)) return
                      await statoAi(b, 'tenuta'); onMessage(`📌 Nota tenuta: ${b.nome} (${b.intestatario || '—'})`)
                    }}>📌 Tieni la nota</button>
                    <button style={btn('#22c55e')} disabled={salvando} onClick={async () => {
                      if (!window.confirm(`${b.nome} – ${b.intestatario || '—'}\n"${pulisciNota(b.note)}"\n\nNota gestita: tolgo il testo dal book? (le parole chiave restano, il testo resta nello storico)`)) return
                      setSalvando(true)
                      try { await statoAi(b, 'scartata'); await aggiornaNotaBook(b, soloParoleChiave(b.note), `nota gestita il ${dataIt(oggi)} (popup note da attenzionare)`, setBooks); onMessage(`📝 Nota tolta: ${b.nome} (${b.intestatario || '—'})`) }
                      catch (e) { onError('Errore: ' + e.message) }
                      setSalvando(false)
                    }}>✓ Gestita</button>
                  </div>
                </div>
              )})}
            </div>
          </div>
        </div>
      )}
    </>
  )
}
