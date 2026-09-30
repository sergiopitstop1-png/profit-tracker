import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

export const runtime = 'nodejs'
export const maxDuration = 60

const MODEL = 'openai/gpt-oss-20b'
const BATCH_SIZE = 5

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
  }
)

const lucySchema = {
  type: 'object',

  properties: {
    giudizio: {
      type: 'string',
      enum: [
        'UTILE',
        'DA_VALUTARE',
        'IGNORA',
      ],
    },

    categoria: {
      type: 'string',
      enum: [
        'BONUS',
        'FREEBET',
        'CASHBACK',
        'PROMO_DEPOSITO',
        'PROMO_CASINO',
        'PROMO_SLOT',
        'PROMO_PERSONALIZZATA',
        'RIMBORSO',
        'KYC',
        'LIMITAZIONE',
        'SOSPENSIONE',
        'PRELIEVO',
        'DEPOSITO',
        'SICUREZZA',
        'SCADENZA',
        'NEWSLETTER',
        'PUBBLICITA',
        'ALTRO',
      ],
    },

    priorita: {
      type: 'string',
      enum: [
        'alta',
        'media',
        'bassa',
      ],
    },

    confidenza: {
      type: 'number',
      minimum: 0,
      maximum: 1,
    },

    bookmaker: {
      type: ['string', 'null'],
    },

    tipo_offerta: {
      type: ['string', 'null'],
    },

    bonus_importo: {
      type: ['number', 'null'],
    },

    deposito_richiesto: {
      type: ['number', 'null'],
    },

    rollover: {
      type: ['string', 'null'],
    },

    scadenza: {
      type: ['string', 'null'],
    },

    condizioni: {
      type: ['string', 'null'],
    },

    motivazione_ai: {
      type: 'string',
    },

    richiede_azione: {
      type: 'boolean',
    },
  },

  required: [
    'giudizio',
    'categoria',
    'priorita',
    'confidenza',
    'bookmaker',
    'tipo_offerta',
    'bonus_importo',
    'deposito_richiesto',
    'rollover',
    'scadenza',
    'condizioni',
    'motivazione_ai',
    'richiede_azione',
  ],

  additionalProperties: false,
}


function compactMailBody(
  value: string | null | undefined
) {
  const text =
    String(value || '')
      .replace(/\u0000/g, '')
      .trim()

  if (text.length <= 3000) {
    return text
  }

  return (
    text.slice(0, 1800) +
    '\n\n[...contenuto abbreviato...]\n\n' +
    text.slice(-1200)
  )
}


function sleep(ms: number) {
  return new Promise(resolve =>
    setTimeout(resolve, ms)
  )
}


