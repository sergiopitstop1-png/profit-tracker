// =====================================================================
// PronoX · Modello calcio condiviso
// Unica fonte del modello: la usano sia la pagina /oggi sia la cron
// delle fotografie. Se modifichi il modello, lo modifichi solo qui.
// =====================================================================

export const MODEL_NAME = "dixon_coles";
export const MODEL_VERSION = "dc_v2"; // aumentala a ogni modifica del modello

const DEFAULT_API_FD = "/api/footballdata";
const DEFAULT_API_ODDS = "/api/odds";

async function defaultFetchSeasonMatches(code, season) {
  const r = await fetch(`${DEFAULT_API_FD}?endpoint=competitions/${code}/matches&season=${season}`);
  const d = await r.json();
  return d.matches || [];
}

// Solo le 12 competizioni coperte dal piano FREE di football-data.org.
// Le altre (Nordiche, MLS, J-League, Copa Libertadores) richiederebbero
// il piano Pro (144 competizioni, 249€/mese) o una fonte dati alternativa
// (es. API-Football su RapidAPI, ~19$/mese) — da valutare in futuro.
export const LEAGUES = [
  { code: "SA", name: "Serie A", flag: "🇮🇹", oddsKey: "soccer_italy_serie_a" },
  { code: "PL", name: "Premier League", flag: "🏴󠁧󠁢󠁥󠁮󠁧󠁿", oddsKey: "soccer_epl" },
  { code: "BL1", name: "Bundesliga", flag: "🇩🇪", oddsKey: "soccer_germany_bundesliga" },
  { code: "PD", name: "La Liga", flag: "🇪🇸", oddsKey: "soccer_spain_la_liga" },
  { code: "FL1", name: "Ligue 1", flag: "🇫🇷", oddsKey: "soccer_france_ligue_one" },
  { code: "CL", name: "Champions League", flag: "⭐", oddsKey: "soccer_uefa_champs_league" },
  { code: "ELC", name: "Championship", flag: "🏴󠁧󠁢󠁥󠁮󠁧󠁿", oddsKey: "soccer_efl_champ" },
  { code: "DED", name: "Eredivisie", flag: "🇳🇱", oddsKey: "soccer_netherlands_eredivisie" },
  { code: "PPL", name: "Primeira Liga", flag: "🇵🇹", oddsKey: null },
  { code: "BSA", name: "Serie B Brasile", flag: "🇧🇷", oddsKey: "soccer_brazil_campeonato" },
  { code: "EC", name: "European Championship", flag: "🇪🇺", oddsKey: null },
  { code: "WC", name: "FIFA World Cup", flag: "🌍", oddsKey: "soccer_fifa_world_cup" },
];

export const DOMESTIC_LEAGUES = ["SA", "PL", "BL1", "PD", "FL1", "ELC", "DED", "PPL"];
export const CUP_LEAGUES = ["CL", "EC", "WC"];

// ─── MODELLO ───────────────────────────────────────────────────

export function poisson(k, lambda) {
  let p = Math.exp(-lambda);
  for (let i = 1; i <= k; i++) p *= lambda / i;
  return p;
}

export function dixonColesCorr(i, j, lH, lA, rho = -0.13) {
  if (i === 0 && j === 0) return 1 - lH * lA * rho;
  if (i === 0 && j === 1) return 1 + lH * rho;
  if (i === 1 && j === 0) return 1 + lA * rho;
  if (i === 1 && j === 1) return 1 - rho;
  return 1;
}

export function calcProbs(lH, lA, max = 8) {
  let h = 0, d = 0, a = 0, o25 = 0, btts = 0, mass = 0;
  for (let i = 0; i <= max; i++) {
    for (let j = 0; j <= max; j++) {
      const corr = dixonColesCorr(i, j, lH, lA);
      const p = poisson(i, lH) * poisson(j, lA) * corr;
      mass += p;
      if (i > j) h += p;
      else if (i === j) d += p;
      else a += p;
      if (i + j > 2.5) o25 += p;
      if (i > 0 && j > 0) btts += p;
    }
  }
  // V2: normalizziamo TUTTI i mercati sulla massa effettivamente calcolata.
  // Prima 1X2 veniva normalizzato, mentre Over/Under e BTTS no: con Dixon-Coles
  // e la griglia troncata questo poteva gonfiare soprattutto gli UNDER estremi.
  const tot = mass > 0 ? mass : (h + d + a || 1);
  const o25n = o25 / tot;
  const bttsn = btts / tot;
  const o05ht = Math.min(0.18 + (lH + lA) * 0.14, 0.96);
  return { h: h/tot, d: d/tot, a: a/tot, o25: o25n, u25: 1 - o25n, btts: bttsn, o05ht };
}

