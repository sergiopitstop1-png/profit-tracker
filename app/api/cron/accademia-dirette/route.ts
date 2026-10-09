// 09/10/2026 · Cron (ogni 5 minuti): calendario dirette dell'Accademia + avvisi Telegram.
//  1) legge i messaggi recenti (ultimi 14 giorni) che sembrano annunci di dirette e li fa interpretare dall'AI (Groq)
//     -> tabella accademia_dirette (titolo, data e ora in Italia, link)
//  2) manda l'avviso Telegram il giorno prima (24 ore) e 30 minuti prima.
// Bot: LUCY_TELEGRAM_BOT_TOKEN / LUCY_TELEGRAM_CHAT_ID; se mancano usa quelli del watchdog (PROP_WATCHDOG_TELEGRAM_*).
// Prova a mano: curl.exe -H "Authorization: Bearer IL_TUO_CRON_SECRET" "https://sergioapicella.it/api/cron/accademia-dirette"
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
export const maxDuration = 60

const MODEL = 'openai/gpt-oss-20b'
const FINESTRA_GIORNI = 14
const MAX_AI_PER_GIRO = 10

const msg = (e: unknown) => (e instanceof Error ? e.message : String(e))

const sb = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, {
  auth: { persistSession: false, autoRefreshToken: false },
})

/* ---------- date: ora italiana <-> UTC ---------- */
function offsetRoma(utcMs: number) {
  const p = new Intl.DateTimeFormat('en-US', {
    timeZone: 'Europe/Rome', hourCycle: 'h23', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', second: '2-digit',
  }).formatToParts(new Date(utcMs))
  const g = (t: string) => Number(p.find(x => x.type === t)?.value)
  return Date.UTC(g('year'), g('month') - 1, g('day'), g('hour'), g('minute'), g('second')) - utcMs
}
function romaToIso(locale: string): string | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})/.exec(locale || '')
  if (!m) return null
  const guess = Date.UTC(+m[1], +m[2] - 1, +m[3], +m[4], +m[5])
  let utc = guess - offsetRoma(guess)
  utc = guess - offsetRoma(utc)
  const d = new Date(utc)
  return Number.isNaN(d.getTime()) ? null : d.toISOString()
}
const fmtRoma = (iso: string) =>
  new Intl.DateTimeFormat('it-IT', { timeZone: 'Europe/Rome', weekday: 'short', day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' }).format(new Date(iso))
const fmtMessaggio = (iso: string) =>
  new Intl.DateTimeFormat('it-IT', { timeZone: 'Europe/Rome', weekday: 'long', day: '2-digit', month: 'long', year: 'numeric', hour: '2-digit', minute: '2-digit' }).format(new Date(iso))

/* ---------- quali messaggi sembrano annunci ---------- */
function sembraAnnuncio(t: string | null) {
  if (!t || t.length > 4000) return false
  return /(diretta|dirette|\blive\b|zoom|webinar|meeting|streaming|collegamento|appuntamento|incontro|evento)/i.test(t)
    && /(\d{1,2}[:.]\d{2}|\bore\s*\d{1,2})/i.test(t)
}

/* ---------- AI ---------- */
const schema = {
  type: 'object',
  additionalProperties: false,
  required: ['dirette'],
  properties: {
    dirette: {
      type: 'array',
      items: {
        type: 'object',
        additionalProperties: false,
        required: ['titolo', 'inizio', 'link'],
        properties: {
          titolo: { type: 'string' },
          inizio: { type: 'string' },
          link: { type: ['string', 'null'] },
        },
      },
    },
  },
}

async function leggiAnnuncio(m: { data_msg: string; chat_titolo: string | null; topic_titolo: string | null; testo: string }) {
  const key = process.env.GROQ_API_KEY
  if (!key) throw new Error('GROQ_API_KEY mancante')
  const prompt = `Sei Lucy, assistente di Sergio. Leggi questo messaggio di un gruppo Telegram italiano e trova le DIRETTE FUTURE annunciate (dirette, live, webinar, meeting, collegamenti Zoom/YouTube con data e ora).
Regole:
- Includi solo eventi con data E ora indicate o ricavabili. Se manca l'ora, non includerlo.
- Il messaggio è stato scritto: ${fmtMessaggio(m.data_msg)} (ora italiana). Usalo per risolvere "oggi", "domani", "stasera", "martedì 14" e per l'anno mancante (scegli la data futura più vicina al messaggio).
- Ignora eventi già passati, riassunti, ringraziamenti, registrazioni, promemoria generici senza data.
- "inizio" in ora italiana, formato AAAA-MM-GGTHH:MM. "titolo" breve (max 80 caratteri). "link": URL della diretta (zoom, youtube, t.me...) se presente, altrimenti null.
- Un messaggio può contenere più dirette (calendario): elencale tutte. Se non ce n'è nessuna, "dirette" è un array vuoto.
Gruppo: ${m.chat_titolo || ''}${m.topic_titolo ? ' / ' + m.topic_titolo : ''}
Messaggio:
"""
${m.testo.slice(0, 3500)}
"""`
  const r = await fetch('https://api.groq.com/openai/v1/chat/completions', {
    method: 'POST',
    headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model: MODEL, reasoning_effort: 'low', temperature: 0, max_completion_tokens: 900,
      messages: [{ role: 'user', content: prompt }],
      response_format: { type: 'json_schema', json_schema: { name: 'dirette', strict: true, schema } },
    }),
  })
  if (!r.ok) throw new Error(`Groq ${r.status}: ${(await r.text()).slice(0, 200)}`)
  const j = await r.json()
  const out = JSON.parse(j?.choices?.[0]?.message?.content || '{}')
  return Array.isArray(out.dirette) ? (out.dirette as { titolo: string; inizio: string; link: string | null }[]) : []
}

