// tennisModel.js
// Modello di probabilità di vittoria tennis basato su point-win probability al servizio
// (approccio Klaassen & Magnus): dalla % di punti vinti al servizio si risale, per via
// ricorsiva esatta, a P(vincere game) -> P(vincere tiebreak) -> P(vincere set) -> P(vincere match).
//
// SEMPLIFICAZIONI DICHIARATE (per un tool ad uso personale, non un paper accademico):
// 1. I set sono trattati come indipendenti (assunzione standard anche nel paper originale
//    di Klaassen & Magnus) — non si modella la "fatica" tra un set e l'altro.
// 2. L'ordine di chi serve per primo nei singoli set è fissato per convenzione
//    (Set1: A, Set2: B, Set3 decisivo: A) invece di tracciare esattamente la rotazione
//    reale — l'impatto sulla probabilità aggregata è trascurabile.
// 3. Il tie-break oltre il 6-6 usa una ricorsione con cap di sicurezza (a,b <= 40 punti)
//    invece di una forma chiusa — a quei punteggi la probabilità residua è comunque
//    trascurabile, quindi il cap non introduce errore pratico.

function memoize2(fn) {
  const cache = new Map();
  return (i, j) => {
    const key = i * 1000 + j;
    if (cache.has(key)) return cache.get(key);
    const result = fn(i, j);
    cache.set(key, result);
    return result;
  };
}

/**
 * Probabilità che il giocatore al servizio vinca un game, dato p = prob. di vincere
 * un singolo punto al servizio. Ricorsione esatta con chiusura analitica al deuce.
 */
function gameProb(p) {
  const q = 1 - p;
  const deuceWin = (p * p) / (p * p + q * q); // prob. di vincere il game partendo dal 40-40

  const rec = memoize2((i, j) => {
    if (i >= 4 && i - j >= 2) return 1;
    if (j >= 4 && j - i >= 2) return 0;
    if (i >= 3 && j >= 3 && i === j) return deuceWin; // 40-40, 41-41 (adv-adv)... tutti equivalenti
    return p * rec(i + 1, j) + q * rec(i, j + 1);
  });
  return rec(0, 0);
}

/**
 * Ordine di servizio nel tie-break: punto 1 = firstServer, poi blocchi da 2 punti
 * alternati (standard ATP/WTA): A, B,B, A,A, B,B, A,A, ...
 */
function tiebreakServerAt(pointNumber, firstServer) {
  if (pointNumber === 1) return firstServer;
  const other = firstServer === "A" ? "B" : "A";
  const block = Math.floor((pointNumber - 2) / 2);
  return block % 2 === 0 ? other : firstServer;
}

/**
 * Probabilità che A vinca il tie-break, dati pA (prob. A vince punto al proprio servizio)
 * e pB (prob. B vince punto al proprio servizio). Ricorsione con cap di sicurezza oltre
 * il quale approssima 0.5 (impatto trascurabile a quei punteggi estremi).
 */
function tiebreakProb(pA, pB, firstServer = "A") {
  const cache = new Map();
  const CAP = 40;

  function rec(a, b) {
    if (a >= 7 && a - b >= 2) return 1;
    if (b >= 7 && b - a >= 2) return 0;
    if (a >= CAP || b >= CAP) return 0.5; // troncamento di sicurezza, probabilità residua trascurabile

    const key = a + "-" + b;
    if (cache.has(key)) return cache.get(key);

    const server = tiebreakServerAt(a + b + 1, firstServer);
    const pAWinsPoint = server === "A" ? pA : 1 - pB;
    const result =
      pAWinsPoint * rec(a + 1, b) + (1 - pAWinsPoint) * rec(a, b + 1);
    cache.set(key, result);
    return result;
  }
  return rec(0, 0);
}

/**
 * Probabilità che A vinca il set, dati pA, pB (prob. punto vinto al proprio servizio)
 * e chi serve il primo game del set ("A" o "B"). Ricorsione esatta e finita
 * (il punteggio è naturalmente limitato dalle regole del set).
 */
function setProb(pA, pB, firstServer = "A") {
  const gA = gameProb(pA); // prob. A vince un proprio game di servizio
  const gB = gameProb(pB); // prob. B vince un proprio game di servizio
  const cache = new Map();

  function rec(i, j) {
    if (i >= 6 && i - j >= 2) return 1;
    if (j >= 6 && j - i >= 2) return 0;
    if (i === 6 && j === 6) {
      // Tie-break decide il set. Chi serve il game 13 (il tie-break) è il prossimo
      // in rotazione rispetto a chi ha servito il game 12.
      const server12 = (12 % 2 === 1) === (firstServer === "A") ? "A" : "B";
      const tbFirstServer = server12 === "A" ? "B" : "A";
      return tiebreakProb(pA, pB, tbFirstServer);
    }

    const key = i + "-" + j;
    if (cache.has(key)) return cache.get(key);

    const gameNumber = i + j + 1;
    const isOdd = gameNumber % 2 === 1;
    const server = isOdd === (firstServer === "A") ? "A" : "B";
    const pAWinsGame = server === "A" ? gA : 1 - gB;

    const result = pAWinsGame * rec(i + 1, j) + (1 - pAWinsGame) * rec(i, j + 1);
    cache.set(key, result);
    return result;
  }
  return rec(0, 0);
}

/**
 * Probabilità che A vinca il match (best of 3, assunzione standard ATP/WTA maschile
 * e femminile — per Slam maschili best of 5 passare bestOf=5).
 * Set indipendenti (vedi nota in cima al file); ordine di servizio nei set: A, B, A, B, A.
 */
function matchProb(pA, pB, bestOf = 3) {
  const firstServers = ["A", "B", "A", "B", "A"];
  const setProbs = firstServers
    .slice(0, bestOf)
    .map((fs) => setProb(pA, pB, fs));

  const setsToWin = Math.ceil(bestOf / 2);
  const n = setProbs.length;

  function rec(setIdx, wA, wB) {
    if (wA === setsToWin) return 1;
    if (wB === setsToWin) return 0;
    const p = setProbs[setIdx];
    return p * rec(setIdx + 1, wA + 1, wB) + (1 - p) * rec(setIdx + 1, wA, wB + 1);
  }
  return rec(0, 0, 0);
}

module.exports = { gameProb, tiebreakProb, setProb, matchProb };