// ─── PRONOX CALCIO V2: confidence prudenziale ───────────────────
// I prior sotto derivano dallo storico verificato corrente di PronoX.
// Non sostituiscono il modello: servono a impedire che una probabilità Poisson
// estrema venga mostrata come certezza quando quel mercato non l'ha dimostrata.
export const FOOTBALL_MARKET_PRIORS = {
  "CASA VINCE":   { hit: 15/23, n: 23 },
  "OSPITE VINCE": { hit:  8/14, n: 14 },
  "OVER 2.5":     { hit:  9/16, n: 16 },
  "UNDER 2.5":    { hit: 24/47, n: 47 },
  "BTTS SÌ":      { hit:  6/9,  n:  9 },
};

export function devigTwoWay(oddsFor, oddsAgainst) {
  if (!oddsFor || !oddsAgainst || oddsFor <= 1 || oddsAgainst <= 1) return null;
  const a = 1 / oddsFor, b = 1 / oddsAgainst;
  return a / (a + b);
}

export function calibrateFootballProbability(label, rawProb, oddsData) {
  const prior = FOOTBALL_MARKET_PRIORS[label];
  if (!prior) return Math.min(0.90, Math.max(0.10, rawProb));

  // Più storico abbiamo su un mercato, più chiediamo al modello di rispettare
  // ciò che è successo davvero. Il peso resta volutamente conservativo.
  const historyWeight = Math.min(0.55, 0.20 + prior.n / 120);
  let calibrated = rawProb * (1 - historyWeight) + prior.hit * historyWeight;

  // Se abbiamo entrambe le quote del mercato, usiamo la probabilità bookmaker
  // senza margine come ulteriore ancora. Il mercato NON decide il pronostico:
  // riduce soltanto l'eccesso di sicurezza del modello.
  let marketProb = null;
  if (label === "UNDER 2.5") marketProb = devigTwoWay(oddsData?.oUnder25, oddsData?.oOver25);
  if (label === "OVER 2.5")  marketProb = devigTwoWay(oddsData?.oOver25, oddsData?.oUnder25);
  if (marketProb !== null) calibrated = calibrated * 0.75 + marketProb * 0.25;

  // Niente 97-99% finché lo storico non giustifica livelli simili.
  return Math.min(0.90, Math.max(0.10, calibrated));
}

export function timeWeight(matchDate, refDate) {
  const days = (new Date(refDate) - new Date(matchDate)) / (1000 * 60 * 60 * 24);
  return Math.exp(-days / 90);
}

