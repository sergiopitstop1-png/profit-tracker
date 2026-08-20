export const dynamic = "force-dynamic";
export const revalidate = 0;

/*
  MARKET SIGNAL FIRST TOUCH v2.00 — 24H TAIL
  Checkpoint supportati: 1,2,3,6,9,12,15,18,21,24 ore.
  Usa path_m15_24h; per 1/2/3H accetta anche il vecchio path_m15_3h.
  Restituisce anche la sorte delle sole operazioni ancora aperte al checkpoint precedente.
*/

const SUPABASE_URL =
  process.env.NEXT_PUBLIC_SUPABASE_URL ||
  process.env.SUPABASE_URL;

const SUPABASE_SERVICE_ROLE_KEY =
  process.env.SUPABASE_SERVICE_ROLE_KEY;

const SIGNAL_TABLE =
  "prop_market_signal_log";

const CHECKPOINTS =
  [1, 2, 3, 6, 9, 12, 15, 18, 21, 24];

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

function headers() {
  if (
    !SUPABASE_URL ||
    !SUPABASE_SERVICE_ROLE_KEY
  ) {
    throw new Error(
      "Supabase non configurato."
    );
  }

  return {
    apikey:
      SUPABASE_SERVICE_ROLE_KEY,

    Authorization:
      `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`
  };
}

function num(
  v,
  d = null
) {
  const n =
    Number(v);

  return Number.isFinite(n)
    ? n
    : d;
}

function pct(
  n,
  d
) {
  return d > 0
    ? Number(
        (
          100 *
          n /
          d
        ).toFixed(1)
      )
    : null;
}

function normSymbol(
  v
) {
  return String(
    v ||
    "XAUUSD"
  )
    .toUpperCase()
    .replace(
      /[^A-Z0-9]/g,
      ""
    ) ||
    "XAUUSD";
}

function opposite(
  d
) {
  return d === "BUY"
    ? "SELL"
    : d === "SELL"
      ? "BUY"
      : "WAIT";
}

function previousCheckpoint(
  h
) {
  const i =
    CHECKPOINTS.indexOf(
      h
    );

  return i > 0
    ? CHECKPOINTS[
        i - 1
      ]
    : 0;
}

function normalizePath(
  v
) {
  if (
    !Array.isArray(v)
  ) {
    return [];
  }

  return v
    .map(
      b => ({
        t:
          num(
            b?.t
          ),

        o:
          num(
            b?.o
          ),

        h:
          num(
            b?.h
          ),

        l:
          num(
            b?.l
          ),

        c:
          num(
            b?.c
          ),

        v:
          num(
            b?.v,
            0
          )
      })
    )
    .filter(
      b =>
        [
          b.t,
          b.o,
          b.h,
          b.l,
          b.c
        ].every(
          Number.isFinite
        )
    )
    .sort(
      (
        a,
        b
      ) =>
        a.t -
        b.t
    );
}

function barHit(
  direction,
  price,
  bar
) {
  if (
    direction ===
    "BUY"
  ) {
    return (
      bar.h >=
      price
    );
  }

  if (
    direction ===
    "SELL"
  ) {
    return (
      bar.l <=
      price
    );
  }

  return false;
}

