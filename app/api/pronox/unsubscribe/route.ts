// Salva questo file come: app/api/pronox/unsubscribe/route.ts
// (crea la cartella "unsubscribe" dentro app/api/pronox/ se non esiste già)

import { createClient } from "@supabase/supabase-js";
import crypto from "crypto";
import { notifyAdmin } from "../../../../lib/notifyAdmin"; // aggiusta il percorso relativo in base a dove hai il file lib/notifyAdmin.ts

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

// Stesso identico calcolo usato per generare il link nella mail — se il
// token non coincide (email modificata a mano nell'URL, link vecchio dopo
// un cambio di UNSUB_SECRET, ecc.) rifiutiamo, così nessuno può disiscrivere
// l'email di qualcun altro solo indovinandola.
function tokenFor(email: string) {
  return crypto
    .createHmac("sha256", process.env.UNSUB_SECRET!)
    .update(email.toLowerCase().trim())
    .digest("hex")
    .slice(0, 16);
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const email = searchParams.get("email");
  const token = searchParams.get("token");

  if (!email || !token || tokenFor(email) !== token) {
    return new Response(pageHtml("Link non valido", "Questo link di disiscrizione non è valido o è scaduto."), {
      status: 400,
      headers: { "Content-Type": "text/html; charset=utf-8" },
    });
  }

  const { error } = await supabase
    .from("user_profiles")
    .update({ digest_subscribed: false })
    .eq("email", email);

  if (error) {
    return new Response(pageHtml("Errore", "Non siamo riusciti a completare la disiscrizione. Riprova più tardi o scrivi a Sergio."), {
      status: 500,
      headers: { "Content-Type": "text/html; charset=utf-8" },
    });
  }

  await notifyAdmin("disiscrizione", email);

  return new Response(
    pageHtml("Disiscrizione completata", `Non riceverai più la digest giornaliera di PronoX all'indirizzo ${email}. Puoi tornare a iscriverti in qualsiasi momento scrivendo a Sergio.`),
    { headers: { "Content-Type": "text/html; charset=utf-8" } }
  );
}

function pageHtml(title: string, message: string) {
  return `<!DOCTYPE html>
<html lang="it">
<head><meta charset="utf-8"><title>${title} · PronoX</title></head>
<body style="background:#0d0f14;color:#e8ecf5;font-family:system-ui,sans-serif;padding:60px 20px;text-align:center;">
  <h1 style="font-size:22px;">PRONO<span style="color:#c8f135;">X</span></h1>
  <h2 style="font-size:18px;margin-top:24px;">${title}</h2>
  <p style="color:#6b7490;max-width:400px;margin:16px auto;">${message}</p>
  <a href="https://sergioapicella.it/oggi" style="display:inline-block;margin-top:20px;padding:10px 24px;background:#c8f135;color:#0d0f14;font-weight:800;border-radius:10px;text-decoration:none;">Torna a PronoX</a>
</body>
</html>`;
}