export function calcRatings(matches, refDate) {
  const teams = {};
  const today = refDate || new Date().toISOString().split("T")[0];
  const finished = matches.filter(m =>
    m.status === "FINISHED" &&
    m.score?.fullTime?.home !== null &&
    m.score?.fullTime?.away !== null &&
    m.score?.fullTime?.home >= 0 &&
    m.score?.fullTime?.away >= 0
  );
  if (finished.length === 0) return { teams, lgAvgHome: 1.35, lgAvgAway: 1.1 };
  let totWHome = 0, totWAway = 0, sumWHome = 0, sumWAway = 0;
  finished.forEach(m => {
    const hId = m.homeTeam.id;
    const aId = m.awayTeam.id;
    const hG = m.score.fullTime.home;
    const aG = m.score.fullTime.away;
    const w = timeWeight(m.utcDate?.split("T")[0] || today, today);
    if (!teams[hId]) teams[hId] = { name: m.homeTeam.name, crest: m.homeTeam.crest, hGF: 0, hGA: 0, hW: 0, aGF: 0, aGA: 0, aW: 0, form: [], lastMatches: [] };
    if (!teams[aId]) teams[aId] = { name: m.awayTeam.name, crest: m.awayTeam.crest, hGF: 0, hGA: 0, hW: 0, aGF: 0, aGA: 0, aW: 0, form: [], lastMatches: [] };
    teams[hId].hGF += hG * w; teams[hId].hGA += aG * w; teams[hId].hW += w;
    teams[aId].aGF += aG * w; teams[aId].aGA += hG * w; teams[aId].aW += w;
    const hRes = hG > aG ? "W" : hG === aG ? "D" : "L";
    const aRes = aG > hG ? "W" : aG === hG ? "D" : "L";
    teams[hId].form.push({ res: hRes, w, date: m.utcDate });
    teams[aId].form.push({ res: aRes, w, date: m.utcDate });
    teams[hId].lastMatches.push({ gf: hG, ga: aG, home: true, date: m.utcDate });
    teams[aId].lastMatches.push({ gf: aG, ga: hG, home: false, date: m.utcDate });
    sumWHome += hG * w; totWHome += w;
    sumWAway += aG * w; totWAway += w;
  });
  const lgAvgHome = totWHome > 0 ? sumWHome / totWHome : 1.35;
  const lgAvgAway = totWAway > 0 ? sumWAway / totWAway : 1.1;
  Object.values(teams).forEach(t => {
    t.attH = t.hW > 0 ? (t.hGF / t.hW) / lgAvgHome : 1;
    t.defH = t.hW > 0 ? (t.hGA / t.hW) / lgAvgAway : 1;
    t.attA = t.aW > 0 ? (t.aGF / t.aW) / lgAvgAway : 1;
    t.defA = t.aW > 0 ? (t.aGA / t.aW) / lgAvgHome : 1;
    t.form.sort((a, b) => new Date(b.date) - new Date(a.date));
    const last5 = t.form.slice(0, 5);
    const formScore = last5.reduce((s, f) => s + (f.res === "W" ? 3 : f.res === "D" ? 1 : 0), 0);
    t.formRating = last5.length > 0 ? formScore / (last5.length * 3) : 0.5;
    t.formStr = last5.map(f => f.res).join("");
    const hAvg = t.hW > 0 ? t.hGF / t.hW : lgAvgHome;
    const aAvg = t.aW > 0 ? t.aGF / t.aW : lgAvgAway;
    t.homeAdvantage = hAvg > 0 && aAvg > 0 ? hAvg / aAvg : 1.1;
    t.avgHomeGoals = t.hW > 0 ? (t.hGF / t.hW).toFixed(2) : "N/D";
    t.avgHomeConceded = t.hW > 0 ? (t.hGA / t.hW).toFixed(2) : "N/D";
    t.avgAwayGoals = t.aW > 0 ? (t.aGF / t.aW).toFixed(2) : "N/D";
    t.avgAwayConceded = t.aW > 0 ? (t.aGA / t.aW).toFixed(2) : "N/D";
  });
  return { teams, lgAvgHome, lgAvgAway };
}

export function calcH2H(allMatches, teamHId, teamAId) {
  const h2h = allMatches.filter(m =>
    m.status === "FINISHED" && (
      (m.homeTeam.id === teamHId && m.awayTeam.id === teamAId) ||
      (m.homeTeam.id === teamAId && m.awayTeam.id === teamHId)
    )
  ).slice(-6);
  if (h2h.length === 0) return { bias: 0, count: 0 };
  let hWins = 0, aWins = 0;
  h2h.forEach(m => {
    const hG = m.score.fullTime.home;
    const aG = m.score.fullTime.away;
    if (m.homeTeam.id === teamHId) {
      if (hG > aG) hWins++;
      else if (aG > hG) aWins++;
    } else {
      if (aG > hG) hWins++;
      else if (hG > aG) aWins++;
    }
  });
  const bias = (hWins - aWins) / h2h.length * 0.08;
  return { bias, count: h2h.length, hWins, aWins };
}

