// ════════════════════════════════════════════════════════════════════
// /api/segnali — riceve i segnali ScoreTrend dal lettore sul PC (03/10/2026)
// POST { righe: [...] }  con header  x-pt-segreto: <SEGNALI_SECRET>
// Inserisce o aggiorna per msg_id (i risultati arrivano come modifica del messaggio).
// ════════════════════════════════════════════════════════════════════
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

export const runtime = 'nodejs'

const CAMPI = ['msg_id', 'data_msg', 'data_partita', 'ora', 'competizione', 'casa', 'ospite', 'live', 'minuto', 'mercato',
  'linea', 'tempo', 'quota', 'selezione', 'unita', 'esito', 'profitto', 'link', 'scoretrend_id'] as const

export async function POST(req: NextRequest) {
  const segreto = process.env.SEGNALI_SECRET
  if (!segreto || req.headers.get('x-pt-segreto') !== segreto) {
    return NextResponse.json({ error: 'non autorizzato' }, { status: 401 })
  }
  let corpo: any
  try { corpo = await req.json() } catch { return NextResponse.json({ error: 'JSON non valido' }, { status: 400 }) }
  const righe = Array.isArray(corpo?.righe) ? corpo.righe : []
  if (!righe.length) return NextResponse.json({ salvati: 0 })
  if (righe.length > 1000) return NextResponse.json({ error: 'massimo 1000 righe per invio' }, { status: 400 })

  const pulite = righe
    .filter((r: any) => Number.isFinite(Number(r?.msg_id)))
    .map((r: any) => {
      const o: Record<string, any> = {}
      for (const k of CAMPI) o[k] = r[k] === undefined || r[k] === '' ? null : r[k]
      o.aggiornato = new Date().toISOString()
      return o
    })

  const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL as string, process.env.SUPABASE_SERVICE_ROLE_KEY as string, { auth: { persistSession: false } })
  const { error } = await supabase.from('scoretrend_segnali').upsert(pulite, { onConflict: 'msg_id' })
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ salvati: pulite.length })
}
