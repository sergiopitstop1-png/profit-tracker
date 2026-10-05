"use client";
// ════════════════════════════════════════════════════════════════════
// PROFILAZIONI MIRATE (28/09/2026) — gruppi di conti (book + cliente) per operazioni di casinò live.
// Ogni gruppo si ripete ogni N giorni; con ✅ Fatta si registra l'operazione (storico con i conti coinvolti).
// I conti di un gruppo NON ricevono più la profilazione casinò normale (la sostituisce): il filtro è in
// ProfitTrackerClient (getAzioniOggiBase → togliCasinoMirate). Tabelle: profilazioni_mirate, profilazioni_mirate_fatte.
// 05/10/2026: UNA PERSONA = UN CONTO per gruppo. Al casinò live ci si collega con un solo conto alla volta:
// la stessa persona con due book nello stesso gruppo viene bloccata (aggiunta, salvataggio) e segnalata nei gruppi salvati.
// 05/10/2026: 📝 NOTE del gruppo (cosa fare la prossima volta) — colonna profilazioni_mirate.note (profilazioni_mirate_note.sql).
// ════════════════════════════════════════════════════════════════════
import React, { useState } from 'react'
import { supabase } from '../profit-tracker/supabaseClient'
import SessioneLivePanel from './SessioneLive' // 02/10/2026: numeri a conto nella profilazione mirata

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
const inp = { background: '#020617', color: '#f8fafc', border: '1px solid #475569', borderRadius: 8, padding: '6px 9px', fontSize: 13 }
const btn = (c) => ({ padding: '5px 10px', borderRadius: 8, border: `1px solid ${c}66`, background: `${c}1a`, color: c, fontWeight: 700, fontSize: 12, cursor: 'pointer' })

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

