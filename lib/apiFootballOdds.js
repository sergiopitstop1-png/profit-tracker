// 01/11/2026 — QUOTE DA API-FOOTBALL (piano Pro) al posto di Betfair / The Odds API.
// Trasforma le quote prematch di API-Football nello STESSO formato di The Odds API (array di partite con bookmakers →
// markets h2h e totals), così /oggi, /pronosticatore, il digest e le fotografie PronoX non cambiano: leggono come prima.
//
// Come funziona, per ogni campionato:
//   1) /fixtures?league&season&from&to        → partite (id, data, nomi delle squadre)
//   2) /odds?league&season&date&bet=1         → 1X2 ("Match Winner"), una chiamata per giorno (e pagina)
//   3) /odds?league&season&date&bet=5         → Over/Under gol ("Goals Over/Under"), idem
// Le quote prematch di API-Football si aggiornano circa una volta al giorno: la cache di /api/odds dura ore, non minuti.
// Variabile Vercel: API_FOOTBALL_KEY (la stessa chiave del piano Pro; vanno bene anche APIFOOTBALL_KEY e API_SPORTS_KEY).

const AF_BASE = "https://v3.football.api-sports.io";

// oddsKey (quello di The Odds API, già usato in tutto PronoX) → campionato di API-Football
export const AF_LEAGUES = {
  soccer_italy_serie_a: { id: 135 },
  soccer_epl: { id: 39 },
  soccer_germany_bundesliga: { id: 78 },
  soccer_spain_la_liga: { id: 140 },
  soccer_france_ligue_one: { id: 61 },
  soccer_uefa_champs_league: { id: 2 },
  soccer_efl_champ: { id: 40 },
  soccer_netherlands_eredivisie: { id: 88 },
  soccer_brazil_campeonato: { id: 71, calendar: true },
  soccer_fifa_world_cup: { id: 1, calendar: true },
};

// Nomi di API-Football (corti) → nome usato da football-data.org, quando l'abbinamento automatico per somiglianza non basta
// (es. "Inter" contro "FC Internazionale Milano"). Se una partita risulta senza quota per il nome, si aggiunge qui.
export const ALIAS_SQUADRE = {
  Inter: "FC Internazionale Milano",
  Wolves: "Wolverhampton Wanderers FC",
  Lyon: "Olympique Lyonnais",
  Rennes: "Stade Rennais FC 1901",
  Brest: "Stade Brestois 29",
};
const nm = (n) => ALIAS_SQUADRE[n] || n;

export function apiFootballKey() {
  return (
    process.env.API_FOOTBALL_KEY ||
    process.env.APIFOOTBALL_KEY ||
    process.env.API_SPORTS_KEY ||
    ""
  );
}

// stagione: anno di inizio per i campionati ago-mag (lug-dic = anno corrente, gen-giu = anno scorso); anno solare per gli altri
export function seasonFor(oddsKey, now = new Date()) {
  const cfg = AF_LEAGUES[oddsKey];
  if (!cfg) return null;
  const y = now.getUTCFullYear();
  const m = now.getUTCMonth() + 1;
  if (cfg.calendar) return y;
  return m >= 7 ? y : y - 1;
}

const isoDay = (d) => d.toISOString().slice(0, 10);

async function afGet(path, params, key, fetchImpl = fetch) {
  const url = `${AF_BASE}${path}?${new URLSearchParams(params).toString()}`;
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), 12000);
  try {
    const r = await fetchImpl(url, {
      headers: { "x-apisports-key": key },
      signal: ctrl.signal,
      cache: "no-store",
    });
    const j = await r.json().catch(() => null);
    if (!r.ok) throw new Error(`API-Football HTTP ${r.status}`);
    // API-Football risponde 200 anche quando c'è un errore (chiave sbagliata, limite superato): sta in "errors"
    const err = j?.errors;
    const msg = Array.isArray(err) ? err.join(" ") : err && typeof err === "object" ? Object.values(err).join(" ") : "";
    if (msg) throw new Error(`API-Football: ${msg}`);
    return j;
  } finally {
    clearTimeout(t);
  }
}

// tutte le pagine di una risposta (le quote sono a 10 partite per pagina)
async function afGetAll(path, params, key, fetchImpl, calls) {
  const out = [];
  for (let page = 1; page <= 10; page++) {
    const j = await afGet(path, { ...params, page: String(page) }, key, fetchImpl);
    calls.n++;
    out.push(...(Array.isArray(j?.response) ? j.response : []));
    const total = Number(j?.paging?.total || 1);
    if (page >= total) break;
  }
  return out;
}

