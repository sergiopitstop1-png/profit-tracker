// Market Engine V2.3 — MT5 PRICE + FRED MACRO + TickAtlas EVENT RISK

export const dynamic = "force-dynamic";
export const revalidate = 0;

const MASSIVE_BASE = "https://api.massive.com";

const SUPABASE_URL =
  process.env.NEXT_PUBLIC_SUPABASE_URL ||
  process.env.SUPABASE_URL;

const SUPABASE_SERVICE_ROLE_KEY =
  process.env.SUPABASE_SERVICE_ROLE_KEY;

const MT5_FEED_MAX_AGE_MS = 90_000;
const M15_MAX_BAR_AGE_MS = 45 * 60 * 1000;
const H1_MAX_BAR_AGE_MS = 120 * 60 * 1000;

const SUPPORTED = new Set([
  "XAUUSD", "XAGUSD", "EURUSD", "GBPUSD", "USDJPY",
  "USDCHF", "USDCAD", "AUDUSD", "NZDUSD", "EURGBP",
  "EURJPY", "EURCHF", "EURAUD", "GBPJPY", "GBPCHF",
  "GBPAUD", "AUDJPY", "CADJPY", "CHFJPY", "NZDJPY"
]);

const TF = {
  M15: { multiplier: 15, timespan: "minute", days: 14 },
  H1: { multiplier: 1, timespan: "hour", days: 380 },
};

const CACHE_TTL = 120_000;
globalThis.__propMarketCache ??= new Map();

const ENGINE_TZ = "Europe/Rome";

function isoDate(d) {
  return d.toISOString().slice(0, 10);
}

async function fetchBars(symbol, cfg, apiKey) {
  const to = new Date();

  const from = new Date(
    to.getTime() -
    cfg.days * 86400000
  );

  const ticker = `C:${symbol}`;

  const url =
    `${MASSIVE_BASE}/v2/aggs/ticker/${encodeURIComponent(ticker)}` +
    `/range/${cfg.multiplier}/${cfg.timespan}/${isoDate(from)}/${isoDate(to)}` +
    `?adjusted=true&sort=asc&limit=50000&apiKey=${encodeURIComponent(apiKey)}`;

  const r = await fetch(
    url,
    { cache: "no-store" }
  );

  const j = await r.json();

  if (
    !r.ok ||
    j?.status === "ERROR"
  ) {
    throw new Error(
      j?.error ||
      j?.message ||
      `Massive HTTP ${r.status}`
    );
  }

  const bars =
    Array.isArray(j?.results)
      ? j.results
          .map(x => ({
            t: Number(x.t),
            o: Number(x.o),
            h: Number(x.h),
            l: Number(x.l),
            c: Number(x.c),
            v: Number(x.v || 0),
          }))
          .filter(x =>
            [x.t, x.o, x.h, x.l, x.c]
              .every(Number.isFinite)
          )
      : [];

  if (bars.length < 60) {
    throw new Error(
      `${symbol} ${cfg.timespan}: dati insufficienti (${bars.length} barre)`
    );
  }

  return bars;
}

function normalizeBars(arr) {
  if (!Array.isArray(arr)) return [];

  return arr
    .map(b => ({
      t: Number(b?.t),
      o: Number(b?.o),
      h: Number(b?.h),
      l: Number(b?.l),
      c: Number(b?.c),
      v: Number(b?.v || 0)
    }))
    .filter(b =>
      [b.t, b.o, b.h, b.l, b.c]
        .every(Number.isFinite)
    )
    .sort((a, b) => a.t - b.t);
}

async function fetchMt5MarketFeed(symbol) {
  if (
    !SUPABASE_URL ||
    !SUPABASE_SERVICE_ROLE_KEY
  ) {
    return {
      ok: false,
      reason: "SUPABASE_ENV_MISSING"
    };
  }

  const url =
    `${SUPABASE_URL}/rest/v1/prop_market_feed` +
    `?market_key=eq.${encodeURIComponent(symbol)}` +
    `&select=market_key,source_symbol,account_login,account_server,account_company,terminal_time,last_m15_time,last_h1_time,m15,h1,updated_at` +
    `&limit=1`;

  const r = await fetch(url, {
    method: "GET",

    headers: {
      apikey: SUPABASE_SERVICE_ROLE_KEY,
      Authorization: `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`,
      "Content-Type": "application/json"
    },

    cache: "no-store"
  });

  if (!r.ok) {
    return {
      ok: false,
      reason: `SUPABASE_HTTP_${r.status}`,
      detail: await r.text()
    };
  }

  const rows = await r.json();

  const row =
    Array.isArray(rows)
      ? rows[0]
      : null;

  if (!row) {
    return {
      ok: false,
      reason: "NO_MT5_FEED"
    };
  }

  const m15 = normalizeBars(row.m15);
  const h1 = normalizeBars(row.h1);

  if (
    m15.length < 60 ||
    h1.length < 60
  ) {
    return {
      ok: false,
      reason: "MT5_BARS_INSUFFICIENT",
      m15Count: m15.length,
      h1Count: h1.length
    };
  }

  const updatedMs =
    new Date(
      row.updated_at || 0
    ).getTime();

  const feedAgeMs =
    Number.isFinite(updatedMs)
      ? Math.max(
          0,
          Date.now() - updatedMs
        )
      : Infinity;

  const lastM15Ms =
    m15[m15.length - 1]?.t || 0;

  const lastH1Ms =
    h1[h1.length - 1]?.t || 0;

  const m15AgeMs =
    lastM15Ms
      ? Math.max(
          0,
          Date.now() - lastM15Ms
        )
      : Infinity;

  const h1AgeMs =
    lastH1Ms
      ? Math.max(
          0,
          Date.now() - lastH1Ms
        )
      : Infinity;

  const live =
    feedAgeMs <= MT5_FEED_MAX_AGE_MS &&
    m15AgeMs <= M15_MAX_BAR_AGE_MS &&
    h1AgeMs <= H1_MAX_BAR_AGE_MS;

  return {
    ok: true,
    live,
    row,
    m15,
    h1,
    feedAgeMs,
    m15AgeMs,
    h1AgeMs
  };
}

function validateBarFreshness(
  m15Bars,
  h1Bars
) {
  const now = Date.now();

  const lastM15 =
    m15Bars?.[
      m15Bars.length - 1
    ]?.t || 0;

  const lastH1 =
    h1Bars?.[
      h1Bars.length - 1
    ]?.t || 0;

  const m15AgeMs =
    lastM15
      ? Math.max(
          0,
          now - lastM15
        )
      : Infinity;

  const h1AgeMs =
    lastH1
      ? Math.max(
          0,
          now - lastH1
        )
      : Infinity;

  return {
    live:
      m15AgeMs <= M15_MAX_BAR_AGE_MS &&
      h1AgeMs <= H1_MAX_BAR_AGE_MS,

    m15AgeMs,
    h1AgeMs,
    lastM15,
    lastH1
  };
}

function waitCombined(
  reason,
  feedMeta = {}
) {
  return {
    bias: "NEUTRAL",
    score: 0,
    confidence: 0,
    propDirection: "WAIT",
    signalStrength: "INSUFFICIENT",
    forecastDirection: "WAIT",
    forecastCondition: "NO_LIVE_DATA",
    horizon: "0-3H",

    agreement: {
      agreeCount: 0,
      conflictCount: 0,
      session: 0,
      rolling: 0,
      blocks: 0,
      micro: 0
    },

    reasons: [
      reason ||
      "Feed di mercato non sufficientemente fresco: segnale bloccato."
    ],

    feedGuard: feedMeta
  };
}

