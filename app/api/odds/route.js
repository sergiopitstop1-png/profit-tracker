const CACHE_TTL = 15 * 60 * 1000;

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
