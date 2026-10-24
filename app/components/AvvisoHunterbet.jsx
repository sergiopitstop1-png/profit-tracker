"use client";
// ════════════════════════════════════════════════════════════════════
// AVVISO HUNTERBET PRE-LIVE (23/10/2026)
// Sempre montato nel Profit Tracker (qualsiasi scheda): se il Masaniello Hunterbet è ACCESO, ogni minuto guarda se è arrivato
// un segnale Pre-live «12 + MG 1-3» giocabile (stesse regole del pannello) e, quando compare, avvisa subito:
// riquadro fisso in alto a destra, suono, titolo della scheda del browser e (se li abiliti) notifica del browser.
// Se entro 5 minuti non confermi la scheda (né premi «Non gioco questa» o «Nascondi») ti telefona (Twilio, /api/avvisi/chiamata);
// secondo tentativo dopo altri 5 minuti, poi basta. La scheda si conferma nel pannello «Masaniello Hunterbet Pre-live».
// ════════════════════════════════════════════════════════════════════
import React, { useState, useEffect, useRef } from 'react'
import { supabase } from '../profit-tracker/supabaseClient'
import { candidatiHB, partiteOggiHB } from '../../lib/recupero/masanielloHunterbet'

const ORA_IT = (iso) => new Date(iso).toLocaleTimeString('it-IT', { timeZone: 'Europe/Rome', hour: '2-digit', minute: '2-digit' })
const CHIAVE = 'profittracker_hb_avvisati'
const letti = () => { try { return new Set(JSON.parse(localStorage.getItem(CHIAVE) || '[]')) } catch { return new Set() } }
const salva = (set) => { try { localStorage.setItem(CHIAVE, JSON.stringify([...set].slice(-100))) } catch { /* storage non disponibile */ } }

const CHIAVE_CHIAMATE = 'profittracker_hb_chiamate'
const ATTESA_MS = 5 * 60000, TENTATIVI_MAX = 2
const leggiChiamate = () => { try { return JSON.parse(localStorage.getItem(CHIAVE_CHIAMATE) || '{}') || {} } catch { return {} } }
const salvaChiamate = (o) => { try { const k = Object.keys(o); if (k.length > 60) k.slice(0, k.length - 60).forEach((x) => delete o[x]); localStorage.setItem(CHIAVE_CHIAMATE, JSON.stringify(o)) } catch { /* storage non disponibile */ } }

function beep() {
  try {
    const Ctx = window.AudioContext || window.webkitAudioContext; if (!Ctx) return
    const c = new Ctx()
    ;[0, 0.25, 0.5].forEach((t, i) => { const o = c.createOscillator(), g = c.createGain(); o.frequency.value = i === 2 ? 1040 : 780; g.gain.value = 0.15; o.connect(g); g.connect(c.destination); o.start(c.currentTime + t); o.stop(c.currentTime + t + 0.18) })
  } catch { /* audio bloccato dal browser finché non clicchi sulla pagina */ }
}

