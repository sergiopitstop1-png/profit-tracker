// ============================================================
// MARKET SIGNAL LOGGER v1.00
// ProfitTracker / Market Engine Lab
//
// Scopo:
// - registra una fotografia LIVE del Market Engine
// - una sola riga per SYMBOL + ENGINE VERSION + M15
// - non modifica MAI il segnale originale già registrato
// - prepara i dati per valutatore 1H / 2H / 3H
//
// GET:
//   /api/market-signal-log?symbol=XAUUSD
//   -> forza una nuova analisi e prova a registrarla
//
// GET:
//   /api/market-signal-log?mode=recent&symbol=XAUUSD
//   -> mostra gli ultimi record salvati
//
// POST:
//   { "symbol": "XAUUSD" }
//   -> forza una nuova analisi e prova a registrarla
//
// POST:
//   { "analysis": { ...risposta market-analysis... } }
//   -> registra direttamente uno snapshot già calcolato
// ============================================================

export const dynamic = "force-dynamic";
export const revalidate = 0;


// ============================================================
// CONFIG
// ============================================================

const SUPABASE_URL =
  process.env.NEXT_PUBLIC_SUPABASE_URL ||
  process.env.SUPABASE_URL;

const SUPABASE_SERVICE_ROLE_KEY =
  process.env.SUPABASE_SERVICE_ROLE_KEY;

const DEFAULT_SYMBOL = "XAUUSD";

const SIGNAL_TABLE =
  "prop_market_signal_log";


// ============================================================
// UTILITY
// ============================================================

