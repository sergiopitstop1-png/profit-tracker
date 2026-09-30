import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

export const runtime = 'nodejs'
export const maxDuration = 60

const MODEL = 'openai/gpt-oss-20b'

const EMAIL_BATCH_SIZE = 5
const SMS_BATCH_SIZE = 5
const MAX_WORK_TIME_MS = 50_000

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
      enum: ['UTILE', 'DA_VALUTARE', 'IGNORA'],
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
      enum: ['alta', 'media', 'bassa'],
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

type Canale = 'EMAIL' | 'SMS'

type LucyItem = {
  id: number | string
  canale: Canale
  cliente_nome: string | null
  mittente: string | null
  oggetto: string | null
  testo_completo: string | null
  data_comunicazione: string | null
  tabella: 'lucy_mail_archive' | 'sms_clienti'
}

function compactBody(
  value: string | null | undefined
) {
  const text = String(value || '')
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

/* =========================================================
   PROMPT LUCY
   ========================================================= */

function buildPrompt(item: LucyItem) {
  const dataRicezione =
    item.data_comunicazione
      ? new Date(
          item.data_comunicazione
        ).toLocaleString('it-IT', {
          timeZone: 'Europe/Rome',
          weekday: 'long',
          day: '2-digit',
          month: '2-digit',
          year: 'numeric',
          hour: '2-digit',
          minute: '2-digit',
        })
      : 'sconosciuta'

  return `
Sei Lucy, l'assistente operativo di ProfitTracker.

Devi analizzare una comunicazione ricevuta da uno degli account del sistema.

La comunicazione può provenire da EMAIL oppure SMS.

Canale della comunicazione:
${item.canale}

==================================================
OBIETTIVO DI LUCY
==================================================

Devi distinguere chiaramente TRE tipi di comunicazione:

1. OPPORTUNITÀ ECONOMICA GAMING
2. COMUNICAZIONE OPERATIVA / PROBLEMA
3. COMUNICAZIONE DA IGNORARE

È MOLTO IMPORTANTE NON CONFONDERE
UN PROBLEMA OPERATIVO CON UNA OPPORTUNITÀ ECONOMICA.

==================================================
1. UTILE = OPPORTUNITÀ ECONOMICA GAMING
==================================================

Usa giudizio "UTILE" SOLO quando esiste
una reale opportunità economica legata a:

- bookmaker
- scommesse
- casinò online
- poker
- slot
- conti gioco
- bonus gaming
- cashback gaming
- freebet
- rimborsi gaming
- promo deposito gaming
- promozioni personalizzate
- offerte riservate al conto

Esempi UTILE:

"Deposita 50€ e ricevi 20€ bonus"
-> UTILE

"Hai una freebet da 10€"
-> UTILE

"Cashback 20% sulle perdite"
-> UTILE

"Bonus casinò riservato al tuo conto"
-> UTILE

"Ti abbiamo accreditato 15€ di bonus"
-> UTILE

"Rimborso fino a 20€ sulle perdite"
-> UTILE

UTILE deve quindi significare:
C'È UNA POSSIBILE OPPORTUNITÀ ECONOMICA
PER SERGIO.

NON usare UTILE per problemi tecnici,
KYC, limitazioni, sospensioni,
sicurezza, depositi o prelievi problematici.

==================================================
2. DA_VALUTARE = OPERATIVITÀ / PROBLEMI
==================================================

Usa giudizio "DA_VALUTARE" per comunicazioni
operative relative ai conti gioco.

Poi usa "richiede_azione" per distinguere
una semplice informazione da un vero problema.

------------------------------------
DA_VALUTARE + richiede_azione = true
------------------------------------

Questa combinazione identifica un VERO PROBLEMA
o una situazione che richiede l'intervento di Sergio.

Esempi:

- conto sospeso
- conto limitato
- conto bloccato
- documento rifiutato
- verifica identità fallita
- KYC incompleto che richiede documenti
- richiesta urgente di nuovi documenti
- documento in scadenza che richiede intervento
- prelievo rifiutato
- prelievo bloccato
- deposito rifiutato
- deposito non accreditato
- verifica del conto fallita
- problema di sicurezza reale
- accesso bloccato
- account temporaneamente sospeso
- richiesta obbligatoria con scadenza
- chiusura del conto
- richiesta di intervento per evitare limitazioni
  o sospensione

Esempio:

"Il documento inviato non è stato accettato.
Invia un nuovo documento."

giudizio = DA_VALUTARE
categoria = KYC
richiede_azione = true

Esempio:

"Il tuo prelievo è stato rifiutato.
Contatta l'assistenza."

giudizio = DA_VALUTARE
categoria = PRELIEVO
richiede_azione = true

Esempio:

"Il tuo conto è stato temporaneamente sospeso."

giudizio = DA_VALUTARE
categoria = SOSPENSIONE
richiede_azione = true

------------------------------------
DA_VALUTARE + richiede_azione = false
------------------------------------

Usa questa combinazione per comunicazioni
operative informative che NON rappresentano
un problema e NON richiedono intervento.

Esempi:

- registrazione completata
- conto verificato
- documenti approvati
- KYC completato
- verifica completata
- conto attivato
- prelievo eseguito correttamente
- deposito accreditato correttamente
- modifica dati completata
- comunicazione tecnica informativa
- conferma di un'operazione riuscita

Esempio:

"Registrazione completata con successo."

giudizio = DA_VALUTARE
categoria = KYC oppure ALTRO
richiede_azione = false

NON è un problema.

Esempio:

"I tuoi documenti sono stati approvati."

giudizio = DA_VALUTARE
categoria = KYC
richiede_azione = false

NON è un problema.

Esempio:

"Il prelievo è stato elaborato con successo."

giudizio = DA_VALUTARE
categoria = PRELIEVO
richiede_azione = false

NON è un problema.

==================================================
3. IGNORA
==================================================

Usa giudizio "IGNORA" per:

- pubblicità generica
- newsletter senza valore operativo
- comunicazioni commerciali generiche
- offerte non gaming
- social
- ecommerce
- banche
- Revolut
- carte di credito
- negozi
- telecomunicazioni
- viaggi
- hotel
- assicurazioni
- contenuti irrilevanti
- codici OTP
- codici temporanei di accesso
- codici di verifica senza altra informazione utile

IMPORTANTE:

Un OTP NON è un problema di sicurezza.

Esempio:

"Codice di verifica: 943085"

giudizio = IGNORA
categoria = SICUREZZA
richiede_azione = false

NON deve diventare un problema.

==================================================
COMUNICAZIONI NON GAMING
==================================================

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

Anche se una comunicazione non gaming contiene parole come:

BONUS
CASHBACK
PREMIO
GRATIS
SCONTO

deve essere classificata IGNORA.

==================================================
PROFITTRACKER / LUCY
==================================================

Una comunicazione tecnica riguardante
ProfitTracker o Lucy può essere DA_VALUTARE.

Esempio:

"Production deployment failed for ProfitTracker"

giudizio = DA_VALUTARE
categoria = ALTRO
richiede_azione = true

NON deve essere classificata come
opportunità economica.

==================================================
PRIORITÀ
==================================================

ALTA:

Usala con parsimonia.

Per opportunità:
- promo personale o riservata con valore concreto;
- bonus/freebet/cashback importante;
- opportunità con scadenza entro 72 ore.

Per problemi:
- conto sospeso;
- conto limitato;
- conto bloccato;
- documento rifiutato con intervento necessario;
- prelievo bloccato;
- sicurezza reale del conto;
- situazione urgente.

MEDIA:

- opportunità utile ma non urgente;
- situazione operativa da verificare;
- KYC che richiede attenzione ma non urgente;
- comunicazione importante non immediata.

BASSA:

- informazione operativa senza intervento;
- comunicazione secondaria;
- contenuto da ignorare;
- OTP.

==================================================
BOOKMAKER
==================================================

Se riconosci il bookmaker o casinò,
scrivine il nome in "bookmaker".

Se non è riconoscibile usa null.

Non inventare il bookmaker.

==================================================
CATEGORIA
==================================================

Usa la categoria più precisa possibile.

Categorie economiche:

BONUS
FREEBET
CASHBACK
PROMO_DEPOSITO
PROMO_CASINO
PROMO_SLOT
PROMO_PERSONALIZZATA
RIMBORSO

Categorie operative:

KYC
LIMITAZIONE
SOSPENSIONE
PRELIEVO
DEPOSITO
SICUREZZA
SCADENZA

Altre:

NEWSLETTER
PUBBLICITA
ALTRO

IMPORTANTE:

La categoria da sola NON determina
se esiste un problema.

Per esempio:

KYC + richiede_azione false
= informazione operativa

KYC + richiede_azione true
= problema operativo

SICUREZZA + IGNORA + richiede_azione false
= normale OTP

SOSPENSIONE + DA_VALUTARE + richiede_azione true
= problema reale

==================================================
VALORI ECONOMICI
==================================================

bonus_importo:

SOLO l'importo che QUESTO conto riceve
con certezza se rispetta le condizioni.

Esempio:

"deposita 100€, ricevi 50€"
-> bonus_importo = 50

Usa null se:

- è un montepremi condiviso;
- sono premi in palio;
- è un torneo;
- è Drop & Wins;
- è un'estrazione;
- è una classifica;
- è solo un massimale;
- ci sono più bonus diversi;
- l'importo non è chiaro.

Esempio:

"100% fino a 500€"

NON scrivere bonus_importo = 500.

Metti bonus_importo = null
e descrivi il massimale nelle condizioni.

NON sommare mai bonus diversi.

==================================================
DEPOSITO RICHIESTO
==================================================

deposito_richiesto:

scrivi SOLO la ricarica/deposito necessario
per ottenere la promozione.

La puntata minima NON è un deposito.

La giocata minima NON è un deposito.

Queste informazioni vanno nelle condizioni.

==================================================
ROLLOVER
==================================================

Scrivi le condizioni di wagering/rollover
se presenti.

Se non esistono o non sono indicate usa null.

==================================================
SCADENZA
==================================================

Scrivila SEMPRE nel formato:

AAAA-MM-GG HH:mm

Usa l'ora italiana.

Calcolala partendo dalla data di ricezione
della comunicazione.

Esempi:

comunicazione ricevuta il 30/09/2026

"entro il 4 ottobre"
-> "2026-10-04 23:59"

"domani alle 21"
-> "2026-10-01 21:00"

"entro domenica"
-> "2026-10-04 23:59"

Se l'ora non è indicata usa 23:59.

Se la scadenza non esiste
o non è determinabile usa null.

==================================================
CONDIZIONI
==================================================

Scrivi un riassunto MOLTO breve
delle condizioni importanti.

Non copiare tutto il messaggio.

==================================================
MOTIVAZIONE AI
==================================================

Spiega in italiano e in modo sintetico
perché la comunicazione è:

- opportunità economica;
- comunicazione operativa;
- problema operativo;
- oppure da ignorare.

Se è un problema,
spiega chiaramente quale intervento
è richiesto.

==================================================
RICHIEDE AZIONE
==================================================

richiede_azione = true SOLO se Sergio
deve realmente fare qualcosa.

Esempi TRUE:

- depositare per ottenere un bonus;
- utilizzare una freebet prima della scadenza;
- completare una promo;
- inviare documenti;
- contattare assistenza;
- risolvere un prelievo bloccato;
- intervenire su un conto sospeso;
- completare una verifica obbligatoria.

Esempi FALSE:

- registrazione completata;
- KYC completato;
- documenti approvati;
- deposito riuscito;
- prelievo riuscito;
- OTP;
- newsletter;
- informazione senza intervento.

==================================================
REGOLA FONDAMENTALE
==================================================

Prima di rispondere chiediti:

"Questa comunicazione offre a Sergio
una concreta opportunità economica gaming?"

Se SÌ:
giudizio = UTILE.

Se NO, chiediti:

"È una comunicazione operativa importante?"

Se SÌ:
giudizio = DA_VALUTARE.

Poi chiediti:

"Sergio deve intervenire?"

Se SÌ:
richiede_azione = true.

Se NO:
richiede_azione = false.

Se non è né opportunità economica
né comunicazione operativa importante:
giudizio = IGNORA.

==================================================
COMUNICAZIONE
==================================================

Canale:
${item.canale}

Data di ricezione:
${dataRicezione}

Cliente:
${item.cliente_nome || 'non identificato'}

Mittente:
${item.mittente || '-'}

Oggetto:
${item.oggetto || '(nessun oggetto)'}

Testo:
${compactBody(item.testo_completo)}

==================================================

Rispondi esclusivamente secondo
lo schema JSON richiesto.
`
}

/* =========================================================
   CHIAMATA GROQ
   ========================================================= */

async function analyzeItem(
  item: LucyItem
) {
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
        content: buildPrompt(item),
      },
    ],

    response_format: {
      type: 'json_schema',

      json_schema: {
        name: 'lucy_message_analysis',
        strict: true,
        schema: lucySchema,
      },
    },
  }

  let lastError: Error | null =
    null

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

      return JSON.parse(content)
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

