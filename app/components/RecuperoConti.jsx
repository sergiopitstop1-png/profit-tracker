"use client";
// ════════════════════════════════════════════════════════════════════
// RECUPERO CONTI LIMITATI
// Convenzione concordata con Sergio (25/09/2026): nella NOTA del book scrivi
//   "limitato bonus"  → si segue il recupero per limitazione bonus/promo della scheda Profiliamo del book
//   "limitato sport"  → si segue il recupero per limitazione sport
// Vale anche per i conti dormienti. Un conto con "chiuso" nella nota è escluso.
// Stato del recupero (passi fatti, tentativi col supporto) in Supabase: tabella recupero_conti.
// Le procedure per ogni book arrivano da ProfitTrackerClient (getRecuperoProtocollo), che ha le schede.
// ════════════════════════════════════════════════════════════════════
import React, { useState, useEffect } from 'react'
import { supabase } from '../profit-tracker/supabaseClient'
import { togliParola, aggiornaNotaBook, annullaAvvisiFlusso } from './noteConti'

export const GIORNI_PRIMO_CONTATTO = 14   // dopo quanti giorni di volume blando contattare il supporto
export const GIORNI_TRA_TENTATIVI = 30    // dopo un "no" del supporto, riprova dopo questi giorni
export const GIORNI_VERIFICA_SPORT = 30   // 27/09/2026: ogni 30 giorni verifica se la limitazione sport è stata tolta
// 27/09/2026 — TETTO AI RECUPERI ATTIVI: solo questi conti ricevono azioni; gli altri aspettano in coda.
// Quando un posto si libera (recuperato, non scommette più, messo in attesa) entra da solo il primo della coda.
// Priorità: livello del conto (profilazione → mantenimento → dormiente), poi classe del book (A → B → C),
// poi la limitazione più vecchia. Colonne recupero_conti.attivo_dal / in_attesa_manuale (vedi recupero_attivi.sql).
export const MAX_RECUPERI_ATTIVI = 20

const oggiISO = () => new Date().toLocaleDateString('sv-SE')
const diffGiorni = (da, a) => Math.round((new Date(a + 'T00:00:00') - new Date(da + 'T00:00:00')) / 86400000)
const dataIt = (iso) => iso ? iso.split('-').reverse().join('/') : ''
const hashStr = (t) => { let h = 2166136261; const s = String(t); for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619) } h ^= h >>> 15; h = Math.imul(h, 2246822507); h ^= h >>> 13; return h >>> 0 }

// Limitazioni lette dalla nota: ['bonus'], ['sport'], ['bonus','sport'] oppure [] (anche se "chiuso")
export function limitazioniDaNota(note) {
  const n = String(note || '').toLowerCase()
  if (!n || n.includes('chiuso')) return []
  const out = []
  if (/limitat[oa]\s+bonus/.test(n)) out.push('bonus')
  if (/limitat[oa]\s+sport/.test(n)) out.push('sport')
  return out
}

// Conti in recupero: [{ book, tipo, proto, stato }]
export function contiInRecupero(books, recuperi, getRecuperoProtocollo) {
  const out = []
  for (const book of books || []) {
    for (const tipo of limitazioniDaNota(book.note)) {
      if (tipo === 'sport' && book.sport_bloccato) continue   // sport bloccato per sempre: niente più recupero sport
      const stato = (recuperi || []).find(r => String(r.book_id) === String(book.id) && r.tipo === tipo) || null
      out.push({ book, tipo, proto: getRecuperoProtocollo(book.nome, tipo), stato })
    }
  }
  return out.sort((a, b) => (a.book.nome || '').localeCompare(b.book.nome || '') || (a.book.intestatario || '').localeCompare(b.book.intestatario || ''))
}

// Priorità in coda (numero più basso = prima)
export function prioritaRecupero(item, getClasseBook) {
  const liv = String(item.book?.profilo_livello || '')
  const pLiv = liv === 'attivo' ? 0 : liv.startsWith('mantenimento') ? 1 : 2
  const cl = getClasseBook ? getClasseBook(item.book?.nome) : 'C'
  const pCl = cl === 'A' ? 0 : (cl === 'B' || cl === 'B_CASINO') ? 1 : 2
  return [pLiv, pCl, item.stato?.iniziato || '9999']
}
const confrontaPriorita = (a, b) => a[0] - b[0] || a[1] - b[1] || String(a[2]).localeCompare(String(b[2]))
export const recuperoAttivo = (item) => !!item?.stato?.attivo_dal

