// 28/11/2026 · Cron: CHIUSURA DI FINE MESE (e di fine anno) a mezzanotte italiana.
// Vercel lavora in UTC: il cron parte ogni ora e qui si guarda l'ora italiana (vale anche con l'ora legale).
//  · giorno 1, ore 00 -> chiude il mese appena finito; se non riesce riprova ogni ora (giorni 1-3), segnata "in ritardo"
//  · ultimo giorno del mese, ore 18 -> promemoria su Telegram: aggiornare i saldi prima di mezzanotte
// Controllo a mano, senza salvare niente:  ?prova=1&periodo=2026-11
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { partiRoma, telegramTesto } from '@/lib/accademiaRiassunto'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
export const maxDuration = 60

const euro = (v: unknown) => new Intl.NumberFormat('it-IT', { style: 'currency', currency: 'EUR' }).format(Number(v || 0))
const mesePrima = (giorno: string) => {
  const [y, m] = giorno.split('-').map(Number)
  return new Date(Date.UTC(y, m - 2, 1)).toISOString().slice(0, 7)
}
const èUltimoDelMese = (giorno: string) => {
  const [y, m, d] = giorno.split('-').map(Number)
  return d === new Date(Date.UTC(y, m, 0)).getUTCDate()
}

export async function GET(req: NextRequest) {
  const cronSecret = process.env.CRON_SECRET
  if (!cronSecret || req.headers.get('authorization') !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
  const q = req.nextUrl.searchParams
  const prova = q.get('prova') === '1'
  const { giorno, ora } = partiRoma(Date.now())

  if (!prova && ora === 18 && èUltimoDelMese(giorno)) {
    const anno = giorno.endsWith('-12-31')
    const t = await telegramTesto(`🕛 Stasera a mezzanotte il Profit Tracker chiude ${anno ? `l'ANNO ${giorno.slice(0, 4)}` : 'il mese'}.\nAggiorna prima i saldi di book e wallet e segna "Pagato" quello che hai pagato: la fotografia usa i dati registrati a quell'ora.`)
    return NextResponse.json({ ok: t.ok, promemoria: true })
  }

  const nelTurno = Number(giorno.slice(8)) <= 3
  if (!prova && !nelTurno) return NextResponse.json({ ok: true, saltato: 'non è il momento di una chiusura' })

  const chiesto = q.get('periodo') || ''
  const periodo = prova && /^\d{4}-(0[1-9]|1[0-2])$/.test(chiesto) ? chiesto : mesePrima(giorno)
  const sb = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, { auth: { persistSession: false, autoRefreshToken: false } })
  const { data, error } = await sb.rpc('chiudi_periodo', { p_periodo: periodo, p_salva: !prova })

  if (error) {
    // si riprova ogni ora; il messaggio d'errore arriva solo alle 0, alle 9 e alle 18
    if (!prova && [0, 9, 18].includes(ora)) {
      await telegramTesto(`⚠️ Chiusura ${periodo} NON riuscita: ${error.message.slice(0, 300)}\nRiprovo ogni ora fino al giorno 3. Se manca la funzione, esegui supabase/chiusure_periodo.sql su Supabase.`)
    }
    return NextResponse.json({ ok: false, errore: error.message }, { status: 500 })
  }
  if (prova) {
    const { fotografia: _foto, ...numeri } = data || {}
    return NextResponse.json({ ok: true, prova: true, ...numeri })
  }
  if (data?.gia_fatta) return NextResponse.json({ ok: true, saltato: 'già chiuso', periodo })

  const annuale = periodo.endsWith('-12')
  const t = await telegramTesto([
    `🔒 ${annuale ? `ANNO ${periodo.slice(0, 4)} CHIUSO` : `Chiusura ${periodo} fatta`}${data.in_ritardo ? ' — ⚠️ IN RITARDO: i saldi non sono quelli di mezzanotte' : ''}`,
    `Cassa: ${euro(data.cassa)}`,
    `Prelievi dell'anno: ${euro(data.prelievi_anno)}`,
    ...(annuale ? [`Il ${Number(periodo.slice(0, 4)) + 1} parte da zero, con apertura ${euro(data.cassa)}.`, 'Scarica l\'Excel in Profit Tracker → Periodi.'] : []),
  ].join('\n'))
  return NextResponse.json({ ok: true, periodo, telegram: t.ok })
}
