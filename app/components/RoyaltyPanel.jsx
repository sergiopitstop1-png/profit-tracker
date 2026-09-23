"use client";
// ════════════════════════════════════════════════════════════════════
// ROYALTY CLIENTI
// Ogni cliente ha un "conto": matura ogni mese la quota del suo accordo,
// scala royalty e anticipi pagati, i premi non scalano nulla.
//   saldo = maturato - (royalty + anticipi)   → quanto gli devi oggi
//   accantonamento royalty = somma dei saldi di tutti i clienti
// La frequenza decide solo QUANDO si paga: mensili al giorno X (banner in
// dashboard), annuali a giugno o dicembre.
// Tabelle: royalty_accordi, royalty_pagamenti (+ dashboard_settings.royalty_giorno_mensile)
// ════════════════════════════════════════════════════════════════════
import React, { useState } from 'react'
import { supabase } from '../profit-tracker/supabaseClient'

const MESI = ['gennaio', 'febbraio', 'marzo', 'aprile', 'maggio', 'giugno', 'luglio', 'agosto', 'settembre', 'ottobre', 'novembre', 'dicembre']
const GIORNI_TOLLERANZA_RITARDO = 5 // oltre questi giorni dal giorno di pagamento l'avviso diventa "in ritardo"

const eur = (v) => new Intl.NumberFormat('it-IT', { style: 'currency', currency: 'EUR' }).format(Number(v || 0))
const r2 = (v) => Math.round(Number(v || 0) * 100) / 100
const oggiISO = () => new Date().toLocaleDateString('sv-SE')
const meseIdx = (iso) => { const [y, m] = String(iso).split('-').map(Number); return y * 12 + (m - 1) }
const idxToPeriodo = (i) => `${Math.floor(i / 12)}-${String((i % 12) + 1).padStart(2, '0')}`
const periodoLabel = (p) => { const [y, m] = String(p).split('-').map(Number); return m ? `${MESI[m - 1]} ${y}` : p }
const giorniNelMese = (y, m) => new Date(y, m, 0).getDate() // m = 1..12
const giornoPrima = (iso) => new Date(new Date(iso + 'T00:00:00').getTime() - 86400000).toLocaleDateString('sv-SE')
const primoMeseProssimo = () => { const d = new Date(); return new Date(d.getFullYear(), d.getMonth() + 1, 1).toLocaleDateString('sv-SE') }

function accordoAttivoAl(accordi, iso) {
  return accordi.find(a => a.valido_dal <= iso && (!a.valido_al || a.valido_al >= iso)) || null
}

function descriviAccordo(a) {
  if (!a) return 'nessun accordo'
  if (a.frequenza === 'nessuna') return 'nessuna royalty'
  if (a.frequenza === 'mensile') return `mensile · ${eur(a.importo_mensile)}/mese`
  return `annuale ${MESI[(a.mese_pagamento || 12) - 1]} · ${eur(a.importo_mensile)}/mese (${eur(a.importo_mensile * 12)}/anno)`
}

