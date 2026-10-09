export const maxDuration = 60

import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

/*
 * =========================================================
 * SICUREZZA CRON
 * =========================================================
 */

function isAuthorized(request: Request) {
  const auth = request.headers.get('authorization')

  return (
    !!process.env.CRON_SECRET &&
    auth === `Bearer ${process.env.CRON_SECRET}`
  )
}

/*
 * =========================================================
 * REFRESH ACCESS TOKEN GOOGLE
 * =========================================================
 */

async function getAccessToken(connection: any) {
  const tokenStillValid =
    connection.access_token &&
    connection.token_expiry &&
    new Date(connection.token_expiry).getTime() >
      Date.now() + 5 * 60 * 1000

  if (tokenStillValid) {
    return connection.access_token
  }

  const response = await fetch(
    'https://oauth2.googleapis.com/token',
    {
      method: 'POST',
      headers: {
        'Content-Type':
          'application/x-www-form-urlencoded',
      },
      body: new URLSearchParams({
        client_id:
          process.env.GMAIL_CLIENT_ID!,
        client_secret:
          process.env.GMAIL_CLIENT_SECRET!,
        refresh_token:
          connection.refresh_token,
        grant_type:
          'refresh_token',
      }),
    }
  )

  const data = await response.json()

  if (!data.access_token) {
    console.error(
      '[Lucy] refresh token fallito',
      data
    )

    throw new Error(
      'Impossibile aggiornare il token Gmail'
    )
  }

  const expiry =
    new Date(
      Date.now() +
        data.expires_in * 1000
    ).toISOString()

  await supabase
    .from('lucy_gmail_connection')
    .update({
      access_token:
        data.access_token,

      token_expiry:
        expiry,

      updated_at:
        new Date().toISOString(),
    })
    .eq('id', 1)

  return data.access_token
}

/*
 * =========================================================
 * DECODIFICA BASE64 GMAIL
 * =========================================================
 */

function decodeBase64(data?: string) {
  if (!data) return ''

  const normalized = data
    .replace(/-/g, '+')
    .replace(/_/g, '/')

  return Buffer
    .from(normalized, 'base64')
    .toString('utf8')
}

/*
 * =========================================================
 * ESTRAZIONE TESTO EMAIL
 * =========================================================
 */

function extractText(part: any): string {
  if (!part) return ''

  /*
   * Prima preferiamo sempre text/plain
   */

  if (
    part.mimeType === 'text/plain' &&
    part.body?.data
  ) {
    return decodeBase64(
      part.body.data
    )
  }

  /*
   * Multipart
   */

  if (part.parts?.length) {
    for (const child of part.parts) {
      const text =
        extractText(child)

      if (text) {
        return text
      }
    }
  }

  /*
   * Fallback HTML
   */

  if (
    part.mimeType === 'text/html' &&
    part.body?.data
  ) {
    return decodeBase64(
      part.body.data
    )
      .replace(
        /<style[^>]*>[\s\S]*?<\/style>/gi,
        ' '
      )
      .replace(
        /<script[^>]*>[\s\S]*?<\/script>/gi,
        ' '
      )
      .replace(
        /<[^>]+>/g,
        ' '
      )
      .replace(
        /\s+/g,
        ' '
      )
      .trim()
  }

  if (part.body?.data) {
    return decodeBase64(
      part.body.data
    )
  }

  return ''
}

/*
 * =========================================================
 * HEADER EMAIL
 * =========================================================
 */

function getHeader(
  headers: any[],
  name: string
) {
  return (
    headers.find(
      (header) =>
        String(
          header.name
        ).toLowerCase() ===
        name.toLowerCase()
    )?.value || ''
  )
}

/*
 * =========================================================
 * ESTRAZIONE INDIRIZZI EMAIL
 * =========================================================
 */

