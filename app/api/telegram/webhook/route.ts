import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

function parseMessaggio(testo: string) {
  const result: any = { telefono: null, cliente: null, tipo: null, mittente: null, testo: null }

  // Emoji ESATTE usate dal Python (senza varianti U+FE0F)
  // 📱 Telefono: Alfonso
  // 🏷 Tipo: OTP
  // 👤 Da: SNAITECH
  // 🔑 Codice: 123456  (opzionale)
  // 💬 Testo: contenuto

  const telefono = testo.match(/📱\s*Telefono:\s*(.+)/i)
  const tipo     = testo.match(/🏷\s*Tipo:\s*(.+)/i)
  const mittente = testo.match(/👤\s*Da:\s*(.+)/i)
  const testoMsg = testo.match(/💬\s*Testo:\s*([\s\S]+)/i)

  if (telefono) result.cliente  = telefono[1].trim()
  if (tipo)     result.tipo     = tipo[1].trim()
  if (mittente) result.mittente = mittente[1].trim()
  if (testoMsg) result.testo    = testoMsg[1].trim()

  // Fallback senza emoji (per test manuali)
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

  result.telefono = result.cliente
  return result
}

export async function GET() {
  return NextResponse.json({ ok: true, message: 'Webhook attivo' })
}

export async function POST(request: Request) {
  try {
    const body = await request.json()
    console.log('TELEGRAM FULL BODY:', JSON.stringify(body))

    const message =
      body.message ||
      body.channel_post ||
      body.edited_message ||
      body.edited_channel_post

    if (!message) {
      console.log('TELEGRAM: nessun campo message trovato. Chiavi:', Object.keys(body).join(', '))
      return NextResponse.json({ ok: true })
    }

    const testo = message.text || message.caption

    if (!testo) {
      console.log('TELEGRAM: messaggio senza testo. Campi:', Object.keys(message).join(', '))
      return NextResponse.json({ ok: true })
    }

    console.log('TELEGRAM TESTO:', testo)

    const telegramMessageId = message.message_id
    const dataRicezione = new Date(message.date * 1000).toISOString()
    const parsed = parseMessaggio(testo)

    console.log('PARSED:', JSON.stringify(parsed))

    const { error } = await supabase.from('sms_clienti').insert([{
      telegram_message_id: telegramMessageId,
      telefono: parsed.telefono || 'sconosciuto',
      cliente:  parsed.cliente  || 'sconosciuto',
      tipo:     parsed.tipo     || 'GENERICO',
      mittente: parsed.mittente || 'Sconosciuto',
      testo:    parsed.testo    || testo,
      data_ricezione: dataRicezione,
      letta: false
    }])

    if (error) {
      if (error.code === '23505') {
        console.log('TELEGRAM: duplicato ignorato, id:', telegramMessageId)
      } else {
        console.error('ERRORE SUPABASE:', error.message, error.code)
      }
    } else {
      console.log('SALVATO OK, id:', telegramMessageId)
    }

    return NextResponse.json({ ok: true })
  } catch (e) {
    console.error('WEBHOOK EXCEPTION:', String(e))
    return NextResponse.json({ ok: true, error: String(e) })
  }
}
