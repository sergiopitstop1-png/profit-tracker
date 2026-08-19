export const dynamic = "force-dynamic";
export const revalidate = 0;

/*
============================================================
MARKET FEED API v1.3
+ MARKET ENGINE SIGNAL LOGGER
+ MARKET SIGNAL EVALUATOR

Riceve da MarketFeedBridge MT5:
- M15
- H1
- account MT5
- timestamp terminale

Salva tutto su Supabase nella tabella:

prop_market_feed

AUTOMAZIONI:

NUOVA M15
   ↓
1. salva nuovo feed
   ↓
2. chiama /api/market-signal-log
   ↓
3. chiama /api/market-signal-evaluator

IMPORTANTE:

- Signal Logger ed Evaluator sono BEST EFFORT.
- Se uno dei due fallisce,
  il feed MT5 NON viene bloccato.
- NON esegue trading.
============================================================
*/


const SUPABASE_URL =
  process.env.NEXT_PUBLIC_SUPABASE_URL ||
  process.env.SUPABASE_URL;


const SUPABASE_SERVICE_ROLE_KEY =
  process.env.SUPABASE_SERVICE_ROLE_KEY;


const MARKET_FEED_SECRET =
  process.env.MARKET_FEED_SECRET;


/*
============================================================
CONFIG
============================================================
*/

const LIVE_MAX_AGE_SECONDS =
  90;


const SUPPORTED =
  new Set([
    "XAUUSD",
    "XAGUSD",

    "EURUSD",
    "GBPUSD",
    "USDJPY",
    "USDCHF",
    "USDCAD",
    "AUDUSD",
    "NZDUSD",

    "EURGBP",
    "EURJPY",
    "EURCHF",
    "EURAUD",

    "GBPJPY",
    "GBPCHF",
    "GBPAUD",

    "AUDJPY",
    "CADJPY",
    "CHFJPY",
    "NZDJPY"
  ]);


/*
============================================================
JSON RESPONSE
============================================================
*/

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


/*
============================================================
UTILITY
============================================================
*/

function cleanString(
  value
) {
  return String(
    value ?? ""
  ).trim();
}


function normalizeMarketKey(
  value
) {
  return cleanString(
    value
  )
    .toUpperCase()
    .replace(
      /[^A-Z]/g,
      ""
    );
}


function toFiniteNumber(
  value
) {
  const n =
    Number(
      value
    );

  return Number.isFinite(
    n
  )
    ? n
    : null;
}


function timestampToIso(
  value
) {
  const n =
    toFiniteNumber(
      value
    );

  if (
    n === null ||
    n <= 0
  ) {
    return null;
  }


  /*
    L'EA invia timestamp in millisecondi.

    Se per errore arrivasse in secondi,
    lo convertiamo automaticamente.
  */

  const ms =
    n <
    10_000_000_000
      ? n * 1000
      : n;


  const d =
    new Date(
      ms
    );


  if (
    !Number.isFinite(
      d.getTime()
    )
  ) {
    return null;
  }


  return d.toISOString();
}


