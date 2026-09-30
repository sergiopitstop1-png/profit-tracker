import crypto from 'crypto'
import { NextResponse } from 'next/server'

const REDIRECT_URI = 'https://sergioapicella.it/api/gmail/callback'
const LUCY_EMAIL = 'lucyserver52@gmail.com'

const SCOPES = [
  'https://www.googleapis.com/auth/gmail.readonly',
]

export async function GET() {
  const clientId = process.env.GMAIL_CLIENT_ID
  const clientSecret = process.env.GMAIL_CLIENT_SECRET

  if (!clientId || !clientSecret) {
    return NextResponse.json(
      { error: 'Credenziali Gmail mancanti su Vercel' },
      { status: 500 }
    )
  }

  const nonce = crypto.randomBytes(24).toString('hex')

  const signature = crypto
    .createHmac('sha256', clientSecret)
    .update(nonce)
    .digest('hex')

  const state = `lucy.${nonce}.${signature}`

  const params = new URLSearchParams({
    client_id: clientId,
    redirect_uri: REDIRECT_URI,
    response_type: 'code',
    scope: SCOPES.join(' '),
    access_type: 'offline',
    prompt: 'consent',
    login_hint: LUCY_EMAIL,
    state,
  })

  const response = NextResponse.redirect(
    `https://accounts.google.com/o/oauth2/v2/auth?${params.toString()}`
  )

  response.cookies.set('lucy_oauth_nonce', nonce, {
    httpOnly: true,
    secure: true,
    sameSite: 'lax',
    path: '/',
    maxAge: 600,
  })

  return response
}
