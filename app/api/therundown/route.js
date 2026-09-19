export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const apiKey = process.env.THERUNDOWN_API_KEY;

    if (!apiKey) {
      return Response.json(
        { ok: false, error: "THERUNDOWN_API_KEY non configurata" },
        { status: 500 }
      );
    }

    const oggi = new Date().toISOString().slice(0, 10);

    // EPL = 11
    // 1 = Moneyline
    // 2 = Handicap
    // 3 = Totals
    //
    // 3  = Pinnacle
    // 19 = DraftKings
    // 23 = FanDuel

    const url =
      `https://therundown.io/api/v2/sports/11/events/${oggi}` +
      `?market_ids=1,2,3` +
     `&affiliate_ids=22,19,23` +
      `&main_line=true` +
      `&hide_closed=true`;

    const res = await fetch(url, {
      headers: {
        "X-TheRundown-Key": apiKey,
      },
      cache: "no-store",
    });

    const data = await res.json();

    // Mostriamo solo la prima partita per non avere
    // di nuovo 30 schermate di JSON :-)
    const evento = data?.events?.[0] || null;

    return Response.json({
      ok: res.ok,

      status: res.status,

      quota: {
        usati: res.headers.get("x-datapoints"),
        remaining: res.headers.get("x-datapoints-remaining"),
        limit: res.headers.get("x-datapoints-limit"),
        delay_seconds: res.headers.get("x-data-delay-seconds"),
      },

      numero_eventi: data?.events?.length || 0,

      esempio_evento: evento
        ? {
            event_id: evento.event_id,
            data: evento.event_date,

            squadre: evento.teams?.map(t => ({
              id: t.team_id,
              nome: t.name,
              casa: t.is_home,
              trasferta: t.is_away,
            })),

            markets: evento.markets,
          }
        : null,
    });

  } catch (error) {
    return Response.json(
      {
        ok: false,
        error: error?.message || String(error),
      },
      { status: 500 }
    );
  }
}
