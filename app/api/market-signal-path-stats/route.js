export const dynamic = "force-dynamic";
export const revalidate = 0;

/*
============================================================
MARKET SIGNAL PATH STATS v1.00

Analizza SOLO i forecast BUY/SELL che risultano LOSS
all'orizzonte richiesto (1H / 2H / 3H).

Risponde a una domanda diversa dal Win Rate:

"Quando il forecast era sbagliato, cosa sarebbe successo
alla strategia PROP (opposta) / BROKER (forecast)?"

Usa i campi compilati dall'Evaluator v1.10:

- prop_max_delta_1h/2h/3h
- broker_max_delta_1h/2h/3h
- prop_hit_20...70_at
- broker_hit_20...70_at

NON modifica alcun dato.
============================================================
*/

const SUPABASE_URL =
  process.env.NEXT_PUBLIC_SUPABASE_URL ||
  process.env.SUPABASE_URL;

const SUPABASE_SERVICE_ROLE_KEY =
  process.env.SUPABASE_SERVICE_ROLE_KEY;

const SIGNAL_TABLE =
  "prop_market_signal_log";

const DEFAULT_SYMBOL =
  "XAUUSD";

const LEVELS =
  [20, 30, 40, 50, 60, 70];


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


function headers() {
  return {
    apikey:
      SUPABASE_SERVICE_ROLE_KEY,

    Authorization:
      `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`,

    "Content-Type":
      "application/json"
  };
}


function normalizeSymbol(
  value
) {
  return (
    String(
      value ||
      DEFAULT_SYMBOL
    )
      .toUpperCase()
      .replace(
        /[^A-Z0-9]/g,
        ""
      )
      .trim() ||
    DEFAULT_SYMBOL
  );
}


function safeHours(
  value
) {
  const n =
    Number(value);

  return [1, 2, 3]
    .includes(n)
      ? n
      : 1;
}


function finite(
  value
) {
  const n =
    Number(value);

  return Number.isFinite(n)
    ? n
    : null;
}


function pct(
  n,
  d
) {
  if (!d) {
    return null;
  }

  return Number(
    (
      (n / d) *
      100
    )
      .toFixed(1)
  );
}


function avg(
  values
) {
  const x =
    values.filter(
      v =>
        Number.isFinite(v)
    );

  if (
    !x.length
  ) {
    return null;
  }

  return Number(
    (
      x.reduce(
        (a, b) =>
          a + b,
        0
      ) /
      x.length
    )
      .toFixed(3)
  );
}


function max(
  values
) {
  const x =
    values.filter(
      v =>
        Number.isFinite(v)
    );

  if (
    !x.length
  ) {
    return null;
  }

  return Number(
    Math.max(
      ...x
    )
      .toFixed(3)
  );
}


// ============================================================
// HIT ENTRO ORIZZONTE
// ============================================================

function hitWithinHorizon(
  row,
  side,
  level,
  hours
) {
  const hit =
    row?.[
      `${side}_hit_${level}_at`
    ];

  if (!hit) {
    return false;
  }

  const signalMs =
    new Date(
      row.signal_m15_time
    )
      .getTime();

  const hitMs =
    new Date(
      hit
    )
      .getTime();

  if (
    !Number.isFinite(signalMs) ||
    !Number.isFinite(hitMs)
  ) {
    return false;
  }

  const endMs =
    signalMs +
    hours *
    60 *
    60 *
    1000;

  return (
    hitMs <=
    endMs
  );
}


// ============================================================
// VERSIONE ENGINE ATTUALE
// ============================================================

async function getLatestEngineVersion(
  symbol
) {
  const url =
    `${SUPABASE_URL}` +
    `/rest/v1/${SIGNAL_TABLE}` +
    `?symbol=eq.${encodeURIComponent(symbol)}` +
    `&select=engine_version` +
    `&order=signal_m15_time.desc` +
    `&limit=1`;

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

  const text =
    await r.text();

  let data =
    [];

  try {
    data =
      text
        ? JSON.parse(text)
        : [];
  }

  catch {
    throw new Error(
      `Engine version non JSON: ${text.slice(0,200)}`
    );
  }

  if (
    !r.ok
  ) {
    throw new Error(
      data?.message ||
      data?.error ||
      `HTTP ${r.status}`
    );
  }

  return String(
    data?.[0]
      ?.engine_version ||
    ""
  )
    .trim();
}


// ============================================================
// LETTURA LOSS
// ============================================================

async function getRows(
  symbol,
  engineVersion,
  hours
) {
  const directionField =
    `direction_correct_${hours}h`;

  const propDeltaField =
    `prop_max_delta_${hours}h`;

  const brokerDeltaField =
    `broker_max_delta_${hours}h`;

  const select =
    [
      "id",
      "engine_version",
      "signal_m15_time",
      "forecast_direction",

      directionField,

      propDeltaField,
      brokerDeltaField,

      ...LEVELS.map(
        x =>
          `prop_hit_${x}_at`
      ),

      ...LEVELS.map(
        x =>
          `broker_hit_${x}_at`
      )
    ]
      .join(",");


  const pageSize =
    1000;

  let offset =
    0;

  const all =
    [];


  while (
    true
  ) {
    let url =
      `${SUPABASE_URL}` +
      `/rest/v1/${SIGNAL_TABLE}` +

      `?symbol=eq.${encodeURIComponent(symbol)}` +

      `&${directionField}=eq.false` +

      `&forecast_direction=in.(BUY,SELL)` +

      `&select=${select}` +

      `&order=signal_m15_time.asc` +

      `&limit=${pageSize}` +

      `&offset=${offset}`;


    if (
      engineVersion
    ) {
      url +=
        `&engine_version=eq.${encodeURIComponent(engineVersion)}`;
    }


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


    const text =
      await r.text();


    let data =
      [];


    try {
      data =
        text
          ? JSON.parse(text)
          : [];
    }

    catch {
      throw new Error(
        `Path stats non JSON: ${text.slice(0,200)}`
      );
    }


    if (
      !r.ok
    ) {
      throw new Error(
        data?.message ||
        data?.error ||
        `Path stats HTTP ${r.status}`
      );
    }


    if (
      !Array.isArray(data)
    ) {
      break;
    }


    all.push(
      ...data
    );


    if (
      data.length <
      pageSize
    ) {
      break;
    }


    offset +=
      pageSize;


    if (
      offset >=
      10000
    ) {
      break;
    }
  }


  return all;
}


