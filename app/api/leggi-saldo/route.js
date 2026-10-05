// app/api/leggi-saldo/route.js
// ════════════════════════════════════════════════════════════════════
// 📸 LEGGI SALDI (28/09/2026): lo script sul PC manda lo screenshot del book APERTO su un telefono
// (aperto da Sergio a mano o dal Profit Tracker, con login fatto a mano). Qui:
//   1. si riconosce il conto: cliente del telefono + sito (o app) in primo piano
//   2. Claude Haiku legge il saldo dallo screenshot
//   3. NON scrive niente (28/09/2026): restituisce la lettura; Sergio conferma nel Profit Tracker, che poi scrive
//      il saldo con una riga "correzione automatica" in Transazioni. Differenze oltre SOGLIA: "da controllare".
// Lo screenshot NON viene salvato. Protetta da BOOK_LAVORATI_SECRET. Costo ~0,2 centesimi a lettura.
// 05/10/2026: alias dei domini (come /api/book-lavorati) e, con il filtro di un book, PRIMA si controlla
// che il sito aperto sia quel book (altrimenti "saltato", senza chiamare l'AI), POI si cerca il conto.
// ════════════════════════════════════════════════════════════════════
const MODELLO = 'claude-haiku-4-5-20251001'
const SOGLIA = 1000   // € — oltre questa differenza non scrivo da solo (possibile lettura sbagliata)
const URL_DB = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL
const CHIAVE = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_KEY

const SYSTEM = `Leggi il SALDO di un conto gioco da uno screenshot di un bookmaker italiano (sito o app, visto da telefono).
Cerca la cifra in euro del saldo del conto: di solito in alto vicino all'utente o nel menu del conto, con scritte come
"Saldo", "Saldo conto", "Saldo totale", "Conto", "Disponibile", "Prelevabile", oppure solo una cifra in € accanto all'icona dell'utente.
- "saldo": il saldo in soldi reali del conto (se ci sono saldo reale e bonus separati, qui il reale; se c'è una sola cifra, quella).
- "bonus": l'eventuale saldo bonus/fun mostrato a parte, altrimenti null.
- Se il saldo NON si vede (pagina in caricamento, non loggato, saldo nascosto con asterischi o occhio, schermo nero, popup che copre),
  metti "saldo": null e spiega in "motivo" in poche parole (es. "non loggato", "saldo nascosto", "pagina in caricamento").
- Non inventare: se non sei sicuro della cifra, saldo null.
Rispondi SOLO con JSON: {"saldo": 123.45 | null, "bonus": 0 | null, "motivo": "breve", "testo": "la scritta esatta che hai letto accanto alla cifra"}`

const norm = s => String(s || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9]/g, '')
// siti con un nome diverso dal book: etichetta del dominio → nome del book normalizzato (uguale in /api/book-lavorati)
const ALIAS = { '888casino': '888sport', '888poker': '888sport', '888': '888sport' }
const etichetta = host => { const p = String(host || '').toLowerCase().replace(/^www\./, '').split('.').filter(Boolean); const e = norm(p.length < 2 ? p[0] : p[p.length - 2]); return ALIAS[e] || e }
// il sito (o l'app) aperto è questo book?
function eQuelBook(host, nomeBook) {
  const n = norm(nomeBook), h = String(host || '')
  if (!n) return false
  if (h.startsWith('pkg:')) return n.length >= 4 && norm(h.slice(4)).includes(n)
  const et = etichetta(h)
  return !!et && (et === n || (n.length >= 4 && (n.startsWith(et) || et.startsWith(n))))
}
const euro = v => Number(v || 0).toLocaleString('it-IT', { style: 'currency', currency: 'EUR' })

async function db(percorso, opz = {}) {
  const r = await fetch(`${URL_DB}/rest/v1/${percorso}`, { ...opz, headers: { apikey: CHIAVE, Authorization: `Bearer ${CHIAVE}`, 'Content-Type': 'application/json', Prefer: 'return=representation', ...(opz.headers || {}) } })
  if (!r.ok) throw new Error(`${percorso}: ${r.status} ${await r.text()}`)
  return r.status === 204 ? null : r.json().catch(() => null)
}

// 05/10/2026: Supabase restituisce al massimo 1000 righe per richiesta → legge i book a pagine (oltre 1000 conti)
async function tuttiIBooks(colonne) {
  const out = []
  for (let off = 0; ; off += 1000) {
    const pag = await db(`books?select=${colonne}&order=id.asc&limit=1000&offset=${off}`)
    out.push(...(pag || []))
    if (!pag || pag.length < 1000) break
  }
  return out
}