function ema(values, period) {
  if (!values.length) return [];

  const k =
    2 / (period + 1);

  const out =
    new Array(
      values.length
    ).fill(null);

  if (
    values.length <
    period
  ) {
    return out;
  }

  let seed = 0;

  for (
    let i = 0;
    i < period;
    i++
  ) {
    seed += values[i];
  }

  let prev =
    seed / period;

  out[period - 1] =
    prev;

  for (
    let i = period;
    i < values.length;
    i++
  ) {
    prev =
      values[i] * k +
      prev * (1 - k);

    out[i] =
      prev;
  }

  return out;
}

function rsi(
  values,
  period = 14
) {
  const out =
    new Array(
      values.length
    ).fill(null);

  if (
    values.length <=
    period
  ) {
    return out;
  }

  let gain = 0;
  let loss = 0;

  for (
    let i = 1;
    i <= period;
    i++
  ) {
    const d =
      values[i] -
      values[i - 1];

    gain +=
      Math.max(d, 0);

    loss +=
      Math.max(-d, 0);
  }

  let avgGain =
    gain / period;

  let avgLoss =
    loss / period;

  out[period] =
    avgLoss === 0
      ? 100
      : 100 -
        100 /
        (
          1 +
          avgGain /
          avgLoss
        );

  for (
    let i = period + 1;
    i < values.length;
    i++
  ) {
    const d =
      values[i] -
      values[i - 1];

    const g =
      Math.max(d, 0);

    const l =
      Math.max(-d, 0);

    avgGain =
      (
        avgGain *
        (period - 1) +
        g
      ) / period;

    avgLoss =
      (
        avgLoss *
        (period - 1) +
        l
      ) / period;

    out[i] =
      avgLoss === 0
        ? 100
        : 100 -
          100 /
          (
            1 +
            avgGain /
            avgLoss
          );
  }

  return out;
}

function atr(
  bars,
  period = 14
) {
  const tr =
    bars.map(
      (b, i) => {
        if (i === 0) {
          return b.h - b.l;
        }

        const pc =
          bars[i - 1].c;

        return Math.max(
          b.h - b.l,
          Math.abs(b.h - pc),
          Math.abs(b.l - pc)
        );
      }
    );

  const out =
    new Array(
      bars.length
    ).fill(null);

  if (
    bars.length <
    period
  ) {
    return out;
  }

  let seed = 0;

  for (
    let i = 0;
    i < period;
    i++
  ) {
    seed += tr[i];
  }

  let prev =
    seed / period;

  out[period - 1] =
    prev;

  for (
    let i = period;
    i < bars.length;
    i++
  ) {
    prev =
      (
        prev *
        (period - 1) +
        tr[i]
      ) / period;

    out[i] =
      prev;
  }

  return out;
}

function macd(
  values,
  fast = 12,
  slow = 26,
  signalPeriod = 9
) {
  const ef =
    ema(
      values,
      fast
    );

  const es =
    ema(
      values,
      slow
    );

  const line =
    values.map(
      (_, i) =>
        Number.isFinite(ef[i]) &&
        Number.isFinite(es[i])
          ? ef[i] - es[i]
          : null
    );

  const compact = [];
  const indexMap = [];

  line.forEach(
    (v, i) => {
      if (
        Number.isFinite(v)
      ) {
        compact.push(v);
        indexMap.push(i);
      }
    }
  );

  const sigCompact =
    ema(
      compact,
      signalPeriod
    );

  const signal =
    new Array(
      values.length
    ).fill(null);

  indexMap.forEach(
    (
      originalIndex,
      compactIndex
    ) => {
      signal[
        originalIndex
      ] =
        sigCompact[
          compactIndex
        ];
    }
  );

  const histogram =
    values.map(
      (_, i) =>
        Number.isFinite(line[i]) &&
        Number.isFinite(signal[i])
          ? line[i] - signal[i]
          : null
    );

  return {
    line,
    signal,
    histogram
  };
}

function lastFinite(arr) {
  for (
    let i =
      arr.length - 1;
    i >= 0;
    i--
  ) {
    if (
      Number.isFinite(
        arr[i]
      )
    ) {
      return arr[i];
    }
  }

  return null;
}

function clamp(
  v,
  min,
  max
) {
  return Math.max(
    min,
    Math.min(
      max,
      v
    )
  );
}

function signLabel(
  v,
  threshold = 0
) {
  if (v > threshold) {
    return "BUY";
  }

  if (v < -threshold) {
    return "SELL";
  }

  return "NEUTRAL";
}

function zonedParts(ts) {
  const parts =
    new Intl.DateTimeFormat(
      "en-CA",
      {
        timeZone: ENGINE_TZ,
        year: "numeric",
        month: "2-digit",
        day: "2-digit",
        hour: "2-digit",
        minute: "2-digit",
        hourCycle: "h23"
      }
    ).formatToParts(
      new Date(ts)
    );

  const out = {};

  for (
    const p of parts
  ) {
    if (
      p.type !==
      "literal"
    ) {
      out[p.type] =
        p.value;
    }
  }

  return {
    dateKey:
      `${out.year}-${out.month}-${out.day}`,

    hour:
      Number(out.hour),

    minute:
      Number(out.minute)
  };
}

function pct(
  from,
  to
) {
  if (
    !Number.isFinite(from) ||
    !Number.isFinite(to) ||
    from === 0
  ) {
    return 0;
  }

  return (
    (
      to - from
    ) /
    Math.abs(from)
  ) * 100;
}

function atrUnits(
  from,
  to,
  atrValue
) {
  if (
    !Number.isFinite(from) ||
    !Number.isFinite(to) ||
    !Number.isFinite(atrValue) ||
    atrValue <= 0
  ) {
    return 0;
  }

  return (
    to - from
  ) / atrValue;
}

function rollingMoveFromM15(
  bars,
  barCount,
  atrValue
) {
  if (
    !Array.isArray(bars) ||
    bars.length <
      barCount + 1
  ) {
    return {
      dollars: 0,
      pct: 0,
      atr: 0,
      direction: "NEUTRAL"
    };
  }

  const end =
    bars[
      bars.length - 1
    ].c;

  const start =
    bars[
      bars.length -
      1 -
      barCount
    ].c;

  const dollars =
    end - start;

  const movePct =
    pct(
      start,
      end
    );

  const atrMove =
    atrUnits(
      start,
      end,
      atrValue
    );

  return {
    dollars,
    pct: movePct,
    atr: atrMove,

    direction:
      signLabel(
        atrMove,
        0.15
      )
  };
}

