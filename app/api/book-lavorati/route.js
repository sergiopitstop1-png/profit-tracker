// app/api/book-lavorati/route.js
// ════════════════════════════════════════════════════════════════════
// BOOK LAVORATI (27/09/2026): riceve dallo script sul PC i siti dei book aperti in primo piano sui telefoni
// e registra "conto usato oggi" in book_attivita. Protetta da una chiave segreta (BOOK_LAVORATI_SECRET).
// Variabili Vercel: BOOK_LAVORATI_SECRET, PT_USER_ID, SUPABASE_SERVICE_ROLE_KEY, NEXT_PUBLIC_SUPABASE_URL
// Riceve: { voci: [{ intestatario, host, visto }] }   (solo il nome del sito, mai l'indirizzo completo)
// ════════════════════════════════════════════════════════════════════
const URL_DB = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL
const CHIAVE = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_KEY
const UTENTE = process.env.PT_USER_ID

// siti con un nome diverso dal book (aggiungere qui se serve): etichetta del dominio → nome del book normalizzato
// 05/10/2026: 888 ha più domini (888casino.it, 888poker.it, 888sport.it) ma in Books c'è un solo conto "888sport"
const ALIAS = { '888casino': '888sport', '888poker': '888sport', '888': '888sport' }

const norm = s => String(s || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9]/g, '')
function etichetta(host) {
  const parti = String(host || '').toLowerCase().replace(/^www\./, '').split('.').filter(Boolean)
  if (parti.length < 2) return norm(parti[0])
  return norm(parti[parti.length - 2])          // sport.lottomatica.it → lottomatica
}
const SEMBRA_BOOK = /(bet|casin|gioc|slot|poker|sport|win|lotto|bingo|scommess|stake|snai|sisal|eurobet|bwin)/i

async function db(percorso, opz = {}) {
  const r = await fetch(`${URL_DB}/rest/v1/${percorso}`, { ...opz, headers: { apikey: CHIAVE, Authorization: `Bearer ${CHIAVE}`, 'Content-Type': 'application/json', ...(opz.headers || {}) } })
  if (!r.ok) throw new Error(`${percorso}: ${r.status} ${await r.text()}`)
  return r.status === 204 ? null : r.json().catch(() => null)
}

export async function POST(req) {
  if (!process.env.BOOK_LAVORATI_SECRET || req.headers.get('x-pt-segreto') !== process.env.BOOK_LAVORATI_SECRET)
    return Response.json({ error: 'non autorizzato' }, { status: 401 })
  if (!URL_DB || !CHIAVE || !UTENTE) return Response.json({ error: 'configurazione server incompleta (PT_USER_ID / SUPABASE_SERVICE_ROLE_KEY)' }, { status: 500 })
  let body
  try { body = await req.json() } catch { return Response.json({ error: 'richiesta non valida' }, { status: 400 }) }
  const voci = (Array.isArray(body?.voci) ? body.voci : []).slice(0, 500)
  if (!voci.length) return Response.json({ ok: true, registrati: 0 })

  const books = await db('books?select=id,nome,intestatario')
  const perIntest = new Map()
  for (const b of books || []) { const k = norm(b.intestatario); if (!perIntest.has(k)) perIntest.set(k, []); perIntest.get(k).push(b) }

  const righe = new Map(), sconosciuti = new Map()
  for (const v of voci) {
    const et = ALIAS[etichetta(v.host)] || etichetta(v.host)
    if (!String(v.host || '').startsWith('pkg:') && (!et || et.length < 3)) continue
    const visto = new Date(v.visto || Date.now())
    const data = visto.toLocaleDateString('sv-SE', { timeZone: 'Europe/Rome' })
    // intestatario: uguale, oppure uno inizia con l'altro (es. "Nicola Gandin" ↔ "Nicola Gandin Sanson")
    // un telefono può valere per più nomi, separati da "|" (es. "Giampaolo Rizzieri|Paolo Rizzieri")
    const candidati = String(v.intestatario || '').split('|').map(norm).filter(Boolean).flatMap(ni =>
      perIntest.get(ni) || [...perIntest.entries()].filter(([k]) => ni.length >= 6 && (k.startsWith(ni) || ni.startsWith(k))).flatMap(([, l]) => l))
    // app di un book (es. "pkg:it.bet365.android"): il nome del book deve comparire nel nome dell'app
    const pk = String(v.host || '').startsWith('pkg:') ? norm(String(v.host).slice(4)) : ''
    const book = pk
      ? candidati.find(b => { const n = norm(b.nome); return n.length >= 4 && pk.includes(n) })
      : (candidati.find(b => norm(b.nome) === et) || candidati.find(b => { const n = norm(b.nome); return n.length >= 4 && (n.startsWith(et) || et.startsWith(n)) }))
    if (book) righe.set(`${book.id}|${data}`, { user_id: UTENTE, book_id: book.id, data, fonte: 'telefono', ultimo_visto: visto.toISOString(), host: String(v.host).startsWith('pkg:') ? null : String(v.host).slice(0, 120) })
    else if (SEMBRA_BOOK.test(v.host)) sconosciuti.set(`${v.intestatario}|${v.host}`, { user_id: UTENTE, intestatario: String(v.intestatario || '').replace(/\|/g, ' / ').slice(0, 80), host: String(v.host).slice(0, 120), visto: visto.toISOString() })
  }
  if (righe.size) await db('book_attivita?on_conflict=user_id,book_id,data,fonte', { method: 'POST', headers: { Prefer: 'resolution=merge-duplicates,return=minimal' }, body: JSON.stringify([...righe.values()]) })
  if (sconosciuti.size) await db('book_attivita_sconosciuti?on_conflict=user_id,intestatario,host', { method: 'POST', headers: { Prefer: 'resolution=merge-duplicates,return=minimal' }, body: JSON.stringify([...sconosciuti.values()]) })
  return Response.json({ ok: true, registrati: righe.size, sconosciuti: [...sconosciuti.values()].map(x => `${x.intestatario}: ${x.host}`) })
}
