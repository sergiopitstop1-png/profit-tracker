import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { isRequestAuthorized } from '@/lib/apiAuth'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

// GET ?status=pending - lista le richieste (filtrabile per stato), le piu' vecchie prima
export async function GET(request: Request) {
  if (!(await isRequestAuthorized(request))) {
    return NextResponse.json({ error: 'Non autorizzato' }, { status: 401 })
  }

  const { searchParams } = new URL(request.url)
  const status = searchParams.get('status')

  let query = supabase.from('saldo_jobs').select('*').order('richiesto_il', { ascending: true })
  if (status) query = query.eq('status', status)

  const { data, error } = await query
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ jobs: data })
}

// POST - crea una nuova richiesta. Body: { book: "lottomatica", only_client?: "Alfonso" }
export async function POST(request: Request) {
  if (!(await isRequestAuthorized(request))) {
    return NextResponse.json({ error: 'Non autorizzato' }, { status: 401 })
  }

  const body = await request.json()
  const { book, only_client } = body

  if (!book) {
    return NextResponse.json({ error: 'book e\' obbligatorio' }, { status: 400 })
  }

  const { data, error } = await supabase
    .from('saldo_jobs')
    .insert({ book, only_client: only_client || null })
    .select('id')
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true, id: data.id })
}

// PATCH - aggiorna lo stato/risultato di una richiesta (usato dal poller sul PC)
export async function PATCH(request: Request) {
  if (!(await isRequestAuthorized(request))) {
    return NextResponse.json({ error: 'Non autorizzato' }, { status: 401 })
  }

  const body = await request.json()
  const { id, ...fields } = body

  if (!id) return NextResponse.json({ error: 'id e\' obbligatorio' }, { status: 400 })

  const { error } = await supabase.from('saldo_jobs').update(fields).eq('id', Number(id))
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true })
}
