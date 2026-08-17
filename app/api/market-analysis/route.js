// Market Engine v11 — forecast operativo 0-3H, momentum-first

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

const CACHE_TTL = 120_000; // 2 minuti
globalThis.__propMarketCache ??= new Map();

function isoDate(d) {
  return d.toISOString().slice(0, 10);
}

async function fetchBars(symbol, cfg, apiKey) {
  const to = new Date();
  const from = new Date(to.getTime() - cfg.days * 86400000);
  const ticker = `C:${symbol}`;

  const url =
    `${MASSIVE_BASE}/v2/aggs/ticker/${encodeURIComponent(ticker)}` +
    `/range/${cfg.multiplier}/${cfg.timespan}/${isoDate(from)}/${isoDate(to)}` +
    `?adjusted=true&sort=asc&limit=50000&apiKey=${encodeURIComponent(apiKey)}`;

  const r = await fetch(url, { cache: "no-store" });
  const j = await r.json();

  if (!r.ok || j?.status === "ERROR") {
    throw new Error(j?.error || j?.message || `Massive HTTP ${r.status}`);
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
  const out = new Array(values.length).fill(null);

  if (values.length < period) return out;

  let seed = 0;

  for (let i = 0; i < period; i++) {
    seed += values[i];
  }

  let prev = seed / period;
  out[period - 1] = prev;

  for (let i = period; i < values.length; i++) {
    prev = values[i] * k + prev * (1 - k);
    out[i] = prev;
  }

  return out;
}

function rsi(values, period = 14) {
  const out = new Array(values.length).fill(null);

  if (values.length <= period) return out;

  let gain = 0;
  let loss = 0;

  for (let i = 1; i <= period; i++) {
    const d = values[i] - values[i - 1];

    gain += Math.max(d, 0);
    loss += Math.max(-d, 0);
  }

  let avgGain = gain / period;
  let avgLoss = loss / period;

  out[period] =
    avgLoss === 0
      ? 100
      : 100 - 100 / (1 + avgGain / avgLoss);

  for (let i = period + 1; i < values.length; i++) {
    const d = values[i] - values[i - 1];

    const g = Math.max(d, 0);
    const l = Math.max(-d, 0);

    avgGain =
      (avgGain * (period - 1) + g) / period;

    avgLoss =
      (avgLoss * (period - 1) + l) / period;

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

    const pc = bars[i - 1].c;

    return Math.max(
      b.h - b.l,
      Math.abs(b.h - pc),
      Math.abs(b.l - pc)
    );
  });

  const out = new Array(bars.length).fill(null);

  if (bars.length < period) return out;

  let seed = 0;

  for (let i = 0; i < period; i++) {
    seed += tr[i];
  }

  let prev = seed / period;
  out[period - 1] = prev;

  for (let i = period; i < bars.length; i++) {
    prev =
      ((prev * (period - 1)) + tr[i]) / period;

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
  const ef = ema(values, fast);
  const es = ema(values, slow);

  const line = values.map((_, i) =>
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

  const sigCompact = ema(
    compact,
    signalPeriod
  );

  const signal =
    new Array(values.length).fill(null);

  indexMap.forEach(
    (originalIndex, compactIndex) => {
      signal[originalIndex] =
        sigCompact[compactIndex];
    }
  );

  const histogram = values.map((_, i) =>
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

function aggregateBars(
  bars,
  bucketMs
) {
  const buckets = new Map();

  for (const b of bars) {
    const bucket =
      Math.floor(b.t / bucketMs) *
      bucketMs;

    const existing =
      buckets.get(bucket);

    if (!existing) {
      buckets.set(bucket, {
        t: bucket,
        o: b.o,
        h: b.h,
        l: b.l,
        c: b.c,
        v: b.v || 0
      });
    } else {
      existing.h =
        Math.max(existing.h, b.h);

      existing.l =
        Math.min(existing.l, b.l);

      existing.c = b.c;

      existing.v += b.v || 0;
    }
  }

  return [...buckets.values()]
    .sort((a, b) => a.t - b.t);
}

function clamp(
  v,
  min,
  max
) {
  return Math.max(
    min,
    Math.min(max, v)
  );
}

function seriesValueAgo(
  arr,
  barsAgo = 1
) {
  let found = 0;

  for (
    let i = arr.length - 1;
    i >= 0;
    i--
  ) {
    if (!Number.isFinite(arr[i])) {
      continue;
    }

    if (found === barsAgo) {
      return arr[i];
    }

    found++;
  }

  return null;
}

function analyzeTimeframe(
  bars,
  name
) {
  const closes =
    bars.map(b => b.c);

  const ema20A =
    ema(closes, 20);

  const ema50A =
    ema(closes, 50);

  const ema200A =
    ema(closes, 200);

  const rsiA =
    rsi(closes, 14);

  const atrA =
    atr(bars, 14);

  const macdA =
    macd(closes);

  const close =
    closes[closes.length - 1];

  const e20 =
    lastFinite(ema20A);

  const e50 =
    lastFinite(ema50A);

  const e200 =
    lastFinite(ema200A);

  const r =
    lastFinite(rsiA);

  const a =
    lastFinite(atrA);

  const mLine =
    lastFinite(macdA.line);

  const mSignal =
    lastFinite(macdA.signal);

  const mHist =
    lastFinite(macdA.histogram);

  const recent =
    bars.slice(-20);

  const support =
    Math.min(
      ...recent.map(b => b.l)
    );

  const resistance =
    Math.max(
      ...recent.map(b => b.h)
    );

  let score = 0;

  const reasons = [];

  // ==========================================================
  // 1. TREND DI FONDO
  // ==========================================================

  if (
    [close, e20, e50, e200]
      .every(Number.isFinite)
  ) {
    if (
      close > e20 &&
      e20 > e50 &&
      e50 > e200
    ) {
      score += 22;

      reasons.push(
        "EMA allineate rialziste"
      );
    }

    else if (
      close < e20 &&
      e20 < e50 &&
      e50 < e200
    ) {
      score -= 22;

      reasons.push(
        "EMA allineate ribassiste"
      );
    }

    else {
      score +=
        close > e20 ? 5 : -5;

      score +=
        e20 > e50 ? 5 : -5;

      score +=
        e50 > e200 ? 3 : -3;

      reasons.push(
        "Trend EMA misto"
      );
    }
  }

  // ==========================================================
  // 2. MOMENTUM RECENTE
  // ==========================================================

  const lastIdx =
    closes.length - 1;

  const closeAgo = n =>
    lastIdx - n >= 0
      ? closes[lastIdx - n]
      : null;

  const momentum = {
    bars3: null,
    bars6: null,
    bars12: null
  };

  if (
    Number.isFinite(a) &&
    a > 0
  ) {
    const addMomentum = (
      barsAgo,
      weight,
      key,
      label
    ) => {
      const prev =
        closeAgo(barsAgo);

      if (
        !Number.isFinite(prev)
      ) {
        return;
      }

      const atrUnits =
        (close - prev) / a;

      momentum[key] =
        atrUnits;

      score +=
        clamp(
          atrUnits / 1.75,
          -1,
          1
        ) * weight;

      if (
        Math.abs(atrUnits) >=
        0.20
      ) {
        reasons.push(
          `${label} ${
            atrUnits > 0
              ? "rialzista"
              : "ribassista"
          } (${atrUnits.toFixed(2)} ATR)`
        );
      }
    };

    addMomentum(
      3,
      16,
      "bars3",
      "Momentum breve"
    );

    addMomentum(
      6,
      14,
      "bars6",
      "Momentum medio"
    );

    addMomentum(
      12,
      10,
      "bars12",
      "Momentum esteso"
    );
  }

  // ==========================================================
  // 3. PENDENZA EMA20
  // ==========================================================

  const e20Ago3 =
    seriesValueAgo(
      ema20A,
      3
    );

  const e20Ago6 =
    seriesValueAgo(
      ema20A,
      6
    );

  let ema20SlopeAtr = null;
  let ema20Slope6Atr = null;

  if (
    Number.isFinite(e20) &&
    Number.isFinite(e20Ago3) &&
    Number.isFinite(a) &&
    a > 0
  ) {
    ema20SlopeAtr =
      (e20 - e20Ago3) / a;

    score +=
      clamp(
        ema20SlopeAtr / 0.75,
        -1,
        1
      ) * 10;

    if (
      Math.abs(
        ema20SlopeAtr
      ) >= 0.08
    ) {
      reasons.push(
        `EMA20 inclinata ${
          ema20SlopeAtr > 0
            ? "verso l'alto"
            : "verso il basso"
        }`
      );
    }
  }

  if (
    Number.isFinite(e20) &&
    Number.isFinite(e20Ago6) &&
    Number.isFinite(a) &&
    a > 0
  ) {
    ema20Slope6Atr =
      (e20 - e20Ago6) / a;
  }

  // ==========================================================
  // 4. RSI
  // ==========================================================

  const rAgo3 =
    seriesValueAgo(
      rsiA,
      3
    );

  let rsiDelta3 = null;

  if (
    Number.isFinite(r)
  ) {
    if (
      r >= 55 &&
      r <= 72
    ) {
      score += 8;
    }

    else if (
      r <= 45 &&
      r >= 28
    ) {
      score -= 8;
    }

    else if (
      r > 72
    ) {
      score += 2;
    }

    else if (
      r < 28
    ) {
      score -= 2;
    }

    reasons.push(
      `RSI ${r.toFixed(1)}`
    );

    if (
      Number.isFinite(rAgo3)
    ) {
      rsiDelta3 =
        r - rAgo3;

      score +=
        clamp(
          rsiDelta3 / 8,
          -1,
          1
        ) * 8;

      if (
        Math.abs(rsiDelta3) >=
        2.5
      ) {
        reasons.push(
          `RSI ${
            rsiDelta3 > 0
              ? "in accelerazione"
              : "in decelerazione"
          } (${
            rsiDelta3 > 0
              ? "+"
              : ""
          }${rsiDelta3.toFixed(1)})`
        );
      }
    }
  }

  // ==========================================================
  // 5. MACD
  // ==========================================================

  const histAgo3 =
    seriesValueAgo(
      macdA.histogram,
      3
    );

  let macdAcceleration =
    null;

  if (
    Number.isFinite(mHist)
  ) {
    score +=
      mHist > 0
        ? 9
        : mHist < 0
          ? -9
          : 0;

    reasons.push(
      mHist > 0
        ? "MACD positivo"
        : mHist < 0
          ? "MACD negativo"
          : "MACD piatto"
    );

    if (
      Number.isFinite(
        histAgo3
      )
    ) {
      macdAcceleration =
        mHist - histAgo3;

      const scale =
        Math.max(
          Math.abs(mHist),
          Math.abs(histAgo3),
          1e-9
        );

      const normalizedAccel =
        macdAcceleration /
        scale;

      score +=
        clamp(
          normalizedAccel,
          -1,
          1
        ) * 9;

      if (
        Math.abs(
          normalizedAccel
        ) >= 0.15
      ) {
        reasons.push(
          `MACD ${
            normalizedAccel > 0
              ? "sta migliorando"
              : "sta peggiorando"
          }`
        );
      }
    }
  }

  // ==========================================================
  // 6. STRUTTURA RECENTE
  // ==========================================================

  if (
    recent.length >= 10 &&
    Number.isFinite(a) &&
    a > 0
  ) {
    const older =
      recent.slice(
        -10,
        -5
      );

    const newer =
      recent.slice(-5);

    const oldMid =
      (
        Math.max(
          ...older.map(
            b => b.h
          )
        ) +
        Math.min(
          ...older.map(
            b => b.l
          )
        )
      ) / 2;

    const newMid =
      (
        Math.max(
          ...newer.map(
            b => b.h
          )
        ) +
        Math.min(
          ...newer.map(
            b => b.l
          )
        )
      ) / 2;

    const structureAtr =
      (newMid - oldMid) / a;

    score +=
      clamp(
        structureAtr / 1.25,
        -1,
        1
      ) * 10;

    if (
      Math.abs(
        structureAtr
      ) >= 0.15
    ) {
      reasons.push(
        `Struttura recente ${
          structureAtr > 0
            ? "crescente"
            : "decrescente"
        }`
      );
    }
  }

  // ==========================================================
  // 7. PRESSIONE ULTIME 4 CANDELE
  // ==========================================================

  const last4 =
    bars.slice(-4);

  if (
    last4.length === 4
  ) {
    const directional =
      last4.reduce(
        (sum, b) => {
          const range =
            Math.max(
              b.h - b.l,
              1e-9
            );

          return sum +
            (
              (b.c - b.o) /
              range
            );
        },
        0
      ) /
      last4.length;

    score +=
      clamp(
        directional,
        -1,
        1
      ) * 8;

    if (
      Math.abs(
        directional
      ) >= 0.20
    ) {
      reasons.push(
        `Pressione candele ${
          directional > 0
            ? "rialzista"
            : "ribassista"
        }`
      );
    }
  }

  score =
    clamp(
      score,
      -100,
      100
    );

  let bias = "NEUTRAL";

  if (
    score >= 16
  ) {
    bias = "BUY";
  }

  if (
    score <= -16
  ) {
    bias = "SELL";
  }

  const atrPct =
    Number.isFinite(a) &&
    close
      ? (a / close) * 100
      : null;

  return {
    timeframe: name,

    lastClose: close,

    timestamp:
      bars[
        bars.length - 1
      ]?.t || null,

    ema20: e20,
    ema50: e50,
    ema200: e200,

    ema20SlopeAtr,
    ema20Slope6Atr,

    rsi14: r,
    rsiDelta3,

    atr14: a,
    atrPct,

    macd: {
      line: mLine,
      signal: mSignal,
      histogram: mHist,
      acceleration:
        macdAcceleration
    },

    momentum,

    support20:
      support,

    resistance20:
      resistance,

    score:
      Number(
        score.toFixed(1)
      ),

    bias,

    reasons
  };
}

function combine(
  timeframes
) {
  // ==========================================================
  // FORECAST OPERATIVO 0-3 ORE
  // ==========================================================

  const weights = {
    M15: 0.45,
    H1: 0.35,
    H4: 0.15,
    D1: 0.05
  };

  const timestamps =
    Object.values(
      timeframes
    )
      .map(
        x =>
          Number(
            x?.timestamp
          )
      )
      .filter(
        Number.isFinite
      );

  const freshestTs =
    timestamps.length
      ? Math.max(
          ...timestamps
        )
      : null;

  const lagThresholdMs = {
    M15:
      2 *
      60 *
      60 *
      1000,

    H1:
      6 *
      60 *
      60 *
      1000,

    H4:
      18 *
      60 *
      60 *
      1000,

    D1:
      72 *
      60 *
      60 *
      1000,
  };

  const freshness = {};

  for (
    const [tf, data]
    of Object.entries(
      timeframes
    )
  ) {
    const ts =
      Number(
        data?.timestamp
      );

    const lagMs =
      freshestTs &&
      Number.isFinite(ts)
        ? Math.max(
            0,
            freshestTs - ts
          )
        : null;

    const stale =
      !Number.isFinite(ts) ||
      (
        Number.isFinite(
          lagMs
        ) &&
        lagMs >
          (
            lagThresholdMs[tf] ||
            86400000
          )
      );

    freshness[tf] = {
      stale,
      lagMs,

      timestamp:
        Number.isFinite(ts)
          ? ts
          : null
    };
  }

  let weighted = 0;
  let totalWeight = 0;

  for (
    const [tf, data]
    of Object.entries(
      timeframes
    )
  ) {
    const w =
      weights[tf] || 0;

    if (
      !freshness[tf]?.stale &&
      Number.isFinite(
        data?.score
      )
    ) {
      weighted +=
        data.score * w;

      totalWeight += w;
    }
  }

  let score =
    totalWeight
      ? weighted /
        totalWeight
      : 0;

  const m15 =
    timeframes.M15;

  const h1 =
    timeframes.H1;

  const m15Usable =
    !freshness.M15?.stale &&
    Number.isFinite(
      m15?.score
    );

  const h1Usable =
    !freshness.H1?.stale &&
    Number.isFinite(
      h1?.score
    );

  let shortTermAgreement =
    0;

  // ==========================================================
  // ACCORDO M15 / H1
  // ==========================================================

  if (
    m15Usable &&
    h1Usable
  ) {
    const sameDirection =
      Math.sign(
        m15.score
      ) !== 0 &&
      Math.sign(
        m15.score
      ) ===
        Math.sign(
          h1.score
        );

    if (
      sameDirection
    ) {
      shortTermAgreement =
        Math.min(
          12,
          (
            Math.abs(
              m15.score
            ) +
            Math.abs(
              h1.score
            )
          ) / 12
        );

      score +=
        Math.sign(
          m15.score
        ) *
        shortTermAgreement;
    }

    else if (
      Math.abs(
        m15.score
      ) >= 16 &&
      Math.abs(
        h1.score
      ) >= 16
    ) {
      score *= 0.62;

      shortTermAgreement =
        -10;
    }
  }

  score =
    clamp(
      score,
      -100,
      100
    );

  let bias =
    "NEUTRAL";

  if (
    score >= 16
  ) {
    bias = "BUY";
  }

  if (
    score <= -16
  ) {
    bias = "SELL";
  }

  const usableEntries =
    Object.entries(
      timeframes
    )
      .filter(
        ([tf]) =>
          !freshness[tf]
            ?.stale
      );

  const usableBiases =
    usableEntries.map(
      ([, x]) =>
        x.bias
    );

  const buyCount =
    usableBiases.filter(
      x => x === "BUY"
    ).length;

  const sellCount =
    usableBiases.filter(
      x => x === "SELL"
    ).length;

  const neutralCount =
    usableBiases.filter(
      x =>
        x === "NEUTRAL"
    ).length;

  // ==========================================================
  // CONFIDENCE
  // ==========================================================

  const scoreComponent =
    Math.min(
      65,
      Math.abs(score) *
        0.82
    );

  let shortTermComponent =
    0;

  if (
    m15Usable &&
    h1Usable
  ) {
    if (
      Math.sign(
        m15.score
      ) ===
        Math.sign(
          h1.score
        ) &&
      Math.abs(
        m15.score
      ) >= 10 &&
      Math.abs(
        h1.score
      ) >= 10
    ) {
      shortTermComponent =
        20;
    }

    else if (
      Math.sign(
        m15.score
      ) ===
        Math.sign(
          h1.score
        )
    ) {
      shortTermComponent =
        12;
    }
  }

  else if (
    m15Usable ||
    h1Usable
  ) {
    shortTermComponent =
      6;
  }

  const directionalCount =
    bias === "BUY"
      ? buyCount
      : bias === "SELL"
        ? sellCount
        : 0;

  const agreementRatio =
    usableBiases.length
      ? directionalCount /
        usableBiases.length
      : 0;

  const alignmentComponent =
    agreementRatio * 15;

  let confidence =
    Math.round(
      clamp(
        scoreComponent +
        shortTermComponent +
        alignmentComponent,
        0,
        100
      )
    );

  // ==========================================================
  // CONFLITTO M15 / H1
  // ==========================================================

  if (
    m15Usable &&
    h1Usable &&
    Math.sign(
      m15.score
    ) !== 0 &&
    Math.sign(
      h1.score
    ) !== 0 &&
    Math.sign(
      m15.score
    ) !==
      Math.sign(
        h1.score
      ) &&
    Math.abs(
      m15.score
    ) >= 16 &&
    Math.abs(
      h1.score
    ) >= 16
  ) {
    confidence =
      Math.min(
        confidence,
        39
      );
  }

  // ==========================================================
  // WAIT REALE
  // ==========================================================

  const actionable =
    bias !== "NEUTRAL" &&
    confidence >= 40;

  const propDirection =
    !actionable
      ? "WAIT"
      : bias === "BUY"
        ? "SELL"
        : "BUY";

  const signalStrength =
    !actionable ||
    confidence < 40
      ? "INSUFFICIENT"

      : confidence < 55
        ? "WEAK"

        : confidence < 70
          ? "GOOD"

          : "STRONG";

  return {
    score:
      Number(
        score.toFixed(1)
      ),

    confidence,

    bias,

    propDirection,

    signalStrength,

    horizon:
      "0-3H",

    shortTermAgreement:
      Number(
        shortTermAgreement
          .toFixed(1)
      ),

    alignment: {
      buy: buyCount,
      sell: sellCount,
      neutral:
        neutralCount
    },

    freshness,

    usableTimeframes:
      Object.keys(
        timeframes
      ).filter(
        tf =>
          !freshness[tf]
            ?.stale
      ),

    staleTimeframes:
      Object.keys(
        timeframes
      ).filter(
        tf =>
          freshness[tf]
            ?.stale
      ),

    freshestTimestamp:
      freshestTs
  };
}

export async function GET(
  request
) {
  const apiKey =
    process.env
      .MASSIVE_API_KEY;

  if (
    !apiKey
  ) {
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

    // ========================================================
    // SOLO 2 CHIAMATE MASSIVE
    // ========================================================

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

    // ========================================================
    // AGGREGAZIONE LOCALE
    // ========================================================

    const h4Bars =
      aggregateBars(
        h1Bars,
        4 *
        60 *
        60 *
        1000
      );

    const d1Bars =
      aggregateBars(
        h1Bars,
        24 *
        60 *
        60 *
        1000
      );

    const timeframes = {

      M15:
        analyzeTimeframe(
          m15Bars,
          "M15"
        ),

      H1:
        analyzeTimeframe(
          h1Bars,
          "H1"
        ),

      H4:
        analyzeTimeframe(
          h4Bars,
          "H4"
        ),

      D1:
        analyzeTimeframe(
          d1Bars,
          "D1"
        ),
    };

    const combined =
      combine(
        timeframes
      );

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

      note:
        "Forecast quantitativo operativo 0-3H; score descrittivo, non probabilità certa.",

      combined,

      timeframes
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

        symbol
      },
      {
        status:
          502
      }
    );
  }
}
