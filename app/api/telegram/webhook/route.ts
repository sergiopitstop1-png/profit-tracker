import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

function parseMessaggio(testo: string) {
  // Ignora completamente le emoji - cerca solo le parole chiave
  // Rimuove qualsiasi carattere non ASCII prima della parola chiave
  const strip = (pattern: string) =>
    new RegExp(`[^\\n]*${pattern}:\\s*(.+)`, 'i')

  const telefono = testo.match(strip('Telefono'))
  const tipo     = testo.match(strip('Tipo'))
  const mittente = testo.match(strip('Da'))
  const testoMsg = testo.match(/[^\n]*Testo:\s*([\s\S]+)/i)

  const cliente = telefono?.[1]?.trim() || null

  return {
    telefono: cliente,
    cliente:  cliente,
    tipo:     tipo?.[1]?.trim()     || 'GENERICO',
    mittente: mittente?.[1]?.trim() || 'Sconosciuto',
    testo:    testoMsg?.[1]?.trim() || testo,
  }
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
      tipo:     parsed.tipo,
      mittente: parsed.mittente,
      testo:    parsed.testo,
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
