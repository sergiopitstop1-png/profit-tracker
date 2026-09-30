import {
  NextRequest,
  NextResponse,
} from 'next/server'

import {
  createClient,
} from '@supabase/supabase-js'

import {
  createServerClient,
} from '@supabase/ssr'


const adminSupabase =
  createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )


/*
 * =========================================================
 * AUTORIZZAZIONE
 * =========================================================
 */

async function authorize(
  req: NextRequest
) {
  const response =
    NextResponse.next()

  const supabase =
    createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        cookies: {
          get(name) {
            return req.cookies
              .get(name)?.value
          },

          set(
            name,
            value,
            options
          ) {
            response.cookies.set({
              name,
              value,
              ...options,
            })
          },

          remove(
            name,
            options
          ) {
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
  } =
    await supabase.auth
      .getSession()

  if (!session) {
    return false
  }

  const {
    data: profile,
  } =
    await supabase
      .from('user_profiles')
      .select('role')
      .eq(
        'id',
        session.user.id
      )
      .single()

  return (
    profile?.role === 'vip' ||
    profile?.role === 'admin'
  )
}


/*
 * =========================================================
 * SICUREZZA RICERCA
 * =========================================================
 */

function safeSearch(
  value: string
) {
  return value
    .replace(
      /[,%()]/g,
      ' '
    )
    .replace(
      /\s+/g,
      ' '
    )
    .trim()
}


/*
 * =========================================================
 * CATEGORIE PROBLEMI ACCOUNT
 * =========================================================
 */

const PROBLEM_CATEGORIES = [
  'KYC',
  'LIMITAZIONE',
  'SOSPENSIONE',
  'PRELIEVO',
  'DEPOSITO',
  'SICUREZZA',
  'SCADENZA',
]


/*
 * =========================================================
 * CONTATORI LUCY
 * =========================================================
 */

async function getCounters() {
  /*
   * Totale archivio
   */

  const totalQuery =
    adminSupabase
      .from(
        'lucy_mail_archive'
      )
      .select(
        'id',
        {
          count: 'exact',
          head: true,
        }
      )


  /*
   * Opportunità
   */

  const usefulQuery =
    adminSupabase
      .from(
        'lucy_mail_archive'
      )
      .select(
        'id',
        {
          count: 'exact',
          head: true,
        }
      )
      .eq(
        'giudizio',
        'UTILE'
      )


  /*
   * Da valutare
   */

  const evaluateQuery =
    adminSupabase
      .from(
        'lucy_mail_archive'
      )
      .select(
        'id',
        {
          count: 'exact',
          head: true,
        }
      )
      .eq(
        'giudizio',
        'DA_VALUTARE'
      )


  /*
   * Ignora
   */

  const ignoredQuery =
    adminSupabase
      .from(
        'lucy_mail_archive'
      )
      .select(
        'id',
        {
          count: 'exact',
          head: true,
        }
      )
      .eq(
        'giudizio',
        'IGNORA'
      )


  /*
   * Da analizzare
   */

  const pendingQuery =
    adminSupabase
      .from(
        'lucy_mail_archive'
      )
      .select(
        'id',
        {
          count: 'exact',
          head: true,
        }
      )
      .eq(
        'giudizio',
        'DA_ANALIZZARE'
      )


  /*
   * Problemi account
   *
   * Qui contiamo in base
   * alla categoria AI.
   */

  const problemsQuery =
    adminSupabase
      .from(
        'lucy_mail_archive'
      )
      .select(
        'id',
        {
          count: 'exact',
          head: true,
        }
      )
      .in(
        'categoria',
        PROBLEM_CATEGORIES
      )


  const [
    total,
    useful,
    evaluate,
    ignored,
    pending,
    problems,
  ] =
    await Promise.all([
      totalQuery,
      usefulQuery,
      evaluateQuery,
      ignoredQuery,
      pendingQuery,
      problemsQuery,
    ])


  return {
    tutte:
      total.count || 0,

    opportunita:
      useful.count || 0,

    da_valutare:
      evaluate.count || 0,

    problemi:
      problems.count || 0,

    ignora:
      ignored.count || 0,

    da_analizzare:
      pending.count || 0,
  }
}


/*
 * =========================================================
 * LETTURA ARCHIVIO
 * =========================================================
 */

export async function GET(
  req: NextRequest
) {
  if (
    !(await authorize(req))
  ) {
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
          sp.get(
            'page_size'
          ) || 50
        )
      )
    )


  const from =
    (page - 1) *
    pageSize

  const to =
    from +
    pageSize -
    1


  let q =
    adminSupabase
      .from(
        'lucy_mail_archive'
      )
      .select(
        '*',
        {
          count: 'exact',
        }
      )


  /*
   * =======================================================
   * FILTRI
   * =======================================================
   */

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

  const dal =
    sp.get('dal')

  const al =
    sp.get('al')

  /*
   * Nuovo filtro rapido
   * della dashboard Lucy.
   */

  const vista =
    sp.get('vista')


  /*
   * =======================================================
   * VISTE RAPIDE
   * =======================================================
   */

  if (
    vista ===
    'opportunita'
  ) {
    q =
      q.eq(
        'giudizio',
        'UTILE'
      )
  }


  if (
    vista ===
    'da_valutare'
  ) {
    q =
      q.eq(
        'giudizio',
        'DA_VALUTARE'
      )
  }


  if (
    vista ===
    'ignora'
  ) {
    q =
      q.eq(
        'giudizio',
        'IGNORA'
      )
  }


  if (
    vista ===
    'da_analizzare'
  ) {
    q =
      q.eq(
        'giudizio',
        'DA_ANALIZZARE'
      )
  }


  if (
    vista ===
    'problemi'
  ) {
    q =
      q.in(
        'categoria',
        PROBLEM_CATEGORIES
      )
  }


  /*
   * =======================================================
   * FILTRI MANUALI
   * =======================================================
   */

  if (cliente) {
    q =
      q.ilike(
        'cliente_nome',
        `%${safeSearch(
          cliente
        )}%`
      )
  }


  if (bookmaker) {
    q =
      q.ilike(
        'bookmaker',
        `%${safeSearch(
          bookmaker
        )}%`
      )
  }


  if (giudizio) {
    q =
      q.eq(
        'giudizio',
        giudizio
      )
  }


  if (categoria) {
    q =
      q.eq(
        'categoria',
        categoria
      )
  }


  if (priorita) {
    q =
      q.eq(
        'priorita',
        priorita
      )
  }


  if (dal) {
    q =
      q.gte(
        'data_mail',
        dal
      )
  }


  if (al) {
    q =
      q.lte(
        'data_mail',
        al
      )
  }


  if (search) {
    const s =
      safeSearch(
        search
      )

    if (s) {
      q =
        q.or(
          `oggetto.ilike.%${s}%,mittente.ilike.%${s}%,testo_completo.ilike.%${s}%`
        )
    }
  }


  /*
   * =======================================================
   * QUERY MAIL
   * =======================================================
   */

  const mailPromise =
    q
      .order(
        'data_mail',
        {
          ascending: false,
        }
      )
      .range(
        from,
        to
      )


  /*
   * Mail + contatori
   * contemporaneamente.
   */

  const [
    mailResult,
    counters,
  ] =
    await Promise.all([
      mailPromise,
      getCounters(),
    ])


  const {
    data,
    error,
    count,
  } =
    mailResult


  if (error) {
    return NextResponse.json(
      {
        error:
          error.message,
      },
      {
        status: 500,
      }
    )
  }


  return NextResponse.json({
    data,

    /*
     * Numero risultati
     * della vista/filtro corrente.
     */

    count:
      count || 0,

    /*
     * Contatori globali Lucy.
     */

    counters,

    page,

    pageSize,
  })
}


/*
 * =========================================================
 * FEEDBACK / LETTURA EMAIL
 * =========================================================
 */

export async function PATCH(
  req: NextRequest
) {
  if (
    !(await authorize(req))
  ) {
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


  const body =
    await req.json()


  const {
    id,
    feedback_utente,
    feedback_note,
    letta,
  } =
    body


  if (!id) {
    return NextResponse.json(
      {
        error:
          'id mancante',
      },
      {
        status: 400,
      }
    )
  }


  const patch:
    Record<
      string,
      unknown
    > =
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


  if (
    letta !==
    undefined
  ) {
    patch.letta =
      letta
  }


  const {
    data,
    error,
  } =
    await adminSupabase
      .from(
        'lucy_mail_archive'
      )
      .update(
        patch
      )
      .eq(
        'id',
        id
      )
      .select()
      .single()


  if (error) {
    return NextResponse.json(
      {
        error:
          error.message,
      },
      {
        status: 500,
      }
    )
  }


  return NextResponse.json(
    data
  )
}
