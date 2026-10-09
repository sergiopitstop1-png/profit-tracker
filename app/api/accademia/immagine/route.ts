/* eslint-disable @typescript-eslint/no-explicit-any */
// ════════════════════════════════════════════════════════════════════
// /api/accademia/immagine — riceve dal lettore sul PC una foto di un gruppo Telegram dell'Accademia
// (schede Profiliamo, segnalazioni promo...), la fa leggere a Claude Haiku e salva il testo sul messaggio.
// POST { chat_id, msg_id, immagine_base64, mime, gruppo, topic, didascalia, solo_prova? }  header x-pt-segreto: SEGNALI_SECRET
// Variabili Vercel: LUCY_ANTHROPIC_API_KEY (chiave dedicata), facoltativa LUCY_VISION_MODEL (default claude-haiku-5-5)
// 409 = il messaggio non è ancora arrivato sul sito (il lettore riprova); 503 = limite temporaneo (riprova).
// ════════════════════════════════════════════════════════════════════
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

export const runtime = 'nodejs'
export const maxDuration = 60

const MODELLO = process.env.LUCY_VISION_MODEL || 'claude-haiku-5-5'
const MIME_OK = ['image/jpeg', 'image/png', 'image/webp', 'image/gif']
const MAX_BASE64 = 5_000_000
// listino Haiku 5.5 (USD per milione di token): serve solo a stimare il costo per immagine
const PREZZO_IN = 0.1
const PREZZO_OUT = 0.5

const prompt = (gruppo: string, topic: string, didascalia: string) => `Sei Lucy, assistente di Sergio (matched betting e bonus dei bookmaker italiani). Questa immagine arriva da un gruppo Telegram dell'Accademia del Profitto.
Gruppo: ${gruppo || '-'} · Topic: ${topic || '-'} · Didascalia: ${didascalia || '-'}

Trascrivi in italiano tutto il contenuto utile dell'immagine, fedelmente e senza inventare:
- titolo, bookmaker/casinò e tipo di scheda o promo (profilazione sport/casinò, riservata, bonus, ecc.);
- tutti i punti elencati (obiettivo, come fare, quote minime, importi, giochi/slot, dove coprire, costi, scadenze, a chi è riservata, codici promo);
- il testo dei riquadri e dei badge (es. COPERTURA, COSTO PROFILATIVO, PROMOZIONE).
Mantieni l'ordine e usa elenchi con "-". Numeri, importi e date vanno copiati esattamente. Se una parte non si legge, scrivi "[illeggibile]".
Se l'immagine non contiene testo utile (foto, meme, screenshot di conversazione senza informazioni operative) rispondi solo con una riga che la descrive, iniziando con "Senza contenuto operativo:".
Non aggiungere commenti tuoi né consigli.`

export async function POST(req: NextRequest) {
  const segreto = process.env.SEGNALI_SECRET
  if (!segreto || req.headers.get('x-pt-segreto') !== segreto) return NextResponse.json({ error: 'non autorizzato' }, { status: 401 })
  const chiave = process.env.LUCY_ANTHROPIC_API_KEY
  if (!chiave) return NextResponse.json({ error: 'LUCY_ANTHROPIC_API_KEY mancante su Vercel' }, { status: 500 })

  let c: any
  try { c = await req.json() } catch { return NextResponse.json({ error: 'JSON non valido' }, { status: 400 }) }
  const chat_id = Number(c?.chat_id)
  const msg_id = Number(c?.msg_id)
  const base64 = typeof c?.immagine_base64 === 'string' ? c.immagine_base64 : ''
  const mime = String(c?.mime || 'image/jpeg').toLowerCase()
  const prova = c?.solo_prova === true
  if (!Number.isFinite(chat_id) || !Number.isFinite(msg_id) || !base64) return NextResponse.json({ error: 'dati mancanti' }, { status: 400 })
  if (!MIME_OK.includes(mime)) return NextResponse.json({ error: `formato non supportato: ${mime}` }, { status: 400 })
  if (base64.length > MAX_BASE64) return NextResponse.json({ error: 'immagine troppo grande' }, { status: 413 })

  const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL as string, process.env.SUPABASE_SERVICE_ROLE_KEY as string, { auth: { persistSession: false } })
  if (!prova) {
    const { data: riga, error } = await supabase.from('accademia_messaggi').select('id,immagine_letta').eq('chat_id', chat_id).eq('msg_id', msg_id).maybeSingle()
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    if (!riga) return NextResponse.json({ error: 'messaggio non ancora sul sito' }, { status: 409 })
    if (riga.immagine_letta) return NextResponse.json({ ok: true, gia_letta: true })
  }

  const r = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: { 'x-api-key': chiave, 'anthropic-version': '2023-06-01', 'content-type': 'application/json' },
    body: JSON.stringify({
      model: MODELLO,
      max_tokens: 1500,
      temperature: 0,
      messages: [{
        role: 'user',
        content: [
          { type: 'image', source: { type: 'base64', media_type: mime, data: base64 } },
          { type: 'text', text: prompt(String(c.gruppo || '').slice(0, 120), String(c.topic || '').slice(0, 120), String(c.didascalia || '').slice(0, 300)) },
        ],
      }],
    }),
  })
  if (r.status === 429 || r.status === 529 || r.status >= 500) return NextResponse.json({ error: `Anthropic ${r.status}, riprovare` }, { status: 503 })
  if (!r.ok) return NextResponse.json({ error: `Anthropic ${r.status}: ${(await r.text()).slice(0, 300)}` }, { status: 502 })
  const j = await r.json()
  const testo = (Array.isArray(j?.content) ? j.content.filter((b: any) => b?.type === 'text').map((b: any) => b.text).join('\n') : '').trim()
  if (!testo) return NextResponse.json({ error: 'risposta vuota' }, { status: 502 })
  const costo = ((j?.usage?.input_tokens || 0) * PREZZO_IN + (j?.usage?.output_tokens || 0) * PREZZO_OUT) / 1_000_000

  if (prova) return NextResponse.json({ ok: true, prova: true, testo, costo_usd: costo, token: j?.usage })
  const { error: e2 } = await supabase.from('accademia_messaggi')
    .update({ testo_immagine: testo.slice(0, 12000), immagine_letta: new Date().toISOString(), immagine_costo_usd: costo })
    .eq('chat_id', chat_id).eq('msg_id', msg_id)
  if (e2) return NextResponse.json({ error: e2.message }, { status: 500 })
  return NextResponse.json({ ok: true, caratteri: testo.length, costo_usd: costo })
}
