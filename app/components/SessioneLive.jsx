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
import { turniCampionato, risultatiCampionato, totaliTurno } from '../../lib/campionatoBaccarat'   // 14/10/2026: campionato a eliminazione

export const SESTINE = [[1,2,3,4,5,6],[4,5,6,7,8,9],[7,8,9,10,11,12],[10,11,12,13,14,15],[13,14,15,16,17,18],[16,17,18,19,20,21],[19,20,21,22,23,24],[22,23,24,25,26,27],[25,26,27,28,29,30],[28,29,30,31,32,33],[31,32,33,34,35,36]]
export const soloSestine = (b) => /lottomatica|goldbet/i.test(String(b?.nome || ''))

function generatore(seedText) {
  let s = 2166136261
  for (const ch of String(seedText)) { s ^= ch.charCodeAt(0); s = Math.imul(s, 16777619) }
  return () => { s += 0x6D2B79F5; let t = s; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296 }
}
function mescola(arr, rnd) { const a = [...arr]; for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(rnd() * (i + 1)); [a[i], a[j]] = [a[j], a[i]] } return a }

const haMano = (p) => String(p?.aMano ?? '').trim() !== '' && Number.isFinite(Number(p.aMano))

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
  // 23/10/2026: campo vuoto = automatico; qualunque numero scritto, ANCHE 0, è un'assegnazione a mano (0 = quel conto in questo giro non copre nessun numero)
  const fissi = normali.filter(haMano), automatici = normali.filter(p => !haMano(p))
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
  const vuoti = righe.filter(r => !r.numeri?.length && !haMano(r))   // 0 scritto a mano = voluto, non è un errore
  if (vuoti.length) return { righe, errore: `${vuoti.map(r => r.intestatario).join(', ')} resterebbe senza numeri: troppi conti per i numeri liberi` }
  return { righe, errore: '' }
}

