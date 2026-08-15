export const dynamic = "force-dynamic";
export const revalidate = 0;

const MASSIVE_BASE = "https://api.massive.com";

const SUPPORTED = new Set([
  "XAUUSD","XAGUSD","EURUSD","GBPUSD","USDJPY","USDCHF","USDCAD","AUDUSD","NZDUSD",
  "EURGBP","EURJPY","EURCHF","EURAUD","GBPJPY","GBPCHF","GBPAUD","AUDJPY","CADJPY",
  "CHFJPY","NZDJPY"
]);

const TF = {
  M15: { multiplier: 15, timespan: "minute", days: 10, minBars: 220 },
  H1:  { multiplier: 1, timespan: "hour", days: 20, minBars: 220 },
  H4:  { multiplier: 4, timespan: "hour", days: 60, minBars: 220 },
  D1:  { multiplier: 1, timespan: "day", days: 380, minBars: 220 },
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
    ? j.results.map(x => ({
        t: Number(x.t),
        o: Number(x.o),
        h: Number(x.h),
        l: Number(x.l),
        c: Number(x.c),
        v: Number(x.v || 0),
      })).filter(x =>
        [x.t,x.o,x.h,x.l,x.c].every(Number.isFinite)
      )
    : [];

  if (bars.length < 60) {
    throw new Error(`${symbol} ${cfg.timespan}: dati insufficienti (${bars.length} barre)`);
  }

  return bars;
}

function ema(values, period) {
  if (!values.length) return [];
  const k = 2 / (period + 1);
  const out = new Array(values.length).fill(null);
  if (values.length < period) return out;

  let seed = 0;
  for (let i = 0; i < period; i++) seed += values[i];
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

  let gain = 0, loss = 0;
  for (let i = 1; i <= period; i++) {
    const d = values[i] - values[i - 1];
    gain += Math.max(d, 0);
    loss += Math.max(-d, 0);
  }

  let avgGain = gain / period;
  let avgLoss = loss / period;
  out[period] = avgLoss === 0 ? 100 : 100 - 100 / (1 + avgGain / avgLoss);

  for (let i = period + 1; i < values.length; i++) {
    const d = values[i] - values[i - 1];
    const g = Math.max(d, 0);
    const l = Math.max(-d, 0);
    avgGain = (avgGain * (period - 1) + g) / period;
    avgLoss = (avgLoss * (period - 1) + l) / period;
    out[i] = avgLoss === 0 ? 100 : 100 - 100 / (1 + avgGain / avgLoss);
  }
  return out;
}

function atr(bars, period = 14) {
  const tr = bars.map((b, i) => {
    if (i === 0) return b.h - b.l;
    const pc = bars[i - 1].c;
    return Math.max(b.h - b.l, Math.abs(b.h - pc), Math.abs(b.l - pc));
  });

  const out = new Array(bars.length).fill(null);
  if (bars.length < period) return out;

  let seed = 0;
  for (let i = 0; i < period; i++) seed += tr[i];
  let prev = seed / period;
  out[period - 1] = prev;

  for (let i = period; i < bars.length; i++) {
    prev = ((prev * (period - 1)) + tr[i]) / period;
    out[i] = prev;
  }
  return out;
}

function macd(values, fast = 12, slow = 26, signalPeriod = 9) {
  const ef = ema(values, fast);
  const es = ema(values, slow);
  const line = values.map((_, i) =>
    Number.isFinite(ef[i]) && Number.isFinite(es[i]) ? ef[i] - es[i] : null
  );

  const compact = [];
  const indexMap = [];
  line.forEach((v, i) => {
    if (Number.isFinite(v)) {
      compact.push(v);
      indexMap.push(i);
    }
  });

  const sigCompact = ema(compact, signalPeriod);
  const signal = new Array(values.length).fill(null);
  indexMap.forEach((originalIndex, compactIndex) => {
    signal[originalIndex] = sigCompact[compactIndex];
  });

  const histogram = values.map((_, i) =>
    Number.isFinite(line[i]) && Number.isFinite(signal[i]) ? line[i] - signal[i] : null
  );

  return { line, signal, histogram };
}

function lastFinite(arr) {
  for (let i = arr.length - 1; i >= 0; i--) {
    if (Number.isFinite(arr[i])) return arr[i];
  }
  return null;
}

