'use client'

// 11/10/2026 · Raccoglitore dei consigli dell'Accademia (tab Telegram di Archivio Lucy).
// Lucy legge i messaggi dei topic scelti e ne estrae slot consigliate, consigli sulle promo, bug e schemi: qui si consultano per book e tipo.
// Legge da /api/accademia/consigli (solo admin). Stile matrix come il resto di Archivio Lucy.

import { useCallback, useEffect, useMemo, useState } from 'react'

type Fonte = { c: string | null; t: string | null; m: string | null; l: string | null; d: string; x: string }
type Consiglio = {
  id: number; tipo: 'slot' | 'promo' | 'bug' | 'pattern'; book: string | null; promo: string | null; argomento: string | null
  titolo: string; consiglio: string; dettagli: string | null; scopo: string | null; da_staff: boolean; autori: string[]
  n_fonti: number; fonti: Fonte[]; chat_titolo: string | null; topic_titolo: string | null; prima_data: string | null; ultima_data: string | null; stato: string
}
type Stato = {
  ultimo_msg: string | null; ultima_esecuzione: string | null; messaggi_letti: number; consigli_trovati: number; costo_usd: number
  errori_consecutivi: number; ultimo_errore: string | null; batch_saltati: number
} | null
type Prova = {
  trovati: { chat: string; topic: string; messaggi: number; nuovi: number }[]; nuovi: number; blocchi: number; costoStimato: number
  avviso: string; alternative: string[]
}

const TIPI: { k: Consiglio['tipo']; nome: string }[] = [
  { k: 'slot', nome: '🎰 Slot' }, { k: 'promo', nome: '🎯 Promo' }, { k: 'bug', nome: '🐞 Bug' }, { k: 'pattern', nome: '🧩 Pattern' },
]
const NOME_TIPO: Record<string, string> = { slot: '🎰 Slot', promo: '🎯 Promo', bug: '🐞 Bug', pattern: '🧩 Pattern' }

const fmtGiorno = (v: string | null) => {
  if (!v) return '-'
  const d = new Date(v)
  return Number.isNaN(d.getTime()) ? '-' : d.toLocaleDateString('it-IT', { day: '2-digit', month: '2-digit', year: '2-digit' })
}
const fmtData = (v: string | null) => {
  if (!v) return '-'
  const d = new Date(v)
  return Number.isNaN(d.getTime()) ? '-' : d.toLocaleString('it-IT', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })
}
const maiuscola = (t: string) => t.charAt(0).toUpperCase() + t.slice(1)

