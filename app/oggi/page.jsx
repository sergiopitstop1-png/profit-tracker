"use client";
import { useState, useEffect } from "react";
import { createClient } from "@supabase/supabase-js";

const API_FD = "/api/footballdata";
const API_ODDS = "/api/odds";
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
);

// Solo le 12 competizioni coperte dal piano FREE di football-data.org.
// Le altre (Nordiche, MLS, J-League, Copa Libertadores) richiederebbero
// il piano Pro (144 competizioni, 249€/mese) o una fonte dati alternativa
// (es. API-Football su RapidAPI, ~19$/mese) — da valutare in futuro.
const LEAGUES = [
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

const DOMESTIC_LEAGUES = ["SA", "PL", "BL1", "PD", "FL1", "ELC", "DED", "PPL"];
const CUP_LEAGUES = ["CL", "EC", "WC"];

// ─── MODELLO ───────────────────────────────────────────────────

function poisson(k, lambda) {
  let p = Math.exp(-lambda);
  for (let i = 1; i <= k; i++) p *= lambda / i;
  return p;
}

function dixonColesCorr(i, j, lH, lA, rho = -0.13) {
  if (i === 0 && j === 0) return 1 - lH * lA * rho;
  if (i === 0 && j === 1) return 1 + lH * rho;
  if (i === 1 && j === 0) return 1 + lA * rho;
  if (i === 1 && j === 1) return 1 - rho;
  return 1;
}

function calcProbs(lH, lA, max = 8) {
  let h = 0, d = 0, a = 0, o25 = 0, btts = 0;
  for (let i = 0; i <= max; i++) {
    for (let j = 0; j <= max; j++) {
      const corr = dixonColesCorr(i, j, lH, lA);
      const p = poisson(i, lH) * poisson(j, lA) * corr;
      if (i > j) h += p;
      else if (i === j) d += p;
      else a += p;
      if (i + j > 2.5) o25 += p;
      if (i > 0 && j > 0) btts += p;
    }
  }
  const o05ht = Math.min(0.18 + (lH + lA) * 0.14, 0.96);
  const tot = h + d + a;
  return { h: h/tot, d: d/tot, a: a/tot, o25, u25: 1 - o25, btts, o05ht };
}

function timeWeight(matchDate, refDate) {
  const days = (new Date(refDate) - new Date(matchDate)) / (1000 * 60 * 60 * 24);
  return Math.exp(-days / 90);
}

function calcRatings(matches, refDate) {
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

function calcH2H(allMatches, teamHId, teamAId) {
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

function getLambdas(teamH, teamA, lgAvgHome, lgAvgAway, h2hBias) {
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

function getSignals(probs) {
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

async function fetchOddsForLeague(oddsKey, date) {
  if (!oddsKey) return {};
  try {
    const r = await fetch(`${API_ODDS}?endpoint=sports/${oddsKey}/odds&regions=eu&markets=h2h,totals&dateFormat=iso&oddsFormat=decimal`);
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
const STOP_WORDS = ["fc", "cf", "sc", "ac", "bc", "bk", "fk", "sk", "if", "ik",
  "club", "united", "city", "town", "athletic", "athletics", "sport", "sports",
  "deportivo", "deportiva", "atletico", "atletica", "real", "racing", "river",
  "plate", "union", "the", "de", "do", "da", "del", "di", "los", "las", "le",
  "la", "el", "al", "1", "2", "afc", "rsc", "vfb", "vfl", "tsg", "rb", "rd"];

function normalizeName(name) {
  return name.toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")  // rimuove caratteri speciali
    .split(/\s+/)
    .filter(w => w.length > 1 && !STOP_WORDS.includes(w))
    .join(" ")
    .trim();
}

function nameSimilarity(a, b) {
  const wa = new Set(normalizeName(a).split(" ").filter(w => w.length > 2));
  const wb = new Set(normalizeName(b).split(" ").filter(w => w.length > 2));
  if (wa.size === 0 || wb.size === 0) return 0;
  let common = 0;
  wa.forEach(w => { if (wb.has(w)) common++; });
  // Controlla anche match parziale (es. "liverpool" dentro "liverpool fc")
  wa.forEach(w => { wb.forEach(wb2 => { if (w.length > 4 && (w.includes(wb2) || wb2.includes(w))) common += 0.5; }); });
  return common / Math.max(wa.size, wb.size);
}

function matchOdds(oddsMap, homeName, awayName) {
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

function calcEV(prob, bookOdds) {
  if (!bookOdds || bookOdds <= 1) return null;
  return prob * (bookOdds - 1) - (1 - prob);
}

function currentSeasonFor(code) {
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

async function getSeasonData(code, supabaseClient, seasonOverride) {
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
    const r = await fetch(`${API_FD}?endpoint=competitions/${code}/matches&season=${season}`);
    const d = await r.json();
    matches = d.matches || [];
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

// ─── COMPONENTE ───────────────────────────────────────────────

export default function Oggi() {

  const [date, setDate] = useState(() => new Date().toISOString().split("T")[0]);
  const [selectedLeagues, setSelectedLeagues] = useState([]);
  const [matches, setMatches] = useState([]);
  const [loading, setLoading] = useState(false);
  const [progress, setProgress] = useState("");
  const [filter, setFilter] = useState("all");
  const [savingId, setSavingId] = useState(null);
  const [savedMap, setSavedMap] = useState({});
  const [checkingId, setCheckingId] = useState(null);
  const [pianoMap, setPianoMap] = useState({});
  const [sports, setSports] = useState(["calcio"]);

  const toggleLeague = (code) => {
    setSelectedLeagues(prev => prev.includes(code) ? prev.filter(x => x !== code) : [...prev, code]);
  };

  const toggleSport = (s) => {
    setSports(prev => prev.includes(s) ? prev.filter(x => x !== s) : [...prev, s]);
  };

  const load = async () => {
    setLoading(true);
    setMatches([]);
    setSavedMap({});
    setPianoMap({});
    const all = [];
    const today = date;

    if (sports.includes("calcio") && selectedLeagues.length > 0) {

    const needsDomestic = selectedLeagues.some(c => CUP_LEAGUES.includes(c));
    const leaguesToLoad = needsDomestic
      ? [...new Set([...selectedLeagues, ...DOMESTIC_LEAGUES])]
      : selectedLeagues;

    const allRatings = {};
    const allAvgs = {};
    const allMatches = {};

    for (const code of leaguesToLoad) {
      const league = LEAGUES.find(l => l.code === code);
      if (!league) continue;
      setProgress(`Carico ${league.flag} ${league.name}...`);
      let seasonMatches = await getSeasonData(code, supabase);
      const finishedCount = seasonMatches.filter(m => m.status === "FINISHED").length;

      // Stagione nuova appena iniziata: poche partite finite non bastano per
      // ratings affidabili. Invece di uno switch netto "vecchia stagione SI/NO",
      // mescoliamo lo storico della stagione precedente con quello nuovo — il
      // peso per recenza (timeWeight, già esistente) sfuma da solo l'importanza
      // delle partite vecchie mano a mano che si accumulano quelle nuove, senza
      // salti bruschi nelle previsioni quando si supera una soglia fissa.
      const MIN_FINISHED_FOR_FRESH_DATA = 15; // sopra questa soglia non serve più lo storico vecchio
      let ratingsSource = seasonMatches;
      if (finishedCount < MIN_FINISHED_FOR_FRESH_DATA) {
        const currentSeasonYear = parseInt(currentSeasonFor(code), 10);
        const priorSeason = String(currentSeasonYear - 1);
        const priorMatches = await getSeasonData(code, supabase, priorSeason);
        if (priorMatches.length > 0) {
          ratingsSource = [...priorMatches, ...seasonMatches]; // timeWeight sfuma da sé le più vecchie
          setProgress(`${league.flag} ${league.name}: stagione nuova, integro storico ${priorSeason}...`);
        }
      }

      allMatches[code] = seasonMatches; // per H2H e fixture del giorno resta la stagione corrente
      const { teams, lgAvgHome, lgAvgAway } = calcRatings(ratingsSource, today);
      allRatings[code] = teams;
      allAvgs[code] = { lgAvgHome, lgAvgAway };
    }

    // Carica quote per ogni lega selezionata
    const allOdds = {};
    for (const code of selectedLeagues) {
      const league = LEAGUES.find(l => l.code === code);
      if (!league?.oddsKey) continue;
      setProgress(`Carico quote ${league.flag} ${league.name}...`);
      allOdds[code] = await fetchOddsForLeague(league.oddsKey, date);
    }

    const findTeamRating = (teamId, teamName, primaryCode) => {
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
    };

    for (const code of selectedLeagues) {
      const league = LEAGUES.find(l => l.code === code);
      if (!league) continue;
      setProgress(`Cerco partite ${league.flag} ${league.name}...`);

      let fixtures = [];
      for (let attempt = 0; attempt < 4; attempt++) {
        try {
          const r = await fetch(`${API_FD}?endpoint=competitions/${code}/matches&dateFrom=${date}&dateTo=${date}`);
          const d = await r.json();
          fixtures = d.matches || [];
          if (fixtures.length > 0) break;
        } catch (e) {}
        if (attempt < 3) await new Promise(r => setTimeout(r, 2500));
      }

      let lgAvgHome, lgAvgAway;
      if (CUP_LEAGUES.includes(code)) {
        const avgs = DOMESTIC_LEAGUES.filter(c => allAvgs[c]);
        lgAvgHome = avgs.reduce((s, c) => s + allAvgs[c].lgAvgHome, 0) / (avgs.length || 1);
        lgAvgAway = avgs.reduce((s, c) => s + allAvgs[c].lgAvgAway, 0) / (avgs.length || 1);
      } else {
        lgAvgHome = allAvgs[code]?.lgAvgHome || 1.35;
        lgAvgAway = allAvgs[code]?.lgAvgAway || 1.1;
      }

      const seasonMatchesForH2H = allMatches[code] || [];

      for (const fix of fixtures) {
        const hId = fix.homeTeam.id;
        const aId = fix.awayTeam.id;
        const resH = findTeamRating(hId, fix.homeTeam.name, code);
        const resA = findTeamRating(aId, fix.awayTeam.name, code);

        const h2h = calcH2H(seasonMatchesForH2H, hId, aId);
        let lH = lgAvgHome;
        let lA = lgAvgAway;
        let hasRatings = false;

        if (resH && resA) {
          const lambdas = getLambdas(resH.rating, resA.rating, lgAvgHome, lgAvgAway, h2h.bias);
          lH = lambdas.lH;
          lA = lambdas.lA;
          hasRatings = true;
        }

        const probs = calcProbs(lH, lA);
        const signals = getSignals(probs);
        const time = fix.utcDate ? new Date(fix.utcDate).toLocaleTimeString("it-IT", { hour: "2-digit", minute: "2-digit" }) : "--:--";

        // Abbina quote bookmaker
        const oddsData = matchOdds(allOdds[code] || {}, fix.homeTeam.name, fix.awayTeam.name);

        // Calcola EV e VALUE per ogni segnale
        const signalsWithEV = signals.map(s => {
          let bookOdds = null;
          if (oddsData) {
            if (s.label === "CASA VINCE") bookOdds = oddsData.o1;
            else if (s.label === "OSPITE VINCE") bookOdds = oddsData.o2;
            else if (s.label === "OVER 2.5") bookOdds = oddsData.oOver25;
            else if (s.label === "UNDER 2.5") bookOdds = oddsData.oUnder25;
          }
          const ev = bookOdds ? calcEV(s.prob, bookOdds) : null;
          const isValue = ev !== null && ev > 0.03; // almeno 3% EV
          return { ...s, bookOdds, ev, isValue };
        });

        const hasValue = signalsWithEV.some(s => s.isValue);

        all.push({
          id: fix.id,
          home: { name: fix.homeTeam.name, crest: fix.homeTeam.crest },
          away: { name: fix.awayTeam.name, crest: fix.awayTeam.crest },
          time, league, probs, lH, lA,
          signals: signalsWithEV,
          hasRatings, hasValue,
          fdId: fix.id,
          ratingSource: resH?.leagueCode,
          formH: resH?.rating.formStr || "",
          formA: resA?.rating.formStr || "",
          h2h,
          oddsData,
        });
      }
    }

    all.sort((a, b) => {
      if (b.hasValue !== a.hasValue) return b.hasValue ? 1 : -1;
      return (b.signals[0]?.prob || 0) - (a.signals[0]?.prob || 0);
    });

    } // fine blocco calcio

    if (sports.includes("tennis")) {
      setProgress("🎾 Cerco partite di tennis...");
      try {
        const r = await fetch(`/api/tennis/matches?date=${date}`);
        const d = await r.json();
        const tennisMatches = (d.matches || []).map((m, i) => {
          const valueSuspiciousSignals = [
            m.isValueA && { label: `${m.playerA.name} vince`, prob: m.probA, isValue: true, ev: m.evA, fairOdds: 1 / m.probA, bookOdds: m.oddsA, color: "#c8f135", strong: m.probA > 0.65 },
            m.isValueB && { label: `${m.playerB.name} vince`, prob: m.probB, isValue: true, ev: m.evB, fairOdds: 1 / m.probB, bookOdds: m.oddsB, color: "#4af0c4", strong: m.probB > 0.65 },
            m.suspiciousA && { label: `${m.playerA.name} vince`, prob: m.probA, isSuspicious: true, ev: m.evA, fairOdds: 1 / m.probA, bookOdds: m.oddsA, color: "#f0794a" },
            m.suspiciousB && { label: `${m.playerB.name} vince`, prob: m.probB, isSuspicious: true, ev: m.evB, fairOdds: 1 / m.probB, bookOdds: m.oddsB, color: "#f0794a" },
          ].filter(Boolean);

          // Nessun value bet e nessun sospetto: se i dati sono affidabili
          // (non lowDataPlayer), mostriamo comunque il pronostico secco del
          // modello — utile per tracciare l'accuratezza nel tempo, anche
          // quando il mercato non lascia margine da sfruttare.
          let signals = valueSuspiciousSignals;
          if (signals.length === 0 && !m.lowDataPlayer) {
            const favorsA = m.probA >= m.probB;
            signals = [{
              label: `${favorsA ? m.playerA.name : m.playerB.name} vince`,
              prob: favorsA ? m.probA : m.probB,
              isPlain: true,
              ev: null,
              fairOdds: 1 / (favorsA ? m.probA : m.probB),
              bookOdds: favorsA ? m.oddsA : m.oddsB,
              color: "#7dd3fc",
            }];
          }

          return {
          isTennis: true,
          id: `tennis_${date}_${i}`,
          tour: m.tour,
          league: { name: m.tournament ? `🎾 ${m.tournament} · ${m.tour}` : `🎾 Tennis ${m.tour}` },
          time: m.commenceTime ? new Date(m.commenceTime).toLocaleTimeString("it-IT", { hour: "2-digit", minute: "2-digit" }) : "--:--",
          home: { name: m.playerA.name, crest: null },
          away: { name: m.playerB.name, crest: null },
          playerA: m.playerA,
          playerB: m.playerB,
          probs: { h: m.probA, a: m.probB },
          oddsData: m.oddsA && m.oddsB ? { o1: m.oddsA, o2: m.oddsB } : null,
          signals,
          hasValue: m.isValueA || m.isValueB,
          statsWarning: !m.playerA.statsFound || !m.playerB.statsFound,
          };
        });
        // Nascondiamo le partite che mostrerebbero SOLO il triangolo di
        // sospetto (nessun segnale VALUE vero, nessun pronostico neutro) —
        // non vengono mai usate, quindi solo rumore visivo. Restano visibili
        // sia le partite con un vero value bet, sia quelle col pronostico
        // neutro (utile per tracciare l'accuratezza), sia quelle mute.
        const tennisMatchesFiltered = tennisMatches.filter(m => m.hasValue || !m.signals.some(s => s.isSuspicious));
        all.push(...tennisMatchesFiltered);
      } catch (e) {
        console.error("Errore caricamento tennis:", e);
      }
    }

    setMatches(all);
    setLoading(false);
    setProgress("");
  };

  const saveSignal = async (match, signal) => {
    const key = `${match.id}_${signal.label}`;
    setSavingId(key);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      // pronox_archive.match_id è un bigint: gli id calcio (numerici, da
      // football-data.org) vanno bene così, ma quelli tennis sono stringhe
      // tipo "tennis_2026-08-01_0" — li convertiamo in un numero sintetico
      // ma comunque univoco (data + indice della partita in quel giorno).
      let numericMatchId;
      if (match.isTennis) {
        const idxPart = match.id.split("_").pop();
        numericMatchId = parseInt(date.replace(/-/g, ""), 10) * 1000 + parseInt(idxPart, 10);
      } else {
        numericMatchId = match.id;
      }
      const { error } = await supabase.from("pronox_archive").insert({
        match_id: numericMatchId, match_date: date, match_time: match.time,
        league: match.league.name, home_team: match.home.name, away_team: match.away.name,
        prediction_type: signal.type, prediction_label: signal.label,
        probability: parseFloat((signal.prob * 100).toFixed(1)),
        lambda_home: match.isTennis ? 0 : parseFloat(match.lH.toFixed(3)),
        lambda_away: match.isTennis ? 0 : parseFloat(match.lA.toFixed(3)),
        status: "PENDING",
        user_id: user?.id || null,
      });
      if (error) {
        console.error("Errore salvataggio pronox_archive:", error);
        alert(`Salvataggio fallito: ${error.message}`);
      } else {
        setSavedMap(prev => ({ ...prev, [key]: "PENDING" }));
      }
    } catch (e) { console.error(e); alert(`Salvataggio fallito: ${e.message || e}`); }
    setSavingId(null);
  };

  const verifyResult = async (match, signal) => {
    const key = `${match.id}_${signal.label}`;
    if (match.isTennis) {
      // Verifica risultati tennis non ancora implementata (serve una fonte
      // punteggi live per il tennis) — per ora si può solo salvare il segnale.
      return;
    }
    setCheckingId(key);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      const r = await fetch(`${API_FD}?endpoint=matches/${match.fdId}`);
      const d = await r.json();
      const m = d.match || d;
      if (!m || m.status !== "FINISHED") { setCheckingId(null); return; }
      const ftHome = m.score?.fullTime?.home ?? 0;
      const ftAway = m.score?.fullTime?.away ?? 0;
      const htHome = m.score?.halfTime?.home ?? 0;
      const htAway = m.score?.halfTime?.away ?? 0;
      const total = ftHome + ftAway;
      let outcome = "LOSS";
      if (signal.label === "CASA VINCE") outcome = ftHome > ftAway ? "WIN" : "LOSS";
      else if (signal.label === "OSPITE VINCE") outcome = ftAway > ftHome ? "WIN" : "LOSS";
      else if (signal.label === "OVER 2.5") outcome = total > 2.5 ? "WIN" : "LOSS";
      else if (signal.label === "UNDER 2.5") outcome = total < 2.5 ? "WIN" : "LOSS";
      else if (signal.label === "BTTS SÌ") outcome = ftHome > 0 && ftAway > 0 ? "WIN" : "LOSS";
      else if (signal.label === "OVER 0.5 HT") outcome = (htHome + htAway) > 0 ? "WIN" : "LOSS";
      else if (signal.label === "TRADING O0.5 HT → U2.5 LIVE") outcome = (htHome + htAway) >= 1 && total <= 2 ? "WIN" : "LOSS";
      await supabase.from("pronox_archive")
        .update({ status: outcome, ft_home_goals: ftHome, ft_away_goals: ftAway, ht_home_goals: htHome, ht_away_goals: htAway, result_checked_at: new Date().toISOString() })
        .eq("match_id", match.id).eq("prediction_label", signal.label).eq("user_id", user?.id);
      setSavedMap(prev => ({ ...prev, [key]: outcome }));
    } catch (e) { console.error(e); }
    setCheckingId(null);
  };

  const addToPlan = async (match, signal) => {
    const key = `${match.id}_${signal.label}_piano`;
    setPianoMap(prev => ({ ...prev, [key]: "saving" }));
    try {
      const { data: plan } = await supabase.from("pronox_plans").select("id").eq("status", "ACTIVE").single();
      if (!plan) { alert("Nessun piano attivo!"); setPianoMap(prev => ({ ...prev, [key]: null })); return; }
      const { error } = await supabase.from("pronox_bets").insert({
        plan_id: plan.id, match_date: date, match_time: match.time,
        league: match.league.name, home_team: match.home.name, away_team: match.away.name,
        prediction_label: signal.label, prediction_type: signal.type,
        probability: parseFloat((signal.prob * 100).toFixed(1)),
        lambda_home: match.isTennis ? 0 : parseFloat(match.lH.toFixed(3)),
        lambda_away: match.isTennis ? 0 : parseFloat(match.lA.toFixed(3)),
        status: "PENDING",
      });
      if (error) {
        console.error("Errore salvataggio pronox_bets:", error);
        alert(`Salvataggio nel piano fallito: ${error.message}`);
        setPianoMap(prev => ({ ...prev, [key]: null }));
      } else {
        setPianoMap(prev => ({ ...prev, [key]: "saved" }));
      }
    } catch (e) { console.error(e); alert(`Salvataggio nel piano fallito: ${e.message || e}`); setPianoMap(prev => ({ ...prev, [key]: null })); }
  };

  const filtered = matches.filter(m => {
    if (filter === "signal") return m.signals.length > 0;
    if (filter === "strong") return m.signals.some(s => s.strong);
    if (filter === "over") return m.probs.o25 > 0.65;
    if (filter === "value") return m.hasValue;
    if (filter === "trading") return m.signals.some(s => s.type === "TRADING");
    return true;
  });

  const strongCount = matches.filter(m => m.signals.some(s => s.strong)).length;
  const signalCount = matches.filter(m => m.signals.length > 0).length;
  const valueCount = matches.filter(m => m.hasValue).length;

  const formColor = (r) => r === "W" ? "#c8f135" : r === "D" ? "#ffd060" : "#ff5c5c";

  return (
    <div style={{ minHeight: "100vh", background: "#0d0f14", color: "#e8ecf5", fontFamily: "system-ui, sans-serif", padding: "24px 16px" }}>
      <div style={{ maxWidth: 860, margin: "0 auto" }}>
        <h1 style={{ fontSize: 26, fontWeight: 800, marginBottom: 4 }}>
          PRONO<span style={{ color: "#c8f135" }}>X</span>
          <span style={{ fontSize: 13, fontWeight: 400, color: "#6b7490" }}> · partite del giorno</span>
        </h1>
        <div style={{ fontSize: 11, color: "#6b7490", marginBottom: 12, letterSpacing: "0.08em" }}>
          © Sergio Apicella · PronoX 2026
        </div>
        <div style={{ display: "flex", gap: 16, marginBottom: 20 }}>
          <a href="/" style={{ fontSize: 12, color: "#6b7490", textDecoration: "none" }}>← home</a>
          <a href="/pronosticatore" style={{ fontSize: 12, color: "#6b7490", textDecoration: "none" }}>⚽ analisi manuale</a>
          <a href="/archivio" style={{ fontSize: 12, color: "#6b7490", textDecoration: "none" }}>📊 archivio</a>
          <a href="/piano" style={{ fontSize: 12, color: "#c8f135", textDecoration: "none", fontWeight: 700 }}>🎯 piano</a>
        </div>

        <div style={{ background: "#161920", border: "1px solid #2a2f3f", borderRadius: 14, padding: 20, marginBottom: 16 }}>
          <div style={{ display: "flex", gap: 12, alignItems: "flex-end", flexWrap: "wrap", marginBottom: 14 }}>
            <div>
              <label style={lbl}>Data</label>
              <input type="date" value={date} onChange={e => setDate(e.target.value)} style={{ ...inp, width: 160 }} />
            </div>
            <div>
              <label style={lbl}>Filtra</label>
              <select value={filter} onChange={e => setFilter(e.target.value)} style={{ ...sel, minWidth: 200 }}>
                <option value="all">Tutte le partite</option>
                <option value="value">🎆 Solo VALUE bet</option>
                <option value="signal">Con almeno un segnale</option>
                <option value="strong">Solo segnali forti</option>
                <option value="over">Over 2.5 probabile</option>
                <option value="trading">Trading O0.5 HT + U2.5</option>
              </select>
            </div>
            <div>
              <label style={lbl}>Sport</label>
              <div style={{ display: "flex", gap: 8 }}>
                {[
                  { key: "calcio", label: "⚽ Calcio" },
                  { key: "tennis", label: "🎾 Tennis" },
                ].map(s => (
                  <button key={s.key} onClick={() => toggleSport(s.key)}
                    style={{ padding: "9px 16px", borderRadius: 8, fontSize: 13, fontWeight: 700, cursor: "pointer", border: "1px solid", background: sports.includes(s.key) ? "#c8f135" : "transparent", color: sports.includes(s.key) ? "#0d0f14" : "#6b7490", borderColor: sports.includes(s.key) ? "#c8f135" : "#2a2f3f" }}>
                    {s.label}
                  </button>
                ))}
              </div>
            </div>
          </div>
          {sports.includes("calcio") && (
            <div>
              <label style={lbl}>Leghe (seleziona 1-3 per risultati stabili)</label>
              <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
                {LEAGUES.map(l => (
                  <button key={l.code} onClick={() => toggleLeague(l.code)}
                    style={{ padding: "6px 14px", borderRadius: 20, fontSize: 12, fontWeight: 600, cursor: "pointer", border: "1px solid", background: selectedLeagues.includes(l.code) ? "#c8f135" : "transparent", color: selectedLeagues.includes(l.code) ? "#0d0f14" : "#6b7490", borderColor: selectedLeagues.includes(l.code) ? "#c8f135" : "#2a2f3f" }}>
                    {l.flag} {l.name}
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>

        <button onClick={load} disabled={loading || (sports.includes("calcio") && selectedLeagues.length === 0) || sports.length === 0}
          style={{ width: "100%", padding: 14, fontSize: 15, fontWeight: 800, borderRadius: 10, border: "none", cursor: loading || (sports.includes("calcio") && selectedLeagues.length === 0) || sports.length === 0 ? "not-allowed" : "pointer", background: loading || (sports.includes("calcio") && selectedLeagues.length === 0) || sports.length === 0 ? "#2a2f3f" : "#c8f135", color: loading || (sports.includes("calcio") && selectedLeagues.length === 0) || sports.length === 0 ? "#6b7490" : "#0d0f14", marginBottom: 20 }}>
          {loading ? `⏳ ${progress}` : sports.length === 0 ? "Seleziona uno sport" : (sports.includes("calcio") && selectedLeagues.length === 0) ? "Seleziona almeno una lega" : "ANALIZZA PARTITE DEL GIORNO ↗"}
        </button>

        {matches.length > 0 && (
          <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 10, marginBottom: 16 }}>
            {[
              ["Partite", matches.length, "#e8ecf5"],
              ["Segnali", signalCount, "#4af0c4"],
              ["Forti", strongCount, "#c8f135"],
              ["🎆 VALUE", valueCount, "#ff9f43"],
            ].map(([l, v, c]) => (
              <div key={l} style={{ background: "#161920", border: `1px solid ${l === "🎆 VALUE" && v > 0 ? "rgba(255,159,67,0.4)" : "#2a2f3f"}`, borderRadius: 10, padding: "14px 12px", textAlign: "center" }}>
                <div style={{ fontSize: 10, color: "#6b7490", fontWeight: 700, letterSpacing: "0.08em", marginBottom: 6, textTransform: "uppercase" }}>{l}</div>
                <div style={{ fontSize: 28, fontWeight: 700, color: c }}>{v}</div>
              </div>
            ))}
          </div>
        )}

        {filtered.map(m => (
          m.isTennis ? (
            <div key={m.id} style={{ background: "#161920", border: `1px solid ${m.hasValue ? "rgba(255,159,67,0.5)" : "#2a2f3f"}`, borderRadius: 14, padding: 18, marginBottom: 10 }}>
              <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 12 }}>
                <div style={{ fontSize: 11, color: "#6b7490", fontWeight: 700, letterSpacing: "0.08em" }}>
                  {m.league.name} · {m.time}
                </div>
                <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                  {m.hasValue && <span style={{ fontSize: 11, fontWeight: 800, color: "#ff9f43", background: "rgba(255,159,67,0.15)", padding: "2px 8px", borderRadius: 6 }}>🎆 VALUE</span>}
                  {m.statsWarning && <span style={{ fontSize: 11, color: "#f0794a" }}>⚠ stats stimate</span>}
                </div>
              </div>

              <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 12 }}>
                <div style={{ flex: 1 }}>
                  <div style={{ fontWeight: 700, fontSize: 15 }}>{m.home.name}</div>
                  <div style={{ fontSize: 12, color: "#6b7490", marginTop: 2 }}>{(m.probs.h * 100).toFixed(0)}% · servizio {m.playerA?.servePct ? (m.playerA.servePct * 100).toFixed(0) + "%" : "—"}</div>
                </div>
                <div style={{ color: "#6b7490", fontSize: 13, fontWeight: 600 }}>vs</div>
                <div style={{ flex: 1, textAlign: "right" }}>
                  <div style={{ fontWeight: 700, fontSize: 15 }}>{m.away.name}</div>
                  <div style={{ fontSize: 12, color: "#6b7490", marginTop: 2 }}>{(m.probs.a * 100).toFixed(0)}% · servizio {m.playerB?.servePct ? (m.playerB.servePct * 100).toFixed(0) + "%" : "—"}</div>
                </div>
              </div>

              {m.oddsData && (
                <div style={{ display: "grid", gridTemplateColumns: "repeat(2, 1fr)", gap: 6, marginBottom: 12 }}>
                  {[["1", m.oddsData.o1], ["2", m.oddsData.o2]].map(([l, v]) => (
                    <div key={l} style={{ background: "#0d0f14", border: "1px solid rgba(255,159,67,0.2)", borderRadius: 8, padding: "8px 4px", textAlign: "center" }}>
                      <div style={{ fontSize: 9, color: "#ff9f43", fontWeight: 700, letterSpacing: "0.06em", marginBottom: 3 }}>{l} 📖</div>
                      <div style={{ fontSize: 15, fontWeight: 700, color: "#e8ecf5", fontFamily: "monospace" }}>{v ? v.toFixed(2) : "—"}</div>
                    </div>
                  ))}
                </div>
              )}

              {m.signals.length > 0 ? (
                <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                  {m.signals.map((s, i) => {
                    const key = `${m.id}_${s.label}`;
                    const savedStatus = savedMap[key];
                    return (
                      <div key={i} style={{ borderRadius: 8, border: `1px solid ${s.isValue ? "rgba(255,159,67,0.6)" : s.isSuspicious ? "rgba(240,121,74,0.5)" : "#2a2f3f"}`, background: s.isValue ? "rgba(255,159,67,0.08)" : s.isSuspicious ? "rgba(240,121,74,0.08)" : "rgba(255,255,255,0.03)", padding: "10px 14px" }}>
                        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: (s.isValue || s.isSuspicious) ? 8 : 0 }}>
                          <span style={{ fontSize: 13, fontWeight: 700, color: s.isValue ? "#ff9f43" : s.isSuspicious ? "#f0794a" : "#e8ecf5" }}>
                            {s.isValue ? "🎆 " : s.isSuspicious ? "⚠️ " : "→ "}{s.label}
                          </span>
                          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                            <span style={{ fontSize: 13, fontFamily: "monospace", color: s.color, fontWeight: 600 }}>{(s.prob * 100).toFixed(1)}%</span>
                            {s.bookOdds && <span style={{ fontSize: 12, fontFamily: "monospace", color: "#6b7490" }}>@{s.bookOdds.toFixed(2)}</span>}
                            {!s.isSuspicious && !savedStatus && (
                              <button onClick={() => saveSignal(m, s)} disabled={savingId === key}
                                style={{ fontSize: 12, padding: "5px 12px", borderRadius: 8, border: `1px solid ${s.color}60`, background: `${s.color}15`, color: s.color, cursor: "pointer", fontWeight: 700 }}>
                                {savingId === key ? "..." : "☑ Salva"}
                              </button>
                            )}
                            {savedStatus === "PENDING" && <span style={{ fontSize: 12, padding: "5px 10px", borderRadius: 8, background: "rgba(255,208,96,0.1)", color: "#ffd060", fontWeight: 700 }}>⏳ salvato</span>}
                          </div>
                        </div>
                        {s.isValue && s.ev !== null && (
                          <div style={{ fontSize: 11, color: "#ff9f43", background: "rgba(255,159,67,0.1)", borderRadius: 6, padding: "4px 10px", display: "inline-block" }}>
                            Quota equa: {s.fairOdds.toFixed(2)} · Book: {s.bookOdds.toFixed(2)} · EV: +{(s.ev * 100).toFixed(1)}%
                          </div>
                        )}
                        {s.isSuspicious && s.ev !== null && (
                          <div style={{ fontSize: 11, color: "#f0794a", background: "rgba(240,121,74,0.1)", borderRadius: 6, padding: "4px 10px", display: "inline-block" }}>
                            EV +{(s.ev * 100).toFixed(1)}% — fuori scala, probabile stima inaffidabile: non salvabile
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              ) : (
                <div style={{ fontSize: 12, color: "#6b7490", padding: "8px 0" }}>— Nessun value bet · skip</div>
              )}
            </div>
          ) : (
          <div key={m.id} style={{ background: "#161920", border: `1px solid ${m.hasValue ? "rgba(255,159,67,0.5)" : m.signals.some(s => s.strong) ? "rgba(200,241,53,0.4)" : m.signals.length > 0 ? "rgba(74,240,196,0.25)" : "#2a2f3f"}`, borderRadius: 14, padding: 18, marginBottom: 10 }}>

            <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 12 }}>
              <div style={{ fontSize: 11, color: "#6b7490", fontWeight: 700, letterSpacing: "0.08em" }}>
                {m.league.flag} {m.league.name} · {m.time}
              </div>
              <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                {m.hasValue && <span style={{ fontSize: 11, fontWeight: 800, color: "#ff9f43", background: "rgba(255,159,67,0.15)", padding: "2px 8px", borderRadius: 6 }}>🎆 VALUE</span>}
                {m.ratingSource && CUP_LEAGUES.includes(m.league.code) && (
                  <span style={{ fontSize: 10, color: "#4af0c4" }}>dati: {LEAGUES.find(l => l.code === m.ratingSource)?.name}</span>
                )}
                {!m.hasRatings && <span style={{ fontSize: 11, color: "#f0794a" }}>⚠ N/D</span>}
              </div>
            </div>

            <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 12 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 8, flex: 1 }}>
                {m.home.crest && <img src={m.home.crest} style={{ width: 28, height: 28 }} alt="" />}
                <div>
                  <div style={{ fontWeight: 700, fontSize: 15 }}>{m.home.name}</div>
                  {m.formH && (
                    <div style={{ display: "flex", gap: 2, marginTop: 3 }}>
                      {m.formH.split("").map((r, i) => (
                        <span key={i} style={{ fontSize: 9, fontWeight: 700, color: formColor(r), background: `${formColor(r)}20`, padding: "1px 4px", borderRadius: 3 }}>{r}</span>
                      ))}
                    </div>
                  )}
                </div>
              </div>
              <div style={{ textAlign: "center" }}>
                {m.oddsData ? (
                  <div style={{ display: "flex", gap: 6 }}>
                    {[m.oddsData.o1, m.oddsData.oX, m.oddsData.o2].map((q, i) => (
                      <div key={i} style={{ background: "#0d0f14", border: "1px solid #2a2f3f", borderRadius: 6, padding: "4px 8px", textAlign: "center", minWidth: 40 }}>
                        <div style={{ fontSize: 9, color: "#6b7490", marginBottom: 2 }}>{["1","X","2"][i]}</div>
                        <div style={{ fontSize: 13, fontWeight: 700, color: "#e8ecf5", fontFamily: "monospace" }}>{q ? q.toFixed(2) : "—"}</div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div style={{ color: "#6b7490", fontSize: 13, fontWeight: 600 }}>vs</div>
                )}
              </div>
              <div style={{ display: "flex", alignItems: "center", gap: 8, flex: 1, justifyContent: "flex-end" }}>
                <div style={{ textAlign: "right" }}>
                  <div style={{ fontWeight: 700, fontSize: 15 }}>{m.away.name}</div>
                  {m.formA && (
                    <div style={{ display: "flex", gap: 2, marginTop: 3, justifyContent: "flex-end" }}>
                      {m.formA.split("").map((r, i) => (
                        <span key={i} style={{ fontSize: 9, fontWeight: 700, color: formColor(r), background: `${formColor(r)}20`, padding: "1px 4px", borderRadius: 3 }}>{r}</span>
                      ))}
                    </div>
                  )}
                </div>
                {m.away.crest && <img src={m.away.crest} style={{ width: 28, height: 28 }} alt="" />}
              </div>
            </div>

            {m.h2h.count > 0 && (
              <div style={{ fontSize: 11, color: "#6b7490", marginBottom: 10 }}>
                H2H ultimi {m.h2h.count}: <span style={{ color: "#c8f135" }}>{m.h2h.hWins}V</span> - <span style={{ color: "#ffd060" }}>{m.h2h.count - m.h2h.hWins - m.h2h.aWins}P</span> - <span style={{ color: "#4af0c4" }}>{m.h2h.aWins}V</span>
              </div>
            )}

            <div style={{ background: "#0d0f14", border: "1px solid #2a2f3f", borderRadius: 10, padding: "12px 16px", marginBottom: 12 }}>
              <div style={{ fontSize: 10, color: "#6b7490", fontWeight: 700, letterSpacing: "0.1em", textTransform: "uppercase", marginBottom: 10 }}>Gol probabili</div>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  {m.home.crest && <img src={m.home.crest} style={{ width: 20, height: 20 }} alt="" />}
                  <span style={{ fontSize: 13 }}>{m.home.name}</span>
                </div>
                <span style={{ fontSize: 24, fontWeight: 700, color: "#c8f135", fontFamily: "monospace" }}>{m.lH.toFixed(2)}</span>
              </div>
              <div style={{ height: 1, background: "#2a2f3f", marginBottom: 8 }} />
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  {m.away.crest && <img src={m.away.crest} style={{ width: 20, height: 20 }} alt="" />}
                  <span style={{ fontSize: 13 }}>{m.away.name}</span>
                </div>
                <span style={{ fontSize: 24, fontWeight: 700, color: "#4af0c4", fontFamily: "monospace" }}>{m.lA.toFixed(2)}</span>
              </div>
            </div>

            <div style={{ display: "grid", gridTemplateColumns: "repeat(5, 1fr)", gap: 6, marginBottom: m.oddsData ? 8 : 12 }}>
              {[
                ["1", (m.probs.h * 100).toFixed(0) + "%"],
                ["X", (m.probs.d * 100).toFixed(0) + "%"],
                ["2", (m.probs.a * 100).toFixed(0) + "%"],
                ["O2.5", (m.probs.o25 * 100).toFixed(0) + "%"],
                ["BTTS", (m.probs.btts * 100).toFixed(0) + "%"],
              ].map(([l, v]) => (
                <div key={l} style={{ background: "#0d0f14", border: "1px solid #2a2f3f", borderRadius: 8, padding: "8px 4px", textAlign: "center" }}>
                  <div style={{ fontSize: 9, color: "#6b7490", fontWeight: 700, letterSpacing: "0.06em", marginBottom: 3 }}>{l}</div>
                  <div style={{ fontSize: 15, fontWeight: 600 }}>{v}</div>
                </div>
              ))}
            </div>

            {m.oddsData && (
              <div style={{ display: "grid", gridTemplateColumns: "repeat(5, 1fr)", gap: 6, marginBottom: 12 }}>
                {[
                  ["1", m.oddsData.o1],
                  ["X", m.oddsData.oX],
                  ["2", m.oddsData.o2],
                  ["O2.5", m.oddsData.oOver25],
                  ["U2.5", m.oddsData.oUnder25],
                ].map(([l, v]) => (
                  <div key={l} style={{ background: "#0d0f14", border: "1px solid rgba(255,159,67,0.2)", borderRadius: 8, padding: "8px 4px", textAlign: "center" }}>
                    <div style={{ fontSize: 9, color: "#ff9f43", fontWeight: 700, letterSpacing: "0.06em", marginBottom: 3 }}>{l} 📖</div>
                    <div style={{ fontSize: 15, fontWeight: 700, color: "#e8ecf5", fontFamily: "monospace" }}>{v ? v.toFixed(2) : "—"}</div>
                  </div>
                ))}
              </div>
            )}

            {m.signals.length > 0 ? (
              <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                {m.signals.map((s, i) => {
                  const key = `${m.id}_${s.label}`;
                  const savedStatus = savedMap[key];
                  const pianoStatus = pianoMap[`${m.id}_${s.label}_piano`];
                  return (
                    <div key={i} style={{ borderRadius: 8, border: `1px solid ${s.isValue ? "rgba(255,159,67,0.6)" : s.strong ? s.color + "50" : "#2a2f3f"}`, background: s.isValue ? "rgba(255,159,67,0.08)" : s.strong ? `${s.color}10` : "rgba(255,255,255,0.03)", padding: "10px 14px" }}>
                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: s.isValue ? 8 : 0 }}>
                        <span style={{ fontSize: 13, fontWeight: 700, color: s.isValue ? "#ff9f43" : s.strong ? s.color : "#e8ecf5" }}>
                          {s.isValue ? "🎆 " : s.strong ? "🔥 " : "→ "}{s.label}
                        </span>
                        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                          <span style={{ fontSize: 13, fontFamily: "monospace", color: s.color, fontWeight: 600 }}>{(s.prob * 100).toFixed(1)}%</span>
                          {s.bookOdds && (
                            <span style={{ fontSize: 12, fontFamily: "monospace", color: s.isValue ? "#ff9f43" : "#6b7490", fontWeight: s.isValue ? 700 : 400 }}>
                              @{s.bookOdds.toFixed(2)}
                            </span>
                          )}
                          {!savedStatus && (
                            <button onClick={() => saveSignal(m, s)} disabled={savingId === key}
                              style={{ fontSize: 12, padding: "5px 12px", borderRadius: 8, border: `1px solid ${s.color}60`, background: `${s.color}15`, color: s.color, cursor: "pointer", fontWeight: 700 }}>
                              {savingId === key ? "..." : "☑ Salva"}
                            </button>
                          )}
                          {savedStatus === "PENDING" && (
                            <button onClick={() => verifyResult(m, s)} disabled={checkingId === key}
                              style={{ fontSize: 12, padding: "5px 12px", borderRadius: 8, border: "1px solid rgba(255,208,96,0.4)", background: "rgba(255,208,96,0.1)", color: "#ffd060", cursor: "pointer", fontWeight: 700 }}>
                              {checkingId === key ? "..." : "⏳ Verifica"}
                            </button>
                          )}
                          {savedStatus === "WIN" && <span style={{ fontSize: 12, padding: "5px 10px", borderRadius: 8, background: "rgba(200,241,53,0.15)", color: "#c8f135", fontWeight: 700 }}>✓ WIN</span>}
                          {savedStatus === "LOSS" && <span style={{ fontSize: 12, padding: "5px 10px", borderRadius: 8, background: "rgba(255,92,92,0.15)", color: "#ff5c5c", fontWeight: 700 }}>✗ LOSS</span>}
                          {pianoStatus === "saved" ? (
                            <span style={{ fontSize: 12, padding: "5px 10px", borderRadius: 8, background: "rgba(200,241,53,0.15)", color: "#c8f135", fontWeight: 700 }}>🎯</span>
                          ) : (
                            <button onClick={() => addToPlan(m, s)} disabled={pianoStatus === "saving"}
                              style={{ fontSize: 12, padding: "5px 12px", borderRadius: 8, border: "1px solid rgba(200,241,53,0.4)", background: "rgba(200,241,53,0.08)", color: "#c8f135", cursor: "pointer", fontWeight: 700 }}>
                              {pianoStatus === "saving" ? "..." : "+ Piano"}
                            </button>
                          )}
                        </div>
                      </div>
                      {s.isValue && s.ev !== null && (
                        <div style={{ fontSize: 11, color: "#ff9f43", background: "rgba(255,159,67,0.1)", borderRadius: 6, padding: "4px 10px", display: "inline-block" }}>
                          Quota equa: {s.fairOdds.toFixed(2)} · Book: {s.bookOdds.toFixed(2)} · EV: +{(s.ev * 100).toFixed(1)}%
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            ) : (
              <div style={{ fontSize: 12, color: "#6b7490", padding: "8px 0" }}>— Nessun segnale chiaro · skip</div>
            )}
          </div>
          )
        ))}

        {matches.length === 0 && !loading && (
          <div style={{ textAlign: "center", color: "#6b7490", padding: "40px 0", fontSize: 14 }}>
            {sports.includes("calcio") && selectedLeagues.length === 0 ? "Seleziona una o due leghe e clicca Analizza" : "Seleziona sport/leghe e clicca Analizza"}
          </div>
        )}
      </div>
    </div>
  );
}

const lbl = { fontSize: 11, fontWeight: 700, color: "#6b7490", letterSpacing: "0.06em", textTransform: "uppercase", display: "block", marginBottom: 5 };
const inp = { background: "#0d0f14", border: "1px solid #2a2f3f", borderRadius: 8, padding: "9px 12px", color: "#e8ecf5", fontSize: 14, outline: "none", boxSizing: "border-box" };
const sel = { background: "#0d0f14", border: "1px solid #2a2f3f", borderRadius: 8, padding: "9px 12px", color: "#e8ecf5", fontSize: 14, outline: "none", boxSizing: "border-box" };
