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

alta (usala con parsimonia):
- promo personale o riservata a questo conto con valore
  concreto e certo;
- valore certo con scadenza entro 72 ore;
- problema serio sul conto (sospensione, limitazione,
  KYC con scadenza, prelievo bloccato).

media:
utile ma non urgente oppure da verificare.
Tornei, montepremi, Drop & Wins e promo generiche
inviate a tutti i giocatori: al massimo media.

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
SOLO l'importo che QUESTO conto riceve con certezza
se rispetta le condizioni.
Esempio: "deposita 100€, ricevi 50€" -> 50.
Usa null se:
- è un montepremi o premi in palio condivisi tra i giocatori
  (tornei, Drop & Wins, estrazioni, classifiche);
- è solo un massimale ("fino a 500€", "100% fino a 1.000€"):
  scrivi il massimale nelle condizioni;
- ci sono più bonus diversi: NON sommarli mai,
  descrivili nelle condizioni;
- l'importo non è chiaro.

deposito_richiesto:
solo la ricarica/deposito richiesto per ottenere la promo.
La puntata minima o la giocata minima NON è un deposito:
va nelle condizioni.

rollover:
scrivi le condizioni di wagering/rollover se presenti.

scadenza:
scrivila SEMPRE nel formato "AAAA-MM-GG HH:mm", ora italiana,
calcolandola dalla data di ricezione della mail indicata sotto.
Esempi (mail del 30/09/2026):
"entro il 4 ottobre" -> "2026-10-04 23:59";
"domani alle 21" -> "2026-10-01 21:00";
"entro domenica" -> "2026-10-04 23:59".
Se l'ora non è indicata usa 23:59.
Se la scadenza non esiste o non è determinabile usa null.

condizioni:
riassunto MOLTO breve delle condizioni importanti.

motivazione_ai:
spiega in italiano, in modo sintetico,
perché la mail è utile, da valutare o da ignorare.

richiede_azione:
true solo se Sergio deve effettivamente fare qualcosa.

------------------------------------

EMAIL