// ─── CALCOLO ────────────────────────────────────────────────────────
export function calcolaRoyalty(accordi = [], pagamenti = [], giornoGenerale = 26, oggi = oggiISO()) {
  const idxOggi = meseIdx(oggi)
  const [yOggi, mOggi, dOggi] = oggi.split('-').map(Number)
  const perCliente = {}
  const cli = (id) => (perCliente[id] = perCliente[id] || { maturato: 0, pagato: 0, premi: 0, saldo: 0, accordi: [], attivo: null, prossimaAnnuale: null })

  for (const a of accordi) cli(a.cliente_id).accordi.push(a)
  for (const c of Object.values(perCliente)) c.accordi.sort((x, y) => String(x.valido_dal).localeCompare(String(y.valido_dal)))

  // Maturato: quota mensile × mesi dall'inizio accordo al mese corrente incluso
  for (const a of accordi) {
    if (a.frequenza === 'nessuna' || a.valido_dal > oggi) continue
    const fine = a.valido_al && a.valido_al < oggi ? a.valido_al : oggi
    const mesi = Math.max(0, meseIdx(fine) - meseIdx(a.valido_dal) + 1)
    cli(a.cliente_id).maturato += Number(a.importo_mensile || 0) * mesi
  }
  for (const p of pagamenti) {
    if (p.storico) continue
    if (p.tipo === 'premio') cli(p.cliente_id).premi += Number(p.importo || 0)
    else cli(p.cliente_id).pagato += Number(p.importo || 0)
  }

  const mensiliDaPagare = []
  const prossimiAnnuali = []
  let quotaMensileAttuale = 0

  for (const [id, c] of Object.entries(perCliente)) {
    c.maturato = r2(c.maturato); c.pagato = r2(c.pagato); c.premi = r2(c.premi)
    c.saldo = r2(c.maturato - c.pagato)
    c.attivo = accordoAttivoAl(c.accordi, oggi)
    if (c.attivo && c.attivo.frequenza !== 'nessuna') quotaMensileAttuale += Number(c.attivo.importo_mensile || 0)

    // Mensili: ogni mese dell'accordo, dal giorno di pagamento in poi, senza una royalty con quel periodo
    for (const a of c.accordi) {
      if (a.frequenza !== 'mensile') continue
      const periodiPagati = new Set(pagamenti.filter(p => String(p.cliente_id) === String(id) && !p.storico && p.tipo === 'royalty').map(p => p.periodo))
      const fineIdx = Math.min(idxOggi, a.valido_al ? meseIdx(a.valido_al) : idxOggi)
      for (let i = meseIdx(a.valido_dal); i <= fineIdx; i++) {
        const periodo = idxToPeriodo(i)
        if (periodiPagati.has(periodo)) continue
        const y = Math.floor(i / 12), m = (i % 12) + 1
        const giorno = Math.min(Number(a.giorno_pagamento || giornoGenerale || 26), giorniNelMese(y, m))
        const scadenza = `${periodo}-${String(giorno).padStart(2, '0')}`
        if (scadenza > oggi) continue
        const ritardo = Math.round((new Date(oggi + 'T00:00:00') - new Date(scadenza + 'T00:00:00')) / 86400000)
        mensiliDaPagare.push({ cliente_id: a.cliente_id, periodo, importo: r2(a.importo_mensile), scadenza, giorniRitardo: ritardo, inRitardo: ritardo > GIORNI_TOLLERANZA_RITARDO })
      }
    }

    // Annuali: prossimo mese di pagamento e saldo previsto a quella data
    if (c.attivo && c.attivo.frequenza === 'annuale') {
      const mp = Number(c.attivo.mese_pagamento || 12)
      const anno = mp >= mOggi ? yOggi : yOggi + 1
      const mesiMancanti = (anno * 12 + mp - 1) - idxOggi
      const previsto = r2(c.saldo + Number(c.attivo.importo_mensile || 0) * mesiMancanti)
      c.prossimaAnnuale = { periodo: `${anno}-${String(mp).padStart(2, '0')}`, previsto }
      prossimiAnnuali.push({ cliente_id: Number(id), ...c.prossimaAnnuale })
    }
  }

  mensiliDaPagare.sort((a, b) => a.scadenza.localeCompare(b.scadenza))
  prossimiAnnuali.sort((a, b) => a.periodo.localeCompare(b.periodo))
  const totaleSaldo = r2(Object.values(perCliente).reduce((s, c) => s + c.saldo, 0))
  const totaleMaturato = r2(Object.values(perCliente).reduce((s, c) => s + c.maturato, 0))
  const totalePagato = r2(Object.values(perCliente).reduce((s, c) => s + c.pagato, 0))
  return { perCliente, totaleSaldo, totaleMaturato, totalePagato, quotaMensileAttuale: r2(quotaMensileAttuale), mensiliDaPagare, prossimiAnnuali, dOggi }
}

// ─── SCRITTURE ──────────────────────────────────────────────────────
export async function inserisciPagamento(payload) {
  const { data, error } = await supabase.from('royalty_pagamenti').insert([payload]).select().single()
  if (error) throw new Error(error.message)
  return data
}

