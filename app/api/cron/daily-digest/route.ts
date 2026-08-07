import { createClient } from "@supabase/supabase-js";

const API_FOOTBALL = "https://api.football-data.org/v4";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY! // service role: bypassa RLS, serve per scrivere pronox_daily_picks e leggere tutte le email
);

const LEAGUES = [
  { code: "SA", name: "Serie A", oddsKey: "soccer_italy_serie_a" },
  { code: "PL", name: "Premier League", oddsKey: "soccer_epl" },
  { code: "BL1", name: "Bundesliga", oddsKey: "soccer_germany_bundesliga" },
  { code: "PD", name: "La Liga", oddsKey: "soccer_spain_la_liga" },
  { code: "FL1", name: "Ligue 1", oddsKey: "soccer_france_ligue_one" },
  { code: "CL", name: "Champions League", oddsKey: "soccer_uefa_champs_league" },
  { code: "ELC", name: "Championship", oddsKey: "soccer_efl_champ" },
  { code: "DED", name: "Eredivisie", oddsKey: "soccer_netherlands_eredivisie" },
  { code: "PPL", name: "Primeira Liga", oddsKey: null },
  { code: "BSA", name: "Serie B Brasile", oddsKey: "soccer_brazil_campeonato" },
];

const QUOTA_MINIMA = 1.40;

// ─── MODELLO (stesse funzioni pure di /oggi) ────────────────────

function poisson(k: number, lambda: number) {
  let p = Math.exp(-lambda);
  for (let i = 1; i <= k; i++) p *= lambda / i;
  return p;
}

function dixonColesCorr(i: number, j: number, lH: number, lA: number, rho = -0.13) {
  if (i === 0 && j === 0) return 1 - lH * lA * rho;
  if (i === 0 && j === 1) return 1 + lH * rho;
  if (i === 1 && j === 0) return 1 + lA * rho;
  if (i === 1 && j === 1) return 1 - rho;
  return 1;
}

function calcProbs(lH: number, lA: number, max = 8) {
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
  const tot = h + d + a;
  return { h: h / tot, d: d / tot, a: a / tot, o25, u25: 1 - o25, btts };
}

function timeWeight(matchDate: any, refDate: any) {
  const days = (new Date(refDate).getTime() - new Date(matchDate).getTime()) / (1000 * 60 * 60 * 24);
  return Math.exp(-days / 90);
}

function calcRatings(matches: any[], refDate: any) {
  const teams: Record<string, any> = {};
  const today = refDate || new Date().toISOString().split("T")[0];
  const finished = matches.filter(m =>
    m.status === "FINISHED" &&
    m.score?.fullTime?.home !== null &&
    m.score?.fullTime?.away !== null
  );
  if (finished.length === 0) return { teams, lgAvgHome: 1.35, lgAvgAway: 1.1 };
  let totWHome = 0, totWAway = 0, sumWHome = 0, sumWAway = 0;
  finished.forEach(m => {
    const hId = m.homeTeam.id;
    const aId = m.awayTeam.id;
    const hG = m.score.fullTime.home;
    const aG = m.score.fullTime.away;
    const w = timeWeight(m.utcDate?.split("T")[0] || today, today);
    if (!teams[hId]) teams[hId] = { name: m.homeTeam.name, hGF: 0, hGA: 0, hW: 0, aGF: 0, aGA: 0, aW: 0, form: [] };
    if (!teams[aId]) teams[aId] = { name: m.awayTeam.name, hGF: 0, hGA: 0, hW: 0, aGF: 0, aGA: 0, aW: 0, form: [] };
    teams[hId].hGF += hG * w; teams[hId].hGA += aG * w; teams[hId].hW += w;
    teams[aId].aGF += aG * w; teams[aId].aGA += hG * w; teams[aId].aW += w;
    const hRes = hG > aG ? "W" : hG === aG ? "D" : "L";
    const aRes = aG > hG ? "W" : aG === hG ? "D" : "L";
    teams[hId].form.push({ res: hRes, date: m.utcDate });
    teams[aId].form.push({ res: aRes, date: m.utcDate });
    sumWHome += hG * w; totWHome += w;
    sumWAway += aG * w; totWAway += w;
  });
  const lgAvgHome = totWHome > 0 ? sumWHome / totWHome : 1.35;
  const lgAvgAway = totWAway > 0 ? sumWAway / totWAway : 1.1;
  Object.values(teams).forEach((t) => {
    t.attH = t.hW > 0 ? (t.hGF / t.hW) / lgAvgHome : 1;
    t.defH = t.hW > 0 ? (t.hGA / t.hW) / lgAvgAway : 1;
    t.attA = t.aW > 0 ? (t.aGF / t.aW) / lgAvgAway : 1;
    t.defA = t.aW > 0 ? (t.aGA / t.aW) / lgAvgHome : 1;
    t.form.sort((a: any, b: any) => new Date(b.date).getTime() - new Date(a.date).getTime());
    const last5 = t.form.slice(0, 5);
    const formScore = last5.reduce((s: number, f: any) => s + (f.res === "W" ? 3 : f.res === "D" ? 1 : 0), 0);
    t.formRating = last5.length > 0 ? formScore / (last5.length * 3) : 0.5;
    const hAvg = t.hW > 0 ? t.hGF / t.hW : lgAvgHome;
    const aAvg = t.aW > 0 ? t.aGF / t.aW : lgAvgAway;
    t.homeAdvantage = hAvg > 0 && aAvg > 0 ? hAvg / aAvg : 1.1;
  });
  return { teams, lgAvgHome, lgAvgAway };
}

