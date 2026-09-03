"use client";

import React, { useState, useEffect, useCallback, useMemo, useRef } from "react";
import { Plus, Trash2, RotateCcw, AlertTriangle, ChevronUp, ChevronDown, LayoutGrid, X, Wand2, Loader2 } from "lucide-react";
// Adegua questo import al percorso reale del tuo client Supabase (lo stesso usato altrove nel Profit Tracker).
import { supabase } from "@/lib/supabaseClient";

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

// --- calcoli invariati rispetto alla versione standalone ---
function computeCalc(capitale, events) {
  const validEvents = events.filter((e) => e.quota && parseFloat(e.quota) > 1);
  const n = validEvents.length;
  if (n === 0 || !capitale || capitale <= 0) return null;
  const sumInvQ = validEvents.reduce((acc, e) => acc + 1 / parseFloat(e.quota), 0);
  const payout = capitale / sumInvQ;
  const breakEven = sumInvQ;
  const stakes = validEvents.map((e) => ({ ...e, stake: payout / parseFloat(e.quota) }));
  const decise = stakes.filter((e) => e.esito !== "attesa");
  const vinte = decise.filter((e) => e.esito === "vinta").length;
  const incassoParziale = vinte * payout;
  const profittoParziale = incassoParziale - capitale;
  const roiParziale = (profittoParziale / capitale) * 100;
  const scenari = [];
  for (let k = 1; k <= n; k++) {
    const t = k * payout;
    scenari.push({ k, target: t, roi: ((t - capitale) / capitale) * 100 });
  }
  return { n, payout, breakEven, stakes, vinte, incassoParziale, profittoParziale, roiParziale, scenari, decise: decise.length };
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
    .map((e) => ({ id: e.id, label: e.label, quota: e.quota == null ? "" : String(e.quota), esito: e.esito })),
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

function Stepper({ label, value, onChange, color }) {
  return (
    <div>
      <label style={{ display: "block", fontFamily: "system-ui, sans-serif", fontSize: 11, color: MUTED, marginBottom: 4, textTransform: "uppercase", letterSpacing: 0.4 }}>
        {label}
      </label>
      <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
        <button onClick={() => onChange(Math.max(0, value - 1))} style={{ background: PANEL, border: `1px solid ${LINE}`, borderRadius: 4, color: MUTED, width: 26, height: 26, display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer" }}>
          <ChevronDown size={13} />
        </button>
        <span style={{ fontFamily: "Georgia, serif", fontSize: 18, color: color || CREAM, minWidth: 30, textAlign: "center" }}>{value}</span>
        <button onClick={() => onChange(value + 1)} style={{ background: PANEL, border: `1px solid ${LINE}`, borderRadius: 4, color: MUTED, width: 26, height: 26, display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer" }}>
          <ChevronUp size={13} />
        </button>
      </div>
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

function Dashboard({ plans, onOpen }) {
  const rows = plans.map((p) => {
    const calc = computeCalc(p.capitale, p.events);
    const stats = computePlanStats(p.planN, p.planK, p.curWins, p.curLosses, p.alertMargin, p.extQuota, p.extTarget);
    return { plan: p, calc, stats };
  });
  const capitaleTot = plans.reduce((a, p) => a + (parseFloat(p.capitale) || 0), 0);
  const profittoTot = rows.reduce((a, r) => a + (r.calc ? r.calc.profittoParziale : 0), 0);
  const inAllerta = rows.filter((r) => r.stats && r.stats.triggered).length;

  return (
    <div>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(150px, 1fr))", gap: 10, marginBottom: 24 }}>
        <SummaryCard label="Piani attivi" value={plans.length} />
        <SummaryCard label="Capitale allocato" value={`€${fmt(capitaleTot)}`} />
        <SummaryCard label="P&L aggregato" value={`${profittoTot >= 0 ? "+" : ""}€${fmt(profittoTot)}`} accent={profittoTot >= 0 ? GREEN : RUST} />
        <SummaryCard label="Piani in allerta" value={inAllerta} accent={inAllerta > 0 ? AMBER : GREEN} />
      </div>

      <div style={{ fontFamily: "system-ui, sans-serif", fontSize: 13, border: `1px solid ${LINE}`, borderRadius: 8, overflow: "hidden" }}>
        <div style={{ display: "grid", gridTemplateColumns: "1.4fr 0.8fr 0.8fr 1fr 1fr 0.9fr 0.7fr", background: PANEL, padding: "8px 14px", color: MUTED, fontSize: 11, textTransform: "uppercase", letterSpacing: 0.5, gap: 6 }}>
          <span>Piano</span>
          <span style={{ textAlign: "right" }}>Capitale</span>
          <span style={{ textAlign: "right" }}>Eventi</span>
          <span style={{ textAlign: "right" }}>Payout</span>
          <span style={{ textAlign: "right" }}>Esito</span>
          <span style={{ textAlign: "right" }}>Margine</span>
          <span></span>
        </div>
        {rows.map(({ plan, calc, stats }) => (
          <div key={plan.id} style={{ display: "grid", gridTemplateColumns: "1.4fr 0.8fr 0.8fr 1fr 1fr 0.9fr 0.7fr", padding: "10px 14px", borderTop: `1px solid ${LINE}`, alignItems: "center", gap: 6 }}>
            <span style={{ color: CREAM, fontFamily: "Georgia, serif", fontSize: 15 }}>{plan.name}</span>
            <span style={{ textAlign: "right", color: CREAM }}>€{fmt(plan.capitale, 0)}</span>
            <span style={{ textAlign: "right", color: MUTED }}>{calc ? calc.n : 0}</span>
            <span style={{ textAlign: "right", color: GOLD }}>{calc ? `€${fmt(calc.payout)}` : "—"}</span>
            <span style={{ textAlign: "right", color: !calc || calc.decise === 0 ? MUTED : calc.profittoParziale >= 0 ? GREEN : RUST }}>
              {calc && calc.decise > 0 ? `${calc.profittoParziale >= 0 ? "+" : ""}€${fmt(calc.profittoParziale)}` : "—"}
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
  const calc = useMemo(() => computeCalc(plan.capitale, plan.events), [plan.capitale, plan.events]);
  const stats = useMemo(
    () => computePlanStats(plan.planN, plan.planK, plan.curWins, plan.curLosses, plan.alertMargin, plan.extQuota, plan.extTarget),
    [plan.planN, plan.planK, plan.curWins, plan.curLosses, plan.alertMargin, plan.extQuota, plan.extTarget]
  );

  const field = (key) => ({
    onLocal: (value) => onLocalUpdate(plan.id, { [key]: value }),
    onSave: (value) => onSavePlanField(plan.id, key, value),
  });

  const setNow = (key, value) => {
    onLocalUpdate(plan.id, { [key]: value });
    onSavePlanField(plan.id, key, value);
  };

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
            <label style={{ display: "block", fontFamily: "system-ui, sans-serif", fontSize: 11, color: MUTED, marginBottom: 4 }}>Capitale</label>
            <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
              <span style={{ fontSize: 20, color: MUTED }}>€</span>
              <input
                type="number"
                value={plan.capitale}
                onChange={(e) => { const v = parseFloat(e.target.value) || 0; field("capitale").onLocal(v); field("capitale").onSave(v); }}
                style={{ background: "transparent", border: "none", borderBottom: `1px solid ${LINE}`, color: CREAM, fontFamily: "Georgia, serif", fontSize: 24, width: 130, textAlign: "right", outline: "none" }}
              />
            </div>
          </div>
        </div>
      </div>

      {calc && (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(140px, 1fr))", gap: 10, marginBottom: 28 }}>
          <SummaryCard label="Eventi" value={calc.n} />
          <SummaryCard label="Payout per vincita" value={`€${fmt(calc.payout)}`} accent={GOLD} />
          <SummaryCard label="Pareggio (vincite)" value={fmt(calc.breakEven)} />
          <SummaryCard
            label={calc.decise === calc.n ? "Esito finale" : `Esito (${calc.decise}/${calc.n} decisi)`}
            value={`${calc.profittoParziale >= 0 ? "+" : ""}€${fmt(calc.profittoParziale)}`}
            accent={calc.decise === 0 ? MUTED : calc.profittoParziale >= 0 ? GREEN : RUST}
            sub={calc.decise > 0 ? `ROI ${calc.roiParziale >= 0 ? "+" : ""}${fmt(calc.roiParziale)}%` : "nessun esito ancora"}
          />
        </div>
      )}

      <div style={{ marginBottom: 28, border: `1px solid ${LINE}`, borderRadius: 8, padding: 18 }}>
        <h2 style={{ fontSize: 16, fontWeight: 400, margin: "0 0 14px" }}>Piano e allerta perdite</h2>

        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(110px, 1fr))", gap: 14, marginBottom: 16 }}>
          <NumField label="Eventi totali (N)" value={plan.planN} onChange={(v) => setNow("planN", v)} step={1} min={1} />
          <NumField label="Vincite minime (K)" value={plan.planK} onChange={(v) => setNow("planK", v)} step={1} min={1} />
          <NumField label="Margine di allerta" value={plan.alertMargin} onChange={(v) => setNow("alertMargin", v)} step={1} min={0} />
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(110px, 1fr))", gap: 14, marginBottom: 18 }}>
          <Stepper label="Vinte finora" value={plan.curWins} onChange={(v) => setNow("curWins", v)} color={GREEN} />
          <Stepper label="Perse finora" value={plan.curLosses} onChange={(v) => setNow("curLosses", v)} color={RUST} />
        </div>

        {stats && (
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(140px, 1fr))", gap: 10, marginBottom: stats.triggered ? 16 : 0 }}>
            <SummaryCard label="Perdite massime tollerate" value={stats.maxLosses} sub={`serve vincere ${fmt(stats.winRateNeededPct, 1)}%`} />
            <SummaryCard label="Margine di sicurezza" value={stats.lossesResidue} accent={stats.exceeded ? RUST : stats.triggered ? AMBER : GREEN} sub={stats.exceeded ? "soglia superata" : "perdite ancora ammesse"} />
            <SummaryCard label="Win-rate reale finora" value={stats.h != null ? `${fmt(stats.h * 100, 1)}%` : "—"} sub={`${plan.curWins}V / ${plan.curLosses}P su ${stats.played}`} />
          </div>
        )}

        {stats && stats.triggered && (
          <div style={{ background: "rgba(184,89,61,0.08)", border: `1px solid ${stats.exceeded ? RUST : AMBER}`, borderRadius: 8, padding: 16, marginTop: 4 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 10 }}>
              <AlertTriangle size={16} color={stats.exceeded ? RUST : AMBER} />
              <span style={{ fontFamily: "system-ui, sans-serif", fontSize: 13, color: stats.exceeded ? RUST : AMBER }}>
                {stats.exceeded
                  ? `Soglia superata: hai ${plan.curLosses} perdite contro un massimo di ${stats.maxLosses}`
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
            <p style={{ fontFamily: "system-ui, sans-serif", fontSize: 11, color: MUTED, marginTop: 12, lineHeight: 1.5 }}>
              Stima basata sul win-rate osservato finora: non è una garanzia, è una proiezione da rivedere man mano che arrivano nuovi risultati.
            </p>
          </div>
        )}
      </div>

      <div style={{ marginBottom: 24, border: `1px solid ${LINE}`, borderRadius: 8, padding: 18 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 14 }}>
          <Wand2 size={16} color={GOLD} />
          <h2 style={{ fontSize: 16, fontWeight: 400, margin: 0 }}>Genera eventi in blocco</h2>
        </div>
        <p style={{ fontFamily: "system-ui, sans-serif", fontSize: 12, color: MUTED, margin: "0 0 14px" }}>
          Crea in automatico le caselle per tutti gli eventi del piano, precompilate con una quota media. Sostituisce gli eventi attuali di questo piano.
        </p>
        <div style={{ display: "flex", alignItems: "flex-end", gap: 14, flexWrap: "wrap" }}>
          <NumField label="Numero eventi" value={plan.bulkN} onChange={(v) => setNow("bulkN", v)} step={1} min={1} width={100} />
          <div>
            <label style={{ display: "block", fontFamily: "system-ui, sans-serif", fontSize: 11, color: MUTED, marginBottom: 4, textTransform: "uppercase", letterSpacing: 0.4 }}>
              Quota media
            </label>
            <input
              value={plan.bulkQuota}
              onChange={(e) => { field("bulkQuota").onLocal(e.target.value); field("bulkQuota").onSave(e.target.value); }}
              placeholder="1.50"
              style={{ background: PANEL, border: `1px solid ${LINE}`, borderRadius: 4, color: CREAM, fontFamily: "system-ui, sans-serif", fontSize: 14, padding: "6px 8px", width: 90, outline: "none" }}
            />
          </div>
          <button onClick={() => onGenerateBulk(plan.id)} style={{ display: "flex", alignItems: "center", gap: 6, background: "transparent", border: `1px solid ${GOLD}`, borderRadius: 6, color: GOLD, fontFamily: "system-ui, sans-serif", fontSize: 13, padding: "8px 14px", cursor: "pointer", height: 34 }}>
            <Wand2 size={14} /> Genera griglia eventi
          </button>
        </div>
      </div>

      <div style={{ marginBottom: 24 }}>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 90px 130px 90px 32px", gap: 8, padding: "0 4px 10px", fontFamily: "system-ui, sans-serif", fontSize: 11, color: MUTED, textTransform: "uppercase", letterSpacing: 0.5, borderBottom: `1px solid ${LINE}` }}>
          <span>Evento</span>
          <span>Quota</span>
          <span>Esito</span>
          <span style={{ textAlign: "right" }}>Puntata</span>
          <span></span>
        </div>

        {plan.events.map((ev) => {
          const stakeInfo = calc?.stakes.find((s) => s.id === ev.id);
          const rowColor = ev.esito === "vinta" ? GREEN : ev.esito === "persa" ? RUST : CREAM;
          return (
            <div key={ev.id} style={{ display: "grid", gridTemplateColumns: "1fr 90px 130px 90px 32px", gap: 8, alignItems: "center", padding: "10px 4px", borderBottom: `1px solid ${LINE}` }}>
              <input
                value={ev.label}
                onChange={(e) => onUpdateEventField(plan.id, ev.id, "label", e.target.value)}
                placeholder="Nome evento"
                style={{ background: "transparent", border: "none", color: CREAM, fontFamily: "Georgia, serif", fontSize: 15, outline: "none", minWidth: 0 }}
              />
              <input
                type="number"
                step="0.01"
                value={ev.quota}
                onChange={(e) => onUpdateEventField(plan.id, ev.id, "quota", e.target.value)}
                placeholder="1.50"
                style={{ background: PANEL, border: `1px solid ${LINE}`, borderRadius: 4, color: CREAM, fontFamily: "system-ui, sans-serif", fontSize: 14, padding: "5px 8px", width: 74, outline: "none" }}
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
              <span style={{ fontFamily: "system-ui, sans-serif", fontSize: 13, textAlign: "right", color: MUTED }}>
                {stakeInfo ? `€${fmt(stakeInfo.stake)}` : "—"}
              </span>
              <button onClick={() => onRemoveEvent(plan.id, ev.id)} aria-label="Rimuovi evento" style={{ background: "transparent", border: "none", color: MUTED, cursor: "pointer", display: "flex", justifyContent: "center" }}>
                <Trash2 size={15} />
              </button>
            </div>
          );
        })}

        <div style={{ display: "flex", gap: 10, marginTop: 14 }}>
          <button onClick={() => onAddEvent(plan.id)} style={{ display: "flex", alignItems: "center", gap: 6, background: "transparent", border: `1px solid ${LINE}`, borderRadius: 6, color: CREAM, fontFamily: "system-ui, sans-serif", fontSize: 13, padding: "8px 14px", cursor: "pointer" }}>
            <Plus size={14} /> Aggiungi evento
          </button>
          <button onClick={() => onResetOutcomes(plan.id)} style={{ display: "flex", alignItems: "center", gap: 6, background: "transparent", border: `1px solid ${LINE}`, borderRadius: 6, color: MUTED, fontFamily: "system-ui, sans-serif", fontSize: 13, padding: "8px 14px", cursor: "pointer" }}>
            <RotateCcw size={14} /> Azzera esiti
          </button>
        </div>
      </div>

      {calc && (
        <div>
          <h2 style={{ fontSize: 16, fontWeight: 400, margin: "0 0 12px", color: CREAM }}>Scenari per numero di vincite</h2>
          <div style={{ fontFamily: "system-ui, sans-serif", fontSize: 13, border: `1px solid ${LINE}`, borderRadius: 8, overflow: "hidden", maxHeight: 360, overflowY: "auto" }}>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", background: PANEL, padding: "8px 14px", color: MUTED, fontSize: 11, textTransform: "uppercase", letterSpacing: 0.5, position: "sticky", top: 0 }}>
              <span>Vincite</span>
              <span style={{ textAlign: "right" }}>Capitale finale</span>
              <span style={{ textAlign: "right" }}>ROI</span>
            </div>
            {calc.scenari.map((s) => {
              const isCurrent = calc.decise > 0 && s.k === calc.vinte && calc.decise === calc.n;
              return (
                <div key={s.k} style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", padding: "7px 14px", borderTop: `1px solid ${LINE}`, background: isCurrent ? "rgba(201,162,74,0.08)" : "transparent" }}>
                  <span style={{ color: isCurrent ? GOLD : CREAM }}>{s.k}/{calc.n}</span>
                  <span style={{ textAlign: "right", color: CREAM }}>€{fmt(s.target)}</span>
                  <span style={{ textAlign: "right", color: s.roi >= 0 ? GREEN : RUST }}>{s.roi >= 0 ? "+" : ""}{fmt(s.roi)}%</span>
                </div>
              );
            })}
          </div>
          <p style={{ fontFamily: "system-ui, sans-serif", fontSize: 12, color: MUTED, marginTop: 10, lineHeight: 1.5 }}>
            La puntata su ogni evento è payout ÷ quota, così ogni singola vincita rende sempre la stessa cifra fissa.
          </p>
        </div>
      )}
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
    onLocalUpdate(planId, { events: [...plan.events, { id: data.id, label: data.label, quota: "", esito: "attesa" }] });
  };

  const removeEvent = async (planId, eventId) => {
    const plan = plans.find((p) => p.id === planId);
    onLocalUpdate(planId, { events: plan.events.filter((e) => e.id !== eventId) });
    const { error } = await supabase.from("masaniello_events").delete().eq("id", eventId);
    if (error) console.error("Errore rimozione evento:", error);
  };

  const debouncedEventSave = useDebouncedCallback((eventId, field, value) => {
    const dbField = field; // label, quota, esito -> stessi nomi lato DB
    const payload = field === "quota" ? { quota: value === "" ? null : parseFloat(value) } : { [dbField]: value };
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
    const n = Math.max(1, Math.round(plan.bulkN));
    const q = plan.bulkQuota;

    const { error: delErr } = await supabase.from("masaniello_events").delete().eq("plan_id", planId);
    if (delErr) { console.error("Errore pulizia eventi:", delErr); return; }

    const rows = Array.from({ length: n }, (_, i) => ({
      plan_id: planId,
      position: i,
      label: `Evento ${i + 1}`,
      quota: parseFloat(q) || null,
      esito: "attesa",
    }));
    const { data, error } = await supabase.from("masaniello_events").insert(rows).select();
    if (error) { console.error("Errore generazione blocco:", error); return; }

    const newEvents = data
      .sort((a, b) => a.position - b.position)
      .map((e) => ({ id: e.id, label: e.label, quota: String(e.quota), esito: e.esito }));
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
            Simula più piani in parallelo e confrontali dalla dashboard
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
