// app/api/tennis/matches/route.js
//
// Restituisce le partite di tennis del giorno con probabilità calcolata dal modello
// (tennisModel.js + Elo + H2H + forma recente) e confronto con le quote reali
// (OddsPapi) per il value bet.
//
// NOTA SULLA FONTE QUOTE: inizialmente usava The Odds API, ma copriva solo 1-2
// tornei di tennis alla volta (Washington ATP/WTA, verificato il 01/08/2026) —
// troppo poco. OddsPapi (oddspapi.io) dichiara copertura molto più ampia
// (5.600+ tornei) con piano gratuito. IMPORTANTE: il piano gratuito è limitato
// a 250 richieste/mese — questa route usa una cache di 20 minuti su Supabase
// per non sprecarle ad ogni refresh della pagina.
//
// Query string: ?date=YYYY-MM-DD

import { createClient } from "@supabase/supabase-js";
import { matchProb } from "../../../../lib/tennisModel"; // adatta il path alla tua struttura cartelle

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
);

const ODDSPAPI_KEY = process.env.ODDSPAPI_KEY;
const ODDSPAPI_BASE = "https://api.oddspapi.io/v4";
const TENNIS_SPORT_ID = 12;
const MATCH_WINNER_MARKET_ID = "121"; // 121 = player 1, 122 = player 2 (confermato da esempi ufficiali OddsPapi)

const DEFAULT_SURFACE_SERVE_PCT = { Hard: 0.62, Clay: 0.60, Grass: 0.64, Carpet: 0.62 };
const DEFAULT_SURFACE_RETURN_PCT = { Hard: 0.38, Clay: 0.40, Grass: 0.36, Carpet: 0.38 };
const CACHE_MINUTES = 20;

// ── Cache su Supabase, per non sprecare le 250 richieste/mese ──────
async function getCachedMatches(date) {
  const { data } = await supabase
    .from("tennis_odds_cache")
    .select("fetched_at, raw_matches")
    .eq("cache_date", date)
    .maybeSingle();
  if (!data) return null;
  const ageMinutes = (Date.now() - new Date(data.fetched_at).getTime()) / 60000;
  if (ageMinutes > CACHE_MINUTES) return null;
  return data.raw_matches;
}

async function setCachedMatches(date, rawMatches) {
  await supabase.from("tennis_odds_cache").upsert(
    { cache_date: date, fetched_at: new Date().toISOString(), raw_matches: rawMatches },
    { onConflict: "cache_date" }
  );
}

