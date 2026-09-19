export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const apiKey = process.env.THERUNDOWN_API_KEY;

    if (!apiKey) {
      return Response.json(
        { ok: false, error: "THERUNDOWN_API_KEY mancante" },
        { status: 500 }
      );
    }

    const oggi = new Date().toISOString().slice(0, 10);

    const url =
      `https://therundown.io/api/v2/sports/markets/${oggi}`;

    const res = await fetch(url, {
      headers: {
        "X-TheRundown-Key": apiKey,
      },
      cache: "no-store",
    });

    const data = await res.json();

    // Ci interessa SOLO EPL = sport 11
    const epl =
      data?.["11"] ||
      data?.[11] ||
      [];

    return Response.json({
      ok: res.ok,
      status: res.status,
      data: oggi,

      EPL: {
        sport_id: 11,
        numero_mercati: Array.isArray(epl) ? epl.length : 0,

        mercati: Array.isArray(epl)
          ? epl.map(m => ({
              id: m.id,
              nome: m.name,
              descrizione: m.short_description,
              periodo: m.period_id,
              live: m.live_variant_id
            }))
          : epl
      },

      quota: {
        usati: res.headers.get("x-datapoints"),
        remaining: res.headers.get("x-datapoints-remaining"),
        limit: res.headers.get("x-datapoints-limit")
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
