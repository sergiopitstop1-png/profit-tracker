import { NextRequest, NextResponse } from "next/server";
import { supabase as supabaseAdmin } from "../../profit-tracker/supabaseClient";

const BUCKET = "promo-screenshots";

// GET /api/screenshots?giorno=YYYY-MM-DD -> lista con URL firmati (1h)
export async function GET(req: NextRequest) {
  const giorno = req.nextUrl.searchParams.get("giorno");
  if (!giorno) return NextResponse.json({ error: "giorno mancante" }, { status: 400 });

  const { data, error } = await supabaseAdmin
    .from("promo_screenshots")
    .select("id, storage_path, label, collaboratore_id, collaboratori(nome)")
    .eq("giorno", giorno)
    .order("created_at", { ascending: true });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const withUrls = await Promise.all(
    (data || []).map(async (row) => {
      const { data: signed } = await supabaseAdmin.storage
        .from(BUCKET)
        .createSignedUrl(row.storage_path, 3600);
      return { ...row, url: signed?.signedUrl || null };
    })
  );

  return NextResponse.json({ giorno, screenshots: withUrls });
}

// POST /api/screenshots  (multipart/form-data: file, giorno, label?, collaboratoreId?)
export async function POST(req: NextRequest) {
  const form = await req.formData();
  const file = form.get("file") as File | null;
  const giorno = form.get("giorno") as string | null;
  const label = (form.get("label") as string | null) || null;
  const collaboratoreId = (form.get("collaboratoreId") as string | null) || null;

  if (!file || !giorno) {
    return NextResponse.json({ error: "file o giorno mancante" }, { status: 400 });
  }

  const ext = file.name.split(".").pop() || "jpg";
  const path = `${giorno}/${crypto.randomUUID()}.${ext}`;
  const buffer = Buffer.from(await file.arrayBuffer());

  const { error: uploadError } = await supabaseAdmin.storage
    .from(BUCKET)
    .upload(path, buffer, { contentType: file.type, upsert: false });

  if (uploadError) return NextResponse.json({ error: uploadError.message }, { status: 500 });

  const { data, error } = await supabaseAdmin
    .from("promo_screenshots")
    .insert({ giorno, storage_path: path, label, collaboratore_id: collaboratoreId })
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ screenshot: data });
}

// DELETE /api/screenshots?id=xxx -> rimuove riga + file fisico
export async function DELETE(req: NextRequest) {
  const id = req.nextUrl.searchParams.get("id");
  if (!id) return NextResponse.json({ error: "id mancante" }, { status: 400 });

  const { data: row, error: fetchErr } = await supabaseAdmin
    .from("promo_screenshots")
    .select("storage_path")
    .eq("id", id)
    .single();

  if (fetchErr) return NextResponse.json({ error: fetchErr.message }, { status: 500 });

  await supabaseAdmin.storage.from(BUCKET).remove([row.storage_path]);

  const { error } = await supabaseAdmin.from("promo_screenshots").delete().eq("id", id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ ok: true });
}
