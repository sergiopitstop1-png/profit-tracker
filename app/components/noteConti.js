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

// ─── SCADENZA SCRITTA NELLA NOTA (03/10/2026) ─────────────────────────
// "ENTRO 27/10", "entro il 27/10/2026", "scadenza 5.11", "non oltre il 3-12": la nota va lavorata entro quella data.
// Non è "testo in più": resta nella nota anche quando il sistema la ripulisce.
export const RE_SCADENZA = /\b(?:entro(?:\s+(?:il|del|al))?|scad\w*(?:\s+(?:il|del|al))?|non\s+oltre(?:\s+il)?|termine(?:\s+(?:il|del))?)\s*:?\s*(\d{1,2})\s*[\/.\-]\s*(\d{1,2})(?:\s*[\/.\-]\s*(\d{2,4}))?/i
export function scadenzaNota(note, oggi = new Date().toLocaleDateString('sv-SE')) {
  const m = senzaAccenti(pulisciNota(note)).match(RE_SCADENZA)
  if (!m) return null
  const g = Number(m[1]), me = Number(m[2])
  let y = m[3] ? Number(m[3]) : Number(oggi.slice(0, 4))
  if (y < 100) y += 2000
  if (me < 1 || me > 12 || g < 1 || g > 31) return null
  const iso = (anno) => `${anno}-${String(me).padStart(2, '0')}-${String(g).padStart(2, '0')}`
  if (new Date(iso(y) + 'T00:00:00').getDate() !== g) return null
  // senza anno: se la data è passata da più di 60 giorni, è dell'anno prossimo (es. scritto a dicembre "entro 10/01")
  if (!m[3] && (new Date(oggi + 'T00:00:00') - new Date(iso(y) + 'T00:00:00')) / 86400000 > 60) y += 1
  return iso(y)
}
const togliScadenza = (n) => n.replace(new RegExp(RE_SCADENZA.source, 'gi'), ' ')
const fraseScadenza = (note) => { const m = senzaAccenti(pulisciNota(note)).match(RE_SCADENZA); return m ? m[0].toUpperCase() : '' }

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
  const pulita = (t) => t.replace(/^[\s\-–,;:.()]+|[\s\-–,;:.()]+$/g, '').replace(/\s*[-–]\s*[-–]\s*/g, ' - ').replace(/\s+/g, ' ').trim().toUpperCase()
  // 03/10/2026: la scadenza riguarda la cosa appena chiusa → si toglie insieme alla parola chiave
  return pulita(togliScadenza(n))
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

// Annulla gli avvisi aperti di un flusso per un book. Si usa SOLO quando la parola chiave la toglie il sistema
// dopo un esito confermato (recuperato, approvato, riaperto…). Se la toglie qualcuno a mano, gli avvisi
// NON si annullano: finiscono tra quelli "da confermare" (vedi AvvisiConti.jsx).
export async function annullaAvvisiFlusso(bookId, flusso, motivo, setAvvisi) {
  const { data, error } = await supabase.from('avvisi_conti').update({ stato: 'annullato', esito: motivo || 'flusso chiuso' })
    .eq('stato', 'aperto').eq('book_id', String(bookId)).contains('meta', { flusso }).select()
  if (!error && data && data.length && setAvvisi) setAvvisi(prev => (prev || []).map(x => data.find(d => d.id === x.id) || x))
}

// Rimette una parola chiave in fondo alla nota (ripristino dopo una cancellazione per errore)
export function aggiungiParola(note, flusso) {
  const k = PAROLE_CHIAVE.find(x => x.flusso === flusso)
  const n = pulisciNota(note)
  if (!k || k.re.test(senzaAccenti(n))) return n
  return (n ? `${n} - ` : '') + k.label.toUpperCase()
}

// Solo le parole chiave della nota (il testo in più viene tolto). '' se non ce ne sono.
export function soloParoleChiave(note) {
  const n = senzaAccenti(pulisciNota(note))
  const parole = PAROLE_CHIAVE.filter(k => k.re.test(n)).map(k => (n.match(new RegExp(k.re.source, 'i')) || [''])[0].toUpperCase()).join(' - ')
  const sc = parole ? fraseScadenza(note) : ''   // 03/10/2026: la scadenza non si perde quando la nota viene ripulita
  return sc ? `${parole} ${sc}` : parole
}
// Testo in più rispetto alle parole chiave (quello che legge l'AI)
export function testoExtra(note) {
  return motivoAssistenza(togliScadenza(senzaAccenti(pulisciNota(note))))   // la scadenza non è testo da far leggere all'AI
}
// Impronta della nota: se cambia, la nota va riletta
export function improntaNota(note) {
  const s = pulisciNota(note).toLowerCase(); let h = 2166136261
  for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619) }
  return (h >>> 0).toString(36)
}
