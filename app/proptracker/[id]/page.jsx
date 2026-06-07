'use client'
import { useState, useEffect, useCallback } from 'react'
import { useRouter, useParams } from 'next/navigation'
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
)

const C = {
  dark:'#0D1117', panel:'#161B22', accent:'#F0B429', green:'#2EA043',
  red:'#DA3633', blue:'#388BFD', text:'#E6EDF3', muted:'#8B949E',
  input:'#1C2128', border:'#30363D', orange:'#E8622A', greenDark:'#0D2010'
}

function calcPuntataBook(cfg, opIndex, prevPnlBook, quotaBook, puntataProp) {
  const totalOps = parseInt(cfg.puntate_fase1) + parseInt(cfg.puntate_fase2)
  const targetBook = parseFloat(cfg.fee_challenge) + parseFloat(cfg.profitto_target)
  const residuo = targetBook - (prevPnlBook || 0)
  const puntateRim = Math.max(1, totalOps - opIndex)
  const defaultPuntata = parseFloat(cfg.puntata_prop_default)
  // Aggressività: 50=conservativo (assume 50% vittorie book), 100=aggressivo (assume tutte vinte)
  const aggressivita = Math.min(100, Math.max(10, parseFloat(cfg.aggressivita_pct || 50))) / 100
  const base = Math.max(0, residuo) / (puntateRim * (quotaBook - 1) * aggressivita)
  const scaled = base * (puntataProp / defaultPuntata)
  return Math.max(1, Math.round(scaled))
}

function calcIncasso(esito, puntata, quota) {
  if (esito === '' || esito == null) return null
  const n = parseFloat(esito)
  if (!isNaN(n) && esito !== 'V' && esito !== 'P') return n
  if (esito === 'V') return puntata * (quota - 1)
  if (esito === 'P') return -puntata
  return null
}

function getStato(op, cfg) {
  if (!op.esito_prop) return ''
  const saldo = op.saldo_prop
  const pnlBook = op.pnl_cum_book
  const perdMax = parseFloat(cfg.saldo_iniziale) * parseFloat(cfg.perdita_max_pct)
  const targetBook = parseFloat(cfg.fee_challenge) + parseFloat(cfg.profitto_target)
  const targetF1 = parseFloat(cfg.saldo_iniziale) * parseFloat(cfg.target_fase1_pct)
  const targetF2 = parseFloat(cfg.saldo_iniziale) * (1 + parseFloat(cfg.target_fase1_pct)) * parseFloat(cfg.target_fase2_pct)

  if (saldo < parseFloat(cfg.saldo_iniziale) - perdMax) return '🔴 PROP BRUCIATA'
  if (pnlBook >= targetBook) return '✅ TARGET OK'
  if (pnlBook >= parseFloat(cfg.fee_challenge)) return '🔔 FEE COPERTA'
  if (op.fase === 'Fase 1' && saldo >= parseFloat(cfg.saldo_iniziale) + targetF1) return '✅ F1 TARGET'
  // In Fase 2 il saldo riparte da saldo_iniziale, quindi target F2 = saldo_iniziale * (1 + target_fase2_pct)
  if (op.fase === 'Fase 2' && saldo >= parseFloat(cfg.saldo_iniziale) * (1 + parseFloat(cfg.target_fase2_pct))) return '✅ F2 TARGET'
  if (op.esito_prop === 'V') return '🟢 PROP WIN'
  return '🟡 PROP LOSS'
}

const STATO_BG = {
  '🔴 PROP BRUCIATA': C.red,
  '✅ TARGET OK': C.green,
  '🔔 FEE COPERTA': C.orange,
}

