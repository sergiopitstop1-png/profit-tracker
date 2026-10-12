"use client";
// ════════════════════════════════════════════════════════════════════
// SLOT CONSIGLIATE — UNA SOLA LISTA (13/10/2026)
// Fonde in un posto solo: la lista di Profilazione (tabella slot_consigliate, modificabile qui)
// e le slot nominate nei consigli dell'Accademia estratti da Lucy (tabella accademia_consigli, via /api/accademia/consigli, solo admin).
// La stessa lista si vede nella tab 🧰 Strumenti (ListaSlotUnica incorporata) e nella finestra 🎰 aperta dall'agenda (SlotConsigliate).
// Una slot = un nome (uniti senza badare a maiuscole/accenti). Se è nella lista ha ✓, se arriva solo dall'Accademia ha ＋ per portarla in lista (decide Sergio).
// ════════════════════════════════════════════════════════════════════
import React, { useEffect, useMemo, useState } from 'react'
import { supabase } from '../profit-tracker/supabaseClient'

const inp = { background: '#0b1220', color: '#f8fafc', border: '1px solid rgba(51,65,85,0.9)', borderRadius: 8, padding: '6px 9px', fontSize: 13 }
const btn = (c) => ({ padding: '5px 10px', borderRadius: 8, border: `1px solid ${c}66`, background: `${c}1a`, color: c, fontWeight: 700, fontSize: 12, cursor: 'pointer' })
const chipStile = (attivo) => ({ ...btn(attivo ? '#22c55e' : '#94a3b8'), borderRadius: 999, padding: '3px 10px' })

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

