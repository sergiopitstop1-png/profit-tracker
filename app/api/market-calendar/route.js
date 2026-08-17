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

/*
============================================================
CLASSIFICAZIONE EVENTI MACRO

IMPORTANTE:
Le regole specifiche "Philly Fed", "Richmond Fed" ecc.
DEVONO stare prima della regola generica "Fed/FOMC",
altrimenti vengono scambiati per eventi di politica monetaria.
============================================================
*/

function eventRule(name) {
  const t =
    String(name || "")
      .toLowerCase();

  /*
  ------------------------------------------------------------
  OCCUPAZIONE
  ------------------------------------------------------------
  */

  if (
    t.includes("non-farm") ||
    t.includes("nonfarm payroll") ||
    t.includes("non farm payroll")
  ) {
    return {
      key: "NFP",
      weight: 24,
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
    t.includes("initial claims") ||
    t.includes("unemployment claims")
  ) {
    return {
      key: "JOBLESS_CLAIMS",
      weight: 15,
      strongerIsGoldNegative: false
    };
  }

  if (
    t.includes("adp") &&
    t.includes("employment")
  ) {
    return {
      key: "ADP_EMPLOYMENT",
      weight: 13,
      strongerIsGoldNegative: true
    };
  }

  /*
  ------------------------------------------------------------
  INFLAZIONE
  ------------------------------------------------------------
  */

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
    t.includes("ppi") ||
    t.includes("producer price")
  ) {
    return {
      key: "PPI",
      weight: 14,
      strongerIsGoldNegative: true
    };
  }

  /*
  ------------------------------------------------------------
  CONSUMI / ATTIVITÀ ECONOMICA
  ------------------------------------------------------------
  */

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
    t.includes("industrial production")
  ) {
    return {
      key: "INDUSTRIAL_PRODUCTION",
      weight: 11,
      strongerIsGoldNegative: true
    };
  }

  if (
    t.includes("durable goods")
  ) {
    return {
      key: "DURABLE_GOODS",
      weight: 11,
      strongerIsGoldNegative: true
    };
  }

  /*
  ------------------------------------------------------------
  ISM / PMI
  ------------------------------------------------------------
  */

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
    t.includes("manufacturing pmi")
  ) {
    return {
      key: "MANUFACTURING_PMI",
      weight: 11,
      strongerIsGoldNegative: true
    };
  }

  if (
    t.includes("services pmi")
  ) {
    return {
      key: "SERVICES_PMI",
      weight: 11,
      strongerIsGoldNegative: true
    };
  }

  /*
  ------------------------------------------------------------
  INDICI REGIONALI FED

  DEVONO STARE PRIMA DELLA REGOLA GENERICA FED/FOMC
  ------------------------------------------------------------
  */

  if (
    t.includes("philly fed") ||
    t.includes("philadelphia fed") ||
    t.includes("empire state") ||
    t.includes("richmond fed") ||
    t.includes("dallas fed") ||
    t.includes("kansas city fed")
  ) {
    return {
      key: "REGIONAL_ACTIVITY",
      weight: 10,
      strongerIsGoldNegative: true
    };
  }

  /*
  ------------------------------------------------------------
  FIDUCIA / SENTIMENT
  ------------------------------------------------------------
  */

  if (
    t.includes("consumer confidence") ||
    t.includes("consumer sentiment") ||
    t.includes("michigan consumer")
  ) {
    return {
      key: "CONSUMER_SENTIMENT",
      weight: 9,
      strongerIsGoldNegative: true
    };
  }

  /*
  ------------------------------------------------------------
  FED / FOMC / POLITICA MONETARIA

  Qui strongerIsGoldNegative = null perché:
  - verbali FOMC
  - discorsi Fed
  - decisioni tassi

  spesso non sono valori numerici confrontabili direttamente
  con forecast/actual.
  ------------------------------------------------------------
  */

  if (
    t.includes("fomc") ||
    t.includes("federal reserve") ||
    t.includes("interest rate decision") ||
    t.includes("fed chair") ||
    t.includes("powell")
  ) {
    return {
      key: "FED",
      weight: 24,
      strongerIsGoldNegative: null
    };
  }

  /*
  ------------------------------------------------------------
  EVENTI NON CLASSIFICATI
  ------------------------------------------------------------
  */

  return {
    key: "OTHER",
    weight: 8,
    strongerIsGoldNegative: null
  };
}

