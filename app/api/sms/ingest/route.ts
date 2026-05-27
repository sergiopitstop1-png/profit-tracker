import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

export async function POST(request: Request) {
  try {
    const body = await request.json()
    console.log('SMS INGEST:', JSON.stringify(body))

    const { telefono, cliente, mittente, tipo, testo, data_ricezione } = body

    if (!mittente || !testo) {
      return NextResponse.json({ ok: false, error: 'mittente e testo obbligatori' }, { status: 400 })
    }

    // Usa data_ricezione dal Python (epoch ms) oppure ora
    let dataISO: string
    if (data_ricezione && String(data_ricezione).length >= 10) {
      const epoch = Number(data_ricezione)
      // Se in millisecondi (13 cifre) dividi per 1000, se in secondi (10 cifre) usa diretto
      dataISO = new Date(epoch > 1e12 ? epoch : epoch * 1000).toISOString()
    } else {
      dataISO = new Date().toISOString()
    }

    const { error } = await supabase.from('sms_clienti').insert([{
      telefono:          telefono  || 'sconosciuto',
      cliente:           cliente   || telefono || 'sconosciuto',
      tipo:              tipo      || 'GENERICO',
      mittente:          mittente,
      testo:             testo,
      data_ricezione:    dataISO,
      letta:             false
    }])

    if (error) {
      console.error('ERRORE SUPABASE:', error.message)
      return NextResponse.json({ ok: false, error: error.message }, { status: 500 })
    }

    console.log('SMS salvato OK')
    return NextResponse.json({ ok: true })
  } catch (e) {
    console.error('INGEST EXCEPTION:', String(e))
    return NextResponse.json({ ok: false, error: String(e) }, { status: 500 })
  }
}
