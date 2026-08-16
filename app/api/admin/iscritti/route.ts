// Salva questo file come: app/api/admin/iscritti/route.ts
// (crea le cartelle "admin/iscritti" dentro app/api/ se non esistono)

import { createServerClient } from "@supabase/ssr";
import { createClient } from "@supabase/supabase-js";
import { cookies } from "next/headers";
import { NextResponse } from "next/server";

export async function GET() {
  const cookieStore = await cookies();

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

  const { data: myProfile } = await supabaseAuth
    .from("user_profiles")
    .select("role")
    .eq("id", session.user.id)
    .single();

  const role = myProfile?.role || "user";
  if (role !== "admin" && role !== "vip") {
    return NextResponse.json({ error: "Non autorizzato" }, { status: 403 });
  }

  const supabaseAdmin = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );

  const { data, error } = await supabaseAdmin
    .from("user_profiles")
    .select("id, email, full_name, role, created_at, digest_subscribed")
    .order("created_at", { ascending: false });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ iscritti: data });
}
