"use client";
// ════════════════════════════════════════════════════════════════════
// SESSIONI LIVE LIBERE (01/10/2026) — dal file "Randomizzatori" di Sergio
// Copertura della roulette (0-36) su più conti, scelti a mano:
//  • più sessioni nello stesso giorno: chi ha già giocato oggi viene segnalato
//    e messo in fondo (le "puntate confermate" del vecchio Excel)
//  • numeri a mano per qualcuno: il resto si ridistribuisce da solo
//  • Lottomatica/GoldBet giocano solo sestine vere
//  • seed stabile: i numeri NON cambiano se tocchi altro (il difetto del RAND() dell'Excel)
//  • 📱 per ogni conto e 📱 Apri tutti
// Costo teorico: 1/37 del giocato (= la puntata di un numero) a ogni giro.
// Tabella: live_sessioni (vedi live_sessioni.sql).
// ════════════════════════════════════════════════════════════════════
import React, { useState, useEffect, useMemo, useCallback } from 'react'
import { supabase } from '../profit-tracker/supabaseClient'

export const SESTINE = [[1,2,3,4,5,6],[4,5,6,7,8,9],[7,8,9,10,11,12],[10,11,12,13,14,15],[13,14,15,16,17,18],[16,17,18,19,20,21],[19,20,21,22,23,24],[22,23,24,25,26,27],[25,26,27,28,29,30],[28,29,30,31,32,33],[31,32,33,34,35,36]]
export const soloSestine = (b) => /lottomatica|goldbet/i.test(String(b?.nome || ''))

function generatore(seedText) {
  let s = 2166136261
  for (const ch of String(seedText)) { s ^= ch.charCodeAt(0); s = Math.imul(s, 16777619) }
  return () => { s += 0x6D2B79F5; let t = s; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296 }
}
function mescola(arr, rnd) { const a = [...arr]; for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(rnd() * (i + 1)); [a[i], a[j]] = [a[j], a[i]] } return a }

// Distribuzione dei 37 numeri. partecipanti: [{ id, nome, intestatario, aMano: numero|'' }]
// Restituisce { righe:[{...p, tipo, numeri}], errore }  — esportata per i test
export function distribuisci(partecipanti, seedText) {
  const rnd = generatore(seedText)
  const P = partecipanti || []
  if (P.length < 2) return { righe: [], errore: 'Servono almeno 2 conti' }
  const sest = P.filter(soloSestine)
  if (sest.length > 6) return { righe: [], errore: 'Al massimo 6 conti "solo sestine" (Lottomatica/GoldBet): non ci sono più sestine separate' }
  const occupati = new Set(), out = new Map()
  // 1. sestine vere, senza sovrapporsi
  // ricerca con ritorno indietro: trova sempre sestine separate se esistono (fino a 6)
  const scelte = []
  const cerca = (k, pool) => {
    if (k === 0) return true
    for (const s of pool) {
      if (s.some(n => scelte.some(x => x.includes(n)))) continue
      scelte.push(s)
      if (cerca(k - 1, pool)) return true
      scelte.pop()
    }
    return false
  }
  if (sest.length && !cerca(sest.length, mescola(SESTINE, rnd))) return { righe: [], errore: 'Troppe sestine: non riesco a darle tutte senza sovrapposizioni, togli un conto Lottomatica/GoldBet' }
  sest.forEach((p, i) => { scelte[i].forEach(n => occupati.add(n)); out.set(p.id, { tipo: 'Sestina', numeri: [...scelte[i]] }) })
  // 2. numeri a mano, poi 3. il resto diviso tra gli altri
  const liberi = mescola([...Array(37).keys()].filter(n => !occupati.has(n)), rnd)
  const normali = P.filter(p => !soloSestine(p))
  const fissi = normali.filter(p => Number(p.aMano) > 0), automatici = normali.filter(p => !(Number(p.aMano) > 0))
  const sommaFissi = fissi.reduce((a, p) => a + Number(p.aMano), 0)
  if (sommaFissi > liberi.length) return { righe: [], errore: `Hai assegnato a mano ${sommaFissi} numeri, ma ne restano solo ${liberi.length}` }
  if (!normali.length) return { righe: [], errore: 'Serve almeno un conto che non sia Lottomatica/GoldBet: le sestine non coprono lo 0 e i numeri rimasti' }
  if (!automatici.length && sommaFissi < liberi.length) return { righe: [], errore: `Restano ${liberi.length - sommaFissi} numeri scoperti: lascia vuoto "a mano" per almeno un conto` }
  let pos = 0
  for (const p of fissi) { out.set(p.id, { tipo: 'Numeri', numeri: liberi.slice(pos, pos + Number(p.aMano)).sort((a, b) => a - b) }); pos += Number(p.aMano) }
  const resto = liberi.length - pos
  automatici.forEach((p, i) => {
    const quanti = Math.floor(resto / automatici.length) + (i < resto % automatici.length ? 1 : 0)
    out.set(p.id, { tipo: 'Numeri', numeri: liberi.slice(pos, pos + quanti).sort((a, b) => a - b) }); pos += quanti
  })
  const righe = P.map(p => ({ ...p, ...out.get(p.id) }))
  const coperti = new Set(righe.flatMap(r => r.numeri || []))
  if (coperti.size !== 37 || righe.reduce((a, r) => a + (r.numeri?.length || 0), 0) !== 37) return { righe, errore: 'Copertura non valida' }
  const vuoti = righe.filter(r => !r.numeri?.length)
  if (vuoti.length) return { righe, errore: `${vuoti.map(r => r.intestatario).join(', ')} resterebbe senza numeri: troppi conti per i numeri liberi` }
  return { righe, errore: '' }
}