// ─── STILI ──────────────────────────────────────────────────────────
const box = { background: 'rgba(11,18,32,0.85)', border: '1px solid rgba(51,65,85,0.8)', borderRadius: 14, padding: '14px 18px' }
const inp = { background: '#0b1220', color: '#f8fafc', border: '1px solid rgba(51,65,85,0.9)', borderRadius: 8, padding: '5px 8px', fontSize: 13 }
const btn = (c) => ({ padding: '6px 12px', borderRadius: 10, border: `1px solid ${c}66`, background: `${c}1a`, color: c, fontWeight: 700, fontSize: 12, cursor: 'pointer' })
const thS = { textAlign: 'left', fontSize: 11, color: '#64748b', fontWeight: 700, padding: '4px 6px', textTransform: 'uppercase' }
const tdS = { padding: '4px 6px', fontSize: 13, color: '#e2e8f0', verticalAlign: 'middle' }
const TIPO_COLORE = { royalty: '#22c55e', anticipo: '#38bdf8', premio: '#c084fc' }

// ─── RIEPILOGO IN CIMA ALLA TAB CLIENTI ─────────────────────────────
export function RoyaltyRiepilogo({ calc, clienti, onPaga, giornoGenerale, onCambiaGiorno }) {
  const nome = (id) => clienti.find(c => String(c.id) === String(id))?.nome || `#${id}`
  const [aperto, setAperto] = useState(true)
  return (
    <div style={{ ...box, marginTop: 16, border: '1px solid rgba(34,197,94,0.35)' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12, flexWrap: 'wrap', cursor: 'pointer' }} onClick={() => setAperto(!aperto)}>
        <div style={{ fontWeight: 900, fontSize: 15, color: '#f8fafc' }}>💶 Royalty {aperto ? '▾' : '▸'}</div>
        <div style={{ display: 'flex', gap: 18, flexWrap: 'wrap', fontSize: 13 }}>
          <span style={{ color: '#94a3b8' }}>Da accantonare: <b style={{ color: '#22c55e' }}>{eur(calc.totaleSaldo)}</b></span>
          <span style={{ color: '#94a3b8' }}>Matura ogni mese: <b style={{ color: '#e2e8f0' }}>{eur(calc.quotaMensileAttuale)}</b></span>
          {calc.mensiliDaPagare.length > 0 && <span style={{ color: '#fbbf24', fontWeight: 800 }}>⚠️ {calc.mensiliDaPagare.length} mensili da pagare</span>}
        </div>
      </div>
      {aperto && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: 16, marginTop: 12 }}>
          <div>
            <div style={{ fontSize: 12, fontWeight: 800, color: '#94a3b8', marginBottom: 6, display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
              MENSILI · pagamento il
              <input key={giornoGenerale} type='number' min='1' max='31' defaultValue={giornoGenerale} style={{ ...inp, width: 56 }} onClick={e => e.stopPropagation()}
                onBlur={e => { const v = Number(e.target.value); if (v >= 1 && v <= 31 && v !== giornoGenerale) onCambiaGiorno(v) }} />
              del mese
            </div>
            {calc.mensiliDaPagare.length === 0
              ? <div style={{ fontSize: 13, color: '#64748b' }}>Nessuna mensilità da pagare ora ✅</div>
              : calc.mensiliDaPagare.map(m => (
                <div key={m.cliente_id + m.periodo} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8, padding: '4px 0', fontSize: 13 }}>
                  <span style={{ color: m.inRitardo ? '#f87171' : '#fbbf24' }}>{nome(m.cliente_id)} · {periodoLabel(m.periodo)} · <b>{eur(m.importo)}</b>{m.inRitardo ? ` · in ritardo di ${m.giorniRitardo} gg` : ''}</span>
                  <button style={btn('#22c55e')} onClick={() => onPaga(m)}>✅ Pagato</button>
                </div>
              ))}
          </div>
          <div>
            <div style={{ fontSize: 12, fontWeight: 800, color: '#94a3b8', marginBottom: 6 }}>ANNUALI · prossimi pagamenti (saldo previsto)</div>
            {calc.prossimiAnnuali.length === 0
              ? <div style={{ fontSize: 13, color: '#64748b' }}>Nessun annuale</div>
              : calc.prossimiAnnuali.map(p => (
                <div key={p.cliente_id} style={{ display: 'flex', justifyContent: 'space-between', padding: '3px 0', fontSize: 13, color: '#cbd5e1' }}>
                  <span>{nome(p.cliente_id)} · {periodoLabel(p.periodo)}</span><b>{eur(p.previsto)}</b>
                </div>
              ))}
          </div>
        </div>
      )}
    </div>
  )
}

