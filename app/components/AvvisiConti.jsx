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
import { paroleChiave, motivoAssistenza, togliParola, aggiornaNotaBook, notaDaAttenzionare, pulisciNota } from './noteConti'
import { contiInRecupero, avvisiRecupero, limitazioniDaNota } from './RecuperoConti'

// ─── PARAMETRI ──────────────────────────────────────────────────────
export const RIAPERTURE_SETTIMANA = 2      // chiudere e riaprire: massimo 2 conti a settimana
export const INVII_DOCUMENTO_GIORNO = 3    // inviare documento: 3 book al giorno, lun-ven
export const GIORNI_VERIFICA_DOCUMENTO = 3 // dopo l'invio (o la seduta live): verifica l'esito dopo 3 giorni
export const GIORNI_ATTESA_ASSISTENZA = 7  // assistenza "in attesa di risposta": ricontrolla dopo 7 giorni
export const GIORNI_RIFIUTO_ASSISTENZA = 30 // assistenza "rifiutato": nuovo tentativo dopo 30 giorni

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

const ICONA = { recupero: '🔧', assistenza: '🎧', riapertura: '🔁', documento: '📄', live: '🎥' }
const NOME_FLUSSO = { recupero: 'Recupero conti limitati', assistenza: 'Sentire assistenza', riapertura: 'Chiudere e riaprire', documento: 'Inviare documento', live: 'Riconoscimento live' }

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
export default function AvvisiContiPanel({ books, setBooks, avvisi, setAvvisi, recuperi, setRecuperi, getRecuperoProtocollo, onMessage, onError }) {
  const oggi = oggiISO()
  const [mostra, setMostra] = useState(true)
  const [mostraFuturi, setMostraFuturi] = useState(false)
  const [azione, setAzione] = useState(null)      // { id, modo: 'fatto' | 'rimanda', data }
  const [salvando, setSalvando] = useState(false)
  const [popupNote, setPopupNote] = useState(false)
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

    // Annullo automatico: parola chiave tolta a mano dalla nota (o sport bloccato per sempre)
    const daAnnullare = aperti.filter(a => {
      const f = a.meta?.flusso
      if (!f) return false
      const ids = a.book_id ? [a.book_id] : (a.meta?.book_ids || [])
      const presenti = ids.map(bookDi).filter(Boolean)
      if (!presenti.length) return false
      const ancora = presenti.some(b => (f === 'bonus' || f === 'sport') ? (limitazioniDaNota(b.note).includes(f) && !(f === 'sport' && b.sport_bloccato)) : paroleChiave(b.note).includes(f))
      return !ancora
    })
    if (daAnnullare.length) {
      supabase.from('avvisi_conti').update({ stato: 'annullato', esito: 'parola chiave tolta dalla nota' }).in('id', daAnnullare.map(a => a.id)).select()
        .then(({ data }) => { if (data) setAvvisi(prev => prev.map(x => data.find(d => d.id === x.id) || x)) })
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [books, avvisi, recuperi])

  // ─── azioni collegate agli esiti ──────────────────────────────────
  async function togliDallaNota(book, flusso, motivo) {
    if (!book) return
    await aggiornaNotaBook(book, togliParola(book.note, flusso), motivo, setBooks)
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
    const testo = `Confermi di aver fatto:\n${a.titolo}\n${chi}${esitoLbl ? `\n\nEsito: ${esitoLbl}` : ''}${dataScelta ? `\nAppuntamento: ${dataIt(dataScelta)}` : ''}`
    if (!window.confirm(testo)) return
    setSalvando(true)
    try {
      const ok = await aggiornaAvviso(a, { stato: 'fatto', fatto_il: oggi, esito: esito || (dataScelta ? `appuntamento ${dataScelta}` : 'fatto') })
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
  const daFare = aperti.filter(a => a.data_prevista <= oggi).sort((x, y) => x.data_prevista.localeCompare(y.data_prevista) || x.tipo.localeCompare(y.tipo))
  const futuri = aperti.filter(a => a.data_prevista > oggi).sort((x, y) => x.data_prevista.localeCompare(y.data_prevista))
  const inRitardo = daFare.filter(a => a.data_prevista < oggi).length
  const noteAtt = (books || []).filter(b => notaDaAttenzionare(b.note))

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
            🔔 Avvisi conti · {daFare.length} da fare{inRitardo ? <span style={{ color: '#f87171' }}> ({inRitardo} in ritardo)</span> : ''} {mostra ? '▾' : '▸'}
          </div>
          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
            <button style={btn(noteAtt.length ? '#fbbf24' : '#64748b')} onClick={() => setPopupNote(true)}>📝 Note da attenzionare ({noteAtt.length})</button>
            <button style={btn('#94a3b8')} onClick={() => setMostraFuturi(!mostraFuturi)}>📅 In programma ({futuri.length})</button>
          </div>
        </div>
        {mostra && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginTop: 10 }}>
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

      {popupNote && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(2,6,23,0.85)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 2100, padding: 16 }} onClick={() => setPopupNote(false)}>
          <div onClick={e => e.stopPropagation()} style={{ background: '#0f172a', border: '1px solid rgba(251,191,36,0.45)', borderRadius: 16, padding: 18, width: 'min(760px, 100%)', maxHeight: '85vh', overflowY: 'auto' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
              <div style={{ fontSize: 16, fontWeight: 900, color: '#fbbf24' }}>📝 Book con note da attenzionare · {noteAtt.length}</div>
              <button style={btn('#94a3b8')} onClick={() => setPopupNote(false)}>Chiudi</button>
            </div>
            <div style={{ fontSize: 12, color: '#94a3b8', marginBottom: 10 }}>Note senza parole chiave (limitato bonus · limitato sport · sentire assistenza · chiudere e riaprire · inviare documento · riconoscimento live). Con ✓ la nota viene tolta dal book; il testo resta nello storico.</div>
            {noteAtt.length === 0 && <div style={{ color: '#64748b', fontSize: 13 }}>Nessuna nota da attenzionare 👌</div>}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              {noteAtt.sort((a, b) => norm(a.nome).localeCompare(norm(b.nome)) || norm(a.intestatario).localeCompare(norm(b.intestatario))).map(b => (
                <div key={b.id} style={{ display: 'flex', gap: 8, alignItems: 'center', background: 'rgba(11,18,32,0.75)', border: '1px solid rgba(51,65,85,0.7)', borderRadius: 10, padding: '7px 10px', flexWrap: 'wrap' }}>
                  <b style={{ color: '#f8fafc', fontSize: 13 }}>{b.nome}</b>
                  <span style={{ color: '#94a3b8', fontSize: 12 }}>{b.intestatario || '—'}</span>
                  <span style={{ color: '#fde68a', fontSize: 12, flex: 1, minWidth: 180 }}>{pulisciNota(b.note)}</span>
                  <button style={btn('#22c55e')} disabled={salvando} onClick={async () => {
                    if (!window.confirm(`${b.nome} – ${b.intestatario || '—'}\n"${pulisciNota(b.note)}"\n\nNota gestita: la tolgo dal book? (il testo resta nello storico)`)) return
                    setSalvando(true)
                    try { await aggiornaNotaBook(b, '', `nota gestita il ${dataIt(oggi)} (popup note da attenzionare)`, setBooks); onMessage(`📝 Nota tolta: ${b.nome} (${b.intestatario || '—'})`) }
                    catch (e) { onError('Errore: ' + e.message) }
                    setSalvando(false)
                  }}>✓ Gestita</button>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </>
  )
}