export default function ConsigliAccademia() {
  const [lista, setLista] = useState<Consiglio[]>([])
  const [perTipo, setPerTipo] = useState<Record<string, number>>({})
  const [perBook, setPerBook] = useState<Record<string, number>>({})
  const [stato, setStato] = useState<Stato>(null)
  const [errore, setErrore] = useState('')
  const [carico, setCarico] = useState(true)
  const [tipo, setTipo] = useState('')
  const [book, setBook] = useState('')
  const [ricerca, setRicerca] = useState('')
  const [q, setQ] = useState('')
  const [archiviati, setArchiviati] = useState(false)
  const [giro, setGiro] = useState(0)
  const [prova, setProva] = useState<Prova | null>(null)
  const [lavoro, setLavoro] = useState('')
  const [esito, setEsito] = useState('')
  const [aperti, setAperti] = useState<Set<number>>(new Set())

  useEffect(() => { const t = setTimeout(() => setQ(ricerca), 350); return () => clearTimeout(t) }, [ricerca])

  const carica = useCallback(async () => {
    setCarico(true)
    try {
      const p = new URLSearchParams()
      if (tipo) p.set('tipo', tipo)
      if (book) p.set('book', book)
      if (q) p.set('q', q)
      if (archiviati) p.set('stato', 'archiviato')
      const r = await fetch(`/api/accademia/consigli?${p}`, { cache: 'no-store' })
      const j = await r.json()
      if (!r.ok) throw new Error(j?.error || `errore ${r.status}`)
      setLista(j.consigli || []); setPerTipo(j.perTipo || {}); setPerBook(j.perBook || {}); setStato(j.stato || null); setErrore('')
    } catch (e) {
      setErrore(e instanceof Error ? e.message : String(e))
    } finally {
      setCarico(false)
    }
  }, [tipo, book, q, archiviati])
  useEffect(() => { carica() }, [carica, giro])

  const chiama = async (azione: 'prova' | 'avvia') => {
    setLavoro(azione); setEsito('')
    try {
      const r = await fetch('/api/accademia/consigli', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ azione }) })
      const j = await r.json()
      if (!r.ok) throw new Error(j?.error || `errore ${r.status}`)
      if (azione === 'prova') setProva(j as Prova)
      else {
        setEsito(j.ok === false
          ? `⚠️ Lettura interrotta: ${j.errore || 'errore'}`
          : j.saltato
            ? `ℹ️ ${j.saltato}`
            : `✅ Letti ${j.messaggi} messaggi in ${j.blocchi} blocchi · ${j.consigli} consigli nuovi o aggiornati · costo ${Number(j.costo || 0).toFixed(3)} $${j.blocchi >= 1 ? ' (se ci sono altri messaggi da leggere, premi di nuovo)' : ''}`)
        setProva(null); setGiro(g => g + 1)
      }
    } catch (e) {
      setEsito(`⚠️ ${e instanceof Error ? e.message : String(e)}`)
    } finally {
      setLavoro('')
    }
  }

  const cambiaStato = async (c: Consiglio) => {
    const nuovo = c.stato === 'attivo' ? 'archiviato' : 'attivo'
    setLista(l => l.filter(x => x.id !== c.id))
    await fetch('/api/accademia/consigli', { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id: c.id, stato: nuovo }) }).catch(() => null)
    setGiro(g => g + 1)
  }

  const totale = Object.values(perTipo).reduce((s, n) => s + n, 0)
  const bookElenco = useMemo(() => Object.entries(perBook).sort((a, b) => (a[0] === '' ? -1 : b[0] === '' ? 1 : a[0].localeCompare(b[0]))), [perBook])
  const perGruppo = useMemo(() => {
    const m = new Map<string, Consiglio[]>()
    for (const c of lista) { const k = c.book || ''; m.set(k, [...(m.get(k) || []), c]) }
    return [...m.entries()].sort((a, b) => (a[0] === '' ? -1 : b[0] === '' ? 1 : a[0].localeCompare(b[0])))
  }, [lista])

  const chip = (attivo: boolean) => `rounded-full border px-3 py-1 text-xs font-semibold transition-colors ${attivo ? 'border-green-400 bg-green-500/20 text-green-200' : 'border-green-900/70 text-slate-400 hover:border-green-700'}`

  return (
    <section className="mb-5 rounded-xl border border-green-900/70 bg-[#07100a] p-4">
      <div className="mb-3 flex flex-wrap items-start justify-between gap-3">
        <div>
          <div className="font-bold text-green-300">&gt; 💡 CONSIGLI DELL&apos;ACCADEMIA</div>
          <div className="text-xs text-slate-500">
            Lucy legge i topic scelti (4 Chiacchiere, Bonus Expert, Bonus Casino) e raccoglie qui slot consigliate, consigli sulle promo, bug e schemi.
          </div>
          {stato && (
            <div className="mt-1 text-[11px] text-slate-500">
              Letti {Number(stato.messaggi_letti).toLocaleString('it-IT')} messaggi · fino al {fmtData(stato.ultimo_msg)} · ultima lettura {fmtData(stato.ultima_esecuzione)} · speso {Number(stato.costo_usd).toFixed(3)} $
              {stato.batch_saltati > 0 && <span className="text-amber-300"> · {stato.batch_saltati} blocchi saltati per errore</span>}
            </div>
          )}
          {stato?.ultimo_errore && <div className="mt-1 text-[11px] text-amber-300">Ultimo errore: {stato.ultimo_errore}</div>}
        </div>
        <div className="flex flex-wrap gap-2">
          <button disabled={!!lavoro} onClick={() => chiama('prova')} className="rounded-lg border border-green-700 px-3 py-1.5 text-xs font-semibold text-green-300 hover:bg-green-950/50 disabled:opacity-50">
            {lavoro === 'prova' ? '> controllo…' : '🔍 Controlla cosa leggerà'}
          </button>
          <button
            disabled={!!lavoro}
            onClick={() => { if (confirm('Lucy legge adesso i messaggi nuovi e spende pochi centesimi. Vuoi procedere?')) chiama('avvia') }}
            className="rounded-lg border border-green-400 bg-green-500/15 px-3 py-1.5 text-xs font-semibold text-green-200 hover:bg-green-500/25 disabled:opacity-50"
          >
            {lavoro === 'avvia' ? '> leggo… (può durare qualche minuto)' : '▶ Leggi ora'}
          </button>
        </div>
      </div>

      {esito && <div className="mb-3 rounded border border-green-900/70 bg-black/30 p-2 text-xs text-green-200">{esito}</div>}

      {prova && (
        <div className="mb-3 rounded border border-green-700/60 bg-black/30 p-3 text-xs text-slate-300">
          {prova.avviso ? (
            <>
              <div className="mb-1 font-semibold text-amber-300">{prova.avviso}</div>
              <div className="text-slate-400">Topic che ho trovato (dimmi quali vuoi che legga):</div>
              <ul className="mt-1 list-disc pl-5 text-slate-400">{prova.alternative.map(a => <li key={a}>{a}</li>)}</ul>
            </>
          ) : (
            <>
              <div className="mb-1 font-semibold text-green-300">Leggerà questi topic:</div>
              <ul className="space-y-0.5">
                {prova.trovati.map(t => (
                  <li key={`${t.chat}${t.topic}`}>{t.chat} / <b>{t.topic}</b> · {t.messaggi.toLocaleString('it-IT')} messaggi, da leggere {t.nuovi.toLocaleString('it-IT')}</li>
                ))}
              </ul>
              <div className="mt-2">
                Da leggere: <b>{prova.nuovi.toLocaleString('it-IT')}</b> messaggi · circa <b>{prova.blocchi}</b> blocchi · costo stimato <b>{prova.costoStimato.toFixed(2)} $</b>
              </div>
            </>
          )}
        </div>
      )}

      {errore && <div className="mb-3 rounded border border-amber-500/40 bg-amber-500/10 p-2 text-xs text-amber-300">{errore}</div>}

      <div className="mb-2 flex flex-wrap items-center gap-2">
        <button onClick={() => setTipo('')} className={chip(!tipo)}>Tutti ({totale})</button>
        {TIPI.map(t => <button key={t.k} onClick={() => setTipo(tipo === t.k ? '' : t.k)} className={chip(tipo === t.k)}>{t.nome} ({perTipo[t.k] || 0})</button>)}
      </div>
      <div className="mb-3 flex flex-wrap items-center gap-2">
        <select value={book} onChange={e => setBook(e.target.value)} className="rounded-lg border border-green-900/70 bg-black/40 px-2 py-1.5 text-xs text-slate-200">
          <option value="">Tutti i book</option>
          {bookElenco.map(([b, n]) => <option key={b || '__generale'} value={b || '__generale'}>{b ? maiuscola(b) : 'Generale (nessun book)'} ({n})</option>)}
        </select>
        <input value={ricerca} onChange={e => setRicerca(e.target.value)} placeholder="Cerca (slot, promo, parola…)" className="min-w-[200px] flex-1 rounded-lg border border-green-900/70 bg-black/40 px-3 py-1.5 text-xs text-slate-200 placeholder:text-slate-600" />
        <label className="flex items-center gap-1 text-xs text-slate-400">
          <input type="checkbox" checked={archiviati} onChange={e => setArchiviati(e.target.checked)} /> archiviati
        </label>
      </div>

      {carico && !lista.length && <div className="text-sm text-slate-500">&gt; carico…</div>}
      {!carico && !errore && !lista.length && (
        <div className="rounded border border-green-900/70 p-4 text-center text-sm text-slate-500">
          &gt; Nessun consiglio {tipo || book || q ? 'con questi filtri' : 'ancora: premi “Controlla cosa leggerà”, poi “Leggi ora”'}.
        </div>
      )}

      <div className="space-y-3">
        {perGruppo.map(([b, cons]) => (
          <details key={b || '__generale'} open={perGruppo.length <= 3 || !!book || !!q} className="rounded-lg border border-green-900/50 bg-black/20">
            <summary className="cursor-pointer select-none px-3 py-2 text-sm font-bold text-green-300">
              {b ? maiuscola(b) : 'Generale'} <span className="font-normal text-slate-500">· {cons.length}</span>
            </summary>
            <div className="space-y-2 p-2">
              {cons.map(c => {
                const aperto = aperti.has(c.id)
                return (
                  <article key={c.id} className="rounded-lg border border-green-900/60 bg-[#050b07] p-3">
                    <div className="mb-1 flex flex-wrap items-center gap-2 text-[11px]">
                      <span className="rounded bg-green-500/15 px-1.5 py-0.5 font-semibold text-green-300">{NOME_TIPO[c.tipo]}</span>
                      {c.scopo && <span className="rounded bg-sky-500/15 px-1.5 py-0.5 text-sky-300">{c.scopo}</span>}
                      {c.promo && <span className="rounded bg-violet-500/15 px-1.5 py-0.5 text-violet-300">{c.promo}</span>}
                      {c.da_staff && <span className="rounded bg-amber-500/15 px-1.5 py-0.5 text-amber-300">⭐ staff</span>}
                      <span className="text-slate-500">{c.n_fonti} {c.n_fonti === 1 ? 'messaggio' : 'messaggi'} · {fmtGiorno(c.ultima_data)}{c.topic_titolo ? ` · ${c.topic_titolo}` : ''}</span>
                    </div>
                    <div className="font-semibold text-slate-100">{c.titolo}</div>
                    <div className="mt-1 whitespace-pre-wrap text-sm text-slate-300">{c.consiglio}</div>
                    {c.dettagli && <div className="mt-1 whitespace-pre-wrap text-xs text-slate-400">{c.dettagli}</div>}
                    {c.autori.length > 0 && <div className="mt-1 text-[11px] text-slate-500">Da: {c.autori.slice(0, 5).join(', ')}{c.autori.length > 5 ? '…' : ''}</div>}
                    <div className="mt-2 flex flex-wrap items-center gap-3 text-[11px]">
                      {c.fonti.slice(0, 3).map((f, i) => f.l
                        ? <a key={i} href={f.l} target="_blank" rel="noreferrer" className="text-green-400 hover:underline">↗ Telegram {fmtGiorno(f.d)}</a>
                        : null)}
                      {c.fonti.length > 0 && <button onClick={() => setAperti(s => { const n = new Set(s); if (n.has(c.id)) n.delete(c.id); else n.add(c.id); return n })} className="text-slate-400 hover:underline">{aperto ? 'nascondi messaggi' : 'vedi messaggi'}</button>}
                      <button onClick={() => cambiaStato(c)} className="ml-auto text-slate-500 hover:text-amber-300">{c.stato === 'attivo' ? 'Archivia' : 'Ripristina'}</button>
                    </div>
                    {aperto && (
                      <ul className="mt-2 space-y-1 border-t border-green-900/50 pt-2 text-[11px] text-slate-400">
                        {c.fonti.map((f, i) => (
                          <li key={i}><span className="text-slate-500">{fmtData(f.d)} · {f.m || '?'}:</span> {f.x}{f.l && <> <a href={f.l} target="_blank" rel="noreferrer" className="text-green-400 hover:underline">↗</a></>}</li>
                        ))}
                      </ul>
                    )}
                  </article>
                )
              })}
            </div>
          </details>
        ))}
      </div>
    </section>
  )
}