// ── OddsPapi: fixture + quote del giorno ────────────────────────────
async function fetchOddsPapiRawMatches(date) {
  const toDate = new Date(date);
  toDate.setDate(toDate.getDate() + 1);
  const to = toDate.toISOString().split("T")[0];

  // 1. Fixture del giorno (nomi giocatori, orario, torneo)
  const fixturesUrl = `${ODDSPAPI_BASE}/fixtures?apiKey=${ODDSPAPI_KEY}&sportId=${TENNIS_SPORT_ID}&from=${date}&to=${to}&hasOdds=true`;
  const fixturesRes = await fetch(fixturesUrl);
  if (!fixturesRes.ok) return { matches: [], oddsDebug: { reason: "fixtures request failed", status: fixturesRes.status } };
  const fixtures = await fixturesRes.json();
  if (!Array.isArray(fixtures) || fixtures.length === 0) return { matches: [], oddsDebug: { reason: "nessuna fixture restituita" } };

  // Filtra solo le fixture che iniziano davvero nella data richiesta
  const todaysFixtures = fixtures.filter((f) => f.startTime?.split("T")[0] === date);
  if (todaysFixtures.length === 0) return { matches: [], oddsDebug: { reason: "nessuna fixture per questa data esatta" } };

  // 2. Quote solo per i tornei del circuito principale ATP/WTA — l'endpoint
  // quote accetta al massimo 5 tornei per chiamata, e i Challenger/ITF/UTR
  // (che sono la maggioranza delle fixture di un giorno tipico) sono
  // comunque quelli dove abbiamo meno dati affidabili (Elo, statistiche),
  // quindi escluderli qui non perde segnali di qualità.
  const LOWER_TIER_PATTERNS = /challenger|itf|utr|ptt|125k|futures|\bsrl\b|qualifying|qualification/i;
  const mainTourFixtures = todaysFixtures.filter((f) => !LOWER_TIER_PATTERNS.test(f.tournamentName || ""));

  const tournamentIds = [...new Set(mainTourFixtures.map((f) => f.tournamentId).filter(Boolean))].slice(0, 5);
  if (tournamentIds.length === 0) {
    return { matches: [], oddsDebug: { reason: "nessun torneo di circuito principale trovato oggi" } };
  }
  // Manteniamo solo le fixture dei tornei per cui chiediamo davvero le quote
  const todaysFixturesFiltered = mainTourFixtures.filter((f) => tournamentIds.includes(f.tournamentId));

  const oddsUrl = `${ODDSPAPI_BASE}/odds-by-tournaments?apiKey=${ODDSPAPI_KEY}&tournamentIds=${tournamentIds.join(",")}&bookmaker=pinnacle`;
  const oddsRes = await fetch(oddsUrl);
  const oddsDebug = { status: oddsRes.status, ok: oddsRes.ok, tournamentIdsCount: tournamentIds.length, url: oddsUrl.replace(ODDSPAPI_KEY, "***") };
  let oddsData = [];
  if (oddsRes.ok) {
    oddsData = await oddsRes.json();
    oddsDebug.isArray = Array.isArray(oddsData);
    oddsDebug.length = Array.isArray(oddsData) ? oddsData.length : null;
    oddsDebug.sample = Array.isArray(oddsData) ? oddsData[0] : oddsData;
  } else {
    oddsDebug.errorBody = (await oddsRes.text()).slice(0, 500);
  }
  const oddsByFixtureId = new Map((Array.isArray(oddsData) ? oddsData : []).map((o) => [o.fixtureId, o]));

  function extractBestPrices(oddsEntry) {
    let bestP1 = null, bestP2 = null;
    const debugMarkets = [];
    if (oddsEntry?.bookmakerOdds) {
      for (const bm of Object.values(oddsEntry.bookmakerOdds)) {
        const market = bm.markets?.[MATCH_WINNER_MARKET_ID];
        if (!market) continue;
        const p1 = market.outcomes?.["121"]?.players?.["0"];
        const p2 = market.outcomes?.["122"]?.players?.["0"];
        debugMarkets.push({ hasMarket: !!market, p1, p2 });
        if (p1?.active && p1.price && (!bestP1 || p1.price > bestP1)) bestP1 = p1.price;
        if (p2?.active && p2.price && (!bestP2 || p2.price > bestP2)) bestP2 = p2.price;
      }
    }
    return { bestP1, bestP2, debugMarkets };
  }

  // Diagnostico mirato: testiamo l'estrazione sulla stessa fixture campione
  // che vediamo in oddsDebug.sample, per capire se il problema è
  // nell'estrazione del prezzo o nell'abbinamento fixture<->quote.
  if (Array.isArray(oddsData) && oddsData[0]) {
    oddsDebug.sampleExtraction = extractBestPrices(oddsData[0]);
    oddsDebug.sampleFixtureIdInOdds = oddsData[0].fixtureId;
    oddsDebug.sampleFixtureIdInFixtures = todaysFixturesFiltered[0]?.fixtureId;
    oddsDebug.fixtureIdsMatch = oddsData[0].fixtureId === todaysFixturesFiltered[0]?.fixtureId;
  }

  // Uniamo fixture (nomi/orari) e quote (prezzi) in un'unica lista pulita
  const matches = todaysFixturesFiltered.map((f) => {
    const odds = oddsByFixtureId.get(f.fixtureId);
    const { bestP1, bestP2 } = extractBestPrices(odds);
    return {
      fixtureId: f.fixtureId,
      tournamentName: f.tournamentName || odds?.tournamentName || null,
      startTime: f.startTime,
      playerAName: f.participant1Name,
      playerBName: f.participant2Name,
      oddsA: bestP1,
      oddsB: bestP2,
    };
  }).filter((m) => m.playerAName && m.playerBName);

  return { matches, oddsDebug };
}

