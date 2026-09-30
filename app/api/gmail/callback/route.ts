import crypto from 'crypto'
import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

const REDIRECT_URI = 'https://sergioapicella.it/api/gmail/callback'
const LUCY_EMAIL = 'lucyserver52@gmail.com'

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url)

  const code = searchParams.get('code')
  const state = searchParams.get('state')

  if (!code || !state) {
    return NextResponse.json(
      { error: 'Parametri mancanti' },
      { status: 400 }
    )
  }

  const clientId = process.env.GMAIL_CLIENT_ID
  const clientSecret = process.env.GMAIL_CLIENT_SECRET

  if (!clientId || !clientSecret) {
    return NextResponse.json(
      { error: 'Credenziali Gmail mancanti' },
      { status: 500 }
    )
  }

  /*
   * ---------------------------------------------------------
   * VERIFICA STATE PER IL NUOVO FLUSSO LUCY
   * ---------------------------------------------------------
   */

  const isLucy = state.startsWith('lucy.')

  if (isLucy) {
    const [, nonce, signature] = state.split('.')

    if (!nonce || !signature) {
      return NextResponse.json(
        { error: 'State Lucy non valido' },
        { status: 400 }
      )
    }

    const cookieHeader = request.headers.get('cookie') || ''

    const cookieMatch = cookieHeader.match(
      /(?:^|;\s*)lucy_oauth_nonce=([^;]+)/
    )

    const cookieNonce = cookieMatch?.[1]

    if (!cookieNonce || cookieNonce !== nonce) {
      return NextResponse.json(
        { error: 'Verifica OAuth Lucy fallita' },
        { status: 400 }
      )
    }

    const expectedSignature = crypto
      .createHmac('sha256', clientSecret)
      .update(nonce)
      .digest('hex')

    if (
      signature.length !== expectedSignature.length ||
      !crypto.timingSafeEqual(
        Buffer.from(signature),
        Buffer.from(expectedSignature)
      )
    ) {
      return NextResponse.json(
        { error: 'Firma OAuth Lucy non valida' },
        { status: 400 }
      )
    }
  }

  /*
   * ---------------------------------------------------------
   * SCAMBIO CODE -> TOKEN GOOGLE
   * ---------------------------------------------------------
   */

  const tokenRes = await fetch(
    'https://oauth2.googleapis.com/token',
    {
      method: 'POST',
      headers: {
        'Content-Type':
          'application/x-www-form-urlencoded',
      },
      body: new URLSearchParams({
        code,
        client_id: clientId,
        client_secret: clientSecret,
        redirect_uri: REDIRECT_URI,
        grant_type: 'authorization_code',
      }),
    }
  )

  const tokenData = await tokenRes.json()

  if (
    tokenData.error ||
    !tokenData.access_token
  ) {
    return NextResponse.json(
      {
        error:
          tokenData.error ||
          'Google non ha restituito access token',
      },
      { status: 400 }
    )
  }

  /*
   * ---------------------------------------------------------
   * NUOVO FLUSSO LUCY_SERVER
   * ---------------------------------------------------------
   */

  if (isLucy) {
    /*
     * Controlliamo quale account Google è stato
     * effettivamente autorizzato.
     */

    const profileRes = await fetch(
      'https://gmail.googleapis.com/gmail/v1/users/me/profile',
      {
        headers: {
          Authorization: `Bearer ${tokenData.access_token}`,
        },
      }
    )

    const profile = await profileRes.json()

    if (
      !profile.emailAddress ||
      profile.emailAddress.toLowerCase() !==
        LUCY_EMAIL.toLowerCase()
    ) {
      return NextResponse.json(
        {
          error:
            'Devi autorizzare l’account Lucy_Server',
        },
        { status: 403 }
      )
    }

    /*
     * Se Google non restituisce un nuovo refresh token,
     * conserviamo quello già presente.
     */

    const { data: existing } = await supabase
      .from('lucy_gmail_connection')
      .select('refresh_token')
      .eq('id', 1)
      .maybeSingle()

    const refreshToken =
      tokenData.refresh_token ||
      existing?.refresh_token

    if (!refreshToken) {
      return NextResponse.json(
        {
          error:
            'Google non ha restituito il refresh token. Ripetere autorizzazione.',
        },
        { status: 400 }
      )
    }

    const { error } = await supabase
      .from('lucy_gmail_connection')
      .upsert({
        id: 1,
        email: LUCY_EMAIL,

        access_token:
          tokenData.access_token,

        refresh_token:
          refreshToken,

        token_expiry:
          new Date(
            Date.now() +
              tokenData.expires_in * 1000
          ).toISOString(),

        connected_at:
          new Date().toISOString(),

        updated_at:
          new Date().toISOString(),
      })

    if (error) {
      console.error(
        'Errore salvataggio Lucy:',
        error
      )

      return NextResponse.json(
        {
          error:
            'Errore salvataggio connessione Lucy',
        },
        { status: 500 }
      )
    }

    const response = NextResponse.redirect(
      'https://sergioapicella.it/profit-tracker/archivio-lucy?gmail=ok'
    )

    response.cookies.set(
      'lucy_oauth_nonce',
      '',
      {
        path: '/',
        maxAge: 0,
      }
    )

    return response
  }

  /*
   * ---------------------------------------------------------
   * VECCHIO SISTEMA GMAIL
   * ---------------------------------------------------------
   *
   * Lo lasciamo funzionante per non rompere
   * gli account già collegati.
   */

  const [email, emailId] =
    state.split('|')

  if (!email || !emailId) {
    return NextResponse.json(
      { error: 'State Gmail non valido' },
      { status: 400 }
    )
  }

  /*
   * Conserviamo l'eventuale refresh token esistente
   * se Google questa volta non ne restituisce uno.
   */

  const { data: existingEmail } =
    await supabase
      .from('clienti_email')
      .select('gmail_refresh_token')
      .eq('id', emailId)
      .maybeSingle()

  await supabase
    .from('clienti_email')
    .update({
      gmail_access_token:
        tokenData.access_token,

      gmail_refresh_token:
        tokenData.refresh_token ||
        existingEmail?.gmail_refresh_token,

      gmail_token_expiry:
        new Date(
          Date.now() +
            tokenData.expires_in * 1000
        ).toISOString(),
    })
    .eq('id', emailId)

  return NextResponse.redirect(
    'https://sergioapicella.it/profit-tracker?gmail=ok'
  )
}
