/* eslint-disable @typescript-eslint/no-explicit-any */
// ═════════════════════════════════════════════════════════════════
// /api/lucy-chat — chat con Lucy (15/10/2026) · SOLA LETTURA
// POST { messages: [{role:'user'|'assistant', content}] } → { risposta }
// Solo utenti vip/admin loggati. Lucy legge un riassunto degli ultimi giorni (operazioni, rimandate, avvisi)
// e risponde; NON scrive nulla nel database. Chiave: LUCY_ANTHROPIC_API_KEY (Vercel). Modello: LUCY_CHAT_MODEL (default claude-sonnet-5-5)
// ═════════════════════════════════════════════════════════════════
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { isRequestAuthorized } from '../../../lib/apiAuth'

export const runtime = 'nodejs'
export const maxDuration = 60

const MODELLO = process.env.LUCY_CHAT_MODEL || 'claude-sonnet-5-5'
const MAX_MESSAGGI = 20
const MAX_CHARS_CONTESTO = 24000

const giornoIso = (d: Date) => d.toLocaleDateString('sv-SE', { timeZone: 'Europe/Rome' })
const taglia = (v: any, n = 120) => String(v ?? '').replace(/\s+/g, ' ').slice(0, n)

async function contesto() {
  const sb = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL as string, process.env.SUPABASE_SERVICE_ROLE_KEY as string, { auth: { persistSession: false } })
  const oggi = giornoIso(new Date())
  const da = giornoIso(new Date(Date.now() - 6 * 86400000))
  const parti: string[] = [`Oggi è ${oggi} (ora italiana).`]
  const prova = async (nome: string, fn: () => Promise<string>) => { try { const t = await fn(); if (t) parti.push(`\n## ${nome}\n${t}`) } catch { parti.push(`\n## ${nome}\n(non leggibile)`) } }

  await prova('Operazioni Sport Lucy confermate (ultimi 7 giorni)', async () => {
    const { data, error } = await sb.from('lucy_bet_confermate').select('rec,data').gte('data', da).order('data', { ascending: false }).limit(150)
    if (error) throw error
    return (data || []).map((r: any) => r.rec || {}).map((x: any) => `- ${x.data || ''} · ${taglia(x.book, 30)} · ${taglia(x.intestatario, 30)} · ${taglia(x.tipo, 30)} · stake ${x.stake ?? '?'}${x.partita ? ' · ' + taglia(x.partita, 50) : ''}`).join('\n')
  })
  await prova('Bet saltate o rimandate (ultimi 7 giorni)', async () => {
    const { data, error } = await sb.from('lucy_decisioni').select('*').gte('data', da).order('creato', { ascending: false }).limit(60)
    if (error) throw error
    return (data || []).map((d: any) => `- ${d.data} · ${d.decisione} · ${taglia(d.book_nome, 30)} · ${taglia(d.intestatario, 30)} · ${taglia(d.motivo, 80)}`).join('\n')
  })
  await prova('Voci di Oggi da fare rimandate', async () => {
    const { data, error } = await sb.from('oggi_da_fare_stato').select('*').eq('stato', 'rimandato').order('rimanda_a', { ascending: true }).limit(80)
    if (error) throw error
    return (data || []).map((r: any) => `- rimandata al ${r.rimanda_a} · ${taglia(r.titolo, 90)} · ${taglia(r.dettaglio, 90)}`).join('\n')
  })
  await prova('Avvisi sui conti ancora aperti', async () => {
    const { data, error } = await sb.from('avvisi_conti').select('*').not('stato', 'in', '(fatto,annullato)').order('data_prevista', { ascending: true }).limit(60)
    if (error) throw error
    return (data || []).map((a: any) => `- ${a.data_prevista || ''} · ${taglia(a.tipo, 30)} · ${taglia(a.book_nome || a.nome_book || a.book, 30)} · ${taglia(a.intestatario, 30)} · ${taglia(a.motivo || a.nota || a.testo, 100)}`).join('\n')
  })
  return parti.join('\n').slice(0, MAX_CHARS_CONTESTO)
}

const SISTEMA = (ctx: string) => `Sei Lucy, l'assistente di Sergio per il Profit Tracker (matched betting, ~800 conti bookmaker di circa 23 clienti, profilazione, mantenimento e recupero dei conti). Parli sempre in italiano, con tono caldo ma professionale, e rispondi in modo BREVE e chiaro (Sergio non è un programmatore e si perde nei testi lunghi).

Regole:
- Scrivi in testo semplice: niente asterischi, niente grassetto, niente titoli markdown. Se serve un elenco usa righe che iniziano con un trattino.
- Se Sergio ti saluta o fa due chiacchiere, rispondi brevemente e con calore, senza elencare scadenze o attività: le porti solo se te le chiede o se c'è qualcosa di davvero urgente e lo dici in una riga.
- Rispondi usando SOLO i dati qui sotto e quello che Sergio ti scrive. Se un dato non c'è, dillo chiaramente: non inventare conti, importi, date o quote.
- Sei in sola lettura: in questa chat non puoi modificare nulla (non puoi registrare operazioni, rimandare voci, confermare bet). Se Sergio chiede un'azione, spiega in quale pulsante del Profit Tracker farla.
- Per decisioni importanti (soldi, rischi) ragiona con lui, ma ricorda che l'ultima parola è sua.
- Regole fisse del lavoro: massimo 5 incroci al giorno (modalità "solo conti": tu indichi i conti e l'importo della prima bet, Sergio sceglie la partita); Masaniello di recupero in pausa; mai bet sotto quota 1,40; mai operazioni su Bet365 di domenica.

DATI DEL PROFIT TRACKER (riassunto automatico, può essere incompleto):
${ctx}`

export async function POST(req: NextRequest) {
  if (!(await isRequestAuthorized(req))) return NextResponse.json({ error: 'non autorizzato' }, { status: 401 })
  const chiave = process.env.LUCY_ANTHROPIC_API_KEY
  if (!chiave) return NextResponse.json({ error: 'LUCY_ANTHROPIC_API_KEY mancante su Vercel' }, { status: 500 })
  let c: any
  try { c = await req.json() } catch { return NextResponse.json({ error: 'JSON non valido' }, { status: 400 }) }
  const messaggi = (Array.isArray(c?.messages) ? c.messages : [])
    .filter((m: any) => (m?.role === 'user' || m?.role === 'assistant') && typeof m?.content === 'string' && m.content.trim())
    .slice(-MAX_MESSAGGI).map((m: any) => ({ role: m.role, content: m.content.slice(0, 4000) }))
  while (messaggi.length && messaggi[0].role !== 'user') messaggi.shift()
  if (!messaggi.length || messaggi[messaggi.length - 1].role !== 'user') return NextResponse.json({ error: 'messaggio mancante' }, { status: 400 })

  const ctx = await contesto()
  const r = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: { 'x-api-key': chiave, 'anthropic-version': '2023-06-01', 'content-type': 'application/json' },
    body: JSON.stringify({ model: MODELLO, max_tokens: 1000, system: SISTEMA(ctx), messages: messaggi }),
  })
  if (!r.ok) return NextResponse.json({ error: `Anthropic ${r.status}: ${(await r.text()).slice(0, 200)}` }, { status: r.status === 429 || r.status >= 500 ? 503 : 502 })
  const j = await r.json()
  const risposta = (Array.isArray(j?.content) ? j.content.filter((b: any) => b?.type === 'text').map((b: any) => b.text).join('\n') : '').trim()
  if (!risposta) return NextResponse.json({ error: 'risposta vuota' }, { status: 502 })
  return NextResponse.json({ risposta })
}
