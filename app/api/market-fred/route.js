export const dynamic = "force-dynamic";
export const revalidate = 0;

const FRED_BASE =
  "https://api.stlouisfed.org/fred";

const FRED_API_KEY =
  process.env.FRED_API_KEY;

/*
============================================================
FRED MACRO BACKGROUND ENGINE
Target principale: XAUUSD

IMPORTANTE:
- NON è un segnale BUY/SELL autonomo.
- NON contiene consensus/forecast di mercato.
- Serve come contesto macro strutturale.
============================================================
*/

const SERIES = [
  {
    id: "DGS10",
    key: "US10Y",
    name: "Treasury USA 10Y",
    group: "YIELDS",
    frequency: "DAILY",
    weight: 14
  },

  {
    id: "DGS2",
    key: "US2Y",
    name: "Treasury USA 2Y",
    group: "YIELDS",
    frequency: "DAILY",
    weight: 16
  },

  {
    id: "FEDFUNDS",
    key: "FED_FUNDS",
    name: "Federal Funds Effective Rate",
    group: "RATES",
    frequency: "MONTHLY",
    weight: 10
  },

  {
    id: "CPIAUCSL",
    key: "CPI",
    name: "Consumer Price Index",
    group: "INFLATION",
    frequency: "MONTHLY",
    weight: 6
  },

  {
    id: "CPILFESL",
    key: "CORE_CPI",
    name: "Core CPI",
    group: "INFLATION",
    frequency: "MONTHLY",
    weight: 8
  },

  {
    id: "PCEPI",
    key: "PCE",
    name: "PCE Price Index",
    group: "INFLATION",
    frequency: "MONTHLY",
    weight: 6
  },

  {
    id: "PCEPILFE",
    key: "CORE_PCE",
    name: "Core PCE",
    group: "INFLATION",
    frequency: "MONTHLY",
    weight: 9
  },

  {
    id: "UNRATE",
    key: "UNEMPLOYMENT",
    name: "Unemployment Rate",
    group: "LABOR",
    frequency: "MONTHLY",
    weight: 7
  },

  {
    id: "PAYEMS",
    key: "PAYROLLS",
    name: "Total Nonfarm Payrolls",
    group: "LABOR",
    frequency: "MONTHLY",
    weight: 7
  }
];

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
          "no-store"
      }
    }
  );
}

function toNumber(v) {
  if (
    v === null ||
    v === undefined ||
    v === "" ||
    v === "."
  ) {
    return null;
  }

  const n =
    Number(v);

  return Number.isFinite(n)
    ? n
    : null;
}

function clamp(
  value,
  min,
  max
) {
  return Math.max(
    min,
    Math.min(
      max,
      value
    )
  );
}

async function sleep(ms) {
  return new Promise(
    resolve =>
      setTimeout(
        resolve,
        ms
      )
  );
}

