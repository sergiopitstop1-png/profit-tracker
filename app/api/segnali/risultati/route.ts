// ════════════════════════════════════════════════════════════════════
// /api/segnali/risultati — risultati completi delle partite dei segnali (04/10/2026)
// Lo usa il programma risultati_partite.py sul PC (header x-pt-segreto = SEGNALI_SECRET).
//  GET  → elenco dei segnali (ScoreTrend e Hunterbet) che non hanno ancora il risultato finale
//  POST { tabella: 'scoretrend' | 'hunterbet', righe: [{ msg_id, ht_casa, ht_ospite, ft_casa, ft_ospite, gol, af_fixture_id, af_stato }] }
//       Un valore già scritto non viene mai cancellato da uno vuoto.
// ════════════════════════════════════════════════════════════════════
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
export const runtime = 'nodejs'

const TABELLE = { scoretrend: 'scoretrend_segnali', hunterbet: 'hunterbet_segnali' } as const
const CAMPI = ['ht_casa', 'ht_ospite', 'ft_casa', 'ft_ospite', 'gol', 'af_fixture_id', 'af_stato'] as const
const db = () => createClient(process.env.NEXT_PUBLIC_SUPABASE_URL as string, process.env.SUPABASE_SERVICE_ROLE_KEY as string, { auth: { persistSession: false } })
const autorizzato = (req: NextRequest) => !!process.env.SEGNALI_SECRET && req.headers.get('x-pt-segreto') === process.env.SEGNALI_SECRET

export async function GET(req: NextRequest) {
  if (!autorizzato(req)) return NextResponse.json({ error: 'non autorizzato' }, { status: 401 })
  const supabase = db()
  const limite = new Date(Date.now() - 3 * 3600 * 1000).toISOString()            // partite iniziate da almeno 3 ore
  const dieciGiorniFa = new Date(Date.now() - 10 * 86400 * 1000).toISOString()   // oltre, API-Football per data non serve più
  const out: any[] = []
  {
    const { data, error } = await supabase.from('scoretrend_segnali')
      .select('msg_id,data_msg,data_partita,casa,ospite,af_fixture_id,risultato_tentativi')
      .is('ft_casa', null).lte('data_msg', limite).gte('data_msg', dieciGiorniFa).lt('risultato_tentativi', 6).limit(500)
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    for (const r of data || []) out.push({ tabella: 'scoretrend', ...r })
  }
  {
    const { data, error } = await supabase.from('hunterbet_segnali')
      .select('msg_id,data_msg,casa,ospite,fixture_id,af_fixture_id,risultato_tentativi')
      .is('ft_casa', null).lte('data_msg', limite).gte('data_msg', dieciGiorniFa).lt('risultato_tentativi', 6).limit(500)
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    for (const r of data || []) out.push({ tabella: 'hunterbet', ...r })
  }
  return NextResponse.json({ mancanti: out })
}

export async function POST(req: NextRequest) {
  if (!autorizzato(req)) return NextResponse.json({ error: 'non autorizzato' }, { status: 401 })
  let corpo: any
  try { corpo = await req.json() } catch { return NextResponse.json({ error: 'JSON non valido' }, { status: 400 }) }
  const tabella = TABELLE[corpo?.tabella as keyof typeof TABELLE]
  if (!tabella) return NextResponse.json({ error: 'tabella non valida' }, { status: 400 })
  const righe = Array.isArray(corpo?.righe) ? corpo.righe.slice(0, 1000) : []
  const supabase = db()
  let aggiornati = 0
  for (const r of righe) {
    const id = Number(r?.msg_id)
    if (!Number.isFinite(id)) continue
    const { data: prima, error: e1 } = await supabase.from(tabella).select('*').eq('msg_id', id).maybeSingle()
    if (e1) return NextResponse.json({ error: e1.message }, { status: 500 })
    if (!prima) continue
    const patch: Record<string, any> = {}
    for (const k of CAMPI) {
      const v = r[k]
      if (v !== null && v !== undefined && v !== '' && JSON.stringify(v) !== JSON.stringify(prima[k])) patch[k] = v
    }
    if (r?.non_trovata) patch.risultato_tentativi = Number(prima.risultato_tentativi || 0) + 1   // dopo 6 tentativi si smette di cercarla
    if (!Object.keys(patch).length) continue
    const { error } = await supabase.from(tabella).update(patch).eq('msg_id', id)
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    aggiornati++
  }
  return NextResponse.json({ aggiornati })
}
