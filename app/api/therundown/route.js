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

    // TEST: EPL del 20 settembre 2026
    const dataTest = "2026-09-20";

    // 1. Recupera gli eventi EPL della giornata
    const eventiUrl =
      `https://therundown.io/api/v2/sports/11/events/${dataTest}`;

    const eventiRes = await fetch(eventiUrl, {
      headers: {
        "X-TheRundown-Key": apiKey,
      },
      cache: "no-store",
    });

    const eventiData = await eventiRes.json();
    const eventi = eventiData?.events || [];

    if (!eventiRes.ok) {
      return Response.json({
        ok: false,
        fase: "RECUPERO EVENTI",
        status: eventiRes.status,
        risposta: eventiData,
      });
    }

    if (eventi.length === 0) {
      return Response.json({
        ok: false,
        data_test: dataTest,
        message: "Nessuna partita EPL trovata per questa data",
      });
    }

    // 2. Prende la prima partita NON terminata
    const evento = eventi.find(
      (e) => e.event_status !== "STATUS_FULL_TIME"
    );

    if (!evento) {
      return Response.json({
        ok: false,
        data_test: dataTest,
        message: "Tutte le partite trovate risultano terminate",
        numero_eventi: eventi.length,
        eventi: eventi.map((e) => ({
          event_id: e.event_id,
          data: e.event_date,
          stato: e.event_status,
          squadre: e.teams?.map((t) => t.name),
        })),
      });
    }

    // 3. Chiede il MONEYLINE (mercato 1) della singola partita
    // Nessun filtro bookmaker per questo test
    const quoteUrl =
      `https://therundown.io/api/v2/events/${evento.event_id}` +
      `?market_ids=1` +
      `&main_line=true` +
      `&hide_closed=true`;

    const quoteRes = await fetch(quoteUrl, {
      headers: {
        "X-TheRundown-Key": apiKey,
      },
      cache: "no-store",
    });

    const quoteData = await quoteRes.json();

    // 4. Risposta diagnostica
    return Response.json({
      ok: quoteRes.ok,

      data_test: dataTest,

      eventi_trovati: eventi.length,

      partita_scelta: {
        event_id: evento.event_id,
        data: evento.event_date,
        stato: evento.event_status,
        squadre: evento.teams?.map((t) => ({
          nome: t.name,
          casa: t.is_home,
          trasferta: t.is_away,
        })),
      },

      numero_mercati: quoteData?.markets?.length || 0,

      markets: quoteData?.markets || [],

      risposta_completa: quoteData,

      quota: {
        usati: quoteRes.headers.get("x-datapoints"),
        remaining: quoteRes.headers.get("x-datapoints-remaining"),
        limit: quoteRes.headers.get("x-datapoints-limit"),
        delay_seconds: quoteRes.headers.get("x-data-delay-seconds"),
      },
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
