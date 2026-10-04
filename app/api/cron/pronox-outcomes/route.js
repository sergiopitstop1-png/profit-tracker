// =====================================================================
// PronoX · Cron esiti delle fotografie (04/10/2026)
// Per ogni esito fotografato in prediction_snapshots, quando la partita
// è finita scrive in selection_outcomes se è vinto (true), perso (false)
// o nullo (null: partita rinviata, annullata o sospesa).
// Il verdetto usa le stesse regole del catalogo mercati di footballModel,
// sul risultato dei 90 minuti (supplementari e rigori esclusi).
//
// Novità 04/10: salva anche il punteggio (1° tempo e 90 minuti) in
// pronox_risultati, una riga per partita. Le partite con gli esiti già
// scritti ma senza punteggio vengono ripassate, così si completano da sole.
// Nessuna riga già scritta viene sovrascritta (né esiti né punteggi).
//
// Esecuzione manuale (test): /api/cron/pronox-outcomes
// =====================================================================

import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { FOOTBALL_MARKETS } from "../../../../lib/pronox/footballModel";

export const dynamic = "force-dynamic";
export const maxDuration = 300;

const FD_BASE = "https://api.football-data.org/v4";
const GIORNI_INDIETRO = 7;            // finestra di partite da controllare
const ATTESA_FINE_MS = 150 * 60000;   // 2h30 dopo il fischio d'inizio
const NULLA_DOPO_MS = 48 * 3600000;   // rinviate/annullate: nulle dopo 48 ore
const STATI_NULLI = ["POSTPONED", "CANCELLED", "SUSPENDED", "AWARDED"];

// regole per mercato|esito (le fotografie usano BTTS yes/no, il catalogo si/no)
const REGOLE = new Map(FOOTBALL_MARKETS.map((m) => [m.id, m.test]));
REGOLE.set("BTTS|yes", REGOLE.get("BTTS|si"));

function giorno(ts) {
  return new Date(ts).toISOString().split("T")[0];
}

function intero(v) {
  return Number.isInteger(v) ? v : null;
}

// Gol nei 90 minuti. Se la partita è andata ai supplementari/rigori
// usa regularTime; se manca, non si può decidere (si riprova dopo).
function gol90(match) {
  const s = match.score || {};
  if (s.duration && s.duration !== "REGULAR") {
    const r = s.regularTime;
    if (r && Number.isInteger(r.home) && Number.isInteger(r.away)) return { h: r.home, a: r.away };
    return null;
  }
  const f = s.fullTime;
  if (f && Number.isInteger(f.home) && Number.isInteger(f.away)) return { h: f.home, a: f.away };
  return null;
}

// Riga per pronox_risultati (punteggi null se la partita non si è giocata)
function rigaRisultato(id, ev, m, g, scritto_at) {
  const ht = m.score?.halfTime || {};
  return {
    event_id: id,
    competition: m.competition?.code ?? null,
    event_start: ev.start,
    home_team: m.homeTeam?.name ?? null,
    away_team: m.awayTeam?.name ?? null,
    stato: m.status ?? null,
    durata: m.score?.duration ?? null,
    ht_casa: g ? intero(ht.home) : null,
    ht_ospite: g ? intero(ht.away) : null,
    ft_casa: g ? g.h : null,
    ft_ospite: g ? g.a : null,
    scritto_at,
  };
}

