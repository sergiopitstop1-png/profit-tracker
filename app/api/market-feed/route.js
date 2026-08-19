export const dynamic = "force-dynamic";
export const revalidate = 0;

/*
============================================================
MARKET FEED API v1.2
+ MARKET ENGINE SIGNAL LOGGER TRIGGER

Riceve da MarketFeedBridge MT5:
- M15
- H1
- account MT5
- timestamp terminale

Salva tutto su Supabase nella tabella:

prop_market_feed

NOVITÀ v1.2:
- rileva la chiusura di una NUOVA M15
- quando cambia last_m15_time richiama automaticamente:
  /api/market-signal-log
- il Signal Logger NON può bloccare il feed MT5
- nessun trading
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

const LIVE_MAX_AGE_SECONDS = 90;


const SUPPORTED = new Set([
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
    Number(value);

  return Number.isFinite(n)
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

    Per sicurezza:
    se arrivasse in secondi,
    lo convertiamo automaticamente.
  */

  const ms =
    n < 10_000_000_000
      ? n * 1000
      : n;

  const d =
    new Date(ms);

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
    !Array.isArray(input)
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
  if (!iso) {
    return null;
  }

  const ts =
    new Date(
      iso
    ).getTime();

  if (
    !Number.isFinite(ts)
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
SUPABASE CHECK
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
    `?market_key=eq.${encodeURIComponent(marketKey)}` +
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
        ? JSON.parse(text)
        : [];
  }

  catch {
    throw new Error(
      `Supabase GET risposta non JSON: ${text.slice(0, 300)}`
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
    ? data[0] || null
    : null;
}


/*
============================================================
UPSERT SUPABASE
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
        ? JSON.parse(text)
        : [];
  }

  catch {
    throw new Error(
      `Supabase UPSERT risposta non JSON: ${text.slice(0, 300)}`
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
    ? data[0] || row
    : row;
}


/*
============================================================
SIGNAL LOGGER TRIGGER
============================================================

Questa funzione viene chiamata SOLO quando market-feed
ha rilevato una nuova candela M15 chiusa.

IMPORTANTE:
eventuali errori qui NON devono mai propagarsi
al MarketFeedBridge / MT5.
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
          ? JSON.parse(text)
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


    console.log(
      "Market Signal Logger:",
      marketKey,
      data?.inserted
        ? "INSERTED"
        : data?.duplicate
          ? "DUPLICATE"
          : data?.skipped
            ? "SKIPPED"
            : "OK",
      "| M15:",
      data?.signal?.m15Time ||
      "-"
    );


    return {
      ok:
        true,

      status:
        data?.inserted
          ? "INSERTED"
          : data?.duplicate
            ? "DUPLICATE"
            : data?.skipped
              ? "SKIPPED"
              : "OK",

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
        String(error)
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
          ok: false,

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
          ok: false,

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

    if (!row) {
      return json({
        ok: false,

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
      ok: true,

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
        ok: false,

        error:
          error?.message ||
          String(error)
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
    if (
      !supabaseConfigured()
    ) {
      return json(
        {
          ok: false,

          error:
            "Supabase non configurato."
        },
        500
      );
    }


    let body;


    try {
      body =
        await request.json();
    }

    catch {
      return json(
        {
          ok: false,

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
            ok: false,

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


    if (!marketKey) {
      return json(
        {
          ok: false,

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
          ok: false,

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
      m15.length < 20
    ) {
      return json(
        {
          ok: false,

          error:
            `Barre M15 insufficienti: ${m15.length}`
        },
        400
      );
    }


    if (
      h1.length < 20
    ) {
      return json(
        {
          ok: false,

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
        m15.length - 1
      ];


    const lastH1 =
      h1[
        h1.length - 1
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

    È questo confronto che ci permette di sapere
    se è nata una nuova M15.
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
      È nuova quando:

      1. non esisteva ancora un feed precedente

      OPPURE

      2. il timestamp M15 appena ricevuto
         è diverso da quello già salvato.
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

    PRIMA salviamo il feed.

    Solo DOPO eventualmente facciamo partire
    il Market Engine Logger.

    In questo modo market-analysis leggerà
    già la NUOVA candela M15 da Supabase.
    ------------------------------------------------------------
    */

    const saved =
      await upsertFeed(
        row
      );


    /*
    ------------------------------------------------------------
    SIGNAL LOGGER
    ------------------------------------------------------------

    IMPORTANTISSIMO:

    Il feed MT5 è prioritario.

    Se il logger fallisce:
    - il feed resta salvato
    - MT5 riceve comunque HTTP 200
    - l'errore viene solamente segnalato

    Questo evita che il laboratorio statistico
    possa rompere il MarketFeedBridge.
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
    }


    /*
    ------------------------------------------------------------
    OK
    ------------------------------------------------------------
    */

    return json({
      ok: true,

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
        Diagnostica nuova v1.2.

        Non serve all'EA per funzionare,
        ma ci permette di vedere subito
        se il logger è scattato.
      */

      new_m15:
        isNewM15,

      signal_logger:
        signalLogger,

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
        ok: false,

        error:
          error?.message ||
          String(error)
      },
      500
    );
  }
}
