export async function GET(request) {
  const { searchParams } = new URL(request.url);
  const endpoint = searchParams.get("endpoint") || "status";
  
  const params = new URLSearchParams(searchParams);
  params.delete("endpoint");
  
  const apiUrl = `https://v3.football.api-sports.io/${endpoint}${params.toString() ? "?" + params.toString() : ""}`;
  
  const response = await fetch(apiUrl, {
    headers: {
      "x-apisports-key": process.env.FOOTBALL_API_KEY,
    },
  });
  
  const data = await response.json();
  
  return Response.json(data);
}
