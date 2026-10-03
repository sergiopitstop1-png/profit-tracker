// ════════════════════════════════════════════════════════════════════
// UN AVVISO AL GIORNO (03/10/2026, regola di Sergio)
// Tra tutti gli avvisi da fare (chat, documenti, live, riaperture, recupero, note…) ogni giorno
// se ne propone UNO. Ordine: prima chi ha una scadenza entro 7 giorni (la più vicina per prima),
// poi il più vecchio. Le scadenze più lontane sono comunque protette: se con un avviso al giorno
// una scadenza verrebbe superata, quell'avviso entra OGGI in più (segnalato come urgente).
// Gli altri restano in coda con il giorno previsto; si possono sempre fare in anticipo.
// Funzione pura: la usano il pannello Avvisi e i contatori/banner del Profit Tracker.
// ════════════════════════════════════════════════════════════════════
export const LIMITE_AVVISI_GIORNO = 1
export const GIORNI_SCADENZA_VICINA = 7

const piuGiorni = (iso, n) => { const d = new Date(iso + 'T00:00:00'); d.setDate(d.getDate() + n); return d.toLocaleDateString('sv-SE') }

export function pianoAvvisi({ candidati, oggi, scadenzaDi = () => null, fattiOggi = 0, limite = LIMITE_AVVISI_GIORNO }) {
  const lista = [...(candidati || [])]
  const davanti = new Set()   // avvisi con scadenza da mettere in testa alla fila
  for (const a of lista) { const sc = scadenzaDi(a); if (sc && sc <= piuGiorni(oggi, GIORNI_SCADENZA_VICINA)) davanti.add(a) }
  let risultato = null
  for (let giro = 0; giro < 30; giro++) {
    const chiave = (a) => davanti.has(a) ? String(scadenzaDi(a)) : '9999'
    const ord = [...lista].sort((x, y) =>
      chiave(x).localeCompare(chiave(y))
      || String(x.data_prevista || '').localeCompare(String(y.data_prevista || ''))
      || String(x.creato || '').localeCompare(String(y.creato || ''))
      || Number(x.id || 0) - Number(y.id || 0))
    // ogni avviso prende il primo giorno libero (limite al giorno); se quel giorno è dopo la sua
    // scadenza, si fa oggi come urgente (senza togliere il posto agli altri)
    const usati = new Map([[oggi, Math.min(limite, fattiOggi)]])
    const libero = () => { for (let n = 0; n < 3650; n++) { const g = piuGiorni(oggi, n); if ((usati.get(g) || 0) < limite) return g } return oggi }
    const diOggi = [], urgenti = [], coda = []
    for (const a of ord) {
      const g = libero(), sc = scadenzaDi(a)
      if (sc && g > sc) { urgenti.push(a); diOggi.push(a); continue }
      usati.set(g, (usati.get(g) || 0) + 1)
      if (g === oggi) diOggi.push(a); else coda.push({ a, giorno: g })
    }
    risultato = { oggi: diOggi, urgenti, coda, fattiOggi, limite }
    // una scadenza lontana finita "urgente" solo perché era in fondo alla fila: la si mette davanti e si ricalcola
    const daAnticipare = urgenti.filter(a => !davanti.has(a))
    if (!daAnticipare.length) break
    daAnticipare.forEach(a => davanti.add(a))
  }
  return risultato
}