const norma = (t) => String(t || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().trim()
const maiuscola = (t) => String(t || '').charAt(0).toUpperCase() + String(t || '').slice(1)
const SCOPI = [{ k: 'margine', nome: '💰 Margine' }, { k: 'rollover', nome: '🔄 Rollover' }, { k: 'altro', nome: '🎰 Altro' }]

export function ListaSlotUnica({ contesto, incorporato }) {
  const [lista, setLista] = useState([])
  const [caricamento, setCaricamento] = useState(true)
  const [errore, setErrore] = useState('')
  const [tips, setTips] = useState([])
  const [erroreTips, setErroreTips] = useState('')
  const [giro, setGiro] = useState(0)
  const [cerca, setCerca] = useState('')
  const [vista, setVista] = useState('provider')   // 'book' | 'provider'
  const [filtro, setFiltro] = useState('tutte')    // tutte | lista | accademia | margine | rollover
  const [modifica, setModifica] = useState(false)
  const [nuova, setNuova] = useState({ provider: '', nome: '', nota: '' })
  const [lavoro, setLavoro] = useState(false)
  const [esito, setEsito] = useState('')
  const [copiato, setCopiato] = useState(false)

  useEffect(() => {
    let vivo = true
    fetch('/api/accademia/consigli?tipo=slot&limit=500', { cache: 'no-store' })
      .then(async r => { const j = await r.json().catch(() => ({})); if (!r.ok) throw new Error(j?.error || `errore ${r.status}`); return j })
      .then(j => { if (vivo) { setTips(j.consigli || []); setErroreTips('') } })
      .catch(e => { if (vivo) setErroreTips(String(e.message || e)) })
    return () => { vivo = false }
  }, [giro])

  useEffect(() => {
    let vivo = true
    supabase.from('slot_consigliate').select('*').order('ordine', { ascending: true }).order('id', { ascending: true })
      .then(({ data, error }) => {
        if (!vivo) return
        if (error) setErrore('Impossibile caricare la lista: ' + error.message)
        else setLista(data || [])
        setCaricamento(false)
      })
    return () => { vivo = false }
  }, [])

  // ── fusione: nome normalizzato → una sola voce ──
  const { voci, senzaNomi } = useMemo(() => {
    const m = new Map()
    const prendi = (nome, provider) => {
      const k = norma(nome)
      if (!k) return null
      let v = m.get(k)
      if (!v) { v = { k, nome: String(nome).trim(), provider: '', nota: '', riga: null, acc: new Map(), n: 0, staff: false, ultima: '' }; m.set(k, v) }
      if (!v.provider && provider) v.provider = String(provider).trim()
      return v
    }
    for (const r of lista) {
      const v = prendi(r.nome, r.provider)
      if (!v) continue
      v.riga = r; v.nome = String(r.nome).trim(); v.provider = String(r.provider || '').trim(); v.nota = r.nota || ''
    }
    let senza = 0
    for (const t of tips) {
      if (!(t.slot || []).length) { senza++; continue }
      const sc = ['margine', 'rollover'].includes(t.scopo) ? t.scopo : 'altro'
      for (const x of t.slot) {
        const v = prendi(x.nome, x.provider)
        if (!v) continue
        const b = t.book || ''
        const kk = b + '|' + sc
        const a = v.acc.get(kk) || { book: b, scopo: sc, n: 0, ultima: '' }
        a.n += 1; v.acc.set(kk, a)
        if ((t.ultima_data || '') > a.ultima) a.ultima = t.ultima_data || ''
        v.n += 1; v.staff = v.staff || !!t.da_staff
        if ((t.ultima_data || '') > v.ultima) v.ultima = t.ultima_data || ''
      }
    }
    return { voci: [...m.values()], senzaNomi: senza }
  }, [lista, tips])

  const q = norma(cerca)
  const visibili = voci.filter(v => {
    if (filtro === 'lista' && !v.riga) return false
    if (filtro === 'accademia' && (v.riga || v.acc.size === 0)) return false
    if ((filtro === 'margine' || filtro === 'rollover') && ![...v.acc.values()].some(a => a.scopo === filtro)) return false
    if (!q) return true
    return norma([v.nome, v.provider, v.nota, ...[...v.acc.values()].map(a => a.book)].join(' ')).includes(q)
  })

  const nLista = voci.filter(v => v.riga).length
  const nSoloAcc = voci.filter(v => !v.riga && v.acc.size).length
  const providers = [...new Set(lista.map(s => s.provider))]

  // per provider
  const gruppiProvider = useMemo(() => {
    const g = new Map()
    for (const v of visibili) { const p = v.provider || ''; g.set(p, [...(g.get(p) || []), v]) }
    return [...g.entries()]
      .sort((a, b) => (a[0] === '' ? 1 : b[0] === '' ? -1 : a[0].localeCompare(b[0])))
      .map(([p, vv]) => [p, vv.sort((a, b) => b.ultima.localeCompare(a.ultima) || a.nome.localeCompare(b.nome))])
  }, [visibili]) // eslint-disable-line react-hooks/exhaustive-deps

  // per book → scopo
  const gruppiBook = useMemo(() => {
    const libri = new Map()
    for (const v of visibili) {
      for (const a of v.acc.values()) {
        if ((filtro === 'margine' || filtro === 'rollover') && a.scopo !== filtro) continue
        if (!libri.has(a.book)) libri.set(a.book, new Map())
        const per = libri.get(a.book)
        per.set(a.scopo, [...(per.get(a.scopo) || []), { v, n: a.n, ultima: a.ultima }])
      }
    }
    const ctx = norma(contesto)
    return [...libri.entries()]
      .map(([book, per]) => ({
        book,
        perQuesto: !!(ctx && book && ctx.includes(norma(book))),
        ultima: [...per.values()].flat().reduce((m, x) => (x.ultima > m ? x.ultima : m), ''),
        scopi: SCOPI.map(s => ({ ...s, voci: (per.get(s.k) || []).sort((x, y) => y.ultima.localeCompare(x.ultima) || y.n - x.n || x.v.nome.localeCompare(y.v.nome)) })).filter(s => s.voci.length),
      }))
      .sort((a, b) => Number(b.perQuesto) - Number(a.perQuesto) || (a.book === '' ? 1 : b.book === '' ? -1 : b.ultima.localeCompare(a.ultima) || a.book.localeCompare(b.book)))
  }, [visibili, filtro, contesto]) // eslint-disable-line react-hooks/exhaustive-deps

  // ── azioni sulla lista (tabella slot_consigliate) ──
  async function aggiungi(daAcc) {
    const provider = (daAcc ? daAcc.provider : nuova.provider).trim(), nome = (daAcc ? daAcc.nome : nuova.nome).trim()
    if (!provider || !nome) { setErrore('Inserisci provider e nome'); return }
    const ordineProv = lista.filter(s => s.provider === provider).map(s => s.ordine)
    const ordine = ordineProv.length ? Math.max(...ordineProv) : (lista.length ? Math.max(...lista.map(s => s.ordine)) + 1 : 1)
    const { data, error } = await supabase.from('slot_consigliate').insert([{ provider, nome, nota: daAcc ? 'Accademia' : nuova.nota.trim(), ordine }]).select().single()
    if (error) { setErrore(error.message.includes('duplicate') ? 'Questa slot è già in lista' : 'Errore: ' + error.message); return }
    setLista(prev => [...prev, data].sort((a, b) => a.ordine - b.ordine || a.id - b.id))
    if (!daAcc) setNuova({ provider, nome: '', nota: '' })
    setErrore('')
  }
  function portaInLista(v) {
    const provider = (v.provider || window.prompt(`Di quale provider è "${v.nome}"? (es. NetEnt, Pragmatic, Playtech)`) || '').trim()
    if (!provider) return
    aggiungi({ provider, nome: v.nome })
  }
  async function aggiorna(s, campo, valore) {
    if ((s[campo] || '') === valore) return
    const { error } = await supabase.from('slot_consigliate').update({ [campo]: valore }).eq('id', s.id)
    if (error) { setErrore('Errore: ' + error.message); return }
    setLista(prev => prev.map(x => x.id === s.id ? { ...x, [campo]: valore } : x))
  }
  async function elimina(s) {
    if (!window.confirm(`Togliere "${s.nome}" (${s.provider}) dalla lista?`)) return
    const { error } = await supabase.from('slot_consigliate').delete().eq('id', s.id)
    if (error) { setErrore('Errore: ' + error.message); return }
    setLista(prev => prev.filter(x => x.id !== s.id))
  }

  // ── Lucy rilegge i consigli vecchi per scrivere i nomi delle slot ──
  async function estraiNomi() {
    if (!window.confirm('Lucy rilegge solo il testo dei consigli già raccolti (non Telegram) per scriverne i nomi delle slot. Costa pochi centesimi. Procedo?')) return
    setLavoro(true); setEsito('')
    try {
      const r = await fetch('/api/accademia/consigli', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ azione: 'slot_mancanti' }) })
      const j = await r.json().catch(() => ({}))
      if (!r.ok) throw new Error(j?.error || `errore ${r.status}`)
      setEsito(j.ok === false
        ? `⚠️ Interrotto: ${j.errore || 'errore'} · compilati ${j.conNomi} consigli`
        : `✅ Letti ${j.lavorati} consigli: ${j.conNomi} con i nomi delle slot, ${j.senzaNomi} senza nessun nome nel testo${j.rimasti > 0 ? ` · ne restano ${j.rimasti}, premi di nuovo` : ''} · costo ${Number(j.costo || 0).toFixed(3)} $`)
      setGiro(g => g + 1)
    } catch (e) {
      setEsito('⚠️ ' + String(e.message || e))
    } finally { setLavoro(false) }
  }

  const testoElenco = () => gruppiBook.flatMap(g => g.scopi.map(s => `${g.book ? maiuscola(g.book) : 'Generale'} ${s.k}: ${s.voci.map(x => x.v.nome).join(', ')}`)).join('\n')
  async function copia() {
    try { await navigator.clipboard.writeText(testoElenco()); setCopiato(true); setTimeout(() => setCopiato(false), 2000) } catch { /* niente */ }
  }

  // ── pezzi di interfaccia ──
  const badge = (c, titolo, key, children) => <span key={key} title={titolo} style={{ fontSize: 10.5, color: c, border: `1px solid ${c}55`, background: `${c}14`, borderRadius: 6, padding: '0 5px', whiteSpace: 'nowrap' }}>{children}</span>
  const azione = (v) => v.riga
    ? <span title="È nella lista di Profilazione" style={{ color: '#22c55e', fontSize: 11 }}>✓</span>
    : <button onClick={() => portaInLista(v)} title="Aggiungi alla lista Slot consigliate" style={{ ...btn('#22c55e'), padding: '0 7px', fontSize: 11 }}>＋</button>

  const rigaProvider = (v) => {
    if (modifica && v.riga) {
      const s = v.riga
      return (
        <div key={v.k} style={{ display: 'flex', gap: 4, alignItems: 'center', marginBottom: 3 }}>
          <input key={'n' + s.id + s.nome} defaultValue={s.nome} onBlur={e => aggiorna(s, 'nome', e.target.value.trim())} style={{ ...inp, padding: '3px 6px', fontSize: 12, flex: 1, minWidth: 0 }} />
          <input key={'o' + s.id + s.nota} defaultValue={s.nota || ''} placeholder="nota" onBlur={e => aggiorna(s, 'nota', e.target.value.trim())} style={{ ...inp, padding: '3px 6px', fontSize: 12, width: 70 }} />
          <button onClick={() => elimina(s)} style={{ background: 'transparent', border: 'none', color: '#f87171', cursor: 'pointer' }}>🗑</button>
        </div>
      )
    }
    const accs = [...v.acc.values()]
    return (
      <div key={v.k} style={{ padding: '2px 0', display: 'flex', gap: 6, flexWrap: 'wrap', alignItems: 'baseline' }}>
        <span style={{ color: v.riga ? '#e2e8f0' : '#fde68a', fontSize: 14 }}>{v.nome}</span>
        {v.nota && v.nota !== 'Accademia' ? <span style={{ color: '#94a3b8', fontSize: 11 }}>· {v.nota}</span> : null}
        {accs.map(a => badge(a.scopo === 'margine' ? '#38bdf8' : a.scopo === 'rollover' ? '#a78bfa' : '#94a3b8', `${a.n} ${a.n === 1 ? 'consiglio' : 'consigli'}`, a.book + a.scopo, `${a.book ? maiuscola(a.book) : 'generale'} ${a.scopo !== 'altro' ? a.scopo : ''}${a.n > 1 ? ` ×${a.n}` : ''}`))}
        {v.staff && <span title="Consigliata dallo staff">⭐</span>}
        {azione(v)}
      </div>
    )
  }

  const contenitore = incorporato
    ? { background: '#0f172a', border: '1px solid rgba(251,191,36,0.4)', borderRadius: 16, padding: 20, width: '100%', maxWidth: 900, boxSizing: 'border-box' }
    : {}

  return (
    <div style={contenitore}>
      <div style={{ fontSize: 12, color: '#94a3b8' }}>
        {nLista} in lista Profilazione · {nSoloAcc} solo dall&apos;Accademia (＋ per portarle in lista) · {providers.length} provider
        {contesto ? <><br /><span style={{ color: '#fbbf24' }}>Per: {contesto}</span></> : null}
      </div>

      <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', alignItems: 'center', margin: '12px 0 8px' }}>
        <button style={chipStile(vista === 'book')} onClick={() => setVista('book')}>📚 Per book</button>
        <button style={chipStile(vista === 'provider')} onClick={() => setVista('provider')}>🏷 Per provider</button>
        <span style={{ color: '#334155' }}>|</span>
        {[['tutte', 'Tutte'], ['lista', '✓ In lista'], ['accademia', '🎓 Solo Accademia'], ['margine', '💰 Margine'], ['rollover', '🔄 Rollover']].map(([k, n]) =>
          <button key={k} style={chipStile(filtro === k)} onClick={() => setFiltro(k)}>{n}</button>)}
        <span style={{ flex: 1 }} />
        <button style={btn(modifica ? '#22c55e' : '#94a3b8')} onClick={() => setModifica(!modifica)}>{modifica ? '✓ Fine' : '✏️ Modifica lista'}</button>
        {vista === 'book' && gruppiBook.length > 0 && <button style={btn('#38bdf8')} onClick={copia}>{copiato ? '✓ Copiato' : '📋 Copia elenco'}</button>}
      </div>

      <input value={cerca} onChange={e => setCerca(e.target.value)} placeholder="Cerca slot, provider o book…" style={{ ...inp, width: '100%', marginBottom: 12, boxSizing: 'border-box' }} />

      {errore && <div style={{ color: '#f87171', fontSize: 12, marginBottom: 8 }}>{errore}</div>}
      {erroreTips && <div style={{ color: '#fbbf24', fontSize: 12, marginBottom: 8 }}>Slot dell&apos;Accademia non disponibili ({erroreTips}): vedi solo la lista di Profilazione.</div>}
      {esito && <div style={{ color: '#86efac', fontSize: 12, marginBottom: 8 }}>{esito}</div>}

      {caricamento ? <div style={{ color: '#94a3b8' }}>Caricamento…</div> : vista === 'provider' ? (
        <div style={{ columnWidth: 230, columnGap: 18 }}>
          {gruppiProvider.map(([p, vv]) => (
            <div key={p || '__nessuno'} style={{ breakInside: 'avoid', marginBottom: 14 }}>
              <div style={{ color: '#fbbf24', fontWeight: 900, fontSize: 12, letterSpacing: 0.5, textTransform: 'uppercase', marginBottom: 4 }}>{p || 'Provider da indicare'}</div>
              {vv.map(v => rigaProvider(v))}
            </div>
          ))}
          {gruppiProvider.length === 0 && <div style={{ color: '#94a3b8' }}>Nessuna slot trovata.</div>}
        </div>
      ) : (
        <div>
          {gruppiBook.map(g => (
            <details key={g.book || '__generale'} open={g.perQuesto || gruppiBook.length <= 4 || !!q} style={{ marginBottom: 10, border: `1px solid ${g.perQuesto ? 'rgba(251,191,36,0.6)' : 'rgba(51,65,85,0.8)'}`, borderRadius: 10, background: 'rgba(2,6,23,0.5)' }}>
              <summary style={{ cursor: 'pointer', color: '#fbbf24', fontWeight: 900, fontSize: 12, letterSpacing: 0.5, textTransform: 'uppercase', padding: '7px 10px' }}>
                {g.book ? maiuscola(g.book) : 'Generale'}{g.perQuesto ? <span style={{ color: '#fbbf24', fontWeight: 600 }}> · per questo book</span> : null}
              </summary>
              <div style={{ padding: '2px 10px 10px' }}>
                {g.scopi.map(s => (
                  <div key={s.k} style={{ display: 'flex', gap: 10, alignItems: 'baseline', marginTop: 5 }}>
                    <span style={{ width: 86, flexShrink: 0, fontSize: 12, fontWeight: 800, color: '#38bdf8' }}>{s.nome}</span>
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, flex: 1 }}>
                      {s.voci.map(({ v, n, ultima }) => (
                        <span key={v.k} title={`${n} ${n === 1 ? 'consiglio' : 'consigli'}${v.provider ? ' · ' + v.provider : ''}${ultima ? ' · ultimo messaggio ' + new Date(ultima).toLocaleDateString('it-IT') : ''}`}
                          style={{ display: 'inline-flex', gap: 5, alignItems: 'center', border: `1px solid ${v.riga ? 'rgba(34,197,94,0.45)' : 'rgba(245,158,11,0.35)'}`, background: v.riga ? 'rgba(34,197,94,0.08)' : 'rgba(245,158,11,0.08)', borderRadius: 6, padding: '1px 7px', fontSize: 12.5, color: '#f1f5f9' }}>
                          {v.nome}{n > 1 ? <span style={{ color: '#fbbf24', opacity: 0.8 }}>×{n}</span> : null}{v.staff ? '⭐' : ''}{azione(v)}
                        </span>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </details>
          ))}
          {gruppiBook.length === 0 && <div style={{ color: '#94a3b8', fontSize: 13 }}>Nessuna slot dell&apos;Accademia con questi filtri. Quelle della lista di Profilazione sono nella vista «Per provider».</div>}
        </div>
      )}

      {senzaNomi > 0 && (
        <div style={{ marginTop: 12, padding: 8, border: '1px solid rgba(245,158,11,0.4)', background: 'rgba(245,158,11,0.08)', borderRadius: 8, color: '#fcd34d', fontSize: 12 }}>
          {senzaNomi} {senzaNomi === 1 ? 'consiglio sulle slot non ha' : 'consigli sulle slot non hanno'} ancora l&apos;elenco dei nomi (letti prima che Lucy imparasse a estrarli).
          <button disabled={lavoro} onClick={estraiNomi} style={{ ...btn('#22c55e'), marginLeft: 8, opacity: lavoro ? 0.5 : 1 }}>{lavoro ? 'Leggo…' : '🔧 Estrai i nomi con Lucy'}</button>
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
          <button style={btn('#22c55e')} onClick={() => aggiungi()}>Aggiungi</button>
        </div>
      )}
    </div>
  )
}

// Finestra 🎰 aperta dall'agenda: stessa lista della tab Strumenti
export default function SlotConsigliate({ onClose, contesto }) {
  return (
    <div onClick={onClose} style={{ position: 'fixed', inset: 0, background: 'rgba(2,6,23,0.8)', zIndex: 3000, display: 'flex', alignItems: 'flex-start', justifyContent: 'center', overflowY: 'auto', padding: '30px 12px' }}>
      <div onClick={e => e.stopPropagation()} style={{ background: '#0f172a', border: '1px solid rgba(251,191,36,0.4)', borderRadius: 16, padding: 20, width: '100%', maxWidth: 760 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
          <div style={{ fontSize: 19, fontWeight: 900, color: '#f8fafc' }}>🎰 Slot consigliate</div>
          <button style={btn('#94a3b8')} onClick={onClose}>✕</button>
        </div>
        <ListaSlotUnica contesto={contesto} />
      </div>
    </div>
  )
}
