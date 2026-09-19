export const dynamic = "force-dynamic";

async function getEvents(sportId, apiKey) {
  const oggi = new Date().toISOString().slice(0, 10);

  const url =
    `https://therundown.io/api/v2/sports/${sportId}/events/${oggi}` +
    `?main_line=true&hide_closed=true`;

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

  return {
    sportId,
    status: res.status,
    ok: res.ok,
    remaining: res.headers.get("x-datapoints-remaining"),
    used: res.headers.get("x-datapoints-used"),
    limit: res.headers.get("x-datapoints-limit"),
    data,
  };
}

function compattaEvento(evento) {
  if (!evento || typeof evento !== "object") return evento;

  const teams =
    evento.teams ||
    evento.participants ||
    evento.competitors ||
    [];

  return {
    event_id:
      evento.event_id ??
      evento.id ??
      null,

    data:
      evento.event_date ??
      evento.start_time ??
      evento.scheduled ??
      evento.date ??
      null,

    nome:
      evento.name ??
      evento.event_name ??
      null,

    teams,

    // Per il primo test manteniamo solo un assaggio
    // della struttura quote restituita dall'API.
    lines_sample:
      evento.lines
        ? Object.entries(evento.lines).slice(0, 2)
        : evento.markets
        ? Object.entries(evento.markets).slice(0, 2)
        : null,

    chiavi_disponibili: Object.keys(evento),
  };
}

export async function GET() {
  try {
    const apiKey = process.env.THERUNDOWN_API_KEY;

    if (!apiKey) {
      return Response.json(
        {
          ok: false,
          error: "THERUNDOWN_API_KEY non configurata",
        },
        { status: 500 }
      );
    }

    // 11 = EPL
    // 16 = UEFA Champions League
    const [epl, champions] = await Promise.all([
      getEvents(11, apiKey),
      getEvents(16, apiKey),
    ]);

    const eventiEpl =
      epl.data?.events ||
      epl.data?.data ||
      [];

    const eventiChampions =
      champions.data?.events ||
      champions.data?.data ||
      [];

    return Response.json({
      ok: epl.ok && champions.ok,

      test: "TheRundown EPL + Champions",

      EPL: {
        sport_id: 11,
        status: epl.status,
        eventi_trovati: eventiEpl.length,
        esempio: eventiEpl.slice(0, 3).map(compattaEvento),
      },

      CHAMPIONS: {
        sport_id: 16,
        status: champions.status,
        eventi_trovati: eventiChampions.length,
        esempio: eventiChampions.slice(0, 3).map(compattaEvento),
      },

      quota: {
        remaining:
          champions.remaining ||
          epl.remaining,

        used:
          champions.used ||
          epl.used,

        limit:
          champions.limit ||
          epl.limit,
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
