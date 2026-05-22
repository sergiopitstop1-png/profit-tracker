import { NextResponse } from 'next/server'

const SCOPES = [
  'https://www.googleapis.com/auth/gmail.readonly'
]

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url)
  const email = searchParams.get('email')
  
  if (!email) {
    return NextResponse.json({ error: 'Email mancante' }, { status: 400 })
  }

  const params = new URLSearchParams({
    client_id: process.env.GMAIL_CLIENT_ID!,
    redirect_uri: 'https://sergioapicella.it/api/gmail/callback',
    response_type: 'code',
    scope: SCOPES.join(' '),
    access_type: 'offline',
    prompt: 'consent',
    login_hint: email,
    state: email
  })

  const authUrl = `https://accounts.google.com/o/oauth2/auth?${params.toString()}`
  
  return NextResponse.redirect(authUrl)
}
