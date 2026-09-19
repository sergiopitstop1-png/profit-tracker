export const dynamic = "force-dynamic";

const sleep = (ms) =>
  new Promise((resolve) => setTimeout(resolve, ms));

// Cache server-side: 15 minuti
const CACHE_MS = 15 * 60 * 1000;

globalThis.__therundownCache =
  globalThis.__therundownCache || new Map();

const cache = globalThis.__therundownCache;

// ---------------------------------------------------------
// AMERICAN ODDS -> DECIMAL ODDS
// ---------------------------------------------------------

function americanToDecimal(price) {
  const p = Number(price);

  if (!Number.isFinite(p)) return null;

  // Sentinel TheRundown = off board
  if (p === 0.0001) return null;

  let dec;

  if (p > 0) {
    dec = 1 + p / 100;
  } else if (p < 0) {
    dec = 1 + 100 / Math.abs(p);
  } else {
    return null;
  }

  return Number(dec.toFixed(3));
}

// ---------------------------------------------------------
// MEDIA
// ---------------------------------------------------------

function media(arr) {
  const validi = arr.filter(
    (x) => Number.isFinite(x) && x > 1
  );

  if (!validi.length) return null;

  return Number(
    (
      validi.reduce((a, b) => a + b, 0) /
      validi.length
    ).toFixed(2)
  );
}

// ---------------------------------------------------------
// ESTRAE PREZZI DECIMALI DA UNA LINE
// ---------------------------------------------------------

function estraiPrezzi(line) {
  const prices = line?.prices || {};

  return Object.entries(prices)
    .map(([affiliateId, p]) => {
      const quota = americanToDecimal(p?.price);

      if (!quota) return null;

      // Se disponibile, teniamo solo main line
      if (p?.is_main_line === false) return null;

      return {
        affiliate_id: Number(affiliateId),
        quota,
        updated_at: p?.updated_at || null,
      };
    })
    .filter(Boolean);
}

// ---------------------------------------------------------
// MONEYLINE -> 1 X 2
// ---------------------------------------------------------

function parseMoneyline(market, evento) {
  if (!market) return null;

  const teams = evento?.teams || [];

  const homeTeam = teams.find(
    (t) => t.is_home === true
  );

  const awayTeam = teams.find(
    (t) => t.is_away === true
  );

  let q1 = [];
  let qX = [];
  let q2 = [];

  for (const participant of market.participants || []) {
    const nome = String(
      participant?.name || ""
    ).toLowerCase();

    const line = participant?.lines?.[0];

    if (!line) continue;

    const prezzi = estraiPrezzi(line).map(
      (x) => x.quota
    );

    const participantId = Number(participant?.id);

    if (
      nome === "draw" ||
      nome.includes("draw") ||
      nome === "tie"
    ) {
      qX.push(...prezzi);
    } else if (
      homeTeam &&
      participantId === Number(homeTeam.team_id)
    ) {
      q1.push(...prezzi);
    } else if (
      awayTeam &&
      participantId === Number(awayTeam.team_id)
    ) {
      q2.push(...prezzi);
    } else {
      // fallback sui nomi
      const homeName = String(
        homeTeam?.name || ""
      ).toLowerCase();

      const awayName = String(
        awayTeam?.name || ""
      ).toLowerCase();

      if (homeName && nome.includes(homeName)) {
        q1.push(...prezzi);
      }

      if (awayName && nome.includes(awayName)) {
        q2.push(...prezzi);
      }
    }
  }

  return {
    "1": media(q1),
    X: media(qX),
    "2": media(q2),
  };
}

// ---------------------------------------------------------
// TOTALS -> OVER / UNDER
// ---------------------------------------------------------

function parseTotals(market) {
  if (!market) return [];

  const risultati = {};

  for (const participant of market.participants || []) {
    const nome = String(
      participant?.name || ""
    ).toLowerCase();

    let tipo = null;

    if (nome.includes("over")) tipo = "over";
    if (nome.includes("under")) tipo = "under";

    if (!tipo) continue;

    for (const line of participant?.lines || []) {
      const valore = Number(line?.value);

      if (!Number.isFinite(valore)) continue;

      if (!risultati[valore]) {
        risultati[valore] = {
          linea: valore,
          over: [],
          under: [],
        };
      }

      const prezzi = estraiPrezzi(line).map(
        (x) => x.quota
      );

      risultati[valore][tipo].push(...prezzi);
    }
  }

  return Object.values(risultati)
    .map((r) => ({
      linea: r.linea,
      over: media(r.over),
      under: media(r.under),
    }))
    .filter(
      (r) => r.over !== null || r.under !== null
    )
    .sort((a, b) => a.linea - b.linea);
}

