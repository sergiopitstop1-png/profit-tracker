// Salva questo file come: app/iscritti/page.tsx

"use client";

import { useState, useEffect, useMemo } from "react";

export default function IscrittiPage() {
  const [iscritti, setIscritti] = useState<any[] | null>(null);
  const [error, setError] = useState("");
  const [search, setSearch] = useState("");

  useEffect(() => {
    async function load() {
      try {
        const res = await fetch("/api/admin/iscritti");
        const data = await res.json();
        if (!res.ok) {
          setError(data.error || "Errore nel caricamento");
          return;
        }
        setIscritti(data.iscritti);
      } catch (e) {
        setError("Errore di rete");
      }
    }
    load();
  }, []);

  const filtered = useMemo(() => {
    if (!iscritti) return [];
    const q = search.toLowerCase().trim();
    if (!q) return iscritti;
    return iscritti.filter((u) =>
      (u.email || "").toLowerCase().includes(q) ||
      (u.full_name || "").toLowerCase().includes(q)
    );
  }, [iscritti, search]);

  const counts = useMemo(() => {
    if (!iscritti) return { totale: 0, admin: 0, vip: 0, user: 0, digestAttiva: 0 };
    return {
      totale: iscritti.length,
      admin: iscritti.filter((u) => u.role === "admin").length,
      vip: iscritti.filter((u) => u.role === "vip").length,
      user: iscritti.filter((u) => u.role === "user").length,
      digestAttiva: iscritti.filter((u) => u.digest_subscribed).length,
    };
  }, [iscritti]);

  const roleColor: Record<string, string> = { admin: "#ff9f43", vip: "#c8f135", user: "#6b7490" };
  const roleLabel: Record<string, string> = { admin: "Admin", vip: "VIP", user: "Utente" };

  return (
    <main style={{ background: "#0d0f14", color: "#e8ecf5", padding: "40px 20px", minHeight: "100vh", fontFamily: "system-ui, sans-serif" }}>
      <div style={{ maxWidth: 900, margin: "0 auto" }}>

        <div style={{ display: "flex", gap: 16, marginBottom: 20 }}>
          <a href="/" style={{ fontSize: 12, color: "#6b7490", textDecoration: "none" }}>← home</a>
          <a href="/profit-tracker" style={{ fontSize: 12, color: "#6b7490", textDecoration: "none" }}>💼 Profit Tracker</a>
        </div>

        <h1 style={{ fontSize: 26, fontWeight: 800, marginBottom: 4 }}>Iscritti al sito</h1>
        <p style={{ color: "#6b7490", fontSize: 14, marginBottom: 24 }}>
          Tutti gli account registrati (PronoX / Prop Tracker)
        </p>

        {error && (
          <div style={{ background: "rgba(255,92,92,0.1)", border: "1px solid rgba(255,92,92,0.3)", borderRadius: 10, padding: "14px 18px", color: "#ff5c5c", fontSize: 14, marginBottom: 20 }}>
            {error}
          </div>
        )}

        {!error && iscritti === null && (
          <div style={{ color: "#6b7490", fontSize: 14 }}>Carico...</div>
        )}

        {iscritti !== null && (
          <>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(5, 1fr)", gap: 10, marginBottom: 24 }}>
              {[
                ["Totale", counts.totale, "#e8ecf5"],
                ["Admin", counts.admin, "#ff9f43"],
                ["VIP", counts.vip, "#c8f135"],
                ["Utenti", counts.user, "#6b7490"],
                ["Digest attiva", counts.digestAttiva, "#4af0c4"],
              ].map(([label, val, color]) => (
                <div key={label as string} style={{ background: "#161920", border: "1px solid #2a2f3f", borderRadius: 10, padding: "12px 14px", textAlign: "center" }}>
                  <div style={{ fontSize: 20, fontWeight: 800, color: color as string }}>{val}</div>
                  <div style={{ fontSize: 10, color: "#6b7490", marginTop: 2, textTransform: "uppercase", letterSpacing: "0.05em" }}>{label}</div>
                </div>
              ))}
            </div>

            <input
              type="text"
              placeholder="Cerca per nome o email..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              style={{
                width: "100%", background: "#161920", border: "1px solid #2a2f3f", borderRadius: 10,
                padding: "12px 16px", color: "#e8ecf5", fontSize: 14, outline: "none", marginBottom: 16, boxSizing: "border-box",
              }}
            />

            <div style={{ background: "#161920", border: "1px solid #2a2f3f", borderRadius: 14, overflow: "hidden" }}>
              {filtered.length === 0 ? (
                <div style={{ padding: 30, textAlign: "center", color: "#6b7490", fontSize: 14 }}>
                  Nessun iscritto trovato.
                </div>
              ) : (
                filtered.map((u, i) => (
                  <div
                    key={u.id}
                    style={{
                      display: "flex", alignItems: "center", justifyContent: "space-between",
                      padding: "14px 18px", borderBottom: i < filtered.length - 1 ? "1px solid #2a2f3f" : "none",
                    }}
                  >
                    <div>
                      <div style={{ fontSize: 14, fontWeight: 700 }}>{u.full_name || "—"}</div>
                      <div style={{ fontSize: 12, color: "#6b7490" }}>{u.email}</div>
                    </div>
                    <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
                      <span style={{ fontSize: 11, color: "#6b7490" }}>
                        {new Date(u.created_at).toLocaleDateString("it-IT", { day: "numeric", month: "short", year: "numeric" })}
                      </span>
                      <span style={{ fontSize: 11 }}>
                        {u.digest_subscribed ? "📧" : "🔕"}
                      </span>
                      <span
                        style={{
                          fontSize: 11, fontWeight: 700, padding: "4px 10px", borderRadius: 20,
                          background: `${roleColor[u.role] || "#6b7490"}20`, color: roleColor[u.role] || "#6b7490",
                        }}
                      >
                        {roleLabel[u.role] || u.role}
                      </span>
                    </div>
                  </div>
                ))
              )}
            </div>
          </>
        )}

      </div>
    </main>
  );
}