async function fetchFredSeries(
  seriesId,
  limit = 18
) {
  const url =
    `${FRED_BASE}/series/observations` +
    `?series_id=${encodeURIComponent(seriesId)}` +
    `&api_key=${encodeURIComponent(FRED_API_KEY)}` +
    `&file_type=json` +
    `&sort_order=desc` +
    `&limit=${limit}`;

  async function doRequest(
    attempt = 1
  ) {
    const response =
      await fetch(
        url,
        {
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

    const contentType =
      response.headers
        .get(
          "content-type"
        ) ||
      "";

    if (
      !contentType.includes(
        "application/json"
      )
    ) {
      if (
        attempt < 2
      ) {
        await sleep(400);

        return doRequest(
          attempt + 1
        );
      }

      throw new Error(
        `${seriesId}: risposta non JSON da FRED (HTTP ${response.status})`
      );
    }

    let data;

    try {
      data =
        JSON.parse(text);
    }

    catch {
      if (
        attempt < 2
      ) {
        await sleep(400);

        return doRequest(
          attempt + 1
        );
      }

      throw new Error(
        `${seriesId}: JSON FRED non valido`
      );
    }

    if (!response.ok) {
      throw new Error(
        data?.error_message ||
        `FRED HTTP ${response.status}`
      );
    }

    const observations =
      Array.isArray(
        data?.observations
      )
        ? data.observations
            .map(o => ({
              date:
                o.date,

              value:
                toNumber(
                  o.value
                )
            }))
            .filter(
              o =>
                o.value !== null
            )
        : [];

    if (
      observations.length <
      2
    ) {
      throw new Error(
        `${seriesId}: osservazioni insufficienti`
      );
    }

    return observations;
  }

  return doRequest();
}

function latestChange(
  observations
) {
  const latest =
    observations[0];

  const previous =
    observations[1];

  if (
    !latest ||
    !previous
  ) {
    return null;
  }

  const absolute =
    latest.value -
    previous.value;

  const pct =
    previous.value !== 0
      ? (
          absolute /
          Math.abs(
            previous.value
          )
        ) * 100
      : 0;

  return {
    latest:
      latest.value,

    latestDate:
      latest.date,

    previous:
      previous.value,

    previousDate:
      previous.date,

    change:
      absolute,

    changePct:
      pct
  };
}

function inflationStats(
  observations
) {
  if (
    observations.length <
    2
  ) {
    return null;
  }

  const latest =
    observations[0];

  const previous =
    observations[1];

  const mom =
    previous.value !== 0
      ? (
          (
            latest.value /
            previous.value
          ) - 1
        ) * 100
      : null;

  let yoy =
    null;

  if (
    observations.length >=
    13
  ) {
    const yearAgo =
      observations[12];

    if (
      yearAgo.value !== 0
    ) {
      yoy =
        (
          (
            latest.value /
            yearAgo.value
          ) - 1
        ) * 100;
    }
  }

  return {
    latest:
      latest.value,

    latestDate:
      latest.date,

    mom,

    yoy
  };
}

function scoreYield(
  change,
  weight
) {
  if (!change) {
    return 0;
  }

  const normalized =
    clamp(
      change.change /
      0.20,
      -1,
      1
    );

  return (
    -normalized *
    weight
  );
}

function scoreFedFunds(
  change,
  weight
) {
  if (!change) {
    return 0;
  }

  const normalized =
    clamp(
      change.change /
      0.50,
      -1,
      1
    );

  return (
    -normalized *
    weight
  );
}

function scoreUnemployment(
  change,
  weight
) {
  if (!change) {
    return 0;
  }

  const normalized =
    clamp(
      change.change /
      0.40,
      -1,
      1
    );

  return (
    normalized *
    weight
  );
}

function scorePayrolls(
  observations,
  weight
) {
  if (
    observations.length <
    2
  ) {
    return 0;
  }

  const latestGain =
    observations[0].value -
    observations[1].value;

  let previousGain =
    latestGain;

  if (
    observations.length >=
    3
  ) {
    previousGain =
      observations[1].value -
      observations[2].value;
  }

  const acceleration =
    latestGain -
    previousGain;

  const normalized =
    clamp(
      acceleration /
      150,
      -1,
      1
    );

  return (
    -normalized *
    weight
  );
}

function scoreInflationTrend(
  observations,
  weight
) {
  if (
    observations.length <
    3
  ) {
    return 0;
  }

  const latest =
    inflationStats(
      observations
    );

  const shifted =
    inflationStats(
      observations.slice(1)
    );

  if (
    latest?.mom === null ||
    latest?.mom === undefined ||
    shifted?.mom === null ||
    shifted?.mom === undefined
  ) {
    return 0;
  }

  const acceleration =
    latest.mom -
    shifted.mom;

  const normalized =
    clamp(
      acceleration /
      0.30,
      -1,
      1
    );

  return (
    -normalized *
    weight
  );
}

function macroBias(
  score
) {
  if (
    score >= 22
  ) {
    return "BULLISH_GOLD";
  }

  if (
    score <= -22
  ) {
    return "BEARISH_GOLD";
  }

  return "NEUTRAL";
}

function macroStrength(
  score
) {
  const a =
    Math.abs(score);

  if (
    a >= 55
  ) {
    return "STRONG";
  }

  if (
    a >= 32
  ) {
    return "GOOD";
  }

  if (
    a >= 18
  ) {
    return "WEAK";
  }

  return "NEUTRAL";
}

export async function GET() {
  try {
    if (!FRED_API_KEY) {
      return json(
        {
          ok: false,

          error:
            "FRED_API_KEY non configurata su Vercel."
        },
        500
      );
    }

    const results =
      await Promise.allSettled(
        SERIES.map(
          async config => {
            const observations =
              await fetchFredSeries(
                config.id,
                18
              );

            return {
              config,
              observations
            };
          }
        )
      );

    const loaded = {};
    const errors = [];

    results.forEach(
      (
        result,
        index
      ) => {
        const config =
          SERIES[index];

        if (
          result.status ===
          "fulfilled"
        ) {
          loaded[
            config.key
          ] = {
            config:
              result.value
                .config,

            observations:
              result.value
                .observations
          };
        }

        else {
          errors.push({
            series:
              config.id,

            key:
              config.key,

            error:
              result.reason
                ?.message ||
              String(
                result.reason
              )
          });
        }
      }
    );

    const components = [];

    if (
      loaded.US10Y
    ) {
      const change =
        latestChange(
          loaded.US10Y
            .observations
        );

      const score =
        scoreYield(
          change,
          loaded.US10Y
            .config
            .weight
        );

      components.push({
        key:
          "US10Y",

        label:
          "Treasury 10Y",

        score:
          Number(
            score.toFixed(2)
          ),

        latest:
          change?.latest,

        previous:
          change?.previous,

        change:
          change?.change,

        latestDate:
          change?.latestDate
      });
    }

    if (
      loaded.US2Y
    ) {
      const change =
        latestChange(
          loaded.US2Y
            .observations
        );

      const score =
        scoreYield(
          change,
          loaded.US2Y
            .config
            .weight
        );

      components.push({
        key:
          "US2Y",

        label:
          "Treasury 2Y",

        score:
          Number(
            score.toFixed(2)
          ),

        latest:
          change?.latest,

        previous:
          change?.previous,

        change:
          change?.change,

        latestDate:
          change?.latestDate
      });
    }

    if (
      loaded.FED_FUNDS
    ) {
      const change =
        latestChange(
          loaded.FED_FUNDS
            .observations
        );

      const score =
        scoreFedFunds(
          change,
          loaded
            .FED_FUNDS
            .config
            .weight
        );

      components.push({
        key:
          "FED_FUNDS",

        label:
          "Fed Funds",

        score:
          Number(
            score.toFixed(2)
          ),

        latest:
          change?.latest,

        previous:
          change?.previous,

        change:
          change?.change,

        latestDate:
          change?.latestDate
      });
    }

    if (
      loaded.UNEMPLOYMENT
    ) {
      const change =
        latestChange(
          loaded
            .UNEMPLOYMENT
            .observations
        );

      const score =
        scoreUnemployment(
          change,
          loaded
            .UNEMPLOYMENT
            .config
            .weight
        );

      components.push({
        key:
          "UNEMPLOYMENT",

        label:
          "Unemployment",

        score:
          Number(
            score.toFixed(2)
          ),

        latest:
          change?.latest,

        previous:
          change?.previous,

        change:
          change?.change,

        latestDate:
          change?.latestDate
      });
    }

    if (
      loaded.PAYROLLS
    ) {
      const obs =
        loaded.PAYROLLS
          .observations;

      const score =
        scorePayrolls(
          obs,
          loaded.PAYROLLS
            .config
            .weight
        );

      const change =
        latestChange(obs);

      components.push({
        key:
          "PAYROLLS",

        label:
          "Payroll Employment",

        score:
          Number(
            score.toFixed(2)
          ),

        latest:
          change?.latest,

        previous:
          change?.previous,

        change:
          change?.change,

        latestDate:
          change?.latestDate
      });
    }

    const inflationKeys = [
      "CPI",
      "CORE_CPI",
      "PCE",
      "CORE_PCE"
    ];

    const inflation = {};

    for (
      const key of
      inflationKeys
    ) {
      const item =
        loaded[key];

      if (!item) {
        continue;
      }

      const stats =
        inflationStats(
          item.observations
        );

      const score =
        scoreInflationTrend(
          item.observations,
          item.config.weight
        );

      inflation[key] = {
        seriesId:
          item.config.id,

        name:
          item.config.name,

        latest:
          stats?.latest,

        latestDate:
          stats?.latestDate,

        mom:
          stats?.mom !== null &&
          stats?.mom !== undefined
            ? Number(
                stats.mom
                  .toFixed(3)
              )
            : null,

        yoy:
          stats?.yoy !== null &&
          stats?.yoy !== undefined
            ? Number(
                stats.yoy
                  .toFixed(3)
              )
            : null,

        score:
          Number(
            score.toFixed(2)
          )
      };

      components.push({
        key,

        label:
          item.config.name,

        score:
          Number(
            score.toFixed(2)
          ),

        latest:
          stats?.latest,

        latestDate:
          stats?.latestDate,

        mom:
          inflation[key]
            .mom,

        yoy:
          inflation[key]
            .yoy
      });
    }

    const rawScore =
      components.reduce(
        (
          sum,
          component
        ) =>
          sum +
          (
            Number(
              component.score
            ) || 0
          ),
        0
      );

    const score =
      clamp(
        rawScore,
        -65,
        65
      );

    const bias =
      macroBias(
        score
      );

    const strength =
      macroStrength(
        score
      );

    let yieldCurve =
      null;

    const y10 =
      components.find(
        x =>
          x.key ===
          "US10Y"
      );

    const y2 =
      components.find(
        x =>
          x.key ===
          "US2Y"
      );

    if (
      Number.isFinite(
        y10?.latest
      ) &&
      Number.isFinite(
        y2?.latest
      )
    ) {
      yieldCurve = {
        tenYear:
          y10.latest,

        twoYear:
          y2.latest,

        spread:
          Number(
            (
              y10.latest -
              y2.latest
            ).toFixed(3)
          )
      };
    }

    const reasons =
      components
        .filter(
          c =>
            Math.abs(
              Number(
                c.score
              ) || 0
            ) >= 2
        )
        .sort(
          (a, b) =>
            Math.abs(
              b.score
            ) -
            Math.abs(
              a.score
            )
        )
        .slice(
          0,
          5
        )
        .map(
          c => {
            const direction =
              c.score > 0
                ? "supporta oro"
                : "pressione su oro";

            return (
              `${c.label}: ${direction} (${c.score > 0 ? "+" : ""}${c.score})`
            );
          }
        );

    return json({
      ok: true,

      source:
        "FRED",

      generatedAt:
        new Date()
          .toISOString(),

      engineVersion:
        "FRED-MACRO-V1.1",

      macro: {
        score:
          Number(
            score.toFixed(1)
          ),

        rawScore:
          Number(
            rawScore.toFixed(1)
          ),

        bias,

        strength,

        confidence:
          Math.round(
            clamp(
              Math.abs(score) *
              1.25,
              0,
              80
            )
          ),

        role:
          "BACKGROUND",

        reasons
      },

      yields: {
        US10Y:
          y10 || null,

        US2Y:
          y2 || null,

        curve:
          yieldCurve
      },

      inflation,

      labor: {
        unemployment:
          components.find(
            x =>
              x.key ===
              "UNEMPLOYMENT"
          ) || null,

        payrolls:
          components.find(
            x =>
              x.key ===
              "PAYROLLS"
          ) || null
      },

      rates: {
        fedFunds:
          components.find(
            x =>
              x.key ===
              "FED_FUNDS"
          ) || null
      },

      components,

      errors,

      seriesLoaded:
        Object.keys(
          loaded
        ).length,

      seriesRequested:
        SERIES.length,

      note:
        "FRED Macro Background V1.1: contesto strutturale per XAUUSD. Non rappresenta un segnale operativo autonomo e non contiene consensus di mercato."
    });
  }

  catch (error) {
    console.error(
      "FRED Macro error:",
      error
    );

    return json(
      {
        ok: false,

        source:
          "FRED",

        engineVersion:
          "FRED-MACRO-V1.1",

        error:
          error?.message ||
          String(error)
      },
      500
    );
  }
}