export default function AvvisoHunterbet({ onApri, ogniMs = 60000, giroMs = 20000 }) {
  const [cand, setCand] = useState([])
  const [nascosto, setNascosto] = useState(new Set())
  const [permesso, setPermesso] = useState(() => { try { return typeof Notification === 'undefined' ? 'no' : Notification.permission } catch { return 'no' } })
  const titoloOriginale = useRef(null)
  const avvisati = useRef(letti())

  const nascostoRef = useRef(nascosto); nascostoRef.current = nascosto
  const [telefonata, setTelefonata] = useState('?')   // '?' = non so ancora · 'si' = attiva · 'no' = chiavi Twilio mancanti
  const [, ridisegna] = useState(0)

  // legge piano, bet e segnali e restituisce i candidati di adesso (null se il piano è spento o c'è un errore)
  async function leggiCandidati() {
    const { data: p, error } = await supabase.from('recupero_hb_piano').select('*').maybeSingle()
    if (error || !p || !p.attivo) return []
    const { data: b } = await supabase.from('recupero_hb_bets').select('msg_id,stato,creato')
    const da = new Date(Date.now() - 24 * 3600000).toISOString()
    const { data: sg } = await supabase.from('hunterbet_segnali').select('msg_id,data_msg,competizione,casa,ospite,tipo_segnale,fase,esito,ft_casa,stato_match,af_stato').gte('data_msg', da).order('data_msg', { ascending: true }).limit(500)
    const giaInPiano = new Set([...(b || []).map(x => String(x.msg_id)), ...(Array.isArray(p.saltati) ? p.saltati : []).map(String)])
    return candidatiHB(sg || [], { giaInPiano, partiteOggi: partiteOggiHB(b || []) })
  }

  useEffect(() => {
    let vivo = true
    async function controlla() {
      try {
        const c = await leggiCandidati()
        if (!vivo) return
        setCand(c)
        const reg = leggiChiamate(); let cambiato = false
        for (const x of c) if (!reg[x.msg_id]) { reg[x.msg_id] = { primo: Date.now(), n: 0 }; cambiato = true }
        if (cambiato) salvaChiamate(reg)
        const nuovi = c.filter(x => !avvisati.current.has(String(x.msg_id)))
        if (nuovi.length) {
          nuovi.forEach(x => avvisati.current.add(String(x.msg_id))); salva(avvisati.current)
          beep()
          try { if (typeof Notification !== 'undefined' && Notification.permission === 'granted') new Notification('🎯 Hunterbet Pre-live', { body: `${nuovi[0].partita} · arrivato alle ${ORA_IT(nuovi[0].event_start)} · 12 + Multigol 1-3`, tag: 'hb-' + nuovi[0].msg_id, requireInteraction: true, renotify: true }) } catch { /* notifica non supportata */ }
        }
      } catch { /* rete assente o tabelle non ancora create: riprovo al prossimo giro */ }
    }
    controlla()
    const t = setInterval(controlla, ogniMs)
    const vis = () => { if (document.visibilityState === 'visible') controlla() }
    document.addEventListener('visibilitychange', vis)
    return () => { vivo = false; clearInterval(t); document.removeEventListener('visibilitychange', vis) }
  }, [ogniMs])

  // la telefonata è attiva? (chiavi Twilio su Vercel)
  useEffect(() => {
    let vivo = true
    fetch('/api/avvisi/chiamata').then(r => r.ok ? r.json() : null).then(j => { if (vivo && j) setTelefonata(j.configurato ? 'si' : 'no') }).catch(() => {})
    return () => { vivo = false }
  }, [])

  // telefonata: dopo 5 minuti senza conferma (secondo tentativo dopo altri 5), mai per partite già iniziate o nascoste
  useEffect(() => {
    if (telefonata !== 'si') return
    let vivo = true, occupato = false
    const giro = async () => {
      if (occupato) return
      occupato = true
      try {
        const reg = leggiChiamate()
        const adesso = Date.now()
        const pronti = cand.filter(x => {
          const r = reg[x.msg_id]
          return r && !nascostoRef.current.has(String(x.msg_id)) && r.n < TENTATIVI_MAX && adesso - r.primo >= ATTESA_MS * (r.n + 1) && adesso - new Date(x.event_start).getTime() < 30 * 60000   // 24/10/2026: niente telefonate per segnali arrivati da piu' di 30 minuti (es. scheda riaperta ore dopo) · : tolto «partita non ancora iniziata»: event_start è l'ora di ARRIVO del segnale (sempre nel passato), per questo la telefonata automatica non partiva mai
        })
        if (!pronti.length) return
        const x = pronti[0]
        const fresco = await leggiCandidati().catch(() => null)          // ricontrollo: magari l'hai appena confermata
        if (!vivo || !fresco || !fresco.some(y => String(y.msg_id) === String(x.msg_id))) return
        if (nascostoRef.current.has(String(x.msg_id))) return
        const reg2 = leggiChiamate(); reg2[x.msg_id] = { ...(reg2[x.msg_id] || { primo: adesso }), n: (reg2[x.msg_id]?.n || 0) + 1, ultimo: adesso }; salvaChiamate(reg2)   // segno PRIMA: due giri non chiamano due volte
        const r = await fetch('/api/avvisi/chiamata', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ partita: x.partita }) })
        if (r.status === 503) setTelefonata('no')
        ridisegna(v => v + 1)
      } catch { /* rete assente: ritento al prossimo giro (il tentativo è già segnato, quindi non si chiama più di due volte) */ }
      finally { occupato = false }
    }
    const t = setInterval(giro, giroMs)
    return () => { vivo = false; clearInterval(t) }
  }, [telefonata, cand, giroMs])

  const visibili = cand.filter(x => !nascosto.has(String(x.msg_id)))

  // titolo della scheda del browser: «🎯 (1) …» finché c'è una proposta non nascosta
  useEffect(() => {
    if (titoloOriginale.current === null) titoloOriginale.current = document.title
    const base = titoloOriginale.current.replace(/^🎯 \(\d+\) /, '')
    document.title = visibili.length ? `🎯 (${visibili.length}) ${base}` : base
    return () => { document.title = base }
  }, [visibili.length])

  if (!visibili.length) return null
  const c = visibili[0]
  return (
    <div role="alert" style={{ position: 'fixed', top: 70, right: 16, zIndex: 9998, maxWidth: 340, background: 'rgba(15,23,42,0.98)', border: '2px solid #38bdf8', borderRadius: 14, padding: '12px 14px', boxShadow: '0 6px 28px rgba(0,0,0,.6)', color: '#e2e8f0', fontSize: 13 }}>
      <div style={{ fontWeight: 900, color: '#7dd3fc', marginBottom: 4 }}>🎯 Hunterbet Pre-live: partita da giocare</div>
      <div><b>{c.partita}</b></div>
      <div style={{ color: '#94a3b8', fontSize: 12 }}>{c.competition ? c.competition + ' · ' : ''}arrivato alle {ORA_IT(c.event_start)} · 12 + Multigol 1-3 · quota min 1,60</div>
      {(() => {
        const r = leggiChiamate()[c.msg_id]
        if (telefonata === 'no') return <div style={{ color: '#64748b', fontSize: 11, marginTop: 4 }}>📞 telefonata non attiva (mancano le chiavi Twilio)</div>
        if (telefonata !== 'si' || !r) return null
        if (Date.now() - new Date(c.event_start).getTime() >= 30 * 60000) return <div style={{ color: '#64748b', fontSize: 11, marginTop: 4 }}>📞 segnale di più di 30 minuti fa: niente telefonata</div>
        if (r.n >= TENTATIVI_MAX) return <div style={{ color: '#fbbf24', fontSize: 11, marginTop: 4 }}>📞 ti ho già chiamato {r.n} volte</div>
        const quando = new Date(r.primo + ATTESA_MS * (r.n + 1)).toLocaleTimeString('it-IT', { timeZone: 'Europe/Rome', hour: '2-digit', minute: '2-digit' })
        return <div style={{ color: '#fbbf24', fontSize: 11, marginTop: 4 }}>📞 {r.n ? 'secondo avviso' : 'ti telefono'} alle {quando} se non confermi o non premi «Non gioco»/«Nascondi»</div>
      })()}
      <div style={{ marginTop: 8, display: 'flex', gap: 6, flexWrap: 'wrap' }}>
        <button onClick={() => onApri && onApri()} style={{ background: '#059669', color: 'white', border: 0, borderRadius: 8, padding: '5px 10px', fontWeight: 800, fontSize: 12, cursor: 'pointer' }}>Apri il Masaniello</button>
        <button onClick={() => setNascosto(prev => new Set([...prev, String(c.msg_id)]))} style={{ background: '#334155', color: 'white', border: 0, borderRadius: 8, padding: '5px 10px', fontWeight: 800, fontSize: 12, cursor: 'pointer' }}>Nascondi</button>
        {permesso === 'default' && <button onClick={async () => { try { setPermesso(await Notification.requestPermission()) } catch { /* non supportato */ } }} style={{ background: '#0ea5e9', color: 'white', border: 0, borderRadius: 8, padding: '5px 10px', fontWeight: 800, fontSize: 12, cursor: 'pointer' }}>🔔 Attiva notifiche</button>}
      </div>
    </div>
  )
}
