// =====================================================================
// PronoX · Cron segnali TENNIS (07/10/2026)  →  app/api/cron/pronox-tennis/route.js
// Come per il calcio, registra da solo ogni segnale tennis in pronox_tennis_segnali:
// solo VALUE e pronostici "X vince" (mai i "sospetti"), una volta sola e senza modifiche.
// Usa lo stesso calcolo di /oggi e di daily-digest: getTennisMatches (lib/tennisMatches.js), chiamato
// direttamente (niente richiesta di rete). Le quote OddsPapi hanno una cache di 20 minuti: la corsa che
// parte subito dopo daily-digest (14:10 UTC, date=domani) riusa quella cache e non consuma richieste.
// Le partite già iniziate si saltano (le quote non sarebbero più quelle del prepartita).
//
// Prova a mano:  curl.exe -H "Authorization: Bearer IL_TUO_CRON_SECRET" "https://sergioapicella.it/api/cron/pronox-tennis?date=oggi"
// date: oggi | domani | AAAA-MM-GG (data UTC, come in /oggi)
// =====================================================================
import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { getTennisMatches } from "../../../../lib/tennisMatches";

export const dynamic = "force-dynamic";
export const maxDuration = 120;

const isoUTC = (d) => d.toISOString().split("T")[0];
function risolviData(p) {
  const v = (p || "").toLowerCase();
  if (!v || v === "oggi" || v === "today") return isoUTC(new Date());
  if (v === "domani" || v === "tomorrow") return isoUTC(new Date(Date.now() + 86400000));
  return p;
}
const arrotonda = (x) => (x == null || !Number.isFinite(Number(x)) ? null : Math.round(Number(x) * 10000) / 10000);
const num = (x) => (x && Number.isFinite(Number(x)) && Number(x) > 1 ? Number(x) : null);

export async function GET(request) {
  const secret = process.env.CRON_SECRET;
  if (secret && request.headers.get("authorization") !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "non autorizzato" }, { status: 401 });
  }
  const url = new URL(request.url);
  const date = risolviData(url.searchParams.get("date"));
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return NextResponse.json({ error: "data non valida" }, { status: 400 });

  const report = { date, partite: 0, segnali: 0, gia_iniziate: 0, nuovi: 0, gia_presenti: 0, errors: [], debug: {} };
  try {
    // 1. Stesso calcolo di /oggi e di daily-digest
    const d = await getTennisMatches(date);
    if (d?.error) {
      report.errors.push(`${d.error}${d.details ? ` (${String(d.details).slice(0, 200)})` : ""}`);
      return NextResponse.json(report, { status: 502 });
    }
    report.debug.dalla_cache = !!d.fromCache;
    const partite = Array.isArray(d?.matches) ? d.matches : [];
    report.partite = partite.length;

    // 2. Stessa regola di /oggi per i segnali
    const adesso = Date.now();
    const righe = [];
    for (const m of partite) {
      if (!m?.playerA?.name || !m?.playerB?.name) continue;
      const inizio = m.commenceTime ? new Date(m.commenceTime).getTime() : null;
      if (inizio && inizio <= adesso) { report.gia_iniziate++; continue; }
      const sig = [];
      if (m.isValueA) sig.push({ lato: "A", tipo: "VALUE" });
      if (m.isValueB) sig.push({ lato: "B", tipo: "VALUE" });
      if (!sig.length && !m.lowDataPlayer && !m.suspiciousA && !m.suspiciousB) {
        sig.push({ lato: m.probA >= m.probB ? "A" : "B", tipo: "PRONOSTICO" });
      }
      for (const s of sig) {
        const a = s.lato === "A";
        righe.push({
          data_partita: date,
          inizio: m.commenceTime || null,
          ora: m.commenceTime ? new Date(m.commenceTime).toLocaleTimeString("it-IT", { timeZone: "Europe/Rome", hour: "2-digit", minute: "2-digit" }) : null,
          torneo: m.tournament || null,
          circuito: m.tour || null,
          giocatore_a: m.playerA.name,
          giocatore_b: m.playerB.name,
          selezione: a ? m.playerA.name : m.playerB.name,
          tipo: s.tipo,
          prob: arrotonda(a ? m.probA : m.probB),
          quota: num(a ? m.oddsA : m.oddsB),
          quota_a: num(m.oddsA),
          quota_b: num(m.oddsB),
          ev: s.tipo === "VALUE" ? arrotonda(a ? m.evA : m.evB) : null,
          esito_manuale: false,
        });
      }
    }
    report.segnali = righe.length;

    // 3. Scrittura (il primo salvataggio non si riscrive)
    const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } });
    for (let i = 0; i < righe.length; i += 200) {
      const { data, error } = await supabase
        .from("pronox_tennis_segnali")
        .upsert(righe.slice(i, i + 200), { onConflict: "data_partita,giocatore_a,giocatore_b,selezione", ignoreDuplicates: true })
        .select("id");
      if (error) report.errors.push(`insert: ${error.message}`);
      else report.nuovi += data?.length || 0;
    }
    report.gia_presenti = righe.length - report.nuovi;
  } catch (e) {
    report.errors.push(String(e?.message || e));
    return NextResponse.json(report, { status: 500 });
  }
  return NextResponse.json(report);
}
