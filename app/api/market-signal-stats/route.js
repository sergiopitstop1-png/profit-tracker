export const dynamic = "force-dynamic";
export const revalidate = 0;

/*
============================================================
MARKET SIGNAL STATS v1.00

Legge la VIEW Supabase:
public.prop_market_signal_stats

e restituisce statistiche GLOBALI per simbolo/versione,
senza dipendere dal limite 25/100 della tabella visuale.

GET:
/api/market-signal-stats?symbol=XAUUSD
/api/market-signal-stats?symbol=XAUUSD&engine_version=V2.3-MT5-MACRO
============================================================
*/

const SUPABASE_URL =
  process.env.NEXT_PUBLIC_SUPABASE_URL ||
  process.env.SUPABASE_URL;

const SUPABASE_SERVICE_ROLE_KEY =
  process.env.SUPABASE_SERVICE_ROLE_KEY;

const STATS_VIEW =
  "prop_market_signal_stats";

const SIGNAL_TABLE =
  "prop_market_signal_log";

const DEFAULT_SYMBOL =
  "XAUUSD";


function json(data, status = 200) {
  return Response.json(data, {
    status,
    headers: {
      "Cache-Control": "no-store, no-cache, must-revalidate"
    }
  });
}


function assertEnv() {
  if (!SUPABASE_URL) {
    throw new Error("SUPABASE_URL non configurato.");
  }

  if (!SUPABASE_SERVICE_ROLE_KEY) {
    throw new Error("SUPABASE_SERVICE_ROLE_KEY non configurata.");
  }
}


function supabaseHeaders() {
  return {
    apikey: SUPABASE_SERVICE_ROLE_KEY,
    Authorization: `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`,
    "Content-Type": "application/json"
  };
}


function normalizeSymbol(value) {
  const s = String(value || DEFAULT_SYMBOL)
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, "")
    .trim();

  return s || DEFAULT_SYMBOL;
}


function num(value) {
  const n = Number(value);
  return Number.isFinite(n) ? n : 0;
}


function round(value, digits = 1) {
  const n = Number(value);

  if (!Number.isFinite(n)) {
    return null;
  }

  const p = 10 ** digits;

  return Math.round(n * p) / p;
}


function pct(wins, evaluated) {
  const e = num(evaluated);

  if (e <= 0) {
    return null;
  }

  return round(
    (num(wins) / e) * 100,
    1
  );
}


function weightedAverage(
  rows,
  valueKey,
  countKey
) {
  let sum = 0;
  let count = 0;

  for (const row of rows) {
    const value =
      Number(row?.[valueKey]);

    const n =
      num(row?.[countKey]);

    if (
      Number.isFinite(value) &&
      n > 0
    ) {
      sum += value * n;
      count += n;
    }
  }

  if (!count) {
    return null;
  }

  return round(
    sum / count,
    3
  );
}


async function readStatsRows(
  symbol,
  requestedVersion = ""
) {
  let url =
    `${SUPABASE_URL}/rest/v1/${STATS_VIEW}` +
    `?symbol=eq.${encodeURIComponent(symbol)}` +
    `&select=*`;

  if (requestedVersion) {
    url +=
      `&engine_version=eq.${encodeURIComponent(requestedVersion)}`;
  }

  const response =
    await fetch(
      url,
      {
        method: "GET",
        headers: supabaseHeaders(),
        cache: "no-store"
      }
    );

  const text =
    await response.text();

  let data = null;

  try {
    data =
      text
        ? JSON.parse(text)
        : [];
  }

  catch {
    throw new Error(
      `Market Signal Stats: risposta Supabase non JSON: ${text.slice(0, 300)}`
    );
  }

  if (!response.ok) {
    throw new Error(
      data?.message ||
      data?.error ||
      `Market Signal Stats HTTP ${response.status}`
    );
  }

  return Array.isArray(data)
    ? data
    : [];
}


