// ════════════════════════════════════════════════════════════════════
// BETFAIR STATO (06/10/2026) · una riga in Dashboard che dice se le quote Betfair sono fresche.
// Legge la tabella betfair_stato (la riga scritta dal servizio sul PC ogni ~30 secondi).
//  • tutto bene            → riga piccola e discreta: "Quote Betfair · aggiornate 20 s fa · 742 mercati"
//  • ferme da oltre 3 min  → avviso arancione
//  • ferme da oltre 10 min → avviso rosso (PC spento, in sospensione o servizio fermo)
//  • il servizio segnala un problema (campo messaggio) → avviso con il testo
// Mettilo accanto a PromoBonus.jsx (usa lo stesso client Supabase).
// ════════════════════════════════════════════════════════════════════
import React, { useEffect, useState } from 'react'
import { supabase } from '../profit-tracker/supabaseClient'

const SOGLIA_ATTENZIONE_SEC = 180   // 3 minuti
const SOGLIA_FERMA_SEC = 600        // 10 minuti

// Funzione pura (si può provare da sola): dalla riga di betfair_stato al livello di allarme
export function valutaStato(riga, oraMs = Date.now()) {
  const nessuno = { livello: 'nessuno', sec: null, testo: 'Betfair: nessun dato (servizio mai avviato, oppure non leggibile da questo accesso)' }
  if (!riga || !riga.ultimo_aggiornamento) return nessuno
  const t = new Date(riga.ultimo_aggiornamento).getTime()
  if (!Number.isFinite(t)) return nessuno
  const sec = Math.max(0, Math.round((oraMs - t) / 1000))
  const min = Math.floor(sec / 60)
  const eta = sec < 90 ? `${sec} s fa` : sec < 7200 ? `${min} min fa` : `${Math.floor(min / 60)} h ${min % 60} min fa`
  const messaggio = riga.messaggio ? String(riga.messaggio) : ''
  if (sec > SOGLIA_FERMA_SEC) return { livello: 'ferma', sec, testo: `⛔ Quote Betfair FERME: ultimo aggiornamento ${eta}. Controlla che il PC sia acceso e il servizio in funzione.` }
  if (sec > SOGLIA_ATTENZIONE_SEC) return { livello: 'attenzione', sec, testo: `⚠️ Quote Betfair in ritardo: ultimo aggiornamento ${eta}.` }
  if (messaggio) return { livello: 'attenzione', sec, testo: `⚠️ Betfair: ${messaggio}` }
  return { livello: 'ok', sec, testo: `Quote Betfair · aggiornate ${eta} · ${riga.mercati_attivi ?? '?'} mercati${riga.ritardata ? ' · dati ritardati' : ''}` }
}
// FINE valutaStato

const STILI = {
  ok: { color: '#64748b', bg: 'transparent', border: 'transparent', size: 11, weight: 600 },
  attenzione: { color: '#fcd34d', bg: 'rgba(245,158,11,0.10)', border: 'rgba(245,158,11,0.55)', size: 12, weight: 800 },
  ferma: { color: '#fca5a5', bg: 'rgba(239,68,68,0.12)', border: 'rgba(239,68,68,0.65)', size: 13, weight: 900 },
  nessuno: { color: '#94a3b8', bg: 'rgba(100,116,139,0.10)', border: 'rgba(100,116,139,0.45)', size: 12, weight: 700 },
}

export default function BetfairStato() {
  const [riga, setRiga] = useState(undefined)   // undefined = sto caricando, null = nessuna riga
  const [, setTick] = useState(0)

  useEffect(() => {
    let vivo = true
    const carica = async () => {
      try {
        const { data, error } = await supabase.from('betfair_stato')
          .select('ultimo_aggiornamento,mercati_attivi,messaggio,ritardata,versione').limit(1).maybeSingle()
        if (vivo) setRiga(error ? null : (data || null))
      } catch {
        if (vivo) setRiga(null)
      }
    }
    carica()
    const ricarica = setInterval(carica, 30000)          // rilegge la tabella ogni 30 secondi
    const aggiorna = setInterval(() => setTick(n => n + 1), 15000)   // e ricalcola "x secondi fa" ogni 15
    return () => { vivo = false; clearInterval(ricarica); clearInterval(aggiorna) }
  }, [])

  if (riga === undefined) return null
  const s = valutaStato(riga)
  const st = STILI[s.livello]
  return (
    <div title={riga?.versione ? `Servizio: ${riga.versione}` : undefined}
      style={{ margin: s.livello === 'ok' ? '0 0 6px' : '0 0 12px', padding: s.livello === 'ok' ? '0 2px' : '8px 12px', borderRadius: 12,
        border: `1px solid ${st.border}`, background: st.bg, color: st.color, fontSize: st.size, fontWeight: st.weight }}>
      {s.testo}
    </div>
  )
}
