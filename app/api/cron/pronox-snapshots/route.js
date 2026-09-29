// =====================================================================
// PronoX · Cron fotografie pronostici
// Ogni giorno fotografa TUTTE le partite del giorno dopo, su tutti i
// mercati, anche quelle che il modello non consiglia. È la memoria da
// cui il modello futuro imparerà. Non tocca nulla di ciò che vedono gli
// utenti: scrive solo nella tabella prediction_snapshots.
//
// Esecuzione manuale (test):
//   /api/cron/pronox-snapshots?date=2026-10-04&horizon=manual
// =====================================================================

import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import {
  LEAGUES, DOMESTIC_LEAGUES, CUP_LEAGUES,
  MODEL_NAME, MODEL_VERSION,
  calcRatings, currentSeasonFor, getSeasonData,
  fetchOddsForLeague, matchOdds, computeFixtureModel,
  calibrateFootballProbability,
} from "../../../../lib/pronox/footballModel";

export const dynamic = "force-dynamic";
export const maxDuration = 300; // i download stagionali possono richiedere tempo

const FD_BASE = "https://api.football-data.org/v4";
const FD_MIN_GAP_MS = 6500;      // piano free: massimo 10 chiamate al minuto
const HORIZONS = ["opening", "t24h", "t1h", "manual"];

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// ─── football-data.org diretto (lato server, con pausa anti-limite) ──
let lastFdCall = 0;
async function fdGet(path) {
  const wait = lastFdCall + FD_MIN_GAP_MS - Date.now();
  if (wait > 0) await sleep(wait);
  lastFdCall = Date.now();
  const r = await fetch(`${FD_BASE}/${path}`, {
    headers: { "X-Auth-Token": process.env.FOOTBALL_DATA_KEY },
    cache: "no-store",
  });
  if (!r.ok) throw new Error(`football-data ${r.status} su ${path}`);
  return r.json();
}

const fetchSeasonMatchesServer = async (code, season) => {
  const d = await fdGet(`competitions/${code}/matches?season=${season}`);
  return d.matches || [];
};

// ─── utilità ────────────────────────────────────────────────────────
function tomorrowUTC() {
  const d = new Date();
  d.setUTCDate(d.getUTCDate() + 1);
  return d.toISOString().split("T")[0];
}

