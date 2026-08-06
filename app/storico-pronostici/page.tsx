"use client";
import { useEffect, useMemo, useState } from "react";
import { createClient } from "@/lib/supabase-browser";
// Se il tuo progetto non usa l'alias "@/lib/...", sostituisci la riga sopra con:
// import { createClient } from "../../lib/supabase-browser";

const supabase = createClient();

type Pick = {
  id: string;
  pick_date: string;
  sport: string | null; // 'tennis' | null/'calcio'
  league: string;
  home_team: string;
  away_team: string;
  prediction_label: string;
  probability: number;
  quota: number | null;
  status: "PENDING" | "WIN" | "LOSS";
};

const bg = "#0d0f14";
const card = "#161920";
const border = "#2a2f3f";
const textDim = "#6b7490";
const textMain = "#e8ecf5";
const accent = "#c8f135";
const win = "#4af0c4";
const loss = "#ff5c5c";

function StatCard({
  icon, label, wins, losses,
}: { icon: string; label: string; wins: number; losses: number }) {
  const total = wins + losses;
  const pct = total > 0 ? Math.round((wins / total) * 100) : null;
  return (
    <div style={{
      background: card, border: `1px solid ${border}`, borderRadius: 16,
      padding: "24px 20px", flex: 1, minWidth: 220, textAlign: "center",
    }}>
      <div style={{ fontSize: 28, marginBottom: 6 }}>{icon}</div>
      <div style={{ fontSize: 13, color: textDim, fontWeight: 700, letterSpacing: "0.05em", textTransform: "uppercase", marginBottom: 10 }}>
        {label}
      </div>
      <div style={{ fontSize: 40, fontWeight: 900, color: pct !== null ? accent : textDim }}>
        {pct !== null ? `${pct}%` : "—"}
      </div>
      <div style={{ fontSize: 13, color: textDim, marginTop: 6 }}>
        {total > 0 ? `${wins} vinti su ${total} verificati` : "Ancora nessun pronostico verificato"}
      </div>
    </div>
  );
}

function PickRow({ p }: { p: Pick }) {
  const badge =
    p.status === "WIN" ? { text: "✓ WIN", color: win } :
    p.status === "LOSS" ? { text: "✗ LOSS", color: loss } :
    { text: "⏳ in corso", color: textDim };
  return (
    <div style={{
      display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12,
      padding: "12px 0", borderBottom: `1px solid ${border}`, flexWrap: "wrap",
    }}>
      <div style={{ flex: 1, minWidth: 200 }}>
        <div style={{ fontSize: 11, color: textDim, marginBottom: 2 }}>
          {p.sport === "tennis" ? "🎾" : "⚽"} {p.league}
        </div>
        <div style={{ fontSize: 14, fontWeight: 700, color: textMain }}>
          {p.home_team} vs {p.away_team}
        </div>
        <div style={{ fontSize: 13, color: win }}>
          {p.prediction_label} · {p.probability}%{p.quota ? ` · @${Number(p.quota).toFixed(2)}` : ""}
        </div>
      </div>
      <div style={{ fontWeight: 800, fontSize: 13, color: badge.color, whiteSpace: "nowrap" }}>
        {badge.text}
      </div>
    </div>
  );
}