async function readRecentRows(
  symbol,
  engineVersion,
  limitValue
) {
  const requested =
    String(
      limitValue || "25"
    ).toUpperCase();

  let safeLimit = 25;

  if (requested === "ALL") {
    safeLimit = 5000;
  }

  else {
    const n =
      Number(requested);

    safeLimit =
      Math.max(
        1,
        Math.min(
          Number.isFinite(n)
            ? n
            : 25,
          5000
        )
      );
  }

  let url =
    `${SUPABASE_URL}/rest/v1/${SIGNAL_TABLE}` +
    `?symbol=eq.${encodeURIComponent(symbol)}` +
    `&select=` +
    [
      "id",
      "symbol",
      "engine_version",
      "signal_source",
      "signal_m15_time",
      "entry_price",
      "forecast_direction",
      "prop_direction",
      "price_score",
      "confidence_raw",
      "signal_strength",
      "forecast_condition",
      "evaluation_status",
      "evaluated_1h_at",
      "evaluated_2h_at",
      "evaluated_3h_at",
      "direction_correct_1h",
      "direction_correct_2h",
      "direction_correct_3h",
      "mfe_atr_3h",
      "mae_atr_3h",
      "result_3h",
      "created_at"
    ].join(",") +
    `&order=signal_m15_time.desc` +
    `&limit=${safeLimit}`;

  if (engineVersion) {
    url +=
      `&engine_version=eq.${encodeURIComponent(engineVersion)}`;
  }

  const response =
    await fetch(
      url,
      {
        method: "GET",
        headers: supabaseHeaders(),
        cache: "no-store"
      }
    );

  const text =
    await response.text();

  let data = null;

  try {
    data =
      text
        ? JSON.parse(text)
        : [];
  }

  catch {
    throw new Error(
      `Market Signal Stats rows: risposta Supabase non JSON: ${text.slice(0, 300)}`
    );
  }

  if (!response.ok) {
    throw new Error(
      data?.message ||
      data?.error ||
      `Market Signal Stats rows HTTP ${response.status}`
    );
  }

  return Array.isArray(data)
    ? data
    : [];
}


function aggregate(rows) {
  const total =
    rows.reduce(
      (s, r) =>
        s +
        num(r.total_signals),
      0
    );

  const pending =
    rows.reduce(
      (s, r) =>
        s +
        num(r.pending_count),
      0
    );

  const partial =
    rows.reduce(
      (s, r) =>
        s +
        num(r.partial_count),
      0
    );

  const completed =
    rows.reduce(
      (s, r) =>
        s +
        num(r.completed_count),
      0
    );

  const evaluated1h =
    rows.reduce(
      (s, r) =>
        s +
        num(r.evaluated_1h),
      0
    );

  const wins1h =
    rows.reduce(
      (s, r) =>
        s +
        num(r.wins_1h),
      0
    );

  const evaluated2h =
    rows.reduce(
      (s, r) =>
        s +
        num(r.evaluated_2h),
      0
    );

  const wins2h =
    rows.reduce(
      (s, r) =>
        s +
        num(r.wins_2h),
      0
    );

  const evaluated3h =
    rows.reduce(
      (s, r) =>
        s +
        num(r.evaluated_3h),
      0
    );

  const wins3h =
    rows.reduce(
      (s, r) =>
        s +
        num(r.wins_3h),
      0
    );

  const directional =
    rows
      .filter(
        r =>
          ["BUY", "SELL"]
            .includes(
              String(
                r.forecast_direction ||
                ""
              )
                .toUpperCase()
            )
      )
      .reduce(
        (s, r) =>
          s +
          num(r.total_signals),
        0
      );

  const buy =
    rows
      .filter(
        r =>
          String(
            r.forecast_direction ||
            ""
          )
            .toUpperCase() ===
          "BUY"
      )
      .reduce(
        (s, r) =>
          s +
          num(r.total_signals),
        0
      );

  const sell =
    rows
      .filter(
        r =>
          String(
            r.forecast_direction ||
            ""
          )
            .toUpperCase() ===
          "SELL"
      )
      .reduce(
        (s, r) =>
          s +
          num(r.total_signals),
        0
      );

  const wait =
    rows
      .filter(
        r =>
          String(
            r.forecast_direction ||
            ""
          )
            .toUpperCase() ===
          "WAIT"
      )
      .reduce(
        (s, r) =>
          s +
          num(r.total_signals),
        0
      );

  return {
    total,
    directional,
    buy,
    sell,
    wait,
    pending,
    partial,
    completed,

    evaluated1h,
    wins1h,
    winRate1h:
      pct(
        wins1h,
        evaluated1h
      ),

    evaluated2h,
    wins2h,
    winRate2h:
      pct(
        wins2h,
        evaluated2h
      ),

    evaluated3h,
    wins3h,
    winRate3h:
      pct(
        wins3h,
        evaluated3h
      ),

    avgMfeAtr3h:
      weightedAverage(
        rows,
        "avg_mfe_atr_3h",
        "mfe_3h_count"
      ),

    avgMaeAtr3h:
      weightedAverage(
        rows,
        "avg_mae_atr_3h",
        "mae_3h_count"
      )
  };
}


