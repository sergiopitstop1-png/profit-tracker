"use client";
import { useState } from "react";
import { createClient } from "@supabase/supabase-js";

const API_FD = "/api/footballdata";
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
);

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
  const o05ht = 1 - Math.exp(-(lH + lA) * 0.45);
  return { h, d, a, o25, u25: 1 - o25, btts, o05ht };
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
  });
  return { teams, lgAvgHome, lgAvgAway };
}

function getSignals(probs) {
  const signals = [];
  if (probs.h > 0.55) signals.push({ label: "CASA VINCE", prob: probs.h, color: "#c8f135", strong: probs.h > 0.65 });
  if (probs.a > 0.50) signals.push({ label: "OSPITE VINCE", prob: probs.a, color: "#c8f135", strong: probs.a > 0.60 });
  if (probs.o25 > 0.58) signals.push({ label: "OVER 2.5", prob: probs.o25, color: "#4af0c4", strong: probs.o25 > 0.68 });
  if (probs.btts > 0.55) signals.push({ label: "BTTS SÌ", prob: probs.btts, color: "#4af0c4", strong: probs.btts > 0.65 });
  if (probs.o05ht > 0.70) signals.push({ label: "OVER 0.5 HT", prob: probs.o05ht, color: "#ffd060", strong: probs.o05ht > 0.80 });
  if (probs.u25 > 0.62) signals.push({ label: "UNDER 2.5", prob: probs.u25, color: "#ffd060", strong: probs.u25 > 0.72 });
  if (
  probs.o05ht >= 0.70 &&
  probs.u25 >= 0.48 &&
  probs.o25 <= 0.56 &&
  probs.btts <= 0.58
) {
  signals.push({
    label: "TRADING O0.5 HT → U2.5 LIVE",
    prob: probs.o05ht,
    color: "#ff9f43",
    strong: probs.o05ht >= 0.78 && probs.u25 >= 0.52
  });
}
  signals.sort((a, b) => b.prob - a.prob);
  return signals;
}
function isTradingO05HTU25(m) {
  const totalLambda = m.lH + m.lA;

  return (
    m.probs.o05ht >= 0.70 &&
    m.probs.u25 >= 0.48 &&
    m.probs.o25 <= 0.56 &&
    m.probs.btts <= 0.58 &&
    totalLambda >= 1.70 &&
    totalLambda <= 2.60
  );
}
export default function Oggi() {
  const [date, setDate] = useState(() => new Date().toISOString().split("T")[0]);
  const [selectedLeagues, setSelectedLeagues] = useState(["SA", "CL"]);
  const [matches, setMatches] = useState([]);
  const [loading, setLoading] = useState(false);
  const [progress, setProgress] = useState("");
  const [filter, setFilter] = useState("all");
  const [savingId, setSavingId] = useState(null);
const [savedIds, setSavedIds] = useState([]);

  const toggleLeague = (code) => {
    setSelectedLeagues(prev => prev.includes(code) ? prev.filter(x => x !== code) : [...prev, code]);
  };

  const load = async () => {
    setLoading(true);
    setMatches([]);
    const all = [];

    for (const code of selectedLeagues) {
      const league = LEAGUES.find(l => l.code === code);

      // 1. Carica tutti i risultati stagione corrente per i rating
      setProgress(`Carico statistiche ${league.flag} ${league.name}...`);
      const rSeason = await fetch(`${API_FD}?endpoint=competitions/${code}/matches&season=2025`);
      const dSeason = await rSeason.json();
      const { teams, lgAvgHome, lgAvgAway } = calcRatings(dSeason.matches || []);

      // 2. Carica fixture di oggi
      setProgress(`Cerco partite ${league.flag} ${league.name}...`);
      const rToday = await fetch(`${API_FD}?endpoint=competitions/${code}/matches&dateFrom=${date}&dateTo=${date}`);
      const dToday = await rToday.json();
      const fixtures = dToday.matches || [];

      for (const fix of fixtures) {
        const hId = fix.homeTeam.id;
        const aId = fix.awayTeam.id;
        const teamH = teams[hId];
        const teamA = teams[aId];

        let lH = lgAvgHome;
        let lA = lgAvgAway;

        if (teamH && teamA) {
          lH = teamH.attH * teamA.defA * lgAvgHome;
          lA = teamA.attA * teamH.defH * lgAvgAway;
        }

        const probs = calcProbs(lH, lA);
        const signals = getSignals(probs);
        const time = fix.utcDate ? new Date(fix.utcDate).toLocaleTimeString("it-IT", { hour: "2-digit", minute: "2-digit" }) : "--:--";

        all.push({
          id: fix.id,
          home: { name: fix.homeTeam.name, crest: fix.homeTeam.crest },
          away: { name: fix.awayTeam.name, crest: fix.awayTeam.crest },
          time, league, probs, lH, lA, signals,
          hasRatings: !!(teamH && teamA),
        });
      }
    }

    all.sort((a, b) => (b.signals[0]?.prob || 0) - (a.signals[0]?.prob || 0));
    setMatches(all);
    setLoading(false);
    setProgress("");
  };
const saveToArchive = async (m) => {
  setSavingId(m.id);

  const { error } = await supabase
    .from("pronox_archive")
    .insert({
      match_id: m.id,
      match_date: date,
      match_time: m.time,
      league: m.league.name,
      home_team: m.home.name,
      away_team: m.away.name,
      prediction_type: "trading_ht_u25",
      prediction_label: "TRADING O0.5 HT → U2.5 LIVE",
      probability: m.probs.o05ht,
      lambda_home: m.lH,
      lambda_away: m.lA,
      status: "pending"
    });

  setSavingId(null);

  if (error) {
    alert("Errore salvataggio: " + error.message);
    return;
  }

  setSavedIds(prev => [...prev, m.id]);
};
  const filtered = matches.filter(m => {
    if (filter === "signal") return m.signals.length > 0;
if (filter === "strong") return m.signals.some(s => s.strong);
if (filter === "over") return m.probs.o25 > 0.58;
if (filter === "trading") return isTradingO05HTU25(m);
return true;
  });

  const strongCount = matches.filter(m => m.signals.some(s => s.strong)).length;
  const signalCount = matches.filter(m => m.signals.length > 0).length;

  return (
    <div style={{ minHeight: "100vh", background: "#0d0f14", color: "#e8ecf5", fontFamily: "system-ui, sans-serif", padding: "24px 16px" }}>
      <div style={{ maxWidth: 860, margin: "0 auto" }}>

        <h1 style={{ fontSize: 26, fontWeight: 800, marginBottom: 4 }}>
          PRONO<span style={{ color: "#c8f135" }}>X</span>
          <span style={{ fontSize: 13, fontWeight: 400, color: "#6b7490" }}> · partite del giorno</span>
        </h1>
        <div style={{ display: "flex", gap: 16, marginBottom: 20 }}>
          <a href="/" style={{ fontSize: 12, color: "#6b7490", textDecoration: "none" }}>← home</a>
          <a href="/pronosticatore" style={{ fontSize: 12, color: "#6b7490", textDecoration: "none" }}>⚽ analisi manuale</a>
        </div>

        <div style={{ background: "#161920", border: "1px solid #2a2f3f", borderRadius: 14, padding: 20, marginBottom: 16 }}>
          <div style={{ display: "flex", gap: 12, alignItems: "flex-end", flexWrap: "wrap", marginBottom: 14 }}>
            <div>
              <label style={lbl}>Data</label>
              <input type="date" value={date} onChange={e => setDate(e.target.value)} style={{ ...inp, width: 160 }} />
            </div>
            <div>
              <label style={lbl}>Filtra</label>
              <select value={filter} onChange={e => setFilter(e.target.value)} style={{ ...sel, minWidth: 200 }}>
                <option value="all">Tutte le partite</option>
                <option value="signal">Con almeno un segnale</option>
                <option value="strong">Solo segnali forti</option>
                <option value="over">Over 2.5 probabile</option>
                <option value="trading">Trading O0.5 HT + U2.5 Live</option>
              </select>
            </div>
          </div>
          <div>
            <label style={lbl}>Leghe</label>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
              {LEAGUES.map(l => (
                <button key={l.code} onClick={() => toggleLeague(l.code)}
                  style={{ padding: "6px 14px", borderRadius: 20, fontSize: 12, fontWeight: 600, cursor: "pointer", border: "1px solid", background: selectedLeagues.includes(l.code) ? "#c8f135" : "transparent", color: selectedLeagues.includes(l.code) ? "#0d0f14" : "#6b7490", borderColor: selectedLeagues.includes(l.code) ? "#c8f135" : "#2a2f3f" }}>
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

        {matches.length > 0 && (
          <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 10, marginBottom: 16 }}>
            {[
              ["Partite analizzate", matches.length, "#e8ecf5"],
              ["Con segnale", signalCount, "#4af0c4"],
              ["Segnali forti", strongCount, "#c8f135"],
            ].map(([l, v, c]) => (
              <div key={l} style={{ background: "#161920", border: "1px solid #2a2f3f", borderRadius: 10, padding: "14px 12px", textAlign: "center" }}>
                <div style={{ fontSize: 10, color: "#6b7490", fontWeight: 700, letterSpacing: "0.08em", marginBottom: 6, textTransform: "uppercase" }}>{l}</div>
                <div style={{ fontSize: 28, fontWeight: 700, color: c }}>{v}</div>
              </div>
            ))}
          </div>
        )}

        {filtered.map(m => (
          <div key={m.id} style={{ background: "#161920", border: `1px solid ${m.signals.some(s => s.strong) ? "rgba(200,241,53,0.4)" : m.signals.length > 0 ? "rgba(74,240,196,0.25)" : "#2a2f3f"}`, borderRadius: 14, padding: 18, marginBottom: 10 }}>

            <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 10 }}>
              <div style={{ fontSize: 11, color: "#6b7490", fontWeight: 700, letterSpacing: "0.08em" }}>
                {m.league.flag} {m.league.name} · {m.time}
              </div>
              <div style={{ fontSize: 11, color: "#6b7490" }}>
                λ {m.lH.toFixed(2)} — {m.lA.toFixed(2)}
                {!m.hasRatings && <span style={{ color: "#f0794a", marginLeft: 6 }}>⚠ rating N/D</span>}
              </div>
            </div>

            <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 14 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 8, flex: 1 }}>
                {m.home.crest && <img src={m.home.crest} style={{ width: 28, height: 28 }} alt="" />}
                <span style={{ fontWeight: 700, fontSize: 15 }}>{m.home.name}</span>
              </div>
              <div style={{ color: "#6b7490", fontSize: 13, fontWeight: 600 }}>vs</div>
              <div style={{ display: "flex", alignItems: "center", gap: 8, flex: 1, justifyContent: "flex-end" }}>
                <span style={{ fontWeight: 700, fontSize: 15 }}>{m.away.name}</span>
                {m.away.crest && <img src={m.away.crest} style={{ width: 28, height: 28 }} alt="" />}
              </div>
            </div>

            <div style={{ display: "grid", gridTemplateColumns: "repeat(5, 1fr)", gap: 6, marginBottom: 12 }}>
              {[
                ["1", (m.probs.h * 100).toFixed(0) + "%"],
                ["X", (m.probs.d * 100).toFixed(0) + "%"],
                ["2", (m.probs.a * 100).toFixed(0) + "%"],
                ["O2.5", (m.probs.o25 * 100).toFixed(0) + "%"],
                ["BTTS", (m.probs.btts * 100).toFixed(0) + "%"],
              ].map(([l, v]) => (
                <div key={l} style={{ background: "#0d0f14", border: "1px solid #2a2f3f", borderRadius: 8, padding: "8px 4px", textAlign: "center" }}>
                  <div style={{ fontSize: 9, color: "#6b7490", fontWeight: 700, letterSpacing: "0.06em", marginBottom: 3 }}>{l}</div>
                  <div style={{ fontSize: 15, fontWeight: 600 }}>{v}</div>
                </div>
              ))}
            </div>

            {m.signals.length > 0 ? (
              <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                {m.signals.map((s, i) => (
                  <div key={i} style={{ borderRadius: 8, padding: "9px 14px", background: s.strong ? `${s.color}15` : "rgba(255,255,255,0.04)", border: `1px solid ${s.strong ? s.color + "50" : "#2a2f3f"}`, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                    <span style={{ fontSize: 13, fontWeight: 700, color: s.strong ? s.color : "#e8ecf5" }}>
                      {s.strong ? "🔥 " : "→ "}{s.label}
                    </span>
                    <span style={{ fontSize: 13, fontFamily: "monospace", color: s.color, fontWeight: 600 }}>
                      {(s.prob * 100).toFixed(1)}%
                    </span>
                  </div>
                ))}
              </div>
            ) : (
              <div style={{ fontSize: 12, color: "#6b7490", padding: "8px 0" }}>— Nessun segnale chiaro · skip</div>
            )}
            {isTradingO05HTU25(m) && (
  <button
    onClick={() => saveToArchive(m)}
    disabled={savingId === m.id || savedIds.includes(m.id)}
    style={{
      marginTop: 12,
      width: "100%",
      padding: "10px 12px",
      borderRadius: 10,
      border: "1px solid rgba(255,159,67,0.45)",
      background: savedIds.includes(m.id) ? "rgba(74,240,196,0.12)" : "rgba(255,159,67,0.12)",
      color: savedIds.includes(m.id) ? "#4af0c4" : "#ff9f43",
      fontWeight: 800,
      cursor: savingId === m.id || savedIds.includes(m.id) ? "not-allowed" : "pointer"
    }}
  >
    {savedIds.includes(m.id)
      ? "✓ Salvata in archivio"
      : savingId === m.id
        ? "Salvataggio..."
        : "☑ Salva trading in archivio"}
  </button>
)}
          </div>
        ))}

        {matches.length === 0 && !loading && (
          <div style={{ textAlign: "center", color: "#6b7490", padding: "40px 0", fontSize: 14 }}>
            Seleziona le leghe e clicca Analizza
          </div>
        )}
      </div>
    </div>
  );
}

const lbl = { fontSize: 11, fontWeight: 700, color: "#6b7490", letterSpacing: "0.06em", textTransform: "uppercase", display: "block", marginBottom: 5 };
const inp = { background: "#0d0f14", border: "1px solid #2a2f3f", borderRadius: 8, padding: "9px 12px", color: "#e8ecf5", fontSize: 14, outline: "none", boxSizing: "border-box" };
const sel = { background: "#0d0f14", border: "1px solid #2a2f3f", borderRadius: 8, padding: "9px 12px", color: "#e8ecf5", fontSize: 14, outline: "none", boxSizing: "border-box" };