/*
============================================================
CALCOLO SURPRISE

score > 0  => tendenzialmente favorevole all'oro
score < 0  => tendenzialmente sfavorevole all'oro
============================================================
*/

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

  /*
    Surprise normalizzata.

    A circa +/-15% rispetto al consensus
    consideriamo la sorpresa già molto forte.
  */

  const normalized =
    Math.max(
      -1,
      Math.min(
        1,
        surprise / 0.15
      )
    );

  /*
    Esempio CPI:
    actual > forecast
    => più inflazione
    => possibile pressione rialzista sui rendimenti/USD
    => normalmente negativo per oro.

    Esempio unemployment:
    actual > forecast
    => mercato lavoro più debole
    => potenzialmente positivo per oro.
  */

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

/*
============================================================
GET
============================================================
*/

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

    /*
    ----------------------------------------------------------
    PARAMETRI
    ----------------------------------------------------------
    */

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

    /*
    ----------------------------------------------------------
    URL TICKATLAS
    ----------------------------------------------------------
    */

    const url =
      `${TICKATLAS_BASE}` +
      `?next_hours=${encodeURIComponent(hours)}` +
      `&impact=${encodeURIComponent(impact)}` +
      `&currencies=${encodeURIComponent(currencies)}` +
      `&limit=100`;

    /*
    ----------------------------------------------------------
    REQUEST
    ----------------------------------------------------------
    */

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

    /*
    ----------------------------------------------------------
    EVENTI
    ----------------------------------------------------------
    */

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

    /*
    ----------------------------------------------------------
    NORMALIZZAZIONE EVENTI
    ----------------------------------------------------------
    */

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

    /*
    ----------------------------------------------------------
    EVENTI GIÀ PUBBLICATI

    Consideriamo solo le ultime 6 ore.
    ----------------------------------------------------------
    */

    const released =
      normalized.filter(
        e =>
          e.actual !== null &&
          e.actual !== "" &&
          e.minutesFromNow !== null &&
          e.minutesFromNow <= 0 &&
          e.minutesFromNow >= -360
      );

    /*
    ----------------------------------------------------------
    EVENTI FUTURI
    ----------------------------------------------------------
    */

    const upcoming =
      normalized
        .filter(
          e =>
            e.minutesFromNow !== null &&
            e.minutesFromNow > 0
        )
        .sort(
          (a, b) =>
            a.minutesFromNow -
            b.minutesFromNow
        );

    /*
    ----------------------------------------------------------
    SCORE EVENTI PUBBLICATI
    ----------------------------------------------------------
    */

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

    /*
    ----------------------------------------------------------
    PROSSIMO EVENTO
    ----------------------------------------------------------
    */

    const nextHighImpact =
      upcoming.length
        ? upcoming[0]
        : null;

    /*
    ----------------------------------------------------------
    RISCHIO EVENTO
    ----------------------------------------------------------
    */

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

    /*
    ----------------------------------------------------------
    BIAS CALENDARIO
    ----------------------------------------------------------
    */

    const bias =
      eventScore >= 15
        ? "BULLISH_GOLD"

        : eventScore <= -15
          ? "BEARISH_GOLD"

          : "NEUTRAL";

    /*
    ----------------------------------------------------------
    EVENTI FED SPECIFICI
    ----------------------------------------------------------
    */

    const fedEvents =
      normalized.filter(
        e =>
          e.macroKey ===
          "FED"
      );

    const regionalFedEvents =
      normalized.filter(
        e =>
          e.macroKey ===
          "REGIONAL_ACTIVITY"
      );

    /*
    ----------------------------------------------------------
    RISPOSTA
    ----------------------------------------------------------
    */

    return json({
      ok: true,

      source:
        "TICKATLAS",

      generatedAt:
        new Date()
          .toISOString(),

      engineVersion:
        "TICKATLAS-CALENDAR-V1.1",

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

      fedEvents,

      regionalFedEvents,

      events:
        normalized,

      counts: {
        total:
          normalized.length,

        released:
          released.length,

        upcoming:
          upcoming.length,

        fed:
          fedEvents.length,

        regionalFed:
          regionalFedEvents.length
      },

      note:
        "TickAtlas Calendar V1.1: FOMC/Fed separati dagli indicatori regionali Fed. Gli eventi già pubblicati possono contribuire allo score macro; gli eventi futuri aumentano soprattutto il rischio operativo."
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

        engineVersion:
          "TICKATLAS-CALENDAR-V1.1",

        error:
          error?.message ||
          String(error)
      },
      500
    );
  }
}
