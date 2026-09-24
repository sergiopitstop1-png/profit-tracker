"use client";
// ════════════════════════════════════════════════════════════════════
// SLOT CONSIGLIATE (lista Profiliamo) — finestra aperta dal pulsante 🎰 dell'agenda
// quando un'azione dice di giocare alle slot. Lista unica per tutti i book.
// Tabella: slot_consigliate (provider, nome, nota, ordine). Modificabile da qui.
// ════════════════════════════════════════════════════════════════════
import React, { useEffect, useState } from 'react'
import { supabase } from '../profit-tracker/supabaseClient'

const inp = { background: '#0b1220', color: '#f8fafc', border: '1px solid rgba(51,65,85,0.9)', borderRadius: 8, padding: '6px 9px', fontSize: 13 }
const btn = (c) => ({ padding: '5px 10px', borderRadius: 8, border: `1px solid ${c}66`, background: `${c}1a`, color: c, fontWeight: 700, fontSize: 12, cursor: 'pointer' })

// true se il testo di un'azione parla di slot (per mostrare il pulsante 🎰)
export const parlaDiSlot = (testo) => /\bslot\b/i.test(String(testo || ''))

export function PulsanteSlot({ onClick }) {
  return (
    <button
      onClick={(e) => { e.stopPropagation(); onClick() }}
      title="Slot consigliate (lista Profiliamo)"
      style={{ marginLeft: 8, padding: '1px 8px', borderRadius: 7, border: '1px solid rgba(251,191,36,0.55)', background: 'rgba(251,191,36,0.12)', color: '#fbbf24', fontWeight: 800, fontSize: 11, cursor: 'pointer', whiteSpace: 'nowrap' }}
    >🎰 Slot</button>
  )
}

