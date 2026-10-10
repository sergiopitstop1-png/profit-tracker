// 10/10/2026 · Riassunti dei messaggi dei gruppi dell'Accademia (12:00 e 19:00 ora italiana).
// Passi: 1) legge i messaggi della fascia  2) li etichetta con parole chiave e tiene i più utili
//        3) li fa riassumere a Claude Haiku  4) salva in accademia_riassunti  5) (cron) manda il testo su Telegram.
// Variabili Vercel: LUCY_ANTHROPIC_API_KEY (obbligatoria), facoltative: LUCY_SUMMARY_MODEL (default claude-haiku-5-5),
// ACCADEMIA_RIASSUNTI_GRUPPI (parole nel nome dei gruppi, separate da virgola), ACCADEMIA_STAFF (nomi dello staff, separati da virgola),
// LUCY_TELEGRAM_BOT_TOKEN / LUCY_TELEGRAM_CHAT_ID (se mancano usa quelli del watchdog).
import { createClient } from '@supabase/supabase-js'

export type Fascia = 12 | 19

export type Msg = {
  chat_id: number; msg_id: number; chat_titolo: string | null; topic_titolo: string | null
  data_msg: string; mittente: string | null; testo: string | null; testo_immagine: string | null; link: string | null
}
type Scelto = Msg & { tags: string[]; book: string[]; staff: boolean; score: number }

const MODELLO = process.env.LUCY_SUMMARY_MODEL || 'claude-haiku-5-5'
const PREZZO_IN = 0.1   // USD per milione di token (listino Haiku 5.5)
const PREZZO_OUT = 0.5
const MAX_CARATTERI = 180_000   // quanto testo al massimo mandiamo al modello (circa 55.000 token)
const MAX_PER_MESSAGGIO = 1500

/* ---------- testo e gruppi ---------- */
export const norm = (t: string) => t.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase()

const PAROLE_GRUPPI = (process.env.ACCADEMIA_RIASSUNTI_GRUPPI || 'elite,accademia,profiliamo,meeting,profit,expert,bonus')
  .split(',').map(x => norm(x.trim())).filter(Boolean)
export const gruppoAccademia = (titolo: string | null) => !!titolo && PAROLE_GRUPPI.some(w => norm(titolo).includes(w))

const STAFF = (process.env.ACCADEMIA_STAFF || 'frioni,lentini,fotia,amurri,willy').split(',').map(x => norm(x.trim())).filter(Boolean)
const èStaff = (m: string | null) => !!m && STAFF.some(s => norm(m).includes(s))

/* ---------- ora italiana <-> UTC ---------- */
function offsetRoma(utcMs: number) {
  const p = new Intl.DateTimeFormat('en-US', {
    timeZone: 'Europe/Rome', hourCycle: 'h23', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', second: '2-digit',
  }).formatToParts(new Date(utcMs))
  const g = (t: string) => Number(p.find(x => x.type === t)?.value)
  return Date.UTC(g('year'), g('month') - 1, g('day'), g('hour'), g('minute'), g('second')) - utcMs
}
function romaAUtc(y: number, mo: number, d: number, h: number) {
  const guess = Date.UTC(y, mo - 1, d, h, 0)
  let utc = guess - offsetRoma(guess)
  utc = guess - offsetRoma(utc)
  return utc
}
export function partiRoma(ms: number) {
  const p = new Intl.DateTimeFormat('en-US', {
    timeZone: 'Europe/Rome', hourCycle: 'h23', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit',
  }).formatToParts(new Date(ms))
  const g = (t: string) => p.find(x => x.type === t)?.value || ''
  return { giorno: `${g('year')}-${g('month')}-${g('day')}`, ora: Number(g('hour')) }
}
/** fascia 12: dalle 19:00 del giorno prima alle 12:00 · fascia 19: dalle 12:00 alle 19:00 (ora italiana) */
export function finestra(giorno: string, fascia: Fascia) {
  const [y, m, d] = giorno.split('-').map(Number)
  if (fascia === 19) return { da: romaAUtc(y, m, d, 12), a: romaAUtc(y, m, d, 19) }
  const ieri = new Date(Date.UTC(y, m - 1, d - 1))
  return { da: romaAUtc(ieri.getUTCFullYear(), ieri.getUTCMonth() + 1, ieri.getUTCDate(), 19), a: romaAUtc(y, m, d, 12) }
}
const oraMsg = (iso: string) => new Intl.DateTimeFormat('it-IT', { timeZone: 'Europe/Rome', hour: '2-digit', minute: '2-digit' }).format(new Date(iso))
const etichettaFinestra = (ms: number) => new Intl.DateTimeFormat('it-IT', { timeZone: 'Europe/Rome', weekday: 'long', day: '2-digit', month: 'long', hour: '2-digit', minute: '2-digit' }).format(new Date(ms))