/* ---------- Telegram ---------- */
async function telegram(testo: string) {
  const token = process.env.LUCY_TELEGRAM_BOT_TOKEN || process.env.PROP_WATCHDOG_TELEGRAM_BOT_TOKEN
  const chat = process.env.LUCY_TELEGRAM_CHAT_ID || process.env.PROP_WATCHDOG_TELEGRAM_CHAT_ID
  if (!token || !chat) return { ok: false, motivo: 'bot Telegram non configurato' }
  const r = await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ chat_id: chat, text: testo, disable_web_page_preview: true }),
  })
  return r.ok ? { ok: true } : { ok: false, motivo: `Telegram ${r.status}` }
}

export async function GET(req: NextRequest) {
  const cronSecret = process.env.CRON_SECRET
  if (!cronSecret || req.headers.get('authorization') !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
  const rep = { letti: 0, annunci: 0, nuove: 0, avvisi: 0, errori: [] as string[] }

  /* 1) nuovi annunci */
  try {
    const da = new Date(Date.now() - FINESTRA_GIORNI * 86400000).toISOString()
    const { data: recenti, error } = await sb
      .from('accademia_messaggi')
      .select('chat_id,msg_id,chat_titolo,topic_titolo,data_msg,testo')
      .gte('data_msg', da)
      .not('testo', 'is', null)
      .order('data_msg', { ascending: true })
      .limit(1500)
    if (error) throw new Error(error.message)
    const cand = (recenti || []).filter(m => sembraAnnuncio(m.testo))
    if (cand.length) {
      const { data: gia } = await sb.from('accademia_dirette_letti').select('chat_id,msg_id').gte('letto', da)
      const visti = new Set((gia || []).map(x => `${x.chat_id}|${x.msg_id}`))
      const daLeggere = cand.filter(m => !visti.has(`${m.chat_id}|${m.msg_id}`)).slice(0, MAX_AI_PER_GIRO)
      for (const m of daLeggere) {
        let trovate: { titolo: string; inizio: string; link: string | null }[] = []
        try {
          trovate = await leggiAnnuncio({ data_msg: m.data_msg, chat_titolo: m.chat_titolo, topic_titolo: m.topic_titolo, testo: m.testo })
        } catch (e) {
          rep.errori.push(msg(e).slice(0, 150))
          continue   // non lo segno come letto: riprovo al prossimo giro
        }
        rep.letti++
        for (const t of trovate) {
          const inizio = romaToIso(t.inizio)
          if (!inizio || !t.titolo?.trim()) continue
          rep.annunci++
          // stessa diretta annunciata più volte: stesso orario (±30 minuti) = una sola riga
          const a = new Date(new Date(inizio).getTime() - 30 * 60000).toISOString()
          const b = new Date(new Date(inizio).getTime() + 30 * 60000).toISOString()
          const { data: esiste } = await sb.from('accademia_dirette').select('id,link').gte('inizio', a).lte('inizio', b).limit(1)
          if (esiste && esiste.length) {
            if (!esiste[0].link && t.link) await sb.from('accademia_dirette').update({ link: t.link }).eq('id', esiste[0].id)
            continue
          }
          const { error: e2 } = await sb.from('accademia_dirette').insert({
            chat_id: m.chat_id, msg_id: m.msg_id, titolo: t.titolo.trim().slice(0, 120), inizio, link: t.link || null,
            gruppo: m.chat_titolo, topic: m.topic_titolo,
          })
          if (e2) rep.errori.push(`insert: ${e2.message}`)
          else rep.nuove++
        }
        await sb.from('accademia_dirette_letti').upsert({ chat_id: m.chat_id, msg_id: m.msg_id }, { onConflict: 'chat_id,msg_id' })
      }
    }
  } catch (e) {
    rep.errori.push(msg(e).slice(0, 200))
  }

  /* 2) avvisi Telegram */
  try {
    const adesso = Date.now()
    const { data: prossime } = await sb
      .from('accademia_dirette')
      .select('id,titolo,inizio,link,gruppo,avviso_24h,avviso_30m')
      .gt('inizio', new Date(adesso).toISOString())
      .lte('inizio', new Date(adesso + 24 * 3600000).toISOString())
      .order('inizio', { ascending: true })
    for (const d of prossime || []) {
      const manca = new Date(d.inizio).getTime() - adesso
      const riga = `${d.titolo}\n🕒 ${fmtRoma(d.inizio)}${d.gruppo ? `\n📍 ${d.gruppo}` : ''}${d.link ? `\n🔗 ${d.link}` : ''}`
      if (manca <= 30 * 60000 && !d.avviso_30m) {
        const r = await telegram(`⏰ Tra 30 minuti: diretta Accademia\n${riga}`)
        if (r.ok) { await sb.from('accademia_dirette').update({ avviso_30m: true, avviso_24h: true }).eq('id', d.id); rep.avvisi++ }
        else rep.errori.push(String(r.motivo))
      } else if (manca > 30 * 60000 && !d.avviso_24h) {
        const r = await telegram(`📡 Entro 24 ore: diretta Accademia\n${riga}`)
        if (r.ok) { await sb.from('accademia_dirette').update({ avviso_24h: true }).eq('id', d.id); rep.avvisi++ }
        else rep.errori.push(String(r.motivo))
      }
    }
  } catch (e) {
    rep.errori.push(msg(e).slice(0, 200))
  }

  return NextResponse.json({ ok: rep.errori.length === 0, ...rep })
}
