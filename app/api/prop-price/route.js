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
    const prices = row?.spreadProfilePrices;
    if (Array.isArray(prices) && prices.length) {
      const preferred = prices.find(p => p?.spreadProfile === "elite") || prices[0];
      const bid = Number(preferred?.bid);
      const ask = Number(preferred?.ask);
      if (Number.isFinite(bid) && Number.isFinite(ask)) return { bid, ask, price: (bid + ask) / 2 };
    }
    const bid = Number(row?.bid);
    const ask = Number(row?.ask);
    if (Number.isFinite(bid) && Number.isFinite(ask)) return { bid, ask, price: (bid + ask) / 2 };
    const price = Number(row?.price ?? row?.last ?? row?.mid);
    if (Number.isFinite(price)) return { bid: null, ask: null, price };
  }
  return null;
}

async function getPair(base, quote) {
  const url = `https://forex-data-feed.swissquote.com/public-quotes/bboquotes/instrument/${encodeURIComponent(base)}/${encodeURIComponent(quote)}`;
  const res = await fetch(url, {
    cache: "no-store",
    headers: { accept: "application/json", "user-agent": "ProfitTracker/1.0" }
  });
  if (!res.ok) throw new Error(`Feed ${base}/${quote} HTTP ${res.status}`);
  const payload = await res.json();
  const q = pickQuote(payload);
  if (!q) throw new Error(`Formato prezzo ${base}/${quote} non riconosciuto`);
  return q;
}

async function getQuoteToUsd(quote) {
  if (quote === "USD") return 1;

  // Prima prova QUOTE/USD.
  try {
    const direct = await getPair(quote, "USD");
    if (direct.price > 0) return direct.price;
  } catch {}

  // Poi prova USD/QUOTE e inverte.
  const inverse = await getPair("USD", quote);
  if (!inverse.price || inverse.price <= 0) throw new Error(`Conversione ${quote}->USD non disponibile`);
  return 1 / inverse.price;
}

export async function GET(request) {
  const { searchParams } = new URL(request.url);
  const symbol = (searchParams.get("symbol") || "XAUUSD").toUpperCase();
  const pair = SYMBOLS[symbol];

  if (!pair) {
    return Response.json({ error: "Asset non supportato" }, { status: 400 });
  }

  const [base, quote] = pair;

  try {
    const [q, quoteToUsd] = await Promise.all([
      getPair(base, quote),
      getQuoteToUsd(quote)
    ]);

    return Response.json({
      symbol,
      ...q,
      quoteToUsd,
      source: "Swissquote",
      time: new Date().toISOString()
    }, {
      headers: {
        "Cache-Control": "no-store, no-cache, must-revalidate, proxy-revalidate"
      }
    });
  } catch (e) {
    return Response.json({
      error: e?.message || "Feed non disponibile",
      symbol
    }, { status: 502 });
  }
}