export function getLambdas(teamH, teamA, lgAvgHome, lgAvgAway, h2hBias) {
  let lH = teamH.attH * teamA.defA * lgAvgHome;
  let lA = teamA.attA * teamH.defH * lgAvgAway;
  const homeAdv = Math.min(Math.max(teamH.homeAdvantage, 0.8), 1.4);
  lH *= homeAdv;
  const formFactorH = 0.85 + (teamH.formRating * 0.30);
  const formFactorA = 0.85 + (teamA.formRating * 0.30);
  lH *= formFactorH;
  lA *= formFactorA;
  lH *= (1 + h2hBias);
  lA *= (1 - h2hBias);
  lH = Math.max(0.3, Math.min(3.0, lH));
  lA = Math.max(0.3, Math.min(3.0, lA));
  return { lH, lA };
}

export function getSignals(probs) {
  const signals = [];
  if (probs.h > 0.62) signals.push({ label: "CASA VINCE", type: "1X2", prob: probs.h, color: "#c8f135", strong: probs.h > 0.72, fairOdds: 1 / probs.h });
  if (probs.a > 0.55) signals.push({ label: "OSPITE VINCE", type: "1X2", prob: probs.a, color: "#c8f135", strong: probs.a > 0.65, fairOdds: 1 / probs.a });
  if (probs.o25 > 0.65) signals.push({ label: "OVER 2.5", type: "OVER", prob: probs.o25, color: "#4af0c4", strong: probs.o25 > 0.72, fairOdds: 1 / probs.o25 });
  if (probs.btts > 0.60) signals.push({ label: "BTTS SÌ", type: "BTTS", prob: probs.btts, color: "#4af0c4", strong: probs.btts > 0.68, fairOdds: 1 / probs.btts });
  if (probs.u25 > 0.65) signals.push({ label: "UNDER 2.5", type: "UNDER", prob: probs.u25, color: "#ffd060", strong: probs.u25 > 0.75, fairOdds: 1 / probs.u25 });
  if (probs.o05ht > 0.90) signals.push({ label: "OVER 0.5 HT", type: "OVER", prob: probs.o05ht, color: "#ffd060", strong: true, fairOdds: 1 / probs.o05ht });
  signals.sort((a, b) => b.prob - a.prob);
  return signals;
}

// ─── ODDS API: mappa lega → oddsKey e matcha per nome squadra ──

export async function fetchOddsForLeague(oddsKey, date, apiOdds = DEFAULT_API_ODDS) {
  if (!oddsKey) return {};
  try {
    const r = await fetch(`${apiOdds}?endpoint=sports/${oddsKey}/odds&regions=eu&markets=h2h,totals&dateFormat=iso&oddsFormat=decimal`);
    const data = await r.json();
    if (!Array.isArray(data)) return {};
    // Filtra per data
    const dayStart = new Date(date + "T00:00:00Z").getTime();
    const dayEnd = new Date(date + "T23:59:59Z").getTime();
    const oddsMap = {};
    data.forEach(game => {
      const gameTime = new Date(game.commence_time).getTime();
      if (gameTime < dayStart || gameTime > dayEnd) return;
      const key = `${game.home_team}__${game.away_team}`;
      // Estrai quote medie h2h e totals
      let o1 = null, oX = null, o2 = null, oOver25 = null, oUnder25 = null;
      game.bookmakers?.forEach(bk => {
        bk.markets?.forEach(mkt => {
          if (mkt.key === "h2h") {
            mkt.outcomes?.forEach(o => {
              if (o.name === game.home_team) o1 = o1 ? (o1 + o.price) / 2 : o.price;
              else if (o.name === game.away_team) o2 = o2 ? (o2 + o.price) / 2 : o.price;
              else oX = oX ? (oX + o.price) / 2 : o.price;
            });
          }
          if (mkt.key === "totals") {
            mkt.outcomes?.forEach(o => {
              if (o.name === "Over" && Math.abs(o.point - 2.5) < 0.01) oOver25 = oOver25 ? (oOver25 + o.price) / 2 : o.price;
              if (o.name === "Under" && Math.abs(o.point - 2.5) < 0.01) oUnder25 = oUnder25 ? (oUnder25 + o.price) / 2 : o.price;
            });
          }
        });
      });
      oddsMap[key] = { o1, oX, o2, oOver25, oUnder25,
        homeTeam: game.home_team, awayTeam: game.away_team };
    });
    return oddsMap;
  } catch (e) { return {}; }
}

