// app/api/tennis/matches/route.js
//
// Restituisce le partite di tennis del giorno con probabilità calcolata dal modello
// (tennisModel.js) e confronto con le quote reali (The Odds API) per il value bet.
//
// Query string: ?date=YYYY-MM-DD&tour=atp|wta (tour opzionale, default entrambi)

import { createClient } from "@supabase/supabase-js";
import { matchProb } from "../../../../lib/tennisModel"; // adatta il path alla tua struttura cartelle

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
);

const ODDS_API_KEY = process.env.ODDS_API_KEY;
const DEFAULT_SURFACE_SERVE_PCT = { Hard: 0.62, Clay: 0.60, Grass: 0.64, Carpet: 0.62 };
const DEFAULT_SURFACE_RETURN_PCT = { Hard: 0.38, Clay: 0.40, Grass: 0.36, Carpet: 0.38 };

// ── Odds API: scopre i tornei di tennis attivi in questo momento ──
// (a differenza del calcio, il tennis su The Odds API non ha una chiave
// fissa per l'intero circuito: ogni torneo ha la sua sport_key, che compare
// nel catalogo solo mentre quel torneo è "in season". Va quindi scoperta
// dinamicamente ad ogni chiamata.)
async function fetchActiveTennisSportKeys() {
  const url = `https://api.the-odds-api.com/v4/sports?apiKey=${ODDS_API_KEY}`;
  const r = await fetch(url);
  if (!r.ok) return [];
  const sports = await r.json();
  return sports
    .filter((s) => s.key && s.key.startsWith("tennis_") && s.active)
    .map((s) => ({ key: s.key, title: s.title }));
}

async function fetchTennisOdds(sportKey) {
  const url = `https://api.the-odds-api.com/v4/sports/${sportKey}/odds/?apiKey=${ODDS_API_KEY}&regions=eu&markets=h2h&oddsFormat=decimal`;
  const r = await fetch(url);
  if (!r.ok) return [];
  return r.json();
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

  // Più giocatori con lo stesso cognome (es. omonimie familiari): serve anche
  // l'iniziale del nome per scegliere quello giusto. Se non basta a
  // disambiguare, meglio nessun match che uno sbagliato (si userà il
  // default di superficie invece di statistiche di un altro giocatore).
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
  return { servePct: null, returnPct: null }; // campione troppo piccolo, si userà il default di superficie
}

// Combina la % di servizio del server con la % di risposta dell'avversario:
// un servizio "forte sulla carta" contro un ottimo rispositore va ammortizzato,
// non preso alla lettera. Media semplice tra le due letture del punto.
function effectivePointWinProb(serverServePct, returnerReturnPct) {
  const returnerAllows = 1 - returnerReturnPct; // quanto il rispositore "concede" in media
  return (serverServePct + returnerAllows) / 2;
}

function calcEV(prob, bookOdds) {
  if (!bookOdds || bookOdds <= 1) return null;
  return prob * (bookOdds - 1) - (1 - prob);
}

function guessSurface(tournamentTitle) {
  const t = (tournamentTitle || "").toLowerCase();
  if (t.includes("french open") || t.includes("roland garros") || t.includes("madrid") || t.includes("rome") || t.includes("monte carlo") || t.includes("clay")) return "Clay";
  if (t.includes("wimbledon") || t.includes("grass") || t.includes("halle") || t.includes("queen")) return "Grass";
  return "Hard"; // default plausibile: la maggioranza del calendario è su cemento
}

