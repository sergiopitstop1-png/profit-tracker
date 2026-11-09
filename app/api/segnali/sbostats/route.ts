// ════════════════════════════════════════════════════════════════════
// /api/segnali/sbostats — riceve i pronostici SBOStats (Match Analysis) dal lettore sul PC (09/11/2026)
// POST { righe: [...] }  con header  x-pt-segreto: <SEGNALI_SECRET>
// Ogni riga: { data, partita, campionato, pronostico, frequenza, quota_teorica, risultato, esito }
//  • le righe IN ATTESA si inseriscono solo se nuove: non toccano mai una riga già presente (un esito deciso non torna "in attesa");
//  • le righe con esito (VINCENTE/PERDENTE/…) inseriscono o aggiornano.
// ════════════════════════════════════════════════════════════════════
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
export const runtime = 'nodejs'

const ESITI: Record<string, string | null> = {
  'VINCENTE': 'VINTA', 'PERDENTE': 'PERSA', 'IN ATTESA': null,
  'ANNULLATO': 'NULLA', 'RIMBORSATO': 'NULLA',
}

const numero = (v: any): number | null => {
  const n = Number(String(v ?? '').replace('%', '').replace(',', '.').trim())
  return Number.isFinite(n) && String(v ?? '').trim() !== '' ? n : null
}

// «09/11/2026 21:15» (ora italiana) → ISO UTC
function romaIso(testo: string): string | null {
  const m = /^(\d{1,2})\/(\d{1,2})\/(\d{4})\s+(\d{1,2}):(\d{2})/.exec(String(testo || '').trim())
  if (!m) return null
  const [g, mo, a, h, mi] = [m[1], m[2], m[3], m[4], m[5]].map(Number)
  const locale = Date.UTC(a, mo - 1, g, h, mi)
  const fmt = new Intl.DateTimeFormat('en-US', { timeZone: 'Europe/Rome', hourCycle: 'h23', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' })
  const scarto = (t: number) => {
    const p = fmt.formatToParts(new Date(t))
    const v = (k: string) => Number(p.find(x => x.type === k)?.value)
    return Date.UTC(v('year'), v('month') - 1, v('day'), v('hour'), v('minute')) - t
  }
  const t = locale - scarto(locale - scarto(locale))
  const d = new Date(t)
  return Number.isFinite(d.getTime()) ? d.toISOString() : null
}

export async function POST(req: NextRequest) {
  const segreto = process.env.SEGNALI_SECRET
  if (!segreto || req.headers.get('x-pt-segreto') !== segreto) return NextResponse.json({ error: 'non autorizzato' }, { status: 401 })

  let corpo: any
  try { corpo = await req.json() } catch { return NextResponse.json({ error: 'JSON non valido' }, { status: 400 }) }
  const righe = Array.isArray(corpo?.righe) ? corpo.righe : []
  if (!righe.length) return NextResponse.json({ salvati: 0 })
  if (righe.length > 1000) return NextResponse.json({ error: 'massimo 1000 righe per invio' }, { status: 400 })

  const ora = new Date().toISOString()
  const perChiave = new Map<string, Record<string, any>>()
  let scartate = 0
  for (const r of righe) {
    const data = String(r?.data ?? '').trim()
    const partita = String(r?.partita ?? '').trim()
    const pronostico = String(r?.pronostico ?? '').trim()
    const frequenza = numero(r?.frequenza)
    if (!data || !partita || !pronostico || frequenza === null) { scartate++; continue }
    const statoTesto = String(r?.esito ?? '').trim().toUpperCase()
    const esito = Object.prototype.hasOwnProperty.call(ESITI, statoTesto) ? ESITI[statoTesto] : null
    const [casa, ...resto] = partita.split(' - ')
    perChiave.set(`${data}|${partita}|${pronostico}`, {
      chiave: `${data}|${partita}|${pronostico}`,
      data_partita: romaIso(data), data_testo: data,
      partita, casa: casa.trim() || null, ospite: resto.join(' - ').trim() || null,
      campionato: String(r?.campionato ?? '').trim() || null,
      pronostico, frequenza,
      quota_teorica: numero(r?.quota_teorica),
      risultato: String(r?.risultato ?? '').trim() || null,
      esito, aggiornato: ora,
    })
  }

  const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL as string, process.env.SUPABASE_SERVICE_ROLE_KEY as string, { auth: { persistSession: false } })
  const tutte = [...perChiave.values()]
  const decise = tutte.filter(r => r.esito !== null)
  const inAttesa = tutte.filter(r => r.esito === null)

  let nuove = 0
  for (let i = 0; i < inAttesa.length; i += 500) {
    // solo le righe che non ci sono già: una riga già presente (magari con esito) non si tocca
    const { data, error } = await supabase.from('sbostats_segnali').upsert(inAttesa.slice(i, i + 500), { onConflict: 'chiave', ignoreDuplicates: true }).select('chiave')
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    nuove += data?.length ?? 0
  }
  for (let i = 0; i < decise.length; i += 500) {
    const { error } = await supabase.from('sbostats_segnali').upsert(decise.slice(i, i + 500), { onConflict: 'chiave' })
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  }
  return NextResponse.json({ ricevute: righe.length, scartate, in_attesa_nuove: nuove, con_esito: decise.length })
}
