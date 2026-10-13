// app/api/griglia/route.js
// ════════════════════════════════════════════════════════════════════
// GRIGLIA (13/10/2026): la mini griglia sul PC dei telefoni legge, SENZA prendersi i comandi, quelli che interessano a lei
// ("apri" / "app" = mostra i telefoni di quell'operazione · "griglia_fatto" = toglie il telefono di un cliente).
// Non cambia lo stato dei comandi: l'agente book_lavorati continua a eseguirli come prima.
// GET ?dopo=ID → { ultimo, comandi: [{ id, azione, intestatari }] } con id > ID, creati negli ultimi 10 minuti.
//   dopo=-1 → solo { ultimo } (la griglia parte da lì e non rilegge i comandi vecchi).
// Protetta dalla stessa chiave di book-lavorati (BOOK_LAVORATI_SECRET).
// ════════════════════════════════════════════════════════════════════
const URL_DB = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL
const CHIAVE = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_KEY
export const dynamic = 'force-dynamic'

async function db(percorso) {
  const r = await fetch(`${URL_DB}/rest/v1/${percorso}`, { cache: 'no-store', headers: { apikey: CHIAVE, Authorization: `Bearer ${CHIAVE}` } })
  if (!r.ok) throw new Error(`${percorso}: ${r.status} ${await r.text()}`)
  return r.json()
}
const autorizzato = req => !!process.env.BOOK_LAVORATI_SECRET && req.headers.get('x-pt-segreto') === process.env.BOOK_LAVORATI_SECRET

export async function GET(req) {
  if (!autorizzato(req)) return Response.json({ error: 'non autorizzato' }, { status: 401 })
  try {
    const dopo = Number(new URL(req.url).searchParams.get('dopo'))
    if (!Number.isFinite(dopo) || dopo < 0) {
      const u = await db('comandi_telefoni?select=id&order=id.desc&limit=1')
      return Response.json({ ultimo: u?.[0]?.id || 0, comandi: [] })
    }
    const da = new Date(Date.now() - 10 * 60000).toISOString()
    const righe = await db(`comandi_telefoni?id=gt.${Math.floor(dopo)}&creato=gte.${encodeURIComponent(da)}&azione=in.(apri,app,griglia_fatto)&select=id,azione,intestatari&order=id.asc&limit=50`)
    // "ultimo" avanza anche sui comandi che non mi riguardano, così non li rivedo
    const u = await db(`comandi_telefoni?id=gt.${Math.floor(dopo)}&select=id&order=id.desc&limit=1`)
    return Response.json({ ultimo: Math.max(Math.floor(dopo), u?.[0]?.id || 0), comandi: righe || [] })
  } catch (e) {
    return Response.json({ error: String(e?.message || e).slice(0, 300) }, { status: 500 })
  }
}
