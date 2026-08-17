// Market Engine V2 — Day Regime + 3H Blocks + Rolling Windows
// DEBUG BUILD — verifica freshness feed Massive

export const dynamic = "force-dynamic";
export const revalidate = 0;

const MASSIVE_BASE = "https://api.massive.com";

const SUPPORTED = new Set([
  "XAUUSD","XAGUSD","EURUSD","GBPUSD","USDJPY","USDCHF","USDCAD","AUDUSD","NZDUSD",
  "EURGBP","EURJPY","EURCHF","EURAUD","GBPJPY","GBPCHF","GBPAUD","AUDJPY","CADJPY",
  "CHFJPY","NZDJPY"
]);

const TF = {
  M15: { multiplier: 15, timespan: "minute", days: 14 },
  H1:  { multiplier: 1, timespan: "hour", days: 380 },
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
    to.getTime() - cfg.days * 86400000
  );

  const ticker = `C:${symbol}`;

  const url =
    `${MASSIVE_BASE}/v2/aggs/ticker/${encodeURIComponent(ticker)}` +
    `/range/${cfg.multiplier}/${cfg.timespan}/${isoDate(from)}/${isoDate(to)}` +
    `?adjusted=true&sort=asc&limit=50000&apiKey=${encodeURIComponent(apiKey)}`;

  const r = await fetch(url, {
    cache: "no-store"
  });

  const j = await r.json();

  if (!r.ok || j?.status === "ERROR") {
    throw new Error(
      j?.error ||
      j?.message ||
      `Massive HTTP ${r.status}`
    );
  }

  const bars = Array.isArray(j?.results)
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
          [x.t, x.o, x.h, x.l, x.c].every(Number.isFinite)
        )
    : [];

  if (bars.length < 60) {
    throw new Error(
      `${symbol} ${cfg.timespan}: dati insufficienti (${bars.length} barre)`
    );
  }

  return bars;
}

function ema(values, period) {
  if (!values.length) return [];

  const k = 2 / (period + 1);

  const out = new Array(
    values.length
  ).fill(null);

  if (values.length < period) {
    return out;
  }

  let seed = 0;

  for (let i = 0; i < period; i++) {
    seed += values[i];
  }

  let prev = seed / period;

  out[period - 1] = prev;

  for (let i = period; i < values.length; i++) {
    prev =
      values[i] * k +
      prev * (1 - k);

    out[i] = prev;
  }

  return out;
}

function rsi(values, period = 14) {
  const out = new Array(
    values.length
  ).fill(null);

  if (values.length <= period) {
    return out;
  }

  let gain = 0;
  let loss = 0;

  for (let i = 1; i <= period; i++) {
    const d =
      values[i] -
      values[i - 1];

    gain += Math.max(d, 0);
    loss += Math.max(-d, 0);
  }

  let avgGain = gain / period;
  let avgLoss = loss / period;

  out[period] =
    avgLoss === 0
      ? 100
      : 100 - 100 / (1 + avgGain / avgLoss);

  for (
    let i = period + 1;
    i < values.length;
    i++
  ) {
    const d =
      values[i] -
      values[i - 1];

    const g = Math.max(d, 0);
    const l = Math.max(-d, 0);

    avgGain =
      (avgGain * (period - 1) + g) /
      period;

    avgLoss =
      (avgLoss * (period - 1) + l) /
      period;

    out[i] =
      avgLoss === 0
        ? 100
        : 100 - 100 / (1 + avgGain / avgLoss);
  }

  return out;
}