/* =========================================================
   SCADENZE ITALIANE
   ========================================================= */

const MESI:
  Record<string, number> = {
  gennaio: 1,
  gen: 1,
  febbraio: 2,
  feb: 2,
  marzo: 3,
  mar: 3,
  aprile: 4,
  apr: 4,
  maggio: 5,
  mag: 5,
  giugno: 6,
  giu: 6,
  luglio: 7,
  lug: 7,
  agosto: 8,
  ago: 8,
  settembre: 9,
  sett: 9,
  set: 9,
  ottobre: 10,
  ott: 10,
  novembre: 11,
  nov: 11,
  dicembre: 12,
  dic: 12,
}

const GIORNI:
  Record<string, number> = {
  domenica: 0,
  lunedi: 1,
  martedi: 2,
  mercoledi: 3,
  giovedi: 4,
  venerdi: 5,
  sabato: 6,
}

function romeParts(ts: number) {
  const f =
    new Intl.DateTimeFormat(
      'en-GB',
      {
        timeZone:
          'Europe/Rome',

        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit',
        hourCycle: 'h23',
      }
    )

  const p:
    Record<string, string> =
    {}

  for (
    const x of f.formatToParts(
      new Date(ts)
    )
  ) {
    p[x.type] = x.value
  }

  return {
    y: Number(p.year),
    m: Number(p.month),
    d: Number(p.day),
    h: Number(p.hour),
    mi: Number(p.minute),
  }
}

