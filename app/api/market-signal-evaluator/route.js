export const dynamic = "force-dynamic";
export const revalidate = 0;

/*
============================================================
MARKET SIGNAL EVALUATOR v1.00

Valuta automaticamente i segnali salvati in:

public.prop_market_signal_log

Usa le M15 già presenti in:

public.prop_market_feed

Checkpoint:
- 1H
- 2H
- 3H

Calcola:
- prezzo finale checkpoint
- massimo/minimo
- MFE
- MAE
- MFE/MAE in ATR
- direzione corretta?
- risultato finale 3H

NON crea nuovi segnali.
NON esegue trading.
============================================================
*/


const SUPABASE_URL =
  process.env.NEXT_PUBLIC_SUPABASE_URL ||
  process.env.SUPABASE_URL;

const SUPABASE_SERVICE_ROLE_KEY =
  process.env.SUPABASE_SERVICE_ROLE_KEY;

const SIGNAL_TABLE =
  "prop_market_signal_log";

const FEED_TABLE =
  "prop_market_feed";

const DEFAULT_SYMBOL =
  "XAUUSD";


// ============================================================
// RESPONSE
// ============================================================

function json(
  data,
  status = 200
) {
  return Response.json(
    data,
    {
      status,

      headers: {
        "Cache-Control":
          "no-store, no-cache, must-revalidate"
      }
    }
  );
}


// ============================================================
// UTILITY
// ============================================================

function assertEnv() {
  if (
    !SUPABASE_URL ||
    !SUPABASE_SERVICE_ROLE_KEY
  ) {
    throw new Error(
      "Supabase non configurato."
    );
  }
}


function supabaseHeaders(
  extra = {}
) {
  return {
    apikey:
      SUPABASE_SERVICE_ROLE_KEY,

    Authorization:
      `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`,

    "Content-Type":
      "application/json",

    ...extra
  };
}


function normalizeSymbol(
  value
) {
  const s =
    String(
      value ||
      DEFAULT_SYMBOL
    )
      .toUpperCase()
      .replace(
        /[^A-Z0-9]/g,
        ""
      )
      .trim();

  return s ||
    DEFAULT_SYMBOL;
}


function finiteOrNull(
  value
) {
  const n =
    Number(value);

  return Number.isFinite(n)
    ? n
    : null;
}


function isoToMs(
  value
) {
  const ms =
    new Date(
      value
    ).getTime();

  return Number.isFinite(ms)
    ? ms
    : null;
}


function normalizeBars(
  input
) {
  if (
    !Array.isArray(input)
  ) {
    return [];
  }

  return input
    .map(
      bar => ({
        t:
          finiteOrNull(
            bar?.t
          ),

        o:
          finiteOrNull(
            bar?.o
          ),

        h:
          finiteOrNull(
            bar?.h
          ),

        l:
          finiteOrNull(
            bar?.l
          ),

        c:
          finiteOrNull(
            bar?.c
          ),

        v:
          finiteOrNull(
            bar?.v
          ) ?? 0
      })
    )
    .filter(
      bar =>
        Number.isFinite(
          bar.t
        ) &&
        Number.isFinite(
          bar.o
        ) &&
        Number.isFinite(
          bar.h
        ) &&
        Number.isFinite(
          bar.l
        ) &&
        Number.isFinite(
          bar.c
        )
    )
    .sort(
      (a, b) =>
        a.t - b.t
    );
}


// ============================================================
// FEED M15
// ============================================================

