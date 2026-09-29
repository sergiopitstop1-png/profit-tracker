export const dynamic = "force-dynamic";
export const revalidate = 0;

const url = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
const table = "prop_market_signal_log";

function reply(data, status = 200) {
  return Response.json(data, { status, headers: { "Cache-Control": "no-store" } });
}

function quantile(sorted, p) {
  const index = (sorted.length - 1) * p;
  const low = Math.floor(index);
  const fraction = index - low;
  return sorted[low] + fraction * (sorted[Math.min(low + 1, sorted.length - 1)] - sorted[low]);
}

function pathClose(row, bars) {
  const path = Array.isArray(row.path_m15_3h) && row.path_m15_3h.length >= bars
    ? row.path_m15_3h : row.path_m15_24h;
  if (!Array.isArray(path) || path.length < bars) return null;
  const ordered = [...path].sort((a, b) => Number(a.t) - Number(b.t));
  const close = Number(ordered[bars - 1]?.c);
  return Number.isFinite(close) && close > 0 ? close : null;
}

function evaluate(rows, hours) {
  const samples = rows.map(row => {
    const entry = Number(row.entry_price);
    const close = pathClose(row, hours * 4);
    return entry > 0 && close != null ? close - entry : null;
  }).filter(Number.isFinite);

  // Keep the latest observations untouched while deriving the interval from older signals.
  if (samples.length < 80) return { available: false, samples: samples.length, reason: "Servono almeno 80 segnali completi della versione corrente e della stessa direzione." };
  const split = Math.floor(samples.length * 0.8);
  const train = samples.slice(0, split).sort((a, b) => a - b);
  const test = samples.slice(split);
  const median = quantile(train, 0.5);
  const low = quantile(train, 0.1);
  const high = quantile(train, 0.9);
  const mae = test.reduce((sum, actual) => sum + Math.abs(actual - median), 0) / test.length;
  const baselineMae = test.reduce((sum, actual) => sum + Math.abs(actual), 0) / test.length;
  const coverage = test.filter(actual => actual >= low && actual <= high).length / test.length;
  return { available: true, samples: samples.length, testSamples: test.length,
    deltaMedian: median, deltaLow: low, deltaHigh: high,
    mae, baselineMae, coverage, beatsBaseline: mae < baselineMae };
}

export async function GET(request) {
  try {
    if (!url || !key) throw new Error("Supabase non configurato");
    const params = new URL(request.url).searchParams;
    const symbol = String(params.get("symbol") || "XAUUSD").toUpperCase().replace(/[^A-Z0-9]/g, "");
    const direction = String(params.get("direction") || "").toUpperCase();
    if (!symbol || !["BUY", "SELL"].includes(direction)) return reply({ ok: false, error: "Asset o direzione non validi" }, 400);

    const headers = { apikey: key, Authorization: `Bearer ${key}` };
    const base = `${url}/rest/v1/${table}?symbol=eq.${encodeURIComponent(symbol)}`;
    const latestResponse = await fetch(`${base}&select=engine_version&order=signal_m15_time.desc&limit=1`, { headers, cache: "no-store" });
    if (!latestResponse.ok) throw new Error(`Lettura versione: HTTP ${latestResponse.status}`);
    const latest = await latestResponse.json();
    const version = latest?.[0]?.engine_version;
    if (!version) return reply({ ok: true, available: false, reason: "Nessun segnale storico disponibile" });

    const rows = [];
    for (let offset = 0; offset < 1000; offset += 500) {
      const query = `${base}&engine_version=eq.${encodeURIComponent(version)}` +
        `&forecast_direction=eq.${direction}&select=signal_m15_time,entry_price,path_m15_3h,path_m15_24h` +
        `&order=signal_m15_time.desc&limit=500&offset=${offset}`;
      const response = await fetch(query, { headers, cache: "no-store" });
      if (!response.ok) throw new Error(`Lettura percorsi: HTTP ${response.status}`);
      const page = await response.json();
      if (!Array.isArray(page)) throw new Error("Percorsi storici non validi");
      rows.push(...page);
      if (page.length < 500) break;
    }

    rows.reverse();
    return reply({ ok: true, symbol, direction, engineVersion: version,
      historicalWindow: "ultimi 1000 segnali della stessa versione e direzione",
      horizons: { "1": evaluate(rows, 1), "3": evaluate(rows, 3) } });
  } catch (error) {
    return reply({ ok: false, error: error?.message || String(error) }, 500);
  }
}
