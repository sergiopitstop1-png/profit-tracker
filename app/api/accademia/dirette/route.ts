// 09/10/2026 · Calendario dirette dell'Accademia (solo admin).
// GET            -> prossime dirette (da 2 ore fa in avanti)
// DELETE ?id=N   -> toglie una diretta sbagliata (il messaggio non verrà riletto)
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { createServerClient } from '@supabase/ssr'

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

export async function GET(req: NextRequest) {
  if (!(await èAdmin(req))) return NextResponse.json({ error: 'Accesso riservato agli admin' }, { status: 403 })
  const da = new Date(Date.now() - 2 * 3600000).toISOString()
  const { data, error } = await admin
    .from('accademia_dirette')
    .select('id,titolo,inizio,link,gruppo,topic')
    .gte('inizio', da)
    .order('inizio', { ascending: true })
    .limit(60)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ dirette: data || [] })
}

export async function DELETE(req: NextRequest) {
  if (!(await èAdmin(req))) return NextResponse.json({ error: 'Accesso riservato agli admin' }, { status: 403 })
  const id = req.nextUrl.searchParams.get('id')
  if (!id || !/^\d+$/.test(id)) return NextResponse.json({ error: 'id non valido' }, { status: 400 })
  const { error } = await admin.from('accademia_dirette').delete().eq('id', id)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true })
}
