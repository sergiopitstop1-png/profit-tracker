/* eslint-disable @typescript-eslint/no-explicit-any */
// ═════════════════════════════════════════════════════════════════
// lib/lucyRegistra.ts — la Chat Lucy REGISTRA un'operazione fatta a mano (28/10/2026)
// Sergio scrive o detta "fatta bet 10 euro bet365 Sergio": Lucy trova il conto, mostra un riepilogo e, SOLO dopo il suo sì,
// mette la voce nella coda esistente `registra_coda` (la stessa del programmino Alt+R). Il Profit Tracker, quando è aperto,
// la porta nel Registro manuale e lì decide da solo se è recupero, mantenimento o profilazione (stessa funzione di sempre).
// Questo file NON scrive in nessun'altra tabella e non crea tabelle nuove. Usato solo da /api/lucy-chat (non da Lucy locale).
// ═════════════════════════════════════════════════════════════════

export const TIPI_OPERAZIONE = ['Sport', 'Casinò / slot', 'Ricarica', 'Promo / VXT', 'Altro']
const MAX_CONTI = 40
const MAX_IN_ATTESA = 200

export const STRUMENTI_REGISTRA = [{
  name: 'trova_conto',
  description: 'Cerca i conti (book + cliente) per nome, in sola lettura. Usalo SEMPRE prima di registrare un\'operazione, per avere l\'id esatto del conto. Restituisce id, book, cliente, livello e note del conto (per vedere se è limitato o dormiente).',
  input_schema: {
    type: 'object',
    properties: {
      book: { type: 'string', description: 'Parte del nome del book (es. "sisal", "bet365").' },
      cliente: { type: 'string', description: 'Parte del nome del cliente / intestatario (es. "federico", "sergio").' },
    },
  },
}, {
  name: 'registra_operazione',
  description: 'Mette in coda la registrazione di un\'operazione fatta OGGI a mano su uno o più conti. Chiamalo SOLO dopo che Sergio ha confermato in chat il riepilogo che gli hai mostrato, e solo con gli id presi da trova_conto. Una chiamata = un importo: se le bet hanno importi diversi fai una chiamata per ciascuna. Registra solo operazioni di oggi.',
  input_schema: {
    type: 'object',
    properties: {
      book_ids: { type: 'array', items: { type: 'string' }, description: 'Id dei conti (da trova_conto).' },
      tipo_op: { type: 'string', enum: TIPI_OPERAZIONE, description: 'Sport = bet; Casinò / slot; Ricarica; Promo / VXT; Altro.' },
      importo: { type: 'string', description: 'Importo in euro come numero (10) oppure intervallo (5/15). Lascia vuoto se Sergio non lo ha detto: non inventarlo.' },
      nota: { type: 'string', description: 'Breve descrizione facoltativa (es. "contropuntata ADP", partita).' },
    },
    required: ['book_ids', 'tipo_op'],
  },
}]

const taglia = (v: any, n = 90) => String(v ?? '').replace(/\s+/g, ' ').trim().slice(0, n)
// ilike: tolgo i caratteri speciali di LIKE/PostgREST dal testo cercato
const pulisci = (v: any) => String(v ?? '').replace(/[%_*,()\\]/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 40)

export async function trovaConto(sb: any, inp: any): Promise<string> {
  const book = pulisci(inp?.book), cliente = pulisci(inp?.cliente)
  if (!book && !cliente) return 'Dimmi almeno il book o il cliente da cercare.'
  let q = sb.from('books').select('id,nome,intestatario,profilo_livello,note').order('nome', { ascending: true }).limit(15)
  if (book) q = q.ilike('nome', `%${book}%`)
  if (cliente) q = q.ilike('intestatario', `%${cliente}%`)
  const { data, error } = await q
  if (error) return `Ricerca non riuscita: ${taglia(error.message, 120)}`
  if (!data?.length) return `Nessun conto trovato per book "${book}" e cliente "${cliente}".`
  const righe = data.map((b: any) => {
    const nota = taglia(b.note, 100)
    const limitato = /limitat/i.test(String(b.note || ''))
    return `- id ${b.id} · ${taglia(b.nome, 40)} · ${taglia(b.intestatario, 40) || '—'} · livello: ${b.profilo_livello || 'nessuno (vale mantenimento)'}${limitato ? ' · LIMITATO (nota)' : ''}${nota ? ` · nota: ${nota}` : ''}`
  })
  return `${data.length === 15 ? 'Primi 15 conti trovati (se non è quello giusto restringi la ricerca)' : `${data.length} conti trovati`}:\n${righe.join('\n')}`
}

