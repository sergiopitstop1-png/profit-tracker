// Salva questo file come: app/api/pronox/notify-signup/route.ts
// (crea la cartella "notify-signup" dentro app/api/pronox/ se non esiste)

import { createClient } from "@supabase/supabase-js";
import { NextResponse } from "next/server";
import { notifyAdmin } from "@/lib/notifyAdmin"; // alias assoluto: se il tuo progetto non ha "@/*" configurato in tsconfig.json, vedi nota sotto

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function POST(request: Request) {
  const { email } = await request.json();
  if (!email) {
    return NextResponse.json({ error: "Email mancante" }, { status: 400 });
  }

  // Controllo minimo anti-abuso: notifichiamo solo se esiste davvero un
  // profilo con questa email (creato dal trigger al momento della
  // registrazione), così questa route non può essere usata per spammarti
  // notifiche finte con email a caso.
  const { data: profile } = await supabase
    .from("user_profiles")
    .select("id")
    .eq("email", email)
    .maybeSingle();

  if (!profile) {
    // Non è un errore per l'utente che si sta registrando — semplicemente
    // non mandiamo la notifica se non troviamo il profilo (es. race
    // condition col trigger, capita raramente).
    return NextResponse.json({ ok: true, notified: false });
  }

  await notifyAdmin("iscrizione", email);
  return NextResponse.json({ ok: true, notified: true });
}
