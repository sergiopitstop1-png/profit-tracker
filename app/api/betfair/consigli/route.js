// app/api/betfair/consigli/route.js
// ════════════════════════════════════════════════════════════════════
// LUCY TRADING (06/10/2026): riceve dal PC (trading_prematch.py) lo stato dell'analisi e i consigli di adesso.
// Stesso segreto della route delle quote (BETFAIR_SECRET). I consigli vengono sostituiti a ogni invio (restano pochi).
// Tabelle: lucy_trading_stato, lucy_trading_consigli (lucy_trading.sql)
// ════════════════════════════════════════════════════════════════════
const URL_DB = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL
const CHIAVE = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_KEY
const UTENTE = process.env.PT_USER_ID

const testo = (v, n = 300) => (v === null || v === undefined ? null : String(v).slice(0, n))
const numero = v => { if (v === null || v === undefined || v === '') return null; const n = Number(v); return Number.isFinite(n) ? n : null }
const dataIso = v => { const d = new Date(v); return Number.isNaN(d.getTime()) ? null : d.toISOString() }

async function db(percorso, opz = {}) {
  const r = await fetch(`${URL_DB}/rest/v1/${percorso}`, { ...opz, headers: { apikey: CHIAVE, Authorization: `Bearer ${CHIAVE}`, 'Content-Type': 'application/json', ...(opz.headers || {}) } })
  if (!r.ok) throw new Error(`${percorso.split('?')[0]}: ${r.status} ${(await r.text()).slice(0, 300)}`)
  return r.status === 204 ? null : r.json().catch(() => null)
}

export async function POST(req) {
  if (!process.env.BETFAIR_SECRET || req.headers.get('x-pt-segreto') !== process.env.BETFAIR_SECRET)
    return Response.json({ error: 'non autorizzato' }, { status: 401 })
  if (!URL_DB || !CHIAVE || !UTENTE)
    return Response.json({ error: 'configurazione server incompleta (PT_USER_ID / SUPABASE_SERVICE_ROLE_KEY)' }, { status: 500 })
  let body
  try { body = await req.json() } catch { return Response.json({ error: 'richiesta non valida' }, { status: 400 }) }
  try {
    const s = body?.stato
    if (s && typeof s === 'object') {
      const migliori = Array.isArray(s.migliori) ? s.migliori.slice(0, 8).map(m => ({ strategia: testo(m?.strategia, 200), n: numero(m?.n), media_pct: numero(m?.media_pct), z: numero(m?.z) })) : []
      await db('lucy_trading_stato?on_conflict=user_id', { method: 'POST', headers: { Prefer: 'resolution=merge-duplicates,return=minimal' }, body: JSON.stringify([{
        user_id: UTENTE, aggiornato: dataIso(s.aggiornato) || new Date().toISOString(), giorni_dati: numero(s.giorni_dati), partite_complete: numero(s.partite_complete),
        segmenti_testati: numero(s.segmenti_testati), segmenti_validi: numero(s.segmenti_validi), z_richiesto: numero(s.z_richiesto), min_giorni: numero(s.min_giorni),
        min_partite: numero(s.min_partite), commissione_pct: numero(s.commissione_pct), messaggio: testo(s.messaggio, 600), migliori }]) })
    }
    const cons = (Array.isArray(body?.consigli) ? body.consigli : []).slice(0, 30).map(c => ({
      user_id: UTENTE, event_id: testo(c?.event_id, 40), evento: testo(c?.evento, 200), inizio: dataIso(c?.inizio), tipo: testo(c?.tipo, 60), selezione: testo(c?.selezione, 120),
      direzione: testo(c?.direzione, 30), prezzo_entrata: numero(c?.prezzo_entrata), size_entrata: numero(c?.size_entrata), uscita_alle: dataIso(c?.uscita_alle),
      rend_atteso_pct: numero(c?.rend_atteso_pct), rend_min_pct: numero(c?.rend_min_pct), n: numero(c?.n), segmento: testo(c?.segmento, 300) }))
    if (Array.isArray(body?.consigli)) {
      await db(`lucy_trading_consigli?user_id=eq.${UTENTE}`, { method: 'DELETE', headers: { Prefer: 'return=minimal' } })
      if (cons.length) await db('lucy_trading_consigli', { method: 'POST', headers: { Prefer: 'return=minimal' }, body: JSON.stringify(cons) })
    }
    return Response.json({ ok: true, consigli: cons.length })
  } catch (e) {
    return Response.json({ ok: false, error: String(e.message || e).slice(0, 300) }, { status: 500 })
  }
}