function romeToTs(
  y: number,
  m: number,
  d: number,
  h: number,
  mi: number
) {
  const voluto =
    Date.UTC(
      y,
      m - 1,
      d,
      h,
      mi
    )

  let ts = voluto

  for (
    let i = 0;
    i < 2;
    i++
  ) {
    const p =
      romeParts(ts)

    ts +=
      voluto -
      Date.UTC(
        p.y,
        p.m - 1,
        p.d,
        p.h,
        p.mi
      )
  }

  return ts
}

function giornoValido(
  y: number,
  m: number,
  d: number
) {
  if (
    m < 1 ||
    m > 12 ||
    d < 1 ||
    d > 31
  ) {
    return false
  }

  return (
    new Date(
      Date.UTC(
        y,
        m - 1,
        d
      )
    ).getUTCDate() === d
  )
}

function normalizeScadenza(
  value: unknown,
  dataComunicazione?:
    string | null
): string | null {
  if (
    value === null ||
    value === undefined
  ) {
    return null
  }

  let s =
    String(value)
      .trim()
      .toLowerCase()
      .normalize('NFD')
      .replace(
        /[\u0300-\u036f]/g,
        ''
      )

  if (!s) {
    return null
  }

  const refTs =
    dataComunicazione &&
    !Number.isNaN(
      new Date(
        dataComunicazione
      ).getTime()
    )
      ? new Date(
          dataComunicazione
        ).getTime()
      : Date.now()

  const ref =
    romeParts(refTs)

  const oggiTs =
    Date.UTC(
      ref.y,
      ref.m - 1,
      ref.d
    )

  let h = 23
  let mi = 59

  const ora =
    s.match(
      /\b(?:ore|alle)\s*(\d{1,2})(?:[:.](\d{2}))?\b/
    ) ||
    s.match(
      /\b(\d{1,2}):(\d{2})\b/
    )

  if (ora) {
    h = Number(ora[1])
    mi =
      Number(
        ora[2] || 0
      )

    s =
      s.replace(
        ora[0],
        ' '
      )
  }

  if (
    h > 23 ||
    mi > 59
  ) {
    return null
  }

  let y:
    number | null = null

  let m = 0
  let d = 0

  let r:
    RegExpMatchArray | null

  if (
    (r = s.match(
      /\b(\d{4})-(\d{1,2})-(\d{1,2})/
    ))
  ) {
    y = +r[1]
    m = +r[2]
    d = +r[3]
  } else if (
    (r = s.match(
      /\b(\d{1,2})[\/.-](\d{1,2})(?:[\/.-](\d{2,4}))?\b/
    ))
  ) {
    d = +r[1]
    m = +r[2]

    if (r[3]) {
      y =
        r[3].length === 2
          ? 2000 + +r[3]
          : +r[3]
    }
  } else if (
    (r = s.match(
      /\b(\d{1,2})\s+(?:di\s+)?([a-z]+)(?:\s+(\d{4}))?/
    )) &&
    MESI[r[2]]
  ) {
    d = +r[1]
    m = MESI[r[2]]

    if (r[3]) {
      y = +r[3]
    }
  } else if (
    /\b(dopodomani|domani|oggi|stasera|mezzanotte)\b/.test(
      s
    )
  ) {
    const piu =
      /\bdopodomani\b/.test(
        s
      )
        ? 2
        : /\bdomani\b/.test(
              s
            )
          ? 1
          : 0

    const t =
      new Date(
        oggiTs +
          piu * 86400000
      )

    y =
      t.getUTCFullYear()

    m =
      t.getUTCMonth() + 1

    d =
      t.getUTCDate()
  } else if (
    (r = s.match(
      /\b(domenica|lunedi|martedi|mercoledi|giovedi|venerdi|sabato)\b/
    ))
  ) {
    const diff =
      (
        GIORNI[r[1]] -
        new Date(
          oggiTs
        ).getUTCDay() +
        7
      ) % 7

    const t =
      new Date(
        oggiTs +
          diff * 86400000
      )

    y =
      t.getUTCFullYear()

    m =
      t.getUTCMonth() + 1

    d =
      t.getUTCDate()
  } else if (
    (r = s.match(
      /\b(?:entro\s+il|fino\s+al|il)\s+(\d{1,2})\b/
    ))
  ) {
    d = +r[1]
    m = ref.m
    y = ref.y

    if (d < ref.d) {
      m++

      if (m > 12) {
        m = 1
        y++
      }
    }
  } else {
    return null
  }

  let annoDedotto =
    false

  if (y === null) {
    y = ref.y
    annoDedotto = true
  }

  if (
    !giornoValido(
      y,
      m,
      d
    )
  ) {
    return null
  }

  let ts =
    romeToTs(
      y,
      m,
      d,
      h,
      mi
    )

  if (
    annoDedotto &&
    ts <
      refTs -
        60 * 86400000 &&
    giornoValido(
      y + 1,
      m,
      d
    )
  ) {
    ts =
      romeToTs(
        y + 1,
        m,
        d,
        h,
        mi
      )
  }

  if (
    ts <
      refTs -
        2 * 86400000 ||
    ts >
      refTs +
        400 * 86400000
  ) {
    return null
  }

  return new Date(
    ts
  ).toISOString()
}

