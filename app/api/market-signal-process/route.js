export const dynamic = "force-dynamic";
export const revalidate = 0;

/*
============================================================
MARKET SIGNAL PROCESS v1.00

Chiamato dal MarketFeedBridge DOPO che market-feed
ha già restituito HTTP 200.

Esegue in sequenza:

1. Signal Logger
2. Signal Evaluator

IMPORTANTE:
questa route è completamente separata dal salvataggio
del feed MT5.

Se fallisce:
- le candele sono già state salvate
- MT5 non deve reinviare il feed
============================================================
*/

const DEFAULT_SYMBOL = "XAUUSD";


function json(data, status = 200) {
  return Response.json(
    data,
    {
      status,
      headers: {
        "Cache-Control": "no-store, no-cache, must-revalidate"
      }
    }
  );
}


function normalizeSymbol(value) {
  const s =
    String(value || DEFAULT_SYMBOL)
      .toUpperCase()
      .replace(/[^A-Z0-9]/g, "")
      .trim();

  return s || DEFAULT_SYMBOL;
}


async function callInternal(
  requestUrl,
  path,
  symbol
) {
  const origin =
    new URL(requestUrl).origin;

  const response =
    await fetch(
      `${origin}${path}`,
      {
        method: "POST",

        headers: {
          "Content-Type": "application/json",
          Accept: "application/json"
        },

        body: JSON.stringify({
          symbol
        }),

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
        : null;
  }
  catch {
    data = {
      raw: text
    };
  }

  if (!response.ok) {
    throw new Error(
      data?.error ||
      `${path} HTTP ${response.status}`
    );
  }

  return data;
}


async function processSignal(
  requestUrl,
  symbol
) {
  const result = {
    ok: true,
    symbol,

    logger: null,
    evaluator: null
  };


  /*
  ============================================================
  LOGGER
  ============================================================
  */

  try {
    result.logger =
      await callInternal(
        requestUrl,
        "/api/market-signal-log",
        symbol
      );
  }

  catch (error) {
    console.error(
      "Market Signal Process - Logger:",
      error
    );

    result.ok = false;

    result.logger = {
      ok: false,
      error:
        error?.message ||
        String(error)
    };
  }


  /*
  ============================================================
  EVALUATOR

  Lo eseguiamo anche se il logger ha avuto errore.

  Motivo:
  potremmo comunque avere vecchi segnali PENDING
  da portare a 1H / 2H / 3H.
  ============================================================
  */

  try {
    result.evaluator =
      await callInternal(
        requestUrl,
        "/api/market-signal-evaluator",
        symbol
      );
  }

  catch (error) {
    console.error(
      "Market Signal Process - Evaluator:",
      error
    );

    result.ok = false;

    result.evaluator = {
      ok: false,
      error:
        error?.message ||
        String(error)
    };
  }


  return result;
}


export async function POST(request) {
  try {
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
        body?.symbol
      );

    const result =
      await processSignal(
        request.url,
        symbol
      );

    /*
      Anche un errore del Lab non deve essere trattato
      dall'EA come errore del MARKET FEED.

      Restituiamo quindi HTTP 200 con ok false
      se una sottoroute fallisce.
    */

    return json(result);
  }

  catch (error) {
    console.error(
      "Market Signal Process POST:",
      error
    );

    return json({
      ok: false,
      error:
        error?.message ||
        String(error)
    });
  }
}


export async function GET(request) {
  try {
    const { searchParams } =
      new URL(request.url);

    const symbol =
      normalizeSymbol(
        searchParams.get("symbol")
      );

    const result =
      await processSignal(
        request.url,
        symbol
      );

    return json(result);
  }

  catch (error) {
    console.error(
      "Market Signal Process GET:",
      error
    );

    return json({
      ok: false,
      error:
        error?.message ||
        String(error)
    });
  }
}
