// Salva questo file come: app/profilo/page.tsx

"use client";

import { useState, useEffect } from "react";
import { createClient } from "../../lib/supabase-browser"; // stesso client usato in app/register/page.tsx — aggiusta il percorso se il tuo è diverso
import EliminaAccountButton from "../components/EliminaAccountButton"; // components sta dentro app/, quindi un solo livello di risalita

const supabase = createClient();

export default function ProfiloPage() {
  const [profile, setProfile] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function loadProfile() {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        window.location.href = "/register?mode=login&from=/profilo";
        return;
      }

      const { data } = await supabase
        .from("user_profiles")
        .select("email, full_name, role, created_at, digest_subscribed")
        .eq("id", session.user.id)
        .single();

      setProfile(data);
      setLoading(false);
    }
    loadProfile();
  }, []);

  async function handleLogout() {
    await supabase.auth.signOut();
    window.location.href = "/oggi";
  }

  if (loading) {
    return (
      <main style={{ background: "#0d0f14", minHeight: "100vh", color: "#6b7490", display: "flex", alignItems: "center", justifyContent: "center", fontFamily: "system-ui, sans-serif" }}>
        Carico...
      </main>
    );
  }

  const roleLabel: Record<string, string> = { admin: "Admin", vip: "VIP", user: "Utente" };
  const joinedDate = profile?.created_at
    ? new Date(profile.created_at).toLocaleDateString("it-IT", { day: "numeric", month: "long", year: "numeric" })
    : "-";

  return (
    <main style={{ background: "#0d0f14", color: "#e8ecf5", padding: "60px 20px", minHeight: "100vh", fontFamily: "system-ui, sans-serif" }}>
      <div style={{ maxWidth: 480, margin: "0 auto" }}>

        <div style={{ marginBottom: 32 }}>
          <h1 style={{ fontSize: 28, fontWeight: 800, marginBottom: 8 }}>
            PRONO<span style={{ color: "#c8f135" }}>X</span>
          </h1>
          <p style={{ color: "#6b7490", fontSize: 15 }}>Il tuo profilo</p>
        </div>

        <div style={{ background: "#161920", border: "1px solid #2a2f3f", borderRadius: 16, padding: 28, marginBottom: 20 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 14, marginBottom: 24 }}>
            <div style={{
              width: 52, height: 52, borderRadius: "50%", background: "#c8f135",
              display: "flex", alignItems: "center", justifyContent: "center",
              fontSize: 22, fontWeight: 800, color: "#0d0f14",
            }}>
              {(profile?.full_name || profile?.email || "?").charAt(0).toUpperCase()}
            </div>
            <div>
              <div style={{ fontSize: 17, fontWeight: 800 }}>
                {profile?.full_name || "Utente PronoX"}
              </div>
              <div style={{ fontSize: 13, color: "#6b7490" }}>{profile?.email}</div>
            </div>
          </div>

          <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
            <Row label="Ruolo" value={roleLabel[profile?.role] || profile?.role || "-"} />
            <Row label="Iscritto dal" value={joinedDate} />
            <Row label="Digest giornaliera" value={profile?.digest_subscribed ? "✅ Attiva" : "⏸️ Disattivata"} />
          </div>

          <button
            onClick={handleLogout}
            style={{
              marginTop: 24, width: "100%", padding: "12px", borderRadius: 10,
              border: "1px solid #2a2f3f", background: "transparent", color: "#e8ecf5",
              fontWeight: 700, fontSize: 14, cursor: "pointer",
            }}
          >
            Esci
          </button>
        </div>

        <div style={{ background: "#161920", border: "1px solid #2a2f3f", borderRadius: 16, padding: 28 }}>
          <div style={{ fontSize: 12, fontWeight: 700, color: "#6b7490", letterSpacing: "0.06em", textTransform: "uppercase", marginBottom: 14 }}>
            Zona pericolosa
          </div>
          <EliminaAccountButton />
        </div>

      </div>
    </main>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div style={{ display: "flex", justifyContent: "space-between", fontSize: 14 }}>
      <span style={{ color: "#6b7490" }}>{label}</span>
      <span style={{ fontWeight: 700 }}>{value}</span>
    </div>
  );
}