// 14/10/2026: i conti si presentano in ordine alfabetico partendo dal nome (gli intestatari sono scritti «Nome Cognome»)
const perNome = (a, b) => String(a.intestatario || '').localeCompare(String(b.intestatario || ''), 'it', { sensitivity: 'base' }) || String(a.nome || '').localeCompare(String(b.nome || ''), 'it', { sensitivity: 'base' })
const oggiIso = () => new Date().toLocaleDateString('sv-SE')
const euro = (n) => (Number(n) || 0).toLocaleString('it-IT', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + ' €'

export default function SessioneLivePanel({ books, contoUsabile, apriContiSuTelefoni, onMessage, onError, contiIniziali, origine = 'libera', gruppo = null, onSalvata }) {
  // contiIniziali: i conti di una profilazione mirata, già pronti (origine 'mirata', gruppo = nome del gruppo)
  const [sessioni, setSessioni] = useState([])
  const [cerca, setCerca] = useState('')
  const [scelti, setScelti] = useState(() => (contiIniziali || []).map(b => ({ id: b.id, nome: b.nome, intestatario: b.intestatario, aMano: '', euroNum: '', lato: null, importo: '' })).sort(perNome)) // [{ id, nome, intestatario, aMano }]
  const [stake, setStake] = useState(10)
  const [giri, setGiri] = useState(3)
  const [mescolata, setMescolata] = useState(0)
  const [gioco, setGioco] = useState('roulette')        // 'roulette' | 'baccarat'
  const [operazione, setOperazione] = useState('spot')  // baccarat: 'spot' | 'campionato'
  const [esitiCamp, setEsitiCamp] = useState({})   // campionato: { 'turno:id': 'V' | 'P' } chi ha vinto / perso in ogni turno
  const [latiCamp, setLatiCamp] = useState({})     // campionato: lati cambiati a mano dal turno 2 in poi
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
      .sort((a, b) => Number(giocatoOggi.has(String(a.id))) - Number(giocatoOggi.has(String(b.id))) || perNome(a, b))
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

  // ── CAMPIONATO a eliminazione: i vincitori raddoppiano e si rimettono metà Banco e metà Giocatore, fino a un vincitore
  const campionato = !roulette && operazione === 'campionato'
  const turni = campionato ? turniCampionato(bac, esitiCamp, latiCamp) : []
  const { per: perConto, finito: campFinito, campioneId } = campionato ? risultatiCampionato(turni) : { per: new Map(), finito: false, campioneId: null }
  const avvisoCamp = campionato && scelti.length >= 2 && ![2, 4, 8, 16].includes(scelti.length) ? `Il campionato funziona con 2, 4, 8 o 16 conti (ora ${scelti.length}): con altri numeri qualcuno resta senza avversario` : ''

  const errore = roulette ? erroreR : erroreB
  const pronta = roulette ? (!errore && righe.length >= 2) : !errore

  const aggiungi = (b) => { setEsitiCamp({}); setLatiCamp({}); setScelti(v => [...v, { id: b.id, nome: b.nome, intestatario: b.intestatario, aMano: '', euroNum: '', lato: null, importo: '' }].sort(perNome)) }
  const togli = (id) => { setEsitiCamp({}); setLatiCamp({}); setScelti(v => v.filter(s => s.id !== id)) }
  const cambia = (id, campo, val) => { if (campo === 'lato' || campo === 'importo') { setEsitiCamp({}); setLatiCamp({}) }; setScelti(v => v.map(s => s.id === id ? { ...s, [campo]: val } : s)) }
  // campionato: segna un conto vincente (V) o perdente (P) nel turno k; i turni dopo si ricalcolano
  const tieniFinoA = (e, k) => Object.fromEntries(Object.entries(e).filter(([chiave]) => Number(chiave.split(':')[0]) <= k))
  const segnaConto = (k, id, v) => setEsitiCamp(e => { const n = tieniFinoA(e, k); if (v) n[`${k}:${id}`] = v; else delete n[`${k}:${id}`]; return n })
  // tutta la mano in un colpo: vince il Banco, vince il Giocatore, oppure pareggio (puntate restituite: si rigioca)
  const segnaTurno = (k, vince) => setEsitiCamp(e => {
    const n = tieniFinoA(e, k)
    for (const c of turni[k] || []) { if (vince) n[`${k}:${c.id}`] = c.lato === vince ? 'V' : 'P'; else delete n[`${k}:${c.id}`] }
    return n
  })
  // turno 1 in un colpo: i primi N/2 della lista su un lato e gli altri sull'altro (o alternati)
  const impostaLatiTurno1 = (modo) => { setEsitiCamp({}); setLatiCamp({}); setScelti(v => { const meta = Math.floor(v.length / 2); return v.map((x, i) => ({ ...x, lato: modo === 'alternati' ? (i % 2 === 0 ? 'Banco' : 'Giocatore') : (modo === 'primiGiocatore' ? (i < meta ? 'Giocatore' : 'Banco') : (i < meta ? 'Banco' : 'Giocatore')) })) }) }
  const cambiaLatoCamp = (k, id, lato) => { setLatiCamp(l => ({ ...l, [`${k}:${id}`]: lato })); setEsitiCamp(e => { const n = tieniFinoA(e, k); for (const c of turni[k] || []) delete n[`${k}:${c.id}`]; return n }) }
  const soloNum = (t) => t.replace(/[^0-9]/g, '')
  const soloEuro = (t) => t.replace(/[^0-9.,]/g, '').replace(',', '.')

  async function conferma() {
    if (!pronta) return
    const parola = roulette ? 'giri' : 'mani'
    if (campionato && !campFinito) return err('Campionato: segna prima chi vince e chi perde in ogni turno, fino al vincitore')
    let n
    if (campionato) n = turni.length   // le mani giocate sono i turni del campionato
    else {
      const fatti = window.prompt(`Sessione ${numeroSessione}: quante ${parola === 'giri' ? 'volte (giri)' : 'mani'} avete giocato davvero?`, String(giri))
      if (fatti === null) return
      n = Math.max(0, parseInt(fatti, 10) || 0)
    }
    const partecipanti = roulette
      ? righe.map(r => ({ id: r.id, nome: r.nome, intestatario: r.intestatario, tipo: r.tipo, numeri: r.numeri, stake: euroNumero(r) }))
      : campionato
        ? bac.map(x => { const r = perConto.get(x.id) || {}; return { id: x.id, nome: x.nome, intestatario: x.intestatario, tipo: x.tipo, importo: x.puntata, campionato: true, puntato_totale: r.puntato ?? 0, risultato: r.risultato ?? 0, esito: r.campione ? 'vincitore' : 'eliminato', turno_uscita: r.uscita ?? null } })
        : bac.map(x => ({ id: x.id, nome: x.nome, intestatario: x.intestatario, tipo: x.tipo, importo: x.puntata }))
    const { error } = await supabase.from('live_sessioni').insert([{
      giorno: oggiIso(), numero: numeroSessione, seed: seedText, stake: Number(stake), giri: Number(giri), giri_fatti: n, origine, gruppo,
      gioco, operazione: roulette ? null : operazione, partecipanti,
    }])
    if (error) return err(error.message + ' (hai lanciato sessioni_live_baccarat.sql?)')
    msg(`🎰 Sessione ${numeroSessione} salvata: ${roulette ? 'roulette' : `baccarat ${operazione}`}, ${partecipanti.length} conti, ${n} ${parola}`)
    if (onSalvata) { onSalvata(); return }
    setScelti([]); setMescolata(0); setEsitiCamp({}); setLatiCamp({}); carica()
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
            <button onClick={() => { setOperazione('campionato'); setStake('100') }} style={scelta(operazione === 'campionato')}>Campionato</button>
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
            {!campionato && <span>{roulette ? 'giri' : 'mani'} <input style={{ ...inp, width: 50 }} value={giri} onChange={e => setGiri(soloNum(e.target.value))} /></span>}
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
                      <td style={{ ...td, fontWeight: 800 }}>{(r.numeri || []).join(', ') || (r.numeri ? <span style={{ color: '#94a3b8', fontWeight: 400 }}>nessun numero in questo giro</span> : '')}</td>
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
          ) : campionato ? null : (
            <table style={{ borderCollapse: 'collapse', width: '100%' }}>
              <thead><tr><th style={th}>Book</th><th style={th}>Intestatario</th><th style={th}>Lato</th><th style={th}>€ a mano</th><th style={th}>{campionato ? 'Risultato' : 'Totale'}</th><th style={th}></th></tr></thead>
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
                    <td style={{ ...td, fontWeight: campionato ? 800 : 400 }}>{campionato
                      ? (perConto.get(x.id) ? <span style={{ color: perConto.get(x.id).risultato >= 0 ? '#86efac' : '#fca5a5' }}>{campioneId === x.id ? '🏆 ' : ''}{segno(perConto.get(x.id).risultato)}</span> : '')
                      : euro(x.puntata * Number(giri || 0))}</td>
                    <td style={td}>
                      <button onClick={() => apriContiSuTelefoni([(books || []).find(b => String(b.id) === String(x.id)) || x], `${x.nome} di ${x.intestatario}`)} style={btn('#0ea5e9')}>📱</button>
                      <button onClick={() => togli(x.id)} style={{ ...btn('#64748b'), marginLeft: 4 }}>✕</button>
                    </td>
                  </tr>))}
              </tbody>
            </table>
          )}

          {campionato && !errore && (
            <div style={{ marginTop: 10 }}>
              {avvisoCamp && <div style={{ color: '#fbbf24', fontSize: 12, marginBottom: 6 }}>⚠️ {avvisoCamp}</div>}
              {turni.map((t, k) => {
                const { B: tB, P: tP } = totaliTurno(t)
                const chiuso = t.every(c => c.esito)
                const finale = t.length === 2
                return (
                  <div key={k} style={{ ...box, borderColor: chiuso ? 'rgba(34,197,94,0.4)' : 'rgba(167,139,250,0.6)' }}>
                    <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center', marginBottom: 6, fontSize: 12 }}>
                      <b style={{ color: '#c4b5fd' }}>{finale ? '🏁 Finale' : `Turno ${k + 1}`} · {t.length} conti · Banco {euro(tB)} · Giocatore {euro(tP)}</b>
                      {tB !== tP && <span style={{ color: '#fbbf24' }}>⚠️ Banco e Giocatore non sono uguali: copertura sbilanciata</span>}
                      <span style={{ marginLeft: 'auto', display: 'flex', gap: 6, alignItems: 'center' }}>
                        <span style={{ color: '#94a3b8' }}>ha vinto la mano:</span>
                        <button onClick={() => segnaTurno(k, 'Banco')} style={btn('#4f46e5')}>Banco</button>
                        <button onClick={() => segnaTurno(k, 'Giocatore')} style={btn('#4f46e5')}>Giocatore</button>
                        <button onClick={() => segnaTurno(k, null)} title="Pareggio: puntate restituite, si rigioca" style={btn('#64748b')}>Pareggio / azzera</button>
                      </span>
                    </div>
                    {k === 0 && (
                      <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', alignItems: 'center', marginBottom: 6, fontSize: 12, color: '#94a3b8' }}>
                        Chi ha puntato cosa (nell&apos;ordine della lista):
                        <button onClick={() => impostaLatiTurno1('primiGiocatore')} style={btn('#6d28d9')}>Primi {Math.floor(scelti.length / 2)} Giocatore · altri Banco</button>
                        <button onClick={() => impostaLatiTurno1('primiBanco')} style={btn('#6d28d9')}>Primi {Math.floor(scelti.length / 2)} Banco · altri Giocatore</button>
                        <button onClick={() => impostaLatiTurno1('alternati')} style={btn('#64748b')}>Alternati</button>
                      </div>
                    )}
                    <table style={{ borderCollapse: 'collapse', width: '100%' }}>
                      <tbody>
                        {t.map(c => {
                          const prima = perConto.get(c.id)
                          // saldo prima di questo turno = puntata iniziale + risultato dei turni già chiusi
                          const iniziale = bac.find(x => x.id === c.id)?.puntata || 0
                          const prec = k > 0 ? risultatiCampionato(turni.slice(0, k)).per.get(c.id) : null
                          const saldo = iniziale + (prec?.risultato || 0)
                          const manca = k > 0 ? Math.round((c.importo - saldo) * 100) / 100 : 0
                          return (
                            <tr key={c.id}>
                              <td style={{ ...td, fontWeight: 800 }}>{c.nome}</td>
                              <td style={td}>{c.intestatario}</td>
                              <td style={td}>
                                <button onClick={() => (k === 0 ? cambia(c.id, 'lato', 'Banco') : cambiaLatoCamp(k, c.id, 'Banco'))} style={scelta(c.lato === 'Banco')}>Banco</button>
                                <button onClick={() => (k === 0 ? cambia(c.id, 'lato', 'Giocatore') : cambiaLatoCamp(k, c.id, 'Giocatore'))} style={{ ...scelta(c.lato === 'Giocatore'), marginLeft: 4 }}>Giocatore</button>
                              </td>
                              <td style={td}>{k === 0 ? <input style={{ ...inp, width: 56 }} placeholder={String(stake)} value={scelti.find(x => x.id === c.id)?.importo ?? ''} onChange={e => cambia(c.id, 'importo', soloEuro(e.target.value))} /> : null}{k === 0 ? <span style={{ color: '#94a3b8' }}> {euro(c.importo)}</span> : euro(c.importo)}{manca > 0.004 ? <span style={{ color: '#fbbf24', fontSize: 10 }}> · saldo {euro(saldo)}: servono {euro(manca)} in più (il Banco paga 0,95)</span> : null}</td>
                              <td style={td}>
                                <button onClick={() => segnaConto(k, c.id, c.esito === 'V' ? null : 'V')} style={{ ...btn('#059669', c.esito === 'V'), opacity: c.esito === 'V' ? 1 : 0.55 }}>✓ Vince</button>
                                <button onClick={() => segnaConto(k, c.id, c.esito === 'P' ? null : 'P')} style={{ ...btn('#dc2626', c.esito === 'P'), marginLeft: 4, opacity: c.esito === 'P' ? 1 : 0.55 }}>✗ Perde</button>
                              </td>
                              <td style={{ ...td, fontWeight: 800 }}>
                                {c.esito === 'V' ? <span style={{ color: '#86efac' }}>+{euro(c.importo * (c.lato === 'Banco' ? 0.95 : 1))}{finale ? ' · 🏆 campione' : ' · passa al turno dopo'}</span> : null}
                                {c.esito === 'P' ? <span style={{ color: '#fca5a5' }}>−{euro(c.importo)} · eliminato{prima && prima.risultato !== -c.importo ? ` (in totale ${segno(prima.risultato)})` : ''}</span> : null}
                              </td>
                              {k === 0 && (
                                <td style={td}>
                                  <button onClick={() => apriContiSuTelefoni([(books || []).find(b => String(b.id) === String(c.id)) || c], `${c.nome} di ${c.intestatario}`)} style={btn('#0ea5e9')}>📱</button>
                                  <button onClick={() => togli(c.id)} style={{ ...btn('#64748b'), marginLeft: 4 }}>✕</button>
                                </td>
                              )}
                            </tr>)
                        })}
                      </tbody>
                    </table>
                  </div>)
              })}
              {campFinito && (
                <div style={{ ...box, borderColor: 'rgba(34,197,94,0.6)', fontSize: 12, color: '#cbd5e1' }}>
                  {(() => {
                    const tot = Math.round([...perConto.values()].reduce((a, r) => a + r.risultato, 0) * 100) / 100
                    return (
                      <div style={{ textAlign: 'center', padding: '8px 0 12px' }}>
                        <div style={{ fontSize: 12, color: '#94a3b8', fontWeight: 800, letterSpacing: 1 }}>{tot <= 0 ? '💸 COSTO PROFILATIVO DEL CAMPIONATO' : '💰 GUADAGNO DEL CAMPIONATO'}</div>
                        <div style={{ fontSize: 40, fontWeight: 900, color: tot <= 0 ? '#fca5a5' : '#86efac', lineHeight: 1.2 }}>{euro(Math.abs(tot))}</div>
                        <div style={{ fontSize: 11, color: '#94a3b8' }}>somma dei risultati di tutti i conti · si salva con «Sessione giocata» e finisce in Archivio come costo profilativo</div>
                      </div>)
                  })()}
                  {campioneId == null ? 'Campionato chiuso senza vincitore.' : <>🏆 Campione: <b>{bac.find(x => x.id === campioneId)?.nome} · {bac.find(x => x.id === campioneId)?.intestatario}</b> {segno(perConto.get(campioneId)?.risultato || 0)}</>}
                  <div style={{ marginTop: 6 }}>{bac.map(x => { const r = perConto.get(x.id); return r ? <div key={x.id}>{r.campione ? '🏆' : '❌'} {x.nome} · {x.intestatario}: {segno(r.risultato)} (puntato in tutto {euro(r.puntato)}{r.uscita ? `, uscito al turno ${r.uscita}` : ''})</div> : null })}</div>
                </div>
              )}
              <button onClick={conferma} disabled={!campFinito} style={{ ...btn('#059669', campFinito), marginTop: 4 }}>✓ Sessione giocata{campFinito ? '' : ' (segna prima tutti i turni)'}</button>
            </div>
          )}

          {pronta && !campionato && (
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
