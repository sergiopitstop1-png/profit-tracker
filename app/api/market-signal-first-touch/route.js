export const dynamic = "force-dynamic";
export const revalidate = 0;

/*
============================================================
MARKET SIGNAL FIRST TOUCH SIMULATOR v1.00
============================================================

Scopo:
- NON modifica alcun segnale
- NON esegue trading
- legge path_m15_3h già salvato
- simula TP/SL della PROP
- stabilisce quale livello viene toccato per primo
- separa i risultati in:
    TOTALE
    FORECAST WIN
    FORECAST LOSS

IMPORTANTE:
Il forecast e la PROP sono opposti.

Forecast BUY  -> PROP SELL
Forecast SELL -> PROP BUY

Se TP e SL vengono toccati nella stessa M15:
AMBIGUOUS, perché con OHLC M15 non conosciamo
l'ordine intrabar.
============================================================
*/

const SUPABASE_URL =
  process.env.NEXT_PUBLIC_SUPABASE_URL ||
  process.env.SUPABASE_URL;

const SUPABASE_SERVICE_ROLE_KEY =
  process.env.SUPABASE_SERVICE_ROLE_KEY;

const SIGNAL_TABLE = "prop_market_signal_log";
const DEFAULT_SYMBOL = "XAUUSD";


// ============================================================
// RESPONSE
// ============================================================

function json(data, status = 200) {
  return Response.json(data, {
    status,
    headers: {
      "Cache-Control": "no-store, no-cache, must-revalidate"
    }
  });
}


// ============================================================
// ENV
// ============================================================

function assertEnv() {
  if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
    throw new Error("Supabase non configurato.");
  }
}


// ============================================================
// HEADERS
// ============================================================

function supabaseHeaders() {
  return {
    apikey: SUPABASE_SERVICE_ROLE_KEY,
    Authorization: `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`,
    "Content-Type": "application/json"
  };
}


// ============================================================
// UTILITY
// ============================================================

function normalizeSymbol(value) {
  const symbol = String(value || DEFAULT_SYMBOL)
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, "")
    .trim();

  return symbol || DEFAULT_SYMBOL;
}


function finiteOrNull(value) {
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}


function normalizeDirection(value) {
  const direction = String(value || "")
    .toUpperCase()
    .trim();

  if (direction === "BUY") return "BUY";
  if (direction === "SELL") return "SELL";

  return "WAIT";
}


function normalizeBars(input) {
  if (!Array.isArray(input)) return [];

  return input
    .map(bar => ({
      t: finiteOrNull(bar?.t),
      o: finiteOrNull(bar?.o),
      h: finiteOrNull(bar?.h),
      l: finiteOrNull(bar?.l),
      c: finiteOrNull(bar?.c),
      v: finiteOrNull(bar?.v) ?? 0
    }))
    .filter(bar =>
      Number.isFinite(bar.t) &&
      Number.isFinite(bar.o) &&
      Number.isFinite(bar.h) &&
      Number.isFinite(bar.l) &&
      Number.isFinite(bar.c)
    )
    .sort((a, b) => a.t - b.t);
}


function oppositeDirection(direction) {
  if (direction === "BUY") return "SELL";
  if (direction === "SELL") return "BUY";

  return "WAIT";
}


// ============================================================
// POINT SIZE
// ============================================================

/*
XAUUSD attuale:
1000 punti MT5 = 10.00 dollari di prezzo

Quindi:
1 punto = 0.01

Lo rendiamo comunque parametrico.
*/

function pointsToPrice(points, pointSize) {
  return points * pointSize;
}


// ============================================================
// DATABASE
// ============================================================

