import { createBrowserClient } from "@supabase/ssr";

export function createClient() {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      auth: {
        // "implicit" invece di "pkce": il link (reset password, magic link)
        // porta il token direttamente con sé, quindi funziona anche se
        // aperto da un browser o da un'app email diversa da quella dove
        // è stata fatta la richiesta — importante per utenti "normali"
        // che aprono la mail dal telefono.
        flowType: "implicit",
      },
    }
  );
}