export async function GET(request) {
  const secret = process.env.CRON_SECRET;
  if (secret && request.headers.get("authorization") !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "non autorizzato" }, { status: 401 });
  }

  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY,
    { auth: { persistSession: false } }
  );

  const report = {
    partite_da_controllare: 0, partite_finite: 0, partite_nulle: 0,
    partite_in_attesa: 0, esiti_scritti: 0, risultati_scritti: 0,
    esiti_sconosciuti: [], errors: [],
  };

  try {
    const ora = Date.now();
    const da = new Date(ora - GIORNI_INDIETRO * 86400000).toISOString();
    const a = new Date(ora - ATTESA_FINE_MS).toISOString();

    // 1. Esiti fotografati nella finestra (paginati)
    const fotografati = new Map(); // event_id -> { start, chiavi:Set("market|selection"), serveRisultato }
    for (let from = 0; ; from += 1000) {
      const { data, error } = await supabase
        .from("prediction_snapshots")
        .select("event_id, market, selection, event_start")
        .gte("event_start", da)
        .lte("event_start", a)
        .order("id", { ascending: true })
        .range(from, from + 999);
      if (error) throw new Error(`snapshots: ${error.message}`);
      for (const r of data || []) {
        if (!fotografati.has(r.event_id)) fotografati.set(r.event_id, { start: r.event_start, chiavi: new Set(), serveRisultato: true });
        fotografati.get(r.event_id).chiavi.add(`${r.market}|${r.selection}`);
      }
      if (!data || data.length < 1000) break;
    }
    if (fotografati.size === 0) return NextResponse.json({ ...report, note: "nessuna partita da controllare" });

    // 2. Esiti e risultati già scritti: si salta ciò che è già deciso
    const ids = [...fotografati.keys()];
    const giaScritti = new Set();
    const risultatiScritti = new Set();
    for (let i = 0; i < ids.length; i += 100) {
      const blocco = ids.slice(i, i + 100);
      const { data, error } = await supabase
        .from("selection_outcomes")
        .select("event_id, market, selection")
        .in("event_id", blocco);
      if (error) throw new Error(`outcomes: ${error.message}`);
      for (const r of data || []) giaScritti.add(`${r.event_id}|${r.market}|${r.selection}`);

      const { data: ris, error: errRis } = await supabase
        .from("pronox_risultati")
        .select("event_id")
        .in("event_id", blocco);
      if (errRis) throw new Error(`risultati: ${errRis.message}`);
      for (const r of ris || []) risultatiScritti.add(r.event_id);
    }
    for (const [id, ev] of fotografati) {
      for (const k of ev.chiavi) if (giaScritti.has(`${id}|${k}`)) ev.chiavi.delete(k);
      ev.serveRisultato = !risultatiScritti.has(id);
      if (ev.chiavi.size === 0 && !ev.serveRisultato) fotografati.delete(id);
    }
    report.partite_da_controllare = fotografati.size;
    if (fotografati.size === 0) return NextResponse.json({ ...report, note: "tutto già aggiornato" });

    // 3. Risultati da football-data con una sola chiamata (dateTo è esclusivo)
    const starts = [...fotografati.values()].map((e) => new Date(e.start).getTime());
    const dal = giorno(Math.min(...starts));
    const al = giorno(Math.max(...starts) + 86400000);
    const r = await fetch(`${FD_BASE}/matches?dateFrom=${dal}&dateTo=${al}`, {
      headers: { "X-Auth-Token": process.env.FOOTBALL_DATA_KEY },
      cache: "no-store",
    });
    if (!r.ok) throw new Error(`football-data ${r.status}`);
    const partite = new Map(((await r.json()).matches || []).map((m) => [`fd_${m.id}`, m]));

    // 4. Verdetti e punteggi
    const righe = [];
    const risultati = [];
    const settled_at = new Date().toISOString();
    for (const [id, ev] of fotografati) {
      const m = partite.get(id);
      const vecchia = ora - new Date(ev.start).getTime() > NULLA_DOPO_MS;
      if (!m) { report.partite_in_attesa++; continue; }

      if (STATI_NULLI.includes(m.status)) {
        if (!vecchia) { report.partite_in_attesa++; continue; } // può ancora essere recuperata
        for (const k of ev.chiavi) {
          const [market, selection] = k.split("|");
          righe.push({ event_id: id, market, selection, won: null, settled_at });
        }
        if (ev.serveRisultato) risultati.push(rigaRisultato(id, ev, m, null, settled_at));
        report.partite_nulle++;
        continue;
      }
      if (m.status !== "FINISHED") { report.partite_in_attesa++; continue; }

      const g = gol90(m);
      if (!g) { report.partite_in_attesa++; continue; }
      report.partite_finite++;
      if (ev.serveRisultato) risultati.push(rigaRisultato(id, ev, m, g, settled_at));
      for (const k of ev.chiavi) {
        const regola = REGOLE.get(k);
        if (!regola) {
          if (!report.esiti_sconosciuti.includes(k)) report.esiti_sconosciuti.push(k);
          continue;
        }
        const [market, selection] = k.split("|");
        righe.push({ event_id: id, market, selection, won: !!regola(g.h, g.a), settled_at });
      }
    }

    // 5. Scrittura esiti (un esito già deciso non viene riscritto)
    for (let i = 0; i < righe.length; i += 500) {
      const { data, error } = await supabase
        .from("selection_outcomes")
        .upsert(righe.slice(i, i + 500), { onConflict: "event_id,market,selection", ignoreDuplicates: true })
        .select("event_id");
      if (error) report.errors.push(`insert: ${error.message}`);
      else report.esiti_scritti += data?.length || 0;
    }

    // 6. Scrittura punteggi (un risultato già scritto non viene riscritto)
    for (let i = 0; i < risultati.length; i += 500) {
      const { data, error } = await supabase
        .from("pronox_risultati")
        .upsert(risultati.slice(i, i + 500), { onConflict: "event_id", ignoreDuplicates: true })
        .select("event_id");
      if (error) report.errors.push(`risultati: ${error.message}`);
      else report.risultati_scritti += data?.length || 0;
    }
  } catch (e) {
    report.errors.push(String(e?.message || e));
    return NextResponse.json(report, { status: 500 });
  }
  return NextResponse.json(report);
}
