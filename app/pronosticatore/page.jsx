"use client";
import { useState, useCallback } from "react";

const API_FD = "/api/footballdata";

const LEAGUES = [
  { code: "SA", name: "Serie A", flag: "🇮🇹" },
  { code: "PD", name: "La Liga", flag: "🇪🇸" },
  { code: "PL", name: "Premier League", flag: "🏴󠁧󠁢󠁥󠁮󠁧󠁿" },
  { code: "BL1", name: "Bundesliga", flag: "🇩🇪" },
  { code: "FL1", name: "Ligue 1", flag: "🇫🇷" },
  { code: "CL", name: "Champions League", flag: "⭐" },
];

function poisson(k, lambda) {
  let p = Math.exp(-lambda);
  for (let i = 1; i <= k; i++) p *= lambda / i;
  return p;
}

function calcProbs(lH, lA, max = 8) {
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

function calcRatings(matches) {
  const teams = {};
  const finished = matches.filter(m =>
    m.status === "FINISHED" &&
    m.score?.fullTime?.home !== null &&
    m.score?.fullTime?.away !== null
  );
  if (finished.length === 0) return { teams, lgAvgHome: 1.35, lgAvgAway: 1.1 };
  finished.forEach(m => {
    const hId = m.homeTeam.id;
    const aId = m.awayTeam.id;
    const hG = m.score.fullTime.home;
    const aG = m.score.fullTime.away;
    if (!teams[hId]) teams[hId] = { name: m.homeTeam.name, crest: m.homeTeam.crest, hGF: 0, hGA: 0, hP: 0, aGF: 0, aGA: 0, aP: 0 };
    if (!teams[aId]) teams[aId] = { name: m.awayTeam.name, crest: m.awayTeam.crest, hGF: 0, hGA: 0, hP: 0, aGF: 0, aGA: 0, aP: 0 };
    teams[hId].hGF += hG; teams[hId].hGA += aG; teams[hId].hP++;
    teams[aId].aGF += aG; teams[aId].aGA += hG; teams[aId].aP++;
  });
  const totHomeGoals = finished.reduce((s, m) => s + m.score.fullTime.home, 0);
  const totAwayGoals = finished.reduce((s, m) => s + m.score.fullTime.away, 0);
  const lgAvgHome = totHomeGoals / finished.length;
  const lgAvgAway = totAwayGoals / finished.length;
  Object.values(teams).forEach(t => {
    t.attH = t.hP > 0 ? (t.hGF / t.hP) / lgAvgHome : 1;
    t.defH = t.hP > 0 ? (t.hGA / t.hP) / lgAvgAway : 1;
    t.attA = t.aP > 0 ? (t.aGF / t.aP) / lgAvgAway : 1;
    t.defA = t.aP > 0 ? (t.aGA / t.aP) / lgAvgHome : 1;
    t.avgHomeGoals = t.hP > 0 ? (t.hGF / t.hP).toFixed(2) : "N/D";
    t.avgHomeConceded = t.hP > 0 ? (t.hGA / t.hP).toFixed(2) : "N/D";
    t.avgAwayGoals = t.aP > 0 ? (t.aGF / t.aP).toFixed(2) : "N/D";
    t.avgAwayConceded = t.aP > 0 ? (t.aGA / t.aP).toFixed(2) : "N/D";
    t.form = "N/D";
  });
  return { teams, lgAvgHome, lgAvgAway };
}

function getLambdas(teamH, teamA, lgAvgHome, lgAvgAway) {
  const lH = teamH.attH * teamA.defA * lgAvgHome;
  const lA = teamA.attA * teamH.defH * lgAvgAway;
  return { lH, lA };
}

function ev(prob, odd) {
  if (!odd || odd <= 1) return null;
  return prob * (odd - 1) - (1 - prob);
}

export default function Pronosticatore() {
  const [leagueCode, setLeagueCode] = useState("SA");
  const [matches, setMatches] = useState([]);
  const [ratings, setRatings] = useState(null);
  const [loadingLeague, setLoadingLeague] = useState(false);
  const [searchH, setSearchH] = useState("");
  const [searchA, setSearchA] = useState("");
  const [teamH, setTeamH] = useState(null);
  const [teamA, setTeamA] = useState(null);
  const [filteredH, setFilteredH] = useState([]);
  const [filteredA, setFilteredA] = useState([]);
  const [result, setResult] = useState(null);
  const [odds, setOdds] = useState({ o1: "", oX: "", o2: "", oOver25: "", oBTTS: "", oO05HT: "" });
  const [pick, setPick] = useState("h");

  const loadLeague = async (code) => {
    setLoadingLeague(true);
    setRatings(null);
    setTeamH(null);
    setTeamA(null);
    setResult(null);
    setFilteredH([]);
    setFilteredA([]);
    try {
      const r = await fetch(`${API_FD}?endpoint=competitions/${code}/matches&season=2025`);
      const d = await r.json();
      const allMatches = d.matches || [];
      setMatches(allMatches);
      const { teams, lgAvgHome, lgAvgAway } = calcRatings(allMatches);
      setRatings({ teams, lgAvgHome, lgAvgAway });
    } catch (e) {
      console.error(e);
    }
    setLoadingLeague(false);
  };

  const searchTeam = (q, side) => {
    if (!ratings || q.length < 2) {
      side === "h" ? setFilteredH([]) : setFilteredA([]);
      return;
    }
    const results = Object.entries(ratings.teams)
      .filter(([, t]) => t.name.toLowerCase().includes(q.toLowerCase()))
      .map(([id, t]) => ({ id, ...t }));
    side === "h" ? setFilteredH(results) : setFilteredA(results);
  };

  const selectTeam = (team, side) => {
    if (side === "h") { setTeamH(team); setFilteredH([]); setSearchH(team.name); }
    else { setTeamA(team); setFilteredA([]); setSearchA(team.name); }
  };

  const calcola = () => {
    if (!teamH || !teamA || !ratings) return;
    const { lH, lA } = getLambdas(teamH, teamA, ratings.lgAvgHome, ratings.lgAvgAway);
    const probs = calcProbs(lH, lA);
    const pickProbs = { h: probs.h, d: probs.d, a: probs.a, o25: probs.o25, u25: probs.u25, btts: probs.btts, bttsNo: probs.bttsNo, o05ht: probs.o05ht };
    const pickOdds = { h: odds.o1, d: odds.oX, a: odds.o2, o25: odds.oOver25, u25: odds.oOver25, btts: odds.oBTTS, bttsNo: odds.oBTTS, o05ht: odds.oO05HT };
    const myProb = pickProbs[pick];
    const myOdd = parseFloat(pickOdds[pick]) || 0;
    const myEv = myOdd > 1 ? ev(myProb, myOdd) : null;
    setResult({ probs, lH, lA, myProb, myOdd, myEv, pick });
  };

  const pickLabels = { h: "Casa vince", d: "Pareggio", a: "Ospite vince", o25: "Over 2.5", u25: "Under 2.5", btts: "BTTS Sì", bttsNo: "BTTS No", o05ht: "Over 0.5 HT" };
  const teamCount = ratings ? Object.keys(ratings.teams).length : 0;

  return (
    <div style={{ minHeight: "100vh", background: "#0d0f14", color: "#e8ecf5", fontFamily: "system-ui, sans-serif", padding: "24px 16px" }}>
      <div style={{ maxWidth: 760, margin: "0 auto" }}>
        <h1 style={{ fontSize: 28, fontWeight: 800, marginBottom: 4 }}>PRONO<span style={{ color: "#c8f135" }}>X</span> <span style={{ fontSize: 13, fontWeight: 400, color: "#6b7490" }}>v3.0 · Dixon-Coles</span></h1>
        <div style={{ display: "flex", gap: 16, marginBottom: 20 }}>
          <a href="/" style={{ fontSize: 12, color: "#6b7490", textDecoration: "none" }}>← home</a>
          <a href="/oggi" style={{ fontSize: 12, color: "#6b7490", textDecoration: "none" }}>📅 partite del giorno</a>
        </div>

        {/* Selezione lega */}
        <div style={card}>
          <div style={cardTitle}>SELEZIONA LEGA</div>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginBottom: 14 }}>
            {LEAGUES.map(l => (
              <button key={l.code} onClick={() => { setLeagueCode(l.code); loadLeague(l.code); }}
                style={{ padding: "6px 14px", borderRadius: 20, fontSize: 12, fontWeight: 600, cursor: "pointer", border: "1px solid", background: leagueCode === l.code ? "#c8f135" : "transparent", color: leagueCode === l.code ? "#0d0f14" : "#6b7490", borderColor: leagueCode === l.code ? "#c8f135" : "#2a2f3f" }}>
                {l.flag} {l.name}
              </button>
            ))}
          </div>
          {loadingLeague && <div style={{ color: "#c8f135", fontSize: 13 }}>⏳ Carico statistiche stagione corrente...</div>}
          {ratings && !loadingLeague && (
            <div style={{ fontSize: 12, color: "#4af0c4" }}>
              ✓ {teamCount} squadre caricate · Media gol casa: {ratings.lgAvgHome.toFixed(2)} · trasferta: {ratings.lgAvgAway.toFixed(2)}
            </div>
          )}
        </div>

        {/* Ricerca squadre */}
        {ratings && (
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginBottom: 14 }}>
            {[["h", "Squadra Casa", searchH, setSearchH, filteredH], ["a", "Squadra Ospite", searchA, setSearchA, filteredA]].map(([side, label, val, setVal, filtered]) => (
              <div key={side} style={{ position: "relative" }}>
                <label style={lbl}>{label}</label>
                <input value={val}
                  onChange={e => { setVal(e.target.value); searchTeam(e.target.value, side); }}
                  placeholder="Cerca squadra..."
                  style={inp} />
                {filtered.length > 0 && (
                  <div style={{ position: "absolute", zIndex: 10, background: "#1e2230", border: "1px solid #2a2f3f", borderRadius: 8, width: "100%", top: "100%", marginTop: 2, maxHeight: 200, overflowY: "auto" }}>
                    {filtered.map(t => (
                      <div key={t.id} onClick={() => selectTeam(t, side)}
                        style={{ padding: "8px 12px", cursor: "pointer", fontSize: 13, display: "flex", alignItems: "center", gap: 8, borderBottom: "1px solid #2a2f3f" }}
                        onMouseEnter={e => e.currentTarget.style.background = "#2a2f3f"}
                        onMouseLeave={e => e.currentTarget.style.background = "transparent"}>
                        {t.crest && <img src={t.crest} style={{ width: 20, height: 20 }} alt="" />}
                        {t.name}
                      </div>
                    ))}
                  </div>
                )}
                {(side === "h" ? teamH : teamA) && (
                  <div style={{ marginTop: 6, fontSize: 12, color: "#c8f135", display: "flex", alignItems: "center", gap: 6 }}>
                    {(side === "h" ? teamH : teamA).crest && <img src={(side === "h" ? teamH : teamA).crest} style={{ width: 20, height: 20 }} alt="" />}
                    {(side === "h" ? teamH : teamA).name} ✓
                  </div>
                )}
              </div>
            ))}
          </div>
        )}

        {/* Stats preview */}
        {teamH && teamA && (
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginBottom: 14 }}>
            {[[teamH, "Casa"], [teamA, "Ospite"]].map(([t, label]) => (
              <div key={label} style={card}>
                <div style={cardTitle}>{label.toUpperCase()}</div>
                <div style={{ fontSize: 13 }}>
                  <div>Gol fatti casa: <span style={{ color: "#c8f135" }}>{t.avgHomeGoals}</span> · trasferta: <span style={{ color: "#c8f135" }}>{t.avgAwayGoals}</span></div>
                  <div>Gol subiti casa: <span style={{ color: "#f0794a" }}>{t.avgHomeConceded}</span> · trasferta: <span style={{ color: "#f0794a" }}>{t.avgAwayConceded}</span></div>
                  <div style={{ marginTop: 6 }}>
                    <span style={{ fontSize: 11, color: "#6b7490" }}>ATT casa: </span><span style={{ color: "#4af0c4" }}>{t.attH.toFixed(2)}</span>
                    <span style={{ fontSize: 11, color: "#6b7490" }}> · DEF casa: </span><span style={{ color: "#ffd060" }}>{t.defH.toFixed(2)}</span>
                  </div>
                  <div>
                    <span style={{ fontSize: 11, color: "#6b7490" }}>ATT trasf: </span><span style={{ color: "#4af0c4" }}>{t.attA.toFixed(2)}</span>
                    <span style={{ fontSize: 11, color: "#6b7490" }}> · DEF trasf: </span><span style={{ color: "#ffd060" }}>{t.defA.toFixed(2)}</span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Quote */}
        {teamH && teamA && (
          <div style={card}>
            <div style={cardTitle}>QUOTE BOOKMAKER</div>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 10, marginBottom: 10 }}>
              {[["1 Casa", "o1"], ["X Pareggio", "oX"], ["2 Ospite", "o2"]].map(([l, k]) => (
                <div key={k}>
                  <label style={lbl}>{l}</label>
                  <input type="number" step="0.01" value={odds[k]} onChange={e => setOdds({ ...odds, [k]: e.target.value })} placeholder="2.10" style={inp} />
                </div>
              ))}
              {[["Over 2.5", "oOver25"], ["BTTS Sì", "oBTTS"], ["Over 0.5 HT", "oO05HT"]].map(([l, k]) => (
                <div key={k}>
                  <label style={lbl}>{l}</label>
                  <input type="number" step="0.01" value={odds[k]} onChange={e => setOdds({ ...odds, [k]: e.target.value })} placeholder="1.85" style={inp} />
                </div>
              ))}
            </div>
            <div>
              <label style={lbl}>Scommessa su</label>
              <select value={pick} onChange={e => setPick(e.target.value)} style={sel}>
                {Object.entries(pickLabels).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
              </select>
            </div>
          </div>
        )}

        {teamH && teamA && (
          <button onClick={calcola} style={{ ...btnCalc }}>
            CALCOLA PRONOSTICO ↗
          </button>
        )}

        {/* Risultati */}
        {result && (
          <div style={{ ...card, marginTop: 14 }}>
            <div style={cardTitle}>RISULTATO ANALISI</div>
            <div style={{ fontSize: 12, color: "#6b7490", marginBottom: 12 }}>
              λ Casa: <span style={{ color: "#c8f135" }}>{result.lH.toFixed(3)}</span> · λ Ospite: <span style={{ color: "#4af0c4" }}>{result.lA.toFixed(3)}</span>
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 10, marginBottom: 16 }}>
              {[
                ["1 Casa", (result.probs.h * 100).toFixed(1) + "%", "#c8f135"],
                ["X Pareggio", (result.probs.d * 100).toFixed(1) + "%", "#ffd060"],
                ["2 Ospite", (result.probs.a * 100).toFixed(1) + "%", "#4af0c4"],
                ["Over 2.5", (result.probs.o25 * 100).toFixed(1) + "%", "#c8f135"],
                ["BTTS Sì", (result.probs.btts * 100).toFixed(1) + "%", "#4af0c4"],
                ["Over 0.5 HT", (result.probs.o05ht * 100).toFixed(1) + "%", "#ffd060"],
              ].map(([l, v, c]) => (
                <div key={l} style={{ background: "#0d0f14", border: "1px solid #2a2f3f", borderRadius: 10, padding: "12px 10px", textAlign: "center" }}>
                  <div style={{ fontSize: 10, color: "#6b7490", fontWeight: 700, letterSpacing: "0.08em", marginBottom: 4 }}>{l}</div>
                  <div style={{ fontSize: 22, fontWeight: 500, color: c }}>{v}</div>
                </div>
              ))}
            </div>
            {result.myEv !== null && (
              <div style={{ borderRadius: 10, padding: "14px 16px", background: result.myEv > 0.03 ? "rgba(200,241,53,0.08)" : result.myEv > 0 ? "rgba(255,208,96,0.08)" : "rgba(255,92,92,0.08)", border: `1px solid ${result.myEv > 0.03 ? "rgba(200,241,53,0.3)" : result.myEv > 0 ? "rgba(255,208,96,0.3)" : "rgba(255,92,92,0.3)"}`, color: result.myEv > 0.03 ? "#c8f135" : result.myEv > 0 ? "#ffd060" : "#ff5c5c", fontSize: 14, fontWeight: 600 }}>
                {pickLabels[result.pick]} · Prob: {(result.myProb * 100).toFixed(1)}% · Quota: {result.myOdd} · EV: {result.myEv > 0 ? "+" : ""}{(result.myEv * 100).toFixed(1)}%
                <div style={{ fontSize: 12, fontWeight: 400, marginTop: 4, opacity: 0.8 }}>
                  {result.myEv > 0.03 ? "✓ Valore positivo — considera la puntata" : result.myEv > 0 ? "~ Valore marginale — valuta con attenzione" : "✗ Nessun valore — quota bruciata"}
                </div>
              </div>
            )}
          </div>
        )}

        {!ratings && !loadingLeague && (
          <div style={{ textAlign: "center", color: "#6b7490", padding: "40px 0", fontSize: 14 }}>
            Seleziona una lega per caricare le statistiche della stagione corrente
          </div>
        )}
      </div>
    </div>
  );
}

const lbl = { fontSize: 11, fontWeight: 700, color: "#6b7490", letterSpacing: "0.06em", textTransform: "uppercase", display: "block", marginBottom: 5 };
const inp = { background: "#0d0f14", border: "1px solid #2a2f3f", borderRadius: 8, padding: "9px 12px", color: "#e8ecf5", fontFamily: "monospace", fontSize: 14, outline: "none", width: "100%", boxSizing: "border-box" };
const sel = { background: "#0d0f14", border: "1px solid #2a2f3f", borderRadius: 8, padding: "9px 12px", color: "#e8ecf5", fontSize: 14, outline: "none", width: "100%", boxSizing: "border-box" };
const card = { background: "#161920", border: "1px solid #2a2f3f", borderRadius: 14, padding: "20px", marginBottom: 14 };
const cardTitle = { fontSize: 11, fontWeight: 700, color: "#6b7490", letterSpacing: "0.12em", textTransform: "uppercase", marginBottom: 14 };
const btnCalc = { width: "100%", padding: "14px", fontSize: 15, fontWeight: 800, borderRadius: 10, border: "none", cursor: "pointer", background: "#c8f135", color: "#0d0f14", marginBottom: 8 };
