"use client";

import React, { useState, useEffect, useCallback, useMemo, useRef } from "react";
import { Plus, Trash2, RotateCcw, AlertTriangle, LayoutGrid, X, Wand2, Loader2, Link2 } from "lucide-react";
import { supabase } from "../profit-tracker/supabaseClient";

const INK = "#12140f";
const PANEL = "#1a1d16";
const LINE = "#2c2f26";
const CREAM = "#ece7d8";
const MUTED = "#8f9282";
const GREEN = "#4d9b6f";
const RUST = "#b8593d";
const GOLD = "#c9a24a";
const AMBER = "#c98a3e";

const fmt = (n, d = 2) =>
  Number.isFinite(n) ? n.toLocaleString("it-IT", { minimumFractionDigits: d, maximumFractionDigits: d }) : "—";

// --- debounce per gli input testuali/numerici, per non scrivere su Supabase a ogni carattere ---
function useDebouncedCallback(callback, delay = 500) {
  const timers = useRef({});
  return useCallback(
    (key, ...args) => {
      if (timers.current[key]) clearTimeout(timers.current[key]);
      timers.current[key] = setTimeout(() => callback(...args), delay);
    },
    [callback, delay]
  );
}

// ════════════════════════════════════════════════════════════════════
// MOTORE MASANIELLO (standard, quote variabili, eventi contemporanei)
// V(i,k) = frazione dell'obiettivo che serve avere prima dell'evento i con ancora k vincite da fare:
//   V(i,0) = 1   ·   V(i,k) = 0 se k > eventi rimasti   ·   V(i,k) = [V(i+1,k-1) + (q_i-1)·V(i+1,k)] / q_i
// Obiettivo = capitale attuale / V(stato). Puntata di un gruppo di m eventi contemporanei:
//   totale S = X · (1 − V(i+m,k) / V(i,k))  → se li perdi tutti sei esattamente sul piano classico
//   ripartito a vincita uguale: s_j = P / q_j con P = S / Σ(1/q_j)  (m = 1 → formula classica)
// Puntate arrotondate all'euro; il capitale reale si aggiorna con le puntate arrotondate.
// ════════════════════════════════════════════════════════════════════
const parseQ = (v) => { const n = parseFloat(String(v ?? '').replace(',', '.')); return Number.isFinite(n) && n > 1 ? n : null };

function computeMasaniello(plan) {
  const C = Number(plan.capitale) || 0;
  const N = Math.round(Number(plan.planN) || 0);
  const K = Math.round(Number(plan.planK) || 0);
  if (C <= 0 || N <= 0 || K <= 0 || K > N) return null;
  const events = plan.events || [];
  const qEntered = events.map(e => parseQ(e.quota)).filter(Boolean);
  const qRif = parseQ(plan.bulkQuota) || (qEntered.length ? qEntered.reduce((a, b) => a + b, 0) / qEntered.length : 2);
  // quota di ogni "casella" del piano: quella dell'evento se c'è, altrimenti la quota di riferimento
  const q = Array.from({ length: N }, (_, i) => (events[i] && parseQ(events[i].quota)) || qRif);

  const memo = new Map();
  const V = (i, k) => {
    if (k <= 0) return 1;
    if (N - i < k) return 0;
    const key = i * 1000 + k;
    if (memo.has(key)) return memo.get(key);
    const v = (V(i + 1, k - 1) + (q[i] - 1) * V(i + 1, k)) / q[i];
    memo.set(key, v);
    return v;
  };

  const obiettivoIniziale = C / V(0, K);
  // gruppi: un evento con "contemporanea" = true sta nello stesso gruppo del precedente
  const groups = [];
  events.slice(0, N).forEach((e, idx) => {
    if (idx > 0 && e.contemporanea && groups.length) groups[groups.length - 1].push(idx);
    else groups.push([idx]);
  });

  let X = C, i = 0, k = K, vinte = 0, perse = 0;
  const rows = events.map((e, idx) => ({ id: e.id, idx, stake: null, capitaleDopo: null, gruppo: null, stato: idx >= N ? 'fuori' : 'futuro' }));
  let prossime = null; // gruppo da giocare adesso
  let stato = 'in corso';

  for (let g = 0; g < groups.length; g++) {
    const idxs = groups[g];
    const m = idxs.length;
    idxs.forEach(ix => { rows[ix].gruppo = g; });
    if (k <= 0) { stato = 'obiettivo'; idxs.forEach(ix => { rows[ix].stake = 0; rows[ix].stato = 'chiuso' }); continue; }
    const v0 = V(i, k);
    if (v0 <= 0) { stato = 'fallito'; idxs.forEach(ix => { rows[ix].stake = 0; rows[ix].stato = 'chiuso' }); continue; }
    const S = Math.max(0, X * (1 - V(i + m, k) / v0));
    const sumInv = idxs.reduce((a, ix) => a + 1 / q[ix], 0);
    const P = S / sumInv;
    let stakes = idxs.map(ix => Math.max(0, Math.round(P / q[ix])));
    // mai più del capitale disponibile
    let tot = stakes.reduce((a, b) => a + b, 0);
    while (tot > Math.floor(X) && tot > 0) { const j = stakes.indexOf(Math.max(...stakes)); stakes[j] -= 1; tot -= 1 }
    idxs.forEach((ix, j) => { rows[ix].stake = stakes[j] });

    const esiti = idxs.map(ix => events[ix].esito);
    if (esiti.some(es => es === 'attesa' || !es)) {
      if (!prossime) prossime = { gruppo: g, eventi: idxs, totale: tot, capitale: X, obiettivo: X / v0 };
      idxs.forEach(ix => { rows[ix].stato = events[ix].esito === 'attesa' || !events[ix].esito ? 'da giocare' : 'giocato' });
      // gli eventi successivi dipendono dall'esito: non si possono calcolare adesso
      for (let r = g + 1; r < groups.length; r++) groups[r].forEach(ix => { rows[ix].gruppo = r });
      break;
    }
    idxs.forEach((ix, j) => {
      const win = events[ix].esito === 'vinta';
      X += win ? stakes[j] * (q[ix] - 1) : -stakes[j];
      if (win) { vinte++; k-- } else perse++;
      rows[ix].stato = 'giocato';
    });
    X = Math.round(X * 100) / 100;
    idxs.forEach(ix => { rows[ix].capitaleDopo = X });
    i += m;
  }
  if (!prossime && stato === 'in corso') {
    if (k <= 0) stato = 'obiettivo';
    else if (V(i, k) <= 0) stato = 'fallito';
    else if (i >= Math.min(N, events.length)) stato = 'mancano eventi';
  }
  const vAttuale = k <= 0 ? 1 : V(i, k);
  return {
    N, K, qRif, obiettivoIniziale, capitaleAttuale: X, vinte, perse, giocati: vinte + perse,
    vincitaMancanti: Math.max(0, k), obiettivoAttuale: vAttuale > 0 ? X / vAttuale : null,
    profitto: X - C, rows, prossime, stato, eventiOltreN: Math.max(0, events.length - N),
  };
}

