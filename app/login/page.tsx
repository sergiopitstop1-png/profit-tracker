"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "../../lib/supabase-browser";

export default function Login() {
  const router = useRouter();
  const supabase = createClient();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [mode, setMode] = useState<"magic" | "password">("magic");
  const [sent, setSent] = useState(false);
  const [errore, setErrore] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleMagicLink(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setErrore("");

    const { error } = await supabase.auth.signInWithOtp({
      email,
      options: { emailRedirectTo: `${window.location.origin}/auth/confirm` },
    });

    setLoading(false);
    if (error) { setErrore(error.message); return; }
    setSent(true);
  }

  async function handlePassword(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setErrore("");

    const { error } = await supabase.auth.signInWithPassword({ email, password });

    if (error) {
      setLoading(false);
      setErrore(error.message);
      return;
    }

    // Aspetta che la sessione sia propagata ai cookie
    await supabase.auth.getSession();
    window.location.href = "/profit-tracker";
  }

  if (sent) {
    return (
      <main style={{ background: "#0d0f14", color: "#e8ecf5", padding: "60px 20px", minHeight: "100vh", fontFamily: "system-ui, sans-serif", display: "flex", alignItems: "center", justifyContent: "center" }}>
        <div style={{ maxWidth: 480, textAlign: "center" }}>
          <div style={{ fontSize: 48, marginBottom: 20 }}>📬</div>
          <h1 style={{ fontSize: 28, fontWeight: 800, marginBottom: 12 }}>Controlla la tua email!</h1>
          <p style={{ color: "#6b7490", fontSize: 15, lineHeight: 1.7 }}>
            Abbiamo inviato un link di accesso a <strong style={{ color: "#c8f135" }}>{email}</strong>.<br />
            Clicca il link per accedere a PronoX.
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
            <span style={{ fontSize: 13, fontWeight: 400, color: "#6b7490" }}> · accedi</span>
          </h1>
        </div>

        <div style={{ display: "flex", gap: 8, marginBottom: 24 }}>
          <button onClick={() => setMode("magic")}
            style={{ flex: 1, padding: "10px", borderRadius: 8, border: "1px solid", background: mode === "magic" ? "#c8f135" : "transparent", color: mode === "magic" ? "#0d0f14" : "#6b7490", borderColor: mode === "magic" ? "#c8f135" : "#2a2f3f", fontWeight: 700, fontSize: 13, cursor: "pointer" }}>
            📬 Magic Link
          </button>
          <button onClick={() => setMode("password")}
            style={{ flex: 1, padding: "10px", borderRadius: 8, border: "1px solid", background: mode === "password" ? "#c8f135" : "transparent", color: mode === "password" ? "#0d0f14" : "#6b7490", borderColor: mode === "password" ? "#c8f135" : "#2a2f3f", fontWeight: 700, fontSize: 13, cursor: "pointer" }}>
            🔐 Password
          </button>
        </div>

        <div style={{ background: "#161920", border: "1px solid #2a2f3f", borderRadius: 16, padding: 28 }}>

          {mode === "magic" ? (
            <form onSubmit={handleMagicLink} style={{ display: "flex", flexDirection: "column", gap: 16 }}>
              <p style={{ fontSize: 13, color: "#6b7490", margin: 0 }}>
                Inserisci la tua email — ti mandiamo un link di accesso istantaneo. Niente password.
              </p>
              <div>
                <label style={lbl}>Email</label>
                <input type="email" placeholder="nome@email.com" value={email} onChange={e => setEmail(e.target.value)} required style={inp} />
              </div>
              {errore && <p style={{ color: "#ff5c5c", fontSize: 13, margin: 0 }}>{errore}</p>}
              <button type="submit" disabled={loading || !email}
                style={{ padding: "14px", borderRadius: 10, border: "none", background: loading || !email ? "#2a2f3f" : "#c8f135", color: loading || !email ? "#6b7490" : "#0d0f14", fontWeight: 800, fontSize: 15, cursor: loading || !email ? "not-allowed" : "pointer" }}>
                {loading ? "Invio..." : "INVIA LINK DI ACCESSO ↗"}
              </button>
            </form>
          ) : (
            <form onSubmit={handlePassword} style={{ display: "flex", flexDirection: "column", gap: 16 }}>
              <p style={{ fontSize: 13, color: "#6b7490", margin: 0 }}>
                Accesso con password — riservato all'area privata.
              </p>
              <div>
                <label style={lbl}>Email</label>
                <input type="email" placeholder="nome@email.com" value={email} onChange={e => setEmail(e.target.value)} required style={inp} />
              </div>
              <div>
                <label style={lbl}>Password</label>
                <input type="password" placeholder="••••••••" value={password} onChange={e => setPassword(e.target.value)} required style={inp} />
              </div>
              {errore && <p style={{ color: "#ff5c5c", fontSize: 13, margin: 0 }}>{errore}</p>}
              <button type="submit" disabled={loading}
                style={{ padding: "14px", borderRadius: 10, border: "none", background: loading ? "#2a2f3f" : "#c8f135", color: loading ? "#6b7490" : "#0d0f14", fontWeight: 800, fontSize: 15, cursor: loading ? "not-allowed" : "pointer" }}>
                {loading ? "Accesso in corso..." : "ENTRA ↗"}
              </button>
            </form>
          )}

          <div style={{ marginTop: 20, paddingTop: 20, borderTop: "1px solid #2a2f3f", textAlign: "center" }}>
            <p style={{ fontSize: 13, color: "#6b7490" }}>
              Non hai un account?{" "}
              <a href="/register" style={{ color: "#c8f135", textDecoration: "none", fontWeight: 700 }}>Registrati gratis</a>
            </p>
          </div>
        </div>

      </div>
    </main>
  );
}

const lbl = { fontSize: 11, fontWeight: 700, color: "#6b7490", letterSpacing: "0.06em", textTransform: "uppercase" as const, display: "block", marginBottom: 6 };
const inp = { background: "#0d0f14", border: "1px solid #2a2f3f", borderRadius: 8, padding: "12px 14px", color: "#e8ecf5", fontSize: 14, outline: "none", width: "100%", boxSizing: "border-box" as const };
