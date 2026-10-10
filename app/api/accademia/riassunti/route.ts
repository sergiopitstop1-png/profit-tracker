// 10/10/2026 · Riassunti dei messaggi dell'Accademia per il tab "Telegram" di Archivio Lucy. Solo admin.
// GET            -> ultimi 40 riassunti (dal più recente)
// POST {fascia}  -> rifà (o fa adesso) il riassunto di oggi per la fascia 12 o 19, senza mandarlo su Telegram
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { createServerClient } from '@supabase/ssr'
import { generaRiassunto, partiRoma, type Fascia } from '@/lib/accademiaRiassunto'

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
    .from('accademia_riassunti')
    .select('id,giorno,fascia,da,a,testo,n_messaggi,n_selezionati,costo_usd,inviato_telegram,creato')
    .order('giorno', { ascending: false })
    .order('fascia', { ascending: false })
    .limit(40)
  if (error) return NextResponse.json({ error: `${error.message}. Esegui supabase/accademia_riassunti.sql` }, { status: 500 })
  return NextResponse.json({ riassunti: data || [] })
}

export async function POST(req: NextRequest) {
  if (!(await èAdmin(req))) return NextResponse.json({ error: 'Accesso riservato agli admin' }, { status: 403 })
  const corpo = await req.json().catch(() => ({}))
  const fascia = Number(corpo?.fascia)
  if (fascia !== 12 && fascia !== 19) return NextResponse.json({ error: 'fascia non valida (12 o 19)' }, { status: 400 })
  try {
    const r = await generaRiassunto({ giorno: partiRoma(Date.now()).giorno, fascia: fascia as Fascia, salva: true, telegram: false })
    return NextResponse.json({ ok: true, n_messaggi: r.n_messaggi, n_selezionati: r.n_selezionati, costo_usd: r.costo_usd })
  } catch (e) {
    return NextResponse.json({ error: (e instanceof Error ? e.message : String(e)).slice(0, 300) }, { status: 500 })
  }
}
