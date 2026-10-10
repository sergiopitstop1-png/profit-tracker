"use client";
// 10/10/2026 — PROFILIAMO OGGI: Lucy legge i messaggi recenti di Profiliamo (Telegram Accademia), riconosce di quale
// bookmaker parlano e li assegna ai clienti che hai messo in profilazione su quel book, affiancando il protocollo
// di Lucy di oggi. Nessuna AI: il book si riconosce dal nome nel testo (anche letto dalle immagini).
import React, { useCallback, useEffect, useMemo, useState } from 'react'

const norm = (s) => String(s || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9]+/g, ' ').trim()
const quando = (iso) => new Date(iso).toLocaleString('it-IT', { timeZone: 'Europe/Rome', weekday: 'short', day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })
const btn = { background: '#334155', color: 'white', border: 0, borderRadius: 8, padding: '4px 10px', fontWeight: 800, fontSize: 12, cursor: 'pointer' }

export default function ProfiliamoOggi({ books = [], agendaOggi = [] }) {
  const [messaggi, setMessaggi] = useState(null)
  const [errore, setErrore] = useState('')
  const [ore, setOre] = useState(36)
  const [aperti, setAperti] = useState({})

  const carica = useCallback(async () => {
    setErrore('')
    try {
      const r = await fetch(`/api/accademia/profiliamo?ore=${ore}`, { cache: 'no-store' })
      const j = await r.json()
      if (!r.ok) throw new Error(j.error || 'Errore')
      setMessaggi(j.messaggi || [])
    } catch (e) { setErrore(e.message || String(e)); setMessaggi([]) }
  }, [ore])
  useEffect(() => { carica() }, [carica])

  // book per nome (un nome = tanti conti, uno per cliente)
  const perNome = useMemo(() => {
    const m = new Map()
    for (const b of books) {
      const k = norm(b.nome)
      if (k.length < 3) continue
      if (!m.has(k)) m.set(k, [])
      m.get(k).push(b)
    }
    return m
  }, [books])

  const azioniOggi = useMemo(() => {
    const m = new Map()
    for (const x of agendaOggi) m.set(x.book.id, x.agenda)
    return m
  }, [agendaOggi])

  // messaggi -> per ogni bookmaker nominato
  const gruppi = useMemo(() => {
    const out = new Map()
    for (const msg of messaggi || []) {
      const testo = norm(`${msg.testo || ''} ${msg.testo_immagine || ''}`)
      for (const [nome, conti] of perNome) {
        if (!(` ${testo} `).includes(` ${nome} `)) continue
        if (!out.has(nome)) out.set(nome, { nome: conti[0].nome, conti, msgs: [] })
        out.get(nome).msgs.push(msg)
      }
    }
    return [...out.values()].sort((a, b) => String(b.msgs[0].data_msg).localeCompare(String(a.msgs[0].data_msg)))
  }, [messaggi, perNome])

  const nonAssegnati = (messaggi || []).length - new Set(gruppi.flatMap(g => g.msgs.map(m => m.id))).size

  return (
    <div>
      <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap', marginBottom: 8, fontSize: 12, color: '#cbd5e1' }}>
        <span>Messaggi di Profiliamo delle ultime</span>
        <select value={ore} onChange={e => setOre(Number(e.target.value))} style={{ background: '#0b1220', color: '#f8fafc', border: '1px solid #334155', borderRadius: 6, padding: '3px 6px' }}>
          <option value={12}>12 ore</option><option value={36}>36 ore</option><option value={72}>3 giorni</option><option value={168}>7 giorni</option>
        </select>
        <button onClick={carica} style={btn}>↻ Aggiorna</button>
        {messaggi && <span style={{ color: '#94a3b8' }}>{messaggi.length} messaggi · {gruppi.length} book nominati{nonAssegnati > 0 ? ` · ${nonAssegnati} senza book riconosciuto` : ''}</span>}
      </div>
      {errore && <div style={{ color: '#fca5a5', fontSize: 12 }}>⚠️ {errore}</div>}
      {messaggi && messaggi.length === 0 && !errore && (
        <div style={{ fontSize: 12, color: '#94a3b8' }}>Nessun messaggio di Profiliamo in questo periodo. Il gruppo viene riconosciuto dal nome (Profiliamo) nel gruppo o nel topic Telegram.</div>
      )}
      {gruppi.map(g => {
        const inProf = g.conti.filter(b => b.profilo_livello === 'attivo')
        const aperto = !!aperti[g.nome]
        return (
          <div key={g.nome} style={{ background: 'rgba(15,23,42,0.6)', border: '1px solid rgba(148,163,184,0.25)', borderRadius: 12, padding: '9px 12px', marginBottom: 8 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8, flexWrap: 'wrap' }}>
              <b style={{ color: '#f8fafc' }}>{g.nome} <span style={{ color: '#94a3b8', fontWeight: 600, fontSize: 12 }}>· {g.msgs.length} {g.msgs.length === 1 ? 'messaggio' : 'messaggi'} · ultimo {quando(g.msgs[0].data_msg)}</span></b>
              <button onClick={() => setAperti(p => ({ ...p, [g.nome]: !aperto }))} style={btn}>{aperto ? '▾ Nascondi testo' : '▸ Leggi il messaggio'}</button>
            </div>
            <div style={{ fontSize: 12, margin: '5px 0', color: '#cbd5e1' }}>
              {inProf.length === 0
                ? <span style={{ color: '#fbbf24' }}>Nessun cliente in profilazione su {g.nome}: messaggio solo informativo.</span>
                : <>Da fare per: {inProf.map(b => {
                    const ag = azioniOggi.get(b.id)
                    return <span key={b.id} style={{ display: 'inline-block', background: 'rgba(16,185,129,0.15)', border: '1px solid rgba(16,185,129,0.4)', borderRadius: 8, padding: '1px 8px', margin: '2px 4px 2px 0' }}>
                      🟢 <b>{b.intestatario || '—'}</b>{ag?.azioni?.length ? ` · oggi: ${ag.azioni.join(' / ')}` : ' · oggi niente in agenda'}
                    </span>
                  })}</>}
            </div>
            {aperto && g.msgs.map(m => (
              <div key={m.id} style={{ borderTop: '1px solid #334155', padding: '6px 0', fontSize: 12, color: '#e2e8f0', whiteSpace: 'pre-wrap' }}>
                <div style={{ color: '#94a3b8', marginBottom: 2 }}>{quando(m.data_msg)}{m.mittente ? ` · ${m.mittente}` : ''}{m.topic_titolo ? ` · ${m.topic_titolo}` : ''}</div>
                {m.testo}{m.testo_immagine ? `\n🖼️ ${m.testo_immagine}` : ''}
              </div>
            ))}
          </div>
        )
      })}
    </div>
  )
}
