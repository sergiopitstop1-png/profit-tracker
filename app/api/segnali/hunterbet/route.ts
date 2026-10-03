// ════════════════════════════════════════════════════════════════════
// /api/segnali/hunterbet — riceve i segnali Hunterbet dal lettore sul PC
// POST { righe: [...] }  con header  x-pt-segreto: <SEGNALI_SECRET>
// 04/10/2026 (Claude):
//  • UN DATO GIÀ SCRITTO NON SI CANCELLA: se arriva un campo vuoto e sul sito c'è già un valore
//    (esito, risultato, minuto…), si tiene il valore. Un riavvio del PC non azzera più gli esiti.
//  • Un esito già deciso (VINTA/PERSA/NULLA) non torna mai "in corso".
//  • Più veloce: una sola lettura per tutte le righe, inserimenti in blocco, aggiornamenti solo se cambia qualcosa.
// ════════════════════════════════════════════════════════════════════
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
export const runtime = 'nodejs'

const CAMPI = ['msg_id', 'data_msg', 'competizione', 'casa', 'ospite', 'tipo_segnale', 'score_casa_segnale', 'score_ospite_segnale', 'minuto_segnale',
  'fixture_id', 'score_casa_attuale', 'score_ospite_attuale', 'stato_match', 'esito', 'data_esito', 'minuti_al_gol'] as const
const vuoto = (v: any) => v === null || v === undefined || v === ''

export async function POST(req: NextRequest) {
  const segreto = process.env.SEGNALI_SECRET
  if (!segreto || req.headers.get('x-pt-segreto') !== segreto) return NextResponse.json({ error: 'non autorizzato' }, { status: 401 })

  let corpo: any
  try { corpo = await req.json() } catch { return NextResponse.json({ error: 'JSON non valido' }, { status: 400 }) }
  const righe = Array.isArray(corpo?.righe) ? corpo.righe : []
  if (!righe.length) return NextResponse.json({ salvati: 0 })
  if (righe.length > 1000) return NextResponse.json({ error: 'massimo 1000 righe per invio' }, { status: 400 })

  const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL as string, process.env.SUPABASE_SERVICE_ROLE_KEY as string, { auth: { persistSession: false } })

  // righe valide (se lo stesso msg_id arriva due volte, vale l'ultima)
  const arrivate = new Map<number, any>()
  for (const r of righe) { const id = Number(r?.msg_id); if (Number.isFinite(id)) arrivate.set(id, r) }
  const ids = [...arrivate.keys()]

  // una sola lettura di quello che c'è già
  const esistenti = new Map<number, Record<string, any>>()
  for (let i = 0; i < ids.length; i += 500) {
    const { data, error } = await supabase.from('hunterbet_segnali').select('*').in('msg_id', ids.slice(i, i + 500))
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    for (const r of data || []) esistenti.set(Number(r.msg_id), r)
  }

  const nuovi: Record<string, any>[] = []
  let aggiornati = 0, invariati = 0
  for (const [msgId, r] of arrivate) {
    const prima = esistenti.get(msgId)
    const riga: Record<string, any> = { msg_id: msgId }
    for (const k of CAMPI) {
      if (k === 'msg_id') continue
      const nuovo = Object.prototype.hasOwnProperty.call(r, k) && !vuoto(r[k]) ? r[k] : null
      // il valore nuovo vince solo se c'è; altrimenti resta quello già scritto
      riga[k] = nuovo !== null ? nuovo : (prima ? (prima[k] ?? null) : null)
    }
    // un esito deciso non si cambia più (salvo correzione esplicita con un altro esito)
    if (prima && !vuoto(prima.esito) && vuoto(r?.esito)) { riga.esito = prima.esito; riga.data_esito = prima.data_esito ?? riga.data_esito }

    if (!prima) { nuovi.push({ ...riga, aggiornato: new Date().toISOString() }); continue }
    const cambiato = CAMPI.some(k => k !== 'msg_id' && String(prima[k] ?? '') !== String(riga[k] ?? ''))
    if (!cambiato) { invariati++; continue }
    const { msg_id, ...patch } = riga
    const { error } = await supabase.from('hunterbet_segnali').update({ ...patch, aggiornato: new Date().toISOString() }).eq('msg_id', msgId)
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    aggiornati++
  }
  for (let i = 0; i < nuovi.length; i += 500) {
    const { error } = await supabase.from('hunterbet_segnali').insert(nuovi.slice(i, i + 500))
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  }
  return NextResponse.json({ salvati: nuovi.length + aggiornati, nuovi: nuovi.length, aggiornati, invariati })
}