export default function ProfilazioniMiratePanel({ books, terminato, gruppi, setGruppi, fatte, setFatte, giorniPausa, onProfilazione, onProfilazioneTutti, onApri, sitoBook, onMessage, onError }) {
  const [aperto, setAperto] = useState(true)
  const [edit, setEdit] = useState(null)          // { id?, nome, ogni_giorni, conti: [book_id], cerca }
  const [storico, setStorico] = useState(null)    // id gruppo con lo storico aperto
  const [numeri, setNumeri] = useState(null)      // 02/10/2026: id gruppo con la tabella numeri aperta
  const [nota, setNota] = useState(null)          // 05/10/2026: { id, testo } nota in modifica
  const oggi = oggiISO()
  const bookDi = id => (books || []).find(b => String(b.id) === String(id))

  const righe = (gruppi || []).map(g => ({ g, ...prossimaMirata(g, fatte || [], giorniPausa) }))
    .sort((a, b) => a.prossima.localeCompare(b.prossima))
  const daFare = righe.filter(r => r.prossima <= oggi).length

  async function salva() {
    const e = edit
    if (!e.nome.trim()) { onError('Dai un nome al gruppo'); return }
    if (!e.conti.length) { onError('Aggiungi almeno un conto'); return }
    // 05/10/2026: una persona = un conto per gruppo
    const doppie = personeDoppie(e.conti.map(bookDi))
    if (doppie.length) { onError(`⛔ Non salvato: ${doppie.map(d => `${d.persona} è presente ${d.conti.length} volte (${d.conti.map(b => b.nome).join(', ')})`).join(' · ')}. Al casinò live ci si collega con un solo conto per persona: togline uno.`); return }
    const riga = { nome: e.nome.trim(), ogni_giorni: Math.max(1, Number(e.ogni_giorni) || 7), conti: e.conti.map(String), tipo: 'casino live' }
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
    if (!window.confirm(`Elimino il gruppo "${g.nome}"?\nLo storico delle operazioni fatte resta salvato. I suoi conti tornano alla profilazione casinò normale.`)) return
    const { error } = await supabase.from('profilazioni_mirate').delete().eq('id', g.id)
    if (error) { onError(error.message); return }
    setGruppi(prev => prev.filter(x => x.id !== g.id))
  }
  // 02/10/2026 — 📅 la prossima la decide Sergio: gg/mm/aaaa (o gg/mm); vuoto = automatica (ogni N giorni)
  function leggiData(t) {
    const m = String(t || '').trim().match(/^(\d{1,2})[\/.-](\d{1,2})(?:[\/.-](\d{2,4}))?$/)
    if (!m) return null
    let y = m[3] ? Number(m[3]) : Number(oggi.slice(0, 4)); if (y < 100) y += 2000
    const iso = `${y}-${String(m[2]).padStart(2, '0')}-${String(m[1]).padStart(2, '0')}`
    const d = new Date(iso + 'T00:00:00')
    if (Number.isNaN(d.getTime()) || d.getDate() !== Number(m[1])) return null
    return iso < oggi && !m[3] ? `${y + 1}${iso.slice(4)}` : iso
  }
  // 05/10/2026 — 📝 note del gruppo: restano finché non le cancelli tu
  async function salvaNota() {
    const testo = String(nota?.testo || '').trim()
    const { error } = await supabase.from('profilazioni_mirate').update({ note: testo || null }).eq('id', nota.id)
    if (error) { onError('Nota non salvata: lancia profilazioni_mirate_note.sql (' + error.message + ')'); return }
    setGruppi(prev => prev.map(x => x.id === nota.id ? { ...x, note: testo || null } : x))
    onMessage(testo ? '📝 Nota salvata' : '📝 Nota cancellata')
    setNota(null)
  }
  async function scegliProssima(g, proposta) {
    const t = window.prompt(`📅 "${g.nome}": quando fai la prossima?\nScrivi la data (gg/mm/aaaa oppure gg/mm).\nLascia vuoto per la cadenza automatica (ogni ${g.ogni_giorni} giorni).`, proposta ? dataIt(proposta) : '')
    if (t === null) return
    const iso = t.trim() ? leggiData(t) : null
    if (t.trim() && !iso) { onError('Data non valida: usa gg/mm/aaaa'); return }
    const { error } = await supabase.from('profilazioni_mirate').update({ prossima_manuale: iso }).eq('id', g.id)
    if (error) { onError('Data non salvata: ' + error.message + ' (hai lanciato sessioni_live_baccarat.sql?)'); return }
    setGruppi(prev => prev.map(x => x.id === g.id ? { ...x, prossima_manuale: iso } : x))
    onMessage(iso ? `📅 ${g.nome}: prossima il ${dataIt(iso)}` : `📅 ${g.nome}: cadenza automatica ogni ${g.ogni_giorni} giorni`)
  }
  async function fatta(g, daSessione = false) {
    const nomi = g.conti.map(bookDi).filter(Boolean).map(b => `${b.nome} – ${b.intestatario || '—'}`)
    if (!window.confirm(`✅ Operazione fatta su "${g.nome}" oggi?\n\n${nomi.join('\n')}`)) return
    // 02/10/2026: l'importo resta nell'archivio. Se arrivi da 🎰 Numeri gli importi sono già nella sessione salvata.
    let importo = null
    if (!daSessione) {
      const t = window.prompt(`Quanto ha giocato OGNI conto di "${g.nome}" in questa operazione? (€)\nServe per l'archivio. Lascia vuoto se non vuoi indicarlo.`, '')
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
  }
  async function annullaFatta(f) {
    if (!window.confirm(`Tolgo dallo storico l'operazione del ${dataIt(f.data)}?`)) return
    const { error } = await supabase.from('profilazioni_mirate_fatte').delete().eq('id', f.id)
    if (error) { onError(error.message); return }
    setFatte(prev => prev.filter(x => x.id !== f.id))
  }

  // ─── editor del gruppo ───
  const editor = edit && (() => {
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
    const personaGiaNelGruppo = id => { const b = bookDi(id); const k = normNome(b?.intestatario); return k ? edit.conti.map(bookDi).find(x => x && normNome(x.intestatario) === k) : null }
    const aggiungiConti = (ids) => {
      let nuovi = ids.map(String).filter(id => !edit.conti.includes(id))
      // 05/10/2026: una persona = un conto: scarta chi è già nel gruppo e, tra i nuovi, tiene il primo conto di ogni persona
      const visti = new Set(edit.conti.map(bookDi).filter(Boolean).map(b => normNome(b.intestatario)))
      const scartati = []
      nuovi = nuovi.filter(id => { const k = normNome(bookDi(id)?.intestatario); if (k && visti.has(k)) { scartati.push(id); return false } if (k) visti.add(k); return true })
      if (scartati.length) onError(`⛔ Una persona = un conto per sessione. Non aggiunti: ${scartati.map(id => { const g = personaGiaNelGruppo(id); return `${etichetta(id)}${g ? ` (c'è già ${g.nome})` : ''}` }).join(', ')}`)
      if (!nuovi.length) { setEdit({ ...edit, cerca: '' }); return }
      const doppi = nuovi.filter(id => gruppiDi(id).length)
      let daAggiungere = nuovi
      if (doppi.length === 1 && nuovi.length === 1) {
        if (!window.confirm(`⚠️ ${etichetta(doppi[0])} è già in: ${gruppiDi(doppi[0]).join(', ')}.\n\nLo aggiungo anche a "${edit.nome || 'questo gruppo'}"?`)) return
      } else if (doppi.length) {
        const elenco = doppi.map(id => `• ${etichetta(id)} → già in ${gruppiDi(id).join(', ')}`).join('\n')
        const anche = window.confirm(`⚠️ ${doppi.length} di questi conti sono già in altre profilazioni mirate:\n\n${elenco}\n\nOK = aggiungo anche questi\nAnnulla = aggiungo solo i ${nuovi.length - doppi.length} conti nuovi`)
        if (!anche) daAggiungere = nuovi.filter(id => !doppi.includes(id))
      }
      setEdit({ ...edit, conti: [...edit.conti, ...daAggiungere], cerca: '' })
    }
    return (
      <div style={{ marginTop: 10, padding: 12, borderRadius: 12, border: '1px solid rgba(250,204,21,0.45)', background: 'rgba(250,204,21,0.05)' }}>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center', marginBottom: 8 }}>
          <input placeholder="Nome (es. Profilazione 1)" value={edit.nome} onChange={e => setEdit({ ...edit, nome: e.target.value })} style={{ ...inp, minWidth: 200 }} />
          <span style={{ fontSize: 12, color: '#cbd5e1' }}>ogni</span>
          <input type="number" min={1} value={edit.ogni_giorni} onChange={e => setEdit({ ...edit, ogni_giorni: e.target.value })} style={{ ...inp, width: 70 }} />
          <span style={{ fontSize: 12, color: '#cbd5e1' }}>giorni · operazione di casinò live</span>
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
              return <div key={b.id} onClick={() => aggiungiConti([b.id])} style={{ padding: '5px 10px', cursor: 'pointer', display: 'flex', gap: 8, fontSize: 12, borderTop: '1px solid #1e293b' }}>
                <b>{b.nome}</b><span style={{ color: '#94a3b8' }}>{b.intestatario || '—'}</span>
                {inAltri(b.id) && <span style={{ marginLeft: 'auto', color: '#fbbf24' }}>⚠️ già in {gruppiDi(b.id).join(', ')}</span>}
                {personaGiaNelGruppo(b.id) && <span style={{ marginLeft: inAltri(b.id) ? 8 : 'auto', color: '#f87171', fontWeight: 700 }}>⛔ {b.intestatario} è già nel gruppo con {personaGiaNelGruppo(b.id).nome}</span>}
              </div>
            })}
          </div>
        )}
        {(() => { const d = personeDoppie(edit.conti.map(bookDi)); return d.length > 0 && (
          <div style={{ marginTop: 8, padding: '6px 10px', borderRadius: 8, border: '1px solid rgba(248,113,113,0.6)', background: 'rgba(248,113,113,0.10)', color: '#fca5a5', fontSize: 12, fontWeight: 700 }}>
            ⛔ {d.map(x => `${x.persona} è presente ${x.conti.length} volte (${x.conti.map(b => b.nome).join(' + ')})`).join(' · ')}. Al casinò live ci si collega con un solo conto per persona: togline uno con ✕ prima di salvare.
          </div>) })()}
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4, marginTop: 8 }}>
          {edit.conti.map(id => { const b = bookDi(id); const doppio = b && personeDoppie(edit.conti.map(bookDi)).some(x => x.conti.some(c => String(c.id) === String(id))); return (
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

  return (
    <div style={{ background: 'rgba(250,204,21,0.05)', border: '1px solid rgba(250,204,21,0.35)', borderRadius: 16, padding: '12px 16px', marginBottom: 16 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
        <div onClick={() => setAperto(!aperto)} style={{ fontSize: 14, fontWeight: 900, color: '#fde047', cursor: 'pointer' }}>
          🎯 Profilazioni mirate · {(gruppi || []).length} gruppi{daFare ? <span style={{ color: '#f87171' }}> · {daFare} da fare</span> : ''} {aperto ? '▾' : '▸'}
        </div>
        {!edit && <button style={btn('#facc15')} onClick={() => setEdit({ nome: `Profilazione ${(gruppi || []).length + 1}`, ogni_giorni: 7, conti: [], cerca: '' })}>➕ Nuovo gruppo</button>}
      </div>
      {editor}
      {aperto && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginTop: 10 }}>
          {righe.length === 0 && !edit && <div style={{ fontSize: 12, color: '#94a3b8' }}>Nessun gruppo. Crea "Profilazione 1" con i conti che hai taggato su Panda: da quel momento quei conti non ricevono più la profilazione casinò normale.</div>}
          {righe.map(({ g, ultima, prossima, manuale }) => {
            const ritardo = prossima < oggi ? diffGiorni(prossima, oggi) : 0
            const stato = prossima <= oggi ? (ritardo ? `in ritardo di ${ritardo} gg` : 'da fare oggi') : `tra ${diffGiorni(oggi, prossima)} gg (${dataIt(prossima)})`
            const conti = (g.conti || []).map(bookDi).filter(Boolean)
            const nonProf = conti.filter(b => b.profilo_livello !== 'attivo')
            const libri = [...new Set(conti.map(b => b.nome))]
            const doppie = personeDoppie(conti)   // 05/10/2026
            return (
              <div key={g.id} style={{ background: 'rgba(11,18,32,0.75)', border: `1px solid ${prossima <= oggi ? 'rgba(248,113,113,0.5)' : 'rgba(51,65,85,0.7)'}`, borderRadius: 12, padding: '8px 12px' }}>
                <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
                  <b style={{ color: '#fde047', fontSize: 13 }}>🎯 {g.nome}</b>
                  <span style={{ fontSize: 12, color: '#cbd5e1' }}>{conti.length} conti · {manuale ? `📅 data scelta da te (${dataIt(prossima)})` : `ogni ${g.ogni_giorni} gg`} · ultima {ultima ? dataIt(ultima) : 'mai'}</span>
                  <span style={{ fontSize: 12, fontWeight: 800, color: prossima <= oggi ? '#f87171' : '#94a3b8' }}>{stato}</span>
                  <span style={{ marginLeft: 'auto', display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                    {libri.length > 1 && <button style={{ ...btn('#0ea5e9'), fontWeight: 900 }} title="Apre tutti i book del gruppo sui telefoni giusti" onClick={() => apriSuTelefoni(conti, `tutti i book di "${g.nome}"`)}>📱 Apri tutti ({conti.length})</button>}
                    {onApri && libri.map(nb => <button key={nb} style={btn('#38bdf8')} title={`Apri ${nb} sui telefoni di questi conti`} onClick={() => onApri(nb, conti.filter(b => b.nome === nb))}>📱 {nb}</button>)}
                    <button style={{ ...btn('#a78bfa'), fontWeight: 900 }} title="Quanti numeri gioca ogni conto: copertura della roulette, sestine per Lottomatica/GoldBet" onClick={() => setNumeri(numeri === g.id ? null : g.id)}>🎰 Numeri</button>
                    <button style={btn('#22c55e')} onClick={() => fatta(g)}>✅ Fatta</button>
                    <button style={btn('#94a3b8')} title="Scegli tu la data della prossima" onClick={() => scegliProssima(g, prossima)}>📅</button>
                    <button style={{ ...btn(g.note ? '#fbbf24' : '#94a3b8'), fontWeight: g.note ? 900 : 700 }} title={g.note ? 'Modifica la nota' : 'Aggiungi una nota (cosa fare la prossima volta)'} onClick={() => setNota(nota?.id === g.id ? null : { id: g.id, testo: g.note || '' })}>📝</button>
                    <button style={btn('#94a3b8')} onClick={() => setStorico(storico === g.id ? null : g.id)}>📜</button>
                    <button style={btn('#facc15')} onClick={() => setEdit({ id: g.id, nome: g.nome, ogni_giorni: g.ogni_giorni, conti: (g.conti || []).map(String), cerca: '' })}>✏️</button>
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
                {numeri === g.id && (
                  <div style={{ marginTop: 8 }}>
                    <SessioneLivePanel books={books} contiIniziali={conti} origine="mirata" gruppo={g.nome}
                      apriContiSuTelefoni={apriSuTelefoni} onMessage={onMessage} onError={onError}
                      onSalvata={() => { setNumeri(null); fatta(g, true) }} />
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
            )
          })}
        </div>
      )}
    </div>
  )
}
