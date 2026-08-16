// Salva questo file come: app/api/pronox/account/delete/route.ts
// (crea le cartelle "account/delete" dentro app/api/pronox/ se non esistono)

import { createServerClient } from "@supabase/ssr";
import { createClient } from "@supabase/supabase-js";
import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { notifyAdmin } from "@/lib/notifyAdmin"; // alias assoluto: se il tuo progetto non ha "@/*" configurato in tsconfig.json, vedi nota sotto

export async function POST() {
  const cookieStore = await cookies();

  // Stessa logica delle altre route protette: leggiamo chi è loggato dai
  // cookie di sessione, prima di fare qualunque cosa distruttiva.
  const supabaseAuth = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        get(name: string) {
          return cookieStore.get(name)?.value;
        },
        set() {},
        remove() {},
      },
    }
  );

  const { data: { session } } = await supabaseAuth.auth.getSession();
  if (!session) {
    return NextResponse.json({ error: "Non autenticato" }, { status: 401 });
  }

  const userId = session.user.id;
  const userEmail = session.user.email || "email sconosciuta";

  const supabaseAdmin = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );

  // L'utente cancella SOLO il proprio account — usiamo l'id preso dalla
  // sessione, non un id passato dal client, così nessuno può cancellare
  // l'account di qualcun altro modificando la richiesta.
  const { error: authDeleteError } = await supabaseAdmin.auth.admin.deleteUser(userId);
  if (authDeleteError) {
    console.error(`[account/delete] ERRORE cancellazione utente Auth (id=${userId}):`, authDeleteError.message);
  }
  const { error } = await supabaseAdmin.from("user_profiles").delete().eq("id", userId);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  await notifyAdmin("cancellazione", userEmail);

  return NextResponse.json({ ok: true });
}
