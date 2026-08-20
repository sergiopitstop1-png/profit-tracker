export const dynamic = "force-dynamic";
export const revalidate = 0;

/*
============================================================
MARKET SIGNAL EVALUATOR v1.20
+ FORECAST EVALUATION 1H / 2H / 3H
+ PROP / BROKER PATH ANALYSIS
+ FIRST TOUCH RECORDER — path_m15_3h
+ BACKFILL STORICO

NON crea segnali.
NON esegue trading.

NOVITA' v1.20:
- salva nel record del segnale le M15 successive all'entry
- conserva fino a 3 ore di percorso
- path_m15_3h diventa la base permanente per simulazioni
  TP/SL FIRST TOUCH con parametri modificabili
- backfill dei percorsi ancora recuperabili dalle 300 M15
============================================================
*/

const SUPABASE_URL =
  process.env.NEXT_PUBLIC_SUPABASE_URL ||
  process.env.SUPABASE_URL;

const SUPABASE_SERVICE_ROLE_KEY =
  process.env.SUPABASE_SERVICE_ROLE_KEY;

const SIGNAL_TABLE = "prop_market_signal_log";
const FEED_TABLE = "prop_market_feed";
const DEFAULT_SYMBOL = "XAUUSD";

const PATH_LEVELS = [20, 30, 40, 50, 60, 70];


// ============================================================
// UTILITY
// ============================================================

function json(data, status = 200) {
  return Response.json(data, {
    status,
    headers: {
      "Cache-Control": "no-store, no-cache, must-revalidate"
    }
  });
}

function assertEnv() {
  if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
    throw new Error("Supabase non configurato.");
  }
}

function supabaseHeaders(extra = {}) {
  return {
    apikey: SUPABASE_SERVICE_ROLE_KEY,
    Authorization: `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`,
    "Content-Type": "application/json",
    ...extra
  };
}

function normalizeSymbol(value) {
  const s = String(value || DEFAULT_SYMBOL)
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, "")
    .trim();

  return s || DEFAULT_SYMBOL;
}

function finiteOrNull(value) {
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}

function isoToMs(value) {
  const ms = new Date(value).getTime();
  return Number.isFinite(ms) ? ms : null;
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


// ============================================================
// FEED
// ============================================================

async function getFeed(symbol) {
  assertEnv();

  const url =
    `${SUPABASE_URL}/rest/v1/${FEED_TABLE}` +
    `?market_key=eq.${encodeURIComponent(symbol)}` +
    `&select=market_key,last_m15_time,m15,updated_at` +
    `&limit=1`;

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
      `Feed Supabase non JSON: ${text.slice(0, 300)}`
    );
  }

  if (!response.ok) {
    throw new Error(
      data?.message ||
      data?.error ||
      `Feed HTTP ${response.status}`
    );
  }

  const row =
    Array.isArray(data)
      ? data[0] || null
      : null;

  if (!row) return null;

  return {
    ...row,
    m15: normalizeBars(row.m15)
  };
}


// ============================================================
// SIGNAL SELECT
// ============================================================

const SIGNAL_SELECT = [
  "id",
  "symbol",
  "signal_m15_time",
  "entry_price",
  "atr_m15",
  "forecast_direction",

  "evaluated_1h_at",
  "evaluated_2h_at",
  "evaluated_3h_at",

  "direction_correct_1h",
  "direction_correct_2h",
  "direction_correct_3h",

  "evaluation_status",

  "prop_max_delta_1h",
  "prop_max_delta_2h",
  "prop_max_delta_3h",

  "broker_max_delta_1h",
  "broker_max_delta_2h",
  "broker_max_delta_3h",

  "prop_hit_20_at",
  "prop_hit_30_at",
  "prop_hit_40_at",
  "prop_hit_50_at",
  "prop_hit_60_at",
  "prop_hit_70_at",

  "broker_hit_20_at",
  "broker_hit_30_at",
  "broker_hit_40_at",
  "broker_hit_50_at",
  "broker_hit_60_at",
  "broker_hit_70_at",

  "path_m15_3h"
].join(",");


// ============================================================
// GET OPEN SIGNALS
// ============================================================

