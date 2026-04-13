export async function POST(req) {
  const body = await req.json()
  
  const response = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': process.env.ANTHROPIC_API_KEY,
      'anthropic-version': '2023-06-01'
    },
    body: JSON.stringify({
  ...body,
  system: (body.system || '') + '\n\nRISPONDI SOLO CON JSON VALIDO. NESSUN TESTO AGGIUNTIVO. NESSUNA SPIEGAZIONE.'
})
  
  const data = await response.json()
  return Response.json(data)
}