/* ---------- etichette a parole chiave ---------- */
const REGOLE: [string, RegExp][] = [
  ['promo', /promo|bonus|offert|riservat|cashback|freebet|rimbors|codice|ricaric|deposit|ricarica/i],
  ['bug', /\bbug\b|glitch|errore|sbagliat|non funziona|falla\b|loop\b/i],
  ['slot', /\bslot\b|\brtp\b|volatil|contribut|wager|rollover|giri\b|jackpot/i],
  ['limiti', /limitat|verifica|document|\bkyc\b|chius|bloccat|sospes|\bban\b|bannat/i],
  ['prelievi', /prelie|prelev|bonifico|pagament|accredit/i],
  ['dirette', /dirett|\blive\b|zoom|webinar|meeting/i],
  ['scadenza', /scadenz|entro il|entro le|fino al|ultimi giorni|ultime ore/i],
  // i membri che raccontano come è andata davvero una promo: per Sergio sono tra le notizie più utili
  ['esperienza', /a me (è|e'|ha|non|mi)|mi è (arriv|stat|andat)|mi (hanno|ha) (accredit|dato|pagat|limitat|chius|bloccat|chiest)|ho (ricevut|incassat|fatto|provato|giocat|chiesto|prelevat|ottenut)|mi (arriv|accredit|paga)|è arrivat|e' arrivat|accreditat|non (mi )?(è|e')? ?(arrivat|accreditat|partit|funzion)|sono riuscit|non sono riuscit|confermo|anche a me|a voi (è|e')|per me (funziona|non)/i],
]
const BOOK = [
  'bet365', 'eurobet', 'goldbet', 'lottomatica', 'snai', 'sisal', 'planetwin', 'netbet', 'starcasino', 'admiral', 'betflag', 'quigioco',
  'marathonbet', 'stanleybet', 'william hill', 'betfair', 'pokerstars', 'bwin', 'unibet', 'leovegas', 'vincitu', 'betsson',
  'daznbet', 'dazn bet', 'eplay24', 'cplay', 'microgame', 'gioco digitale', 'sportium', 'bet777', 'betaland', 'domusbet',
  'lottoland', 'netwin', 'mrplay', 'betway', 'newgioco', 'elabet', 'sbanca',
]
const TOPIC_UTILI = /segnalazion|promo|bug|dirett|important|operativ|riassunt|comunicaz|profilaz|recupero/i

export function seleziona(msgs: Msg[]): { scelti: Scelto[]; letti: number } {
  const out: Scelto[] = []
  for (const m of msgs) {
    const t = `${m.testo || ''}\n${m.testo_immagine || ''}`.trim()
    if (!t) continue
    const tags = REGOLE.filter(([, rx]) => rx.test(t)).map(([n]) => n)
    const tn = norm(t)
    const book = [...new Set(BOOK.filter(b => tn.includes(b)))]
    const staff = èStaff(m.mittente)
    let score = tags.length * 3 + book.length * 2
    if (staff) score += 2
    if (m.testo_immagine) score += 5
    if (m.topic_titolo && TOPIC_UTILI.test(m.topic_titolo)) score += 3
    if (t.length >= 200) score += 2
    else if (t.length >= 80) score += 1
    if (t.length < 25 && !tags.length && !book.length) continue   // "ok", "grazie", emoji...
    if (score >= 3) out.push({ ...m, tags, book, staff, score })
  }
  // se sono troppi, tiene i più importanti fino al limite di testo, poi rimette in ordine di tempo
  const lunghezza = (m: Scelto) => Math.min(MAX_PER_MESSAGGIO, (m.testo || '').length) + Math.min(MAX_PER_MESSAGGIO, (m.testo_immagine || '').length) + 60
  const perPunteggio = [...out].sort((a, b) => b.score - a.score)
  let tot = 0
  const tenuti: Scelto[] = []
  for (const m of perPunteggio) {
    const l = lunghezza(m)
    if (tot + l > MAX_CARATTERI) continue
    tot += l
    tenuti.push(m)
  }
  tenuti.sort((a, b) => a.data_msg.localeCompare(b.data_msg))
  return { scelti: tenuti, letti: msgs.length }
}

function testoPerModello(scelti: Scelto[]) {
  const gruppi = new Map<string, Scelto[]>()
  for (const m of scelti) {
    const k = `${m.chat_titolo || m.chat_id}${m.topic_titolo ? ` / ${m.topic_titolo}` : ''}`
    gruppi.set(k, [...(gruppi.get(k) || []), m])
  }
  const blocchi: string[] = []
  for (const [k, lista] of gruppi) {
    const righe = lista.map(m => {
      const et = [...m.tags, ...m.book].join(',')
      const corpo = (m.testo || '').slice(0, MAX_PER_MESSAGGIO).replace(/\n{3,}/g, '\n\n')
      const img = m.testo_immagine ? `\n  IMMAGINE: ${m.testo_immagine.slice(0, MAX_PER_MESSAGGIO).replace(/\n{2,}/g, '\n')}` : ''
      return `[${oraMsg(m.data_msg)}] ${m.mittente || '?'}${m.staff ? ' (staff)' : ''}${et ? ` {${et}}` : ''}: ${corpo}${img}`
    })
    blocchi.push(`=== ${k} ===\n${righe.join('\n')}`)
  }
  return blocchi.join('\n\n')
}

const promptRiassunto = (da: number, a: number, corpo: string) => `Sei Lucy, assistente di Sergio (matched betting, bonus dei bookmaker italiani e casinò). Sotto trovi i messaggi dei gruppi Telegram dell'Accademia del Profitto scritti tra ${etichettaFinestra(da)} e ${etichettaFinestra(a)} (ora italiana). Prepara il riassunto per Sergio.

Regole:
- Usa SOLO quello che è scritto nei messaggi: niente invenzioni. Se un dato (importo, scadenza, book, condizione) non c'è, non scriverlo.
- I messaggi dei membri sono preziosi: raccontano come vanno davvero le promo (tempi di accredito, importi arrivati, intoppi, trucchi, limitazioni). Riportali con precisione e non scartarli perché non sono dello staff.
- Distingui comunque la fonte: ciò che dice lo staff (messaggi marcati "(staff)") è informazione ufficiale; ciò che raccontano i membri è esperienza. Se più membri raccontano la stessa cosa, scrivi quanti (es. "3 membri"). Se l'esperienza dei membri contraddice lo staff, segnalalo chiaramente.
- Importi, quote, date e orari vanno copiati esatti. Nomina sempre il book o la slot.
- Il testo dopo "IMMAGINE:" è ciò che Lucy ha letto in una foto (schede, promo riservate, segnalazioni): trattalo come contenuto vero.
- Le parole tra graffe {} sono solo etichette automatiche di aiuto: non citarle.
- Salta chiacchiere, saluti, ringraziamenti, battute. Se una sezione non ha nulla di utile, non scriverla.

Formato (testo semplice, niente tabelle). Usa solo le sezioni che servono:
## 🎯 Promo e riservate
## 🐞 Bug e problemi
## 📅 Dirette e comunicazioni
## 🧠 Consigli e operatività
## 👥 Come stanno andando le promo (esperienze dei membri)
## ⚠️ Conti, verifiche, limitazioni
## ❓ Dubbi aperti
Ogni punto è una riga breve che comincia con "- " e finisce con (Gruppo / Argomento). Al massimo 30 punti in totale: tieni i più importanti per chi gestisce molti conti e promo. Nella sezione delle esperienze dei membri scrivi per ogni punto: book, promo, cosa è successo (accredito, tempi, importi, problemi) e chi lo riporta ("1 membro", "3 membri"). Se nei messaggi non c'è niente di rilevante, rispondi solo: "Niente di rilevante in questa fascia."

MESSAGGI:
${corpo}`

/* ---------- Anthropic ---------- */
async function chiediAClaude(prompt: string) {
  const chiave = process.env.LUCY_ANTHROPIC_API_KEY
  if (!chiave) throw new Error('LUCY_ANTHROPIC_API_KEY mancante su Vercel')
  const chiama = (conSforzoBasso: boolean) => fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: { 'x-api-key': chiave, 'anthropic-version': '2023-06-01', 'content-type': 'application/json' },
    // Haiku 5.5 ragiona da solo (livello "medium"): per un riassunto basta poco, e deve restare spazio per scrivere
    body: JSON.stringify({
      model: MODELLO, max_tokens: 16000, messages: [{ role: 'user', content: prompt }],
      ...(conSforzoBasso ? { thinking: { type: 'adaptive' }, output_config: { effort: 'low' } } : {}),
    }),
  })
  let r = await chiama(true)
  if (r.status === 400) {
    const t = await r.text()
    if (/thinking|effort|output_config/i.test(t)) r = await chiama(false)   // se il modello non accetta queste opzioni, riprova senza
    else throw new Error(`Anthropic 400: ${t.slice(0, 300)}`)
  }
  if (!r.ok) throw new Error(`Anthropic ${r.status}: ${(await r.text()).slice(0, 300)}`)
  const j = await r.json()
  const testo = (Array.isArray(j?.content) ? j.content.filter((b: { type?: string }) => b?.type === 'text').map((b: { text: string }) => b.text).join('\n') : '').trim()
  if (!testo) {
    const tipi = Array.isArray(j?.content) ? j.content.map((b: { type?: string }) => b?.type || '?').join(',') : ''
    throw new Error(`risposta vuota (stop: ${j?.stop_reason || '?'}, blocchi: ${tipi || 'nessuno'}, token in/out: ${j?.usage?.input_tokens ?? '?'}/${j?.usage?.output_tokens ?? '?'})`)
  }
  const costo = ((j?.usage?.input_tokens || 0) * PREZZO_IN + (j?.usage?.output_tokens || 0) * PREZZO_OUT) / 1_000_000
  return { testo, costo }
}

