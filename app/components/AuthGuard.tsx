"use client";

// NOTA: il controllo di accesso ora avviene nel middleware.ts (sessione Supabase reale).
// Questo componente resta solo per non rompere gli import nelle pagine esistenti,
// ma non fa più nessun controllo proprio (usava il vecchio sistema con password unica
// in localStorage, ormai sostituito).
export default function AuthGuard({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
