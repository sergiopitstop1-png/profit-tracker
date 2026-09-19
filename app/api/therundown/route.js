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

    // Test ufficiale TheRundown:
    // sport_id 4 + mercati 1,2,3 + 3 bookmaker
    const date = new Date().toISOString().slice(0, 10);

    const url =
      `https://therundown.io/api/v2/sports/4/events/${date}` +
      `?market_ids=1,2,3` +
      `&affiliate_ids=3,19,23` +
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

    return Response.json(
      {
        ok: res.ok,
        status: res.status,

        quota: {
          used:
            res.headers.get("x-datapoints-used") ||
            res.headers.get("x-datapoints"),
          remaining: res.headers.get("x-datapoints-remaining"),
          limit: res.headers.get("x-datapoints-limit"),
          period: res.headers.get("x-datapoints-period"),
        },

        data,
      },
      { status: res.ok ? 200 : res.status }
    );
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
