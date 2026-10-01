import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { createServerClient } from '@supabase/ssr'

const adminSupabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
  }
)

type Canale = 'EMAIL' | 'SMS'

type UnifiedRow = {
  id: string
  source_id: string | number
  canale: Canale

  data_mail: string | null
  cliente_nome: string | null
  bookmaker: string | null
  mittente: string | null
  destinatario_originale: string | null

  oggetto: string | null
  testo_completo: string | null

  categoria: string | null
  giudizio: string | null
  priorita: string | null
  confidenza: number | null

  tipo_offerta: string | null
  bonus_importo: number | null
  deposito_richiesto: number | null
  rollover: string | null
  scadenza: string | null
  condizioni: string | null
  motivazione_ai: string | null
  richiede_azione: boolean | null

  letta: boolean | null
  archiviata: boolean

  feedback_utente: string | null
  feedback_note: string | null
}

/* =========================================================
   CATEGORIE
   ========================================================= */

const PROBLEM_CATEGORIES = [
  'KYC',
  'LIMITAZIONE',
  'SOSPENSIONE',
  'PRELIEVO',
  'DEPOSITO',
  'SICUREZZA',
  'SCADENZA',
]

/* =========================================================
   AUTORIZZAZIONE
   ========================================================= */

async function authorize(req: NextRequest) {
  const response = NextResponse.next()

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        get(name) {
          return req.cookies.get(name)?.value
        },

        set(name, value, options) {
          response.cookies.set({
            name,
            value,
            ...options,
          })
        },

        remove(name, options) {
          response.cookies.set({
            name,
            value: '',
            ...options,
          })
        },
      },
    }
  )

  const {
    data: { session },
  } = await supabase.auth.getSession()

  if (!session) {
    return false
  }

  const { data: profile } = await supabase
    .from('user_profiles')
    .select('role')
    .eq('id', session.user.id)
    .single()

  return (
    profile?.role === 'vip' ||
    profile?.role === 'admin'
  )
}

/* =========================================================
   UTILITÀ
   ========================================================= */

function normalize(value: unknown) {
  return String(value ?? '')
    .trim()
    .toLowerCase()
}

function getPeriodoStart(periodo: string | null) {
  if (!periodo || periodo === 'tutto') {
    return null
  }

  const d = new Date()

  if (periodo === '15g') {
    d.setDate(d.getDate() - 15)
    return d
  }

  if (periodo === '1m') {
    d.setMonth(d.getMonth() - 1)
    return d
  }

  if (periodo === '3m') {
    d.setMonth(d.getMonth() - 3)
    return d
  }

  return null
}

function toTime(value: string | null) {
  if (!value) return 0

  const time = new Date(value).getTime()

  return Number.isNaN(time)
    ? 0
    : time
}

/* =========================================================
   NORMALIZZAZIONE EMAIL
   ========================================================= */

function normalizeEmail(row: any): UnifiedRow {
  return {
    id: `EMAIL:${row.id}`,
    source_id: row.id,
    canale: 'EMAIL',

    data_mail: row.data_mail ?? null,
    cliente_nome: row.cliente_nome ?? null,
    bookmaker: row.bookmaker ?? null,
    mittente: row.mittente ?? null,

    destinatario_originale:
      row.destinatario_originale ?? null,

    oggetto: row.oggetto ?? null,

    testo_completo:
      row.testo_completo ?? null,

    categoria:
      row.categoria ?? null,

    giudizio:
      row.giudizio ?? null,

    priorita:
      row.priorita ?? null,

    confidenza:
      row.confidenza ?? null,

    tipo_offerta:
      row.tipo_offerta ?? null,

    bonus_importo:
      row.bonus_importo ?? null,

    deposito_richiesto:
      row.deposito_richiesto ?? null,

    rollover:
      row.rollover ?? null,

    scadenza:
      row.scadenza ?? null,

    condizioni:
      row.condizioni ?? null,

    motivazione_ai:
      row.motivazione_ai ?? null,

    richiede_azione:
      row.richiede_azione ?? false,

    letta:
      row.letta ?? false,

    archiviata:
      row.archiviata ?? false,

    feedback_utente:
      row.feedback_utente ?? null,

    feedback_note:
      row.feedback_note ?? null,
  }
}

/* =========================================================
   NORMALIZZAZIONE SMS
   ========================================================= */

