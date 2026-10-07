"use client";
// ════════════════════════════════════════════════════════════════════
// 🎁 PROMO BONUS (05/10/2026)
// Tab "Promo": le promo arrivate via mail/SMS (cliente, book, tipo, versamento, bonus, rollover, scadenza).
// - Da Lucy Mail, pulsante "📌 Promo" → il Profit Tracker apre questa tab con il modulo già compilato
//   dai dati letti dall'AI (prefill). "Applica anche a…" crea la stessa promo per più clienti.
// - PromoScadenze: striscia in Dashboard che LAMPEGGIA quando una promo da fare scade entro 2 giorni.
// - Stato: 'da fare' → 'fatta' (finisce in Archivio operazioni) oppure 'rinunciata'. "Scaduta" si calcola.
// Tabella: promo_bonus (promo_bonus.sql).
// ════════════════════════════════════════════════════════════════════
import React, { useEffect, useMemo, useRef, useState } from 'react'
import { supabase } from '../profit-tracker/supabaseClient'

const TIPI = ['Benvenuto', 'Ricarica', 'Cashback', 'Freebet', 'Giri gratis', 'Quota maggiorata', 'Rimborso', 'Torneo', 'Altro']
const oggiIso = () => new Date().toLocaleDateString('sv-SE', { timeZone: 'Europe/Rome' })
const dataIt = iso => iso ? String(iso).slice(0, 10).split('-').reverse().join('/') : ''
const giorniA = iso => Math.round((new Date(String(iso).slice(0, 10) + 'T12:00:00') - new Date(oggiIso() + 'T12:00:00')) / 86400000)
const euro = v => v == null || v === '' ? '' : Number(v).toLocaleString('it-IT', { style: 'currency', currency: 'EUR' })
const norm = s => String(s || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9]/g, '')
const num = v => { if (v === null || v === undefined || String(v).trim() === '') return null; const n = Number(String(v).replace(/[€\s]/g, '').replace(',', '.')); return Number.isFinite(n) ? n : null }

// scadenza scritta dall'AI in vari modi → AAAA-MM-GG (oppure '' se non si capisce)
export function leggiScadenza(t) {
  const s = String(t || '').trim()
  let m = s.match(/(\d{4})-(\d{2})-(\d{2})/)
  if (m) return `${m[1]}-${m[2]}-${m[3]}`
  m = s.match(/(\d{1,2})[\/.-](\d{1,2})(?:[\/.-](\d{2,4}))?/)
  if (m) { let y = m[3] ? Number(m[3]) : Number(oggiIso().slice(0, 4)); if (y < 100) y += 2000; return `${y}-${String(m[2]).padStart(2, '0')}-${String(m[1]).padStart(2, '0')}` }
  return ''
}

function statoVisto(p) {
  if (p.stato !== 'da fare') return p.stato
  if (p.scadenza && giorniA(p.scadenza) < 0) return 'scaduta'
  return 'da fare'
}
function etichettaScadenza(iso) {
  if (!iso) return { testo: 'senza scadenza', colore: '#64748b' }
  const g = giorniA(iso)
  if (g < 0) return { testo: `scaduta da ${-g} gg`, colore: '#64748b' }
  if (g === 0) return { testo: 'scade OGGI', colore: '#f87171' }
  if (g === 1) return { testo: 'scade domani', colore: '#facc15' }   // 07/10/2026: giallo (oggi resta rosso)
  if (g === 2) return { testo: 'tra 2 gg', colore: '#38bdf8' }       // 07/10/2026: azzurro
  return { testo: `tra ${g} gg`, colore: '#94a3b8' }
}

