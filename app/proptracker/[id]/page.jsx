'use client'
import { useState, useEffect } from 'react'
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

// ─── Calcoli puri ─────────────────────────────────────────────────────────────

function getFase(prevOps) {
  // Cambia fase SOLO al raggiungimento del target, mai per numero operazione
  if (prevOps.some(o => o.stato_operazione?.includes('F2 TARGET'))) return 'Finanziato'
  if (prevOps.some(o => o.stato_operazione?.includes('F1 TARGET'))) return 'Fase 2'
  return 'Fase 1'
}

function isFirstOfFase(fase, prevOps) {
  if (prevOps.length === 0) return false
  return prevOps[prevOps.length - 1]?.fase !== fase
}

function calcIncasso(esito, puntata, quota) {
  if (!esito && esito !== 0) return null
  if (esito === 'NC') return 0
  const n = parseFloat(esito)
  if (!isNaN(n) && esito !== 'V' && esito !== 'P') return n
  if (esito === 'V') return parseFloat(puntata) * (parseFloat(quota) - 1)
  if (esito === 'P') return -parseFloat(puntata)
  return null
}

function calcPuntataBook(cfg, prevPnlBook, quotaBook, puntataProp, targetDinamico, puntateRimanenti) {
  const residuo = Math.max(0, targetDinamico - (prevPnlBook || 0))
  const rim = Math.max(1, puntateRimanenti)
  const agg = Math.min(100, Math.max(10, parseFloat(cfg.aggressivita_pct || 35))) / 100
  const base = residuo / (rim * (parseFloat(quotaBook) - 1) * agg)
  const scaled = base * (parseFloat(puntataProp) / parseFloat(cfg.puntata_prop_default))
  // Cap: MAI più della puntata prop (1x)
  const cap = parseFloat(cfg.puntata_prop_default)
  return Math.max(1, Math.min(Math.round(scaled), cap))
}

function calcTargetDinamico(cfg, allPrevOps) {
  const base = parseFloat(cfg.fee_challenge) + parseFloat(cfg.profitto_target)
  const prelievi = allPrevOps
    .filter(o => o.prelievo_confermato && o.prelievo_lordo)
    .reduce((s, o) => s + parseFloat(o.prelievo_lordo) * 0.75, 0)
  return Math.max(0, base - prelievi)
}

function getStato(op, cfg) {
  if (!op.esito_prop) return ''
  const saldo = op.saldo_prop
  const pnlBook = op.pnl_cum_book
  const perdMax = parseFloat(cfg.saldo_iniziale) * parseFloat(cfg.perdita_max_pct)
  const targetBase = parseFloat(cfg.fee_challenge) + parseFloat(cfg.profitto_target)
  const targetF1 = parseFloat(cfg.saldo_iniziale) * parseFloat(cfg.target_fase1_pct)
  const targetF2 = parseFloat(cfg.saldo_iniziale) * parseFloat(cfg.target_fase2_pct)

  if (saldo < parseFloat(cfg.saldo_iniziale) - perdMax) return '🔴 PROP BRUCIATA'
  if (op.fase === 'Finanziato' && pnlBook >= (op.target_dinamico ?? targetBase)) return '🏦 FINANZIATO OK'
  if (pnlBook >= targetBase) return '✅ TARGET OK'
  if (op.fase === 'Fase 1' && saldo >= parseFloat(cfg.saldo_iniziale) + targetF1) return '✅ F1 TARGET'
  if (op.fase === 'Fase 2' && saldo >= parseFloat(cfg.saldo_iniziale) + targetF2) return '✅ F2 TARGET'
  if (pnlBook >= parseFloat(cfg.fee_challenge)) return '🔔 FEE COPERTA'
  if (op.esito_prop === 'V') return '🟢 PROP WIN'
  return '🟡 PROP LOSS'
}