function normalizeSms(row: any): UnifiedRow {
  return {
    id: `SMS:${row.id}`,
    source_id: row.id,
    canale: 'SMS',

    data_mail:
      row.data_ricezione ?? null,

    cliente_nome:
      row.cliente ??
      row.telefono ??
      null,

    bookmaker:
      row.bookmaker ?? null,

    mittente:
      row.mittente ?? null,

    destinatario_originale:
      row.telefono ?? null,

    oggetto:
      row.tipo === 'OTP'
        ? 'SMS OTP'
        : 'SMS',

    testo_completo:
      row.testo ?? null,

    categoria:
      row.categoria ?? null,

    giudizio:
      row.giudizio ?? null,

    priorita:
      row.priorita ?? null,

    confidenza:
      row.confidenza ?? null,

    tipo_offerta:
      row.tipo_offerta ?? null,

    bonus_importo:
      row.bonus_importo ?? null,

    deposito_richiesto:
      row.deposito_richiesto ?? null,

    rollover:
      row.rollover ?? null,

    scadenza:
      row.scadenza ?? null,

    condizioni:
      row.condizioni ?? null,

    motivazione_ai:
      row.motivazione_ai ?? null,

    richiede_azione:
      row.richiede_azione ?? false,

    letta:
      row.letta ?? false,

    archiviata:
      row.archiviata ?? false,

    feedback_utente:
      row.feedback_utente ?? null,

    feedback_note:
      row.feedback_note ?? null,
  }
}

/* =========================================================
   CLASSIFICAZIONE DELLA VISTA

   Ogni comunicazione NON archiviata
   appartiene a una sola vista operativa.

   Le comunicazioni archiviate appartengono
   esclusivamente alla vista "archiviate".
   ========================================================= */

type LucyBucket =
  | 'opportunita'
  | 'problemi'
  | 'da_valutare'
  | 'ignora'
  | 'da_analizzare'

function getBucket(row: UnifiedRow): LucyBucket {
  if (
    !row.giudizio ||
    row.giudizio === 'DA_ANALIZZARE'
  ) {
    return 'da_analizzare'
  }

  /*
   * IGNORA ha precedenza sui problemi.
   */
  if (row.giudizio === 'IGNORA') {
    return 'ignora'
  }

  /*
   * Problema operativo reale.
   */
  if (
    row.giudizio === 'DA_VALUTARE' &&
    row.richiede_azione === true &&
    PROBLEM_CATEGORIES.includes(
      row.categoria || ''
    )
  ) {
    return 'problemi'
  }

  /*
   * Opportunità economica.
   */
  if (row.giudizio === 'UTILE') {
    return 'opportunita'
  }

  /*
   * Comunicazione da valutare.
   */
  if (row.giudizio === 'DA_VALUTARE') {
    return 'da_valutare'
  }

  return 'da_valutare'
}

/* =========================================================
   VISTE
   ========================================================= */

function matchesVista(
  row: UnifiedRow,
  vista: string | null
) {
  /*
   * ARCHIVIATE:
   * mostra esclusivamente ciò che Sergio
   * ha deciso di archiviare.
   */
  if (vista === 'archiviate') {
    return row.archiviata === true
  }

  /*
   * Tutte le altre viste sono operative.
   * Una comunicazione archiviata NON deve
   * più comparire qui.
   */
  if (row.archiviata === true) {
    return false
  }

  /*
   * TUTTE significa tutte le comunicazioni
   * ancora operative, non quelle archiviate.
   */
  if (!vista || vista === 'tutte') {
    return true
  }

  return getBucket(row) === vista
}

/* =========================================================
   FILTRI
   ========================================================= */

function matchesFilters(
  row: UnifiedRow,
  params: {
    cliente: string | null
    bookmaker: string | null
    giudizio: string | null
    categoria: string | null
    priorita: string | null
    search: string | null
    canale: string | null
    periodoStart: Date | null
  }
) {
  const {
    cliente,
    bookmaker,
    giudizio,
    categoria,
    priorita,
    search,
    canale,
    periodoStart,
  } = params

  if (
    canale &&
    canale !== 'TUTTI' &&
    row.canale !== canale
  ) {
    return false
  }

  if (
    cliente &&
    normalize(row.cliente_nome) !==
      normalize(cliente)
  ) {
    return false
  }

  if (
    bookmaker &&
    !normalize(row.bookmaker).includes(
      normalize(bookmaker)
    ) &&
    !normalize(row.mittente).includes(
      normalize(bookmaker)
    )
  ) {
    return false
  }

  if (
    giudizio &&
    row.giudizio !== giudizio
  ) {
    return false
  }

  if (
    categoria &&
    row.categoria !== categoria
  ) {
    return false
  }

  if (
    priorita &&
    row.priorita !== priorita
  ) {
    return false
  }

  if (periodoStart) {
    const time =
      toTime(row.data_mail)

    if (
      !time ||
      time <
        periodoStart.getTime()
    ) {
      return false
    }
  }

  if (search) {
    const needle =
      normalize(search)

    const haystack = [
      row.cliente_nome,
      row.bookmaker,
      row.mittente,
      row.oggetto,
      row.testo_completo,
      row.motivazione_ai,
      row.condizioni,
    ]
      .map(normalize)
      .join(' ')

    if (
      needle &&
      !haystack.includes(needle)
    ) {
      return false
    }
  }

  return true
}