function normalizeBars(
  input
) {
  if (
    !Array.isArray(
      input
    )
  ) {
    return [];
  }


  return input
    .map(
      bar => ({
        t:
          toFiniteNumber(
            bar?.t
          ),

        o:
          toFiniteNumber(
            bar?.o
          ),

        h:
          toFiniteNumber(
            bar?.h
          ),

        l:
          toFiniteNumber(
            bar?.l
          ),

        c:
          toFiniteNumber(
            bar?.c
          ),

        v:
          toFiniteNumber(
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


function ageSeconds(
  iso
) {
  if (
    !iso
  ) {
    return null;
  }


  const ts =
    new Date(
      iso
    ).getTime();


  if (
    !Number.isFinite(
      ts
    )
  ) {
    return null;
  }


  return Math.max(
    0,

    Math.round(
      (
        Date.now() -
        ts
      ) /
      1000
    )
  );
}


/*
============================================================
SUPABASE
============================================================
*/

function supabaseConfigured() {
  return Boolean(
    SUPABASE_URL &&
    SUPABASE_SERVICE_ROLE_KEY
  );
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


/*
============================================================
GET ROW FROM SUPABASE
============================================================
*/

async function getFeedRow(
  marketKey
) {
  const url =
    `${SUPABASE_URL}` +
    `/rest/v1/prop_market_feed` +
    `?market_key=eq.${encodeURIComponent(
      marketKey
    )}` +
    `&select=` +
    [
      "market_key",
      "source_symbol",
      "account_login",
      "account_server",
      "account_company",
      "terminal_time",
      "last_m15_time",
      "last_h1_time",
      "updated_at"
    ].join(",") +
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


  let data =
    null;


  try {
    data =
      text
        ? JSON.parse(
            text
          )
        : [];
  }

  catch {
    throw new Error(
      `Supabase GET risposta non JSON: ${text.slice(
        0,
        300
      )}`
    );
  }


  if (
    !response.ok
  ) {
    throw new Error(
      data?.message ||
      data?.error ||
      `Supabase GET HTTP ${response.status}`
    );
  }


  return Array.isArray(
    data
  )
    ? data[0] ||
        null
    : null;
}


/*
============================================================
UPSERT FEED
============================================================
*/

async function upsertFeed(
  row
) {
  const url =
    `${SUPABASE_URL}` +
    `/rest/v1/prop_market_feed` +
    `?on_conflict=market_key`;


  const response =
    await fetch(
      url,
      {
        method:
          "POST",

        headers:
          supabaseHeaders({
            Prefer:
              "resolution=merge-duplicates,return=representation"
          }),

        body:
          JSON.stringify(
            [row]
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
        ? JSON.parse(
            text
          )
        : [];
  }

  catch {
    throw new Error(
      `Supabase UPSERT risposta non JSON: ${text.slice(
        0,
        300
      )}`
    );
  }


  if (
    !response.ok
  ) {
    throw new Error(
      data?.message ||
      data?.error ||
      data?.hint ||
      `Supabase UPSERT HTTP ${response.status}`
    );
  }


  return Array.isArray(
    data
  )
    ? data[0] ||
        row
    : row;
}


/*
============================================================
SIGNAL LOGGER TRIGGER
============================================================

Chiamato soltanto quando arriva
una NUOVA M15 chiusa.

Se fallisce:
- NON blocca market-feed
- NON blocca MT5
============================================================
*/

async function triggerSignalLogger(
  requestUrl,
  marketKey
) {
  try {
    const origin =
      new URL(
        requestUrl
      ).origin;


    const loggerUrl =
      `${origin}/api/market-signal-log`;


    const response =
      await fetch(
        loggerUrl,
        {
          method:
            "POST",

          headers: {
            "Content-Type":
              "application/json",

            Accept:
              "application/json"
          },

          body:
            JSON.stringify({
              symbol:
                marketKey
            }),

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
          ? JSON.parse(
              text
            )
          : null;
    }

    catch {
      data = {
        raw:
          text
      };
    }


    if (
      !response.ok
    ) {
      console.error(
        "Market Signal Logger HTTP error:",
        response.status,
        data
      );


      return {
        ok:
          false,

        status:
          "ERROR",

        http:
          response.status,

        error:
          data?.error ||
          `HTTP ${response.status}`
      };
    }


    const status =
      data?.inserted
        ? "INSERTED"
        : data?.duplicate
          ? "DUPLICATE"
          : data?.skipped
            ? "SKIPPED"
            : "OK";


    console.log(
      "Market Signal Logger:",
      marketKey,
      "|",
      status,
      "| M15:",
      data?.signal
        ?.m15Time ||
      "-"
    );


    return {
      ok:
        true,

      status,

      inserted:
        Boolean(
          data?.inserted
        ),

      duplicate:
        Boolean(
          data?.duplicate
        ),

      skipped:
        Boolean(
          data?.skipped
        ),

      reason:
        data?.reason ||
        null,

      signal:
        data?.signal ||
        null
    };
  }

  catch (error) {
    console.error(
      "Market Signal Logger trigger error:",
      error
    );


    return {
      ok:
        false,

      status:
        "ERROR",

      error:
        error?.message ||
        String(
          error
        )
    };
  }
}


/*
============================================================
SIGNAL EVALUATOR TRIGGER
============================================================

Chiamato dopo il Signal Logger.

Controlla i vecchi segnali:
- PENDING
- PARTIAL

e aggiorna quelli che hanno raggiunto:
- 1H
- 2H
- 3H

Se fallisce:
- NON blocca market-feed
- NON blocca logger
- NON blocca MT5
============================================================
*/

async function triggerSignalEvaluator(
  requestUrl,
  marketKey
) {
  try {
    const origin =
      new URL(
        requestUrl
      ).origin;


    const evaluatorUrl =
      `${origin}/api/market-signal-evaluator`;


    const response =
      await fetch(
        evaluatorUrl,
        {
          method:
            "POST",

          headers: {
            "Content-Type":
              "application/json",

            Accept:
              "application/json"
          },

          body:
            JSON.stringify({
              symbol:
                marketKey
            }),

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
          ? JSON.parse(
              text
            )
          : null;
    }

    catch {
      data = {
        raw:
          text
      };
    }


    if (
      !response.ok
    ) {
      console.error(
        "Market Signal Evaluator HTTP error:",
        response.status,
        data
      );


      return {
        ok:
          false,

        status:
          "ERROR",

        http:
          response.status,

        error:
          data?.error ||
          `HTTP ${response.status}`
      };
    }


    console.log(
      "Market Signal Evaluator:",
      marketKey,
      "| checked:",
      data?.checked ??
        0,
      "| updated:",
      data?.updated ??
        0
    );


    return {
      ok:
        true,

      status:
        data?.status ||
        "DONE",

      checked:
        data?.checked ??
        0,

      updated:
        data?.updated ??
        0,

      openSignals:
        data?.openSignals ??
        0
    };
  }

  catch (error) {
    console.error(
      "Market Signal Evaluator trigger error:",
      error
    );


    return {
      ok:
        false,

      status:
        "ERROR",

      error:
        error?.message ||
        String(
          error
        )
    };
  }
}


/*
============================================================
GET

Esempio:

/api/market-feed?symbol=XAUUSD
============================================================
*/

export async function GET(
  request
) {
  try {
    if (
      !supabaseConfigured()
    ) {
      return json(
        {
          ok:
            false,

          error:
            "Supabase non configurato.",

          detail:
            "Mancano NEXT_PUBLIC_SUPABASE_URL/SUPABASE_URL oppure SUPABASE_SERVICE_ROLE_KEY."
        },
        500
      );
    }


    const {
      searchParams
    } =
      new URL(
        request.url
      );


    const marketKey =
      normalizeMarketKey(
        searchParams.get(
          "symbol"
        ) ||
        searchParams.get(
          "market_key"
        ) ||
        "XAUUSD"
      );


    if (
      !SUPPORTED.has(
        marketKey
      )
    ) {
      return json(
        {
          ok:
            false,

          error:
            `Simbolo non supportato: ${marketKey}`
        },
        400
      );
    }


    const row =
      await getFeedRow(
        marketKey
      );


    if (
      !row
    ) {
      return json({
        ok:
          false,

        market_key:
          marketKey,

        status:
          "NO_FEED"
      });
    }


    const age =
      ageSeconds(
        row.updated_at
      );


    const status =
      age !== null &&
      age <=
        LIVE_MAX_AGE_SECONDS
        ? "LIVE"
        : "STALE";


    return json({
      ok:
        true,

      status,

      age_seconds:
        age,

      market_key:
        row.market_key,

      source_symbol:
        row.source_symbol,

      account_login:
        row.account_login,

      account_server:
        row.account_server,

      account_company:
        row.account_company,

      terminal_time:
        row.terminal_time,

      last_m15_time:
        row.last_m15_time,

      last_h1_time:
        row.last_h1_time,

      updated_at:
        row.updated_at
    });
  }

  catch (error) {
    console.error(
      "Market Feed GET error:",
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


/*
============================================================
POST

Riceve payload dal MarketFeedBridge MT5.
============================================================
*/

export async function POST(
  request
) {
  try {

    /*
    ------------------------------------------------------------
    SUPABASE CHECK
    ------------------------------------------------------------
    */

    if (
      !supabaseConfigured()
    ) {
      return json(
        {
          ok:
            false,

          error:
            "Supabase non configurato."
        },
        500
      );
    }


    /*
    ------------------------------------------------------------
    BODY
    ------------------------------------------------------------
    */

    let body;


    try {
      body =
        await request.json();
    }

    catch {
      return json(
        {
          ok:
            false,

          error:
            "JSON non valido."
        },
        400
      );
    }


    /*
    ------------------------------------------------------------
    SECRET
    ------------------------------------------------------------
    */

    if (
      MARKET_FEED_SECRET
    ) {
      const receivedSecret =
        cleanString(
          body?.secret
        );


      if (
        !receivedSecret ||
        receivedSecret !==
          MARKET_FEED_SECRET
      ) {
        return json(
          {
            ok:
              false,

            error:
              "FEED_SECRET non valido."
          },
          401
        );
      }
    }


    /*
    ------------------------------------------------------------
    MARKET KEY
    ------------------------------------------------------------
    */

    const marketKey =
      normalizeMarketKey(
        body?.market_key
      );


    if (
      !marketKey
    ) {
      return json(
        {
          ok:
            false,

          error:
            "market_key mancante."
        },
        400
      );
    }


    if (
      !SUPPORTED.has(
        marketKey
      )
    ) {
      return json(
        {
          ok:
            false,

          error:
            `Simbolo non supportato: ${marketKey}`
        },
        400
      );
    }


    /*
    ------------------------------------------------------------
    BARRE
    ------------------------------------------------------------
    */

    const m15 =
      normalizeBars(
        body?.m15
      );


    const h1 =
      normalizeBars(
        body?.h1
      );


    if (
      m15.length <
      20
    ) {
      return json(
        {
          ok:
            false,

          error:
            `Barre M15 insufficienti: ${m15.length}`
        },
        400
      );
    }


    if (
      h1.length <
      20
    ) {
      return json(
        {
          ok:
            false,

          error:
            `Barre H1 insufficienti: ${h1.length}`
        },
        400
      );
    }


    /*
    ------------------------------------------------------------
    ULTIMA BARRA
    ------------------------------------------------------------
    */

    const lastM15 =
      m15[
        m15.length -
        1
      ];


    const lastH1 =
      h1[
        h1.length -
        1
      ];


    const lastM15Time =
      timestampToIso(
        lastM15?.t
      );


    const lastH1Time =
      timestampToIso(
        lastH1?.t
      );


    if (
      !lastM15Time
    ) {
      return json(
        {
          ok:
            false,

          error:
            "Timestamp ultima M15 non valido."
        },
        400
      );
    }


    if (
      !lastH1Time
    ) {
      return json(
        {
          ok:
            false,

          error:
            "Timestamp ultima H1 non valido."
        },
        400
      );
    }


    /*
    ------------------------------------------------------------
    STATO PRECEDENTE

    Lo leggiamo PRIMA dell'upsert.

    Serve per capire se la M15 appena ricevuta
    è nuova oppure è ancora la stessa.
    ------------------------------------------------------------
    */

    const previousRow =
      await getFeedRow(
        marketKey
      );


    const previousM15Time =
      previousRow
        ?.last_m15_time ||
      null;


    /*
      NUOVA M15 quando:

      - non esisteva feed precedente

      oppure

      - last_m15_time è cambiato
    */

    const isNewM15 =
      !previousM15Time ||
      previousM15Time !==
        lastM15Time;


    /*
    ------------------------------------------------------------
    TERMINAL TIME
    ------------------------------------------------------------
    */

    const terminalTime =
      timestampToIso(
        body?.terminal_time
      );


    /*
    ------------------------------------------------------------
    ACCOUNT
    ------------------------------------------------------------
    */

    const accountLogin =
      cleanString(
        body?.account_login
      );


    const accountServer =
      cleanString(
        body?.account_server
      );


    const accountCompany =
      cleanString(
        body?.account_company
      );


    const sourceSymbol =
      cleanString(
        body?.source_symbol
      ) ||
      marketKey;


    /*
    ------------------------------------------------------------
    ROW SUPABASE
    ------------------------------------------------------------
    */

    const nowIso =
      new Date()
        .toISOString();


    const row = {
      market_key:
        marketKey,

      source_symbol:
        sourceSymbol,

      account_login:
        accountLogin,

      account_server:
        accountServer,

      account_company:
        accountCompany,

      terminal_time:
        terminalTime,

      last_m15_time:
        lastM15Time,

      last_h1_time:
        lastH1Time,

      m15,

      h1,

      updated_at:
        nowIso
    };


    /*
    ------------------------------------------------------------
    UPSERT FEED

    PRIMA salviamo il nuovo feed.

    Così:
    - Market Engine
    - Signal Logger
    - Evaluator

    lavorano tutti sulla nuova M15 appena arrivata.
    ------------------------------------------------------------
    */

    const saved =
      await upsertFeed(
        row
      );


    /*
    ------------------------------------------------------------
    DIAGNOSTICA LOGGER
    ------------------------------------------------------------
    */

    let signalLogger = {
      triggered:
        false,

      status:
        "NOT_NEW_M15",

      previous_m15_time:
        previousM15Time,

      current_m15_time:
        lastM15Time
    };


    /*
    ------------------------------------------------------------
    DIAGNOSTICA EVALUATOR
    ------------------------------------------------------------
    */

    let signalEvaluator = {
      triggered:
        false,

      status:
        "NOT_NEW_M15",

      previous_m15_time:
        previousM15Time,

      current_m15_time:
        lastM15Time
    };


    /*
    ------------------------------------------------------------
    NUOVA M15
    ------------------------------------------------------------

    Ordine intenzionale:

    1. Signal Logger
       registra il NUOVO segnale.

    2. Evaluator
       controlla tutti i segnali PENDING/PARTIAL.

    In questo modo il nuovo segnale sarà semplicemente
    visto come PENDING e non verrà valutato prematuramente.
    ------------------------------------------------------------
    */

    if (
      isNewM15
    ) {

      console.log(
        "Market Feed: NUOVA M15 |",
        marketKey,
        "| precedente:",
        previousM15Time ||
        "NONE",
        "| nuova:",
        lastM15Time
      );


      /*
      ----------------------------------------------------------
      1. LOGGER
      ----------------------------------------------------------
      */

      const loggerResult =
        await triggerSignalLogger(
          request.url,
          marketKey
        );


      signalLogger = {
        triggered:
          true,

        previous_m15_time:
          previousM15Time,

        current_m15_time:
          lastM15Time,

        ...loggerResult
      };


      /*
      ----------------------------------------------------------
      2. EVALUATOR
      ----------------------------------------------------------
      */

      const evaluatorResult =
        await triggerSignalEvaluator(
          request.url,
          marketKey
        );


      signalEvaluator = {
        triggered:
          true,

        previous_m15_time:
          previousM15Time,

        current_m15_time:
          lastM15Time,

        ...evaluatorResult
      };
    }


    /*
    ------------------------------------------------------------
    OK
    ------------------------------------------------------------
    */

    return json({
      ok:
        true,

      status:
        "SAVED",

      market_key:
        marketKey,

      source_symbol:
        sourceSymbol,

      account_login:
        accountLogin,

      account_server:
        accountServer,

      account_company:
        accountCompany,

      terminal_time:
        terminalTime,

      last_m15_time:
        lastM15Time,

      last_h1_time:
        lastH1Time,

      m15_bars:
        m15.length,

      h1_bars:
        h1.length,

      /*
        TRUE soltanto quando
        è comparsa una nuova M15 chiusa.
      */

      new_m15:
        isNewM15,


      /*
        Diagnostica Signal Logger.
      */

      signal_logger:
        signalLogger,


      /*
        Diagnostica Evaluator.
      */

      signal_evaluator:
        signalEvaluator,


      updated_at:
        saved?.updated_at ||
        nowIso
    });
  }

  catch (error) {
    console.error(
      "Market Feed POST error:",
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
