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

    // Aston Villa - Tottenham trovato dal test precedente
    const eventId = "f19d35f3ce0ce4fd80a928fc1cfe06c8";

    const url =
      `https://therundown.io/api/v2/events/${eventId}` +
      `?market_ids=1` +
      `&main_line=true` +
      `&hide_closed=true`;

    const res = await fetch(url, {
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

    return Response.json({
      ok: res.ok,
      status: res.status,

      test: "SINGOLO EVENTO - MONEYLINE SENZA FILTRO BOOK",

      event_id: eventId,

      quota: {
        usati: res.headers.get("x-datapoints"),
        remaining: res.headers.get("x-datapoints-remaining"),
        limit: res.headers.get("x-datapoints-limit"),
        delay_seconds: res.headers.get("x-data-delay-seconds")
      },

      risposta: data
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