function groupDirection(
  rows,
  direction
) {
  const subset =
    rows.filter(
      r =>
        String(
          r.forecast_direction ||
          ""
        )
          .toUpperCase() ===
        direction
    );

  const base =
    aggregate(
      subset
    );

  return {
    direction,

    total:
      base.total,

    evaluated3h:
      base.evaluated3h,

    wins3h:
      base.wins3h,

    winRate3h:
      base.winRate3h,

    avgMfeAtr3h:
      base.avgMfeAtr3h,

    avgMaeAtr3h:
      base.avgMaeAtr3h
  };
}


function groupConfidence(rows) {
  const order = [
    "0-49",
    "50-69",
    "70-79",
    "80-89",
    "90-100"
  ];

  return order.map(
    band => {

      const subset =
        rows.filter(
          r =>
            r.confidence_band ===
              band &&
            ["BUY", "SELL"].includes(
              String(
                r.forecast_direction ||
                ""
              )
                .toUpperCase()
            )
        );

      const base =
        aggregate(
          subset
        );

      return {
        band,

        total:
          base.total,

        evaluated1h:
          base.evaluated1h,

        winRate1h:
          base.winRate1h,

        evaluated2h:
          base.evaluated2h,

        winRate2h:
          base.winRate2h,

        evaluated3h:
          base.evaluated3h,

        winRate3h:
          base.winRate3h,

        avgMfeAtr3h:
          base.avgMfeAtr3h,

        avgMaeAtr3h:
          base.avgMaeAtr3h
      };
    }
  );
}


export async function GET(request) {
  try {
    assertEnv();

    const {
      searchParams
    } =
      new URL(
        request.url
      );

    const symbol =
      normalizeSymbol(
        searchParams.get(
          "symbol"
        ) ||
        DEFAULT_SYMBOL
      );

    const requestedVersion =
      String(
        searchParams.get(
          "engine_version"
        ) ||
        ""
      )
        .trim();


    let rows =
      await readStatsRows(
        symbol,
        requestedVersion
      );


    const versions = [
      ...new Set(
        rows
          .map(
            r =>
              String(
                r.engine_version ||
                ""
              )
                .trim()
          )
          .filter(
            Boolean
          )
      )
    ]
      .sort();


    /*
      Se non viene richiesta una versione,
      usiamo automaticamente quella
      dell'ultimo segnale disponibile.
    */

    let activeVersion =
      requestedVersion ||
      "";


    if (
      !activeVersion &&
      rows.length
    ) {
      const latestRow =
        [...rows]
          .sort(
            (a, b) =>
              new Date(
                b.last_signal_at ||
                0
              ).getTime() -
              new Date(
                a.last_signal_at ||
                0
              ).getTime()
          )[0];


      activeVersion =
        String(
          latestRow
            ?.engine_version ||
          ""
        )
          .trim();


      if (
        activeVersion
      ) {
        rows =
          rows.filter(
            r =>
              String(
                r.engine_version ||
                ""
              )
                .trim() ===
              activeVersion
          );
      }
    }


    const summary =
      aggregate(
        rows
      );


    const includeRows =
      String(
        searchParams.get(
          "include_rows"
        ) ||
        "1"
      ) !==
      "0";


    const requestedLimit =
      searchParams.get(
        "limit"
      ) ||
      "25";


    const recentRows =
      includeRows
        ? await readRecentRows(
            symbol,
            activeVersion,
            requestedLimit
          )
        : [];


    return json({
      ok:
        true,

      symbol,

      engineVersion:
        activeVersion ||
        null,

      availableVersions:
        versions,

      summary,

      byDirection: {
        BUY:
          groupDirection(
            rows,
            "BUY"
          ),

        SELL:
          groupDirection(
            rows,
            "SELL"
          ),

        WAIT:
          groupDirection(
            rows,
            "WAIT"
          )
      },

      confidenceBands:
        groupConfidence(
          rows
        ),

      rows:
        recentRows,

      rowsCount:
        recentRows.length,

      requestedLimit,

      generatedAt:
        new Date()
          .toISOString()
    });
  }

  catch (error) {
    console.error(
      "Market Signal Stats GET error:",
      error
    );

    return json(
      {
        ok:
          false,

        error:
          error?.message ||
          String(
            error
          )
      },
      500
    );
  }
}
