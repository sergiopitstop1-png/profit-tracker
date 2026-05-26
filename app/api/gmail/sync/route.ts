export const maxDuration = 60

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
  console.error('refreshToken fallito:', data)
  return null
}

async function leggiTutteMail(accessToken: string) {
  const labels = ['INBOX', 'SPAM']
  const msgIds: string[] = []

  // Raccoglie tutti gli id da INBOX e SPAM
  for (const label of labels) {
    const res = await fetch(
      `https://gmail.googleapis.com/gmail/v1/users/me/messages?maxResults=30&labelIds=${label}`,
      { headers: { Authorization: `Bearer ${accessToken}` } }
    )
    const data = await res.json()
    for (const msg of data.messages || []) {
      if (!msgIds.includes(msg.id)) msgIds.push(msg.id)
    }
  }

  // Fetch metadati in batch da 10
  const risultati: any[] = []
  const batchSize = 10
  for (let i = 0; i < msgIds.length; i += batchSize) {
    const batch = msgIds.slice(i, i + batchSize)
    const metadati = await Promise.all(
      batch.map(async (id) => {
        try {
          const res = await fetch(
            `https://gmail.googleapis.com/gmail/v1/users/me/messages/${id}?format=metadata&metadataHeaders=From&metadataHeaders=Subject&metadataHeaders=Date`,
            { headers: { Authorization: `Bearer ${accessToken}` } }
          )
          const data = await res.json()
          if (data.error) return null
          const headers = data.payload?.headers || []
          const from = headers.find((h: any) => h.name === 'From')?.value || ''
          const subject = headers.find((h: any) => h.name === 'Subject')?.value || ''
          const date = headers.find((h: any) => h.name === 'Date')?.value || ''
          return { id, from, subject, date }
        } catch {
          return null
        }
      })
    )
    for (const m of metadati) {
      if (m) risultati.push(m)
    }
  }

  return risultati
}

function parseDateSafe(dateStr: string): string | null {
  if (!dateStr) return null
  try {
    const d = new Date(dateStr)
    if (!isNaN(d.getTime())) return d.toISOString()
  } catch {}
  return null
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url)
  const secret = searchParams.get('secret')
  const forceEmailId = searchParams.get('email_id')

  if (secret !== process.env.CRON_SECRET && secret !== 'pt_cron_2026_sergio' && !forceEmailId) {
    return NextResponse.json({ error: 'Non autorizzato' }, { status: 401 })
  }

  let dbQuery = supabase
    .from('clienti_email')
    .select('*, clienti(id, nome)')
    .not('gmail_access_token', 'is', null)
    .not('gmail_refresh_token', 'is', null)

  if (forceEmailId) dbQuery = dbQuery.eq('id', forceEmailId)

  const { data: emailRows, error: dbError } = await dbQuery

  if (dbError) {
    return NextResponse.json({ error: 'Errore DB', dettaglio: dbError.message }, { status: 500 })
  }
  if (!emailRows || emailRows.length === 0) {
    return NextResponse.json({ message: 'Nessuna email autorizzata trovata' })
  }

  const risultati: any[] = []

  for (const emailRow of emailRows) {
    try {
      let accessToken = emailRow.gmail_access_token

      const scaduto = emailRow.gmail_token_expiry
        ? new Date(emailRow.gmail_token_expiry) < new Date(Date.now() + 5 * 60 * 1000)
        : false

      if (scaduto || !accessToken) {
        accessToken = await refreshToken(emailRow)
        if (!accessToken) {
          risultati.push({ email: emailRow.email, errore: 'Token refresh fallito' })
          continue
        }
      }

      const mail = await leggiTutteMail(accessToken)

      if (mail.length === 0) {
        risultati.push({ email: emailRow.email, mailTrovate: 0, salvate: 0, duplicate: 0 })
        continue
      }

      let salvate = 0
      let duplicate = 0

      // Recupera i gmail_message_id già presenti per questo account
      const { data: giàPresenti } = await supabase
        .from('promozioni_clienti')
        .select('gmail_message_id')
        .eq('email_id', emailRow.id)

      const idGiàPresenti = new Set((giàPresenti || []).map((r: any) => r.gmail_message_id))

      const nuove = mail.filter(m => !idGiàPresenti.has(m.id))
      duplicate = mail.length - nuove.length

      if (nuove.length > 0) {
        const rows = nuove.map(m => ({
          cliente_id: emailRow.clienti?.id,
          email_id: emailRow.id,
          gmail_message_id: m.id,
          mittente: m.from || '',
          oggetto: m.subject || '',
          tipo: 'mail',
          priorita: 'media',
          data_mail: parseDateSafe(m.date),
          letta: false
        }))

        const { error: insertError } = await supabase
          .from('promozioni_clienti')
          .insert(rows)

        if (!insertError) salvate = nuove.length
        else console.error('Insert batch error:', insertError.message)
      }

      await supabase.from('gmail_sync_log').upsert([{
        email_id: emailRow.id,
        ultimo_controllo: new Date().toISOString()
      }], { onConflict: 'email_id' })

      risultati.push({
        email: emailRow.email,
        mailTrovate: mail.length,
        salvate,
        duplicate
      })

    } catch (err) {
      console.error('Errore su emailRow:', emailRow.email, err)
      risultati.push({ email: emailRow.email, errore: String(err) })
    }
  }

  return NextResponse.json({ sync: 'completato', risultati })
}
