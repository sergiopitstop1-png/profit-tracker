'use strict';
/*
 Genera lib/market-odds.json dalla storia M15 esportata da MT5.
 Uso:  node scripts/build-market-odds.js  XAUUSD_M15_....csv  [lib/market-odds.json]
 (MT5: Visualizza > Simboli > Barre > esporta, separatore TAB, colonne DATE TIME OPEN HIGH LOW CLOSE ...)

 Contenuto (solo statistica descrittiva, NON una previsione di direzione):
  - range: ampiezza (max-min) delle 3 ore successive, in multipli di ATR M15, per ora UTC;
  - firstTouch: probabilita' storica che il TP sia toccato PRIMA dello SL, per regime di ATR,
    lato BUY/SELL, orizzonte 1/2/3/6/12/24h e griglia TP/SL in dollari.
  Convenzione identica all'evaluator del sito: entrata = chiusura della barra di segnale,
  si guardano le barre successive fino a t+H; se TP e SL cadono nella stessa barra conta SL (prudente).
*/
const fs = require('fs');
const CSV = process.argv[2];
const OUT = process.argv[3] || 'lib/market-odds.json';
if (!CSV) { console.error('Uso: node scripts/build-market-odds.js file.csv [out.json]'); process.exit(1); }

// server MT5 = New York + 7h (UTC+3 con NY in ora legale, UTC+2 in ora solare)
const nyFmt = new Intl.DateTimeFormat('en-US', { timeZone: 'America/New_York', timeZoneName: 'shortOffset', hour: 'numeric' });
const cache = new Map();
function nyOff(ms) {
  const k = Math.floor(ms / 3600000);
  let v = cache.get(k);
  if (v === undefined) { v = parseInt(nyFmt.formatToParts(new Date(ms)).find(x => x.type === 'timeZoneName').value.replace('GMT', ''), 10); cache.set(k, v); }
  return v;
}
const serverToUtc = w => (nyOff(w - 3 * 3600e3) === -4 ? w - 3 * 3600e3 : w - 2 * 3600e3);

const lines = fs.readFileSync(CSV, 'utf8').split(/\r?\n/).filter(Boolean);
const bars = [];
for (let i = 1; i < lines.length; i++) {
  const f = lines[i].split('\t'); if (f.length < 6) continue;
  const [y, mo, d] = f[0].split('.').map(Number), [h, mi] = f[1].split(':').map(Number);
  bars.push({ t: serverToUtc(Date.UTC(y, mo - 1, d, h, mi)), h: +f[3], l: +f[4], c: +f[5] });
}
bars.sort((a, b) => a.t - b.t);
const idx = new Map(bars.map((b, i) => [b.t, i]));

// ATR14 Wilder come nel motore
const atr = new Array(bars.length).fill(null);
{ const tr = bars.map((b, i) => i ? Math.max(b.h - b.l, Math.abs(b.h - bars[i - 1].c), Math.abs(b.l - bars[i - 1].c)) : b.h - b.l);
  let p = tr.slice(0, 14).reduce((a, b) => a + b, 0) / 14; atr[13] = p;
  for (let i = 14; i < bars.length; i++) { p = (p * 13 + tr[i]) / 14; atr[i] = p; } }

const TPS = [5, 10, 15, 20, 30, 40, 50, 75, 100];
const SLS = [3, 5, 7.5, 10, 15, 20, 30];
const HOURS = [1, 2, 3, 6, 12, 24];
const MAXB = 96;
const sig = [];
for (let i = 200; i < bars.length - 1; i++) if (atr[i]) sig.push(i);
const atrs = sig.map(i => atr[i]).sort((a, b) => a - b);
const q1 = atrs[Math.floor(atrs.length / 3)], q2 = atrs[Math.floor(2 * atrs.length / 3)];
const regimeOf = a => (a < q1 ? 'low' : a < q2 ? 'mid' : 'high');
const acc = {}; // regime|side|H -> counts
const get = (r, s, H) => (acc[`${r}|${s}|${H}`] ||= { n: 0, tp: SLS.map(() => TPS.map(() => 0)), sl: SLS.map(() => TPS.map(() => 0)) });
const rangeAcc = {}; // hour -> ratios
const INF = 1e9;

