// =====================================================================
// RECUPERO CONTI · Masaniello pilota con le partite di PronoX (01/10/2026)
// Solo funzioni pure (niente database, niente interfaccia): si possono
// testare da sole. Le usano il pannello Recuperi e Lucy.
//
// Regole concordate con Sergio:
// - piano pilota 500 €, 133 vincite su 200 eventi, quota di riferimento 1,45
// - un solo esito per partita, quota giusta tra 1,40 e 1,60,
//   massimo 5 partite al giorno (le più probabili)
// - quota minima accettabile: almeno +3% di valore atteso
// - se la % di vincite richiesta supera di 2 punti quella iniziale,
//   Lucy PROPONE di allungare il piano (max 400 eventi): conferma Sergio
// - avviso rosso e stop nuove bet quando la perdita arriva a 200 €
// - la puntata di ogni partita si divide tra i conti limitati
//   (tutti, anche quelli in coda): pezzi 3-8 € sui limitati bonus,
//   2 € sui limitati sport, massimo 25 € a settimana per conto,
//   un conto una sola volta per partita, max 2 conti dello stesso book
// =====================================================================

import { FOOTBALL_MARKETS } from "../pronox/footballModel";

export const PIANO_PILOTA = {
  nome: "Recupero pilota PronoX",
  capitale: 500,
  N: 200,
  K: 133,
  quotaRif: 1.45,
  maxEventi: 400,
  sogliaAllungo: 0.02,
  perditaMax: 200,
  quotaDa: 1.40,
  quotaA: 1.60,
  minEV: 0.03,
  maxPartiteGiorno: 5, // più partite contemporanee = più rischio nello stesso giorno
};

const ETICHETTE = new Map(FOOTBALL_MARKETS.map((m) => [m.id, m.label]));
ETICHETTE.set("BTTS|yes", "Goal (entrambe segnano)");
const PRIORITA_VERSIONE = (v) => (String(v).endsWith("_cal") ? 2 : 1); // calibrata se c'è

// ─── 1. Esiti candidati: uno per partita ─────────────────────────────
// righe = prediction_snapshots (event_id, event_start, competition,
// home_team, away_team, market, selection, model_version, model_prob)
export function scegliEsiti(righe, piano = PIANO_PILOTA) {
  const perEsito = new Map(); // event|market|selection -> riga migliore
  for (const r of righe || []) {
    if (!r || !Number.isFinite(Number(r.model_prob))) continue;
    const k = `${r.event_id}|${r.market}|${r.selection}`;
    const prima = perEsito.get(k);
    if (!prima || PRIORITA_VERSIONE(r.model_version) > PRIORITA_VERSIONE(prima.model_version)) perEsito.set(k, r);
  }
  const perPartita = new Map();
  for (const r of perEsito.values()) {
    const p = Number(r.model_prob);
    const quotaGiusta = 1 / p;
    if (quotaGiusta < piano.quotaDa || quotaGiusta > piano.quotaA) continue;
    const c = {
      event_id: r.event_id,
      event_start: r.event_start,
      competition: r.competition,
      partita: r.home_team && r.away_team ? `${r.home_team} – ${r.away_team}` : r.event_id,
      market: r.market,
      selection: r.selection,
      esito: ETICHETTE.get(`${r.market}|${r.selection}`) || `${r.market} ${r.selection}`,
      prob: p,
      quotaGiusta: Math.round(quotaGiusta * 100) / 100,
      quotaMinima: Math.ceil(((1 + piano.minEV) / p) * 100) / 100,
    };
    const prima = perPartita.get(r.event_id);
    if (!prima || c.prob > prima.prob) perPartita.set(r.event_id, c); // il più probabile nella fascia
  }
  return [...perPartita.values()].sort((a, b) => String(a.event_start).localeCompare(String(b.event_start)));
}

// ─── 2. Motore Masaniello (quota di riferimento costante) ────────────
function creaV(q) {
  const memo = new Map();
  const V = (n, k) => {
    if (k <= 0) return 1;
    if (n < k) return 0;
    const key = n * 1000 + k;
    if (memo.has(key)) return memo.get(key);
    const v = (V(n - 1, k - 1) + (q - 1) * V(n - 1, k)) / q;
    memo.set(key, v);
    return v;
  };
  return V;
}

