// app/api/therundown/route.js
// V23 DIAGNOSTICA + CONVERSIONE AMERICAN -> DECIMAL
//
// Esempi:
// /api/therundown?league=Premier%20League&date=2026-09-20
// /api/therundown?league=Serie%20A&date=2026-09-20
// /api/therundown?league=La%20Liga&date=2026-09-20
// /api/therundown?catalog=1
//
// ENV Vercel:
// THERUNDOWN_API_KEY

const CACHE_TTL = 15 * 60 * 1000

const cache =
  globalThis.__therundownLucyCacheV23 ||
  new Map()

globalThis.__therundownLucyCacheV23 = cache


// ---------------------------------------------------------
// NORMALIZZAZIONE
// ---------------------------------------------------------

function norm(value) {
  return String(value || "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]/g, "")
}


// ---------------------------------------------------------
// AMERICAN -> DECIMAL
// ---------------------------------------------------------

function americanToDecimal(american) {
  const a = Number(american)

  if (!Number.isFinite(a) || a === 0) {
    return null
  }

  let decimal

  if (a > 0) {
    decimal = 1 + a / 100
  } else {
    decimal = 1 + 100 / Math.abs(a)
  }

  return Number(decimal.toFixed(3))
}


// ---------------------------------------------------------
// PARSER PREZZO
// ---------------------------------------------------------
//
// IMPORTANTE:
// TheRundown normalmente espone price come American odds.
// Se un domani restituisce esplicitamente price_decimal,
// diamo precedenza a quello.
//
// NON consideriamo più 210 come quota decimale 210.
// 210 American = 3.10 decimale.
// -115 American = 1.87 decimale.
// ---------------------------------------------------------

function getDecimalPrice(priceObj) {

  if (!priceObj) return null

  // Campo esplicitamente decimale
  const explicitDecimal =
    priceObj.price_decimal ??
    priceObj.decimal_price ??
    priceObj.decimal

  if (explicitDecimal !== undefined &&
      explicitDecimal !== null) {

    const d = Number(explicitDecimal)

    if (Number.isFinite(d) && d > 1) {
      return Number(d.toFixed(3))
    }
  }

  // Campo price TheRundown:
  // lo trattiamo come AMERICAN ODDS.
  const american =
    priceObj.price ??
    priceObj.american ??
    priceObj.american_price

  if (american === undefined ||
      american === null) {
    return null
  }

  return americanToDecimal(american)
}


// ---------------------------------------------------------
// MEDIA QUOTE
// ---------------------------------------------------------

function average(values) {

  const valid = values.filter(
    x => Number.isFinite(x) && x > 1
  )

  if (!valid.length) return null

  const result =
    valid.reduce((sum, x) => sum + x, 0) /
    valid.length

  return Number(result.toFixed(2))
}


// ---------------------------------------------------------
// ALIAS LEGHE
// ---------------------------------------------------------

const LEAGUE_ALIASES = {

  "premierleague": [
    "epl",
    "premierleague",
    "englishpremierleague"
  ],

  "epl": [
    "epl",
    "premierleague",
    "englishpremierleague"
  ],

  "seriea": [
    "seriea",
    "italianseriea",
    "italyseriea"
  ],

  "laliga": [
    "laliga",
    "spanishlaliga",
    "spainlaliga"
  ],

  "bundesliga": [
    "bundesliga",
    "germanbundesliga",
    "germanybundesliga"
  ],

  "ligue1": [
    "ligue1",
    "frenchligue1",
    "franceligue1"
  ],

  "championsleague": [
    "championsleague",
    "uefachampionsleague",
    "uefachamp",
    "ucl"
  ],

  "atp": [
    "atp",
    "tennisatp"
  ],

  "wta": [
    "wta",
    "tenniswta"
  ],

  "mls": [
    "mls",
    "majorsoccerleague"
  ],

  "worldcup": [
    "worldcup",
    "fifaworldcup"
  ]
}


// ---------------------------------------------------------
// TESTO SPORT
// ---------------------------------------------------------

function sportText(sport) {

  return norm([
    sport?.name,
    sport?.sport_name,
    sport?.league,
    sport?.abbreviation,
    sport?.code,
    sport?.key,
    sport?.description
  ]
    .filter(Boolean)
    .join(" "))
}


// ---------------------------------------------------------
// TROVA SPORT NEL CATALOGO
// ---------------------------------------------------------

function resolveSport(sports, league) {

  const requested = norm(league)

  if (!requested) return null

  const aliases =
    LEAGUE_ALIASES[requested] ||
    [requested]

  // Prima match esatto
  let found = sports.find(sport => {

    const candidates = [
      norm(sport?.name),
      norm(sport?.sport_name),
      norm(sport?.abbreviation),
      norm(sport?.code),
      norm(sport?.key)
    ]

    return candidates.some(
      c => aliases.includes(c)
    )
  })

  if (found) return found


  // Poi match parziale
  found = sports.find(sport => {

    const txt = sportText(sport)

    return aliases.some(alias =>
      txt.includes(alias) ||
      alias.includes(txt)
    )
  })

  return found || null
}


// ---------------------------------------------------------
// CATALOGO SPORTS
// ---------------------------------------------------------

async function fetchSports(apiKey) {

  const response = await fetch(
    "https://therundown.io/api/v2/sports",
    {
      headers: {
        "X-TheRundown-Key": apiKey
      },
      cache: "no-store"
    }
  )

  const json =
    await response.json().catch(() => null)

  if (!response.ok) {

    throw new Error(
      json?.message ||
      json?.error ||
      `Catalogo TheRundown HTTP ${response.status}`
    )
  }

  if (Array.isArray(json)) {
    return json
  }

  if (Array.isArray(json?.sports)) {
    return json.sports
  }

  return []
}


// ---------------------------------------------------------
// NOME PARTECIPANTE
// ---------------------------------------------------------

function participantName(participant) {

  return (
    participant?.name ||
    participant?.participant_name ||
    participant?.label ||
    participant?.value ||
    ""
  )
}


// ---------------------------------------------------------
// ESTRAZIONE PRICE ROWS
// ---------------------------------------------------------

function collectPrices(market) {

  const result = []

  if (!market) return result

  const participants =
    Array.isArray(market?.participants)
      ? market.participants
      : []

  for (const participant of participants) {

    const pName =
      participantName(participant)

    let lines = []

    if (Array.isArray(participant?.lines)) {
      lines = participant.lines
    } else if (
      participant?.lines &&
      typeof participant.lines === "object"
    ) {
      lines = Object.values(participant.lines)
    }


    // Alcuni payload possono avere prices
    // direttamente nel participant.
    if (!lines.length && participant?.prices) {

      lines = [{
        value:
          participant?.line ??
          market?.line,

        prices:
          participant.prices
      }]
    }


    for (const lineObj of lines) {

      let prices = []

      if (Array.isArray(lineObj?.prices)) {
        prices = lineObj.prices
      } else if (
        lineObj?.prices &&
        typeof lineObj.prices === "object"
      ) {
        prices = Object.values(lineObj.prices)
      }


      for (const priceObj of prices) {

        const decimal =
          getDecimalPrice(priceObj)

        if (!decimal) continue

        const rawLine =
          lineObj?.value ??
          lineObj?.line ??
          participant?.line ??
          market?.line

        const line =
          rawLine === undefined ||
          rawLine === null ||
          rawLine === ""
            ? null
            : Number(rawLine)

        result.push({

          participant: pName,

          line:
            Number.isFinite(line)
              ? line
              : null,

          decimal,

          american:
            priceObj?.price ??
            priceObj?.american ??
            priceObj?.american_price ??
            null,

          affiliate_id:
            priceObj?.affiliate_id ??
            lineObj?.affiliate_id ??
            null
        })
      }
    }
  }

  return result
}


// ---------------------------------------------------------
// TROVA TEAM HOME/AWAY
// ---------------------------------------------------------

function getTeams(event) {

  const teams =
    Array.isArray(event?.teams)
      ? event.teams
      : (
          Array.isArray(event?.participants)
            ? event.participants
            : []
        )

  let home =
    teams.find(t =>
      t?.is_home === true ||
      t?.home_away === "home" ||
      t?.side === "home"
    )

  let away =
    teams.find(t =>
      t?.is_away === true ||
      t?.home_away === "away" ||
      t?.side === "away"
    )

  if (!home) home = teams[0]
  if (!away) away = teams[1]

  return {
    home,
    away
  }
}


// ---------------------------------------------------------
// PARSE EVENTO
// ---------------------------------------------------------

function parseEvent(event) {

  const { home, away } =
    getTeams(event)

  const casa =
    home?.name ||
    home?.team_name ||
    ""

  const trasferta =
    away?.name ||
    away?.team_name ||
    ""

  const markets =
    Array.isArray(event?.markets)
      ? event.markets
      : (
          Array.isArray(event?.lines)
            ? event.lines
            : []
        )


  // MONEYLINE
  const moneyline =
    markets.find(m =>
      Number(
        m?.market_id ??
        m?.id
      ) === 1
    ) ||
    markets.find(m =>
      norm(m?.name) === "moneyline"
    )


  // TOTALS
  const totals =
    markets.find(m =>
      Number(
        m?.market_id ??
        m?.id
      ) === 3
    ) ||
    markets.find(m =>
      ["totals", "total"].includes(
        norm(m?.name)
      )
    )


  const mlPrices =
    collectPrices(moneyline)

  const totalPrices =
    collectPrices(totals)

  const homeNorm =
    norm(casa)

  const awayNorm =
    norm(trasferta)


  // HOME
  const homeOdds =
    average(
      mlPrices
        .filter(x => {

          const p =
            norm(x.participant)

          return (
            p === homeNorm ||
            p.includes(homeNorm) ||
            homeNorm.includes(p) ||
            p === "home"
          )
        })
        .map(x => x.decimal)
    )


  // AWAY
  const awayOdds =
    average(
      mlPrices
        .filter(x => {

          const p =
            norm(x.participant)

          return (
            p === awayNorm ||
            p.includes(awayNorm) ||
            awayNorm.includes(p) ||
            p === "away"
          )
        })
        .map(x => x.decimal)
    )


  // DRAW
  const drawOdds =
    average(
      mlPrices
        .filter(x => {

          const p =
            norm(x.participant)

          return (
            p === "draw" ||
            p === "tie" ||
            p === "x"
          )
        })
        .map(x => x.decimal)
    )


  // -------------------------------------------------------
  // TOTALS
  // -------------------------------------------------------

  const availableLines = [
    ...new Set(
      totalPrices
        .map(x => x.line)
        .filter(x => Number.isFinite(x))
    )
  ]


  const overUnder =
    availableLines
      .map(line => {

        const over =
          average(
            totalPrices
              .filter(x =>
                x.line === line &&
                norm(x.participant)
                  .includes("over")
              )
              .map(x => x.decimal)
          )

        const under =
          average(
            totalPrices
              .filter(x =>
                x.line === line &&
                norm(x.participant)
                  .includes("under")
              )
              .map(x => x.decimal)
          )

        return {
          linea: line,
          over,
          under
        }
      })
      .filter(x =>
        x.over &&
        x.under
      )


  return {

    event_id:
      event?.event_id ??
      event?.id ??
      null,

    sport_id:
      event?.sport_id ??
      null,

    data:
      event?.event_date ??
      event?.start_time ??
      event?.commence_time ??
      event?.scheduled ??
      null,

    casa,
    trasferta,

    quote: {

      esito_1x2: {
        "1": homeOdds,
        "X": drawOdds,
        "2": awayOdds
      },

      over_under:
        overUnder
    },


    // Diagnostica temporanea
    debug: {

      numero_mercati:
        markets.length,

      moneyline_rows:
        mlPrices.length,

      totals_rows:
        totalPrices.length,

      moneyline_raw:
        mlPrices,

      totals_raw:
        totalPrices
    }
  }
}


// ---------------------------------------------------------
// GET
// ---------------------------------------------------------

export async function GET(request) {

  const {
    searchParams
  } = new URL(request.url)


  const apiKey =
    process.env.THERUNDOWN_API_KEY


  if (!apiKey) {

    return Response.json(
      {
        ok: false,
        error:
          "THERUNDOWN_API_KEY mancante su Vercel"
      },
      {
        status: 500
      }
    )
  }


  const date =
    searchParams.get("date") ||
    new Date()
      .toISOString()
      .slice(0, 10)


  const league =
    searchParams.get("league")


  const requestedSportId =
    searchParams.get("sport_id")


  const catalogMode =
    searchParams.get("catalog") === "1"


  const force =
    searchParams.get("force") === "1"


  try {

    // -----------------------------------------------------
    // CARICA CATALOGO
    // -----------------------------------------------------

    const sports =
      await fetchSports(apiKey)


    // -----------------------------------------------------
    // SOLO CATALOGO
    // -----------------------------------------------------

    if (catalogMode) {

      return Response.json({

        ok: true,

        numero_sport:
          sports.length,

        sports:
          sports.map(s => ({

            id:
              s?.sport_id ??
              s?.id ??
              null,

            name:
              s?.name ??
              s?.sport_name ??
              null,

            abbreviation:
              s?.abbreviation ??
              s?.code ??
              null,

            raw:
              s
          }))
      })
    }


    // -----------------------------------------------------
    // RISOLVI SPORT
    // -----------------------------------------------------

    let sportId = null
    let resolvedSport = null


    if (requestedSportId) {

      sportId =
        Number(requestedSportId)

      resolvedSport =
        sports.find(s =>
          Number(
            s?.sport_id ??
            s?.id
          ) === sportId
        ) || null

    } else {

      resolvedSport =
        resolveSport(
          sports,
          league
        )

      if (resolvedSport) {

        sportId =
          Number(
            resolvedSport?.sport_id ??
            resolvedSport?.id
          )
      }
    }


    if (!sportId) {

      return Response.json(
        {

          ok: false,

          error:
            `Campionato non trovato nel catalogo TheRundown: ${league || "nessuno"}`,

          richiesta: {
            league,
            date
          },

          catalogo:
            sports.map(s => ({
              id:
                s?.sport_id ??
                s?.id,

              name:
                s?.name ??
                s?.sport_name,

              abbreviation:
                s?.abbreviation ??
                s?.code
            }))
        },
        {
          status: 404
        }
      )
    }


    // -----------------------------------------------------
    // CACHE
    // -----------------------------------------------------

    const cacheKey =
      `${sportId}|${date}`


    const cached =
      cache.get(cacheKey)


    if (
      !force &&
      cached &&
      Date.now() - cached.time < CACHE_TTL
    ) {

      return Response.json({
        ...cached.data,

        cache: {
          hit: true,
          minuti: 15
        }
      })
    }


    // -----------------------------------------------------
    // THE RUNDOWN
    // -----------------------------------------------------
    //
    // SOLO:
    // 1 = MONEYLINE
    // 3 = TOTALS
    //
    // main_line=true
    // hide_closed=true
    // -----------------------------------------------------

    const apiUrl =
      `https://therundown.io/api/v2/sports/${sportId}/events/${date}` +
      `?market_ids=1,3&main_line=true&hide_closed=true`


    const response =
      await fetch(
        apiUrl,
        {
          headers: {
            "X-TheRundown-Key":
              apiKey
          },

          cache: "no-store"
        }
      )


    const json =
      await response
        .json()
        .catch(() => null)


    if (!response.ok) {

      return Response.json(
        {

          ok: false,

          error:
            json?.message ||
            json?.error ||
            `TheRundown HTTP ${response.status}`,

          sport_id:
            sportId,

          league,

          url_chiamata:
            apiUrl,

          upstream_status:
            response.status
        },
        {
          status:
            response.status
        }
      )
    }


    const events =
      Array.isArray(json?.events)
        ? json.events
        : (
            Array.isArray(json)
              ? json
              : []
          )


    const parsed =
      events.map(parseEvent)


    // -----------------------------------------------------
    // RISPOSTA
    // -----------------------------------------------------

    const body = {

      ok: true,

      provider:
        "TheRundown",

      versione:
        "V23-diagnostic",

      richiesta: {
        league,
        date,
        sport_id:
          requestedSportId || null
      },

      sport_risolto: {

        sport_id:
          sportId,

        name:
          resolvedSport?.name ??
          resolvedSport?.sport_name ??
          null,

        abbreviation:
          resolvedSport?.abbreviation ??
          resolvedSport?.code ??
          null
      },

      data:
        date,

      eventi_trovati:
        events.length,

      eventi_con_1x2:
        parsed.filter(p =>
          p?.quote?.esito_1x2?.["1"] &&
          p?.quote?.esito_1x2?.["2"]
        ).length,

      eventi_con_totals:
        parsed.filter(p =>
          p?.quote?.over_under?.length
        ).length,

      partite:
        parsed,

      quota_api: {

        usati:
          response.headers.get(
            "x-datapoints"
          ) ||
          response.headers.get(
            "x-datapoints-used"
          ),

        remaining:
          response.headers.get(
            "x-datapoints-remaining"
          ),

        limit:
          response.headers.get(
            "x-datapoints-limit"
          ),

        monthly_remaining:
          response.headers.get(
            "x-datapoints-monthly-remaining"
          ),

        delay_seconds:
          response.headers.get(
            "x-data-delay-seconds"
          )
      },

      cache: {
        hit: false,
        minuti: 15
      },

      aggiornato_il:
        new Date().toISOString()
    }


    cache.set(
      cacheKey,
      {
        time:
          Date.now(),

        data:
          body
      }
    )


    return Response.json(body)

  } catch (error) {

    return Response.json(
      {

        ok: false,

        versione:
          "V23-diagnostic",

        error:
          error?.message ||
          "Errore sconosciuto TheRundown",

        richiesta: {
          league,
          date
        }
      },
      {
        status: 502
      }
    )
  }
}
