// 28/11/2026 · Excel dell'anno. Solo admin.
// GET ?anno=2026 -> se il 31/12 è chiuso: l'archivio congelato; altrimenti un'ANTEPRIMA con i dati di adesso (non salva niente).
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { createServerClient } from '@supabase/ssr'
import { creaExcelArchivio } from '@/lib/archivioExcel'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
export const maxDuration = 60

async function èAdmin(req: NextRequest) {
  const supabase = createServerClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!, {
    cookies: { get(name) { return req.cookies.get(name)?.value }, set() {}, remove() {} },
  })
  // getUser verifica il token con Supabase, non si fida del solo cookie
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return false
  const { data: profile } = await supabase.from('user_profiles').select('role').eq('id', user.id).single()
  return profile?.role === 'admin'
}

export async function GET(req: NextRequest) {
  if (!(await èAdmin(req))) return NextResponse.json({ error: 'Accesso riservato agli admin' }, { status: 403 })
  const anno = Number(req.nextUrl.searchParams.get('anno'))
  const annoOggi = Number(new Date().toLocaleDateString('sv-SE', { timeZone: 'Europe/Rome' }).slice(0, 4))
  if (!Number.isInteger(anno) || anno < 2026 || anno > annoOggi) return NextResponse.json({ error: 'anno non valido' }, { status: 400 })

  const sb = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, { auth: { persistSession: false, autoRefreshToken: false } })
  const { data: congelata, error } = await sb.from('chiusure_periodo').select('*').eq('periodo', `${anno}-12`).maybeSingle()
  if (error) return NextResponse.json({ error: `${error.message}. Esegui supabase/chiusure_periodo.sql` }, { status: 500 })

  let chiusura = congelata
  const anteprima = !congelata
  if (anteprima) {
    if (anno < annoOggi) return NextResponse.json({ error: `Il ${anno} non ha la chiusura del 31/12` }, { status: 404 })
    const r = await sb.rpc('chiudi_periodo', { p_periodo: `${anno}-12`, p_salva: false })
    if (r.error) return NextResponse.json({ error: r.error.message }, { status: 500 })
    chiusura = r.data
  }

  try {
    const { buffer } = await creaExcelArchivio(chiusura, anno, { anteprima })
    const nome = anteprima ? `ANTEPRIMA_${anno}.xlsx` : `archivio_${anno}.xlsx`
    return new NextResponse(new Uint8Array(buffer as ArrayBuffer), {
      headers: {
        'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        'Content-Disposition': `attachment; filename="${nome}"`,
        'Cache-Control': 'no-store',
      },
    })
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : String(e) }, { status: 500 })
  }
}
