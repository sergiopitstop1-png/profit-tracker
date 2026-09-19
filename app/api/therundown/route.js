// app/api/therundown/route.js
// V24 — TheRundown
//
// Correzioni:
// - ITA1 = Serie A
// - EPL = Premier League
// - UEFACHAMP = Champions League
// - UEFA Europa League
// - ATP / WTA
// - conversione American Odds -> Decimal Odds
// - cache 15 minuti
// - diagnostica catalogo
//
// ENV Vercel:
// THERUNDOWN_API_KEY


// =========================================================
// CONFIG
// =========================================================

const CACHE_TTL = 15 * 60 * 1000

const cache =
  globalThis.__therundownLucyCacheV24 ||
  new Map()

globalThis.__therundownLucyCacheV24 = cache


// =========================================================
// NORMALIZZAZIONE
// =========================================================

function norm(value) {
  return String(value || "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]/g, "")
}


// =========================================================
// AMERICAN ODDS -> DECIMAL ODDS
// =========================================================

function americanToDecimal(value) {

  const american = Number(value)

  if (
    !Number.isFinite(american) ||
    american === 0
  ) {
    return null
  }

  let decimal

  if (american > 0) {

    // +210 -> 3.10
    decimal =
      1 + american / 100

  } else {

    // -115 -> 1.87
    decimal =
      1 + 100 / Math.abs(american)
  }

  return Number(
    decimal.toFixed(3)
  )
}


// =========================================================
// ESTRAZIONE QUOTA
// =========================================================

function getDecimalPrice(priceObj) {

  if (!priceObj) return null


  // Se TheRundown fornisce esplicitamente
  // una quota decimale, usiamo quella.
  const explicitDecimal =
    priceObj?.price_decimal ??
    priceObj?.decimal_price ??
    priceObj?.decimal


  if (
    explicitDecimal !== undefined &&
    explicitDecimal !== null
  ) {

    const value =
      Number(explicitDecimal)

    if (
      Number.isFinite(value) &&
      value > 1
    ) {
      return Number(
        value.toFixed(3)
      )
    }
  }


  // Il campo "price" viene trattato
  // come American Odds.
  const american =
    priceObj?.price ??
    priceObj?.american ??
    priceObj?.american_price


  if (
    american === undefined ||
    american === null
  ) {
    return null
  }


  return americanToDecimal(
    american
  )
}


// =========================================================
// MEDIA
// =========================================================

function average(values) {

  const valid =
    values.filter(
      value =>
        Number.isFinite(value) &&
        value > 1
    )


  if (!valid.length) {
    return null
  }


  const avg =
    valid.reduce(
      (sum, value) =>
        sum + value,
      0
    ) / valid.length


  return Number(
    avg.toFixed(2)
  )
}


// =========================================================
// ALIAS LEGHE
//
// Questi comprendono i NOMI REALI che abbiamo visto
// nel catalogo restituito dal tuo account TheRundown.
// =========================================================

const LEAGUE_ALIASES = {

  // -----------------------------
  // PREMIER LEAGUE
  // TheRundown = EPL / sport 11
  // -----------------------------

  premierleague: [
    "epl",
    "premierleague",
    "englishpremierleague"
  ],

  epl: [
    "epl",
    "premierleague",
    "englishpremierleague"
  ],


  // -----------------------------
  // SERIE A
  // TheRundown = ITA1 / sport 15
  // -----------------------------

  seriea: [
    "ita1",
    "seriea",
    "italianseriea",
    "italyseriea"
  ],

  ita1: [
    "ita1",
    "seriea",
    "italianseriea",
    "italyseriea"
  ],


  // -----------------------------
  // CHAMPIONS LEAGUE
  // TheRundown = UEFACHAMP / 16
  // -----------------------------

  championsleague: [
    "uefachamp",
    "championsleague",
    "uefachampionsleague",
    "ucl"
  ],

  uefachampionsleague: [
    "uefachamp",
    "championsleague",
    "uefachampionsleague",
    "ucl"
  ],

  uefachamp: [
    "uefachamp",
    "championsleague",
    "uefachampionsleague",
    "ucl"
  ],


  // -----------------------------
  // EUROPA LEAGUE
  // TheRundown = sport 33
  // -----------------------------

  europaleague: [
    "uefaeuropaleague",
    "europaleague"
  ],

  uefaeuropaleague: [
    "uefaeuropaleague",
    "europaleague"
  ],


  // -----------------------------
  // ATP
  // TheRundown = sport 38
  // -----------------------------

  atp: [
    "atp",
    "tennisatp"
  ],


  // -----------------------------
  // WTA
  // TheRundown = sport 39
  // -----------------------------

  wta: [
    "wta",
    "tenniswta"
  ],


  // -----------------------------
  // MLS
  // -----------------------------

  mls: [
    "mls",
    "majorsoccerleague"
  ],


  // -----------------------------
  // EUROPEI
  // -----------------------------

  euro: [
    "uefaeuro",
    "euro"
  ],

  uefaeuro: [
    "uefaeuro",
    "euro"
  ],


  // -----------------------------
  // WORLD CUP
  // -----------------------------

  worldcup: [
    "fifa",
    "worldcup",
    "fifaworldcup"
  ],


  // =======================================================
  // NON PRESENTI ATTUALMENTE NEL CATALOGO
  //
  // Li lasciamo riconoscibili, ma NON inventiamo sport_id.
  // Se non esistono nel catalogo, la route restituisce 404.
  // =======================================================

  laliga: [
    "laliga",
    "spanishlaliga",
    "spainlaliga"
  ],

  bundesliga: [
    "bundesliga",
    "germanbundesliga",
    "germanybundesliga"
  ],

  ligue1: [
    "ligue1",
    "frenchligue1",
    "franceligue1"
  ]
}


// =========================================================
// TESTO COMPLETO SPORT
// =========================================================

function sportText(sport) {

  return norm(
    [
      sport?.name,
      sport?.sport_name,
      sport?.league,
      sport?.abbreviation,
      sport?.code,
      sport?.key,
      sport?.description
    ]
      .filter(Boolean)
      .join(" ")
  )
}


// =========================================================
// RISOLUZIONE LEGA -> SPORT
// =========================================================

function resolveSport(
  sports,
  requestedLeague
) {

  const requested =
    norm(requestedLeague)


  if (!requested) {
    return null
  }


  const aliases =
    LEAGUE_ALIASES[requested] ||
    [requested]


  // -------------------------------------------
  // 1. MATCH ESATTO
  // -------------------------------------------

  let found =
    sports.find(sport => {

      const candidates = [

        norm(sport?.name),

        norm(
          sport?.sport_name
        ),

        norm(
          sport?.abbreviation
        ),

        norm(
          sport?.code
        ),

        norm(
          sport?.key
        )
      ]


      return candidates.some(
        candidate =>
          aliases.includes(
            candidate
          )
      )
    })


  if (found) {
    return found
  }


  // -------------------------------------------
  // 2. MATCH PARZIALE
  // -------------------------------------------

  found =
    sports.find(sport => {

      const text =
        sportText(sport)


      return aliases.some(
        alias =>
          text.includes(alias) ||
          alias.includes(text)
      )
    })


  return found || null
}


// =========================================================
// CATALOGO SPORT
// =========================================================

async function fetchSports(apiKey) {

  const response =
    await fetch(
      "https://therundown.io/api/v2/sports",
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

    throw new Error(

      json?.message ||

      json?.error ||

      `Catalogo TheRundown HTTP ${response.status}`
    )
  }


  if (Array.isArray(json)) {
    return json
  }


  if (
    Array.isArray(
      json?.sports
    )
  ) {
    return json.sports
  }


  return []
}


// =========================================================
// NOME PARTECIPANTE
// =========================================================

function participantName(
  participant
) {

  return (

    participant?.name ||

    participant?.participant_name ||

    participant?.label ||

    participant?.value ||

    ""
  )
}


// =========================================================
// RACCOLTA QUOTE DI UN MERCATO
// =========================================================

function collectPrices(market) {

  const result = []


  if (!market) {
    return result
  }


  const participants =
    Array.isArray(
      market?.participants
    )
      ? market.participants
      : []


  for (
    const participant
    of participants
  ) {

    const pName =
      participantName(
        participant
      )


    let lines = []


    if (
      Array.isArray(
        participant?.lines
      )
    ) {

      lines =
        participant.lines

    } else if (

      participant?.lines &&

      typeof participant.lines
        === "object"

    ) {

      lines =
        Object.values(
          participant.lines
        )
    }


    // -----------------------------------------
    // Alcuni payload possono avere prices
    // direttamente sul participant
    // -----------------------------------------

    if (
      !lines.length &&
      participant?.prices
    ) {

      lines = [
        {
          value:
            participant?.line ??
            market?.line,

          prices:
            participant.prices
        }
      ]
    }


    for (
      const lineObj
      of lines
    ) {

      let prices = []


      if (
        Array.isArray(
          lineObj?.prices
        )
      ) {

        prices =
          lineObj.prices

      } else if (

        lineObj?.prices &&

        typeof lineObj.prices
          === "object"

      ) {

        prices =
          Object.values(
            lineObj.prices
          )
      }


      for (
        const priceObj
        of prices
      ) {

        const decimal =
          getDecimalPrice(
            priceObj
          )


        if (!decimal) {
          continue
        }


        const rawLine =

          lineObj?.value ??

          lineObj?.line ??

          participant?.line ??

          market?.line


        let line = null


        if (
          rawLine !== undefined &&
          rawLine !== null &&
          rawLine !== ""
        ) {

          const parsed =
            Number(rawLine)


          if (
            Number.isFinite(
              parsed
            )
          ) {

            line =
              parsed
          }
        }


        result.push({

          participant:
            pName,

          line,

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


// =========================================================
// HOME / AWAY
// =========================================================

function getTeams(event) {

  const teams =

    Array.isArray(
      event?.teams
    )

      ? event.teams

      : (

          Array.isArray(
            event?.participants
          )

            ? event.participants

            : []
        )


  let home =
    teams.find(
      team =>

        team?.is_home === true ||

        team?.home_away ===
          "home" ||

        team?.side ===
          "home"
    )


  let away =
    teams.find(
      team =>

        team?.is_away === true ||

        team?.home_away ===
          "away" ||

        team?.side ===
          "away"
    )


  if (!home) {
    home = teams[0]
  }


  if (!away) {
    away = teams[1]
  }


  return {
    home,
    away
  }
}


// =========================================================
// PARSE EVENTO
// =========================================================

function parseEvent(event) {

  const {
    home,
    away
  } =
    getTeams(event)


  const casa =

    home?.name ||

    home?.team_name ||

    ""


  const trasferta =

    away?.name ||

    away?.team_name ||

    ""


  // -------------------------------------------
  // TheRundown può restituire i mercati
  // in markets oppure lines.
  // -------------------------------------------

  const markets =

    Array.isArray(
      event?.markets
    )

      ? event.markets

      : (

          Array.isArray(
            event?.lines
          )

            ? event.lines

            : []
        )


  // =======================================================
  // MONEYLINE
  // =======================================================

  const moneyline =

    markets.find(
      market =>

        Number(

          market?.market_id ??

          market?.id

        ) === 1
    )

    ||

    markets.find(
      market =>

        norm(
          market?.name
        ) === "moneyline"
    )


  // =======================================================
  // TOTALS
  // =======================================================

  const totals =

    markets.find(
      market =>

        Number(

          market?.market_id ??

          market?.id

        ) === 3
    )

    ||

    markets.find(
      market => {

        const name =
          norm(
            market?.name
          )


        return (

          name === "totals" ||

          name === "total"
        )
      }
    )


  const moneylinePrices =
    collectPrices(
      moneyline
    )


  const totalsPrices =
    collectPrices(
      totals
    )


  const homeNorm =
    norm(casa)


  const awayNorm =
    norm(trasferta)


  // =======================================================
  // QUOTA HOME
  // =======================================================

  const quotaHome =
    average(

      moneylinePrices

        .filter(item => {

          const participant =
            norm(
              item.participant
            )


          return (

            participant ===
              homeNorm ||

            participant.includes(
              homeNorm
            ) ||

            homeNorm.includes(
              participant
            ) ||

            participant ===
              "home"
          )
        })

        .map(
          item =>
            item.decimal
        )
    )


  // =======================================================
  // QUOTA AWAY
  // =======================================================

  const quotaAway =
    average(

      moneylinePrices

        .filter(item => {

          const participant =
            norm(
              item.participant
            )


          return (

            participant ===
              awayNorm ||

            participant.includes(
              awayNorm
            ) ||

            awayNorm.includes(
              participant
            ) ||

            participant ===
              "away"
          )
        })

        .map(
          item =>
            item.decimal
        )
    )


  // =======================================================
  // QUOTA DRAW
  // =======================================================

  const quotaDraw =
    average(

      moneylinePrices

        .filter(item => {

          const participant =
            norm(
              item.participant
            )


          return (

            participant ===
              "draw" ||

            participant ===
              "tie" ||

            participant ===
              "x"
          )
        })

        .map(
          item =>
            item.decimal
        )
    )


  // =======================================================
  // TOTALS
  // =======================================================

  const availableLines = [

    ...new Set(

      totalsPrices

        .map(
          item =>
            item.line
        )

        .filter(
          value =>
            Number.isFinite(
              value
            )
        )
    )
  ]


  const overUnder =
    availableLines

      .map(line => {


        const over =
          average(

            totalsPrices

              .filter(item =>

                item.line ===
                  line &&

                norm(
                  item.participant
                ).includes(
                  "over"
                )
              )

              .map(
                item =>
                  item.decimal
              )
          )


        const under =
          average(

            totalsPrices

              .filter(item =>

                item.line ===
                  line &&

                norm(
                  item.participant
                ).includes(
                  "under"
                )
              )

              .map(
                item =>
                  item.decimal
              )
          )


        return {

          linea:
            line,

          over,

          under
        }
      })

      .filter(
        item =>
          item.over &&
          item.under
      )


  // =======================================================
  // RISULTATO EVENTO
  // =======================================================

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

        "1":
          quotaHome,

        "X":
          quotaDraw,

        "2":
          quotaAway
      },


      over_under:
        overUnder
    },


    // -------------------------------------------
    // DEBUG TEMPORANEO
    // Lo teniamo per vedere esattamente
    // cosa restituisce TheRundown.
    // -------------------------------------------

    debug: {

      numero_mercati:
        markets.length,

      moneyline_rows:
        moneylinePrices.length,

      totals_rows:
        totalsPrices.length,

      moneyline_raw:
        moneylinePrices,

      totals_raw:
        totalsPrices
    }
  }
}


// =========================================================
// API GET
// =========================================================

export async function GET(request) {

  const {
    searchParams
  } =
    new URL(
      request.url
    )


  const apiKey =
    process.env
      .THERUNDOWN_API_KEY


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

    searchParams.get(
      "date"
    )

    ||

    new Date()
      .toISOString()
      .slice(0, 10)


  const league =
    searchParams.get(
      "league"
    )


  const requestedSportId =
    searchParams.get(
      "sport_id"
    )


  const catalogMode =
    searchParams.get(
      "catalog"
    ) === "1"


  const force =
    searchParams.get(
      "force"
    ) === "1"


  try {

    // =====================================================
    // CATALOGO
    // =====================================================

    const sports =
      await fetchSports(
        apiKey
      )


    // =====================================================
    // MODALITÀ CATALOGO
    // =====================================================

    if (catalogMode) {

      return Response.json({

        ok: true,

        numero_sport:
          sports.length,

        sports:
          sports.map(
            sport => ({

              id:

                sport?.sport_id ??

                sport?.id ??

                null,


              name:

                sport?.sport_name ??

                sport?.name ??

                null,


              abbreviation:

                sport?.abbreviation ??

                sport?.code ??

                null
            })
          )
      })
    }


    // =====================================================
    // RISOLUZIONE SPORT
    // =====================================================

    let sportId =
      null


    let resolvedSport =
      null


    // -----------------------------------------------------
    // Se viene passato direttamente sport_id
    // -----------------------------------------------------

    if (requestedSportId) {

      sportId =
        Number(
          requestedSportId
        )


      resolvedSport =
        sports.find(
          sport =>

            Number(

              sport?.sport_id ??

              sport?.id

            ) === sportId
        )

        || null
    }


    // -----------------------------------------------------
    // Altrimenti risolviamo dal nome della lega
    // -----------------------------------------------------

    else {

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


    // =====================================================
    // SPORT NON TROVATO
    // =====================================================

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
            sports.map(
              sport => ({

                id:

                  sport?.sport_id ??

                  sport?.id,


                name:

                  sport?.sport_name ??

                  sport?.name
              })
            )
        },

        {
          status: 404
        }
      )
    }


    // =====================================================
    // CACHE
    // =====================================================

    const cacheKey =
      `${sportId}|${date}`


    const cached =
      cache.get(
        cacheKey
      )


    if (

      !force &&

      cached &&

      Date.now() -
        cached.time <
        CACHE_TTL

    ) {

      return Response.json({

        ...cached.data,


        cache: {

          hit:
            true,

          minuti:
            15
        }
      })
    }


    // =====================================================
    // CHIAMATA THE RUNDOWN
    //
    // market 1 = Moneyline
    // market 3 = Totals
    // =====================================================

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

          cache:
            "no-store"
        }
      )


    const json =
      await response
        .json()
        .catch(
          () => null
        )


    // =====================================================
    // ERRORE UPSTREAM
    // =====================================================

    if (!response.ok) {

      return Response.json(
        {

          ok:
            false,


          error:

            json?.message ||

            json?.error ||

            `TheRundown HTTP ${response.status}`,


          sport_id:
            sportId,


          league,


          upstream_status:
            response.status
        },

        {
          status:
            response.status
        }
      )
    }


    // =====================================================
    // EVENTI
    // =====================================================

    const events =

      Array.isArray(
        json?.events
      )

        ? json.events

        : (

            Array.isArray(
              json
            )

              ? json

              : []
          )


    const parsed =
      events.map(
        parseEvent
      )


    // =====================================================
    // RISPOSTA
    // =====================================================

    const body = {

      ok:
        true,


      provider:
        "TheRundown",


      versione:
        "V24",


      richiesta: {

        league,

        date,

        sport_id:
          requestedSportId ||
          null
      },


      sport_risolto: {

        sport_id:
          sportId,


        name:

          resolvedSport?.sport_name ??

          resolvedSport?.name ??

          null
      },


      data:
        date,


      eventi_trovati:
        events.length,


      eventi_con_1x2:

        parsed.filter(
          partita =>

            partita?.quote
              ?.esito_1x2
              ?.["1"]

            &&

            partita?.quote
              ?.esito_1x2
              ?.["2"]
        ).length,


      eventi_con_totals:

        parsed.filter(
          partita =>

            partita?.quote
              ?.over_under
              ?.length
        ).length,


      partite:
        parsed,


      quota_api: {

        usati:

          response.headers.get(
            "x-datapoints"
          )

          ||

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

        hit:
          false,

        minuti:
          15
      },


      aggiornato_il:
        new Date()
          .toISOString()
    }


    // =====================================================
    // SALVA CACHE
    // =====================================================

    cache.set(
      cacheKey,
      {

        time:
          Date.now(),

        data:
          body
      }
    )


    return Response.json(
      body
    )

  } catch (error) {

    return Response.json(
      {

        ok:
          false,


        versione:
          "V24",


        error:

          error?.message ||

          "Errore sconosciuto TheRundown",


        richiesta: {

          league,

          date,

          sport_id:
            requestedSportId ||
            null
        }
      },

      {
        status:
          502
      }
    )
  }
}