// ─── BADGE NELLA RIGA DEL CLIENTE ───────────────────────────────────
export function RoyaltyBadge({ info }) {
  if (!info || !info.attivo || info.attivo.frequenza === 'nessuna') {
    if (info && info.saldo > 0) return <span style={{ fontSize: 11, padding: '2px 8px', borderRadius: 6, background: 'rgba(34,197,94,0.12)', color: '#22c55e', fontWeight: 700 }}>💶 saldo {eur(info.saldo)}</span>
    return null
  }
  const a = info.attivo
  const freq = a.frequenza === 'mensile' ? `${eur(a.importo_mensile)}/mese` : `annuale ${MESI[(a.mese_pagamento || 12) - 1].slice(0, 3)}`
  return (
    <span style={{ fontSize: 11, padding: '2px 8px', borderRadius: 6, background: 'rgba(34,197,94,0.12)', color: '#22c55e', fontWeight: 700 }}>
      💶 {freq} · saldo {eur(info.saldo)}
    </span>
  )
}

// ─── MODALE DI GESTIONE DEL CLIENTE ─────────────────────────────────
export function RoyaltyModal({ cliente, accordi, pagamenti, calc, setAccordi, setPagamenti, onClose, onMessage, onError }) {
  const mieiAccordi = accordi.filter(a => String(a.cliente_id) === String(cliente.id)).sort((x, y) => String(x.valido_dal).localeCompare(String(y.valido_dal)))
  const mieiPagamenti = pagamenti.filter(p => String(p.cliente_id) === String(cliente.id))
    .sort((x, y) => String(y.data || y.periodo || '').localeCompare(String(x.data || x.periodo || '')) || y.id - x.id)
  const info = calc.perCliente[cliente.id] || { maturato: 0, pagato: 0, premi: 0, saldo: 0, attivo: null }
  const attivo = info.attivo
  const [mostraArchivio, setMostraArchivio] = useState(false)
  const [nuovoAcc, setNuovoAcc] = useState({ valido_dal: primoMeseProssimo(), importo_mensile: attivo ? String(attivo.importo_mensile) : '', frequenza: attivo?.frequenza || 'mensile', mese_pagamento: attivo?.mese_pagamento || 12, giorno_pagamento: '', nota: '' })
  const [nuovoPag, setNuovoPag] = useState({ tipo: 'royalty', importo: attivo?.frequenza === 'mensile' ? String(Number(attivo.importo_mensile)) : '', data: oggiISO(), periodo: attivo?.frequenza === 'mensile' ? oggiISO().slice(0, 7) : '', nota: '' })
  const [salvando, setSalvando] = useState(false)

  async function aggiornaAccordo(id, campo, valore) {
    const { error } = await supabase.from('royalty_accordi').update({ [campo]: valore }).eq('id', id)
    if (error) { onError('Errore aggiornamento accordo: ' + error.message); return }
    setAccordi(prev => prev.map(a => a.id === id ? { ...a, [campo]: valore } : a))
  }
  async function eliminaAccordo(id) {
    if (!window.confirm('Eliminare questo accordo? Il maturato di quel periodo sparisce dal saldo.')) return
    const { error } = await supabase.from('royalty_accordi').delete().eq('id', id)
    if (error) { onError('Errore eliminazione accordo: ' + error.message); return }
    setAccordi(prev => prev.filter(a => a.id !== id))
  }
  async function aggiungiAccordo() {
    const importo = Number(String(nuovoAcc.importo_mensile).replace(',', '.'))
    if (!nuovoAcc.valido_dal || (nuovoAcc.frequenza !== 'nessuna' && !(importo >= 0))) { onError('Inserisci data di inizio e importo mensile'); return }
    setSalvando(true)
    // Chiude l'accordo aperto che si sovrapporrebbe: finisce il giorno prima del nuovo
    const daChiudere = mieiAccordi.filter(a => a.valido_dal < nuovoAcc.valido_dal && (!a.valido_al || a.valido_al >= nuovoAcc.valido_dal))
    for (const a of daChiudere) await aggiornaAccordo(a.id, 'valido_al', giornoPrima(nuovoAcc.valido_dal))
    const payload = {
      cliente_id: cliente.id,
      valido_dal: nuovoAcc.valido_dal,
      importo_mensile: nuovoAcc.frequenza === 'nessuna' ? 0 : importo,
      frequenza: nuovoAcc.frequenza,
      mese_pagamento: nuovoAcc.frequenza === 'annuale' ? Number(nuovoAcc.mese_pagamento) : null,
      giorno_pagamento: nuovoAcc.frequenza === 'mensile' && nuovoAcc.giorno_pagamento ? Number(nuovoAcc.giorno_pagamento) : null,
      nota: nuovoAcc.nota.trim(),
    }
    const { data, error } = await supabase.from('royalty_accordi').insert([payload]).select().single()
    setSalvando(false)
    if (error) { onError('Errore nuovo accordo: ' + error.message); return }
    setAccordi(prev => [...prev, data])
    onMessage(`Nuovo accordo dal ${nuovoAcc.valido_dal} salvato${daChiudere.length ? ' (il precedente è stato chiuso il giorno prima)' : ''}`)
  }

  async function aggiornaPagamento(id, campo, valore) {
    const { error } = await supabase.from('royalty_pagamenti').update({ [campo]: valore }).eq('id', id)
    if (error) { onError('Errore aggiornamento pagamento: ' + error.message); return }
    setPagamenti(prev => prev.map(p => p.id === id ? { ...p, [campo]: valore } : p))
  }
  async function eliminaPagamento(id) {
    if (!window.confirm('Eliminare questo pagamento?')) return
    const { error } = await supabase.from('royalty_pagamenti').delete().eq('id', id)
    if (error) { onError('Errore eliminazione pagamento: ' + error.message); return }
    setPagamenti(prev => prev.filter(p => p.id !== id))
  }
  async function aggiungiPagamento() {
    const importo = Number(String(nuovoPag.importo).replace(',', '.'))
    if (!(importo > 0)) { onError('Inserisci un importo valido'); return }
    setSalvando(true)
    try {
      const data = await inserisciPagamento({ cliente_id: cliente.id, tipo: nuovoPag.tipo, importo, data: nuovoPag.data || null, periodo: nuovoPag.periodo.trim(), nota: nuovoPag.nota.trim() })
      setPagamenti(prev => [...prev, data])
      setNuovoPag(p => ({ ...p, importo: '', nota: '' }))
      onMessage(`${nuovoPag.tipo === 'premio' ? 'Premio' : nuovoPag.tipo === 'anticipo' ? 'Anticipo' : 'Royalty'} di ${eur(importo)} a ${cliente.nome} registrato. Ricorda di registrare l'uscita sul wallet usato.`)
    } catch (e) { onError('Errore nuovo pagamento: ' + e.message) }
    setSalvando(false)
  }

  const correnti = mieiPagamenti.filter(p => !p.storico)
  const archivio = mieiPagamenti.filter(p => p.storico)

  const rigaPagamento = (p) => (
    <tr key={p.id}>
      <td style={tdS}><input key={'d' + p.id + p.data} type='date' defaultValue={p.data || ''} style={inp} onBlur={e => e.target.value !== (p.data || '') && aggiornaPagamento(p.id, 'data', e.target.value || null)} /></td>
      <td style={tdS}><input key={'p' + p.id + p.periodo} defaultValue={p.periodo || ''} placeholder='es. 2026-09' style={{ ...inp, width: 90 }} onBlur={e => e.target.value !== (p.periodo || '') && aggiornaPagamento(p.id, 'periodo', e.target.value.trim())} /></td>
      <td style={tdS}>
        <select value={p.tipo} style={{ ...inp, color: TIPO_COLORE[p.tipo] }} onChange={e => aggiornaPagamento(p.id, 'tipo', e.target.value)}>
          <option value='royalty'>royalty</option><option value='anticipo'>anticipo</option><option value='premio'>premio</option>
        </select>
      </td>
      <td style={tdS}><input key={'i' + p.id + p.importo} defaultValue={p.importo} style={{ ...inp, width: 80, textAlign: 'right' }} onBlur={e => { const v = Number(e.target.value.replace(',', '.')); if (v > 0 && v !== Number(p.importo)) aggiornaPagamento(p.id, 'importo', v) }} /></td>
      <td style={tdS}><input key={'n' + p.id + p.nota} defaultValue={p.nota || ''} style={{ ...inp, width: '100%', minWidth: 160 }} onBlur={e => e.target.value !== (p.nota || '') && aggiornaPagamento(p.id, 'nota', e.target.value)} /></td>
      <td style={tdS}><button style={btn('#f87171')} onClick={() => eliminaPagamento(p.id)}>🗑</button></td>
    </tr>
  )

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(2,6,23,0.8)', zIndex: 1000, display: 'flex', alignItems: 'flex-start', justifyContent: 'center', overflowY: 'auto', padding: '30px 12px' }} onClick={onClose}>
      <div style={{ ...box, background: '#0f172a', width: '100%', maxWidth: 980, padding: 22 }} onClick={e => e.stopPropagation()}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 12 }}>
          <div>
            <div style={{ fontSize: 20, fontWeight: 900, color: '#f8fafc' }}>💶 Royalty · {cliente.nome}</div>
            <div style={{ fontSize: 13, color: '#94a3b8', marginTop: 4 }}>{descriviAccordo(attivo)}</div>
          </div>
          <button style={btn('#94a3b8')} onClick={onClose}>✕ Chiudi</button>
        </div>

        <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', margin: '16px 0' }}>
          {[['Maturato', info.maturato, '#e2e8f0'], ['Pagato (royalty + anticipi)', info.pagato, '#38bdf8'], ['Saldo da pagare', info.saldo, info.saldo > 0 ? '#22c55e' : '#94a3b8'], ['Premi (extra)', info.premi, '#c084fc']].map(([l, v, c]) => (
            <div key={l} style={{ ...box, padding: '10px 14px', flex: '1 1 160px' }}>
              <div style={{ fontSize: 11, color: '#64748b', fontWeight: 700, textTransform: 'uppercase' }}>{l}</div>
              <div style={{ fontSize: 18, fontWeight: 900, color: c }}>{eur(v)}</div>
            </div>
          ))}
          {info.prossimaAnnuale && (
            <div style={{ ...box, padding: '10px 14px', flex: '1 1 160px', border: '1px solid rgba(251,191,36,0.4)' }}>
              <div style={{ fontSize: 11, color: '#64748b', fontWeight: 700, textTransform: 'uppercase' }}>Da pagare a {periodoLabel(info.prossimaAnnuale.periodo)}</div>
              <div style={{ fontSize: 18, fontWeight: 900, color: '#fbbf24' }}>{eur(info.prossimaAnnuale.previsto)}</div>
            </div>
          )}
        </div>

        {/* ACCORDI */}
        <div style={{ fontWeight: 800, color: '#f8fafc', margin: '8px 0' }}>📄 Accordi</div>
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead><tr><th style={thS}>Dal</th><th style={thS}>Al</th><th style={thS}>€/mese</th><th style={thS}>Frequenza</th><th style={thS}>Mese / giorno pag.</th><th style={thS}>Nota</th><th style={thS}></th></tr></thead>
            <tbody>
              {mieiAccordi.length === 0 && <tr><td style={{ ...tdS, color: '#64748b' }} colSpan={7}>Nessun accordo: nessuna royalty (es. parenti)</td></tr>}
              {mieiAccordi.map(a => (
                <tr key={a.id} style={{ opacity: a === attivo ? 1 : 0.65 }}>
                  <td style={tdS}><input key={'vd' + a.id + a.valido_dal} type='date' defaultValue={a.valido_dal} style={inp} onBlur={e => e.target.value && e.target.value !== a.valido_dal && aggiornaAccordo(a.id, 'valido_dal', e.target.value)} /></td>
                  <td style={tdS}><input key={'va' + a.id + a.valido_al} type='date' defaultValue={a.valido_al || ''} style={inp} onBlur={e => e.target.value !== (a.valido_al || '') && aggiornaAccordo(a.id, 'valido_al', e.target.value || null)} /></td>
                  <td style={tdS}><input key={'im' + a.id + a.importo_mensile} defaultValue={r2(a.importo_mensile)} style={{ ...inp, width: 80, textAlign: 'right' }} onBlur={e => { const v = Number(e.target.value.replace(',', '.')); if (v >= 0 && Math.abs(v - Number(a.importo_mensile)) >= 0.005) aggiornaAccordo(a.id, 'importo_mensile', v) }} /></td>
                  <td style={tdS}>
                    <select value={a.frequenza} style={inp} onChange={e => aggiornaAccordo(a.id, 'frequenza', e.target.value)}>
                      <option value='mensile'>mensile</option><option value='annuale'>annuale</option><option value='nessuna'>nessuna</option>
                    </select>
                  </td>
                  <td style={tdS}>
                    {a.frequenza === 'annuale' && (
                      <select value={a.mese_pagamento || 12} style={inp} onChange={e => aggiornaAccordo(a.id, 'mese_pagamento', Number(e.target.value))}>
                        {MESI.map((m, i) => <option key={m} value={i + 1}>{m}</option>)}
                      </select>
                    )}
                    {a.frequenza === 'mensile' && (
                      <input key={'gp' + a.id + a.giorno_pagamento} type='number' min='1' max='31' placeholder='generale' defaultValue={a.giorno_pagamento || ''} style={{ ...inp, width: 90 }}
                        onBlur={e => { const v = e.target.value ? Number(e.target.value) : null; if (v !== (a.giorno_pagamento || null)) aggiornaAccordo(a.id, 'giorno_pagamento', v) }} />
                    )}
                  </td>
                  <td style={tdS}><input key={'no' + a.id + a.nota} defaultValue={a.nota || ''} style={{ ...inp, width: '100%', minWidth: 140 }} onBlur={e => e.target.value !== (a.nota || '') && aggiornaAccordo(a.id, 'nota', e.target.value)} /></td>
                  <td style={tdS}><button style={btn('#f87171')} onClick={() => eliminaAccordo(a.id)}>🗑</button></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div style={{ ...box, padding: 12, marginTop: 8, display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
          <span style={{ fontSize: 12, fontWeight: 800, color: '#94a3b8' }}>➕ Nuovo accordo dal</span>
          <input type='date' value={nuovoAcc.valido_dal} onChange={e => setNuovoAcc({ ...nuovoAcc, valido_dal: e.target.value })} style={inp} />
          <select value={nuovoAcc.frequenza} onChange={e => setNuovoAcc({ ...nuovoAcc, frequenza: e.target.value })} style={inp}>
            <option value='mensile'>mensile</option><option value='annuale'>annuale</option><option value='nessuna'>nessuna royalty</option>
          </select>
          {nuovoAcc.frequenza !== 'nessuna' && <input placeholder='€/mese' value={nuovoAcc.importo_mensile} onChange={e => setNuovoAcc({ ...nuovoAcc, importo_mensile: e.target.value })} style={{ ...inp, width: 80 }} />}
          {nuovoAcc.frequenza === 'annuale' && (
            <select value={nuovoAcc.mese_pagamento} onChange={e => setNuovoAcc({ ...nuovoAcc, mese_pagamento: e.target.value })} style={inp}>
              {MESI.map((m, i) => <option key={m} value={i + 1}>paga a {m}</option>)}
            </select>
          )}
          {nuovoAcc.frequenza === 'mensile' && <input type='number' min='1' max='31' placeholder='giorno (vuoto = generale)' value={nuovoAcc.giorno_pagamento} onChange={e => setNuovoAcc({ ...nuovoAcc, giorno_pagamento: e.target.value })} style={{ ...inp, width: 170 }} />}
          <input placeholder='nota' value={nuovoAcc.nota} onChange={e => setNuovoAcc({ ...nuovoAcc, nota: e.target.value })} style={{ ...inp, flex: 1, minWidth: 120 }} />
          <button style={btn('#22c55e')} disabled={salvando} onClick={aggiungiAccordo}>Salva accordo</button>
        </div>

        {/* PAGAMENTI */}
        <div style={{ fontWeight: 800, color: '#f8fafc', margin: '18px 0 8px' }}>💸 Pagamenti</div>
        <div style={{ ...box, padding: 12, marginBottom: 8, display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
          <span style={{ fontSize: 12, fontWeight: 800, color: '#94a3b8' }}>➕ Nuovo</span>
          <select value={nuovoPag.tipo} onChange={e => setNuovoPag({ ...nuovoPag, tipo: e.target.value })} style={{ ...inp, color: TIPO_COLORE[nuovoPag.tipo] }}>
            <option value='royalty'>royalty</option><option value='anticipo'>anticipo (scala il saldo)</option><option value='premio'>premio (extra, non scala)</option>
          </select>
          <input placeholder='importo €' value={nuovoPag.importo} onChange={e => setNuovoPag({ ...nuovoPag, importo: e.target.value })} style={{ ...inp, width: 90 }} />
          <input type='date' value={nuovoPag.data} onChange={e => setNuovoPag({ ...nuovoPag, data: e.target.value })} style={inp} />
          <input placeholder='periodo (es. 2026-09)' value={nuovoPag.periodo} onChange={e => setNuovoPag({ ...nuovoPag, periodo: e.target.value })} style={{ ...inp, width: 150 }} />
          <input placeholder='nota' value={nuovoPag.nota} onChange={e => setNuovoPag({ ...nuovoPag, nota: e.target.value })} style={{ ...inp, flex: 1, minWidth: 120 }} />
          <button style={btn('#22c55e')} disabled={salvando} onClick={aggiungiPagamento}>Registra</button>
        </div>
        <div style={{ fontSize: 11, color: '#64748b', marginBottom: 6 }}>Per i mensili il periodo (anno-mese) dice quale mensilità è stata pagata: è quello che spegne l'avviso nel banner.</div>
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead><tr><th style={thS}>Data</th><th style={thS}>Periodo</th><th style={thS}>Tipo</th><th style={thS}>€</th><th style={thS}>Nota</th><th style={thS}></th></tr></thead>
            <tbody>
              {correnti.length === 0 && <tr><td style={{ ...tdS, color: '#64748b' }} colSpan={6}>Nessun pagamento</td></tr>}
              {correnti.map(rigaPagamento)}
            </tbody>
          </table>
        </div>
        {archivio.length > 0 && (
          <div style={{ marginTop: 12 }}>
            <button style={btn('#94a3b8')} onClick={() => setMostraArchivio(!mostraArchivio)}>{mostraArchivio ? '▾' : '▸'} Archivio anni precedenti ({archivio.length}) · non conta nel saldo</button>
            {mostraArchivio && (
              <div style={{ overflowX: 'auto', marginTop: 8, opacity: 0.8 }}>
                <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                  <tbody>{archivio.map(rigaPagamento)}</tbody>
                </table>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