// Parole da rimuovere per normalizzare i nomi delle squadre
export const STOP_WORDS = ["fc", "cf", "sc", "ac", "bc", "bk", "fk", "sk", "if", "ik",
  "club", "united", "city", "town", "athletic", "athletics", "sport", "sports",
  "deportivo", "deportiva", "atletico", "atletica", "real", "racing", "river",
  "plate", "union", "the", "de", "do", "da", "del", "di", "los", "las", "le",
  "la", "el", "al", "1", "2", "afc", "rsc", "vfb", "vfl", "tsg", "rb", "rd"];

export function normalizeName(name) {
  return name.toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")  // rimuove caratteri speciali
    .split(/\s+/)
    .filter(w => w.length > 1 && !STOP_WORDS.includes(w))
    .join(" ")
    .trim();
}

export function nameSimilarity(a, b) {
  const wa = new Set(normalizeName(a).split(" ").filter(w => w.length > 2));
  const wb = new Set(normalizeName(b).split(" ").filter(w => w.length > 2));
  if (wa.size === 0 || wb.size === 0) return 0;
  let common = 0;
  wa.forEach(w => { if (wb.has(w)) common++; });
  // Controlla anche match parziale (es. "liverpool" dentro "liverpool fc")
  wa.forEach(w => { wb.forEach(wb2 => { if (w.length > 4 && (w.includes(wb2) || wb2.includes(w))) common += 0.5; }); });
  return common / Math.max(wa.size, wb.size);
}

// ─── LETTORE NEWS: penalità sul lambda in base a infortuni/squalifiche ──
// Quanto riduciamo il lambda (gol attesi) di una squadra in base alla
// gravità e affidabilità dell'evento trovato dal lettore news (Haiku).
// 1.0 = nessuna penalità, 0.82 = -18% sui gol attesi, ecc.
export const NEWS_PENALTY_TABLE = {
  titolare_chiave: { confermato: 0.82, rumor: 0.94 },
  rotazione: { confermato: 0.95, rumor: 0.98 },
  riserva: { confermato: 1.0, rumor: 1.0 },
};

// Soglia minima di similarità nome per considerare un evento news
// riferito davvero a quella squadra (evita falsi positivi tipo
// "Real Madrid" che matcha "Real Sociedad").
export const NEWS_MATCH_THRESHOLD = 0.5;

export function getTeamNewsImpact(teamName, newsSignals) {
  const matchedEvents = [];

  for (const ev of newsSignals) {
    if (ev.sport !== "calcio" || !ev.squadra_o_torneo) continue;
    if (ev.tipo === "ritiro" || ev.tipo === "forfait") continue; // eventi tennis

    const sim = nameSimilarity(teamName, ev.squadra_o_torneo);
    if (sim < NEWS_MATCH_THRESHOLD) continue;

    matchedEvents.push(ev);
  }

  if (matchedEvents.length === 0) return { multiplier: 1.0, events: [] };

  // Usiamo SOLO l'evento più recente, non il "peggiore" - una formazione
  // ufficiale di oggi che conferma il rientro di un giocatore deve prevalere
  // su un vecchio articolo di infortunio di 2 giorni fa, non sommarsi o
  // essere ignorata a favore del peggiore dei due.
  const mostRecent = [...matchedEvents].sort(
    (a, b) => new Date(b.processato_at) - new Date(a.processato_at)
  )[0];
  const multiplier = NEWS_PENALTY_TABLE[mostRecent.gravita]?.[mostRecent.affidabilita] ?? 1.0;

  return { multiplier, events: matchedEvents, appliedEvent: mostRecent };
}

