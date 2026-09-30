export const maxDuration = 60

import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

function authorized(request: Request) {
  const auth = request.headers.get('authorization')

  return (
    !!process.env.CRON_SECRET &&
    auth === `Bearer ${process.env.CRON_SECRET}`
  )
}

function cleanJson(text: string) {
  return text
    .replace(/```json/gi, '')
    .replace(/```/g, '')
    .trim()
}

function numberOrNull(value: any) {
  if (
    value === null ||
    value === undefined ||
    value === ''
  ) {
    return null
  }

  const n = Number(value)

  return Number.isFinite(n)
    ? n
    : null
}

function stringOrNull(value: any) {
  if (
    value === null ||
    value === undefined
  ) {
    return null
  }

  const s = String(value).trim()

  return s || null
}

async function analyzeMail(mail: any) {
  const body = String(
    mail.testo_completo || ''
  ).slice(0, 16000)

  const prompt = `
Analizza UNA email ricevuta da un sistema che monitora
account di bookmaker, casinò e servizi online.

Il tuo compito NON è cercare semplicemente parole chiave.
Devi capire il significato reale della mail e stabilire
se richiede attenzione.

CLIENTE:
${mail.cliente_nome || 'NON IDENTIFICATO'}

MITTENTE:
${mail.mittente || ''}

OGGETTO:
${mail.oggetto || ''}

TESTO:
${body}

REGOLE IMPORTANTI:

1. UTILE
Usa UTILE quando esiste una concreta opportunità economica
o un'azione importante sull'account.

Esempi:
- bonus deposito
- freebet
- cashback
- bonus casinò
- bonus slot
- promo personalizzata
- rimborso
- credito promozionale
- offerta con valore economico
- premio
- promozione riservata
- KYC/documenti richiesti
- conto limitato
- conto sospeso
- prelievo rifiutato
- deposito problematico
- verifica account
- scadenza importante

2. DA_VALUTARE
Usa DA_VALUTARE se potrebbe esserci qualcosa di interessante
ma dalla mail non è possibile stabilirlo con sufficiente
certezza.

3. IGNORA
Usa IGNORA per:
- pubblicità generica
- newsletter senza vantaggio concreto
- marketing generico
- comunicazioni commerciali non utili
- ricevute/notifiche ordinarie
- GitHub/Vercel
- negozi
- banche/fintech senza offerta rilevante
- comunicazioni senza utilità operativa

IMPORTANTE:
Una mail proveniente da un bookmaker NON è automaticamente
UTILE. Una newsletter generica di un bookmaker può essere IGNORA.

BOOKMAKER:
Individua il nome dell'operatore reale dal mittente e dal testo.
Esempi: Sportium, bwin, Sisal, SNAI, Eurobet, Lottomatica,
Goldbet, DAZNBet, Bet365, PokerStars, NetBet, LeoVegas ecc.

Se non è un bookmaker/casinò/operatore di gioco:
bookmaker = null.

CATEGORIA:
scegli UNA delle seguenti:

BONUS
FREEBET
CASHBACK
PROMO_DEPOSITO
PROMO_CASINO
PROMO_SLOT
PROMO_PERSONALIZZATA
RIMBORSO
KYC
LIMITAZIONE
SOSPENSIONE
PRELIEVO
DEPOSITO
SICUREZZA
SCADENZA
NEWSLETTER
PUBBLICITA
ALTRO

PRIORITA:
alta = richiede azione rapida, scadenza imminente,
problema account o opportunità importante.

media = utile ma non urgente.

bassa = informativa o poco importante.

CONFIDENZA:
numero da 0 a 1.

BONUS_IMPORTO:
solo numero in euro se chiaramente indicato.
Altrimenti null.

DEPOSITO_RICHIESTO:
solo numero in euro se chiaramente indicato.
Altrimenti null.

ROLLOVER:
scrivi una descrizione sintetica solo se chiaramente presente.
Esempio "10x bonus", "35x".
Altrimenti null.

SCADENZA:
se è possibile ricavare una data precisa,
restituiscila in formato ISO 8601.
Altrimenti null.

TIPO_OFFERTA:
breve descrizione dell'offerta.
Altrimenti null.

CONDIZIONI:
riassumi in massimo 250 caratteri le condizioni importanti.
Altrimenti null.

MOTIVAZIONE:
spiega in massimo 250 caratteri PERCHÉ hai scelto
UTILE, DA_VALUTARE o IGNORA.

RICHIEDE_AZIONE:
true se Sergio dovrebbe fare qualcosa.
false altrimenti.

Rispondi SEMPRE E SOLO con un JSON valido.
Niente markdown.
Niente testo prima o dopo.

Formato ESATTO:

{
  "giudizio": "UTILE",
  "categoria": "BONUS",
  "priorita": "alta",
  "confidenza": 0.95,
  "bookmaker": "Sportium",
  "tipo_offerta": "Bonus deposito",
  "bonus_importo": 50,
  "deposito_richiesto": 100,
  "rollover": null,
  "scadenza": null,
  "condizioni": "Deposita 100 euro per ricevere 50 euro.",
  "motivazione_ai": "Offerta economica concreta e personalizzata.",
  "richiede_azione": true
}
`

  const response = await fetch(
    'https://api.groq.com/openai/v1/chat/completions',
    {
      method: 'POST',

      headers: {
        'Content-Type': 'application/json',
        Authorization:
          `Bearer ${process.env.GROQ_API_KEY}`,
      },

      body: JSON.stringify({
        model:
          'openai/gpt-oss-120b',

        temperature: 0.1,

        max_tokens: 1000,

        response_format: {
          type: 'json_object',
        },

        messages: [
          {
            role: 'system',
            content:
              'Sei Lucy, assistente specializzata nell’analisi di email operative e promozionali. Devi essere prudente, precisa e restituire esclusivamente JSON valido.',
          },

          {
            role: 'user',
            content: prompt,
          },
        ],
      }),
    }
  )

  const data = await response.json()

  if (
    !response.ok ||
    !data.choices?.[0]?.message?.content
  ) {
    throw new Error(
      data?.error?.message ||
      'Groq non ha restituito una risposta valida'
    )
  }

  return JSON.parse(
    cleanJson(
      data.choices[0].message.content
    )
  )
}

