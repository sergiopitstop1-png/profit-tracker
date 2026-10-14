"use client";
// ════════════════════════════════════════════════════════════════════
// OGGI DA FARE (14/10/2026)
// Tutto ciò che c'è da fare oggi in un'unica pagina, per sezione, con ✓ Fatto e ⏭ Rimanda (con la data).
// Le voci non si copiano: vengono ricalcolate dalle fonti che esistono già.
//   • Bet, incroci, conti da movimentare, avvisi → fotografia che il Profit Tracker salva nel browser (localStorage)
//   • Masaniello di recupero → tabella recupero_bets, letta qui
//   • Mail e SMS con azione → /api/lucy-mail/archive?vista=problemi, letta qui
// Di nuovo salvato c'è solo lo stato: tabella oggi_da_fare_stato (supabase/oggi_da_fare.sql).
// "Fatto" qui è la lista di controllo di oggi: non scrive nelle tabelle di Lucy, degli avvisi o delle bet.
// Le voci già chiuse dal Profit Tracker (bet confermate, bet del Masaniello piazzate, mail lette) passano da sole in "Fatte".
// ════════════════════════════════════════════════════════════════════
import React, { useCallback, useEffect, useMemo, useState } from 'react'
import { supabase } from '../supabaseClient'
import { costruisciLista, dataIso, domaniIso, dataIt, dataLunga, rinvioValido, aggiungiGiorni, vociMasaniello, vociMail } from '../../../lib/oggiDaFare'

const CHIAVE_FOTO = 'profittracker_oggi_da_fare'
const ETA_MAX_MIN = 30   // oltre questo tempo la fotografia del Profit Tracker si considera vecchia

const card = { border: '1px solid rgba(71,85,105,0.7)', borderRadius: 14, background: 'rgba(15,23,42,0.85)', marginBottom: 14, overflow: 'hidden' }
const btnBase = { border: '1px solid transparent', borderRadius: 9, padding: '8px 14px', fontWeight: 900, fontSize: 13, cursor: 'pointer' }

function leggiFoto() {
  try {
    const f = JSON.parse(localStorage.getItem(CHIAVE_FOTO) || 'null')
    return f && Array.isArray(f.voci) ? f : null
  } catch { return null }
}

