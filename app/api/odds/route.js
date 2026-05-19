export async function GET(request) {
  const { searchParams } = new URL(request.url);
  const endpoint = searchParams.get("endpoint") || "sports";

  const params = new URLSearchParams(searchParams);
  params.delete("endpoint");
  params.set("apiKey", process.env.ODDS_API_KEY);

  const apiUrl = `https://api.the-odds-api.com/v4/${endpoint}?${params.toString()}`;

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 15000);

  try {
    const response = await fetch(apiUrl, { signal: controller.signal });
    clearTimeout(timeout);
    const data = await response.json();
    return Response.json(data);
  } catch (e) {
    clearTimeout(timeout);
    return Response.json([], { status: 200 });
  }
}
