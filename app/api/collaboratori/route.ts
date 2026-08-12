import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "../../../lib/supabase-admin";

// GET /api/collaboratori -> lista collaboratori attivi
export async function GET() {
  const { data, error } = await supabaseAdmin
    .from("collaboratori")
    .select("*")
    .eq("attivo", true)
    .order("nome", { ascending: true });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ collaboratori: data });
}

// POST /api/collaboratori  { nome: string }
export async function POST(req: NextRequest) {
  const { nome } = await req.json();
  if (!nome || !nome.trim()) {
    return NextResponse.json({ error: "Nome mancante" }, { status: 400 });
  }

  const { data, error } = await supabaseAdmin
    .from("collaboratori")
    .insert({ nome: nome.trim() })
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ collaboratore: data });
}

// DELETE /api/collaboratori?id=xxx -> soft delete (attivo = false)
// Non cancelliamo la riga per mantenere lo storico su movimentazioni/risultati passati.
export async function DELETE(req: NextRequest) {
  const id = req.nextUrl.searchParams.get("id");
  if (!id) return NextResponse.json({ error: "id mancante" }, { status: 400 });

  const { error } = await supabaseAdmin
    .from("collaboratori")
    .update({ attivo: false })
    .eq("id", id);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
