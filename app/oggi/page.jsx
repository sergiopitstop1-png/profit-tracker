"use client";
import { useState, useEffect } from "react";

const API = "/api/football";
const LEAGUES = [
  { id: "135", name: "Serie A", flag: "🇮🇹" },
  { id: "140", name: "La Liga", flag: "🇪🇸" },
  { id: "39", name: "Premier League", flag: "🏴󠁧󠁢󠁥󠁮󠁧󠁿" },
  { id: "78", name: "Bundesliga", flag: "🇩🇪" },
  { id: "61", name: "Ligue 1", flag: "🇫🇷" },
  { id: "2", name: "Champions League", flag: "⭐" },
];

function poisson(k, lambda) {
  let p = Math.exp(-lambda);
  for (let i = 1; i <= k; i++) p *= lambda / i;
  return p;
}

function calcProbs(lH, lA, max = 7) {
  let h = 0, d = 0, a = 0, o25 = 0, btts = 0;
  for (let i = 0; i <= max; i++) {
    for (let j = 0; j <= max; j++) {
      const p = poisson(i, lH) * poisson(j, lA);
      if (i > j) h += p;
      else if (i === j) d += p;
      else a += p;
      if (i + j > 2.5) o25 += p;
      if (i > 0 && j > 0) btts += p;
    }
  }
  const o05ht = Math.min(0.18 + (lH + lA) * 0.14, 0.92);
  return { h, d, a, o25, u25: 1 - o25, btts, bttsNo: 1 - btts, o05ht };
}

function ev(prob, odd) {
  if (!odd || odd <= 1) return null;
  return prob * (odd - 1) - (1 - prob);
}

function bestEv(probs, fixture) {
  const odds = fixture.odds;
  if (!odds) return null;
  const checks = [
    { label: "Casa vince", prob: probs.h, odd: odds.h },
    { label: "Pareggio", prob: probs.d, odd: odds.d },
    { label: "Ospite vince", prob: probs.a, odd: odds.a },
    { label: "Over 2.5", prob: probs.o25, odd: odds.o25 },
    { label: "BTTS Sì", prob: probs.btts, odd: odds.btts },
  ];
  let best = null;
  for (const c of checks) {
    const e = ev(c.prob, c.odd);
    if (e !== null && (best === null || e > best.ev)) {
      best = { ...c, ev: e };
    }
  }
  return best;
}

async function fetchFixtures(leagueId, season, date) {
  const r = await fetch(`${API}?endpoint=fixtures&league=${leagueId}&season=${season}&date=${date}`);
  const d = await r.json();
  return d.response || [];
}

async function fetchStats(teamId, leagueId, season) {
  const r = await fetch(`${API}?endpoint=teams/statistics&league=${leagueId}&season=${season}&team=${teamId}`);
  const d = await r.json();
  return d.response;
}

async function fetchOdds(fixtureId) {
  const r = await fetch(`${API}?endpoint=odds&fixture=${fixtureId}&bookmaker=8`);
  const d = await r.json();
  try {
    const bets = d.response[0]?.bookmakers[0]?.bets || [];
    const result = {};
    for (const bet of bets) {
      if (bet.name === "Match Winner") {
        result.h = parseFloat(bet.values.find(v => v.value === "Home")?.odd);
        result.d = parseFloat(bet.values.find(v => v.value === "Draw")?.odd);
        result.a = parseFloat(bet.values.find(v => v.value === "Away")?.odd);
      }
      if (bet.name === "Goals Over/Under" ) {
        result.o25 = parseFloat(bet.values.find(v => v.value === "Over 2.5")?.odd);
      }
      if (bet.name === "Both Teams Score") {
        result.btts = parseFloat(bet.values.find(v => v.value === "Yes")?.odd);
      }
    }
    return Object.keys(result).length > 0 ? result : null;
  } catch { return null; }
}