function buildPrompt(mail: any) {
  return `
Sei Lucy, l'assistente operativo di ProfitTracker.

Devi analizzare una email ricevuta da uno degli account del sistema.

OBIETTIVO PRINCIPALE:
individuare opportunità economiche REALI relative esclusivamente a:

- bookmaker
- scommesse
- casinò online
- poker
- slot
- conti gioco
- promozioni gaming
- bonus gaming
- cashback gaming
- freebet
- rimborsi gaming
- comunicazioni operative importanti dei conti gioco

NON considerare opportunità economiche generiche.

ESEMPI DA IGNORARE:
- banche
- Revolut
- carte di credito
- ecommerce
- negozi
- Decathlon
- telefonia
- hotel
- viaggi
- assicurazioni
- cashback non gaming
- sconti commerciali
- newsletter generiche
- offerte non legate al gioco online

Anche se una mail non gaming contiene parole come:
BONUS, CASHBACK, PREMIO, GRATIS, SCONTO
deve essere classificata IGNORA.

ECCEZIONE:
una comunicazione tecnica riguardante Lucy o ProfitTracker
può essere DA_VALUTARE, ma NON deve essere classificata
come opportunità/promozione gaming.

------------------------------------

GIUDIZIO

UTILE:
- bonus bookmaker/casinò/poker/slot
- freebet
- cashback gaming
- rimborso
- promo deposito gaming
- promo personale
- offerta riservata
- promozione con valore economico
- comunicazione importante sul conto gioco
- KYC importante
- limitazione
- sospensione
- problema deposito/prelievo
- sicurezza del conto
- scadenza importante

DA_VALUTARE:
- comunicazione gaming ambigua
- condizioni non sufficientemente chiare
- possibile opportunità che richiede verifica
- problema tecnico ProfitTracker/Lucy

IGNORA:
- pubblicità generica
- newsletter senza valore operativo
- offerte non gaming
- comunicazioni commerciali generiche
- social
- ecommerce
- banche
- Revolut
- negozi
- telecomunicazioni
- viaggi
- hotel
- contenuti irrilevanti

------------------------------------

PRIORITÀ

alta:
opportunità concreta, scadenza vicina,
bonus importante, problema serio sul conto,
azione urgente.

media:
utile ma non urgente oppure da verificare.

bassa:
informazione secondaria o contenuto da ignorare.

------------------------------------

BOOKMAKER

Se riconosci il bookmaker o casinò,
scrivine il nome in "bookmaker".

Se non è riconoscibile usa null.

Non inventare il bookmaker.

------------------------------------

VALORI

bonus_importo:
solo importo monetario del bonus se chiaramente indicato.

deposito_richiesto:
solo importo richiesto per ottenere la promo se chiaramente indicato.

rollover:
scrivi le condizioni di wagering/rollover se presenti.

scadenza:
riporta la scadenza indicata nella mail.
Se non esiste usa null.

condizioni:
riassunto MOLTO breve delle condizioni importanti.

motivazione_ai:
spiega in italiano, in modo sintetico,
perché la mail è utile, da valutare o da ignorare.

richiede_azione:
true solo se Sergio deve effettivamente fare qualcosa.

------------------------------------

EMAIL

Cliente:
${mail.cliente_nome || 'non identificato'}

Mittente:
${mail.mittente || '-'}

Destinatario originale:
${mail.destinatario_originale || '-'}

Oggetto:
${mail.oggetto || '(senza oggetto)'}

Testo:
${compactMailBody(mail.testo_completo)}

------------------------------------

Rispondi esclusivamente secondo lo schema JSON richiesto.
`
}


async function analyzeMail(mail: any) {
  const apiKey =
    process.env.GROQ_API_KEY

  if (!apiKey) {
    throw new Error(
      'GROQ_API_KEY mancante'
    )
  }

  const body = {
    model: MODEL,

    reasoning_effort: 'low',

    max_completion_tokens: 700,

    messages: [
      {
        role: 'user',
        content: buildPrompt(mail),
      },
    ],

    response_format: {
      type: 'json_schema',

      json_schema: {
        name:
          'lucy_mail_analysis',

        strict: true,

        schema: lucySchema,
      },
    },
  }


  let lastError: Error | null =
    null

  /*
   * Due tentativi.
   * Se Groq risponde 429 aspettiamo
   * prima di riprovare.
   */
  for (
    let attempt = 1;
    attempt <= 2;
    attempt++
  ) {
    try {
      const response =
        await fetch(
          'https://api.groq.com/openai/v1/chat/completions',
          {
            method: 'POST',

            headers: {
              Authorization:
                `Bearer ${apiKey}`,

              'Content-Type':
                'application/json',
            },

            body:
              JSON.stringify(body),
          }
        )


      if (
        response.status === 429
      ) {
        const retryHeader =
          response.headers.get(
            'retry-after'
          )

        let waitSeconds =
          Number(retryHeader)

        if (
          !Number.isFinite(
            waitSeconds
          ) ||
          waitSeconds <= 0
        ) {
          waitSeconds = 12
        }

        waitSeconds =
          Math.min(
            waitSeconds,
            25
          )

        if (attempt < 2) {
          console.warn(
            `[Lucy AI] Groq 429, attendo ${waitSeconds}s`
          )

          await sleep(
            waitSeconds * 1000
          )

          continue
        }
      }


      if (!response.ok) {
        const errorText =
          await response.text()

        throw new Error(
          `Groq ${response.status}: ${errorText.slice(0, 500)}`
        )
      }


      const json =
        await response.json()

      const content =
        json?.choices?.[0]
          ?.message?.content

      if (!content) {
        throw new Error(
          'Groq non ha restituito contenuto'
        )
      }


      const parsed =
        JSON.parse(content)

      return parsed

    } catch (error: any) {
      lastError =
        error instanceof Error
          ? error
          : new Error(
              String(error)
            )

      if (attempt < 2) {
        await sleep(1500)
      }
    }
  }


  throw (
    lastError ||
    new Error(
      'Errore AI sconosciuto'
    )
  )
}

