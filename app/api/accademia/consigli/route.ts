// 11/10/2026 · Consigli dell'Accademia estratti da Lucy, per il tab "Telegram" di Archivio Lucy. Solo admin.
// GET  ?tipo=&book=&q=&stato=attivo|archiviato&limit=&offset=  -> consigli + conteggi + stato della lettura
// PATCH {id, stato}                                            -> archivia / ripristina un consiglio
// POST {azione:'prova'|'avvia'}                                -> 'prova': cosa leggerebbe e quanto costa · 'avvia': legge adesso
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { createServerClient } from '@supabase/ssr'
import { anteprima, eseguiPassata, statoConsigli, TIPI } from '@/lib/accademiaConsigli'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
export const maxDuration = 300

const admin = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, {
  auth: { persistSession: false, autoRefreshToken: false },
})
const AIUTO = 'Esegui supabase/accademia_consigli.sql nel SQL Editor di Supabase.'
const msg = (e: unknown) => (e instanceof Error ? e.message : String(e)).slice(0, 300)

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
  const q = req.nextUrl.searchParams
  const statoF = q.get('stato') === 'archiviato' ? 'archiviato' : 'attivo'
  const limit = Math.min(Math.max(Number(q.get('limit')) || 200, 1), 500)
  const offset = Math.max(Number(q.get('offset')) || 0, 0)

  // conteggi (sempre sul totale dello stato scelto, per le chip dei filtri)
  const { data: tutti, error: e0 } = await admin.from('accademia_consigli').select('tipo,book').eq('stato', statoF).limit(5000)
  if (e0) return NextResponse.json({ error: `${e0.message}. ${AIUTO}` }, { status: 500 })
  const perTipo: Record<string, number> = {}
  const perBook: Record<string, number> = {}
  for (const r of tutti || []) {
    perTipo[r.tipo] = (perTipo[r.tipo] || 0) + 1
    const b = r.book || ''
    perBook[b] = (perBook[b] || 0) + 1
  }

  let query = admin.from('accademia_consigli')
    .select('id,tipo,book,promo,argomento,titolo,consiglio,dettagli,scopo,da_staff,autori,n_fonti,fonti,chat_titolo,topic_titolo,prima_data,ultima_data,stato')
    .eq('stato', statoF)
    .order('ultima_data', { ascending: false })
    .range(offset, offset + limit - 1)
  const tipo = q.get('tipo')
  if (tipo && (TIPI as readonly string[]).includes(tipo)) query = query.eq('tipo', tipo)
  const book = q.get('book')
  if (book === '__generale') query = query.is('book', null)
  else if (book) query = query.eq('book', book)
  const testo = (q.get('q') || '').trim().replace(/[,()%*]/g, ' ')
  if (testo) query = query.or(['titolo', 'consiglio', 'dettagli', 'promo', 'argomento', 'book'].map(c => `${c}.ilike.%${testo}%`).join(','))
  const { data, error } = await query
  if (error) return NextResponse.json({ error: `${error.message}. ${AIUTO}` }, { status: 500 })

  const st = await statoConsigli().catch(() => null)
  return NextResponse.json({ consigli: data || [], perTipo, perBook, stato: st })
}

export async function PATCH(req: NextRequest) {
  if (!(await èAdmin(req))) return NextResponse.json({ error: 'Accesso riservato agli admin' }, { status: 403 })
  const corpo = await req.json().catch(() => ({}))
  const id = Number(corpo?.id)
  const nuovo = corpo?.stato
  if (!id || (nuovo !== 'attivo' && nuovo !== 'archiviato')) return NextResponse.json({ error: 'id o stato non validi' }, { status: 400 })
  const { error } = await admin.from('accademia_consigli').update({ stato: nuovo, aggiornato: new Date().toISOString() }).eq('id', id)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true })
}

export async function POST(req: NextRequest) {
  if (!(await èAdmin(req))) return NextResponse.json({ error: 'Accesso riservato agli admin' }, { status: 403 })
  const corpo = await req.json().catch(() => ({}))
  try {
    if (corpo?.azione === 'prova') return NextResponse.json({ ok: true, ...(await anteprima()) })
    if (corpo?.azione === 'avvia') return NextResponse.json(await eseguiPassata({ forza: true, budgetMs: 200_000 }))
    return NextResponse.json({ error: 'azione non valida' }, { status: 400 })
  } catch (e) {
    return NextResponse.json({ error: `${msg(e)}. ${AIUTO}` }, { status: 500 })
  }
}
