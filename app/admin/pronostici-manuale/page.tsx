"use client";
import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase-browser";
// Se il tuo progetto non usa l'alias "@/lib/...", sostituisci la riga sopra con:
// import { createClient } from "../../../lib/supabase-browser";

const supabase = createClient();

type Pick = {
  id: string;
  pick_date: string;
  sport: string | null;
  league: string;
  home_team: string;
  away_team: string;
  prediction_label: string;
  probability: number;
  status: string;
};

const bg = "#0d0f14";
const card = "#161920";
const border = "#2a2f3f";
const textDim = "#6b7490";
const textMain = "#e8ecf5";
const win = "#4af0c4";
const loss = "#ff5c5c";

export default function PronosticiManualePage() {
  const [picks, setPicks] = useState<Pick[]>([]);
  const [loading, setLoading] = useState(true);
  const [savingId, setSavingId] = useState<string | null>(null);

  const load = async () => {
    setLoading(true);
    const { data } = await supabase
      .from("pronox_daily_picks")
      .select("*")
      .eq("status", "PENDING")
      .order("pick_date", { ascending: true });
    setPicks(data || []);
    setLoading(false);
  };

  useEffect(() => { load(); }, []);

  const setStatus = async (id: string, status: "WIN" | "LOSS") => {
    setSavingId(id);
    try {
      const res = await fetch("/api/pronostici/segna-esito", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id, status }),
      });
      const data = await res.json();
      if (!res.ok) {
        alert(data.error || "Errore nel salvataggio, riprova.");
        setSavingId(null);
        return;
      }
      setPicks((prev) => prev.filter((p) => p.id !== id));
    } catch (e) {
      alert("Errore di rete, riprova.");
    }
    setSavingId(null);
  };

  return (
    <div style={{ background: bg, minHeight: "100vh", padding: "40px 20px", fontFamily: "system-ui, sans-serif" }}>
      <div style={{ maxWidth: 640, margin: "0 auto" }}>
        <h1 style={{ color: textMain, fontSize: 24, fontWeight: 900, marginBottom: 4 }}>
          Esito manuale pronostici
        </h1>
        <p style={{ color: textDim, fontSize: 13, marginBottom: 24 }}>
          Elenco dei pronostici ancora "in corso". La verifica automatica ci riprova ogni sera da sola —
          usa questi pulsanti solo per i casi bloccati (partita rinviata, dato non trovato, ecc.).
        </p>

        {loading && <p style={{ color: textDim }}>Caricamento...</p>}
        {!loading && picks.length === 0 && (
          <p style={{ color: win, fontSize: 14 }}>✓ Nessun pronostico in sospeso al momento.</p>
        )}

        {picks.map((p) => (
          <div key={p.id} style={{
            background: card, border: `1px solid ${border}`, borderRadius: 12,
            padding: "14px 18px", marginBottom: 10, display: "flex",
            alignItems: "center", justifyContent: "space-between", gap: 12, flexWrap: "wrap",
          }}>
            <div>
              <div style={{ fontSize: 11, color: textDim, marginBottom: 2 }}>
                {p.sport === "tennis" ? "🎾" : "⚽"} {p.league} · {p.pick_date}
              </div>
              <div style={{ fontSize: 14, fontWeight: 700, color: textMain }}>
                {p.home_team} vs {p.away_team}
              </div>
              <div style={{ fontSize: 13, color: win }}>{p.prediction_label} · {p.probability}%</div>
            </div>
            <div style={{ display: "flex", gap: 8 }}>
              <button
                disabled={savingId === p.id}
                onClick={() => setStatus(p.id, "WIN")}
                style={{ padding: "8px 16px", borderRadius: 8, border: `1px solid ${win}`, background: "rgba(74,240,196,0.1)", color: win, fontWeight: 700, fontSize: 12, cursor: "pointer" }}
              >✓ WIN</button>
              <button
                disabled={savingId === p.id}
                onClick={() => setStatus(p.id, "LOSS")}
                style={{ padding: "8px 16px", borderRadius: 8, border: `1px solid ${loss}`, background: "rgba(255,92,92,0.1)", color: loss, fontWeight: 700, fontSize: 12, cursor: "pointer" }}
              >✗ LOSS</button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
