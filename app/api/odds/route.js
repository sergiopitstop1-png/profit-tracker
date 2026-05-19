export async function GET(request) {
  const { searchParams } = new URL(request.url);
  const sport = searchParams.get("sport") || "soccer";
  const endpoint = searchParams.get("endpoint") || "odds";

  const params = new URLSearchParams(searchParams);
  params.delete("endpoint");
  params.delete("sport");

  const apiUrl = `https://api.the-odds-api.com/v4/sports/${sport}/${endpoint}?apiKey=${process.env.ODDS_API_KEY}&${params.toString()}`;

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
