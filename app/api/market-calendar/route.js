export const dynamic = "force-dynamic";
export const revalidate = 0;

const TICKATLAS_BASE =
  "https://tickatlas.com/v1/calendar";

const TICKATLAS_API_KEY =
  process.env.TICKATLAS_API_KEY;

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

function normalizeText(v) {
  return String(
    v ?? ""
  ).trim();
}

function parseNumberLike(v) {
  if (
    v === null ||
    v === undefined ||
    v === ""
  ) {
    return null;
  }

  const raw =
    String(v)
      .trim()
      .replace(/,/g, "");

  const multiplier =
    /K$/i.test(raw)
      ? 1000
      : /M$/i.test(raw)
        ? 1_000_000
        : /B$/i.test(raw)
          ? 1_000_000_000
          : 1;

  const cleaned =
    raw.replace(
      /[%KMB]/gi,
      ""
    );

  const n =
    Number(cleaned);

  return Number.isFinite(n)
    ? n * multiplier
    : null;
}

function eventRule(name) {
  const t =
    String(name || "")
      .toLowerCase();

  if (
    t.includes("non-farm") ||
    t.includes("nonfarm payroll")
  ) {
    return {
      key: "NFP",
      weight: 24,
      strongerIsGoldNegative: true
    };
  }

  if (
    t.includes("core cpi")
  ) {
    return {
      key: "CORE_CPI",
      weight: 22,
      strongerIsGoldNegative: true
    };
  }

  if (
    t.includes("cpi") ||
    t.includes("consumer price")
  ) {
    return {
      key: "CPI",
      weight: 20,
      strongerIsGoldNegative: true
    };
  }

  if (
    t.includes("core pce")
  ) {
    return {
      key: "CORE_PCE",
      weight: 22,
      strongerIsGoldNegative: true
    };
  }

  if (
    t.includes("pce")
  ) {
    return {
      key: "PCE",
      weight: 20,
      strongerIsGoldNegative: true
    };
  }

  if (
    t.includes("unemployment rate")
  ) {
    return {
      key: "UNEMPLOYMENT",
      weight: 18,
      strongerIsGoldNegative: false
    };
  }

  if (
    t.includes("jobless claims") ||
    t.includes("initial claims")
  ) {
    return {
      key: "JOBLESS_CLAIMS",
      weight: 15,
      strongerIsGoldNegative: false
    };
  }

  if (
    t.includes("retail sales")
  ) {
    return {
      key: "RETAIL_SALES",
      weight: 15,
      strongerIsGoldNegative: true
    };
  }

  if (
    t.includes("gdp")
  ) {
    return {
      key: "GDP",
      weight: 16,
      strongerIsGoldNegative: true
    };
  }

  if (
    t.includes("ism") &&
    t.includes("manufacturing")
  ) {
    return {
      key: "ISM_MANUFACTURING",
      weight: 14,
      strongerIsGoldNegative: true
    };
  }

  if (
    t.includes("ism") &&
    (
      t.includes("services") ||
      t.includes("non-manufacturing")
    )
  ) {
    return {
      key: "ISM_SERVICES",
      weight: 14,
      strongerIsGoldNegative: true
    };
  }

  if (
    t.includes("fed") ||
    t.includes("fomc") ||
    t.includes("interest rate")
  ) {
    return {
      key: "FED",
      weight: 24,
      strongerIsGoldNegative: null
    };
  }

  return {
    key: "OTHER",
    weight: 8,
    strongerIsGoldNegative: null
  };
}

function surpriseScore(
  event
) {
  const rule =
    eventRule(
      event.event ||
      event.title
    );

  const actual =
    parseNumberLike(
      event.actual
    );

  const forecast =
    parseNumberLike(
      event.forecast
    );

  if (
    actual === null ||
    forecast === null ||
    rule.strongerIsGoldNegative === null
  ) {
    return {
      score: 0,
      key: rule.key,
      surprise: null,
      interpretable: false
    };
  }

  const denominator =
    Math.max(
      Math.abs(forecast),
      0.0001
    );

  const surprise =
    (
      actual -
      forecast
    ) /
    denominator;

  const normalized =
    Math.max(
      -1,
      Math.min(
        1,
        surprise / 0.15
      )
    );

  const direction =
    rule.strongerIsGoldNegative
      ? -1
      : 1;

  return {
    score:
      normalized *
      rule.weight *
      direction,

    key:
      rule.key,

    surprise,

    interpretable:
      true
  };
}

