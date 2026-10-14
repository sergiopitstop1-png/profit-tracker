/* eslint-disable @typescript-eslint/no-explicit-any */
// 14/10/2026 · Promo segnalate ↔ mail e SMS dei clienti.
// Legge le segnalazioni del topic "Segnalazione Promo" (testo + testo letto dalle immagini), riconosce il book citato
// e cerca nelle mail e negli SMS dei clienti (stesso book, vicino nel tempo) chi l'ha ricevuta. Poi elenca i clienti
// che hanno quel book e NON risultano averla ricevuta. Calcolo al volo: non scrive niente e non usa l'AI.
// Solo admin. GET ?giorni=14 (da 3 a 45). GET ?nuove=1 = solo le promo nuove da quando hai attivato il popup e non ancora segnate «ok visto».
// POST {ids:[…]} segna come viste (tabella promo_segnalate_viste).
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { createServerClient } from '@supabase/ssr'

export const dynamic = 'force-dynamic'
export const maxDuration = 60

const admin = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, {
  auth: { persistSession: false, autoRefreshToken: false },
})

async function èAdmin(req: NextRequest) {
  const response = NextResponse.next()
  const supabase = createServerClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!, {
    cookies: {
      get(name) { return req.cookies.get(name)?.value },
      set(name, value, options) { response.cookies.set({ name, value, ...options }) },
      remove(name, options) { response.cookies.set({ name, value: '', ...options }) },
    },
  })
  const { data: { session } } = await supabase.auth.getSession()
  if (!session) return false
  const { data: profile } = await supabase.from('user_profiles').select('role').eq('id', session.user.id).single()
  return profile?.role === 'admin'
}

const GIORNO = 86400000
const TAB_VISTE = 'promo_segnalate_viste'   // chiave 'inizio' = da quando contano le nuove, 'msg:ID' = segnalazione già vista
const PRIMA_DELLA_SEGNALAZIONE = 2 * GIORNO   // la mail può arrivare prima che qualcuno la segnali
const DOPO_LA_SEGNALAZIONE = 5 * GIORNO
// comunicazioni operative sul conto (non sono promo): non contano come "promo ricevuta"
const CATEGORIE_OPERATIVE = new Set(['KYC', 'LIMITAZIONE', 'SOSPENSIONE', 'PRELIEVO', 'DEPOSITO', 'SICUREZZA', 'SCADENZA'])

