"use client";
import { useState, useEffect } from "react";
import { createClient } from "../../lib/supabase-browser";

const supabase = createClient();

export default function ResetPasswordPage() {
  const [pronto, setPronto] = useState(false); // true quando Supabase ha riconosciuto il link come valido
  const [password, setPassword] = useState("");
  const [conferma, setConferma] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [fatto, setFatto] = useState(false);

  useEffect(() => {
    const verificaLink = async () => {
      // Nuovo flusso: il link nella mail punta al nostro sito con un
      // token_hash nella query string, non più al redirect automatico di
      // Supabase. Lo verifichiamo qui esplicitamente via JS — così, se uno
      // scanner email "visita" il link da solo senza eseguire JavaScript,
      // non consuma il codice prima che l'utente vero clicchi davvero.
      const params = new URLSearchParams(window.location.search);
      const token_hash = params.get("token_hash");
      const type = params.get("type");
      const code = params.get("code");

      if (token_hash && type) {
        const { error } = await supabase.auth.verifyOtp({
          token_hash,
          type: type as "recovery",
        });
        if (!error) { setPronto(true); return; }
      }

      if (code) {
        const { error } = await supabase.auth.exchangeCodeForSession(code);
        if (!error) { setPronto(true); return; }
      }

      // Fallback: se per qualche motivo arriva ancora nel vecchio formato
      // (token nell'URL, gestito automaticamente dalla libreria)
      const { data: { session } } = await supabase.auth.getSession();
      if (session) setPronto(true);
    };
    verificaLink();

    const { data: listener } = supabase.auth.onAuthStateChange((event) => {
      if (event === "PASSWORD_RECOVERY") {
        setPronto(true);
      }
    });

    return () => { listener.subscription.unsubscribe(); };
  }, []);

  const handleSubmit = async () => {
    if (!password || password.length < 6) {
      setError("La password deve avere almeno 6 caratteri.");
      return;
    }
    if (password !== conferma) {
      setError("Le due password non coincidono.");
      return;
    }
    setLoading(true);
    setError("");

    const { error: updateError } = await supabase.auth.updateUser({ password });

    setLoading(false);
    if (updateError) {
      setError("Qualcosa è andato storto, riprova o richiedi un nuovo link.");
      return;
    }
    setFatto(true);
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

        {fatto ? (
          <>
            <div style={{ fontSize: 15, color: "#4af0c4", fontWeight: 700, marginTop: 20, marginBottom: 10 }}>
              ✓ Password aggiornata
            </div>
            <a href="/register?mode=login" style={{ fontSize: 13, color: "#c8f135", textDecoration: "none" }}>
              Vai al login →
            </a>
          </>
        ) : !pronto ? (
          <div style={{ fontSize: 13, color: "#6b7490", marginTop: 20 }}>
            Verifica del link in corso... se non succede nulla entro pochi secondi, il link potrebbe essere scaduto — richiedine uno nuovo dalla pagina "Password dimenticata".
          </div>
        ) : (
          <>
            <div style={{ fontSize: 13, color: "#6b7490", marginBottom: 32 }}>
              Scegli la tua nuova password
            </div>

            <input
              type="password"
              value={password}
              onChange={e => setPassword(e.target.value)}
              placeholder="Nuova password..."
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
                marginBottom: 10,
              }}
            />

            <input
              type="password"
              value={conferma}
              onChange={e => setConferma(e.target.value)}
              onKeyDown={e => e.key === "Enter" && handleSubmit()}
              placeholder="Conferma password..."
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
              disabled={loading || !password || !conferma}
              style={{
                width: "100%",
                padding: "13px",
                borderRadius: 10,
                border: "none",
                background: loading || !password || !conferma ? "#2a2f3f" : "#c8f135",
                color: loading || !password || !conferma ? "#6b7490" : "#0d0f14",
                fontWeight: 800,
                fontSize: 15,
                cursor: loading || !password || !conferma ? "not-allowed" : "pointer",
                transition: "all 0.2s",
              }}
            >
              {loading ? "Salvataggio..." : "Salva nuova password →"}
            </button>
          </>
        )}
      </div>
    </div>
  );
}