// Conti della coda da attivare adesso per riempire i posti liberi
export function daPromuovere(lista, getClasseBook, max = MAX_RECUPERI_ATTIVI) {
  const validi = (lista || []).filter(it => it.stato && it.proto?.disponibile)
  const liberi = max - validi.filter(recuperoAttivo).length
  if (liberi <= 0) return []
  return validi.filter(it => !recuperoAttivo(it) && !it.stato.in_attesa_manuale)
    .map(it => ({ it, p: prioritaRecupero(it, getClasseBook) }))
    .sort((a, b) => confrontaPriorita(a.p, b.p)).slice(0, liberi).map(x => x.it)
}
// Coda ordinata (per il pannello)
export function codaRecuperi(lista, getClasseBook) {
  return (lista || []).filter(it => !recuperoAttivo(it)).map(it => ({ it, p: prioritaRecupero(it, getClasseBook) }))
    .sort((a, b) => (a.it.stato?.in_attesa_manuale ? 1 : 0) - (b.it.stato?.in_attesa_manuale ? 1 : 0) || confrontaPriorita(a.p, b.p)).map(x => x.it)
}

// Esito finale di un recupero, per il riepilogo per book (tabella recupero_esiti)
export async function registraEsitoRecupero(book, tipo, stato, esito) {
  try {
    await supabase.from('recupero_esiti').insert([{ book_id: String(book.id), nome: book.nome || '', intestatario: book.intestatario || '', tipo, iniziato: stato?.iniziato || null, attivo_dal: stato?.attivo_dal || null, chiuso_il: oggiISO(), esito, tentativi: (stato?.tentativi || []).length }])
  } catch { /* il riepilogo è un di più */ }
}

// Prossimo contatto col supporto: { data, motivo } — i giorni contano da quando il recupero è ATTIVO
export function prossimoContatto(item, oggi = oggiISO()) {
  const inizio = item.stato?.attivo_dal || item.stato?.iniziato || oggi
  const tentativi = item.stato?.tentativi || []
  const primo = item.proto?.primoContattoGiorni ?? GIORNI_PRIMO_CONTATTO
  if (!tentativi.length) {
    const d = new Date(new Date(inizio + 'T00:00:00').getTime() + primo * 86400000).toLocaleDateString('sv-SE')
    return { data: d, motivo: 'primo contatto' }
  }
  const ultimo = [...tentativi].sort((a, b) => String(a.data).localeCompare(String(b.data))).slice(-1)[0]
  if (ultimo.esito === 'attesa') return { data: null, motivo: 'in attesa di risposta' }
  const d = new Date(new Date(ultimo.data + 'T00:00:00').getTime() + GIORNI_TRA_TENTATIVI * 86400000).toLocaleDateString('sv-SE')
  return { data: d, motivo: 'nuovo tentativo' }
}

// Azioni di oggi per l'agenda
export function azioniRecuperoOggi(item, oggi = oggiISO()) {
  const { book, tipo, proto } = item
  if (!proto || !proto.disponibile) return []
  const azioni = []
  const d = new Date(oggi + 'T00:00:00')
  const settimana = Math.floor((d - new Date(d.getFullYear(), 0, 1)) / (7 * 86400000))
  const giorno = d.getDay()
  const lbl = tipo === 'sport' ? 'limitato sport' : 'limitato bonus'
  const p = proto.periodica
  if (p && p.frequenza === 'settimanale') {
    const g = hashStr(`${book.id}|${tipo}|sett${settimana}|giorno`) % 7
    if (giorno === g) {
      const sezioni = p.sezioni || []
      const sez = sezioni.length ? sezioni[hashStr(`${book.id}|${tipo}|sett${settimana}|sez`) % sezioni.length] : ''
      azioni.push(`🔧 Recupero (${lbl}): ${p.testo}${sez ? ` — oggi ${sez}` : ''}`)
    }
  }
  if (p && p.frequenza === 'mensile') {
    // un giorno casuale in ognuna delle (volte) parti del mese, così le giornate sono distanziate
    const volte = p.volte || 1
    const seg = Math.floor(28 / volte)
    const giorni = new Set()
    for (let k = 0; k < volte; k++) giorni.add(k * seg + 1 + (hashStr(`${book.id}|${tipo}|${d.getFullYear()}-${d.getMonth()}|${k}`) % seg))
    if (giorni.has(d.getDate())) {
      const sezioni = p.sezioni || []
      const sez = sezioni.length ? sezioni[hashStr(`${book.id}|${tipo}|${oggi}|sez`) % sezioni.length] : ''
      azioni.push(`🔧 Recupero (${lbl}): ${p.testo}${sez ? ` — oggi ${sez}` : ''}`)
    }
  }
  const pc = prossimoContatto(item, oggi)
  if (pc.data && oggi >= pc.data) azioni.push(`🔧 Recupero (${lbl}): ${proto.testoContatto || 'contatta il supporto (chat/mail) per info sulle promozioni, da GIOCATORE, poi chiedi la rivalutazione del conto'}`)
  return azioni
}