const senzaAccenti = (s: any) => String(s ?? '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase()
const norm = (s: any) => senzaAccenti(s).replace(/[^a-z0-9]/g, '')
const tempo = (v: any) => { const t = v ? new Date(v).getTime() : NaN; return Number.isFinite(t) ? t : null }
function stessoCliente(a: string, b: string) {
  if (!a || !b) return false
  return a === b || (Math.min(a.length, b.length) >= 6 && (a.startsWith(b) || b.startsWith(a)))
}

// legge tutte le righe di una query a pagine da 1000 (limite di Supabase)
async function leggiTutto(pagina: (da: number, a: number) => PromiseLike<{ data: any[] | null; error: any }>, maxPagine = 8) {
  const out: any[] = []
  for (let i = 0; i < maxPagine; i++) {
    const { data, error } = await pagina(i * 1000, i * 1000 + 999)
    if (error) throw new Error(error.message)
    out.push(...(data || []))
    if (!data || data.length < 1000) break
  }
  return out
}

export async function GET(req: NextRequest) {
  if (!(await èAdmin(req))) return NextResponse.json({ error: 'Accesso riservato agli admin' }, { status: 403 })
  const soloNuove = req.nextUrl.searchParams.get('nuove') === '1'
  let giorni = Math.min(45, Math.max(3, Number(req.nextUrl.searchParams.get('giorni')) || 14))
  let inizioNuove = 0; const viste = new Set<number>()

  try {
    if (soloNuove) {
      // da quando contano le "nuove": la prima volta parte da adesso (la promo già presenti non fanno popup)
      const { data: riga, error: eI } = await admin.from(TAB_VISTE).select('visto_il').eq('chiave', 'inizio').maybeSingle()
      if (eI) return NextResponse.json({ nuove: [], errore: `tabella ${TAB_VISTE} non pronta: ${eI.message}` })
      if (!riga) {
        await admin.from(TAB_VISTE).upsert({ chiave: 'inizio' }, { onConflict: 'chiave', ignoreDuplicates: true })
        return NextResponse.json({ nuove: [], partito_ora: true })
      }
      inizioNuove = new Date(riga.visto_il).getTime()
      const rv = await leggiTutto((a, b) => admin.from(TAB_VISTE).select('chiave').like('chiave', 'msg:%').range(a, b))
      for (const r of rv) viste.add(Number(String(r.chiave).slice(4)))
      giorni = Math.min(45, Math.max(3, Math.ceil((Date.now() - inizioNuove) / GIORNO) + 4))   // + margine per riconoscere i doppioni
    }
    const dal = new Date(Date.now() - giorni * GIORNO).toISOString()
    const dalComunicazioni = new Date(Date.now() - giorni * GIORNO - PRIMA_DELLA_SEGNALAZIONE).toISOString()

    // 1. segnalazioni
    const { data: msg, error: eMsg } = await admin
      .from('accademia_messaggi')
      .select('id,chat_titolo,topic_titolo,data_msg,mittente,testo,testo_immagine,media_tipo,link')
      .or('topic_titolo.ilike.%segnalazion%promo%,topic_titolo.ilike.%promo%segnalazion%')
      .gte('data_msg', dal)
      .order('data_msg', { ascending: false })
      .limit(300)
    if (eMsg) return NextResponse.json({ error: `segnalazioni: ${eMsg.message}` }, { status: 500 })

    // 2. conti dei clienti (per riconoscere i book e sapere chi li ha)
    const books = await leggiTutto((a, b) => admin.from('books').select('nome,intestatario,note').range(a, b))
    let terminati = new Set<string>()
    try {
      const { data: cl } = await admin.from('clienti').select('nome,terminato')
      terminati = new Set((cl || []).filter((c: any) => c.terminato).map((c: any) => norm(c.nome)))
    } catch { /* tabella non disponibile: nessun cliente escluso */ }

    const nomiBook = new Map<string, string>()   // chiave normalizzata → nome da mostrare
    for (const b of books) {
      const k = norm(b.nome)
      if (k.length >= 3 && !nomiBook.has(k)) nomiBook.set(k, String(b.nome).trim())
    }
    // riconoscimento per parola intera (senza spazi si potrebbero unire pezzi di parole diverse)
    const regex = new Map<string, RegExp>()
    for (const [k, nome] of nomiBook) {
      const pezzi = senzaAccenti(nome).split(/[^a-z0-9]+/).filter(Boolean)
      if (pezzi.length) regex.set(k, new RegExp(`(?<![a-z0-9])${pezzi.join('[^a-z0-9]*')}(?![a-z0-9])`))
    }
    const bookNelTesto = (testo: string): string[] => {
      const t = senzaAccenti(testo)
      const trovati = [...regex.entries()].filter(([, r]) => r.test(t)).map(([k]) => k)
      return trovati.filter(k => !trovati.some(altro => altro !== k && altro.includes(k)))   // "bet365" batte "bet"
    }

    // 3. mail e SMS dei clienti (non IGNORA, non OTP, non comunicazioni operative)
    const mail = await leggiTutto((a, b) => admin.from('lucy_mail_archive')
      .select('id,cliente_nome,bookmaker,mittente,oggetto,data_mail,giudizio,categoria,bonus_importo')
      .gte('data_mail', dalComunicazioni).or('giudizio.is.null,giudizio.neq.IGNORA')
      .order('data_mail', { ascending: false }).range(a, b))
    const sms = await leggiTutto((a, b) => admin.from('sms_clienti')
      .select('id,cliente,bookmaker,tipo,testo,data_ricezione,giudizio,categoria,bonus_importo')
      .gte('data_ricezione', dalComunicazioni).or('giudizio.is.null,giudizio.neq.IGNORA').or('tipo.is.null,tipo.neq.OTP')
      .order('data_ricezione', { ascending: false }).range(a, b))

    type Comunicazione = { canale: 'MAIL' | 'SMS'; cliente: string; clienteKey: string; book: string[]; t: number; titolo: string; importo: number | null; paroleChiave: string[] }
    const comunicazioni: Comunicazione[] = []
    const parole = (s: string) => [...new Set(senzaAccenti(s).split(/[^a-z0-9]+/).filter(p => p.length >= 5))]
    for (const m of mail) {
      if (CATEGORIE_OPERATIVE.has(String(m.categoria || '').toUpperCase())) continue
      const t = tempo(m.data_mail); const cliente = String(m.cliente_nome || '').trim()
      if (t === null || !cliente) continue
      const book = m.bookmaker && nomiBook.has(norm(m.bookmaker)) ? [norm(m.bookmaker)] : bookNelTesto(`${m.oggetto || ''} ${m.mittente || ''} ${m.bookmaker || ''}`)
      if (!book.length) continue
      comunicazioni.push({ canale: 'MAIL', cliente, clienteKey: norm(cliente), book, t, titolo: String(m.oggetto || '(senza oggetto)'), importo: Number(m.bonus_importo) > 0 ? Number(m.bonus_importo) : null, paroleChiave: parole(String(m.oggetto || '')) })
    }
    for (const s of sms) {
      if (CATEGORIE_OPERATIVE.has(String(s.categoria || '').toUpperCase())) continue
      const t = tempo(s.data_ricezione); const cliente = String(s.cliente || '').trim()
      if (t === null || !cliente) continue
      const book = s.bookmaker && nomiBook.has(norm(s.bookmaker)) ? [norm(s.bookmaker)] : bookNelTesto(`${s.testo || ''} ${s.bookmaker || ''}`)
      if (!book.length) continue
      comunicazioni.push({ canale: 'SMS', cliente, clienteKey: norm(cliente), book, t, titolo: String(s.testo || '').slice(0, 140), importo: Number(s.bonus_importo) > 0 ? Number(s.bonus_importo) : null, paroleChiave: parole(String(s.testo || '')) })
    }

    // 4. segnalazioni utili: pulisco il testo, scarto gli avvisi (truffe, phishing…) e unisco i doppioni
    const pulisci = (x: any) => String(x ?? '').replace(/\*\*|__|`|^#+\s*/gm, '').replace(/[ \t]+/g, ' ').replace(/\n{3,}/g, '\n\n').trim()
    const paroleTesto = (x: string) => new Set(senzaAccenti(x).split(/[^a-z0-9]+/).filter(p => p.length >= 4))
    const simili = (a: Set<string>, b: Set<string>) => {
      if (!a.size || !b.size) return false
      let comuni = 0; for (const p of a) if (b.has(p)) comuni++
      return comuni / Math.min(a.size, b.size) >= 0.6
    }
    const èAvviso = (x: string) => /(truffa|phishing|attenzione|fate attenzione|falso sito|finto sito|non cliccate)/.test(senzaAccenti(x)) && !/(bonus|promo|cashback|freebet|rimborso|quota|offerta|moltiplicatore|%)/.test(senzaAccenti(x))
    type Gruppo = { ids: number[]; msg: any; testo: string; testoImg: string | null; books: string[]; tMin: number; tMax: number; doppioni: number; parole: Set<string> }
    const gruppi: Gruppo[] = []
    let senzaBook = 0; let avvisi = 0
    for (const m of msg || []) {   // dal più recente: il primo di un gruppo è il più recente
      const tCorpo = pulisci(m.testo); const tImg = m.testo_immagine ? pulisci(m.testo_immagine) : ''
      const tutto = [tCorpo, tImg].filter(Boolean).join('\n').trim()
      if (tutto.length < 25) continue
      const books_ = bookNelTesto(tutto)
      if (!books_.length) { senzaBook++; continue }
      if (èAvviso(tutto)) { avvisi++; continue }
      const t = tempo(m.data_msg) as number
      const parole_ = paroleTesto(tutto)
      const g = gruppi.find(x => x.books.join() === books_.join() && Math.abs(x.tMax - t) < 4 * GIORNO && simili(x.parole, parole_))
      if (g) { g.tMin = Math.min(g.tMin, t); g.doppioni++; g.ids.push(m.id); continue }
      gruppi.push({ ids: [m.id], msg: m, testo: tCorpo, testoImg: tImg || null, books: books_, tMin: t, tMax: t, doppioni: 0, parole: parole_ })
    }

    // 5. abbinamento mail/SMS ↔ segnalazione
    const risultati: any[] = []
    for (const g of gruppi) {
      if (soloNuove && (g.tMax < inizioNuove || g.ids.some(i => viste.has(Number(i))))) continue
      const m = g.msg; const books_ = g.books
      const testoNorm = senzaAccenti([g.testo, g.testoImg].filter(Boolean).join('\n'))
      const arrivata = new Map<string, any>()
      for (const c of comunicazioni) {
        if (!c.book.some(k => books_.includes(k))) continue
        if (c.t < g.tMin - PRIMA_DELLA_SEGNALAZIONE || c.t > g.tMax + DOPO_LA_SEGNALAZIONE) continue
        const importoOk = c.importo !== null && Number.isInteger(c.importo) && new RegExp(`(?<![0-9])${c.importo}(?![0-9])`).test(testoNorm)
        const paroleOk = c.paroleChiave.filter(p => testoNorm.includes(p)).length >= 2
        const forza = importoOk || paroleOk ? 'forte' : 'probabile'
        const voce = { cliente: c.cliente, canale: c.canale, quando: new Date(c.t).toISOString(), titolo: c.titolo, book: nomiBook.get(c.book.find(k => books_.includes(k)) as string), forza }
        const prec = arrivata.get(c.clienteKey)
        // per ogni cliente tengo l'abbinamento migliore (prima il più sicuro, poi il più vicino alla segnalazione)
        if (!prec || (forza === 'forte' && prec.forza !== 'forte') || (forza === prec.forza && Math.abs(c.t - g.tMax) < Math.abs(new Date(prec.quando).getTime() - g.tMax))) arrivata.set(c.clienteKey, voce)
      }
      // clienti che hanno il book (non chiuso, non limitato ai bonus, non terminato) e non risultano averla ricevuta
      const ricevuti = [...arrivata.keys()]
      const nonArrivata = new Map<string, string>(); const limitati = new Map<string, string>()
      for (const b of books) {
        if (!books_.includes(norm(b.nome))) continue
        const nome = String(b.intestatario || '').trim(); const k = norm(nome)
        if (!k || terminati.has(k) || ricevuti.some(r => stessoCliente(r, k))) continue
        const nota = senzaAccenti(b.note)
        if (nota.includes('chiuso')) continue
        if (nota.includes('limitato bonus')) limitati.set(k, nome)
        else nonArrivata.set(k, nome)
      }
      const tutte = [...arrivata.values()]
      const righe = (g.testo || g.testoImg || '').split('\n').map(r => r.trim()).filter(r => r.length >= 8)
      const titolo = (righe[0] || '').slice(0, 120)
      risultati.push({
        id: m.id, ids: g.ids, data: m.data_msg, gruppo: m.chat_titolo, topic: m.topic_titolo, mittente: m.mittente, link: m.link,
        titolo, doppioni: g.doppioni,
        testo: g.testo.slice(0, 600), testo_immagine: g.testoImg ? g.testoImg.slice(0, 900) : null,
        book: books_.map(k => nomiBook.get(k)),
        arrivata_a: tutte.filter(a => a.forza === 'forte').sort((a, b) => a.cliente.localeCompare(b.cliente)),
        forse_arrivata_a: tutte.filter(a => a.forza === 'probabile').sort((a, b) => a.cliente.localeCompare(b.cliente)),
        non_arrivata_a: [...nonArrivata.values()].sort((a, b) => a.localeCompare(b)),
        limitati_bonus: [...limitati.values()].sort((a, b) => a.localeCompare(b)),
      })
    }

    if (soloNuove) return NextResponse.json({ nuove: risultati })
    return NextResponse.json({
      giorni,
      segnalazioni: risultati,
      riepilogo: { totale: risultati.length, con_ricevute: risultati.filter(r => r.arrivata_a.length).length, nessuno: risultati.filter(r => !r.arrivata_a.length).length, senza_book_riconosciuto: senzaBook, avvisi_nascosti: avvisi },
      comunicazioni_considerate: comunicazioni.length,
    })
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || String(e) }, { status: 500 })
  }
}

// segna come viste (ok visto). Body: { ids: number[] }
export async function POST(req: NextRequest) {
  if (!(await èAdmin(req))) return NextResponse.json({ error: 'Accesso riservato agli admin' }, { status: 403 })
  try {
    const body = await req.json().catch(() => ({}))
    const ids: number[] = (Array.isArray(body?.ids) ? body.ids : []).map(Number).filter((n: number) => Number.isFinite(n)).slice(0, 500)
    if (!ids.length) return NextResponse.json({ error: 'nessuna promo indicata' }, { status: 400 })
    const { error } = await admin.from(TAB_VISTE).upsert(ids.map(i => ({ chiave: `msg:${i}` })), { onConflict: 'chiave', ignoreDuplicates: true })
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json({ ok: true, segnate: ids.length })
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || String(e) }, { status: 500 })
  }
}
