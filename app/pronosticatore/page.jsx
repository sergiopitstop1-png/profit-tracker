"use client";
import { useState, useCallback } from "react";

const API = "/api/football";

function poisson(k, lambda) {
  let p = Math.exp(-lambda);
  for (let i = 1; i <= k; i++) p *= lambda / i;
  return p;
}

function buildMatrix(lH, lA, max = 6) {
  const m = [];
  for (let i = 0; i <= max; i++) {
    m[i] = [];
    for (let j = 0; j <= max; j++) {
      m[i][j] = poisson(i, lH) * poisson(j, lA);
    }
  }
  return m;
}

function calcProbs(matrix, max = 6) {
  let h = 0, d = 0, a = 0, o25 = 0, u25 = 0, btts = 0, o05ht = 0;
  for (let i = 0; i <= max; i++) {
    for (let j = 0; j <= max; j++) {
      const p = matrix[i][j];
      if (i > j) h += p;
      else if (i === j) d += p;
      else a += p;
      if (i + j > 2.5) o25 += p;
      else u25 += p;
      if (i > 0 && j > 0) btts += p;
      if (i + j >= 1) o05ht += p * 0.42;
    }
  }
  return { h, d, a, o25, u25, btts, bttsNo: 1 - btts, o05ht: Math.min(o05ht + 0.18, 0.92) };
}

function ev(prob, odd) {
  return prob * (odd - 1) - (1 - prob);
}