function atr(bars, period = 14) {
  const tr = bars.map((b, i) => {
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
  });

  const out = new Array(
    bars.length
  ).fill(null);

  if (bars.length < period) {
    return out;
  }

  let seed = 0;

  for (let i = 0; i < period; i++) {
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
      ((prev * (period - 1)) + tr[i]) /
      period;

    out[i] = prev;
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
    ema(values, fast);

  const es =
    ema(values, slow);

  const line =
    values.map((_, i) =>
      Number.isFinite(ef[i]) &&
      Number.isFinite(es[i])
        ? ef[i] - es[i]
        : null
    );

  const compact = [];
  const indexMap = [];

  line.forEach((v, i) => {
    if (Number.isFinite(v)) {
      compact.push(v);
      indexMap.push(i);
    }
  });

  const sigCompact =
    ema(compact, signalPeriod);

  const signal =
    new Array(
      values.length
    ).fill(null);

  indexMap.forEach(
    (originalIndex, compactIndex) => {
      signal[originalIndex] =
        sigCompact[compactIndex];
    }
  );

  const histogram =
    values.map((_, i) =>
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
    let i = arr.length - 1;
    i >= 0;
    i--
  ) {
    if (Number.isFinite(arr[i])) {
      return arr[i];
    }
  }

  return null;
}

function clamp(v, min, max) {
  return Math.max(
    min,
    Math.min(max, v)
  );
}

function signLabel(v, threshold = 0) {
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

  for (const p of parts) {
    if (p.type !== "literal") {
      out[p.type] = p.value;
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

function pct(from, to) {
  if (
    !Number.isFinite(from) ||
    !Number.isFinite(to) ||
    from === 0
  ) {
    return 0;
  }

  return (
    (to - from) /
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
    bars.length < barCount + 1
  ) {
    return {
      dollars: 0,
      pct: 0,
      atr: 0,
      direction: "NEUTRAL"
    };
  }

  const end =
    bars[bars.length - 1].c;

  const start =
    bars[
      bars.length -
      1 -
      barCount
    ].c;

  const dollars =
    end - start;

  const movePct =
    pct(start, end);

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

  for (const b of m15Bars) {
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

    if (!byBlock.has(key)) {
      byBlock.set(
        key,
        {
          key,

          dateKey:
            zp.dateKey,

          startHour,

          endHour:
            startHour + 3,

          open:
            b.o,

          high:
            b.h,

          low:
            b.l,

          close:
            b.c,

          firstTs:
            b.t,

          lastTs:
            b.t,

          bars:
            1
        }
      );
    } else {
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
        Number.isFinite(atrValue) &&
        atrValue > 0
          ? move / atrValue
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
      current - low
    ) / range;

  const moveAtr =
    Number.isFinite(atrValue) &&
    atrValue > 0
      ? move / atrValue
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
    } else if (
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
              (b.c - b.o) /
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

  let priceAction = 0;

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
    closes.length > barsBack &&
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
        (r - 50) / 18,
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
    timeframe:
      name,

    timestamp:
      bars[
        bars.length - 1
      ]?.t || null,

    lastClose:
      close,

    atr14:
      a,

    rsi14:
      r,

    ema20:
      e20,

    ema50:
      e50,

    macdHistogram:
      hist,

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
    Object.entries(levels)
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
    Number.isFinite(atrValue) &&
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

  const completedOrCurrent =
    currentDayBlocks.slice(-4);

  const blockDirectional =
    completedOrCurrent.reduce(
      (sum, b) => {
        return (
          sum +
          clamp(
            b.atrMove / 1.6,
            -1,
            1
          )
        );
      },
      0
    );

  const blockScore =
    completedOrCurrent.length
      ? clamp(
          blockDirectional /
          completedOrCurrent.length,
          -1,
          1
        ) * 100
      : 0;

  const rollingScore =
    clamp(
      (
        clamp(
          rolling.h1.atr / 1.2,
          -1,
          1
        ) * 0.20 +

        clamp(
          rolling.h3.atr / 2.0,
          -1,
          1
        ) * 0.38 +

        clamp(
          rolling.h6.atr / 3.0,
          -1,
          1
        ) * 0.28 +

        clamp(
          rolling.h12.atr / 4.5,
          -1,
          1
        ) * 0.14
      ),
      -1,
      1
    ) * 100;

  const microScore =
    m15.score * 0.58 +
    h1.score * 0.42;

  let raw =
    session.score * 0.34 +
    rollingScore * 0.28 +
    blockScore * 0.20 +
    microScore * 0.18;

  const daySign =
    Math.sign(
      session.score
    );

  const rawSign =
    Math.sign(raw);

  const reversalAgreement =
    Math.sign(
      rolling.h3.atr
    ) === rawSign &&
    Math.sign(
      m15.score
    ) === rawSign &&
    Math.sign(
      h1.score
    ) === rawSign;

  if (
    Math.abs(
      session.score
    ) >= 50 &&
    rawSign !== 0 &&
    rawSign !== daySign &&
    !reversalAgreement
  ) {
    raw *= 0.35;
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

  const familyValues = [
    session.score,
    rollingScore,
    blockScore,
    microScore
  ].filter(
    Number.isFinite
  );

  const targetSign =
    direction === "BUY"
      ? 1
      : direction === "SELL"
        ? -1
        : 0;

  const agreeCount =
    targetSign === 0
      ? 0
      : familyValues.filter(
          v =>
            Math.sign(v) ===
            targetSign &&
            Math.abs(v) >= 12
        ).length;

  const conflictCount =
    targetSign === 0
      ? familyValues.filter(
          v =>
            Math.abs(v) >= 18
        ).length
      : familyValues.filter(
          v =>
            Math.sign(v) ===
            -targetSign &&
            Math.abs(v) >= 18
        ).length;

  let confidence =
    direction === "WAIT"
      ? Math.round(
          Math.min(
            39,
            Math.abs(raw)
          )
        )
      : Math.round(
          clamp(
            Math.abs(raw) * 0.55 +
            agreeCount * 12 -
            conflictCount * 10,
            0,
            100
          )
        );

  if (
    agreeCount < 3
  ) {
    confidence =
      Math.min(
        confidence,
        69
      );
  }

  if (
    conflictCount >= 2
  ) {
    confidence =
      Math.min(
        confidence,
        49
      );
  }

  const signalStrength =
    direction === "WAIT" ||
    confidence < 40
      ? "INSUFFICIENT"
      : confidence < 55
        ? "WEAK"
        : confidence < 70
          ? "GOOD"
          : "STRONG";

  const propDirection =
    direction === "BUY"
      ? "SELL"
      : direction === "SELL"
        ? "BUY"
        : "WAIT";

  let condition =
    "MIXED";

  if (
    direction !== "WAIT"
  ) {
    if (
      Math.sign(
        session.score
      ) === targetSign &&
      Math.sign(
        rollingScore
      ) === targetSign
    ) {
      condition =
        "CONTINUATION";
    } else if (
      Math.sign(
        session.score
      ) !== targetSign &&
      agreeCount >= 3
    ) {
      condition =
        "REVERSAL";
    } else {
      condition =
        "PULLBACK_OR_TRANSITION";
    }
  }

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
    `Momentum rolling 3H ${
      rolling.h3.dollars >= 0
        ? "+"
        : ""
    }${rolling.h3.dollars.toFixed(2)} • 6H ${
      rolling.h6.dollars >= 0
        ? "+"
        : ""
    }${rolling.h6.dollars.toFixed(2)}`
  );

  if (
    completedOrCurrent.length
  ) {
    reasons.push(
      `Ultimi blocchi 3H: ${
        completedOrCurrent
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

    agreement: {
      agreeCount,

      conflictCount,

      session:
        Number(
          session.score.toFixed(1)
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

export async function GET(
  request
) {
  const apiKey =
    process.env
      .MASSIVE_API_KEY;

  if (!apiKey) {
    return Response.json(
      {
        error:
          "MASSIVE_API_KEY non configurata su Vercel"
      },
      {
        status: 500
      }
    );
  }

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
    ).toUpperCase();

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
        error:
          "Asset non supportato"
      },
      {
        status: 400
      }
    );
  }

  const cacheKey =
    symbol;

  const cached =
    globalThis
      .__propMarketCache
      .get(cacheKey);

  if (
    !force &&
    cached &&
    Date.now() -
      cached.ts <
      CACHE_TTL
  ) {
    return Response.json(
      {
        ...cached.data,

        cache:
          true,

        cacheAgeMs:
          Date.now() -
          cached.ts
      },
      {
        headers: {
          "Cache-Control":
            "no-store"
        }
      }
    );
  }

  try {
    const [
      m15Bars,
      h1Bars
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

    /*
     * DEBUG FEED
     *
     * Questi dati NON vengono elaborati.
     * Servono esclusivamente a verificare
     * cosa Massive ci sta realmente restituendo.
     */

    const lastM15Raw =
      m15Bars[
        m15Bars.length - 1
      ];

    const lastH1Raw =
      h1Bars[
        h1Bars.length - 1
      ];

    const debugFeed = {
      serverNowISO:
        new Date().toISOString(),

      m15BarsCount:
        m15Bars.length,

      h1BarsCount:
        h1Bars.length,

      lastM15Raw,

      lastH1Raw,

      lastM15ISO:
        lastM15Raw?.t
          ? new Date(
              lastM15Raw.t
            ).toISOString()
          : null,

      lastH1ISO:
        lastH1Raw?.t
          ? new Date(
              lastH1Raw.t
            ).toISOString()
          : null,

      m15LagMinutes:
        lastM15Raw?.t
          ? Number(
              (
                (
                  Date.now() -
                  lastM15Raw.t
                ) /
                60000
              ).toFixed(1)
            )
          : null,

      h1LagMinutes:
        lastH1Raw?.t
          ? Number(
              (
                (
                  Date.now() -
                  lastH1Raw.t
                ) /
                60000
              ).toFixed(1)
            )
          : null
    };

    const m15Atr =
      lastFinite(
        atr(
          m15Bars,
          14
        )
      );

    const session =
      currentSessionStats(
        m15Bars,
        m15Atr
      );

    const blocks3h =
      buildThreeHourBlocks(
        m15Bars,
        m15Atr
      );

    const rolling = {
      h1:
        rollingMoveFromM15(
          m15Bars,
          4,
          m15Atr
        ),

      h3:
        rollingMoveFromM15(
          m15Bars,
          12,
          m15Atr
        ),

      h6:
        rollingMoveFromM15(
          m15Bars,
          24,
          m15Atr
        ),

      h12:
        rollingMoveFromM15(
          m15Bars,
          48,
          m15Atr
        )
    };

    const compact = {
      M15:
        analyzeCompactTimeframe(
          m15Bars,
          "M15"
        ),

      H1:
        analyzeCompactTimeframe(
          h1Bars,
          "H1"
        )
    };

    const fib =
      fibonacciContext(
        session,
        session.current,
        m15Atr
      );

    const forecast =
      buildForecast({
        session,

        blocks:
          blocks3h,

        rolling,

        m15:
          compact.M15,

        h1:
          compact.H1,

        fib
      });

    const currentDayBlocks =
      blocks3h.filter(
        b =>
          b.dateKey ===
          session.dateKey
      );

    const combined = {
      bias:
        forecast.direction === "BUY"
          ? "BUY"
          : forecast.direction === "SELL"
            ? "SELL"
            : "NEUTRAL",

      score:
        forecast.score,

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

      agreement:
        forecast.agreement,

      reasons:
        forecast.reasons
    };

    const data = {
      ok: true,

      symbol,

      generatedAt:
        new Date()
          .toISOString(),

      source:
        "Massive",

      apiCallsUsed:
        2,

      engineVersion:
        "V2-DAY-3H-DEBUG",

      /*
       * QUESTA È LA PARTE CHE CI INTERESSA ADESSO
       */

      debug:
        debugFeed,

      timezone:
        ENGINE_TZ,

      note:
        "V2 DEBUG: verifica freshness feed Massive. Regime giornata + blocchi 3H + rolling momentum + price action M15/H1.",

      combined,

      session,

      blocks3h:
        currentDayBlocks,

      rolling,

      fib,

      timeframes:
        compact,

      macro: {
        status:
          "NOT_CONFIGURED",

        score:
          0,

        note:
          "Modulo macro/news non collegato: non influenza il forecast."
      }
    };

    globalThis
      .__propMarketCache
      .set(
        cacheKey,
        {
          ts:
            Date.now(),

          data
        }
      );

    return Response.json(
      data,
      {
        headers: {
          "Cache-Control":
            "no-store"
        }
      }
    );

  } catch (e) {
    console.error(
      "Market analysis error:",
      e
    );

    return Response.json(
      {
        error:
          e?.message ||
          "Errore Market Engine",

        symbol,

        generatedAt:
          new Date()
            .toISOString()
      },
      {
        status: 502
      }
    );
  }
}