export default function Oggi() {
  const [date, setDate] = useState(() => new Date().toISOString().split("T")[0]);
  const [season] = useState("2024");
  const [selectedLeagues, setSelectedLeagues] = useState(["135", "2"]);
  const [matches, setMatches] = useState([]);
  const [loading, setLoading] = useState(false);
  const [progress, setProgress] = useState("");
  const [filter, setFilter] = useState("all");

  const toggleLeague = (id) => {
    setSelectedLeagues(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]);
  };

  const load = async () => {
    setLoading(true);
    setMatches([]);
    const all = [];

    for (const lid of selectedLeagues) {
      const league = LEAGUES.find(l => l.id === lid);
      setProgress(`Carico partite ${league.flag} ${league.name}...`);
      const fixtures = await fetchFixtures(lid, season, date);
      
      for (const fix of fixtures) {
        setProgress(`Analizzo ${fix.teams.home.name} vs ${fix.teams.away.name}...`);
        
        const [statsH, statsA, odds] = await Promise.all([
          fetchStats(fix.teams.home.id, lid, season),
          fetchStats(fix.teams.away.id, lid, season),
          fetchOdds(fix.fixture.id),
        ]);

        const gfH = parseFloat(statsH?.goals?.for?.average?.home || 1.2);
        const gaH = parseFloat(statsH?.goals?.against?.average?.home || 1.1);
        const gfA = parseFloat(statsA?.goals?.for?.average?.away || 1.0);
        const gaA = parseFloat(statsA?.goals?.against?.average?.away || 1.2);
        const lgAvg = 1.35;
        const lH = (gfH / lgAvg) * (gaA / lgAvg) * lgAvg * 1.1;
        const lA = (gfA / lgAvg) * (gaH / lgAvg) * lgAvg;
        const probs = calcProbs(lH, lA);
        const best = bestEv(probs, { odds });
        const time = fix.fixture.date ? new Date(fix.fixture.date).toLocaleTimeString("it-IT", { hour: "2-digit", minute: "2-digit" }) : "--:--";

        all.push({
          id: fix.fixture.id,
          home: fix.teams.home,
          away: fix.teams.away,
          time,
          league: { id: lid, ...league },
          probs,
          lH,
          lA,
          odds,
          best,
          statsH,
          statsA,
        });
      }
    }

    all.sort((a, b) => (b.best?.ev || -99) - (a.best?.ev || -99));
    setMatches(all);
    setLoading(false);
    setProgress("");
  };

  const filtered = matches.filter(m => {
    if (filter === "value") return m.best && m.best.ev > 0.03;
    if (filter === "noodds") return !m.odds;
    return true;
  });

  const evColor = (e) => e > 0.05 ? "#c8f135" : e > 0 ? "#ffd060" : "#ff5c5c";

  return (
    <div style={{ minHeight: "100vh", background: "#0d0f14", color: "#e8ecf5", fontFamily: "system-ui, sans-serif", padding: "24px 16px" }}>
      <div style={{ maxWidth: 860, margin: "0 auto" }}>

        <h1 style={{ fontSize: 26, fontWeight: 800, marginBottom: 4 }}>
          PRONO<span style={{ color: "#c8f135" }}>X</span> <span style={{ fontSize: 13, fontWeight: 400, color: "#6b7490" }}>· partite del giorno</span>
        </h1>
        <a href="/pronosticatore" style={{ fontSize: 12, color: "#6b7490", textDecoration: "none" }}>← analisi manuale</a>

        {/* Controlli */}
        <div style={{ background: "#161920", border: "1px solid #2a2f3f", borderRadius: 14, padding: 20, marginTop: 20, marginBottom: 16 }}>
          <div style={{ display: "flex", gap: 12, alignItems: "center", flexWrap: "wrap", marginBottom: 14 }}>
            <div>
              <label style={lbl}>Data</label>
              <input type="date" value={date} onChange={e => setDate(e.target.value)} style={{ ...inp, width: 160 }} />
            </div>
            <div style={{ flex: 1 }}>
              <label style={lbl}>Filtra risultati</label>
              <select value={filter} onChange={e => setFilter(e.target.value)} style={{ ...sel, width: "auto", minWidth: 180 }}>
                <option value="all">Tutte le partite</option>
                <option value="value">Solo con valore (EV &gt; 3%)</option>
                <option value="noodds">Senza quote (solo Poisson)</option>
              </select>
            </div>
          </div>

          <div>
            <label style={lbl}>Leghe</label>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
              {LEAGUES.map(l => (
                <button key={l.id} onClick={() => toggleLeague(l.id)}
                  style={{ padding: "6px 14px", borderRadius: 20, fontSize: 12, fontWeight: 600, cursor: "pointer", border: "1px solid", transition: "all 0.15s", background: selectedLeagues.includes(l.id) ? "#c8f135" : "transparent", color: selectedLeagues.includes(l.id) ? "#0d0f14" : "#6b7490", borderColor: selectedLeagues.includes(l.id) ? "#c8f135" : "#2a2f3f" }}>
                  {l.flag} {l.name}
                </button>
              ))}
            </div>
          </div>
        </div>

        <button onClick={load} disabled={loading || selectedLeagues.length === 0}
          style={{ width: "100%", padding: 14, fontSize: 15, fontWeight: 800, borderRadius: 10, border: "none", cursor: loading ? "not-allowed" : "pointer", background: loading ? "#2a2f3f" : "#c8f135", color: loading ? "#6b7490" : "#0d0f14", marginBottom: 20 }}>
          {loading ? `⏳ ${progress}` : "ANALIZZA PARTITE DEL GIORNO ↗"}
        </button>

        {/* Sommario */}
        {matches.length > 0 && (
          <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 10, marginBottom: 16 }}>
            {[
              ["Partite analizzate", matches.length, "#e8ecf5"],
              ["Con valore (EV>3%)", matches.filter(m => m.best?.ev > 0.03).length, "#c8f135"],
              ["Con quote disponibili", matches.filter(m => m.odds).length, "#4af0c4"],
            ].map(([l, v, c]) => (
              <div key={l} style={{ background: "#161920", border: "1px solid #2a2f3f", borderRadius: 10, padding: "14px 12px", textAlign: "center" }}>
                <div style={{ fontSize: 10, color: "#6b7490", fontWeight: 700, letterSpacing: "0.08em", marginBottom: 6, textTransform: "uppercase" }}>{l}</div>
                <div style={{ fontSize: 28, fontWeight: 700, color: c }}>{v}</div>
              </div>
            ))}
          </div>
        )}

        {/* Lista partite */}
        {filtered.map(m => (
          <div key={m.id} style={{ background: "#161920", border: `1px solid ${m.best?.ev > 0.03 ? "rgba(200,241,53,0.3)" : "#2a2f3f"}`, borderRadius: 14, padding: 18, marginBottom: 10 }}>
            
            {/* Header */}
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
              <div style={{ fontSize: 11, color: "#6b7490", fontWeight: 700, letterSpacing: "0.08em" }}>
                {m.league.flag} {m.league.name} · {m.time}
              </div>
              {m.best && (
                <div style={{ fontSize: 12, fontWeight: 700, color: evColor(m.best.ev), background: "rgba(0,0,0,0.3)", padding: "3px 10px", borderRadius: 20 }}>
                  EV {m.best.ev > 0 ? "+" : ""}{(m.best.ev * 100).toFixed(1)}%
                </div>
              )}
            </div>

            {/* Squadre */}
            <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 14 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 8, flex: 1 }}>
                {m.home.logo && <img src={m.home.logo} style={{ width: 28, height: 28 }} alt="" />}
                <span style={{ fontWeight: 700, fontSize: 15 }}>{m.home.name}</span>
              </div>
              <div style={{ color: "#6b7490", fontSize: 13, fontWeight: 600 }}>vs</div>
              <div style={{ display: "flex", alignItems: "center", gap: 8, flex: 1, justifyContent: "flex-end" }}>
                <span style={{ fontWeight: 700, fontSize: 15 }}>{m.away.name}</span>
                {m.away.logo && <img src={m.away.logo} style={{ width: 28, height: 28 }} alt="" />}
              </div>
            </div>

            {/* Probabilità */}
            <div style={{ display: "grid", gridTemplateColumns: "repeat(5, 1fr)", gap: 6, marginBottom: m.best ? 10 : 0 }}>
              {[
                ["1", (m.probs.h * 100).toFixed(0) + "%"],
                ["X", (m.probs.d * 100).toFixed(0) + "%"],
                ["2", (m.probs.a * 100).toFixed(0) + "%"],
                ["O2.5", (m.probs.o25 * 100).toFixed(0) + "%"],
                ["BTTS", (m.probs.btts * 100).toFixed(0) + "%"],
              ].map(([l, v]) => (
                <div key={l} style={{ background: "#0d0f14", border: "1px solid #2a2f3f", borderRadius: 8, padding: "8px 4px", textAlign: "center" }}>
                  <div style={{ fontSize: 9, color: "#6b7490", fontWeight: 700, letterSpacing: "0.06em", marginBottom: 3 }}>{l}</div>
                  <div style={{ fontSize: 15, fontWeight: 600, color: "#e8ecf5" }}>{v}</div>
                </div>
              ))}
            </div>

            {/* Best bet */}
            {m.best && m.best.ev > 0 && (
              <div style={{ borderRadius: 8, padding: "10px 14px", background: m.best.ev > 0.03 ? "rgba(200,241,53,0.08)" : "rgba(255,208,96,0.08)", border: `1px solid ${m.best.ev > 0.03 ? "rgba(200,241,53,0.25)" : "rgba(255,208,96,0.25)"}`, fontSize: 13, fontWeight: 600, color: m.best.ev > 0.03 ? "#c8f135" : "#ffd060" }}>
                ✓ {m.best.label} · Prob {(m.best.prob * 100).toFixed(1)}% · Quota {m.best.odd?.toFixed(2)} · EV +{(m.best.ev * 100).toFixed(1)}%
              </div>
            )}

            {!m.odds && (
              <div style={{ fontSize: 11, color: "#6b7490", marginTop: 6 }}>Quote non disponibili — usa le probabilità Poisson come riferimento</div>
            )}
          </div>
        ))}

        {matches.length === 0 && !loading && (
          <div style={{ textAlign: "center", color: "#6b7490", padding: "40px 0", fontSize: 14 }}>
            Seleziona le leghe e clicca Analizza per vedere le partite del giorno
          </div>
        )}

      </div>
    </div>
  );
}

const lbl = { fontSize: 11, fontWeight: 700, color: "#6b7490", letterSpacing: "0.06em", textTransform: "uppercase", display: "block", marginBottom: 5 };
const inp = { background: "#0d0f14", border: "1px solid #2a2f3f", borderRadius: 8, padding: "9px 12px", color: "#e8ecf5", fontSize: 14, outline: "none", boxSizing: "border-box" };
const sel = { background: "#0d0f14", border: "1px solid #2a2f3f", borderRadius: 8, padding: "9px 12px", color: "#e8ecf5", fontSize: 14, outline: "none", boxSizing: "border-box" };