export default function Pronosticatore() {
  const [leagueId, setLeagueId] = useState("135");
  const [season, setSeason] = useState("2024");
  const [searchH, setSearchH] = useState("");
  const [searchA, setSearchA] = useState("");
  const [teamsH, setTeamsH] = useState([]);
  const [teamsA, setTeamsA] = useState([]);
  const [teamH, setTeamH] = useState(null);
  const [teamA, setTeamA] = useState(null);
  const [statsH, setStatsH] = useState(null);
  const [statsA, setStatsA] = useState(null);
  const [loading, setLoading] = useState("");
  const [result, setResult] = useState(null);
  const [odds, setOdds] = useState({ o1: "", oX: "", o2: "", oOver25: "", oBTTS: "", oO05HT: "" });
  const [pick, setPick] = useState("h");

  const leagues = [
    { id: "135", name: "Serie A" },
    { id: "140", name: "La Liga" },
    { id: "39", name: "Premier League" },
    { id: "78", name: "Bundesliga" },
    { id: "61", name: "Ligue 1" },
    { id: "2", name: "Champions League" },
  ];

  const searchTeam = useCallback(async (q, side) => {
    if (q.length < 3) return;
    const r = await fetch(`${API}?endpoint=teams&search=${encodeURIComponent(q)}`);
    const d = await r.json();
    if (side === "h") setTeamsH(d.response || []);
    else setTeamsA(d.response || []);
  }, []);

  const loadStats = async (team, side) => {
    setLoading(side === "h" ? "Casa..." : "Ospite...");
    const r = await fetch(`${API}?endpoint=teams/statistics&league=${leagueId}&season=${season}&team=${team.team.id}`);
    const d = await r.json();
    const s = d.response;
    if (side === "h") { setTeamH(team); setStatsH(s); setTeamsH([]); }
    else { setTeamA(team); setStatsA(s); setTeamsA([]); }
    setLoading("");
  };

  const calcola = () => {
    if (!statsH || !statsA) return;
    const gfH = statsH.goals?.for?.average?.home || 1.2;
    const gaH = statsH.goals?.against?.average?.home || 1.0;
    const gfA = statsA.goals?.for?.average?.away || 1.0;
    const gaA = statsA.goals?.against?.average?.away || 1.2;
    const lgAvg = 1.35;
    const attH = parseFloat(gfH) / lgAvg;
    const defH = parseFloat(gaH) / lgAvg;
    const attA = parseFloat(gfA) / lgAvg;
    const defA = parseFloat(gaA) / lgAvg;
    const lH = attH * defA * lgAvg * 1.1;
    const lA = attA * defH * lgAvg;
    const matrix = buildMatrix(lH, lA);
    const probs = calcProbs(matrix);
    const pickProbs = { h: probs.h, d: probs.d, a: probs.a, o25: probs.o25, u25: probs.u25, btts: probs.btts, bttsNo: probs.bttsNo, o05ht: probs.o05ht };
    const pickOdds = { h: odds.o1, d: odds.oX, a: odds.o2, o25: odds.oOver25, u25: odds.oOver25, btts: odds.oBTTS, bttsNo: odds.oBTTS, o05ht: odds.oO05HT };
    const myProb = pickProbs[pick];
    const myOdd = parseFloat(pickOdds[pick]) || 0;
    const myEv = myOdd > 1 ? ev(myProb, myOdd) : null;
    setResult({ probs, lH, lA, myProb, myOdd, myEv, pick });
  };

  const pickLabels = { h: "Casa vince", d: "Pareggio", a: "Ospite vince", o25: "Over 2.5", u25: "Under 2.5", btts: "BTTS Sì", bttsNo: "BTTS No", o05ht: "Over 0.5 HT" };

  return (
    <div style={{ minHeight: "100vh", background: "#0d0f14", color: "#e8ecf5", fontFamily: "system-ui, sans-serif", padding: "24px 16px" }}>
      <div style={{ maxWidth: 760, margin: "0 auto" }}>
        <h1 style={{ fontSize: 28, fontWeight: 800, marginBottom: 4 }}>PRONO<span style={{ color: "#c8f135" }}>X</span> <span style={{ fontSize: 13, fontWeight: 400, color: "#6b7490" }}>v2.0 · dati reali</span></h1>

        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginBottom: 16, marginTop: 20 }}>
          <div>
            <label style={lbl}>Lega</label>
            <select value={leagueId} onChange={e => setLeagueId(e.target.value)} style={sel}>
              {leagues.map(l => <option key={l.id} value={l.id}>{l.name}</option>)}
            </select>
          </div>
          <div>
            <label style={lbl}>Stagione</label>
            <select value={season} onChange={e => setSeason(e.target.value)} style={sel}>
              <option value="2024">2024/25</option>
              <option value="2023">2023/24</option>
            </select>
          </div>
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginBottom: 16 }}>
          {[["h", "Squadra Casa", searchH, setSearchH, teamsH], ["a", "Squadra Ospite", searchA, setSearchA, teamsA]].map(([side, label, val, setVal, teams]) => (
            <div key={side} style={{ position: "relative" }}>
              <label style={lbl}>{label}</label>
              <div style={{ display: "flex", gap: 6 }}>
                <input value={val} onChange={e => setVal(e.target.value)} placeholder="Es. Napoli..." style={{ ...inp, flex: 1 }} />
                <button onClick={() => searchTeam(val, side)} style={btn}>Cerca</button>
              </div>
              {teams.length > 0 && (
                <div style={{ position: "absolute", zIndex: 10, background: "#1e2230", border: "1px solid #2a2f3f", borderRadius: 8, width: "100%", top: "100%", marginTop: 2 }}>
                  {teams.slice(0, 6).map(t => (
                    <div key={t.team.id} onClick={() => loadStats(t, side)}
                      style={{ padding: "8px 12px", cursor: "pointer", fontSize: 13, display: "flex", alignItems: "center", gap: 8, borderBottom: "1px solid #2a2f3f" }}
                      onMouseEnter={e => e.currentTarget.style.background = "#2a2f3f"}
                      onMouseLeave={e => e.currentTarget.style.background = "transparent"}>
                      {t.team.logo && <img src={t.team.logo} style={{ width: 20, height: 20 }} alt="" />}
                      {t.team.name} <span style={{ color: "#6b7490", fontSize: 11 }}>{t.team.country}</span>
                    </div>
                  ))}
                </div>
              )}
              {(side === "h" ? teamH : teamA) && (
                <div style={{ marginTop: 6, display: "flex", alignItems: "center", gap: 8, fontSize: 13, color: "#c8f135" }}>
                  <img src={(side === "h" ? teamH : teamA).team.logo} style={{ width: 24, height: 24 }} alt="" />
                  {(side === "h" ? teamH : teamA).team.name} ✓
                </div>
              )}
            </div>
          ))}
        </div>

        {loading && <div style={{ color: "#c8f135", fontSize: 13, marginBottom: 12 }}>Carico statistiche {loading}</div>}

        {statsH && statsA && (
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginBottom: 16 }}>
            {[[statsH, teamH, "Casa"], [statsA, teamA, "Ospite"]].map(([s, t, label]) => (
              <div key={label} style={card}>
                <div style={{ fontSize: 11, color: "#6b7490", fontWeight: 700, letterSpacing: "0.1em", marginBottom: 8 }}>{label.toUpperCase()}</div>
                <div style={{ fontSize: 13 }}>
                  <div>Gol fatti (casa/trasferta): <span style={{ color: "#c8f135" }}>{s.goals?.for?.average?.home} / {s.goals?.for?.average?.away}</span></div>
                  <div>Gol subiti (casa/trasferta): <span style={{ color: "#f0794a" }}>{s.goals?.against?.average?.home} / {s.goals?.against?.average?.away}</span></div>
                  <div>Forma: <span style={{ color: "#4af0c4" }}>{s.form?.slice(-5)}</span></div>
                </div>
              </div>
            ))}
          </div>
        )}

        <div style={card}>
          <div style={{ fontSize: 11, color: "#6b7490", fontWeight: 700, letterSpacing: "0.1em", marginBottom: 12 }}>QUOTE BOOKMAKER</div>
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

        <button onClick={calcola} disabled={!statsH || !statsA} style={{ ...btn, width: "100%", padding: "14px", fontSize: 15, fontWeight: 800, marginTop: 8, background: statsH && statsA ? "#c8f135" : "#2a2f3f", color: statsH && statsA ? "#0d0f14" : "#6b7490", border: "none", borderRadius: 10, cursor: statsH && statsA ? "pointer" : "not-allowed" }}>
          CALCOLA PRONOSTICO ↗
        </button>

        {result && (
          <div style={{ ...card, marginTop: 14 }}>
            <div style={{ fontSize: 11, color: "#6b7490", fontWeight: 700, letterSpacing: "0.1em", marginBottom: 16 }}>RISULTATO ANALISI</div>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 10, marginBottom: 16 }}>
              {[["1 Casa", (result.probs.h * 100).toFixed(1) + "%", "#c8f135"], ["X Pareggio", (result.probs.d * 100).toFixed(1) + "%", "#ffd060"], ["2 Ospite", (result.probs.a * 100).toFixed(1) + "%", "#4af0c4"], ["Over 2.5", (result.probs.o25 * 100).toFixed(1) + "%", "#c8f135"], ["BTTS Sì", (result.probs.btts * 100).toFixed(1) + "%", "#4af0c4"], ["Over 0.5 HT", (result.probs.o05ht * 100).toFixed(1) + "%", "#ffd060"]].map(([l, v, c]) => (
                <div key={l} style={{ background: "#0d0f14", border: "1px solid #2a2f3f", borderRadius: 10, padding: "12px 10px", textAlign: "center" }}>
                  <div style={{ fontSize: 10, color: "#6b7490", fontWeight: 700, letterSpacing: "0.08em", marginBottom: 4 }}>{l}</div>
                  <div style={{ fontSize: 22, fontWeight: 500, color: c }}>{v}</div>
                </div>
              ))}
            </div>
            <div style={{ fontSize: 12, color: "#6b7490", marginBottom: 12 }}>λ Casa: {result.lH.toFixed(2)} · λ Ospite: {result.lA.toFixed(2)}</div>
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
      </div>
    </div>
  );
}

const lbl = { fontSize: 11, fontWeight: 700, color: "#6b7490", letterSpacing: "0.06em", textTransform: "uppercase", display: "block", marginBottom: 5 };
const inp = { background: "#0d0f14", border: "1px solid #2a2f3f", borderRadius: 8, padding: "9px 12px", color: "#e8ecf5", fontFamily: "monospace", fontSize: 14, outline: "none", width: "100%", boxSizing: "border-box" };
const sel = { background: "#0d0f14", border: "1px solid #2a2f3f", borderRadius: 8, padding: "9px 12px", color: "#e8ecf5", fontSize: 14, outline: "none", width: "100%", boxSizing: "border-box" };
const btn = { background: "transparent", border: "1px solid #2a2f3f", borderRadius: 8, padding: "9px 14px", color: "#e8ecf5", fontSize: 13, cursor: "pointer", whiteSpace: "nowrap" };
const card = { background: "#161920", border: "1px solid #2a2f3f", borderRadius: 14, padding: "20px", marginBottom: 14 };
