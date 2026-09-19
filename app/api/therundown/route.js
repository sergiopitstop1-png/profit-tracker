// app/api/therundown/route.js — V22
// Risolve dinamicamente league -> sport_id dal catalogo TheRundown.
// API key SOLO server-side: THERUNDOWN_API_KEY.

const CACHE_TTL = 15 * 60 * 1000
const cache = globalThis.__therundownLucyCacheV22 || new Map()
globalThis.__therundownLucyCacheV22 = cache
let catalogCache = globalThis.__therundownLucySportsV22 || null

const norm = s => String(s || '')
  .toLowerCase()
  .normalize('NFD')
  .replace(/[\u0300-\u036f]/g,'')
  .replace(/[^a-z0-9]/g,'')

const ALIASES = {
  epl: ['epl','englishpremierleague','premierleague'],
  seriea: ['seriea','italyseriea','italianseriea'],
  laliga: ['laliga','spainlaliga','spanishlaliga'],
  bundesliga: ['bundesliga','germanybundesliga','germanbundesliga'],
  ligue1: ['ligue1','franceligue1','frenchligue1'],
  championsleague: [
    'championsleague',
    'uefachampionsleague',
    'uefachamp',
    'ucl'
  ],
  worldcup: ['worldcup','fifaworldcup'],
  atp: ['atp','tennisatp'],
  wta: ['wta','tenniswta'],
  mls: ['mls','majorsoccerleague']
}

function sportText(s) {
  return norm([
    s?.name,
    s?.sport_name,
    s?.league,
    s?.abbreviation,
    s?.code,
    s?.key,
    s?.description
  ].filter(Boolean).join(' '))
}

function resolveSport(sports, league) {
  const q = norm(league)
  if (!q) return null

  const aliases = ALIASES[q] || [q]

  let hit = sports.find(s =>
    aliases.includes(norm(s?.name)) ||
    aliases.includes(norm(s?.abbreviation)) ||
    aliases.includes(norm(s?.code))
  )

  if (hit) return hit

  hit = sports.find(s =>
    aliases.some(a =>
      sportText(s).includes(a) ||
      a.includes(sportText(s))
    )
  )

  return hit || null
}

async function getSports(key) {
  if (
    catalogCache &&
    Date.now() - catalogCache.at < 6 * 60 * 60 * 1000
  ) {
    return catalogCache.data
  }

  const r = await fetch(
    'https://therundown.io/api/v2/sports',
    {
      headers: {
        'X-TheRundown-Key': key
      },
      cache: 'no-store'
    }
  )

  const j = await r.json().catch(() => null)

  if (!r.ok) {
    throw new Error(
      j?.message ||
      j?.error ||
      `Catalogo TheRundown HTTP ${r.status}`
    )
  }

  const data = Array.isArray(j)
    ? j
    : (j?.sports || [])

  catalogCache = {
    at: Date.now(),
    data
  }

  globalThis.__therundownLucySportsV22 = catalogCache

  return data
}

function decimalPrice(x) {
  const v = Number(
    x?.price_decimal ??
    x?.decimal ??
    x?.decimal_price ??
    x?.price
  )

  if (!Number.isFinite(v)) return null

  // Se arriva American odds, non lo trasformiamo alla cieca.
  return v > 1 ? v : null
}

function participantName(p) {
  return (
    p?.name ||
    p?.participant_name ||
    p?.label ||
    p?.value ||
    ''
  )
}

function collectPrices(market) {
  const out = []

  for (const p of (market?.participants || [])) {
    const pname = participantName(p)

    const lines = Array.isArray(p?.lines)
      ? p.lines
      : Object.values(p?.lines || {})

    for (const line of lines) {
      const prices = Array.isArray(line?.prices)
        ? line.prices
        : Object.values(line?.prices || {})

      for (const pr of prices) {
        const dec = decimalPrice(pr)

        if (dec) {
          out.push({
            participant: pname,
            line: Number(
              line?.value ??
              line?.line ??
              market?.line ??
              NaN
            ),
            price: dec,
            affiliate: pr?.affiliate_id
          })
        }
      }
    }
  }

  return out
}

function avg(vals) {
  const a = vals.filter(
    v => Number.isFinite(v) && v > 1
  )

  return a.length
    ? a.reduce((s, v) => s + v, 0) / a.length
    : null
}

