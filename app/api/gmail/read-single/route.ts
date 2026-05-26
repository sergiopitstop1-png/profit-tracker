import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

async function refreshToken(emailRow: any) {
  const res = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      client_id: process.env.GMAIL_CLIENT_ID!,
      client_secret: process.env.GMAIL_CLIENT_SECRET!,
      refresh_token: emailRow.gmail_refresh_token,
      grant_type: 'refresh_token'
    })
  })
  const data = await res.json()
  if (data.access_token) return data.access_token
  return null
}

function estraiTestoDaParts(parts: any[]): string {
  for (const part of parts) {
    if (!part) continue
    if (part.parts?.length > 0) {
      const nested = estraiTestoDaParts(part.parts)
      if (nested) return nested
    }
    if (part.mimeType === 'text/plain' && part.body?.data) {
      return Buffer.from(part.body.data, 'base64').toString('utf-8')
    }
  }
  for (const part of parts) {
    if (!part) continue
    if (part.parts?.length > 0) {
      const nested = estraiTestoDaParts(part.parts)
      if (nested) return nested
    }
    if (part.mimeType === 'text/html' && part.body?.data) {
      return Buffer.from(part.body.data, 'base64')
        .toString('utf-8')
        .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, ' ')
        .replace(/<[^>]*>/g, ' ')
        .replace(/\s+/g, ' ')
        .trim()
    }
  }
  return ''
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url)
  const emailId = searchParams.get('email_id')
  const messageId = searchParams.get('message_id')

  if (!emailId || !messageId) {
    return NextResponse.json({ error: 'Parametri mancanti' }, { status: 400 })
  }

  const { data: emailRow } = await supabase
    .from('clienti_email')
    .select('*')
    .eq('id', emailId)
    .single()

  if (!emailRow) return NextResponse.json({ error: 'Email non trovata' }, { status: 404 })

  let accessToken = emailRow.gmail_access_token
  const scaduto = emailRow.gmail_token_expiry
    ? new Date(emailRow.gmail_token_expiry) < new Date(Date.now() + 5 * 60 * 1000)
    : false

  if (scaduto || !accessToken) {
    accessToken = await refreshToken(emailRow)
    if (!accessToken) return NextResponse.json({ error: 'Token refresh fallito' }, { status: 401 })
  }

  try {
    const res = await fetch(
      `https://gmail.googleapis.com/gmail/v1/users/me/messages/${messageId}?format=full`,
      { headers: { Authorization: `Bearer ${accessToken}` } }
    )
    const data = await res.json()
    if (data.error) return NextResponse.json({ error: data.error.message }, { status: 500 })

    const payload = data.payload
    let testo = ''

    if (payload.body?.data && (!payload.parts || payload.parts.length === 0)) {
      testo = Buffer.from(payload.body.data, 'base64').toString('utf-8')
      if (payload.mimeType === 'text/html') {
        testo = testo.replace(/<style[^>]*>[\s\S]*?<\/style>/gi, ' ')
          .replace(/<[^>]*>/g, ' ')
          .replace(/\s+/g, ' ')
          .trim()
      }
    } else {
      testo = estraiTestoDaParts(payload.parts || [payload])
    }

    return NextResponse.json({ testo: testo.substring(0, 10000) })
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 })
  }
}
