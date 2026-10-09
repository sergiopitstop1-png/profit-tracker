// 09/10/2026 · Lettura dei messaggi Telegram dell'Accademia per la tab "Telegram" di Archivio Lucy.
// Solo admin. La tabella accademia_messaggi non ha policy di lettura: si legge solo da qui (service role).
// GET ?elenco=1                      -> gruppi e topic con conteggi (serve la funzione SQL accademia_gruppi)
// GET ?q=&chat=&topic=&autore=&da=&a=&offset=&limit=  -> messaggi, dal più recente
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

// toglie i caratteri che hanno un significato nei filtri di PostgREST e quelli di ilike
const pulisci = (s: string) => s.replace(/[%_*,()\\]/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 100)
const intero = (v: string | null) => (v !== null && /^-?\d+$/.test(v) ? v : null)
const dataValida = (v: string | null) => (v && !Number.isNaN(new Date(v).getTime()) ? new Date(v).toISOString() : null)

export async function GET(req: NextRequest) {
  if (!(await èAdmin(req))) return NextResponse.json({ error: 'Accesso riservato agli admin' }, { status: 403 })
  const sp = req.nextUrl.searchParams

  if (sp.get('elenco')) {
    const { data, error } = await admin.rpc('accademia_gruppi')
    if (error) return NextResponse.json({ error: `elenco gruppi non disponibile: ${error.message}. Esegui supabase/accademia_gruppi.sql` }, { status: 500 })
    return NextResponse.json({ gruppi: data || [] })
  }

  const limit = Math.min(100, Math.max(1, Number(sp.get('limit')) || 50))
  const offset = Math.max(0, Number(sp.get('offset')) || 0)

  let q = admin
    .from('accademia_messaggi')
    .select('id,chat_id,chat_titolo,topic_id,topic_titolo,msg_id,data_msg,mittente,testo,media_tipo,link', { count: 'exact' })
    .order('data_msg', { ascending: false })
    .order('id', { ascending: false })
    .range(offset, offset + limit - 1)

  const chat = intero(sp.get('chat'))
  if (chat) q = q.eq('chat_id', chat)
  const topic = sp.get('topic')
  if (topic === '0') q = q.is('topic_id', null)
  else if (intero(topic)) q = q.eq('topic_id', topic as string)
  const autore = pulisci(sp.get('autore') || '')
  if (autore) q = q.ilike('mittente', `%${autore}%`)
  const da = dataValida(sp.get('da'))
  if (da) q = q.gte('data_msg', da)
  const a = dataValida(sp.get('a'))
  if (a) q = q.lte('data_msg', a)
  // ricerca: ogni parola deve comparire nel testo (maiuscole/minuscole ininfluenti, anche pezzi di parola e codici)
  for (const parola of pulisci(sp.get('q') || '').split(' ').filter(Boolean).slice(0, 6)) q = q.ilike('testo', `%${parola}%`)

  const { data, error, count } = await q
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ messaggi: data || [], totale: count ?? 0, offset, limit })
}
