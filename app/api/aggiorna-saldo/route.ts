// Salva questo file come: app/api/aggiorna-saldo/route.ts
// (stessa struttura di app/api/credenziali/route.ts, stessa chiave service role)

import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

// POST - aggiorna il saldo di un book, dato il suo id nella tabella "books"
export async function POST(request: Request) {
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
