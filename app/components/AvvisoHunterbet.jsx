"use client";
// ════════════════════════════════════════════════════════════════════
// AVVISO HUNTERBET PRE-LIVE (23/10/2026)
// Sempre montato nel Profit Tracker (qualsiasi scheda): se il Masaniello Hunterbet è ACCESO, ogni minuto guarda se è arrivato
// un segnale Pre-live «12 + MG 1-3» giocabile (stesse regole del pannello) e, quando compare, avvisa subito:
// riquadro fisso in alto a destra, suono, titolo della scheda del browser e (se li abiliti) notifica del browser.
// Non scrive nulla: la scheda si conferma nel pannello «Masaniello Hunterbet Pre-live».
// ════════════════════════════════════════════════════════════════════
import React, { useState, useEffect, useRef } from 'react'
import { supabase } from '../profit-tracker/supabaseClient'
import { candidatiHB, partiteOggiHB } from '../../lib/recupero/masanielloHunterbet'

const ORA_IT = (iso) => new Date(iso).toLocaleTimeString('it-IT', { timeZone: 'Europe/Rome', hour: '2-digit', minute: '2-digit' })
const CHIAVE = 'profittracker_hb_avvisati'
const letti = () => { try { return new Set(JSON.parse(localStorage.getItem(CHIAVE) || '[]')) } catch { return new Set() } }
const salva = (set) => { try { localStorage.setItem(CHIAVE, JSON.stringify([...set].slice(-100))) } catch { /* storage non disponibile */ } }

function beep() {
  try {
    const Ctx = window.AudioContext || window.webkitAudioContext; if (!Ctx) return
    const c = new Ctx()
    ;[0, 0.25, 0.5].forEach((t, i) => { const o = c.createOscillator(), g = c.createGain(); o.frequency.value = i === 2 ? 1040 : 780; g.gain.value = 0.15; o.connect(g); g.connect(c.destination); o.start(c.currentTime + t); o.stop(c.currentTime + t + 0.18) })
  } catch { /* audio bloccato dal browser finché non clicchi sulla pagina */ }
}

export default function AvvisoHunterbet({ onApri, ogniMs = 60000 }) {
  const [cand, setCand] = useState([])
  const [nascosto, setNascosto] = useState(new Set())
  const [permesso, setPermesso] = useState(() => { try { return typeof Notification === 'undefined' ? 'no' : Notification.permission } catch { return 'no' } })
  const titoloOriginale = useRef(null)
  const avvisati = useRef(letti())

  useEffect(() => {
    let vivo = true
    async function controlla() {
      try {
        const { data: p, error } = await supabase.from('recupero_hb_piano').select('*').maybeSingle()
        if (error || !p || !p.attivo) { if (vivo) setCand([]); return }
        const { data: b } = await supabase.from('recupero_hb_bets').select('msg_id,stato,creato')
        const da = new Date(Date.now() - 24 * 3600000).toISOString()
        const { data: sg } = await supabase.from('hunterbet_segnali').select('msg_id,data_msg,competizione,casa,ospite,tipo_segnale,fase,esito,ft_casa,stato_match,af_stato').gte('data_msg', da).order('data_msg', { ascending: true }).limit(500)
        const giaInPiano = new Set([...(b || []).map(x => String(x.msg_id)), ...(Array.isArray(p.saltati) ? p.saltati : []).map(String)])
        const c = candidatiHB(sg || [], { giaInPiano, partiteOggi: partiteOggiHB(b || []) })
        if (!vivo) return
        setCand(c)
        const nuovi = c.filter(x => !avvisati.current.has(String(x.msg_id)))
        if (nuovi.length) {
          nuovi.forEach(x => avvisati.current.add(String(x.msg_id))); salva(avvisati.current)
          beep()
          try { if (typeof Notification !== 'undefined' && Notification.permission === 'granted') new Notification('🎯 Hunterbet Pre-live', { body: `${nuovi[0].partita} · ${ORA_IT(nuovi[0].event_start)} · 12 + Multigol 1-3`, tag: 'hb-' + nuovi[0].msg_id }) } catch { /* notifica non supportata */ }
        }
      } catch { /* rete assente o tabelle non ancora create: riprovo al prossimo giro */ }
    }
    controlla()
    const t = setInterval(controlla, ogniMs)
    const vis = () => { if (document.visibilityState === 'visible') controlla() }
    document.addEventListener('visibilitychange', vis)
    return () => { vivo = false; clearInterval(t); document.removeEventListener('visibilitychange', vis) }
  }, [ogniMs])

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
      <div style={{ color: '#94a3b8', fontSize: 12 }}>{c.competition ? c.competition + ' · ' : ''}ore {ORA_IT(c.event_start)} · 12 + Multigol 1-3 · quota min 1,60</div>
      <div style={{ marginTop: 8, display: 'flex', gap: 6, flexWrap: 'wrap' }}>
        <button onClick={() => onApri && onApri()} style={{ background: '#059669', color: 'white', border: 0, borderRadius: 8, padding: '5px 10px', fontWeight: 800, fontSize: 12, cursor: 'pointer' }}>Apri il Masaniello</button>
        <button onClick={() => setNascosto(prev => new Set([...prev, String(c.msg_id)]))} style={{ background: '#334155', color: 'white', border: 0, borderRadius: 8, padding: '5px 10px', fontWeight: 800, fontSize: 12, cursor: 'pointer' }}>Nascondi</button>
        {permesso === 'default' && <button onClick={async () => { try { setPermesso(await Notification.requestPermission()) } catch { /* non supportato */ } }} style={{ background: '#0ea5e9', color: 'white', border: 0, borderRadius: 8, padding: '5px 10px', fontWeight: 800, fontSize: 12, cursor: 'pointer' }}>🔔 Attiva notifiche</button>}
      </div>
    </div>
  )
}
