import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

// GET - lista credenziali di un book (senza password), oppure rivela una singola password
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url)
  const bookId = searchParams.get('book_id')
  const revealId = searchParams.get('reveal')

  if (revealId) {
    const { data, error } = await supabase.rpc('leggi_credenziale', { p_id: Number(revealId) })
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    if (!data || data.length === 0) return NextResponse.json({ error: 'non trovata' }, { status: 404 })
    return NextResponse.json({ credenziale: data[0] })
  }

  if (!bookId) {
    return NextResponse.json({ error: 'book_id mancante' }, { status: 400 })
  }

  const { data, error } = await supabase
    .from('credenziali')
    .select('id, book_id, username, created_at, updated_at')
    .eq('book_id', Number(bookId))
    .order('created_at', { ascending: false })

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ credenziali: data })
}

// POST - crea una nuova credenziale (cifrata)
export async function POST(request: Request) {
  const { book_id, username, password } = await request.json()

  if (!book_id || !username || !password) {
    return NextResponse.json({ error: 'book_id, username o password mancante' }, { status: 400 })
  }

  const { data, error } = await supabase.rpc('inserisci_credenziale', {
    p_book_id: Number(book_id),
    p_username: username,
    p_password: password
  })

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true, id: data })
}

// DELETE - elimina una credenziale
export async function DELETE(request: Request) {
  const { searchParams } = new URL(request.url)
  const id = searchParams.get('id')

  if (!id) return NextResponse.json({ error: 'id mancante' }, { status: 400 })

  const { error } = await supabase
    .from('credenziali')
    .delete()
    .eq('id', Number(id))

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true })
}