// 27/09/2026 — Avvisi PERSISTENTI del recupero (tabella avvisi_conti, vedi AvvisiConti.jsx).
// Stesse regole di azioniRecuperoOggi, ma ogni avviso ha una chiave stabile: resta finché Sergio non lo segna Fatto.
//   periodica → una chiave per giornata · contatto → una chiave per data di contatto (non si duplica ogni giorno)
//   verifica sport → ogni 30 giorni dall'inizio del recupero sport
export function avvisiRecupero(item, oggi = oggiISO()) {
  const { book, tipo, proto, stato } = item
  if (!proto || !proto.disponibile) return []
  if (!recuperoAttivo(item)) return []          // in coda: nessuna azione finché non entra tra gli attivi
  const out = []
  const lbl = tipo === 'sport' ? 'limitato sport' : 'limitato bonus'
  const base = `rec|${book.id}|${tipo}`
  const meta = { flusso: tipo, book_id: String(book.id) }
  // periodica: se oggi azioniRecuperoOggi la prevede
  const periodiche = azioniRecuperoOggi({ ...item, stato: { ...(stato || {}), tentativi: [{ data: oggi, esito: 'attesa' }] } }, oggi)
  periodiche.forEach((testo, i) => out.push({ chiave: `${base}|per|${oggi}|${i}`, tipo: 'recupero', titolo: testo.replace(/^🔧 Recupero \([^)]*\): /, ''), sottotitolo: `🔧 Recupero ${lbl}`, meta: { ...meta, azione: 'periodica' } }))
  const pc = prossimoContatto(item, oggi)
  if (pc.data && oggi >= pc.data) out.push({ chiave: `${base}|contatto|${pc.data}`, tipo: 'recupero', data_prevista: pc.data, titolo: proto.testoContatto || 'contatta il supporto (chat/mail) per info sulle promozioni, da GIOCATORE, poi chiedi la rivalutazione del conto', sottotitolo: `🔧 Recupero ${lbl} · ${pc.motivo}`, meta: { ...meta, azione: 'contatto' } })
  const inizioAtt = stato?.attivo_dal || stato?.iniziato
  if (tipo === 'sport' && inizioAtt) {
    const n = Math.floor(diffGiorni(inizioAtt, oggi) / GIORNI_VERIFICA_SPORT)
    if (n >= 1) {
      const d = new Date(new Date(inizioAtt + 'T00:00:00').getTime() + n * GIORNI_VERIFICA_SPORT * 86400000).toLocaleDateString('sv-SE')
      out.push({ chiave: `${base}|verifica|${d}`, tipo: 'recupero', data_prevista: d, titolo: 'verifica se la limitazione sport è stata tolta', sottotitolo: `🔧 Recupero limitato sport · controllo ogni ${GIORNI_VERIFICA_SPORT} giorni`, meta: { ...meta, azione: 'verifica_sport' } })
    }
  }
  return out
}

// ─── STILI ──────────────────────────────────────────────────────────
const inp = { background: '#0b1220', color: '#f8fafc', border: '1px solid rgba(51,65,85,0.9)', borderRadius: 8, padding: '5px 8px', fontSize: 12 }
const btn = (c) => ({ padding: '5px 10px', borderRadius: 8, border: `1px solid ${c}66`, background: `${c}1a`, color: c, fontWeight: 700, fontSize: 12, cursor: 'pointer' })
const LIV = { attivo: ['🟢 Profilazione', '#22c55e'], dormiente: ['⚫ Dormiente', '#94a3b8'] }