const num = (x) => {
  const n = Number(String(x).replace(",", "."));
  return Number.isFinite(n) && n > 1 ? n : null;
};
const slug = (s) => String(s || "").toLowerCase().replace(/[^a-z0-9]+/g, "_").replace(/^_|_$/g, "");

// 05/11/2026 — mercati extra (solo per le fotografie PronoX, opts.extra): Over/Under del primo tempo e Goal/NoGol.
// Gli id dei mercati si cercano per nome con /odds/bets (una chiamata, poi in memoria); se la ricerca fallisce si usano 6 e 8.
const RE_H1 = /^goals over\/under first half$/i;
const RE_BTTS = /^both teams score$/i;
let _betIds = null;
async function betIdsExtra(key, fetchImpl, calls) {
  if (_betIds) return _betIds;
  const ids = { h1: "6", btts: "8" };
  try {
    const j = await afGet("/odds/bets", {}, key, fetchImpl);
    calls.n++;
    for (const b of Array.isArray(j?.response) ? j.response : []) {
      if (RE_H1.test(String(b?.name || "").trim())) ids.h1 = String(b.id);
      if (RE_BTTS.test(String(b?.name || "").trim())) ids.btts = String(b.id);
    }
  } catch (_) { /* si usano gli id di riserva */ }
  _betIds = ids;
  return ids;
}

// Funzione pura (si prova da sola): partite + risposte quote → partite nel formato di The Odds API
// extra = { h1: [...], btts: [...] } (facoltativo): risposte /odds dei mercati primo tempo e Goal/NoGol
export function buildEvents(fixtures, oddsMatch, oddsTotals, oddsKey, extra = {}) {
  const book = new Map(); // fixtureId → Map(bookmakerId → {key,title,last_update,markets:{h2h?,totals?}})
  const get = (fid, b, update) => {
    if (!book.has(fid)) book.set(fid, new Map());
    const m = book.get(fid);
    if (!m.has(b.id)) m.set(b.id, { key: slug(b.name) || `b${b.id}`, title: String(b.name || b.id), last_update: update || null, h2h: null, totals: [], totalsH1: [], btts: [] });
    return m.get(b.id);
  };
  const fx = new Map(fixtures.map((f) => [f.fixture.id, f]));

  for (const row of oddsMatch) {
    const f = fx.get(row.fixture?.id);
    if (!f) continue;
    for (const b of row.bookmakers || []) {
      for (const bet of b.bets || []) {
        if (!(bet.id === 1 || /^match winner$/i.test(bet.name || ""))) continue;
        const v = Object.fromEntries((bet.values || []).map((x) => [String(x.value).toLowerCase(), num(x.odd)]));
        if (v.home && v.draw && v.away) {
          get(f.fixture.id, b, row.update).h2h = [
            { name: nm(f.teams.home.name), price: v.home },
            { name: "Draw", price: v.draw },
            { name: nm(f.teams.away.name), price: v.away },
          ];
        }
      }
    }
  }
  for (const row of oddsTotals) {
    const f = fx.get(row.fixture?.id);
    if (!f) continue;
    for (const b of row.bookmakers || []) {
      for (const bet of b.bets || []) {
        if (!(bet.id === 5 || /^goals over\/under$/i.test(bet.name || ""))) continue;
        const out = [];
        for (const x of bet.values || []) {
          const m = /^(over|under)\s+([0-9]+(?:\.[0-9]+)?)$/i.exec(String(x.value).trim());
          const price = num(x.odd);
          if (m && price) out.push({ name: m[1][0].toUpperCase() + m[1].slice(1).toLowerCase(), price, point: Number(m[2]) });
        }
        if (out.length) get(f.fixture.id, b, row.update).totals.push(...out);
      }
    }
  }

  for (const row of extra.h1 || []) {
    const f = fx.get(row.fixture?.id);
    if (!f) continue;
    for (const b of row.bookmakers || []) {
      for (const bet of b.bets || []) {
        if (!(RE_H1.test(String(bet.name || "").trim()) || String(bet.id) === "6")) continue;
        const out = [];
        for (const x of bet.values || []) {
          const m = /^(over|under)\s+([0-9]+(?:\.[0-9]+)?)$/i.exec(String(x.value).trim());
          const price = num(x.odd);
          if (m && price) out.push({ name: m[1][0].toUpperCase() + m[1].slice(1).toLowerCase(), price, point: Number(m[2]) });
        }
        if (out.length) get(f.fixture.id, b, row.update).totalsH1.push(...out);
      }
    }
  }
  for (const row of extra.btts || []) {
    const f = fx.get(row.fixture?.id);
    if (!f) continue;
    for (const b of row.bookmakers || []) {
      for (const bet of b.bets || []) {
        if (!(RE_BTTS.test(String(bet.name || "").trim()) || String(bet.id) === "8")) continue;
        const out = [];
        for (const x of bet.values || []) {
          const v = String(x.value).trim().toLowerCase();
          const price = num(x.odd);
          if (price && (v === "yes" || v === "no")) out.push({ name: v === "yes" ? "Yes" : "No", price });
        }
        if (out.length) get(f.fixture.id, b, row.update).btts.push(...out);
      }
    }
  }

  return fixtures
    .map((f) => {
      const books = [...(book.get(f.fixture.id)?.values() || [])]
        .map((b) => ({
          key: b.key,
          title: b.title,
          last_update: b.last_update,
          markets: [
            ...(b.h2h ? [{ key: "h2h", outcomes: b.h2h }] : []),
            ...(b.totals.length ? [{ key: "totals", outcomes: b.totals }] : []),
            ...(b.totalsH1.length ? [{ key: "totals_h1", outcomes: b.totalsH1 }] : []),
            ...(b.btts.length ? [{ key: "btts", outcomes: b.btts }] : []),
          ],
        }))
        .filter((b) => b.markets.length);
      return {
        id: String(f.fixture.id),
        sport_key: oddsKey,
        commence_time: new Date(f.fixture.date).toISOString(),
        home_team: nm(f.teams.home.name),
        away_team: nm(f.teams.away.name),
        bookmakers: books,
      };
    })
    .filter((e) => e.bookmakers.length);
}