// eventi = una riga per PARTITA giocata nel piano:
// { event_id, event_start, puntata (somma dei pezzi), incasso (somma delle vincite lorde, 0 se persa),
//   esito: 'vinta' | 'persa' | 'nulla' | 'attesa' }
// pianoDb = { capitale, N, K, quotaRif, eventi_extra }
export function statoPiano(pianoDb, eventi, piano = PIANO_PILOTA) {
  const C = Number(pianoDb?.capitale ?? piano.capitale);
  const N = Number(pianoDb?.N ?? piano.N) + Number(pianoDb?.eventi_extra || 0);
  const K = Number(pianoDb?.K ?? piano.K);
  const q = Number(pianoDb?.quotaRif ?? piano.quotaRif);
  const V = creaV(q);

  let X = C, vinte = 0, perse = 0, nulle = 0, inAttesa = 0, impegnato = 0;
  for (const e of eventi || []) {
    if (e.esito === "attesa") { inAttesa++; impegnato += Number(e.puntata) || 0; continue; }
    if (e.esito === "nulla") { nulle++; continue; } // rimborsata: non conta
    X += (Number(e.incasso) || 0) - (Number(e.puntata) || 0);
    if (e.esito === "vinta") vinte++; else perse++;
  }
  X = Math.round(X * 100) / 100;
  const k = Math.max(0, K - vinte);
  const n = N - vinte - perse;
  const perdita = Math.round((C - X) * 100) / 100;
  const quotaIniziale = K / Number(pianoDb?.N ?? piano.N);
  const richiesta = n > 0 ? k / n : 1;

  let stato = "in corso";
  if (k <= 0) stato = "obiettivo raggiunto";
  else if (V(n, k) <= 0) stato = "fallito";

  // avvisi
  let avviso = { livello: "ok", testo: "" };
  if (stato === "in corso" && perdita >= piano.perditaMax) {
    avviso = { livello: "rosso", testo: `Perdita di ${perdita.toFixed(2)} €: raggiunto il limite di ${piano.perditaMax} €. Nuove bet ferme, decidi tu.` };
  } else if (stato === "in corso" && richiesta > quotaIniziale + piano.sogliaAllungo) {
    let extra = 0;
    while (k / (n + extra) > quotaIniziale && N + extra < piano.maxEventi) extra++;
    avviso = extra > 0
      ? { livello: "giallo", extraProposti: extra, testo: `Servono ${k} vincite su ${n} eventi (${(richiesta * 100).toFixed(1)}%). Propongo di allungare il piano di ${extra} eventi: puntate più basse, obiettivo più basso.` }
      : { livello: "giallo", extraProposti: 0, testo: `Servono ${k} vincite su ${n} eventi e il piano è già alla lunghezza massima.` };
  }

  return {
    capitale: X, capitaleIniziale: C, perdita, vinte, perse, nulle, inAttesa, impegnato,
    eventiTotali: N, eventiRimasti: n, vinciteMancanti: k, richiesta,
    obiettivo: stato === "in corso" ? Math.round((X / V(n, k)) * 100) / 100 : X,
    stato, avviso, V,
  };
}

// ─── 3. Puntate delle nuove partite (gruppo contemporaneo) ───────────
// Prudenza: le partite ancora in attesa si considerano perse, così le
// nuove puntate non superano mai quelle del percorso peggiore.
export function puntateNuove(stato, candidati) {
  const m = (candidati || []).length;
  if (!m || stato.stato !== "in corso" || stato.avviso.livello === "rosso") return [];
  const X = stato.capitale - stato.impegnato;
  const n = stato.eventiRimasti - stato.inAttesa;
  const k = stato.vinciteMancanti;
  const V = stato.V;
  const mm = Math.min(m, Math.max(0, n));
  if (mm <= 0 || X <= 0) return [];
  const v0 = V(n, k);
  if (v0 <= 0) return [];
  const usati = candidati.slice(0, mm);
  const S = Math.max(0, X * (1 - V(n - mm, k) / v0));
  // a vincita uguale sulle quote minime (la quota reale sarà almeno questa)
  const P = S / usati.reduce((a, c) => a + 1 / c.quotaMinima, 0);
  let puntate = usati.map((c) => Math.max(0, Math.round(P / c.quotaMinima)));
  let tot = puntate.reduce((a, b) => a + b, 0);
  while (tot > Math.floor(X) && tot > 0) { const j = puntate.indexOf(Math.max(...puntate)); puntate[j]--; tot--; }
  return usati.map((c, j) => ({ ...c, puntata: puntate[j] })).filter((c) => c.puntata > 0);
}

