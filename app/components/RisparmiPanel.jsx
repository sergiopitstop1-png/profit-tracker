"use client";
// ════════════════════════════════════════════════════════════════════
// RISPARMI SAMU E MASSI — conto deposito
// Samu e Massi versano soldi, Sergio li usa e paga un interesse mensile.
//   saldo = somma dei movimenti (versamenti +, prelievi -, interessi +)
//   interesse del mese M = saldo al 1° di M × tasso in vigore al 1° di M
//   (un versamento fatto il 10 matura dal mese dopo; un prelievo del 10 ha già preso l'interesse del mese)
// Gli interessi li scrive l'app da sola (automatico = true), recuperando anche i mesi arretrati.
// Tabelle: risparmi_movimenti, risparmi_tassi. Storico fino a set 2026 importato da memo_savings_rows.
// ════════════════════════════════════════════════════════════════════
import React, { useState } from 'react'
import { supabase } from '../profit-tracker/supabaseClient'

export const PERSONE = [
  { key: 'massimiliano', nome: 'Massimiliano' },
  { key: 'samuele', nome: 'Samuele' },
]
const MESI = ['gennaio', 'febbraio', 'marzo', 'aprile', 'maggio', 'giugno', 'luglio', 'agosto', 'settembre', 'ottobre', 'novembre', 'dicembre']

const eur = (v) => new Intl.NumberFormat('it-IT', { style: 'currency', currency: 'EUR' }).format(Number(v || 0))
const r2 = (v) => Math.round(Number(v || 0) * 100) / 100
const oggiISO = () => new Date().toLocaleDateString('sv-SE')
const meseIdx = (iso) => { const [y, m] = String(iso).split('-').map(Number); return y * 12 + (m - 1) }
const idxToMese = (i) => `${Math.floor(i / 12)}-${String((i % 12) + 1).padStart(2, '0')}`
const meseLabel = (ym) => { const [y, m] = ym.split('-').map(Number); return `${MESI[m - 1]} ${y}` }
const pct = (v) => `${Number(v || 0).toLocaleString('it-IT', { maximumFractionDigits: 3 })}%`
const dataIt = (iso) => iso ? iso.split('-').reverse().join('/') : ''

export function tassoAl(tassi, iso) {
  const validi = (tassi || []).filter(t => t.valido_dal <= iso).sort((a, b) => b.valido_dal.localeCompare(a.valido_dal))
  return validi.length ? Number(validi[0].tasso) : 0
}

// Interessi automatici mancanti fino al mese corrente incluso, per tutte le persone.
export function interessiDaMaturare(movimenti = [], tassi = [], oggi = oggiISO()) {
  const nuovi = []
  const idxOggi = meseIdx(oggi)
  for (const { key: persona } of PERSONE) {
    const miei = movimenti.filter(m => m.persona === persona)
    if (miei.length === 0) continue
    const mesiInteressi = miei.filter(m => m.tipo === 'interessi').map(m => m.mese_interesse).sort()
    const primoMov = miei.map(m => m.data).sort()[0]
    let i = mesiInteressi.length ? meseIdx(mesiInteressi[mesiInteressi.length - 1]) + 1 : meseIdx(primoMov) + 1
    const generati = []
    for (; i <= idxOggi; i++) {
      const mese = idxToMese(i)
      const inizio = `${mese}-01`
      const saldo = [...miei, ...generati].filter(m => m.data < inizio).reduce((s, m) => s + Number(m.importo || 0), 0)
      const tasso = tassoAl(tassi, inizio)
      const importo = saldo > 0 ? r2(saldo * tasso / 100) : 0
      const riga = { persona, data: inizio, tipo: 'interessi', importo, mese_interesse: mese, automatico: true, causale: `interessi ${meseLabel(mese)} (${pct(tasso)})` }
      generati.push(riga)
      nuovi.push(riga)
    }
  }
  return nuovi
}

// Scrive gli interessi mancanti e restituisce la lista aggiornata. Se un altro dispositivo li ha già
// scritti (vincolo unico), ricarica da Supabase.
export async function maturaInteressi(movimenti, tassi) {
  const nuovi = interessiDaMaturare(movimenti, tassi)
  if (nuovi.length === 0) return movimenti
  const { data, error } = await supabase.from('risparmi_movimenti').insert(nuovi).select()
  if (error) {
    const { data: ricaricati } = await supabase.from('risparmi_movimenti').select('*').order('data', { ascending: true }).order('id', { ascending: true })
    return normalizza(ricaricati || movimenti)
  }
  return [...movimenti, ...normalizza(data || [])]
}