export function matchOdds(oddsMap, homeName, awayName) {
  // 1. Match esatto
  const exactKey = `${homeName}__${awayName}`;
  if (oddsMap[exactKey]) return oddsMap[exactKey];

  // 2. Cerca il miglior match per similarità
  let bestScore = 0;
  let bestMatch = null;

  for (const [, v] of Object.entries(oddsMap)) {
    const simH = nameSimilarity(homeName, v.homeTeam || "");
    const simA = nameSimilarity(awayName, v.awayTeam || "");
    const score = simH + simA;
    // Entrambe le squadre devono matchare almeno un po'
    if (simH > 0.3 && simA > 0.3 && score > bestScore) {
      bestScore = score;
      bestMatch = v;
    }
  }

  // 3. Se non trova con ordine normale, prova invertito (alcuni API invertono home/away)
  if (!bestMatch) {
    for (const [, v] of Object.entries(oddsMap)) {
      const simH = nameSimilarity(homeName, v.awayTeam || "");
      const simA = nameSimilarity(awayName, v.homeTeam || "");
      const score = simH + simA;
      if (simH > 0.3 && simA > 0.3 && score > bestScore) {
        bestScore = score;
        // Inverte le quote home/away
        bestMatch = { ...v, o1: v.o2, o2: v.o1, homeTeam: v.awayTeam, awayTeam: v.homeTeam };
      }
    }
  }

  return bestMatch;
}

export function calcEV(prob, bookOdds) {
  if (!bookOdds || bookOdds <= 1) return null;
  return prob * (bookOdds - 1) - (1 - prob);
}

export function currentSeasonFor(code) {
  const now = new Date();
  const year = now.getFullYear();
  const month = now.getMonth() + 1; // 1-12

  // Leghe che seguono l'anno solare (non agosto-maggio)
  const CALENDAR_YEAR_LEAGUES = ["BSA"];

  if (CALENDAR_YEAR_LEAGUES.includes(code)) {
    return String(year);
  }

  // Leghe agosto-maggio (SA, PL, BL1, PD, FL1, CL, ELC, DED, PPL):
  // season = anno di inizio stagione. Es: gen-giu 2026 -> stagione 2025 (2025/26).
  // lug-dic 2026 -> stagione 2026 (2026/27, anche in preseason/prime giornate).
  return String(month >= 7 ? year : year - 1);
}

export async function getSeasonData(code, supabaseClient, seasonOverride, fetchSeasonMatches = defaultFetchSeasonMatches) {
  const today = new Date().toISOString().split("T")[0];
  const season = seasonOverride || currentSeasonFor(code);
  try {
    const { data: cached } = await supabaseClient
      .from("pronox_cache")
      .select("data, updated_at")
      .eq("league_code", code)
      .eq("season", season)
      .single();
    if (cached) {
      const cacheDate = cached.updated_at?.split("T")[0];
      if (cacheDate === today) return cached.data;
    }
  } catch (e) {}
  let matches = [];
  for (let attempt = 0; attempt < 4; attempt++) {
    try {
      matches = await fetchSeasonMatches(code, season);
    } catch (e) { matches = []; }
    if (matches.length > 0) break;
    if (attempt < 3) await new Promise(r => setTimeout(r, 2000));
  }
  if (matches.length > 0) {
    try {
      await supabaseClient.from("pronox_cache").upsert({
        league_code: code, season, data: matches,
        updated_at: new Date().toISOString(),
      }, { onConflict: "league_code,season" });
    } catch (e) {}
  }
  return matches;
}


// ─── ANALISI DI UNA PARTITA (stessa logica della pagina /oggi) ───────

export function findTeamRating(allRatings, teamId, teamName, primaryCode) {
  if (allRatings[primaryCode]?.[teamId]) return { rating: allRatings[primaryCode][teamId], leagueCode: primaryCode };
  for (const code of DOMESTIC_LEAGUES) {
    if (!allRatings[code]) continue;
    if (allRatings[code][teamId]) return { rating: allRatings[code][teamId], leagueCode: code };
    const found = Object.entries(allRatings[code]).find(([, t]) =>
      t.name.toLowerCase().includes(teamName.toLowerCase().split(" ")[0]) ||
      teamName.toLowerCase().includes(t.name.toLowerCase().split(" ")[0])
    );
    if (found) return { rating: found[1], leagueCode: code };
  }
  return null;
}

export function getLeagueAverages(code, allAvgs) {
  if (CUP_LEAGUES.includes(code)) {
    const avgs = DOMESTIC_LEAGUES.filter(c => allAvgs[c]);
    return {
      lgAvgHome: avgs.reduce((s, c) => s + allAvgs[c].lgAvgHome, 0) / (avgs.length || 1),
      lgAvgAway: avgs.reduce((s, c) => s + allAvgs[c].lgAvgAway, 0) / (avgs.length || 1),
    };
  }
  return {
    lgAvgHome: allAvgs[code]?.lgAvgHome || 1.35,
    lgAvgAway: allAvgs[code]?.lgAvgAway || 1.1,
  };
}