async function getSignals(symbol, limit = 1000) {
  const safeLimit = Math.max(
    1,
    Math.min(Number(limit) || 1000, 5000)
  );

  const select = [
    "id",
    "symbol",
    "signal_m15_time",
    "entry_price",
    "forecast_direction",

    "direction_correct_1h",
    "direction_correct_2h",
    "direction_correct_3h",

    "evaluated_1h_at",
    "evaluated_2h_at",
    "evaluated_3h_at",

    "evaluation_status",
    "result_3h",

    "path_m15_3h"
  ].join(",");

  const url =
    `${SUPABASE_URL}/rest/v1/${SIGNAL_TABLE}` +
    `?symbol=eq.${encodeURIComponent(symbol)}` +
    `&forecast_direction=in.(BUY,SELL)` +
    `&path_m15_3h=not.is.null` +
    `&select=${select}` +
    `&order=signal_m15_time.asc` +
    `&limit=${safeLimit}`;

  const response = await fetch(url, {
    method: "GET",
    headers: supabaseHeaders(),
    cache: "no-store"
  });

  const text = await response.text();

  let data;

  try {
    data = text ? JSON.parse(text) : [];
  } catch {
    throw new Error(
      `Signal query non JSON: ${text.slice(0, 300)}`
    );
  }

  if (!response.ok) {
    throw new Error(
      data?.message ||
      data?.error ||
      `Signal query HTTP ${response.status}`
    );
  }

  return Array.isArray(data) ? data : [];
}


// ============================================================
// FORECAST RESULT AT HORIZON
// ============================================================

function getForecastResult(signal, hours) {
  let value = null;

  if (hours === 1) {
    value = signal.direction_correct_1h;
  }

  else if (hours === 2) {
    value = signal.direction_correct_2h;
  }

  else if (hours === 3) {
    value = signal.direction_correct_3h;
  }

  if (value === true) return "WIN";
  if (value === false) return "LOSS";

  return "PENDING";
}


// ============================================================
// PATH FOR HORIZON
// ============================================================

function getPathForHorizon(signal, hours) {
  const bars = normalizeBars(
    signal.path_m15_3h
  );

  if (!bars.length) return [];

  const signalMs =
    new Date(signal.signal_m15_time).getTime();

  if (!Number.isFinite(signalMs)) {
    return [];
  }

  const endMs =
    signalMs +
    hours * 60 * 60 * 1000;

  return bars.filter(bar =>
    bar.t > signalMs &&
    bar.t <= endMs
  );
}


// ============================================================
// LEVELS
// ============================================================

function getPropLevels({
  forecastDirection,
  entryPrice,
  tpDistance,
  slDistance
}) {
  const propDirection =
    oppositeDirection(forecastDirection);

  if (propDirection === "BUY") {
    return {
      propDirection,

      tpPrice:
        entryPrice +
        tpDistance,

      slPrice:
        entryPrice -
        slDistance
    };
  }

  if (propDirection === "SELL") {
    return {
      propDirection,

      tpPrice:
        entryPrice -
        tpDistance,

      slPrice:
        entryPrice +
        slDistance
    };
  }

  return null;
}


// ============================================================
// FIRST TOUCH
// ============================================================