function classify(
  row,
  hours,
  tpDist,
  slDist
) {
  const entry =
    num(
      row.entry_price
    );

  const forecast =
    String(
      row.forecast_direction ||
      ""
    )
      .toUpperCase();

  if (
    !Number.isFinite(
      entry
    ) ||
    ![
      "BUY",
      "SELL"
    ].includes(
      forecast
    )
  ) {
    return {
      kind:
        "INVALID"
    };
  }

  const prop =
    opposite(
      forecast
    );

  const raw24 =
    normalizePath(
      row.path_m15_24h
    );

  const raw3 =
    normalizePath(
      row.path_m15_3h
    );

  const path =
    raw24.length
      ? raw24
      : raw3;

  if (
    !path.length
  ) {
    return {
      kind:
        "NO_PATH"
    };
  }

  const needBars =
    hours *
    4;

  if (
    path.length <
    needBars
  ) {
    return {
      kind:
        "PENDING",

      bars:
        path.length,

      needBars
    };
  }

  const bars =
    path.slice(
      0,
      needBars
    );

  const tpPrice =
    prop === "BUY"
      ? entry +
        tpDist
      : entry -
        tpDist;

  const slPrice =
    prop === "BUY"
      ? entry -
        slDist
      : entry +
        slDist;

  for (
    let i = 0;
    i < bars.length;
    i++
  ) {
    const b =
      bars[i];

    const tp =
      barHit(
        prop,
        tpPrice,
        b
      );

    const sl =
      barHit(
        opposite(
          prop
        ),
        slPrice,
        b
      );

    if (
      tp &&
      sl
    ) {
      return {
        kind:
          "AMBIGUOUS",

        barIndex:
          i,

        hitTime:
          b.t
      };
    }

    if (
      tp
    ) {
      return {
        kind:
          "TP",

        barIndex:
          i,

        hitTime:
          b.t
      };
    }

    if (
      sl
    ) {
      return {
        kind:
          "SL",

        barIndex:
          i,

        hitTime:
          b.t
      };
    }
  }

  return {
    kind:
      "NONE",

    bars:
      bars.length
  };
}

function bucket(
  rows,
  hours,
  tpDist,
  slDist,
  filterFn =
    () => true
) {
  const counts = {
    signals:
      0,

    tp:
      0,

    sl:
      0,

    none:
      0,

    ambiguous:
      0
  };

  for (
    const r
    of rows
  ) {
    if (
      !filterFn(
        r
      )
    ) {
      continue;
    }

    const x =
      classify(
        r,
        hours,
        tpDist,
        slDist
      );

    if (
      [
        "PENDING",
        "NO_PATH",
        "INVALID"
      ].includes(
        x.kind
      )
    ) {
      continue;
    }

    counts.signals++;

    if (
      x.kind ===
      "TP"
    ) {
      counts.tp++;
    }

    else if (
      x.kind ===
      "SL"
    ) {
      counts.sl++;
    }

    else if (
      x.kind ===
      "AMBIGUOUS"
    ) {
      counts.ambiguous++;
    }

    else {
      counts.none++;
    }
  }

  return {
    ...counts,

    tpPct:
      pct(
        counts.tp,
        counts.signals
      ),

    slPct:
      pct(
        counts.sl,
        counts.signals
      ),

    nonePct:
      pct(
        counts.none,
        counts.signals
      ),

    ambiguousPct:
      pct(
        counts.ambiguous,
        counts.signals
      )
  };
}

function forecastResult(
  row,
  hours
) {
  const h =
    hours <= 1
      ? 1
      : hours <= 2
        ? 2
        : 3;

  const v =
    row[
      `direction_correct_${h}h`
    ];

  return v === true
    ? "WIN"
    : v === false
      ? "LOSS"
      : null;
}

async function getRows(
  symbol
) {
  const select =
    [
      "id",
      "symbol",
      "signal_m15_time",
      "entry_price",
      "forecast_direction",
      "direction_correct_1h",
      "direction_correct_2h",
      "direction_correct_3h",
      "path_m15_3h",
      "path_m15_24h"
    ].join(
      ","
    );

  const url =
    `${SUPABASE_URL}/rest/v1/${SIGNAL_TABLE}` +
    `?symbol=eq.${encodeURIComponent(symbol)}` +
    `&forecast_direction=in.(BUY,SELL)` +
    `&select=${select}` +
    `&order=signal_m15_time.asc` +
    `&limit=5000`;

  const r =
    await fetch(
      url,
      {
        headers:
          headers(),

        cache:
          "no-store"
      }
    );

  const t =
    await r.text();

  let j =
    [];

  try {
    j =
      t
        ? JSON.parse(
            t
          )
        : [];
  }

  catch {
    throw new Error(
      `Supabase non JSON: ${
        t.slice(
          0,
          200
        )
      }`
    );
  }

  if (
    !r.ok
  ) {
    throw new Error(
      j?.message ||
      j?.error ||
      `Supabase HTTP ${r.status}`
    );
  }

  return Array.isArray(
    j
  )
    ? j
    : [];
}


