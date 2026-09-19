export const dynamic = "force-dynamic";

async function callTR(path, apiKey) {
  const res = await fetch(`https://therundown.io${path}`, {
    headers: {
      "X-TheRundown-Key": apiKey,
    },
    cache: "no-store",
  });

  const text = await res.text();

  let data;
  try {
    data = JSON.parse(text);
  } catch {
    data = text;
  }

  return {
    ok: res.ok,
    status: res.status,
    data,
    remaining: res.headers.get("x-datapoints-remaining"),
    used: res.headers.get("x-datapoints-used"),
  };
}

export async function GET() {
  try {
    const apiKey = process.env.THERUNDOWN_API_KEY;

    if (!apiKey) {
      return Response.json(
        { ok: false, error: "THERUNDOWN_API_KEY non configurata" },
        { status: 500 }
      );
    }

    const [sportsRes, affiliatesRes, marketsRes] = await Promise.all([
      callTR("/api/v2/sports", apiKey),
      callTR("/api/v2/affiliates", apiKey),
      callTR("/api/v2/markets", apiKey),
    ]);

    const sports =
      sportsRes.data?.sports ||
      sportsRes.data?.data ||
      [];

    const affiliates =
      affiliatesRes.data?.affiliates ||
      affiliatesRes.data?.data ||
      [];

    const markets =
      marketsRes.data?.markets ||
      marketsRes.data?.data ||
      [];

    // Campionati / competizioni calcio che interessano a Lucy
    const paroleCalcio = [
      "EPL",
      "ITALY",
      "GERMANY",
      "SPAIN",
      "FRANCE",
      "UEFACHAMP",
      "UEFAEURO",
      "MLS",
      "BRAZIL",
      "SOCCER"
    ];

    const calcio = sports.filter((s) => {
      const nome = String(
        s.sport_name ||
        s.name ||
        ""
      ).toUpperCase();

      return paroleCalcio.some((p) => nome.includes(p));
    });

    // Mercati che possono essere utili a Lucy
    const mercatiLucy = [
      "moneyline",
      "spread",
      "total",
      "over_under",
      "both_teams",
      "double_chance",
      "draw_no_bet",
      "first_team_score",
      "winning_margin"
    ];

    const mercati = markets.filter((m) => {
      const testo = [
        m.name,
        m.short_description,
        m.description,
        m.family
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();

      return mercatiLucy.some((p) => testo.includes(p));
    });

    const books = affiliates.map((a) => ({
      id: a.affiliate_id ?? a.id,
      nome: a.affiliate_name ?? a.name,
      stato: a.status
    }));

    return Response.json({
      ok: true,

      riepilogo: {
        competizioni_calcio_trovate: calcio.length,
        bookmaker_trovati: books.length,
        mercati_lucy_trovati: mercati.length
      },

      competizioni: calcio.map((s) => ({
        id: s.sport_id ?? s.id,
        nome: s.sport_name ?? s.name
      })),

      bookmaker: books,

      mercati_lucy: mercati.map((m) => ({
        id: m.id,
        nome: m.name,
        descrizione: m.short_description,
        live: m.live
      })),

      quota_api: {
        remaining:
          sportsRes.remaining ||
          affiliatesRes.remaining ||
          marketsRes.remaining,
        used:
          sportsRes.used ||
          affiliatesRes.used ||
          marketsRes.used
      }
    });

  } catch (error) {
    return Response.json(
      {
        ok: false,
        error: error?.message || String(error)
      },
      { status: 500 }
    );
  }
}