function extractEmails(
  value: string
) {
  const matches =
    value.match(
      /[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi
    ) || []

  return [
    ...new Set(
      matches.map(
        (email) =>
          email.toLowerCase()
      )
    ),
  ]
}

/*
 * =========================================================
 * LISTA MESSAGGI RECENTI
 * =========================================================
 */

async function listMessages(
  accessToken: string,
  afterUnix: number
) {
  const ids: string[] = []

  let pageToken:
    | string
    | undefined

  /*
   * Massimo 5 pagine da 100:
   * fino a 500 mail per ciclo.
   */

  for (
    let page = 0;
    page < 5;
    page++
  ) {
    const params =
      new URLSearchParams({
        maxResults: '100',

        /*
         * in:anywhere comprende anche
         * spam e archiviate.
         */

        q: `in:anywhere after:${afterUnix}`,
      })

    if (pageToken) {
      params.set(
        'pageToken',
        pageToken
      )
    }

    const response =
      await fetch(
        `https://gmail.googleapis.com/gmail/v1/users/me/messages?${params.toString()}`,
        {
          headers: {
            Authorization:
              `Bearer ${accessToken}`,
          },
        }
      )

    const data =
      await response.json()

    if (data.error) {
      throw new Error(
        data.error.message ||
          'Errore Gmail'
      )
    }

    for (
      const message of
        data.messages || []
    ) {
      ids.push(
        message.id
      )
    }

    pageToken =
      data.nextPageToken

    if (!pageToken) {
      break
    }
  }

  return [
    ...new Set(ids),
  ]
}

/*
 * =========================================================
 * LETTURA MESSAGGIO COMPLETO
 * =========================================================
 */

async function getMessage(
  accessToken: string,
  id: string
) {
  const response =
    await fetch(
      `https://gmail.googleapis.com/gmail/v1/users/me/messages/${id}?format=full`,
      {
        headers: {
          Authorization:
            `Bearer ${accessToken}`,
        },
      }
    )

  const data =
    await response.json()

  if (data.error) {
    throw new Error(
      data.error.message ||
        'Errore lettura email'
    )
  }

  return data
}

/*
 * =========================================================
 * SYNC AUTOMATICO
 * =========================================================
 */

export async function GET(
  request: Request
) {
  /*
   * Niente più secret nell'URL.
   */

  if (!isAuthorized(request)) {
    return NextResponse.json(
      {
        error:
          'Non autorizzato',
      },
      {
        status: 401,
      }
    )
  }

  /*
   * Recupera la connessione
   * centrale Lucy_Server.
   */

  const {
    data: connection,
    error: connectionError,
  } =
    await supabase
      .from(
        'lucy_gmail_connection'
      )
      .select('*')
      .eq('id', 1)
      .maybeSingle()

  if (
    connectionError ||
    !connection?.refresh_token
  ) {
    return NextResponse.json(
      {
        error:
          'Lucy_Server non collegata a Gmail',
      },
      {
        status: 409,
      }
    )
  }

  try {
    const accessToken =
      await getAccessToken(
        connection
      )

    /*
     * Primo avvio:
     * guardiamo gli ultimi 7 giorni.
     *
     * Successivamente ripartiamo
     * dall'ultimo sync con 10 minuti
     * di sovrapposizione.
     */

    const startTime =
      connection.last_sync_at
        ? new Date(
            connection.last_sync_at
          ).getTime() -
          10 * 60 * 1000
        : Date.now() -
          7 *
            24 *
            60 *
            60 *
            1000

    const afterUnix =
      Math.floor(
        startTime / 1000
      )

    const messageIds =
      await listMessages(
        accessToken,
        afterUnix
      )

    /*
     * Controlliamo quali messaggi
     * sono già nel calderone.
     */

    let existingIds =
      new Set<string>()

    if (
      messageIds.length > 0
    ) {
      const {
        data: existing,
      } =
        await supabase
          .from(
            'lucy_mail_archive'
          )
          .select(
            'gmail_message_id'
          )
          .in(
            'gmail_message_id',
            messageIds
          )

      existingIds =
        new Set(
          (
            existing || []
          ).map(
            (row: any) =>
              row.gmail_message_id
          )
        )
    }

    const newIds =
      messageIds.filter(
        (id) =>
          !existingIds.has(id)
      )

    /*
     * Carichiamo la rubrica
     * cliente -> email
     * direttamente da ProfitTracker.
     */

    const {
      data: emailRows,
    } =
      await supabase
        .from('clienti_email')
        .select(
          'email, clienti(id, nome)'
        )

    const clientByEmail =
      new Map<
        string,
        any
      >()

    for (
      const row of
        emailRows || []
    ) {
      if (!row.email) {
        continue
      }

      clientByEmail.set(
        String(
          row.email
        ).toLowerCase(),
        row.clienti
      )
    }

    /*
     * 09/10/2026 — Anche l'email scritta nel form cliente
     * (colonna clienti.email) vale per il riconoscimento.
     * clienti_email ha la precedenza; qui si aggiungono
     * solo gli indirizzi che mancano.
     */

    const {
      data: clientiRows,
    } =
      await supabase
        .from('clienti')
        .select('id, nome, email')

    for (
      const c of
        clientiRows || []
    ) {
      for (
        const addr of
          extractEmails(
            String(
              c.email || ''
            )
          )
      ) {
        if (
          !clientByEmail.has(
            addr
          )
        ) {
          clientByEmail.set(
            addr,
            {
              id: c.id,
              nome: c.nome,
            }
          )
        }
      }
    }

    /*
     * 09/10/2026 — Mail già archiviate ma senza cliente
     * (indirizzo aggiunto dopo l'arrivo): riprova ad
     * abbinarle a ogni giro.
     */

    let riabbinate = 0

    {
      const {
        data: orfane,
      } =
        await supabase
          .from(
            'lucy_mail_archive'
          )
          .select(
            'id, destinatario_originale'
          )
          .is(
            'cliente_id',
            null
          )
          .not(
            'destinatario_originale',
            'is',
            null
          )
          .limit(500)

      for (
        const o of
          orfane || []
      ) {
        const found =
          clientByEmail.get(
            String(
              o.destinatario_originale
            )
              .trim()
              .toLowerCase()
          )

        if (found?.id) {
          const {
            error: relinkError,
          } =
            await supabase
              .from(
                'lucy_mail_archive'
              )
              .update({
                cliente_id:
                  found.id,

                cliente_nome:
                  found.nome,
              })
              .eq('id', o.id)

          if (!relinkError) {
            riabbinate++
          }
        }
      }
    }

    let saved = 0
    let unidentified = 0

    /*
     * Elaboriamo soltanto
     * le mail nuove.
     */

    for (
      const messageId of
        newIds
    ) {
      const message =
        await getMessage(
          accessToken,
          messageId
        )

      const headers =
        message.payload
          ?.headers || []

      /*
       * Gmail forwarding mantiene
       * normalmente il destinatario
       * originale in questi header.
       */

      const recipientHeaders =
        [
          getHeader(
            headers,
            'X-Forwarded-For'
          ),

          getHeader(
            headers,
            'X-Original-To'
          ),

          getHeader(
            headers,
            'Delivered-To'
          ),

          getHeader(
            headers,
            'To'
          ),
        ]
          .filter(Boolean)
          .join(' ')

      const recipients =
        extractEmails(
          recipientHeaders
        ).filter(
          (email) =>
            email !==
            'lucyserver52@gmail.com'
        )

      /*
       * Cerchiamo quale indirizzo
       * appartiene a un cliente
       * ProfitTracker.
       */

      let matchedEmail:
        | string
        | null = null

      let client:
        | any
        | null = null

      for (
        const email of
          recipients
      ) {
        const found =
          clientByEmail.get(
            email
          )

        if (found) {
          matchedEmail =
            email

          client =
            found

          break
        }
      }

      if (!client) {
        unidentified++
      }

      /*
       * Data email
       */

      const dateHeader =
        getHeader(
          headers,
          'Date'
        )

      let mailDate:
        | string
        | null = null

      if (
        dateHeader &&
        !isNaN(
          new Date(
            dateHeader
          ).getTime()
        )
      ) {
        mailDate =
          new Date(
            dateHeader
          ).toISOString()
      } else if (
        message.internalDate
      ) {
        mailDate =
          new Date(
            Number(
              message.internalDate
            )
          ).toISOString()
      }

      /*
       * Salviamo PRIMA la mail.
       *
       * L'AI arriverà DOPO.
       */

      const archiveRow = {
        gmail_message_id:
          messageId,

        gmail_thread_id:
          message.threadId ||
          null,

        mittente:
          getHeader(
            headers,
            'From'
          ),

        destinatario_originale:
          matchedEmail ||
          recipients[0] ||
          null,

        oggetto:
          getHeader(
            headers,
            'Subject'
          ) ||
          '(senza oggetto)',

        testo_completo:
          extractText(
            message.payload
          )
            .slice(
              0,
              50000
            ) ||
          null,

        data_mail:
          mailDate,

        cliente_id:
          client?.id ||
          null,

        cliente_nome:
          client?.nome ||
          null,

        gmail_labels:
          message.labelIds ||
          [],

        /*
         * L'AI non ha ancora
         * espresso un giudizio.
         */

        categoria:
          'DA_ANALIZZARE',

        giudizio:
          'DA_ANALIZZARE',

        priorita:
          'media',

        richiede_azione:
          false,

        letta:
          false,
      }

      const {
        error: insertError,
      } =
        await supabase
          .from(
            'lucy_mail_archive'
          )
          .insert(
            archiveRow
          )

      if (
        insertError
      ) {
        console.error(
          '[Lucy] errore insert',
          messageId,
          insertError.message
        )
      } else {
        saved++
      }
    }

    /*
     * Registriamo il momento
     * dell'ultimo controllo.
     */

    await supabase
      .from(
        'lucy_gmail_connection'
      )
      .update({
        last_sync_at:
          new Date().toISOString(),

        updated_at:
          new Date().toISOString(),
      })
      .eq('id', 1)

    return NextResponse.json({
      sync:
        'completato',

      trovate:
        messageIds.length,

      nuove:
        newIds.length,

      salvate:
        saved,

      non_identificate:
        unidentified,

      riabbinate,
    })
  } catch (error: any) {
    console.error(
      '[Lucy sync]',
      error
    )

    return NextResponse.json(
      {
        error:
          error?.message ||
          String(error),
      },
      {
        status: 500,
      }
    )
  }
}