export async function GET(
  request
) {
  try {
    if (
      !TICKATLAS_API_KEY
    ) {
      return json(
        {
          ok: false,

          error:
            "TICKATLAS_API_KEY non configurata su Vercel."
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

    const hours =
      Math.min(
        168,
        Math.max(
          1,
          Number(
            searchParams.get(
              "hours"
            ) || 24
          )
        )
      );

    const impact =
      (
        searchParams.get(
          "impact"
        ) ||
        "high"
      ).toLowerCase();

    const currencies =
      (
        searchParams.get(
          "currencies"
        ) ||
        "USD"
      ).toUpperCase();

    const url =
      `${TICKATLAS_BASE}` +
      `?next_hours=${encodeURIComponent(hours)}` +
      `&impact=${encodeURIComponent(impact)}` +
      `&currencies=${encodeURIComponent(currencies)}` +
      `&limit=100`;

    const response =
      await fetch(
        url,
        {
          headers: {
            "X-API-Key":
              TICKATLAS_API_KEY,

            Accept:
              "application/json"
          },

          cache:
            "no-store"
        }
      );

    const text =
      await response.text();

    let data;

    try {
      data =
        JSON.parse(text);
    }

    catch {
      return json(
        {
          ok: false,

          source:
            "TICKATLAS",

          status:
            response.status,

          error:
            "TickAtlas ha restituito una risposta non JSON.",

          detail:
            text.slice(
              0,
              500
            )
        },
        502
      );
    }

    if (!response.ok) {
      return json(
        {
          ok: false,

          source:
            "TICKATLAS",

          status:
            response.status,

          error:
            data?.message ||
            data?.error ||
            `TickAtlas HTTP ${response.status}`,

          detail:
            data
        },
        response.status
      );
    }

    const events =
      Array.isArray(
        data?.data?.events
      )
        ? data.data.events
        : Array.isArray(
            data?.events
          )
          ? data.events
          : [];

    const now =
      Date.now();

    const normalized =
      events.map(
        event => {
          const datetime =
            normalizeText(
              event.datetime ||
              event.time
            );

          const eventName =
            normalizeText(
              event.event ||
              event.title
            );

          const ts =
            datetime
              ? new Date(
                  datetime
                ).getTime()
              : NaN;

          const mins =
            Number.isFinite(ts)
              ? (
                  ts -
                  now
                ) /
                60000
              : null;

          const surprise =
            surpriseScore(
              event
            );

          return {
            datetime,

            minutesFromNow:
              mins !== null
                ? Number(
                    mins.toFixed(1)
                  )
                : null,

            currency:
              normalizeText(
                event.currency
              ),

            impact:
              normalizeText(
                event.impact
              ).toLowerCase(),

            event:
              eventName,

            forecast:
              event.forecast ??
              null,

            previous:
              event.previous ??
              null,

            actual:
              event.actual ??
              null,

            macroKey:
              surprise.key,

            goldScore:
              Number(
                surprise.score
                  .toFixed(2)
              ),

            surprise:
              surprise.surprise !==
              null
                ? Number(
                    surprise.surprise
                      .toFixed(4)
                  )
                : null,

            interpretable:
              surprise.interpretable
          };
        }
      );

    const released =
      normalized.filter(
        e =>
          e.actual !== null &&
          e.actual !== "" &&
          e.minutesFromNow !== null &&
          e.minutesFromNow <= 0 &&
          e.minutesFromNow >= -360
      );

    const upcoming =
      normalized.filter(
        e =>
          e.minutesFromNow !== null &&
          e.minutesFromNow > 0
      );

    let eventScore =
      released.reduce(
        (
          sum,
          e
        ) =>
          sum +
          e.goldScore,
        0
      );

    eventScore =
      Math.max(
        -65,
        Math.min(
          65,
          eventScore
        )
      );

    const nextHighImpact =
      upcoming.length
        ? upcoming[0]
        : null;

    let eventRisk =
      "LOW";

    if (
      nextHighImpact &&
      nextHighImpact
        .minutesFromNow <= 30
    ) {
      eventRisk =
        "VERY_HIGH";
    }

    else if (
      nextHighImpact &&
      nextHighImpact
        .minutesFromNow <= 90
    ) {
      eventRisk =
        "HIGH";
    }

    else if (
      nextHighImpact &&
      nextHighImpact
        .minutesFromNow <= 180
    ) {
      eventRisk =
        "MEDIUM";
    }

    const bias =
      eventScore >= 15
        ? "BULLISH_GOLD"

        : eventScore <= -15
          ? "BEARISH_GOLD"

          : "NEUTRAL";

    return json({
      ok: true,

      source:
        "TICKATLAS",

      generatedAt:
        new Date()
          .toISOString(),

      engineVersion:
        "TICKATLAS-CALENDAR-V1",

      query: {
        hours,
        impact,
        currencies
      },

      calendar: {
        score:
          Number(
            eventScore.toFixed(1)
          ),

        bias,

        eventRisk,

        nextHighImpact
      },

      releasedEvents:
        released,

      upcomingEvents:
        upcoming,

      events:
        normalized,

      counts: {
        total:
          normalized.length,

        released:
          released.length,

        upcoming:
          upcoming.length
      },

      note:
        "TickAtlas Calendar V1: gli eventi già pubblicati possono contribuire allo score macro; gli eventi futuri aumentano soprattutto il rischio operativo."
    });
  }

  catch (error) {
    console.error(
      "TickAtlas Calendar error:",
      error
    );

    return json(
      {
        ok: false,

        source:
          "TICKATLAS",

        error:
          error?.message ||
          String(error)
      },
      500
    );
  }
}
