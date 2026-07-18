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

  // Lista completa, SENZA password/risposta segreta, con dati book uniti (se presente)
  const { data, error } = await supabase
    .from('credenziali')
    .select(`
      id, book_id, username, data_iscrizione, limite_settimanale, invio_documenti, note, created_at,
      bookmaker_manuale, intestatario_manuale,
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
    bookmaker: c.books?.nome || c.bookmaker_manuale || '',
    intestatario: c.books?.intestatario || c.intestatario_manuale || '',
    manuale: !c.book_id
  }))

  return NextResponse.json({ credenziali })
}

// POST - crea una nuova credenziale (cifrata). Serve book_id OPPURE bookmaker_manuale+intestatario_manuale
export async function POST(request: Request) {
  const body = await request.json()
  const { book_id, username, password, data_iscrizione, risposta_segreta, limite_settimanale, invio_documenti, note, bookmaker_manuale, intestatario_manuale } = body

  const haBook = !!book_id
  const haManuale = !!bookmaker_manuale && !!intestatario_manuale

  if (!username || !password || (!haBook && !haManuale)) {
    return NextResponse.json({ error: 'username, password e (book_id oppure bookmaker/intestatario manuali) sono obbligatori' }, { status: 400 })
  }

  const { data, error } = await supabase.rpc('inserisci_credenziale', {
    p_book_id: haBook ? Number(book_id) : null,
    p_username: username,
    p_password: password,
    p_data_iscrizione: data_iscrizione || null,
    p_risposta_segreta: risposta_segreta || null,
    p_limite_settimanale: limite_settimanale ? Number(limite_settimanale) : null,
    p_invio_documenti: !!invio_documenti,
    p_note: note || null,
    p_bookmaker_manuale: haBook ? null : bookmaker_manuale,
    p_intestatario_manuale: haBook ? null : intestatario_manuale
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
  const { id, book_id, username, password, data_iscrizione, risposta_segreta, limite_settimanale, invio_documenti, note, bookmaker_manuale, intestatario_manuale } = body

  const haBook = !!book_id
  const haManuale = !!bookmaker_manuale && !!intestatario_manuale

  if (!id || !username || !password || (!haBook && !haManuale)) {
    return NextResponse.json({ error: 'id, username, password e (book_id oppure bookmaker/intestatario manuali) sono obbligatori' }, { status: 400 })
  }

  const { error } = await supabase.rpc('aggiorna_credenziale', {
    p_id: Number(id),
    p_book_id: haBook ? Number(book_id) : null,
    p_username: username,
    p_password: password,
    p_data_iscrizione: data_iscrizione || null,
    p_risposta_segreta: risposta_segreta || null,
    p_limite_settimanale: limite_settimanale ? Number(limite_settimanale) : null,
    p_invio_documenti: !!invio_documenti,
    p_note: note || null,
    p_bookmaker_manuale: haBook ? null : bookmaker_manuale,
    p_intestatario_manuale: haBook ? null : intestatario_manuale
  })

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true })
}
