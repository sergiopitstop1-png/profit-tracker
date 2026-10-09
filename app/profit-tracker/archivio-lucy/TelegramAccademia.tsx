'use client'

// 09/10/2026 · Tab "Telegram" di Archivio Lucy: consultazione dei messaggi dei gruppi dell'Accademia del Profitto.
// Legge da /api/accademia/messaggi (solo admin). Stile matrix come il resto di Archivio Lucy.

import { Fragment, useCallback, useEffect, useMemo, useRef, useState } from 'react'

type Gruppo = { chat_id: number; chat_titolo: string | null; topic_id: number | null; topic_titolo: string | null; n: number; ultimo: string | null }
type Messaggio = {
  id: number; chat_id: number; chat_titolo: string | null; topic_id: number | null; topic_titolo: string | null
  msg_id: number; data_msg: string; mittente: string | null; testo: string | null; media_tipo: string | null; link: string | null
}
type Filtri = { q: string; chat: string; topic: string; autore: string; da: string; a: string }

const VUOTI: Filtri = { q: '', chat: '', topic: '', autore: '', da: '', a: '' }
const PAGINA = 50
const TESTO_BREVE = 700

const fmtData = (v: string) => {
  const d = new Date(v)
  return Number.isNaN(d.getTime()) ? v : d.toLocaleString('it-IT', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' })
}
const fmtGiorno = (v: string | null) => {
  if (!v) return '-'
  const d = new Date(v)
  return Number.isNaN(d.getTime()) ? '-' : d.toLocaleDateString('it-IT', { day: '2-digit', month: '2-digit', year: '2-digit' })
}
const inizioGiorno = (iso: string) => (iso ? new Date(`${iso}T00:00:00`).toISOString() : '')
const fineGiorno = (iso: string) => (iso ? new Date(`${iso}T23:59:59.999`).toISOString() : '')
const oggiIso = () => {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

function Evidenzia({ testo, parole }: { testo: string; parole: string[] }) {
  const buone = parole.filter(p => p.length > 0)
  if (!buone.length) return <>{testo}</>
  const rx = new RegExp(`(${buone.map(p => p.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('|')})`, 'gi')
  return (
    <>
      {testo.split(rx).map((pezzo, i) =>
        i % 2 === 1 ? <mark key={i} className="bg-green-400/30 text-green-200 rounded px-0.5">{pezzo}</mark> : <Fragment key={i}>{pezzo}</Fragment>
      )}
    </>
  )
}

type Diretta = { id: number; titolo: string; inizio: string; link: string | null; gruppo: string | null; topic: string | null }
const fmtDiretta = (v: string) =>
  new Intl.DateTimeFormat('it-IT', { timeZone: 'Europe/Rome', weekday: 'long', day: '2-digit', month: 'long', hour: '2-digit', minute: '2-digit' }).format(new Date(v))

function CalendarioDirette() {
  const [lista, setLista] = useState<Diretta[] | null>(null)
  const [errore, setErrore] = useState('')
  const [adesso, setAdesso] = useState(0)
  const [giro, setGiro] = useState(0)   // cambia quando si vuole ricaricare
  useEffect(() => {
    let vivo = true
    fetch('/api/accademia/dirette')
      .then(async r => ({ ok: r.ok, status: r.status, j: await r.json().catch(() => ({})) }))
      .then(({ ok, status, j }) => {
        if (!vivo) return
        setAdesso(Date.now())
        if (!ok) { setErrore(j?.error || `Errore ${status}`); setLista([]) } else { setErrore(''); setLista(j.dirette || []) }
      })
      .catch(() => { if (vivo) { setErrore('Calendario non raggiungibile'); setLista([]) } })
    return () => { vivo = false }
  }, [giro])
  const togli = async (id: number) => {
    if (!window.confirm('Togliere questa diretta dal calendario? (non verrà rimessa)')) return
    await fetch(`/api/accademia/dirette?id=${id}`, { method: 'DELETE' })
    setGiro(g => g + 1)
  }
  return (
    <div className="mb-5 rounded-xl border border-pink-500/40 bg-[#07100a] p-4">
      <div className="mb-2 font-bold text-pink-300">&gt; 📅 CALENDARIO DIRETTE</div>
      {errore && <div className="mb-2 rounded border border-amber-500/40 bg-amber-500/10 p-2 text-xs text-amber-300">{errore}</div>}
      {lista === null && <div className="text-sm text-slate-500">&gt; carico…</div>}
      {lista && !lista.length && !errore && <div className="text-sm text-slate-500">&gt; Nessuna diretta in programma trovata. Lucy legge gli annunci ogni 5 minuti.</div>}
      <ul className="space-y-1.5">
        {(lista || []).map(d => {
          const passata = new Date(d.inizio).getTime() < adesso
          return (
            <li key={d.id} className={`flex flex-wrap items-center gap-x-3 gap-y-1 rounded-lg border px-3 py-2 text-sm ${passata ? 'border-green-900/50 text-slate-500' : 'border-green-900/70 text-slate-200'}`}>
              <span className="font-bold capitalize text-green-300">{fmtDiretta(d.inizio)}</span>
              <span className="min-w-0 flex-1">{d.titolo}{d.gruppo ? <span className="text-slate-500"> · {d.gruppo}</span> : null}</span>
              {d.link && <a href={d.link} target="_blank" rel="noopener noreferrer" className="text-green-400 hover:underline">↗ apri</a>}
              <button onClick={() => togli(d.id)} title="Non è una diretta / sbagliata" className="text-xs text-slate-600 hover:text-red-400">✕</button>
            </li>
          )
        })}
      </ul>
    </div>
  )
}

export default function TelegramAccademia() {
  const [gruppi, setGruppi] = useState<Gruppo[]>([])
  const [erroreGruppi, setErroreGruppi] = useState('')
  const [bozza, setBozza] = useState<Filtri>(VUOTI)     // quello che scrivi
  const [filtri, setFiltri] = useState<Filtri>(VUOTI)   // quello che è applicato
  const [messaggi, setMessaggi] = useState<Messaggio[]>([])
  const [totale, setTotale] = useState(0)
  const [carico, setCarico] = useState(false)
  const [errore, setErrore] = useState('')
  const [espansi, setEspansi] = useState<Set<number>>(new Set())
  const richiesta = useRef(0)

  // elenco gruppi (una volta)
  useEffect(() => {
    let vivo = true
    fetch('/api/accademia/messaggi?elenco=1')
      .then(async r => ({ ok: r.ok, j: await r.json().catch(() => ({})) }))
      .then(({ ok, j }) => {
        if (!vivo) return
        if (!ok) setErroreGruppi(j?.error || 'Elenco gruppi non disponibile')
        else setGruppi(j.gruppi || [])
      })
      .catch(() => vivo && setErroreGruppi('Elenco gruppi non raggiungibile'))
    return () => { vivo = false }
  }, [])

  const parametri = useCallback((f: Filtri, offset: number) => {
    const p = new URLSearchParams()
    if (f.q.trim()) p.set('q', f.q.trim())
    if (f.chat) p.set('chat', f.chat)
    if (f.topic) p.set('topic', f.topic)
    if (f.autore.trim()) p.set('autore', f.autore.trim())
    if (f.da) p.set('da', inizioGiorno(f.da))
    if (f.a) p.set('a', fineGiorno(f.a))
    p.set('limit', String(PAGINA))
    p.set('offset', String(offset))
    return p.toString()
  }, [])

  const carica = useCallback(async (f: Filtri, aggiungi: boolean, offset: number) => {
    const mia = ++richiesta.current
    setCarico(true)
    setErrore('')
    try {
      const r = await fetch(`/api/accademia/messaggi?${parametri(f, offset)}`)
      const j = await r.json().catch(() => ({}))
      if (mia !== richiesta.current) return
      if (!r.ok) { setErrore(j?.error || `Errore ${r.status}`); if (!aggiungi) { setMessaggi([]); setTotale(0) } return }
      setTotale(j.totale || 0)
      setMessaggi(prev => (aggiungi ? [...prev, ...(j.messaggi || [])] : j.messaggi || []))
    } catch {
      if (mia === richiesta.current) setErrore('Server non raggiungibile')
    } finally {
      if (mia === richiesta.current) setCarico(false)
    }
  }, [parametri])

  // ogni volta che cambiano i filtri applicati, riparte dall'inizio
  useEffect(() => { setEspansi(new Set()); carica(filtri, false, 0) }, [filtri, carica])

  const applica = (f: Filtri) => { setBozza(f); setFiltri(f) }

  // gruppi raggruppati per chat
  const perChat = useMemo(() => {
    const m = new Map<number, { chat_id: number; titolo: string; n: number; ultimo: string | null; topic: Gruppo[] }>()
    for (const g of gruppi) {
      const c = m.get(g.chat_id) || { chat_id: g.chat_id, titolo: g.chat_titolo || String(g.chat_id), n: 0, ultimo: null, topic: [] }
      c.n += Number(g.n)
      if (g.ultimo && (!c.ultimo || g.ultimo > c.ultimo)) c.ultimo = g.ultimo
      if (g.chat_titolo) c.titolo = g.chat_titolo
      if (g.topic_id) c.topic.push(g)
      m.set(g.chat_id, c)
    }
    return [...m.values()].sort((a, b) => (b.ultimo || '').localeCompare(a.ultimo || ''))
  }, [gruppi])

  const parole = useMemo(() => filtri.q.trim().split(/\s+/).filter(Boolean), [filtri.q])
  const filtriAttivi = JSON.stringify(filtri) !== JSON.stringify(VUOTI)
  const toggle = (set: Set<number>, id: number) => { const n = new Set(set); if (n.has(id)) n.delete(id); else n.add(id); return n }

  const vistiPer = (m: Messaggio) => m.testo || (m.media_tipo ? `[${m.media_tipo}]` : '[senza testo]')

  return (
    <>
    <CalendarioDirette />
    <div className="grid grid-cols-1 lg:grid-cols-[320px_minmax(0,1fr)] gap-5">
      {/* ================= GRUPPI ================= */}
      <aside className="rounded-xl border border-green-900/70 bg-[#07100a] p-3 lg:sticky lg:top-4 lg:self-start lg:max-h-[calc(100vh-2rem)] overflow-y-auto max-h-72">
        <div className="mb-2 flex items-center justify-between">
          <div className="font-bold text-green-300">&gt; GRUPPI</div>
          {filtri.chat && (
            <button onClick={() => applica({ ...filtri, chat: '', topic: '' })} className="text-xs text-green-400 hover:underline">tutti</button>
          )}
        </div>
        {erroreGruppi && <div className="mb-2 rounded border border-amber-500/40 bg-amber-500/10 p-2 text-xs text-amber-300">{erroreGruppi}</div>}
        {!erroreGruppi && !perChat.length && <div className="text-sm text-slate-500">&gt; nessun gruppo ancora</div>}
        <ul className="space-y-1">
          {perChat.map(c => {
            const attivo = filtri.chat === String(c.chat_id)
            return (
              <li key={c.chat_id}>
                <button
                  onClick={() => applica({ ...filtri, chat: String(c.chat_id), topic: '' })}
                  className={`w-full rounded-lg border px-2 py-1.5 text-left transition-colors ${attivo ? 'border-green-400 bg-green-500/15 text-green-300' : 'border-transparent text-slate-300 hover:border-green-700 hover:bg-green-950/40'}`}
                >
                  <div className="truncate text-sm font-semibold">{c.titolo}</div>
                  <div className="text-[11px] text-slate-500">{c.n.toLocaleString('it-IT')} messaggi · ultimo {fmtGiorno(c.ultimo)}</div>
                </button>
                {attivo && c.topic.length > 0 && (
                  <ul className="ml-3 mt-1 space-y-0.5 border-l border-green-900/70 pl-2">
                    <li>
                      <button onClick={() => applica({ ...filtri, topic: '' })} className={`w-full truncate rounded px-2 py-1 text-left text-xs ${!filtri.topic ? 'text-green-300' : 'text-slate-400 hover:text-green-300'}`}>Tutti i topic</button>
                    </li>
                    {c.topic.sort((a, b) => Number(b.n) - Number(a.n)).map(t => (
                      <li key={t.topic_id}>
                        <button onClick={() => applica({ ...filtri, topic: String(t.topic_id) })} className={`flex w-full justify-between gap-2 rounded px-2 py-1 text-left text-xs ${filtri.topic === String(t.topic_id) ? 'bg-green-500/15 text-green-300' : 'text-slate-400 hover:text-green-300'}`}>
                          <span className="truncate">{t.topic_titolo || `topic ${t.topic_id}`}</span>
                          <span className="shrink-0 text-slate-600">{Number(t.n).toLocaleString('it-IT')}</span>
                        </button>
                      </li>
                    ))}
                  </ul>
                )}
              </li>
            )
          })}
        </ul>
      </aside>

      {/* ================= MESSAGGI ================= */}
      <section className="min-w-0">
        <form
          onSubmit={e => { e.preventDefault(); setFiltri({ ...bozza, chat: filtri.chat, topic: filtri.topic }) }}
          className="mb-4 rounded-xl border border-green-900/70 bg-[#07100a] p-4 shadow-[0_0_20px_rgba(0,0,0,0.35)]"
        >
          <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-4">
            <input className="matrix-input xl:col-span-2" placeholder="🔎 Cerca parole o codici (es. EPlay24 bonus)" value={bozza.q} onChange={e => setBozza({ ...bozza, q: e.target.value })} />
            <input className="matrix-input" placeholder="Autore" value={bozza.autore} onChange={e => setBozza({ ...bozza, autore: e.target.value })} />
            <div className="flex gap-2">
              <input type="date" className="matrix-input" title="Dal" value={bozza.da} onChange={e => setBozza({ ...bozza, da: e.target.value })} />
              <input type="date" className="matrix-input" title="Al" value={bozza.a} onChange={e => setBozza({ ...bozza, a: e.target.value })} />
            </div>
          </div>
          <div className="mt-3 flex flex-wrap items-center gap-2">
            <button type="submit" className="rounded-lg border border-green-400 bg-green-500/15 px-4 py-2 font-semibold text-green-300 hover:bg-green-500/25">Cerca</button>
            <button type="button" onClick={() => applica({ ...VUOTI, da: oggiIso(), a: oggiIso() })} className="rounded-lg border border-pink-500/50 bg-[#07100a] px-4 py-2 text-pink-300 hover:bg-pink-950/30">📅 Oggi</button>
            <button type="button" onClick={() => { const d = new Date(); d.setDate(d.getDate() - 6); const iso = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`; applica({ ...VUOTI, da: iso }) }} className="rounded-lg border border-green-900/70 bg-[#07100a] px-4 py-2 text-slate-300 hover:border-green-500">Ultimi 7 giorni</button>
            {filtriAttivi && (
              <button type="button" onClick={() => applica(VUOTI)} className="rounded-lg border border-green-900/70 bg-[#07100a] px-4 py-2 text-slate-400 hover:border-green-500">✕ Azzera</button>
            )}
            <div className="ml-auto text-sm text-slate-400">{carico && !messaggi.length ? '> carico…' : `> ${totale.toLocaleString('it-IT')} messaggi`}</div>
          </div>
        </form>

        {errore && <div className="mb-4 rounded-lg border border-red-500/40 bg-red-500/10 p-3 text-sm text-red-300">{errore}</div>}

        <div className="space-y-2">
          {messaggi.map(m => {
            const testo = vistiPer(m)
            const lungo = testo.length > TESTO_BREVE && !espansi.has(m.id)
            const media = !m.testo
            return (
              <article key={m.id} className="rounded-xl border border-green-900/70 bg-[#07100a] p-3 hover:border-green-700/80">
                <div className="mb-1.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs">
                  <span className="font-bold text-green-300">{m.mittente || '?'}</span>
                  <span className="text-slate-500">{fmtData(m.data_msg)}</span>
                  <button onClick={() => applica({ ...filtri, chat: String(m.chat_id), topic: '' })} className="rounded border border-green-900/70 px-1.5 py-0.5 text-emerald-300 hover:border-green-500" title="Mostra solo questo gruppo">
                    {m.chat_titolo || m.chat_id}
                  </button>
                  {m.topic_id ? (
                    <button onClick={() => applica({ ...filtri, chat: String(m.chat_id), topic: String(m.topic_id) })} className="rounded border border-green-900/70 px-1.5 py-0.5 text-slate-400 hover:border-green-500" title="Mostra solo questo topic">
                      # {m.topic_titolo || m.topic_id}
                    </button>
                  ) : null}
                  {m.link && (
                    <a href={m.link} target="_blank" rel="noopener noreferrer" className="ml-auto text-green-400 hover:underline">↗ Telegram</a>
                  )}
                </div>
                <div className={`whitespace-pre-wrap break-words text-sm ${media ? 'italic text-slate-500' : 'text-slate-200'}`}>
                  <Evidenzia testo={lungo ? `${testo.slice(0, TESTO_BREVE)}…` : testo} parole={parole} />
                </div>
                {testo.length > TESTO_BREVE && (
                  <button onClick={() => setEspansi(toggle(espansi, m.id))} className="mt-1 text-xs text-green-400 hover:underline">
                    {espansi.has(m.id) ? 'mostra meno' : 'mostra tutto'}
                  </button>
                )}
              </article>
            )
          })}
          {!carico && !errore && messaggi.length === 0 && <div className="rounded-xl border border-green-900/70 bg-[#07100a] p-6 text-center text-slate-500">&gt; Nessun messaggio trovato.</div>}
        </div>

        {messaggi.length < totale && (
          <div className="mt-4 text-center">
            <button disabled={carico} onClick={() => carica(filtri, true, messaggi.length)} className="rounded-lg border border-green-400 bg-green-500/15 px-6 py-2 font-semibold text-green-300 hover:bg-green-500/25 disabled:opacity-50">
              {carico ? '> carico…' : `Carica altri ${Math.min(PAGINA, totale - messaggi.length)}`}
            </button>
          </div>
        )}
      </section>
    </div>
    </>
  )
}
