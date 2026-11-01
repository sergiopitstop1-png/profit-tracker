// 01/11/2026 — FALSI ALLARMI "conto limitato / sospeso" nelle mail PROMOZIONALI.
// Caso reale: la promo bet365 "Bet Builder Max" ha in testa la frase fissa "Problemi nell'effettuare il login?"
// (un link standard del modello di mail) e Lucy l'ha letta come un problema di accesso al conto:
// LIMITAZIONE / CONTO SOSPESO con il popup rosso "mail importanti sui conti".
// Qui ci sono due difese, entrambe pure (senza chiamate esterne, si provano da sole):
//   1) togliFrasiStandard: toglie dal testo le frasi fisse dei modelli di mail PRIMA che le legga l'AI;
//   2) eFalsoProblemaPromo: se l'AI dice "problema sul conto" ma nel testo (senza frasi standard e senza il piè di pagina
//      sul gioco responsabile) non c'è nessun segno di un problema vero, ed è una promo, l'allarme è falso.

const norm = (v: unknown) =>
  String(v ?? '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')

// frasi fisse di intestazioni e piè di pagina: non descrivono un problema del conto
const FRASI_STANDARD: RegExp[] = [
  /problemi nell['’`]?\s*effettuare il login\s*\??/gi,
  /problemi (di|con l[’'`]?) ?accesso\s*\?/gi,
  /aggiungi [a-z0-9. ]{2,30} ai tuoi contatti/gi,
  /\bcontattaci\b/gi,
  /\bcancellati\b/gi,
  /annulla l['’`]?\s*iscrizione/gi,
  /non riesci a (visualizzare|leggere) (questa|questo) (mail|e-?mail|messaggio)\s*\??/gi,
]

export function togliFrasiStandard(testo: string): string {
  let t = String(testo ?? '')
  for (const re of FRASI_STANDARD) t = t.replace(re, ' ')
  return t
}

// righe del piè di pagina su gioco responsabile / licenza: parlano di "esclusione", "reclamo" ecc. in generale
const RE_PIEDE =
  /vietato ai minori|dipendenza patologica|gioco responsabile|gioco d.?azzardo|adm\.gov|concessione n|licenza|ecogra|autoesclusion|giocaresponsabile|reclam|probabilita di vincita/

// segni di un problema VERO sul conto (se ce n'è anche solo uno, l'allarme resta)
const RE_PROBLEMA_REALE =
  /sospes|sospension|limitat|limitaz|restrizion|blocc|chius|disattiv|rifiut|respint|non (e|sono) stat[oai] (possibile|accettat|approvat|verificat)|scadut|in scadenza|document|identita|verific|kyc|antiriciclaggio|inattiv|dormient|esclus|violazion|irregolarit|attivita sospett|sicurezza del (tuo )?(conto|account)|prelievo|inibizion/

// segni che è una promozione / pubblicità di gioco
const RE_SEGNI_PROMO =
  /bet ?builder|\bbuilder\b|scopri|t&c|termini e condizioni|\boffert|superquot|moltiplicator|quota (maggiorata|boost)|\bbonus\b|freebet|cashback|\bpromo|gioca ora|scommetti|puntata|multipla|schedina|\bquote\b|\bgiri\b|jackpot/

export function eFalsoProblemaPromo(oggetto: unknown, testo: unknown): boolean {
  const o = norm(togliFrasiStandard(String(oggetto ?? '')))
  const righe = norm(togliFrasiStandard(String(testo ?? '').slice(0, 6000))).split(/\n+/)
  const utili = righe.filter((r) => !RE_PIEDE.test(r)).join('\n')
  const tutto = `${o}\n${utili}`
  if (RE_PROBLEMA_REALE.test(tutto)) return false
  return RE_SEGNI_PROMO.test(tutto)
}
