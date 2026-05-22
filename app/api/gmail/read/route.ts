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
  if (data.access_token) {
    await supabase.from('clienti_email').update({
      gmail_access_token: data.access_token,
      gmail_token_expiry: new Date(Date.now() + data.expires_in * 1000).toISOString()
    }).eq('id', emailRow.id)
    return data.access_token
  }
  return null
}

async function leggiMail(accessToken: string) {
  const labels = ['INBOX', 'SPAM']
  const risultati = []

  for (const label of labels) {
    const listRes = await fetch(
      `https://gmail.googleapis.com/gmail/v1/users/me/messages?maxResults=20&labelIds=${label}`,
      { headers: { Authorization: `Bearer ${accessToken}` } }
    )
    const listData = await listRes.json()
    if (!listData.messages) continue

    for (const msg of listData.messages.slice(0, 10)) {
      const msgRes = await fetch(
        `https://gmail.googleapis.com/gmail/v1/users/me/messages/${msg.id}?format=metadata&metadataHeaders=From&metadataHeaders=Subject&metadataHeaders=Date`,
        { headers: { Authorization: `Bearer ${accessToken}` } }
      )
      const msgData = await msgRes.json()
      const headers = msgData.payload?.headers || []
      const from = headers.find((h: any) => h.name === 'From')?.value || ''
      const subject = headers.find((h: any) => h.name === 'Subject')?.value || ''
      const date = headers.find((h: any) => h.name === 'Date')?.value || ''
      risultati.push({ from, subject, date, label, id: msg.id })
    }
  }
  return risultati
}

async function analizzaPromozioni(mail: any[], nomeCliente: string) {
  const testo = mail.map(m => `Da: ${m.from}\nOggetto: ${m.subject}`).join('\n\n')

  const res = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': process.env.ANTHROPIC_API_KEY!,
      'anthropic-version': '2023-06-01'
    },
    body: JSON.stringify({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 1000,
      messages: [{
        role: 'user',
        content: `Analizza queste email di ${nomeCliente} e identifica SOLO quelle che contengono promozioni, bonus, offerte speciali o opportunità da bookmaker/casinò/operatori di gioco. Rispondi SOLO in JSON array: [{"from": "mittente", "subject": "oggetto", "tipo": "promozione/bonus/offerta", "priorita": "alta/media/bassa"}]. Se non ci sono promozioni rispondi con array vuoto []. Email:\n\n${testo}`
      }]
    })
  })

  const data = await res.json()
  try {
    const testo = data.content[0].text.replace(/```json|```/g, '').trim()
    return JSON.parse(testo)
  } catch {
    return []
  }
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url)
  const emailId = searchParams.get('email_id')

  if (!emailId) {
    return NextResponse.json({ error: 'email_id mancante' }, { status: 400 })
  }

  const { data: emailRow, error } = await supabase
    .from('clienti_email')
    .select('*, clienti(nome)')
    .eq('id', emailId)
    .single()

  if (error || !emailRow) {
    return NextResponse.json({ error: 'Email non trovata' }, { status: 404 })
  }

  if (!emailRow.gmail_access_token) {
    return NextResponse.json({ error: 'Non autorizzato', needsAuth: true }, { status: 401 })
  }

  let accessToken = emailRow.gmail_access_token
  if (emailRow.gmail_token_expiry && new Date(emailRow.gmail_token_expiry) < new Date()) {
    accessToken = await refreshToken(emailRow)
    if (!accessToken) {
      return NextResponse.json({ error: 'Token scaduto', needsAuth: true }, { status: 401 })
    }
  }

  const mail = await leggiMail(accessToken)
  const promozioni = await analizzaPromozioni(mail, emailRow.clienti?.nome || emailRow.email)

  return NextResponse.json({
    email: emailRow.email,
    totale_mail: mail.length,
    promozioni
  })
}
