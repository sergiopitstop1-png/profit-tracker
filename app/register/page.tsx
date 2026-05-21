"use client";

import { useState } from "react";
import { createClient } from "../../lib/supabase-browser";

export default function Register() {
  const supabase = createClient();
  const [email, setEmail] = useState("");
  const [name, setName] = useState("");
  const [sent, setSent] = useState(false);
  const [loading, setLoading] = useState(false);
  const [errore, setErrore] = useState("");

  async function handleRegister(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setErrore("");

    const { error } = await supabase.auth.signInWithOtp({
      email,
      options: {
        emailRedirectTo: `${window.location.origin}/oggi`,
        data: { full_name: name },
      },
    });

    setLoading(false);

    if (error) {
      setErrore(error.message);
      return;
    }

    // Salva il nome nel profilo
    if (name) {
      await supabase.from("user_profiles").upsert({ email, full_name: name }, { onConflict: "email" });
    }

    setSent(true);
  }

  if (sent) {
    return (
      <main style={{ background: "#0d0f14", color: "#e8ecf5", padding: "60px 20px", minHeight: "100vh", fontFamily: "system-ui, sans-serif", display: "flex", alignItems: "center", justifyContent: "center" }}>
        <div style={{ maxWidth: 480, textAlign: "center" }}>
          <div style={{ fontSize: 48, marginBottom: 20 }}>📬</div>
          <h1 style={{ fontSize: 28, fontWeight: 800, marginBottom: 12 }}>
            Controlla la tua email!
          </h1>
          <p style={{ color: "#6b7490", fontSize: 15, lineHeight: 1.7 }}>
            Abbiamo inviato un link di accesso a <strong style={{ color: "#c8f135" }}>{email}</strong>.<br />
            Clicca il link per accedere a PronoX — niente password, niente stress.
          </p>
          <p style={{ color: "#6b7490", fontSize: 13, marginTop: 20 }}>
            Non trovi l'email? Controlla la cartella spam.
          </p>
        </div>
      </main>
    );
  }

  return (
    <main style={{ background: "#0d0f14", color: "#e8ecf5", padding: "60px 20px", minHeight: "100vh", fontFamily: "system-ui, sans-serif" }}>
      <div style={{ maxWidth: 480, margin: "0 auto" }}>

        <div style={{ marginBottom: 32 }}>
          <h1 style={{ fontSize: 28, fontWeight: 800, marginBottom: 8 }}>
            PRONO<span style={{ color: "#c8f135" }}>X</span>
          </h1>
          <p style={{ color: "#6b7490", fontSize: 15 }}>
            Registrati gratis e accedi al pronosticatore sportivo basato su dati reali.
          </p>
          <div style={{ marginTop: 12, display: "inline-block", background: "rgba(200,241,53,0.1)", border: "1px solid rgba(200,241,53,0.3)", borderRadius: 20, padding: "4px 14px", fontSize: 12, color: "#c8f135", fontWeight: 700 }}>
            🎁 Gratuito fino a fine 2025
          </div>
        </div>

        <div style={{ background: "#161920", border: "1px solid #2a2f3f", borderRadius: 16, padding: 28 }}>
          <form onSubmit={handleRegister} style={{ display: "flex", flexDirection: "column", gap: 16 }}>

            <div>
              <label style={lbl}>Nome</label>
              <input
                type="text"
                placeholder="Il tuo nome"
                value={name}
                onChange={e => setName(e.target.value)}
                style={inp}
              />
            </div>

            <div>
              <label style={lbl}>Email</label>
              <input
                type="email"
                placeholder="nome@email.com"
                value={email}
                onChange={e => setEmail(e.target.value)}
                required
                style={inp}
              />
            </div>

            {errore && (
              <p style={{ color: "#ff5c5c", fontSize: 13, margin: 0 }}>{errore}</p>
            )}

            <button
              type="submit"
              disabled={loading || !email}
              style={{ padding: "14px", borderRadius: 10, border: "none", background: loading || !email ? "#2a2f3f" : "#c8f135", color: loading || !email ? "#6b7490" : "#0d0f14", fontWeight: 800, fontSize: 15, cursor: loading || !email ? "not-allowed" : "pointer", marginTop: 4 }}>
              {loading ? "Invio in corso..." : "REGISTRATI GRATIS ↗"}
            </button>

          </form>

          <div style={{ marginTop: 20, paddingTop: 20, borderTop: "1px solid #2a2f3f", textAlign: "center" }}>
            <p style={{ fontSize: 13, color: "#6b7490" }}>
              Hai già un account?{" "}
              <a href="/login" style={{ color: "#c8f135", textDecoration: "none", fontWeight: 700 }}>Accedi</a>
            </p>
          </div>
        </div>

        <div style={{ marginTop: 24, display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 12 }}>
          {[
            ["⚽", "Calcio", "19 campionati"],
            ["🎾", "Tennis", "Tornei live"],
            ["🎆", "Value Bet", "EV calcolato"],
          ].map(([icon, title, sub]) => (
            <div key={title} style={{ background: "#161920", border: "1px solid #2a2f3f", borderRadius: 10, padding: "14px 10px", textAlign: "center" }}>
              <div style={{ fontSize: 22, marginBottom: 6 }}>{icon}</div>
              <div style={{ fontSize: 13, fontWeight: 700, marginBottom: 4 }}>{title}</div>
              <div style={{ fontSize: 11, color: "#6b7490" }}>{sub}</div>
            </div>
          ))}
        </div>

      </div>
    </main>
  );
}

const lbl = { fontSize: 11, fontWeight: 700, color: "#6b7490", letterSpacing: "0.06em", textTransform: "uppercase" as const, display: "block", marginBottom: 6 };
const inp = { background: "#0d0f14", border: "1px solid #2a2f3f", borderRadius: 8, padding: "12px 14px", color: "#e8ecf5", fontSize: 14, outline: "none", width: "100%", boxSizing: "border-box" as const };