function jsonResponse(
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


function finiteOrNull(value) {
  const n =
    Number(value);

  return Number.isFinite(n)
    ? n
    : null;
}


function integerOrNull(value) {
  const n =
    Number(value);

  return Number.isFinite(n)
    ? Math.trunc(n)
    : null;
}


function textOrNull(value) {
  if (
    value === null ||
    value === undefined
  ) {
    return null;
  }

  const s =
    String(value).trim();

  return s
    ? s
    : null;
}


function boolOrNull(value) {
  if (
    value === true ||
    value === false
  ) {
    return value;
  }

  return null;
}


function validDateIso(value) {
  if (
    value === null ||
    value === undefined ||
    value === ""
  ) {
    return null;
  }

  /*
    Il Market Engine può restituire:
    - timestamp numerico in millisecondi
    - stringa ISO
  */

  let d;

  if (
    typeof value === "number" ||
    (
      typeof value === "string" &&
      /^[0-9]+$/.test(
        value.trim()
      )
    )
  ) {
    const n =
      Number(value);

    if (
      !Number.isFinite(n)
    ) {
      return null;
    }

    /*
      Protezione:
      se arriva timestamp Unix in secondi
      invece che millisecondi.
    */

    const ms =
      n < 10_000_000_000
        ? n * 1000
        : n;

    d =
      new Date(ms);
  }

  else {
    d =
      new Date(value);
  }

  if (
    !Number.isFinite(
      d.getTime()
    )
  ) {
    return null;
  }

  return d.toISOString();
}


function normalizeSymbol(value) {
  const symbol =
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

  return symbol ||
    DEFAULT_SYMBOL;
}


// ============================================================
// SUPABASE REST
// ============================================================

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


function assertEnv() {
  if (
    !SUPABASE_URL
  ) {
    throw new Error(
      "SUPABASE_URL non configurato."
    );
  }

  if (
    !SUPABASE_SERVICE_ROLE_KEY
  ) {
    throw new Error(
      "SUPABASE_SERVICE_ROLE_KEY non configurata."
    );
  }
}


// ============================================================
// MARKET ANALYSIS
// ============================================================

async function fetchMarketAnalysis(
  requestUrl,
  symbol
) {
  const origin =
    new URL(
      requestUrl
    ).origin;

  /*
    force=1:
    per il logger vogliamo l'analisi
    realmente aggiornata alla nuova M15,
    non una risposta rimasta nella cache.
  */

  const url =
    `${origin}/api/market-analysis` +
    `?symbol=${encodeURIComponent(symbol)}` +
    `&force=1`;

  const response =
    await fetch(
      url,
      {
        method:
          "GET",

        cache:
          "no-store",

        headers: {
          Accept:
            "application/json"
        }
      }
    );

  const text =
    await response.text();

  let data =
    null;

  try {
    data =
      text
        ? JSON.parse(text)
        : null;
  }

  catch {
    throw new Error(
      `market-analysis ha restituito una risposta non JSON. HTTP ${response.status}`
    );
  }

  if (
    !response.ok
  ) {
    throw new Error(
      data?.error ||
      `market-analysis HTTP ${response.status}`
    );
  }

  if (
    !data?.ok
  ) {
    throw new Error(
      data?.error ||
      "Market Engine non disponibile."
    );
  }

  return data;
}


// ============================================================
// VALIDAZIONE ANALISI
// ============================================================

function validateAnalysis(
  analysis
) {
  if (
    !analysis ||
    typeof analysis !==
      "object"
  ) {
    return {
      ok: false,
      reason:
        "ANALYSIS_MISSING"
    };
  }

  if (
    analysis.ok !== true
  ) {
    return {
      ok: false,
      reason:
        "ANALYSIS_NOT_OK"
    };
  }

  /*
    Non vogliamo registrare come LIVE
    un risultato generato senza sorgente live.
  */

  if (
    analysis.source ===
      "NO_LIVE_SOURCE"
  ) {
    return {
      ok: false,
      reason:
        "NO_LIVE_SOURCE"
    };
  }

  const m15Time =
    validDateIso(
      analysis
        ?.timeframes
        ?.m15
        ?.timestamp
    ) ||
    validDateIso(
      analysis
        ?.feed
        ?.lastM15
    );

  if (
    !m15Time
  ) {
    return {
      ok: false,
      reason:
        "M15_TIME_MISSING"
    };
  }

  const engineVersion =
    textOrNull(
      analysis.engineVersion
    );

  if (
    !engineVersion
  ) {
    return {
      ok: false,
      reason:
        "ENGINE_VERSION_MISSING"
    };
  }

  return {
    ok: true,
    m15Time,
    engineVersion
  };
}


// ============================================================
// COSTRUZIONE RECORD
// ============================================================

function buildSignalRow(
  analysis
) {
  const validation =
    validateAnalysis(
      analysis
    );

  if (
    !validation.ok
  ) {
    return {
      ok: false,
      reason:
        validation.reason
    };
  }

  const combined =
    analysis.combined ||
    {};

  const forecast =
    analysis.forecast ||
    {};

  const priceForecast =
    analysis.priceForecast ||
    {};

  const agreement =
    forecast.agreement ||
    combined.agreement ||
    {};

  const macro =
    forecast.macro ||
    combined.macro ||
    {};

  const session =
    analysis.session ||
    {};

  const rolling =
    analysis.rolling ||
    {};

  const m15 =
    analysis
      ?.timeframes
      ?.m15 ||
    {};

  const h1 =
    analysis
      ?.timeframes
      ?.h1 ||
    {};

  const fib =
    analysis.fibonacci ||
    {};

  const nearestFib =
    fib.nearest ||
    null;

  const direction =
    textOrNull(
      forecast.direction ||
      combined.forecastDirection
    ) ||
    "WAIT";

  const propDirection =
    textOrNull(
      forecast.propDirection ||
      combined.propDirection
    ) ||
    "WAIT";

  const entryPrice =
    finiteOrNull(
      analysis
        ?.market
        ?.currentPrice
    ) ??
    finiteOrNull(
      m15.lastClose
    );

  const row = {

    // ========================================================
    // IDENTITÀ
    // ========================================================

    symbol:
      normalizeSymbol(
        analysis.symbol
      ),

    engine_version:
      validation.engineVersion,

    signal_source:
      "LIVE",

    signal_m15_time:
      validation.m15Time,

    evaluation_status:
      "PENDING",


    // ========================================================
    // PREZZO
    // ========================================================

    entry_price:
      entryPrice,

    atr_m15:
      finiteOrNull(
        analysis
          ?.market
          ?.atrM15
      ) ??
      finiteOrNull(
        m15.atr14
      ),


    // ========================================================
    // FORECAST
    // ========================================================

    forecast_direction:
      direction,

    prop_direction:
      propDirection,

    /*
      price_score:
      forecast prima dell'overlay macro.

      Nella V2.3 il campo finale
      forecast.priceScore contiene
      proprio il baseScore del price engine.
    */

    price_score:
      finiteOrNull(
        forecast.priceScore
      ) ??
      finiteOrNull(
        priceForecast.score
      ),

    confidence_raw:
      finiteOrNull(
        forecast.confidence ??
        combined.confidence
      ),

    signal_strength:
      textOrNull(
        forecast.signalStrength ||
        combined.signalStrength
      ),

    forecast_condition:
      textOrNull(
        forecast.condition ||
        combined.forecastCondition
      ),


    // ========================================================
    // COMPONENTI MOTORE
    // ========================================================

    day_score:
      finiteOrNull(
        agreement.session
      ) ??
      finiteOrNull(
        session.score
      ),

    rolling_score:
      finiteOrNull(
        agreement.rolling
      ),

    micro_score:
      finiteOrNull(
        agreement.micro
      ),

    blocks_score:
      finiteOrNull(
        agreement.blocks
      ),

    m15_score:
      finiteOrNull(
        m15.score
      ),

    h1_score:
      finiteOrNull(
        h1.score
      ),

    day_regime:
      textOrNull(
        session.regime
      ),

    day_structure:
      textOrNull(
        session.structure
      ),

    agree_count:
      integerOrNull(
        agreement.agreeCount
      ),

    conflict_count:
      integerOrNull(
        agreement.conflictCount
      ),


    // ========================================================
    // ROLLING
    //
    // Salviamo qui le unità ATR,
    // non i dollari.
    //
    // In questo modo 1.2 significa:
    // movimento pari a 1.2 ATR,
    // confrontabile tra giornate diverse.
    //
    // I valori completi in dollari/pct
    // restano comunque nello snapshot JSON.
    // ========================================================

    rolling_1h:
      finiteOrNull(
        rolling?.h1?.atr
      ),

    rolling_3h:
      finiteOrNull(
        rolling?.h3?.atr
      ),

    rolling_6h:
      finiteOrNull(
        rolling?.h6?.atr
      ),

    rolling_12h:
      finiteOrNull(
        rolling?.h12?.atr
      ),


    // ========================================================
    // MACRO
    // ========================================================

    fred_score:
      finiteOrNull(
        macro.fredScore
      ),

    fred_bias:
      textOrNull(
        macro.fredBias
      ),

    calendar_score:
      finiteOrNull(
        macro.calendarScore
      ),

    calendar_bias:
      textOrNull(
        macro.calendarBias
      ),

    macro_composite_score:
      finiteOrNull(
        macro.compositeScore
      ),

    macro_adjustment:
      finiteOrNull(
        macro.adjustment
      ),

    event_risk:
      textOrNull(
        macro.eventRisk
      ),

    next_high_impact:
      macro.nextHighImpact &&
      typeof macro.nextHighImpact ===
        "object"
        ? macro.nextHighImpact
        : null,


    // ========================================================
    // FIBONACCI
    // ========================================================

    fib_impulse:
      textOrNull(
        fib.impulse
      ),

    fib_near:
      boolOrNull(
        fib.nearFib
      ),

    fib_nearest_name:
      textOrNull(
        nearestFib?.name
      ),

    fib_nearest_price:
      finiteOrNull(
        nearestFib?.price
      ),


    // ========================================================
    // SNAPSHOT COMPLETO
    //
    // Qui conserviamo l'intera risposta
    // del Market Engine V2.3.
    //
    // Questo sarà preziosissimo in futuro:
    // potremo rianalizzare i vecchi segnali
    // anche se aggiungeremo nuove metriche.
    // ========================================================

    snapshot:
      analysis
  };

  return {
    ok: true,
    row
  };
}


// ============================================================
// CERCA RECORD ESISTENTE
// ============================================================

async function findExistingSignal(
  symbol,
  engineVersion,
  signalM15Time
) {
  assertEnv();

  const url =
    `${SUPABASE_URL}/rest/v1/${SIGNAL_TABLE}` +
    `?symbol=eq.${encodeURIComponent(symbol)}` +
    `&engine_version=eq.${encodeURIComponent(engineVersion)}` +
    `&signal_m15_time=eq.${encodeURIComponent(signalM15Time)}` +
    `&select=id,symbol,engine_version,signal_m15_time,forecast_direction,confidence_raw,created_at,evaluation_status` +
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

  if (
    !response.ok
  ) {
    const text =
      await response.text();

    throw new Error(
      `Supabase ricerca segnale HTTP ${response.status}: ${text}`
    );
  }

  const rows =
    await response.json();

  return Array.isArray(rows)
    ? rows[0] || null
    : null;
}


// ============================================================
// INSERT
// ============================================================

async function insertSignal(
  row
) {
  assertEnv();

  /*
    Prima controlliamo esplicitamente
    se la M15 esiste già.

    Il DB ha comunque anche il UNIQUE INDEX:
    quindi abbiamo DUE protezioni
    contro i doppioni.
  */

  const existing =
    await findExistingSignal(
      row.symbol,
      row.engine_version,
      row.signal_m15_time
    );

  if (
    existing
  ) {
    return {
      inserted:
        false,

      duplicate:
        true,

      record:
        existing
    };
  }


  const url =
    `${SUPABASE_URL}/rest/v1/${SIGNAL_TABLE}`;

  const response =
    await fetch(
      url,
      {
        method:
          "POST",

        headers:
          supabaseHeaders({
            Prefer:
              "return=representation"
          }),

        body:
          JSON.stringify(
            row
          ),

        cache:
          "no-store"
      }
    );

  const text =
    await response.text();

  let data =
    null;

  try {
    data =
      text
        ? JSON.parse(text)
        : null;
  }

  catch {
    data =
      text;
  }


  // ========================================================
  // POSSIBILE RACE CONDITION
  //
  // Se due richieste arrivassero nello stesso
  // millisecondo, il UNIQUE INDEX può bloccare
  // la seconda.
  //
  // In tal caso non è un errore:
  // recuperiamo semplicemente il record esistente.
  // ========================================================

  if (
    response.status === 409
  ) {
    const raceExisting =
      await findExistingSignal(
        row.symbol,
        row.engine_version,
        row.signal_m15_time
      );

    if (
      raceExisting
    ) {
      return {
        inserted:
          false,

        duplicate:
          true,

        record:
          raceExisting
      };
    }
  }


  if (
    !response.ok
  ) {
    throw new Error(
      `Supabase insert segnale HTTP ${response.status}: ${
        typeof data === "string"
          ? data
          : JSON.stringify(data)
      }`
    );
  }


  const insertedRow =
    Array.isArray(data)
      ? data[0]
      : data;


  return {
    inserted:
      true,

    duplicate:
      false,

    record:
      insertedRow
  };
}


// ============================================================
// REGISTRA ANALISI
// ============================================================

async function logAnalysis(
  analysis
) {
  const built =
    buildSignalRow(
      analysis
    );

  if (
    !built.ok
  ) {
    return {
      ok: true,

      inserted:
        false,

      skipped:
        true,

      reason:
        built.reason
    };
  }


  /*
    IMPORTANTE:
    salviamo anche WAIT.

    WAIT serve al futuro laboratorio
    per capire se il motore è bravo
    anche quando decide di NON operare.
  */

  const saved =
    await insertSignal(
      built.row
    );


  return {
    ok: true,

    skipped:
      false,

    inserted:
      saved.inserted,

    duplicate:
      saved.duplicate,

    signal: {
      id:
        saved.record?.id ||
        null,

      symbol:
        built.row.symbol,

      engineVersion:
        built.row.engine_version,

      m15Time:
        built.row.signal_m15_time,

      entryPrice:
        built.row.entry_price,

      forecast:
        built.row.forecast_direction,

      propDirection:
        built.row.prop_direction,

      priceScore:
        built.row.price_score,

      confidenceRaw:
        built.row.confidence_raw,

      signalStrength:
        built.row.signal_strength,

      condition:
        built.row.forecast_condition,

      evaluationStatus:
        saved.record
          ?.evaluation_status ||
        built.row.evaluation_status
    }
  };
}


// ============================================================
// RECENT SIGNALS
// ============================================================

async function getRecentSignals(
  symbol,
  limit = 25
) {
  assertEnv();

  const safeLimit =
    Math.max(
      1,
      Math.min(
        Number(limit) || 25,
        200
      )
    );

  let url =
    `${SUPABASE_URL}/rest/v1/${SIGNAL_TABLE}` +
    `?select=` +
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
      "day_score",
      "rolling_score",
      "micro_score",
      "blocks_score",
      "m15_score",
      "h1_score",
      "event_risk",
      "evaluation_status",
      "direction_correct_1h",
      "direction_correct_2h",
      "direction_correct_3h",
      "result_3h",
      "created_at"
    ]
      .join(",") +
    `&order=signal_m15_time.desc` +
    `&limit=${safeLimit}`;

  if (
    symbol
  ) {
    url +=
      `&symbol=eq.${encodeURIComponent(symbol)}`;
  }


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


  if (
    !response.ok
  ) {
    const text =
      await response.text();

    throw new Error(
      `Supabase storico HTTP ${response.status}: ${text}`
    );
  }


  const rows =
    await response.json();


  return Array.isArray(rows)
    ? rows
    : [];
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


    // ========================================================
    // CASO A:
    // riceviamo direttamente la risposta Market Engine
    // ========================================================

    if (
      body?.analysis &&
      typeof body.analysis ===
        "object"
    ) {
      const result =
        await logAnalysis(
          body.analysis
        );

      return jsonResponse(
        result
      );
    }


    // ========================================================
    // CASO B:
    // chiediamo noi una nuova analisi
    // ========================================================

    const symbol =
      normalizeSymbol(
        body?.symbol ||
        DEFAULT_SYMBOL
      );

    const analysis =
      await fetchMarketAnalysis(
        request.url,
        symbol
      );

    const result =
      await logAnalysis(
        analysis
      );


    return jsonResponse({
      ...result,

      requestedSymbol:
        symbol
    });
  }

  catch (error) {
    console.error(
      "Market Signal Logger POST error:",
      error
    );

    return jsonResponse(
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


    const mode =
      String(
        searchParams.get(
          "mode"
        ) ||
        "log"
      )
        .toLowerCase()
        .trim();


    const symbol =
      normalizeSymbol(
        searchParams.get(
          "symbol"
        ) ||
        DEFAULT_SYMBOL
      );


    // ========================================================
    // GET STORICO
    //
    // /api/market-signal-log?mode=recent
    // ========================================================

    if (
      mode ===
      "recent"
    ) {
      const limit =
        Number(
          searchParams.get(
            "limit"
          ) ||
          25
        );

      const rows =
        await getRecentSignals(
          symbol,
          limit
        );

      return jsonResponse({
        ok:
          true,

        mode:
          "recent",

        symbol,

        count:
          rows.length,

        rows
      });
    }


    // ========================================================
    // DEFAULT:
    // forza nuova analisi e prova a registrarla
    // ========================================================

    const analysis =
      await fetchMarketAnalysis(
        request.url,
        symbol
      );

    const result =
      await logAnalysis(
        analysis
      );


    return jsonResponse({
      ...result,

      requestedSymbol:
        symbol
    });
  }

  catch (error) {
    console.error(
      "Market Signal Logger GET error:",
      error
    );

    return jsonResponse(
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