export const normalizza = (rows) => (rows || []).map(m => ({ ...m, importo: Number(m.importo || 0) }))

export function calcolaRisparmi(movimenti = [], tassi = [], oggi = oggiISO()) {
  const perPersona = {}
  const prossimoInizio = `${idxToMese(meseIdx(oggi) + 1)}-01`
  for (const { key } of PERSONE) {
    const miei = movimenti.filter(m => m.persona === key)
    const saldo = r2(miei.reduce((s, m) => s + Number(m.importo || 0), 0))
    const tassoProssimo = tassoAl(tassi, prossimoInizio)
    perPersona[key] = {
      saldo,
      tassoAttuale: tassoAl(tassi, oggi),
      tassoProssimo,
      prossimoInteresse: saldo > 0 ? r2(saldo * tassoProssimo / 100) : 0,
      prossimoMese: prossimoInizio.slice(0, 7),
    }
  }
  const totale = r2(Object.values(perPersona).reduce((s, p) => s + p.saldo, 0))
  return { perPersona, totale }
}

// ─── STILI ──────────────────────────────────────────────────────────
const inp = { background: '#0b1220', color: '#f8fafc', border: '1px solid rgba(51,65,85,0.9)', borderRadius: 8, padding: '5px 8px', fontSize: 13 }
const btn = (c) => ({ padding: '5px 10px', borderRadius: 8, border: `1px solid ${c}66`, background: `${c}1a`, color: c, fontWeight: 700, fontSize: 12, cursor: 'pointer' })
const COLORE = { versamento: '#4ade80', prelievo: '#f87171', interessi: '#94a3b8' }