function analyzeTimeframe(bars, name) {
  const closes = bars.map(b => b.c);
  const ema20A = ema(closes, 20);
  const ema50A = ema(closes, 50);
  const ema200A = ema(closes, 200);
  const rsiA = rsi(closes, 14);
  const atrA = atr(bars, 14);
  const macdA = macd(closes);

  const close = closes[closes.length - 1];
  const e20 = lastFinite(ema20A);
  const e50 = lastFinite(ema50A);
  const e200 = lastFinite(ema200A);
  const r = lastFinite(rsiA);
  const a = lastFinite(atrA);
  const mLine = lastFinite(macdA.line);
  const mSignal = lastFinite(macdA.signal);
  const mHist = lastFinite(macdA.histogram);

  const recent = bars.slice(-20);
  const support = Math.min(...recent.map(b => b.l));
  const resistance = Math.max(...recent.map(b => b.h));

  let score = 0;
  const reasons = [];

  if ([close,e20,e50,e200].every(Number.isFinite)) {
    if (close > e20 && e20 > e50 && e50 > e200) {
      score += 40;
      reasons.push("EMA allineate rialziste");
    } else if (close < e20 && e20 < e50 && e50 < e200) {
      score -= 40;
      reasons.push("EMA allineate ribassiste");
    } else {
      if (close > e20) score += 8;
      else score -= 8;

      if (e20 > e50) score += 8;
      else score -= 8;

      if (e50 > e200) score += 8;
      else score -= 8;

      reasons.push("Trend EMA misto");
    }
  }

  if (Number.isFinite(r)) {
    if (r >= 55 && r <= 70) {
      score += 14;
      reasons.push(`RSI positivo (${r.toFixed(1)})`);
    } else if (r <= 45 && r >= 30) {
      score -= 14;
      reasons.push(`RSI negativo (${r.toFixed(1)})`);
    } else if (r > 70) {
      score += 4;
      reasons.push(`RSI in ipercomprato (${r.toFixed(1)})`);
    } else if (r < 30) {
      score -= 4;
      reasons.push(`RSI in ipervenduto (${r.toFixed(1)})`);
    } else {
      reasons.push(`RSI neutrale (${r.toFixed(1)})`);
    }
  }

  if (Number.isFinite(mHist)) {
    if (mHist > 0) {
      score += 18;
      reasons.push("MACD positivo");
    } else if (mHist < 0) {
      score -= 18;
      reasons.push("MACD negativo");
    }
  }

  if (recent.length >= 6) {
    const older = recent.slice(0, 10);
    const newer = recent.slice(-10);
    const oldMid = (Math.max(...older.map(b => b.h)) + Math.min(...older.map(b => b.l))) / 2;
    const newMid = (Math.max(...newer.map(b => b.h)) + Math.min(...newer.map(b => b.l))) / 2;
    if (newMid > oldMid) {
      score += 12;
      reasons.push("Struttura prezzi crescente");
    } else if (newMid < oldMid) {
      score -= 12;
      reasons.push("Struttura prezzi decrescente");
    }
  }

  score = Math.max(-100, Math.min(100, score));

  let bias = "NEUTRAL";
  if (score >= 20) bias = "BUY";
  if (score <= -20) bias = "SELL";

  const atrPct = Number.isFinite(a) && close ? (a / close) * 100 : null;

  return {
    timeframe: name,
    lastClose: close,
    timestamp: bars[bars.length - 1]?.t || null,
    ema20: e20,
    ema50: e50,
    ema200: e200,
    rsi14: r,
    atr14: a,
    atrPct,
    macd: {
      line: mLine,
      signal: mSignal,
      histogram: mHist
    },
    support20: support,
    resistance20: resistance,
    score,
    bias,
    reasons
  };
}

function combine(timeframes) {
  const weights = { M15: 0.15, H1: 0.30, H4: 0.35, D1: 0.20 };
  let weighted = 0;
  let totalWeight = 0;

  for (const [tf, data] of Object.entries(timeframes)) {
    const w = weights[tf] || 0;
    if (Number.isFinite(data?.score)) {
      weighted += data.score * w;
      totalWeight += w;
    }
  }

  const score = totalWeight ? weighted / totalWeight : 0;

  let bias = "NEUTRAL";
  if (score >= 20) bias = "BUY";
  if (score <= -20) bias = "SELL";

  const confidence = Math.min(100, Math.round(Math.abs(score)));

  const directional = Object.values(timeframes).map(x => x.bias);
  const buyCount = directional.filter(x => x === "BUY").length;
  const sellCount = directional.filter(x => x === "SELL").length;
  const neutralCount = directional.filter(x => x === "NEUTRAL").length;

  return {
    score: Number(score.toFixed(1)),
    confidence,
    bias,
    alignment: { buy: buyCount, sell: sellCount, neutral: neutralCount }
  };
}

export async function GET(request) {
  const apiKey = process.env.MASSIVE_API_KEY;
  if (!apiKey) {
    return Response.json(
      { error: "MASSIVE_API_KEY non configurata su Vercel" },
      { status: 500 }
    );
  }

  const { searchParams } = new URL(request.url);
  const symbol = (searchParams.get("symbol") || "XAUUSD").toUpperCase();
  const force = searchParams.get("force") === "1";

  if (!SUPPORTED.has(symbol)) {
    return Response.json({ error: "Asset non supportato" }, { status: 400 });
  }

  const cacheKey = symbol;
  const cached = globalThis.__propMarketCache.get(cacheKey);

  if (!force && cached && Date.now() - cached.ts < CACHE_TTL) {
    return Response.json({
      ...cached.data,
      cache: true,
      cacheAgeMs: Date.now() - cached.ts
    }, {
      headers: { "Cache-Control": "no-store" }
    });
  }

  try {
    const entries = await Promise.all(
      Object.entries(TF).map(async ([name, cfg]) => {
        const bars = await fetchBars(symbol, cfg, apiKey);
        return [name, analyzeTimeframe(bars, name)];
      })
    );

    const timeframes = Object.fromEntries(entries);
    const combined = combine(timeframes);

    const data = {
      ok: true,
      symbol,
      generatedAt: new Date().toISOString(),
      source: "Massive",
      note: "Score quantitativo, non probabilità di successo.",
      combined,
      timeframes
    };

    globalThis.__propMarketCache.set(cacheKey, { ts: Date.now(), data });

    return Response.json(data, {
      headers: { "Cache-Control": "no-store" }
    });
  } catch (e) {
    console.error("Market analysis error:", e);
    return Response.json(
      {
        error: e?.message || "Errore Market Engine",
        symbol
      },
      { status: 502 }
    );
  }
}
