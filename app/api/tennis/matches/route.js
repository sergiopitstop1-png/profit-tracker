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

// ── Odds API: eventi tennis del giorno ──────────────────────────
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
  const lastName = norm.split(" ").pop();
  if (!lastName) return null;
  const { data } = await supabase
    .from("tennis_players")
    .select("player_id, name")
    .ilike("name", `%${lastName}%`)
    .limit(5);
  if (!data || data.length === 0) return null;
  // match più stringente: il cognome deve comparire per intero
  const exact = data.find((p) => normalizeName(p.name).includes(lastName));
  return exact || data[0];
}

async function getSurfaceServePct(playerId, surface) {
  if (!playerId) return null;
  const { data } = await supabase
    .from("tennis_player_surface_stats")
    .select("serve_pt_win_pct, matches_sample")
    .eq("player_id", playerId)
    .eq("surface", surface)
    .maybeSingle();
  if (data && data.matches_sample >= 5) return data.serve_pt_win_pct;
  return null; // campione troppo piccolo, verrà usato il default di superficie
}

function calcEV(prob, bookOdds) {
  if (!bookOdds || bookOdds <= 1) return null;
  return prob * (bookOdds - 1) - (1 - prob);
}

export async function GET(request) {
  if (!ODDS_API_KEY) {
    return Response.json({ error: "ODDS_API_KEY non configurata", matches: [] }, { status: 200 });
  }

  const { searchParams } = new URL(request.url);
  const date = searchParams.get("date") || new Date().toISOString().split("T")[0];
  const tourFilter = searchParams.get("tour"); // 'atp' | 'wta' | null (entrambi)

  const sportKeys = [];
  if (!tourFilter || tourFilter === "atp") sportKeys.push({ key: "tennis_atp", tour: "ATP" });
  if (!tourFilter || tourFilter === "wta") sportKeys.push({ key: "tennis_wta", tour: "WTA" });

  const results = [];

  for (const { key, tour } of sportKeys) {
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

      const surface = "Hard"; // The Odds API non fornisce la superficie: da affinare in futuro
      // (es. incrociando col nome torneo, o con una tabella tornei->superficie mantenuta a mano)

      const [playerA, playerB] = await Promise.all([
        findPlayerByName(playerAName),
        findPlayerByName(playerBName),
      ]);

      const [pctA, pctB] = await Promise.all([
        getSurfaceServePct(playerA?.player_id, surface),
        getSurfaceServePct(playerB?.player_id, surface),
      ]);

      const pA = pctA ?? DEFAULT_SURFACE_SERVE_PCT[surface];
      const pB = pctB ?? DEFAULT_SURFACE_SERVE_PCT[surface];

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

      results.push({
        tour,
        commenceTime: ev.commence_time,
        playerA: { name: playerAName, matchedId: playerA?.player_id || null, servePct: pA, statsFound: !!pctA },
        playerB: { name: playerBName, matchedId: playerB?.player_id || null, servePct: pB, statsFound: !!pctB },
        surface,
        probA: Number(probA.toFixed(4)),
        probB: Number(probB.toFixed(4)),
        oddsA, oddsB,
        evA: evA !== null ? Number(evA.toFixed(4)) : null,
        evB: evB !== null ? Number(evB.toFixed(4)) : null,
        isValueA: evA !== null && evA > 0.03,
        isValueB: evB !== null && evB > 0.03,
      });
    }
  }

  return Response.json({ matches: results });
}