// ── Normalizza nome giocatore per il matching odds <-> anagrafica ──
function normalizeName(name) {
  return (name || "")
    .toLowerCase()
    .normalize("NFD").replace(/[\u0300-\u036f]/g, "") // rimuove accenti
    .replace(/[^a-z\s]/g, "")
    .trim();
}

async function findPlayerByName(name) {
  const norm = normalizeName(name);
  const parts = norm.split(" ").filter(Boolean);
  const lastName = parts[parts.length - 1];
  const firstInitial = parts[0]?.[0];
  if (!lastName) return null;

  const { data } = await supabase
    .from("tennis_players")
    .select("player_id, name")
    .ilike("name", `%${lastName}%`)
    .order("name")
    .limit(50); // rete ampia: con cognomi comuni (es. "Fritz") possono esserci molti omonimi
  if (!data || data.length === 0) return null;

  const candidates = data.filter((p) => {
    const pNorm = normalizeName(p.name);
    return pNorm.split(" ").pop() === lastName; // cognome esatto, non solo "contiene"
  });
  if (candidates.length === 0) return null;
  if (candidates.length === 1) return candidates[0];

  const byInitial = candidates.filter((p) => normalizeName(p.name)[0] === firstInitial);
  if (byInitial.length === 1) return byInitial[0];

  const exactFull = candidates.find((p) => normalizeName(p.name) === norm);
  if (exactFull) return exactFull;

  return null; // ambiguo, meglio astenersi
}

async function getSurfaceStats(playerId, surface) {
  if (!playerId) return { servePct: null, returnPct: null };
  const { data } = await supabase
    .from("tennis_player_surface_stats")
    .select("serve_pt_win_pct, return_pt_win_pct, matches_sample")
    .eq("player_id", playerId)
    .eq("surface", surface)
    .maybeSingle();
  if (data && data.matches_sample >= 15) {
    return { servePct: data.serve_pt_win_pct, returnPct: data.return_pt_win_pct };
  }
  return { servePct: null, returnPct: null };
}

function effectivePointWinProb(serverServePct, returnerReturnPct) {
  const returnerAllows = 1 - returnerReturnPct;
  return (serverServePct + returnerAllows) / 2;
}

function calcEV(prob, bookOdds) {
  if (!bookOdds || bookOdds <= 1) return null;
  return prob * (bookOdds - 1) - (1 - prob);
}

async function getEloRating(playerId, surface) {
  if (!playerId) return null;
  const { data } = await supabase
    .from("tennis_player_elo")
    .select("elo_overall, elo_hard, elo_clay, elo_grass, matches_count")
    .eq("player_id", playerId)
    .maybeSingle();
  if (!data || data.matches_count < 10) return null;
  const surfaceElo = { Hard: data.elo_hard, Clay: data.elo_clay, Grass: data.elo_grass }[surface];
  return (surfaceElo ?? data.elo_overall) * 0.67 + data.elo_overall * 0.33;
}

async function getPlayerMatchCount(playerId) {
  if (!playerId) return 0;
  const { data } = await supabase
    .from("tennis_player_elo")
    .select("matches_count")
    .eq("player_id", playerId)
    .maybeSingle();
  return data?.matches_count ?? 0;
}

function eloWinProb(eloA, eloB) {
  return 1 / (1 + Math.pow(10, (eloB - eloA) / 400));
}

