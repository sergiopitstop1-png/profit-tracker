"use client";
import { useState } from "react";
import { createClient } from "@supabase/supabase-js";

const API_FD = "/api/footballdata";
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
);

const LEAGUES = [
  { code: "SA", name: "Serie A", flag: "🇮🇹" },
  { code: "PL", name: "Premier League", flag: "🏴󠁧󠁢󠁥󠁮󠁧󠁿" },
  { code: "BL1", name: "Bundesliga", flag: "🇩🇪" },
  { code: "PD", name: "La Liga", flag: "🇪🇸" },
  { code: "FL1", name: "Ligue 1", flag: "🇫🇷" },
  { code: "CL", name: "Champions League", flag: "⭐" },
  { code: "ELC", name: "Championship", flag: "🏴󠁧󠁢󠁥󠁮󠁧󠁿" },
  { code: "DED", name: "Eredivisie", flag: "🇳🇱" },
  { code: "PPL", name: "Primeira Liga", flag: "🇵🇹" },
  { code: "BSA", name: "Serie B Brasile", flag: "🇧🇷" },
  { code: "CLI", name: "Copa Libertadores", flag: "🌎" },
  { code: "EC", name: "European Championship", flag: "🇪🇺" },
  { code: "WC", name: "FIFA World Cup", flag: "🌍" },
];

const DOMESTIC_LEAGUES = ["SA", "PL", "BL1", "PD", "FL1", "ELC", "DED", "PPL"];
const CUP_LEAGUES = ["CL", "EC", "WC", "CLI"];

// ─── MODELLO MIGLIORATO ───────────────────────────────────────

function poisson(k, lambda) {
  let p = Math.exp(-lambda);
  for (let i = 1; i <= k; i++) p *= lambda / i;
  return p;
}

// Correzione Dixon-Coles per scoreline basse (0-0, 1-0, 0-1, 1-1)
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
  const o05ht = Math.min(0.18 + (lH + lA) * 0.14, 0.92);
  // Normalizza
  const tot = h + d + a;
  return { h: h/tot, d: d/tot, a: a/tot, o25, u25: 1 - o25, btts, o05ht };
}

