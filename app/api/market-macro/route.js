export const dynamic = "force-dynamic";
export const revalidate = 0;

const EODHD_BASE = "https://eodhd.com/api/economic-events";

const API_KEY =
  process.env.EODHD_API_KEY;

const ENGINE_TZ =
  "Europe/Rome";

const IMPORTANT_PATTERNS = [
  {
    key: "CPI",
    patterns: [
      "consumer price index",
      "cpi",
      "inflation rate"
    ],
    weight: 18,
    inverseForGold: true
  },
  {
    key: "CORE_CPI",
    patterns: [
      "core consumer price",
      "core cpi",
      "core inflation"
    ],
    weight: 20,
    inverseForGold: true
  },
  {
    key: "PCE",
    patterns: [
      "pce price",
      "personal consumption expenditure",
      "personal consumption expenditures"
    ],
    weight: 20,
    inverseForGold: true
  },
  {
    key: "CORE_PCE",
    patterns: [
      "core pce",
      "core personal consumption"
    ],
    weight: 22,
    inverseForGold: true
  },
  {
    key: "NFP",
    patterns: [
      "nonfarm payroll",
      "non farm payroll",
      "payrolls"
    ],
    weight: 22,
    inverseForGold: true
  },
  {
    key: "UNEMPLOYMENT",
    patterns: [
      "unemployment rate"
    ],
    weight: 16,
    inverseForGold: false
  },
  {
    key: "JOBLESS_CLAIMS",
    patterns: [
      "initial jobless claims",
      "jobless claims",
      "unemployment claims"
    ],
    weight: 14,
    inverseForGold: false
  },
  {
    key: "GDP",
    patterns: [
      "gdp growth",
      "gross domestic product",
      "gdp"
    ],
    weight: 16,
    inverseForGold: true
  },
  {
    key: "RETAIL_SALES",
    patterns: [
      "retail sales"
    ],
    weight: 14,
    inverseForGold: true
  },
  {
    key: "ISM_MANUFACTURING",
    patterns: [
      "ism manufacturing",
      "manufacturing pmi"
    ],
    weight: 12,
    inverseForGold: true
  },
  {
    key: "ISM_SERVICES",
    patterns: [
      "ism services",
      "services pmi",
      "non-manufacturing pmi"
    ],
    weight: 12,
    inverseForGold: true
  },
  {
    key: "PPI",
    patterns: [
      "producer price index",
      "ppi"
    ],
    weight: 12,
    inverseForGold: true
  },
  {
    key: "INDUSTRIAL_PRODUCTION",
    patterns: [
      "industrial production"
    ],
    weight: 10,
    inverseForGold: true
  },
  {
    key: "DURABLE_GOODS",
    patterns: [
      "durable goods"
    ],
    weight: 10,
    inverseForGold: true
  },
  {
    key: "CONSUMER_CONFIDENCE",
    patterns: [
      "consumer confidence",
      "consumer sentiment",
      "michigan consumer"
    ],
    weight: 9,
    inverseForGold: true
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

function pad2(n) {
  return String(n)
    .padStart(2, "0");
}

function formatDateUTC(d) {
  return (
    d.getUTCFullYear() +
    "-" +
    pad2(
      d.getUTCMonth() + 1
    ) +
    "-" +
    pad2(
      d.getUTCDate()
    )
  );
}

function normalizeText(v) {
  return String(
    v || ""
  )
    .trim()
    .toLowerCase();
}

function toNumber(v) {
  if (
    v === null ||
    v === undefined ||
    v === ""
  ) {
    return null;
  }

  const n =
    Number(v);

  return Number.isFinite(n)
    ? n
    : null;
}

function parseEodDate(raw) {
  if (!raw) {
    return null;
  }

  const clean =
    String(raw)
      .trim();

  /*
    EODHD documenta:
    YYYY-MM-DD HH:MM:SS

    Per ora interpretiamo il timestamp come UTC
    e lo convertiamo poi in Europe/Rome per UI.

    Se durante i test vediamo uno shift,
    correggiamo qui una volta sola.
  */

  const iso =
    clean.includes("T")
      ? clean
      : clean.replace(
          " ",
          "T"
        );

  const d =
    new Date(
      iso.endsWith("Z")
        ? iso
        : `${iso}Z`
    );

  return Number.isFinite(
    d.getTime()
  )
    ? d
    : null;
}

function formatRomeDate(
  date
) {
  if (!date) {
    return null;
  }

  return new Intl
    .DateTimeFormat(
      "it-IT",
      {
        timeZone:
          ENGINE_TZ,

        day:
          "2-digit",

        month:
          "2-digit",

        year:
          "numeric",

        hour:
          "2-digit",

        minute:
          "2-digit",

        hourCycle:
          "h23"
      }
    )
    .format(date);
}

function classifyEvent(type) {
  const txt =
    normalizeText(type);

  for (
    const rule of
    IMPORTANT_PATTERNS
  ) {
    if (
      rule.patterns.some(
        p =>
          txt.includes(p)
      )
    ) {
      return rule;
    }
  }

  return null;
}

function surpriseScore({
  actual,
  estimate,
  previous,
  rule
}) {
  if (!rule) {
    return {
      score: 0,
      surprise: null,
      basis: "UNCLASSIFIED"
    };
  }

  const a =
    toNumber(actual);

  const e =
    toNumber(estimate);

  const p =
    toNumber(previous);

  let reference =
    null;

  let basis =
    "NONE";

  if (
    a !== null &&
    e !== null
  ) {
    reference =
      e;

    basis =
      "ACTUAL_VS_ESTIMATE";
  }

  else if (
    a !== null &&
    p !== null
  ) {
    reference =
      p;

    basis =
      "ACTUAL_VS_PREVIOUS";
  }

  else {
    return {
      score: 0,
      surprise: null,
      basis
    };
  }

  const denominator =
    Math.max(
      Math.abs(reference),
      0.0001
    );

  const surprise =
    (
      a -
      reference
    ) /
    denominator;

  /*
    Limitiamo il surprise:
    dati economici con valori piccoli
    possono produrre percentuali assurde.
  */

  const normalized =
    Math.max(
      -1,
      Math.min(
        1,
        surprise / 0.20
      )
    );

  /*
    inverseForGold:
    dato più forte del previsto
    => tipicamente pressione ribassista su oro.

    unemployment/jobless:
    dato più alto del previsto
    => tipicamente più favorevole all'oro.
  */

  const direction =
    rule.inverseForGold
      ? -1
      : 1;

  const score =
    normalized *
    rule.weight *
    direction;

  return {
    score,
    surprise,
    basis
  };
}

function eventUrgencyWeight(
  eventTime,
  now
) {
  if (!eventTime) {
    return 0.5;
  }

  const diffMin =
    (
      eventTime.getTime() -
      now.getTime()
    ) /
    60000;

  /*
    Eventi già usciti:
    massima rilevanza nelle prime 3 ore,
    poi decadono rapidamente.
  */

  if (
    diffMin <= 0
  ) {
    const age =
      Math.abs(diffMin);

    if (age <= 30) {
      return 1.0;
    }

    if (age <= 90) {
      return 0.85;
    }

    if (age <= 180) {
      return 0.65;
    }

    if (age <= 360) {
      return 0.35;
    }

    return 0.10;
  }

  /*
    Eventi futuri:
    non cambiano la direzione,
    ma aumentano il rischio.
  */

  if (diffMin <= 30) {
    return 0.90;
  }

  if (diffMin <= 90) {
    return 0.65;
  }

  if (diffMin <= 180) {
    return 0.45;
  }

  if (diffMin <= 360) {
    return 0.25;
  }

  return 0.10;
}

function riskLevelFromUpcoming(
  upcoming
) {
  if (!upcoming.length) {
    return {
      level: "LOW",
      nextEvent: null
    };
  }

  const next =
    upcoming[0];

  const mins =
    next.minutesFromNow;

  if (mins <= 30) {
    return {
      level: "VERY_HIGH",
      nextEvent: next
    };
  }

  if (mins <= 90) {
    return {
      level: "HIGH",
      nextEvent: next
    };
  }

  if (mins <= 180) {
    return {
      level: "MEDIUM",
      nextEvent: next
    };
  }

  return {
    level: "LOW",
    nextEvent: next
  };
}

export async function GET(
  request
) {
  try {
    if (!API_KEY) {
      return json(
        {
          ok: false,
          error:
            "EODHD_API_KEY non configurata su Vercel."
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

    const country =
      (
        searchParams.get(
          "country"
        ) ||
        "US"
      ).toUpperCase();

    const now =
      new Date();

    /*
      Prendiamo:
      ieri + oggi + domani

      Così possiamo leggere sia
      eventi appena usciti sia eventi imminenti.
    */

    const fromDate =
      new Date(
        now.getTime() -
        24 *
        60 *
        60 *
        1000
      );

    const toDate =
      new Date(
        now.getTime() +
        24 *
        60 *
        60 *
        1000
      );

    const from =
      formatDateUTC(
        fromDate
      );

    const to =
      formatDateUTC(
        toDate
      );

    const url =
      `${EODHD_BASE}` +
      `?api_token=${encodeURIComponent(API_KEY)}` +
      `&from=${encodeURIComponent(from)}` +
      `&to=${encodeURIComponent(to)}` +
      `&country=${encodeURIComponent(country)}` +
      `&limit=1000` +
      `&fmt=json`;

    const response =
      await fetch(
        url,
        {
          cache:
            "no-store"
        }
      );

    const rawText =
      await response.text();

    let rawData =
      null;

    try {
      rawData =
        JSON.parse(
          rawText
        );
    }

    catch {
      rawData =
        rawText;
    }

    if (!response.ok) {
      return json(
        {
          ok: false,

          source:
            "EODHD",

          status:
            response.status,

          error:
            "Errore EODHD Economic Events API",

          detail:
            rawData
        },
        response.status
      );
    }

    if (
      !Array.isArray(
        rawData
      )
    ) {
      return json(
        {
          ok: false,

          source:
            "EODHD",

          error:
            "EODHD non ha restituito un array di eventi.",

          detail:
            rawData
        },
        502
      );
    }

    const normalized =
      rawData
        .map(
          event => {
            const rule =
              classifyEvent(
                event.type
              );

            if (!rule) {
              return null;
            }

            const eventTime =
              parseEodDate(
                event.date
              );

            if (!eventTime) {
              return null;
            }

            const diffMin =
              (
                eventTime.getTime() -
                now.getTime()
              ) /
              60000;

            const surprise =
              surpriseScore({
                actual:
                  event.actual,

                estimate:
                  event.estimate,

                previous:
                  event.previous,

                rule
              });

            const urgency =
              eventUrgencyWeight(
                eventTime,
                now
              );

            const weightedScore =
              surprise.score *
              urgency;

            return {
              key:
                rule.key,

              type:
                event.type,

              country:
                event.country,

              comparison:
                event.comparison ??
                null,

              period:
                event.period ??
                null,

              dateRaw:
                event.date,

              dateISO:
                eventTime
                  .toISOString(),

              dateRome:
                formatRomeDate(
                  eventTime
                ),

              minutesFromNow:
                Number(
                  diffMin.toFixed(1)
                ),

              actual:
                toNumber(
                  event.actual
                ),

              estimate:
                toNumber(
                  event.estimate
                ),

              previous:
                toNumber(
                  event.previous
                ),

              change:
                toNumber(
                  event.change
                ),

              changePercentage:
                toNumber(
                  event.change_percentage
                ),

              weight:
                rule.weight,

              basis:
                surprise.basis,

              surprise:
                surprise.surprise !==
                null
                  ? Number(
                      surprise
                        .surprise
                        .toFixed(4)
                    )
                  : null,

              rawScore:
                Number(
                  surprise.score
                    .toFixed(2)
                ),

              urgency:
                Number(
                  urgency
                    .toFixed(2)
                ),

              goldScore:
                Number(
                  weightedScore
                    .toFixed(2)
                )
            };
          }
        )
        .filter(Boolean)
        .sort(
          (a, b) =>
            new Date(
              a.dateISO
            ) -
            new Date(
              b.dateISO
            )
        );

    const recent =
      normalized.filter(
        e =>
          e.minutesFromNow <= 0 &&
          e.minutesFromNow >= -360
      );

    const upcoming =
      normalized.filter(
        e =>
          e.minutesFromNow > 0 &&
          e.minutesFromNow <= 360
      );

    /*
      MACRO SCORE
      Solo eventi GIÀ pubblicati
      influenzano la direzione.

      Gli eventi FUTURI influenzano
      invece il livello di rischio.
    */

    let score =
      recent.reduce(
        (
          sum,
          event
        ) =>
          sum +
          event.goldScore,

        0
      );

    score =
      Math.max(
        -100,
        Math.min(
          100,
          score
        )
      );

    const directionalBias =
      score >= 15
        ? "BULLISH_GOLD"

        : score <= -15
          ? "BEARISH_GOLD"

          : "NEUTRAL";

    const confidence =
      Math.round(
        Math.min(
          100,
          Math.abs(score)
        )
      );

    const risk =
      riskLevelFromUpcoming(
        upcoming
      );

    return json({
      ok: true,

      source:
        "EODHD",

      generatedAt:
        now.toISOString(),

      timezone:
        ENGINE_TZ,

      query: {
        country,
        from,
        to
      },

      macro: {
        score:
          Number(
            score.toFixed(1)
          ),

        bias:
          directionalBias,

        confidence,

        upcomingRisk:
          risk.level,

        nextEvent:
          risk.nextEvent
      },

      recentEvents:
        recent,

      upcomingEvents:
        upcoming,

      allRelevantEvents:
        normalized,

      counts: {
        raw:
          rawData.length,

        relevant:
          normalized.length,

        recent:
          recent.length,

        upcoming:
          upcoming.length
      },

      note:
        "Macro score sperimentale per XAUUSD. Gli eventi già pubblicati possono influenzare la direzione; gli eventi futuri aumentano solo il livello di rischio."
    });
  }

  catch (error) {
    console.error(
      "Market Macro error:",
      error
    );

    return json(
      {
        ok: false,

        source:
          "EODHD",

        error:
          error?.message ||
          String(error)
      },
      500
    );
  }
}
