export async function GET(request) {
  const { searchParams } = new URL(request.url);
  const endpoint = searchParams.get("endpoint") || "competitions";
  
  const params = new URLSearchParams(searchParams);
  params.delete("endpoint");
  
  const apiUrl = `https://api.football-data.org/v4/${endpoint}${params.toString() ? "?" + params.toString() : ""}`;
  
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 15000);
  
  try {
    const response = await fetch(apiUrl, {
      headers: { "X-Auth-Token": process.env.FOOTBALL_DATA_KEY },
      signal: controller.signal,
    });
    clearTimeout(timeout);
    const data = await response.json();
    return Response.json(data);
  } catch (e) {
    clearTimeout(timeout);
    return Response.json({ matches: [], error: "timeout" }, { status: 200 });
  }
}
