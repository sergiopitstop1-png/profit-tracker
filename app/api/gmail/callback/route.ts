import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url)
  const code = searchParams.get('code')
  const state = searchParams.get('state')

  if (!code || !state) {
    return NextResponse.json({ error: 'Parametri mancanti' }, { status: 400 })
  }

  const [email, emailId] = state.split('|')

  const tokenRes = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      code,
      client_id: process.env.GMAIL_CLIENT_ID!,
      client_secret: process.env.GMAIL_CLIENT_SECRET!,
      redirect_uri: 'https://sergioapicella.it/api/gmail/callback',
      grant_type: 'authorization_code'
    })
  })

  const tokenData = await tokenRes.json()
  if (tokenData.error) {
    return NextResponse.json({ error: tokenData.error }, { status: 400 })
  }

  await supabase.from('clienti_email').update({
    gmail_access_token: tokenData.access_token,
    gmail_refresh_token: tokenData.refresh_token,
    gmail_token_expiry: new Date(Date.now() + tokenData.expires_in * 1000).toISOString()
  }).eq('id', emailId)

  return NextResponse.redirect('https://sergioapicella.it/profit-tracker?gmail=ok')
}