// Calcola peso temporale: partite recenti pesano di più
function timeWeight(matchDate, refDate) {
  const days = (new Date(refDate) - new Date(matchDate)) / (1000 * 60 * 60 * 24);
  return Math.exp(-days / 90); // dimezza ogni 90 giorni
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
  
  // Calcola medie ponderate per lega
  let totWHome = 0, totWAway = 0, sumWHome = 0, sumWAway = 0;
  
  finished.forEach(m => {
    const hId = m.homeTeam.id;
    const aId = m.awayTeam.id;
    const hG = m.score.fullTime.home;
    const aG = m.score.fullTime.away;
    const w = timeWeight(m.utcDate?.split("T")[0] || today, today);
    
    if (!teams[hId]) teams[hId] = {
      name: m.homeTeam.name, crest: m.homeTeam.crest,
      hGF: 0, hGA: 0, hW: 0,
      aGF: 0, aGA: 0, aW: 0,
      form: [], lastMatches: []
    };
    if (!teams[aId]) teams[aId] = {
      name: m.awayTeam.name, crest: m.awayTeam.crest,
      hGF: 0, hGA: 0, hW: 0,
      aGF: 0, aGA: 0, aW: 0,
      form: [], lastMatches: []
    };
    
    // Pesi temporali per gol
    teams[hId].hGF += hG * w; teams[hId].hGA += aG * w; teams[hId].hW += w;
    teams[aId].aGF += aG * w; teams[aId].aGA += hG * w; teams[aId].aW += w;
    
    // Forma: risultato ponderato
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
    
    // Forma recente (ultimi 5 pesata)
    t.form.sort((a, b) => new Date(b.date) - new Date(a.date));
    const last5 = t.form.slice(0, 5);
    const formScore = last5.reduce((s, f) => s + (f.res === "W" ? 3 : f.res === "D" ? 1 : 0), 0);
    t.formRating = last5.length > 0 ? formScore / (last5.length * 3) : 0.5;
    t.formStr = last5.map(f => f.res).join("");
    
    // Vantaggio casa reale
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

// H2H tra due squadre
function calcH2H(allMatches, teamHId, teamAId) {
  const h2h = allMatches.filter(m =>
    m.status === "FINISHED" && (
      (m.homeTeam.id === teamHId && m.awayTeam.id === teamAId) ||
      (m.homeTeam.id === teamAId && m.awayTeam.id === teamHId)
    )
  ).slice(-6); // ultimi 6 scontri
  
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
  // Base Dixon-Coles
  let lH = teamH.attH * teamA.defA * lgAvgHome;
  let lA = teamA.attA * teamH.defH * lgAvgAway;
  
  // Aggiusta per vantaggio casa reale della squadra di casa
  const homeAdv = Math.min(Math.max(teamH.homeAdvantage, 0.8), 1.4);
  lH *= homeAdv;
  
  // Aggiusta per forma recente (max ±15%)
  const formFactorH = 0.85 + (teamH.formRating * 0.30);
  const formFactorA = 0.85 + (teamA.formRating * 0.30);
  lH *= formFactorH;
  lA *= formFactorA;
  
  // Aggiusta per H2H (max ±8%)
  lH *= (1 + h2hBias);
  lA *= (1 - h2hBias);
  
  // Limiti ragionevoli
  lH = Math.max(0.3, Math.min(4.5, lH));
  lA = Math.max(0.3, Math.min(4.5, lA));
  
  return { lH, lA };
}

function getSignals(probs) {
  const signals = [];
  if (probs.h > 0.55) signals.push({ label: "CASA VINCE", type: "1X2", prob: probs.h, color: "#c8f135", strong: probs.h > 0.65 });
  if (probs.a > 0.50) signals.push({ label: "OSPITE VINCE", type: "1X2", prob: probs.a, color: "#c8f135", strong: probs.a > 0.60 });
  if (probs.o25 > 0.58) signals.push({ label: "OVER 2.5", type: "OVER", prob: probs.o25, color: "#4af0c4", strong: probs.o25 > 0.68 });
  if (probs.btts > 0.55) signals.push({ label: "BTTS SÌ", type: "BTTS", prob: probs.btts, color: "#4af0c4", strong: probs.btts > 0.65 });
  if (probs.o05ht > 0.70) signals.push({ label: "OVER 0.5 HT", type: "OVER", prob: probs.o05ht, color: "#ffd060", strong: probs.o05ht > 0.80 });
  if (probs.u25 > 0.62) signals.push({ label: "UNDER 2.5", type: "UNDER", prob: probs.u25, color: "#ffd060", strong: probs.u25 > 0.72 });
  if (probs.o05ht >= 0.70 && probs.u25 >= 0.48 && probs.o25 <= 0.56 && probs.btts <= 0.58) {
    signals.push({ label: "TRADING O0.5 HT → U2.5 LIVE", type: "TRADING", prob: probs.o05ht, color: "#ff9f43", strong: probs.o05ht >= 0.78 && probs.u25 >= 0.52 });
  }
  signals.sort((a, b) => b.prob - a.prob);
  return signals;
}

async function fetchLeagueMatches(code) {
  const r = await fetch(`${API_FD}?endpoint=competitions/${code}/matches&season=2025`);
  const d = await r.json();
  return d.matches || [];
}

async function getSeasonData(code, supabaseClient) {
  const today = new Date().toISOString().split("T")[0];
  
  // Prova a leggere dalla cache
  try {
    const { data: cached } = await supabaseClient
      .from("pronox_cache")
      .select("data, updated_at")
      .eq("league_code", code)
      .eq("season", "2025")
      .single();
    
    if (cached) {
      const cacheDate = cached.updated_at?.split("T")[0];
      // Cache valida se aggiornata oggi
      if (cacheDate === today) {
        return cached.data;
      }
    }
  } catch (e) {}
  
  // Fetch fresco con retry
  let matches = [];
  for (let attempt = 0; attempt < 4; attempt++) {
    const r = await fetch(`${API_FD}?endpoint=competitions/${code}/matches&season=2025`);
    const d = await r.json();
    matches = d.matches || [];
    if (matches.length > 0) break;
    if (attempt < 3) await new Promise(r => setTimeout(r, 2000));
  }
  
  // Salva in cache se abbiamo dati
  if (matches.length > 0) {
    try {
      await supabaseClient.from("pronox_cache").upsert({
        league_code: code,
        season: "2025",
        data: matches,
        updated_at: new Date().toISOString(),
      }, { onConflict: "league_code,season" });
    } catch (e) {}
  }
  
  return matches;
}

// ─── COMPONENTE ───────────────────────────────────────────────

export default function Oggi() {
  const [date, setDate] = useState(() => new Date().toISOString().split("T")[0]);
  const [selectedLeagues, setSelectedLeagues] = useState([]); // nessuna selezionata di default
  const [matches, setMatches] = useState([]);
  const [loading, setLoading] = useState(false);
  const [progress, setProgress] = useState("");
  const [filter, setFilter] = useState("all");
  const [savingId, setSavingId] = useState(null);
  const [savedMap, setSavedMap] = useState({});
  const [checkingId, setCheckingId] = useState(null);
  const [pianoMap, setPianoMap] = useState({});

  const toggleLeague = (code) => {
    setSelectedLeagues(prev => prev.includes(code) ? prev.filter(x => x !== code) : [...prev, code]);
  };

  const load = async () => {
    setLoading(true);
    setMatches([]);
    setSavedMap({});
    setPianoMap({});
    const all = [];
    const today = date;

    // Carica leghe domestiche se ci sono coppe
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
      const seasonMatches = await getSeasonData(code, supabase);
      allMatches[code] = seasonMatches;
      const { teams, lgAvgHome, lgAvgAway } = calcRatings(seasonMatches, today);
      allRatings[code] = teams;
      allAvgs[code] = { lgAvgHome, lgAvgAway };
    }

    const findTeamRating = (teamId, teamName, primaryCode) => {
      if (allRatings[primaryCode]?.[teamId]) {
        return { rating: allRatings[primaryCode][teamId], leagueCode: primaryCode };
      }
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

      // Tutti i match della stagione per H2H
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

        all.push({
          id: fix.id,
          home: { name: fix.homeTeam.name, crest: fix.homeTeam.crest },
          away: { name: fix.awayTeam.name, crest: fix.awayTeam.crest },
          time, league, probs, lH, lA, signals, hasRatings,
          fdId: fix.id,
          ratingSource: resH?.leagueCode,
          formH: resH?.rating.formStr || "",
          formA: resA?.rating.formStr || "",
          h2h,
        });
      }
    }

    all.sort((a, b) => (b.signals[0]?.prob || 0) - (a.signals[0]?.prob || 0));
    setMatches(all);
    setLoading(false);
    setProgress("");
  };

  const saveSignal = async (match, signal) => {
    const key = `${match.id}_${signal.label}`;
    setSavingId(key);
    try {
      await supabase.from("pronox_archive").insert({
        match_id: match.id, match_date: date, match_time: match.time,
        league: match.league.name, home_team: match.home.name, away_team: match.away.name,
        prediction_type: signal.type, prediction_label: signal.label,
        probability: parseFloat((signal.prob * 100).toFixed(1)),
        lambda_home: parseFloat(match.lH.toFixed(3)),
        lambda_away: parseFloat(match.lA.toFixed(3)),
        status: "PENDING",
      });
      setSavedMap(prev => ({ ...prev, [key]: "PENDING" }));
    } catch (e) { console.error(e); }
    setSavingId(null);
  };

  const verifyResult = async (match, signal) => {
    const key = `${match.id}_${signal.label}`;
    setCheckingId(key);
    try {
      const r = await fetch(`${API_FD}?endpoint=matches/${match.fdId}`);
      const d = await r.json();
      const m = d.match || d;
      if (!m || m.status !== "FINISHED") { alert("Partita non ancora terminata!"); setCheckingId(null); return; }
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
      else if (signal.label === "OVER 0.5 HT") outcome = (htHome + htAway) > 0 ? "WIN" : "LOSS";
      else if (signal.label === "BTTS SÌ") outcome = ftHome > 0 && ftAway > 0 ? "WIN" : "LOSS";
      else if (signal.label === "TRADING O0.5 HT → U2.5 LIVE") outcome = (htHome + htAway) >= 1 && total <= 2 ? "WIN" : "LOSS";
      await supabase.from("pronox_archive")
        .update({ status: outcome, ft_home_goals: ftHome, ft_away_goals: ftAway, ht_home_goals: htHome, ht_away_goals: htAway, result_checked_at: new Date().toISOString() })
        .eq("match_id", match.id).eq("prediction_label", signal.label);
      setSavedMap(prev => ({ ...prev, [key]: outcome }));
    } catch (e) { console.error(e); }
    setCheckingId(null);
  };

  const addToPlan = async (match, signal) => {
    const key = `${match.id}_${signal.label}_piano`;
    setPianoMap(prev => ({ ...prev, [key]: "saving" }));
    try {
      const { data: plan } = await supabase.from("pronox_plans").select("id").eq("status", "ACTIVE").single();
      if (!plan) { alert("Nessun piano attivo! Vai su /piano per crearne uno."); setPianoMap(prev => ({ ...prev, [key]: null })); return; }
      await supabase.from("pronox_bets").insert({
        plan_id: plan.id, match_date: date, match_time: match.time,
        league: match.league.name, home_team: match.home.name, away_team: match.away.name,
        prediction_label: signal.label, prediction_type: signal.type,
        probability: parseFloat((signal.prob * 100).toFixed(1)),
        lambda_home: parseFloat(match.lH.toFixed(3)),
        lambda_away: parseFloat(match.lA.toFixed(3)),
        status: "PENDING",
      });
      setPianoMap(prev => ({ ...prev, [key]: "saved" }));
    } catch (e) { console.error(e); setPianoMap(prev => ({ ...prev, [key]: null })); }
  };

  const filtered = matches.filter(m => {
    if (filter === "signal") return m.signals.length > 0;
    if (filter === "strong") return m.signals.some(s => s.strong);
    if (filter === "over") return m.probs.o25 > 0.58;
    if (filter === "trading") return m.signals.some(s => s.type === "TRADING");
    return true;
  });

  const strongCount = matches.filter(m => m.signals.some(s => s.strong)).length;
  const signalCount = matches.filter(m => m.signals.length > 0).length;

  const formColor = (r) => r === "W" ? "#c8f135" : r === "D" ? "#ffd060" : "#ff5c5c";

  return (
    <div style={{ minHeight: "100vh", background: "#0d0f14", color: "#e8ecf5", fontFamily: "system-ui, sans-serif", padding: "24px 16px" }}>
      <div style={{ maxWidth: 860, margin: "0 auto" }}>
        <h1 style={{ fontSize: 26, fontWeight: 800, marginBottom: 4 }}>
          PRONO<span style={{ color: "#c8f135" }}>X</span>
          <span style={{ fontSize: 13, fontWeight: 400, color: "#6b7490" }}> · partite del giorno</span>
        </h1>
        <div style={{
  fontSize: 11,
  color: "#6b7490",
  marginBottom: 12,
  letterSpacing: "0.08em"
}}>
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
                <option value="signal">Con almeno un segnale</option>
                <option value="strong">Solo segnali forti</option>
                <option value="over">Over 2.5 probabile</option>
                <option value="trading">Trading O0.5 HT + U2.5</option>
              </select>
            </div>
          </div>
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
        </div>

        <button onClick={load} disabled={loading || selectedLeagues.length === 0}
          style={{ width: "100%", padding: 14, fontSize: 15, fontWeight: 800, borderRadius: 10, border: "none", cursor: loading || selectedLeagues.length === 0 ? "not-allowed" : "pointer", background: loading || selectedLeagues.length === 0 ? "#2a2f3f" : "#c8f135", color: loading || selectedLeagues.length === 0 ? "#6b7490" : "#0d0f14", marginBottom: 20 }}>
          {loading ? `⏳ ${progress}` : selectedLeagues.length === 0 ? "Seleziona almeno una lega" : "ANALIZZA PARTITE DEL GIORNO ↗"}
        </button>

        {matches.length > 0 && (
          <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 10, marginBottom: 16 }}>
            {[
              ["Partite analizzate", matches.length, "#e8ecf5"],
              ["Con segnale", signalCount, "#4af0c4"],
              ["Segnali forti", strongCount, "#c8f135"],
            ].map(([l, v, c]) => (
              <div key={l} style={{ background: "#161920", border: "1px solid #2a2f3f", borderRadius: 10, padding: "14px 12px", textAlign: "center" }}>
                <div style={{ fontSize: 10, color: "#6b7490", fontWeight: 700, letterSpacing: "0.08em", marginBottom: 6, textTransform: "uppercase" }}>{l}</div>
                <div style={{ fontSize: 28, fontWeight: 700, color: c }}>{v}</div>
              </div>
            ))}
          </div>
        )}

        {filtered.map(m => (
          <div key={m.id} style={{ background: "#161920", border: `1px solid ${m.signals.some(s => s.strong) ? "rgba(200,241,53,0.4)" : m.signals.length > 0 ? "rgba(74,240,196,0.25)" : "#2a2f3f"}`, borderRadius: 14, padding: 18, marginBottom: 10 }}>

            <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 12 }}>
              <div style={{ fontSize: 11, color: "#6b7490", fontWeight: 700, letterSpacing: "0.08em" }}>
                {m.league.flag} {m.league.name} · {m.time}
              </div>
              <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
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
              <div style={{ color: "#6b7490", fontSize: 13, fontWeight: 600 }}>vs</div>
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

            <div style={{ display: "grid", gridTemplateColumns: "repeat(5, 1fr)", gap: 6, marginBottom: 12 }}>
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

            {m.signals.length > 0 ? (
              <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                {m.signals.map((s, i) => {
                  const key = `${m.id}_${s.label}`;
                  const savedStatus = savedMap[key];
                  const pianoStatus = pianoMap[`${m.id}_${s.label}_piano`];
                  return (
                    <div key={i} style={{ borderRadius: 8, border: `1px solid ${s.strong ? s.color + "50" : "#2a2f3f"}`, background: s.strong ? `${s.color}10` : "rgba(255,255,255,0.03)", padding: "10px 14px", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                      <span style={{ fontSize: 13, fontWeight: 700, color: s.strong ? s.color : "#e8ecf5" }}>
                        {s.strong ? "🔥 " : "→ "}{s.label}
                      </span>
                      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                        <span style={{ fontSize: 13, fontFamily: "monospace", color: s.color, fontWeight: 600 }}>{(s.prob * 100).toFixed(1)}%</span>
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
                  );
                })}
              </div>
            ) : (
              <div style={{ fontSize: 12, color: "#6b7490", padding: "8px 0" }}>— Nessun segnale chiaro · skip</div>
            )}
          </div>
        ))}

        {matches.length === 0 && !loading && (
          <div style={{ textAlign: "center", color: "#6b7490", padding: "40px 0", fontSize: 14 }}>
            {selectedLeagues.length === 0 ? "Seleziona una o due leghe e clicca Analizza" : "Seleziona le leghe e clicca Analizza"}
          </div>
        )}
      </div>
    </div>
  );
}

const lbl = { fontSize: 11, fontWeight: 700, color: "#6b7490", letterSpacing: "0.06em", textTransform: "uppercase", display: "block", marginBottom: 5 };
const inp = { background: "#0d0f14", border: "1px solid #2a2f3f", borderRadius: 8, padding: "9px 12px", color: "#e8ecf5", fontSize: 14, outline: "none", boxSizing: "border-box" };
const sel = { background: "#0d0f14", border: "1px solid #2a2f3f", borderRadius: 8, padding: "9px 12px", color: "#e8ecf5", fontSize: 14, outline: "none", boxSizing: "border-box" };
