"use client";

import { useState, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import { createClient } from "../../lib/supabase-browser";

const supabase = createClient();

function RegisterForm() {
  const searchParams = useSearchParams();
  const from = searchParams.get("from") || "/oggi";
  const modeParam = searchParams.get("mode");

  const [mode, setMode] = useState(modeParam === "login" ? "login" : "register"); // "register" | "login"
  const [email, setEmail] = useState("");
  const [name, setName] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [errore, setErrore] = useState("");

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setErrore("");

    if (mode === "register") {
      const { data, error } = await supabase.auth.signUp({
        email,
        password,
        options: { data: { full_name: name } },
      });

      if (error) {
        setLoading(false);
        setErrore(error.message === "User already registered" ? "Questa email è già registrata. Prova ad accedere." : error.message);
        return;
      }

      // Salva il nome nel profilo (il trigger crea già la riga base con ruolo 'user')
      if (name && data.user) {
        await supabase.from("user_profiles").update({ full_name: name }).eq("id", data.user.id);
      }

      // Avvisa Sergio della nuova iscrizione — "fire and forget": se questa
      // chiamata fallisce non deve mai bloccare la registrazione dell'utente.
      fetch("/api/pronox/notify-signup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
      }).catch(() => {});

      // Se la conferma email è disattivata su Supabase, la sessione è già attiva qui
      await supabase.auth.getSession();
      window.location.href = from;
      return;
    }

    // mode === "login"
    const { error } = await supabase.auth.signInWithPassword({ email, password });

    setLoading(false);

    if (error) {
      setErrore("Email o password errati.");
      return;
    }

    await supabase.auth.getSession();
    window.location.href = from;
  }

  return (
    <main style={{ background: "#0d0f14", color: "#e8ecf5", padding: "60px 20px", minHeight: "100vh", fontFamily: "system-ui, sans-serif" }}>
      <div style={{ maxWidth: 480, margin: "0 auto" }}>

        <div style={{ marginBottom: 32 }}>
          <h1 style={{ fontSize: 28, fontWeight: 800, marginBottom: 8 }}>
            PRONO<span style={{ color: "#c8f135" }}>X</span>
          </h1>
          <p style={{ color: "#6b7490", fontSize: 15 }}>
            {mode === "register"
              ? "Registrati gratis e accedi al pronosticatore sportivo basato su dati reali."
              : "Accedi al tuo account PronoX."}
          </p>
          {mode === "register" && (
            <div style={{ marginTop: 12, display: "inline-block", background: "rgba(200,241,53,0.1)", border: "1px solid rgba(200,241,53,0.3)", borderRadius: 20, padding: "4px 14px", fontSize: 12, color: "#c8f135", fontWeight: 700 }}>
              🎁 Gratuito fino a fine 2026
            </div>
          )}
        </div>

        <div style={{ background: "#161920", border: "1px solid #2a2f3f", borderRadius: 16, padding: 28 }}>

          {/* Toggle registrati / accedi */}
          <div style={{ display: "flex", gap: 8, marginBottom: 20, background: "#0d0f14", borderRadius: 10, padding: 4 }}>
            <button
              type="button"
              onClick={() => { setMode("register"); setErrore(""); }}
              style={{
                flex: 1, padding: "9px", borderRadius: 8, border: "none", cursor: "pointer", fontWeight: 700, fontSize: 13,
                background: mode === "register" ? "#c8f135" : "transparent",
                color: mode === "register" ? "#0d0f14" : "#6b7490",
              }}
            >
              Registrati
            </button>
            <button
              type="button"
              onClick={() => { setMode("login"); setErrore(""); }}
              style={{
                flex: 1, padding: "9px", borderRadius: 8, border: "none", cursor: "pointer", fontWeight: 700, fontSize: 13,
                background: mode === "login" ? "#c8f135" : "transparent",
                color: mode === "login" ? "#0d0f14" : "#6b7490",
              }}
            >
              Accedi
            </button>
          </div>

          <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: 16 }}>

            {mode === "register" && (
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
            )}

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

            <div>
              <label style={lbl}>Password</label>
              <input
                type="password"
                placeholder={mode === "register" ? "Scegli una password" : "La tua password"}
                value={password}
                onChange={e => setPassword(e.target.value)}
                required
                minLength={6}
                style={inp}
              />
            </div>

            {errore && (
              <p style={{ color: "#ff5c5c", fontSize: 13, margin: 0 }}>{errore}</p>
            )}

            <button
              type="submit"
              disabled={loading || !email || !password}
              style={{ padding: "14px", borderRadius: 10, border: "none", background: loading || !email || !password ? "#2a2f3f" : "#c8f135", color: loading || !email || !password ? "#6b7490" : "#0d0f14", fontWeight: 800, fontSize: 15, cursor: loading || !email || !password ? "not-allowed" : "pointer", marginTop: 4 }}>
              {loading ? "Attendi..." : mode === "register" ? "REGISTRATI GRATIS ↗" : "ACCEDI →"}
            </button>

            {mode === "login" && (
              <a href="/password-dimenticata" style={{ textAlign: "center", fontSize: 13, color: "#6b7490", textDecoration: "none" }}>
                Password dimenticata?
              </a>
            )}

          </form>
        </div>

        {mode === "register" && (
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
        )}

      </div>
    </main>
  );
}

export default function Register() {
  return (
    <Suspense fallback={<div style={{ background: "#0d0f14", minHeight: "100vh", color: "#6b7490", display: "flex", alignItems: "center", justifyContent: "center", fontFamily: "system-ui, sans-serif" }}>Carico...</div>}>
      <RegisterForm />
    </Suspense>
  );
}

const lbl = { fontSize: 11, fontWeight: 700, color: "#6b7490", letterSpacing: "0.06em", textTransform: "uppercase" as const, display: "block", marginBottom: 6 };
const inp = { background: "#0d0f14", border: "1px solid #2a2f3f", borderRadius: 8, padding: "12px 14px", color: "#e8ecf5", fontSize: 14, outline: "none", width: "100%", boxSizing: "border-box" as const };