function calcH2H(allMatches: any[], teamHId: any, teamAId: any) {
  const h2h = allMatches.filter(m =>
    m.status === "FINISHED" && (
      (m.homeTeam.id === teamHId && m.awayTeam.id === teamAId) ||
      (m.homeTeam.id === teamAId && m.awayTeam.id === teamHId)
    )
  ).slice(-6);
  if (h2h.length === 0) return { bias: 0 };
  let hWins = 0, aWins = 0;
  h2h.forEach(m => {
    const hG = m.score.fullTime.home;
    const aG = m.score.fullTime.away;
    if (m.homeTeam.id === teamHId) { if (hG > aG) hWins++; else if (aG > hG) aWins++; }
    else { if (aG > hG) hWins++; else if (hG > aG) aWins++; }
  });
  return { bias: (hWins - aWins) / h2h.length * 0.08 };
}

function getLambdas(teamH: any, teamA: any, lgAvgHome: number, lgAvgAway: number, h2hBias: number) {
  let lH = teamH.attH * teamA.defA * lgAvgHome;
  let lA = teamA.attA * teamH.defH * lgAvgAway;
  const homeAdv = Math.min(Math.max(teamH.homeAdvantage, 0.8), 1.4);
  lH *= homeAdv;
  lH *= (0.85 + teamH.formRating * 0.30);
  lA *= (0.85 + teamA.formRating * 0.30);
  lH *= (1 + h2hBias);
  lA *= (1 - h2hBias);
  return { lH: Math.max(0.3, Math.min(3.0, lH)), lA: Math.max(0.3, Math.min(3.0, lA)) };
}

function getSignals(probs: any) {
  const signals = [];
  if (probs.h > 0.62) signals.push({ label: "CASA VINCE", prob: probs.h });
  if (probs.a > 0.55) signals.push({ label: "OSPITE VINCE", prob: probs.a });
  if (probs.o25 > 0.65) signals.push({ label: "OVER 2.5", prob: probs.o25 });
  if (probs.btts > 0.60) signals.push({ label: "BTTS SÌ", prob: probs.btts });
  if (probs.u25 > 0.65) signals.push({ label: "UNDER 2.5", prob: probs.u25 });
  signals.sort((a: any, b: any) => b.prob - a.prob);
  return signals;
}

// ─── QUOTE: stessa logica di recupero/matching già usata in /oggi ──

