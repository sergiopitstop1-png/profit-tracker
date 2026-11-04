// lib/calcolatore1t.ts — 04/11/2026
// Calcoli (solo matematica, niente rete, niente database) per la giocata «Over 0.5 1° tempo + assicurazione sullo 0-0 finale».
// Usati dalla pagina /profit-tracker/calcolatore-1t.
//
// Idea: si punta X sull'Over 0.5 1T (quota Qo). Con una piccola puntata s sullo 0-0 FINALE (exchange, quota B) ci si assicura:
//  - se segna nel 1T → vince l'Over (X·(Qo−1)) e si perde s;
//  - se è 0-0 al 45' → si perde X, ma lo 0-0 finale scende (es. da 14,5 a ~4,5): lo si chiude («banca») e si incassa s·g.
// g = guadagno netto per euro puntato sullo 0-0 quando lo chiudi a quota Qh:  g = (B/Qh − 1)·(1 − commissione)

export type Copertura = {
  g: number            // guadagno netto per euro sullo 0-0 chiuso all'intervallo
  s: number            // puntata sullo 0-0 finale
  vinceSeSegna: number // risultato netto se segna nel 1T
  perdeSeZero: number  // risultato netto se è 0-0 al 45' (dopo la chiusura dello 0-0)
  quotaEfficace: number // 1 + vinceSeSegna/X: la quota da usare nel Masaniello classico
  pareggio: number     // tasso di vittoria (0-1) sotto il quale la giocata perde in media
  recuperoEffettivo: number // quanto recuperi davvero (in € e in % di X)
}

export function guadagnoChiusura(quotaBack: number, quotaChiusura: number, commissionePct: number): number {
  return (quotaBack / quotaChiusura - 1) * (1 - commissionePct / 100)
}

export function copertura(X: number, quotaOver: number, quotaBack: number, quotaChiusura: number, commissionePct: number, recuperoPct: number): Copertura | null {
  if (!(X > 0) || !(quotaOver > 1) || !(quotaBack > 1) || !(quotaChiusura > 1)) return null
  const g = guadagnoChiusura(quotaBack, quotaChiusura, commissionePct)
  if (!(g > 0)) return null   // chiudere a quota ≥ quota di ingresso non recupera nulla
  const R = Math.max(0, recuperoPct) / 100
  const s = (R * X) / g
  const vinceSeSegna = X * (quotaOver - 1) - s
  const perdeSeZero = -X + s * g
  const L = -perdeSeZero
  return {
    g, s, vinceSeSegna, perdeSeZero,
    quotaEfficace: 1 + vinceSeSegna / X,
    pareggio: vinceSeSegna > 0 ? L / (vinceSeSegna + L) : 1,
    recuperoEffettivo: s * g,
  }
}

// ── Masaniello classico con quota efficace Q ─────────────────────────────────────────────────────
// N eventi, V vittorie da fare. A(n,v) = P(Bin(n, 1/Q) ≥ v): il capitale «necessario» per garantire il target.
// Stake della prossima giocata = K·(1 − A(n−1,v)/A(n,v)); rendimento se centri il target = 1/A(N,V) − 1.
function tabellaA(Q: number, N: number): number[][] {
  const p = 1 / Q
  const A: number[][] = []
  for (let n = 0; n <= N; n++) {
    A[n] = []
    for (let v = 0; v <= N + 1; v++) {
      if (v <= 0) A[n][v] = 1
      else if (v > n) A[n][v] = 0
      else A[n][v] = p * A[n - 1][v - 1] + (1 - p) * A[n - 1][v]
    }
  }
  return A
}

export type PianoMasaniello =
  | { stato: 'ok'; stake: number; rendimentoTarget: number; fattoreTarget: number }
  | { stato: 'raggiunto' }          // v ≤ 0: le vittorie previste sono già fatte
  | { stato: 'impossibile' }        // v > n: non si può più arrivare al target
  | { stato: 'errore'; motivo: string }

// K = capitale attuale del Masaniello, n = partite ancora da giocare, v = vittorie ancora da fare
export function pianoMasaniello(K: number, Q: number, n: number, v: number): PianoMasaniello {
  if (!(K > 0) || !(Q > 1)) return { stato: 'errore', motivo: 'Capitale e quota efficace devono essere positivi (quota > 1)' }
  if (!Number.isInteger(n) || !Number.isInteger(v) || n < 0 || n > 400) return { stato: 'errore', motivo: 'Partite e vittorie devono essere numeri interi (massimo 400 partite)' }
  if (v <= 0) return { stato: 'raggiunto' }
  if (v > n) return { stato: 'impossibile' }
  const A = tabellaA(Q, n)
  const a = A[n][v]
  if (!(a > 0)) return { stato: 'impossibile' }
  return { stato: 'ok', stake: K * (1 - A[n - 1][v] / a), fattoreTarget: 1 / a, rendimentoTarget: 1 / a - 1 }
}

// Probabilità di centrare almeno V vittorie su N partite, se il tasso reale di vittoria è p
export function probTarget(N: number, V: number, p: number): number {
  if (V <= 0) return 1
  if (V > N) return 0
  if (p <= 0) return 0
  if (p >= 1) return 1
  // P(X ≥ V) con ricorrenza sulla pmf (stabile per N ≤ 400)
  const pmf: number[] = new Array(N + 1).fill(0)
  pmf[0] = Math.pow(1 - p, N)
  for (let k = 1; k <= N; k++) pmf[k] = pmf[k - 1] * ((N - k + 1) / k) * (p / (1 - p))
  let s = 0
  for (let k = V; k <= N; k++) s += pmf[k]
  return Math.min(1, Math.max(0, s))
}
