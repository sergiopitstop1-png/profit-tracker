// ════════════════════════════════════════════════════════════════════
// /api/accademia/ingest — riceve i messaggi dei gruppi Telegram dell'Accademia dal lettore sul PC
// POST { messaggi: [...] }  con header  x-pt-segreto: <SEGNALI_SECRET>   (stessa chiave di Hunterbet)
// 09/10/2026: un messaggio è identificato da (chat_id, msg_id): se arriva di nuovo (modifica o
// ripartenza del lettore) si aggiorna, mai doppioni.
// ════════════════════════════════════════════════════════════════════
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
export const runtime = 'nodejs'

const MAX_PER_INVIO = 500
const vuoto = (v: any) => v === null || v === undefined || v === ''
const pulisci = (v: any, max: number) => (vuoto(v) ? null : String(v).replace(/\u0000/g, '').slice(0, max))

export async function POST(req: NextRequest) {
  const segreto = process.env.SEGNALI_SECRET
  if (!segreto || req.headers.get('x-pt-segreto') !== segreto) return NextResponse.json({ error: 'non autorizzato' }, { status: 401 })

  let corpo: any
  try { corpo = await req.json() } catch { return NextResponse.json({ error: 'JSON non valido' }, { status: 400 }) }
  const arrivati = Array.isArray(corpo?.messaggi) ? corpo.messaggi : []
  if (!arrivati.length) return NextResponse.json({ ricevuti: 0, salvati: 0, scartati: 0 })
  if (arrivati.length > MAX_PER_INVIO) return NextResponse.json({ error: `massimo ${MAX_PER_INVIO} messaggi per invio` }, { status: 400 })

  // se lo stesso (chat_id, msg_id) arriva due volte nello stesso invio, vale l'ultimo
  const righe = new Map<string, Record<string, any>>()
  let scartati = 0
  for (const m of arrivati) {
    const chat_id = Number(m?.chat_id)
    const msg_id = Number(m?.msg_id)
    const data = m?.data_msg ? new Date(m.data_msg) : null
    if (!Number.isFinite(chat_id) || !Number.isFinite(msg_id) || !data || Number.isNaN(data.getTime())) { scartati++; continue }
    const modificato = m?.modificato_il ? new Date(m.modificato_il) : null
    righe.set(`${chat_id}:${msg_id}`, {
      chat_id,
      msg_id,
      chat_titolo: pulisci(m.chat_titolo, 200),
      topic_id: Number.isFinite(Number(m?.topic_id)) && !vuoto(m?.topic_id) ? Number(m.topic_id) : null,
      topic_titolo: pulisci(m.topic_titolo, 200),
      data_msg: data.toISOString(),
      modificato_il: modificato && !Number.isNaN(modificato.getTime()) ? modificato.toISOString() : null,
      mittente: pulisci(m.mittente, 200),
      testo: pulisci(m.testo, 20000),
      media_tipo: pulisci(m.media_tipo, 40),
      link: pulisci(m.link, 500),
    })
  }

  const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL as string, process.env.SUPABASE_SERVICE_ROLE_KEY as string, { auth: { persistSession: false } })
  const lista = [...righe.values()]
  let salvati = 0
  for (let i = 0; i < lista.length; i += 200) {
    const { data, error } = await supabase
      .from('accademia_messaggi')
      .upsert(lista.slice(i, i + 200), { onConflict: 'chat_id,msg_id' })
      .select('id')
    if (error) return NextResponse.json({ error: error.message, salvati }, { status: 500 })
    salvati += data?.length || 0
  }
  return NextResponse.json({ ricevuti: arrivati.length, salvati, scartati })
}
