"use client";
// 📚 ARCHIVIO BET (14/10/2026): le bet generate da Lucy giorno per giorno (tabella lucy_proposte_giorno, supabase/lucy_proposte_giorno.sql)
// con a fianco l'esito: ✅ fatta (bet confermata), ⏭ saltata, 🔁 rimandata, oppure "non fatta" se è rimasta lì.
// Sola lettura: l'esito si legge da lucy_bet_confermate e lucy_decisioni, le stesse tabelle che usa già il Profit Tracker.
import React, { useEffect, useState } from 'react'
import { supabase } from '../supabaseClient'
import { dataLunga, aggiungiGiorni } from '../../../lib/oggiDaFare'

const GIORNI = 30
const STATI = {
  fatta: { icona: '✅', testo: 'fatta', colore: '#4ade80' },
  saltata: { icona: '⏭', testo: 'saltata', colore: '#fb923c' },
  rimandata: { icona: '🔁', testo: 'rimandata', colore: '#fbbf24' },
  non_fatta: { icona: '⚠️', testo: 'non fatta', colore: '#f87171' },
  da_fare: { icona: '•', testo: 'da fare', colore: '#7dd3fc' },
  nd: { icona: '', testo: '', colore: '#64748b' },
}

export default function ArchivioBet({ oggi, versione }) {
  const [aperto, setAperto] = useState(false)
  const [giorni, setGiorni] = useState(null)   // [{ giorno, righe:[{...voce, stato, motivo}] }]
  const [errore, setErrore] = useState('')
  const [carico, setCarico] = useState(false)
  const [filtro, setFiltro] = useState('tutte')
  const [cerca, setCerca] = useState('')

  async function carica() {
    setCarico(true); setErrore('')
    try {
      const da = aggiungiGiorni(oggi, -GIORNI)
      const [p, c, d] = await Promise.all([
        supabase.from('lucy_proposte_giorno').select('giorno,righe').gte('giorno', da).order('giorno', { ascending: false }),
        supabase.from('lucy_bet_confermate').select('key,data').gte('data', da).limit(5000),
        supabase.from('lucy_decisioni').select('chiave,decisione,data,motivo').gte('data', da).limit(5000),
      ])
      if (p.error) throw new Error(/lucy_proposte_giorno/.test(p.error.message || '') ? 'Manca la tabella dell\'archivio: esegui supabase/lucy_proposte_giorno.sql nel SQL Editor di Supabase.' : p.error.message)
      const fatte = new Set((c.data || []).map(x => x.key))
      const dec = new Map((d.data || []).map(x => [x.chiave, x]))
      setGiorni((p.data || []).map(g => ({
        giorno: g.giorno,
        righe: (Array.isArray(g.righe) ? g.righe : []).map(v => {
          if (!String(v.key).startsWith('bet|')) return { ...v, stato: 'nd' }
          const k = String(v.key).slice(4)
          const x = dec.get(k)
          const stato = fatte.has(k) ? 'fatta' : x ? (x.decisione === 'saltata' ? 'saltata' : 'rimandata') : g.giorno === oggi ? 'da_fare' : 'non_fatta'
          return { ...v, stato, motivo: x?.motivo || '' }
        }),
      })))
    } catch (e) { setErrore(e?.message || String(e)); setGiorni([]) }
    setCarico(false)
  }

  // quando nel Profit Tracker cambia qualcosa (bet confermata, saltata, rimandata) e l'archivio è aperto, si aggiorna da solo
  useEffect(() => {
    if (!aperto || giorni === null) return
    const t = setTimeout(() => carica(), 1200)
    return () => clearTimeout(t)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [versione])

  function apri() {
    const n = !aperto
    setAperto(n)
    if (n && giorni === null) carica()
  }

  const q = cerca.trim().toLowerCase()
  const visibili = (giorni || []).map(g => ({
    ...g,
    righe: g.righe.filter(v => (filtro === 'tutte' || v.stato === filtro) && (!q || `${v.titolo} ${v.dettaglio}`.toLowerCase().includes(q))),
  })).filter(g => g.righe.length)
  const chip = (id, testo) => <button key={id} type="button" onClick={() => setFiltro(id)} style={{ background: filtro === id ? 'rgba(56,189,248,0.2)' : 'transparent', color: filtro === id ? '#7dd3fc' : '#94a3b8', border: '1px solid rgba(100,116,139,0.5)', borderRadius: 999, padding: '2px 10px', fontSize: 11.5, fontWeight: 700, cursor: 'pointer' }}>{testo}</button>

  return (
    <div style={{ marginTop: -6, marginBottom: 14, border: '1px solid rgba(51,65,85,0.7)', borderRadius: 12, background: 'rgba(15,23,42,0.5)' }}>
      <button type="button" onClick={apri} style={{ width: '100%', textAlign: 'left', cursor: 'pointer', border: 0, background: 'transparent', color: '#94a3b8', padding: '9px 14px', fontWeight: 800, fontSize: 13 }}>
        📚 Archivio bet · ultimi {GIORNI} giorni {aperto ? '▾' : '▸'}
      </button>
      {aperto && (
        <div style={{ padding: '4px 14px 12px' }}>
          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', alignItems: 'center', marginBottom: 8 }}>
            {chip('tutte', 'tutte')}{chip('fatta', '✅ fatte')}{chip('saltata', '⏭ saltate')}{chip('rimandata', '🔁 rimandate')}{chip('non_fatta', '⚠️ non fatte')}
            <input value={cerca} onChange={e => setCerca(e.target.value)} placeholder="cerca cliente, book, partita…" style={{ marginLeft: 'auto', background: '#020617', color: '#e2e8f0', border: '1px solid #334155', borderRadius: 8, padding: '4px 9px', fontSize: 12, minWidth: 180 }} />
          </div>
          {carico && <div style={{ color: '#94a3b8', fontSize: 12.5 }}>⏳ Carico l&apos;archivio…</div>}
          {errore && <div style={{ color: '#fecaca', fontSize: 12.5 }}>⚠️ {errore}</div>}
          {!carico && !errore && giorni && visibili.length === 0 && <div style={{ color: '#64748b', fontSize: 12.5 }}>{giorni.length === 0 ? 'Ancora nessuna bet archiviata: si salvano da oggi, appena Lucy le genera.' : 'Nessuna bet con questo filtro.'}</div>}
          {visibili.map(g => {
            const n = (s) => g.righe.filter(v => v.stato === s).length
            return (
              <div key={g.giorno} style={{ marginTop: 8 }}>
                <div style={{ fontSize: 12, fontWeight: 800, color: '#cbd5e1', textTransform: 'capitalize' }}>
                  {dataLunga(g.giorno)} <span style={{ color: '#64748b', fontWeight: 600, textTransform: 'none' }}>· {g.righe.length} · ✅ {n('fatta')} · ⏭ {n('saltata')} · 🔁 {n('rimandata')}{n('non_fatta') ? ` · ⚠️ ${n('non_fatta')}` : ''}</span>
                </div>
                {g.righe.map(v => {
                  const st = STATI[v.stato] || STATI.nd
                  return (
                    <div key={v.key} style={{ display: 'flex', gap: 10, alignItems: 'baseline', padding: '3px 0', borderTop: '1px solid rgba(51,65,85,0.4)', fontSize: 12 }}>
                      <div style={{ flex: 1, minWidth: 0, color: '#94a3b8', lineHeight: 1.4 }}>
                        <b style={{ color: '#cbd5e1' }}>{v.titolo}</b> · {v.dettaglio}{v.motivo ? ` · «${v.motivo}»` : ''}
                      </div>
                      <div style={{ color: st.colore, fontWeight: 800, whiteSpace: 'nowrap' }}>{st.icona} {st.testo}</div>
                    </div>
                  )
                })}
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
