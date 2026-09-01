import { createServerClient } from "@supabase/ssr";
import { createClient } from "@supabase/supabase-js";
import { cookies } from "next/headers";
import { NextResponse } from "next/server";

export async function POST(request: Request) {
  const cookieStore = await cookies();

  // Client "utente" — serve solo per leggere chi è loggato e con che ruolo,
  // usando i cookie della sessione (stessa logica del middleware).
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

  const { data: profile } = await supabaseAuth
    .from("user_profiles")
    .select("role")
    .eq("id", session.user.id)
    .single();

  const role = profile?.role || "user";
  if (role !== "vip" && role !== "admin") {
    return NextResponse.json({ error: "Non autorizzato" }, { status: 403 });
  }

  const { id, status } = await request.json();
  const validStatuses = ["WIN", "LOSS", "ANNULLATO"];
  if (!id || !validStatuses.includes(status)) {
    return NextResponse.json({ error: "Dati non validi" }, { status: 400 });
  }

  // Solo qui, dopo aver verificato ruolo e sessione, usiamo la chiave
  // segreta (service role) per scrivere davvero — bypassa la RLS che
  // blocca giustamente la scrittura diretta dal browser.
  const supabaseAdmin = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );

  const { error } = await supabaseAdmin
    .from("pronox_daily_picks")
    .update({ status })
    .eq("id", id);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