export default function SlotConsigliate({ onClose, contesto }) {
  const [slot, setSlot] = useState([])
  const [caricamento, setCaricamento] = useState(true)
  const [errore, setErrore] = useState('')
  const [cerca, setCerca] = useState('')
  const [modifica, setModifica] = useState(false)
  const [nuova, setNuova] = useState({ provider: '', nome: '', nota: '' })

  useEffect(() => {
    let vivo = true
    supabase.from('slot_consigliate').select('*').order('ordine', { ascending: true }).order('id', { ascending: true })
      .then(({ data, error }) => {
        if (!vivo) return
        if (error) setErrore('Impossibile caricare la lista: ' + error.message)
        else setSlot(data || [])
        setCaricamento(false)
      })
    return () => { vivo = false }
  }, [])

  const q = cerca.trim().toLowerCase()
  const filtrate = slot.filter(s => !q || s.nome.toLowerCase().includes(q) || s.provider.toLowerCase().includes(q) || (s.nota || '').toLowerCase().includes(q))
  const gruppi = []
  filtrate.forEach(s => {
    let g = gruppi.find(x => x.provider === s.provider)
    if (!g) { g = { provider: s.provider, voci: [] }; gruppi.push(g) }
    g.voci.push(s)
  })
  const providers = [...new Set(slot.map(s => s.provider))]

  async function aggiungi() {
    const provider = nuova.provider.trim(), nome = nuova.nome.trim()
    if (!provider || !nome) { setErrore('Inserisci provider e nome'); return }
    const ordineProv = slot.filter(s => s.provider === provider).map(s => s.ordine)
    const ordine = ordineProv.length ? Math.max(...ordineProv) : (slot.length ? Math.max(...slot.map(s => s.ordine)) + 1 : 1)
    const { data, error } = await supabase.from('slot_consigliate').insert([{ provider, nome, nota: nuova.nota.trim(), ordine }]).select().single()
    if (error) { setErrore(error.message.includes('duplicate') ? 'Questa slot è già in lista' : 'Errore: ' + error.message); return }
    setSlot(prev => [...prev, data].sort((a, b) => a.ordine - b.ordine || a.id - b.id))
    setNuova({ provider, nome: '', nota: '' })
    setErrore('')
  }
  async function aggiorna(s, campo, valore) {
    if ((s[campo] || '') === valore) return
    const { error } = await supabase.from('slot_consigliate').update({ [campo]: valore }).eq('id', s.id)
    if (error) { setErrore('Errore: ' + error.message); return }
    setSlot(prev => prev.map(x => x.id === s.id ? { ...x, [campo]: valore } : x))
  }
  async function elimina(s) {
    if (!window.confirm(`Togliere "${s.nome}" (${s.provider}) dalla lista?`)) return
    const { error } = await supabase.from('slot_consigliate').delete().eq('id', s.id)
    if (error) { setErrore('Errore: ' + error.message); return }
    setSlot(prev => prev.filter(x => x.id !== s.id))
  }

  return (
    <div onClick={onClose} style={{ position: 'fixed', inset: 0, background: 'rgba(2,6,23,0.8)', zIndex: 3000, display: 'flex', alignItems: 'flex-start', justifyContent: 'center', overflowY: 'auto', padding: '30px 12px' }}>
      <div onClick={e => e.stopPropagation()} style={{ background: '#0f172a', border: '1px solid rgba(251,191,36,0.4)', borderRadius: 16, padding: 20, width: '100%', maxWidth: 720 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 12 }}>
          <div>
            <div style={{ fontSize: 19, fontWeight: 900, color: '#f8fafc' }}>🎰 Slot consigliate</div>
            <div style={{ fontSize: 12, color: '#94a3b8', marginTop: 3 }}>
              Lista Profiliamo · {slot.length} slot · {providers.length} provider
              {contesto ? <><br /><span style={{ color: '#fbbf24' }}>Per: {contesto}</span></> : null}
            </div>
          </div>
          <div style={{ display: 'flex', gap: 6 }}>
            <button style={btn(modifica ? '#22c55e' : '#94a3b8')} onClick={() => setModifica(!modifica)}>{modifica ? '✓ Fine' : '✏️ Modifica lista'}</button>
            <button style={btn('#94a3b8')} onClick={onClose}>✕</button>
          </div>
        </div>

        <input value={cerca} onChange={e => setCerca(e.target.value)} placeholder="Cerca slot o provider…" style={{ ...inp, width: '100%', margin: '14px 0', boxSizing: 'border-box' }} />

        {errore && <div style={{ color: '#f87171', fontSize: 12, marginBottom: 8 }}>{errore}</div>}
        {caricamento ? <div style={{ color: '#94a3b8' }}>Caricamento…</div> : (
          <div style={{ columnWidth: 210, columnGap: 18 }}>
            {gruppi.map(g => (
              <div key={g.provider} style={{ breakInside: 'avoid', marginBottom: 14 }}>
                <div style={{ color: '#fbbf24', fontWeight: 900, fontSize: 12, letterSpacing: 0.5, textTransform: 'uppercase', marginBottom: 4 }}>{g.provider}</div>
                {g.voci.map(s => modifica ? (
                  <div key={s.id} style={{ display: 'flex', gap: 4, alignItems: 'center', marginBottom: 3 }}>
                    <input key={'n' + s.id + s.nome} defaultValue={s.nome} onBlur={e => aggiorna(s, 'nome', e.target.value.trim())} style={{ ...inp, padding: '3px 6px', fontSize: 12, flex: 1, minWidth: 0 }} />
                    <input key={'o' + s.id + s.nota} defaultValue={s.nota || ''} placeholder="nota" onBlur={e => aggiorna(s, 'nota', e.target.value.trim())} style={{ ...inp, padding: '3px 6px', fontSize: 12, width: 70 }} />
                    <button onClick={() => elimina(s)} style={{ background: 'transparent', border: 'none', color: '#f87171', cursor: 'pointer' }}>🗑</button>
                  </div>
                ) : (
                  <div key={s.id} style={{ color: '#e2e8f0', fontSize: 14, padding: '2px 0' }}>
                    {s.nome}{s.nota ? <span style={{ color: '#94a3b8', fontSize: 11 }}> · {s.nota}</span> : null}
                  </div>
                ))}
              </div>
            ))}
            {gruppi.length === 0 && <div style={{ color: '#94a3b8' }}>Nessuna slot trovata.</div>}
          </div>
        )}

        {modifica && (
          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', alignItems: 'center', marginTop: 12, paddingTop: 12, borderTop: '1px solid rgba(51,65,85,0.7)' }}>
            <span style={{ fontSize: 12, color: '#94a3b8', fontWeight: 700 }}>➕ Aggiungi</span>
            <input list="slot-providers" value={nuova.provider} onChange={e => setNuova({ ...nuova, provider: e.target.value })} placeholder="provider" style={{ ...inp, width: 140 }} />
            <datalist id="slot-providers">{providers.map(p => <option key={p} value={p} />)}</datalist>
            <input value={nuova.nome} onChange={e => setNuova({ ...nuova, nome: e.target.value })} placeholder="nome slot" style={{ ...inp, flex: 1, minWidth: 140 }}
              onKeyDown={e => { if (e.key === 'Enter') aggiungi() }} />
            <input value={nuova.nota} onChange={e => setNuova({ ...nuova, nota: e.target.value })} placeholder="nota (facoltativa)" style={{ ...inp, width: 140 }} />
            <button style={btn('#22c55e')} onClick={aggiungi}>Aggiungi</button>
          </div>
        )}
      </div>
    </div>
  )
}