// ─── 4. Divisione di una puntata tra i conti ─────────────────────────
// conti = [{ book_id, nome, intestatario, tipo: 'bonus'|'sport' }]
// usoSettimana = Map(book_id -> € già giocati questa settimana dal piano)
// ultimaBet = Map(book_id -> data ISO dell'ultima bet del piano)
function hash(t) { let h = 2166136261; for (const ch of String(t)) { h ^= ch.charCodeAt(0); h = Math.imul(h, 16777619); } return Math.abs(h); }

export function dividiTraConti(puntata, candidato, conti, usoSettimana = new Map(), ultimaBet = new Map(), opz = {}) {
  const tetto = opz.tettoSettimana ?? 25;
  const maxStessoBook = opz.maxStessoBook ?? 2;
  const giaUsati = opz.giaUsati || new Set(); // book_id già impegnati su questa partita
  const ordinati = [...(conti || [])]
    .filter((c) => !giaUsati.has(String(c.book_id)))
    .sort((a, b) =>
      (usoSettimana.get(String(a.book_id)) || 0) - (usoSettimana.get(String(b.book_id)) || 0) ||
      String(ultimaBet.get(String(a.book_id)) || "").localeCompare(String(ultimaBet.get(String(b.book_id)) || "")) ||
      hash(`${candidato.event_id}|${a.book_id}`) - hash(`${candidato.event_id}|${b.book_id}`));

  const pezzi = [];
  const perBook = new Map();
  let resto = Math.round(puntata);
  for (const c of ordinati) {
    if (resto <= 0) break;
    const nomeBook = String(c.nome || "").toLowerCase();
    if ((perBook.get(nomeBook) || 0) >= maxStessoBook) continue;
    const libero = tetto - (usoSettimana.get(String(c.book_id)) || 0);
    let importo;
    if (c.tipo === "sport") importo = 2;
    else importo = 3 + (hash(`${candidato.event_id}|${c.book_id}|imp`) % 6); // 3-8 €, vario
    importo = Math.min(importo, resto, libero);
    if (importo < 2) continue;
    if (c.tipo === "sport" && resto - importo === 1) continue; // lascia il 3 a un conto bonus
    // non lasciare un resto di 1 € che nessuno può giocare
    if (c.tipo !== "sport" && resto - importo === 1) {
      if (importo + 1 <= libero) importo += 1;
      else if (importo > 2) importo -= 1;
    }
    pezzi.push({ book_id: c.book_id, nome: c.nome, intestatario: c.intestatario, tipo: c.tipo, importo });
    perBook.set(nomeBook, (perBook.get(nomeBook) || 0) + 1);
    resto -= importo;
  }
  return { pezzi, nonCollocato: Math.max(0, resto) };
}

// ─── 5. La scheda del giorno ─────────────────────────────────────────
export function schedaDelGiorno({ pianoDb, eventi, righeSnapshot, conti, usoSettimana, ultimaBet, giaInPiano = new Set(), piano = PIANO_PILOTA }) {
  const stato = statoPiano(pianoDb, eventi, piano);
  const candidati = scegliEsiti(righeSnapshot, piano)
    .filter((c) => !giaInPiano.has(c.event_id))
    .sort((a, b) => b.prob - a.prob)
    .slice(0, piano.maxPartiteGiorno)
    .sort((a, b) => String(a.event_start).localeCompare(String(b.event_start)));
  const puntate = puntateNuove(stato, candidati);
  const uso = new Map(usoSettimana || []);
  const bets = [];
  for (const p of puntate) {
    const { pezzi, nonCollocato } = dividiTraConti(p.puntata, p, conti, uso, ultimaBet);
    for (const z of pezzi) uso.set(String(z.book_id), (uso.get(String(z.book_id)) || 0) + z.importo);
    bets.push({ ...p, pezzi, nonCollocato });
  }
  const { V, ...statoPulito } = stato;
  return { stato: statoPulito, bets };
}