async function fetchOddsForLeague(oddsKey: string | null, date: string) {
  if (!oddsKey) return {};
  try {
    const r = await fetch(`https://sergioapicella.it/api/odds?endpoint=sports/${oddsKey}/odds&regions=eu&markets=h2h,totals&dateFormat=iso&oddsFormat=decimal`);
    const data = await r.json();
    if (!Array.isArray(data)) return {};
    const dayStart = new Date(date + "T00:00:00Z").getTime();
    const dayEnd = new Date(date + "T23:59:59Z").getTime();
    const oddsMap: Record<string, any> = {};
    data.forEach((game: any) => {
      const gameTime = new Date(game.commence_time).getTime();
      if (gameTime < dayStart || gameTime > dayEnd) return;
      const key = `${game.home_team}__${game.away_team}`;
      let o1: number | null = null, oX: number | null = null, o2: number | null = null, oOver25: number | null = null, oUnder25: number | null = null;
      game.bookmakers?.forEach((bk: any) => {
        bk.markets?.forEach((mkt: any) => {
          if (mkt.key === "h2h") {
            mkt.outcomes?.forEach((o: any) => {
              if (o.name === game.home_team) o1 = o1 ? (o1 + o.price) / 2 : o.price;
              else if (o.name === game.away_team) o2 = o2 ? (o2 + o.price) / 2 : o.price;
              else oX = oX ? (oX + o.price) / 2 : o.price;
            });
          }
          if (mkt.key === "totals") {
            mkt.outcomes?.forEach((o: any) => {
              if (o.name === "Over" && Math.abs(o.point - 2.5) < 0.01) oOver25 = oOver25 ? (oOver25 + o.price) / 2 : o.price;
              if (o.name === "Under" && Math.abs(o.point - 2.5) < 0.01) oUnder25 = oUnder25 ? (oUnder25 + o.price) / 2 : o.price;
            });
          }
        });
      });
      oddsMap[key] = { o1, oX, o2, oOver25, oUnder25, homeTeam: game.home_team, awayTeam: game.away_team };
    });
    return oddsMap;
  } catch (e) { return {}; }
}

const STOP_WORDS = ["fc", "cf", "sc", "ac", "bc", "bk", "fk", "sk", "if", "ik",
  "club", "united", "city", "town", "athletic", "athletics", "sport", "sports",
  "deportivo", "deportiva", "atletico", "atletica", "real", "racing", "river",
  "plate", "union", "the", "de", "do", "da", "del", "di", "los", "las", "le",
  "la", "el", "al", "1", "2", "afc", "rsc", "vfb", "vfl", "tsg", "rb", "rd"];

function normalizeName(name: string) {
  return name.toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .split(/\s+/)
    .filter((w) => w.length > 1 && !STOP_WORDS.includes(w))
    .join(" ")
    .trim();
}

function nameSimilarity(a: string, b: string) {
  const wa = new Set(normalizeName(a).split(" ").filter((w) => w.length > 2));
  const wb = new Set(normalizeName(b).split(" ").filter((w) => w.length > 2));
  if (wa.size === 0 || wb.size === 0) return 0;
  let common = 0;
  wa.forEach((w) => { if (wb.has(w)) common++; });
  wa.forEach((w) => { wb.forEach((wb2) => { if (w.length > 4 && (w.includes(wb2) || wb2.includes(w))) common += 0.5; }); });
  return common / Math.max(wa.size, wb.size);
}

function matchOdds(oddsMap: Record<string, any>, homeName: string, awayName: string) {
  const exactKey = `${homeName}__${awayName}`;
  if (oddsMap[exactKey]) return oddsMap[exactKey];

  let bestScore = 0;
  let bestMatch: any = null;
  for (const [, v] of Object.entries(oddsMap)) {
    const simH = nameSimilarity(homeName, v.homeTeam || "");
    const simA = nameSimilarity(awayName, v.awayTeam || "");
    const score = simH + simA;
    if (simH > 0.3 && simA > 0.3 && score > bestScore) {
      bestScore = score;
      bestMatch = v;
    }
  }
  if (!bestMatch) {
    for (const [, v] of Object.entries(oddsMap)) {
      const simH = nameSimilarity(homeName, v.awayTeam || "");
      const simA = nameSimilarity(awayName, v.homeTeam || "");
      const score = simH + simA;
      if (simH > 0.3 && simA > 0.3 && score > bestScore) {
        bestScore = score;
        bestMatch = { ...v, o1: v.o2, o2: v.o1, homeTeam: v.awayTeam, awayTeam: v.homeTeam };
      }
    }
  }
  return bestMatch;
}

