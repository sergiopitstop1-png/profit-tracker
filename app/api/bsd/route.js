export async function GET(request) {
  const { searchParams } = new URL(request.url);
  const endpoint = searchParams.get("endpoint") || "events";
  
  const params = new URLSearchParams(searchParams);
  params.delete("endpoint");
  
  const apiUrl = `https://sports.bzzoiro.com/api/${endpoint}/${params.toString() ? "?" + params.toString() : ""}`;
  
  const response = await fetch(apiUrl, {
    headers: {
      "Authorization": `Token ${process.env.BSD_API_KEY}`,
    },
  });
  
  const data = await response.json();
  
  return Response.json(data);
}
