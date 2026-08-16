// Salva questo file come: components/UserGreeting.tsx
// Da inserire nel tuo SiteHeader.js (o dove hai il menu di navigazione),
// tipicamente vicino al link "analisi manuale" / "storico" che hai già.
//
// Uso: <UserGreeting />

"use client";

import { useState, useEffect } from "react";
import { createClient } from "../../lib/supabase-browser"; // da app/components/ servono due livelli per arrivare a lib/ (che sta alla radice)

const supabase = createClient();

export default function UserGreeting() {
  const [name, setName] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        setLoading(false);
        return;
      }
      const { data } = await supabase
        .from("user_profiles")
        .select("full_name")
        .eq("id", session.user.id)
        .single();
      setName(data?.full_name || session.user.email?.split("@")[0] || "utente");
      setLoading(false);
    }
    load();
  }, []);

  if (loading) return null; // niente flash mentre carica

  if (!name) {
    // Non loggato — link diretto a login, coerente con lo stile testuale del resto del menu
    return (
      <a href="/register?mode=login" style={{ color: "#6b7490", fontSize: 13, textDecoration: "none" }}>
        Accedi
      </a>
    );
  }

  return (
    <a
      href="/profilo"
      style={{
        display: "inline-flex", alignItems: "center", gap: 6,
        color: "#e8ecf5", fontSize: 13, fontWeight: 700, textDecoration: "none",
      }}
    >
      Ciao {name} 👋
    </a>
  );
}