export default function StoricoPronosticiPage() {
  const [picks, setPicks] = useState<Pick[]>([]);
  const [loading, setLoading] = useState(true);
  const [filtro, setFiltro] = useState<"tutti" | "calcio" | "tennis">("tutti");

  useEffect(() => {
    (async () => {
      const { data } = await supabase
        .from("pronox_daily_picks")
        .select("*")
        .order("pick_date", { ascending: false })
        .limit(300);
      setPicks(data || []);
      setLoading(false);
    })();
  }, []);

  const { footballStats, tennisStats } = useMemo(() => {
    const verified = picks.filter((p) => p.status === "WIN" || p.status === "LOSS");
    const foot = verified.filter((p) => p.sport !== "tennis");
    const tennis = verified.filter((p) => p.sport === "tennis");
    return {
      footballStats: { wins: foot.filter((p) => p.status === "WIN").length, losses: foot.filter((p) => p.status === "LOSS").length },
      tennisStats: { wins: tennis.filter((p) => p.status === "WIN").length, losses: tennis.filter((p) => p.status === "LOSS").length },
    };
  }, [picks]);

  const filtered = useMemo(() => {
    if (filtro === "tutti") return picks;
    if (filtro === "calcio") return picks.filter((p) => p.sport !== "tennis");
    return picks.filter((p) => p.sport === "tennis");
  }, [picks, filtro]);

  const grouped = useMemo(() => {
    const map = new Map<string, Pick[]>();
    filtered.forEach((p) => {
      if (!map.has(p.pick_date)) map.set(p.pick_date, []);
      map.get(p.pick_date)!.push(p);
    });
    return Array.from(map.entries());
  }, [filtered]);

  const tabStyle = (active: boolean) => ({
    padding: "8px 18px", borderRadius: 10, fontSize: 13, fontWeight: 700, cursor: "pointer",
    border: `1px solid ${active ? accent : border}`,
    background: active ? "rgba(200,241,53,0.1)" : "transparent",
    color: active ? accent : textDim,
  });

  return (
    <div style={{ background: bg, minHeight: "100vh", padding: "48px 20px", fontFamily: "system-ui, sans-serif" }}>
      <div style={{ maxWidth: 640, margin: "0 auto" }}>
        <h1 style={{ color: textMain, fontSize: 30, fontWeight: 900, marginBottom: 4 }}>
          Storico <span style={{ color: accent }}>Pronostici</span>
        </h1>
        <p style={{ color: textDim, fontSize: 14, marginBottom: 20 }}>
          Ogni pronostico che mandiamo, verificato in modo trasparente col risultato reale. Nessuna selezione a posteriori.
        </p>

        <div style={{ display: "flex", alignItems: "center", gap: 16, marginBottom: 32, flexWrap: "wrap" }}>
          <a href="/oggi" style={{
            display: "inline-flex", alignItems: "center", gap: 8,
            padding: "12px 24px", background: accent, color: "#0d0f14",
            fontWeight: 800, borderRadius: 10, textDecoration: "none",
            fontSize: 14,
          }}>
            🎯 Vai ai pronostici di oggi →
          </a>
          <a href="/" style={{ color: textDim, fontSize: 13, textDecoration: "none" }}>
            ← torna alla home del sito
          </a>
        </div>

        {loading ? (
          <p style={{ color: textDim }}>Caricamento...</p>
        ) : (
          <>
            <div style={{ display: "flex", gap: 14, flexWrap: "wrap", marginBottom: 32 }}>
              <StatCard icon="⚽" label="Calcio" wins={footballStats.wins} losses={footballStats.losses} />
              <StatCard icon="🎾" label="Tennis" wins={tennisStats.wins} losses={tennisStats.losses} />
            </div>

            <div style={{ display: "flex", gap: 8, marginBottom: 20 }}>
              <div style={tabStyle(filtro === "tutti")} onClick={() => setFiltro("tutti")}>Tutti</div>
              <div style={tabStyle(filtro === "calcio")} onClick={() => setFiltro("calcio")}>⚽ Calcio</div>
              <div style={tabStyle(filtro === "tennis")} onClick={() => setFiltro("tennis")}>🎾 Tennis</div>
            </div>

            {grouped.length === 0 && (
              <p style={{ color: textDim, fontSize: 14 }}>Nessun pronostico ancora per questo filtro.</p>
            )}

            {grouped.map(([date, dayPicks]) => (
              <div key={date} style={{ background: card, border: `1px solid ${border}`, borderRadius: 14, padding: "16px 20px", marginBottom: 14 }}>
                <div style={{ fontSize: 12, fontWeight: 700, color: textDim, letterSpacing: "0.05em", textTransform: "uppercase", marginBottom: 6 }}>
                  {new Date(date + "T12:00:00").toLocaleDateString("it-IT", { weekday: "long", day: "numeric", month: "long" })}
                </div>
                {dayPicks.map((p) => <PickRow key={p.id} p={p} />)}
              </div>
            ))}
          </>
        )}
      </div>
    </div>
  );
}