function computePlanStats(planN, planK, curWins, curLosses, alertMargin, extQuota, extTarget) {
  const N = planN, K = planK;
  if (!N || !K || K <= 0 || K > N) return null;
  const maxLosses = N - K;
  const lossesResidue = maxLosses - curLosses;
  const triggered = lossesResidue <= alertMargin;
  const exceeded = lossesResidue < 0;
  const winRateNeededPct = (K / N) * 100;
  const played = curWins + curLosses;
  const h = played > 0 ? curWins / played : null;

  let extension = null;
  if (triggered && h != null && h > 0 && extQuota > 1) {
    const t = extTarget / 100;
    const q = parseFloat(extQuota);
    const denom = h - (1 + t) / q;
    if (denom > 0.0005) {
      const remaining = N - curWins - curLosses;
      const numerator = h * remaining + curWins - (N * (1 + t)) / q;
      let M = Math.ceil(Math.max(0, numerator / denom));
      const Ntot = N + M;
      const Vmin = Math.ceil((Ntot * (1 + t)) / q);
      const maxLossesNew = Ntot - Vmin;
      const marginNew = maxLossesNew - curLosses;
      extension = { possible: true, M, Ntot, Vmin, maxLossesNew, marginNew, h };
    } else {
      extension = { possible: false, h };
    }
  }
  return { N, K, maxLosses, lossesResidue, triggered, exceeded, winRateNeededPct, h, extension, played };
}

// --- mapping riga DB <-> stato locale ---
const planFromRow = (row, events) => ({
  id: row.id,
  name: row.name,
  capitale: row.capitale,
  planN: row.plan_n,
  planK: row.plan_k,
  curWins: row.cur_wins,
  curLosses: row.cur_losses,
  alertMargin: row.alert_margin,
  extQuota: row.ext_quota,
  extTarget: row.ext_target,
  bulkN: row.bulk_n,
  bulkQuota: row.bulk_quota,
  events: events
    .filter((e) => e.plan_id === row.id)
    .sort((a, b) => a.position - b.position)
    .map((e) => ({ id: e.id, label: e.label, quota: e.quota == null ? "" : String(e.quota), esito: e.esito, contemporanea: !!e.contemporanea })),
});

const patchToRow = (patch) => {
  const map = {
    name: "name", capitale: "capitale", planN: "plan_n", planK: "plan_k",
    curWins: "cur_wins", curLosses: "cur_losses", alertMargin: "alert_margin",
    extQuota: "ext_quota", extTarget: "ext_target", bulkN: "bulk_n", bulkQuota: "bulk_quota",
  };
  const row = {};
  for (const key of Object.keys(patch)) {
    if (map[key]) row[map[key]] = patch[key];
  }
  return row;
};

function NumField({ label, value, onChange, step = 1, min = 0, width = 90 }) {
  return (
    <div>
      <label style={{ display: "block", fontFamily: "system-ui, sans-serif", fontSize: 11, color: MUTED, marginBottom: 4, textTransform: "uppercase", letterSpacing: 0.4 }}>
        {label}
      </label>
      <input
        type="number"
        value={value}
        step={step}
        min={min}
        onChange={(e) => onChange(parseFloat(e.target.value) || 0)}
        style={{ background: PANEL, border: `1px solid ${LINE}`, borderRadius: 4, color: CREAM, fontFamily: "system-ui, sans-serif", fontSize: 14, padding: "6px 8px", width, outline: "none" }}
      />
    </div>
  );
}

function SummaryCard({ label, value, sub, accent }) {
  return (
    <div style={{ background: PANEL, borderRadius: 8, padding: "12px 14px", border: `1px solid ${LINE}` }}>
      <p style={{ fontFamily: "system-ui, sans-serif", fontSize: 11, color: MUTED, margin: "0 0 6px", textTransform: "uppercase", letterSpacing: 0.4 }}>
        {label}
      </p>
      <p style={{ fontFamily: "Georgia, serif", fontSize: 20, margin: 0, color: accent || CREAM }}>{value}</p>
      {sub && <p style={{ fontFamily: "system-ui, sans-serif", fontSize: 11, color: MUTED, margin: "4px 0 0" }}>{sub}</p>}
    </div>
  );
}

