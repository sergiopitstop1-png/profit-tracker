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

    // TEST SINGOLO:
    // sport 11 = EPL
    const url =
      `https://therundown.io/api/v2/sports/11/events/${oggi}` +
      `?main_line=true&hide_closed=true`;

    const res = await fetch(url, {
      headers: {
        "X-TheRundown-Key": apiKey,
      },
      cache: "no-store",
    });

    const testoOriginale = await res.text();

    let risposta;

    try {
      risposta = JSON.parse(testoOriginale);
    } catch {
      risposta = testoOriginale;
    }

    // Alcuni header utili per capire esattamente il 429
    const headers = {};

    for (const [key, value] of res.headers.entries()) {
      if (
        key.includes("rate") ||
        key.includes("data") ||
        key.includes("retry") ||
        key.includes("limit")
      ) {
        headers[key] = value;
      }
    }

    return Response.json({
      ok: res.ok,

      test: "EPL singolo - diagnostica 429",

      richiesta: {
        sport_id: 11,
        data: oggi,
      },

      risposta_http: {
        status: res.status,
        statusText: res.statusText,
      },

      headers,

      risposta_therundown: risposta,
    });

  } catch (error) {
    return Response.json(
      {
        ok: false,
        errore_locale: error?.message || String(error),
      },
      { status: 500 }
    );
  }
}
