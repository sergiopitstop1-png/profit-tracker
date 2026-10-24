// app/api/registra-rapido/route.js
// ════════════════════════════════════════════════════════════════════
// REGISTRA AL VOLO (24/10/2026): il programmino sul PC (registra_rapido.py, tasto Alt+R) parla con il Profit Tracker da qui.
//  GET  → elenco dei conti per la ricerca nel programma: { conti: [{ id, nome, intestatario }] }
//  POST → { libri: [id…], tipo_op, importo, nota }: mette la voce in coda (tabella registra_coda).
//         Il Profit Tracker, quando e' aperto, la prende e la scrive nel Registro manuale.
// Stessa chiave segreta degli altri programmi sul PC (header x-pt-segreto = BOOK_LAVORATI_SECRET): niente da creare su Vercel.
// Variabili Vercel (gia' presenti): BOOK_LAVORATI_SECRET, PT_USER_ID, SUPABASE_SERVICE_ROLE_KEY, NEXT_PUBLIC_SUPABASE_URL
// Tabella: registra_coda (supabase/registra_coda.sql)
// ════════════════════════════════════════════════════════════════════
const URL_DB = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL
const CHIAVE = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_KEY
const UTENTE = process.env.PT_USER_ID

const TIPI = ['Sport', 'Casinò / slot', 'Ricarica', 'Promo / VXT', 'Altro']
const MAX_CONTI = 40
const MAX_IN_ATTESA = 200

async function db(percorso, opz = {}) {
  const r = await fetch(`${URL_DB}/rest/v1/${percorso}`, { ...opz, headers: { apikey: CHIAVE, Authorization: `Bearer ${CHIAVE}`, 'Content-Type': 'application/json', ...(opz.headers || {}) } })
  if (!r.ok) throw new Error(`${percorso.split('?')[0]}: ${r.status} ${(await r.text()).slice(0, 300)}`)
  return r.status === 204 ? null : r.json().catch(() => null)
}

const autorizzato = req => !!process.env.BOOK_LAVORATI_SECRET && req.headers.get('x-pt-segreto') === process.env.BOOK_LAVORATI_SECRET
const configurato = () => !!(URL_DB && CHIAVE && UTENTE)

export async function GET(req) {
  if (!autorizzato(req)) return Response.json({ error: 'non autorizzato' }, { status: 401 })
  if (!configurato()) return Response.json({ error: 'configurazione server incompleta (PT_USER_ID / SUPABASE_SERVICE_ROLE_KEY)' }, { status: 500 })
  try {
    const conti = []
    for (let off = 0; ; off += 1000) {     // Supabase da' al massimo 1000 righe per richiesta
      const pag = await db(`books?select=id,nome,intestatario&order=id.asc&limit=1000&offset=${off}`)
      conti.push(...(pag || []).map(b => ({ id: String(b.id), nome: b.nome || '', intestatario: b.intestatario || '' })))
      if (!pag || pag.length < 1000) break
    }
    return Response.json({ conti })
  } catch (e) {
    return Response.json({ error: String(e.message || e).slice(0, 300) }, { status: 500 })
  }
}

export async function POST(req) {
  if (!autorizzato(req)) return Response.json({ error: 'non autorizzato' }, { status: 401 })
  if (!configurato()) return Response.json({ error: 'configurazione server incompleta (PT_USER_ID / SUPABASE_SERVICE_ROLE_KEY)' }, { status: 500 })
  let body
  try { body = await req.json() } catch { return Response.json({ error: 'richiesta non valida' }, { status: 400 }) }
  const libri = [...new Set((Array.isArray(body?.libri) ? body.libri : []).map(x => String(x ?? '').trim()).filter(Boolean))]
  if (!libri.length || libri.length > MAX_CONTI) return Response.json({ error: `scegli da 1 a ${MAX_CONTI} conti` }, { status: 400 })
  const tipo = TIPI.includes(body?.tipo_op) ? body.tipo_op : 'Sport'
  const importo = String(body?.importo ?? '').replace(',', '.').trim().slice(0, 20)
  if (importo && !/^\d+(\.\d+)?(\s*[\/\-–]\s*\d+(\.\d+)?)?$/.test(importo)) return Response.json({ error: 'importo non valido: scrivi un numero (10) o un intervallo (5/15)' }, { status: 400 })
  const nota = String(body?.nota ?? '').trim().slice(0, 200)
  try {
    const tot = await db(`registra_coda?select=id&user_id=eq.${UTENTE}&stato=eq.attesa&limit=${MAX_IN_ATTESA + 1}`)
    if ((tot || []).length > MAX_IN_ATTESA) return Response.json({ error: 'troppe voci in attesa: apri il Profit Tracker per smaltirle' }, { status: 429 })
    const r = await db('registra_coda?select=id', { method: 'POST', headers: { Prefer: 'return=representation' }, body: JSON.stringify([{ user_id: UTENTE, book_ids: libri, tipo_op: tipo, importo: importo || null, nota: nota || null }]) })
    return Response.json({ ok: true, id: r?.[0]?.id ?? null })
  } catch (e) {
    return Response.json({ error: String(e.message || e).slice(0, 300) }, { status: 500 })
  }
}
