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
// Costo teorico roulette: 1/37 del giocato a ogni giro.
// 02/10/2026: € a numero per OGNI conto; BACCARAT (Banco/Giocatore, operazione spot o campionato).
// Tabella: live_sessioni (vedi live_sessioni.sql).
// 05/10/2026: tra i conti da aggiungere compaiono solo quelli già profilati (livello assegnato, non dormienti).
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
  const [scelti, setScelti] = useState(() => (contiIniziali || []).map(b => ({ id: b.id, nome: b.nome, intestatario: b.intestatario, aMano: '', euroNum: '', lato: null, importo: '' }))) // [{ id, nome, intestatario, aMano }]
  const [stake, setStake] = useState(10)
  const [giri, setGiri] = useState(3)
  const [mescolata, setMescolata] = useState(0)
  const [gioco, setGioco] = useState('roulette')        // 'roulette' | 'baccarat'
  const [operazione, setOperazione] = useState('spot')  // baccarat: 'spot' | 'campionato'
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
      // 05/10/2026: solo conti GIÀ PROFILATI (livello assegnato e non dormienti). I conti nuovi, senza livello,
      // compaiono qui solo dopo averli classificati in Profilazione.
      .filter(b => b.profilo_livello && b.profilo_livello !== 'dormiente')
      .filter(b => !q || `${b.nome} ${b.intestatario}`.toLowerCase().includes(q))
      .filter(b => !scelti.some(s => String(s.id) === String(b.id)))
      .sort((a, b) => Number(giocatoOggi.has(String(a.id))) - Number(giocatoOggi.has(String(b.id))) || String(a.nome).localeCompare(String(b.nome)) || String(a.intestatario).localeCompare(String(b.intestatario)))
      .slice(0, 40)
  }, [books, contoUsabile, cerca, scelti, giocatoOggi])

  const numeroSessione = (sessioni.reduce((a, s) => Math.max(a, Number(s.numero) || 0), 0)) + 1
  const seedText = `${oggiIso()}|sessione${numeroSessione}|${mescolata}|${scelti.map(s => s.id).join(',')}`
  const roulette = gioco === 'roulette'

  // ── ROULETTE: numeri distribuiti, € a numero anche diverso per ogni conto
  const { righe, errore: erroreR } = useMemo(() => roulette && scelti.length ? distribuisci(scelti, seedText) : { righe: [], errore: '' }, [roulette, scelti, seedText])
  const euroNumero = (x) => Number(x?.euroNum || stake || 0)
  const aGiro = (r) => (r.numeri?.length || 0) * euroNumero(r)
  const totaleGiro = righe.reduce((a, r) => a + aGiro(r), 0)
  const rientri = righe.flatMap(r => (r.numeri || []).map(() => 36 * euroNumero(r)))
  const rientroMin = rientri.length ? Math.min(...rientri) : 0, rientroMax = rientri.length ? Math.max(...rientri) : 0

  // ── BACCARAT: ogni conto su Banco o Giocatore (alternati se non scegli), importo a mano
  const latoDi = (x, i) => x.lato || (i % 2 === 0 ? 'Banco' : 'Giocatore')
  const importoDi = (x) => Number(x.importo || stake || 0)
  const bac = scelti.map((x, i) => ({ ...x, tipo: latoDi(x, i), puntata: importoDi(x) }))
  const B = bac.filter(x => x.tipo === 'Banco').reduce((a, x) => a + x.puntata, 0)
  const P = bac.filter(x => x.tipo === 'Giocatore').reduce((a, x) => a + x.puntata, 0)
  const vinceBanco = 0.95 * B - P, vinceGiocatore = P - B
  const costoMano = -(0.4586 * vinceBanco + 0.4462 * vinceGiocatore) // pareggio: puntate restituite
  const erroreB = scelti.length < 2 ? 'Servono almeno 2 conti' : (!B || !P) ? `Manca il lato ${!B ? 'Banco' : 'Giocatore'}: nessuna copertura` : ''

  const errore = roulette ? erroreR : erroreB
  const pronta = roulette ? (!errore && righe.length >= 2) : !errore

  const aggiungi = (b) => setScelti(v => [...v, { id: b.id, nome: b.nome, intestatario: b.intestatario, aMano: '', euroNum: '', lato: null, importo: '' }])
  const togli = (id) => setScelti(v => v.filter(s => s.id !== id))
  const cambia = (id, campo, val) => setScelti(v => v.map(s => s.id === id ? { ...s, [campo]: val } : s))
  const soloNum = (t) => t.replace(/[^0-9]/g, '')
  const soloEuro = (t) => t.replace(/[^0-9.,]/g, '').replace(',', '.')

  async function conferma() {
    if (!pronta) return
    const parola = roulette ? 'giri' : 'mani'
    const fatti = window.prompt(`Sessione ${numeroSessione}: quante ${parola === 'giri' ? 'volte (giri)' : 'mani'} avete giocato davvero?`, String(giri))
    if (fatti === null) return
    const n = Math.max(0, parseInt(fatti, 10) || 0)
    const partecipanti = roulette
      ? righe.map(r => ({ id: r.id, nome: r.nome, intestatario: r.intestatario, tipo: r.tipo, numeri: r.numeri, stake: euroNumero(r) }))
      : bac.map(x => ({ id: x.id, nome: x.nome, intestatario: x.intestatario, tipo: x.tipo, importo: x.puntata }))
    const { error } = await supabase.from('live_sessioni').insert([{
      giorno: oggiIso(), numero: numeroSessione, seed: seedText, stake: Number(stake), giri: Number(giri), giri_fatti: n, origine, gruppo,
      gioco, operazione: roulette ? null : operazione, partecipanti,
    }])
    if (error) return err(error.message + ' (hai lanciato sessioni_live_baccarat.sql?)')
    msg(`🎰 Sessione ${numeroSessione} salvata: ${roulette ? 'roulette' : `baccarat ${operazione}`}, ${partecipanti.length} conti, ${n} ${parola}`)
    if (onSalvata) { onSalvata(); return }
    setScelti([]); setMescolata(0); carica()
  }

  const box = { background: 'rgba(15,23,42,0.6)', border: '1px solid rgba(148,163,184,0.25)', borderRadius: 12, padding: '10px 12px', marginBottom: 10 }
  const inp = { background: '#0b1220', color: '#f8fafc', border: '1px solid #334155', borderRadius: 8, padding: '5px 8px', fontSize: 12 }
  const btn = (bg, on = true) => ({ background: on ? bg : '#334155', color: 'white', border: 0, borderRadius: 8, padding: '5px 10px', fontWeight: 800, fontSize: 12, cursor: on ? 'pointer' : 'default' })
  const scelta = (on) => ({ ...btn(on ? '#7c3aed' : '#1e293b'), border: `1px solid ${on ? '#a78bfa' : '#334155'}` })
  const th = { textAlign: 'left', padding: '5px 8px', color: '#94a3b8', fontSize: 11, borderBottom: '1px solid #334155' }
  const td = { padding: '5px 8px', fontSize: 12, color: '#e2e8f0', borderBottom: '1px solid rgba(51,65,85,.5)' }
  const segno = (x) => `${x >= 0 ? '+' : ''}${euro(x)}`

  return (
    <div style={{ background: 'rgba(124,58,237,0.07)', border: '1px solid rgba(124,58,237,0.35)', borderRadius: 16, padding: '14px 16px' }}>
      {sessioni.length > 0 && (
        <div style={{ ...box, fontSize: 12, color: '#cbd5e1' }}>
          <b>Oggi:</b> {sessioni.map(s => `sessione ${s.numero} · ${s.gioco === 'baccarat' ? `baccarat ${s.operazione || ''}` : 'roulette'} · ${(s.partecipanti || []).length} conti · ${s.giri_fatti} ${s.gioco === 'baccarat' ? 'mani' : 'giri'}`).join('  |  ')}
        </div>
      )}

      <div style={box}>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center', marginBottom: 8 }}>
          <b style={{ color: '#c4b5fd' }}>Sessione {numeroSessione}{gruppo ? ` · ${gruppo}` : ''}</b>
          <button onClick={() => setGioco('roulette')} style={scelta(roulette)}>🎡 Roulette</button>
          <button onClick={() => setGioco('baccarat')} style={scelta(!roulette)}>🃏 Baccarat</button>
          {!roulette && <>
            <span style={{ color: '#94a3b8', fontSize: 12, marginLeft: 6 }}>operazione:</span>
            <button onClick={() => setOperazione('spot')} style={scelta(operazione === 'spot')}>Spot</button>
            <button onClick={() => setOperazione('campionato')} style={scelta(operazione === 'campionato')}>Campionato</button>
          </>}
        </div>
        <div style={{ fontSize: 12, color: '#94a3b8', marginBottom: 6 }}>{contiIniziali ? 'Aggiungi altri conti se servono:' : 'Scegli i conti:'}</div>
        <input style={{ ...inp, width: 260 }} placeholder="Cerca book o intestatario…" value={cerca} onChange={e => setCerca(e.target.value)} />
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginTop: 8 }}>
          {candidati.map(b => {
            const gia = giocatoOggi.get(String(b.id))
            return (
              <button key={b.id} onClick={() => aggiungi(b)} title={gia ? `Ha già giocato oggi nella sessione ${gia}` : 'Aggiungi alla sessione'}
                style={{ ...inp, cursor: 'pointer', opacity: gia ? 0.55 : 1, borderColor: roulette && soloSestine(b) ? '#a78bfa' : '#334155' }}>
                + {b.nome} · {b.intestatario || '—'}{roulette && soloSestine(b) ? ' (sestina)' : ''}{gia ? ` · già S${gia}` : ''}
              </button>)
          })}
        </div>
      </div>

      {scelti.length > 0 && (
        <div style={box}>
          <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'center', marginBottom: 8, fontSize: 12, color: '#cbd5e1' }}>
            <span>{roulette ? '€ a numero (per tutti)' : '€ a mano (per tutti)'} <input style={{ ...inp, width: 60 }} value={stake} onChange={e => setStake(soloEuro(e.target.value))} /></span>
            <span>{roulette ? 'giri' : 'mani'} <input style={{ ...inp, width: 50 }} value={giri} onChange={e => setGiri(soloNum(e.target.value))} /></span>
            {roulette && <button onClick={() => setMescolata(m => m + 1)} style={btn('#6d28d9')}>🔀 Rimescola numeri</button>}
            <button onClick={() => apriContiSuTelefoni(scelti.map(s => (books || []).find(b => String(b.id) === String(s.id)) || s), `la sessione live ${numeroSessione}`)} style={btn('#0ea5e9')}>📱 Apri tutti ({scelti.length})</button>
          </div>
          {errore && <div style={{ color: '#fca5a5', fontSize: 12, marginBottom: 6 }}>⚠️ {errore}</div>}

          {roulette ? (
            <table style={{ borderCollapse: 'collapse', width: '100%' }}>
              <thead><tr><th style={th}>Book</th><th style={th}>Intestatario</th><th style={th}>Quanti numeri</th><th style={th}>€ a numero</th><th style={th}>Tipo</th><th style={th}>Numeri</th><th style={th}>A giro</th><th style={th}>Totale</th><th style={th}></th></tr></thead>
              <tbody>
                {scelti.map(s => {
                  const r = righe.find(x => x.id === s.id) || {}
                  const gia = giocatoOggi.get(String(s.id))
                  return (
                    <tr key={s.id}>
                      <td style={{ ...td, fontWeight: 800 }}>{s.nome}</td>
                      <td style={td}>{s.intestatario}{gia ? <span style={{ color: '#fbbf24', fontSize: 10 }}> · già sessione {gia}</span> : null}</td>
                      <td style={td}>{soloSestine(s) ? <span style={{ color: '#94a3b8' }}>6 (sestina)</span> : <input style={{ ...inp, width: 46 }} placeholder="auto" value={s.aMano} onChange={e => cambia(s.id, 'aMano', soloNum(e.target.value))} />}</td>
                      <td style={td}><input style={{ ...inp, width: 52 }} placeholder={String(stake)} value={s.euroNum} onChange={e => cambia(s.id, 'euroNum', soloEuro(e.target.value))} /></td>
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
          ) : (
            <table style={{ borderCollapse: 'collapse', width: '100%' }}>
              <thead><tr><th style={th}>Book</th><th style={th}>Intestatario</th><th style={th}>Lato</th><th style={th}>€ a mano</th><th style={th}>Totale</th><th style={th}></th></tr></thead>
              <tbody>
                {bac.map((x) => (
                  <tr key={x.id}>
                    <td style={{ ...td, fontWeight: 800 }}>{x.nome}</td>
                    <td style={td}>{x.intestatario}</td>
                    <td style={td}>
                      <button onClick={() => cambia(x.id, 'lato', 'Banco')} style={scelta(x.tipo === 'Banco')}>Banco</button>
                      <button onClick={() => cambia(x.id, 'lato', 'Giocatore')} style={{ ...scelta(x.tipo === 'Giocatore'), marginLeft: 4 }}>Giocatore</button>
                    </td>
                    <td style={td}><input style={{ ...inp, width: 56 }} placeholder={String(stake)} value={x.importo} onChange={e => cambia(x.id, 'importo', soloEuro(e.target.value))} /></td>
                    <td style={td}>{euro(x.puntata * Number(giri || 0))}</td>
                    <td style={td}>
                      <button onClick={() => apriContiSuTelefoni([(books || []).find(b => String(b.id) === String(x.id)) || x], `${x.nome} di ${x.intestatario}`)} style={btn('#0ea5e9')}>📱</button>
                      <button onClick={() => togli(x.id)} style={{ ...btn('#64748b'), marginLeft: 4 }}>✕</button>
                    </td>
                  </tr>))}
              </tbody>
            </table>
          )}

          {pronta && (
            <div style={{ marginTop: 8, fontSize: 12, color: '#cbd5e1' }}>
              {roulette ? (
                rientroMin === rientroMax
                  ? <>✅ Tutti i 37 numeri coperti · puntati {euro(totaleGiro)} a giro, rientro {euro(rientroMin)} qualunque numero esca · costo teorico <b>{euro(totaleGiro / 37)}</b> a giro, <b>{euro(totaleGiro / 37 * Number(giri || 0))}</b> su {giri} giri</>
                  : <>✅ Tutti i 37 numeri coperti · puntati {euro(totaleGiro)} a giro · rientro da {euro(rientroMin)} a {euro(rientroMax)} a seconda del numero (risultato da {segno(rientroMin - totaleGiro)} a {segno(rientroMax - totaleGiro)}) · costo teorico medio <b>{euro(totaleGiro / 37)}</b> a giro, <b>{euro(totaleGiro / 37 * Number(giri || 0))}</b> su {giri} giri</>
              ) : (
                <>🃏 Baccarat {operazione} · Banco {euro(B)} · Giocatore {euro(P)} a mano · se vince il Banco {segno(vinceBanco)} · se vince il Giocatore {segno(vinceGiocatore)} · pareggio 0 (puntate restituite) · costo medio <b>{euro(costoMano)}</b> a mano, <b>{euro(costoMano * Number(giri || 0))}</b> su {giri} mani</>
              )}
              <button onClick={conferma} style={{ ...btn('#059669'), marginLeft: 10 }}>✓ Sessione giocata</button>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