const STATO_LABEL = {
  "in corso": { t: "in corso", c: CREAM },
  obiettivo: { t: "obiettivo raggiunto", c: GREEN },
  fallito: { t: "piano fallito", c: RUST },
  "mancano eventi": { t: "aggiungi eventi", c: AMBER },
};

function statsFor(plan, m) {
  return computePlanStats(plan.planN, plan.planK, m ? m.vinte : 0, m ? m.perse : 0, plan.alertMargin, plan.extQuota, plan.extTarget);
}

function Dashboard({ plans, onOpen }) {
  const rows = plans.map((p) => {
    const m = computeMasaniello(p);
    return { plan: p, m, stats: statsFor(p, m) };
  });
  const capitaleTot = plans.reduce((a, p) => a + (parseFloat(p.capitale) || 0), 0);
  const profittoTot = rows.reduce((a, r) => a + (r.m ? r.m.profitto : 0), 0);
  const inAllerta = rows.filter((r) => r.stats && r.stats.triggered).length;
  const cols = "1.4fr 0.8fr 0.8fr 1fr 1fr 0.9fr 0.7fr";

  return (
    <div>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(150px, 1fr))", gap: 10, marginBottom: 24 }}>
        <SummaryCard label="Piani" value={plans.length} />
        <SummaryCard label="Capitale allocato" value={`€${fmt(capitaleTot)}`} />
        <SummaryCard label="P&L aggregato" value={`${profittoTot >= 0 ? "+" : ""}€${fmt(profittoTot)}`} accent={profittoTot >= 0 ? GREEN : RUST} />
        <SummaryCard label="Piani in allerta" value={inAllerta} accent={inAllerta > 0 ? AMBER : GREEN} />
      </div>

      <div style={{ fontFamily: "system-ui, sans-serif", fontSize: 13, border: `1px solid ${LINE}`, borderRadius: 8, overflow: "hidden" }}>
        <div style={{ display: "grid", gridTemplateColumns: cols, background: PANEL, padding: "8px 14px", color: MUTED, fontSize: 11, textTransform: "uppercase", letterSpacing: 0.5, gap: 6 }}>
          <span>Piano</span>
          <span style={{ textAlign: "right" }}>Capitale</span>
          <span style={{ textAlign: "right" }}>Giocati</span>
          <span style={{ textAlign: "right" }}>Obiettivo</span>
          <span style={{ textAlign: "right" }}>P&L</span>
          <span style={{ textAlign: "right" }}>Margine</span>
          <span></span>
        </div>
        {rows.map(({ plan, m, stats }) => (
          <div key={plan.id} style={{ display: "grid", gridTemplateColumns: cols, padding: "10px 14px", borderTop: `1px solid ${LINE}`, alignItems: "center", gap: 6 }}>
            <span style={{ color: CREAM, fontFamily: "Georgia, serif", fontSize: 15 }}>
              {plan.name}
              {m && m.stato !== "in corso" && <span style={{ display: "block", fontFamily: "system-ui, sans-serif", fontSize: 11, color: STATO_LABEL[m.stato].c }}>{STATO_LABEL[m.stato].t}</span>}
            </span>
            <span style={{ textAlign: "right", color: CREAM }}>€{fmt(m ? m.capitaleAttuale : plan.capitale, 0)}</span>
            <span style={{ textAlign: "right", color: MUTED }}>{m ? `${m.giocati}/${m.N}` : "—"}</span>
            <span style={{ textAlign: "right", color: GOLD }}>{m && m.obiettivoAttuale ? `€${fmt(m.obiettivoAttuale)}` : "—"}</span>
            <span style={{ textAlign: "right", color: !m || m.giocati === 0 ? MUTED : m.profitto >= 0 ? GREEN : RUST }}>
              {m && m.giocati > 0 ? `${m.profitto >= 0 ? "+" : ""}€${fmt(m.profitto)}` : "—"}
            </span>
            <span style={{ textAlign: "right", color: !stats ? MUTED : stats.exceeded ? RUST : stats.triggered ? AMBER : GREEN }}>
              {stats ? stats.lossesResidue : "—"}
            </span>
            <span style={{ textAlign: "right" }}>
              <button onClick={() => onOpen(plan.id)} style={{ background: "transparent", border: `1px solid ${LINE}`, borderRadius: 4, color: CREAM, fontFamily: "system-ui, sans-serif", fontSize: 12, padding: "4px 10px", cursor: "pointer" }}>
                Apri
              </button>
            </span>
          </div>
        ))}
        {rows.length === 0 && (
          <div style={{ padding: 20, color: MUTED, fontFamily: "system-ui, sans-serif", fontSize: 13 }}>
            Nessun piano ancora. Crea il primo con "+ Nuovo piano".
          </div>
        )}
      </div>
    </div>
  );
}

