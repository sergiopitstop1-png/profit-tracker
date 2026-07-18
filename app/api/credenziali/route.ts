import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

// GET - lista tutte le credenziali con dati book (senza password), oppure rivela una singola password
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url)
  const revealId = searchParams.get('reveal')

  // Rivela una credenziale specifica (con password/risposta segreta in chiaro)
  if (revealId) {
    const { data, error } = await supabase.rpc('leggi_credenziale', { p_id: Number(revealId) })
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    if (!data || data.length === 0) return NextResponse.json({ error: 'non trovata' }, { status: 404 })
    return NextResponse.json({ credenziale: data[0] })
  }

  // Lista completa, SENZA password/risposta segreta, con dati book uniti
  const { data, error } = await supabase
    .from('credenziali')
    .select(`
      id, book_id, username, data_iscrizione, limite_settimanale, invio_documenti, note, created_at,
      books ( nome, intestatario )
    `)
    .order('created_at', { ascending: false })

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  const credenziali = (data || []).map((c: any) => ({
    id: c.id,
    book_id: c.book_id,
    username: c.username,
    data_iscrizione: c.data_iscrizione,
    limite_settimanale: c.limite_settimanale,
    invio_documenti: c.invio_documenti,
    note: c.note,
    bookmaker: c.books?.nome || '',
    intestatario: c.books?.intestatario || ''
  }))

  return NextResponse.json({ credenziali })
}

// POST - crea una nuova credenziale (cifrata)
export async function POST(request: Request) {
  const body = await request.json()
  const { book_id, username, password, data_iscrizione, risposta_segreta, limite_settimanale, invio_documenti, note } = body

  if (!book_id || !username || !password) {
    return NextResponse.json({ error: 'book_id, username o password mancante' }, { status: 400 })
  }

  const { data, error } = await supabase.rpc('inserisci_credenziale', {
    p_book_id: Number(book_id),
    p_username: username,
    p_password: password,
    p_data_iscrizione: data_iscrizione || null,
    p_risposta_segreta: risposta_segreta || null,
    p_limite_settimanale: limite_settimanale ? Number(limite_settimanale) : null,
    p_invio_documenti: !!invio_documenti,
    p_note: note || null
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
// PUT - modifica una credenziale esistente
export async function PUT(request: Request) {
  const body = await request.json()
  const { id, book_id, username, password, data_iscrizione, risposta_segreta, limite_settimanale, invio_documenti, note } = body

  if (!id || !book_id || !username || !password) {
    return NextResponse.json({ error: 'id, book_id, username o password mancante' }, { status: 400 })
  }

  const { error } = await supabase.rpc('aggiorna_credenziale', {
    p_id: Number(id),
    p_book_id: Number(book_id),
    p_username: username,
    p_password: password,
    p_data_iscrizione: data_iscrizione || null,
    p_risposta_segreta: risposta_segreta || null,
    p_limite_settimanale: limite_settimanale ? Number(limite_settimanale) : null,
    p_invio_documenti: !!invio_documenti,
    p_note: note || null
  })

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true })
}