/* =========================================================
   RECUPERO EMAIL
   ========================================================= */

async function getEmails():
  Promise<LucyItem[]> {
  const {
    data,
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
      .limit(
        EMAIL_BATCH_SIZE
      )

  if (error) {
    throw error
  }

  return (
    data || []
  ).map(mail => ({
    id: mail.id,

    canale:
      'EMAIL' as const,

    cliente_nome:
      mail.cliente_nome,

    mittente:
      mail.mittente,

    oggetto:
      mail.oggetto,

    testo_completo:
      mail.testo_completo,

    data_comunicazione:
      mail.data_mail,

    tabella:
      'lucy_mail_archive' as const,
  }))
}

/* =========================================================
   RECUPERO SMS
   ========================================================= */

async function getSms():
  Promise<LucyItem[]> {
  const {
    data,
    error,
  } =
    await supabase
      .from(
        'sms_clienti'
      )
      .select('*')
      .eq(
        'giudizio',
        'DA_ANALIZZARE'
      )
      .neq(
        'tipo',
        'OTP'
      )
      .order(
        'data_ricezione',
        {
          ascending: false,
        }
      )
      .limit(
        SMS_BATCH_SIZE
      )

  if (error) {
    throw error
  }

  return (
    data || []
  ).map(sms => ({
    id: sms.id,

    canale:
      'SMS' as const,

    cliente_nome:
      sms.cliente ||
      sms.telefono ||
      null,

    mittente:
      sms.mittente,

    oggetto:
      'SMS',

    testo_completo:
      sms.testo,

    data_comunicazione:
      sms.data_ricezione,

    tabella:
      'sms_clienti' as const,
  }))
}

/* =========================================================
   SALVATAGGIO
   ========================================================= */

async function saveResult(
  item: LucyItem,
  result: any
) {
  const now =
    new Date()
      .toISOString()

  const scadenza =
    normalizeScadenza(
      result.scadenza,
      item.data_comunicazione
    )

  const condizioni =
    result.scadenza &&
    !scadenza
      ? [
          result.condizioni,
          `Scadenza indicata: ${result.scadenza}`,
        ]
          .filter(Boolean)
          .join(' · ')
      : result.condizioni

  const { error } =
    await supabase
      .from(
        item.tabella
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

        analizzata_at:
          now,

        updated_at:
          now,
      })
      .eq(
        'id',
        item.id
      )

  if (error) {
    throw error
  }
}