function quotaPerSegnale(oddsData: any, label: string): number | null {
  if (!oddsData) return null;
  if (label === "CASA VINCE") return oddsData.o1 ?? null;
  if (label === "OSPITE VINCE") return oddsData.o2 ?? null;
  if (label === "OVER 2.5") return oddsData.oOver25 ?? null;
  if (label === "UNDER 2.5") return oddsData.oUnder25 ?? null;
  return null; // BTTS non ha una quota mappata in questa fonte
}

function currentSeasonFor(code: string) {
  const now = new Date();
  const year = now.getFullYear();
  const month = now.getMonth() + 1;
  if (code === "BSA") return String(year);
  return String(month >= 7 ? year : year - 1);
}

async function fetchSeasonMatches(code: string) {
  const season = currentSeasonFor(code);
  // Cache-first: riusa i dati già scaricati oggi da /oggi, se presenti
  const { data: cached } = await supabase
    .from("pronox_cache")
    .select("data, updated_at")
    .eq("league_code", code)
    .eq("season", season)
    .single();
  const today = new Date().toISOString().split("T")[0];
  if (cached && cached.updated_at?.split("T")[0] === today) {
    return cached.data;
  }
  try {
    const r = await fetch(`${API_FOOTBALL}/competitions/${code}/matches?season=${season}`, {
      headers: { "X-Auth-Token": process.env.FOOTBALL_DATA_KEY! },
    });
    const d = await r.json();
    const matches = d.matches || [];
    if (matches.length > 0) {
      await supabase.from("pronox_cache").upsert(
        { league_code: code, season, data: matches, updated_at: new Date().toISOString() },
        { onConflict: "league_code,season" }
      );
    }
    return matches;
  } catch (e) {
    return cached?.data || [];
  }
}

// ─── STEP 1: verifica i pronostici ancora in sospeso ────────────
// Controlla TUTTI i pronostici PENDING con data uguale o precedente a ieri,
// non solo quelli di esattamente ieri. Così, se una verifica fallisce un
// giorno (es. il cron gira prima che l'import tennis delle 12:00 abbia
// scritto i risultati), il pronostico non resta bloccato per sempre: viene
// ritentato automaticamente ai run successivi finché non trova l'esito.

async function verifyYesterdayPicks(yesterday: string) {
  const { data: picks } = await supabase
    .from("pronox_daily_picks")
    .select("*")
    .eq("status", "PENDING")
    .lte("pick_date", yesterday);

  if (!picks || picks.length === 0) return [];

  const verified = [];
  for (const pick of picks) {
    try {
      if (pick.sport === "tennis") {
        const outcome = await verifyTennisPick(pick, yesterday);
        if (outcome === null) continue; // partita non ancora nel database (es. rinviata)
        await supabase.from("pronox_daily_picks").update({ status: outcome }).eq("id", pick.id);
        verified.push({ ...pick, status: outcome });
        continue;
      }

      const r = await fetch(`${API_FOOTBALL}/matches/${pick.match_id_fd}`, {
        headers: { "X-Auth-Token": process.env.FOOTBALL_DATA_KEY! },
      });
      const d = await r.json();
      const m = d.match || d;
      if (!m || m.status !== "FINISHED") continue;

      const ftHome = m.score?.fullTime?.home ?? 0;
      const ftAway = m.score?.fullTime?.away ?? 0;
      const total = ftHome + ftAway;
      let outcome = "LOSS";
      if (pick.prediction_label === "CASA VINCE") outcome = ftHome > ftAway ? "WIN" : "LOSS";
      else if (pick.prediction_label === "OSPITE VINCE") outcome = ftAway > ftHome ? "WIN" : "LOSS";
      else if (pick.prediction_label === "OVER 2.5") outcome = total > 2.5 ? "WIN" : "LOSS";
      else if (pick.prediction_label === "UNDER 2.5") outcome = total < 2.5 ? "WIN" : "LOSS";
      else if (pick.prediction_label === "BTTS SÌ") outcome = ftHome > 0 && ftAway > 0 ? "WIN" : "LOSS";

      await supabase.from("pronox_daily_picks").update({ status: outcome }).eq("id", pick.id);
      verified.push({ ...pick, status: outcome, ftHome, ftAway });
    } catch (e) { /* partita non trovata/rinviata, resta PENDING */ }
  }
  return verified;
}