function enrichOps(ops, cfg) {
  const orizzonteStimato = parseInt(cfg.puntate_fase1) + parseInt(cfg.puntate_fase2)

  return ops.reduce((acc, op, i) => {
    const fase = getFase(acc)
    const firstOfFase = isFirstOfFase(fase, acc)
    const prevSaldo = firstOfFase
      ? parseFloat(cfg.saldo_iniziale)
      : (acc[i - 1]?.saldo_prop ?? parseFloat(cfg.saldo_iniziale))
    const prevPnlBook = i > 0 ? (acc[i - 1]?.pnl_cum_book ?? 0) : 0
    const targetDinamico = calcTargetDinamico(cfg, acc)
    const puntateRimanenti = Math.max(1, orizzonteStimato - i)
    const incProp = calcIncasso(op.esito_prop, op.puntata_prop, op.quota_prop)
    const incBook = calcIncasso(op.esito_book, op.puntata_book, op.quota_book)
    const pnlOp = (incProp != null && incBook != null) ? incProp + incBook : null
    const saldoProp = incProp != null ? prevSaldo + incProp : null
    const pnlCumBook = incBook != null ? prevPnlBook + incBook : null
    const profResiduo = pnlCumBook != null ? targetDinamico - pnlCumBook : null

    const enriched = {
      ...op, fase, target_dinamico: targetDinamico,
      incasso_prop: incProp, incasso_book: incBook,
      pnl_operazione: pnlOp, saldo_prop: saldoProp,
      pnl_cum_book: pnlCumBook, profitto_residuo: profResiduo,
      puntate_rimanenti: puntateRimanenti
    }
    enriched.stato_operazione = getStato(enriched, cfg)
    return [...acc, enriched]
  }, [])
}

const STATO_BG = {
  '🔴 PROP BRUCIATA': C.red,
  '✅ TARGET OK': C.green,
  '🏦 FINANZIATO OK': C.blue,
  '🔔 FEE COPERTA': C.orange,
  '✅ F1 TARGET': C.green,
  '✅ F2 TARGET': C.orange,
}

