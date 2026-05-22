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

async function leggiTutteLeMail(accessToken: string) {
  const labels = ['INBOX', 'SPAM']
  const risultati = []
  
  // Filtro ultime 48 ore
  const dopo48h = Math.floor((Date.now() - 48 * 60 * 60 * 1000) / 1000)
  const query = `after:${dopo48h}`

  for (const label of labels) {
    let pageToken: string | null = null
    let totale = 0

    while (totale < 200) {
      const url: string = `https://gmail.googleapis.com/gmail/v1/users/me/messages?maxResults=50&labelIds=${label}&q=${encodeURIComponent(query)}${pageToken ? '&pageToken=' + pageToken : ''}`
      const listRes = await fetch(url, { headers: { Authorization: `Bearer ${accessToken}` } })
      const listData = await listRes.json()
      if (!listData.messages) break

      for (const msg of listData.messages) {
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
        totale++
      }

      pageToken = listData.nextPageToken || null
      if (!pageToken) break
    }
  }
  return risultati
}

async function leggiTestoCompleto(accessToken: string, msgId: string): Promise<string> {
  try {
    const res = await fetch(
      `https://gmail.googleapis.com/gmail/v1/users/me/messages/${msgId}?format=full`,
      { headers: { Authorization: `Bearer ${accessToken}` } }
    )
    const data = await res.json()
    const parts = data.payload?.parts || [data.payload]
    
    // Cerca text/plain prima
    for (const part of parts) {
      if (part?.mimeType === 'text/plain' && part?.body?.data) {
        return Buffer.from(part.body.data, 'base64').toString('utf-8')
      }
    }
    // Fallback su text/html
    for (const part of parts) {
      if (part?.mimeType === 'text/html' && part?.body?.data) {
        return Buffer.from(part.body.data, 'base64')
          .toString('utf-8')
          .replace(/<[^>]*>/g, ' ')
          .replace(/\s+/g, ' ')
          .trim()
      }
    }
  } catch {}
  return ''
}

async function analizzaPromozioni(mail: any[], nomeCliente: string) {
  const BATCH = 20
  const promozioni: any[] = []

  for (let i = 0; i < mail.length; i += BATCH) {
    const batch = mail.slice(i, i + BATCH)
    const testo = batch.map(m => `Da: ${m.from}\nOggetto: ${m.subject}\nData: ${m.date}`).join('\n\n')

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
          content: `Analizza queste email di ${nomeCliente} e identifica SOLO quelle che contengono promozioni, bonus, offerte speciali o opportunità da bookmaker/casinò/operatori di gioco. Includi tutto ciò che potrebbe essere una promo, meglio un falso positivo che perderne una. Rispondi SOLO in JSON array senza markdown: [{"from": "mittente", "subject": "oggetto", "date": "data originale mail", "msg_id": "id del messaggio originale", "tipo": "promozione/bonus/offerta", "priorita": "alta/media/bassa"}]. Priorità ALTA = scadenza imminente o importo elevato. Se non ci sono promozioni rispondi []. Email:\n\n${testo}\n\nID messaggi: ${batch.map(m => m.id).join(', ')}`
        }]
      })
    })

    const data = await res.json()
    try {
      const parsed = JSON.parse(data.content[0].text.replace(/```json|```/g, '').trim())
      for (let j = 0; j < parsed.length; j++) {
        const mailOriginale = batch.find(m => m.subject === parsed[j].subject || m.id === parsed[j].msg_id)
        if (mailOriginale) {
          if (!parsed[j].date) parsed[j].date = mailOriginale.date
          parsed[j].msg_id = mailOriginale.id
        }
      }
      promozioni.push(...parsed)
    } catch { }
  }
  return promozioni
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url)
  const secret = searchParams.get('secret')
  const forceEmailId = searchParams.get('email_id')

  if (secret !== process.env.CRON_SECRET && !forceEmailId) {
    return NextResponse.json({ error: 'Non autorizzato' }, { status: 401 })
  }

  let query = supabase.from('clienti_email').select('*, clienti(id, nome)').not('gmail_access_token', 'is', null)
  if (forceEmailId) query = query.eq('id', forceEmailId)

  const { data: emailRows } = await query
  if (!emailRows || emailRows.length === 0) {
    return NextResponse.json({ message: 'Nessuna email autorizzata' })
  }

  const risultati = []

  for (const emailRow of emailRows) {
    try {
      let accessToken = emailRow.gmail_access_token
      if (emailRow.gmail_token_expiry && new Date(emailRow.gmail_token_expiry) < new Date()) {
        accessToken = await refreshToken(emailRow)
        if (!accessToken) continue
      }

      const mail = await leggiTutteLeMail(accessToken)
      const nomeCliente = emailRow.clienti?.nome || emailRow.email
      const promozioni = await an
