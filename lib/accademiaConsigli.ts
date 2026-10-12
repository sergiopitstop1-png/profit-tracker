// 11/10/2026 · Raccoglitore dei consigli dell'Accademia.
// Lucy legge i messaggi dei topic scelti (pilota: "4 Chiacchiere", "Bonus Expert", "Bonus Casino", "Bonus Sport", "Condivisione file" del gruppo CLUB D'ÈLITE)
// e ne estrae i consigli operativi: slot consigliate per una promo, consigli su altre promo, bug, schemi con cui le promo sono arrivate.
// I consigli sono salvati in accademia_consigli (una riga per consiglio, uniti se lo stesso consiglio ricompare) con il link al messaggio.
// Si legge a blocchi, dal più vecchio, e si ricorda fin dove si è arrivati (accademia_consigli_stato): niente va letto due volte.
// Facoltative su Vercel: ACCADEMIA_CONSIGLI_CHAT / ACCADEMIA_CONSIGLI_TOPIC (espressioni regolari sul nome del gruppo / del topic, senza accenti).
import { createClient } from '@supabase/supabase-js'
import { chiediAClaude, èStaff, norm } from '@/lib/accademiaRiassunto'

export const AMBITO = 'pilota'
const PREZZO_IN = 0.1   // USD per milione di token (Haiku 5.5)
const PREZZO_OUT = 0.5
const CARATTERI_BLOCCO = 70_000
const PARALLELI = 3   // blocchi mandati a Claude insieme
const MAX_PER_MESSAGGIO = 1200
const MIN_CARATTERI = 12
const ATTESA_MIN_CARATTERI = 60_000   // sotto questa quantità di testo nuovo, il cron aspetta (a meno che sia passata un'ora lunga)
const ATTESA_ORE = 20
const MAX_ERRORI = 3
const CONTESTO = 12

export const TIPI = ['slot', 'promo', 'bug', 'pattern', 'file'] as const
export type Tipo = (typeof TIPI)[number]
type SlotNome = { nome: string; provider: string }
type Fonte = { c: string | null; t: string | null; m: string | null; l: string | null; d: string; x: string }
type Riga = {
  id: number; chat_id: number; topic_id: number | null; chat_titolo: string | null; topic_titolo: string | null
  msg_id: number; data_msg: string; mittente: string | null; testo: string | null; media_tipo: string | null; testo_immagine: string | null; link: string | null
}
type Coppia = { chat_id: number; topic_id: number }

const sb = () => createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, { auth: { persistSession: false, autoRefreshToken: false } })