// conto aperto: nomi del telefono ("A|B") + sito o "pkg:app"
async function trovaConto(intestatario, host) {
  let books
  try { books = await tuttiIBooks('id,nome,intestatario,saldo,saldo_cambiato_at') }   // colonna di saldo_fermo.sql · 05/10/2026: tutti i book
  catch { books = await tuttiIBooks('id,nome,intestatario,saldo') }
  const nomi = String(intestatario || '').split('|').map(norm).filter(Boolean)
  const cand = books.filter(b => { const k = norm(b.intestatario); return nomi.some(n => k === n || (n.length >= 6 && (k.startsWith(n) || n.startsWith(k)))) })
  const h = String(host || '')
  if (h.startsWith('pkg:')) return cand.find(b => eQuelBook(h, b.nome)) || null
  const et = etichetta(h)
  return cand.find(b => norm(b.nome) === et) || cand.find(b => eQuelBook(h, b.nome)) || null
}

async function leggi(img) {
  const tipo = img.startsWith('/9j/') ? 'image/jpeg' : 'image/png'
  const r = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'x-api-key': process.env.ANTHROPIC_API_KEY, 'anthropic-version': '2023-06-01' },
    body: JSON.stringify({ model: MODELLO, max_tokens: 200, system: SYSTEM, messages: [{ role: 'user', content: [{ type: 'image', source: { type: 'base64', media_type: tipo, data: img } }, { type: 'text', text: 'Leggi il saldo.' }] }] }),
  })
  const data = await r.json()
  if (!r.ok) throw new Error(data?.error?.message || 'errore Claude API')
  const t = (data.content || []).filter(c => c.type === 'text').map(c => c.text).join('').replace(/```json|```/g, '').trim()
  const out = JSON.parse(t.slice(t.indexOf('{'), t.lastIndexOf('}') + 1))
  const num = v => (v === null || v === undefined || v === '' ? null : (Number.isFinite(Number(String(v).replace(',', '.'))) ? Math.round(Number(String(v).replace(',', '.')) * 100) / 100 : null))
  return { saldo: num(out.saldo), bonus: num(out.bonus), motivo: String(out.motivo || '').slice(0, 120) }
}

export async function POST(req) {
  if (!process.env.BOOK_LAVORATI_SECRET || req.headers.get('x-pt-segreto') !== process.env.BOOK_LAVORATI_SECRET)
    return Response.json({ error: 'non autorizzato' }, { status: 401 })
  const b = await req.json().catch(() => null)
  const img = String(b?.immagine || '')
  if (!img || img.length > 3_000_000) return Response.json({ error: 'immagine mancante o troppo grande' }, { status: 400 })

  // 05/10/2026: con il filtro di un book, un telefono che ha aperto un ALTRO book si salta subito
  if (b?.filtro && !eQuelBook(b?.host, b.filtro)) {
    const h = String(b?.host || '')
    return Response.json({ esito: 'saltato', book: h.startsWith('pkg:') ? h.slice(4) : h.replace(/^www\./, '') })
  }

  const conto = await trovaConto(b?.intestatario, b?.host)
  if (!conto) return Response.json({ esito: 'conto non trovato', motivo: `nessun conto per "${String(b?.intestatario || '').replace(/\|/g, ' / ')}" su ${b?.host}` })
  if (b?.filtro && norm(conto.nome) !== norm(b.filtro)) return Response.json({ esito: 'saltato', book: conto.nome })

  let l
  try { l = await leggi(img) } catch (e) { return Response.json({ esito: 'non letto', book: conto.nome, intestatario: conto.intestatario, motivo: 'lettura non riuscita' }) }
  const base = { book_id: conto.id, book: conto.nome, intestatario: conto.intestatario, prec: Number(conto.saldo || 0), bonus: l.bonus }
  if (l.saldo === null) return Response.json({ ...base, esito: 'non letto', motivo: l.motivo || 'saldo non visibile' })

  const prec = Number(conto.saldo || 0), nuovo = l.saldo, delta = Math.round((nuovo - prec) * 100) / 100
  const esito = delta === 0 ? 'invariato' : Math.abs(delta) > SOGLIA ? 'da controllare' : 'cambiato'
  return Response.json({ ...base, saldo: nuovo, delta, esito, cambiato_at: conto.saldo_cambiato_at || null,
    motivo: esito === 'da controllare' ? `differenza di ${euro(delta)}: controlla bene prima di confermare` : '' })
}