// Il pronostico tennis è sempre "PlayerX vince" — cerchiamo la partita già
// giocata tra i due giocatori intorno alla data del pronostico e vediamo
// se chi era stato indicato come favorito ha vinto davvero.
async function verifyTennisPick(pick: any, pickDate: string) {
  if (!pick.player_a_id || !pick.player_b_id) return null;

  const dateFrom = pickDate;
  const dateTo = new Date(new Date(pickDate).getTime() + 2 * 86400000).toISOString().split("T")[0];

  const { data } = await supabase
    .from("tennis_matches")
    .select("winner_id, loser_id, tourney_date")
    .or(
      `and(winner_id.eq.${pick.player_a_id},loser_id.eq.${pick.player_b_id}),and(winner_id.eq.${pick.player_b_id},loser_id.eq.${pick.player_a_id})`
    )
    .gte("tourney_date", dateFrom)
    .lte("tourney_date", dateTo)
    .limit(1);

  if (!data || data.length === 0) return null; // non ancora giocata/importata

  const winnerId = data[0].winner_id;
  // prediction_label contiene "NomeGiocatore vince" — controlliamo se il nome
  // del vincitore previsto (home_team = playerA, away_team = playerB) coincide
  const predictedWinnerIsA = pick.prediction_label.startsWith(pick.home_team);
  const predictedWinnerId = predictedWinnerIsA ? pick.player_a_id : pick.player_b_id;
  return winnerId === predictedWinnerId ? "WIN" : "LOSS";
}

// ─── STEP 2: calcola i pronostici di domani ─────────────────────