export default function PropTrackerDetail() {
  const router = useRouter()
  const params = useParams()
  const id = params.id

  const [cfg, setCfg] = useState(null)
  const [ops, setOps] = useState([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [editCfg, setEditCfg] = useState(false)

  useEffect(() => {
    if (typeof window !== 'undefined' && !localStorage.getItem('site_unlocked')) {
      router.push('/login'); return
    }
    loadData()
  }, [id])

  async function loadData() {
    setLoading(true)
    const { data: challenge } = await supabase.from('prop_challenges').select('*').eq('id', id).single()
    const { data: operations } = await supabase.from('prop_operations').select('*').eq('challenge_id', id).order('numero')
    if (challenge) setCfg(challenge)
    if (operations) setOps(operations)
    setLoading(false)
  }

  // Calcola tutti i valori derivati per la riga corrente
  function buildRow(op, index, allOps, challenge) {
    const prevOp = index > 0 ? allOps[index - 1] : null
    const fase1Puntate = parseInt(challenge.puntate_fase1)
    // Se è la prima operazione di Fase 2, il saldo riparte da saldo_iniziale
    const isFirstFase2 = op.numero === fase1Puntate + 1
    const prevSaldo = isFirstFase2
      ? parseFloat(challenge.saldo_iniziale)
      : (prevOp?.saldo_prop ?? parseFloat(challenge.saldo_iniziale))
    const prevPnlBook = prevOp?.pnl_cum_book ?? 0

    const incProp = calcIncasso(op.esito_prop, parseFloat(op.puntata_prop), parseFloat(op.quota_prop))
    const incBook = calcIncasso(op.esito_book, parseFloat(op.puntata_book), parseFloat(op.quota_book))
    const pnlOp = (incProp != null && incBook != null) ? incProp + incBook : null
    const saldoProp = incProp != null ? prevSaldo + incProp : null
    const pnlCumBook = incBook != null ? prevPnlBook + incBook : null
    const targetBook = parseFloat(challenge.fee_challenge) + parseFloat(challenge.profitto_target)
    const profResiduo = pnlCumBook != null ? targetBook - pnlCumBook : null
    const totalOps = parseInt(challenge.puntate_fase1) + parseInt(challenge.puntate_fase2)
    const fase = op.numero <= parseInt(challenge.puntate_fase1) ? 'Fase 1' : 'Fase 2'

    const enriched = { ...op, incasso_prop: incProp, incasso_book: incBook, pnl_operazione: pnlOp,
      saldo_prop: saldoProp, pnl_cum_book: pnlCumBook, profitto_residuo: profResiduo,
      puntate_rimanenti: totalOps - op.numero, fase }
    return { ...enriched, stato_operazione: getStato(enriched, challenge) }
  }

  function getEnrichedOps() {
    if (!cfg) return []
    return ops.map((op, i) => buildRow(op, i, ops.map((o,j) => j < i ? buildRow(o, j, ops, cfg) : o), cfg))
      .reduce((acc, _, i) => {
        const built = buildRow(ops[i], i, acc, cfg)
        return [...acc, built]
      }, [])
  }

  async function updateEsito(opId, field, value, opIndex) {
    // Aggiorna stato locale immediatamente
    const newOps = ops.map((op, i) => {
      if (op.id !== opId) return op
      const updated = { ...op, [field]: value }
      // Auto-opposto book se esito prop è V o P
      if (field === 'esito_prop') {
        if (value === 'V') updated.esito_book = 'P'
        else if (value === 'P') updated.esito_book = 'V'
        else updated.esito_book = '' // cash out manuale
      }
      return updated
    })
    setOps(newOps)

    // Salva su Supabase
    const op = newOps.find(o => o.id === opId)
    const enriched = getEnrichedOpsFrom(newOps, cfg)[opIndex]
    const { error } = await supabase.from('prop_operations').update({
      esito_prop: op.esito_prop,
      esito_book: op.esito_book,
      incasso_prop: enriched.incasso_prop,
      incasso_book: enriched.incasso_book,
      pnl_operazione: enriched.pnl_operazione,
      saldo_prop: enriched.saldo_prop,
      pnl_cum_book: enriched.pnl_cum_book,
      profitto_residuo: enriched.profitto_residuo,
      stato_operazione: enriched.stato_operazione,
      updated_at: new Date().toISOString()
    }).eq('id', opId)

    // Aggiorna stato challenge se necessario
    if (enriched.stato_operazione?.includes('BRUCIATA')) {
      await supabase.from('prop_challenges').update({ stato: 'bruciata' }).eq('id', id)
    } else if (enriched.stato_operazione?.includes('TARGET OK')) {
      await supabase.from('prop_challenges').update({ stato: 'completata' }).eq('id', id)
    }
  }

  function getEnrichedOpsFrom(opsArr, challenge) {
    return opsArr.reduce((acc, op, i) => {
      const built = buildRow(op, i, acc, challenge)
      return [...acc, built]
    }, [])
  }

  async function addOperation() {
    if (!cfg) return
    const nextNum = ops.length + 1
    const totalOps = parseInt(cfg.puntate_fase1) + parseInt(cfg.puntate_fase2)
    if (nextNum > totalOps) return

    const prevPnlBook = ops.length > 0 ? (getEnrichedOpsFrom(ops, cfg).slice(-1)[0]?.pnl_cum_book ?? 0) : 0
    const puntataBook = calcPuntataBook(cfg, nextNum - 1, prevPnlBook, parseFloat(cfg.quota_book_default), parseFloat(cfg.puntata_prop_default))

    const newOp = {
      challenge_id: id,

      numero: nextNum,
      fase: nextNum <= parseInt(cfg.puntate_fase1) ? 'Fase 1' : 'Fase 2',
      quota_prop: cfg.quota_prop_default,
      quota_book: cfg.quota_book_default,
      puntata_prop: cfg.puntata_prop_default,
      puntata_book: puntataBook,
      esito_prop: '', esito_book: ''
    }

    const { data, error } = await supabase.from('prop_operations').insert([newOp]).select().single()
    if (!error && data) setOps([...ops, data])
  }

  async function updateField(opId, field, value) {
    setOps(ops.map(op => op.id === opId ? { ...op, [field]: value } : op))
    // Ricalcola puntata book se cambiano quota o puntata prop
    if (['quota_book', 'quota_prop', 'puntata_prop'].includes(field)) {
      const opIndex = ops.findIndex(o => o.id === opId)
      const updatedOps = ops.map(op => op.id === opId ? { ...op, [field]: value } : op)
      const enriched = getEnrichedOpsFrom(updatedOps, cfg)
      const prevPnl = opIndex > 0 ? enriched[opIndex-1].pnl_cum_book ?? 0 : 0
      const op = updatedOps[opIndex]
      const newPuntataBook = calcPuntataBook(cfg, opIndex, prevPnl, parseFloat(op.quota_book), parseFloat(op.puntata_prop))
      setOps(updatedOps.map(o => o.id === opId ? { ...o, puntata_book: newPuntataBook } : o))
      await supabase.from('prop_operations').update({ [field]: value, puntata_book: newPuntataBook }).eq('id', opId)
    } else {
      await supabase.from('prop_operations').update({ [field]: value }).eq('id', opId)
    }
  }

  if (loading) return <div style={{ minHeight:'100vh', background:C.dark, color:C.text, display:'flex', alignItems:'center', justifyContent:'center', fontSize:'18px' }}>Caricamento...</div>
  if (!cfg) return <div style={{ minHeight:'100vh', background:C.dark, color:C.red, display:'flex', alignItems:'center', justifyContent:'center' }}>Challenge non trovata</div>

  const enrichedOps = getEnrichedOpsFrom(ops, cfg)
  const lastOp = enrichedOps.slice(-1)[0]
  const targetBook = parseFloat(cfg.fee_challenge) + parseFloat(cfg.profitto_target)
  const pnlBookAttuale = lastOp?.pnl_cum_book ?? 0
  const saldoAttuale = lastOp?.saldo_prop ?? parseFloat(cfg.saldo_iniziale)
  const totalOps = parseInt(cfg.puntate_fase1) + parseInt(cfg.puntate_fase2)

  return (
    <div style={{ minHeight:'100vh', background:C.dark, color:C.text, fontFamily:'Arial, sans-serif', padding:'24px' }}>

      {/* Header */}
      <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:'24px' }}>
        <div>
          <button style={{ background:'none', border:'none', color:C.muted, cursor:'pointer', fontSize:'14px', marginBottom:'6px' }} onClick={() => router.push('/proptracker')}>
            ← Prop Tracker
          </button>
          <div style={{ fontSize:'22px', fontWeight:'bold', color:C.accent }}>🎯 {cfg.nome}</div>
          {cfg.prop_firm && <div style={{ color:C.muted, fontSize:'13px' }}>{cfg.prop_firm}</div>}
        </div>
        <div style={{ display:'flex', gap:'10px' }}>
          <button style={{ background:C.panel, border:`1px solid ${C.border}`, color:C.text, borderRadius:'8px', padding:'8px 16px', cursor:'pointer', fontSize:'13px' }}
            onClick={() => setEditCfg(!editCfg)}>
            ⚙ Config
          </button>
          {ops.length < totalOps && (
            <button style={{ background:C.accent, color:'#000', border:'none', borderRadius:'8px', padding:'8px 16px', fontWeight:'bold', cursor:'pointer', fontSize:'13px' }}
              onClick={addOperation}>
              + Aggiungi Operazione
            </button>
          )}
        </div>
      </div>

      {/* KPI Cards */}
      <div style={{ display:'grid', gridTemplateColumns:'repeat(5,1fr)', gap:'12px', marginBottom:'24px' }}>
        {[
          ['Saldo Prop', `€${saldoAttuale.toFixed(2)}`, saldoAttuale < parseFloat(cfg.saldo_iniziale) * (1 - parseFloat(cfg.perdita_max_pct)) ? C.red : saldoAttuale >= parseFloat(cfg.saldo_iniziale) * (1 + parseFloat(cfg.target_fase1_pct)) ? C.green : C.text],
          ['P&L Book', `€${pnlBookAttuale.toFixed(2)}`, pnlBookAttuale >= targetBook ? C.green : pnlBookAttuale >= parseFloat(cfg.fee_challenge) ? C.orange : pnlBookAttuale >= 0 ? C.text : C.red],
          ['Target Book', `€${targetBook.toFixed(2)}`, C.accent],
          ['Operazioni', `${ops.length} / ${totalOps}`, C.muted],
          ['Residuo', `€${Math.max(0, targetBook - pnlBookAttuale).toFixed(2)}`, C.text],
        ].map(([label, val, color]) => (
          <div key={label} style={{ background:C.panel, border:`1px solid ${C.border}`, borderRadius:'10px', padding:'14px', textAlign:'center' }}>
            <div style={{ fontSize:'11px', color:C.muted, marginBottom:'6px' }}>{label}</div>
            <div style={{ fontSize:'18px', fontWeight:'bold', color }}>{val}</div>
          </div>
        ))}
      </div>

      {/* Config panel (collassabile) */}
      {editCfg && (
        <div style={{ background:C.panel, border:`1px solid ${C.accent}`, borderRadius:'12px', padding:'20px', marginBottom:'24px' }}>
          <div style={{ fontSize:'15px', fontWeight:'bold', color:C.accent, marginBottom:'16px' }}>⚙ Configurazione Challenge</div>
          <div style={{ display:'grid', gridTemplateColumns:'repeat(4,1fr)', gap:'12px' }}>
            {[
              ['fee_challenge','Fee challenge (€)'],['profitto_target','Profitto netto (€)'],
              ['puntata_prop_default','Puntata prop def.'],['quota_prop_default','Quota prop def.'],
              ['quota_book_default','Quota book def.'],['puntate_fase1','Puntate Fase 1'],
              ['puntate_fase2','Puntate Fase 2'],['aggressivita_pct','Aggressività % (10-100)'],['perdita_max_pct','Perdita max (es.0.15)'],['target_fase1_pct','Target Fase 1 (es.0.25)'],['target_fase2_pct','Target Fase 2 (es.0.19)'],
            ].map(([k,l]) => (
              <div key={k}>
                <label style={{ fontSize:'11px', color:C.muted, marginBottom:'4px', display:'block' }}>{l}</label>
                <input style={{ background:C.input, border:`1px solid ${C.border}`, borderRadius:'6px', padding:'6px 10px', color:C.blue, fontWeight:'bold', fontSize:'13px', width:'100%', boxSizing:'border-box' }}
                  value={cfg[k]} onChange={e => setCfg({...cfg, [k]: e.target.value})}
                  onBlur={async e => {
                    await supabase.from('prop_challenges').update({ [k]: e.target.value }).eq('id', id)
                  }} />
              </div>
            ))}
          </div>
          <div style={{ marginTop:'12px', background:'#1A2A0A', border:`1px solid ${C.green}`, borderRadius:'8px', padding:'10px', display:'flex', gap:'24px', alignItems:'center' }}>
            <span style={{ color:C.muted, fontSize:'13px' }}>📌 Target book totale:</span>
            <span style={{ color:C.accent, fontWeight:'bold', fontSize:'16px' }}>€{(parseFloat(cfg.fee_challenge||0)+parseFloat(cfg.profitto_target||0)).toFixed(2)}</span>
          </div>
        </div>
      )}

      {/* Tabella operazioni */}
      {ops.length === 0 ? (
        <div style={{ background:C.panel, borderRadius:'12px', padding:'40px', textAlign:'center', color:C.muted }}>
          Nessuna operazione ancora. Clicca "+ Aggiungi Operazione" per iniziare.
        </div>
      ) : (
        <div style={{ overflowX:'auto' }}>
          <table style={{ width:'100%', borderCollapse:'collapse', fontSize:'13px' }}>
            <thead>
              <tr>
                {['#','Fase','Q.Prop','Q.Book','Punt.Prop','Punt.Book [AUTO]','Esito Prop','Esito Book','Inc.Prop','Inc.Book','P&L Op','Saldo Prop','P&L Cum Book','Residuo','Stato'].map(h => (
                  <th key={h} style={{ background:h==='Punt.Book [AUTO]' ? C.green : C.accent, color:'#000', padding:'8px 10px', textAlign:'center', fontWeight:'bold', fontSize:'11px', whiteSpace:'nowrap' }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {enrichedOps.map((op, i) => {
                const isSep = op.numero === parseInt(cfg.puntate_fase1) + 1 && i > 0 && enrichedOps[i-1].fase === 'Fase 1'
                const statoBg = STATO_BG[op.stato_operazione]
                const rowBg = op.stato_operazione?.includes('BRUCIATA') ? '#1A0000' : C.panel

                return (
                  <>
                    {isSep && (
                      <tr key={`sep-${op.id}`}>
                        <td colSpan={15} style={{ background:C.accent, color:'#000', textAlign:'center', fontWeight:'bold', fontSize:'12px', padding:'6px' }}>
                          ── INIZIO FASE 2 ──
                        </td>
                      </tr>
                    )}
                    <tr key={op.id} style={{ background:rowBg, borderBottom:`1px solid ${C.border}` }}>
                      <td style={{ padding:'8px 10px', textAlign:'center', color:C.muted, fontWeight:'bold' }}>{op.numero}</td>
                      <td style={{ padding:'8px 10px', textAlign:'center', color:C.text, fontSize:'12px' }}>{op.fase}</td>

                      {/* Quota Prop — editabile */}
                      <td style={{ padding:'4px 6px' }}>
                        <input style={{ background:C.input, border:`1px solid ${C.border}`, borderRadius:'4px', padding:'4px 6px', color:C.blue, fontWeight:'bold', width:'60px', textAlign:'center', fontSize:'13px' }}
                          value={op.quota_prop} onChange={e => updateField(op.id, 'quota_prop', e.target.value)} />
                      </td>

                      {/* Quota Book — editabile */}
                      <td style={{ padding:'4px 6px' }}>
                        <input style={{ background:C.input, border:`1px solid ${C.border}`, borderRadius:'4px', padding:'4px 6px', color:C.blue, fontWeight:'bold', width:'60px', textAlign:'center', fontSize:'13px' }}
                          value={op.quota_book} onChange={e => updateField(op.id, 'quota_book', e.target.value)} />
                      </td>

                      {/* Puntata Prop — editabile */}
                      <td style={{ padding:'4px 6px' }}>
                        <input style={{ background:C.input, border:`1px solid ${C.border}`, borderRadius:'4px', padding:'4px 6px', color:C.blue, fontWeight:'bold', width:'70px', textAlign:'center', fontSize:'13px' }}
                          value={op.puntata_prop} onChange={e => updateField(op.id, 'puntata_prop', e.target.value)} />
                      </td>

                      {/* Puntata Book — auto (verde) */}
                      <td style={{ padding:'8px 10px', textAlign:'center', color:C.green, fontWeight:'bold', background:C.greenDark }}>
                        €{parseFloat(op.puntata_book).toFixed(2)}
                      </td>

                      {/* Esito Prop — input V/P/numero */}
                      <td style={{ padding:'4px 6px' }}>
                        <input style={{ background:C.input, border:`1px solid ${C.border}`, borderRadius:'4px', padding:'4px 8px', color:C.blue, fontWeight:'bold', width:'60px', textAlign:'center', fontSize:'13px' }}
                          value={op.esito_prop || ''} placeholder='V/P/€'
                          onChange={e => updateEsito(op.id, 'esito_prop', e.target.value.toUpperCase(), i)} />
                      </td>

                      {/* Esito Book — auto o manuale */}
                      <td style={{ padding:'4px 6px' }}>
                        <input style={{ background:C.input, border:`1px solid ${C.border}`, borderRadius:'4px', padding:'4px 8px', color:C.blue, fontWeight:'bold', width:'60px', textAlign:'center', fontSize:'13px' }}
                          value={op.esito_book || ''} placeholder='V/P/€'
                          onChange={e => { setOps(ops.map(o => o.id === op.id ? {...o, esito_book: e.target.value.toUpperCase()} : o)); supabase.from('prop_operations').update({esito_book: e.target.value.toUpperCase()}).eq('id',op.id) }} />
                      </td>

                      {/* Valori calcolati */}
                      {[op.incasso_prop, op.incasso_book, op.pnl_operazione].map((v, vi) => (
                        <td key={vi} style={{ padding:'8px 10px', textAlign:'center', color: v == null ? C.muted : v >= 0 ? C.green : C.red, fontWeight:'bold' }}>
                          {v != null ? (v >= 0 ? '+' : '') + v.toFixed(2) + '€' : '—'}
                        </td>
                      ))}

                      <td style={{ padding:'8px 10px', textAlign:'center', color: op.saldo_prop == null ? C.muted : op.saldo_prop < parseFloat(cfg.saldo_iniziale) ? C.red : C.green, fontWeight:'bold' }}>
                        {op.saldo_prop != null ? '€' + op.saldo_prop.toFixed(2) : '—'}
                      </td>

                      <td style={{ padding:'8px 10px', textAlign:'center', color: op.pnl_cum_book == null ? C.muted : op.pnl_cum_book >= 0 ? C.green : C.red, fontWeight:'bold' }}>
                        {op.pnl_cum_book != null ? (op.pnl_cum_book >= 0 ? '+' : '') + op.pnl_cum_book.toFixed(2) + '€' : '—'}
                      </td>

                      <td style={{ padding:'8px 10px', textAlign:'center', color:C.accent, fontWeight:'bold' }}>
                        {op.profitto_residuo != null ? '€' + op.profitto_residuo.toFixed(2) : '—'}
                      </td>

                      {/* Stato */}
                      <td style={{ padding:'6px 10px', textAlign:'center' }}>
                        {op.stato_operazione ? (
                          <span style={{ background: statoBg ? statoBg + '22' : C.panel, color: statoBg || C.text, border:`1px solid ${statoBg || C.border}`, borderRadius:'20px', padding:'3px 10px', fontSize:'11px', fontWeight:'bold', whiteSpace:'nowrap',
                            ...(op.stato_operazione.includes('BRUCIATA') ? { background:C.red, color:'#fff' } : {}) }}>
                            {op.stato_operazione}
                          </span>
                        ) : '—'}
                      </td>
                    </tr>
                  </>
                )
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* Riepilogo finale */}
      {ops.length > 0 && (
        <div style={{ background:C.panel, border:`1px solid ${C.border}`, borderRadius:'12px', padding:'20px', marginTop:'24px' }}>
          <div style={{ fontSize:'15px', fontWeight:'bold', color:C.accent, marginBottom:'16px' }}>📊 Riepilogo Finale</div>
          <div style={{ display:'grid', gridTemplateColumns:'repeat(4,1fr)', gap:'12px' }}>
            {[
              ['P&L Lordo Book', pnlBookAttuale, C.green],
              ['Fee Challenge', -parseFloat(cfg.fee_challenge), C.red],
              ['P&L NETTO', pnlBookAttuale - parseFloat(cfg.fee_challenge), pnlBookAttuale - parseFloat(cfg.fee_challenge) >= 0 ? C.green : C.red],
              ['Target Raggiunto', pnlBookAttuale >= targetBook ? '✅ SÌ' : '❌ NON ANCORA', pnlBookAttuale >= targetBook ? C.green : C.muted],
            ].map(([label, val, color]) => (
              <div key={label} style={{ background:C.input, borderRadius:'10px', padding:'14px', textAlign:'center' }}>
                <div style={{ fontSize:'11px', color:C.muted, marginBottom:'6px' }}>{label}</div>
                <div style={{ fontSize:'18px', fontWeight:'bold', color }}>
                  {typeof val === 'number' ? (val >= 0 ? '+' : '') + val.toFixed(2) + '€' : val}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