function buildThreeHourBlocks(
  m15Bars,
  atrValue
) {
  const byBlock =
    new Map();

  for (
    const b of m15Bars
  ) {
    const zp =
      zonedParts(b.t);

    const blockIndex =
      Math.floor(
        zp.hour / 3
      );

    const startHour =
      blockIndex * 3;

    const key =
      `${zp.dateKey}-${String(startHour).padStart(2, "0")}`;

    if (
      !byBlock.has(key)
    ) {
      byBlock.set(
        key,
        {
          key,
          dateKey: zp.dateKey,
          startHour,
          endHour: startHour + 3,
          open: b.o,
          high: b.h,
          low: b.l,
          close: b.c,
          firstTs: b.t,
          lastTs: b.t,
          bars: 1
        }
      );
    }

    else {
      const x =
        byBlock.get(key);

      x.high =
        Math.max(
          x.high,
          b.h
        );

      x.low =
        Math.min(
          x.low,
          b.l
        );

      x.close =
        b.c;

      x.lastTs =
        b.t;

      x.bars += 1;
    }
  }

  return [
    ...byBlock.values()
  ]
    .sort(
      (a, b) =>
        a.firstTs -
        b.firstTs
    )
    .map(x => {
      const move =
        x.close -
        x.open;

      const movePct =
        pct(
          x.open,
          x.close
        );

      const atrMove =
        Number.isFinite(
          atrValue
        ) &&
        atrValue > 0
          ? move /
            atrValue
          : 0;

      return {
        ...x,

        label:
                  `${String(x.startHour).padStart(2, "0")}–${String(x.endHour).padStart(2, "0")}`,

        move,
        movePct,
        atrMove,

        direction:
          signLabel(
            atrMove,
            0.12
          ),

        complete:
          x.bars >= 10
      };
    });
}

function currentSessionStats(
  m15Bars,
  atrValue
) {
  const latest =
    m15Bars[
      m15Bars.length - 1
    ];

  const currentDateKey =
    zonedParts(
      latest.t
    ).dateKey;

  const today =
    m15Bars.filter(
      b =>
        zonedParts(
          b.t
        ).dateKey ===
        currentDateKey
    );

  const open =
    today[0]?.o ??
    latest.o;

  const high =
    Math.max(
      ...today.map(
        b => b.h
      )
    );

  const low =
    Math.min(
      ...today.map(
        b => b.l
      )
    );

  const current =
    latest.c;

  const move =
    current - open;

  const movePct =
    pct(
      open,
      current
    );

  const range =
    Math.max(
      high - low,
      1e-9
    );

  const positionInRange =
    (
      current -
      low
    ) / range;

  const moveAtr =
    Number.isFinite(
      atrValue
    ) &&
    atrValue > 0
      ? move /
        atrValue
      : 0;

  const last16 =
    today.slice(-16);

  let structure =
    "MIXED";

  let structureScore =
    0;

  if (
    last16.length >= 12
  ) {
    const split =
      Math.floor(
        last16.length / 2
      );

    const older =
      last16.slice(
        0,
        split
      );

    const newer =
      last16.slice(
        split
      );

    const oldHigh =
      Math.max(
        ...older.map(
          b => b.h
        )
      );

    const oldLow =
      Math.min(
        ...older.map(
          b => b.l
        )
      );

    const newHigh =
      Math.max(
        ...newer.map(
          b => b.h
        )
      );

    const newLow =
      Math.min(
        ...newer.map(
          b => b.l
        )
      );

    if (
      newHigh > oldHigh &&
      newLow > oldLow
    ) {
      structure =
        "HH_HL";

      structureScore =
        1;
    }

    else if (
      newHigh < oldHigh &&
      newLow < oldLow
    ) {
      structure =
        "LH_LL";

      structureScore =
        -1;
    }
  }

  let score = 0;

  score +=
    clamp(
      moveAtr / 3.0,
      -1,
      1
    ) * 42;

  score +=
    clamp(
      (
        positionInRange -
        0.5
      ) / 0.45,
      -1,
      1
    ) * 24;

  score +=
    structureScore *
    24;

  const recent =
    today.slice(-8);

  if (
    recent.length >= 4
  ) {
    const bodyPressure =
      recent.reduce(
        (s, b) => {
          const r =
            Math.max(
              b.h - b.l,
              1e-9
            );

          return (
            s +
            (
              (
                b.c -
                b.o
              ) /
              r
            )
          );
        },
        0
      ) /
      recent.length;

    score +=
      clamp(
        bodyPressure,
        -1,
        1
      ) * 10;
  }

  score =
    clamp(
      score,
      -100,
      100
    );

  const regime =
    score >= 24
      ? "BULLISH"

      : score <= -24
        ? "BEARISH"

        : "NEUTRAL";

  return {
    dateKey:
      currentDateKey,

    open,
    high,
    low,
    current,
    move,
    movePct,
    moveAtr,
    positionInRange,
    structure,

    score:
      Number(
        score.toFixed(1)
      ),

    regime
  };
}

function analyzeCompactTimeframe(
  bars,
  name
) {
  const closes =
    bars.map(
      b => b.c
    );

  const ema20A =
    ema(
      closes,
      20
    );

  const ema50A =
    ema(
      closes,
      50
    );

  const rsiA =
    rsi(
      closes,
      14
    );

  const atrA =
    atr(
      bars,
      14
    );

  const macdA =
    macd(closes);

  const close =
    closes[
      closes.length - 1
    ];

  const e20 =
    lastFinite(
      ema20A
    );

  const e50 =
    lastFinite(
      ema50A
    );

  const r =
    lastFinite(
      rsiA
    );

  const a =
    lastFinite(
      atrA
    );

  const hist =
    lastFinite(
      macdA.histogram
    );

  const recent =
    bars.slice(-8);

  const old =
    bars.slice(
      -16,
      -8
    );

  let priceAction =
    0;

  if (
    old.length >= 4 &&
    recent.length >= 4
  ) {
    const oldHigh =
      Math.max(
        ...old.map(
          b => b.h
        )
      );

    const oldLow =
      Math.min(
        ...old.map(
          b => b.l
        )
      );

    const newHigh =
      Math.max(
        ...recent.map(
          b => b.h
        )
      );

    const newLow =
      Math.min(
        ...recent.map(
          b => b.l
        )
      );

    if (
      newHigh > oldHigh &&
      newLow > oldLow
    ) {
      priceAction += 1;
    }

    if (
      newHigh < oldHigh &&
      newLow < oldLow
    ) {
      priceAction -= 1;
    }
  }

  let score = 0;

  const barsBack =
    name === "M15"
      ? 12
      : 3;

  if (
    closes.length >
      barsBack &&
    Number.isFinite(a) &&
    a > 0
  ) {
    const m =
      (
        close -
        closes[
          closes.length -
          1 -
          barsBack
        ]
      ) / a;

    score +=
      clamp(
        m / 2.0,
        -1,
        1
      ) * 42;
  }

  score +=
    priceAction *
    28;

  if (
    Number.isFinite(e20)
  ) {
    score +=
      close > e20
        ? 8
        : -8;
  }

  if (
    Number.isFinite(e20) &&
    Number.isFinite(e50)
  ) {
    score +=
      e20 > e50
        ? 6
        : -6;
  }

  if (
    Number.isFinite(r)
  ) {
    score +=
      clamp(
        (
          r - 50
        ) / 18,
        -1,
        1
      ) * 8;
  }

  if (
    Number.isFinite(hist)
  ) {
    score +=
      hist > 0
        ? 8
        : hist < 0
          ? -8
          : 0;
  }

  score =
    clamp(
      score,
      -100,
      100
    );

  return {
    timeframe: name,

    timestamp:
      bars[
        bars.length - 1
      ]?.t || null,

    lastClose: close,
    atr14: a,
    rsi14: r,
    ema20: e20,
    ema50: e50,
    macdHistogram: hist,
    priceAction,

    score:
      Number(
        score.toFixed(1)
      ),

    bias:
      score >= 20
        ? "BUY"

        : score <= -20
          ? "SELL"

          : "NEUTRAL"
  };
}

