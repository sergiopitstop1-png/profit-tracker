import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

function parseMessaggio(testo: string) {
  const result: any = { telefono: null, cliente: null, tipo: null, mittente: null, testo: null }

  const telefono = testo.match(/📱\s*Telefono:\s*(.+)/i)
  const tipo = testo.match(/🏷️\s*Tipo:\s*(.+)/i)
  const mittente = testo.match(/👤\s*Da:\s*(.+)/i)
  const testoMatch = testo.match(/💬\s*Testo:\s*([\s\S]+)/i)

  if (telefono) result.cliente = telefono[1].trim()
  if (tipo) result.tipo = tipo[1].trim()
  if (mittente) result.mittente = mittente[1].trim()
  if (testoMatch) result.testo = testoMatch[1].trim()

  // Fallback senza emoji
  if (!result.cliente) {
    const t = testo.match(/Telefono:\s*(.+)/i)
    if (t) result.cliente = t[1].trim()
  }
  if (!result.tipo) {
    const t = testo.match(/Tipo:\s*(.+)/i)
    if (t) result.tipo = t[1].trim()
  }
  if (!result.mittente) {
    const t = testo.match(/Da:\s*(.+)/i)
    if (t) result.mittente = t[1].trim()
  }
  if (!result.testo) {
    const t = testo.match(/Testo:\s*([\s\S]+)/i)
    if (t) result.testo = t[1].trim()
  }

  return result
}

export async function GET() {
  return NextResponse.json({ ok: true, message: 'Webhook attivo' })
}

export async function POST(request: Request) {
  try {
    const body = await request.json()
    console.log('TELEGRAM BODY:', JSON.stringify(body).substring(0, 500))
    const message = body.message || body.channel_post
    if (!message || !message.text) {
      console.log('TELEGRAM: nessun messaggio testo trovato')
      return NextResponse.json({ ok: true })
    }

    const telegramMessageId = message.message_id
    const testo = message.text
    const dataRicezione = new Date(message.date * 1000).toISOString()

    const parsed = parseMessaggio(testo)

    const { error } = await supabase.from('sms_clienti').insert([{
      telegram_message_id: telegramMessageId,
      telefono: parsed.cliente,
      cliente: parsed.cliente,
      tipo: parsed.tipo || 'GENERICO',
      mittente: parsed.mittente || 'Sconosciuto',
      testo: parsed.testo || testo,
      data_ricezione: dataRicezione,
      letta: false
    }])

    if (error && error.code !== '23505') { // ignora duplicati
      console.error('Errore insert SMS:', error.message)
    }

    return NextResponse.json({ ok: true })
  } catch (e) {
    console.error('Webhook error:', String(e))
    return NextResponse.json({ ok: true, error: String(e) })
  }
}
