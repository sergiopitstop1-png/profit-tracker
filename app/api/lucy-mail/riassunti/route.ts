// 10/10/2026 · Riassunti di mail e SMS per la tab "Mail e SMS" di Archivio Lucy. Solo admin.
// GET            -> ultimi 40 riassunti (dal più recente)
// POST {fascia}  -> rifà (o fa adesso) il riassunto di oggi per la fascia 12 o 19, senza mandarlo su Telegram
// POST {invia: id} -> manda su Telegram un riassunto già salvato (pulsante «Invia su Telegram»)
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { createServerClient } from '@supabase/ssr'
import { partiRoma, type Fascia } from '@/lib/accademiaRiassunto'
import { generaRiassuntoMail, inviaRiassuntoMailTelegram } from '@/lib/mailRiassunto'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
export const maxDuration = 60

const admin = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, {
  auth: { persistSession: false, autoRefreshToken: false },
})

async function èAdmin(req: NextRequest) {
  const response = NextResponse.next()
  const supabase = createServerClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!, {
    cookies: {
      get(name) { return req.cookies.get(name)?.value },
      set(name, value, options) { response.cookies.set({ name, value, ...options }) },
      remove(name, options) { response.cookies.set({ name, value: '', ...options }) },
    },
  })
  const { data: { session } } = await supabase.auth.getSession()
  if (!session) return false
  const { data: profile } = await supabase.from('user_profiles').select('role').eq('id', session.user.id).single()
  return profile?.role === 'admin'
}

export async function GET(req: NextRequest) {
  if (!(await èAdmin(req))) return NextResponse.json({ error: 'Accesso riservato agli admin' }, { status: 403 })
  const { data, error } = await admin
    .from('mail_riassunti')
    .select('id,giorno,fascia,da,a,testo,n_messaggi,n_selezionati,costo_usd,inviato_telegram,creato')
    .order('giorno', { ascending: false })
    .order('fascia', { ascending: false })
    .limit(40)
  if (error) return NextResponse.json({ error: `${error.message}. Esegui supabase/mail_riassunti.sql` }, { status: 500 })
  return NextResponse.json({ riassunti: data || [] })
}

export async function POST(req: NextRequest) {
  if (!(await èAdmin(req))) return NextResponse.json({ error: 'Accesso riservato agli admin' }, { status: 403 })
  const corpo = await req.json().catch(() => ({}))
  if (corpo?.invia != null) {
    const id = Number(corpo.invia)
    if (!Number.isFinite(id)) return NextResponse.json({ error: 'riassunto non valido' }, { status: 400 })
    const { data: riga, error: eL } = await admin.from('mail_riassunti').select('id,giorno,fascia,testo').eq('id', id).maybeSingle()
    if (eL || !riga) return NextResponse.json({ error: eL?.message || 'riassunto non trovato' }, { status: 404 })
    const t = await inviaRiassuntoMailTelegram(riga)
    if (!t.ok) return NextResponse.json({ error: `Non inviato su Telegram: ${t.motivo}` }, { status: 502 })
    await admin.from('mail_riassunti').update({ inviato_telegram: true }).eq('id', id)
    return NextResponse.json({ ok: true, inviato: true })
  }
  const fascia = Number(corpo?.fascia)
  if (fascia !== 12 && fascia !== 19) return NextResponse.json({ error: 'fascia non valida (12 o 19)' }, { status: 400 })
  try {
    const r = await generaRiassuntoMail({ giorno: partiRoma(Date.now()).giorno, fascia: fascia as Fascia, salva: true, telegram: false })
    return NextResponse.json({ ok: true, n_messaggi: r.n_messaggi, n_selezionati: r.n_selezionati, costo_usd: r.costo_usd })
  } catch (e) {
    return NextResponse.json({ error: (e instanceof Error ? e.message : String(e)).slice(0, 300) }, { status: 500 })
  }
}
