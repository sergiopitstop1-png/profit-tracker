// ════════════════════════════════════════════════════════════════════
// PAROLE CHIAVE NELLE NOTE DEI BOOK (27/09/2026, concordate con Sergio)
//   limitato bonus · limitato sport · sentire assistenza · chiudere e riaprire
//   inviare documento · riconoscimento live
// Riconoscimento: maiuscole indifferenti, spazi/a capo/"\n" letterali ignorati, piccoli refusi tollerati
// ("ASSSITENZA"). "INVIARE DOCUMENTO (LIVE)" e "selfie" valgono come riconoscimento live.
// Ogni modifica automatica di una nota salva il testo originale in note_storico.
// ════════════════════════════════════════════════════════════════════
import { supabase } from '../profit-tracker/supabaseClient'

// testo della nota ripulito: "\n" letterali e a capo → spazio, spazi multipli compressi
export function pulisciNota(note) {
  return String(note || '').replace(/\\n/g, ' ').replace(/\s+/g, ' ').trim()
}
const senzaAccenti = (s) => s.normalize('NFD').replace(/[\u0300-\u036f]/g, '')

// Espressioni delle parole chiave. L'ordine conta: "documento (live)" va riconosciuto prima di "inviare documento".
export const PAROLE_CHIAVE = [
  { flusso: 'bonus', label: 'limitato bonus', re: /limitat[oa]\s+bonus/i },
  { flusso: 'sport', label: 'limitato sport', re: /limitat[oa]\s+sport/i },
  { flusso: 'assistenza', label: 'sentire assistenza', re: /sentir\w*\s+(?:l'?\s*)?as+\w*nza/i },
  { flusso: 'riapertura', label: 'chiudere e riaprire', re: /chiuder\w*\s+e\s+riaprir\w*/i },
  { flusso: 'live', label: 'riconoscimento live', re: /riconosciment\w*\s+live|invia\w*\s+(?:il\s+)?document\w*\s*\(\s*live\s*\)|(?:conto\s+da\s+verificare\s+tramite\s+)?selfie/i },
  { flusso: 'documento', label: 'inviare documento', re: /invia\w*\s+(?:il\s+)?document[a-z]*(?![a-z])(?!\s*\(\s*live)/i },
]

// Flussi presenti nella nota: es. ['bonus'], ['assistenza','riapertura'] … oppure []
export function paroleChiave(note) {
  const n = senzaAccenti(pulisciNota(note))
  if (!n) return []
  return PAROLE_CHIAVE.filter(k => k.re.test(n)).map(k => k.flusso)
}

// Nota con testo ma senza nessuna parola chiave → va nel popup "Book con note da attenzionare"
export function notaDaAttenzionare(note) {
  return pulisciNota(note) !== '' && paroleChiave(note).length === 0
}

// Motivo scritto accanto a "sentire assistenza" (il resto della nota, tolte le altre parole chiave)
export function motivoAssistenza(note) {
  let n = senzaAccenti(pulisciNota(note))
  for (const k of PAROLE_CHIAVE) n = n.replace(new RegExp(k.re.source, 'gi'), ' ')
  return n.replace(/[\s\-–,;:.]+/g, ' ').trim()
}

// Toglie la parola chiave dalla nota. Per "assistenza" toglie anche il motivo (il resto della nota
// che non è un'altra parola chiave), perché la cosa è chiusa. Ritorna la nota ripulita ('' se vuota).
export function togliParola(note, flusso) {
  const k = PAROLE_CHIAVE.find(x => x.flusso === flusso)
  if (!k) return pulisciNota(note)
  let n = senzaAccenti(pulisciNota(note))
  if (flusso === 'assistenza') {
    const altre = PAROLE_CHIAVE.filter(x => x.flusso !== 'assistenza' && x.re.test(n)).map(x => (n.match(new RegExp(x.re.source, 'i')) || [''])[0])
    return altre.join(' - ').toUpperCase()
  }
  n = n.replace(new RegExp(k.re.source, 'gi'), ' ')
  return n.replace(/^[\s\-–,;:.]+|[\s\-–,;:.]+$/g, '').replace(/\s*[-–]\s*[-–]\s*/g, ' - ').replace(/\s+/g, ' ').trim().toUpperCase()
}

// Salva il testo originale di una nota nello storico (non blocca se fallisce)
export async function salvaStoricoNota(book, testo, motivo) {
  try {
    await supabase.from('note_storico').insert([{ book_id: String(book.id), nome: book.nome || '', intestatario: book.intestatario || '', testo: String(testo || ''), motivo: motivo || '' }])
  } catch { /* lo storico è un di più: non deve fermare l'operazione */ }
}

// Aggiorna la nota di un book salvando prima lo storico. Ritorna la nuova nota oppure lancia l'errore.
export async function aggiornaNotaBook(book, nuovaNota, motivo, setBooks) {
  await salvaStoricoNota(book, book.note, motivo)
  const { error } = await supabase.from('books').update({ note: nuovaNota }).eq('id', book.id)
  if (error) throw error
  if (setBooks) setBooks(prev => prev.map(b => b.id === book.id ? { ...b, note: nuovaNota } : b))
  return nuovaNota
}
