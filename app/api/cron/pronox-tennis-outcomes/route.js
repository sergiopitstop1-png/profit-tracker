// =====================================================================
// PronoX · Cron risultati TENNIS da Betfair (07/10/2026)
// Legge da Supabase (betfair_mercati + betfair_quote_ultime, riempite dal servizio
// betfair_quote.py sul PC con tennis = 1) chi ha vinto ogni partita e aggiorna
// pronox_tennis_segnali: vincitore ed esito (VINTA / PERSA / NULLA).
//  • NON consuma crediti di nessuna API: legge solo il database;
//  • non tocca mai i segnali corretti a mano (esito_manuale = true) né quelli già decisi;
//  • il punteggio non arriva da Betfair: resta da scrivere a mano (facoltativo).
// Betfair cancella i mercati dopo 48 ore: va lanciato almeno una volta al giorno (meglio 2).
// Esecuzione manuale (test): /api/cron/pronox-tennis-outcomes
// Variabili: CRON_SECRET, NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, PT_USER_ID
// =====================================================================

import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export const dynamic = "force-dynamic";
export const maxDuration = 120;

const GIORNI_INDIETRO = 5;
const ATTESA_MS = 30 * 60000;          // non guarda partite iniziate da meno di 30 minuti
const TOLLERANZA_ORE = 30;             // differenza massima tra inizio del segnale e inizio del mercato Betfair

// nome → parole utili (senza accenti, niente iniziali di 1-2 lettere)
const parole = (s) =>
  String(s || "")
    .normalize("NFD").replace(/[̀-ͯ]/g, "")
    .toLowerCase().replace(/[^a-z\s-]/g, " ").replace(/-/g, " ")
    .split(/\s+/).filter((t) => t.length >= 3);

const comuni = (a, b) => {
  const set = new Set(b);
  return a.filter((t) => set.has(t)).length;
};

export async function GET(request) {
  const secret = process.env.CRON_SECRET;
  if (secret && request.headers.get("authorization") !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "non autorizzato" }, { status: 401 });
  }
  const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } });
  const utente = process.env.PT_USER_ID;
  const report = { segnali_da_controllare: 0, mercati_tennis: 0, aggiornati: 0, in_attesa: 0, senza_mercato: 0, errors: [] };

  try {
    const ora = Date.now();
    const dal = new Date(ora - GIORNI_INDIETRO * 86400000).toISOString().split("T")[0];

    // 1. Segnali ancora senza esito e non corretti a mano
    const { data: segnali, error: e1 } = await supabase
      .from("pronox_tennis_segnali")
      .select("id, data_partita, inizio, giocatore_a, giocatore_b, selezione, esito, vincitore, esito_manuale")
      .gte("data_partita", dal)
      .is("esito", null)
      .or("esito_manuale.is.null,esito_manuale.eq.false")
      .limit(500);
    if (e1) throw new Error(`segnali: ${e1.message}`);
    const da = (segnali || []).filter((s) => !s.vincitore && (!s.inizio || ora - new Date(s.inizio).getTime() > ATTESA_MS));
    report.segnali_da_controllare = da.length;
    if (!da.length) return NextResponse.json({ ...report, note: "nessun segnale da aggiornare" });

    // 2. Mercati tennis di Betfair (MATCH_ODDS) degli ultimi giorni
    const mercati = [];
    for (let from = 0; ; from += 1000) {
      let q = supabase.from("betfair_mercati")
        .select("market_id, casa, ospite, inizio")
        .eq("sport", "tennis").eq("tipo", "MATCH_ODDS")
        .gte("inizio", new Date(ora - 4 * 86400000).toISOString())
        .lte("inizio", new Date(ora).toISOString())
        .order("market_id").range(from, from + 999);
      if (utente) q = q.eq("user_id", utente);
      const { data, error } = await q;
      if (error) throw new Error(`mercati: ${error.message}`);
      mercati.push(...(data || []));
      if (!data || data.length < 1000) break;
    }
    report.mercati_tennis = mercati.length;

    // 3. Selezioni dei mercati (nome, stato_sel, stato)
    const sel = new Map(); // market_id -> [{nome, stato_sel, stato}]
    for (let i = 0; i < mercati.length; i += 40) {
      const ids = mercati.slice(i, i + 40).map((m) => m.market_id);
      let q = supabase.from("betfair_quote_ultime").select("market_id, nome, stato, stato_sel").in("market_id", ids).limit(1000);
      if (utente) q = q.eq("user_id", utente);
      const { data, error } = await q;
      if (error) throw new Error(`selezioni: ${error.message}`);
      for (const r of data || []) {
        if (!sel.has(r.market_id)) sel.set(r.market_id, []);
        sel.get(r.market_id).push(r);
      }
    }

    // 4. Abbinamento segnale ↔ mercato per cognome + orario
    const aggiornati = [];
    for (const s of da) {
      const pa = parole(s.giocatore_a), pb = parole(s.giocatore_b);
      const t0 = s.inizio ? new Date(s.inizio).getTime() : new Date(`${s.data_partita}T12:00:00Z`).getTime();
      const tol = (s.inizio ? TOLLERANZA_ORE : 40) * 3600000;
      let migliore = null;
      for (const m of mercati) {
        const righe = sel.get(m.market_id) || [];
        if (righe.length < 2) continue;
        if (Math.abs(new Date(m.inizio).getTime() - t0) > tol) continue;
        // ogni giocatore deve corrispondere a una selezione diversa
        const sa = righe.map((r) => comuni(pa, parole(r.nome)));
        const sb = righe.map((r) => comuni(pb, parole(r.nome)));
        const ia = sa.indexOf(Math.max(...sa)), ib = sb.indexOf(Math.max(...sb));
        if (sa[ia] === 0 || sb[ib] === 0 || ia === ib) continue;
        const dist = Math.abs(new Date(m.inizio).getTime() - t0);
        if (!migliore || dist < migliore.dist) migliore = { m, righe, ia, ib, dist };
      }
      if (!migliore) { report.senza_mercato++; continue; }
      const { righe, ia, ib } = migliore;
      const vincente = righe.findIndex((r) => r.stato_sel === "WINNER");
      let vincitore = null, esito = null;
      if (vincente === ia) vincitore = s.giocatore_a;
      else if (vincente === ib) vincitore = s.giocatore_b;
      if (vincitore) esito = vincitore === s.selezione ? "VINTA" : "PERSA";
      else if (righe.every((r) => r.stato === "CLOSED") && vincente === -1) { vincitore = "NULLA"; esito = "NULLA"; } // chiuso senza vincitore: ritiro / annullata
      else if (vincente >= 0) { esito = null; } // vincitore diverso dai due giocatori: non tocco
      if (!esito) { report.in_attesa++; continue; }
      aggiornati.push({ id: s.id, vincitore, esito });
    }

    // 5. Scrittura (solo su righe ancora non decise e non corrette a mano)
    for (const a of aggiornati) {
      const { data, error } = await supabase
        .from("pronox_tennis_segnali")
        .update({ vincitore: a.vincitore, esito: a.esito, aggiornato: new Date().toISOString() })
        .eq("id", a.id).is("esito", null).or("esito_manuale.is.null,esito_manuale.eq.false")
        .select("id");
      if (error) report.errors.push(`update ${a.id}: ${error.message}`);
      else report.aggiornati += data?.length || 0;
    }
  } catch (e) {
    report.errors.push(String(e?.message || e));
    return NextResponse.json(report, { status: 500 });
  }
  return NextResponse.json(report);
}
