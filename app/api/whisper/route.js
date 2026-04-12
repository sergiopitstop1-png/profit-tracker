export async function POST(req) {
  const formData = await req.formData()
  
  const response = await fetch('https://api.openai.com/v1/audio/transcriptions', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${process.env.OPENAI_API_KEY}`
    },
    body: formData
  })
  
  const data = await response.json()
  return Response.json(data)
}