function fibonacciContext(
  session,
  current,
  atrValue
) {
  const range =
    Math.max(
      session.high -
      session.low,
      1e-9
    );

  const bullishImpulse =
    session.current >=
    session.open;

  const levels =
    bullishImpulse
      ? {
          r236:
            session.high -
            range * 0.236,

          r382:
            session.high -
            range * 0.382,

          r500:
            session.high -
            range * 0.500,

          r618:
            session.high -
            range * 0.618
        }
      : {
          r236:
            session.low +
            range * 0.236,

          r382:
            session.low +
            range * 0.382,

          r500:
            session.low +
            range * 0.500,

          r618:
            session.low +
            range * 0.618
        };

  const nearest =
    Object.entries(
      levels
    )
      .map(
        ([name, price]) => ({
          name,
          price,

          distance:
            Math.abs(
              current -
              price
            )
        })
      )
      .sort(
        (a, b) =>
          a.distance -
          b.distance
      )[0];

  const nearFib =
    nearest &&
    Number.isFinite(
      atrValue
    ) &&
    atrValue > 0
      ? nearest.distance <=
        atrValue * 0.35
      : false;

  return {
    impulse:
      bullishImpulse
        ? "UP"
        : "DOWN",

    levels,

    nearest:
      nearest || null,

    nearFib
  };
}

/*
============================================================
V2.3 — MACRO CONNECTOR
Legge le due route già operative:

/api/market-fred
/api/market-calendar

Non chiama direttamente FRED/TickAtlas qui.
Così teniamo i moduli separati e facili da testare.
============================================================
*/

