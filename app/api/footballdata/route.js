export async function GET(request) {
  const { searchParams } = new URL(request.url);
  const endpoint = searchParams.get("endpoint") || "competitions";
  
  const params = new URLSearchParams(searchParams);
  params.delete("endpoint");
  
  const apiUrl = `https://api.football-data.org/v4/${endpoint}${params.toString() ? "?" + params.toString() : ""}`;
  
  const response = await fetch(apiUrl, {
    headers: {
      "X-Auth-Token": process.env.FOOTBALL_DATA_KEY,
    },
  });
  
  const data = await response.json();
  
  return Response.json(data);
}
