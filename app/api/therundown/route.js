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

    // 1. Prendiamo gli eventi EPL di oggi
    const eventiRes = await fetch(
      `https://therundown.io/api/v2/sports/11/events/${oggi}`,
      {
        headers: {
          "X-TheRundown-Key": apiKey,
        },
        cache: "no-store",
      }
    );

    const eventiData = await eventiRes.json();
    const eventi = eventiData?.events || [];

    // Cerchiamo una partita non terminata
    const evento =
      eventi.find(
        e =>
          e.event_status !== "STATUS_FULL_TIME" &&
          new Date(e.event_date).getTime() > Date.now()
      ) ||
      eventi.find(e => e.event_status !== "STATUS_FULL_TIME");

    if (!evento) {
      return Response.json({
        ok: false,
        message: "Nessuna partita EPL futura/non terminata trovata oggi",
        eventi_trovati: eventi.length
      });
    }

    // 2. Interroghiamo quella partita per Moneyline
    const quoteRes = await fetch(
      `https://therundown.io/api/v2/events/${evento.event_id}?market_ids=1&main_line=true&hide_closed=true`,
      {
        headers: {
          "X-TheRundown-Key": apiKey,
        },
        cache: "no-store",
      }
    );

    const quoteData = await quoteRes.json();

    return Response.json({
      ok: quoteRes.ok,

      partita_scelta: {
        event_id: evento.event_id,
        data: evento.event_date,
        stato: evento.event_status,
        squadre: evento.teams?.map(t => t.name)
      },

      numero_mercati: quoteData?.markets?.length || 0,

      markets: quoteData?.markets || [],

      quota: {
        usati: quoteRes.headers.get("x-datapoints"),
        remaining: quoteRes.headers.get("x-datapoints-remaining"),
        limit: quoteRes.headers.get("x-datapoints-limit"),
        delay_seconds: quoteRes.headers.get("x-data-delay-seconds")
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
