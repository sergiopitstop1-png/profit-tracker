"use client";
import { useState } from "react";
import { createClient } from "../../lib/supabase-browser";

const supabase = createClient();

export default function PasswordDimenticataPage() {
  const [email, setEmail] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [inviata, setInviata] = useState(false);

  const handleSubmit = async () => {
    if (!email) return;
    setLoading(true);
    setError("");

    const { error: resetError } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/reset-password`,
    });

    setLoading(false);
    if (resetError) {
      setError("Qualcosa è andato storto, riprova.");
      return;
    }
    // Mostriamo il messaggio di successo anche se l'email non esiste nel
    // sistema: è la prassi corretta, per non far capire a chi indovina a
    // caso quali indirizzi sono registrati e quali no.
    setInviata(true);
  };

  return (
    <div style={{
      minHeight: "100vh",
      background: "#0d0f14",
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      fontFamily: "system-ui, sans-serif",
    }}>
      <div style={{
        background: "#161920",
        border: "1px solid #2a2f3f",
        borderRadius: 16,
        padding: "40px 36px",
        width: "100%",
        maxWidth: 360,
        textAlign: "center",
      }}>
        <div style={{ fontSize: 28, fontWeight: 800, color: "#e8ecf5", marginBottom: 8 }}>
          SERGIO<span style={{ color: "#c8f135" }}>APICELLA</span>
        </div>

        {inviata ? (
          <>
            <div style={{ fontSize: 15, color: "#4af0c4", fontWeight: 700, marginTop: 20, marginBottom: 10 }}>
              ✓ Controlla la tua email
            </div>
            <div style={{ fontSize: 13, color: "#6b7490", marginBottom: 20, lineHeight: 1.5 }}>
              Se l'indirizzo {email} è registrato, ti abbiamo mandato un link per reimpostare la password. Controlla anche lo spam.
            </div>
            <a href="/register?mode=login" style={{ fontSize: 13, color: "#c8f135", textDecoration: "none" }}>
              ← torna al login
            </a>
          </>
        ) : (
          <>
            <div style={{ fontSize: 13, color: "#6b7490", marginBottom: 32 }}>
              Inserisci la tua email, ti mandiamo un link per reimpostare la password
            </div>

            <input
              type="email"
              value={email}
              onChange={e => setEmail(e.target.value)}
              onKeyDown={e => e.key === "Enter" && handleSubmit()}
              placeholder="Email..."
              autoFocus
              style={{
                width: "100%",
                padding: "12px 14px",
                borderRadius: 10,
                border: "1px solid #2a2f3f",
                background: "#0d0f14",
                color: "#e8ecf5",
                fontSize: 15,
                outline: "none",
                boxSizing: "border-box" as const,
                marginBottom: 12,
              }}
            />

            {error && (
              <div style={{ fontSize: 13, color: "#ff5c5c", marginBottom: 12 }}>
                {error}
              </div>
            )}

            <button
              onClick={handleSubmit}
              disabled={loading || !email}
              style={{
                width: "100%",
                padding: "13px",
                borderRadius: 10,
                border: "none",
                background: loading || !email ? "#2a2f3f" : "#c8f135",
                color: loading || !email ? "#6b7490" : "#0d0f14",
                fontWeight: 800,
                fontSize: 15,
                cursor: loading || !email ? "not-allowed" : "pointer",
                transition: "all 0.2s",
              }}
            >
              {loading ? "Invio..." : "Invia link →"}
            </button>

            <a
              href="/register?mode=login"
              style={{ display: "block", marginTop: 16, fontSize: 13, color: "#6b7490", textDecoration: "none" }}
            >
              ← torna al login
            </a>
          </>
        )}
      </div>
    </div>
  );
}