// ---------------------------------------------------------
// FETCH CON CONTROLLO ERRORI
// ---------------------------------------------------------

async function rundownFetch(url, apiKey) {
  const res = await fetch(url, {
    headers: {
      "X-TheRundown-Key": apiKey,
    },
    cache: "no-store",
  });

  let data;

  try {
    data = await res.json();
  } catch {
    data = null;
  }

  if (!res.ok) {
    const error = new Error(
      data?.error ||
        data?.message ||
        `TheRundown HTTP ${res.status}`
    );

    error.status = res.status;
    error.data = data;

    throw error;
  }

  return {
    data,
    headers: res.headers,
  };
}

// ---------------------------------------------------------
// ROUTE
// ---------------------------------------------------------

export async function GET(request) {
  try {
    const apiKey =
      process.env.THERUNDOWN_API_KEY;

    if (!apiKey) {
      return Response.json(
        {
          ok: false,
          error:
            "THERUNDOWN_API_KEY non configurata",
        },
        { status: 500 }
      );
    }

    const { searchParams } = new URL(request.url);

    // Default EPL
    const sportId = Number(
      searchParams.get("sport_id") || 11
    );

    // Default oggi UTC
    const data =
      searchParams.get("date") ||
      new Date().toISOString().slice(0, 10);

    const force =
      searchParams.get("force") === "1";

    const cacheKey =
      `${sportId}_${data}`;

    // -----------------------------------------------------
    // CACHE
    // -----------------------------------------------------

    const cached = cache.get(cacheKey);

    if (
      !force &&
      cached &&
      Date.now() - cached.timestamp < CACHE_MS
    ) {
      return Response.json({
        ...cached.data,
        cache: {
          hit: true,
          minuti: 15,
          salvato_il: new Date(
            cached.timestamp
          ).toISOString(),
        },
      });
    }

    // -----------------------------------------------------
    // 1. EVENTI + MERCATI 1 E 3
    // -----------------------------------------------------

    const url =
      `https://therundown.io/api/v2/sports/${sportId}/events/${data}` +
      `?market_ids=1,3` +
      `&main_line=true` +
      `&hide_closed=true`;

    const risultato =
      await rundownFetch(url, apiKey);

    const eventi =
      risultato.data?.events || [];

    // -----------------------------------------------------
    // TRASFORMA RISPOSTA
    // -----------------------------------------------------

    const partite = eventi
      .filter(
        (e) =>
          e.event_status !==
          "STATUS_FULL_TIME"
      )
      .map((evento) => {
        const teams =
          evento?.teams || [];

        const home =
          teams.find(
            (t) => t.is_home === true
          ) || null;

        const away =
          teams.find(
            (t) => t.is_away === true
          ) || null;

        const moneyline =
          evento?.markets?.find(
            (m) =>
              Number(m.market_id) === 1
          );

        const totals =
          evento?.markets?.find(
            (m) =>
              Number(m.market_id) === 3
          );

        return {
          event_id: evento.event_id,

          sport_id: evento.sport_id,

          data: evento.event_date,

          stato: evento.event_status,

          casa: home?.name || null,

          trasferta: away?.name || null,

          quote: {
            esito_1x2:
              parseMoneyline(
                moneyline,
                evento
              ),

            over_under:
              parseTotals(totals),
          },
        };
      });

    // -----------------------------------------------------
    // QUOTA API
    // -----------------------------------------------------

    const quotaApi = {
      usati:
        risultato.headers.get(
          "x-datapoints"
        ),

      remaining:
        risultato.headers.get(
          "x-datapoints-remaining"
        ),

      limit:
        risultato.headers.get(
          "x-datapoints-limit"
        ),

      monthly_remaining:
        risultato.headers.get(
          "x-datapoints-monthly-remaining"
        ),

      delay_seconds:
        risultato.headers.get(
          "x-data-delay-seconds"
        ),
    };

    const risposta = {
      ok: true,

      provider: "TheRundown",

      sport_id: sportId,

      data,

      numero_partite: partite.length,

      partite,

      quota_api: quotaApi,

      aggiornato_il:
        new Date().toISOString(),
    };

    // -----------------------------------------------------
    // SALVA CACHE
    // -----------------------------------------------------

    cache.set(cacheKey, {
      timestamp: Date.now(),
      data: risposta,
    });

    return Response.json({
      ...risposta,

      cache: {
        hit: false,
        minuti: 15,
      },
    });
  } catch (error) {
    return Response.json(
      {
        ok: false,

        error:
          error?.message ||
          String(error),

        status:
          error?.status || 500,

        dettaglio:
          error?.data || null,
      },
      {
        status:
          error?.status || 500,
      }
    );
  }
}