export default function PropTrackerDetail() {
  const router = useRouter()
  const params = useParams()
  const id = params.id

  const [cfg, setCfg] = useState(null)
  const [ops, setOps] = useState([])
  const [loading, setLoading] = useState(true)
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

  async function addOperation() {
    if (!cfg) return
    const enriched = enrichOps(ops, cfg)
    const lastEnriched = enriched[enriched.length - 1]
    const nextNum = ops.length + 1
    const prevPnlBook = lastEnriched?.pnl_cum_book ?? 0
    const targetDin = calcTargetDinamico(cfg, enriched)
    const orizzonteStimato = parseInt(cfg.puntate_fase1) + parseInt(cfg.puntate_fase2)
    const puntateRim = Math.max(1, orizzonteStimato - ops.length)
    const puntataBook = calcPuntataBook(cfg, prevPnlBook, cfg.quota_book_default, cfg.puntata_prop_default, targetDin, puntateRim)

    const newOp = {
      challenge_id: id,
      numero: nextNum,
      quota_prop: cfg.quota_prop_default,
      quota_book: cfg.quota_book_default,
      puntata_prop: cfg.puntata_prop_default,
      puntata_book: puntataBook,
      esito_prop: '', esito_book: ''
    }
    const { data, error } = await supabase.from('prop_operations').insert([newOp]).select().single()
    if (!error && data) setOps([...ops, data])
  }

  async function deleteOperation(opId) {
    if (!confirm('Eliminare questa operazione?')) return
    await supabase.from('prop_operations').delete().eq('id', opId)
    setOps(ops.filter(o => o.id !== opId))
  }

  async function noCopertura(opId) {
    const newOps = ops.map(o => o.id === opId ? { ...o, esito_book: 'NC', puntata_book: 0 } : o)
    setOps(newOps)
    await supabase.from('prop_operations').update({ esito_book: 'NC', puntata_book: 0, incasso_book: 0 }).eq('id', opId)
  }

  async function updateEsito(opId, value) {
    const newOps = ops.map(o => {
      if (o.id !== opId) return o
      const updated = { ...o, esito_prop: value }
      if (o.esito_book !== 'NC') {
        if (value === 'V') updated.esito_book = 'P'
        else if (value === 'P') updated.esito_book = 'V'
        else updated.esito_book = ''
      }
      return updated
    })
    setOps(newOps)
    const enriched = enrichOps(newOps, cfg)
    const op = enriched.find(o => o.id === opId)
    if (!op) return
    await supabase.from('prop_operations').update({
      esito_prop: op.esito_prop, esito_book: op.esito_book,
      incasso_prop: op.incasso_prop, incasso_book: op.incasso_book,
      pnl_operazione: op.pnl_operazione, saldo_prop: op.saldo_prop,
      pnl_cum_book: op.pnl_cum_book, profitto_residuo: op.profitto_residuo,
      stato_operazione: op.stato_operazione
    }).eq('id', opId)
    if (op.stato_operazione?.includes('BRUCIATA'))
      await supabase.from('prop_challenges').update({ stato: 'bruciata' }).eq('id', id)
    else if (op.stato_operazione?.includes('FINANZIATO OK') || op.stato_operazione?.includes('TARGET OK'))
      await supabase.from('prop_challenges').update({ stato: 'completata' }).eq('id', id)
  }

  async function updateField(opId, field, value) {
    const newOps = ops.map(o => o.id === opId ? { ...o, [field]: value } : o)
    if (['quota_book', 'quota_prop', 'puntata_prop'].includes(field)) {
      const enriched = enrichOps(newOps, cfg)
      const opIdx = newOps.findIndex(o => o.id === opId)
      const prevPnl = opIdx > 0 ? enriched[opIdx - 1]?.pnl_cum_book ?? 0 : 0
      const op = newOps[opIdx]
      const targetDin = calcTargetDinamico(cfg, enriched.slice(0, opIdx))
      const orizzonteStimato = parseInt(cfg.puntate_fase1) + parseInt(cfg.puntate_fase2)
      const puntateRim = Math.max(1, orizzonteStimato - opIdx)
      const newBook = calcPuntataBook(cfg, prevPnl, op.quota_book, op.puntata_prop, targetDin, puntateRim)
      const finalOps = newOps.map(o => o.id === opId ? { ...o, puntata_book: newBook } : o)
      setOps(finalOps)
      await supabase.from('prop_operations').update({ [field]: value, puntata_book: newBook }).eq('id', opId)
    } else {
      setOps(newOps)
      await supabase.from('prop_operations').update({ [field]: value }).eq('id', opId)
    }
  }

  if (loading) return (
    <div style={{ minHeight:'100vh', background:C.dark, color:C.text, display:'flex', alignItems:'center', justifyContent:'center', fontSize:'18px' }}>
      Caricamento...
    </div>
  )
  if (!cfg) return (
    <div style={{ minHeight:'100vh', background:C.dark, color:C.red, display:'flex', alignItems:'center', justifyContent:'center' }}>
      Challenge non trovata
    </div>
  )

  const enrichedOps = enrichOps(ops, cfg)
  const lastOp = enrichedOps[enrichedOps.length - 1]
  const pnlBookAttuale = lastOp?.pnl_cum_book ?? 0
  const saldoAttuale = lastOp?.saldo_prop ?? parseFloat(cfg.saldo_iniziale)
  const targetBase = parseFloat(cfg.fee_challenge) + parseFloat(cfg.profitto_target)
  const prelieviTotali = enrichedOps.filter(o => o.prelievo_confermato && o.prelievo_lordo).reduce((s, o) => s + parseFloat(o.prelievo_lordo) * 0.75, 0)
  const targetDinamicoAttuale = Math.max(0, targetBase - prelieviTotali)
  const faseAttuale = lastOp?.fase ?? 'Fase 1'
  const totalOps = parseInt(cfg.puntate_fase1) + parseInt(cfg.puntate_fase2)

  return (
    <div style={{ minHeight:'100vh', background:C.dark, color:C.text, fontFamily:'Arial, sans-serif', padding:'24px' }}>

      {/* Header */}
      <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:'24px' }}>
        <div>
          <button style={{ background:'none', border:'none', color:C.muted, cursor:'pointer', fontSize:'14px', marginBottom:'6px' }}
            onClick={() => router.push('/proptracker')}>← Prop Tracker</button>
          <div style={{ fontSize:'22px', fontWeight:'bold', color:C.accent }}>🎯 {cfg.nome}</div>
          {cfg.prop_firm && <div style={{ color:C.muted, fontSize:'13px' }}>{cfg.prop_firm}</div>}
        </div>
        <div style={{ display:'flex', gap:'10px' }}>
          <button style={{ background:C.panel, border:`1px solid ${C.border}`, color:C.text, borderRadius:'8px', padding:'8px 16px', cursor:'pointer', fontSize:'13px' }}
            onClick={() => setEditCfg(!editCfg)}>⚙ Config</button>
          <button style={{ background:C.accent, color:'#000', border:'none', borderRadius:'8px', padding:'8px 16px', fontWeight:'bold', cursor:'pointer', fontSize:'13px' }}
            onClick={addOperation}>+ Aggiungi Operazione</button>
        </div>
      </div>

      {/* KPI */}
      <div style={{ display:'grid', gridTemplateColumns:'repeat(5,1fr)', gap:'12px', marginBottom:'24px' }}>
        {[
          ['Saldo Prop', `€${saldoAttuale.toFixed(2)}`,
            saldoAttuale < parseFloat(cfg.saldo_iniziale) * (1 - parseFloat(cfg.perdita_max_pct)) ? C.red
            : saldoAttuale >= parseFloat(cfg.saldo_iniziale) * (1 + parseFloat(cfg.target_fase1_pct)) ? C.green : C.text],
          ['P&L Book', `€${pnlBookAttuale.toFixed(2)}`,
            pnlBookAttuale >= targetDinamicoAttuale ? C.green
            : pnlBookAttuale >= parseFloat(cfg.fee_challenge) ? C.orange
            : pnlBookAttuale >= 0 ? C.text : C.red],
          [faseAttuale === 'Finanziato' ? 'Target Dinamico' : 'Target Book',
            `€${targetDinamicoAttuale.toFixed(2)}`,
            faseAttuale === 'Finanziato' ? C.blue : C.accent],
          [faseAttuale === 'Finanziato' ? 'Prelievi 75%' : 'Operazioni',
            faseAttuale === 'Finanziato' ? `€${prelieviTotali.toFixed(2)}` : `${ops.length} / ${totalOps}`,
            faseAttuale === 'Finanziato' ? C.green : C.muted],
          ['Residuo', `€${Math.max(0, targetDinamicoAttuale - pnlBookAttuale).toFixed(2)}`, C.text],
        ].map(([label, val, color]) => (
          <div key={label} style={{ background:C.panel, border:`1px solid ${C.border}`, borderRadius:'10px', padding:'14px', textAlign:'center' }}>
            <div style={{ fontSize:'11px', color:C.muted, marginBottom:'6px' }}>{label}</div>
            <div style={{ fontSize:'18px', fontWeight:'bold', color }}>{val}</div>
          </div>
        ))}
      </div>

      {/* Config */}
      {editCfg && (
        <div style={{ background:C.panel, border:`1px solid ${C.accent}`, borderRadius:'12px', padding:'20px', marginBottom:'24px' }}>
          <div style={{ fontSize:'15px', fontWeight:'bold', color:C.accent, marginBottom:'16px' }}>⚙ Configurazione</div>
          <div style={{ display:'grid', gridTemplateColumns:'repeat(4,1fr)', gap:'12px' }}>
            {[
              ['fee_challenge','Fee challenge (€)'],
              ['profitto_target','Profitto (€)'],
              ['puntata_prop_default','Puntata prop def.'],
              ['quota_prop_default','Quota prop def.'],
              ['quota_book_default','Quota book def.'],
              ['puntate_fase1','Puntate Fase 1 (stima)'],
              ['puntate_fase2','Puntate Fase 2 (stima)'],
              ['aggressivita_pct','Aggressività % (10-100)'],
              ['perdita_max_pct','Perdita max (es.0.15)'],
              ['target_fase1_pct','Target Fase 1 (es.0.25)'],
              ['target_fase2_pct','Target Fase 2 (es.0.19)'],
            ].map(([k,l]) => (
              <div key={k}>
                <label style={{ fontSize:'11px', color:C.muted, marginBottom:'4px', display:'block' }}>{l}</label>
                <input
                  style={{ background:C.input, border:`1px solid ${C.border}`, borderRadius:'6px', padding:'6px 10px', color:C.blue, fontWeight:'bold', fontSize:'13px', width:'100%', boxSizing:'border-box' }}
                  value={cfg[k] ?? ''}
                  onChange={e => setCfg({...cfg, [k]: e.target.value})}
                  onBlur={async e => await supabase.from('prop_challenges').update({ [k]: e.target.value }).eq('id', id)} />
              </div>
            ))}
          </div>
          <div style={{ marginTop:'12px', background:'#1A2A0A', border:`1px solid ${C.green}`, borderRadius:'8px', padding:'10px', display:'flex', gap:'24px', alignItems:'center' }}>
            <span style={{ color:C.muted, fontSize:'13px' }}>📌 Target book totale:</span>
            <span style={{ color:C.accent, fontWeight:'bold', fontSize:'16px' }}>€{targetBase.toFixed(2)}</span>
            <span style={{ color:C.muted, fontSize:'13px' }}>Cap puntata book:</span>
            <span style={{ color:C.blue, fontWeight:'bold' }}>€{parseFloat(cfg.puntata_prop_default).toFixed(0)} (= puntata prop)</span>
          </div>
        </div>
      )}

      {/* Tabella */}
      {ops.length === 0 ? (
        <div style={{ background:C.panel, borderRadius:'12px', padding:'40px', textAlign:'center', color:C.muted }}>
          Nessuna operazione. Clicca "+ Aggiungi Operazione" per iniziare.
        </div>
      ) : (
        <div style={{ overflowX:'auto' }}>
          <table style={{ width:'100%', borderCollapse:'collapse', fontSize:'13px' }}>
            <thead>
              <tr>
                {['#','Fase','Q.Prop','Q.Book','Punt.Prop','Punt.Book [AUTO]','Esito Prop','Esito Book',
                  'Inc.Prop','Inc.Book','P&L Op','Saldo Prop','P&L Cum Book','Residuo','Stato','',''].map((h,i) => (
                  <th key={i} style={{
                    background: h==='Punt.Book [AUTO]' ? C.green : C.accent,
                    color:'#000', padding:'8px 6px', textAlign:'center',
                    fontWeight:'bold', fontSize:'10px', whiteSpace:'nowrap'
                  }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {enrichedOps.map((op, i) => {
                const isSep = i > 0 && op.fase !== enrichedOps[i-1].fase
                const statoBg = STATO_BG[op.stato_operazione]
                const rowBg = op.stato_operazione?.includes('BRUCIATA') ? '#1A0000' : C.panel
                const sepLabel = op.fase === 'Fase 2'
                  ? '🏆 FASE 1 COMPLETATA — Nuovo conto prop da €1.000 assegnato | INIZIO FASE 2'
                  : '🏦 FASE 2 COMPLETATA — Sei in FINANZIATO! Conto reale attivo'
                const sepColor = op.fase === 'Finanziato' ? C.blue : C.green

                return (
                  <>
                    {isSep && (
                      <tr key={`sep-${op.id}`}>
                        <td colSpan={17} style={{ background:sepColor, color:'#fff', textAlign:'center', fontWeight:'bold', fontSize:'13px', padding:'10px' }}>
                          {sepLabel}
                        </td>
                      </tr>
                    )}
                    <tr key={op.id} style={{ background:rowBg, borderBottom:`1px solid ${C.border}` }}>
                      <td style={{ padding:'6px', textAlign:'center', color:C.muted, fontWeight:'bold' }}>{op.numero}</td>
                      <td style={{ padding:'6px', textAlign:'center', fontSize:'11px', fontWeight:'bold',
                        color: op.fase==='Finanziato' ? C.blue : op.fase==='Fase 2' ? C.orange : C.text }}>
                        {op.fase}
                      </td>

                      {[['quota_prop',60],['quota_book',60],['puntata_prop',70]].map(([field,w]) => (
                        <td key={field} style={{ padding:'3px' }}>
                          <input style={{ background:C.input, border:`1px solid ${C.border}`, borderRadius:'4px', padding:'4px 6px', color:C.blue, fontWeight:'bold', width:`${w}px`, textAlign:'center', fontSize:'12px' }}
                            value={op[field]} onChange={e => updateField(op.id, field, e.target.value)} />
                        </td>
                      ))}

                      <td style={{ padding:'6px', textAlign:'center', color:C.green, fontWeight:'bold', background:C.greenDark }}>
                        €{parseFloat(op.puntata_book || 0).toFixed(0)}
                      </td>

                      <td style={{ padding:'3px' }}>
                        <input style={{ background:C.input, border:`1px solid ${C.border}`, borderRadius:'4px', padding:'4px 6px', color:C.blue, fontWeight:'bold', width:'55px', textAlign:'center', fontSize:'12px' }}
                          value={op.esito_prop || ''} placeholder='V/P/€'
                          onChange={e => updateEsito(op.id, e.target.value.toUpperCase())} />
                      </td>

                      <td style={{ padding:'3px' }}>
                        <input style={{ background: op.esito_book==='NC' ? C.orange+'22' : C.input, border:`1px solid ${op.esito_book==='NC' ? C.orange : C.border}`, borderRadius:'4px', padding:'4px 6px', color: op.esito_book==='NC' ? C.orange : C.blue, fontWeight:'bold', width:'55px', textAlign:'center', fontSize:'12px' }}
                          value={op.esito_book || ''} placeholder='V/P/€'
                          onChange={e => {
                            const v = e.target.value.toUpperCase()
                            setOps(ops.map(o => o.id === op.id ? {...o, esito_book: v} : o))
                            supabase.from('prop_operations').update({esito_book: v}).eq('id', op.id)
                          }} />
                      </td>

                      {[op.incasso_prop, op.incasso_book, op.pnl_operazione].map((v, vi) => (
                        <td key={vi} style={{ padding:'6px', textAlign:'center', fontWeight:'bold',
                          color: v == null ? C.muted : v >= 0 ? C.green : C.red }}>
                          {v != null ? (v >= 0 ? '+' : '') + v.toFixed(2) + '€' : '—'}
                        </td>
                      ))}

                      <td style={{ padding:'6px', textAlign:'center', fontWeight:'bold',
                        color: op.saldo_prop == null ? C.muted : op.saldo_prop < parseFloat(cfg.saldo_iniziale) ? C.red : C.green }}>
                        {op.saldo_prop != null ? '€' + op.saldo_prop.toFixed(2) : '—'}
                      </td>

                      <td style={{ padding:'6px', textAlign:'center', fontWeight:'bold',
                        color: op.pnl_cum_book == null ? C.muted : op.pnl_cum_book >= 0 ? C.green : C.red }}>
                        {op.pnl_cum_book != null ? (op.pnl_cum_book >= 0 ? '+' : '') + op.pnl_cum_book.toFixed(2) + '€' : '—'}
                      </td>

                      <td style={{ padding:'6px', textAlign:'center', color:C.accent, fontWeight:'bold' }}>
                        {op.profitto_residuo != null ? '€' + op.profitto_residuo.toFixed(2) : '—'}
                      </td>

                      <td style={{ padding:'4px 6px', textAlign:'center', minWidth:'120px' }}>
                        {op.stato_operazione ? (
                          <span style={{
                            background: op.stato_operazione.includes('BRUCIATA') ? C.red : statoBg ? statoBg+'22' : C.panel,
                            color: op.stato_operazione.includes('BRUCIATA') ? '#fff' : statoBg || C.text,
                            border:`1px solid ${statoBg || C.border}`,
                            borderRadius:'20px', padding:'3px 8px', fontSize:'10px', fontWeight:'bold', whiteSpace:'nowrap'
                          }}>
                            {op.stato_operazione}
                          </span>
                        ) : '—'}
                      </td>

                      {/* Prelievo Finanziato */}
                      <td style={{ padding:'3px', minWidth:'85px' }}>
                        {op.fase === 'Finanziato' ? (
                          <div style={{ display:'flex', flexDirection:'column', gap:'3px', alignItems:'center' }}>
                            <input
                              style={{ background:C.input, border:`1px solid ${C.border}`, borderRadius:'4px', padding:'3px 6px', color:C.blue, fontWeight:'bold', width:'75px', textAlign:'center', fontSize:'11px' }}
                              value={op.prelievo_lordo || ''} placeholder='Prel.€'
                              onChange={e => setOps(ops.map(o => o.id === op.id ? {...o, prelievo_lordo: e.target.value} : o))}
                              onBlur={async e => {
                                const v = parseFloat(e.target.value) || null
                                setOps(ops.map(o => o.id === op.id ? {...o, prelievo_lordo: v} : o))
                                await supabase.from('prop_operations').update({prelievo_lordo: v}).eq('id', op.id)
                              }} />
                            {op.prelievo_lordo && (
                              <label style={{ display:'flex', alignItems:'center', gap:'4px', fontSize:'10px', cursor:'pointer',
                                color: op.prelievo_confermato ? C.green : C.muted }}>
                                <input type='checkbox' checked={op.prelievo_confermato || false}
                                  onChange={async e => {
                                    const v = e.target.checked
                                    setOps(ops.map(o => o.id === op.id ? {...o, prelievo_confermato: v} : o))
                                    await supabase.from('prop_operations').update({prelievo_confermato: v}).eq('id', op.id)
                                  }}
                                  style={{ accentColor: C.green }} />
                                {op.prelievo_confermato ? '✓ Pagato' : 'Conferma'}
                              </label>
                            )}
                          </div>
                        ) : <span style={{ color:C.muted, fontSize:'11px' }}>—</span>}
                      </td>

                      {/* Azioni */}
                      <td style={{ padding:'3px', textAlign:'center' }}>
                        <div style={{ display:'flex', gap:'3px', justifyContent:'center' }}>
                          <button onClick={() => noCopertura(op.id)}
                            style={{ background: op.esito_book==='NC' ? C.orange+'33' : 'none', border:`1px solid ${op.esito_book==='NC' ? C.orange : C.border}`, borderRadius:'4px', color: op.esito_book==='NC' ? C.orange : C.muted, cursor:'pointer', padding:'3px 6px', fontSize:'10px', fontWeight:'bold' }}
                            title='No copertura'>NC</button>
                          <button onClick={() => deleteOperation(op.id)}
                            style={{ background:'none', border:`1px solid ${C.border}`, borderRadius:'4px', color:C.muted, cursor:'pointer', padding:'3px 6px', fontSize:'11px' }}
                            title='Elimina'>🗑️</button>
                        </div>
                      </td>
                    </tr>
                  </>
                )
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* Riepilogo */}
      {ops.length > 0 && (
        <div style={{ background:C.panel, border:`1px solid ${C.border}`, borderRadius:'12px', padding:'20px', marginTop:'24px' }}>
          <div style={{ fontSize:'15px', fontWeight:'bold', color:C.accent, marginBottom:'16px' }}>📊 Riepilogo Finale</div>
          <div style={{ display:'grid', gridTemplateColumns:'repeat(4,1fr)', gap:'12px' }}>
            {[
              ['P&L Lordo Book', pnlBookAttuale, C.green],
              ['Fee Challenge', -parseFloat(cfg.fee_challenge), C.red],
              ['P&L NETTO', pnlBookAttuale - parseFloat(cfg.fee_challenge), pnlBookAttuale - parseFloat(cfg.fee_challenge) >= 0 ? C.green : C.red],
              ['Obiettivo raggiunto?', pnlBookAttuale >= targetDinamicoAttuale ? '✅ SÌ' : '❌ NON ANCORA', pnlBookAttuale >= targetDinamicoAttuale ? C.green : C.muted],
            ].map(([label, val, color]) => (
              <div key={label} style={{ background:C.input, borderRadius:'10px', padding:'14px', textAlign:'center' }}>
                <div style={{ fontSize:'11px', color:C.muted, marginBottom:'6px' }}>{label}</div>
                <div style={{ fontSize:'18px', fontWeight:'bold', color }}>
                  {typeof val === 'number' ? (val >= 0 ? '+' : '') + val.toFixed(2) + '€' : val}
                </div>
              </div>
            ))}
          </div>
          {faseAttuale === 'Finanziato' && prelieviTotali > 0 && (
            <div style={{ marginTop:'12px', background:'#0A1A2A', border:`1px solid ${C.blue}`, borderRadius:'8px', padding:'10px', display:'flex', gap:'24px', alignItems:'center' }}>
              <span style={{ color:C.muted, fontSize:'13px' }}>🏦 Prelievi confermati (75%):</span>
              <span style={{ color:C.blue, fontWeight:'bold', fontSize:'16px' }}>+€{prelieviTotali.toFixed(2)}</span>
              <span style={{ color:C.muted, fontSize:'13px' }}>Target residuo:</span>
              <span style={{ color:C.accent, fontWeight:'bold', fontSize:'16px' }}>€{targetDinamicoAttuale.toFixed(2)}</span>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