async function getHeadToHead(playerAId, playerBId) {
  if (!playerAId || !playerBId) return null;
  const { data } = await supabase
    .from("tennis_matches")
    .select("winner_id")
    .or(
      `and(winner_id.eq.${playerAId},loser_id.eq.${playerBId}),and(winner_id.eq.${playerBId},loser_id.eq.${playerAId})`
    );
  if (!data || data.length === 0) return null;
  const winsA = data.filter((m) => m.winner_id === playerAId).length;
  const winsB = data.length - winsA;
  return { winsA, winsB, total: data.length };
}

async function getRecentForm(playerId, surface, n = 10, minSameSurface = 5) {
  if (!playerId) return null;

  const { data: sameSurface } = await supabase
    .from("tennis_matches")
    .select("winner_id, loser_id, tourney_date")
    .or(`winner_id.eq.${playerId},loser_id.eq.${playerId}`)
    .eq("surface", surface)
    .order("tourney_date", { ascending: false })
    .limit(n);

  if (sameSurface && sameSurface.length >= minSameSurface) {
    const wins = sameSurface.filter((m) => m.winner_id === playerId).length;
    return wins / sameSurface.length;
  }

  const { data: allSurfaces } = await supabase
    .from("tennis_matches")
    .select("winner_id, loser_id, tourney_date")
    .or(`winner_id.eq.${playerId},loser_id.eq.${playerId}`)
    .order("tourney_date", { ascending: false })
    .limit(n);
  if (!allSurfaces || allSurfaces.length < 5) return null;
  const wins = allSurfaces.filter((m) => m.winner_id === playerId).length;
  return wins / allSurfaces.length;
}

function guessSurface(tournamentTitle) {
  const t = (tournamentTitle || "").toLowerCase();
  if (t.includes("french open") || t.includes("roland garros") || t.includes("madrid") || t.includes("rome") || t.includes("monte carlo") || t.includes("clay")) return "Clay";
  if (t.includes("wimbledon") || t.includes("grass") || t.includes("halle") || t.includes("queen")) return "Grass";
  return "Hard";
}

