export const dynamic = "force-dynamic";
export const revalidate = 0;

const SUPABASE_URL =
  process.env.NEXT_PUBLIC_SUPABASE_URL ||
  process.env.SUPABASE_URL;

const SUPABASE_SERVICE_ROLE_KEY =
  process.env.SUPABASE_SERVICE_ROLE_KEY;

const MARKET_FEED_SECRET =
  process.env.MARKET_FEED_SECRET;

function json(data, status = 200) {
  return Response.json(data, {
    status,
    headers: {
      "Cache-Control": "no-store"
    }
  });
}

function validBar(b) {
  return (
    b &&
    Number.isFinite(Number(b.t)) &&
    Number.isFinite(Number(b.o)) &&
    Number.isFinite(Number(b.h)) &&
    Number.isFinite(Number(b.l)) &&
    Number.isFinite(Number(b.c))
  );
}

function sanitizeBars(arr, max = 500) {
  if (!Array.isArray(arr)) return [];

  return arr
    .filter(validBar)
    .map(b => ({
      t: Number(b.t),
      o: Number(b.o),
      h: Number(b.h),
      l: Number(b.l),
      c: Number(b.c),
      v: Number(b.v || 0)
    }))
    .sort((a, b) => a.t - b.t)
    .slice(-max);
}

async function supabaseRequest(path, options = {}) {
  if (!SUPABASE_URL) {
    throw new Error("SUPABASE_URL non configurata.");
  }

  if (!SUPABASE_SERVICE_ROLE_KEY) {
    throw new Error(
      "SUPABASE_SERVICE_ROLE_KEY non configurata."
    );
  }

  const response = await fetch(
    `${SUPABASE_URL}/rest/v1/${path}`,
    {
      ...options,

      headers: {
        apikey: SUPABASE_SERVICE_ROLE_KEY,

        Authorization:
          `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`,

        "Content-Type": "application/json",

        Prefer:
          "resolution=merge-duplicates,return=representation",

        ...(options.headers || {})
      },

      cache: "no-store"
    }
  );

  const text =
    await response.text();

  let data = null;

  if (text) {
    try {
      data = JSON.parse(text);
    } catch {
      data = text;
    }
  }

  if (!response.ok) {
    throw new Error(
      typeof data === "string"
        ? data
        : JSON.stringify(data)
    );
  }

  return data;
}

/*
============================================================
POST
MT5 -> ProfitTracker -> Supabase
============================================================
*/

export async function POST(request) {
  try {
    if (!MARKET_FEED_SECRET) {
      return json(
        {
          ok: false,
          error:
            "MARKET_FEED_SECRET non configurato su Vercel."
        },
        500
      );
    }

    const body =
      await request.json();

    /*
    ----------------------------------------------------------
    SICUREZZA
    ----------------------------------------------------------
    */

    if (
      !body?.secret ||
      body.secret !== MARKET_FEED_SECRET
    ) {
      return json(
        {
          ok: false,
          error: "Secret non valido."
        },
        401
      );
    }

    /*
    ----------------------------------------------------------
    DATI BASE
    ----------------------------------------------------------
    */

    const marketKey =
      String(
        body.market_key || ""
      )
        .trim()
        .toUpperCase();

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

    const m15 =
      sanitizeBars(
        body.m15,
        500
      );

    const h1 =
      sanitizeBars(
        body.h1,
        500
      );

    if (m15.length < 20) {
      return json(
        {
          ok: false,
          error:
            `M15 insufficienti: ${m15.length}`
        },
        400
      );
    }

    if (h1.length < 20) {
      return json(
        {
          ok: false,
          error:
            `H1 insufficienti: ${h1.length}`
        },
        400
      );
    }

    /*
    ----------------------------------------------------------
    ULTIME CANDELE
    ----------------------------------------------------------
    */

    const lastM15 =
      m15[m15.length - 1];

    const lastH1 =
      h1[h1.length - 1];

    const terminalTimeMs =
      Number(
        body.terminal_time
      );

    const terminalTimeISO =
      Number.isFinite(
        terminalTimeMs
      )
        ? new Date(
            terminalTimeMs
          ).toISOString()
        : new Date()
            .toISOString();

    const payload = {
      market_key:
        marketKey,

      source_symbol:
        String(
          body.source_symbol ||
          ""
        ),

      account_login:
        String(
          body.account_login ||
          ""
        ),

      account_server:
        String(
          body.account_server ||
          ""
        ),

      account_company:
        String(
          body.account_company ||
          ""
        ),

      terminal_time:
        terminalTimeISO,

      last_m15_time:
        new Date(
          lastM15.t
        ).toISOString(),

      last_h1_time:
        new Date(
          lastH1.t
        ).toISOString(),

      m15,

      h1,

      updated_at:
        new Date()
          .toISOString()
    };

    /*
    ----------------------------------------------------------
    UPSERT SUPABASE
    Una sola riga per ogni market_key.
    XAUUSD viene semplicemente aggiornata.
    ----------------------------------------------------------
    */

    const result =
      await supabaseRequest(
        "prop_market_feed?on_conflict=market_key",
        {
          method: "POST",
          body:
            JSON.stringify(
              payload
            )
        }
      );

    return json({
      ok: true,

      market_key:
        marketKey,

      source_symbol:
        payload.source_symbol,

      m15_count:
        m15.length,

      h1_count:
        h1.length,

      last_m15:
        payload.last_m15_time,

      last_h1:
        payload.last_h1_time,

      received_at:
        payload.updated_at,

      saved:
        true,

      rows:
        Array.isArray(result)
          ? result.length
          : null
    });

  } catch (e) {
    console.error(
      "Market Feed POST error:",
      e
    );

    return json(
      {
        ok: false,

        error:
          e?.message ||
          String(e)
      },
      500
    );
  }
}

/*
============================================================
GET
Serve per controllare velocemente se MT5 sta alimentando il feed.
NON restituisce le 300 candele complete.
============================================================
*/

export async function GET(request) {
  try {
    const {
      searchParams
    } =
      new URL(
        request.url
      );

    const marketKey =
      String(
        searchParams.get(
          "symbol"
        ) ||
        "XAUUSD"
      )
        .trim()
        .toUpperCase();

    const rows =
      await supabaseRequest(
        `prop_market_feed` +
        `?market_key=eq.${encodeURIComponent(marketKey)}` +
        `&select=market_key,source_symbol,account_login,account_server,account_company,terminal_time,last_m15_time,last_h1_time,updated_at`,
        {
          method: "GET"
        }
      );

    const row =
      Array.isArray(rows)
        ? rows[0]
        : null;

    if (!row) {
      return json(
        {
          ok: false,

          market_key:
            marketKey,

          status:
            "NO_FEED"
        },
        404
      );
    }

    const now =
      Date.now();

    const updated =
      new Date(
        row.updated_at
      ).getTime();

    const ageSeconds =
      Number.isFinite(
        updated
      )
        ? Math.round(
            (
              now -
              updated
            ) / 1000
          )
        : null;

    return json({
      ok: true,

      status:
        ageSeconds !== null &&
        ageSeconds <= 90
          ? "LIVE"
          : "STALE",

      age_seconds:
        ageSeconds,

      ...row
    });

  } catch (e) {
    console.error(
      "Market Feed GET error:",
      e
    );

    return json(
      {
        ok: false,

        error:
          e?.message ||
          String(e)
      },
      500
    );
  }
}