/* =========================================================
   ANALISI EMAIL + SMS
   ========================================================= */

async function runAnalysis() {
  const startedAt =
    Date.now()

  const [
    emails,
    sms,
  ] =
    await Promise.all([
      getEmails(),
      getSms(),
    ])

  /*
   * Alterniamo:
   * EMAIL
   * SMS
   * EMAIL
   * SMS
   */
  const items:
    LucyItem[] = []

  const max =
    Math.max(
      emails.length,
      sms.length
    )

  for (
    let i = 0;
    i < max;
    i++
  ) {
    if (emails[i]) {
      items.push(
        emails[i]
      )
    }

    if (sms[i]) {
      items.push(
        sms[i]
      )
    }
  }

  if (
    items.length === 0
  ) {
    return {
      ok: true,

      email_trovate: 0,
      sms_trovati: 0,

      email_analizzate: 0,
      sms_analizzati: 0,

      analizzate: 0,
      errori: 0,

      risultati: [],
    }
  }

  let analizzate = 0
  let errori = 0

  let emailAnalizzate = 0
  let smsAnalizzati = 0

  const risultati:
    any[] = []

  for (
    const item of items
  ) {
    /*
     * Fermiamoci prima
     * del timeout Vercel.
     */
    if (
      Date.now() -
        startedAt >
      MAX_WORK_TIME_MS
    ) {
      console.log(
        '[Lucy AI] Stop preventivo per limite tempo'
      )

      break
    }

    try {
      const result =
        await analyzeItem(
          item
        )

      await saveResult(
        item,
        result
      )

      analizzate++

      if (
        item.canale ===
        'EMAIL'
      ) {
        emailAnalizzate++
      } else {
        smsAnalizzati++
      }

      risultati.push({
        id: item.id,
        canale:
          item.canale,
        giudizio:
          result.giudizio,
        categoria:
          result.categoria,
        bookmaker:
          result.bookmaker,
        richiede_azione:
          result.richiede_azione,
      })

      console.log(
        `[Lucy AI] OK ${item.canale} ${item.id} ${result.giudizio} ${result.categoria} azione=${result.richiede_azione} ${result.bookmaker || '-'}`
      )

      await sleep(700)
    } catch (
      error: any
    ) {
      errori++

      console.error(
        `[Lucy AI] ERRORE ${item.canale} ${item.id}`,
        error
      )

      /*
       * Il messaggio rimane
       * DA_ANALIZZARE e verrà
       * riprovato.
       */
      risultati.push({
        id: item.id,
        canale:
          item.canale,

        errore:
          error?.message ||
          String(error),
      })
    }
  }

  return {
    ok: true,

    email_trovate:
      emails.length,

    sms_trovati:
      sms.length,

    email_analizzate:
      emailAnalizzate,

    sms_analizzati:
      smsAnalizzati,

    analizzate,

    errori,

    rimaste_per_prossimo_giro:
      items.length -
      analizzate -
      errori,

    risultati,
  }
}

/* =========================================================
   GET - VERCEL CRON
   ========================================================= */

export async function GET(
  req: NextRequest
) {
  try {
    const cronSecret =
      process.env
        .CRON_SECRET

    if (cronSecret) {
      const auth =
        req.headers.get(
          'authorization'
        )

      if (
        auth !==
        `Bearer ${cronSecret}`
      ) {
        return (
          NextResponse.json(
            {
              error:
                'Unauthorized',
            },
            {
              status: 401,
            }
          )
        )
      }
    }

    const result =
      await runAnalysis()

    return (
      NextResponse.json(
        result
      )
    )
  } catch (
    error: any
  ) {
    console.error(
      '[Lucy AI] errore generale',
      error
    )

    return (
      NextResponse.json(
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
    )
  }
}
