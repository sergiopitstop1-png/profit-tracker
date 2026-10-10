// 10/10/2026 · Messaggi recenti di "Profiliamo" (gruppo/topic dell'Accademia) per la sezione "Profiliamo oggi" di Profilazione.
// Solo admin. Legge accademia_messaggi (testo + testo letto dalle immagini). GET ?ore=36
// Il gruppo si riconosce dal nome (chat o topic contiene "profiliamo"); si può cambiare con ACCADEMIA_PROFILIAMO_PAROLE.
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { createServerClient } from '@supabase/ssr'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

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

const PAROLE = (process.env.ACCADEMIA_PROFILIAMO_PAROLE || 'profiliamo').split(',').map(s => s.trim().toLowerCase()).filter(Boolean)

export async function GET(req: NextRequest) {
  if (!(await èAdmin(req))) return NextResponse.json({ error: 'Accesso riservato agli admin' }, { status: 403 })
  const ore = Math.min(24 * 14, Math.max(1, Number(req.nextUrl.searchParams.get('ore')) || 36))
  const da = new Date(Date.now() - ore * 3600 * 1000).toISOString()
  const { data, error } = await admin
    .from('accademia_messaggi')
    .select('id,chat_titolo,topic_titolo,msg_id,data_msg,mittente,testo,testo_immagine,media_tipo,link')
    .gte('data_msg', da)
    .order('data_msg', { ascending: false })
    .limit(600)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  const messaggi = (data || []).filter(m => {
    const t = `${m.chat_titolo || ''} ${m.topic_titolo || ''}`.toLowerCase()
    return PAROLE.some(p => t.includes(p)) && (m.testo || m.testo_immagine)
  })
  return NextResponse.json({ messaggi, ore })
}
