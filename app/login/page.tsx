"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "../../lib/supabase-browser";

export default function Login() {
  const router = useRouter();
  const supabase = createClient();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [errore, setErrore] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setErrore("");

    const { error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    setLoading(false);

    if (error) {
      setErrore(error.message);
      return;
    }

    router.push("/profit-tracker");
    router.refresh();
  }

  return (
    <main
      style={{
        background: "black",
        color: "white",
        padding: "60px 20px",
        minHeight: "100vh",
        fontFamily: "Arial, sans-serif",
      }}
    >
      <h1 style={{ fontSize: "40px" }}>Area riservata</h1>

      <p style={{ marginTop: "20px", maxWidth: "800px" }}>
        Accedi per entrare nell’area privata.
      </p>

      <form
        onSubmit={handleLogin}
        style={{
          marginTop: "30px",
          maxWidth: "420px",
          display: "flex",
          flexDirection: "column",
          gap: "15px",
        }}
      >
        <input
          type="email"
          placeholder="Email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          style={{
            padding: "14px",
            borderRadius: "8px",
            border: "1px solid #555",
            background: "#111",
            color: "white",
          }}
        />

        <input
          type="password"
          placeholder="Password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          style={{
            padding: "14px",
            borderRadius: "8px",
            border: "1px solid #555",
            background: "#111",
            color: "white",
          }}
        />

        {errore && (
          <p style={{ color: "#ff6b6b", margin: 0 }}>
            {errore}
          </p>
        )}

        <button
          type="submit"
          disabled={loading}
          style={{
            padding: "14px",
            borderRadius: "8px",
            border: "none",
            background: "white",
            color: "black",
            fontWeight: "bold",
            cursor: "pointer",
            opacity: loading ? 0.7 : 1,
          }}
        >
          {loading ? "Accesso in corso..." : "Entra"}
        </button>
      </form>
    </main>
  );
}