async function getFeed(
  symbol
) {
  assertEnv();

  const url =
    `${SUPABASE_URL}` +
    `/rest/v1/${FEED_TABLE}` +
    `?market_key=eq.${encodeURIComponent(symbol)}` +
    `&select=market_key,last_m15_time,m15,updated_at` +
    `&limit=1`;

  const response =
    await fetch(
      url,
      {
        method:
          "GET",

        headers:
          supabaseHeaders(),

        cache:
          "no-store"
      }
    );

  const text =
    await response.text();

  let data;

  try {
    data =
      text
        ? JSON.parse(text)
        : [];
  }

  catch {
    throw new Error(
      `Feed Supabase non JSON: ${text.slice(0,300)}`
    );
  }

  if (
    !response.ok
  ) {
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

  if (!row) {
    return null;
  }

  return {
    ...row,

    m15:
      normalizeBars(
        row.m15
      )
  };
}


// ============================================================
// SEGNALI PENDING / PARTIAL
// ============================================================

async function getOpenSignals(
  symbol,
  limit = 200
) {
  assertEnv();

  const url =
    `${SUPABASE_URL}` +
    `/rest/v1/${SIGNAL_TABLE}` +
    `?symbol=eq.${encodeURIComponent(symbol)}` +
    `&evaluation_status=in.(PENDING,PARTIAL)` +
    `&select=` +
    [
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

      "evaluation_status"
    ].join(",") +
    `&order=signal_m15_time.asc` +
    `&limit=${Math.max(
      1,
      Math.min(
        Number(limit) || 200,
        500
      )
    )}`;

  const response =
    await fetch(
      url,
      {
        method:
          "GET",

        headers:
          supabaseHeaders(),

        cache:
          "no-store"
      }
    );

  const text =
    await response.text();

  let data;

  try {
    data =
      text
        ? JSON.parse(text)
        : [];
  }

  catch {
    throw new Error(
      `Signal query non JSON: ${text.slice(0,300)}`
    );
  }

  if (
    !response.ok
  ) {
    throw new Error(
      data?.message ||
      data?.error ||
      `Signal query HTTP ${response.status}`
    );
  }

  return Array.isArray(data)
    ? data
    : [];
}


// ============================================================
// PATCH SEGNALE
// ============================================================

async function patchSignal(
  id,
  patch
) {
  assertEnv();

  const url =
    `${SUPABASE_URL}` +
    `/rest/v1/${SIGNAL_TABLE}` +
    `?id=eq.${encodeURIComponent(id)}`;

  const response =
    await fetch(
      url,
      {
        method:
          "PATCH",

        headers:
          supabaseHeaders({
            Prefer:
              "return=representation"
          }),

        body:
          JSON.stringify(
            patch
          ),

        cache:
          "no-store"
      }
    );

  const text =
    await response.text();

  let data;

  try {
    data =
      text
        ? JSON.parse(text)
        : [];
  }

  catch {
    data =
      text;
  }

  if (
    !response.ok
  ) {
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
// VALUTAZIONE CHECKPOINT
// ============================================================

function evaluateWindow({
  direction,
  entryPrice,
  atr,
  signalMs,
  hours,
  bars
}) {
  const endMs =
    signalMs +
    hours *
    60 *
    60 *
    1000;

  /*
    Prendiamo le barre chiuse successive al segnale
    fino al checkpoint incluso.

    Una M15 con timestamp t rappresenta l'apertura
    della candela chiusa che termina 15 minuti dopo.

    Per semplicità statistica usiamo tutte le M15
    con timestamp:
    > signalMs
    <= endMs
  */

  const windowBars =
    bars.filter(
      bar =>
        bar.t >
          signalMs &&
        bar.t <=
          endMs
    );

  if (
    windowBars.length === 0
  ) {
    return null;
  }

  const lastBar =
    windowBars[
      windowBars.length - 1
    ];

  const high =
    Math.max(
      ...windowBars.map(
        b => b.h
      )
    );

  const low =
    Math.min(
      ...windowBars.map(
        b => b.l
      )
    );

  const finalPrice =
    lastBar.c;

  let mfe =
    null;

  let mae =
    null;

  let directionCorrect =
    null;


  if (
    direction ===
    "BUY"
  ) {
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

  else if (
    direction ===
    "SELL"
  ) {
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

  else {
    /*
      WAIT:
      non imponiamo WIN/LOSS.
    */

    mfe =
      null;

    mae =
      null;

    directionCorrect =
      null;
  }


  let mfeAtr =
    null;

  let maeAtr =
    null;

  if (
    atr !== null &&
    atr > 0
  ) {
    if (
      mfe !== null
    ) {
      mfeAtr =
        mfe /
        atr;
    }

    if (
      mae !== null
    ) {
      maeAtr =
        mae /
        atr;
    }
  }


  return {
    evaluatedAt:
      new Date(
        endMs
      ).toISOString(),

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
      (
        atr !== null &&
        atr > 0
      )
        ? (
            finalPrice -
            entryPrice
          ) /
          atr
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
  if (
    direction ===
      "WAIT"
  ) {
    return "WAIT";
  }

  if (
    directionCorrect ===
      true
  ) {
    return "WIN";
  }

  if (
    directionCorrect ===
      false
  ) {
    return "LOSS";
  }

  return null;
}


// ============================================================
// VALUTA UN SEGNALE
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
      id:
        signal.id,

      updated:
        false,

      reason:
        "INVALID_SIGNAL_DATA"
    };
  }


  const patch = {};

  let changed =
    false;


  // ==========================================================
  // 1H
  // ==========================================================

  const target1h =
    signalMs +
    60 *
    60 *
    1000;


  if (
    !signal.evaluated_1h_at &&
    nowMs >=
      target1h
  ) {
    const e1 =
      evaluateWindow({
        direction,
        entryPrice,
        atr,
        signalMs,
        hours:
          1,
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

      changed =
        true;
    }
  }


  // ==========================================================
  // 2H
  // ==========================================================

  const target2h =
    signalMs +
    2 *
    60 *
    60 *
    1000;


  if (
    !signal.evaluated_2h_at &&
    nowMs >=
      target2h
  ) {
    const e2 =
      evaluateWindow({
        direction,
        entryPrice,
        atr,
        signalMs,
        hours:
          2,
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

      changed =
        true;
    }
  }


  // ==========================================================
  // 3H
  // ==========================================================

  const target3h =
    signalMs +
    3 *
    60 *
    60 *
    1000;


  let evaluated3hNow =
    false;


  if (
    !signal.evaluated_3h_at &&
    nowMs >=
      target3h
  ) {
    const e3 =
      evaluateWindow({
        direction,
        entryPrice,
        atr,
        signalMs,
        hours:
          3,
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

      evaluated3hNow =
        true;

      changed =
        true;
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
      id:
        signal.id,

      updated:
        false,

      reason:
        "NOTHING_DUE"
    };
  }


  const updated =
    await patchSignal(
      signal.id,
      patch
    );


  return {
    id:
      signal.id,

    updated:
      true,

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

    result3h:
      patch.result_3h ??
      updated?.result_3h ??
      null
  };
}


// ============================================================
// RUN EVALUATOR
// ============================================================

async function runEvaluator(
  symbol
) {
  const feed =
    await getFeed(
      symbol
    );

  if (
    !feed
  ) {
    return {
      ok:
        true,

      symbol,

      status:
        "NO_FEED",

      checked:
        0,

      updated:
        0
    };
  }


  const bars =
    feed.m15;


  if (
    bars.length <
      20
  ) {
    return {
      ok:
        true,

      symbol,

      status:
        "BARS_INSUFFICIENT",

      checked:
        0,

      updated:
        0,

      m15Bars:
        bars.length
    };
  }


  const signals =
    await getOpenSignals(
      symbol
    );


  const nowMs =
    Date.now();


  const results =
    [];


  for (
    const signal
    of signals
  ) {
    try {
      const result =
        await evaluateSignal(
          signal,
          bars,
          nowMs
        );

      results.push(
        result
      );
    }

    catch (error) {
      results.push({
        id:
          signal.id,

        updated:
          false,

        error:
          error?.message ||
          String(error)
      });
    }
  }


  const updated =
    results.filter(
      x =>
        x.updated
    ).length;


  return {
    ok:
      true,

    symbol,

    status:
      "DONE",

    m15Bars:
      bars.length,

    openSignals:
      signals.length,

    checked:
      results.length,

    updated,

    results
  };
}


// ============================================================
// GET
// ============================================================

export async function GET(
  request
) {
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


    const result =
      await runEvaluator(
        symbol
      );


    return json(
      result
    );
  }

  catch (error) {
    console.error(
      "Market Signal Evaluator GET error:",
      error
    );


    return json(
      {
        ok:
          false,

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

export async function POST(
  request
) {
  try {
    assertEnv();


    let body =
      {};


    try {
      body =
        await request.json();
    }

    catch {
      body =
        {};
    }


    const symbol =
      normalizeSymbol(
        body?.symbol ||
        DEFAULT_SYMBOL
      );


    const result =
      await runEvaluator(
        symbol
      );


    return json(
      result
    );
  }

  catch (error) {
    console.error(
      "Market Signal Evaluator POST error:",
      error
    );


    return json(
      {
        ok:
          false,

        error:
          error?.message ||
          String(error)
      },
      500
    );
  }
}