async function getOpenSignals(symbol, limit = 200) {
  const safeLimit = Math.max(
    1,
    Math.min(Number(limit) || 200, 500)
  );

  const url =
    `${SUPABASE_URL}/rest/v1/${SIGNAL_TABLE}` +
    `?symbol=eq.${encodeURIComponent(symbol)}` +
    `&evaluation_status=in.(PENDING,PARTIAL)` +
    `&select=${SIGNAL_SELECT}` +
    `&order=signal_m15_time.asc` +
    `&limit=${safeLimit}`;

  const response = await fetch(url, {
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
// GET BACKFILL SIGNALS
// ============================================================

async function getBackfillSignals(symbol, limit = 500) {
  const safeLimit = Math.max(
    1,
    Math.min(Number(limit) || 500, 1000)
  );

  const url =
    `${SUPABASE_URL}/rest/v1/${SIGNAL_TABLE}` +
    `?symbol=eq.${encodeURIComponent(symbol)}` +
    `&select=${SIGNAL_SELECT}` +
    `&order=signal_m15_time.asc` +
    `&limit=${safeLimit}`;

  const response = await fetch(url, {
    headers: supabaseHeaders(),
    cache: "no-store"
  });

  const text = await response.text();

  let data;

  try {
    data = text ? JSON.parse(text) : [];
  } catch {
    throw new Error(
      `Backfill query non JSON: ${text.slice(0, 300)}`
    );
  }

  if (!response.ok) {
    throw new Error(
      data?.message ||
      data?.error ||
      `Backfill query HTTP ${response.status}`
    );
  }

  const rows =
    Array.isArray(data)
      ? data
      : [];

  return rows.filter(row => {
    const direction = String(
      row?.forecast_direction || "WAIT"
    )
      .toUpperCase()
      .trim();

    if (!["BUY", "SELL"].includes(direction)) {
      return false;
    }

    const savedPath =
      normalizeBars(row?.path_m15_3h);

    return (
      row.prop_max_delta_1h == null ||
      row.prop_max_delta_2h == null ||
      row.prop_max_delta_3h == null ||

      row.broker_max_delta_1h == null ||
      row.broker_max_delta_2h == null ||
      row.broker_max_delta_3h == null ||

      savedPath.length < 12
    );
  });
}


// ============================================================
// PATCH SIGNAL
// ============================================================

async function patchSignal(id, patch) {
  const url =
    `${SUPABASE_URL}/rest/v1/${SIGNAL_TABLE}` +
    `?id=eq.${encodeURIComponent(id)}`;

  const response = await fetch(url, {
    method: "PATCH",

    headers: supabaseHeaders({
      Prefer: "return=representation"
    }),

    body: JSON.stringify(patch),

    cache: "no-store"
  });

  const text = await response.text();

  let data;

  try {
    data =
      text
        ? JSON.parse(text)
        : [];
  } catch {
    data = text;
  }

  if (!response.ok) {
    throw new Error(
      `Patch signal HTTP ${response.status}: ${
        typeof data === "string"
          ? data
          : JSON.stringify(data)
      }`
    );
  }

  return Array.isArray(data)
    ? data[0] || null
    : null;
}


// ============================================================
// PATH M15 RECORDER
// ============================================================

function buildStoredPath(
  signalMs,
  bars,
  nowMs = Date.now()
) {
  if (!Number.isFinite(signalMs)) {
    return [];
  }

  const target3h =
    signalMs +
    3 * 60 * 60 * 1000;

  const effectiveEnd =
    Math.min(
      target3h,
      nowMs
    );

  return bars
    .filter(bar =>
      bar.t > signalMs &&
      bar.t <= effectiveEnd
    )
    .map(bar => ({
      t: bar.t,
      o: bar.o,
      h: bar.h,
      l: bar.l,
      c: bar.c,
      v: bar.v ?? 0
    }))
    .sort((a, b) => a.t - b.t);
}


function sameStoredPath(a, b) {
  const aa = normalizeBars(a);
  const bb = normalizeBars(b);

  if (aa.length !== bb.length) {
    return false;
  }

  for (let i = 0; i < aa.length; i++) {
    if (
      aa[i].t !== bb[i].t ||
      aa[i].o !== bb[i].o ||
      aa[i].h !== bb[i].h ||
      aa[i].l !== bb[i].l ||
      aa[i].c !== bb[i].c
    ) {
      return false;
    }
  }

  return true;
}


// ============================================================
// WINDOW
// ============================================================

function getWindowBars(
  signalMs,
  hours,
  bars
) {
  const endMs =
    signalMs +
    hours *
    60 *
    60 *
    1000;

  const windowBars =
    bars.filter(bar =>
      bar.t > signalMs &&
      bar.t <= endMs
    );

  if (!windowBars.length) {
    return null;
  }

  const lastBar =
    windowBars[
      windowBars.length - 1
    ];

  if (lastBar.t < endMs) {
    return null;
  }

  return {
    endMs,
    bars: windowBars,
    lastBar
  };
}


// ============================================================
// FORECAST EVALUATION
// ============================================================

function evaluateWindow({
  direction,
  entryPrice,
  atr,
  signalMs,
  hours,
  bars
}) {
  const w =
    getWindowBars(
      signalMs,
      hours,
      bars
    );

  if (!w) return null;

  const {
    endMs,
    bars: windowBars,
    lastBar
  } = w;

  const high =
    Math.max(
      ...windowBars.map(b => b.h)
    );

  const low =
    Math.min(
      ...windowBars.map(b => b.l)
    );

  const finalPrice =
    lastBar.c;

  let mfe = null;
  let mae = null;
  let directionCorrect = null;

  if (direction === "BUY") {
    mfe =
      high -
      entryPrice;

    mae =
      low -
      entryPrice;

    directionCorrect =
      finalPrice >
      entryPrice;
  }

  else if (direction === "SELL") {
    mfe =
      entryPrice -
      low;

    mae =
      entryPrice -
      high;

    directionCorrect =
      finalPrice <
      entryPrice;
  }

  let mfeAtr = null;
  let maeAtr = null;

  if (
    atr !== null &&
    atr > 0
  ) {
    if (mfe !== null) {
      mfeAtr =
        mfe / atr;
    }

    if (mae !== null) {
      maeAtr =
        mae / atr;
    }
  }

  return {
    evaluatedAt:
      new Date(endMs)
        .toISOString(),

    price:
      finalPrice,

    high,
    low,
    mfe,
    mae,
    mfeAtr,
    maeAtr,
    directionCorrect,

    finalMove:
      finalPrice -
      entryPrice,

    finalMoveAtr:
      atr !== null &&
      atr > 0
        ? (
            finalPrice -
            entryPrice
          ) / atr
        : null
  };
}


// ============================================================
// RESULT 3H
// ============================================================

function buildResult3h(
  direction,
  directionCorrect
) {
  if (direction === "WAIT") {
    return "WAIT";
  }

  if (directionCorrect === true) {
    return "WIN";
  }

  if (directionCorrect === false) {
    return "LOSS";
  }

  return null;
}


// ============================================================
// PROP / BROKER PATH
// ============================================================

function directionalDelta(
  direction,
  entryPrice,
  high,
  low
) {
  if (direction === "BUY") {
    return Math.max(
      0,
      high - entryPrice
    );
  }

  if (direction === "SELL") {
    return Math.max(
      0,
      entryPrice - low
    );
  }

  return null;
}


function oppositeDirection(direction) {
  if (direction === "BUY") {
    return "SELL";
  }

  if (direction === "SELL") {
    return "BUY";
  }

  return "WAIT";
}


function levelHitInBar(
  direction,
  entryPrice,
  level,
  bar
) {
  if (direction === "BUY") {
    return (
      bar.h >=
      entryPrice + level
    );
  }

  if (direction === "SELL") {
    return (
      bar.l <=
      entryPrice - level
    );
  }

  return false;
}


function analyzePathWindow({
  forecastDirection,
  entryPrice,
  signalMs,
  hours,
  bars
}) {
  if (
    !["BUY", "SELL"].includes(
      forecastDirection
    )
  ) {
    return null;
  }

  const w =
    getWindowBars(
      signalMs,
      hours,
      bars
    );

  if (!w) return null;

  const windowBars =
    w.bars;

  const high =
    Math.max(
      ...windowBars.map(b => b.h)
    );

  const low =
    Math.min(
      ...windowBars.map(b => b.l)
    );

  const brokerDirection =
    forecastDirection;

  const propDirection =
    oppositeDirection(
      forecastDirection
    );

  return {
    propDirection,
    brokerDirection,

    propMaxDelta:
      directionalDelta(
        propDirection,
        entryPrice,
        high,
        low
      ),

    brokerMaxDelta:
      directionalDelta(
        brokerDirection,
        entryPrice,
        high,
        low
      )
  };
}


// ============================================================
// FIRST HITS LEGACY
// ============================================================

function findFirstHits({
  forecastDirection,
  entryPrice,
  signalMs,
  bars,
  hours = 3
}) {
  if (
    !["BUY", "SELL"].includes(
      forecastDirection
    )
  ) {
    return {
      prop: {},
      broker: {}
    };
  }

  const w =
    getWindowBars(
      signalMs,
      hours,
      bars
    );

  if (!w) return null;

  const propDirection =
    oppositeDirection(
      forecastDirection
    );

  const brokerDirection =
    forecastDirection;

  const prop = {};
  const broker = {};

  for (const level of PATH_LEVELS) {
    prop[level] = null;
    broker[level] = null;
  }

  for (const bar of w.bars) {
    for (const level of PATH_LEVELS) {
      if (
        !prop[level] &&
        levelHitInBar(
          propDirection,
          entryPrice,
          level,
          bar
        )
      ) {
        prop[level] =
          new Date(bar.t)
            .toISOString();
      }

      if (
        !broker[level] &&
        levelHitInBar(
          brokerDirection,
          entryPrice,
          level,
          bar
        )
      ) {
        broker[level] =
          new Date(bar.t)
            .toISOString();
      }
    }
  }

  return {
    prop,
    broker
  };
}


function appendPathHits(
  patch,
  signal,
  hits
) {
  if (!hits) return;

  for (const level of PATH_LEVELS) {
    const propKey =
      `prop_hit_${level}_at`;

    const brokerKey =
      `broker_hit_${level}_at`;

    if (
      signal?.[propKey] == null &&
      hits.prop?.[level]
    ) {
      patch[propKey] =
        hits.prop[level];
    }

    if (
      signal?.[brokerKey] == null &&
      hits.broker?.[level]
    ) {
      patch[brokerKey] =
        hits.broker[level];
    }
  }
}


// ============================================================
// EVALUATE OPEN SIGNAL
// ============================================================

async function evaluateSignal(
  signal,
  bars,
  nowMs
) {
  const signalMs =
    isoToMs(
      signal.signal_m15_time
    );

  const entryPrice =
    finiteOrNull(
      signal.entry_price
    );

  const atr =
    finiteOrNull(
      signal.atr_m15
    );

  const direction =
    String(
      signal.forecast_direction ||
      "WAIT"
    )
      .toUpperCase()
      .trim();

  if (
    signalMs === null ||
    entryPrice === null
  ) {
    return {
      id: signal.id,
      updated: false,
      reason: "INVALID_SIGNAL_DATA"
    };
  }

  const patch = {};
  let changed = false;

  const target1h =
    signalMs +
    60 * 60 * 1000;

  const target2h =
    signalMs +
    2 * 60 * 60 * 1000;

  const target3h =
    signalMs +
    3 * 60 * 60 * 1000;


  // ==========================================================
  // FIRST TOUCH RECORDER
  // ==========================================================

  if (
    ["BUY", "SELL"].includes(direction)
  ) {
    const storedPath =
      buildStoredPath(
        signalMs,
        bars,
        nowMs
      );

    if (
      storedPath.length > 0 &&
      !sameStoredPath(
        signal.path_m15_3h,
        storedPath
      )
    ) {
      patch.path_m15_3h =
        storedPath;

      changed = true;
    }
  }


  // ==========================================================
  // 1H
  // ==========================================================

  if (
    !signal.evaluated_1h_at &&
    nowMs >= target1h
  ) {
    const e1 =
      evaluateWindow({
        direction,
        entryPrice,
        atr,
        signalMs,
        hours: 1,
        bars
      });

    if (e1) {
      patch.evaluated_1h_at =
        e1.evaluatedAt;

      patch.price_1h =
        e1.price;

      patch.high_1h =
        e1.high;

      patch.low_1h =
        e1.low;

      patch.mfe_1h =
        e1.mfe;

      patch.mae_1h =
        e1.mae;

      patch.mfe_atr_1h =
        e1.mfeAtr;

      patch.mae_atr_1h =
        e1.maeAtr;

      patch.direction_correct_1h =
        e1.directionCorrect;

      const p1 =
        analyzePathWindow({
          forecastDirection:
            direction,

          entryPrice,
          signalMs,
          hours: 1,
          bars
        });

      if (p1) {
        patch.prop_max_delta_1h =
          p1.propMaxDelta;

        patch.broker_max_delta_1h =
          p1.brokerMaxDelta;
      }

      changed = true;
    }
  }


  // ==========================================================
  // 2H
  // ==========================================================

  if (
    !signal.evaluated_2h_at &&
    nowMs >= target2h
  ) {
    const e2 =
      evaluateWindow({
        direction,
        entryPrice,
        atr,
        signalMs,
        hours: 2,
        bars
      });

    if (e2) {
      patch.evaluated_2h_at =
        e2.evaluatedAt;

      patch.price_2h =
        e2.price;

      patch.high_2h =
        e2.high;

      patch.low_2h =
        e2.low;

      patch.mfe_2h =
        e2.mfe;

      patch.mae_2h =
        e2.mae;

      patch.mfe_atr_2h =
        e2.mfeAtr;

      patch.mae_atr_2h =
        e2.maeAtr;

      patch.direction_correct_2h =
        e2.directionCorrect;

      const p2 =
        analyzePathWindow({
          forecastDirection:
            direction,

          entryPrice,
          signalMs,
          hours: 2,
          bars
        });

      if (p2) {
        patch.prop_max_delta_2h =
          p2.propMaxDelta;

        patch.broker_max_delta_2h =
          p2.brokerMaxDelta;
      }

      changed = true;
    }
  }


  // ==========================================================
  // 3H
  // ==========================================================

  let evaluated3hNow = false;

  if (
    !signal.evaluated_3h_at &&
    nowMs >= target3h
  ) {
    const e3 =
      evaluateWindow({
        direction,
        entryPrice,
        atr,
        signalMs,
        hours: 3,
        bars
      });

    if (e3) {
      patch.evaluated_3h_at =
        e3.evaluatedAt;

      patch.price_3h =
        e3.price;

      patch.high_3h =
        e3.high;

      patch.low_3h =
        e3.low;

      patch.mfe_3h =
        e3.mfe;

      patch.mae_3h =
        e3.mae;

      patch.mfe_atr_3h =
        e3.mfeAtr;

      patch.mae_atr_3h =
        e3.maeAtr;

      patch.direction_correct_3h =
        e3.directionCorrect;

      patch.result_3h =
        buildResult3h(
          direction,
          e3.directionCorrect
        );

      patch.final_move =
        e3.finalMove;

      patch.final_move_atr =
        e3.finalMoveAtr;

      const p3 =
        analyzePathWindow({
          forecastDirection:
            direction,

          entryPrice,
          signalMs,
          hours: 3,
          bars
        });

      if (p3) {
        patch.prop_max_delta_3h =
          p3.propMaxDelta;

        patch.broker_max_delta_3h =
          p3.brokerMaxDelta;
      }

      const hits =
        findFirstHits({
          forecastDirection:
            direction,

          entryPrice,
          signalMs,
          bars,
          hours: 3
        });

      appendPathHits(
        patch,
        signal,
        hits
      );

      /*
      Al completamento delle 3H salviamo anche
      il percorso definitivo.
      */

      if (
        ["BUY", "SELL"].includes(direction)
      ) {
        const finalStoredPath =
          buildStoredPath(
            signalMs,
            bars,
            target3h
          );

        if (
          finalStoredPath.length > 0
        ) {
          patch.path_m15_3h =
            finalStoredPath;
        }
      }

      evaluated3hNow = true;
      changed = true;
    }
  }


  // ==========================================================
  // LEGACY PATH HITS PROGRESSIVI
  // ==========================================================

  if (
    ["BUY", "SELL"].includes(direction)
  ) {
    let availableHours = 0;

    if (nowMs >= target3h) {
      availableHours = 3;
    }

    else if (nowMs >= target2h) {
      availableHours = 2;
    }

    else if (nowMs >= target1h) {
      availableHours = 1;
    }

    if (availableHours > 0) {
      const hits =
        findFirstHits({
          forecastDirection:
            direction,

          entryPrice,
          signalMs,
          bars,
          hours: availableHours
        });

      const beforeCount =
        Object.keys(patch)
          .length;

      appendPathHits(
        patch,
        signal,
        hits
      );

      if (
        Object.keys(patch).length >
        beforeCount
      ) {
        changed = true;
      }
    }
  }


  // ==========================================================
  // STATUS
  // ==========================================================

  if (
    evaluated3hNow ||
    signal.evaluated_3h_at
  ) {
    patch.evaluation_status =
      "COMPLETED";
  }

  else if (
    changed ||
    signal.evaluated_1h_at ||
    signal.evaluated_2h_at
  ) {
    patch.evaluation_status =
      "PARTIAL";
  }

  else {
    patch.evaluation_status =
      "PENDING";
  }


  if (
    !changed &&
    patch.evaluation_status ===
      signal.evaluation_status
  ) {
    return {
      id: signal.id,
      updated: false,
      reason: "NOTHING_DUE"
    };
  }


  const updated =
    await patchSignal(
      signal.id,
      patch
    );


  return {
    id: signal.id,

    updated: true,

    status:
      patch.evaluation_status,

    evaluated1h:
      Boolean(
        patch.evaluated_1h_at
      ),

    evaluated2h:
      Boolean(
        patch.evaluated_2h_at
      ),

    evaluated3h:
      Boolean(
        patch.evaluated_3h_at
      ),

    pathRecorderUpdated:
      Array.isArray(
        patch.path_m15_3h
      ),

    pathBars:
      Array.isArray(
        patch.path_m15_3h
      )
        ? patch.path_m15_3h.length
        : normalizeBars(
            signal.path_m15_3h
          ).length,

    result3h:
      patch.result_3h ??
      updated?.result_3h ??
      null
  };
}


// ============================================================
// BACKFILL
// ============================================================

async function backfillPathSignal(
  signal,
  bars
) {
  const signalMs =
    isoToMs(
      signal.signal_m15_time
    );

  const entryPrice =
    finiteOrNull(
      signal.entry_price
    );

  const direction =
    String(
      signal.forecast_direction ||
      "WAIT"
    )
      .toUpperCase()
      .trim();

  if (
    signalMs === null ||
    entryPrice === null ||
    !["BUY", "SELL"].includes(direction)
  ) {
    return {
      id: signal.id,
      updated: false,
      reason: "NOT_DIRECTIONAL"
    };
  }

  const patch = {};


  // ==========================================================
  // BACKFILL PATH M15 3H
  // ==========================================================

  const reconstructedPath =
    buildStoredPath(
      signalMs,
      bars,
      signalMs +
      3 * 60 * 60 * 1000
    );

  if (
    reconstructedPath.length > 0 &&
    !sameStoredPath(
      signal.path_m15_3h,
      reconstructedPath
    )
  ) {
    patch.path_m15_3h =
      reconstructedPath;
  }


  // ==========================================================
  // BACKFILL DELTA
  // ==========================================================

  for (const hours of [1, 2, 3]) {
    const path =
      analyzePathWindow({
        forecastDirection:
          direction,

        entryPrice,
        signalMs,
        hours,
        bars
      });

    if (!path) continue;

    const propKey =
      `prop_max_delta_${hours}h`;

    const brokerKey =
      `broker_max_delta_${hours}h`;

    if (
      signal?.[propKey] == null
    ) {
      patch[propKey] =
        path.propMaxDelta;
    }

    if (
      signal?.[brokerKey] == null
    ) {
      patch[brokerKey] =
        path.brokerMaxDelta;
    }
  }


  // ==========================================================
  // BACKFILL LEGACY HITS
  // ==========================================================

  const hits =
    findFirstHits({
      forecastDirection:
        direction,

      entryPrice,
      signalMs,
      bars,
      hours: 3
    });

  appendPathHits(
    patch,
    signal,
    hits
  );


  if (
    Object.keys(patch).length === 0
  ) {
    return {
      id: signal.id,
      updated: false,
      reason:
        "ALREADY_FILLED_OR_OUTSIDE_FEED"
    };
  }


  await patchSignal(
    signal.id,
    patch
  );


  return {
    id: signal.id,

    updated: true,

    pathRecorded:
      Array.isArray(
        patch.path_m15_3h
      ),

    pathBars:
      Array.isArray(
        patch.path_m15_3h
      )
        ? patch.path_m15_3h.length
        : normalizeBars(
            signal.path_m15_3h
          ).length,

    patchedFields:
      Object.keys(patch)
  };
}


// ============================================================
// RUN NORMAL
// ============================================================

async function runEvaluator(symbol) {
  const feed =
    await getFeed(symbol);

  if (!feed) {
    return {
      ok: true,
      symbol,
      status: "NO_FEED",
      checked: 0,
      updated: 0
    };
  }

  const bars =
    feed.m15;

  if (bars.length < 20) {
    return {
      ok: true,
      symbol,
      status: "BARS_INSUFFICIENT",
      checked: 0,
      updated: 0,
      m15Bars: bars.length
    };
  }

  const signals =
    await getOpenSignals(symbol);

  const nowMs =
    Date.now();

  const results = [];

  for (const signal of signals) {
    try {
      const result =
        await evaluateSignal(
          signal,
          bars,
          nowMs
        );

      results.push(result);
    }

    catch (error) {
      results.push({
        id: signal.id,
        updated: false,
        error:
          error?.message ||
          String(error)
      });
    }
  }

  const updated =
    results.filter(
      x => x.updated
    ).length;

  const pathRecorderUpdated =
    results.filter(
      x =>
        x.pathRecorderUpdated
    ).length;

  return {
    ok: true,
    symbol,
    status: "DONE",
    mode: "NORMAL",
    version: "1.20",

    m15Bars:
      bars.length,

    openSignals:
      signals.length,

    checked:
      results.length,

    updated,

    pathRecorderUpdated,

    results
  };
}


// ============================================================
// RUN BACKFILL
// ============================================================

async function runBackfill(
  symbol,
  limit = 500
) {
  const feed =
    await getFeed(symbol);

  if (!feed) {
    return {
      ok: true,
      symbol,
      status: "NO_FEED",
      mode: "BACKFILL",
      version: "1.20",
      checked: 0,
      updated: 0
    };
  }

  const bars =
    feed.m15;

  if (bars.length < 20) {
    return {
      ok: true,
      symbol,
      status: "BARS_INSUFFICIENT",
      mode: "BACKFILL",
      version: "1.20",
      checked: 0,
      updated: 0,
      m15Bars: bars.length
    };
  }

  const signals =
    await getBackfillSignals(
      symbol,
      limit
    );

  const results = [];

  for (const signal of signals) {
    try {
      const result =
        await backfillPathSignal(
          signal,
          bars
        );

      results.push(result);
    }

    catch (error) {
      results.push({
        id: signal.id,
        updated: false,
        error:
          error?.message ||
          String(error)
      });
    }
  }

  const updated =
    results.filter(
      x => x.updated
    ).length;

  const pathRecorded =
    results.filter(
      x => x.pathRecorded
    ).length;

  return {
    ok: true,
    symbol,
    status: "DONE",
    mode: "BACKFILL",
    version: "1.20",

    m15Bars:
      bars.length,

    candidates:
      signals.length,

    checked:
      results.length,

    updated,

    pathRecorded,

    results
  };
}


// ============================================================
// GET
// ============================================================

export async function GET(request) {
  try {
    assertEnv();

    const {
      searchParams
    } =
      new URL(request.url);

    const symbol =
      normalizeSymbol(
        searchParams.get(
          "symbol"
        ) ||
        DEFAULT_SYMBOL
      );

    const mode =
      String(
        searchParams.get(
          "mode"
        ) ||
        "normal"
      )
        .toLowerCase()
        .trim();

    if (mode === "backfill") {
      const limit =
        Number(
          searchParams.get(
            "limit"
          ) ||
          500
        );

      return json(
        await runBackfill(
          symbol,
          limit
        )
      );
    }

    return json(
      await runEvaluator(symbol)
    );
  }

  catch (error) {
    console.error(
      "Market Signal Evaluator GET error:",
      error
    );

    return json(
      {
        ok: false,
        error:
          error?.message ||
          String(error)
      },
      500
    );
  }
}


// ============================================================
// POST
// ============================================================

export async function POST(request) {
  try {
    assertEnv();

    let body = {};

    try {
      body =
        await request.json();
    }

    catch {
      body = {};
    }

    const symbol =
      normalizeSymbol(
        body?.symbol ||
        DEFAULT_SYMBOL
      );

    const mode =
      String(
        body?.mode ||
        "normal"
      )
        .toLowerCase()
        .trim();

    if (mode === "backfill") {
      return json(
        await runBackfill(
          symbol,
          Number(
            body?.limit ||
            500
          )
        )
      );
    }

    return json(
      await runEvaluator(symbol)
    );
  }

  catch (error) {
    console.error(
      "Market Signal Evaluator POST error:",
      error
    );

    return json(
      {
        ok: false,
        error:
          error?.message ||
          String(error)
      },
      500
    );
  }
}
