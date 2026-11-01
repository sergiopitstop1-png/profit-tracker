import {
  apiFootballKey,
  AF_LEAGUES,
  fetchEventsForLeague,
} from "../../../lib/apiFootballOdds";

const CACHE_TTL = 15 * 60 * 1000;

// 01/11/2026: le quote prematch di API-Football si aggiornano circa una volta al giorno → cache di 3 ore.
// Il parametro refresh=1 non può rifare la chiamata più spesso di una volta ogni 10 minuti (la chiave è condivisa con Hunterbet).
const CACHE_TTL_AF = 3 * 60 * 60 * 1000;
const MIN_RIFRESCO_AF = 10 * 60 * 1000;

// Mantiene la cache anche tra richieste successive
// finché l'istanza Vercel rimane attiva.
const oddsCache =
  globalThis.__profitTrackerOddsCache || new Map();

globalThis.__profitTrackerOddsCache = oddsCache;

export async function GET(request) {
  const { searchParams } = new URL(request.url);

  const endpoint =
    searchParams.get("endpoint") || "sports";

  const forceRefresh =
    searchParams.get("refresh") === "1";

  const params =
    new URLSearchParams(searchParams);

  params.delete("endpoint");
  params.delete("refresh");

  // ============================
  // API-FOOTBALL (01/11/2026)
  // Quote prematch del piano Pro, tradotte nello stesso formato di The Odds API:
  // /oggi, /pronosticatore e il digest funzionano come prima. ODDS_PROVIDER=theoddsapi per tornare a The Odds API.
  // ============================

  const afKey = apiFootballKey();
  const mLega = /^sports\/([a-z0-9_]+)\/odds$/.exec(endpoint);
  const provider = String(
    process.env.ODDS_PROVIDER || (afKey ? "apifootball" : "theoddsapi")
  ).toLowerCase();

  if (
    provider === "apifootball" &&
    afKey &&
    mLega &&
    AF_LEAGUES[mLega[1]]
  ) {
    const chiaveAF = `AF:${mLega[1]}`;
    const inCache = oddsCache.get(chiaveAF);
    const ora = Date.now();
    const eta = inCache ? ora - inCache.time : Infinity;
    const usaCache =
      inCache && (forceRefresh ? eta < MIN_RIFRESCO_AF : eta < CACHE_TTL_AF);

    if (usaCache) {
      return Response.json(inCache.data, {
        status: 200,
        headers: {
          "x-odds-source": "api-football",
          "x-odds-cache": "HIT",
          "x-odds-cache-age": String(Math.floor(eta / 1000)),
          "x-odds-events": String(inCache.data.length),
        },
      });
    }

    try {
      const { events, calls } = await fetchEventsForLeague(
        mLega[1],
        { days: 3, stats: true },
        afKey
      );

      oddsCache.set(chiaveAF, { time: ora, data: events, headers: {} });

      return Response.json(events, {
        status: 200,
        headers: {
          "x-odds-source": "api-football",
          "x-odds-cache": forceRefresh ? "REFRESH" : "MISS",
          "x-odds-cache-age": "0",
          "x-odds-events": String(events.length),
          "x-odds-af-calls": String(calls),
        },
      });
    } catch (e) {
      // senza la chiave di The Odds API non c'è una riserva: errore chiaro
      if (!process.env.ODDS_API_KEY) {
        return Response.json(
          {
            error: e?.message || "Errore API-Football",
            endpoint,
            source: "api-football",
          },
          { status: 502 }
        );
      }
      // altrimenti si prosegue con The Odds API (riserva)
    }
  }

  // Controllo API KEY
  if (!process.env.ODDS_API_KEY) {
    return Response.json(
      {
        error:
          "ODDS_API_KEY mancante su Vercel",
      },
      {
        status: 500,
      }
    );
  }

  params.set(
    "apiKey",
    process.env.ODDS_API_KEY
  );

  // Chiave univoca della cache
  const cacheKey =
    `${endpoint}?${params
      .toString()
      .replace(
        process.env.ODDS_API_KEY,
        "KEY"
      )}`;

  const cached =
    oddsCache.get(cacheKey);

  const now =
    Date.now();

  // ============================
  // CACHE 15 MINUTI
  // ============================

  if (
    !forceRefresh &&
    cached &&
    now - cached.time < CACHE_TTL
  ) {
    const headers =
      new Headers(cached.headers || {});

    headers.set(
      "x-odds-cache",
      "HIT"
    );

    headers.set(
      "x-odds-cache-age",
      String(
        Math.floor(
          (now - cached.time) / 1000
        )
      )
    );

    return Response.json(
      cached.data,
      {
        status: 200,
        headers,
      }
    );
  }

  // ============================
  // CHIAMATA THE ODDS API
  // ============================

  const apiUrl =
    `https://api.the-odds-api.com/v4/${endpoint}?${params.toString()}`;

  const controller =
    new AbortController();

  const timeout =
    setTimeout(
      () => controller.abort(),
      15000
    );

  try {
    const response =
      await fetch(
        apiUrl,
        {
          signal:
            controller.signal,

          cache:
            "no-store",
        }
      );

    clearTimeout(timeout);

    const data =
      await response
        .json()
        .catch(
          () => null
        );

    // ============================
    // CREDITI ODDS API
    // ============================

    const headers =
      new Headers();

    const remaining =
      response.headers.get(
        "x-requests-remaining"
      );

    const used =
      response.headers.get(
        "x-requests-used"
      );

    const last =
      response.headers.get(
        "x-requests-last"
      );

    if (remaining != null) {
      headers.set(
        "x-odds-remaining",
        remaining
      );
    }

    if (used != null) {
      headers.set(
        "x-odds-used",
        used
      );
    }

    if (last != null) {
      headers.set(
        "x-odds-last",
        last
      );
    }

    headers.set(
      "x-odds-cache",
      forceRefresh
        ? "REFRESH"
        : "MISS"
    );

    headers.set(
      "x-odds-cache-age",
      "0"
    );

    // ============================
    // ERRORE ODDS API
    // ============================

    if (!response.ok) {
      return Response.json(
        {
          error:
            data?.message ||
            data?.error ||
            `The Odds API HTTP ${response.status}`,

          code:
            data?.error_code ||
            null,

          upstreamStatus:
            response.status,

          endpoint,
        },
        {
          status:
            response.status,

          headers,
        }
      );
    }

    // ============================
    // RISPOSTA CORRETTA
    // ============================

    const cleanData =
      data ?? [];

    // Salviamo le quote in cache
    oddsCache.set(
      cacheKey,
      {
        time:
          now,

        data:
          cleanData,

        headers:
          Object.fromEntries(
            headers.entries()
          ),
      }
    );

    return Response.json(
      cleanData,
      {
        status: 200,
        headers,
      }
    );
  }

  // ============================
  // ERRORE / TIMEOUT
  // ============================

  catch (e) {
    clearTimeout(timeout);

    return Response.json(
      {
        error:
          e?.name ===
          "AbortError"
            ? "Timeout The Odds API (15s)"
            : e?.message ||
              "Errore The Odds API",

        endpoint,
      },
      {
        status: 502,
      }
    );
  }
}