// Partite dei prossimi giorni di un campionato, con le quote. opts: { from, to } (YYYY-MM-DD, UTC) oppure { days }.
// Restituisce un array nel formato di The Odds API; con opts.stats l'oggetto { events, calls } per i controlli.
export async function fetchEventsForLeague(oddsKey, opts = {}, key = apiFootballKey(), fetchImpl = fetch) {
  const cfg = AF_LEAGUES[oddsKey];
  if (!cfg) return opts.stats ? { events: [], calls: 0 } : [];
  if (!key) throw new Error("API_FOOTBALL_KEY mancante");
  const now = new Date();
  const season = String(seasonFor(oddsKey, now));
  const from = opts.from || isoDay(now);
  const to = opts.to || isoDay(new Date(now.getTime() + (opts.days ?? 3) * 86400000));
  const calls = { n: 0 };

  const fixtures = (await afGetAll("/fixtures", { league: String(cfg.id), season, from, to, status: "NS" }, key, fetchImpl, calls)).filter(
    (f) => f?.fixture?.id && f?.teams?.home?.name && f?.teams?.away?.name
  );
  if (!fixtures.length) return opts.stats ? { events: [], calls: calls.n } : [];

  const days = [...new Set(fixtures.map((f) => new Date(f.fixture.date).toISOString().slice(0, 10)))];
  const oddsMatch = [];
  const oddsTotals = [];
  const extra = { h1: [], btts: [] };
  const ids = opts.extra ? await betIdsExtra(key, fetchImpl, calls) : null;
  for (const date of days) {
    const base = { league: String(cfg.id), season, date };
    oddsMatch.push(...(await afGetAll("/odds", { ...base, bet: "1" }, key, fetchImpl, calls)));
    oddsTotals.push(...(await afGetAll("/odds", { ...base, bet: "5" }, key, fetchImpl, calls)));
    if (ids) {
      // i mercati extra non devono mai rompere le quote 1X2 e Over/Under 2,5: se falliscono si va avanti senza
      try { extra.h1.push(...(await afGetAll("/odds", { ...base, bet: ids.h1 }, key, fetchImpl, calls))); } catch (_) { /* senza quota 1T */ }
      try { extra.btts.push(...(await afGetAll("/odds", { ...base, bet: ids.btts }, key, fetchImpl, calls))); } catch (_) { /* senza quota NoGol */ }
    }
  }
  const events = buildEvents(fixtures, oddsMatch, oddsTotals, oddsKey, extra);
  return opts.stats ? { events, calls: calls.n } : events;
}
