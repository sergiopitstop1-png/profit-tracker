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

  for (const label of labels) {
    let pageToken = null
    let totale = 0

    while (totale < 100) {
      const url = `https://gmail.googleapis.com/gmail/v1/users/me/messages?maxResults=20&labelIds=${label}${pageToken ? '&pageToken=' + pageToken : ''}`
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

      pageToken = listData.nextPageToken
      if (!pageToken) break
    }
  }
  return risultati
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
          content: `Analizza queste email di ${nomeCliente} e identifica SOLO quelle che contengono promozioni, bonus, offerte speciali o opportunità da bookmaker/casinò/operatori di gioco. Rispondi SOLO in JSON array senza markdown: [{"from": "mittente", "subject": "oggetto", "tipo": "promozione/bonus/offerta", "priorita": "alta/media/bassa"}]. Priorità ALTA = scadenza imminente o importo elevato. Se non ci sono promozioni rispondi []. Email:\n\n${testo}`
        }]
      })
    })

    const data = await res.json()
    try {
      const parsed = JSON.parse(data.content[0].text.replace(/```json|```/g, '').trim())
      promozioni.push(...parsed)
    } catch { }
  }
  return promozioni
}

export async function GET(request: Request) {
  // Verifica secret per sicurezza cron
  const { searchParams } = new URL(request.url)
  const secret = searchParams.get('secret')
  const forceEmailId = searchParams.get('email_id')

  if (secret !== process.env.CRON_SECRET && !forceEmailId) {
    return NextResponse.json({ error: 'Non autorizzato' }, { status: 401 })
  }

  // Prendi tutte le email autorizzate (o solo quella richiesta)
  let query = supabase.from('clienti_email').select('*, clienti(id, nome)').not('gmail_access_token', 'is', null)
  if (forceEmailId) query = query.eq('id', forceEmailId)

  const { data: emailRows } = await query
  if (!emailRows || emailRows.length === 0) {
    return NextResponse.json({ message: 'Nessuna email autorizzata' })
  }

  const risultati = []

  for (const emailRow of emailRows) {
    try {
      // Controlla se ha bisogno di refresh
      let accessToken = emailRow.gmail_access_token
      if (emailRow.gmail_token_expiry && new Date(emailRow.gmail_token_expiry) < new Date()) {
        accessToken = await refreshToken(emailRow)
        if (!accessToken) continue
      }

      // Leggi tutte le mail
      const mail = await leggiTutteLeMail(accessToken)
      const nomeCliente = emailRow.clienti?.nome || emailRow.email
      const promozioni = await analizzaPromozioni(mail, nomeCliente)

      // Salva su Supabase (evita duplicati per oggetto+mittente nelle ultime 24h)
      for (const p of promozioni) {
        const { data: esistente } = await supabase
          .from('promozioni_clienti')
          .select('id')
          .eq('email_id', emailRow.id)
          .eq('oggetto', p.subject)
          .eq('mittente', p.from)
          .gte('created_at', new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString())
          .maybeSingle()

        if (!esistente) {
          await supabase.from('promozioni_clienti').insert([{
            cliente_id: emailRow.clienti?.id,
            email_id: emailRow.id,
            mittente: p.from,
            oggetto: p.subject,
            tipo: p.tipo,
            priorita: p.priorita
          }])
        }
      }

      // Aggiorna sync log
      await supabase.from('gmail_sync_log').upsert([{
        email_id: emailRow.id,
        ultimo_controllo: new Date().toISOString()
      }], { onConflict: 'email_id' })

      risultati.push({ email: emailRow.email, promozioni: promozioni.length })
    } catch (err) {
      risultati.push({ email: emailRow.email, errore: String(err) })
    }
  }

  return NextResponse.json({ sync: 'completato', risultati })
}
