// =====================================================================
// PronoX · minuto del primo gol del 1° tempo (05/11/2026)
// football-data.org dà solo i punteggi, senza il minuto dei gol: qui il minuto si prende da API-Football
// (eventi della partita) per le partite già in pronox_risultati con almeno un gol nel 1° tempo.
// Scrive solo la colonna minuto_primo_gol_1t e solo dove è ancora vuota; nessun'altra colonna viene toccata.
// Costo: 1 chiamata per campionato e giorno (per trovare la partita) + 1 ogni 20 partite (per gli eventi).
// =====================================================================
import { apiFootballKey, ALIAS_SQUADRE } from "../apiFootballOdds";
import { nameSimilarity } from "./footballModel";

const AF_BASE = "https://v3.football.api-sports.io";
// codice football-data.org → campionato API-Football (calendar: stagione = anno solare)
const AF_PER_CODICE = {
  SA: { id: 135 }, PL: { id: 39 }, BL1: { id: 78 }, PD: { id: 140 }, FL1: { id: 61 }, ELC: { id: 40 },
  DED: { id: 88 }, PPL: { id: 94 }, CL: { id: 2 }, BSA: { id: 71, calendar: true }, WC: { id: 1, calendar: true },
};
const GIORNI_INDIETRO = 10;
const STATI_FINITI = new Set(["FT", "AET", "PEN"]);

async function afGet(path, params, key) {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), 15000);
  try {
    const r = await fetch(`${AF_BASE}${path}?${new URLSearchParams(params)}`, { headers: { "x-apisports-key": key }, signal: ctrl.signal, cache: "no-store" });
    const j = await r.json().catch(() => null);
    if (!r.ok) throw new Error(`API-Football HTTP ${r.status}`);
    const err = j?.errors;
    const msg = Array.isArray(err) ? err.join(" ") : err && typeof err === "object" ? Object.values(err).join(" ") : "";
    if (msg) throw new Error(`API-Football: ${msg}`);
    return Array.isArray(j?.response) ? j.response : [];
  } finally { clearTimeout(t); }
}

const stagione = (cfg, dataIso) => {
  const d = new Date(dataIso); const y = d.getUTCFullYear(); const m = d.getUTCMonth() + 1;
  return cfg.calendar ? y : m >= 7 ? y : y - 1;
};
const nomeFd = (n) => ALIAS_SQUADRE[n] || n;

// minuto del primo gol del 1° tempo dagli eventi di API-Football (null se non c'è un gol entro il 45')
export function minutoPrimoGol1T(eventi) {
  const gol = (eventi || [])
    .filter((e) => e?.type === "Goal" && e?.detail !== "Missed Penalty" && Number.isFinite(Number(e?.time?.elapsed)))
    .map((e) => Number(e.time.elapsed))
    .filter((m) => m >= 1 && m <= 45)
    .sort((a, b) => a - b);
  return gol.length ? gol[0] : null;
}

export async function completaMinuti(supabase, report) {
  const key = apiFootballKey();
  report.minuti = { da_completare: 0, trovati: 0, senza_abbinamento: 0, chiamate_api: 0 };
  if (!key) { report.minuti.nota = "chiave API-Football assente"; return; }
  const da = new Date(Date.now() - GIORNI_INDIETRO * 86400000).toISOString();
  const { data, error } = await supabase
    .from("pronox_risultati")
    .select("event_id, competition, event_start, home_team, away_team, ht_casa, ht_ospite")
    .is("minuto_primo_gol_1t", null).gte("event_start", da).order("event_start", { ascending: true }).limit(500);
  if (error) { report.errors.push(`minuti: ${error.message}`); return; }
  const righe = (data || []).filter((r) => Number(r.ht_casa) + Number(r.ht_ospite) >= 1 && AF_PER_CODICE[r.competition]);
  report.minuti.da_completare = righe.length;
  if (!righe.length) return;

  // 1. abbinamento partita football-data → fixture API-Football (campionato + giorno + somiglianza dei nomi)
  const gruppi = new Map();
  for (const r of righe) { const k = `${r.competition}|${String(r.event_start).slice(0, 10)}`; gruppi.set(k, [...(gruppi.get(k) || []), r]); }
  const daCercare = []; // { riga, fixtureId }
  for (const [k, lista] of gruppi) {
    const [code, giorno] = k.split("|"); const cfg = AF_PER_CODICE[code];
    let fixtures = [];
    try { fixtures = await afGet("/fixtures", { league: String(cfg.id), season: String(stagione(cfg, lista[0].event_start)), date: giorno }, key); report.minuti.chiamate_api++; }
    catch (e) { report.errors.push(`minuti fixtures ${k}: ${e.message}`); continue; }
    const finiti = fixtures.filter((f) => STATI_FINITI.has(f?.fixture?.status?.short));
    for (const r of lista) {
      let best = null, bestScore = 0;
      for (const f of finiti) {
        const sh = nameSimilarity(r.home_team || "", nomeFd(f.teams?.home?.name || "")), sa = nameSimilarity(r.away_team || "", nomeFd(f.teams?.away?.name || ""));
        const ok = sh > 0.3 && sa > 0.3 && sh + sa > bestScore;
        // controllo in più: il punteggio del 1° tempo deve coincidere
        const ht = f.score?.halftime;
        if (ok && ht && Number(ht.home) === Number(r.ht_casa) && Number(ht.away) === Number(r.ht_ospite)) { best = f; bestScore = sh + sa; }
      }
      if (best) daCercare.push({ riga: r, fixtureId: best.fixture.id }); else report.minuti.senza_abbinamento++;
    }
  }

  // 2. eventi: fino a 20 partite per chiamata
  for (let i = 0; i < daCercare.length; i += 20) {
    const blocco = daCercare.slice(i, i + 20);
    let dettagli = [];
    try { dettagli = await afGet("/fixtures", { ids: blocco.map((x) => x.fixtureId).join("-") }, key); report.minuti.chiamate_api++; }
    catch (e) { report.errors.push(`minuti eventi: ${e.message}`); continue; }
    const perId = new Map(dettagli.map((d) => [d?.fixture?.id, d]));
    for (const { riga, fixtureId } of blocco) {
      const m = minutoPrimoGol1T(perId.get(fixtureId)?.events);
      if (m == null) continue;
      const { error: errUp } = await supabase.from("pronox_risultati").update({ minuto_primo_gol_1t: m }).eq("event_id", riga.event_id).is("minuto_primo_gol_1t", null);
      if (errUp) report.errors.push(`minuti update: ${errUp.message}`); else report.minuti.trovati++;
    }
  }
}