// ─── CARD PER LA TAB ACCANTONAMENTI ─────────────────────────────────
export function RisparmiCard({ movimenti, tassi, setMovimenti, setTassi, onMessage, onError, panelStyle }) {
  const calc = calcolaRisparmi(movimenti, tassi)
  const [form, setForm] = useState({})
  const [mostraTutti, setMostraTutti] = useState({})
  const [salvando, setSalvando] = useState(false)
  const [nuovoTasso, setNuovoTasso] = useState({ valido_dal: '', tasso: '' })
  const getForm = (p) => form[p] || { tipo: 'prelievo', data: oggiISO(), importo: '', causale: '' }
  const setF = (p, v) => setForm(prev => ({ ...prev, [p]: { ...getForm(p), ...v } }))

  // Dopo una modifica con data nel passato: rifà gli interessi automatici dei mesi successivi
  async function ricalcolaDa(persona, dataIso, lista, tassiUsati = tassi) {
    const meseD = dataIso.slice(0, 7)
    const daRifare = lista.filter(m => m.persona === persona && m.automatico && m.mese_interesse > meseD)
    let aggiornata = lista
    if (daRifare.length) {
      const { error } = await supabase.from('risparmi_movimenti').delete().in('id', daRifare.map(m => m.id))
      if (error) { onError('Errore ricalcolo interessi: ' + error.message); return lista }
      aggiornata = lista.filter(m => !daRifare.includes(m))
    }
    const nuovi = interessiDaMaturare(aggiornata.filter(m => m.persona === persona), tassiUsati)
    if (nuovi.length) {
      const { data, error } = await supabase.from('risparmi_movimenti').insert(nuovi).select()
      if (error) { onError('Errore ricalcolo interessi: ' + error.message); return aggiornata }
      aggiornata = [...aggiornata, ...normalizza(data)]
    }
    return aggiornata
  }

  async function registra(persona) {
    const f = getForm(persona)
    const valore = Math.abs(Number(String(f.importo).replace(',', '.')))
    if (!(valore > 0) || !f.data) { onError('Inserisci data e importo'); return }
    setSalvando(true)
    const importo = f.tipo === 'prelievo' ? -valore : valore
    const { data, error } = await supabase.from('risparmi_movimenti')
      .insert([{ persona, data: f.data, tipo: f.tipo, importo, causale: f.causale.trim() }]).select().single()
    if (error) { setSalvando(false); onError('Errore registrazione: ' + error.message); return }
    const lista = await ricalcolaDa(persona, f.data, [...movimenti, ...normalizza([data])])
    setMovimenti(lista)
    setSalvando(false)
    setF(persona, { importo: '', causale: '' })
    const nome = PERSONE.find(p => p.key === persona).nome
    onMessage(f.tipo === 'prelievo'
      ? `Prelievo di ${eur(valore)} per ${nome} registrato. Ricorda di registrare l'uscita sul wallet usato.`
      : `Versamento di ${eur(valore)} di ${nome} registrato. Matura interessi dal mese successivo.`)
  }

  async function elimina(m) {
    if (!window.confirm(`Eliminare ${m.tipo} di ${eur(Math.abs(m.importo))} del ${dataIt(m.data)}? Gli interessi dei mesi successivi verranno ricalcolati.`)) return
    setSalvando(true)
    const { error } = await supabase.from('risparmi_movimenti').delete().eq('id', m.id)
    if (error) { setSalvando(false); onError('Errore eliminazione: ' + error.message); return }
    const lista = await ricalcolaDa(m.persona, m.data, movimenti.filter(x => x.id !== m.id))
    setMovimenti(lista)
    setSalvando(false)
  }

  async function aggiornaCausale(m, causale) {
    const { error } = await supabase.from('risparmi_movimenti').update({ causale }).eq('id', m.id)
    if (error) { onError('Errore aggiornamento: ' + error.message); return }
    setMovimenti(movimenti.map(x => x.id === m.id ? { ...x, causale } : x))
  }

  async function salvaTasso() {
    const tasso = Number(String(nuovoTasso.tasso).replace(',', '.'))
    if (!nuovoTasso.valido_dal || !(tasso >= 0)) { onError('Inserisci data e tasso'); return }
    const valido_dal = `${nuovoTasso.valido_dal.slice(0, 7)}-01` // il tasso vale da inizio mese
    setSalvando(true)
    const { data, error } = await supabase.from('risparmi_tassi').upsert([{ valido_dal, tasso }], { onConflict: 'valido_dal' }).select().single()
    if (error) { setSalvando(false); onError('Errore tasso: ' + error.message); return }
    const tassiNuovi = [...tassi.filter(t => t.valido_dal !== valido_dal), data]
    setTassi(tassiNuovi)
    // se il tasso parte da un mese già passato, rifà gli interessi automatici da lì
    let lista = movimenti
    const giornoPrima = new Date(new Date(valido_dal + 'T00:00:00').getTime() - 86400000).toLocaleDateString('sv-SE')
    for (const { key } of PERSONE) lista = await ricalcolaDa(key, giornoPrima, lista, tassiNuovi)
    setMovimenti(lista)
    setSalvando(false)
    setNuovoTasso({ valido_dal: '', tasso: '' })
    onMessage(`Tasso ${pct(tasso)} al mese dal ${dataIt(valido_dal)} salvato`)
  }

  const tassiOrdinati = [...(tassi || [])].sort((a, b) => a.valido_dal.localeCompare(b.valido_dal))

  return (
    <div style={{ ...(panelStyle || {}), gridColumn: '1 / -1' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 12, flexWrap: 'wrap' }}>
        <div>
          <h2 style={{ color: '#f8fafc', fontSize: 18, fontWeight: 800, margin: 0 }}>Risparmi Samu e Massi</h2>
          <p style={{ color: '#94a3b8', fontSize: 12, marginTop: 4 }}>
            Conto deposito · interessi accreditati da soli il 1° di ogni mese sul saldo a quella data ·
            tasso {tassiOrdinati.map(t => `${pct(t.tasso)} dal ${dataIt(t.valido_dal)}`).join(', ')}
          </p>
        </div>
        <div style={{ fontSize: 26, fontWeight: 800, color: '#f8fafc' }}>{eur(calc.totale)}</div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(340px, 1fr))', gap: 16, marginTop: 12 }}>
        {PERSONE.map(({ key, nome }) => {
          const p = calc.perPersona[key]
          const f = getForm(key)
          const lista = movimenti.filter(m => m.persona === key && !(m.tipo === 'interessi' && Number(m.importo) === 0))
            .sort((a, b) => b.data.localeCompare(a.data) || (a.tipo === 'interessi') - (b.tipo === 'interessi') || b.id - a.id)
          const visibili = mostraTutti[key] ? lista : lista.slice(0, 8)
          return (
            <div key={key} style={{ background: 'rgba(11,18,32,0.6)', border: '1px solid rgba(51,65,85,0.8)', borderRadius: 12, padding: 14 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
                <span style={{ fontWeight: 800, color: '#f8fafc' }}>{nome}</span>
                <span style={{ fontSize: 20, fontWeight: 900, color: '#4ade80' }}>{eur(p.saldo)}</span>
              </div>
              <div style={{ fontSize: 12, color: '#94a3b8', marginTop: 2 }}>
                prossimo interesse ({meseLabel(p.prossimoMese)}, {pct(p.tassoProssimo)}): ~{eur(p.prossimoInteresse)} sul saldo di oggi
              </div>

              <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', alignItems: 'center', marginTop: 10 }}>
                <select value={f.tipo} onChange={e => setF(key, { tipo: e.target.value })} style={{ ...inp, color: COLORE[f.tipo] }}>
                  <option value='prelievo'>prelievo</option><option value='versamento'>versamento</option>
                </select>
                <input type='date' value={f.data} onChange={e => setF(key, { data: e.target.value })} style={inp} />
                <input placeholder='€' value={f.importo} onChange={e => setF(key, { importo: e.target.value })} style={{ ...inp, width: 70 }} />
                <input placeholder='motivo' value={f.causale} onChange={e => setF(key, { causale: e.target.value })} style={{ ...inp, flex: 1, minWidth: 110 }}
                  onKeyDown={e => { if (e.key === 'Enter') registra(key) }} />
                <button style={btn('#22c55e')} disabled={salvando} onClick={() => registra(key)}>Registra</button>
              </div>

              <div style={{ marginTop: 10, display: 'flex', flexDirection: 'column', gap: 2 }}>
                {visibili.map(m => (
                  <div key={m.id} style={{ display: 'grid', gridTemplateColumns: '78px 86px 1fr 26px', gap: 6, alignItems: 'center', fontSize: 12, padding: '3px 0', borderBottom: '1px solid rgba(51,65,85,0.35)' }}>
                    <span style={{ color: '#64748b' }}>{dataIt(m.data)}</span>
                    <span style={{ color: COLORE[m.tipo], fontWeight: 800, textAlign: 'right' }}>{m.importo > 0 ? '+' : ''}{eur(m.importo)}</span>
                    {m.tipo === 'interessi'
                      ? <span style={{ color: '#64748b' }}>{m.causale || 'interessi'}</span>
                      : <input key={m.id + (m.causale || '')} defaultValue={m.causale || ''} placeholder={m.tipo}
                          onBlur={e => e.target.value !== (m.causale || '') && aggiornaCausale(m, e.target.value)}
                          style={{ ...inp, padding: '2px 6px', fontSize: 12, background: 'transparent', border: '1px solid transparent' }} />}
                    {m.automatico
                      ? <span title='calcolato automaticamente' style={{ color: '#334155', textAlign: 'center' }}>⚙</span>
                      : <button title='elimina' disabled={salvando} onClick={() => elimina(m)} style={{ background: 'transparent', border: 'none', color: '#f87171', cursor: 'pointer', fontSize: 12 }}>🗑</button>}
                  </div>
                ))}
              </div>
              {lista.length > 8 && (
                <button style={{ ...btn('#94a3b8'), marginTop: 8 }} onClick={() => setMostraTutti(prev => ({ ...prev, [key]: !prev[key] }))}>
                  {mostraTutti[key] ? 'Mostra solo gli ultimi' : `Mostra tutti i ${lista.length} movimenti`}
                </button>
              )}
            </div>
          )
        })}
      </div>

      <div style={{ display: 'flex', gap: 6, alignItems: 'center', flexWrap: 'wrap', marginTop: 12, fontSize: 11, color: '#64748b' }}>
        <span>Cambia tasso: dal mese</span>
        <input type='month' value={nuovoTasso.valido_dal.slice(0, 7)} onChange={e => setNuovoTasso({ ...nuovoTasso, valido_dal: e.target.value ? e.target.value + '-01' : '' })} style={{ ...inp, fontSize: 11 }} />
        <input placeholder='% al mese' value={nuovoTasso.tasso} onChange={e => setNuovoTasso({ ...nuovoTasso, tasso: e.target.value })} style={{ ...inp, width: 80, fontSize: 11 }} />
        <button style={btn('#94a3b8')} disabled={salvando} onClick={salvaTasso}>Salva tasso</button>
      </div>
    </div>
  )
}
