/* eslint-disable @typescript-eslint/no-explicit-any */
// 22/10/2026 · Salvataggio di risultato / quota / esito di un segnale Hunterbet (tasto «Salva» della scheda Segnali).
// Prima il browser scriveva direttamente sulla tabella: se il database non permetteva la modifica rispondeva «ok» senza salvare niente
// (la pagina diceva «✓ salvato» ma al ricaricamento tornava tutto com'era, e le analisi restavano «in corso»).
// Ora scrive il server (solo admin e vip) e rilegge la riga dal database: se non è stata salvata davvero, lo dice.
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { createServerClient } from '@supabase/ssr'

export const dynamic = 'force-dynamic'

const admin = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, {
  auth: { persistSession: false, autoRefreshToken: false },
})

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

// solo questi campi si possono scrivere da qui
const CAMPI = ['ft_casa', 'ft_ospite', 'ht_casa', 'ht_ospite', 'quota', 'esito', 'esito_manuale', 'stato_match', 'data_esito', 'score_casa_attuale', 'score_ospite_attuale', 'giocata'] as const
const ESITI = new Set(['VINTA', 'PERSA', 'NULLA'])

export async function POST(req: NextRequest) {
  if (!(await abilitato(req))) return NextResponse.json({ error: 'Accesso riservato agli admin e ai VIP' }, { status: 403 })
  try {
    const body = await req.json().catch(() => ({}))
    const id = Number(body?.msg_id)
    if (!Number.isFinite(id)) return NextResponse.json({ error: 'segnale non indicato' }, { status: 400 })
    const arrivato = body?.patch && typeof body.patch === 'object' ? body.patch : {}
    const patch: Record<string, any> = {}
    for (const k of CAMPI) if (Object.prototype.hasOwnProperty.call(arrivato, k)) patch[k] = arrivato[k]
    if (patch.quota !== undefined && patch.quota !== null && !(Number(patch.quota) > 1 && Number(patch.quota) < 100)) return NextResponse.json({ error: 'quota non valida' }, { status: 400 })   // 23/10/2026
    if (patch.giocata !== undefined && patch.giocata !== null && typeof patch.giocata !== 'boolean') return NextResponse.json({ error: 'giocata non valida' }, { status: 400 })
    if (patch.esito !== undefined && patch.esito !== null && !ESITI.has(String(patch.esito))) return NextResponse.json({ error: 'esito non valido' }, { status: 400 })
    if (!Object.keys(patch).length) return NextResponse.json({ error: 'niente da salvare' }, { status: 400 })
    patch.aggiornato = new Date().toISOString()

    const { data, error } = await admin.from('hunterbet_segnali').update(patch).eq('msg_id', id).select('*')
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    if (!data || data.length === 0) return NextResponse.json({ error: 'segnale non trovato nel database' }, { status: 404 })
    return NextResponse.json({ ok: true, riga: data[0] })
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || String(e) }, { status: 500 })
  }
}
