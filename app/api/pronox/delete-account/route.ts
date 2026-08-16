// Salva questo file come: app/api/pronox/delete-account/route.ts
// (crea la cartella "delete-account" dentro app/api/pronox/ se non esiste)

import { createClient } from "@supabase/supabase-js";
import crypto from "crypto";
import { notifyAdmin } from "@/lib/notifyAdmin"; // alias assoluto: se il tuo progetto non ha "@/*" configurato in tsconfig.json, vedi nota sotto
import { sendFarewellEmail } from "@/lib/sendFarewellEmail";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

// Token con scopo "delete" — diverso da quello usato per il link di sola
// disiscrizione dalla mail (UNSUB_SECRET + ':unsub'), così un link non può
// essere riusato per fare l'altra azione per sbaglio o per abuso.
function deleteToken(email: string) {
  return crypto
    .createHmac("sha256", process.env.UNSUB_SECRET!)
    .update(email.toLowerCase().trim() + ":delete")
    .digest("hex")
    .slice(0, 16);
}

async function performDeletion(email: string) {
  const { data: profile } = await supabase
    .from("user_profiles")
    .select("id")
    .eq("email", email)
    .single();

  if (!profile) return { ok: false, reason: "not_found" as const };

  // IMPORTANTE: l'ordine conta. user_profiles.id ha una foreign key verso
  // l'utente Auth — se proviamo a cancellare l'utente Auth mentre quella
  // riga esiste ancora, Supabase rifiuta con "Database error deleting user"
  // perché lascerebbe un riferimento orfano. Cancelliamo quindi PRIMA il
  // profilo, POI l'utente Auth.
  const { error: profileDeleteError } = await supabase.from("user_profiles").delete().eq("id", profile.id);
  if (profileDeleteError) {
    console.error(`[delete-account] ERRORE cancellazione profilo (id=${profile.id}, email=${email}):`, profileDeleteError.message);
  }

  const { error: authDeleteError } = await supabase.auth.admin.deleteUser(profile.id);
  if (authDeleteError) {
    console.error(`[delete-account] ERRORE cancellazione utente Auth (id=${profile.id}, email=${email}):`, authDeleteError.message);
  }

  return { ok: true as const };
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const email = searchParams.get("email");
  const token = searchParams.get("token");

  if (!email || !token || deleteToken(email) !== token) {
    return htmlResponse(400, confirmPage("Link non valido", "Questo link non è valido o è scaduto.", null));
  }

  // Solo la pagina di conferma — nessuna cancellazione ancora. La
  // cancellazione vera scatta solo al click sul pulsante, che fa una POST.
  return htmlResponse(
    200,
    confirmPage(
      "Confermi la cancellazione?",
      `Stai per eliminare definitivamente il tuo account PronoX (${email}). Potrai iscriverti di nuovo in futuro, ma perderai l'accesso e lo storico legato a questo account.`,
      { email, token }
    )
  );
}

export async function POST(request: Request) {
  const { searchParams } = new URL(request.url);
  const email = searchParams.get("email");
  const token = searchParams.get("token");

  if (!email || !token || deleteToken(email) !== token) {
    return htmlResponse(400, resultPage("Link non valido", "Questo link non è valido o è scaduto."));
  }

  const result = await performDeletion(email);
  if (!result.ok) {
    return htmlResponse(200, resultPage("Account non trovato", "Non risulta nessun account PronoX attivo con questa email — forse è già stato cancellato in precedenza."));
  }

  await notifyAdmin("cancellazione", email);
  await sendFarewellEmail(email);

  return htmlResponse(
    200,
    resultPage("Account cancellato", `L'account (${email}) è stato eliminato. Puoi iscriverti di nuovo quando vuoi da sergioapicella.it.`)
  );
}

function htmlResponse(status: number, body: string) {
  return new Response(body, { status, headers: { "Content-Type": "text/html; charset=utf-8" } });
}

function shell(inner: string) {
  return `<!DOCTYPE html>
<html lang="it">
<head><meta charset="utf-8"><title>PronoX</title></head>
<body style="background:#0d0f14;color:#e8ecf5;font-family:system-ui,sans-serif;padding:60px 20px;text-align:center;">
  <h1 style="font-size:22px;">PRONO<span style="color:#c8f135;">X</span></h1>
  ${inner}
</body>
</html>`;
}

function confirmPage(title: string, message: string, data: { email: string; token: string } | null) {
  const button = data
    ? `<form method="POST" action="/api/pronox/delete-account?email=${encodeURIComponent(data.email)}&token=${data.token}">
         <button type="submit" style="margin-top:20px;padding:12px 28px;background:#ff5c5c;color:#0d0f14;font-weight:800;border:none;border-radius:10px;font-size:14px;cursor:pointer;">
           Sì, elimina il mio account
         </button>
       </form>`
    : "";
  return shell(`
    <h2 style="font-size:18px;margin-top:24px;">${title}</h2>
    <p style="color:#6b7490;max-width:400px;margin:16px auto;">${message}</p>
    ${button}
  `);
}

function resultPage(title: string, message: string) {
  return shell(`
    <h2 style="font-size:18px;margin-top:24px;">${title}</h2>
    <p style="color:#6b7490;max-width:400px;margin:16px auto;">${message}</p>
    <a href="https://sergioapicella.it/oggi" style="display:inline-block;margin-top:20px;padding:10px 24px;background:#c8f135;color:#0d0f14;font-weight:800;border-radius:10px;text-decoration:none;">Torna a PronoX</a>
  `);
}
