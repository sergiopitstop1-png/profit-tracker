export const dynamic = "force-dynamic";

const sleep = (ms) =>
  new Promise((resolve) => setTimeout(resolve, ms));

export async function GET() {
  try {
    const apiKey = process.env.THERUNDOWN_API_KEY;

    if (!apiKey) {
      return Response.json(
        { ok: false, error: "THERUNDOWN_API_KEY mancante" },
        { status: 500 }
      );
    }

    const dataTest = "2026-09-20";

    // =====================================================
    // 1. RECUPERA EVENTI EPL
    // =====================================================

    const eventiUrl =
      `https://therundown.io/api/v2/sports/11/events/${dataTest}`;

    const eventiRes = await fetch(eventiUrl, {
      headers: {
        "X-TheRundown-Key": apiKey,
      },
      cache: "no-store",
    });

    const eventiData = await eventiRes.json();

    if (!eventiRes.ok) {
      return Response.json({
        ok: false,
        fase: "RECUPERO EVENTI",
        status: eventiRes.status,
        risposta: eventiData,
      });
    }

    const eventi = eventiData?.events || [];

    if (eventi.length === 0) {
      return Response.json({
        ok: false,
        data_test: dataTest,
        message: "Nessuna partita EPL trovata",
      });
    }

    // Prima partita non terminata
    const evento = eventi.find(
      (e) => e.event_status !== "STATUS_FULL_TIME"
    );

    if (!evento) {
      return Response.json({
        ok: false,
        data_test: dataTest,
        message: "Nessuna partita non terminata",
        numero_eventi: eventi.length,
      });
    }

    // =====================================================
    // IMPORTANTE:
    // FREE TIER = 1 RICHIESTA AL SECONDO
    // Aspettiamo 1,2 secondi prima della seconda richiesta
    // =====================================================

    await sleep(1200);

    // =====================================================
    // 2. RECUPERA MONEYLINE DELLA PARTITA
    // =====================================================

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

    // Se la seconda chiamata fallisce,
    // mostriamo chiaramente l'errore.
    if (!quoteRes.ok) {
      return Response.json({
        ok: false,

        fase: "RECUPERO QUOTE",

        partita_scelta: {
          event_id: evento.event_id,
          data: evento.event_date,
          stato: evento.event_status,
          squadre: evento.teams?.map((t) => t.name),
        },

        status_quote: quoteRes.status,

        errore_quote: quoteData,

        quota: {
          remaining:
            quoteRes.headers.get("x-datapoints-remaining"),
          limit:
            quoteRes.headers.get("x-datapoints-limit"),
          delay_seconds:
            quoteRes.headers.get("x-data-delay-seconds"),
        },
      });
    }

    // =====================================================
    // 3. RISULTATO
    // =====================================================

    return Response.json({
      ok: true,

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

      numero_mercati:
        quoteData?.markets?.length || 0,

      markets:
        quoteData?.markets || [],

      risposta_completa:
        quoteData,

      quota: {
        usati:
          quoteRes.headers.get("x-datapoints"),

        remaining:
          quoteRes.headers.get("x-datapoints-remaining"),

        limit:
          quoteRes.headers.get("x-datapoints-limit"),

        delay_seconds:
          quoteRes.headers.get("x-data-delay-seconds"),
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
