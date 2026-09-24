// app/api/tennis/matches/route.js
//
// Restituisce le partite di tennis del giorno con probabilità del modello e quote.
// La logica è in lib/tennisMatches.js (condivisa con la cron daily-digest).
//
// Query string: ?date=YYYY-MM-DD   ·   ?debug=raw per fixture/quote grezze da OddsPapi

import { getTennisMatches } from "../../../../lib/tennisMatches"; // adatta il path alla tua struttura cartelle

export const maxDuration = 60;

export async function GET(request) {
  const { searchParams } = new URL(request.url);
  const date = searchParams.get("date") || new Date().toISOString().split("T")[0];
  const debug = searchParams.get("debug") === "raw";
  const result = await getTennisMatches(date, { debug });
  return Response.json(result, { status: 200 });
}
