"use client";
// ════════════════════════════════════════════════════════════════════
// PROFILAZIONI MIRATE (28/09/2026) — gruppi di conti (book + cliente) per operazioni di casinò live.
// Ogni gruppo si ripete ogni N giorni; con ✅ Fatta si registra l'operazione (storico con i conti coinvolti).
// I conti di un gruppo NON ricevono più la profilazione casinò normale (la sostituisce): il filtro è in
// ProfitTrackerClient (getAzioniOggiBase → togliCasinoMirate). Tabelle: profilazioni_mirate, profilazioni_mirate_fatte.
// ════════════════════════════════════════════════════════════════════
import React, { useState } from 'react'
import { supabase } from '../profit-tracker/supabaseClient'

const oggiISO = () => new Date().toLocaleDateString('sv-SE')
const addGiorni = (iso, n) => { const d = new Date(iso + 'T00:00:00'); d.setDate(d.getDate() + n); return d.toLocaleDateString('sv-SE') }
const diffGiorni = (da, a) => Math.round((new Date(a + 'T00:00:00') - new Date(da + 'T00:00:00')) / 86400000)
const dataIt = (iso) => iso ? iso.split('-').reverse().join('/') : ''
const inp = { background: '#020617', color: '#f8fafc', border: '1px solid #475569', borderRadius: 8, padding: '6px 9px', fontSize: 13 }
const btn = (c) => ({ padding: '5px 10px', borderRadius: 8, border: `1px solid ${c}66`, background: `${c}1a`, color: c, fontWeight: 700, fontSize: 12, cursor: 'pointer' })

// prossima data di un gruppo: ultima fatta + N giorni (+ giorni di pausa totale); mai fatta = oggi
export function prossimaMirata(g, fatte, giorniPausa) {
  const ultime = fatte.filter(f => f.gruppo_id === g.id).map(f => f.data).sort()
  const ultima = ultime[ultime.length - 1] || null
  if (!ultima) return { ultima: null, prossima: oggiISO() }
  const n = Number(g.ogni_giorni || 7)
  return { ultima, prossima: addGiorni(ultima, n + (giorniPausa ? giorniPausa(ultima, oggiISO()) : 0)) }
}

