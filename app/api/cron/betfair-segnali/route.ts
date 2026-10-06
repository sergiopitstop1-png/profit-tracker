// app/api/cron/betfair-segnali/route.ts
// Cron (ogni 5 minuti): congela la quota Betfair dei segnali nuovi e aggiorna il prezzo di chiusura.
// Protetto da CRON_SECRET come gli altri cron. La logica sta in app/profit-tracker/segnali/congela.ts
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { eseguiCongelamento } from '../../../profit-tracker/segnali/congela'

export const runtime = 'nodejs'
export const maxDuration = 60

export async function GET(req: NextRequest) {
  const cronSecret = process.env.CRON_SECRET
  if (!cronSecret || req.headers.get('authorization') !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
  try {
    const sb = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, {
      auth: { persistSession: false, autoRefreshToken: false },
    })
    return NextResponse.json(await eseguiCongelamento(sb))
  } catch (e: any) {
    console.error('[Betfair segnali] errore', e)
    return NextResponse.json({ ok: false, error: e?.message || String(e) }, { status: 500 })
  }
}
