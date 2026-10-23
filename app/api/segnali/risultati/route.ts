// ════════════════════════════════════════════════════════════════════
// /api/segnali/risultati — risultati completi delle partite dei segnali (04/10/2026)
// Lo usa il programma risultati_partite.py sul PC (header x-pt-segreto = SEGNALI_SECRET).
//  GET  → elenco dei segnali (ScoreTrend e Hunterbet) che non hanno ancora il risultato finale
//  POST { tabella: 'scoretrend' | 'hunterbet', righe: [{ msg_id, ht_casa, ht_ospite, ft_casa, ft_ospite, gol, af_fixture_id, af_stato }] }
//       Un valore già scritto non viene mai cancellato da uno vuoto.
//       23/10/2026: per Hunterbet, quando il risultato finale c'è e l'esito è ancora "in corso", il server calcola l'esito
//       (stessa regola della pagina Segnali, lib/valutaHunter.ts). Un esito già deciso o corretto a mano non viene mai toccato.
//  POST { azione: 'chiudi_esiti' } → chiude l'esito di tutti i segnali Hunterbet che hanno già il risultato finale ma sono ancora "in corso".
// ════════════════════════════════════════════════════════════════════
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { valutaHunter } from '../../../../lib/valutaHunter'
export const runtime = 'nodejs'

const TABELLE = { scoretrend: 'scoretrend_segnali', hunterbet: 'hunterbet_segnali' } as const
const CAMPI = ['ht_casa', 'ht_ospite', 'ft_casa', 'ft_ospite', 'gol', 'af_fixture_id', 'af_stato'] as const
const db = () => createClient(process.env.NEXT_PUBLIC_SUPABASE_URL as string, process.env.SUPABASE_SERVICE_ROLE_KEY as string, { auth: { persistSession: false } })
const autorizzato = (req: NextRequest) => !!process.env.SEGNALI_SECRET && req.headers.get('x-pt-segreto') === process.env.SEGNALI_SECRET

export async function GET(req: NextRequest) {
  if (!autorizzato(req)) return NextResponse.json({ error: 'non autorizzato' }, { status: 401 })
  const supabase = db()
  const limite = new Date(Date.now() - 3 * 3600 * 1000).toISOString()            // partite iniziate da almeno 3 ore
  const dieciGiorniFa = new Date(Date.now() - 10 * 86400 * 1000).toISOString()   // oltre, API-Football per data non serve più
  const out: any[] = []
  {
    const { data, error } = await supabase.from('scoretrend_segnali')
      .select('msg_id,data_msg,data_partita,casa,ospite,af_fixture_id,risultato_tentativi')
      .is('ft_casa', null).lte('data_msg', limite).gte('data_msg', dieciGiorniFa).or('risultato_tentativi.is.null,risultato_tentativi.lt.6').limit(500)
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    for (const r of data || []) out.push({ tabella: 'scoretrend', ...r })
  }
  {
    const { data, error } = await supabase.from('hunterbet_segnali')
      .select('msg_id,data_msg,casa,ospite,fixture_id,af_fixture_id,risultato_tentativi')
      .is('ft_casa', null).lte('data_msg', limite).gte('data_msg', dieciGiorniFa).or('risultato_tentativi.is.null,risultato_tentativi.lt.6').limit(500)
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    for (const r of data || []) out.push({ tabella: 'hunterbet', ...r })
  }
  return NextResponse.json({ mancanti: out })
}

export async function POST(req: NextRequest) {
  if (!autorizzato(req)) return NextResponse.json({ error: 'non autorizzato' }, { status: 401 })
  let corpo: any
  try { corpo = await req.json() } catch { return NextResponse.json({ error: 'JSON non valido' }, { status: 400 }) }
  if (corpo?.azione === 'chiudi_esiti') return chiudiEsiti()
  const tabella = TABELLE[corpo?.tabella as keyof typeof TABELLE]
  if (!tabella) return NextResponse.json({ error: 'tabella non valida' }, { status: 400 })
  const righe = Array.isArray(corpo?.righe) ? corpo.righe.slice(0, 1000) : []
  const supabase = db()
  let aggiornati = 0
  for (const r of righe) {
    const id = Number(r?.msg_id)
    if (!Number.isFinite(id)) continue
    const { data: prima, error: e1 } = await supabase.from(tabella).select('*').eq('msg_id', id).maybeSingle()
    if (e1) return NextResponse.json({ error: e1.message }, { status: 500 })
    if (!prima) continue
    const patch: Record<string, any> = {}
    for (const k of CAMPI) {
      const v = r[k]
      if (v !== null && v !== undefined && v !== '' && JSON.stringify(v) !== JSON.stringify(prima[k])) patch[k] = v
    }
    if (tabella === 'hunterbet_segnali') Object.assign(patch, esitoDaChiudere(prima, patch.ft_casa ?? prima.ft_casa, patch.ft_ospite ?? prima.ft_ospite))
    if (r?.non_trovata) patch.risultato_tentativi = r?.definitiva ? 99 : Number(prima.risultato_tentativi || 0) + 1   // dopo 6 tentativi (o se irrecuperabile) si smette di cercarla
    if (!Object.keys(patch).length) continue
    const { error } = await supabase.from(tabella).update(patch).eq('msg_id', id)
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    aggiornati++
  }
  return NextResponse.json({ aggiornati })
}

// Campi da scrivere per chiudere l'esito di un segnale Hunterbet (vuoto = niente da fare)
function esitoDaChiudere(riga: any, ftCasa: any, ftOspite: any): Record<string, any> {
  if (riga?.esito_manuale === true) return {}                                    // corretto a mano: non si tocca
  if (riga?.esito !== null && riga?.esito !== undefined && riga?.esito !== '') return {}   // esito già deciso: non si cambia
  if (ftCasa === null || ftCasa === undefined || ftOspite === null || ftOspite === undefined) return {}
  const fc = Number(ftCasa), fo = Number(ftOspite)
  if (!Number.isInteger(fc) || !Number.isInteger(fo)) return {}
  const esito = valutaHunter(riga, fc, fo)
  if (!esito) return {}                                                          // mercato non riconosciuto: lo scegli tu a mano
  const ora = new Date().toISOString()
  return { esito, data_esito: riga.data_esito ?? ora, stato_match: 'FINITA', score_casa_attuale: fc, score_ospite_attuale: fo, aggiornato: ora }
}

async function chiudiEsiti() {
  const supabase = db()
  const { data, error } = await supabase.from('hunterbet_segnali')
    .select('msg_id,tipo_segnale,score_casa_segnale,score_ospite_segnale,ft_casa,ft_ospite,esito,esito_manuale,data_esito')
    .not('ft_casa', 'is', null).not('ft_ospite', 'is', null).is('esito', null).limit(1000)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  let chiusi = 0
  for (const r of data || []) {
    const patch = esitoDaChiudere(r, r.ft_casa, r.ft_ospite)
    if (!Object.keys(patch).length) continue
    const { error: e2 } = await supabase.from('hunterbet_segnali').update(patch).eq('msg_id', r.msg_id).is('esito', null)
    if (e2) return NextResponse.json({ error: e2.message, chiusi }, { status: 500 })
    chiusi++
  }
  return NextResponse.json({ chiusi })
}
