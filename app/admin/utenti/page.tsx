"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "../../../lib/supabase-browser";

const supabase = createClient();

export default function AdminUtenti() {
  const router = useRouter();
  const [utenti, setUtenti] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [authorized, setAuthorized] = useState(false);
  const [updatingId, setUpdatingId] = useState<string | null>(null);
  useEffect(() => {
    const init = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { router.push("/login"); return; }

      const { data: profile } = await supabase
        .from("user_profiles")
        .select("role")
        .eq("id", user.id)
        .single();

      if (profile?.role !== "admin") { router.push("/"); return; }

      setAuthorized(true);
      loadUtenti();
    };
    init();
  }, []);

  const loadUtenti = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from("user_profiles")
      .select("*")
      .order("created_at", { ascending: false });
    if (!error) setUtenti(data || []);
    setLoading(false);
  };

  const changeRole = async (id: string, newRole: string) => {
    setUpdatingId(id);
    await supabase.from("user_profiles").update({ role: newRole }).eq("id", id);
    setUtenti(prev => prev.map(u => u.id === id ? { ...u, role: newRole } : u));
    setUpdatingId(null);
  };

  const roleBadge = (role) => {
    if (role === "admin") return { bg: "rgba(200,241,53,0.15)", color: "#c8f135", text: "👑 ADMIN" };
    if (role === "vip") return { bg: "rgba(74,240,196,0.15)", color: "#4af0c4", text: "⭐ VIP" };
    return { bg: "rgba(107,116,144,0.15)", color: "#6b7490", text: "👤 USER" };
  };

  const totali = utenti.length;
  const vip = utenti.filter(u => u.role === "vip").length;
  const user = utenti.filter(u => u.role === "user").length;

  if (!authorized && !loading) return null;

  return (
    <div style={{ minHeight: "100vh", background: "#0d0f14", color: "#e8ecf5", fontFamily: "system-ui, sans-serif", padding: "24px 16px" }}>
      <div style={{ maxWidth: 860, margin: "0 auto" }}>

        <h1 style={{ fontSize: 26, fontWeight: 800, marginBottom: 4 }}>
          PRONO<span style={{ color: "#c8f135" }}>X</span>
          <span style={{ fontSize: 13, fontWeight: 400, color: "#6b7490" }}> · admin · utenti</span>
        </h1>
        <div style={{ display: "flex", gap: 16, marginBottom: 24 }}>
          <a href="/" style={{ fontSize: 12, color: "#6b7490", textDecoration: "none" }}>← home</a>
          <a href="/oggi" style={{ fontSize: 12, color: "#6b7490", textDecoration: "none" }}>📅 partite del giorno</a>
        </div>

        {/* Statistiche */}
        <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 10, marginBottom: 20 }}>
          {[
            ["Totale iscritti", totali, "#e8ecf5"],
            ["VIP", vip, "#4af0c4"],
            ["User", user, "#6b7490"],
          ].map(([l, v, c]) => (
            <div key={l} style={{ background: "#161920", border: "1px solid #2a2f3f", borderRadius: 10, padding: "14px 12px", textAlign: "center" }}>
              <div style={{ fontSize: 10, color: "#6b7490", fontWeight: 700, letterSpacing: "0.08em", marginBottom: 6, textTransform: "uppercase" }}>{l}</div>
              <div style={{ fontSize: 28, fontWeight: 700, color: c }}>{v}</div>
            </div>
          ))}
        </div>

        {/* Lista utenti */}
        {loading ? (
          <div style={{ textAlign: "center", color: "#6b7490", padding: "40px 0" }}>Carico utenti...</div>
        ) : (
          utenti.map(u => {
            const badge = roleBadge(u.role);
            return (
              <div key={u.id} style={{ background: "#161920", border: "1px solid #2a2f3f", borderRadius: 12, padding: 16, marginBottom: 10, display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 12 }}>
                <div>
                  <div style={{ fontWeight: 700, fontSize: 14, marginBottom: 4 }}>
                    {u.full_name || "—"}
                  </div>
                  <div style={{ fontSize: 12, color: "#6b7490" }}>{u.email}</div>
                  <div style={{ fontSize: 11, color: "#3a3f4f", marginTop: 4 }}>
                    Iscritto: {new Date(u.created_at).toLocaleDateString("it-IT")}
                  </div>
                </div>
                <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                  <span style={{ fontSize: 12, padding: "4px 12px", borderRadius: 8, background: badge.bg, color: badge.color, fontWeight: 700 }}>
                    {badge.text}
                  </span>
                  {u.role !== "admin" && (
                    <select
                      value={u.role}
                      onChange={e => changeRole(u.id, e.target.value)}
                      disabled={updatingId === u.id}
                      style={{ background: "#0d0f14", border: "1px solid #2a2f3f", borderRadius: 8, padding: "6px 10px", color: "#e8ecf5", fontSize: 12, cursor: "pointer", outline: "none" }}>
                      <option value="user">👤 User</option>
                      <option value="vip">⭐ VIP</option>
                      <option value="admin">👑 Admin</option>
                    </select>
                  )}
                  {updatingId === u.id && <span style={{ fontSize: 11, color: "#6b7490" }}>⏳</span>}
                </div>
              </div>
            );
          })
        )}

        {!loading && utenti.length === 0 && (
          <div style={{ textAlign: "center", color: "#6b7490", padding: "40px 0", fontSize: 14 }}>
            Nessun utente registrato ancora.
          </div>
        )}
      </div>
    </div>
  );
}