/* =========================================================
   CONTATORI OPERATIVI

   Le comunicazioni archiviate NON entrano
   nei contatori operativi.

   "archiviate" ha un contatore separato.
   ========================================================= */

function getCounters(
  rows: UnifiedRow[]
) {
  const counters = {
    tutte: 0,
    opportunita: 0,
    da_valutare: 0,
    problemi: 0,
    ignora: 0,
    da_analizzare: 0,
    archiviate: 0,
  }

  for (const row of rows) {
    if (row.archiviata) {
      counters.archiviate++
      continue
    }

    counters.tutte++

    const bucket =
      getBucket(row)

    if (bucket === 'opportunita') {
      counters.opportunita++
    } else if (bucket === 'problemi') {
      counters.problemi++
    } else if (bucket === 'da_valutare') {
      counters.da_valutare++
    } else if (bucket === 'ignora') {
      counters.ignora++
    } else if (bucket === 'da_analizzare') {
      counters.da_analizzare++
    }
  }

  return counters
}

/* =========================================================
   CLIENTI
   ========================================================= */

function getClienti(
  rows: UnifiedRow[]
) {
  return Array.from(
    new Set(
      rows
        .map(
          row =>
            row.cliente_nome?.trim()
        )
        .filter(
          (
            value
          ): value is string =>
            Boolean(value)
        )
    )
  ).sort((a, b) =>
    a.localeCompare(
      b,
      'it',
      {
        sensitivity: 'base',
      }
    )
  )
}

/* =========================================================
   CARICAMENTO EMAIL + SMS
   ========================================================= */

async function loadAll() {
  const [
    emailResult,
    smsResult,
  ] = await Promise.all([
    adminSupabase
      .from('lucy_mail_archive')
      .select('*')
      .order(
        'data_mail',
        {
          ascending: false,
        }
      )
      .limit(5000),

    adminSupabase
      .from('sms_clienti')
      .select('*')
      .order(
        'data_ricezione',
        {
          ascending: false,
        }
      )
      .limit(5000),
  ])

  if (emailResult.error) {
    throw new Error(
      `Email: ${emailResult.error.message}`
    )
  }

  if (smsResult.error) {
    throw new Error(
      `SMS: ${smsResult.error.message}`
    )
  }

  const emails =
    (emailResult.data || [])
      .map(normalizeEmail)

  const sms =
    (smsResult.data || [])
      .map(normalizeSms)

  return [
    ...emails,
    ...sms,
  ].sort(
    (a, b) =>
      toTime(b.data_mail) -
      toTime(a.data_mail)
  )
}

/* =========================================================
   GET
   ========================================================= */