function simulateFirstTouch({
  signal,
  hours,
  tpPoints,
  slPoints,
  pointSize
}) {
  const forecastDirection =
    normalizeDirection(
      signal.forecast_direction
    );

  const entryPrice =
    finiteOrNull(
      signal.entry_price
    );

  if (
    !["BUY", "SELL"].includes(forecastDirection) ||
    entryPrice === null
  ) {
    return {
      outcome: "INVALID"
    };
  }

  const path =
    getPathForHorizon(
      signal,
      hours
    );

  if (!path.length) {
    return {
      outcome: "NO_PATH"
    };
  }

  const tpDistance =
    pointsToPrice(
      tpPoints,
      pointSize
    );

  const slDistance =
    pointsToPrice(
      slPoints,
      pointSize
    );

  const levels =
    getPropLevels({
      forecastDirection,
      entryPrice,
      tpDistance,
      slDistance
    });

  if (!levels) {
    return {
      outcome: "INVALID"
    };
  }

  const {
    propDirection,
    tpPrice,
    slPrice
  } = levels;


  // ==========================================================
  // BAR PER BAR
  // ==========================================================

  for (let i = 0; i < path.length; i++) {
    const bar = path[i];

    let tpHit = false;
    let slHit = false;

    if (propDirection === "BUY") {
      tpHit =
        bar.h >= tpPrice;

      slHit =
        bar.l <= slPrice;
    }

    else if (propDirection === "SELL") {
      tpHit =
        bar.l <= tpPrice;

      slHit =
        bar.h >= slPrice;
    }


    // ========================================================
    // BOTH SAME M15
    // ========================================================

    if (tpHit && slHit) {
      return {
        outcome: "AMBIGUOUS",

        barIndex: i,

        hitTime:
          new Date(bar.t)
            .toISOString(),

        bar,

        tpPrice,
        slPrice,

        propDirection
      };
    }


    // ========================================================
    // TP FIRST
    // ========================================================

    if (tpHit) {
      return {
        outcome: "TP",

        barIndex: i,

        hitTime:
          new Date(bar.t)
            .toISOString(),

        bar,

        tpPrice,
        slPrice,

        propDirection
      };
    }


    // ========================================================
    // SL FIRST
    // ========================================================

    if (slHit) {
      return {
        outcome: "SL",

        barIndex: i,

        hitTime:
          new Date(bar.t)
            .toISOString(),

        bar,

        tpPrice,
        slPrice,

        propDirection
      };
    }
  }


  // ==========================================================
  // NEITHER
  // ==========================================================

  return {
    outcome: "NONE",

    tpPrice,
    slPrice,

    propDirection
  };
}


// ============================================================
// STAT BUCKET
// ============================================================

function createBucket() {
  return {
    signals: 0,

    tp: 0,
    sl: 0,
    none: 0,
    ambiguous: 0,

    tpPct: 0,
    slPct: 0,
    nonePct: 0,
    ambiguousPct: 0
  };
}


function addOutcome(bucket, outcome) {
  bucket.signals += 1;

  if (outcome === "TP") {
    bucket.tp += 1;
  }

  else if (outcome === "SL") {
    bucket.sl += 1;
  }

  else if (outcome === "AMBIGUOUS") {
    bucket.ambiguous += 1;
  }

  else {
    bucket.none += 1;
  }
}


function finalizeBucket(bucket) {
  const total = bucket.signals;

  if (!total) {
    return bucket;
  }

  bucket.tpPct =
    Number(
      (
        bucket.tp /
        total *
        100
      ).toFixed(1)
    );

  bucket.slPct =
    Number(
      (
        bucket.sl /
        total *
        100
      ).toFixed(1)
    );

  bucket.nonePct =
    Number(
      (
        bucket.none /
        total *
        100
      ).toFixed(1)
    );

  bucket.ambiguousPct =
    Number(
      (
        bucket.ambiguous /
        total *
        100
      ).toFixed(1)
    );

  return bucket;
}


// ============================================================
// RUN SIMULATOR
// ============================================================

