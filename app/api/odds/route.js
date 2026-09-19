export async function GET(request) {
  const { searchParams } = new URL(request.url);
  const endpoint = searchParams.get("endpoint") || "sports";

  const params = new URLSearchParams(searchParams);
  params.delete("endpoint");
  params.set("apiKey", process.env.ODDS_API_KEY);

  if (!process.env.ODDS_API_KEY) {
    return Response.json(
      { error: "ODDS_API_KEY mancante su Vercel" },
      { status: 500 }
    );
  }

  const apiUrl =
    `https://api.the-odds-api.com/v4/${endpoint}?${params.toString()}`;

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 15000);

  try {
    const response = await fetch(apiUrl, {
      signal: controller.signal,
      cache: "no-store",
    });

    clearTimeout(timeout);

    const data = await response.json().catch(() => null);

    if (!response.ok) {
      return Response.json(
        {
          error:
            data?.message ||
            data?.error ||
            `The Odds API HTTP ${response.status}`,
          code: data?.error_code || null,
          upstreamStatus: response.status,
          endpoint,
        },
        { status: response.status }
      );
    }

    return Response.json(data ?? []);
  } catch (e) {
    clearTimeout(timeout);

    return Response.json(
      {
        error:
          e?.name === "AbortError"
            ? "Timeout The Odds API (15s)"
            : e?.message || "Errore The Odds API",
        endpoint,
      },
      { status: 502 }
    );
  }
}
