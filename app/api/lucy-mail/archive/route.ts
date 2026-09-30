import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

export async function GET(req: NextRequest) {
  const sp = req.nextUrl.searchParams
  const page = Math.max(1, Number(sp.get('page') || 1))
  const pageSize = Math.min(100, Math.max(10, Number(sp.get('page_size') || 50)))
  const from = (page - 1) * pageSize
  const to = from + pageSize - 1

  let q = supabase.from('lucy_mail_archive').select('*', { count: 'exact' })

  const cliente = sp.get('cliente')
  const bookmaker = sp.get('bookmaker')
  const giudizio = sp.get('giudizio')
  const categoria = sp.get('categoria')
  const priorita = sp.get('priorita')
  const search = sp.get('q')
  const dal = sp.get('dal')
  const al = sp.get('al')

  if (cliente) q = q.ilike('cliente_nome', `%${cliente}%`)
  if (bookmaker) q = q.ilike('bookmaker', `%${bookmaker}%`)
  if (giudizio) q = q.eq('giudizio', giudizio)
  if (categoria) q = q.eq('categoria', categoria)
  if (priorita) q = q.eq('priorita', priorita)
  if (dal) q = q.gte('data_mail', dal)
  if (al) q = q.lte('data_mail', al)
  if (search) q = q.or(`oggetto.ilike.%${search}%,mittente.ilike.%${search}%,testo_completo.ilike.%${search}%`)

  const { data, error, count } = await q.order('data_mail', { ascending: false }).range(from, to)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ data, count, page, pageSize })
}

export async function PATCH(req: NextRequest) {
  const body = await req.json()
  const { id, feedback_utente, feedback_note, letta } = body
  if (!id) return NextResponse.json({ error: 'id mancante' }, { status: 400 })

  const patch: Record<string, unknown> = { updated_at: new Date().toISOString() }
  if (feedback_utente !== undefined) patch.feedback_utente = feedback_utente
  if (feedback_note !== undefined) patch.feedback_note = feedback_note
  if (letta !== undefined) patch.letta = letta

  const { data, error } = await supabase.from('lucy_mail_archive').update(patch).eq('id', id).select().single()
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data)
}
