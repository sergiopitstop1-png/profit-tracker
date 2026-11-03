// 03/11/2026 — LIVELLI FEDELTÀ (Premium Club Lottomatica, Gold Club Goldbet): il team chiede di portare i conti almeno ad Argento
// per tentare il VIP. Il livello si calcola sui Punti Base del MESE SOLARE: una doppia a quota totale >= 2 vale coefficiente 1,
// quindi 1€ giocato = 1 Punto Base. Soglie dai regolamenti (Lottomatica: Argento 500, Oro 1.200).
// Goldbet non ha "Argento/Oro": uso lo stesso posto in classifica (3° e 4° livello = Maestro 1.200, Fenomeno 4.000).
// Per cambiare il livello obiettivo di un book basta modificare qui 'base' (e il nome).
export const LIVELLI_FEDELTA = {
  lottomatica: { programma: 'Premium Club', livelli: { livello_argento: { nome: 'Argento', base: 500 }, livello_oro: { nome: 'Oro', base: 1200 } } },
  goldbet:     { programma: 'Gold Club',    livelli: { livello_argento: { nome: 'Maestro', base: 1200 }, livello_oro: { nome: 'Fenomeno', base: 4000 } } },
}
export const FEDELTA_FINE_PROGRAMMA = '2027-01-31'   // fine di Premium Club e Gold Club
export const FEDELTA_DOPPIA_MAX = 200                // € massimi per singola doppia (sopra, si divide in più doppie)

// Piano mensile: 4 finestre di 7 giorni (1-7, 8-14, 15-21, 22-28) con lo stesso importo, spezzato in doppie da max 200€
export function pianoFedeltaSettimanale(base) {
  const sett = Math.ceil(base / 4 / 25) * 25            // importo a settimana, arrotondato a 25€
  const n = Math.max(1, Math.ceil(sett / FEDELTA_DOPPIA_MAX))
  const importo = Math.ceil(sett / n / 5) * 5           // importo per doppia, arrotondato a 5€
  return { sett, n, importo }
}

// 'lottomatica' | 'goldbet' | null a partire dal nome del book
export function bookFedelta(nomeBook) {
  const n = String(nomeBook || '').toLowerCase()
  return n.includes('goldbet') ? 'goldbet' : n.includes('lottomatica') ? 'lottomatica' : null
}