// ─── PANNELLO NELLA TAB PROFILAZIONE ────────────────────────────────
export default function RecuperoContiPanel({ books, recuperi, setRecuperi, setBooks, setAvvisi, avvisi, getClasseBook, getRecuperoProtocollo, onMessage, onError }) {
  const lista = contiInRecupero(books, recuperi, getRecuperoProtocollo)
  const [aperto, setAperto] = useState(null)
  const [nuovoTent, setNuovoTent] = useState({})
  const [salvando, setSalvando] = useState(false)
  const [mostra, setMostra] = useState(true)
  const [mostraCoda, setMostraCoda] = useState(false)
  const [mostraRiepilogo, setMostraRiepilogo] = useState(false)
  const [esiti, setEsiti] = useState([])
  useEffect(() => { supabase.from('recupero_esiti').select('*').then(({ data }) => setEsiti(data || [])) }, [recuperi])
  const oggi = oggiISO()
  const attivi = lista.filter(recuperoAttivo)
  const coda = codaRecuperi(lista, getClasseBook)
  if (lista.length === 0 && !(books || []).some(b => b.sport_bloccato)) return null
  const chiave = (it) => `${it.book.id}|${it.tipo}`

  async function assicuraRiga(it) {
    if (it.stato) return it.stato
    const { data, error } = await supabase.from('recupero_conti').upsert([{ book_id: it.book.id, tipo: it.tipo, iniziato: oggi }], { onConflict: 'book_id,tipo' }).select().single()
    if (error) { onError('Errore recupero: ' + error.message); return null }
    setRecuperi(prev => [...prev.filter(r => !(String(r.book_id) === String(it.book.id) && r.tipo === it.tipo)), data])
    return data
  }
  async function aggiorna(it, campi) {
    const riga = await assicuraRiga(it)
    if (!riga) return
    const { data, error } = await supabase.from('recupero_conti').update(campi).eq('id', riga.id).select().single()
    if (error) { onError('Errore recupero: ' + error.message); return }
    setRecuperi(prev => prev.map(r => r.id === riga.id ? data : r))
  }
  async function spuntaPasso(it, idx) {
    const fatti = { ...(it.stato?.passi_fatti || {}) }
    if (fatti[idx]) delete fatti[idx]; else fatti[idx] = oggi
    await aggiorna(it, { passi_fatti: fatti })
  }
  async function aggiungiTentativo(it) {
    const f = nuovoTent[chiave(it)] || { data: oggi, esito: 'attesa', nota: '' }
    const tentativi = [...(it.stato?.tentativi || []), { data: f.data || oggi, esito: f.esito, nota: (f.nota || '').trim() }]
    await aggiorna(it, { tentativi })
    setNuovoTent(p => ({ ...p, [chiave(it)]: { data: oggi, esito: 'attesa', nota: '' } }))
  }
  async function eliminaTentativo(it, i) {
    const tentativi = (it.stato?.tentativi || []).filter((_, k) => k !== i)
    await aggiorna(it, { tentativi })
  }
  async function recuperato(it) {
    if (!window.confirm(`${it.book.nome} · ${it.book.intestatario || ''}: segnare come RECUPERATO (limitazione ${it.tipo})? La parola chiave esce dalla nota (il testo originale resta nello storico).`)) return
    setSalvando(true)
    try { await aggiornaNotaBook(it.book, togliParola(it.book.note, it.tipo), `recuperato ${it.tipo} il ${dataIt(oggi)}`, setBooks) }
    catch (error) { setSalvando(false); onError('Errore aggiornamento nota: ' + error.message); return }
    await annullaAvvisiFlusso(it.book.id, it.tipo, `recuperato ${it.tipo} il ${dataIt(oggi)}`, setAvvisi)
    await registraEsitoRecupero(it.book, it.tipo, it.stato, 'recuperato')
    if (it.stato) {
      await supabase.from('recupero_conti').delete().eq('id', it.stato.id)
      setRecuperi(prev => prev.filter(r => r.id !== it.stato.id))
    }
    setSalvando(false)
    onMessage(`${it.book.nome} (${it.book.intestatario || '—'}) recuperato 🎉 — nota aggiornata`)
  }

  async function attivaOra(it) {
    const pieno = attivi.length >= MAX_RECUPERI_ATTIVI
    if (!window.confirm(`${it.book.nome} · ${it.book.intestatario || '—'} (limitato ${it.tipo}): attivo il recupero adesso?${pieno ? `\n\nAttenzione: i recuperi attivi sono già ${attivi.length} su ${MAX_RECUPERI_ATTIVI}, questo li supera.` : ''}`)) return
    setSalvando(true)
    await aggiorna(it, { attivo_dal: oggi, in_attesa_manuale: false })
    setSalvando(false)
    onMessage(`⏫ Recupero attivato: ${it.book.nome} (${it.book.intestatario || '—'})`)
  }
  async function mettiInAttesa(it) {
    if (!window.confirm(`${it.book.nome} · ${it.book.intestatario || '—'} (limitato ${it.tipo}): lo rimetto in coda?\nNon riceve più azioni e non rientra da solo: lo riattivi tu con ⏫. Il suo posto va al primo della coda.`)) return
    setSalvando(true)
    await aggiorna(it, { attivo_dal: null, in_attesa_manuale: true })
    await annullaAvvisiFlusso(it.book.id, it.tipo, 'recupero rimesso in coda', setAvvisi)
    setSalvando(false)
    onMessage(`⏸ In coda: ${it.book.nome} (${it.book.intestatario || '—'})`)
  }

  async function sportBloccato(it, valore) {
    const msg = valore
      ? `${it.book.nome} · ${it.book.intestatario || ''}: questo conto NON potrà MAI PIÙ scommettere sullo sport?\nEsce dal recupero sport e da tutti gli incroci sport di Lucy (resta per il casinò).`
      : `${it.book.nome} · ${it.book.intestatario || ''}: riabilitare lo sport su questo conto?`
    if (!window.confirm(msg)) return
    setSalvando(true)
    const { error } = await supabase.from('books').update({ sport_bloccato: valore }).eq('id', it.book.id)
    if (error) { setSalvando(false); onError('Errore: ' + error.message + ' (hai lanciato sport_bloccato.sql?)'); return }
    setBooks(prev => prev.map(b => b.id === it.book.id ? { ...b, sport_bloccato: valore } : b))
    if (valore && it.stato) {
      await registraEsitoRecupero(it.book, it.tipo, it.stato, 'non scommette più')
      await supabase.from('recupero_conti').delete().eq('id', it.stato.id)
      setRecuperi(prev => prev.filter(r => r.id !== it.stato.id))
    }
    setSalvando(false)
    onMessage(valore ? `🚫 ${it.book.nome} (${it.book.intestatario || '—'}): sport bloccato per sempre` : `✅ ${it.book.nome} (${it.book.intestatario || '—'}): sport riabilitato`)
  }
  const bloccati = (books || []).filter(b => b.sport_bloccato)

  const daFareOggi = attivi.filter(it => azioniRecuperoOggi(it, oggi).length > 0).length
  // riepilogo per book: attivi, in coda, recuperati, non scommette più, giorni medi per recuperare, azioni fatte
  const riepilogo = (() => {
    const m = {}
    const riga = (nome) => { const k = String(nome || '—').toLowerCase().trim(); return (m[k] = m[k] || { nome: nome || '—', attivi: 0, coda: 0, recuperati: 0, persi: 0, giorni: [], azioni: 0 }) }
    for (const it of lista) riga(it.book.nome)[recuperoAttivo(it) ? 'attivi' : 'coda']++
    for (const e of esiti) { const r = riga(e.nome); if (e.esito === 'recuperato') { r.recuperati++; const da = e.attivo_dal || e.iniziato; if (da && e.chiuso_il) r.giorni.push(diffGiorni(da, e.chiuso_il)) } else r.persi++ }
    for (const a of avvisi || []) if (a.tipo === 'recupero' && a.stato === 'fatto') { const b = (books || []).find(x => String(x.id) === String(a.book_id)); if (b) riga(b.nome).azioni++ }
    return Object.values(m).sort((a, b) => (b.attivi + b.coda) - (a.attivi + a.coda))
  })()

  return (
    <div style={{ background: 'rgba(239,68,68,0.06)', border: '1px solid rgba(239,68,68,0.35)', borderRadius: 16, padding: '14px 16px', marginBottom: 16 }}>
      <div onClick={() => setMostra(!mostra)} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', cursor: 'pointer', gap: 8, flexWrap: 'wrap' }}>
        <div style={{ fontSize: 14, fontWeight: 900, color: '#fca5a5' }}>🔧 Recupero conti limitati · attivi {attivi.length}/{MAX_RECUPERI_ATTIVI} · in coda {coda.length} {mostra ? '▾' : '▸'}</div>
        <div style={{ fontSize: 12, color: '#94a3b8' }}>
          {daFareOggi > 0 ? <b style={{ color: '#fbbf24' }}>{daFareOggi} con azioni oggi</b> : 'nessuna azione oggi'} · scrivi "limitato bonus" o "limitato sport" nella nota del book
        </div>
      </div>
      {mostra && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginTop: 10 }}>
          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
            <button style={btn('#94a3b8')} onClick={() => setMostraCoda(!mostraCoda)}>⏳ Coda ({coda.length}) {mostraCoda ? '▾' : '▸'}</button>
            <button style={btn('#94a3b8')} onClick={() => setMostraRiepilogo(!mostraRiepilogo)}>📊 Riepilogo per book {mostraRiepilogo ? '▾' : '▸'}</button>
          </div>
          {mostraRiepilogo && (
            <div style={{ overflowX: 'auto', background: 'rgba(11,18,32,0.75)', border: '1px solid rgba(51,65,85,0.7)', borderRadius: 12, padding: 8 }}>
              <table style={{ width: '100%', fontSize: 12, color: '#e2e8f0', borderCollapse: 'collapse' }}>
                <thead><tr style={{ color: '#94a3b8', textAlign: 'right' }}><th style={{ textAlign: 'left', padding: 4 }}>Book</th><th>Attivi</th><th>In coda</th><th>Recuperati</th><th>Non scommettono più</th><th>Giorni medi</th><th>Azioni fatte</th></tr></thead>
                <tbody>{riepilogo.map(r => (
                  <tr key={r.nome} style={{ textAlign: 'right', borderTop: '1px solid rgba(51,65,85,0.5)' }}>
                    <td style={{ textAlign: 'left', padding: 4, fontWeight: 700 }}>{r.nome}</td><td>{r.attivi}</td><td>{r.coda}</td>
                    <td style={{ color: r.recuperati ? '#22c55e' : undefined }}>{r.recuperati}</td><td style={{ color: r.persi ? '#f87171' : undefined }}>{r.persi}</td>
                    <td>{r.giorni.length ? Math.round(r.giorni.reduce((x, y) => x + y, 0) / r.giorni.length) : '—'}</td><td style={{ paddingRight: 4 }}>{r.azioni}</td>
                  </tr>))}</tbody>
              </table>
              <div style={{ fontSize: 11, color: '#64748b', marginTop: 4 }}>I recuperati e i "non scommettono più" si contano da oggi in poi. Giorni medi: da quando il recupero è attivo a quando è recuperato.</div>
            </div>
          )}
          {mostraCoda && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 4, background: 'rgba(11,18,32,0.5)', borderRadius: 12, padding: 8 }}>
              <div style={{ fontSize: 11, color: '#94a3b8' }}>In ordine di priorità: profilazione → mantenimento → dormienti, poi book di classe A → B → C, poi la limitazione più vecchia. Entrano da soli quando si libera un posto.</div>
              {coda.map((it, i) => (
                <div key={chiave(it)} style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap', fontSize: 12, padding: '4px 6px', borderTop: '1px solid rgba(51,65,85,0.4)' }}>
                  <span style={{ color: '#64748b', width: 24 }}>{i + 1}.</span>
                  <b style={{ color: '#f8fafc' }}>{it.book.nome}</b>
                  <span style={{ color: '#94a3b8' }}>{it.book.intestatario || '—'}</span>
                  <span style={{ color: it.tipo === 'bonus' ? '#f87171' : '#facc15' }}>limitato {it.tipo}</span>
                  {!it.proto?.disponibile && <span style={{ color: '#f87171' }}>{it.proto?.motivo || 'nessun protocollo'}</span>}
                  {it.stato?.in_attesa_manuale && <span style={{ color: '#fbbf24' }}>⏸ messo in coda a mano</span>}
                  {it.proto?.disponibile && <button style={{ ...btn('#38bdf8'), marginLeft: 'auto' }} disabled={salvando} onClick={() => attivaOra(it)}>⏫ Attiva ora</button>}
                </div>
              ))}
            </div>
          )}
          {attivi.map(it => {
            const k = chiave(it)
            const isOpen = aperto === k
            const proto = it.proto
            const fatti = it.stato?.passi_fatti || {}
            const tentativi = it.stato?.tentativi || []
            const giorni = it.stato?.iniziato ? diffGiorni(it.stato.iniziato, oggi) : 0
            const pc = proto?.disponibile ? prossimoContatto(it, oggi) : null
            const azOggi = azioniRecuperoOggi(it, oggi)
            const [livLbl, livCol] = LIV[it.book.profilo_livello] || (String(it.book.profilo_livello || '').startsWith('mantenimento') ? ['🟡 Mantenimento', '#fbbf24'] : ['— Non impostato', '#64748b'])
            const nPassi = proto?.passi?.length || 0
            const nFatti = Object.keys(fatti).length
            const f = nuovoTent[k] || { data: oggi, esito: 'attesa', nota: '' }
            return (
              <div key={k} style={{ background: 'rgba(11,18,32,0.75)', border: `1px solid ${azOggi.length ? 'rgba(251,191,36,0.5)' : 'rgba(51,65,85,0.7)'}`, borderRadius: 12 }}>
                <div onClick={() => setAperto(isOpen ? null : k)} style={{ padding: '9px 12px', display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer', flexWrap: 'wrap' }}>
                  <span style={{ color: '#f87171', fontSize: 11, transform: isOpen ? 'rotate(90deg)' : 'none', display: 'inline-block' }}>▶</span>
                  <b style={{ color: '#f8fafc', fontSize: 13 }}>{it.book.nome}</b>
                  <span style={{ color: '#94a3b8', fontSize: 12 }}>{it.book.intestatario || '—'}</span>
                  <span style={{ fontSize: 10, padding: '2px 7px', borderRadius: 6, fontWeight: 800, background: it.tipo === 'bonus' ? 'rgba(239,68,68,0.18)' : 'rgba(250,204,21,0.18)', color: it.tipo === 'bonus' ? '#f87171' : '#facc15' }}>limitato {it.tipo}</span>
                  <span style={{ fontSize: 10, color: livCol }}>{livLbl}</span>
                  <span style={{ marginLeft: 'auto', fontSize: 11, color: '#64748b' }}>
                    {!proto?.disponibile ? <span style={{ color: '#f87171' }}>{proto?.motivo || 'recupero non disponibile'}</span>
                      : <>{it.stato ? `da ${giorni} gg` : 'appena rilevato'} · passi {nFatti}/{nPassi} · tentativi {tentativi.length}{pc?.data ? ` · supporto dal ${dataIt(pc.data)}` : pc ? ` · ${pc.motivo}` : ''}</>}
                  </span>
                </div>
                {azOggi.length > 0 && !isOpen && (
                  <div style={{ padding: '0 12px 8px 30px', fontSize: 12, color: '#fbbf24' }}>{azOggi.map((a, i) => <div key={i}>{a}</div>)}</div>
                )}
                {isOpen && (
                  <div style={{ padding: '4px 14px 12px 30px', fontSize: 12, color: '#cbd5e1' }}>
                    {!proto?.disponibile ? (
                      <div style={{ color: '#fca5a5' }}>{proto?.motivo || 'Nessuna procedura di recupero per questo book.'}</div>
                    ) : (
                      <>
                        <div style={{ color: '#94a3b8', marginBottom: 6 }}>Fonte: {proto.fonte}{proto.nota ? ` · ${proto.nota}` : ''}</div>
                        {azOggi.length > 0 && <div style={{ color: '#fbbf24', fontWeight: 700, marginBottom: 6 }}>{azOggi.map((a, i) => <div key={i}>{a}</div>)}</div>}
                        <div style={{ fontWeight: 800, color: '#f8fafc', margin: '6px 0 4px' }}>Passaggi</div>
                        {proto.passi.map((p, i) => (
                          <label key={i} style={{ display: 'flex', gap: 8, alignItems: 'flex-start', padding: '2px 0', cursor: 'pointer', color: fatti[i] ? '#64748b' : '#e2e8f0', textDecoration: fatti[i] ? 'line-through' : 'none' }}>
                            <input type="checkbox" checked={!!fatti[i]} onChange={() => spuntaPasso(it, i)} style={{ marginTop: 2 }} />
                            <span>{p}{fatti[i] ? <span style={{ color: '#22c55e', textDecoration: 'none' }}> · fatto il {dataIt(fatti[i])}</span> : null}</span>
                          </label>
                        ))}
                        <div style={{ fontWeight: 800, color: '#f8fafc', margin: '10px 0 4px' }}>Tentativi con il supporto</div>
                        {tentativi.length === 0 && <div style={{ color: '#64748b' }}>Nessun tentativo ancora{pc?.data ? ` · primo contatto previsto dal ${dataIt(pc.data)}` : ''}</div>}
                        {tentativi.map((t, i) => (
                          <div key={i} style={{ display: 'flex', gap: 8, alignItems: 'center', padding: '2px 0' }}>
                            <span style={{ color: '#94a3b8' }}>{dataIt(t.data)}</span>
                            <b style={{ color: t.esito === 'ok' ? '#22c55e' : t.esito === 'no' ? '#f87171' : '#fbbf24' }}>{t.esito === 'ok' ? 'sbloccato' : t.esito === 'no' ? 'rifiutato' : 'in attesa'}</b>
                            <span>{t.nota}</span>
                            <button onClick={() => eliminaTentativo(it, i)} style={{ background: 'transparent', border: 'none', color: '#f87171', cursor: 'pointer', marginLeft: 'auto' }}>🗑</button>
                          </div>
                        ))}
                        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', alignItems: 'center', marginTop: 6 }}>
                          <input type="date" value={f.data} onChange={e => setNuovoTent(p => ({ ...p, [k]: { ...f, data: e.target.value } }))} style={inp} />
                          <select value={f.esito} onChange={e => setNuovoTent(p => ({ ...p, [k]: { ...f, esito: e.target.value } }))} style={inp}>
                            <option value="attesa">in attesa di risposta</option>
                            <option value="no">rifiutato</option>
                            <option value="ok">sbloccato</option>
                          </select>
                          <input value={f.nota} placeholder="nota (operatore, cosa hai detto…)" onChange={e => setNuovoTent(p => ({ ...p, [k]: { ...f, nota: e.target.value } }))} style={{ ...inp, flex: 1, minWidth: 160 }} />
                          <button style={btn('#38bdf8')} onClick={() => aggiungiTentativo(it)}>Registra tentativo</button>
                        </div>
                        <div style={{ fontSize: 11, color: '#64748b', marginTop: 4 }}>Dopo un rifiuto l'agenda ti ricorda di riprovare dopo {GIORNI_TRA_TENTATIVI} giorni.</div>
                      </>
                    )}
                    <div style={{ marginTop: 10, display: 'flex', justifyContent: 'flex-end', gap: 8, flexWrap: 'wrap' }}>
                      {it.tipo === 'sport' && <button style={btn('#f87171')} disabled={salvando} onClick={() => sportBloccato(it, true)} title="Il book non fa più scommettere: esce per sempre dallo sport">🚫 Non scommette più</button>}
                      <button style={btn('#94a3b8')} disabled={salvando} onClick={() => mettiInAttesa(it)} title="Libera il posto per il primo della coda">⏸ Metti in coda</button>
                      <button style={btn('#22c55e')} disabled={salvando} onClick={() => recuperato(it)}>✅ Recuperato</button>
                    </div>
                  </div>
                )}
              </div>
            )
          })}
          {bloccati.length > 0 && (
            <div style={{ fontSize: 12, color: '#94a3b8', marginTop: 4, padding: '8px 10px', borderRadius: 10, background: 'rgba(11,18,32,0.6)', border: '1px solid rgba(51,65,85,0.6)' }}>
              <b style={{ color: '#f87171' }}>🚫 Sport bloccato per sempre ({bloccati.length})</b> — fuori da tutti gli incroci sport, restano per il casinò:
              {bloccati.map(b => (
                <span key={b.id} style={{ marginLeft: 8, whiteSpace: 'nowrap' }}>
                  {b.nome} · {b.intestatario || '—'}
                  <button onClick={() => sportBloccato({ book: b, stato: null }, false)} title="Riabilita lo sport" style={{ marginLeft: 4, background: 'transparent', border: '1px solid rgba(100,116,139,.6)', color: '#94a3b8', borderRadius: 6, fontSize: 10, padding: '0 5px', cursor: 'pointer' }}>annulla</button>
                </span>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  )
}
