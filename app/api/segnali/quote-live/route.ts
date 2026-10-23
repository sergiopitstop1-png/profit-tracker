// ════════════════════════════════════════════════════════════════════
// /api/segnali/quote-live — quota Bet365 in diretta al momento del segnale Hunterbet (24/10/2026)
// Lo usa quote_live.py sul PC (header x-pt-segreto = SEGNALI_SECRET).
//  GET  → segnali LIVE «Gol casa/ospiti» arrivati da meno di 15 minuti e ancora senza quota
//  POST { righe: [{ msg_id, stato: 'ok' | 'sospesa' | 'riprova', quota, linea, fixture_id }] }
//       'riprova' = quota non trovata adesso: si riprova al giro dopo, fino a 8 tentativi, poi diventa 'fallita'.
// Una quota già scritta non viene mai cancellata. Non tocca la quota che scrivi tu a mano (colonna «quota»).
// ════════════════════════════════════════════════════════════════════
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
export const runtime = 'nodejs'

const db = () => createClient(process.env.NEXT_PUBLIC_SUPABASE_URL as string, process.env.SUPABASE_SERVICE_ROLE_KEY as string, { auth: { persistSession: false } })
const autorizzato = (req: NextRequest) => !!process.env.SEGNALI_SECRET && req.headers.get('x-pt-segreto') === process.env.SEGNALI_SECRET
const MAX_TENTATIVI = 8

export async function GET(req: NextRequest) {
  if (!autorizzato(req)) return NextResponse.json({ error: 'non autorizzato' }, { status: 401 })
  const quindiciMinutiFa = new Date(Date.now() - 15 * 60000).toISOString()
  const { data, error } = await db().from('hunterbet_segnali')
    .select('msg_id,data_msg,casa,ospite,tipo_segnale,score_casa_segnale,score_ospite_segnale,fixture_id,af_fixture_id,quota_b365_tentativi,quota_b365_stato')
    .in('tipo_segnale', ['GOL_CASA', 'GOL_OSPITI']).is('quota_b365', null).gte('data_msg', quindiciMinutiFa)
    .or('quota_b365_stato.is.null,quota_b365_stato.eq.riprova').order('data_msg', { ascending: true }).limit(50)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })   // colonne mancanti: hunterbet_quota_b365.sql non lanciato
  return NextResponse.json({ segnali: data || [] })
}

export async function POST(req: NextRequest) {
  if (!autorizzato(req)) return NextResponse.json({ error: 'non autorizzato' }, { status: 401 })
  let corpo: any
  try { corpo = await req.json() } catch { return NextResponse.json({ error: 'JSON non valido' }, { status: 400 }) }
  const righe = Array.isArray(corpo?.righe) ? corpo.righe.slice(0, 200) : []
  const supabase = db()
  let aggiornati = 0
  for (const r of righe) {
    const id = Number(r?.msg_id)
    if (!Number.isFinite(id)) continue
    const { data: prima, error: e1 } = await supabase.from('hunterbet_segnali').select('msg_id,quota_b365,quota_b365_tentativi').eq('msg_id', id).maybeSingle()
    if (e1) return NextResponse.json({ error: e1.message }, { status: 500 })
    if (!prima || prima.quota_b365 != null) continue                              // già letta: non si cambia
    const tentativi = Number(prima.quota_b365_tentativi || 0) + 1
    const patch: Record<string, any> = { quota_b365_tentativi: tentativi }
    const q = Number(r.quota)
    if ((r.stato === 'ok' || r.stato === 'sospesa') && q > 1 && q < 1000) {
      Object.assign(patch, { quota_b365: q, quota_b365_linea: Number.isFinite(Number(r.linea)) ? Number(r.linea) : null, quota_b365_il: new Date().toISOString(), quota_b365_stato: r.stato })
    } else {
      patch.quota_b365_stato = tentativi >= MAX_TENTATIVI ? 'fallita' : 'riprova'
    }
    if (r.fixture_id && Number.isFinite(Number(r.fixture_id))) patch.af_fixture_id = Number(r.fixture_id)
    const { error } = await supabase.from('hunterbet_segnali').update(patch).eq('msg_id', id)
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    aggiornati++
  }
  return NextResponse.json({ aggiornati })
}