export function computeFixtureModel({ fix, code, allRatings, allAvgs, seasonMatchesForH2H, recentNews }) {
  const { lgAvgHome, lgAvgAway } = getLeagueAverages(code, allAvgs);
  const hId = fix.homeTeam.id;
  const aId = fix.awayTeam.id;
  const resH = findTeamRating(allRatings, hId, fix.homeTeam.name, code);
  const resA = findTeamRating(allRatings, aId, fix.awayTeam.name, code);

  const h2h = calcH2H(seasonMatchesForH2H || [], hId, aId);
  let lH = lgAvgHome;
  let lA = lgAvgAway;
  let hasRatings = false;

  if (resH && resA) {
    const lambdas = getLambdas(resH.rating, resA.rating, lgAvgHome, lgAvgAway, h2h.bias);
    lH = lambdas.lH;
    lA = lambdas.lA;
    hasRatings = true;
  }
  const lHBase = lH, lABase = lA; // lambda prima delle news: utile per il modello futuro

  // Penalità da infortuni/squalifiche/formazioni rilevate dal lettore news
  const newsImpactH = getTeamNewsImpact(fix.homeTeam.name, recentNews || []);
  const newsImpactA = getTeamNewsImpact(fix.awayTeam.name, recentNews || []);
  lH *= newsImpactH.multiplier;
  lA *= newsImpactA.multiplier;
  lH = Math.max(0.3, Math.min(3.0, lH));
  lA = Math.max(0.3, Math.min(3.0, lA));

  const probs = calcProbs(lH, lA);
  return {
    lH, lA, lHBase, lABase, probs, h2h, hasRatings, resH, resA,
    lgAvgHome, lgAvgAway, newsImpactH, newsImpactA,
  };
}

// =====================================================================
// 30/09/2026 — CATALOGO MERCATI (griglia dei risultati esatti)
// Stessa griglia e stessa normalizzazione di calcProbs: da qui si
// ricava qualsiasi esito che dipende solo dai gol di casa (i) e
// ospite (j). Le combo sono calcolate sulla griglia (probabilità
// congiunta), MAI moltiplicando le probabilità dei singoli esiti.
// calcProbs resta invariata: /oggi e la cron attuale non cambiano.
// =====================================================================

export const MARKETS_VERSION = "mk_v1"; // aumentala se cambi il catalogo

export function scoreGrid(lH, lA, max = 8) {
  const grid = [];
  let mass = 0;
  for (let i = 0; i <= max; i++) {
    grid.push([]);
    for (let j = 0; j <= max; j++) {
      const p = poisson(i, lH) * poisson(j, lA) * dixonColesCorr(i, j, lH, lA);
      grid[i].push(p);
      mass += p;
    }
  }
  const tot = mass > 0 ? mass : 1;
  for (let i = 0; i <= max; i++) for (let j = 0; j <= max; j++) grid[i][j] /= tot;
  return grid;
}

// ─── regole di base: i = gol casa, j = gol ospite ───
const ESITI = {
  "1": (i, j) => i > j,
  "X": (i, j) => i === j,
  "2": (i, j) => i < j,
  "1X": (i, j) => i >= j,
  "X2": (i, j) => i <= j,
  "12": (i, j) => i !== j,
};
const tot = (i, j) => i + j;
const over = (l) => (i, j) => tot(i, j) > l;
const under = (l) => (i, j) => tot(i, j) < l;
const multigol = (a, b) => (i, j) => tot(i, j) >= a && tot(i, j) <= b;
const GG = (i, j) => i > 0 && j > 0;
const NG = (i, j) => !(i > 0 && j > 0);