function PlanView({ plan, onLocalUpdate, onSavePlanField, onAddEvent, onUpdateEventField, onRemoveEvent, onResetOutcomes, onGenerateBulk }) {
  const m = useMemo(() => computeMasaniello(plan), [plan]);
  const stats = useMemo(() => statsFor(plan, m), [plan, m]);
  const field = (key) => ({
    onLocal: (value) => onLocalUpdate(plan.id, { [key]: value }),
    onSave: (value) => onSavePlanField(plan.id, key, value),
  });
  const setNow = (key, value) => {
    onLocalUpdate(plan.id, { [key]: value });
    onSavePlanField(plan.id, key, value);
  };
  const label = { display: "block", fontFamily: "system-ui, sans-serif", fontSize: 11, color: MUTED, marginBottom: 4, textTransform: "uppercase", letterSpacing: 0.4 };

  return (
    <div>
      <div style={{ marginBottom: 24, borderBottom: `1px solid ${LINE}`, paddingBottom: 18 }}>
        <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", flexWrap: "wrap", gap: 12 }}>
          <div style={{ flex: 1, minWidth: 200 }}>
            <label style={{ display: "block", fontFamily: "system-ui, sans-serif", fontSize: 11, color: MUTED, marginBottom: 4 }}>Nome piano</label>
            <input
              value={plan.name}
              onChange={(e) => { field("name").onLocal(e.target.value); field("name").onSave(e.target.value); }}
              style={{ background: "transparent", border: "none", borderBottom: `1px solid ${LINE}`, color: CREAM, fontFamily: "Georgia, serif", fontSize: 24, outline: "none", width: "100%" }}
            />
          </div>
          <div style={{ textAlign: "right" }}>
            <label style={{ display: "block", fontFamily: "system-ui, sans-serif", fontSize: 11, color: MUTED, marginBottom: 4 }}>Capitale iniziale</label>
            <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
              <span style={{ fontSize: 20, color: MUTED }}>€</span>
              <input
                type="number"
                value={plan.capitale}
                onChange={(e) => { const v = parseFloat(e.target.value) || 0; field("capitale").onLocal(v); field("capitale").onSave(v); }}
                style={{ background: "transparent", border: "none", borderBottom: `1px solid ${LINE}`, color: CREAM, fontFamily: "Georgia, serif", fontSize: 24, width: 130, outline: "none", textAlign: "right" }}
              />
            </div>
          </div>
        </div>
      </div>

      <div style={{ marginBottom: 24, border: `1px solid ${LINE}`, borderRadius: 8, padding: 18 }}>
        <h2 style={{ fontSize: 16, fontWeight: 400, margin: "0 0 14px" }}>Piano</h2>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(120px, 1fr))", gap: 14 }}>
          <NumField label="Eventi totali (N)" value={plan.planN} onChange={(v) => setNow("planN", Math.max(1, Math.round(v)))} step={1} min={1} />
          <NumField label="Vincite minime (K)" value={plan.planK} onChange={(v) => setNow("planK", Math.max(1, Math.round(v)))} step={1} min={1} />
          <div>
            <label style={label}>Quota di riferimento</label>
            <input
              value={plan.bulkQuota ?? ""}
              onChange={(e) => { field("bulkQuota").onLocal(e.target.value); field("bulkQuota").onSave(e.target.value); }}
              placeholder="2,00"
              style={{ background: PANEL, border: `1px solid ${LINE}`, borderRadius: 4, color: CREAM, fontFamily: "system-ui, sans-serif", fontSize: 14, padding: "6px 8px", width: 90, outline: "none" }}
            />
          </div>
          <NumField label="Margine di allerta" value={plan.alertMargin} onChange={(v) => setNow("alertMargin", v)} step={1} min={0} />
        </div>
        <p style={{ fontFamily: "system-ui, sans-serif", fontSize: 11, color: MUTED, margin: "10px 0 0", lineHeight: 1.5 }}>
          La quota di riferimento si usa per gli eventi di cui non hai ancora inserito la quota: appena la scrivi, le puntate si ricalcolano.
        </p>
        {plan.planK > plan.planN && <p style={{ fontFamily: "system-ui, sans-serif", fontSize: 12, color: RUST, margin: "8px 0 0" }}>Le vincite minime non possono superare gli eventi totali.</p>}
      </div>

      {m && (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(140px, 1fr))", gap: 10, marginBottom: 20 }}>
          <SummaryCard label="Obiettivo" value={m.obiettivoAttuale ? `€${fmt(m.obiettivoAttuale)}` : "—"}
            accent={GOLD} sub={`iniziale €${fmt(m.obiettivoIniziale)} · ${m.obiettivoAttuale ? `+${fmt(((m.obiettivoAttuale - plan.capitale) / plan.capitale) * 100, 1)}%` : ""}`} />
          <SummaryCard label="Capitale attuale" value={`€${fmt(m.capitaleAttuale)}`}
            accent={m.giocati === 0 ? CREAM : m.profitto >= 0 ? GREEN : RUST}
            sub={m.giocati > 0 ? `${m.profitto >= 0 ? "+" : ""}€${fmt(m.profitto)}` : "nessun esito ancora"} />
          <SummaryCard label="Avanzamento" value={`${m.vinte}V · ${m.perse}P`} sub={`${m.giocati}/${m.N} giocati · mancano ${m.vincitaMancanti} vincite`} />
          <SummaryCard label="Stato" value={STATO_LABEL[m.stato].t} accent={STATO_LABEL[m.stato].c} />
        </div>
      )}

      {m && m.prossime && (
        <div style={{ marginBottom: 24, border: `1px solid ${GOLD}`, borderRadius: 8, padding: 16, background: "rgba(201,162,74,0.06)" }}>
          <div style={{ fontFamily: "system-ui, sans-serif", fontSize: 11, color: GOLD, textTransform: "uppercase", letterSpacing: 0.5, marginBottom: 8 }}>
            {m.prossime.eventi.length > 1 ? `Prossima giocata · ${m.prossime.eventi.length} eventi in contemporanea` : "Prossima giocata"}
          </div>
          {m.prossime.eventi.map((ix) => {
            const ev = plan.events[ix];
            return (
              <div key={ev.id} style={{ display: "flex", justifyContent: "space-between", fontFamily: "system-ui, sans-serif", fontSize: 14, padding: "3px 0", color: ev.esito === "attesa" ? CREAM : MUTED }}>
                <span>{ev.label} <span style={{ color: MUTED }}>@ {fmt(parseQ(ev.quota) || m.qRif)}</span>{!parseQ(ev.quota) && <span style={{ color: AMBER, fontSize: 11 }}> (quota di riferimento)</span>}</span>
                <b style={{ color: GOLD }}>€{m.rows[ix].stake}</b>
              </div>
            );
          })}
          {m.prossime.eventi.length > 1 && (
            <div style={{ fontFamily: "system-ui, sans-serif", fontSize: 12, color: MUTED, marginTop: 6 }}>Totale in gioco €{m.prossime.totale}</div>
          )}
        </div>
      )}

      {stats && (
        <div style={{ marginBottom: 24, border: `1px solid ${LINE}`, borderRadius: 8, padding: 18 }}>
          <h2 style={{ fontSize: 16, fontWeight: 400, margin: "0 0 14px" }}>Allerta perdite</h2>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(140px, 1fr))", gap: 10, marginBottom: stats.triggered ? 16 : 0 }}>
            <SummaryCard label="Perdite massime tollerate" value={stats.maxLosses} sub={`serve vincere ${fmt(stats.winRateNeededPct, 1)}%`} />
            <SummaryCard label="Margine di sicurezza" value={stats.lossesResidue} accent={stats.exceeded ? RUST : stats.triggered ? AMBER : GREEN} sub={stats.exceeded ? "soglia superata" : "perdite ancora tollerabili"} />
            <SummaryCard label="Win-rate reale finora" value={stats.h != null ? `${fmt(stats.h * 100, 1)}%` : "—"} sub={`${m ? m.vinte : 0}V / ${m ? m.perse : 0}P su ${stats.played} giocati`} />
          </div>
          {stats.triggered && (
            <div style={{ background: "rgba(184,89,61,0.08)", border: `1px solid ${stats.exceeded ? RUST : AMBER}`, borderRadius: 8, padding: 16, marginTop: 4 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 10 }}>
                <AlertTriangle size={16} color={stats.exceeded ? RUST : AMBER} />
                <span style={{ fontFamily: "system-ui, sans-serif", fontSize: 13, color: stats.exceeded ? RUST : AMBER }}>
                  {stats.exceeded
                    ? `Soglia superata: ${m ? m.perse : 0} perdite contro un massimo di ${stats.maxLosses}`
                    : `Attenzione: margine residuo di sole ${stats.lossesResidue} perdite prima del limite (${stats.maxLosses})`}
                </span>
              </div>
              <p style={{ fontFamily: "system-ui, sans-serif", fontSize: 12, color: MUTED, margin: "0 0 12px" }}>
                Stima di quanti eventi aggiungere alla progressione per restare in profitto, in base al tuo win-rate reale finora.
              </p>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(110px, 1fr))", gap: 14, marginBottom: 14 }}>
                <NumField label="Quota media prossimi eventi" value={plan.extQuota} onChange={(v) => setNow("extQuota", v)} step={0.01} min={1.01} />
                <NumField label="Profitto minimo desiderato %" value={plan.extTarget} onChange={(v) => setNow("extTarget", v)} step={1} min={0} />
              </div>
              {stats.extension && stats.extension.possible && (
                <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(140px, 1fr))", gap: 10 }}>
                  <SummaryCard label="Eventi da aggiungere" value={`+${stats.extension.M}`} accent={GOLD} />
                  <SummaryCard label="Nuovo totale eventi" value={stats.extension.Ntot} />
                  <SummaryCard label="Nuove vincite minime" value={stats.extension.Vmin} />
                  <SummaryCard label="Nuovo margine risultante" value={stats.extension.marginNew} accent={GREEN} />
                </div>
              )}
              {stats.extension && !stats.extension.possible && (
                <p style={{ fontFamily: "system-ui, sans-serif", fontSize: 12, color: RUST, margin: 0 }}>
                  Con il tuo win-rate attuale ({fmt(stats.extension.h * 100, 1)}%) e questa quota media, nessuna estensione realistica riporta il piano in profitto.
                </p>
              )}
              {!stats.extension && (
                <p style={{ fontFamily: "system-ui, sans-serif", fontSize: 12, color: MUTED, margin: 0 }}>
                  Servono almeno un esito vinto o perso registrato per calcolare il win-rate e proporre un'estensione.
                </p>
              )}
            </div>
          )}
        </div>
      )}

      <div style={{ marginBottom: 12, display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
        <button onClick={() => onGenerateBulk(plan.id)} style={{ display: "flex", alignItems: "center", gap: 6, background: "transparent", border: `1px solid ${GOLD}`, borderRadius: 6, color: GOLD, fontFamily: "system-ui, sans-serif", fontSize: 13, padding: "8px 14px", cursor: "pointer" }}>
          <Wand2 size={14} /> Genera {plan.planN || 0} eventi
        </button>
        <span style={{ fontFamily: "system-ui, sans-serif", fontSize: 11, color: MUTED }}>crea le caselle per tutto il piano con la quota di riferimento · sostituisce gli eventi attuali</span>
      </div>

      <div style={{ marginBottom: 24 }}>
        <div style={{ display: "grid", gridTemplateColumns: "96px 1fr 80px 120px 70px 90px 30px", gap: 8, padding: "0 4px 10px", fontFamily: "system-ui, sans-serif", fontSize: 11, color: MUTED, textTransform: "uppercase", letterSpacing: 0.4 }}>
          <span title="Contemporanea all'evento sopra">Insieme a sopra</span>
          <span>Evento</span>
          <span>Quota</span>
          <span>Esito</span>
          <span style={{ textAlign: "right" }}>Puntata</span>
          <span style={{ textAlign: "right" }}>Capitale</span>
          <span></span>
        </div>
        {plan.events.map((ev, ix) => {
          const r = m ? m.rows[ix] : null;
          const rowColor = ev.esito === "vinta" ? GREEN : ev.esito === "persa" ? RUST : CREAM;
          const inGruppo = ev.contemporanea && ix > 0;
          const prossimo = r && r.stato === "da giocare";
          return (
            <div key={ev.id} style={{
              display: "grid", gridTemplateColumns: "96px 1fr 80px 120px 70px 90px 30px", gap: 8, alignItems: "center",
              padding: "6px 4px", borderTop: inGruppo ? "none" : `1px solid ${LINE}`,
              borderLeft: `3px solid ${inGruppo || (plan.events[ix + 1] && plan.events[ix + 1].contemporanea) ? GOLD : "transparent"}`,
              background: prossimo ? "rgba(201,162,74,0.06)" : "transparent", opacity: r && r.stato === "fuori" ? 0.45 : 1,
            }}>
              {ix > 0 ? (
                <button
                  onClick={() => onUpdateEventField(plan.id, ev.id, "contemporanea", !ev.contemporanea)}
                  title={ev.contemporanea ? "Contemporanea alla precedente (clicca per separare)" : "Segna come contemporanea alla precedente"}
                  style={{ background: ev.contemporanea ? "rgba(201,162,74,0.18)" : "transparent", border: `1px solid ${ev.contemporanea ? GOLD : LINE}`, borderRadius: 4, color: ev.contemporanea ? GOLD : MUTED, cursor: "pointer", height: 26, display: "flex", alignItems: "center", justifyContent: "center", gap: 4, fontFamily: "system-ui, sans-serif", fontSize: 11, fontWeight: ev.contemporanea ? 700 : 400 }}
                >
                  <Link2 size={12} /> {ev.contemporanea ? "insieme" : "separato"}
                </button>
              ) : <span />}
              <input
                value={ev.label}
                onChange={(e) => onUpdateEventField(plan.id, ev.id, "label", e.target.value)}
                style={{ background: "transparent", border: "none", borderBottom: `1px solid ${LINE}`, color: CREAM, fontFamily: "Georgia, serif", fontSize: 15, padding: "4px 0", outline: "none", minWidth: 0 }}
              />
              <input
                value={ev.quota}
                inputMode="decimal"
                onChange={(e) => onUpdateEventField(plan.id, ev.id, "quota", e.target.value)}
                placeholder={m ? fmt(m.qRif) : "2,00"}
                style={{ background: PANEL, border: `1px solid ${LINE}`, borderRadius: 4, color: CREAM, fontFamily: "system-ui, sans-serif", fontSize: 14, padding: "5px 8px", width: 70, outline: "none" }}
              />
              <select
                value={ev.esito}
                onChange={(e) => onUpdateEventField(plan.id, ev.id, "esito", e.target.value)}
                style={{ background: PANEL, border: `1px solid ${LINE}`, borderRadius: 4, color: rowColor, fontFamily: "system-ui, sans-serif", fontSize: 13, padding: "6px 6px", outline: "none" }}
              >
                <option value="attesa">In attesa</option>
                <option value="vinta">Vinta</option>
                <option value="persa">Persa</option>
              </select>
              <span style={{ fontFamily: "system-ui, sans-serif", fontSize: 14, textAlign: "right", color: prossimo ? GOLD : MUTED, fontWeight: prossimo ? 700 : 400 }}>
                {r && r.stake != null ? `€${r.stake}` : "—"}
              </span>
              <span style={{ fontFamily: "system-ui, sans-serif", fontSize: 13, textAlign: "right", color: MUTED }}>
                {r && r.capitaleDopo != null ? `€${fmt(r.capitaleDopo)}` : ""}
              </span>
              <button onClick={() => onRemoveEvent(plan.id, ev.id)} aria-label="Rimuovi evento" style={{ background: "transparent", border: "none", color: MUTED, cursor: "pointer", display: "flex", justifyContent: "center" }}>
                <Trash2 size={15} />
              </button>
            </div>
          );
        })}

        {m && m.eventiOltreN > 0 && (
          <p style={{ fontFamily: "system-ui, sans-serif", fontSize: 12, color: AMBER, margin: "10px 0 0" }}>
            Hai {m.eventiOltreN} eventi oltre gli N del piano: non vengono calcolati. Aumenta N o rimuovili.
          </p>
        )}

        <div style={{ display: "flex", gap: 10, marginTop: 14 }}>
          <button onClick={() => onAddEvent(plan.id)} style={{ display: "flex", alignItems: "center", gap: 6, background: "transparent", border: `1px solid ${LINE}`, borderRadius: 6, color: CREAM, fontFamily: "system-ui, sans-serif", fontSize: 13, padding: "8px 14px", cursor: "pointer" }}>
            <Plus size={14} /> Aggiungi evento
          </button>
          <button onClick={() => onResetOutcomes(plan.id)} style={{ display: "flex", alignItems: "center", gap: 6, background: "transparent", border: `1px solid ${LINE}`, borderRadius: 6, color: MUTED, fontFamily: "system-ui, sans-serif", fontSize: 13, padding: "8px 14px", cursor: "pointer" }}>
            <RotateCcw size={14} /> Azzera esiti
          </button>
        </div>
      </div>

      <p style={{ fontFamily: "system-ui, sans-serif", fontSize: 12, color: MUTED, lineHeight: 1.6 }}>
        Masaniello standard: ogni puntata si ricalcola sul capitale reale, sugli eventi rimasti e sulle vincite ancora da fare.
        Con il pulsante a sinistra ("separato" → "insieme") leghi un evento a quello sopra: si giocano in contemporanea. Il gruppo rischia in totale quanto il piano rischierebbe perdendoli tutti in fila,
        ripartito in modo che ogni vincita paghi uguale. Puntate arrotondate all'euro. Le puntate degli eventi dopo quelli in attesa
        compaiono quando registri gli esiti.
      </p>
    </div>
  );
}

