/* eslint-disable @typescript-eslint/no-explicit-any */
// 23/10/2026 · Telefonata di avviso (Twilio) quando c'è una bet Hunterbet Pre-live da piazzare e non è stata confermata.
// POST { partita, inizio } → chiama il TUO numero (variabile MIO_NUMERO) dal numero Twilio e legge il testo.
// GET → dice solo se Twilio è configurato (la pagina mostra «telefonata non attiva» se mancano le chiavi).
// Solo admin e VIP. Senza le variabili su Vercel non fa nulla. Tetto: 10 chiamate al giorno, almeno 4 minuti tra una e l'altra (controllati su Twilio stesso).
import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@supabase/ssr'
import { puoChiamare, testoChiamata, twiml } from '../../../../lib/avvisoChiamata'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

async function abilitato(req: NextRequest) {
  const response = NextResponse.next()
  const supabase = createServerClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!, {
    cookies: {
      get(name) { return req.cookies.get(name)?.value },
      set(name, value, options) { response.cookies.set({ name, value, ...options }) },
      remove(name, options) { response.cookies.set({ name, value: '', ...options }) },
    },
  })
  const { data: { session } } = await supabase.auth.getSession()
  if (!session) return false
  const { data: profile } = await supabase.from('user_profiles').select('role').eq('id', session.user.id).single()
  return profile?.role === 'admin' || profile?.role === 'vip'
}

function config() {
  const sid = process.env.TWILIO_ACCOUNT_SID, token = process.env.TWILIO_AUTH_TOKEN, da = process.env.TWILIO_NUMERO, a = process.env.MIO_NUMERO
  return sid && token && da && a ? { sid, token, da, a } : null
}

export async function GET(req: NextRequest) {
  if (!(await abilitato(req))) return NextResponse.json({ error: 'Accesso riservato agli admin e ai VIP' }, { status: 403 })
  return NextResponse.json({ configurato: !!config() })
}

export async function POST(req: NextRequest) {
  if (!(await abilitato(req))) return NextResponse.json({ error: 'Accesso riservato agli admin e ai VIP' }, { status: 403 })
  const c = config()
  if (!c) return NextResponse.json({ error: 'telefonata non configurata', configurato: false }, { status: 503 })
  try {
    const body = await req.json().catch(() => ({}))
    const partita = String(body?.partita || '').slice(0, 200)
    const inizio = body?.inizio ? String(body.inizio) : null
    if (!partita) return NextResponse.json({ error: 'partita non indicata' }, { status: 400 })
    const auth = 'Basic ' + Buffer.from(`${c.sid}:${c.token}`).toString('base64')
    const base = `https://api.twilio.com/2010-04-01/Accounts/${c.sid}/Calls.json`

    // chiamate già fatte verso il tuo numero oggi (da Twilio stesso: niente tabelle da creare)
    const ieri = new Date(Date.now() - 36 * 3600000).toISOString().slice(0, 10)
    const q = new URLSearchParams({ To: c.a, From: c.da, PageSize: '50' }); q.set('StartTime>', ieri)
    const lista = await fetch(`${base}?${q}`, { headers: { Authorization: auth } })
    if (!lista.ok) return NextResponse.json({ error: 'Twilio non risponde (' + lista.status + ')' }, { status: 502 })
    const dati: any = await lista.json()
    const via = puoChiamare((dati?.calls || []).map((x: any) => x.date_created))
    if (!via.ok) return NextResponse.json({ error: via.motivo, saltata: true }, { status: 429 })

    const form = new URLSearchParams({ To: c.a, From: c.da, Twiml: twiml(testoChiamata(partita, inizio)) })
    const r = await fetch(base, { method: 'POST', headers: { Authorization: auth, 'Content-Type': 'application/x-www-form-urlencoded' }, body: form })
    const j: any = await r.json().catch(() => ({}))
    if (!r.ok) return NextResponse.json({ error: 'Twilio: ' + (j?.message || r.status) }, { status: 502 })
    return NextResponse.json({ ok: true, sid: j?.sid })
  } catch (e: any) {
    return NextResponse.json({ error: String(e?.message || e) }, { status: 500 })
  }
}