export async function GET(
  request: Request
) {
  if (!authorized(request)) {
    return NextResponse.json(
      {
        error: 'Non autorizzato',
      },
      {
        status: 401,
      }
    )
  }

  if (!process.env.GROQ_API_KEY) {
    return NextResponse.json(
      {
        error:
          'GROQ_API_KEY mancante',
      },
      {
        status: 500,
      }
    )
  }

  /*
   * Analizziamo a blocchi.
   * Se rimangono altre mail DA_ANALIZZARE,
   * verranno prese al giro successivo.
   */

  const {
    data: mails,
    error,
  } = await supabase
    .from('lucy_mail_archive')
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
    .limit(20)

  if (error) {
    return NextResponse.json(
      {
        error: error.message,
      },
      {
        status: 500,
      }
    )
  }

  if (!mails?.length) {
    return NextResponse.json({
      analizzate: 0,
      utili: 0,
      da_valutare: 0,
      ignorate: 0,
      errori: 0,
      messaggio:
        'Nessuna mail da analizzare',
    })
  }

  let analyzed = 0
  let useful = 0
  let evaluate = 0
  let ignored = 0
  let errors = 0

  for (const mail of mails) {
    try {
      const ai =
        await analyzeMail(mail)

      const allowedJudgments =
        [
          'UTILE',
          'DA_VALUTARE',
          'IGNORA',
        ]

      const judgment =
        allowedJudgments.includes(
          ai.giudizio
        )
          ? ai.giudizio
          : 'DA_VALUTARE'

      const allowedPriorities =
        [
          'alta',
          'media',
          'bassa',
        ]

      const priority =
        allowedPriorities.includes(
          ai.priorita
        )
          ? ai.priorita
          : 'media'

      const confidence =
        Math.max(
          0,
          Math.min(
            1,
            Number(
              ai.confidenza ?? 0
            )
          )
        )

      const update = {
        giudizio:
          judgment,

        categoria:
          stringOrNull(
            ai.categoria
          ) ||
          'ALTRO',

        priorita:
          priority,

        confidenza:
          confidence,

        bookmaker:
          stringOrNull(
            ai.bookmaker
          ),

        tipo_offerta:
          stringOrNull(
            ai.tipo_offerta
          ),

        bonus_importo:
          numberOrNull(
            ai.bonus_importo
          ),

        deposito_richiesto:
          numberOrNull(
            ai.deposito_richiesto
          ),

        rollover:
          stringOrNull(
            ai.rollover
          ),

        scadenza:
          stringOrNull(
            ai.scadenza
          ),

        condizioni:
          stringOrNull(
            ai.condizioni
          ),

        motivazione_ai:
          stringOrNull(
            ai.motivazione_ai
          ),

        richiede_azione:
          Boolean(
            ai.richiede_azione
          ),

        analizzata_at:
          new Date().toISOString(),

        updated_at:
          new Date().toISOString(),
      }

      const {
        error: updateError,
      } = await supabase
        .from(
          'lucy_mail_archive'
        )
        .update(update)
        .eq('id', mail.id)

      if (updateError) {
        throw updateError
      }

      analyzed++

      if (
        judgment === 'UTILE'
      ) {
        useful++
      }

      if (
        judgment ===
        'DA_VALUTARE'
      ) {
        evaluate++
      }

      if (
        judgment === 'IGNORA'
      ) {
        ignored++
      }
    } catch (e: any) {
      errors++

      console.error(
        '[Lucy AI]',
        mail.id,
        e?.message ||
          String(e)
      )
    }
  }

  return NextResponse.json({
    analizzate:
      analyzed,

    utili:
      useful,

    da_valutare:
      evaluate,

    ignorate:
      ignored,

    errori:
      errors,

    rimaste:
      Math.max(
        0,
        (mails?.length || 0) -
          analyzed
      ),
  })
}
