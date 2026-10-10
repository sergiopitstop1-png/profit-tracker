// 10/10/2026 · Cron: riassunto dei messaggi dell'Accademia alle 12:00 e alle 19:00 (ora italiana).
// Vercel lavora in UTC e l'ora legale cambia: il cron parte alle 10, 11, 17 e 18 UTC e qui si controlla che in Italia sia davvero le 12 o le 19.
// Prova a mano (non salva, non manda niente):  ?prova=1&forza=19&giorno=2026-10-09
// Forza e salva:                               ?forza=12   (rifà il riassunto anche se esiste già; &telegram=0 per non inviarlo)
// Chiamata:  curl.exe -H "Authorization: Bearer IL_TUO_CRON_SECRET" "https://sergioapicella.it/api/cron/accademia-riassunto?prova=1&forza=19"
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { generaRiassunto, partiRoma, type Fascia } from '@/lib/accademiaRiassunto'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
export const maxDuration = 60

const msg = (e: unknown) => (e instanceof Error ? e.message : String(e))

export async function GET(req: NextRequest) {
  const cronSecret = process.env.CRON_SECRET
  if (!cronSecret || req.headers.get('authorization') !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
  const q = req.nextUrl.searchParams
  const prova = q.get('prova') === '1'
  const forza = q.get('forza')
  const adesso = partiRoma(Date.now())
  const fascia: Fascia | null = forza === '12' ? 12 : forza === '19' ? 19 : adesso.ora === 12 ? 12 : adesso.ora === 19 ? 19 : null
  if (!fascia) return NextResponse.json({ ok: true, saltato: `in Italia sono le ${adesso.ora}: non è l'ora di un riassunto` })
  const giorno = /^\d{4}-\d{2}-\d{2}$/.test(q.get('giorno') || '') ? (q.get('giorno') as string) : adesso.giorno

  try {
    if (!forza && !prova) {
      const sb = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, { auth: { persistSession: false, autoRefreshToken: false } })
      const { data } = await sb.from('accademia_riassunti').select('id').eq('giorno', giorno).eq('fascia', fascia).maybeSingle()
      if (data) return NextResponse.json({ ok: true, saltato: 'riassunto già fatto' })
    }
    const r = await generaRiassunto({ giorno, fascia, salva: !prova, telegram: !prova && q.get('telegram') !== '0' })
    return NextResponse.json({ ok: true, prova, ...r })
  } catch (e) {
    return NextResponse.json({ ok: false, errore: msg(e).slice(0, 300) }, { status: 500 })
  }
}