// Parole con cui Sergio dice "sì, registra": il controllo è fatto qui, sul SUO ultimo messaggio, non su quello che decide il modello
// (così un testo scritto dentro una mail o un SMS non può far registrare nulla).
// (niente \b: dopo "sì" la lettera accentata non conta come parola, quindi uso un controllo "non segue un'altra lettera")
const SI = /^\s*(s[iì]+|ok(ay)?|va bene|vai|conferm\w*|procedi|esatto|giusto|certo|perfetto)(?![a-zà-öø-ÿ])/i

export async function registraOperazione(sb: any, inp: any, ultimoMessaggioUtente: string): Promise<string> {
  if (!SI.test(String(ultimoMessaggioUtente || '').replace(/^["'«]+/, ''))) {
    return 'NON registrato: prima mostra a Sergio il riepilogo ("Registro: book · cliente · tipo · importo. Ok?") e aspetta che risponda sì. Poi richiama questo strumento.'
  }
  const utente = process.env.PT_USER_ID
  if (!utente) return 'NON registrato: manca PT_USER_ID su Vercel (configurazione del server).'
  const ids = [...new Set((Array.isArray(inp?.book_ids) ? inp.book_ids : []).map((x: any) => String(x ?? '').trim()).filter(Boolean))] as string[]
  if (!ids.length || ids.length > MAX_CONTI) return `NON registrato: scegli da 1 a ${MAX_CONTI} conti.`
  const tipo = TIPI_OPERAZIONE.includes(inp?.tipo_op) ? inp.tipo_op : 'Sport'
  const importo = String(inp?.importo ?? '').replace(',', '.').trim().slice(0, 20)
  if (importo && !/^\d+(\.\d+)?(\s*[\/\-–]\s*\d+(\.\d+)?)?$/.test(importo)) return 'NON registrato: importo non valido (serve un numero, es. 10, oppure un intervallo, es. 5/15).'
  const nota = taglia(inp?.nota, 200)

  const { data: esistenti, error: e1 } = await sb.from('books').select('id,nome,intestatario').in('id', ids)
  if (e1) return `NON registrato: controllo dei conti non riuscito (${taglia(e1.message, 100)}).`
  if ((esistenti || []).length !== ids.length) return 'NON registrato: uno degli id non corrisponde a un conto. Richiama trova_conto e usa gli id esatti.'

  const { data: attesa, error: e2 } = await sb.from('registra_coda').select('id').eq('user_id', utente).eq('stato', 'attesa').limit(MAX_IN_ATTESA + 1)
  if (e2) return `NON registrato: la coda non è raggiungibile (${taglia(e2.message, 100)}). Se la tabella registra_coda non esiste, va creata con supabase/registra_coda.sql.`
  if ((attesa || []).length > MAX_IN_ATTESA) return 'NON registrato: ci sono troppe voci in attesa. Apri il Profit Tracker per smaltirle.'

  const { error: e3 } = await sb.from('registra_coda').insert([{ user_id: utente, book_ids: ids, tipo_op: tipo, importo: importo || null, nota: nota || null }])
  if (e3) return `NON registrato: ${taglia(e3.message, 140)}`
  const elenco = (esistenti || []).map((b: any) => `${taglia(b.nome, 30)} · ${taglia(b.intestatario, 30) || '—'}`).join('; ')
  return `Messo in coda: ${tipo}${importo ? ` ${importo} €` : ''} su ${elenco}. Il Profit Tracker lo scrive nel Registro manuale entro circa un minuto, ma solo se è aperto in una scheda del browser; se il conto è limitato lo segna da solo come recupero, altrimenti come mantenimento o profilazione secondo il suo livello.`
}