async function fetchJsonSafe(
  url,
  timeoutMs = 8000
) {
  const controller =
    new AbortController();

  const timer =
    setTimeout(
      () =>
        controller.abort(),
      timeoutMs
    );

  try {
    const response =
      await fetch(
        url,
        {
          cache:
            "no-store",

          signal:
            controller.signal,

          headers: {
            Accept:
              "application/json"
          }
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
      return {
        ok: false,

        error:
          "Risposta non JSON",

        status:
          response.status
      };
    }

    if (
      !response.ok ||
      data?.ok === false
    ) {
      return {
        ok: false,

        error:
          data?.error ||
          `HTTP ${response.status}`,

        status:
          response.status,

        data
      };
    }

    return {
      ok: true,
      data
    };
  }

  catch (error) {
    return {
      ok: false,

      error:
        error?.name ===
        "AbortError"
          ? "TIMEOUT"
          : error?.message ||
            String(error)
    };
  }

  finally {
    clearTimeout(
      timer
    );
  }
}

async function fetchMacroContext(
  requestUrl
) {
  const origin =
    new URL(
      requestUrl
    ).origin;

  const fredUrl =
    `${origin}/api/market-fred`;

  /*
    Per il motore operativo guardiamo
    gli eventi USD HIGH impact.

    Il calendario medium resta disponibile
    nella route separata per analisi/manuale.
  */

  const calendarUrl =
    `${origin}/api/market-calendar` +
    `?hours=168` +
    `&impact=high` +
    `&currencies=USD`;

  const [
    fredResult,
    calendarResult
  ] =
    await Promise.all([
      fetchJsonSafe(
        fredUrl
      ),

      fetchJsonSafe(
        calendarUrl
      )
    ]);

  const fred =
    fredResult.ok
      ? fredResult.data
      : null;

  const calendar =
    calendarResult.ok
      ? calendarResult.data
      : null;

  return {
    fred,
    calendar,

    health: {
      fred:
        fredResult.ok
          ? "OK"
          : `ERROR: ${
              fredResult.error
            }`,

      calendar:
        calendarResult.ok
          ? "OK"
          : `ERROR: ${
              calendarResult.error
            }`
    }
  };
}

function signalStrengthFromConfidence(
  direction,
  confidence
) {
  if (
    direction === "WAIT"
  ) {
    return "INSUFFICIENT";
  }

  if (
    confidence >= 75
  ) {
    return "STRONG";
  }

  if (
    confidence >= 60
  ) {
    return "GOOD";
  }

  if (
    confidence >= 48
  ) {
    return "WEAK";
  }

  return "INSUFFICIENT";
}

/*
============================================================
MACRO OVERLAY

PRICE ACTION resta dominante.

FRED:
- background lento
- influenza poco lo score

TickAtlas:
- score surprise degli eventi già pubblicati
- eventRisk protegge dalle news imminenti

Regole rischio:

VERY_HIGH:
  blocca nuovi segnali -> WAIT

HIGH:
  non blocca completamente,
  ma limita confidence <= 49

MEDIUM:
  -10 confidence

LOW:
  nessuna penalizzazione
============================================================
*/

function applyMacroOverlay(
  priceForecast,
  macroContext
) {
  const fredScore =
    Number(
      macroContext
        ?.fred
        ?.macro
        ?.score
    );

  const calendarScore =
    Number(
      macroContext
        ?.calendar
        ?.calendar
        ?.score
    );

  const eventRisk =
    macroContext
      ?.calendar
      ?.calendar
      ?.eventRisk ||
    "UNKNOWN";

  const nextEvent =
    macroContext
      ?.calendar
      ?.calendar
      ?.nextHighImpact ||
    null;

  const safeFredScore =
    Number.isFinite(
      fredScore
    )
      ? fredScore
      : 0;

  const safeCalendarScore =
    Number.isFinite(
      calendarScore
    )
      ? calendarScore
      : 0;

  /*
    FRED pesa meno perché è strutturale.
    TickAtlas è più vicino al timing intraday.
  */

  const compositeMacro =
    clamp(
      safeFredScore *
        0.70 +
      safeCalendarScore *
        1.00,

      -65,
      65
    );

  /*
    La macro può spostare il price score
    di MASSIMO 10 punti.

    Quindi non può comandare da sola
    la direzione del Market Engine.
  */

  const macroAdjustment =
    clamp(
      compositeMacro *
        0.15,

      -10,
      10
    );

  const baseScore =
    Number(
      priceForecast.score
    ) || 0;

  let adjustedScore =
    clamp(
      baseScore +
      macroAdjustment,

      -100,
      100
    );

  let direction =
    adjustedScore >= 22
      ? "BUY"

      : adjustedScore <= -22
        ? "SELL"

        : "WAIT";

  /*
    Sicurezza importante:

    la sola macro NON può capovolgere
    direttamente BUY -> SELL
    o SELL -> BUY.

    Se l'overlay attraversa completamente
    lo zero fino al lato opposto,
    trasformiamo il segnale in WAIT.
  */

  if (
    priceForecast.direction !==
      "WAIT" &&
    direction !==
      "WAIT" &&
    direction !==
      priceForecast.direction
  ) {
    direction =
      "WAIT";

    adjustedScore =
      0;
  }

  let confidence =
    Number(
      priceForecast.confidence
    ) || 0;

  const priceSign =
    priceForecast.direction ===
      "BUY"
      ? 1

      : priceForecast.direction ===
        "SELL"
        ? -1

        : 0;

  const macroSign =
    Math.sign(
      compositeMacro
    );

  /*
    Macro allineata:
    bonus massimo +7 confidence.

    Macro contraria:
    penalità massima -10.
  */

  if (
    priceSign !== 0 &&
    Math.abs(
      compositeMacro
    ) >= 15
  ) {
    if (
      macroSign ===
      priceSign
    ) {
      confidence +=
        Math.min(
          7,

          Math.round(
            Math.abs(
              compositeMacro
            ) / 8
          )
        );
    }

    else if (
      macroSign ===
      -priceSign
    ) {
      confidence -=
        Math.min(
          10,

          Math.round(
            Math.abs(
              compositeMacro
            ) / 6
          )
        );
    }
  }

  let condition =
    priceForecast.condition;

  const reasons = [
    ...(
      Array.isArray(
        priceForecast.reasons
      )
        ? priceForecast.reasons
        : []
    )
  ];

  if (
    Number.isFinite(
      fredScore
    )
  ) {
    reasons.push(
      `FRED background ${
        safeFredScore >= 0
          ? "+"
          : ""
      }${safeFredScore.toFixed(1)} • ${
        macroContext
          ?.fred
          ?.macro
          ?.bias ||
        "NEUTRAL"
      }`
    );
  }

  else {
    reasons.push(
      "FRED background non disponibile: nessuna modifica macro strutturale."
    );
  }

  if (
    Number.isFinite(
      calendarScore
    )
  ) {
    reasons.push(
      `TickAtlas event score ${
        safeCalendarScore >= 0
          ? "+"
          : ""
      }${safeCalendarScore.toFixed(1)} • rischio ${eventRisk}`
    );
  }

  else {
    reasons.push(
      "TickAtlas calendar non disponibile: event risk non applicato."
    );
  }

  /*
    Event risk.
  */

  if (
    eventRisk ===
    "VERY_HIGH"
  ) {
    direction =
      "WAIT";

    adjustedScore =
      0;

    confidence =
      0;

    condition =
      "EVENT_RISK_LOCK";

    reasons.push(
      `⛔ Evento USD HIGH impact imminente${
        nextEvent?.event
          ? `: ${nextEvent.event}`
          : ""
      }. Nuovi segnali bloccati.`
    );
  }

  else if (
    eventRisk ===
    "HIGH"
  ) {
    confidence =
      Math.min(
        confidence,
        49
      );

    reasons.push(
      `⚠ Evento USD HIGH impact vicino${
        nextEvent?.event
          ? `: ${nextEvent.event}`
          : ""
      }. Confidence limitata.`
    );
  }

  else if (
    eventRisk ===
    "MEDIUM"
  ) {
    confidence -=
      10;

    reasons.push(
      `⚠ Evento USD HIGH impact nelle prossime ore${
        nextEvent?.event
          ? `: ${nextEvent.event}`
          : ""
      }. Confidence ridotta.`
    );
  }

  confidence =
    Math.round(
      clamp(
        confidence,
        0,
        100
      )
    );

  const propDirection =
    direction === "BUY"
      ? "SELL"

      : direction === "SELL"
        ? "BUY"

        : "WAIT";

  const signalStrength =
    signalStrengthFromConfidence(
      direction,
      confidence
    );

  return {
    ...priceForecast,

    priceScore:
      baseScore,

    score:
      Number(
        adjustedScore.toFixed(1)
      ),

    direction,
    propDirection,
    confidence,
    signalStrength,
    condition,

    macro: {
      fredScore:
        Number.isFinite(
          fredScore
        )
          ? Number(
              safeFredScore
                .toFixed(1)
            )
          : null,

      fredBias:
        macroContext
          ?.fred
          ?.macro
          ?.bias ||
        "UNAVAILABLE",

      calendarScore:
        Number.isFinite(
          calendarScore
        )
          ? Number(
              safeCalendarScore
                .toFixed(1)
            )
          : null,

      calendarBias:
        macroContext
          ?.calendar
          ?.calendar
          ?.bias ||
        "UNAVAILABLE",

      compositeScore:
        Number(
          compositeMacro
            .toFixed(1)
        ),

      adjustment:
        Number(
          macroAdjustment
            .toFixed(1)
        ),

      eventRisk,

      nextHighImpact:
        nextEvent,

      health:
        macroContext
          ?.health ||
        {}
    },

    agreement: {
      ...priceForecast.agreement,

      macro:
        Number(
          compositeMacro
            .toFixed(1)
        )
    },

    reasons
  };
}

/*
============================================================
PRICE FORECAST V2.2
La logica originale del tuo motore resta qui.
L'overlay macro viene applicato DOPO.
============================================================
*/

function buildForecast({
  session,
  blocks,
  rolling,
  m15,
  h1,
  fib
}) {
  const currentDayBlocks =
    blocks.filter(
      b =>
        b.dateKey ===
        session.dateKey
    );

  const recentBlocks =
    currentDayBlocks.slice(-4);

  // Più peso ai blocchi 3H recenti.
  let blockScore = 0;

  if (
    recentBlocks.length
  ) {
    const weights =
      recentBlocks.length === 1
        ? [1]

        : recentBlocks.length === 2
          ? [0.35, 0.65]

          : recentBlocks.length === 3
            ? [0.20, 0.30, 0.50]

            : [0.10, 0.20, 0.30, 0.40];

    blockScore =
      recentBlocks.reduce(
        (sum, b, i) => {
          return (
            sum +
            clamp(
              b.atrMove / 1.8,
              -1,
              1
            ) *
            weights[i]
          );
        },
        0
      ) * 100;
  }

  // Forecast 0–3H:
  // 3H principale, 1H accelerazione,
  // 6H contesto, 12H sfondo.

  const rollingScore =
    clamp(
      clamp(
        rolling.h1.atr / 1.2,
        -1,
        1
      ) * 0.25 +

      clamp(
        rolling.h3.atr / 2.0,
        -1,
        1
      ) * 0.40 +

      clamp(
        rolling.h6.atr / 3.0,
        -1,
        1
      ) * 0.25 +

      clamp(
        rolling.h12.atr / 4.5,
        -1,
        1
      ) * 0.10,

      -1,
      1
    ) * 100;

  // H1 leggermente più importante di M15.

  const microScore =
    m15.score * 0.45 +
    h1.score * 0.55;

  const dayScore =
    session.score;

  const daySign =
    Math.sign(
      dayScore
    );

  const strongDay =
    Math.abs(
      dayScore
    ) >= 55;

  const veryStrongDay =
    Math.abs(
      dayScore
    ) >= 72;

  // Il trend della giornata è la bussola.

  let raw =
    dayScore * 0.38 +
    rollingScore * 0.27 +
    microScore * 0.22 +
    blockScore * 0.13;

  const components = [
    {
      name: "DAY",
      value: dayScore
    },

    {
      name: "ROLLING",
      value: rollingScore
    },

    {
      name: "MICRO",
      value: microScore
    },

    {
      name: "BLOCKS",
      value: blockScore
    }
  ];

  const bullishConfirmations =
    components.filter(
      x =>
        x.value >= 18
    ).length;

  const bearishConfirmations =
    components.filter(
      x =>
        x.value <= -18
    ).length;

  let reversalBlocked =
    false;

  let reversalConfirmed =
    false;

  if (
    strongDay &&
    daySign !== 0 &&
    Math.sign(raw) !== 0 &&
    Math.sign(raw) !== daySign
  ) {
    const oppositeConfirmations =
      daySign > 0
        ? bearishConfirmations
        : bullishConfirmations;

    if (
      oppositeConfirmations >= 3
    ) {
      reversalConfirmed =
        true;
    }

    else {
      reversalBlocked =
        true;

      raw *=
        0.30;
    }
  }

  // Protezione trend molto forte.

  if (
    veryStrongDay &&
    !reversalConfirmed
  ) {
    const rollingSame =
      Math.sign(
        rollingScore
      ) === daySign &&
      Math.abs(
        rollingScore
      ) >= 12;

    const microSame =
      Math.sign(
        microScore
      ) === daySign &&
      Math.abs(
        microScore
      ) >= 12;

    if (
      rollingSame ||
      microSame
    ) {
      const minimumTrendScore =
        daySign * 24;

      if (
        daySign > 0 &&
        raw < minimumTrendScore
      ) {
        raw =
          minimumTrendScore;
      }

      if (
        daySign < 0 &&
        raw > minimumTrendScore
      ) {
        raw =
          minimumTrendScore;
      }
    }
  }

  raw =
    clamp(
      raw,
      -100,
      100
    );

  const direction =
    raw >= 22
      ? "BUY"

      : raw <= -22
        ? "SELL"

        : "WAIT";

  const targetSign =
    direction === "BUY"
      ? 1

      : direction === "SELL"
        ? -1

        : 0;

  let condition =
    "MIXED";

  if (
    direction !== "WAIT"
  ) {
    if (
      targetSign ===
      daySign
    ) {
      if (
        Math.sign(
          rollingScore
        ) === targetSign &&

        Math.sign(
          microScore
        ) === targetSign
      ) {
        condition =
          "CONTINUATION";
      }

      else if (
        Math.sign(
          rollingScore
        ) !== targetSign ||

        Math.sign(
          microScore
        ) !== targetSign
      ) {
        condition =
          "PULLBACK_IN_TREND";
      }

      else {
        condition =
          "TREND";
      }
    }

    else {
      condition =
        reversalConfirmed
          ? "REVERSAL_CONFIRMED"
          : "COUNTERTREND";
    }
  }

  else {
    condition =
      strongDay &&
      Math.sign(
        rollingScore
      ) !== daySign
        ? "TREND_SLOWDOWN"
        : "WAIT";
  }

  const agreeCount =
    targetSign === 0
      ? 0

      : components.filter(
          x =>
            Math.sign(
              x.value
            ) === targetSign &&
            Math.abs(
              x.value
            ) >= 12
        ).length;

  const conflictCount =
    targetSign === 0
      ? components.filter(
          x =>
            Math.abs(
              x.value
            ) >= 18
        ).length

      : components.filter(
          x =>
            Math.sign(
              x.value
            ) === -targetSign &&
            Math.abs(
              x.value
            ) >= 18
        ).length;

  let confidence =
    0;

  if (
    direction === "WAIT"
  ) {
    confidence =
      Math.round(
        clamp(
          Math.abs(raw),
          0,
          39
        )
      );
  }

  else {
    confidence =
      Math.round(
        clamp(
          35 +
          Math.abs(raw) * 0.30 +
          agreeCount * 9 -
          conflictCount * 8,

          0,
          100
        )
      );

    if (
      agreeCount === 4
    ) {
      confidence +=
        7;
    }

    if (
      strongDay &&
      targetSign ===
      daySign
    ) {
      confidence +=
        5;
    }

    if (
      reversalConfirmed
    ) {
      confidence -=
        8;
    }

    confidence =
      Math.round(
        clamp(
          confidence,
          0,
          100
        )
      );
  }

  let signalStrength =
    "INSUFFICIENT";
    if (
    direction !== "WAIT"
  ) {
    if (
      confidence >= 75
    ) {
      signalStrength =
        "STRONG";
    }

    else if (
      confidence >= 60
    ) {
      signalStrength =
        "GOOD";
    }

    else if (
      confidence >= 48
    ) {
      signalStrength =
        "WEAK";
    }
  }

  const propDirection =
    direction === "BUY"
      ? "SELL"

      : direction === "SELL"
        ? "BUY"

        : "WAIT";

  const reasons = [];

  reasons.push(
    `Regime giornata ${
      session.regime === "BULLISH"
        ? "rialzista"

        : session.regime === "BEARISH"
          ? "ribassista"

          : "neutrale"
    }: ${
      session.move >= 0
        ? "+"
        : ""
    }${session.move.toFixed(2)} dal prezzo di apertura`
  );

  reasons.push(
    `Momentum rolling: 1H ${
      rolling.h1.dollars >= 0
        ? "+"
        : ""
    }${rolling.h1.dollars.toFixed(2)} • 3H ${
      rolling.h3.dollars >= 0
        ? "+"
        : ""
    }${rolling.h3.dollars.toFixed(2)} • 6H ${
      rolling.h6.dollars >= 0
        ? "+"
        : ""
    }${rolling.h6.dollars.toFixed(2)}`
  );

  reasons.push(
    `Micro trend: M15 ${m15.bias} (${m15.score}) • H1 ${h1.bias} (${h1.score})`
  );

  if (
    recentBlocks.length
  ) {
    reasons.push(
      `Blocchi 3H: ${
        recentBlocks
          .map(
            b =>
              `${b.label} ${
                b.move >= 0
                  ? "+"
                  : ""
              }${b.move.toFixed(1)}`
          )
          .join(" | ")
      }`
    );
  }

  if (
    reversalBlocked
  ) {
    reasons.push(
      "⚠ Movimento contrario rilevato, ma conferme insufficienti per dichiarare inversione del trend."
    );
  }

  if (
    reversalConfirmed
  ) {
    reasons.push(
      "⚠ Possibile inversione: rolling momentum, micro trend e blocchi 3H confermano il movimento contrario al regime giornaliero."
    );
  }

  if (
    fib?.nearFib &&
    fib?.nearest
  ) {
    reasons.push(
      `Prezzo vicino al livello Fibonacci ${
        fib.nearest.name.replace(
          "r",
          ""
        )
      }% della sessione`
    );
  }

  return {
    score:
      Number(
        raw.toFixed(1)
      ),

    direction,
    propDirection,
    confidence,
    signalStrength,
    condition,
    reversalBlocked,
    reversalConfirmed,

    agreement: {
      agreeCount,
      conflictCount,

      session:
        Number(
          dayScore.toFixed(1)
        ),

      rolling:
        Number(
          rollingScore.toFixed(1)
        ),

      blocks:
        Number(
          blockScore.toFixed(1)
        ),

      micro:
        Number(
          microScore.toFixed(1)
        )
    },

    reasons
  };
}

/*
============================================================
GET — MARKET ENGINE V2.3
============================================================
*/

export async function GET(
  request
) {
  try {
    const {
      searchParams
    } =
      new URL(
        request.url
      );

    const symbol =
      (
        searchParams.get(
          "symbol"
        ) ||
        "XAUUSD"
      )
        .toUpperCase()
        .replace(
          /[^A-Z]/g,
          ""
        );

    const force =
      searchParams.get(
        "force"
      ) === "1";

    if (
      !SUPPORTED.has(
        symbol
      )
    ) {
      return Response.json(
        {
          ok: false,

          error:
            `Simbolo non supportato: ${symbol}`
        },

        {
          status: 400
        }
      );
    }

    // ========================================================
    // CACHE V2.3
    // ========================================================

    const cacheKey =
      `market-v23-${symbol}`;

    const cached =
      globalThis.__propMarketCache.get(
        cacheKey
      );

    if (
      !force &&
      cached &&
      Date.now() -
        cached.ts <
        CACHE_TTL
    ) {
      return Response.json({
        ...cached.data,
        cache: true
      });
    }

    // ========================================================
    // 1. MT5 PRIMARY
    // ========================================================

    let source =
      "MT5";

    let m15Bars = [];
    let h1Bars = [];

    let feedMeta = {};

    const mt5 =
      await fetchMt5MarketFeed(
        symbol
      );

    if (
      mt5.ok &&
      mt5.live
    ) {
      m15Bars =
        mt5.m15;

      h1Bars =
        mt5.h1;

      feedMeta = {
        source:
          "MT5",

        status:
          "LIVE",

        feedAgeSeconds:
          Number(
            (
              mt5.feedAgeMs /
              1000
            ).toFixed(1)
          ),

        m15AgeMinutes:
          Number(
            (
              mt5.m15AgeMs /
              60000
            ).toFixed(1)
          ),

        h1AgeMinutes:
          Number(
            (
              mt5.h1AgeMs /
              60000
            ).toFixed(1)
          ),

        sourceSymbol:
          mt5.row
            ?.source_symbol ||
          symbol,

        accountLogin:
          mt5.row
            ?.account_login ||
          null,

        accountServer:
          mt5.row
            ?.account_server ||
          null,

        accountCompany:
          mt5.row
            ?.account_company ||
          null,

        terminalTime:
          mt5.row
            ?.terminal_time ||
          null,

        lastM15:
          m15Bars[
            m15Bars.length - 1
          ]?.t ||
          null,

        lastH1:
          h1Bars[
            h1Bars.length - 1
          ]?.t ||
          null
      };
    }

    // ========================================================
    // 2. MASSIVE FALLBACK
    // ========================================================

    else {
      source =
        "MASSIVE_FALLBACK";

      const apiKey =
        process.env.MASSIVE_API_KEY ||
        process.env.POLYGON_API_KEY;

      if (
        !apiKey
      ) {
        const combined =
          waitCombined(
            "Feed MT5 non disponibile e MASSIVE_API_KEY assente: nessun segnale operativo.",
            {
              source:
                "NO_LIVE_SOURCE",

              mt5Reason:
                mt5.reason ||
                "MT5_NOT_LIVE"
            }
          );

        const result = {
          ok: true,

          symbol,

          generatedAt:
            new Date()
              .toISOString(),

          engineVersion:
            "V2.3-MT5-MACRO",

          source:
            "NO_LIVE_SOURCE",

          combined
        };

        return Response.json(
          result
        );
      }

      try {
        const [
          massiveM15,
          massiveH1
        ] =
          await Promise.all([
            fetchBars(
              symbol,
              TF.M15,
              apiKey
            ),

            fetchBars(
              symbol,
              TF.H1,
              apiKey
            )
          ]);

        const massiveFresh =
          validateBarFreshness(
            massiveM15,
            massiveH1
          );

        if (
          !massiveFresh.live
        ) {
          const combined =
            waitCombined(
              "MT5 non disponibile e fallback Massive non sufficientemente fresco: segnale bloccato.",
              {
                source:
                  "MASSIVE_FALLBACK",

                mt5Reason:
                  mt5.reason ||
                  "MT5_NOT_LIVE",

                massiveM15AgeMinutes:
                  Number(
                    (
                      massiveFresh
                        .m15AgeMs /
                      60000
                    ).toFixed(1)
                  ),

                massiveH1AgeMinutes:
                  Number(
                    (
                      massiveFresh
                        .h1AgeMs /
                      60000
                    ).toFixed(1)
                  )
              }
            );

          const result = {
            ok: true,

            symbol,

            generatedAt:
              new Date()
                .toISOString(),

            engineVersion:
              "V2.3-MT5-MACRO",

            source:
              "NO_LIVE_SOURCE",

            combined
          };

          return Response.json(
            result
          );
        }

        m15Bars =
          massiveM15;

        h1Bars =
          massiveH1;

        feedMeta = {
          source:
            "MASSIVE_FALLBACK",

          status:
            "LIVE",

          mt5Reason:
            mt5.reason ||
            "MT5_NOT_LIVE",

          m15AgeMinutes:
            Number(
              (
                massiveFresh
                  .m15AgeMs /
                60000
              ).toFixed(1)
            ),

          h1AgeMinutes:
            Number(
              (
                massiveFresh
                  .h1AgeMs /
                60000
              ).toFixed(1)
            ),

          lastM15:
            massiveFresh
              .lastM15,

          lastH1:
            massiveFresh
              .lastH1
        };
      }

      catch (
        massiveError
      ) {
        const combined =
          waitCombined(
            "Nessuna fonte dati live disponibile: segnale operativo bloccato.",
            {
              source:
                "NO_LIVE_SOURCE",

              mt5Reason:
                mt5.reason ||
                "MT5_NOT_LIVE",

              massiveError:
                massiveError
                  ?.message ||
                String(
                  massiveError
                )
            }
          );

        const result = {
          ok: true,

          symbol,

          generatedAt:
            new Date()
              .toISOString(),

          engineVersion:
            "V2.3-MT5-MACRO",

          source:
            "NO_LIVE_SOURCE",

          combined
        };

        return Response.json(
          result
        );
      }
    }

    // ========================================================
    // 3. ANALISI M15 / H1
    // ========================================================

    const m15 =
      analyzeCompactTimeframe(
        m15Bars,
        "M15"
      );

    const h1 =
      analyzeCompactTimeframe(
        h1Bars,
        "H1"
      );

    const atrValue =
      m15.atr14;

    if (
      !Number.isFinite(
        atrValue
      ) ||
      atrValue <= 0
    ) {
      throw new Error(
        "ATR M15 non valido."
      );
    }

    // ========================================================
    // 4. SESSIONE GIORNALIERA
    // ========================================================

    const session =
      currentSessionStats(
        m15Bars,
        atrValue
      );

    // ========================================================
    // 5. BLOCCHI 3H
    // ========================================================

    const blocks =
      buildThreeHourBlocks(
        m15Bars,
        atrValue
      );

    const currentDayBlocks =
      blocks.filter(
        b =>
          b.dateKey ===
          session.dateKey
      );

    // ========================================================
    // 6. ROLLING MOMENTUM
    // ========================================================

    const rolling = {
      h1:
        rollingMoveFromM15(
          m15Bars,
          4,
          atrValue
        ),

      h3:
        rollingMoveFromM15(
          m15Bars,
          12,
          atrValue
        ),

      h6:
        rollingMoveFromM15(
          m15Bars,
          24,
          atrValue
        ),

      h12:
        rollingMoveFromM15(
          m15Bars,
          48,
          atrValue
        ),

      h24:
        rollingMoveFromM15(
          m15Bars,
          96,
          atrValue
        )
    };

    // ========================================================
    // 7. FIBONACCI
    // ========================================================

    const fib =
      fibonacciContext(
        session,
        session.current,
        atrValue
      );

    // ========================================================
    // 8. PRICE FORECAST V2.2
    // ========================================================

    const priceForecast =
      buildForecast({
        session,
        blocks,
        rolling,
        m15,
        h1,
        fib
      });

    // ========================================================
    // 9. MACRO CONTEXT
    // ========================================================

    const macroContext =
      await fetchMacroContext(
        request.url
      );

    // ========================================================
    // 10. FORECAST FINALE V2.3
    // ========================================================

    const forecast =
      applyMacroOverlay(
        priceForecast,
        macroContext
      );

    // ========================================================
    // 11. COMBINED
    // ========================================================

    const combined = {
      bias:
        forecast.direction ===
        "BUY"
          ? "BULLISH"

          : forecast.direction ===
            "SELL"
            ? "BEARISH"

            : "NEUTRAL",

      score:
        forecast.score,

      priceScore:
        forecast.priceScore,

      confidence:
        forecast.confidence,

      propDirection:
        forecast.propDirection,

      signalStrength:
        forecast.signalStrength,

      forecastDirection:
        forecast.direction,

      forecastCondition:
        forecast.condition,

      horizon:
        "0-3H",

      reversalBlocked:
        forecast.reversalBlocked,

      reversalConfirmed:
        forecast.reversalConfirmed,

      agreement:
        forecast.agreement,

      macro:
        forecast.macro,

      reasons:
        forecast.reasons,

      feedGuard:
        feedMeta
    };

    // ========================================================
    // 12. RISPOSTA
    // ========================================================

    const result = {
      ok: true,

      symbol,

      generatedAt:
        new Date()
          .toISOString(),

      engineVersion:
        "V2.3-MT5-MACRO",

      source,

      feed:
        feedMeta,

      /*
      ---------------------------------------------------------
      MACRO CONTEXT RAW
      ---------------------------------------------------------
      */

      macroContext: {
        fred:
          macroContext.fred
            ? {
                ok:
                  true,

                score:
                  macroContext
                    .fred
                    ?.macro
                    ?.score ??
                  null,

                bias:
                  macroContext
                    .fred
                    ?.macro
                    ?.bias ??
                  null,

                strength:
                  macroContext
                    .fred
                    ?.macro
                    ?.strength ??
                  null,

                confidence:
                  macroContext
                    .fred
                    ?.macro
                    ?.confidence ??
                  null,

                reasons:
                  macroContext
                    .fred
                    ?.macro
                    ?.reasons ??
                  []
              }

            : {
                ok:
                  false,

                status:
                  macroContext
                    .health
                    ?.fred ||
                  "UNAVAILABLE"
              },

        calendar:
          macroContext.calendar
            ? {
                ok:
                  true,

                score:
                  macroContext
                    .calendar
                    ?.calendar
                    ?.score ??
                  null,

                bias:
                  macroContext
                    .calendar
                    ?.calendar
                    ?.bias ??
                  null,

                eventRisk:
                  macroContext
                    .calendar
                    ?.calendar
                    ?.eventRisk ??
                  "UNKNOWN",

                nextHighImpact:
                  macroContext
                    .calendar
                    ?.calendar
                    ?.nextHighImpact ??
                  null
              }

            : {
                ok:
                  false,

                status:
                  macroContext
                    .health
                    ?.calendar ||
                  "UNAVAILABLE"
              }
      },

      market: {
        currentPrice:
          session.current,

        sessionOpen:
          session.open,

        sessionHigh:
          session.high,

        sessionLow:
          session.low,

        moveFromOpen:
          Number(
            session.move
              .toFixed(4)
          ),

        moveFromOpenPct:
          Number(
            session.movePct
              .toFixed(4)
          ),

        atrM15:
          Number(
            atrValue
              .toFixed(4)
          )
      },

      session: {
        dateKey:
          session.dateKey,

        regime:
          session.regime,

        score:
          session.score,

        structure:
          session.structure,

        positionInRange:
          Number(
            session.positionInRange
              .toFixed(4)
          ),

        moveAtr:
          Number(
            session.moveAtr
              .toFixed(4)
          )
      },

      rolling: {
        h1: {
          dollars:
            Number(
              rolling.h1
                .dollars
                .toFixed(4)
            ),

          pct:
            Number(
              rolling.h1
                .pct
                .toFixed(4)
            ),

          atr:
            Number(
              rolling.h1
                .atr
                .toFixed(4)
            ),

          direction:
            rolling.h1
              .direction
        },

        h3: {
          dollars:
            Number(
              rolling.h3
                .dollars
                .toFixed(4)
            ),

          pct:
            Number(
              rolling.h3
                .pct
                .toFixed(4)
            ),

          atr:
            Number(
              rolling.h3
                .atr
                .toFixed(4)
            ),

          direction:
            rolling.h3
              .direction
        },

        h6: {
          dollars:
            Number(
              rolling.h6
                .dollars
                .toFixed(4)
            ),

          pct:
            Number(
              rolling.h6
                .pct
                .toFixed(4)
            ),

          atr:
            Number(
              rolling.h6
                .atr
                .toFixed(4)
            ),

          direction:
            rolling.h6
              .direction
        },
                h12: {
          dollars:
            Number(
              rolling.h12
                .dollars
                .toFixed(4)
            ),

          pct:
            Number(
              rolling.h12
                .pct
                .toFixed(4)
            ),

          atr:
            Number(
              rolling.h12
                .atr
                .toFixed(4)
            ),

          direction:
            rolling.h12
              .direction
        },

        h24: {
          dollars:
            Number(
              rolling.h24
                .dollars
                .toFixed(4)
            ),

          pct:
            Number(
              rolling.h24
                .pct
                .toFixed(4)
            ),

          atr:
            Number(
              rolling.h24
                .atr
                .toFixed(4)
            ),

          direction:
            rolling.h24
              .direction
        }
      },

      timeframes: {
        m15,
        h1
      },

      blocks3h:
        currentDayBlocks.map(
          b => ({
            label:
              b.label,

            open:
              b.open,

            high:
              b.high,

            low:
              b.low,

            close:
              b.close,

            move:
              Number(
                b.move
                  .toFixed(4)
              ),

            movePct:
              Number(
                b.movePct
                  .toFixed(4)
              ),

            atrMove:
              Number(
                b.atrMove
                  .toFixed(4)
              ),

            direction:
              b.direction,

            complete:
              b.complete,

            bars:
              b.bars
          })
        ),

      fibonacci: {
        impulse:
          fib.impulse,

        levels:
          fib.levels,

        nearest:
          fib.nearest,

        nearFib:
          fib.nearFib
      },

      /*
      ---------------------------------------------------------
      PRICE FORECAST PRIMA DELLA MACRO
      ---------------------------------------------------------
      */

      priceForecast: {
        horizon:
          "0-3H",

        direction:
          priceForecast.direction,

        propDirection:
          priceForecast.propDirection,

        score:
          priceForecast.score,

        confidence:
          priceForecast.confidence,

        signalStrength:
          priceForecast.signalStrength,

        condition:
          priceForecast.condition,

        reversalBlocked:
          priceForecast.reversalBlocked,

        reversalConfirmed:
          priceForecast.reversalConfirmed,

        agreement:
          priceForecast.agreement,

        reasons:
          priceForecast.reasons
      },

      /*
      ---------------------------------------------------------
      FORECAST FINALE V2.3
      ---------------------------------------------------------
      */

      forecast: {
        horizon:
          "0-3H",

        direction:
          forecast.direction,

        propDirection:
          forecast.propDirection,

        priceScore:
          forecast.priceScore,

        score:
          forecast.score,

        confidence:
          forecast.confidence,

        signalStrength:
          forecast.signalStrength,

        condition:
          forecast.condition,

        reversalBlocked:
          forecast.reversalBlocked,

        reversalConfirmed:
          forecast.reversalConfirmed,

        agreement:
          forecast.agreement,

        macro:
          forecast.macro,

        reasons:
          forecast.reasons
      },

      combined,

      cache:
        false
    };

    // ========================================================
    // 13. CACHE
    // ========================================================

    globalThis.__propMarketCache.set(
      cacheKey,
      {
        ts:
          Date.now(),

        data:
          result
      }
    );

    return Response.json(
      result
    );
  }

  catch (error) {
    console.error(
      "Market Engine V2.3 error:",
      error
    );

    return Response.json(
      {
        ok:
          false,

        engineVersion:
          "V2.3-MT5-MACRO",

        error:
          error?.message ||
          String(error)
      },

      {
        status:
          500
      }
    );
  }
}