export default function ProfilazioniMiratePanel({ books, terminato, gruppi, setGruppi, fatte, setFatte, giorniPausa, onProfilazione, onProfilazioneTutti, onApri, onMessage, onError }) {
  const [aperto, setAperto] = useState(true)
  const [edit, setEdit] = useState(null)          // { id?, nome, ogni_giorni, conti: [book_id], cerca }
  const [storico, setStorico] = useState(null)    // id gruppo con lo storico aperto
  const oggi = oggiISO()
  const bookDi = id => (books || []).find(b => String(b.id) === String(id))

  const righe = (gruppi || []).map(g => ({ g, ...prossimaMirata(g, fatte || [], giorniPausa) }))
    .sort((a, b) => a.prossima.localeCompare(b.prossima))
  const daFare = righe.filter(r => r.prossima <= oggi).length

  async function salva() {
    const e = edit
    if (!e.nome.trim()) { onError('Dai un nome al gruppo'); return }
    if (!e.conti.length) { onError('Aggiungi almeno un conto'); return }
    const riga = { nome: e.nome.trim(), ogni_giorni: Math.max(1, Number(e.ogni_giorni) || 7), conti: e.conti.map(String), tipo: 'casino live' }
    const q = e.id ? supabase.from('profilazioni_mirate').update(riga).eq('id', e.id).select().single()
      : supabase.from('profilazioni_mirate').insert([riga]).select().single()
    const { data, error } = await q
    if (error) { onError('Gruppo non salvato: lancia profilazioni_mirate.sql (' + error.message + ')'); return }
    setGruppi(prev => e.id ? prev.map(x => x.id === data.id ? data : x) : [...prev, data])
    setEdit(null)
    onMessage(`🎯 ${data.nome}: ${data.conti.length} conti, ogni ${data.ogni_giorni} giorni`)
  }
  async function elimina(g) {
    if (!window.confirm(`Elimino il gruppo "${g.nome}"?\nLo storico delle operazioni fatte resta salvato. I suoi conti tornano alla profilazione casinò normale.`)) return
    const { error } = await supabase.from('profilazioni_mirate').delete().eq('id', g.id)
    if (error) { onError(error.message); return }
    setGruppi(prev => prev.filter(x => x.id !== g.id))
  }
  async function fatta(g) {
    const nomi = g.conti.map(bookDi).filter(Boolean).map(b => `${b.nome} – ${b.intestatario || '—'}`)
    if (!window.confirm(`✅ Operazione fatta su "${g.nome}" oggi?\n\n${nomi.join('\n')}\n\nLa prossima sarà tra ${g.ogni_giorni} giorni.`)) return
    const { data, error } = await supabase.from('profilazioni_mirate_fatte').insert([{ gruppo_id: g.id, nome_gruppo: g.nome, data: oggi, conti: g.conti }]).select().single()
    if (error) { onError('Non registrata: ' + error.message); return }
    setFatte(prev => [...prev, data])
    onMessage(`✅ ${g.nome} registrata · prossima il ${dataIt(addGiorni(oggi, g.ogni_giorni))}`)
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
            <button style={btn('#facc15')} onClick={() => setEdit({ ...edit, conti: [...edit.conti, ...trovati.map(b => String(b.id))], cerca: '' })}>➕ Aggiungi tutti ({trovati.length})</button>
          </div>
        )}
        {trovati.length > 0 && (
          <div style={{ marginTop: 4, border: '1px solid #334155', borderRadius: 8, overflowY: 'auto', maxHeight: 320 }}>
            {trovati.map(b => {
              return <div key={b.id} onClick={() => setEdit({ ...edit, conti: [...edit.conti, String(b.id)] })} style={{ padding: '5px 10px', cursor: 'pointer', display: 'flex', gap: 8, fontSize: 12, borderTop: '1px solid #1e293b' }}>
                <b>{b.nome}</b><span style={{ color: '#94a3b8' }}>{b.intestatario || '—'}</span>
                {inAltri(b.id) && <span style={{ marginLeft: 'auto', color: '#fbbf24' }}>già in {inAltri(b.id).nome}</span>}
              </div>
            })}
          </div>
        )}
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4, marginTop: 8 }}>
          {edit.conti.map(id => { const b = bookDi(id); return (
            <span key={id} style={{ fontSize: 12, padding: '3px 8px', borderRadius: 999, background: 'rgba(250,204,21,0.12)', border: '1px solid rgba(250,204,21,0.35)', color: '#fde68a' }}>
              {b ? `${b.nome} · ${b.intestatario || '—'}` : `conto ${id}`} <span onClick={() => setEdit({ ...edit, conti: edit.conti.filter(x => x !== id) })} style={{ cursor: 'pointer', marginLeft: 4, color: '#f87171' }}>✕</span>
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
          {righe.map(({ g, ultima, prossima }) => {
            const ritardo = prossima < oggi ? diffGiorni(prossima, oggi) : 0
            const stato = prossima <= oggi ? (ritardo ? `in ritardo di ${ritardo} gg` : 'da fare oggi') : `tra ${diffGiorni(oggi, prossima)} gg (${dataIt(prossima)})`
            const conti = (g.conti || []).map(bookDi).filter(Boolean)
            const nonProf = conti.filter(b => b.profilo_livello !== 'attivo')
            const libri = [...new Set(conti.map(b => b.nome))]
            return (
              <div key={g.id} style={{ background: 'rgba(11,18,32,0.75)', border: `1px solid ${prossima <= oggi ? 'rgba(248,113,113,0.5)' : 'rgba(51,65,85,0.7)'}`, borderRadius: 12, padding: '8px 12px' }}>
                <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
                  <b style={{ color: '#fde047', fontSize: 13 }}>🎯 {g.nome}</b>
                  <span style={{ fontSize: 12, color: '#cbd5e1' }}>{conti.length} conti · ogni {g.ogni_giorni} gg · ultima {ultima ? dataIt(ultima) : 'mai'}</span>
                  <span style={{ fontSize: 12, fontWeight: 800, color: prossima <= oggi ? '#f87171' : '#94a3b8' }}>{stato}</span>
                  <span style={{ marginLeft: 'auto', display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                    {onApri && libri.map(nb => <button key={nb} style={btn('#38bdf8')} title={`Apri ${nb} sui telefoni di questi conti`} onClick={() => onApri(nb, conti.filter(b => b.nome === nb))}>📱 {nb}</button>)}
                    <button style={btn('#22c55e')} onClick={() => fatta(g)}>✅ Fatta</button>
                    <button style={btn('#94a3b8')} onClick={() => setStorico(storico === g.id ? null : g.id)}>📜</button>
                    <button style={btn('#facc15')} onClick={() => setEdit({ id: g.id, nome: g.nome, ogni_giorni: g.ogni_giorni, conti: (g.conti || []).map(String), cerca: '' })}>✏️</button>
                    <button style={btn('#f87171')} onClick={() => elimina(g)}>🗑</button>
                  </span>
                </div>
                <div style={{ fontSize: 11, color: '#94a3b8', marginTop: 4 }}>{conti.map(b => `${b.nome} · ${b.intestatario || '—'}`).join('  ·  ')}</div>
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