// ============================================================
// GET
// ============================================================

export async function GET(
  request
) {
  try {
    const u =
      new URL(
        request.url
      );

    const symbol =
      normSymbol(
        u.searchParams.get(
          "symbol"
        )
      );

    const hours =
      num(
        u.searchParams.get(
          "hours"
        ),
        1
      );

    if (
      !CHECKPOINTS.includes(
        hours
      )
    ) {
      return json(
        {
          ok:
            false,

          error:
            `hours non valido. Usa: ${
              CHECKPOINTS.join(
                ", "
              )
            }`
        },
        400
      );
    }

    const tpPoints =
      Math.max(
        1,
        num(
          u.searchParams.get(
            "tp"
          ),
          1000
        )
      );

    const slPoints =
      Math.max(
        1,
        num(
          u.searchParams.get(
            "sl"
          ),
          1000
        )
      );

    const pointSize =
      Math.max(
        0.0000001,
        num(
          u.searchParams.get(
            "pointSize"
          ),
          0.01
        )
      );

    const tpDist =
      tpPoints *
      pointSize;

    const slDist =
      slPoints *
      pointSize;

    const rows =
      await getRows(
        symbol
      );


    // ==========================================================
    // CONTEGGIO DISPONIBILITA PATH
    // ==========================================================

    const skipped = {
      pending:
        0,

      noPath:
        0,

      invalid:
        0
    };

    let analyzed =
      0;

    for (
      const r
      of rows
    ) {
      const x =
        classify(
          r,
          hours,
          tpDist,
          slDist
        );

      if (
        x.kind ===
        "PENDING"
      ) {
        skipped.pending++;
      }

      else if (
        x.kind ===
        "NO_PATH"
      ) {
        skipped.noPath++;
      }

      else if (
        x.kind ===
        "INVALID"
      ) {
        skipped.invalid++;
      }

      else {
        analyzed++;
      }
    }


    // ==========================================================
    // STATISTICHE CUMULATIVE DALL'INGRESSO
    // ==========================================================

    const total =
      bucket(
        rows,
        hours,
        tpDist,
        slDist
      );

    const forecastWin =
      bucket(
        rows,
        hours,
        tpDist,
        slDist,
        r =>
          forecastResult(
            r,
            hours
          ) ===
          "WIN"
      );

    const forecastLoss =
      bucket(
        rows,
        hours,
        tpDist,
        slDist,
        r =>
          forecastResult(
            r,
            hours
          ) ===
          "LOSS"
      );


    // ==========================================================
    // SOPRAVVISSUTE AL CHECKPOINT PRECEDENTE
    // ==========================================================

    const prev =
      previousCheckpoint(
        hours
      );

    let survivors =
      null;

    if (
      prev >
      0
    ) {
      /*
        Prendiamo SOLO i trade che al checkpoint precedente
        erano ancora "NONE", cioè non avevano toccato
        né TP né SL.

        Poi vediamo che fine hanno fatto entro il checkpoint
        corrente.
      */

      const eligible =
        rows.filter(
          r =>
            classify(
              r,
              prev,
              tpDist,
              slDist
            ).kind ===
            "NONE"
        );

      const b =
        bucket(
          eligible,
          hours,
          tpDist,
          slDist
        );

      survivors = {
        fromHours:
          prev,

        toHours:
          hours,

        openAtPrevious:
          eligible.length,

        ...b
      };
    }


    // ==========================================================
    // RESPONSE
    // ==========================================================

    return json({
      ok:
        true,

      version:
        "2.00-24H",

      symbol,

      checkpoints:
        CHECKPOINTS,

      configuration: {
        hours,

        tpPoints,

        slPoints,

        pointSize,

        tpPriceDistance:
          tpDist,

        slPriceDistance:
          slDist
      },

      sourceSignals:
        rows.length,

      analyzedSignals:
        analyzed,

      skipped,

      summary: {
        total,
        forecastWin,
        forecastLoss
      },

      survivorsFromPrevious:
        survivors
    });
  }

  catch (e) {
    return json(
      {
        ok:
          false,

        error:
          e?.message ||
          String(e)
      },
      500
    );
  }
}