// ============================================================
// STATISTICHE
// ============================================================

function buildStats(
  rows,
  hours
) {
  const propDeltaKey =
    `prop_max_delta_${hours}h`;

  const brokerDeltaKey =
    `broker_max_delta_${hours}h`;


  /*
  ------------------------------------------------------------
  Solo LOSS che possiedono davvero la Path Analysis
  ------------------------------------------------------------
  */

  const usable =
    rows.filter(
      row =>
        finite(
          row?.[
            propDeltaKey
          ]
        ) !==
          null &&

        finite(
          row?.[
            brokerDeltaKey
          ]
        ) !==
          null
    );


  const losses =
    usable.length;


  const propDeltas =
    usable.map(
      row =>
        finite(
          row?.[
            propDeltaKey
          ]
        )
    );


  const brokerDeltas =
    usable.map(
      row =>
        finite(
          row?.[
            brokerDeltaKey
          ]
        )
    );


  // ==========================================================
  // TP PROP
  // ==========================================================

  const propLevels =
    LEVELS.map(
      level => {

        const hitCount =
          usable.filter(
            row =>
              finite(
                row?.[
                  propDeltaKey
                ]
              ) >=
              level
          )
            .length;


        return {
          level,

          hitCount,

          pct:
            pct(
              hitCount,
              losses
            )
        };
      }
    );


  // ==========================================================
  // RECOVERY BROKER
  //
  // Per ogni TP Prop ipotetico:
  //
  // - prendiamo i LOSS in cui la Prop NON arriva al TP;
  // - quindi l'operazione sarebbe rimasta aperta;
  // - vediamo quanta escursione Broker è arrivata.
  // ==========================================================

  const recoveryByPropTarget =
    LEVELS.map(
      propTarget => {

        const remaining =
          usable.filter(
            row =>
              finite(
                row?.[
                  propDeltaKey
                ]
              ) <
              propTarget
          );


        const brokerLevels =
          LEVELS.map(
            level => {

              const hitCount =
                remaining.filter(
                  row =>
                    finite(
                      row?.[
                        brokerDeltaKey
                      ]
                    ) >=
                    level
                )
                  .length;


              return {
                level,

                hitCount,

                pct:
                  pct(
                    hitCount,
                    remaining.length
                  )
              };
            }
          );


        return {
          propTarget,

          remainingCount:
            remaining.length,

          remainingPct:
            pct(
              remaining.length,
              losses
            ),

          brokerLevels
        };
      }
    );


  // ==========================================================
  // ORDINE DEGLI EVENTI
  //
  // Se entrambi i lati toccano lo stesso livello:
  //
  // PROP PRIMA
  // BROKER PRIMA
  // STESSA M15 = ambiguo
  // ==========================================================

  const sequenceByLevel =
    LEVELS.map(
      level => {

        let bothHit =
          0;

        let propFirst =
          0;

        let brokerFirst =
          0;

        let ambiguous =
          0;


        for (
          const row
          of usable
        ) {
          const pHit =
            hitWithinHorizon(
              row,
              "prop",
              level,
              hours
            );


          const bHit =
            hitWithinHorizon(
              row,
              "broker",
              level,
              hours
            );


          if (
            !pHit ||
            !bHit
          ) {
            continue;
          }


          const pMs =
            new Date(
              row[
                `prop_hit_${level}_at`
              ]
            )
              .getTime();


          const bMs =
            new Date(
              row[
                `broker_hit_${level}_at`
              ]
            )
              .getTime();


          bothHit++;


          if (
            pMs <
            bMs
          ) {
            propFirst++;
          }

          else if (
            bMs <
            pMs
          ) {
            brokerFirst++;
          }

          else {
            ambiguous++;
          }
        }


        return {
          level,

          bothHit,

          propFirst,

          brokerFirst,

          ambiguous
        };
      }
    );


  return {

    summary: {
      losses,

      avgPropDelta:
        avg(
          propDeltas
        ),

      maxPropDelta:
        max(
          propDeltas
        ),

      avgBrokerDelta:
        avg(
          brokerDeltas
        ),

      maxBrokerDelta:
        max(
          brokerDeltas
        )
    },

    propLevels,

    recoveryByPropTarget,

    sequenceByLevel
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


    const hours =
      safeHours(
        searchParams.get(
          "hours"
        ) ||
        1
      );


    const requestedVersion =
      String(
        searchParams.get(
          "engine_version"
        ) ||
        ""
      )
        .trim();


    const engineVersion =
      requestedVersion ||
      await getLatestEngineVersion(
        symbol
      );


    const rows =
      await getRows(
        symbol,
        engineVersion,
        hours
      );


    const stats =
      buildStats(
        rows,
        hours
      );


    return json({
      ok:
        true,

      symbol,

      hours,

      engineVersion:
        engineVersion ||
        null,

      ...stats,

      generatedAt:
        new Date()
          .toISOString()
    });
  }

  catch (
    error
  ) {
    console.error(
      "Market Signal Path Stats error:",
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