async function runSimulator({
  symbol,
  hours,
  tpPoints,
  slPoints,
  pointSize,
  limit
}) {
  const signals =
    await getSignals(
      symbol,
      limit
    );

  const buckets = {
    total: createBucket(),
    win: createBucket(),
    loss: createBucket()
  };

  const rows = [];

  let skippedPending = 0;
  let skippedNoPath = 0;
  let skippedInvalid = 0;


  for (const signal of signals) {
    const forecastResult =
      getForecastResult(
        signal,
        hours
      );


    // ========================================================
    // Per confronto WIN / LOSS usiamo solo segnali
    // già valutati a quell'orizzonte.
    // ========================================================

    if (forecastResult === "PENDING") {
      skippedPending += 1;
      continue;
    }


    const simulation =
      simulateFirstTouch({
        signal,
        hours,
        tpPoints,
        slPoints,
        pointSize
      });


    if (
      simulation.outcome === "NO_PATH"
    ) {
      skippedNoPath += 1;
      continue;
    }


    if (
      simulation.outcome === "INVALID"
    ) {
      skippedInvalid += 1;
      continue;
    }


    // ========================================================
    // TOTAL
    // ========================================================

    addOutcome(
      buckets.total,
      simulation.outcome
    );


    // ========================================================
    // WIN / LOSS
    // ========================================================

    if (forecastResult === "WIN") {
      addOutcome(
        buckets.win,
        simulation.outcome
      );
    }

    else if (forecastResult === "LOSS") {
      addOutcome(
        buckets.loss,
        simulation.outcome
      );
    }


    rows.push({
      id: signal.id,

      signal_m15_time:
        signal.signal_m15_time,

      forecast_direction:
        signal.forecast_direction,

      forecast_result:
        forecastResult,

      entry_price:
        signal.entry_price,

      prop_direction:
        simulation.propDirection,

      outcome:
        simulation.outcome,

      hit_time:
        simulation.hitTime || null,

      bar_index:
        simulation.barIndex ?? null,

      tp_price:
        simulation.tpPrice ?? null,

      sl_price:
        simulation.slPrice ?? null,

      hit_bar:
        simulation.bar || null
    });
  }


  finalizeBucket(buckets.total);
  finalizeBucket(buckets.win);
  finalizeBucket(buckets.loss);


  return {
    ok: true,

    version: "1.00",

    symbol,

    configuration: {
      hours,
      tpPoints,
      slPoints,
      pointSize,

      tpPriceDistance:
        pointsToPrice(
          tpPoints,
          pointSize
        ),

      slPriceDistance:
        pointsToPrice(
          slPoints,
          pointSize
        )
    },

    sourceSignals:
      signals.length,

    analyzedSignals:
      buckets.total.signals,

    skipped: {
      pending:
        skippedPending,

      noPath:
        skippedNoPath,

      invalid:
        skippedInvalid
    },

    summary: {
      total:
        buckets.total,

      forecastWin:
        buckets.win,

      forecastLoss:
        buckets.loss
    },

    rows
  };
}


// ============================================================
// GET
// ============================================================

export async function GET(request) {
  try {
    assertEnv();

    const { searchParams } =
      new URL(request.url);


    // ========================================================
    // SYMBOL
    // ========================================================

    const symbol =
      normalizeSymbol(
        searchParams.get("symbol") ||
        DEFAULT_SYMBOL
      );


    // ========================================================
    // HOURS
    // ========================================================

    let hours =
      Number(
        searchParams.get("hours") ||
        1
      );

    if (![1, 2, 3].includes(hours)) {
      hours = 1;
    }


    // ========================================================
    // TP
    // ========================================================

    let tpPoints =
      Number(
        searchParams.get("tp") ||
        1000
      );

    if (
      !Number.isFinite(tpPoints) ||
      tpPoints <= 0
    ) {
      tpPoints = 1000;
    }


    // ========================================================
    // SL
    // ========================================================

    let slPoints =
      Number(
        searchParams.get("sl") ||
        1000
      );

    if (
      !Number.isFinite(slPoints) ||
      slPoints <= 0
    ) {
      slPoints = 1000;
    }


    // ========================================================
    // POINT SIZE
    // ========================================================

    let pointSize =
      Number(
        searchParams.get("pointSize") ||
        0.01
      );

    if (
      !Number.isFinite(pointSize) ||
      pointSize <= 0
    ) {
      pointSize = 0.01;
    }


    // ========================================================
    // LIMIT
    // ========================================================

    let limit =
      Number(
        searchParams.get("limit") ||
        1000
      );

    if (
      !Number.isFinite(limit) ||
      limit <= 0
    ) {
      limit = 1000;
    }


    return json(
      await runSimulator({
        symbol,
        hours,
        tpPoints,
        slPoints,
        pointSize,
        limit
      })
    );
  }

  catch (error) {
    console.error(
      "Market Signal First Touch GET error:",
      error
    );

    return json(
      {
        ok: false,

        version: "1.00",

        error:
          error?.message ||
          String(error)
      },
      500
    );
  }
}
