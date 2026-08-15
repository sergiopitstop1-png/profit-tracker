export const dynamic = "force-dynamic";
export const revalidate = 0;

const SYMBOLS = {
  XAUUSD: ["XAU", "USD"],
  XAGUSD: ["XAG", "USD"],
  EURUSD: ["EUR", "USD"],
  GBPUSD: ["GBP", "USD"],
  USDJPY: ["USD", "JPY"],
  USDCHF: ["USD", "CHF"],
  USDCAD: ["USD", "CAD"],
  AUDUSD: ["AUD", "USD"],
  NZDUSD: ["NZD", "USD"],
  EURGBP: ["EUR", "GBP"],
  EURJPY: ["EUR", "JPY"],
  EURCHF: ["EUR", "CHF"],
  EURAUD: ["EUR", "AUD"],
  GBPJPY: ["GBP", "JPY"],
  GBPCHF: ["GBP", "CHF"],
  GBPAUD: ["GBP", "AUD"],
  AUDJPY: ["AUD", "JPY"],
  CADJPY: ["CAD", "JPY"],
  CHFJPY: ["CHF", "JPY"],
  NZDJPY: ["NZD", "JPY"],
};

function pickQuote(payload) {
  const rows = Array.isArray(payload) ? payload : [payload];
  for (const row of rows) {
    const spread = row?.spreadProfilePrices?.[0] || row?.spreadProfilePrice || row;
    const bid = Number(spread?.bid ?? row?.bid);
    const ask = Number(spread?.ask ?? row?.ask);
    if (Number.isFinite(bid) && Number.isFinite(ask)) return { bid, ask, price: (bid + ask) / 2 };
    const price = Number(row?.price ?? row?.last ?? row?.mid);
    if (Number.isFinite(price)) return { bid: null, ask: null, price };
  }
  return null;
}

export async function GET(request) {
  const { searchParams } = new URL(request.url);
  const symbol = (searchParams.get("symbol") || "XAUUSD").toUpperCase();
  const pair = SYMBOLS[symbol];
  if (!pair) {
    return Response.json({ error: "Asset non supportato" }, { status: 400 });
  }

  const [base, quote] = pair;
  const url = `https://forex-data-feed.swissquote.com/public-quotes/bboquotes/instrument/${encodeURIComponent(base)}/${encodeURIComponent(quote)}`;

  try {
    const res = await fetch(url, {
      cache: "no-store",
      headers: { "accept": "application/json", "user-agent": "ProfitTracker/1.0" }
    });
    if (!res.ok) throw new Error(`Feed HTTP ${res.status}`);
    const payload = await res.json();
    const q = pickQuote(payload);
    if (!q) throw new Error("Formato prezzo non riconosciuto");

    return Response.json({
      symbol, ...q, source: "Swissquote", time: new Date().toISOString()
    }, {
      headers: { "Cache-Control": "no-store, no-cache, must-revalidate, proxy-revalidate" }
    });
  } catch (e) {
    return Response.json({ error: e?.message || "Feed non disponibile", symbol }, { status: 502 });
  }
}
