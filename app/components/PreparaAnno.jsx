"use client";
// 28/11/2026 · CONTABILITÀ: "Prepara l'anno nuovo". Parte dalle voci di dicembre, Sergio sceglie cosa copiare e con quali importi,
// e crea i 12 mesi (tutte le righe come "previsto").
import React, { useState } from 'react'
import { supabase } from '../profit-tracker/supabaseClient'

// voci che di solito NON si ripetono per tutto l'anno: partono senza spunta (si possono spuntare)
const NON_RICORRENTI = /klarna|gennaio|febbraio|marzo|aprile|maggio|giugno|luglio|agosto|settembre|ottobre|novembre|dicembre/i

export function righeModello(stimeCassa, annoNuovo) {
  const prima = (stimeCassa || []).filter(r => Number(r.anno) === annoNuovo - 1)
  if (!prima.length) return []
  const ultimoMese = Math.max(...prima.map(r => Number(r.mese)))
  return prima.filter(r => Number(r.mese) === ultimoMese)
    .sort((a, b) => Number(a.ordine ?? 0) - Number(b.ordine ?? 0) || Number(a.id) - Number(b.id))
}

export function righeAnnoNuovo(scelte, annoNuovo) {
  const out = []
  for (let mese = 1; mese <= 12; mese++) {
    scelte.forEach((s, i) => out.push({ anno: annoNuovo, mese, voce: s.voce, importo: s.importo, stato: 'previsto', note: s.note || '', ordine: i + 1 }))
  }
  return out
}

const leggiImporto = (v) => { const n = Number(String(v).trim().replace(',', '.')); return Number.isFinite(n) ? n : null }
const eur = (v) => new Intl.NumberFormat('it-IT', { style: 'currency', currency: 'EUR' }).format(Number(v || 0))
const inp = { background: '#0b1220', color: '#f8fafc', border: '1px solid rgba(51,65,85,0.9)', borderRadius: 8, padding: '5px 8px', fontSize: 13 }
const btn = (c) => ({ padding: '8px 14px', borderRadius: 10, border: `1px solid ${c}88`, background: `${c}22`, color: c, fontWeight: 800, fontSize: 13, cursor: 'pointer' })

export default function PreparaAnno({ annoNuovo, stimeCassa, onCreato, onChiudi }) {
  const [voci, setVoci] = useState(() => righeModello(stimeCassa, annoNuovo).map(r => ({
    id: r.id,
    usa: !NON_RICORRENTI.test(r.voce || ''),
    voce: r.voce || '',
    importo: String(r.importo ?? 0),
    note: (String(r.note || '').match(/\[g:\d+\]/) || [''])[0],   // si tiene solo il giorno di scadenza
  })))
  const [salvando, setSalvando] = useState(false)
  const [errore, setErrore] = useState('')
  const cambia = (i, campo, valore) => setVoci(prev => prev.map((v, j) => j === i ? { ...v, [campo]: valore } : v))
  const scelte = voci.filter(v => v.usa)
  const totaleMese = scelte.reduce((s, v) => s + (leggiImporto(v.importo) || 0), 0)

  async function crea() {
    setErrore('')
    if (!scelte.length) return setErrore('Spunta almeno una voce.')
    const pronte = scelte.map(v => ({ ...v, importo: leggiImporto(v.importo) }))
    const sbagliata = pronte.find(v => v.importo === null)
    if (sbagliata) return setErrore(`Importo non valido nella voce "${sbagliata.voce}"`)
    setSalvando(true)
    // controllo sul database: se l'anno esiste già (altro dispositivo) non si duplica
    const gia = await supabase.from('stime_cassa').select('id').eq('anno', annoNuovo).limit(1)
    if (gia.error || (gia.data || []).length) {
      setSalvando(false)
      return setErrore(gia.error ? gia.error.message : `Il ${annoNuovo} esiste già: ricarica la pagina.`)
    }
    // un solo inserimento: o entrano tutte le righe o nessuna
    const { data, error } = await supabase.from('stime_cassa').insert(righeAnnoNuovo(pronte, annoNuovo)).select()
    setSalvando(false)
    if (error) return setErrore(error.message)
    onCreato(data || [])
  }

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(2,6,23,0.8)', zIndex: 10000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}>
      <div style={{ background: '#0f172a', border: '1px solid #334155', borderRadius: 16, padding: 18, width: 'min(680px, 100%)', maxHeight: '90vh', display: 'flex', flexDirection: 'column' }}>
        <div style={{ fontSize: 18, fontWeight: 900, color: '#f8fafc' }}>Prepara il {annoNuovo}</div>
        <div style={{ fontSize: 13, color: '#94a3b8', margin: '6px 0 12px' }}>
          Voci dell'ultimo mese del {annoNuovo - 1}. Controlla spunte e importi: le voci scelte vengono copiate in tutti i 12 mesi come «Prev.».
          Rate Klarna e voci col nome di un mese partono senza spunta. Dopo puoi correggere, aggiungere o togliere righe mese per mese.
        </div>
        <div style={{ overflowY: 'auto', flex: 1 }}>
          {voci.map((v, i) => (
            <div key={v.id} style={{ display: 'flex', gap: 8, alignItems: 'center', padding: '4px 0', opacity: v.usa ? 1 : 0.5 }}>
              <input type='checkbox' checked={v.usa} onChange={e => cambia(i, 'usa', e.target.checked)} aria-label={`copia ${v.voce}`} />
              <input value={v.voce} onChange={e => cambia(i, 'voce', e.target.value)} style={{ ...inp, flex: 1, minWidth: 0 }} />
              <input value={v.importo} onChange={e => cambia(i, 'importo', e.target.value)} inputMode='decimal' style={{ ...inp, width: 100, textAlign: 'right' }} />
            </div>
          ))}
        </div>
        <div style={{ marginTop: 12, fontSize: 13, color: '#e2e8f0' }}>
          {scelte.length} voci · al mese <b>{eur(totaleMese)}</b> · nell'anno <b>{eur(totaleMese * 12)}</b>
        </div>
        {errore && <div style={{ color: '#fca5a5', fontSize: 13, marginTop: 6 }}>{errore}</div>}
        <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', marginTop: 12 }}>
          <button onClick={onChiudi} disabled={salvando} style={btn('#94a3b8')}>Annulla</button>
          <button onClick={crea} disabled={salvando} style={btn('#22c55e')}>{salvando ? 'Creo…' : `Crea ${scelte.length * 12} righe`}</button>
        </div>
      </div>
    </div>
  )
}