/* ---------- Telegram ---------- */
export async function telegramTesto(testo: string) {
  const token = process.env.LUCY_TELEGRAM_BOT_TOKEN || process.env.PROP_WATCHDOG_TELEGRAM_BOT_TOKEN
  const chat = process.env.LUCY_TELEGRAM_CHAT_ID || process.env.PROP_WATCHDOG_TELEGRAM_CHAT_ID
  if (!token || !chat) return { ok: false, motivo: 'bot Telegram non configurato' }
  // Telegram accetta al massimo 4096 caratteri per messaggio: si spezza alle righe
  const pezzi: string[] = []
  let corrente = ''
  for (const riga of testo.split('\n')) {
    if ((corrente + '\n' + riga).length > 3800) { pezzi.push(corrente); corrente = riga } else corrente = corrente ? `${corrente}\n${riga}` : riga
  }
  if (corrente) pezzi.push(corrente)
  for (const p of pezzi) {
    const r = await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ chat_id: chat, text: p, disable_web_page_preview: true }),
    })
    if (!r.ok) return { ok: false, motivo: `Telegram ${r.status}` }
  }
  return { ok: true as const, motivo: '' }
}

/* ---------- tutto insieme ---------- */
export async function generaRiassunto(opz: { giorno: string; fascia: Fascia; salva: boolean; telegram: boolean }) {
  const sb = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, { auth: { persistSession: false, autoRefreshToken: false } })
  const { da, a } = finestra(opz.giorno, opz.fascia)
  const daIso = new Date(da).toISOString()
  const aIso = new Date(a).toISOString()

  const tutti: Msg[] = []
  for (let p = 0; p < 12; p++) {
    const { data, error } = await sb.from('accademia_messaggi')
      .select('chat_id,msg_id,chat_titolo,topic_titolo,data_msg,mittente,testo,testo_immagine,link')
      .gte('data_msg', daIso).lt('data_msg', aIso)
      .order('data_msg', { ascending: true })
      .range(p * 1000, p * 1000 + 999)
    if (error) throw new Error(error.message)
    tutti.push(...((data || []) as Msg[]))
    if ((data || []).length < 1000) break
  }
  const dellAccademia = tutti.filter(m => gruppoAccademia(m.chat_titolo))
  const { scelti, letti } = seleziona(dellAccademia)

  let testo = 'Niente di rilevante in questa fascia.'
  let costo = 0
  if (scelti.length) {
    const r = await chiediAClaude(promptRiassunto(da, a, testoPerModello(scelti)))
    testo = r.testo
    costo = r.costo
  }

  const riga = { giorno: opz.giorno, fascia: opz.fascia, da: daIso, a: aIso, testo, n_messaggi: letti, n_selezionati: scelti.length, costo_usd: costo }
  let inviato = false
  let telegram: { ok: boolean; motivo: string } | null = null
  if (opz.telegram && scelti.length && !/^niente di rilevante/i.test(testo)) {
    const intesta = `📋 Riassunto Accademia · ${new Intl.DateTimeFormat('it-IT', { timeZone: 'Europe/Rome', day: '2-digit', month: 'short' }).format(new Date(`${opz.giorno}T12:00:00Z`))} · ore ${opz.fascia}:00 (${scelti.length} messaggi su ${letti})`
    telegram = await telegramTesto(`${intesta}\n\n${testo.replace(/^## /gm, '▸ ')}`)
    inviato = telegram.ok
  }
  if (opz.salva) {
    const { error } = await sb.from('accademia_riassunti').upsert({ ...riga, inviato_telegram: inviato }, { onConflict: 'giorno,fascia' })
    if (error) throw new Error(`salvataggio: ${error.message}`)
  }
  return { ...riga, inviato_telegram: inviato, telegram }
}
