import { NextRequest, NextResponse } from "next/server";
import { supabase as supabaseAdmin } from "../../profit-tracker/supabaseClient";

// GET /api/movimentazioni?giorno=YYYY-MM-DD
// Ritorna: ogni CONTO di public.books (book + intestatario) + se è stato
// movimentato quel giorno (e da chi) + statistiche di utilizzo, calcolate
// lato server per tenere il payload leggero.
export async function GET(req: NextRequest) {
  const giorno = req.nextUrl.searchParams.get("giorno");
  if (!giorno) return NextResponse.json({ error: "giorno mancante" }, { status: 400 });

  const { data: conti, error: errConti } = await supabaseAdmin
    .from("books")
    .select("id, nome, intestatario");

  if (errConti) return NextResponse.json({ error: errConti.message }, { status: 500 });

  const { data: movs, error: errMovs } = await supabaseAdmin
    .from("movimentazioni")
    .select("book_id, giorno, collaboratore_id, collaboratori(nome)");

  if (errMovs) return NextResponse.json({ error: errMovs.message }, { status: 500 });

  const statsByBook: Record<number, { count: number; lastUsed: string | null; usedToday: string[] }> = {};
  for (const c of conti || []) statsByBook[c.id] = { count: 0, lastUsed: null, usedToday: [] };

  for (const m of movs || []) {
    const s = statsByBook[m.book_id];
    if (!s) continue;
    s.count += 1;
    if (!s.lastUsed || m.giorno > s.lastUsed) s.lastUsed = m.giorno;
    if (m.giorno === giorno) {
      // @ts-ignore - relazione annidata da Supabase
      s.usedToday.push(m.collaboratori?.nome || "?");
    }
  }

  const result = (conti || []).map((c) => ({
    id: c.id,
    nome: c.nome,
    intestatario: c.intestatario,
    utilizziTotali: statsByBook[c.id]?.count || 0,
    ultimoUtilizzo: statsByBook[c.id]?.lastUsed || null,
    usatoOggiDa: statsByBook[c.id]?.usedToday || [],
  }));

  return NextResponse.json({ giorno, clienti: result });
}

// POST /api/movimentazioni  { bookId, giorno, collaboratoreId, note? }
// Registra che un collaboratore ha movimentato un conto in un giorno.
export async function POST(req: NextRequest) {
  const { bookId, giorno, collaboratoreId, note } = await req.json();
  if (!bookId || !giorno || !collaboratoreId) {
    return NextResponse.json({ error: "Parametri mancanti" }, { status: 400 });
  }

  const { data, error } = await supabaseAdmin
    .from("movimentazioni")
    .insert({ book_id: bookId, giorno, collaboratore_id: collaboratoreId, note })
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ movimentazione: data });
}

// DELETE /api/movimentazioni?bookId=..&giorno=..&collaboratoreId=..
// Annulla una movimentazione (es. click su "toggle" per togliere la spunta)
export async function DELETE(req: NextRequest) {
  const bookId = req.nextUrl.searchParams.get("bookId");
  const giorno = req.nextUrl.searchParams.get("giorno");
  const collaboratoreId = req.nextUrl.searchParams.get("collaboratoreId");
  if (!bookId || !giorno || !collaboratoreId) {
    return NextResponse.json({ error: "Parametri mancanti" }, { status: 400 });
  }

  const { error } = await supabaseAdmin
    .from("movimentazioni")
    .delete()
    .eq("book_id", bookId)
    .eq("giorno", giorno)
    .eq("collaboratore_id", collaboratoreId);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