async function computeTomorrowPicks(tomorrow: string) {
  // Anti-doppione: se la route viene chiamata più volte lo stesso giorno
  // (es. un test manuale + il cron automatico), i pronostici di "domani"
  // sono già stati calcolati e salvati — li riusiamo invece di rifarli
  // da capo e reinserirli, cosa che creava le righe duplicate.
  const { data: existing } = await supabase
    .from("pronox_daily_picks")
    .select("*")
    .eq("pick_date", tomorrow);
  if (existing && existing.length > 0) {
    return existing;
  }

  const allPicks = [];

  for (const league of LEAGUES) {
    const matches = await fetchSeasonMatches(league.code);
    if (matches.length === 0) continue;

    const { teams, lgAvgHome, lgAvgAway } = calcRatings(matches, tomorrow);

    const tomorrowMatches = matches.filter((m: any) =>
      m.utcDate?.split("T")[0] === tomorrow && (m.status === "SCHEDULED" || m.status === "TIMED")
    );
    if (tomorrowMatches.length === 0) continue;

    // Una chiamata sola per lega (usa la cache lato /api/odds, come già in /oggi)
    const oddsMap = await fetchOddsForLeague(league.oddsKey, tomorrow);

    for (const m of tomorrowMatches) {
      const teamH = teams[m.homeTeam.id];
      const teamA = teams[m.awayTeam.id];
      if (!teamH || !teamA) continue;

      const h2h = calcH2H(matches, m.homeTeam.id, m.awayTeam.id);
      const { lH, lA } = getLambdas(teamH, teamA, lgAvgHome, lgAvgAway, h2h.bias);
      const probs = calcProbs(lH, lA);
      const signals = getSignals(probs);
      if (signals.length === 0) continue;

      const oddsData = matchOdds(oddsMap, m.homeTeam.name, m.awayTeam.name);

      // Prende il segnale più forte che rispetta la quota minima. Se il
      // migliore ha quota troppo bassa (o inesistente sul mercato), prova
      // il successivo per probabilità sulla stessa partita prima di
      // scartarla del tutto. Un segnale senza quota nota (es. BTTS, che
      // questa fonte non copre) non viene escluso solo per quello.
      let chosen: any = null;
      let chosenQuota: number | null = null;
      for (const s of signals) {
        const q = quotaPerSegnale(oddsData, s.label);
        if (q === null || q >= QUOTA_MINIMA) {
          chosen = s;
          chosenQuota = q;
          break;
        }
      }
      if (!chosen) continue; // tutti i segnali di questa partita sotto quota minima

      allPicks.push({
        pick_date: tomorrow,
        sport: "calcio",
        match_id_fd: m.id,
        league: league.name,
        home_team: m.homeTeam.name,
        away_team: m.awayTeam.name,
        match_time: m.utcDate,
        prediction_label: chosen.label,
        probability: parseFloat((chosen.prob * 100).toFixed(1)),
        quota: chosenQuota,
        status: "PENDING",
      });
    }
  }

  // Prendi i 5 migliori per probabilità, su tutte le leghe di calcio
  allPicks.sort((a: any, b: any) => b.probability - a.probability);
  const bestFootball = allPicks.slice(0, 5);

  const bestTennis = await computeTomorrowTennisPicks(tomorrow);

  const best = [...bestFootball, ...bestTennis];
  if (best.length > 0) {
    const { error } = await supabase.from("pronox_daily_picks").insert(best);
    if (error) {
      // Caso raro: due chiamate quasi simultanee sono arrivate qui insieme.
      // Il vincolo unico sul database ha bloccato il doppione: rileggiamo
      // quello che è già stato salvato dall'altra chiamata.
      const { data: existingAfterRace } = await supabase
        .from("pronox_daily_picks")
        .select("*")
        .eq("pick_date", tomorrow);
      return existingAfterRace || [];
    }
  }
  return best;
}

async function computeTomorrowTennisPicks(tomorrow: string) {
  try {
    const r = await fetch(`https://sergioapicella.it/api/tennis/matches?date=${tomorrow}`);
    const d = await r.json();
    const rawMatches = d.matches || [];

    const picks = rawMatches.map((m: any) => {
      let label, prob, playerAWins;
      if (m.isValueA) { label = `${m.playerA.name} vince`; prob = m.probA; playerAWins = true; }
      else if (m.isValueB) { label = `${m.playerB.name} vince`; prob = m.probB; playerAWins = false; }
      else if (!m.lowDataPlayer) {
        playerAWins = m.probA >= m.probB;
        label = `${playerAWins ? m.playerA.name : m.playerB.name} vince`;
        prob = playerAWins ? m.probA : m.probB;
      } else {
        return null; // dati insufficienti, non pubblichiamo il pronostico
      }
      if (!m.playerA.matchedId || !m.playerB.matchedId) return null; // serve l'id per poter verificare dopo

      // La quota del giocatore su cui puntiamo — già presente nella risposta
      // di /api/tennis/matches (oddsA/oddsB), usata lì per calcolare il value.
      const quota = playerAWins ? (m.oddsA ?? null) : (m.oddsB ?? null);
      if (quota !== null && quota < QUOTA_MINIMA) return null; // sotto quota minima, scartato

      return {
        pick_date: tomorrow,
        sport: "tennis",
        player_a_id: m.playerA.matchedId,
        player_b_id: m.playerB.matchedId,
        league: `🎾 ${m.tournament || m.tour}`,
        home_team: m.playerA.name,
        away_team: m.playerB.name,
        match_time: m.commenceTime,
        prediction_label: label,
        probability: parseFloat((prob * 100).toFixed(1)),
        quota,
        status: "PENDING",
      };
    }).filter(Boolean);

    picks.sort((a: any, b: any) => b.probability - a.probability);
    return picks.slice(0, 3);
  } catch (e) {
    return [];
  }
}