Data di ricezione:
${mail.data_mail ? new Date(mail.data_mail).toLocaleString('it-IT', { timeZone: 'Europe/Rome', weekday: 'long', day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' }) : 'sconosciuta'}

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

/*
 * =========================================================
 * SCADENZE (30/09/2026)
 * Il vecchio Date.parse leggeva "04/10" all'americana
 * (10 aprile) e a volte con anno 2001.
 * Ora: giorno/mese all'italiana, anno e riferimenti relativi
 * (oggi, domani, domenica, entro il 5) calcolati dalla data
 * della mail, ora italiana (senza ora = 23:59).
 * Se la data non è sicura restituisce null: il testo
 * originale finisce nelle condizioni, non si perde.
 * =========================================================
 */
const MESI: Record<string, number> = { gennaio: 1, gen: 1, febbraio: 2, feb: 2, marzo: 3, mar: 3, aprile: 4, apr: 4, maggio: 5, mag: 5, giugno: 6, giu: 6, luglio: 7, lug: 7, agosto: 8, ago: 8, settembre: 9, sett: 9, set: 9, ottobre: 10, ott: 10, novembre: 11, nov: 11, dicembre: 12, dic: 12 }
const GIORNI: Record<string, number> = { domenica: 0, lunedi: 1, martedi: 2, mercoledi: 3, giovedi: 4, venerdi: 5, sabato: 6 }

function romeParts(ts: number) {
  const f = new Intl.DateTimeFormat('en-GB', { timeZone: 'Europe/Rome', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' })
  const p: Record<string, string> = {}
  for (const x of f.formatToParts(new Date(ts))) p[x.type] = x.value
  return { y: Number(p.year), m: Number(p.month), d: Number(p.day), h: Number(p.hour), mi: Number(p.minute) }
}

// ora italiana -> timestamp (gestisce ora legale/solare)
function romeToTs(y: number, m: number, d: number, h: number, mi: number) {
  const voluto = Date.UTC(y, m - 1, d, h, mi)
  let ts = voluto
  for (let i = 0; i < 2; i++) {
    const p = romeParts(ts)
    ts += voluto - Date.UTC(p.y, p.m - 1, p.d, p.h, p.mi)
  }
  return ts
}

function giornoValido(y: number, m: number, d: number) {
  if (m < 1 || m > 12 || d < 1 || d > 31) return false
  return new Date(Date.UTC(y, m - 1, d)).getUTCDate() === d
}

function normalizeScadenza(
  value: unknown,
  dataMail?: string | null
): string | null {
  if (value === null || value === undefined) return null
  let s = String(value).trim().toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '')
  if (!s) return null

  const refTs = dataMail && !Number.isNaN(new Date(dataMail).getTime()) ? new Date(dataMail).getTime() : Date.now()
  const ref = romeParts(refTs)
  const oggiTs = Date.UTC(ref.y, ref.m - 1, ref.d)

  // ora: "ore 21", "alle 12.00", "23:59" (senza ora = 23:59)
  let h = 23
  let mi = 59
  const ora = s.match(/\b(?:ore|alle)\s*(\d{1,2})(?:[:.](\d{2}))?\b/) || s.match(/\b(\d{1,2}):(\d{2})\b/)
  if (ora) {
    h = Number(ora[1])
    mi = Number(ora[2] || 0)
    s = s.replace(ora[0], ' ')
  }
  if (h > 23 || mi > 59) return null

  let y: number | null = null
  let m = 0
  let d = 0
  let r: RegExpMatchArray | null

  if ((r = s.match(/\b(\d{4})-(\d{1,2})-(\d{1,2})/))) {
    y = +r[1]; m = +r[2]; d = +r[3]
  } else if ((r = s.match(/\b(\d{1,2})[\/.-](\d{1,2})(?:[\/.-](\d{2,4}))?\b/))) {
    d = +r[1]; m = +r[2]
    if (r[3]) y = r[3].length === 2 ? 2000 + +r[3] : +r[3]
  } else if ((r = s.match(/\b(\d{1,2})\s+(?:di\s+)?([a-z]+)(?:\s+(\d{4}))?/)) && MESI[r[2]]) {
    d = +r[1]; m = MESI[r[2]]
    if (r[3]) y = +r[3]
  } else if (/\b(dopodomani|domani|oggi|stasera|mezzanotte)\b/.test(s)) {
    const piu = /\bdopodomani\b/.test(s) ? 2 : /\bdomani\b/.test(s) ? 1 : 0
    const t = new Date(oggiTs + piu * 86400000)
    y = t.getUTCFullYear(); m = t.getUTCMonth() + 1; d = t.getUTCDate()
  } else if ((r = s.match(/\b(domenica|lunedi|martedi|mercoledi|giovedi|venerdi|sabato)\b/))) {
    const diff = (GIORNI[r[1]] - new Date(oggiTs).getUTCDay() + 7) % 7
    const t = new Date(oggiTs + diff * 86400000)
    y = t.getUTCFullYear(); m = t.getUTCMonth() + 1; d = t.getUTCDate()
  } else if ((r = s.match(/\b(?:entro\s+il|fino\s+al|il)\s+(\d{1,2})\b/))) {
    d = +r[1]; m = ref.m; y = ref.y
    if (d < ref.d) { m++; if (m > 12) { m = 1; y++ } }
  } else {
    return null
  }

  let annoDedotto = false
  if (y === null) { y = ref.y; annoDedotto = true }
  if (!giornoValido(y, m, d)) return null

  let ts = romeToTs(y, m, d, h, mi)
  // es. mail del 28/12 con scadenza "03/01" -> anno successivo
  if (annoDedotto && ts < refTs - 60 * 86400000 && giornoValido(y + 1, m, d)) ts = romeToTs(y + 1, m, d, h, mi)
  // fuori scala (es. 2001): meglio nessuna data che una data sbagliata
  if (ts < refTs - 2 * 86400000 || ts > refTs + 400 * 86400000) return null

  return new Date(ts).toISOString()
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

      // scadenza calcolata dalla data della mail; se non è sicura
      // il testo originale resta nelle condizioni
      const scadenza =
        normalizeScadenza(result.scadenza, mail.data_mail)
      const condizioni =
        result.scadenza && !scadenza
          ? [result.condizioni, `Scadenza indicata: ${result.scadenza}`].filter(Boolean).join(' · ')
          : result.condizioni


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

            scadenza,

            condizioni,

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
