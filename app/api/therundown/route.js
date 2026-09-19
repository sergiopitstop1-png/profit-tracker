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
    headers: {
      datapoints: res.headers.get("x-datapoints"),
      remaining: res.headers.get("x-datapoints-remaining"),
      limit: res.headers.get("x-datapoints-limit"),
    },
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

    // Endpoint di riferimento:
    // non dovrebbero consumare data point.
    const [sports, affiliates, markets] = await Promise.all([
      callTR("/api/v2/sports", apiKey),
      callTR("/api/v2/affiliates", apiKey),
      callTR("/api/v2/markets", apiKey),
    ]);

    return Response.json({
      ok: true,

      sports: {
        status: sports.status,
        data: sports.data,
      },

      affiliates: {
        status: affiliates.status,
        data: affiliates.data,
      },

      markets: {
        status: markets.status,
        data: markets.data,
      },

      quota: {
        sports: sports.headers,
        affiliates: affiliates.headers,
        markets: markets.headers,
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