// ─── STEP 3: costruisci e invia la mail ─────────────────────────

function buildEmailHtml(yesterdayResults: any[], tomorrowPicks: any[], yesterday: string, tomorrow: string) {
  const wins = yesterdayResults.filter((r: any) => r.status === "WIN").length;
  const losses = yesterdayResults.filter((r: any) => r.status === "LOSS").length;
  const totalDone = wins + losses;
  const winRate = totalDone > 0 ? Math.round((wins / totalDone) * 100) : null;

  const renderRow = (r: any, showPercent: boolean) => `
        <div style="padding:10px 0;border-bottom:1px solid #2a2f3f;">
          <span style="font-size:12px;color:#6b7490;">${r.league}</span><br/>
          <strong style="color:#e8ecf5;">${r.home_team} vs ${r.away_team}</strong><br/>
          <span style="font-size:13px;color:#4af0c4;">${r.prediction_label}</span>
          ${showPercent && r.quota ? `<span style="font-size:12px;color:#6b7490;"> · quota @${Number(r.quota).toFixed(2)}</span>` : ""}
          <span style="float:right;font-weight:800;color:${
            showPercent ? "#c8f135" : r.status === "WIN" ? "#c8f135" : "#ff5c5c"
          };">
            ${showPercent ? `${r.probability}%` : r.status === "WIN" ? "✓ WIN" : "✗ LOSS"}
          </span>
        </div>`;

  const yesterdayFootball = yesterdayResults.filter((r: any) => r.sport !== "tennis");
  const yesterdayTennis = yesterdayResults.filter((r: any) => r.sport === "tennis");
  const tomorrowFootball = tomorrowPicks.filter((r: any) => r.sport !== "tennis");
  const tomorrowTennis = tomorrowPicks.filter((r: any) => r.sport === "tennis");

  const resultsHtml = yesterdayResults.length === 0
    ? `<p style="color:#6b7490;font-size:13px;">Nessun pronostico da verificare ieri.</p>`
    : `
      ${yesterdayFootball.length > 0 ? `<div style="font-size:11px;color:#4af0c4;font-weight:700;margin:10px 0 4px;">⚽ CALCIO</div>${yesterdayFootball.map((r: any) => renderRow(r, false)).join("")}` : ""}
      ${yesterdayTennis.length > 0 ? `<div style="font-size:11px;color:#4af0c4;font-weight:700;margin:14px 0 4px;">🎾 TENNIS</div>${yesterdayTennis.map((r: any) => renderRow(r, false)).join("")}` : ""}
    `;

  const picksHtml = tomorrowPicks.length === 0
    ? `<p style="color:#6b7490;font-size:13px;">Nessun pronostico forte per domani.</p>`
    : `
      ${tomorrowFootball.length > 0 ? `<div style="font-size:11px;color:#4af0c4;font-weight:700;margin:10px 0 4px;">⚽ CALCIO</div>${tomorrowFootball.map((r: any) => renderRow(r, true)).join("")}` : ""}
      ${tomorrowTennis.length > 0 ? `<div style="font-size:11px;color:#4af0c4;font-weight:700;margin:14px 0 4px;">🎾 TENNIS</div>${tomorrowTennis.map((r: any) => renderRow(r, true)).join("")}` : ""}
    `;

  return `
  <div style="background:#0d0f14;padding:32px 20px;font-family:system-ui,sans-serif;">
    <div style="max-width:520px;margin:0 auto;">
      <h1 style="color:#e8ecf5;font-size:24px;margin-bottom:4px;">PRONO<span style="color:#c8f135;">X</span></h1>
      <p style="color:#6b7490;font-size:13px;margin-top:0;">Il tuo riepilogo giornaliero</p>

      <div style="background:#161920;border:1px solid #2a2f3f;border-radius:14px;padding:20px;margin-bottom:16px;">
        <div style="font-size:11px;font-weight:700;color:#6b7490;letter-spacing:0.08em;text-transform:uppercase;margin-bottom:10px;">
          Risultati aggiornati ${winRate !== null ? `· ${wins}/${totalDone} vinte (${winRate}%)` : ""}
        </div>
        ${resultsHtml}
      </div>

      <div style="background:#161920;border:1px solid #2a2f3f;border-radius:14px;padding:20px;">
        <div style="font-size:11px;font-weight:700;color:#6b7490;letter-spacing:0.08em;text-transform:uppercase;margin-bottom:10px;">
          Cosa giocare domani
        </div>
        ${picksHtml}
      </div>

      <div style="text-align:center;margin-top:24px;">
        <a href="https://sergioapicella.it/oggi" style="display:inline-block;padding:12px 28px;background:#c8f135;color:#0d0f14;font-weight:800;border-radius:10px;text-decoration:none;font-size:14px;">
          Vedi tutti i pronostici →
        </a>
        <div style="margin-top:12px;">
          <a href="https://sergioapicella.it/storico-pronostici" style="display:inline-block;padding:10px 24px;background:transparent;border:1px solid #2a2f3f;color:#e8ecf5;font-weight:700;border-radius:10px;text-decoration:none;font-size:13px;">
            📊 Guarda lo storico completo
          </a>
        </div>
      </div>
    </div>
  </div>`;
}

