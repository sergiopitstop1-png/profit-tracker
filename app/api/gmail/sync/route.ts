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

// Estrae testo da parti anche annidate (Gmail può avere parts dentro parts)
function estraiTestoDaParts(parts: any[]): string {
  for (const part of parts) {
    if (!part) continue
    // Ricorsione su parti annidate
    if (part.parts && part.parts.length > 0) {
      const nested = estraiTestoDaParts(part.parts)
      if (nested) return nested
    }
    if (part.mimeType === 'text/plain' && part.body?.data) {
      return Buffer.from(part.body.data, 'base64').toString('utf-8')
    }
  }
  // Fallback su text/html se nessun plain trovato
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

async function leggiTutteLeMail(accessToken: string) {
  const labels = ['INBOX', 'SPAM']
  const risultati: any[] = []

  // 72 ore per sicurezza (copre mail di bordo che il cron potrebbe perdere)
  const dopo72h = Math.floor((Date.now() - 72 * 60 * 60 * 1000) / 1000)
  const query = `after:${dopo72h}`

  for (const label of labels) {
    let pageToken: string | null = null
    let totale = 0

    while (totale < 200) {
      const url: string = `https://gmail.googleapis.com/gmail/v1/users/me/messages?maxResults=50&labelIds=${label}&q=${encodeURIComponent(query)}${pageToken ? '&pageToken=' + pageToken : ''}`
      const listRes = await fetch(url, { headers: { Authorization: `Bearer ${accessToken}` } })
      const listData = await listRes.json()

      if (listData.error) {
        console.error('Gmail list error:', listData.error)
        break
      }
      if (!listData.messages || listData.messages.length === 0) break

      for (const msg of listData.messages) {
        try {
          const msgRes = await fetch(
            `https://gmail.googleapis.com/gmail/v1/users/me/messages/${msg.id}?format=metadata&metadataHeaders=From&metadataHeaders=Subject&metadataHeaders=Date`,
            { headers: { Authorization: `Bearer ${accessToken}` } }
          )
          const msgData = await msgRes.json()
          if (msgData.error) continue
          const headers = msgData.payload?.headers || []
          const from = headers.find((h: any) => h.name === 'From')?.value || ''
          const subject = headers.find((h: any) => h.name === 'Subject')?.value || ''
          const date = headers.find((h: any) => h.name === 'Date')?.value || ''
          risultati.push({ from, subject, date, label, id: msg.id })
          totale++
        } catch (e) {
          console.error('Errore lettura msg metadata:', e)
        }
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
    if (data.error) return ''

    const payload = data.payload
    if (!payload) return ''

    // Corpo diretto (mail semplici senza parts)
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

    // Mail con parts (anche annidate)
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
  const BATCH = 20
  const promozioni: any[] = []

  for (let i = 0; i < mail.length; i += BATCH) {
    const batch = mail.slice(i, i + BATCH)
    const testo = batch.map((m, idx) =>
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
          max_tokens: 1000,
          messages: [{
            role: 'user',
            content: `Analizza queste email di ${nomeCliente} e identifica SOLO quelle che contengono promozioni, bonus, offerte speciali o opportunità da bookmaker/casinò/operatori di gioco d'azzardo. Includi tutto ciò che potrebbe essere una promo: meglio un falso positivo che perderne una. Rispondi SOLO con un JSON array valido, senza markdown, senza testo prima o dopo: [{"msg_id": "id esatto del messaggio come scritto dopo ID:", "from": "mittente", "subject": "oggetto", "date": "data originale", "tipo": "promozione/bonus/offerta", "priorita": "alta/media/bassa"}]. Priorità ALTA = scadenza imminente o importo elevato. Se non ci sono promozioni rispondi []. Email:\n\n${testo}`
          }]
        })
      })

      const data = await res.json()
      if (!data.content?.[0]?.text) continue

      const rawText = data.content[0].text.replace(/```json|```/g, '').trim()
      const parsed = JSON.parse(rawText)

      for (const p of parsed) {
        // Trova la mail originale per avere dati certi
        const mailOriginale = batch.find(m => m.id === p.msg_id || m.subject === p.subject)
        if (mailOriginale) {
          p.msg_id = mailOriginale.id
          if (!p.date) p.date = mailOriginale.date
          if (!p.from) p.from = mailOriginale.from
        }
        promozioni.push(p)
      }
    } catch (e) {
      console.error('Errore analizzaPromozioni batch:', e)
    }
  }

  return promozioni
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url)
  const secret = searchParams.get('secret')
  const forceEmailId = searchParams.get('email_id')

  // Autorizza se secret corretto OPPURE se è una richiesta per email specifica
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

      // Refresh token se scaduto o mancante
      const scaduto = emailRow.gmail_token_expiry
        ? new Date(emailRow.gmail_token_expiry) < new Date(Date.now() + 5 * 60 * 1000) // 5 min di margine
        : false

      if (scaduto || !accessToken) {
        accessToken = await refreshToken(emailRow)
        if (!accessToken) {
          risultati.push({ email: emailRow.email, errore: 'Token refresh fallito' })
          continue
        }
      }

      const mail = await leggiTutteLeMail(accessToken)
      const nomeCliente = emailRow.clienti?.nome || emailRow.email

      if (mail.length === 0) {
        risultati.push({ email: emailRow.email, mailTrovate: 0, promozioni: 0 })
        continue
      }

      const promozioni = await analizzaPromozioni(mail, nomeCliente)
      let salvate = 0
      let duplicate = 0

      for (const p of promozioni) {
        try {
          // Controlla duplicati: stesso oggetto+mittente nelle ultime 72 ore
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
            continue
          }

          // Leggi testo completo solo per promo nuove
          let testoCompleto = ''
          if (p.msg_id) {
            testoCompleto = await leggiTestoCompleto(accessToken, p.msg_id)
          }

          const { error: insertError } = await supabase.from('promozioni_clienti').insert([{
            cliente_id: emailRow.clienti?.id,
            email_id: emailRow.id,
            mittente: p.from || '',
            oggetto: p.subject || '',
            tipo: p.tipo || 'promozione',
            priorita: p.priorita || 'media',
            data_mail: parseDateSafe(p.date),
            testo_completo: testoCompleto ? testoCompleto.substring(0, 10000) : null
          }])

          if (insertError) {
            console.error('Insert error:', insertError)
          } else {
            salvate++
          }
        } catch (e) {
          console.error('Errore su singola promo:', e)
        }
      }

      // Aggiorna log sync
      await supabase.from('gmail_sync_log').upsert([{
        email_id: emailRow.id,
        ultimo_controllo: new Date().toISOString()
      }], { onConflict: 'email_id' })

      risultati.push({
        email: emailRow.email,
        mailTrovate: mail.length,
        promozioniTrovate: promozioni.length,
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
