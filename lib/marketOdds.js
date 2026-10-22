// Statistica storica XAUUSD (vedi scripts/build-market-odds.js). Solo descrittiva: nessuna previsione di direzione.
import odds from "./market-odds.json";

export const ODDS_META = odds.meta;

export function atrRegime(atr) {
  if (!Number.isFinite(atr)) return "all";
  return atr < odds.atrEdges.q1 ? "low" : atr < odds.atrEdges.q2 ? "mid" : "high";
}

// Ampiezza attesa (max-min) delle prossime 3 ore, in dollari, per l'ora UTC del segnale.
export function rangeForecast(atr, utcHour) {
  if (!Number.isFinite(atr) || atr <= 0) return null;
  const r = odds.range3h.byUtcHour[String(utcHour)] || odds.range3h.all;
  const usd = k => Math.round(k * atr * 10) / 10;
  return {
    horizonHours: 3,
    atrM15: Math.round(atr * 100) / 100,
    regime: atrRegime(atr),
    utcHour,
    p10: usd(r.p10), median: usd(r.p50), p90: usd(r.p90),
    sample: r.n,
    note: "Ampiezza storica delle 3h successive (max-min), non la direzione."
  };
}

function bracket(arr, x) {
  if (x <= arr[0]) return [0, 0, 0];
  if (x >= arr[arr.length - 1]) return [arr.length - 1, arr.length - 1, 0];
  let i = 0; while (arr[i + 1] < x) i++;
  return [i, i + 1, (x - arr[i]) / (arr[i + 1] - arr[i])];
}

// Probabilita' storica (%) che il TP sia toccato prima dello SL entro H ore. tp/sl in dollari.
// Fuori griglia: interpolazione lineare, estremi tenuti fermi (TP oltre 100$ o SL sotto 3$ = stima grezza).
export function touchOdds(regime, side, hours, tp, sl) {
  const t = odds.firstTouch[regime]?.[side]?.[String(hours)] || odds.firstTouch.all?.[side]?.[String(hours)];
  if (!t || !(tp > 0) || !(sl > 0)) return null;
  const [t0, t1, tf] = bracket(odds.grid.tp, tp), [s0, s1, sf] = bracket(odds.grid.sl, sl);
  const lerp = m => {
    const a = m[s0][t0] * (1 - tf) + m[s0][t1] * tf, b = m[s1][t0] * (1 - tf) + m[s1][t1] * tf;
    return Math.round((a * (1 - sf) + b * sf) * 10) / 10;
  };
  const tpHit = lerp(t.tp), slHit = lerp(t.sl);
  return { tp: tpHit, sl: slHit, open: Math.round((100 - tpHit - slHit) * 10) / 10, n: t.n, randomWalkRef: Math.round(1000 * sl / (sl + tp)) / 10 };
}
