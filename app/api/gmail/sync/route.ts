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

async function leggiMail(accessToken: string) {
  const labels = ['INBOX', 'SPAM']
  const risultati: any[] = []

  const listResponses = await Promise.all(
    labels.map(label =>
      fetch(
        `https://gmail.googleapis.com/gmail/v1/users/me/messages?maxResults=30&labelIds=${label}`,
        { headers: { Authorization: `Bearer ${accessToken}` } }
      ).then(r => r.json()).then(d => ({ label, messages: d.messages || [] }))
    )
  )

  const toFetch: { id: string, label: string }[] = []
  for (const { label, messages } of listResponses) {
    for (const msg of messages.slice(0, 30)) {
      toFetch.push({ id: msg.id, label })
    }
  }

  const batchSize = 10
  for (let i = 0; i < toFetch.length; i += batchSize) {
    const batch = toFetch.slice(i, i + batchSize)
    const metadati = await Promise.all(
      batch.map(async ({ id, label }) => {
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
          return { from, subject, date, label, id }
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

function estraiTestoDaParts(parts: any[]): string {
  for (const part of parts) {
    if (!part) continue
    if (part.parts && part.parts.length > 0) {
      const nested = estraiTestoDaParts(part.parts)
      if (nested) return nested
    }
    if (part.mimeType === 'text/plain' && part.body?.data) {
      return Buffer.from(part.body.data, 'base64').toString('utf-8')
    }
  }
  for (const part of parts) {
    if (!part) continue
    if (part.parts && part.parts.length > 0) {
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

async function leggiTestoCompleto(accessToken: string, msgId: string): Promise<string> {
  try {
    const res = await fetch(
      `https://gmail.googleapis.com/gmail/v1/users/me/messages/${msgId}?format=full`,
      { headers: { Authorization: `Bearer ${accessToken}` } }
    )
    const data = await res.json()
    if (data.error) return ''
    const payload = data.payload
    if (!payload) return ''
    if (payload.body?.data && (!payload.parts || payload.parts.length === 0)) {
      const testo = Buffer.from(payload.body.data, 'base64').toString('utf-8')
      if (payload.mimeType === 'text/html') {
        return testo.replace(/<style[^>]*>[\s\S]*?<\/style>/gi, ' ')
          .replace(/<[^>]*>/g, ' ')
          .replace(/\s+/g, ' ')
          .trim()
      }
      return testo
    }
    const parts = payload.parts || [payload]
    return estraiTestoDaParts(parts)
  } catch (e) {
    console.error('Errore leggiTestoCompleto:', e)
    return ''
  }
}

function parseDateSafe(dateStr: string): string | null {
  if (!dateStr) return null
  try {
    const d = new Date(dateStr)
    if (!isNaN(d.getTime())) return d.toISOString()
  } catch {}
  return null
}

async function analizzaPromozioni(mail: any[], nomeCliente: string) {
  const testo = mail.map((m, idx) =>
    `[${idx}] ID:${m.id}\nDa: ${m.from}\nOggetto: ${m.subject}\nData: ${m.date}`
  ).join('\n\n')

  try {
    const res = await fetch('https://api.groq.com/openai/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${process.env.GROQ_API_KEY}`
      },
      body: JSON.stringify({
        model: 'llama-3.3-70b-versatile',
        max_tokens: 4000,
        messages: [
          { role: 'system', content: 'Sei un assistente che analizza email. Rispondi SEMPRE e SOLO con un JSON array valido, senza markdown, senza testo prima o dopo.' },
          { role: 'user',
          content: `Analizza queste email di ${nomeCliente} e identifica TUTTE quelle provenienti da bookmaker, casinò, siti di scommesse, poker, slot, giochi online, operatori di gioco. Classifica come promo QUALSIASI mail da questi mittenti, anche se è solo una newsletter o notifica. Includi tutto ciò che potrebbe essere una promo: meglio un falso positivo che perderne una. Rispondi SOLO con un JSON array valido, senza markdown, senza testo prima o dopo: [{"msg_id": "id esatto del messaggio come scritto dopo ID:", "from": "mittente", "subject": "oggetto", "date": "data originale", "tipo": "promozione/bonus/offerta", "priorita": "alta/media/bassa"}]. Priorità ALTA = scadenza imminente o importo elevato. Se non ci sono promozioni rispondi []. Email:\n\n${testo}`
        }]
      })
    })

    const data = await res.json()
    if (!data.choices?.[0]?.message?.content) return []

    const parsed = JSON.parse(data.choices[0].message.content.replace(/```json|```/g, '').trim())
    for (const p of parsed) {
      if (!p.date || !p.from || !p.msg_id) {
        const mailOriginale = mail.find(m => m.id === p.msg_id || m.subject === p.subject)
        if (mailOriginale) {
          if (!p.date) p.date = mailOriginale.date
          if (!p.from) p.from = mailOriginale.from
          if (!p.msg_id) p.msg_id = mailOriginale.id
        }
      }
    }
    return parsed
  } catch (e) {
    console.error('Errore analizzaPromozioni:', e)
    return []
  }
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url)
  const secret = searchParams.get('secret')
  const forceEmailId = searchParams.get('email_id')

  if (secret !== process.env.CRON_SECRET && !forceEmailId) {
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

      const mail = await leggiMail(accessToken)
      const nomeCliente = emailRow.clienti?.nome || emailRow.email

      if (mail.length === 0) {
        risultati.push({ email: emailRow.email, mailTrovate: 0, salvate: 0 })
        continue
      }

      const promozioni = await analizzaPromozioni(mail, nomeCliente)
      let salvate = 0
      let duplicate = 0

      const promozioniDaSalvare: any[] = []
      for (const p of promozioni) {
        const { data: esistente } = await supabase
          .from('promozioni_clienti')
          .select('id')
          .eq('email_id', emailRow.id)
          .eq('oggetto', p.subject || '')
          .eq('mittente', p.from || '')
          .gte('created_at', new Date(Date.now() - 72 * 60 * 60 * 1000).toISOString())
          .maybeSingle()
        if (esistente) { duplicate++; } else { promozioniDaSalvare.push(p) }
      }

      const testiCompleti = await Promise.all(
        promozioniDaSalvare.map(p =>
          p.msg_id ? leggiTestoCompleto(accessToken, p.msg_id) : Promise.resolve('')
        )
      )

      await Promise.all(
        promozioniDaSalvare.map(async (p, idx) => {
          try {
            const { error: insertError } = await supabase.from('promozioni_clienti').insert([{
              cliente_id: emailRow.clienti?.id,
              email_id: emailRow.id,
              mittente: p.from || '',
              oggetto: p.subject || '',
              tipo: p.tipo || 'promozione',
              priorita: p.priorita || 'media',
              data_mail: parseDateSafe(p.date),
              testo_completo: testiCompleti[idx] ? testiCompleti[idx].substring(0, 10000) : null
            }])
            if (!insertError) salvate++
          } catch (e) {
            console.error('Errore su singola promo:', e)
          }
        })
      )

      await supabase.from('gmail_sync_log').upsert([{
        email_id: emailRow.id,
        ultimo_controllo: new Date().toISOString()
      }], { onConflict: 'email_id' })

      risultati.push({
        email: emailRow.email,
        mailTrovate: mail.length,
        promozioniTrovate: promozioni.length,
        salvate,
        duplicate,
        promozioni
      })

    } catch (err) {
      console.error('Errore su emailRow:', emailRow.email, err)
      risultati.push({ email: emailRow.email, errore: String(err) })
    }
  }

  return NextResponse.json({ sync: 'completato', risultati })
}