function addDays(dateStr, n) {
  const d = new Date(`${dateStr}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().split("T")[0];
}

// Partite di una data (UTC). Prima prova con una sola chiamata globale;
// se non trova nulla, interroga campionato per campionato (come fa /oggi).
async function getDayMatches(date, coveredCodes, report) {
  const sameDay = (m) => (m.utcDate || "").startsWith(date);
  let found = [];
  try {
    const d = await fdGet(`matches?dateFrom=${date}&dateTo=${addDays(date, 1)}`);
    const raw = d.matches || [];
    found = raw.filter((m) => sameDay(m) && coveredCodes.includes(m.competition?.code));
    report.debug.global_raw = raw.length;
    report.debug.global_found = found.length;
  } catch (e) {
    report.debug.global_error = String(e?.message || e);
  }
  if (found.length > 0) { report.debug.method = "globale"; return found; }

  report.debug.method = "per campionato";
  report.debug.per_league = {};
  for (const code of coveredCodes) {
    try {
      const d = await fdGet(`competitions/${code}/matches?dateFrom=${date}&dateTo=${date}`);
      const list = (d.matches || []).map((m) => ({
        ...m,
        competition: m.competition?.code ? m.competition : { ...(m.competition || {}), code },
      }));
      report.debug.per_league[code] = list.length;
      found.push(...list);
    } catch (e) {
      report.debug.per_league[code] = `errore: ${String(e?.message || e)}`;
    }
  }
  return found;
}

function cleanProb(p) {
  const clamped = Math.min(0.99999, Math.max(0.00001, p));
  return Math.round(clamped * 100000) / 100000;
}

function cleanOdds(o) {
  if (!o || !Number.isFinite(o) || o <= 1) return null;
  return Math.round(o * 1000) / 1000;
}

function newsEventSummary(ev) {
  if (!ev) return null;
  return {
    tipo: ev.tipo ?? null,
    giocatore: ev.giocatore ?? null,
    gravita: ev.gravita ?? null,
    affidabilita: ev.affidabilita ?? null,
    processato_at: ev.processato_at ?? null,
  };
}

// ─── costruzione delle righe per una partita ───────────────────────
function buildSnapshotRows({ fix, code, model, oddsData, horizon }) {
  const { probs } = model;
  const rh = model.resH?.rating;
  const ra = model.resA?.rating;

  const features = {
    lambda_home: model.lH,
    lambda_away: model.lA,
    lambda_home_pre_news: model.lHBase,
    lambda_away_pre_news: model.lABase,
    league_avg_home: model.lgAvgHome,
    league_avg_away: model.lgAvgAway,
    has_ratings: model.hasRatings,
    rating_source_home: model.resH?.leagueCode ?? null,
    rating_source_away: model.resA?.leagueCode ?? null,
    home: rh ? {
      att_home: rh.attH, def_home: rh.defH,
      form_rating: rh.formRating, form: rh.formStr, home_advantage: rh.homeAdvantage,
    } : null,
    away: ra ? {
      att_away: ra.attA, def_away: ra.defA,
      form_rating: ra.formRating, form: ra.formStr,
    } : null,
    h2h: model.h2h,
    news: {
      home_multiplier: model.newsImpactH.multiplier,
      away_multiplier: model.newsImpactA.multiplier,
      home_event: newsEventSummary(model.newsImpactH.appliedEvent),
      away_event: newsEventSummary(model.newsImpactA.appliedEvent),
    },
    probs_all: probs,
  };

  const marketOdds = oddsData ? {
    avg_eu: {
      "1": oddsData.o1 ?? null, "X": oddsData.oX ?? null, "2": oddsData.o2 ?? null,
      over25: oddsData.oOver25 ?? null, under25: oddsData.oUnder25 ?? null,
    },
    matched_home: oddsData.homeTeam ?? null,
    matched_away: oddsData.awayTeam ?? null,
    source: "the-odds-api",
    captured_at: new Date().toISOString(),
  } : {};

  // label = nome del segnale in /oggi, serve per la calibrazione (null = non calibrato)
  const selections = [
    { market: "1X2",   selection: "1",     prob: probs.h,        odds: oddsData?.o1,       label: "CASA VINCE" },
    { market: "1X2",   selection: "X",     prob: probs.d,        odds: oddsData?.oX,       label: null },
    { market: "1X2",   selection: "2",     prob: probs.a,        odds: oddsData?.o2,       label: "OSPITE VINCE" },
    { market: "OU2.5", selection: "over",  prob: probs.o25,      odds: oddsData?.oOver25,  label: "OVER 2.5" },
    { market: "OU2.5", selection: "under", prob: probs.u25,      odds: oddsData?.oUnder25, label: "UNDER 2.5" },
    { market: "BTTS",  selection: "yes",   prob: probs.btts,     odds: null,               label: "BTTS SÌ" },
    { market: "BTTS",  selection: "no",    prob: 1 - probs.btts, odds: null,               label: null },
  ];

  const base = {
    sport: "football",
    event_id: `fd_${fix.id}`,
    competition: code,
    event_start: fix.utcDate,
    horizon,
    market_odds: marketOdds,
    features,
    feature_schema_version: 1,
  };

  const rows = [];
  for (const s of selections) {
    const odds = cleanOdds(s.odds);
    // Riga 1: probabilità grezza del Dixon-Coles
    rows.push({
      ...base,
      market: s.market,
      selection: s.selection,
      model_name: MODEL_NAME,
      model_version: `${MODEL_VERSION}_raw`,
      model_prob: cleanProb(s.prob),
      odds_taken: odds,
      odds_bookmaker: odds ? "media_eu" : null,
    });
    // Riga 2: probabilità calibrata (quella mostrata in /oggi), solo dove esiste
    if (s.label) {
      rows.push({
        ...base,
        market: s.market,
        selection: s.selection,
        model_name: `${MODEL_NAME}_calibrated`,
        model_version: `${MODEL_VERSION}_cal`,
        model_prob: cleanProb(calibrateFootballProbability(s.label, s.prob, oddsData)),
        odds_taken: odds,
        odds_bookmaker: odds ? "media_eu" : null,
      });
    }
  }
  return rows;
}

// ─── handler ────────────────────────────────────────────────────────
export async function GET(request) {
  // Protezione: se CRON_SECRET è impostato, Vercel lo invia da solo
  const secret = process.env.CRON_SECRET;
  if (secret && request.headers.get("authorization") !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "non autorizzato" }, { status: 401 });
  }

  const url = new URL(request.url);
  const date = url.searchParams.get("date") || tomorrowUTC();
  const horizon = url.searchParams.get("horizon") || "t24h";
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || !HORIZONS.includes(horizon)) {
    return NextResponse.json({ error: "parametri non validi" }, { status: 400 });
  }

  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY,
    { auth: { persistSession: false } }
  );

  const report = { date, horizon, leagues: {}, fixtures: 0, skipped_started: 0, rows: 0, inserted: 0, odds_matched: 0, errors: [], debug: {} };

  try {
    // 1. Partite del giorno
    const coveredCodes = LEAGUES.map((l) => l.code);
    const dayMatches = await getDayMatches(date, coveredCodes, report);
    const minStart = Date.now() + 5 * 60 * 1000;
    const fixturesByCode = {};
    for (const fix of dayMatches) {
      const code = fix.competition?.code;
      if (!coveredCodes.includes(code)) continue;
      if (!["SCHEDULED", "TIMED"].includes(fix.status)) continue;
      if (!fix.utcDate || new Date(fix.utcDate).getTime() < minStart) { report.skipped_started++; continue; }
      (fixturesByCode[code] ||= []).push(fix);
    }
    const playingCodes = Object.keys(fixturesByCode);
    if (playingCodes.length === 0) {
      return NextResponse.json({ ...report, note: "nessuna partita coperta in questa data" });
    }

    // 2. Ratings (stessa logica di /oggi, riferiti alla data delle partite)
    const needsDomestic = playingCodes.some((c) => CUP_LEAGUES.includes(c));
    const leaguesToLoad = needsDomestic ? [...new Set([...playingCodes, ...DOMESTIC_LEAGUES])] : playingCodes;
    const allRatings = {}, allAvgs = {}, allMatches = {};
    for (const code of leaguesToLoad) {
      const seasonMatches = await getSeasonData(code, supabase, undefined, fetchSeasonMatchesServer);
      const finishedCount = seasonMatches.filter((m) => m.status === "FINISHED").length;
      let ratingsSource = seasonMatches;
      if (finishedCount < 15) {
        const priorSeason = String(parseInt(currentSeasonFor(code), 10) - 1);
        const priorMatches = await getSeasonData(code, supabase, priorSeason, fetchSeasonMatchesServer);
        if (priorMatches.length > 0) ratingsSource = [...priorMatches, ...seasonMatches];
      }
      allMatches[code] = seasonMatches;
      const { teams, lgAvgHome, lgAvgAway } = calcRatings(ratingsSource, date);
      allRatings[code] = teams;
      allAvgs[code] = { lgAvgHome, lgAvgAway };
    }

    // 3. Quote (tramite il proxy già esistente del sito)
    const apiOdds = `${url.origin}/api/odds`;
    const allOdds = {};
    for (const code of playingCodes) {
      const league = LEAGUES.find((l) => l.code === code);
      if (league?.oddsKey) allOdds[code] = await fetchOddsForLeague(league.oddsKey, date, apiOdds);
    }

    // 4. News delle ultime 72 ore
    let recentNews = [];
    const since = new Date(Date.now() - 72 * 60 * 60 * 1000).toISOString();
    const { data: newsData, error: newsError } = await supabase
      .from("pronox_news_signals")
      .select("squadra_o_torneo, giocatore, tipo, gravita, affidabilita, sport, note, processato_at")
      .eq("sport", "calcio")
      .gte("processato_at", since);
    if (newsError) report.errors.push(`news: ${newsError.message}`);
    else recentNews = newsData || [];

    // 5. Modello + righe
    const rows = [];
    for (const code of playingCodes) {
      report.leagues[code] = fixturesByCode[code].length;
      for (const fix of fixturesByCode[code]) {
        const model = computeFixtureModel({
          fix, code, allRatings, allAvgs,
          seasonMatchesForH2H: allMatches[code] || [],
          recentNews,
        });
        const oddsData = matchOdds(allOdds[code] || {}, fix.homeTeam.name, fix.awayTeam.name);
        if (oddsData) report.odds_matched++;
        rows.push(...buildSnapshotRows({ fix, code, model, oddsData, horizon }));
        report.fixtures++;
      }
    }
    report.rows = rows.length;

    // 6. Scrittura: i doppioni vengono ignorati (le fotografie non si sovrascrivono)
    for (let i = 0; i < rows.length; i += 500) {
      const chunk = rows.slice(i, i + 500);
      const { data, error } = await supabase
        .from("prediction_snapshots")
        .upsert(chunk, {
          onConflict: "event_id,market,selection,model_version,horizon",
          ignoreDuplicates: true,
        })
        .select("id");
      if (error) report.errors.push(`insert: ${error.message}`);
      else report.inserted += data?.length || 0;
    }
  } catch (e) {
    report.errors.push(String(e?.message || e));
    return NextResponse.json(report, { status: 500 });
  }

  return NextResponse.json(report);
}
