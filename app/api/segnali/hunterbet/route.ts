import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
export const runtime = 'nodejs'

const CAMPI = ['msg_id','data_msg','competizione','casa','ospite','tipo_segnale','score_casa_segnale','score_ospite_segnale','minuto_segnale','fixture_id','score_casa_attuale','score_ospite_attuale','stato_match','esito','data_esito','minuti_al_gol'] as const

export async function POST(req: NextRequest) {
  const segreto=process.env.SEGNALI_SECRET
  if(!segreto || req.headers.get('x-pt-segreto')!==segreto) return NextResponse.json({error:'non autorizzato'},{status:401})

  let corpo:any
  try { corpo=await req.json() } catch { return NextResponse.json({error:'JSON non valido'},{status:400}) }

  const righe=Array.isArray(corpo?.righe)?corpo.righe:[]
  if(!righe.length) return NextResponse.json({salvati:0})
  if(righe.length>1000) return NextResponse.json({error:'massimo 1000 righe per invio'},{status:400})

  const supabase=createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL as string,
    process.env.SUPABASE_SERVICE_ROLE_KEY as string,
    {auth:{persistSession:false}}
  )

  let salvati=0
  for (const r of righe) {
    const msgId=Number(r?.msg_id)
    if(!Number.isFinite(msgId)) continue

    const patch:Record<string,any>={aggiornato:new Date().toISOString()}
    for(const k of CAMPI) {
      if(k==='msg_id') continue
      if(Object.prototype.hasOwnProperty.call(r,k)) patch[k]=r[k]===''?null:r[k]
    }

    const {data:esistente,error:readError}=await supabase
      .from('hunterbet_segnali')
      .select('msg_id')
      .eq('msg_id',msgId)
      .maybeSingle()

    if(readError) return NextResponse.json({error:readError.message},{status:500})

    if(esistente) {
      const {error}=await supabase.from('hunterbet_segnali').update(patch).eq('msg_id',msgId)
      if(error) return NextResponse.json({error:error.message},{status:500})
    } else {
      const nuovo:Record<string,any>={msg_id:msgId,...patch}
      const {error}=await supabase.from('hunterbet_segnali').insert(nuovo)
      if(error) return NextResponse.json({error:error.message},{status:500})
    }
    salvati++
  }

  return NextResponse.json({salvati})
}