const apostrofi = (t: string) => norm(t).replace(/[’‘`´]/g, "'")
const rx = (env: string | undefined, def: RegExp) => { try { return env ? new RegExp(env, 'i') : def } catch { return def } }
const RX_CHAT = rx(process.env.ACCADEMIA_CONSIGLI_CHAT, /d'?\s*elite/i)
const RX_TOPIC = rx(process.env.ACCADEMIA_CONSIGLI_TOPIC, /(4|quattro)\s*chiacchier|bonus\s*expert|bonus\s*casin|bonus\s*sport|condivision\w*\s*(di\s*)?file|file\s*condivis/i)

/* ---------- quali topic leggere ---------- */
type GruppoRpc = { chat_id: number; chat_titolo: string | null; topic_id: number | null; topic_titolo: string | null; n: number; ultimo: string | null }
async function gruppi(): Promise<GruppoRpc[]> {
  const { data, error } = await sb().rpc('accademia_gruppi')
  if (error) throw new Error(error.message)
  return (data || []) as GruppoRpc[]
}
const èDelPilota = (g: GruppoRpc) => g.topic_id != null && RX_CHAT.test(apostrofi(g.chat_titolo || '')) && RX_TOPIC.test(apostrofi(g.topic_titolo || ''))

async function stato() {
  const { data } = await sb().from('accademia_consigli_stato').select('*').eq('ambito', AMBITO).maybeSingle()
  return data as null | {
    ultimo_msg: string | null; ultimo_id: number | null; ultima_esecuzione: string | null; messaggi_letti: number; consigli_trovati: number
    costo_usd: number; errori_consecutivi: number; ultimo_errore: string | null; batch_saltati: number
  }
}

/* ---------- lettura dei messaggi nuovi ---------- */
const SELECT = 'id,chat_id,topic_id,chat_titolo,topic_titolo,msg_id,data_msg,mittente,testo,media_tipo,testo_immagine,link'
function conFiltri<T extends { in: (c: string, v: number[]) => T; or: (f: string) => T }>(q: T, coppie: Coppia[], marca: { t: string; id: number } | null) {
  let r = q.in('chat_id', [...new Set(coppie.map(c => c.chat_id))]).in('topic_id', [...new Set(coppie.map(c => c.topic_id))])
  if (marca) r = r.or(`data_msg.gt.${marca.t},and(data_msg.eq.${marca.t},id.gt.${marca.id})`)
  return r
}
const lungh = (m: Riga) => Math.min(MAX_PER_MESSAGGIO, (m.testo || '').length) + Math.min(MAX_PER_MESSAGGIO, (m.testo_immagine || '').length) + 50

async function leggiBlocco(coppie: Coppia[], marca: { t: string; id: number } | null) {
  const chiavi = new Set(coppie.map(c => `${c.chat_id}:${c.topic_id}`))
  const righe: Riga[] = []
  let cursore = marca
  let caratteri = 0
  let esaurito = false
  let ultimo: { t: string; id: number } | null = marca
  while (caratteri < CARATTERI_BLOCCO) {
    const q = sb().from('accademia_messaggi').select(SELECT).order('data_msg', { ascending: true }).order('id', { ascending: true }).limit(300)
    const { data, error } = await conFiltri(q, coppie, cursore)
    if (error) throw new Error(error.message)
    const grezza = (data || []) as Riga[]
    for (const r of grezza) {
      if (caratteri >= CARATTERI_BLOCCO) break
      ultimo = { t: new Date(r.data_msg).toISOString(), id: r.id }
      if (!chiavi.has(`${r.chat_id}:${r.topic_id}`)) continue
      righe.push(r)
      caratteri += lungh(r)
    }
    if (caratteri >= CARATTERI_BLOCCO) break
    if (grezza.length < 300) { esaurito = true; break }
    cursore = ultimo
  }
  // se ha letto fino in fondo, il segnalibro va all'ultimo messaggio visto (anche non utile)
  return { righe, caratteri, esaurito, ultimo }
}

async function contesto(coppie: Coppia[], marca: { t: string; id: number } | null) {
  if (!marca) return [] as Riga[]
  const chiavi = new Set(coppie.map(c => `${c.chat_id}:${c.topic_id}`))
  const q = sb().from('accademia_messaggi').select(SELECT).lte('data_msg', marca.t).order('data_msg', { ascending: false }).order('id', { ascending: false }).limit(CONTESTO * 4)
  const { data } = await conFiltri(q, coppie, null)
  return ((data || []) as Riga[]).filter(r => chiavi.has(`${r.chat_id}:${r.topic_id}`) && (r.testo || '').length >= MIN_CARATTERI).slice(0, CONTESTO).reverse()
}

/* ---------- prompt ---------- */
const ora = (iso: string) => new Intl.DateTimeFormat('it-IT', { timeZone: 'Europe/Rome', day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' }).format(new Date(iso))
const corpo = (m: Riga) => {
  const t = (m.testo || '').slice(0, MAX_PER_MESSAGGIO).replace(/\n{3,}/g, '\n\n')
  const img = m.testo_immagine ? `\n  IMMAGINE: ${m.testo_immagine.slice(0, MAX_PER_MESSAGGIO).replace(/\n{2,}/g, '\n')}` : ''
  const all = m.media_tipo ? `\n  [ALLEGATO: ${m.media_tipo}]` : ''
  return `${t}${all}${img}`
}
const riga = (cod: string, m: Riga) => `${cod} [${ora(m.data_msg)}] ${m.mittente || '?'}${èStaff(m.mittente) ? ' (staff)' : ''} · ${m.topic_titolo || '-'}: ${corpo(m)}`

function prompt(utili: Riga[], ctx: Riga[], noti: string[]) {
  return `Sei Lucy, assistente di Sergio (matched betting e bonus dei bookmaker italiani e casinò). Sotto trovi i messaggi dei topic del gruppo Telegram dell'Accademia del Profitto. Devi estrarre i CONSIGLI OPERATIVI che Sergio vorrà ritrovare senza rileggere i messaggi.

Tipi di consiglio:
- "slot": una slot (o un gioco) consigliata per fare una promo, in particolare per smaltire un rollover o un wagering con poco costo.
- "promo": un consiglio su come comportarsi con una promo (cosa fare, cosa evitare, ordine delle mosse, condizioni da controllare, come l'hanno incassata).
- "bug": un bug, una falla o un errore di un book o di una promo che si può sfruttare o da cui stare attenti.
- "file": un file, documento, foglio, guida, link o risorsa condivisa nel topic di condivisione file (o altrove): serve sapere QUALE file è, il link se c'è e A COSA SERVE.
- "pattern": uno schema o una condizione che ha fatto arrivare (o non arrivare) una promo: come è stata attivata, cosa avevano fatto prima quelli a cui è arrivata, tempi di accredito.

Regole:
- Usa SOLO ciò che è scritto. Niente invenzioni: se importo, book, slot o condizione non ci sono, non scriverli. Importi, quote, percentuali e date vanno copiati esatti.
- Un consiglio per ogni argomento: se la stessa cosa è detta in più messaggi, uniscili in un solo consiglio e cita tutti i messaggi.
- Il testo dopo "IMMAGINE:" è ciò che Lucy ha letto in una foto: è contenuto vero.
- I messaggi dei membri contano: raccontano esperienza reale. Quelli marcati "(staff)" sono informazione ufficiale. Se un membro contraddice lo staff, scrivilo nei dettagli.
- Ignora saluti, battute, domande senza risposta, chiacchiere. Se un messaggio è solo una domanda e nessuno risponde, non è un consiglio.
- I messaggi sotto "CONTESTO" servono solo a capire i discorsi: non vanno citati.
- "GIÀ NOTI" è l'elenco di argomenti già raccolti: se un consiglio riguarda lo stesso book e lo stesso argomento, riusa ESATTAMENTE le stesse parole di book e argomento, così si uniscono.
- book: nome del bookmaker o casinò in minuscolo (es. "lottomatica", "eurobet"), "" se è generale. promo: nome della promo, "" se non c'è. argomento: 2-5 parole che identificano il tema (es. "slot per rollover 30x").
- scopo (solo per le slot): "rollover" se serve per smaltire il wagering, "margine" se è per fare profitto, "altro" altrimenti; "" per gli altri tipi.
- Per i "file": titolo = nome del file o breve descrizione di cosa è; consiglio = a cosa serve e quando usarlo (solo ciò che è scritto); dettagli = il link/URL esatto scritto nel messaggio (copialo intero), il tipo di file (se noto dall'allegato) e chi lo ha condiviso. Se il messaggio ha solo un allegato senza spiegazione, usa il nome o la descrizione che c'è e scrivi "scopo non indicato". Se c'è un link scrivilo sempre.
- Per le "slot": il campo "slot" è l'elenco delle slot nominate nel consiglio, con il nome ESATTO come scritto e il provider (es. NetEnt, Pragmatic, Playtech) solo se è scritto o ovvio dal nome del gioco, altrimenti "". Per gli altri tipi "slot" è [].
- Al massimo 40 consigli. Se non c'è nulla di utile rispondi []

Rispondi SOLO con un array JSON, senza testo prima o dopo e senza blocchi di codice. Ogni elemento:
{"tipo":"slot|promo|bug|pattern|file","book":"","promo":"","argomento":"","titolo":"frase breve","consiglio":"1-2 frasi pratiche: cosa fare","dettagli":"importi, condizioni, esperienze dei membri, eccezioni; \\"\\" se non ci sono","scopo":"","slot":[{"nome":"Starburst","provider":"NetEnt"}],"msg":["m1","m5"]}
"msg" contiene i codici dei messaggi che sostengono il consiglio (almeno uno, solo messaggi non di contesto).

GIÀ NOTI:
${noti.length ? noti.join('\n') : '(nessuno)'}

CONTESTO (non citabile):
${ctx.length ? ctx.map(m => `[${ora(m.data_msg)}] ${m.mittente || '?'}: ${corpo(m)}`).join('\n') : '(nessuno)'}

MESSAGGI:
${utili.map((m, i) => riga(`m${i + 1}`, m)).join('\n')}`
}

/* ---------- risposta del modello ---------- */
type Grezzo = { slot?: unknown; tipo?: unknown; book?: unknown; promo?: unknown; argomento?: unknown; titolo?: unknown; consiglio?: unknown; dettagli?: unknown; scopo?: unknown; msg?: unknown }
function leggiJson(testo: string): Grezzo[] {
  let t = testo.trim().replace(/^```(?:json)?\s*/i, '').replace(/```\s*$/, '')
  const a = t.indexOf('['), b = t.lastIndexOf(']')
  if (a === -1 || b === -1 || b < a) throw new Error(`risposta non in formato JSON: ${testo.slice(0, 120)}`)
  t = t.slice(a, b + 1)
  const j = JSON.parse(t)
  if (!Array.isArray(j)) throw new Error('la risposta non è un elenco')
  return j as Grezzo[]
}
const str = (v: unknown, max = 1200) => (typeof v === 'string' ? v.trim().slice(0, max) : '')
const slug = (v: string) => norm(v).replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 60)

function leggiSlot(v: unknown): SlotNome[] {
  if (!Array.isArray(v)) return []
  const viste = new Set<string>()
  const out: SlotNome[] = []
  for (const x of v) {
    const nome = typeof x === 'string' ? x.trim() : str((x as { nome?: unknown })?.nome, 80)
    const provider = typeof x === 'string' ? '' : str((x as { provider?: unknown })?.provider, 60)
    if (!nome || viste.has(norm(nome))) continue
    viste.add(norm(nome)); out.push({ nome, provider })
  }
  return out.slice(0, 15)
}
const unisciSlot = (a: SlotNome[], b: SlotNome[]) => {
  const m = new Map<string, SlotNome>()
  for (const s of [...a, ...b]) { const k = norm(s.nome); const e = m.get(k); if (!e || (!e.provider && s.provider)) m.set(k, s) }
  return [...m.values()].slice(0, 20)
}

type Nuovo = {
  chiave: string; tipo: Tipo; book: string | null; promo: string | null; argomento: string | null; titolo: string; consiglio: string; dettagli: string | null
  scopo: string | null; slot: SlotNome[]; da_staff: boolean; autori: string[]; fonti: Fonte[]; chat_titolo: string | null; topic_titolo: string | null; prima: string; ultima: string
}
function costruisci(grezzi: Grezzo[], utili: Riga[]): Nuovo[] {
  const out: Nuovo[] = []
  for (const g of grezzi) {
    const tipo = str(g.tipo).toLowerCase() as Tipo
    const titolo = str(g.titolo, 200), consiglio = str(g.consiglio)
    if (!TIPI.includes(tipo) || !titolo || !consiglio) continue
    const cod = Array.isArray(g.msg) ? g.msg : []
    const righe = [...new Set(cod.map(c => Number(String(c).replace(/\D/g, ''))).filter(n => n >= 1 && n <= utili.length))].map(n => utili[n - 1])
    if (!righe.length) continue   // consiglio senza messaggio che lo sostiene: scartato
    const book = norm(str(g.book, 60)), argomento = str(g.argomento, 100)
    const date = righe.map(r => r.data_msg).sort()
    out.push({
      chiave: `${slug(book) || 'generale'}|${tipo}|${slug(argomento) || slug(titolo)}`,
      tipo, book: book || null, promo: str(g.promo, 100) || null, argomento: argomento || null, titolo, consiglio,
      dettagli: str(g.dettagli) || null,
      slot: tipo === 'slot' ? leggiSlot(g.slot) : [],
      scopo: tipo === 'slot' && ['rollover', 'margine', 'altro'].includes(str(g.scopo)) ? str(g.scopo) : null,
      da_staff: righe.some(r => èStaff(r.mittente)),
      autori: [...new Set(righe.map(r => r.mittente).filter((x): x is string => !!x))],
      fonti: righe.map(r => ({ c: r.chat_titolo, t: r.topic_titolo, m: r.mittente, l: r.link, d: r.data_msg, x: (r.testo || r.testo_immagine || '').replace(/\s+/g, ' ').slice(0, 220) })),
      chat_titolo: righe[0].chat_titolo, topic_titolo: righe[0].topic_titolo, prima: date[0], ultima: date[date.length - 1],
    })
  }
  return out
}

async function salvaConsigli(nuovi: Nuovo[]) {
  if (!nuovi.length) return 0
  const db = sb()
  // se lo stesso consiglio compare due volte nel blocco, si unisce
  const perChiave = new Map<string, Nuovo>()
  for (const n of nuovi) {
    const e = perChiave.get(n.chiave)
    if (!e) { perChiave.set(n.chiave, n); continue }
    e.slot = unisciSlot(e.slot, n.slot); e.fonti.push(...n.fonti); e.autori = [...new Set([...e.autori, ...n.autori])]; e.da_staff ||= n.da_staff
    if (n.consiglio.length > e.consiglio.length) e.consiglio = n.consiglio
    if ((n.dettagli || '').length > (e.dettagli || '').length) e.dettagli = n.dettagli
    if (n.prima < e.prima) e.prima = n.prima
    if (n.ultima > e.ultima) e.ultima = n.ultima
  }
  const chiavi = [...perChiave.keys()]
  // se la colonna "slot" non esiste ancora (SQL non eseguito) si salva senza: nessun consiglio si perde e nessun blocco viene saltato
  let conSlot = true
  let r1 = await db.from('accademia_consigli').select('chiave,consiglio,dettagli,slot,da_staff,autori,fonti,prima_data,ultima_data,stato').in('chiave', chiavi)
  if (r1.error && /slot/i.test(r1.error.message)) {
    conSlot = false
    r1 = await db.from('accademia_consigli').select('chiave,consiglio,dettagli,da_staff,autori,fonti,prima_data,ultima_data,stato').in('chiave', chiavi) as typeof r1
  }
  const { data: esistenti, error } = r1
  if (error) throw new Error(`lettura consigli: ${error.message}`)
  const mappa = new Map((esistenti || []).map(e => [e.chiave as string, e]))
  const righe = [...perChiave.values()].map(n => {
    const e = mappa.get(n.chiave)
    const fonti = [...(((e?.fonti as Fonte[]) || [])), ...n.fonti]
    const viste = new Set<string>()
    const uniche = fonti.filter(f => { const k = f.l || `${f.d}|${f.m}|${f.x}`; if (viste.has(k)) return false; viste.add(k); return true })
    const consiglio = e && e.consiglio.length > n.consiglio.length ? e.consiglio : n.consiglio
    const dettagli = (e?.dettagli || '').length > (n.dettagli || '').length ? e?.dettagli : n.dettagli
    return {
      chiave: n.chiave, tipo: n.tipo, book: n.book, promo: n.promo, argomento: n.argomento, titolo: n.titolo, consiglio, dettagli: dettagli || null,
      scopo: n.scopo, ...(conSlot ? { slot: unisciSlot(((e as { slot?: SlotNome[] } | undefined)?.slot) || [], n.slot) } : {}), da_staff: !!(e?.da_staff) || n.da_staff,
      autori: [...new Set([...((e?.autori as string[]) || []), ...n.autori])],
      n_fonti: uniche.length, fonti: uniche.slice(0, 40), chat_titolo: n.chat_titolo, topic_titolo: n.topic_titolo,
      prima_data: e?.prima_data && e.prima_data < n.prima ? e.prima_data : n.prima,
      ultima_data: e?.ultima_data && e.ultima_data > n.ultima ? e.ultima_data : n.ultima,
      stato: e?.stato || 'attivo', aggiornato: new Date().toISOString(),
    }
  })
  const { error: e2 } = await db.from('accademia_consigli').upsert(righe, { onConflict: 'chiave' })
  if (e2) throw new Error(`salvataggio consigli: ${e2.message}`)
  return righe.length
}

async function giàNoti() {
  const { data } = await sb().from('accademia_consigli').select('book,tipo,argomento').order('ultima_data', { ascending: false }).limit(150)
  return (data || []).map(r => `${r.book || 'generale'} | ${r.tipo} | ${r.argomento || '-'}`)
}

/* ---------- passata completa ---------- */
type Esito = { nuovi: Nuovo[]; spesa: number }
export async function eseguiPassata(opz: { forza?: boolean; budgetMs?: number } = {}) {
  const inizio = Date.now()
  const budget = opz.budgetMs ?? 150_000
  const db = sb()
  const coppie = (await gruppi()).filter(èDelPilota).map(g => ({ chat_id: g.chat_id, topic_id: g.topic_id as number }))
  if (!coppie.length) return { ok: true, saltato: 'nessun topic del pilota trovato (vedi "Controlla cosa leggerà")', blocchi: 0, messaggi: 0, consigli: 0, costo: 0 }
  let st = await stato()
  let marca = st?.ultimo_msg && st.ultimo_id != null ? { t: new Date(st.ultimo_msg).toISOString(), id: Number(st.ultimo_id) } : null
  let blocchi = 0, messaggi = 0, consigli = 0, costo = 0
  let primo = true

  while (Date.now() - inizio < budget || blocchi === 0) {
    // 1) legge fino a PARALLELI blocchi di fila (veloce: solo database)
    const lotto: { b: Awaited<ReturnType<typeof leggiBlocco>>; da: typeof marca }[] = []
    let m = marca
    let fine = false
    for (let i = 0; i < PARALLELI; i++) {
      const b = await leggiBlocco(coppie, m)
      if (!b.righe.length) { if (b.ultimo && (!m || b.ultimo.t !== m.t || b.ultimo.id !== m.id)) lotto.push({ b, da: m }); fine = true; break }
      lotto.push({ b, da: m })
      m = b.ultimo
      if (b.esaurito) { fine = true; break }
    }
    if (!lotto.length) break
    if (primo && !opz.forza && lotto.length === 1 && lotto[0].b.righe.length && lotto[0].b.esaurito && lotto[0].b.caratteri < ATTESA_MIN_CARATTERI) {
      const ult = st?.ultima_esecuzione ? new Date(st.ultima_esecuzione).getTime() : 0
      if (Date.now() - ult < ATTESA_ORE * 3_600_000) return { ok: true, saltato: 'pochi messaggi nuovi: aspetto', blocchi, messaggi, consigli, costo }
    }
    primo = false

    // 2) chiede a Claude tutti i blocchi del lotto insieme
    const noti = await giàNoti()
    const esiti = await Promise.allSettled(lotto.map(async ({ b, da }): Promise<Esito> => {
      const utili = b.righe.filter(r => (r.testo || '').trim().length >= MIN_CARATTERI || (r.testo_immagine || '').trim().length >= MIN_CARATTERI || !!r.media_tipo)
      if (!utili.length) return { nuovi: [], spesa: 0 }
      const r = await chiediAClaude(prompt(utili, await contesto(coppie, da), noti), { senzaPensiero: true, maxTokens: 12000 })
      try { return { nuovi: costruisci(leggiJson(r.testo), utili), spesa: r.costo } } catch (e) { throw new Error(`${e instanceof Error ? e.message : String(e)} (costo ${r.costo.toFixed(4)} $)`) }
    }))

    // 3) salva in ordine; al primo errore si ferma e il segnalibro resta prima del blocco che ha fallito
    for (let i = 0; i < lotto.length; i++) {
      const { b } = lotto[i]
      const es = esiti[i]
      if (es.status === 'rejected') {
        const err = (es.reason instanceof Error ? es.reason.message : String(es.reason)).slice(0, 300)
        const errori = (st?.errori_consecutivi || 0) + 1
        if (errori >= MAX_ERRORI) {
          // il blocco fa sempre errore: lo si salta per non restare bloccati per sempre
          await db.from('accademia_consigli_stato').upsert({
            ambito: AMBITO, ultimo_msg: b.ultimo!.t, ultimo_id: b.ultimo!.id, errori_consecutivi: 0, ultimo_errore: `blocco saltato dopo ${MAX_ERRORI} errori: ${err}`,
            batch_saltati: (st?.batch_saltati || 0) + 1, ultima_esecuzione: new Date().toISOString(),
          }, { onConflict: 'ambito' })
        } else {
          await db.from('accademia_consigli_stato').upsert({ ambito: AMBITO, errori_consecutivi: errori, ultimo_errore: err }, { onConflict: 'ambito' })
        }
        return { ok: false, errore: err, blocchi, messaggi, consigli, costo }
      }
      const nTrovati = await salvaConsigli(es.value.nuovi)
      marca = b.ultimo
      blocchi++; messaggi += b.righe.length; consigli += nTrovati; costo += es.value.spesa
      st = {
        ultimo_msg: marca!.t, ultimo_id: marca!.id, ultima_esecuzione: new Date().toISOString(), messaggi_letti: (st?.messaggi_letti || 0) + b.righe.length,
        consigli_trovati: (st?.consigli_trovati || 0) + nTrovati, costo_usd: Number(st?.costo_usd || 0) + es.value.spesa, errori_consecutivi: 0, ultimo_errore: null, batch_saltati: st?.batch_saltati || 0,
      }
      await db.from('accademia_consigli_stato').upsert({ ambito: AMBITO, ...st }, { onConflict: 'ambito' })
    }
    if (fine) {
      // se l'ultimo giro non ha messaggi utili, il segnalibro va comunque avanti
      const u = lotto[lotto.length - 1].b
      if (!u.righe.length && u.ultimo) await db.from('accademia_consigli_stato').upsert({ ambito: AMBITO, ultimo_msg: u.ultimo.t, ultimo_id: u.ultimo.id }, { onConflict: 'ambito' })
      break
    }
  }
  return { ok: true, blocchi, messaggi, consigli, costo }
}

/* ---------- anteprima: cosa leggerebbe e quanto costerebbe, senza spendere ---------- */
export async function anteprima() {
  const tutti = await gruppi()
  const scelti = tutti.filter(èDelPilota)
  const st = await stato()
  const marca = st?.ultimo_msg && st.ultimo_id != null ? { t: new Date(st.ultimo_msg).toISOString(), id: Number(st.ultimo_id) } : null
  if (!scelti.length) {
    const chat = tutti.filter(g => RX_CHAT.test(apostrofi(g.chat_titolo || '')))
    return {
      trovati: [] as { chat: string; topic: string; messaggi: number; nuovi: number }[], nuovi: 0, blocchi: 0, costoStimato: 0,
      avviso: chat.length ? 'Il gruppo c\'è ma nessun topic corrisponde ai nomi cercati.' : 'Nessun gruppo corrisponde a CLUB D\'ÈLITE.',
      alternative: (chat.length ? chat : tutti).filter(g => g.topic_id != null).slice(0, 40).map(g => `${g.chat_titolo || g.chat_id} / ${g.topic_titolo || g.topic_id}`),
    }
  }
  const db = sb()
  const trovati: { chat: string; topic: string; messaggi: number; nuovi: number }[] = []
  for (const g of scelti) {
    let q = db.from('accademia_messaggi').select('id', { count: 'exact', head: true }).eq('chat_id', g.chat_id).eq('topic_id', g.topic_id as number)
    if (marca) q = q.or(`data_msg.gt.${marca.t},and(data_msg.eq.${marca.t},id.gt.${marca.id})`)
    const { count } = await q
    trovati.push({ chat: g.chat_titolo || String(g.chat_id), topic: g.topic_titolo || String(g.topic_id), messaggi: Number(g.n), nuovi: count || 0 })
  }
  const nuovi = trovati.reduce((s, t) => s + t.nuovi, 0)
  // lunghezza media: si campionano i primi messaggi da leggere
  const campioneQ = db.from('accademia_messaggi').select('testo,testo_immagine').order('data_msg', { ascending: true }).order('id', { ascending: true }).limit(300)
  const { data: camp } = await conFiltri(campioneQ, scelti.map(g => ({ chat_id: g.chat_id, topic_id: g.topic_id as number })), marca)
  const righe = (camp || []) as Pick<Riga, 'testo' | 'testo_immagine'>[]
  const media = righe.length ? righe.reduce((s, r) => s + lungh(r as Riga), 0) / righe.length : 150
  const caratteri = media * nuovi
  const blocchi = Math.ceil(caratteri / CARATTERI_BLOCCO)
  const costoStimato = blocchi ? (((caratteri / 3.5) + blocchi * 2500) * PREZZO_IN + blocchi * 4000 * PREZZO_OUT) / 1_000_000 : 0
  return { trovati, nuovi, blocchi, costoStimato, mediaCaratteri: Math.round(media), avviso: '', alternative: [] as string[] }
}

export { stato as statoConsigli }
