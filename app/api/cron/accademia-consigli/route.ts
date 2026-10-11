// 11/10/2026 · Cron: Lucy legge i messaggi nuovi dei topic del pilota e ne estrae i consigli (vedi lib/accademiaConsigli.ts).
// Parte ogni 15 minuti ma lavora solo se c'è abbastanza testo nuovo (o sono passate 20 ore). Ricorda da sola fin dove ha letto.
// Prova (non legge niente, non spende):  ?prova=1        Forza (legge anche se c'è poco di nuovo):  ?forza=1
// Chiamata:  curl.exe -H "Authorization: Bearer IL_TUO_CRON_SECRET" "https://sergioapicella.it/api/cron/accademia-consigli?prova=1"
import { NextRequest, NextResponse } from 'next/server'
import { anteprima, eseguiPassata } from '@/lib/accademiaConsigli'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
export const maxDuration = 300

export async function GET(req: NextRequest) {
  const cronSecret = process.env.CRON_SECRET
  if (!cronSecret || req.headers.get('authorization') !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
  const q = req.nextUrl.searchParams
  try {
    if (q.get('prova') === '1') return NextResponse.json({ ok: true, prova: true, ...(await anteprima()) })
    return NextResponse.json(await eseguiPassata({ forza: q.get('forza') === '1' }))
  } catch (e) {
    return NextResponse.json({ ok: false, error: (e instanceof Error ? e.message : String(e)).slice(0, 300) }, { status: 500 })
  }
}