// ─── STRISCIA IN DASHBOARD: promo da fare che scadono entro 2 giorni (lampeggia) ───
export function PromoScadenze({ onApri, Sezione }) {
  const [lista, setLista] = useState([])
  useEffect(() => {
    let vivo = true
    const carica = async () => {
      const limite = new Date(Date.now() + 2 * 86400000).toLocaleDateString('sv-SE', { timeZone: 'Europe/Rome' })
      const { data, error } = await supabase.from('promo_bonus').select('id,cliente,book,tipo,bonus,scadenza')
        .eq('stato', 'da fare').gte('scadenza', oggiIso()).lte('scadenza', limite).order('scadenza', { ascending: true })
      if (vivo && !error) setLista(data || [])
    }
    carica()
    const t = setInterval(carica, 5 * 60 * 1000)
    return () => { vivo = false; clearInterval(t) }
  }, [])
  if (!lista.length) return null
  const gruppi = Object.values(lista.reduce((acc, p) => {
    const e = etichettaScadenza(p.scadenza)
    const g = acc[p.scadenza] || (acc[p.scadenza] = { iso: p.scadenza, testo: e.testo.replace('scade ', '').replace(/^./, c => c.toUpperCase()), colore: e.colore, promo: [] })
    g.promo.push(p); return acc
  }, {})).sort((x, y) => String(x.iso).localeCompare(String(y.iso)))
  // 06/10/2026 — se la Dashboard passa il componente Sezione, la striscia è una riga chiusa con i numeri (si apre con un clic)
  const conta = (re) => gruppi.filter(g => re.test(g.testo)).reduce((n, g) => n + g.promo.length, 0)
  const oggi = conta(/^oggi/i), domani = conta(/^domani/i)   // l'etichetta di oggi è scritta OGGI in maiuscolo
  if (Sezione) {
    return (
      <Sezione id="dash_promo" titolo="🎁 Promo in scadenza" badge={`${lista.length}${oggi ? ` · ${oggi} oggi` : ''}${domani ? ` · ${domani} domani` : ''}`} colore="#f87171" aperta={false} lampeggia={oggi + domani > 0}>
        <div onClick={onApri} title="Apri la tab Promo"
          style={{ cursor: 'pointer', background: 'rgba(239,68,68,.08)', border: '1px solid rgba(248,113,113,.5)', borderRadius: 14, padding: '10px 14px', display: 'flex', flexWrap: 'wrap', gap: 8, alignItems: 'center' }}>
          {gruppi.map(g => (
            <div key={g.iso} style={{ width: '100%', display: 'flex', flexWrap: 'wrap', gap: 6, alignItems: 'center' }}>
              <span style={{ minWidth: 118, fontSize: 12, fontWeight: 800, color: g.colore }}>
                {g.testo} <span style={{ fontWeight: 500, opacity: .75 }}>· {dataIt(g.iso)}</span>
              </span>
              {g.promo.map(p => (
                <span key={p.id} style={{ padding: '3px 10px', borderRadius: 999, border: `1px solid ${g.colore}66`, background: `${g.colore}14`, color: '#e2e8f0', fontSize: 12, fontWeight: 600 }}>
                  {p.cliente} <span style={{ color: g.colore, opacity: .8 }}>·</span> {p.book}
                </span>))}
            </div>))}
        </div>
      </Sezione>)
  }
  return (
    <div className="promo-lampeggia" onClick={onApri} title="Apri la tab Promo"
      style={{ cursor: 'pointer', background: 'rgba(239,68,68,.12)', border: '1px solid rgba(248,113,113,.7)', borderRadius: 14, padding: '10px 14px', margin: '0 0 14px', display: 'flex', flexWrap: 'wrap', gap: 8, alignItems: 'center' }}>
      <style>{`@keyframes promoPulse { 0%,100% { box-shadow: 0 0 0 0 rgba(248,113,113,.0); border-color: rgba(248,113,113,.7) } 50% { box-shadow: 0 0 18px 2px rgba(248,113,113,.45); border-color: rgba(254,202,202,1) } } .promo-lampeggia { animation: promoPulse 1.6s ease-in-out infinite }`}</style>
      <div style={{ width: '100%', fontWeight: 900, color: '#fca5a5', fontSize: 13 }}>🎁 Promo in scadenza · {lista.length}</div>
      {gruppi.map(g => (
        <div key={g.iso} style={{ width: '100%', display: 'flex', flexWrap: 'wrap', gap: 6, alignItems: 'center' }}>
          <span style={{ minWidth: 118, fontSize: 12, fontWeight: 800, color: g.colore }}>
            {g.testo} <span style={{ fontWeight: 500, opacity: .75 }}>· {dataIt(g.iso)}</span>
          </span>
          {g.promo.map(p => (
            <span key={p.id} style={{ padding: '3px 10px', borderRadius: 999, border: `1px solid ${g.colore}66`, background: `${g.colore}14`, color: '#e2e8f0', fontSize: 12, fontWeight: 600 }}>
              {p.cliente} <span style={{ color: g.colore, opacity: .8 }}>·</span> {p.book}
            </span>))}
        </div>))}
    </div>
  )
}

