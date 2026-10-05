// app/api/betfair/quote/route.js
// ════════════════════════════════════════════════════════════════════
// BETFAIR QUOTE (06/10/2026): riceve dal servizio sul PC (betfair_quote.py) le ULTIME quote delle partite vicine
// e il "battito" del servizio. Non parla mai con Betfair (da Vercel Betfair blocca per zona geografica).
// Protezioni contro i costi:
//  • le quote si SOVRASCRIVONO (una riga per selezione), non si accumulano;
//  • se i mercati in tabella superano BETFAIR_MAX_MERCATI (di base 20000) risponde 507 e non scrive più;
//  • ogni ora cancella i mercati iniziati da più di 48 ore (le quote collegate spariscono con loro).
// Variabili Vercel: BETFAIR_SECRET (nuova, lunga e casuale), PT_USER_ID, SUPABASE_SERVICE_ROLE_KEY,
//                   NEXT_PUBLIC_SUPABASE_URL  (+ facoltativa BETFAIR_MAX_MERCATI)
// Riceve: { stato: {...}, mercati: [{market_id,...}], quote: [{market_id, selection_id, ...}] }
// Tabelle: betfair_mercati, betfair_quote_ultime, betfair_stato (betfair_quote.sql)
// ════════════════════════════════════════════════════════════════════
const URL_DB = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL
const CHIAVE = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_KEY
const UTENTE = process.env.PT_USER_ID
const MAX_MERCATI = Number(process.env.BETFAIR_MAX_MERCATI || 20000)
const ORE_CONSERVAZIONE = 48

let ultimaPulizia = 0

const testo = (v, n = 200) => (v === null || v === undefined ? null : String(v).slice(0, n))
const numero = v => { if (v === null || v === undefined || v === '') return null; const n = Number(v); return Number.isFinite(n) ? n : null }
const dataIso = v => { const d = new Date(v); return Number.isNaN(d.getTime()) ? null : d.toISOString() }

async function db(percorso, opz = {}) {
  const r = await fetch(`${URL_DB}/rest/v1/${percorso}`, { ...opz, headers: { apikey: CHIAVE, Authorization: `Bearer ${CHIAVE}`, 'Content-Type': 'application/json', ...(opz.headers || {}) } })
  if (!r.ok) throw new Error(`${percorso.split('?')[0]}: ${r.status} ${(await r.text()).slice(0, 300)}`)
  return r.status === 204 ? null : r.json().catch(() => null)
}

// conta le righe senza scaricarle (intestazione Content-Range)
async function contaMercati() {
  const r = await fetch(`${URL_DB}/rest/v1/betfair_mercati?select=market_id&user_id=eq.${UTENTE}&limit=1`, {
    headers: { apikey: CHIAVE, Authorization: `Bearer ${CHIAVE}`, Prefer: 'count=exact' } })
  if (!r.ok) throw new Error(`conteggio: ${r.status}`)
  const tot = Number(String(r.headers.get('content-range') || '').split('/')[1])
  return Number.isFinite(tot) ? tot : 0
}

const upsert = (tabella, conflitto, righe) => db(`${tabella}?on_conflict=${conflitto}`, {
  method: 'POST', headers: { Prefer: 'resolution=merge-duplicates,return=minimal' }, body: JSON.stringify(righe) })

export async function POST(req) {
  if (!process.env.BETFAIR_SECRET || req.headers.get('x-pt-segreto') !== process.env.BETFAIR_SECRET)
    return Response.json({ error: 'non autorizzato' }, { status: 401 })
  if (!URL_DB || !CHIAVE || !UTENTE)
    return Response.json({ error: 'configurazione server incompleta (PT_USER_ID / SUPABASE_SERVICE_ROLE_KEY)' }, { status: 500 })
  let body
  try { body = await req.json() } catch { return Response.json({ error: 'richiesta non valida' }, { status: 400 }) }

  try {
    // 1) battito del servizio: si registra sempre, anche se il resto viene rifiutato
    const s = body?.stato
    if (s && typeof s === 'object') {
      await upsert('betfair_stato', 'user_id', [{
        user_id: UTENTE, ultimo_aggiornamento: dataIso(s.ultimo_aggiornamento) || new Date().toISOString(),
        mercati_attivi: numero(s.mercati_attivi), versione: testo(s.versione, 80), messaggio: testo(s.messaggio, 300),
        ritardata: typeof s.ritardata === 'boolean' ? s.ritardata : null }])
    }

    const mercati = new Map()
    for (const m of (Array.isArray(body?.mercati) ? body.mercati : []).slice(0, 1000)) {
      if (!m?.market_id || !m?.tipo) continue
      mercati.set(String(m.market_id), { user_id: UTENTE, market_id: testo(m.market_id, 40), event_id: testo(m.event_id, 40),
        evento: testo(m.evento), casa: testo(m.casa), ospite: testo(m.ospite), competizione: testo(m.competizione),
        tipo: testo(m.tipo, 60), nome_mercato: testo(m.nome_mercato), inizio: dataIso(m.inizio), aggiornato: new Date().toISOString() })
    }
    const quote = new Map()
    for (const q of (Array.isArray(body?.quote) ? body.quote : []).slice(0, 2000)) {
      if (!q?.market_id || q?.selection_id === undefined || q?.selection_id === null) continue
      quote.set(`${q.market_id}|${q.selection_id}`, { user_id: UTENTE, market_id: testo(q.market_id, 40), selection_id: numero(q.selection_id),
        nome: testo(q.nome, 120), back: numero(q.back), back_size: numero(q.back_size), lay: numero(q.lay), lay_size: numero(q.lay_size),
        ltp: numero(q.ltp), matched: numero(q.matched), stato: testo(q.stato, 30), in_gioco: !!q.in_gioco, ritardata: !!q.ritardata,
        letto: dataIso(q.letto) || new Date().toISOString() })
    }

    // 2) limite di righe: se superato, non scrive altro (il servizio sul PC continua a salvare lo storico locale)
    if (mercati.size || quote.size) {
      const tot = await contaMercati()
      if (tot > MAX_MERCATI) return Response.json({ ok: false, error: `limite righe superato (${tot} mercati)` }, { status: 507 })
    }

    // 3) prima i mercati, poi le quote (le quote dipendono dal mercato)
    if (mercati.size) await upsert('betfair_mercati', 'user_id,market_id', [...mercati.values()])
    if (quote.size) {
      try { await upsert('betfair_quote_ultime', 'user_id,market_id,selection_id', [...quote.values()]) }
      catch (e) {
        if (String(e.message).includes('23503')) return Response.json({ ok: false, error: 'mercati mancanti' }, { status: 409 })
        throw e
      }
    }

    // 4) pulizia oraria dei mercati vecchi
    if (Date.now() - ultimaPulizia > 3600 * 1000) {
      ultimaPulizia = Date.now()
      const limite = new Date(Date.now() - ORE_CONSERVAZIONE * 3600 * 1000).toISOString()
      await db(`betfair_mercati?user_id=eq.${UTENTE}&inizio=lt.${encodeURIComponent(limite)}`, { method: 'DELETE', headers: { Prefer: 'return=minimal' } })
    }
    return Response.json({ ok: true, mercati: mercati.size, quote: quote.size })
  } catch (e) {
    return Response.json({ ok: false, error: String(e.message || e).slice(0, 300) }, { status: 500 })
  }
}
