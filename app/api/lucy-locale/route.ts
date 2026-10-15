/* eslint-disable @typescript-eslint/no-explicit-any */
// ═════════════════════════════════════════════════════════════════
// /api/lucy-locale — porta di LETTURA per la Lucy che gira sul PC (15/10/2026) · SOLA LETTURA
// GET  → { strumenti, tabelle }                       (cosa può leggere Lucy)
// POST { strumento, input, max? } → { risultato }     (esegue cerca_comunicazioni | elenco_tabelle | leggi_tabella)
// Header  x-pt-segreto: <SEGNALI_SECRET>  (la stessa chiave degli altri script del PC). Se la variabile manca su Vercel la porta resta chiusa.
// Non usa Claude e non scrive nulla. Stesse regole di sicurezza della chat su Vercel (lib/lucyLettura.ts): niente password/chiavi/token/utenti, niente OTP.
// ═════════════════════════════════════════════════════════════════
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { timingSafeEqual } from 'crypto'
import { STRUMENTI, elencoTabelle, eseguiStrumento } from '../../../lib/lucyLettura'

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
  const risultato = await eseguiStrumento(sb, nome, input, max)
  return NextResponse.json({ risultato })
}