function build() {
  const out = [];
  const add = (market, selection, label, test) => out.push({ id: `${market}|${selection}`, market, selection, label, test });

  // 1X2 e doppia chance
  add("1X2", "1", "1 (casa vince)", ESITI["1"]);
  add("1X2", "X", "X (pareggio)", ESITI["X"]);
  add("1X2", "2", "2 (ospite vince)", ESITI["2"]);
  add("DC", "1X", "Doppia chance 1X", ESITI["1X"]);
  add("DC", "X2", "Doppia chance X2", ESITI["X2"]);
  add("DC", "12", "Doppia chance 12", ESITI["12"]);

  // Over / Under
  for (const l of [0.5, 1.5, 2.5, 3.5, 4.5]) {
    add(`OU${l}`, "over", `Over ${String(l).replace(".", ",")}`, over(l));
    add(`OU${l}`, "under", `Under ${String(l).replace(".", ",")}`, under(l));
  }

  // Goal / No goal
  add("BTTS", "si", "Goal (entrambe segnano)", GG);
  add("BTTS", "no", "No goal", NG);

  // Multigol (gol totali)
  for (const [a, b] of [[1, 2], [1, 3], [1, 4], [1, 5], [2, 3], [2, 4], [2, 5], [2, 6], [3, 4], [3, 5], [3, 6], [4, 6]]) {
    add("MG", `${a}-${b}`, `Multigol ${a}-${b}`, multigol(a, b));
  }

  // Gol della singola squadra
  add("SEGNA_CASA", "si", "Casa segna", (i) => i > 0);
  add("SEGNA_CASA", "no", "Casa non segna", (i) => i === 0);
  add("SEGNA_OSPITE", "si", "Ospite segna", (i, j) => j > 0);
  add("SEGNA_OSPITE", "no", "Ospite non segna", (i, j) => j === 0);
  for (const [a, b] of [[1, 2], [1, 3], [2, 3]]) {
    add("MG_CASA", `${a}-${b}`, `Multigol casa ${a}-${b}`, (i) => i >= a && i <= b);
    add("MG_OSPITE", `${a}-${b}`, `Multigol ospite ${a}-${b}`, (i, j) => j >= a && j <= b);
  }

  // Combo: esito finale + gol
  const SECONDI = [
    ["O1.5", "over 1,5", over(1.5)],
    ["O2.5", "over 2,5", over(2.5)],
    ["U2.5", "under 2,5", under(2.5)],
    ["U3.5", "under 3,5", under(3.5)],
    ["GG", "goal", GG],
    ["NG", "no goal", NG],
  ];
  for (const e of ["1", "X", "2", "1X", "X2", "12"]) {
    for (const [k, lab, t2] of SECONDI) {
      add("COMBO", `${e}+${k}`, `${e} + ${lab}`, (i, j) => ESITI[e](i, j) && t2(i, j));
    }
  }
  for (const e of ["1X", "X2"]) {
    for (const [a, b] of [[1, 3], [2, 4]]) {
      add("COMBO", `${e}+MG${a}-${b}`, `${e} + multigol ${a}-${b}`, (i, j) => ESITI[e](i, j) && multigol(a, b)(i, j));
    }
  }
  return out;
}

export const FOOTBALL_MARKETS = build();

// Quota minima accettabile: la quota del book deve dare almeno
// questo valore atteso (default +3%) rispetto alla probabilità stimata.
export function minOddsFor(prob, minEV = 0.03) {
  return prob > 0 ? (1 + minEV) / prob : null;
}

// Tutti gli esiti del catalogo per una partita
export function calcMarkets(lH, lA, { minEV = 0.03, max = 8 } = {}) {
  const grid = scoreGrid(lH, lA, max);
  return FOOTBALL_MARKETS.map((m) => {
    let p = 0;
    for (let i = 0; i <= max; i++) for (let j = 0; j <= max; j++) if (m.test(i, j)) p += grid[i][j];
    return {
      id: m.id,
      market: m.market,
      selection: m.selection,
      label: m.label,
      prob: p,
      fairOdds: p > 0 ? 1 / p : null,
      minOdds: minOddsFor(p, minEV),
    };
  });
}

// Esiti con quota giusta dentro una fascia (es. 1,40-1,60 per il recupero)
export function marketsInOddsRange(markets, lo, hi) {
  return (markets || [])
    .filter((m) => m.fairOdds && m.fairOdds >= lo && m.fairOdds <= hi)
    .sort((a, b) => b.prob - a.prob);
}