export async function GET(request) {
  if (!ODDSPAPI_KEY) {
    return Response.json({ error: "ODDSPAPI_KEY non configurata", matches: [] }, { status: 200 });
  }

  const { searchParams } = new URL(request.url);
  const date = searchParams.get("date") || new Date().toISOString().split("T")[0];

  // Debug: ?debug=raw mostra le fixture/quote grezze da OddsPapi, senza
  // passare dal nostro modello — utile per verificare la copertura tornei.
  const isDebug = searchParams.get("debug") === "raw";

  let rawMatches = isDebug ? null : await getCachedMatches(date);
  let fromCache = !!rawMatches;
  let oddsDebug = null;
  if (!rawMatches) {
    try {
      const result = await fetchOddsPapiRawMatches(date);
      rawMatches = result.matches;
      oddsDebug = result.oddsDebug;
      await setCachedMatches(date, rawMatches);
    } catch (e) {
      return Response.json({ error: "Impossibile contattare OddsPapi", details: String(e), matches: [] }, { status: 200 });
    }
  }

  if (isDebug) {
    return Response.json({ fromCache, count: rawMatches.length, oddsDebug, rawMatches });
  }

  const results = [];

  for (const m of rawMatches) {
    const surface = guessSurface(m.tournamentName);

    const [playerA, playerB] = await Promise.all([
      findPlayerByName(m.playerAName),
      findPlayerByName(m.playerBName),
    ]);

    const [statsA, statsB] = await Promise.all([
      getSurfaceStats(playerA?.player_id, surface),
      getSurfaceStats(playerB?.player_id, surface),
    ]);

    const serveA = statsA.servePct ?? DEFAULT_SURFACE_SERVE_PCT[surface];
    const serveB = statsB.servePct ?? DEFAULT_SURFACE_SERVE_PCT[surface];
    const returnA = statsA.returnPct ?? DEFAULT_SURFACE_RETURN_PCT[surface];
    const returnB = statsB.returnPct ?? DEFAULT_SURFACE_RETURN_PCT[surface];

    const pA = effectivePointWinProb(serveA, returnB);
    const pB = effectivePointWinProb(serveB, returnA);
    const probPointModel = matchProb(pA, pB, 3);

    const [eloA, eloB] = await Promise.all([
      getEloRating(playerA?.player_id, surface),
      getEloRating(playerB?.player_id, surface),
    ]);

    let probA, usedElo;
    if (eloA !== null && eloB !== null) {
      const probEloModel = eloWinProb(eloA, eloB);
      probA = probPointModel * 0.30 + probEloModel * 0.70;
      usedElo = true;
    } else {
      probA = probPointModel;
      usedElo = false;
    }

    const [h2h, formA, formB] = await Promise.all([
      getHeadToHead(playerA?.player_id, playerB?.player_id),
      getRecentForm(playerA?.player_id, surface),
      getRecentForm(playerB?.player_id, surface),
    ]);

    let usedH2h = false, usedForm = false;
    if (h2h && h2h.total >= 3) {
      const h2hWinRateA = h2h.winsA / h2h.total;
      probA += (h2hWinRateA - 0.5) * 0.15;
      usedH2h = true;
    }
    if (formA !== null && formB !== null) {
      probA += (formA - formB) * 0.10;
      usedForm = true;
    }
    probA = Math.min(0.98, Math.max(0.02, probA));
    const probB = 1 - probA;

    const evA = calcEV(probA, m.oddsA);
    const evB = calcEV(probB, m.oddsB);

    const MIN_TOTAL_MATCHES = 30;
    const [matchesCountA, matchesCountB] = await Promise.all([
      getPlayerMatchCount(playerA?.player_id),
      getPlayerMatchCount(playerB?.player_id),
    ]);
    const lowDataPlayer = matchesCountA < MIN_TOTAL_MATCHES || matchesCountB < MIN_TOTAL_MATCHES;

    const EV_SANITY_CAP = 0.20;
    const suspiciousA = (evA !== null && evA > EV_SANITY_CAP) || (evA !== null && evA > 0.03 && lowDataPlayer);
    const suspiciousB = (evB !== null && evB > EV_SANITY_CAP) || (evB !== null && evB > 0.03 && lowDataPlayer);

    // Determina il tour (ATP/WTA) dal nome torneo, visto che OddsPapi non lo
    // separa esplicitamente come faceva The Odds API con le sport_key.
    const tour = /\bwta\b/i.test(m.tournamentName || "") ? "WTA" : "ATP";

    results.push({
      tour,
      tournament: m.tournamentName,
      commenceTime: m.startTime,
      playerA: { name: m.playerAName, matchedId: playerA?.player_id || null, servePct: serveA, returnPct: returnA, statsFound: !!statsA.servePct },
      playerB: { name: m.playerBName, matchedId: playerB?.player_id || null, servePct: serveB, returnPct: returnB, statsFound: !!statsB.servePct },
      surface,
      usedElo,
      usedH2h,
      usedForm,
      lowDataPlayer,
      h2h: h2h ? { winsA: h2h.winsA, winsB: h2h.winsB } : null,
      probA: Number(probA.toFixed(4)),
      probB: Number(probB.toFixed(4)),
      oddsA: m.oddsA, oddsB: m.oddsB,
      evA: evA !== null ? Number(evA.toFixed(4)) : null,
      evB: evB !== null ? Number(evB.toFixed(4)) : null,
      isValueA: evA !== null && evA > 0.03 && !suspiciousA,
      isValueB: evB !== null && evB > 0.03 && !suspiciousB,
      suspiciousA,
      suspiciousB,
    });
  }

  return Response.json({ matches: results, fromCache });
}