async function sendDigestEmail(html: string, recipients: string[]) {
  if (recipients.length === 0) return { sent: 0, failed: 0 };

  // Prima mandavamo un'unica mail con tutti in BCC e un indirizzo fittizio
  // come "to" (noreply@sergioapicella.it). Quell'indirizzo è rimbalzato una
  // volta ed è finito nella lista di soppressione di Resend: da quel momento
  // OGNI mail con quell'indirizzo come "to" veniva scartata in silenzio,
  // anche se i veri destinatari erano nel BCC — risultato: nessuno riceveva
  // più nulla, senza nessun errore visibile.
  //
  // Ora mandiamo una mail separata per ciascun iscritto, ognuno come "to"
  // reale. Stessa privacy di prima (nessuno vede gli altri destinatari),
  // ma un indirizzo problematico blocca solo se stesso, non tutti gli altri.
  let sent = 0;
  let failed = 0;

  for (const email of recipients) {
    try {
      const res = await fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${process.env.RESEND_API_KEY}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          from: "PronoX · Sergio Apicella <noreply@sergioapicella.it>",
          to: email,
          subject: "🎾⚽ PronoX — risultati di ieri e pronostici di domani",
          html,
        }),
      });
      if (res.ok) sent++;
      else {
        failed++;
        console.error(`Invio fallito a ${email}:`, await res.text());
      }
    } catch (e) {
      failed++;
      console.error(`Errore invio a ${email}:`, e);
    }
  }

  return { sent, failed };
}

// ─── ROUTE ───────────────────────────────────────────────────────

export async function GET(request: Request) {
  // Protezione: solo Vercel Cron (o chi conosce il secret) può triggerare questa route
  const authHeader = request.headers.get("authorization");
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  const today = new Date();
  const yesterday = new Date(today);
  yesterday.setDate(yesterday.getDate() - 1);
  const tomorrow = new Date(today);
  tomorrow.setDate(tomorrow.getDate() + 1);

  const yesterdayStr = yesterday.toISOString().split("T")[0];
  const tomorrowStr = tomorrow.toISOString().split("T")[0];

  const yesterdayResults = await verifyYesterdayPicks(yesterdayStr);
  const tomorrowPicks = await computeTomorrowPicks(tomorrowStr);

  const { data: profiles } = await supabase.from("user_profiles").select("email");
  const recipients = (profiles || []).map((p: any) => p.email).filter(Boolean);

  const html = buildEmailHtml(yesterdayResults, tomorrowPicks, yesterdayStr, tomorrowStr);
  const emailResult = await sendDigestEmail(html, recipients);

  return Response.json({
    ok: true,
    yesterdayVerified: yesterdayResults.length,
    tomorrowPicks: tomorrowPicks.length,
    emailsSent: emailResult.sent,
    emailsFailed: emailResult.failed,
  });
}
