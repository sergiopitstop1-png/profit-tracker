import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

// Esegue le chiamate a piccoli gruppi paralleli invece che una alla volta, per non superare i tempi massimi del server
async function eseguiAGruppi<T, R>(items: T[], concorrenza: number, fn: (item: T, index: number) => Promise<R>): Promise<R[]> {
  const risultati: R[] = new Array(items.length)
  let cursore = 0
  async function worker() {
    while (cursore < items.length) {
      const i = cursore++
      risultati[i] = await fn(items[i], i)
    }
  }
  const workers = Array.from({ length: Math.min(concorrenza, items.length) }, () => worker())
  await Promise.all(workers)
  return risultati
}

// POST - importa in blocco un array di credenziali già pronte (già abbinate ai book lato client)
export async function POST(request: Request) {
  const body = await request.json()
  const righe = body.righe

  if (!Array.isArray(righe) || righe.length === 0) {
    return NextResponse.json({ error: 'nessuna riga da importare' }, { status: 400 })
  }
  if (righe.length > 5000) {
    return NextResponse.json({ error: 'troppe righe in un colpo solo (max 5000), dividi in più importazioni' }, { status: 400 })
  }

  const errori: { indice: number; riga: any; errore: string }[] = []
  let importate = 0

  await eseguiAGruppi(righe, 15, async (riga: any, indice: number) => {
    const haBook = !!riga.book_id
    const haManuale = !!riga.bookmaker_manuale && !!riga.intestatario_manuale

    if (!riga.username || !riga.password || (!haBook && !haManuale)) {
      errori.push({ indice, riga, errore: 'username, password o bookmaker/intestatario mancanti' })
      return
    }

    const { error } = await supabase.rpc('inserisci_credenziale', {
      p_book_id: haBook ? Number(riga.book_id) : null,
      p_username: riga.username,
      p_password: riga.password,
      p_data_iscrizione: riga.data_iscrizione || null,
      p_risposta_segreta: riga.risposta_segreta || null,
      p_limite_settimanale: riga.limite_settimanale ? Number(riga.limite_settimanale) : null,
      p_invio_documenti: !!riga.invio_documenti,
      p_note: riga.note || null,
      p_bookmaker_manuale: haBook ? null : riga.bookmaker_manuale,
      p_intestatario_manuale: haBook ? null : riga.intestatario_manuale
    })

    if (error) {
      errori.push({ indice, riga, errore: error.message })
    } else {
      importate++
    }
  })

  return NextResponse.json({ ok: true, importate, totali: righe.length, errori })
}