const oggiIso = () => new Date().toLocaleDateString('sv-SE')
const euro = (n) => (Number(n) || 0).toLocaleString('it-IT', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + ' €'

export default function SessioneLivePanel({ books, contoUsabile, apriContiSuTelefoni, onMessage, onError, contiIniziali, origine = 'libera', gruppo = null, onSalvata }) {
  // contiIniziali: i conti di una profilazione mirata, già pronti (origine 'mirata', gruppo = nome del gruppo)
  const [sessioni, setSessioni] = useState([])
  const [cerca, setCerca] = useState('')
  const [scelti, setScelti] = useState(() => (contiIniziali || []).map(b => ({ id: b.id, nome: b.nome, intestatario: b.intestatario, aMano: '' }))) // [{ id, nome, intestatario, aMano }]
  const [stake, setStake] = useState(10)
  const [giri, setGiri] = useState(3)
  const [mescolata, setMescolata] = useState(0)
  const msg = onMessage || (() => {}), err = onError || ((e) => console.error(e))

  const carica = useCallback(async () => {
    const { data, error } = await supabase.from('live_sessioni').select('*').eq('giorno', oggiIso()).order('numero', { ascending: true })
    if (error) return err('Sessioni live: lancia live_sessioni.sql (' + error.message + ')')
    setSessioni(data || [])
  }, [])
  useEffect(() => { carica() }, [carica])

  // chi ha già giocato oggi, e in quale sessione
  const giocatoOggi = useMemo(() => {
    const m = new Map()
    for (const s of sessioni) for (const p of s.partecipanti || []) if (!m.has(String(p.id))) m.set(String(p.id), s.numero)
    return m
  }, [sessioni])

  const candidati = useMemo(() => {
    const q = cerca.trim().toLowerCase()
    return (books || []).filter(b => (contoUsabile ? contoUsabile(b) : true))
      .filter(b => !q || `${b.nome} ${b.intestatario}`.toLowerCase().includes(q))
      .filter(b => !scelti.some(s => String(s.id) === String(b.id)))
      .sort((a, b) => Number(giocatoOggi.has(String(a.id))) - Number(giocatoOggi.has(String(b.id))) || String(a.nome).localeCompare(String(b.nome)) || String(a.intestatario).localeCompare(String(b.intestatario)))
      .slice(0, 40)
  }, [books, contoUsabile, cerca, scelti, giocatoOggi])

  const numeroSessione = (sessioni.reduce((a, s) => Math.max(a, Number(s.numero) || 0), 0)) + 1
  const seedText = `${oggiIso()}|sessione${numeroSessione}|${mescolata}|${scelti.map(s => s.id).join(',')}`
  const { righe, errore } = useMemo(() => scelti.length ? distribuisci(scelti, seedText) : { righe: [], errore: '' }, [scelti, seedText])
  const aGiro = (r) => (r.numeri?.length || 0) * Number(stake || 0)
  const totaleGiro = righe.reduce((a, r) => a + aGiro(r), 0)

  const aggiungi = (b) => setScelti(v => [...v, { id: b.id, nome: b.nome, intestatario: b.intestatario, aMano: '' }])
  const togli = (id) => setScelti(v => v.filter(s => s.id !== id))
  const setAMano = (id, val) => setScelti(v => v.map(s => s.id === id ? { ...s, aMano: val.replace(/[^0-9]/g, '') } : s))

  async function conferma() {
    if (errore || righe.length < 2) return
    const fatti = window.prompt(`Sessione ${numeroSessione}: quanti giri avete giocato davvero?`, String(giri))
    if (fatti === null) return
    const n = Math.max(0, parseInt(fatti, 10) || 0)
    const { error } = await supabase.from('live_sessioni').insert([{
      giorno: oggiIso(), numero: numeroSessione, seed: seedText, stake: Number(stake), giri: Number(giri), giri_fatti: n, origine, gruppo,
      partecipanti: righe.map(r => ({ id: r.id, nome: r.nome, intestatario: r.intestatario, tipo: r.tipo, numeri: r.numeri })),
    }])
    if (error) return err(error.message)
    msg(`🎰 Sessione ${numeroSessione} salvata: ${righe.length} conti, ${n} giri`)
    if (onSalvata) { onSalvata(); return }
    setScelti([]); setMescolata(0); carica()
  }

  const box = { background: 'rgba(15,23,42,0.6)', border: '1px solid rgba(148,163,184,0.25)', borderRadius: 12, padding: '10px 12px', marginBottom: 10 }
  const inp = { background: '#0b1220', color: '#f8fafc', border: '1px solid #334155', borderRadius: 8, padding: '5px 8px', fontSize: 12 }
  const btn = (bg, on = true) => ({ background: on ? bg : '#334155', color: 'white', border: 0, borderRadius: 8, padding: '5px 10px', fontWeight: 800, fontSize: 12, cursor: on ? 'pointer' : 'default' })
  const th = { textAlign: 'left', padding: '5px 8px', color: '#94a3b8', fontSize: 11, borderBottom: '1px solid #334155' }
  const td = { padding: '5px 8px', fontSize: 12, color: '#e2e8f0', borderBottom: '1px solid rgba(51,65,85,.5)' }

  return (
    <div style={{ background: 'rgba(124,58,237,0.07)', border: '1px solid rgba(124,58,237,0.35)', borderRadius: 16, padding: '14px 16px' }}>
      {sessioni.length > 0 && (
        <div style={{ ...box, fontSize: 12, color: '#cbd5e1' }}>
          <b>Oggi:</b> {sessioni.map(s => `sessione ${s.numero} · ${(s.partecipanti || []).length} conti · ${s.giri_fatti} giri`).join('  |  ')}
        </div>
      )}

      <div style={box}>
        <div style={{ fontWeight: 800, color: '#c4b5fd', marginBottom: 6 }}>Sessione {numeroSessione}{gruppo ? ` · ${gruppo}` : ''} · {contiIniziali ? 'aggiungi altri conti se servono' : 'scegli i conti'}</div>
        <input style={{ ...inp, width: 260 }} placeholder="Cerca book o intestatario…" value={cerca} onChange={e => setCerca(e.target.value)} />
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginTop: 8 }}>
          {candidati.map(b => {
            const gia = giocatoOggi.get(String(b.id))
            return (
              <button key={b.id} onClick={() => aggiungi(b)} title={gia ? `Ha già giocato oggi nella sessione ${gia}` : 'Aggiungi alla sessione'}
                style={{ ...inp, cursor: 'pointer', opacity: gia ? 0.55 : 1, borderColor: soloSestine(b) ? '#a78bfa' : '#334155' }}>
                + {b.nome} · {b.intestatario || '—'}{soloSestine(b) ? ' (sestina)' : ''}{gia ? ` · già S${gia}` : ''}
              </button>)
          })}
        </div>
      </div>

      {scelti.length > 0 && (
        <div style={box}>
          <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'center', marginBottom: 8, fontSize: 12, color: '#cbd5e1' }}>
            <span>€ a numero <input style={{ ...inp, width: 60 }} value={stake} onChange={e => setStake(e.target.value.replace(/[^0-9.,]/g, '').replace(',', '.'))} /></span>
            <span>giri <input style={{ ...inp, width: 50 }} value={giri} onChange={e => setGiri(e.target.value.replace(/[^0-9]/g, ''))} /></span>
            <button onClick={() => setMescolata(m => m + 1)} style={btn('#6d28d9')}>🔀 Rimescola numeri</button>
            <button onClick={() => apriContiSuTelefoni(scelti.map(s => (books || []).find(b => String(b.id) === String(s.id)) || s), `la sessione live ${numeroSessione}`)} style={btn('#0ea5e9')}>📱 Apri tutti ({scelti.length})</button>
          </div>
          {errore && <div style={{ color: '#fca5a5', fontSize: 12, marginBottom: 6 }}>⚠️ {errore}</div>}
          <table style={{ borderCollapse: 'collapse', width: '100%' }}>
            <thead><tr><th style={th}>Book</th><th style={th}>Intestatario</th><th style={th}>A mano</th><th style={th}>Tipo</th><th style={th}>Numeri</th><th style={th}>A giro</th><th style={th}>Totale</th><th style={th}></th></tr></thead>
            <tbody>
              {scelti.map(s => {
                const r = righe.find(x => x.id === s.id) || {}
                const gia = giocatoOggi.get(String(s.id))
                return (
                  <tr key={s.id}>
                    <td style={{ ...td, fontWeight: 800 }}>{s.nome}</td>
                    <td style={td}>{s.intestatario}{gia ? <span style={{ color: '#fbbf24', fontSize: 10 }}> · già sessione {gia}</span> : null}</td>
                    <td style={td}>{soloSestine(s) ? <span style={{ color: '#94a3b8' }}>6 (sestina)</span> : <input style={{ ...inp, width: 46 }} placeholder="auto" value={s.aMano} onChange={e => setAMano(s.id, e.target.value)} />}</td>
                    <td style={td}>{r.tipo || ''}</td>
                    <td style={{ ...td, fontWeight: 800 }}>{(r.numeri || []).join(', ')}</td>
                    <td style={td}>{r.numeri ? euro(aGiro(r)) : ''}</td>
                    <td style={td}>{r.numeri ? euro(aGiro(r) * Number(giri || 0)) : ''}</td>
                    <td style={td}>
                      <button onClick={() => apriContiSuTelefoni([(books || []).find(b => String(b.id) === String(s.id)) || s], `${s.nome} di ${s.intestatario}`)} style={btn('#0ea5e9')}>📱</button>
                      <button onClick={() => togli(s.id)} style={{ ...btn('#64748b'), marginLeft: 4 }}>✕</button>
                    </td>
                  </tr>)
              })}
            </tbody>
          </table>
          {!errore && righe.length >= 2 && (
            <div style={{ marginTop: 8, fontSize: 12, color: '#cbd5e1' }}>
              ✅ Tutti i 37 numeri coperti · puntati {euro(totaleGiro)} a giro, rientro {euro(totaleGiro * 36 / 37)} qualunque numero esca · costo teorico <b>{euro(totaleGiro / 37)}</b> a giro, <b>{euro(totaleGiro / 37 * Number(giri || 0))}</b> su {giri} giri
              <button onClick={conferma} style={{ ...btn('#059669'), marginLeft: 10 }}>✓ Sessione giocata</button>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
