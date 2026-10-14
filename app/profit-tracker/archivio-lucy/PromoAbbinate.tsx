'use client'
// 14/10/2026 · 🎯 Promo segnalate: per ogni segnalazione del topic "Segnalazione Promo" mostra a quali clienti
// è arrivata (mail o SMS) e a quali no. Il calcolo lo fa /api/accademia/promo-abbinate al momento.
import { useEffect, useState } from 'react'

type Arrivata = { cliente: string; canale: 'MAIL' | 'SMS'; quando: string; titolo: string; book: string; forza: 'forte' | 'probabile' }
type Segnalazione = {
  id: number; data: string; gruppo: string | null; topic: string | null; mittente: string | null; link: string | null
  testo: string; testo_immagine: string | null; book: string[]
  arrivata_a: Arrivata[]; non_arrivata_a: string[]; limitati_bonus: string[]
}
type Risposta = {
  giorni: number; segnalazioni: Segnalazione[]; comunicazioni_considerate: number
  riepilogo: { totale: number; con_ricevute: number; nessuno: number; senza_book_riconosciuto: number }
}

const quando = (iso: string) => new Date(iso).toLocaleString('it-IT', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })

export default function PromoAbbinate() {
  const [giorni, setGiorni] = useState(14)
  const [giro, setGiro] = useState(0)
  const [filtro, setFiltro] = useState<'tutte' | 'ricevute' | 'nessuno'>('tutte')
  const [aperte, setAperte] = useState<Set<number>>(new Set())
  // ogni esito porta la richiesta (giorni + giro) a cui risponde: "in caricamento" = l'ultimo esito è di una richiesta vecchia
  const chiave = `${giorni}-${giro}`
  const [esito, setEsito] = useState<{ chiave: string; dati: Risposta | null; errore: string } | null>(null)
  const carico = !esito || esito.chiave !== chiave
  const dati = esito?.dati ?? null
  const errore = esito && esito.chiave === chiave ? esito.errore : ''

  useEffect(() => {
    let vivo = true
    fetch(`/api/accademia/promo-abbinate?giorni=${giorni}`)
      .then(async r => { const j = await r.json().catch(() => null); if (!r.ok) throw new Error(j?.error || `errore ${r.status}`); return j })
      .then(j => { if (vivo) setEsito({ chiave, dati: j, errore: '' }) })
      .catch(e => { if (vivo) setEsito({ chiave, dati: null, errore: String(e?.message || e) }) })
    return () => { vivo = false }
  }, [giorni, giro, chiave])

  const lista = (dati?.segnalazioni || []).filter(s => filtro === 'tutte' || (filtro === 'ricevute' ? s.arrivata_a.length > 0 : s.arrivata_a.length === 0))
  const alterna = (id: number) => setAperte(prev => { const x = new Set(prev); if (x.has(id)) x.delete(id); else x.add(id); return x })

  return (
    <div className="mb-6 rounded-xl border border-green-900/70 bg-[#07100a] p-4 text-slate-200">
      <div className="mb-3 flex flex-wrap items-center gap-3">
        <div className="font-bold text-green-300">&gt; PROMO SEGNALATE ↔ MAIL E SMS</div>
        <select value={giorni} onChange={e => setGiorni(Number(e.target.value))} className="rounded border border-green-900/70 bg-black px-2 py-1 text-xs text-green-200">
          {[7, 14, 30, 45].map(g => <option key={g} value={g}>ultimi {g} giorni</option>)}
        </select>
        {(['tutte', 'ricevute', 'nessuno'] as const).map(f => (
          <button key={f} onClick={() => setFiltro(f)} className={`rounded border px-2 py-1 text-xs ${filtro === f ? 'border-green-400 bg-green-500/20 text-green-200' : 'border-green-900/70 text-slate-400 hover:border-green-700'}`}>
            {f === 'tutte' ? 'Tutte' : f === 'ricevute' ? 'Arrivate a qualcuno' : 'Arrivate a nessuno'}
          </button>
        ))}
        <button onClick={() => setGiro(g => g + 1)} disabled={carico} className="rounded border border-green-900/70 px-2 py-1 text-xs text-green-300 hover:border-green-700 disabled:opacity-50">↻ Aggiorna</button>
      </div>

      {dati && (
        <div className="mb-3 text-xs text-slate-400">
          {dati.riepilogo.totale} segnalazioni con un book riconosciuto · <span className="text-green-300">{dati.riepilogo.con_ricevute} arrivate a qualcuno</span> · <span className="text-amber-300">{dati.riepilogo.nessuno} a nessuno</span>
          {dati.riepilogo.senza_book_riconosciuto > 0 && <> · {dati.riepilogo.senza_book_riconosciuto} messaggi senza book riconosciuto (non mostrati)</>}
          {' '}· confrontate {dati.comunicazioni_considerate} mail/SMS
        </div>
      )}
      {carico && <div className="text-sm text-green-300">Confronto in corso…</div>}
      {errore && <div className="rounded border border-red-900 bg-red-950/40 p-2 text-sm text-red-300">{errore}</div>}
      {dati && !carico && lista.length === 0 && <div className="text-sm text-slate-400">Nessuna segnalazione da mostrare con questo filtro.</div>}

      <div className="flex flex-col gap-3">
        {lista.map(s => {
          const aperta = aperte.has(s.id)
          return (
            <div key={s.id} className="rounded-lg border border-green-900/60 bg-black/40 p-3">
              <div className="flex flex-wrap items-center gap-2 text-xs">
                <span className="text-slate-400">{quando(s.data)}</span>
                {s.book.map(b => <span key={b} className="rounded bg-green-500/20 px-2 py-0.5 font-bold text-green-200">{b}</span>)}
                <span className="text-slate-500">{s.mittente || ''}{s.topic ? ` · # ${s.topic}` : ''}</span>
                {s.link && <a href={s.link} target="_blank" rel="noreferrer" className="text-green-400 hover:underline">apri su Telegram</a>}
              </div>
              <div className="mt-1 whitespace-pre-wrap text-sm text-slate-200">
                {(aperta ? s.testo : s.testo.slice(0, 220)) || (s.testo_immagine ? '[segnalazione in immagine]' : '')}
                {!aperta && s.testo.length > 220 ? '…' : ''}
              </div>
              {s.testo_immagine && (
                <div className="mt-1 whitespace-pre-wrap rounded bg-green-950/30 p-2 text-xs text-green-100/80">
                  📷 {aperta ? s.testo_immagine : s.testo_immagine.slice(0, 260)}{!aperta && s.testo_immagine.length > 260 ? '…' : ''}
                </div>
              )}
              {(s.testo.length > 220 || (s.testo_immagine || '').length > 260) && (
                <button onClick={() => alterna(s.id)} className="mt-1 text-xs text-green-400 hover:underline">{aperta ? 'riduci' : 'leggi tutto'}</button>
              )}

              <div className="mt-2 grid grid-cols-1 gap-3 md:grid-cols-2">
                <div>
                  <div className="mb-1 text-xs font-bold text-green-300">✅ ARRIVATA A {s.arrivata_a.length}</div>
                  {s.arrivata_a.length === 0 && <div className="text-xs text-slate-500">nessuna mail o SMS trovata</div>}
                  <ul className="flex flex-col gap-0.5 text-xs">
                    {s.arrivata_a.map(a => (
                      <li key={`${a.cliente}-${a.quando}`} title={a.titolo} className="truncate">
                        <b className="text-slate-100">{a.cliente}</b>{' '}
                        <span className="text-slate-400">{a.canale === 'SMS' ? '💬' : '✉️'} {quando(a.quando)}</span>{' '}
                        {a.forza === 'probabile' && <span className="rounded border border-amber-700/60 px-1 text-amber-300">da verificare</span>}{' '}
                        <span className="text-slate-500">{a.titolo}</span>
                      </li>
                    ))}
                  </ul>
                </div>
                <div>
                  <div className="mb-1 text-xs font-bold text-amber-300">❌ NON ARRIVATA A {s.non_arrivata_a.length}</div>
                  {s.non_arrivata_a.length === 0 && <div className="text-xs text-slate-500">nessuno: tutti i clienti con questo book l&apos;hanno ricevuta</div>}
                  <div className="text-xs text-slate-300">{s.non_arrivata_a.join(' · ')}</div>
                  {s.limitati_bonus.length > 0 && <div className="mt-1 text-[11px] text-slate-500">Non contati (limitati ai bonus): {s.limitati_bonus.join(' · ')}</div>}
                </div>
              </div>
            </div>
          )
        })}
      </div>
      <div className="mt-3 text-[11px] text-slate-500">
        L&apos;abbinamento si basa su book e date (mail/SMS da 2 giorni prima a 5 dopo la segnalazione), non sul testo esatto: «da verificare» = stesso book e periodo ma importo o parole non coincidenti. Una riservata può arrivare anche solo come notifica nell&apos;app: «non arrivata» vuol dire nessuna mail o SMS trovata.
      </div>
    </div>
  )
}