export async function GET(
  req: NextRequest
) {
  if (!(await authorize(req))) {
    return NextResponse.json(
      {
        error: 'Non autorizzato',
      },
      {
        status: 401,
      }
    )
  }

  try {
    const sp =
      req.nextUrl.searchParams

    const page =
      Math.max(
        1,
        Number(
          sp.get('page') || 1
        )
      )

    const pageSize =
      Math.min(
        100,
        Math.max(
          10,
          Number(
            sp.get('page_size') ||
              50
          )
        )
      )

    const vista =
      sp.get('vista')

    const cliente =
      sp.get('cliente')

    const bookmaker =
      sp.get('bookmaker')

    const giudizio =
      sp.get('giudizio')

    const categoria =
      sp.get('categoria')

    const priorita =
      sp.get('priorita')

    const search =
      sp.get('q')

    const canale =
      sp.get('canale')

    /*
     * Default: ultimo mese.
     */
    const periodo =
      sp.get('periodo') ||
      '1m'

    const periodoStart =
      getPeriodoStart(periodo)

    const allRows =
      await loadAll()

    /*
     * CONTATORI
     *
     * Rispettano periodo e canale.
     * Le archiviate hanno un contatore separato.
     */
    const rowsForCounters =
      allRows.filter(row =>
        matchesFilters(
          row,
          {
            cliente: null,
            bookmaker: null,
            giudizio: null,
            categoria: null,
            priorita: null,
            search: null,
            canale,
            periodoStart,
          }
        )
      )

    const counters =
      getCounters(
        rowsForCounters
      )

    /*
     * Clienti per menu a tendina.
     */
    const clienti =
      getClienti(allRows)

    /*
     * FILTRI TABELLA
     */
    const filtered =
      allRows.filter(row =>
        matchesVista(
          row,
          vista
        ) &&
        matchesFilters(
          row,
          {
            cliente,
            bookmaker,
            giudizio,
            categoria,
            priorita,
            search,
            canale,
            periodoStart,
          }
        )
      )

    const count =
      filtered.length

    const from =
      (page - 1) *
      pageSize

    const data =
      filtered.slice(
        from,
        from + pageSize
      )

    return NextResponse.json({
      data,
      count,
      counters,
      clienti,
      periodo,
      page,
      pageSize,
    })
  } catch (error) {
    console.error(
      '[Lucy Archive GET]',
      error
    )

    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : 'Errore archivio Lucy',
      },
      {
        status: 500,
      }
    )
  }
}

/* =========================================================
   PATCH
   ========================================================= */

export async function PATCH(
  req: NextRequest
) {
  if (!(await authorize(req))) {
    return NextResponse.json(
      {
        error: 'Non autorizzato',
      },
      {
        status: 401,
      }
    )
  }

  try {
    const body =
      await req.json()

    const {
      id,
      source_id,
      canale,
      feedback_utente,
      feedback_note,
      letta,
      archiviata,
    } = body

    let realId =
      source_id

    let realCanale:
      Canale | null =
      canale === 'SMS'
        ? 'SMS'
        : canale === 'EMAIL'
          ? 'EMAIL'
          : null

    /*
     * ID unificato:
     * EMAIL:123
     * SMS:uuid
     */
    if (
      !realId &&
      typeof id === 'string' &&
      id.includes(':')
    ) {
      const [
        prefix,
        ...rest
      ] = id.split(':')

      realCanale =
        prefix === 'SMS'
          ? 'SMS'
          : 'EMAIL'

      realId =
        rest.join(':')
    }

    /*
     * Compatibilità con vecchio
     * archivio email.
     */
    if (
      (realId === undefined ||
        realId === null) &&
      id !== undefined &&
      id !== null
    ) {
      realId = id

      if (!realCanale) {
        realCanale = 'EMAIL'
      }
    }

    if (
      realId === undefined ||
      realId === null ||
      !realCanale
    ) {
      return NextResponse.json(
        {
          error:
            'ID o canale mancante',
        },
        {
          status: 400,
        }
      )
    }

    const patch:
      Record<string, unknown> =
      {
        updated_at:
          new Date()
            .toISOString(),
      }

    if (
      feedback_utente !==
      undefined
    ) {
      patch.feedback_utente =
        feedback_utente
    }

    if (
      feedback_note !==
      undefined
    ) {
      patch.feedback_note =
        feedback_note
    }

    if (letta !== undefined) {
      patch.letta = letta
    }

    /*
     * ARCHIVIA / RIPRISTINA
     *
     * true  = finisce nelle Archiviate
     * false = torna nelle viste operative
     */
    if (
      archiviata !== undefined
    ) {
      patch.archiviata =
        Boolean(archiviata)
    }

    const table =
      realCanale === 'SMS'
        ? 'sms_clienti'
        : 'lucy_mail_archive'

    const {
      data,
      error,
    } = await adminSupabase
      .from(table)
      .update(patch)
      .eq('id', realId)
      .select()
      .single()

    if (error) {
      console.error(
        '[Lucy Archive PATCH]',
        error
      )

      return NextResponse.json(
        {
          error: error.message,
        },
        {
          status: 500,
        }
      )
    }

    return NextResponse.json({
      ok: true,
      canale: realCanale,
      archiviata:
        data?.archiviata ??
        false,
      data,
    })
  } catch (error) {
    console.error(
      '[Lucy Archive PATCH]',
      error
    )

    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : 'Errore aggiornamento Lucy',
      },
      {
        status: 500,
      }
    )
  }
}
