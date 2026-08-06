"use client";
import { useState, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import { createClient } from "../../lib/supabase-browser";

const supabase = createClient();

function LoginForm() {
  const searchParams = useSearchParams();
  const from = searchParams.get("from") || "/";

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const handleSubmit = async () => {
    if (!email || !password) return;
    setLoading(true);
    setError("");

    const { error: signInError } = await supabase.auth.signInWithPassword({ email, password });

    if (signInError) {
      setError("Email o password errati.");
      setLoading(false);
      return;
    }

    // Aspetta che la sessione sia propagata prima di redirigere,
    // altrimenti il middleware sulla pagina successiva non la vede ancora
    await supabase.auth.getSession();
    window.location.href = from;
  };

  return (
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
      <div style={{ fontSize: 13, color: "#6b7490", marginBottom: 32 }}>
        Accedi con il tuo account
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
          marginBottom: 10,
        }}
      />

      <input
        type="password"
        value={password}
        onChange={e => setPassword(e.target.value)}
        onKeyDown={e => e.key === "Enter" && handleSubmit()}
        placeholder="Password..."
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
        disabled={loading || !email || !password}
        style={{
          width: "100%",
          padding: "13px",
          borderRadius: 10,
          border: "none",
          background: loading || !email || !password ? "#2a2f3f" : "#c8f135",
          color: loading || !email || !password ? "#6b7490" : "#0d0f14",
          fontWeight: 800,
          fontSize: 15,
          cursor: loading || !email || !password ? "not-allowed" : "pointer",
          transition: "all 0.2s",
        }}
      >
        {loading ? "Accesso..." : "Entra →"}
      </button>

      <a
        href="/password-dimenticata"
        style={{ display: "block", marginTop: 16, fontSize: 13, color: "#6b7490", textDecoration: "none" }}
      >
        Password dimenticata?
      </a>
    </div>
  );
}

export default function LoginPage() {
  return (
    <div style={{
      minHeight: "100vh",
      background: "#0d0f14",
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      fontFamily: "system-ui, sans-serif",
    }}>
      <Suspense fallback={<div style={{ color: "#6b7490", fontSize: 14 }}>Carico...</div>}>
        <LoginForm />
      </Suspense>
    </div>
  );
}
