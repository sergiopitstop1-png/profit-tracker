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
  const risultati: any[] = []

  // Fetch lista messaggi da INBOX e SPAM in parallelo
  const listResponses = await Promise.all(
    labels.map(label =>
      fetch(
        `https://gmail.googleapis.com/gmail/v1/users/me/messages?maxResults=30&labelIds=${label}`,
        { headers: { Authorization: `Bearer ${accessToken}` } }
      ).then(r => r.json()).then(d => ({ label, messages: d.messages || [] }))
    )
  )

  // Raccoglie tutti i msg id da processare
  const toFetch: { id: string, label: string }[] = []
  for (const { label, messages } of listResponses) {
    for (const msg of messages.slice(0, 30)) {
      toFetch.push({ id: msg.id, label })
    }
  }

  // Leggi metadata di tutti i messaggi in parallelo (batch da 10 per non sovraccaricare)
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
  } catch {
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
    const res = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': process.env.ANTHROPIC_API_KEY!,
        'anthropic-version': '2023-06-01'
      },
      body: JSON.stringify({
        model: 'claude-sonnet-4-20250514',
        max_tokens: 2000,
        messages: [{
          role: 'user',
          content: `Analizza queste email di ${nomeCliente} e identifica TUTTE quelle provenienti da bookmaker, casinò, siti di scommesse, poker, slot, giochi online, operatori di gioco. Classifica come promo QUALSIASI mail da questi mittenti, anche se è solo una newsletter o notifica. Includi tutto ciò che potrebbe essere una promo: meglio un falso positivo che perderne una. Rispondi SOLO con un JSON array valido, senza markdown, senza testo prima o dopo: [{"msg_id": "id esatto del messaggio come scritto dopo ID:", "from": "mittente", "subject": "oggetto", "date": "data originale", "tipo": "promozione/bonus/offerta", "priorita": "alta/media/bassa"}]. Priorità ALTA = scadenza imminente o importo elevato. Se non ci sono promozioni rispondi []. Email:\n\n${testo}`
        }]
      })
    })

    const data = await res.json()
    if (!data.content?.[0]?.text) {
      console.error('Claude no content:', JSON.stringify(data))
      return []
    }
    const parsed = JSON.parse(data.content[0].text.replace(/```json|```/g, '').trim())
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
  const emailId = searchParams.get('email_id')

  if (!emailId) {
    return NextResponse.json({ error: 'email_id mancante' }, { status: 400 })
  }

  const { data: emailRow, error } = await supabase
    .from('clienti_email')
    .select('*, clienti(id, nome)')
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
  const nomeCliente = emailRow.clienti?.nome || emailRow.email
  const promozioni = await analizzaPromozioni(mail, nomeCliente)

  // Salva su Supabase con controllo duplicati
  let salvate = 0
  let duplicate = 0

  // Salva testi completi in parallelo per le promo nuove
  const promozioniDaSalvare = []
  for (const p of promozioni) {
    const { data: esistente } = await supabase
      .from('promozioni_clienti')
      .select('id')
      .eq('email_id', emailRow.id)
      .eq('oggetto', p.subject || '')
      .eq('mittente', p.from || '')
      .gte('created_at', new Date(Date.now() - 72 * 60 * 60 * 1000).toISOString())
      .maybeSingle()

    if (esistente) {
      duplicate++
    } else {
      promozioniDaSalvare.push(p)
    }
  }

  // Leggi testi completi in parallelo
  const testiCompleti = await Promise.all(
    promozioniDaSalvare.map(p =>
      p.msg_id ? leggiTestoCompleto(accessToken, p.msg_id) : Promise.resolve('')
    )
  )

  // Inserisci in parallelo
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
        console.error('Errore salvataggio promo:', e)
      }
    })
  )

  return NextResponse.json({
    email: emailRow.email,
    totale_mail: mail.length,
    promozioni,
    salvate,
    duplicate
  })
}
