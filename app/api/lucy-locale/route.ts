/* eslint-disable @typescript-eslint/no-explicit-any */
// ═════════════════════════════════════════════════════════════════
// /api/lucy-locale — porta per la Lucy che gira sul PC (15/10/2026): lettura + registrazione operazioni dopo il sì (28/10/2026)
// GET  → { strumenti, tabelle }                       (cosa può leggere Lucy)
// POST { strumento, input, max?, messaggio_utente? } → { risultato }   (cerca_comunicazioni | elenco_tabelle | leggi_tabella | trova_conto | conti_disponibili | registra_operazione)
// Header  x-pt-segreto: <SEGNALI_SECRET>  (la stessa chiave degli altri script del PC). Se la variabile manca su Vercel la porta resta chiusa.
// Non usa Claude. L'unica scrittura è registra_operazione (coda registra_coda, solo dopo il sì). Stesse regole di sicurezza della chat su Vercel (lib/lucyLettura.ts): niente password/chiavi/token/utenti, niente OTP.
// ═════════════════════════════════════════════════════════════════
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { timingSafeEqual } from 'crypto'
import { STRUMENTI as STRUMENTI_LETTURA, elencoTabelle, eseguiStrumento } from '../../../lib/lucyLettura'
import { STRUMENTI_REGISTRA, trovaConto, registraOperazione, contiDisponibili } from '../../../lib/lucyRegistra'

// Lettura + (28/10/2026) cercare/consigliare conti e registrare operazioni. Registrare richiede il campo "messaggio_utente" (l'ultima frase di Sergio):
// il sito registra solo se è un sì/ok, come nella chat su Vercel.
const STRUMENTI = [...STRUMENTI_LETTURA, ...STRUMENTI_REGISTRA] as any[]

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
export const maxDuration = 60

function controllo(req: NextRequest): NextResponse | null {
  const segreto = process.env.SEGNALI_SECRET
  if (!segreto) return NextResponse.json({ error: 'porta chiusa: manca SEGNALI_SECRET su Vercel (o serve un Redeploy)' }, { status: 503 })
  const a = Buffer.from(req.headers.get('x-pt-segreto') || '')
  const b = Buffer.from(segreto)
  if (a.length !== b.length || !timingSafeEqual(a, b)) return NextResponse.json({ error: 'non autorizzato' }, { status: 401 })
  return null
}

export async function GET(req: NextRequest) {
  const no = controllo(req)
  if (no) return no
  return NextResponse.json({ strumenti: STRUMENTI, tabelle: elencoTabelle() })
}

export async function POST(req: NextRequest) {
  const no = controllo(req)
  if (no) return no
  let c: any
  try { c = await req.json() } catch { return NextResponse.json({ error: 'JSON non valido' }, { status: 400 }) }
  const nome = String(c?.strumento ?? '')
  if (!STRUMENTI.some(s => s.name === nome)) return NextResponse.json({ error: 'strumento sconosciuto' }, { status: 400 })
  const max = Math.min(14000, Math.max(1000, Math.round(Number(c?.max)) || 4000))
  const input = c?.input && typeof c.input === 'object' ? c.input : {}
  const sb = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL as string, process.env.SUPABASE_SERVICE_ROLE_KEY as string, { auth: { persistSession: false } })
  let risultato: string
  if (nome === 'trova_conto') risultato = await trovaConto(sb, input)
  else if (nome === 'conti_disponibili') risultato = await contiDisponibili(sb, input)
  else if (nome === 'registra_operazione') risultato = await registraOperazione(sb, input, String(c?.messaggio_utente ?? ''))
  else risultato = await eseguiStrumento(sb, nome, input, max)
  return NextResponse.json({ risultato })
}
