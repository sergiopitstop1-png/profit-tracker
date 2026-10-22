/* eslint-disable @typescript-eslint/no-explicit-any */
// 22/10/2026 · Popup "Ok visto" per le mail CRITICHE (inibizione bonus, limitazione, conto sospeso/bloccato, KYC).
// GET  = le mail critiche non ancora segnate «visto» (admin e vip). Parte da 3 giorni prima della prima apertura, poi conta le nuove.
// POST {ids:[…]} = segna come viste. Le viste si salvano nella tabella già esistente promo_segnalate_viste con chiave "mailcrit:ID"
// (stessa tabella del popup delle promo, nessuna modifica al database): così il popup resta finché non premi «Ok visto», su qualsiasi dispositivo.
// 22/10/2026: lo vedono anche i VIP (collaboratori). Il «visto» è PERSONALE: se un collaboratore preme «Ok visto» il popup resta all'admin, e viceversa.
// Admin: chiavi "mailcrit:ID" e "mailcrit_inizio" (come prima). VIP: "mailcrit:UTENTE:ID" e "mailcrit_inizio:UTENTE".
// Non dipende da "letta": aprire la mail in Lucy Mail NON fa sparire il popup.
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { createServerClient } from '@supabase/ssr'

export const dynamic = 'force-dynamic'

const admin = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, {
  auth: { persistSession: false, autoRefreshToken: false },
})

const TAB_VISTE = 'promo_segnalate_viste'
const GIORNO = 86400000
// Categorie che fanno comparire il popup. Per aggiungerne (es. 'SICUREZZA', 'PRELIEVO') basta una parola qui.
const CATEGORIE_CRITICHE = ['LIMITAZIONE', 'SOSPENSIONE', 'KYC']

// chi è: admin o vip (stessi ruoli che entrano nel Profit Tracker e in Lucy Mail). Altrimenti null.
async function utenteAbilitato(req: NextRequest): Promise<{ id: string; role: string } | null> {
  const response = NextResponse.next()
  const supabase = createServerClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!, {
    cookies: {
      get(name) { return req.cookies.get(name)?.value },
      set(name, value, options) { response.cookies.set({ name, value, ...options }) },
      remove(name, options) { response.cookies.set({ name, value: '', ...options }) },
    },
  })
  const { data: { session } } = await supabase.auth.getSession()
  if (!session) return null
  const { data: profile } = await supabase.from('user_profiles').select('role').eq('id', session.user.id).single()
  const role = String(profile?.role || '')
  return role === 'admin' || role === 'vip' ? { id: session.user.id, role } : null
}
// chiavi del «visto» per questo utente
const chiaviUtente = (u: { id: string; role: string }) => u.role === 'admin'
  ? { inizio: 'mailcrit_inizio', prefisso: 'mailcrit:' }
  : { inizio: `mailcrit_inizio:${u.id}`, prefisso: `mailcrit:${u.id}:` }

const taglia = (v: any, n: number) => { const t = String(v ?? '').replace(/\s+/g, ' ').trim(); return t.length > n ? t.slice(0, n - 1) + '…' : t }

export async function GET(req: NextRequest) {
  const utente = await utenteAbilitato(req)
  if (!utente) return NextResponse.json({ error: 'Accesso riservato agli admin e ai VIP' }, { status: 403 })
  const { inizio: CHIAVE_INIZIO, prefisso: PREFISSO } = chiaviUtente(utente)
  try {
    // da quando contano le mail: la prima volta parte da 3 giorni fa (così vedi anche quelle di ieri)
    const { data: riga, error: eI } = await admin.from(TAB_VISTE).select('visto_il').eq('chiave', CHIAVE_INIZIO).maybeSingle()
    if (eI) return NextResponse.json({ nuove: [], errore: `tabella ${TAB_VISTE} non pronta: ${eI.message}` })
    let inizio = riga?.visto_il ? new Date(riga.visto_il).getTime() : NaN
    if (!Number.isFinite(inizio)) {
      inizio = Date.now() - 3 * GIORNO
      await admin.from(TAB_VISTE).upsert({ chiave: CHIAVE_INIZIO, visto_il: new Date(inizio).toISOString() }, { onConflict: 'chiave', ignoreDuplicates: true })
    }

    const { data: viste, error: eV } = await admin.from(TAB_VISTE).select('chiave').like('chiave', `${PREFISSO}%`).limit(5000)
    if (eV) return NextResponse.json({ nuove: [], errore: eV.message })
    // ":" nel resto della chiave = è di un altro utente (le chiavi dell'admin iniziano uguali): non conta
    const giaViste = new Set((viste || []).map(r => String(r.chiave).slice(PREFISSO.length)).filter(k => /^\d+$/.test(k)).map(Number))

    const { data: mail, error } = await admin.from('lucy_mail_archive')
      .select('id,cliente_nome,bookmaker,mittente,oggetto,data_mail,categoria,priorita,motivazione_ai')
      .gte('data_mail', new Date(inizio).toISOString())
      .eq('giudizio', 'DA_VALUTARE').eq('richiede_azione', true)
      .in('categoria', CATEGORIE_CRITICHE)
      .or('archiviata.is.null,archiviata.eq.false')
      .order('data_mail', { ascending: false }).limit(200)
    if (error) return NextResponse.json({ nuove: [], errore: error.message })

    const nuove = (mail || []).filter(m => !giaViste.has(Number(m.id))).map(m => ({
      id: m.id,
      data: m.data_mail,
      cliente: m.cliente_nome || '',
      book: m.bookmaker || '',
      categoria: m.categoria || '',
      priorita: m.priorita || '',
      oggetto: taglia(m.oggetto, 140),
      riassunto: taglia(m.motivazione_ai, 400),
    }))
    return NextResponse.json({ nuove })
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || String(e) }, { status: 500 })
  }
}

// segna come viste (ok visto). Body: { ids: number[] }
export async function POST(req: NextRequest) {
  const utente = await utenteAbilitato(req)
  if (!utente) return NextResponse.json({ error: 'Accesso riservato agli admin e ai VIP' }, { status: 403 })
  const { prefisso: PREFISSO } = chiaviUtente(utente)
  try {
    const body = await req.json().catch(() => ({}))
    const ids: number[] = (Array.isArray(body?.ids) ? body.ids : []).map(Number).filter((n: number) => Number.isFinite(n)).slice(0, 500)
    if (!ids.length) return NextResponse.json({ error: 'nessuna mail indicata' }, { status: 400 })
    const { error } = await admin.from(TAB_VISTE).upsert(ids.map(i => ({ chiave: `${PREFISSO}${i}` })), { onConflict: 'chiave', ignoreDuplicates: true })
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json({ ok: true, segnate: ids.length })
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || String(e) }, { status: 500 })
  }
}
