// Componente da inserire nella tua pagina profilo/account esistente.
// Esempio d'uso: <EliminaAccountButton /> dentro il JSX della pagina.

"use client";

import { useState } from "react";
import { createClient } from "@supabase/supabase-js"; // usa il tuo client Supabase già esistente lato browser, se già lo importi altrove sostituisci questa riga

export default function EliminaAccountButton() {
  const [showConfirm, setShowConfirm] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleDelete() {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/pronox/account/delete", { method: "POST" });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "Errore durante la cancellazione.");
        setLoading(false);
        return;
      }
      // Account cancellato lato server — ora chiudiamo la sessione locale
      // e mandiamo l'utente alla home, altrimenti resterebbe "loggato" nel
      // browser con un account che non esiste più.
      window.location.href = "/oggi";
    } catch (e) {
      setError("Errore di rete durante la cancellazione.");
      setLoading(false);
    }
  }

  if (!showConfirm) {
    return (
      <button
        onClick={() => setShowConfirm(true)}
        style={{
          padding: "10px 20px",
          background: "transparent",
          border: "1px solid #ff5c5c",
          color: "#ff5c5c",
          borderRadius: "10px",
          fontWeight: 700,
          cursor: "pointer",
        }}
      >
        Elimina account
      </button>
    );
  }

  return (
    <div style={{ border: "1px solid #2a2f3f", borderRadius: "14px", padding: "20px", maxWidth: "400px" }}>
      <p style={{ color: "#e8ecf5", marginBottom: "16px" }}>
        Sei sicuro? Il tuo account verrà eliminato definitivamente (potrai iscriverti di nuovo in futuro, ma perderai
        l'accesso e lo storico legati a questo account).
      </p>
      {error && <p style={{ color: "#ff5c5c", fontSize: "13px", marginBottom: "12px" }}>{error}</p>}
      <div style={{ display: "flex", gap: "10px" }}>
        <button
          onClick={handleDelete}
          disabled={loading}
          style={{
            padding: "10px 20px",
            background: "#ff5c5c",
            border: "none",
            color: "#0d0f14",
            borderRadius: "10px",
            fontWeight: 800,
            cursor: loading ? "default" : "pointer",
            opacity: loading ? 0.6 : 1,
          }}
        >
          {loading ? "Cancellazione..." : "Sì, elimina definitivamente"}
        </button>
        <button
          onClick={() => setShowConfirm(false)}
          disabled={loading}
          style={{
            padding: "10px 20px",
            background: "transparent",
            border: "1px solid #2a2f3f",
            color: "#e8ecf5",
            borderRadius: "10px",
            fontWeight: 700,
            cursor: "pointer",
          }}
        >
          Annulla
        </button>
      </div>
    </div>
  );
}