export default function Masaniello() {
  const [plans, setPlans] = useState([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState("dashboard");

  // --- caricamento iniziale: piani + eventi dell'utente loggato (RLS filtra già per user_id) ---
  useEffect(() => {
    (async () => {
      setLoading(true);
      const { data: planRows, error: planErr } = await supabase
        .from("masaniello_plans")
        .select("*")
        .order("created_at", { ascending: true });
      if (planErr) {
        console.error("Errore caricamento piani Masaniello:", planErr);
        setLoading(false);
        return;
      }
      const ids = (planRows || []).map((r) => r.id);
      let eventRows = [];
      if (ids.length > 0) {
        const { data, error: evErr } = await supabase
          .from("masaniello_events")
          .select("*")
          .in("plan_id", ids);
        if (evErr) console.error("Errore caricamento eventi Masaniello:", evErr);
        else eventRows = data || [];
      }
      const assembled = (planRows || []).map((r) => planFromRow(r, eventRows));
      setPlans(assembled);
      if (assembled.length > 0) setActiveTab(assembled[0].id);
      setLoading(false);
    })();
  }, []);

  const debouncedSave = useDebouncedCallback((planId, key, value) => {
    supabase.from("masaniello_plans").update(patchToRow({ [key]: value })).eq("id", planId)
      .then(({ error }) => { if (error) console.error("Errore salvataggio piano:", error); });
  }, 500);

  const onLocalUpdate = (planId, patch) => {
    setPlans((ps) => ps.map((p) => (p.id === planId ? { ...p, ...patch } : p)));
  };

  const onSavePlanField = (planId, key, value) => {
    debouncedSave(`${planId}:${key}`, planId, key, value);
  };

  const addPlan = async () => {
    const { data, error } = await supabase
      .from("masaniello_plans")
      .insert({ name: `Masaniello ${plans.length + 1}` })
      .select()
      .single();
    if (error) { console.error("Errore creazione piano:", error); return; }
    const newPlan = planFromRow(data, []);
    setPlans((ps) => [...ps, newPlan]);
    setActiveTab(newPlan.id);
  };

  const removePlan = async (id) => {
    setPlans((ps) => ps.filter((p) => p.id !== id));
    if (activeTab === id) setActiveTab("dashboard");
    const { error } = await supabase.from("masaniello_plans").delete().eq("id", id);
    if (error) console.error("Errore eliminazione piano:", error);
  };

  const addEvent = async (planId) => {
    const plan = plans.find((p) => p.id === planId);
    const position = plan.events.length;
    const { data, error } = await supabase
      .from("masaniello_events")
      .insert({ plan_id: planId, label: `Evento ${position + 1}`, position })
      .select()
      .single();
    if (error) { console.error("Errore aggiunta evento:", error); return; }
    onLocalUpdate(planId, { events: [...plan.events, { id: data.id, label: data.label, quota: "", esito: "attesa", contemporanea: false }] });
  };

  const removeEvent = async (planId, eventId) => {
    const plan = plans.find((p) => p.id === planId);
    onLocalUpdate(planId, { events: plan.events.filter((e) => e.id !== eventId) });
    const { error } = await supabase.from("masaniello_events").delete().eq("id", eventId);
    if (error) console.error("Errore rimozione evento:", error);
  };

  const debouncedEventSave = useDebouncedCallback((eventId, field, value) => {
    const dbField = field; // label, quota, esito -> stessi nomi lato DB
    const payload = field === "quota" ? { quota: parseQ(value) } : { [dbField]: value }; // accetta anche la virgola
    supabase.from("masaniello_events").update(payload).eq("id", eventId)
      .then(({ error }) => { if (error) console.error("Errore salvataggio evento:", error); });
  }, 500);

  const updateEventField = (planId, eventId, field, value) => {
    const plan = plans.find((p) => p.id === planId);
    onLocalUpdate(planId, {
      events: plan.events.map((e) => (e.id === eventId ? { ...e, [field]: value } : e)),
    });
    debouncedEventSave(`${eventId}:${field}`, eventId, field, value);
  };

  const resetOutcomes = async (planId) => {
    const plan = plans.find((p) => p.id === planId);
    onLocalUpdate(planId, { events: plan.events.map((e) => ({ ...e, esito: "attesa" })) });
    const { error } = await supabase.from("masaniello_events").update({ esito: "attesa" }).eq("plan_id", planId);
    if (error) console.error("Errore azzeramento esiti:", error);
  };

  const generateBulk = async (planId) => {
    const plan = plans.find((p) => p.id === planId);
    const n = Math.max(1, Math.round(plan.planN || plan.bulkN || 1));
    const q = parseQ(plan.bulkQuota);

    const { error: delErr } = await supabase.from("masaniello_events").delete().eq("plan_id", planId);
    if (delErr) { console.error("Errore pulizia eventi:", delErr); return; }

    const rows = Array.from({ length: n }, (_, i) => ({
      plan_id: planId,
      position: i,
      label: `Evento ${i + 1}`,
      quota: q,
      esito: "attesa",
      contemporanea: false,
    }));
    const { data, error } = await supabase.from("masaniello_events").insert(rows).select();
    if (error) { console.error("Errore generazione blocco:", error); return; }

    const newEvents = data
      .sort((a, b) => a.position - b.position)
      .map((e) => ({ id: e.id, label: e.label, quota: e.quota == null ? "" : String(e.quota), esito: e.esito, contemporanea: false }));
    onLocalUpdate(planId, { events: newEvents });
  };

  const activePlan = plans.find((p) => p.id === activeTab);

  if (loading) {
    return (
      <div style={{ background: INK, color: MUTED, minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", fontFamily: "system-ui, sans-serif", gap: 8 }}>
        <Loader2 size={16} className="animate-spin" /> Caricamento piani...
      </div>
    );
  }

  return (
    <div style={{ background: INK, color: CREAM, fontFamily: "Georgia, serif", minHeight: "100vh", padding: "32px 20px 60px" }}>
      <div style={{ maxWidth: 860, margin: "0 auto" }}>
        <div style={{ marginBottom: 22 }}>
          <h1 style={{ fontSize: 30, fontWeight: 400, margin: 0, letterSpacing: 0.3 }}>Masaniello</h1>
          <p style={{ fontFamily: "system-ui, sans-serif", fontSize: 13, color: MUTED, margin: "6px 0 0" }}>
            Masaniello standard con eventi in contemporanea · più piani in parallelo, confrontabili dalla dashboard
          </p>
        </div>

        <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginBottom: 26, borderBottom: `1px solid ${LINE}`, paddingBottom: 14 }}>
          <button
            onClick={() => setActiveTab("dashboard")}
            style={{
              display: "flex", alignItems: "center", gap: 6,
              background: activeTab === "dashboard" ? "rgba(201,162,74,0.12)" : "transparent",
              border: `1px solid ${activeTab === "dashboard" ? GOLD : LINE}`,
              borderRadius: 6, color: activeTab === "dashboard" ? GOLD : CREAM,
              fontFamily: "system-ui, sans-serif", fontSize: 13, padding: "7px 12px", cursor: "pointer",
            }}
          >
            <LayoutGrid size={13} /> Dashboard
          </button>

          {plans.map((p) => (
            <div key={p.id} style={{ display: "flex", alignItems: "center" }}>
              <button
                onClick={() => setActiveTab(p.id)}
                style={{
                  background: activeTab === p.id ? "rgba(201,162,74,0.12)" : "transparent",
                  border: `1px solid ${activeTab === p.id ? GOLD : LINE}`,
                  borderRight: "none",
                  borderRadius: "6px 0 0 6px", color: activeTab === p.id ? GOLD : CREAM,
                  fontFamily: "system-ui, sans-serif", fontSize: 13, padding: "7px 10px", cursor: "pointer",
                }}
              >
                {p.name}
              </button>
              <button
                onClick={() => removePlan(p.id)}
                aria-label={`Elimina ${p.name}`}
                style={{
                  background: activeTab === p.id ? "rgba(201,162,74,0.12)" : "transparent",
                  border: `1px solid ${activeTab === p.id ? GOLD : LINE}`,
                  borderRadius: "0 6px 6px 0", color: MUTED,
                  padding: "7px 8px", cursor: "pointer", display: "flex", alignItems: "center",
                }}
              >
                <X size={12} />
              </button>
            </div>
          ))}

          <button onClick={addPlan} style={{ display: "flex", alignItems: "center", gap: 6, background: "transparent", border: `1px solid ${LINE}`, borderRadius: 6, color: MUTED, fontFamily: "system-ui, sans-serif", fontSize: 13, padding: "7px 12px", cursor: "pointer" }}>
            <Plus size={13} /> Nuovo piano
          </button>
        </div>

        {activeTab === "dashboard" && <Dashboard plans={plans} onOpen={setActiveTab} />}
        {activePlan && activeTab !== "dashboard" && (
          <PlanView
            plan={activePlan}
            onLocalUpdate={onLocalUpdate}
            onSavePlanField={onSavePlanField}
            onAddEvent={addEvent}
            onUpdateEventField={updateEventField}
            onRemoveEvent={removeEvent}
            onResetOutcomes={resetOutcomes}
            onGenerateBulk={generateBulk}
          />
        )}

        <div style={{ marginTop: 48, paddingTop: 16, borderTop: `1px solid ${LINE}`, textAlign: "center" }}>
          <p style={{ fontFamily: "system-ui, sans-serif", fontSize: 11, color: MUTED, margin: 0 }}>
            © 2026 Sergio Apicella
          </p>
        </div>
      </div>
    </div>
  );
}