function parseEvent(ev) {
  const teams = ev?.teams || ev?.participants || []

  const home =
    teams.find(t =>
      t?.is_home ||
      t?.home_away === 'home' ||
      t?.side === 'home'
    ) || teams[0]

  const away =
    teams.find(t =>
      t?.is_away ||
      t?.home_away === 'away' ||
      t?.side === 'away'
    ) || teams[1]

  const casa =
    home?.name ||
    home?.team_name ||
    ''

  const trasferta =
    away?.name ||
    away?.team_name ||
    ''

  const markets =
    ev?.markets ||
    ev?.lines ||
    []

  const m1 = markets.find(m =>
    Number(m?.market_id ?? m?.id) === 1 ||
    norm(m?.name) === 'moneyline'
  )

  const mt = markets.find(m =>
    Number(m?.market_id ?? m?.id) === 3 ||
    norm(m?.name) === 'totals'
  )

  const p1 = collectPrices(m1 || {})
  const pt = collectPrices(mt || {})

  const hnorm = norm(casa)
  const anorm = norm(trasferta)

  const qh = avg(
    p1
      .filter(x =>
        norm(x.participant) === hnorm ||
        norm(x.participant).includes(hnorm) ||
        hnorm.includes(norm(x.participant))
      )
      .map(x => x.price)
  )

  const qa = avg(
    p1
      .filter(x =>
        norm(x.participant) === anorm ||
        norm(x.participant).includes(anorm) ||
        anorm.includes(norm(x.participant))
      )
      .map(x => x.price)
  )

  const qx = avg(
    p1
      .filter(x =>
        ['draw', 'tie', 'x'].includes(
          norm(x.participant)
        )
      )
      .map(x => x.price)
  )

  const lines = [
    ...new Set(
      pt
        .map(x => x.line)
        .filter(Number.isFinite)
    )
  ]

  const over_under = lines
    .map(line => ({
      linea: line,

      over: avg(
        pt
          .filter(x =>
            x.line === line &&
            norm(x.participant).includes('over')
          )
          .map(x => x.price)
      ),

      under: avg(
        pt
          .filter(x =>
            x.line === line &&
            norm(x.participant).includes('under')
          )
          .map(x => x.price)
      )
    }))
    .filter(x => x.over && x.under)

  return {
    event_id:
      ev?.event_id ||
      ev?.id,

    sport_id:
      ev?.sport_id,

    data:
      ev?.event_date ||
      ev?.start_time ||
      ev?.commence_time ||
      ev?.scheduled,

    casa,
    trasferta,

    quote: {
      esito_1x2: {
        '1': qh,
        X: qx,
        '2': qa
      },

      over_under
    }
  }
}

export async function GET(request) {
  const { searchParams } = new URL(request.url)

  const key =
    process.env.THERUNDOWN_API_KEY

  if (!key) {
    return Response.json(
      {
        ok: false,
        error:
          'THERUNDOWN_API_KEY mancante su Vercel'
      },
      { status: 500 }
    )
  }

  const date =
    searchParams.get('date') ||
    new Date().toISOString().slice(0, 10)

  const league =
    searchParams.get('league')

  let sportId =
    Number(searchParams.get('sport_id')) ||
    null

  const force =
    searchParams.get('force') === '1'

  try {
    let sport = null

    // Se ProfitTracker non passa sport_id,
    // cerchiamo automaticamente la lega
    // nel catalogo TheRundown.
    if (!sportId) {
      const sports =
        await getSports(key)

      sport =
        resolveSport(sports, league)

      if (!sport) {
        return Response.json(
          {
            ok: false,

            error:
              `Lega non trovata nel catalogo TheRundown: ${league}`,

            available: sports
              .map(s => ({
                id:
                  s.id ||
                  s.sport_id,

                name:
                  s.name ||
                  s.sport_name,

                code:
                  s.code ||
                  s.abbreviation
              }))
              .slice(0, 50)
          },
          { status: 404 }
        )
      }

      sportId =
        Number(
          sport.id ??
          sport.sport_id
        )
    }

    const ck =
      `${sportId}|${date}`

    const cached =
      cache.get(ck)

    if (
      !force &&
      cached &&
      Date.now() - cached.at < CACHE_TTL
    ) {
      return Response.json({
        ...cached.body,

        cache: {
          hit: true,
          minuti: 15
        }
      })
    }

    // Solo Moneyline + Totals.
    // main_line evita di scaricare tutte
    // le linee alternative inutilmente.
    const url =
      `https://therundown.io/api/v2/sports/${sportId}/events/${date}` +
      `?market_ids=1,3&main_line=true&hide_closed=true`

    const r = await fetch(
      url,
      {
        headers: {
          'X-TheRundown-Key': key
        },
        cache: 'no-store'
      }
    )

    const j =
      await r.json().catch(() => null)

    if (!r.ok) {
      return Response.json(
        {
          ok: false,

          error:
            j?.message ||
            j?.error ||
            `TheRundown HTTP ${r.status}`,

          sport_id: sportId,
          league
        },
        {
          status: r.status
        }
      )
    }

    const events =
      Array.isArray(j?.events)
        ? j.events
        : (
            Array.isArray(j)
              ? j
              : []
          )

    const body = {
      ok: true,

      provider:
        'TheRundown',

      sport_id:
        sportId,

      league:
        league ||
        sport?.name ||
        null,

      data:
        date,

      numero_partite:
        events.length,

      partite:
        events.map(parseEvent),

      quota_api: {
        usati:
          r.headers.get('x-datapoints-used') ||
          r.headers.get('x-datapoints'),

        remaining:
          r.headers.get('x-datapoints-remaining'),

        limit:
          r.headers.get('x-datapoints-limit'),

        monthly_remaining:
          r.headers.get(
            'x-datapoints-monthly-remaining'
          ),

        delay_seconds:
          r.headers.get(
            'x-data-delay-seconds'
          )
      },

      aggiornato_il:
        new Date().toISOString(),

      cache: {
        hit: false,
        minuti: 15
      }
    }

    cache.set(
      ck,
      {
        at: Date.now(),
        body
      }
    )

    return Response.json(body)

  } catch (e) {
    return Response.json(
      {
        ok: false,

        error:
          e?.message ||
          'Errore TheRundown',

        league,
        sport_id:
          sportId
      },
      {
        status: 502
      }
    )
  }
}