// ─── TAB PROMO ───
const vuoto = { cliente: '', anche: [], book: '', tipo: '', versamento: '', bonus: '', rollover: '', da_giocare: '', scadenza: '', note: '', mail_canale: null, mail_id: null, oggetto: '' }

export default function PromoBonusPanel({ books, prefill, onPrefillUsato, onMessage, onError }) {
  const [promo, setPromo] = useState([])
  const [form, setForm] = useState(null)          // modulo aperto (nuova o modifica)
  const [filtro, setFiltro] = useState('da fare') // 'da fare' | 'tutte' | 'fatta' | 'scaduta' | 'rinunciata'
  const [cerca, setCerca] = useState('')
  const [errTabella, setErrTabella] = useState('')
  const formRef = useRef(null)

  // 07/10/2026 — quando si apre il modulo (matita, nuova promo, arrivo da Lucy Mail) la pagina scorre fin lì
  useEffect(() => {
    if (!form) return
    const t = setTimeout(() => { try { formRef.current && formRef.current.scrollIntoView({ behavior: 'smooth', block: 'center' }) } catch (e) {} }, 60)
    return () => clearTimeout(t)
  }, [!!form, form && form.id])   // eslint-disable-line react-hooks/exhaustive-deps

  const clienti = useMemo(() => [...new Set((books || []).map(b => String(b.intestatario || '').trim()).filter(Boolean))].sort((a, b) => a.localeCompare(b)), [books])
  const nomiBook = useMemo(() => [...new Set((books || []).map(b => String(b.nome || '').trim()).filter(Boolean))].sort((a, b) => a.localeCompare(b)), [books])
  const trovaBook = (nome, cliente) => (books || []).find(b => norm(b.nome) === norm(nome) && norm(b.intestatario) === norm(cliente))
  const clienteSimile = (t) => { const n = norm(t); if (!n) return ''; return clienti.find(c => norm(c) === n) || clienti.find(c => norm(c).includes(n) || n.includes(norm(c))) || String(t || '') }
  const bookSimile = (t) => { const n = norm(t); if (!n) return ''; return nomiBook.find(b => norm(b) === n) || nomiBook.find(b => norm(b).startsWith(n) || n.startsWith(norm(b))) || String(t || '') }

  async function carica() {
    const { data, error } = await supabase.from('promo_bonus').select('*').order('scadenza', { ascending: true, nullsFirst: false }).order('id', { ascending: false }).limit(1000)
    if (error) { setErrTabella('Lancia promo_bonus.sql su Supabase (' + error.message + ')'); return }
    setErrTabella(''); setPromo(data || [])
  }
  useEffect(() => { carica() }, [])

  // arrivo da Lucy Mail: modulo già compilato con i dati letti dall'AI
  useEffect(() => {
    if (!prefill) return
    const tipo = TIPI.find(t => norm(t) === norm(prefill.tipo)) || prefill.tipo || ''
    const scad = leggiScadenza(prefill.scadenza)
    setForm({
      ...vuoto, cliente: clienteSimile(prefill.cliente), book: bookSimile(prefill.book), tipo,
      versamento: prefill.deposito ?? '', bonus: prefill.bonus ?? '', rollover: prefill.rollover || '', scadenza: scad,
      note: !scad && prefill.scadenza ? `Scadenza nella mail: ${prefill.scadenza}` : '',
      mail_canale: prefill.canale || null, mail_id: prefill.mail_id || null, oggetto: prefill.oggetto || '',
    })
    onPrefillUsato && onPrefillUsato()
  }, [prefill])   // eslint-disable-line react-hooks/exhaustive-deps

  async function salva() {
    const f = form
    if (!f.cliente.trim() || !f.book.trim()) { onError && onError('Servono almeno cliente e book'); return }
    const base = {
      book: f.book.trim(), tipo: f.tipo || null, versamento: num(f.versamento), bonus: num(f.bonus), rollover: f.rollover.trim() || null,
      da_giocare: num(f.da_giocare), scadenza: f.scadenza || null, note: f.note.trim() || null,
      mail_canale: f.mail_canale, mail_id: f.mail_id ? String(f.mail_id) : null, oggetto: f.oggetto || null,
    }
    if (f.id) {
      const b = trovaBook(f.book, f.cliente)
      const { data, error } = await supabase.from('promo_bonus').update({ ...base, cliente: f.cliente.trim(), book_id: b?.id ?? null }).eq('id', f.id).select().single()
      if (error) { onError && onError('Promo non salvata: ' + error.message); return }
      setPromo(prev => prev.map(p => p.id === f.id ? data : p))
      onMessage && onMessage('🎁 Promo aggiornata')
    } else {
      const tutti = [...new Set([f.cliente.trim(), ...f.anche])]
      const righe = tutti.map(c => ({ ...base, cliente: c, book_id: trovaBook(f.book, c)?.id ?? null }))
      const { data, error } = await supabase.from('promo_bonus').insert(righe).select()
      if (error) { onError && onError('Promo non salvata: ' + error.message); return }
      setPromo(prev => [...prev, ...(data || [])])
      const senzaConto = righe.filter(r => !r.book_id).map(r => r.cliente)
      onMessage && onMessage(`🎁 ${righe.length === 1 ? 'Promo salvata' : `${righe.length} promo salvate`}${senzaConto.length ? ` · ⚠️ senza conto ${f.book} in Books: ${senzaConto.join(', ')}` : ''}`)
    }
    setForm(null)
  }

  async function cambiaStato(p, stato) {
    const agg = { stato, fatta_il: stato === 'fatta' ? oggiIso() : null }
    const { data, error } = await supabase.from('promo_bonus').update(agg).eq('id', p.id).select().single()
    if (error) { onError && onError(error.message); return }
    setPromo(prev => prev.map(x => x.id === p.id ? data : x))
    onMessage && onMessage(stato === 'fatta' ? '✅ Promo fatta: è in Archivio operazioni' : stato === 'rinunciata' ? '🚫 Promo rinunciata' : '↩️ Promo riaperta')
  }
  async function aggiornaGiocato(p, v) {
    const n = num(v); if (n === null || n === Number(p.giocato || 0)) return
    const { data, error } = await supabase.from('promo_bonus').update({ giocato: n }).eq('id', p.id).select().single()
    if (!error) setPromo(prev => prev.map(x => x.id === p.id ? data : x))
  }
  async function elimina(p) {
    if (!window.confirm(`Eliminare la promo ${p.book} · ${p.cliente}?`)) return
    const { error } = await supabase.from('promo_bonus').delete().eq('id', p.id)
    if (error) { onError && onError(error.message); return }
    setPromo(prev => prev.filter(x => x.id !== p.id))
  }

  const visibili = useMemo(() => {
    const q = norm(cerca)
    return promo.filter(p => filtro === 'tutte' || statoVisto(p) === filtro)
      .filter(p => !q || norm(`${p.cliente} ${p.book} ${p.tipo} ${p.note} ${p.oggetto}`).includes(q))
      .sort((a, b) => String(a.scadenza || '9999').localeCompare(String(b.scadenza || '9999')))
  }, [promo, filtro, cerca])
  const conteggio = s => promo.filter(p => statoVisto(p) === s).length

  const inp = { padding: '7px 10px', borderRadius: 8, border: '1px solid #334155', background: '#0b1220', color: '#f8fafc', fontSize: 13 }
  const btn = c => ({ padding: '5px 10px', borderRadius: 8, border: `1px solid ${c}88`, background: `${c}1a`, color: c, fontSize: 12, fontWeight: 700, cursor: 'pointer' })
  const th = { textAlign: 'left', padding: '7px 8px', fontSize: 11, color: '#94a3b8', borderBottom: '1px solid #334155', whiteSpace: 'nowrap' }
  const td = { padding: '7px 8px', fontSize: 12.5, color: '#e2e8f0', borderBottom: '1px solid rgba(51,65,85,.5)', verticalAlign: 'top' }
  const campo = (etich, el) => <label style={{ display: 'flex', flexDirection: 'column', gap: 3, fontSize: 11, color: '#94a3b8' }}>{etich}{el}</label>

  return (
    <div style={{ background: 'rgba(15,23,42,.6)', border: '1px solid rgba(244,114,182,.35)', borderRadius: 16, padding: 16 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8, flexWrap: 'wrap', marginBottom: 12 }}>
        <div style={{ fontSize: 18, fontWeight: 900, color: '#f9a8d4' }}>🎁 Promo da ricordare</div>
        {!form && <button style={btn('#f472b6')} onClick={() => setForm({ ...vuoto })}>➕ Nuova promo</button>}
      </div>
      {errTabella && <div style={{ color: '#fca5a5', fontSize: 13, marginBottom: 10 }}>⚠️ {errTabella}</div>}

      {/* ─── modulo ─── */}
      {form && (
        <div ref={formRef} style={{ border: '1px solid rgba(244,114,182,.45)', borderRadius: 12, padding: 12, marginBottom: 14, background: 'rgba(2,6,23,.5)', boxShadow: form.id ? '0 0 0 2px rgba(250,204,21,.45)' : 'none' }}>
          {form.id && <div style={{ fontSize: 13, fontWeight: 800, color: '#facc15', marginBottom: 8 }}>✏️ Modifica promo: {form.book} · {form.cliente}</div>}
          {form.oggetto && <div style={{ fontSize: 12, color: '#7dd3fc', marginBottom: 8 }}>📬 Dalla {form.mail_canale === 'SMS' ? 'SMS' : 'mail'}: <b>{form.oggetto}</b> — controlla i dati letti dall'AI</div>}
          <datalist id="promo-clienti">{clienti.map(c => <option key={c} value={c} />)}</datalist>
          <datalist id="promo-book">{nomiBook.map(b => <option key={b} value={b} />)}</datalist>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: 10 }}>
            {campo('Cliente', <input list="promo-clienti" style={inp} value={form.cliente} onChange={e => setForm({ ...form, cliente: e.target.value })} />)}
            {campo('Book', <input list="promo-book" style={inp} value={form.book} onChange={e => setForm({ ...form, book: e.target.value })} />)}
            {campo('Tipo promo', <select style={inp} value={TIPI.includes(form.tipo) ? form.tipo : (form.tipo ? '__altro' : '')} onChange={e => setForm({ ...form, tipo: e.target.value === '__altro' ? form.tipo : e.target.value })}>
              <option value="">—</option>{TIPI.map(t => <option key={t}>{t}</option>)}{form.tipo && !TIPI.includes(form.tipo) && <option value="__altro">{form.tipo}</option>}
            </select>)}
            {campo('Versamento €', <input style={inp} inputMode="decimal" value={form.versamento} onChange={e => setForm({ ...form, versamento: e.target.value })} />)}
            {campo('Bonus €', <input style={inp} inputMode="decimal" value={form.bonus} onChange={e => setForm({ ...form, bonus: e.target.value })} />)}
            {campo('Scadenza', <input type="date" style={inp} value={form.scadenza} onChange={e => setForm({ ...form, scadenza: e.target.value })} />)}
            {campo('Rollover (come scritto)', <input style={inp} placeholder="es. x5 quota min 1,50" value={form.rollover} onChange={e => setForm({ ...form, rollover: e.target.value })} />)}
            {campo('Da giocare € (facoltativo)', <input style={inp} inputMode="decimal" placeholder="per la barra di avanzamento" value={form.da_giocare} onChange={e => setForm({ ...form, da_giocare: e.target.value })} />)}
          </div>
          {campo('Note', <textarea rows={2} style={{ ...inp, resize: 'vertical', fontFamily: 'inherit', marginTop: 8 }} value={form.note} onChange={e => setForm({ ...form, note: e.target.value })} placeholder="cosa fare, condizioni particolari…" />)}
          {!form.id && (
            <div style={{ marginTop: 10 }}>
              <div style={{ fontSize: 11, color: '#94a3b8', marginBottom: 5 }}>Applica la stessa promo anche a… <span style={{ color: '#64748b' }}>(clic per scegliere)</span></div>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 5, maxHeight: 110, overflowY: 'auto' }}>
                {clienti.filter(c => c !== form.cliente).map(c => { const su = form.anche.includes(c); const haConto = !form.book || !!trovaBook(form.book, c); return (
                  <span key={c} onClick={() => setForm({ ...form, anche: su ? form.anche.filter(x => x !== c) : [...form.anche, c] })}
                    title={haConto ? '' : `Nessun conto ${form.book} in Books`}
                    style={{ cursor: 'pointer', padding: '3px 9px', borderRadius: 999, fontSize: 11.5, border: `1px solid ${su ? '#f472b6' : '#334155'}`, background: su ? 'rgba(244,114,182,.18)' : 'transparent', color: su ? '#fbcfe8' : haConto ? '#cbd5e1' : '#64748b' }}>
                    {su ? '✓ ' : ''}{c}
                  </span>) })}
              </div>
            </div>
          )}
          <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', marginTop: 12 }}>
            <button style={btn('#94a3b8')} onClick={() => setForm(null)}>Annulla</button>
            <button style={btn('#f472b6')} onClick={salva}>💾 {form.id ? 'Salva modifiche' : `Salva${form.anche.length ? ` (${form.anche.length + 1} clienti)` : ''}`}</button>
          </div>
        </div>
      )}

      {/* ─── filtri ─── */}
      <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', alignItems: 'center', marginBottom: 10 }}>
        {[['da fare', `Da fare (${conteggio('da fare')})`], ['scaduta', `Scadute (${conteggio('scaduta')})`], ['fatta', `Fatte (${conteggio('fatta')})`], ['rinunciata', `Rinunciate (${conteggio('rinunciata')})`], ['tutte', `Tutte (${promo.length})`]].map(([k, t]) => (
          <button key={k} style={{ ...btn(filtro === k ? '#f472b6' : '#64748b'), fontWeight: filtro === k ? 900 : 600 }} onClick={() => setFiltro(k)}>{t}</button>))}
        <input style={{ ...inp, marginLeft: 'auto', width: 220 }} placeholder="🔎 Cliente, book, tipo…" value={cerca} onChange={e => setCerca(e.target.value)} />
      </div>

      {/* ─── elenco ─── */}
      <div style={{ overflowX: 'auto' }}>
        <table style={{ borderCollapse: 'collapse', width: '100%' }}>
          <thead><tr>{['Scadenza', 'Cliente', 'Book', 'Tipo', 'Versa', 'Bonus', 'Rollover', 'Note', ''].map((h, i) => <th key={i} style={th}>{h}</th>)}</tr></thead>
          <tbody>
            {visibili.map(p => { const e = etichettaScadenza(p.scadenza); const st = statoVisto(p); const tot = Number(p.da_giocare || 0), gio = Number(p.giocato || 0); return (
              <tr key={p.id} style={{ opacity: st === 'da fare' ? 1 : 0.6 }}>
                <td style={{ ...td, whiteSpace: 'nowrap' }}>
                  <div style={{ fontWeight: 800, color: st === 'da fare' ? e.colore : '#94a3b8' }}>{st === 'fatta' ? '✅ fatta' : st === 'rinunciata' ? '🚫 rinunciata' : e.testo}</div>
                  <div style={{ fontSize: 11, color: '#64748b' }}>{dataIt(p.scadenza)}</div>
                </td>
                <td style={{ ...td, fontWeight: 700 }}>{p.cliente}</td>
                <td style={td}><b>{p.book}</b>{!p.book_id && <span title="Conto non trovato in Books" style={{ color: '#fbbf24' }}> ⚠️</span>}</td>
                <td style={td}>{p.tipo}</td>
                <td style={{ ...td, whiteSpace: 'nowrap' }}>{euro(p.versamento)}</td>
                <td style={{ ...td, whiteSpace: 'nowrap', color: '#86efac', fontWeight: 800 }}>{euro(p.bonus)}</td>
                <td style={{ ...td, minWidth: 130 }}>
                  {p.rollover && <div style={{ fontSize: 12 }}>{p.rollover}</div>}
                  {tot > 0 && (<>
                    <div style={{ height: 6, background: '#1e293b', borderRadius: 4, margin: '4px 0', overflow: 'hidden' }}><div style={{ width: `${Math.min(100, 100 * gio / tot)}%`, height: '100%', background: gio >= tot ? '#22c55e' : '#f472b6' }} /></div>
                    <div style={{ fontSize: 11, color: '#94a3b8', display: 'flex', alignItems: 'center', gap: 4 }}>
                      giocato <input defaultValue={gio || ''} onBlur={ev => aggiornaGiocato(p, ev.target.value)} style={{ ...inp, width: 70, padding: '2px 5px', fontSize: 11 }} /> / {euro(tot)}
                    </div></>)}
                </td>
                <td style={{ ...td, fontSize: 12, color: '#cbd5e1', maxWidth: 260 }}>
                  {p.note}{p.oggetto && <div style={{ fontSize: 11, color: '#7dd3fc', marginTop: 2 }}>📬 {p.oggetto}</div>}
                </td>
                <td style={{ ...td, whiteSpace: 'nowrap' }}>
                  {st === 'da fare' || st === 'scaduta' ? (<>
                    <button style={btn('#22c55e')} onClick={() => cambiaStato(p, 'fatta')}>✅</button>{' '}
                    <button style={btn('#94a3b8')} title="Rinuncia" onClick={() => cambiaStato(p, 'rinunciata')}>🚫</button>{' '}
                  </>) : <><button style={btn('#94a3b8')} title="Riapri" onClick={() => cambiaStato(p, 'da fare')}>↩️</button>{' '}</>}
                  <button style={btn('#facc15')} onClick={() => setForm({ ...vuoto, ...p, anche: [], versamento: p.versamento ?? '', bonus: p.bonus ?? '', rollover: p.rollover || '', da_giocare: p.da_giocare ?? '', scadenza: p.scadenza || '', note: p.note || '', tipo: p.tipo || '' })}>✏️</button>{' '}
                  <button style={btn('#f87171')} onClick={() => elimina(p)}>🗑</button>
                </td>
              </tr>) })}
            {!visibili.length && <tr><td colSpan={9} style={{ ...td, color: '#64748b' }}>Nessuna promo {filtro === 'tutte' ? '' : `"${filtro}"`}. Aggiungile con ➕ o da Lucy Mail con 📌 Promo.</td></tr>}
          </tbody>
        </table>
      </div>
    </div>
  )
}