export default function DaFareClient() {
  const [oggi, setOggi] = useState(() => dataIso())
  const [foto, setFoto] = useState(null)
  const [righe, setRighe] = useState([])
  const [masaniello, setMasaniello] = useState([])
  const [mail, setMail] = useState([])
  const [errori, setErrori] = useState([])
  const [tabellaMancante, setTabellaMancante] = useState(false)
  const [caricamento, setCaricamento] = useState(true)
  const [salvando, setSalvando] = useState('')
  const [rinvio, setRinvio] = useState(null)        // { key, data }
  const [mostraFatte, setMostraFatte] = useState(false)
  const [mostraRimandate, setMostraRimandate] = useState(true)
  const [ora, setOra] = useState(() => Date.now())

  const carica = useCallback(async () => {
    const giorno = dataIso()
    setOggi(giorno)
    setFoto(leggiFoto())
    setCaricamento(true)
    const err = []

    // 1. stato salvato: fatte di recente + tutte le rimandate
    try {
      const da = aggiungiGiorni(giorno, -30)
      const { data, error } = await supabase.from('oggi_da_fare_stato').select('*').or(`giorno.gte.${da},stato.eq.rimandato`)
      if (error) {
        if (/oggi_da_fare_stato|relation|schema cache/i.test(error.message || '')) setTabellaMancante(true)
        else err.push('Stato salvato: ' + error.message)
      } else { setTabellaMancante(false); setRighe(data || []) }
    } catch (e) { err.push('Stato salvato: ' + (e?.message || e)) }

    // 2. bet del Masaniello di recupero: da fare, e piazzate oggi
    try {
      const inizioOggi = new Date(giorno + 'T00:00:00')
      const { data, error } = await supabase.from('recupero_bets').select('*').or(`stato.eq.da_fare,piazzata_at.gte.${inizioOggi.toISOString()}`).order('event_start', { ascending: true })
      if (error) err.push('Masaniello: ' + error.message)
      else setMasaniello(vociMasaniello(data || [], Date.now(), inizioOggi.getTime()))
    } catch (e) { err.push('Masaniello: ' + (e?.message || e)) }

    // 3. mail e SMS che richiedono azione
    try {
      const res = await fetch('/api/lucy-mail/archive?vista=problemi&periodo=15g&page_size=50', { cache: 'no-store' })
      if (!res.ok) throw new Error(res.status === 401 ? 'non autorizzato' : 'errore ' + res.status)
      const j = await res.json()
      setMail(vociMail(j.data || []))
    } catch (e) { err.push('Mail e SMS: ' + (e?.message || e)) }

    setErrori(err)
    setCaricamento(false)
  }, [])

  useEffect(() => { carica() }, [carica])

  // la fotografia cambia quando lavori nel Profit Tracker in un'altra scheda; ogni minuto si aggiorna anche l'età
  useEffect(() => {
    const suStorage = (e) => { if (e.key === CHIAVE_FOTO || e.key === null) setFoto(leggiFoto()) }
    window.addEventListener('storage', suStorage)
    const t = setInterval(() => setOra(Date.now()), 60000)
    const suFocus = () => { setFoto(leggiFoto()); if (dataIso() !== oggi) carica() }
    window.addEventListener('focus', suFocus)
    return () => { window.removeEventListener('storage', suStorage); window.removeEventListener('focus', suFocus); clearInterval(t) }
  }, [oggi, carica])

  const fotoDiOggi = foto && foto.giorno === oggi ? foto : null
  const etaMin = fotoDiOggi?.aggiornato ? Math.max(0, Math.round((ora - new Date(fotoDiOggi.aggiornato).getTime()) / 60000)) : null

  const lista = useMemo(() => {
    const voci = [...(fotoDiOggi?.voci || []), ...masaniello, ...mail]
    return costruisciLista({ voci, righe, oggi })
  }, [fotoDiOggi, masaniello, mail, righe, oggi])

  async function salva(v, stato, rimandaA) {
    setSalvando(v.key)
    try {
      const { data: u, error: eu } = await supabase.auth.getUser()
      if (eu || !u?.user?.id) throw new Error('utente non autenticato')
      const riga = { user_id: u.user.id, chiave: v.key, stato, giorno: oggi, rimanda_a: rimandaA || null, sezione: v.sezione, titolo: v.titolo, dettaglio: v.dettaglio || null, tag: v.tag || null, aggiornato: new Date().toISOString() }
      const { data, error } = await supabase.from('oggi_da_fare_stato').upsert(riga, { onConflict: 'user_id,chiave' }).select().single()
      if (error) throw error
      setRighe(prev => [...prev.filter(r => r.chiave !== v.key), data])
      setRinvio(null)
    } catch (e) {
      setErrori(prev => [...prev, 'Non salvato: ' + (e?.message || e)])
    }
    setSalvando('')
  }

  async function togli(v) {
    setSalvando(v.key)
    try {
      const { error } = await supabase.from('oggi_da_fare_stato').delete().eq('chiave', v.key)
      if (error) throw error
      setRighe(prev => prev.filter(r => r.chiave !== v.key))
    } catch (e) {
      setErrori(prev => [...prev, 'Non annullato: ' + (e?.message || e)])
    }
    setSalvando('')
  }

  const puoSalvare = !tabellaMancante
  const t = lista.totali

  const chip = (testo, colore) => <span style={{ border: `1px solid ${colore}`, color: colore, borderRadius: 999, padding: '3px 11px', fontWeight: 800, fontSize: 12 }}>{testo}</span>

  // funzione di disegno (non un componente): così il campo data non perde il focus a ogni tasto
  function riga(v, tipo = 'fare') {
    const azioni = true
    const aperto = rinvio && rinvio.key === v.key
    const occupato = salvando === v.key
    return (
      <div style={{ padding: '10px 14px', borderTop: '1px solid rgba(51,65,85,0.6)' }}>
        <div style={{ display: 'flex', gap: 10, alignItems: 'flex-start', flexWrap: 'wrap' }}>
          <div style={{ flex: '1 1 260px', minWidth: 0 }}>
            <div style={{ fontWeight: 800, fontSize: 14, color: tipo === 'fatta' ? '#94a3b8' : '#f1f5f9', textDecoration: tipo === 'fatta' ? 'line-through' : 'none' }}>
              {v.tag ? <span style={{ background: 'rgba(100,116,139,0.25)', color: '#cbd5e1', borderRadius: 6, padding: '1px 7px', fontSize: 10.5, fontWeight: 800, marginRight: 7, textDecoration: 'none', display: 'inline-block' }}>{String(v.tag).toUpperCase()}</span> : null}
              {v.titolo}
            </div>
            {v.dettaglio ? <div style={{ fontSize: 12.5, color: '#94a3b8', marginTop: 2, lineHeight: 1.4 }}>{v.dettaglio}</div> : null}
            {v.rimandataDal ? <div style={{ fontSize: 11.5, color: '#fbbf24', marginTop: 3, fontWeight: 700 }}>⏭ rimandata il {dataIt(v.rimandataDal)}: torna oggi</div> : null}
            {tipo === 'fatta' && v.nota ? <div style={{ fontSize: 11.5, color: '#4ade80', marginTop: 3, fontWeight: 700 }}>✓ {v.nota}</div> : null}
            {tipo === 'rimandata' ? <div style={{ fontSize: 12, color: '#fbbf24', marginTop: 3, fontWeight: 800 }}>⏭ rimandata al {dataIt(v.rimanda_a)} · {dataLunga(v.rimanda_a)}</div> : null}
          </div>
          {azioni && tipo === 'fare' && (
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
              <button type="button" disabled={!puoSalvare || occupato} onClick={() => salva(v, 'fatto')}
                style={{ ...btnBase, background: '#16a34a', color: 'white', opacity: !puoSalvare || occupato ? 0.5 : 1 }}>✓ Fatto</button>
              <button type="button" disabled={!puoSalvare || occupato} onClick={() => setRinvio(aperto ? null : { key: v.key, data: domaniIso(oggi) })}
                style={{ ...btnBase, background: aperto ? '#78350f' : 'rgba(251,191,36,0.15)', color: '#fcd34d', borderColor: 'rgba(251,191,36,0.55)', opacity: !puoSalvare || occupato ? 0.5 : 1 }}>⏭ Rimanda</button>
            </div>
          )}
          {tipo === 'fatta' && v.segnataQui && (
            <button type="button" disabled={occupato} onClick={() => togli(v)} title="Rimetti tra le cose da fare" style={{ ...btnBase, background: 'transparent', color: '#cbd5e1', borderColor: 'rgba(148,163,184,0.5)', padding: '5px 10px', fontSize: 12 }}>↩ Annulla</button>
          )}
          {tipo === 'rimandata' && (
            <button type="button" disabled={occupato} onClick={() => togli(v)} title="Riporta tra le cose da fare oggi" style={{ ...btnBase, background: 'transparent', color: '#cbd5e1', borderColor: 'rgba(148,163,184,0.5)', padding: '5px 10px', fontSize: 12 }}>↩ Riporta a oggi</button>
          )}
        </div>
        {aperto && (
          <div style={{ marginTop: 10, padding: '10px 12px', borderRadius: 10, background: 'rgba(251,191,36,0.08)', border: '1px solid rgba(251,191,36,0.4)', display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
            <label style={{ color: '#fde68a', fontWeight: 800, fontSize: 13 }}>Rimanda al giorno:</label>
            <input type="date" value={rinvio.data} min={domaniIso(oggi)} onChange={e => setRinvio({ key: v.key, data: e.target.value })}
              style={{ background: '#020617', color: '#f8fafc', border: '1px solid #475569', borderRadius: 8, padding: '6px 8px', fontWeight: 800, colorScheme: 'dark' }} />
            <span style={{ color: '#94a3b8', fontSize: 12.5 }}>{rinvioValido(rinvio.data, oggi) ? dataLunga(rinvio.data) : 'scegli una data da domani in poi'}</span>
            <button type="button" disabled={!rinvioValido(rinvio.data, oggi) || occupato} onClick={() => salva(v, 'rimandato', rinvio.data)}
              style={{ ...btnBase, background: rinvioValido(rinvio.data, oggi) ? '#d97706' : '#334155', color: 'white', padding: '6px 14px' }}>Conferma</button>
            <button type="button" onClick={() => setRinvio(null)} style={{ ...btnBase, background: 'transparent', color: '#cbd5e1', borderColor: 'rgba(148,163,184,0.5)', padding: '6px 12px' }}>Annulla</button>
          </div>
        )}
      </div>
    )
  }

  return (
    <div style={{ minHeight: '100vh', background: '#050b18', color: '#e2e8f0', fontFamily: 'system-ui, -apple-system, Segoe UI, sans-serif', padding: '18px 14px 60px' }}>
      <div style={{ maxWidth: 920, margin: '0 auto' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap', marginBottom: 6 }}>
          <a href="/profit-tracker" style={{ color: '#7dd3fc', fontWeight: 800, textDecoration: 'none', fontSize: 14 }}>← Profit Tracker</a>
          <a href="/profit-tracker/archivio-lucy" style={{ color: '#94a3b8', fontWeight: 700, textDecoration: 'none', fontSize: 13 }}>✉️ Archivio Lucy</a>
          <button type="button" onClick={carica} disabled={caricamento} style={{ ...btnBase, marginLeft: 'auto', background: 'rgba(56,189,248,0.15)', color: '#7dd3fc', borderColor: 'rgba(56,189,248,0.5)' }}>{caricamento ? '⏳ Aggiorno…' : '🔄 Aggiorna'}</button>
        </div>
        <h1 style={{ fontSize: 26, fontWeight: 900, margin: '8px 0 2px' }}>📋 Oggi da fare</h1>
        <div style={{ color: '#94a3b8', fontSize: 14, textTransform: 'capitalize', marginBottom: 12 }}>{dataLunga(oggi)}</div>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 16 }}>
          {chip(`${t.daFare} da fare`, t.daFare ? '#fbbf24' : '#4ade80')}
          {chip(`${t.fatte} fatte`, '#4ade80')}
          {chip(`${t.rimandate} rimandate`, '#94a3b8')}
        </div>

        {tabellaMancante && (
          <div style={{ ...card, borderColor: 'rgba(248,113,113,0.7)', padding: '12px 14px', color: '#fecaca', fontSize: 13.5, lineHeight: 1.5 }}>
            <b>Manca la tabella per salvare Fatto e Rimanda.</b> Esegui una volta il file <code>supabase/oggi_da_fare.sql</code> nel SQL Editor di Supabase, poi premi Aggiorna. Intanto la lista si vede, ma i bottoni sono spenti.
          </div>
        )}
        {errori.map((e, i) => (
          <div key={i} style={{ ...card, borderColor: 'rgba(248,113,113,0.6)', padding: '9px 14px', color: '#fecaca', fontSize: 13 }}>⚠️ {e}</div>
        ))}
        {!caricamento && !fotoDiOggi && (
          <div style={{ ...card, borderColor: 'rgba(251,191,36,0.6)', padding: '12px 14px', color: '#fde68a', fontSize: 13.5, lineHeight: 1.5 }}>
            ⚠️ Mancano bet, incroci, conti e avvisi di oggi: li prepara il Profit Tracker.{' '}
            {foto ? `L'ultima fotografia è del ${dataIt(foto.giorno)}.` : "Non ce n'è ancora nessuna."} Apri il <a href="/profit-tracker" style={{ color: '#7dd3fc', fontWeight: 800 }}>Profit Tracker</a> (anche in un&apos;altra scheda) e questa pagina si aggiorna da sola.
          </div>
        )}
        {fotoDiOggi && etaMin != null && etaMin > ETA_MAX_MIN && (
          <div style={{ ...card, borderColor: 'rgba(251,191,36,0.5)', padding: '9px 14px', color: '#fde68a', fontSize: 13 }}>
            ⏱ Bet, conti e avvisi sono aggiornati a {etaMin} minuti fa: tieni aperto il Profit Tracker per averli sempre freschi.
          </div>
        )}

        {!caricamento && t.daFare === 0 && (fotoDiOggi || t.fatte > 0) && (
          <div style={{ ...card, borderColor: 'rgba(74,222,128,0.5)', padding: '16px 14px', textAlign: 'center', color: '#86efac', fontWeight: 800, fontSize: 16 }}>✅ Non c&apos;è altro da fare per oggi</div>
        )}

        {lista.sezioni.map(s => (
          <div key={s.id} style={card}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 14px', background: 'rgba(30,41,59,0.9)', borderLeft: `4px solid ${s.colore}` }}>
              <span style={{ fontWeight: 900, fontSize: 15 }}>{s.icona} {s.titolo}</span>
              <span style={{ marginLeft: 'auto', color: s.colore, fontWeight: 900, fontSize: 13 }}>{s.voci.length}</span>
            </div>
            {s.voci.map(v => <React.Fragment key={v.key}>{riga(v)}</React.Fragment>)}
            {s.id === 'masaniello' && <div style={{ padding: '7px 14px', borderTop: '1px solid rgba(51,65,85,0.6)', fontSize: 12, color: '#64748b' }}>La quota reale e la bet piazzata si registrano nel Profit Tracker (Profilazione → Recuperi con PronoX): da lì la voce passa da sola in &ldquo;Fatte&rdquo;.</div>}
            {s.id === 'mail' && <div style={{ padding: '7px 14px', borderTop: '1px solid rgba(51,65,85,0.6)', fontSize: 12, color: '#64748b' }}>Se apri la mail nell&apos;Archivio Lucy e la segni letta, qui sparisce da sola.</div>}
          </div>
        ))}

        {lista.rimandate.length > 0 && (
          <div style={card}>
            <button type="button" onClick={() => setMostraRimandate(v => !v)} style={{ width: '100%', textAlign: 'left', cursor: 'pointer', border: 0, display: 'flex', alignItems: 'center', gap: 10, padding: '10px 14px', background: 'rgba(30,41,59,0.9)', color: '#e2e8f0', borderLeft: '4px solid #94a3b8' }}>
              <span style={{ fontWeight: 900, fontSize: 15 }}>⏭ Rimandate</span>
              <span style={{ marginLeft: 'auto', color: '#94a3b8', fontWeight: 900, fontSize: 13 }}>{lista.rimandate.length} {mostraRimandate ? '▾' : '▸'}</span>
            </button>
            {mostraRimandate && lista.rimandate.map(v => <React.Fragment key={v.key}>{riga(v, 'rimandata')}</React.Fragment>)}
          </div>
        )}

        {lista.fatte.length > 0 && (
          <div style={card}>
            <button type="button" onClick={() => setMostraFatte(v => !v)} style={{ width: '100%', textAlign: 'left', cursor: 'pointer', border: 0, display: 'flex', alignItems: 'center', gap: 10, padding: '10px 14px', background: 'rgba(30,41,59,0.9)', color: '#e2e8f0', borderLeft: '4px solid #4ade80' }}>
              <span style={{ fontWeight: 900, fontSize: 15 }}>✓ Fatte oggi</span>
              <span style={{ marginLeft: 'auto', color: '#4ade80', fontWeight: 900, fontSize: 13 }}>{lista.fatte.length} {mostraFatte ? '▾' : '▸'}</span>
            </button>
            {mostraFatte && lista.fatte.map(v => <React.Fragment key={v.key}>{riga(v, 'fatta')}</React.Fragment>)}
          </div>
        )}

        <div style={{ color: '#64748b', fontSize: 12, lineHeight: 1.5, marginTop: 8 }}>
          Le voci si ricalcolano ogni volta dalle stesse fonti del Profit Tracker. ✓ Fatto e ⏭ Rimanda segnano solo questa lista: una voce rimandata ricompare nel giorno scelto, anche se Lucy nel frattempo ricalcola le bet.
          {fotoDiOggi?.aggiornato ? ` Bet, conti e avvisi aggiornati alle ${new Date(fotoDiOggi.aggiornato).toLocaleTimeString('it-IT', { hour: '2-digit', minute: '2-digit' })}.` : ''}
        </div>
      </div>
    </div>
  )
}