function normalizeScadenza(
  value: unknown
): string | null {
  if (
    value === null ||
    value === undefined
  ) {
    return null
  }

  const raw =
    String(value).trim()

  if (!raw) {
    return null
  }

  /*
   * Accettiamo soltanto date che
   * JavaScript riesce realmente
   * a interpretare.
   *
   * Esempi come:
   * 04/10
   * domani
   * domenica
   * entro il 5
   *
   * NON vengono mandati al campo
   * timestamp di Supabase.
   */
  const parsed =
    Date.parse(raw)

  if (
    Number.isNaN(parsed)
  ) {
    return null
  }

  return new Date(
    parsed
  ).toISOString()
}
async function runAnalysis() {
  /*
   * Prendiamo fino a 5 mail.
   *
   * Manteniamo l'ordinamento
   * dalla più recente alla più vecchia:
   * una nuova promo non deve aspettare
   * dietro tutto l'arretrato.
   */
  const {
    data: mails,
    error,
  } =
    await supabase
      .from(
        'lucy_mail_archive'
      )
      .select('*')
      .eq(
        'giudizio',
        'DA_ANALIZZARE'
      )
      .order(
        'data_mail',
        {
          ascending: false,
        }
      )
      .limit(BATCH_SIZE)


  if (error) {
    throw error
  }


  if (
    !mails ||
    mails.length === 0
  ) {
    return {
      ok: true,
      trovate: 0,
      analizzate: 0,
      errori: 0,
      risultati: [],
    }
  }


  let analizzate = 0
  let errori = 0

  const risultati: any[] = []


  /*
   * Le analizziamo una alla volta.
   *
   * È intenzionale:
   * evita 5 richieste contemporanee
   * verso Groq e riduce il rischio
   * di rate limit.
   */
  for (const mail of mails) {
    try {
      const result =
        await analyzeMail(mail)


      const now =
        new Date()
          .toISOString()


      const {
        error: updateError,
      } =
        await supabase
          .from(
            'lucy_mail_archive'
          )
          .update({
            giudizio:
              result.giudizio,

            categoria:
              result.categoria,

            priorita:
              result.priorita,

            confidenza:
              result.confidenza,

            bookmaker:
              result.bookmaker,

            tipo_offerta:
              result.tipo_offerta,

            bonus_importo:
              result.bonus_importo,

            deposito_richiesto:
              result.deposito_richiesto,

            rollover:
              result.rollover,

            scadenza:
  normalizeScadenza(
    result.scadenza
  ),

            condizioni:
              result.condizioni,

            motivazione_ai:
              result.motivazione_ai,

            richiede_azione:
              result.richiede_azione,

            analizzata_at: now,
            updated_at: now,
          })
          .eq(
            'id',
            mail.id
          )


      if (updateError) {
        throw updateError
      }


      analizzate++


      risultati.push({
        id: mail.id,
        giudizio:
          result.giudizio,
        categoria:
          result.categoria,
        bookmaker:
          result.bookmaker,
      })


      console.log(
        `[Lucy AI] OK ${mail.id} ${result.giudizio} ${result.categoria} ${result.bookmaker || '-'}`
      )


      /*
       * Piccola pausa tra una mail
       * e la successiva.
       */
      await sleep(700)

    } catch (error: any) {
      errori++

      console.error(
        `[Lucy AI] ERRORE mail ${mail.id}`,
        error
      )


      /*
       * IMPORTANTISSIMO:
       * non cambiamo il giudizio.
       *
       * Rimane DA_ANALIZZARE e Lucy
       * potrà riprovarci alla prossima
       * esecuzione.
       */
      risultati.push({
        id: mail.id,
        errore:
          error?.message ||
          String(error),
      })
    }
  }


  return {
    ok: true,
    trovate:
      mails.length,
    analizzate,
    errori,
    risultati,
  }
}


/*
 * =========================================================
 * GET - Vercel Cron
 * =========================================================
 */

export async function GET(
  req: NextRequest
) {
  try {
    const cronSecret =
      process.env.CRON_SECRET

    if (cronSecret) {
      const auth =
        req.headers.get(
          'authorization'
        )

      if (
        auth !==
        `Bearer ${cronSecret}`
      ) {
        return NextResponse.json(
          {
            error:
              'Unauthorized',
          },
          {
            status: 401,
          }
        )
      }
    }


    const result =
      await runAnalysis()

    return NextResponse.json(
      result
    )

  } catch (error: any) {
    console.error(
      '[Lucy AI] errore generale',
      error
    )

    return NextResponse.json(
      {
        ok: false,
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
