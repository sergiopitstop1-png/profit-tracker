import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { isRequestAuthorized } from '@/lib/apiAuth'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

// POST - aggiorna il saldo di un book, dato il suo id nella tabella "books"
export async function POST(request: Request) {
  if (!(await isRequestAuthorized(request))) {
    return NextResponse.json({ error: 'Non autorizzato' }, { status: 401 })
  }

  const body = await request.json()
  const { book_id, saldo } = body

  if (!book_id || saldo === undefined || saldo === null) {
    return NextResponse.json({ error: 'book_id e saldo sono obbligatori' }, { status: 400 })
  }

  const { error } = await supabase
    .from('books')
    .update({ saldo: Number(saldo) })
    .eq('id', Number(book_id))

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true })
}
