// app/api/agente/route.js
// ════════════════════════════════════════════════════════════════════
// AGENTE TELEFONI (28/09/2026): coda dei comandi dal Profit Tracker allo script sul PC.
// GET  → lo script prende i comandi nuovi (li segna "in corso")
// POST → lo script restituisce l'esito { id, esito: { "Nome Cognome": "aperto" | "telefono non collegato" | … } }
// Protetta dalla stessa chiave di book-lavorati (BOOK_LAVORATI_SECRET).
// ════════════════════════════════════════════════════════════════════
const URL_DB = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL
const CHIAVE = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_KEY

async function db(percorso, opz = {}) {
  const r = await fetch(`${URL_DB}/rest/v1/${percorso}`, { ...opz, headers: { apikey: CHIAVE, Authorization: `Bearer ${CHIAVE}`, 'Content-Type': 'application/json', Prefer: 'return=representation', ...(opz.headers || {}) } })
  if (!r.ok) throw new Error(`${percorso}: ${r.status} ${await r.text()}`)
  return r.status === 204 ? null : r.json().catch(() => null)
}
const autorizzato = req => !!process.env.BOOK_LAVORATI_SECRET && req.headers.get('x-pt-segreto') === process.env.BOOK_LAVORATI_SECRET

export async function GET(req) {
  if (!autorizzato(req)) return Response.json({ error: 'non autorizzato' }, { status: 401 })
  // solo comandi recenti (10 minuti): un comando dimenticato non deve aprire pagine ore dopo
  const da = new Date(Date.now() - 10 * 60000).toISOString()
  const comandi = await db(`comandi_telefoni?stato=eq.nuovo&creato=gte.${encodeURIComponent(da)}&select=id,azione,url,intestatari&order=id.asc&limit=20`)
  if (comandi?.length) await db(`comandi_telefoni?id=in.(${comandi.map(c => c.id).join(',')})`, { method: 'PATCH', body: JSON.stringify({ stato: 'in_corso' }) })
  return Response.json({ comandi: comandi || [] })
}

export async function POST(req) {
  if (!autorizzato(req)) return Response.json({ error: 'non autorizzato' }, { status: 401 })
  const b = await req.json().catch(() => null)
  if (!b?.id) return Response.json({ error: 'richiesta non valida' }, { status: 400 })
  await db(`comandi_telefoni?id=eq.${Number(b.id)}`, { method: 'PATCH', body: JSON.stringify({ stato: 'fatto', esito: b.esito || {}, eseguito: new Date().toISOString() }) })
  return Response.json({ ok: true })
}