export async function GET(request) {
  if (!ODDS_API_KEY) {
    return Response.json({ error: "ODDS_API_KEY non configurata", matches: [] }, { status: 200 });
  }

  const { searchParams } = new URL(request.url);
  const date = searchParams.get("date") || new Date().toISOString().split("T")[0];
  const tourFilter = searchParams.get("tour"); // 'atp' | 'wta' | null (entrambi)

  let activeSports = [];
  try {
    activeSports = await fetchActiveTennisSportKeys();
  } catch (e) {
    return Response.json({ error: "Impossibile contattare The Odds API", matches: [] }, { status: 200 });
  }

  const sportKeys = activeSports
    .filter((s) => {
      if (!tourFilter) return true;
      if (tourFilter === "atp") return s.key.includes("_atp_");
      if (tourFilter === "wta") return s.key.includes("_wta_");
      return true;
    })
    .map((s) => ({ key: s.key, tour: s.key.includes("_wta_") ? "WTA" : "ATP", title: s.title }));

  const results = [];

  for (const { key, tour, title } of sportKeys) {
    let events = [];
    try {
      events = await fetchTennisOdds(key);
    } catch (e) {
      continue;
    }

    for (const ev of events) {
      const evDate = ev.commence_time?.split("T")[0];
      if (evDate !== date) continue;

      const playerAName = ev.home_team;
      const playerBName = ev.away_team;
      if (!playerAName || !playerBName) continue;

      const surface = guessSurface(title); // stima da titolo torneo (default Hard se non riconosciuto)

      const [playerA, playerB] = await Promise.all([
        findPlayerByName(playerAName),
        findPlayerByName(playerBName),
      ]);

      const [statsA, statsB] = await Promise.all([
        getSurfaceStats(playerA?.player_id, surface),
        getSurfaceStats(playerB?.player_id, surface),
      ]);

      const serveA = statsA.servePct ?? DEFAULT_SURFACE_SERVE_PCT[surface];
      const serveB = statsB.servePct ?? DEFAULT_SURFACE_SERVE_PCT[surface];
      const returnA = statsA.returnPct ?? DEFAULT_SURFACE_RETURN_PCT[surface];
      const returnB = statsB.returnPct ?? DEFAULT_SURFACE_RETURN_PCT[surface];

      // pA/pB = probabilità di vincere un punto al PROPRIO servizio, aggiustata
      // per quanto bene risponde l'avversario (non solo la propria % di servizio grezza)
      const pA = effectivePointWinProb(serveA, returnB);
      const pB = effectivePointWinProb(serveB, returnA);

      const probA = matchProb(pA, pB, 3);
      const probB = 1 - probA;

      // Migliore quota disponibile tra i bookmaker restituiti
      let oddsA = null, oddsB = null;
      for (const bm of ev.bookmakers || []) {
        const market = bm.markets?.find((m) => m.key === "h2h");
        if (!market) continue;
        const outA = market.outcomes.find((o) => o.name === playerAName);
        const outB = market.outcomes.find((o) => o.name === playerBName);
        if (outA && (!oddsA || outA.price > oddsA)) oddsA = outA.price;
        if (outB && (!oddsB || outB.price > oddsB)) oddsB = outB.price;
      }

      const evA = calcEV(probA, oddsA);
      const evB = calcEV(probB, oddsB);

      // Un EV fuori scala (oltre il 20%) nel tennis pro è quasi sempre un
      // segnale di stima poco affidabile (campione piccolo, dato anomalo),
      // non un vero value bet — lo marchiamo come sospetto invece di
      // nasconderlo, così si vede ma non si scambia per oro.
      const EV_SANITY_CAP = 0.20;
      const suspiciousA = evA !== null && evA > EV_SANITY_CAP;
      const suspiciousB = evB !== null && evB > EV_SANITY_CAP;

      results.push({
        tour,
        commenceTime: ev.commence_time,
        playerA: { name: playerAName, matchedId: playerA?.player_id || null, servePct: serveA, returnPct: returnA, statsFound: !!statsA.servePct },
        playerB: { name: playerBName, matchedId: playerB?.player_id || null, servePct: serveB, returnPct: returnB, statsFound: !!statsB.servePct },
        surface,
        probA: Number(probA.toFixed(4)),
        probB: Number(probB.toFixed(4)),
        oddsA, oddsB,
        evA: evA !== null ? Number(evA.toFixed(4)) : null,
        evB: evB !== null ? Number(evB.toFixed(4)) : null,
        isValueA: evA !== null && evA > 0.03 && !suspiciousA,
        isValueB: evB !== null && evB > 0.03 && !suspiciousB,
        suspiciousA,
        suspiciousB,
      });
    }
  }

  return Response.json({ matches: results });
}