for (const i of sig) {
  const t0 = bars[i].t, entry = bars[i].c, reg = regimeOf(atr[i]);
  const upF = new Map(), dnF = new Map();
  for (const L of [...TPS, ...SLS]) { upF.set(L, INF); dnF.set(L, INF); }
  // finestra a tempo reale (come l'evaluator): barre con t in (t0, t0+24h]; k = minuti/15 dal segnale
  let hi3 = -INF, lo3 = INF, n3 = 0, has = new Set();
  for (let j = i + 1; bars[j] && bars[j].t <= t0 + MAXB * 900000; j++) {
    const b = bars[j], k = (b.t - t0) / 900000; has.add(k);
    for (const L of upF.keys()) { if (upF.get(L) === INF && b.h - entry >= L) upF.set(L, k); if (dnF.get(L) === INF && entry - b.l >= L) dnF.set(L, k); }
    if (k <= 12) { hi3 = Math.max(hi3, b.h); lo3 = Math.min(lo3, b.l); n3++; }
  }
  const hr = new Date(t0).getUTCHours();
  if (has.has(12) && n3 >= 8) (rangeAcc[hr] ||= []).push((hi3 - lo3) / atr[i]);
  for (const side of ['BUY', 'SELL']) {
    const win = side === 'BUY' ? upF : dnF, lose = side === 'BUY' ? dnF : upF;
    for (const H of HOURS) {
      const nb = H * 4;
      if (!has.has(nb)) continue; // serve la barra a t+H
      for (const r of [reg, 'all']) {
        const a = get(r, side, H); a.n++;
        SLS.forEach((sl, si) => TPS.forEach((tp, ti) => {
          const tt = win.get(tp), ss = lose.get(sl);
          if (tt <= nb && tt < ss) a.tp[si][ti]++;
          else if (ss <= nb) a.sl[si][ti]++;
        }));
      }
    }
  }
}
const pct = (x, n) => Math.round((1000 * x) / n) / 10;
const firstTouch = {};
for (const [k, a] of Object.entries(acc)) {
  const [r, s, H] = k.split('|');
  ((firstTouch[r] ||= {})[s] ||= {})[H] = { n: a.n, tp: a.tp.map(row => row.map(x => pct(x, a.n))), sl: a.sl.map(row => row.map(x => pct(x, a.n))) };
}
const qf = (arr, p) => { const s = [...arr].sort((a, b) => a - b); return Math.round(s[Math.floor(p * (s.length - 1))] * 100) / 100; };
const range = {};
for (const [h, arr] of Object.entries(rangeAcc)) range[h] = { n: arr.length, p10: qf(arr, .1), p50: qf(arr, .5), p90: qf(arr, .9) };
const all = Object.values(rangeAcc).flat();
const out = {
  meta: { generatedAt: new Date().toISOString(), symbol: 'XAUUSD', source: 'MT5 M15', bars: bars.length, from: new Date(bars[0].t).toISOString(), to: new Date(bars[bars.length - 1].t).toISOString(), signals: sig.length,
    note: 'Statistica storica descrittiva. Nessun vantaggio direzionale a 3h: usare per ampiezza attesa e probabilita TP/SL, non per la direzione.' },
  grid: { tp: TPS, sl: SLS, hours: HOURS },
  atrEdges: { q1: +q1.toFixed(3), q2: +q2.toFixed(3) },
  range3h: { unit: 'multipli di ATR M15 (max-min delle 3h successive)', all: { n: all.length, p10: qf(all, .1), p50: qf(all, .5), p90: qf(all, .9) }, byUtcHour: range },
  firstTouch
};
fs.writeFileSync(OUT, JSON.stringify(out));
console.log('scritto', OUT, (fs.statSync(OUT).size / 1024).toFixed(0) + ' KB', '| segnali', sig.length, '| ATR terzili', q1.toFixed(2), q2.toFixed(2));
