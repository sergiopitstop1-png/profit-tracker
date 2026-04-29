"use client";
import { useState, useEffect } from "react";
import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
);

const API_FD = "/api/footballdata";

export default function Archivio() {
  const [records, setRecords] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filterStatus, setFilterStatus] = useState("all");
  const [filterType, setFilterType] = useState("all");
  const [checkingId, setCheckingId] = useState(null);

  useEffect(() => { loadArchive(); }, []);

  const loadArchive = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from("pronox_archive")
      .select("*")
      .order("created_at", { ascending: false });
    if (!error) setRecords(data || []);
    setLoading(false);
  };

  const verifyResult = async (record) => {
    setCheckingId(record.id);
    try {
      const r = await fetch(`${API_FD}?endpoint=matches/${record.match_id}`);
      const d = await r.json();
      const m = d.match || d;
      if (!m || m.status !== "FINISHED") {
        alert("Partita non ancora terminata!");
        setCheckingId(null);
        return;
      }
      const ftHome = m.score?.fullTime?.home ?? 0;
      const ftAway = m.score?.fullTime?.away ?? 0;
      const htHome = m.score?.halfTime?.home ?? 0;
      const htAway = m.score?.halfTime?.away ?? 0;
      const total = ftHome + ftAway;
      let outcome = "LOSS";
      const label = record.prediction_label;
      if (label === "CASA VINCE") outcome = ftHome > ftAway ? "WIN" : "LOSS";
      else if (label === "OSPITE VINCE") outcome = ftAway > ftHome ? "WIN" : "LOSS";
      else if (label === "OVER 2.5") outcome = total > 2.5 ? "WIN" : "LOSS";
      else if (label === "UNDER 2.5") outcome = total < 2.5 ? "WIN" : "LOSS";
      else if (label === "OVER 0.5 HT") outcome = (htHome + htAway) > 0 ? "WIN" : "LOSS";
      else if (label === "BTTS SÌ") outcome = ftHome > 0 && ftAway > 0 ? "WIN" : "LOSS";
      else if (label === "TRADING O0.5 HT → U2.5 LIVE") outcome = (htHome + htAway) >= 1 && total <= 2 ? "WIN" : "LOSS";

      const { error: updateError } = await supabase.from("pronox_archive")
  .update({
    status: outcome,
    ft_home_goals: ftHome,
    ft_away_goals: ftAway,
    ht_home_goals: htHome,
    ht_away_goals: htAway,
    result_checked_at: new Date().toISOString()
  })
  .eq("id", record.id);

if (updateError) {
  alert("Errore aggiornamento Supabase: " + updateError.message);
  setCheckingId(null);
  return;
}

      setRecords(prev => prev.map(r => r.id === record.id ? { ...r, status: outcome, ft_home_goals: ftHome, ft_away_goals: ftAway, ht_home_goals: htHome, ht_away_goals: htAway } : r));
    } catch (e) { console.error(e); }
    setCheckingId(null);
  };

  const deleteRecord = async (id) => {
    if (!confirm("Eliminare questo pronostico?")) return;
    await supabase.from("pronox_archive").delete().eq("id", id);
    setRecords(prev => prev.filter(r => r.id !== id));
  };

  const filtered = records.filter(r => {
    if (filterStatus !== "all" && r.status !== filterStatus) return false;
    if (filterType !== "all" && r.prediction_type !== filterType) return false;
    return true;
  });

  const wins = records.filter(r => r.status === "WIN").length;
  const losses = records.filter(r => r.status === "LOSS").length;
  const pending = records.filter(r => r.status === "PENDING").length;
  const total = wins + losses;
  const winRate = total > 0 ? ((wins / total) * 100).toFixed(1) : "—";

  const types = [...new Set(records.map(r => r.prediction_type))].filter(Boolean);

  const statusBadge = (status) => {
    if (status === "WIN") return { bg: "rgba(200,241,53,0.15)", color: "#c8f135", text: "✓ WIN" };
    if (status === "LOSS") return { bg: "rgba(255,92,92,0.15)", color: "#ff5c5c", text: "✗ LOSS" };
    return { bg: "rgba(255,208,96,0.12)", color: "#ffd060", text: "⏳ PENDING" };
  };

  return (
    <div style={{ minHeight: "100vh", background: "#0d0f14", color: "#e8ecf5", fontFamily: "system-ui, sans-serif", padding: "24px 16px" }}>
      <div style={{ maxWidth: 860, margin: "0 auto" }}>

        <h1 style={{ fontSize: 26, fontWeight: 800, marginBottom: 4 }}>
          PRONO<span style={{ color: "#c8f135" }}>X</span>
          <span style={{ fontSize: 13, fontWeight: 400, color: "#6b7490" }}> · archivio pronostici</span>
        </h1>
        <div style={{ display: "flex", gap: 16, marginBottom: 24 }}>
          <a href="/" style={{ fontSize: 12, color: "#6b7490", textDecoration: "none" }}>← home</a>
          <a href="/oggi" style={{ fontSize: 12, color: "#6b7490", textDecoration: "none" }}>📅 partite del giorno</a>
          <a href="/pronosticatore" style={{ fontSize: 12, color: "#6b7490", textDecoration: "none" }}>⚽ analisi manuale</a>
        </div>

        {/* Statistiche */}
        <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 10, marginBottom: 20 }}>
          {[
            ["Totale", records.length, "#e8ecf5"],
            ["WIN", wins, "#c8f135"],
            ["LOSS", losses, "#ff5c5c"],
            ["Win Rate", winRate + (winRate !== "—" ? "%" : ""), winRate !== "—" && parseFloat(winRate) >= 50 ? "#c8f135" : "#ffd060"],
          ].map(([l, v, c]) => (
            <div key={l} style={{ background: "#161920", border: "1px solid #2a2f3f", borderRadius: 10, padding: "14px 12px", textAlign: "center" }}>
              <div style={{ fontSize: 10, color: "#6b7490", fontWeight: 700, letterSpacing: "0.08em", marginBottom: 6, textTransform: "uppercase" }}>{l}</div>
              <div style={{ fontSize: 26, fontWeight: 700, color: c }}>{v}</div>
            </div>
          ))}
        </div>

        {/* Pending da verificare */}
        {pending > 0 && (
          <div style={{ background: "rgba(255,208,96,0.08)", border: "1px solid rgba(255,208,96,0.3)", borderRadius: 10, padding: "12px 16px", marginBottom: 16, fontSize: 13, color: "#ffd060" }}>
            ⏳ Hai <strong>{pending}</strong> pronostico/i in attesa di verifica — clicca "Verifica" per aggiornare il risultato.
          </div>
        )}

        {/* Filtri */}
        <div style={{ background: "#161920", border: "1px solid #2a2f3f", borderRadius: 12, padding: 16, marginBottom: 16, display: "flex", gap: 12, flexWrap: "wrap" }}>
          <div>
            <label style={lbl}>Stato</label>
            <select value={filterStatus} onChange={e => setFilterStatus(e.target.value)} style={sel}>
              <option value="all">Tutti</option>
              <option value="PENDING">Pending</option>
              <option value="WIN">WIN</option>
              <option value="LOSS">LOSS</option>
            </select>
          </div>
          <div>
            <label style={lbl}>Tipo</label>
            <select value={filterType} onChange={e => setFilterType(e.target.value)} style={sel}>
              <option value="all">Tutti</option>
              {types.map(t => <option key={t} value={t}>{t}</option>)}
            </select>
          </div>
          <div style={{ display: "flex", alignItems: "flex-end" }}>
            <button onClick={loadArchive} style={{ padding: "9px 16px", borderRadius: 8, border: "1px solid #2a2f3f", background: "transparent", color: "#6b7490", cursor: "pointer", fontSize: 13 }}>
              ↺ Aggiorna
            </button>
          </div>
        </div>

        {/* Lista */}
        {loading ? (
          <div style={{ textAlign: "center", color: "#6b7490", padding: "40px 0" }}>Carico archivio...</div>
        ) : filtered.length === 0 ? (
          <div style={{ textAlign: "center", color: "#6b7490", padding: "40px 0", fontSize: 14 }}>
            Nessun pronostico salvato ancora — vai su <a href="/oggi" style={{ color: "#c8f135" }}>partite del giorno</a> e salva i tuoi segnali!
          </div>
        ) : (
          filtered.map(r => {
            const badge = statusBadge(r.status);
            return (
              <div key={r.id} style={{ background: "#161920", border: `1px solid ${r.status === "WIN" ? "rgba(200,241,53,0.25)" : r.status === "LOSS" ? "rgba(255,92,92,0.2)" : "#2a2f3f"}`, borderRadius: 12, padding: 16, marginBottom: 10 }}>

                {/* Header */}
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 10 }}>
                  <div>
                    <div style={{ fontSize: 11, color: "#6b7490", marginBottom: 4 }}>
                      {r.league} · {r.match_date} · {r.match_time}
                    </div>
                    <div style={{ fontSize: 15, fontWeight: 700 }}>
                      {r.home_team} <span style={{ color: "#6b7490", fontWeight: 400 }}>vs</span> {r.away_team}
                    </div>
                  </div>
                  <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                    <span style={{ fontSize: 12, padding: "4px 12px", borderRadius: 8, background: badge.bg, color: badge.color, fontWeight: 700 }}>
                      {badge.text}
                    </span>
                    <button onClick={() => deleteRecord(r.id)}
                      style={{ fontSize: 11, padding: "4px 8px", borderRadius: 6, border: "1px solid #2a2f3f", background: "transparent", color: "#6b7490", cursor: "pointer" }}>
                      ✕
                    </button>
                  </div>
                </div>

                {/* Pronostico */}
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", background: "#0d0f14", borderRadius: 8, padding: "10px 14px", marginBottom: r.status === "PENDING" ? 10 : 0 }}>
                  <div>
                    <span style={{ fontSize: 11, color: "#6b7490", marginRight: 8 }}>{r.prediction_type}</span>
                    <span style={{ fontSize: 14, fontWeight: 700, color: "#e8ecf5" }}>{r.prediction_label}</span>
                  </div>
                  <div style={{ display: "flex", gap: 16, alignItems: "center" }}>
                    <div style={{ textAlign: "right" }}>
                      <div style={{ fontSize: 10, color: "#6b7490", marginBottom: 2 }}>PROB</div>
                      <div style={{ fontSize: 16, fontWeight: 700, color: "#c8f135", fontFamily: "monospace" }}>{r.probability}%</div>
                    </div>
                    <div style={{ textAlign: "right" }}>
                      <div style={{ fontSize: 10, color: "#6b7490", marginBottom: 2 }}>λ H / A</div>
                      <div style={{ fontSize: 13, fontFamily: "monospace", color: "#4af0c4" }}>{r.lambda_home} / {r.lambda_away}</div>
                    </div>
                  </div>
                </div>

                {/* Risultato se disponibile */}
                {(r.ft_home_goals !== null && r.ft_home_goals !== undefined) && (
                  <div style={{ display: "flex", gap: 16, marginTop: 10, fontSize: 12, color: "#6b7490" }}>
                    <span>FT: <span style={{ color: "#e8ecf5", fontFamily: "monospace" }}>{r.ft_home_goals} - {r.ft_away_goals}</span></span>
                    {r.ht_home_goals !== null && <span>HT: <span style={{ color: "#e8ecf5", fontFamily: "monospace" }}>{r.ht_home_goals} - {r.ht_away_goals}</span></span>}
                  </div>
                )}

                {/* Bottone verifica */}
                {r.status === "PENDING" && (
  <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
    <button onClick={() => verifyResult(r)} disabled={checkingId === r.id}
      style={{ width: "100%", padding: "10px", borderRadius: 8, border: "1px solid rgba(255,208,96,0.3)", background: "rgba(255,208,96,0.08)", color: "#ffd060", cursor: "pointer", fontWeight: 700, fontSize: 13 }}>
      {checkingId === r.id ? "⏳ Verifica in corso..." : "⏳ Verifica automatica"}
    </button>
    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
      <button onClick={() => manualVerify(r.id, "WIN")}
        style={{ padding: "10px", borderRadius: 8, border: "none", background: "rgba(200,241,53,0.2)", color: "#c8f135", fontWeight: 800, cursor: "pointer", fontSize: 13 }}>
        ✓ WIN
      </button>
      <button onClick={() => manualVerify(r.id, "LOSS")}
        style={{ padding: "10px", borderRadius: 8, border: "none", background: "rgba(255,92,92,0.2)", color: "#ff5c5c", fontWeight: 800, cursor: "pointer", fontSize: 13 }}>
        ✗ LOSS
      </button>
    </div>
  </div>
)}
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}

const lbl = { fontSize: 11, fontWeight: 700, color: "#6b7490", letterSpacing: "0.06em", textTransform: "uppercase", display: "block", marginBottom: 5 };
const sel = { background: "#0d0f14", border: "1px solid #2a2f3f", borderRadius: 8, padding: "9px 12px", color: "#e8ecf5", fontSize: 14, outline: "none", boxSizing: "border-box" };
