import { createServerClient } from "@supabase/ssr";
import { createClient } from "@supabase/supabase-js";
import { cookies } from "next/headers";
import { NextResponse } from "next/server";

async function checkAuth() {
  const cookieStore = await cookies();
  const supabaseAuth = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        get(name: string) { return cookieStore.get(name)?.value; },
        set() {},
        remove() {},
      },
    }
  );

  const { data: { session } } = await supabaseAuth.auth.getSession();
  if (!session) return { ok: false as const, status: 401, error: "Non autenticato" };

  const { data: profile } = await supabaseAuth
    .from("user_profiles")
    .select("role")
    .eq("id", session.user.id)
    .single();

  const role = profile?.role || "user";
  if (role !== "vip" && role !== "admin") {
    return { ok: false as const, status: 403, error: "Non autorizzato" };
  }
  return { ok: true as const };
}

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

// GET → lista tutti gli articoli, bozze incluse (per il pannello admin)
export async function GET() {
  const auth = await checkAuth();
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status });

  const { data, error } = await supabaseAdmin
    .from("blog_posts")
    .select("*")
    .order("created_at", { ascending: false });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ posts: data });
}

// POST → crea un nuovo articolo, oppure aggiorna uno esistente se passi "id"
export async function POST(request: Request) {
  const auth = await checkAuth();
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status });

  const body = await request.json();
  const { id, ...fields } = body;

  if (!fields.title || !fields.slug) {
    return NextResponse.json({ error: "Titolo e slug sono obbligatori" }, { status: 400 });
  }

  if (id) {
    const { error } = await supabaseAdmin.from("blog_posts").update(fields).eq("id", id);
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  } else {
    const { error } = await supabaseAdmin.from("blog_posts").insert([fields]);
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}

// DELETE ?id=... → elimina un articolo
export async function DELETE(request: Request) {
  const auth = await checkAuth();
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status });

  const { searchParams } = new URL(request.url);
  const id = searchParams.get("id");
  if (!id) return NextResponse.json({ error: "id mancante" }, { status: 400 });

  const { error } = await supabaseAdmin.from("blog_posts").delete().eq("id", id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ ok: true });
}
