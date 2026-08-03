import { NextRequest, NextResponse } from "next/server";
import { supabase as supabaseAdmin } from "../../profit-tracker/supabaseClient";

// GET /api/risultati?mese=YYYY-MM  (facoltativo: filtra per mese, altrimenti ultimi 200)
export async function GET(req: NextRequest) {
  const mese = req.nextUrl.searchParams.get("mese");

  let query = supabaseAdmin
    .from("risultati_promo")
    .select("id, giorno, book, valore_atteso, numero_promo, collaboratore_id, collaboratori(nome)")
    .order("giorno", { ascending: false });

  if (mese) {
    const start = `${mese}-01`;
    const [y, m] = mese.split("-").map(Number);
    const end = new Date(y, m, 1).toISOString().slice(0, 10); // primo del mese successivo
    query = query.gte("giorno", start).lt("giorno", end);
  } else {
    query = query.limit(200);
  }

  const { data, error } = await query;
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ risultati: data });
}

// POST /api/risultati  { giorno, book, valoreAtteso, numeroPromo, collaboratoreId? }
export async function POST(req: NextRequest) {
  const { giorno, book, valoreAtteso, numeroPromo, collaboratoreId } = await req.json();

  if (!giorno || !book || valoreAtteso == null || !numeroPromo || numeroPromo <= 0) {
    return NextResponse.json({ error: "Parametri mancanti o non validi" }, { status: 400 });
  }

  const { data, error } = await supabaseAdmin
    .from("risultati_promo")
    .insert({
      giorno,
      book,
      valore_atteso: valoreAtteso,
      numero_promo: numeroPromo,
      collaboratore_id: collaboratoreId || null,
    })
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ risultato: data });
}

// DELETE /api/risultati?id=xxx
export async function DELETE(req: NextRequest) {
  const id = req.nextUrl.searchParams.get("id");
  if (!id) return NextResponse.json({ error: "id mancante" }, { status: 400 });

  const { error } = await supabaseAdmin.from("risultati_promo").delete().eq("id", id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ ok: true });
}
