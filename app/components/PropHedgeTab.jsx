"use client";

import React, { useEffect, useMemo, useState } from "react";
import { supabase } from "../profit-tracker/supabaseClient";
import MarketEnginePanel from "./MarketEnginePanel";
import {
  panel, panelHeader, panelTitle, panelSubtitle, input,
  primaryButtonBlue, secondaryButton, statCard, statLabel,
  statValue, statSub, statsGrid, hintBox, sectionTitle, sectionDescription
} from "./styles";

const ASSETS = {
  XAUUSD: { label: "XAU/USD — Oro", base: "XAU", quote: "USD", contract: 100, point: 0.01, decimals: 3, lotStep: 0.01 },
  XAGUSD: { label: "XAG/USD — Argento", base: "XAG", quote: "USD", contract: 5000, point: 0.001, decimals: 4, lotStep: 0.01 },
  EURUSD: { label: "EUR/USD", base: "EUR", quote: "USD", contract: 100000, point: 0.0001, decimals: 5, lotStep: 0.01 },
  GBPUSD: { label: "GBP/USD", base: "GBP", quote: "USD", contract: 100000, point: 0.0001, decimals: 5, lotStep: 0.01 },
  USDJPY: { label: "USD/JPY", base: "USD", quote: "JPY", contract: 100000, point: 0.01, decimals: 3, lotStep: 0.01 },
  USDCHF: { label: "USD/CHF", base: "USD", quote: "CHF", contract: 100000, point: 0.0001, decimals: 5, lotStep: 0.01 },
  USDCAD: { label: "USD/CAD", base: "USD", quote: "CAD", contract: 100000, point: 0.0001, decimals: 5, lotStep: 0.01 },
  AUDUSD: { label: "AUD/USD", base: "AUD", quote: "USD", contract: 100000, point: 0.0001, decimals: 5, lotStep: 0.01 },
  NZDUSD: { label: "NZD/USD", base: "NZD", quote: "USD", contract: 100000, point: 0.0001, decimals: 5, lotStep: 0.01 },
  EURGBP: { label: "EUR/GBP", base: "EUR", quote: "GBP", contract: 100000, point: 0.0001, decimals: 5, lotStep: 0.01 },
  EURJPY: { label: "EUR/JPY", base: "EUR", quote: "JPY", contract: 100000, point: 0.01, decimals: 3, lotStep: 0.01 },
  EURCHF: { label: "EUR/CHF", base: "EUR", quote: "CHF", contract: 100000, point: 0.0001, decimals: 5, lotStep: 0.01 },
  EURAUD: { label: "EUR/AUD", base: "EUR", quote: "AUD", contract: 100000, point: 0.0001, decimals: 5, lotStep: 0.01 },
  GBPJPY: { label: "GBP/JPY", base: "GBP", quote: "JPY", contract: 100000, point: 0.01, decimals: 3, lotStep: 0.01 },
  GBPCHF: { label: "GBP/CHF", base: "GBP", quote: "CHF", contract: 100000, point: 0.0001, decimals: 5, lotStep: 0.01 },
  GBPAUD: { label: "GBP/AUD", base: "GBP", quote: "AUD", contract: 100000, point: 0.0001, decimals: 5, lotStep: 0.01 },
  AUDJPY: { label: "AUD/JPY", base: "AUD", quote: "JPY", contract: 100000, point: 0.01, decimals: 3, lotStep: 0.01 },
  CADJPY: { label: "CAD/JPY", base: "CAD", quote: "JPY", contract: 100000, point: 0.01, decimals: 3, lotStep: 0.01 },
  CHFJPY: { label: "CHF/JPY", base: "CHF", quote: "JPY", contract: 100000, point: 0.01, decimals: 3, lotStep: 0.01 },
  NZDJPY: { label: "NZD/JPY", base: "NZD", quote: "JPY", contract: 100000, point: 0.01, decimals: 3, lotStep: 0.01 },
};

const fieldLabel = { display: "block", color: "#93c5fd", fontSize: 13, marginBottom: 6 };
const grid2 = { display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px,1fr))", gap: 12 };
const orderGrid = { display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(280px,1fr))", gap: 14, marginTop: 14 };
const orderRow = { display: "flex", justifyContent: "space-between", gap: 16, padding: "7px 0", borderBottom: "1px solid rgba(51,65,85,.55)" };

const PROP_THEMES = [
  { id:"sky", label:"Azzurro polvere", bg:"rgba(56,189,248,.060)", border:"rgba(125,211,252,.38)", header:"rgba(14,116,144,.15)", accent:"#bae6fd" },
  { id:"sage", label:"Verde salvia", bg:"rgba(74,222,128,.052)", border:"rgba(134,239,172,.34)", header:"rgba(22,101,52,.14)", accent:"#bbf7d0" },
  { id:"lavender", label:"Lavanda", bg:"rgba(192,132,252,.055)", border:"rgba(216,180,254,.34)", header:"rgba(107,33,168,.14)", accent:"#e9d5ff" },
  { id:"amber", label:"Ambra tenue", bg:"rgba(251,191,36,.048)", border:"rgba(253,230,138,.32)", header:"rgba(146,64,14,.13)", accent:"#fef3c7" },
  { id:"rose", label:"Rosa antico", bg:"rgba(251,113,133,.048)", border:"rgba(253,164,175,.32)", header:"rgba(159,18,57,.13)", accent:"#ffe4e6" },
  { id:"teal", label:"Turchese", bg:"rgba(45,212,191,.050)", border:"rgba(94,234,212,.33)", header:"rgba(17,94,89,.14)", accent:"#ccfbf1" },
  { id:"peach", label:"Pesca", bg:"rgba(251,146,60,.047)", border:"rgba(253,186,116,.31)", header:"rgba(154,52,18,.13)", accent:"#ffedd5" },
  { id:"indigo", label:"Indaco tenue", bg:"rgba(129,140,248,.052)", border:"rgba(165,180,252,.33)", header:"rgba(55,48,163,.14)", accent:"#e0e7ff" }
];

function getPropTheme(ch, index=0) {
  return PROP_THEMES.find(x => x.id === ch?.themeId) || PROP_THEMES[index % PROP_THEMES.length];
}

function num(v) {
  const x = Number(String(v ?? "").replace(",", "."));
  return Number.isFinite(x) ? x : 0;
}
function ceilStep(v, step) {
  if (!Number.isFinite(v) || v <= 0) return 0;
  return Math.ceil((v - 1e-12) / step) * step;
}
function fmt(v, d = 2) {
  if (!Number.isFinite(v)) return "—";
  return v.toLocaleString("it-IT", { minimumFractionDigits: d, maximumFractionDigits: d });
}
function signedMoney(v) {
  if (!Number.isFinite(v)) return "—";
  return `${v >= 0 ? "+" : "−"}$ ${fmt(Math.abs(v), 2)}`;
}
function uid() {
  return `prop-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}
function makeChallenge(name, id) {
  return {
    id: id || uid(),
    name,
    asset: "XAUUSD",
    direction: "BUY",
    accountSize: "100000",
    propCost: "350",
    finalProfitTarget: "400",
    risk: "1000",
    slPoints: "700",
    tpProp: "10000",
    leverage: "20",
    maxMarginPct: "50",
    accountBalance: "100000",
    ddMax: "6",
    dailyDdPct: "3",
    propStage: "STEP 1",
    highImpactNewsAllowed: false,
    propNotes: "",
    themeId: "",
    dailyRisk: {
      date: "",
      startEquity: "100000"
    },
    brokerExposure: "0",
    entryPrice: "",
    autoPrice: true,
    active: null,
    hedgeEnabled: true,
    hedgeStoppedAt: null,
    closePropPL: "",
    closeBrokerPL: "",
    operationalChecks: {
      accountBalance: false,
      finalProfitTarget: false,
      risk: false,
      slPoints: false,
      tpProp: false,
      entryPrice: false
    },
  };
}

const DEFAULT_CHALLENGES = [
  makeChallenge("GOAT", "goat"),
  makeChallenge("Finotive", "finotive"),
  makeChallenge("Orion", "orion"),
];

function calcChallenge(ch, live) {
  const a = ASSETS[ch.asset] || ASSETS.XAUUSD;
  const account = num(ch.accountSize);
  const bal = num(ch.accountBalance);
  const dd = num(ch.ddMax);
  const risk = num(ch.risk);
  const sl = num(ch.slPoints);
  const px = num(ch.entryPrice) || num(live?.price);
  const lev = num(ch.leverage);
  const exposure = num(ch.autoBrokerExposure ?? ch.brokerExposure);
  const quoteToUsd = Number.isFinite(Number(live?.quoteToUsd)) && Number(live?.quoteToUsd) > 0
    ? Number(live.quoteToUsd)
    : 1;

  const burnBalance = account * (1 - dd / 100);
  const ddResidual = Math.max(0, bal - burnBalance);
  const riskPct = account > 0 ? (risk / account) * 100 : 0;
  const shots = risk > 0 ? ddResidual / risk : 0;

  // Formula concordata: Lotti Prop = Rischio / SL Distance.
  const propLots = sl > 0 ? risk / sl : 0;

  const marginPct = account > 0 && lev > 0
    ? ((propLots * a.contract * px) / lev / account) * 100
    : 0;

  const maxMarginPct = num(ch.maxMarginPct || "50");
  const marginExceeded = maxMarginPct > 0 && marginPct > maxMarginPct;

  // Formula Broker:
  // quota base per tentativo = (Costo Prop + Guadagno finale desiderato + Esposizione Broker accumulata) / Tiri disponibili
  // TP Broker = quota base × 1,10 per buffer spread/slippage.
  const brokerBasePerShot = shots > 0
    ? (num(ch.propCost) + num(ch.finalProfitTarget) + exposure) / shots
    : 0;

  const brokerTpDollars = brokerBasePerShot * 1.10;

  const slMove = sl * a.point;
  const tpMove = propLots > 0
    ? num(ch.tpProp) / (propLots * a.contract * quoteToUsd)
    : 0;

  const brokerLotsRaw = slMove > 0
    ? brokerTpDollars / (a.contract * slMove * quoteToUsd)
    : 0;

  const brokerLots = ceilStep(brokerLotsRaw, a.lotStep);

  const propSL = ch.direction === "BUY" ? px - slMove : px + slMove;
  const propTPPrice = ch.direction === "BUY" ? px + tpMove : px - tpMove;
  const brokerDirection = ch.direction === "BUY" ? "SELL" : "BUY";
  const brokerTP = propSL;
  const brokerSL = propTPPrice;

  const maxBrokerLoss = Math.abs(propTPPrice - px) * a.contract * brokerLots * quoteToUsd;
  const brokerProfitAtPropSL = Math.abs(propSL - px) * a.contract * brokerLots * quoteToUsd;

  return {
    a, px, quoteToUsd, burnBalance, ddResidual, riskPct, shots,
    propLots, marginPct, maxMarginPct, marginExceeded, brokerBasePerShot, brokerTpDollars, slMove, tpMove,
    brokerLotsRaw, brokerLots, propSL, propTPPrice, brokerDirection,
    brokerTP, brokerSL, maxBrokerLoss, brokerProfitAtPropSL
  };
}

function trackOperation(active, live) {
  if (!active) return null;
  const current = Number.isFinite(Number(live?.price)) ? Number(live.price) : active.entry;
  const quoteToUsd = Number.isFinite(Number(live?.quoteToUsd)) && Number(live?.quoteToUsd) > 0
    ? Number(live.quoteToUsd)
    : active.quoteToUsd || 1;

  const delta = current - active.entry;
  const propSign = active.direction === "BUY" ? 1 : -1;
  const brokerSign = active.brokerDirection === "BUY" ? 1 : -1;

  const propPL = delta * active.contract * active.propLots * propSign * quoteToUsd;
  const brokerPL = delta * active.contract * active.brokerLots * brokerSign * quoteToUsd;

  const propBalanceNow = active.propBalanceStart + propPL;
  const combinedPL = propPL + brokerPL;

  const remainingAdverseDistance = active.brokerDirection === "SELL"
    ? Math.max(0, active.brokerSL - current)
    : Math.max(0, current - active.brokerSL);

  const remainingBrokerLoss = remainingAdverseDistance * active.contract * active.brokerLots * quoteToUsd;

  return {
    current, quoteToUsd, delta, propPL, brokerPL, propBalanceNow,
    combinedPL, remainingBrokerLoss
  };
}

function TextNumberField({
  label,
  value,
  onChange,
  disabled = false,
  placeholder = "",
  operational = false,
  updated = false,
  onOperationalChange = null
}) {
  const accent = updated ? {
    border: "1px solid rgba(34,197,94,.58)",
    background: "rgba(22,163,74,.08)",
    boxShadow: "0 0 0 1px rgba(34,197,94,.05) inset"
  } : {
    border: "1px solid rgba(34,211,238,.38)",
    background: "rgba(8,145,178,.07)",
    boxShadow: "0 0 0 1px rgba(34,211,238,.05) inset"
  };

  const inputAccent = updated ? {
    border:"1px solid rgba(34,197,94,.78)",
    boxShadow:"0 0 12px rgba(34,197,94,.10)",
    background:"#07150d"
  } : {
    border:"1px solid rgba(34,211,238,.72)",
    boxShadow:"0 0 12px rgba(34,211,238,.08)",
    background:"#071525"
  };

  const badge = updated ? {
    text: "AGGIORNATA",
    color:"#86efac",
    border:"1px solid rgba(34,197,94,.42)",
    background:"rgba(22,163,74,.14)"
  } : {
    text: "DA AGGIORNARE",
    color:"#67e8f9",
    border:"1px solid rgba(34,211,238,.35)",
    background:"rgba(8,145,178,.12)"
  };

  return (
    <div style={operational ? {
      padding: "8px 8px 0",
      borderRadius: 14,
      ...accent
    } : undefined}>
      <div style={{display:"flex",justifyContent:"space-between",gap:8,alignItems:"center",marginBottom:6}}>
        <label style={{...fieldLabel,marginBottom:0}}>{label}</label>
        {operational && (
          <span style={{
            fontSize:9,
            fontWeight:900,
            letterSpacing:.55,
            color:badge.color,
            border:badge.border,
            background:badge.background,
            borderRadius:999,
            padding:"3px 6px",
            whiteSpace:"nowrap"
          }}>
            {badge.text}
          </span>
        )}
      </div>
      <input
        style={{
          ...input,
          opacity: disabled ? 0.62 : 1,
          ...(operational ? inputAccent : {})
        }}
        type="text"
        inputMode="decimal"
        autoComplete="off"
        value={value}
        placeholder={placeholder}
        disabled={disabled}
        onFocus={e => e.currentTarget.select()}
        onChange={e => {
          const raw = e.target.value;
          if (/^-?[0-9]*[.,]?[0-9]*$/.test(raw) || raw === "") {
            onChange(raw);
            if (operational && onOperationalChange) onOperationalChange();
          }
        }}
      />
    </div>
  );
}

export default function PropHedgeTab() {
  const [challenges, setChallenges] = useState(DEFAULT_CHALLENGES);
  const [brokerBalance, setBrokerBalance] = useState("5000");
  const [brokerBalanceUpdated, setBrokerBalanceUpdated] = useState(false);
  const [brokerBalanceLoaded, setBrokerBalanceLoaded] = useState(false);
  const [showBrokerAdjust, setShowBrokerAdjust] = useState(false);
  const [brokerAdjustType, setBrokerAdjustType] = useState("deposit");
  const [brokerAdjustAmount, setBrokerAdjustAmount] = useState("");
  const [brokerAdjustNewBalance, setBrokerAdjustNewBalance] = useState("");
  const [brokerAdjustNote, setBrokerAdjustNote] = useState("");
  const [brokerAdjustSaving, setBrokerAdjustSaving] = useState(false);
  const [brokerAdjustments, setBrokerAdjustments] = useState([]);
  const [liveMap, setLiveMap] = useState({});
  const [hydrated, setHydrated] = useState(false);

  // Storico Supabase
  const [historyRows, setHistoryRows] = useState([]);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [historyError, setHistoryError] = useState("");

  // Stato challenge correnti su Supabase
  const [activeSyncLoading, setActiveSyncLoading] = useState(false);
  const [activeSyncLoaded, setActiveSyncLoaded] = useState(false);
  const [activeSyncStatus, setActiveSyncStatus] = useState("");
  const [activeSyncLastAt, setActiveSyncLastAt] = useState(null);
  const [showExistingInit, setShowExistingInit] = useState(false);
  const [existingInitChallengeId, setExistingInitChallengeId] = useState("");
  const [existingInitPropBalance, setExistingInitPropBalance] = useState("");
  const [existingInitBrokerBalance, setExistingInitBrokerBalance] = useState("");
  const [existingInitExposure, setExistingInitExposure] = useState("");
  const [showChallengeRegistry, setShowChallengeRegistry] = useState(false);
  const [registryEditingId, setRegistryEditingId] = useState(null);
  const [registryDraft, setRegistryDraft] = useState(null);
  const [historyFilters, setHistoryFilters] = useState({
    prop: "TUTTE",
    asset: "TUTTI",
    result: "TUTTI"
  });

  useEffect(() => {
    try {
      const savedChallenges = localStorage.getItem("propHedgeV7Challenges");
      if (savedChallenges) {
        const parsed = JSON.parse(savedChallenges);
        if (Array.isArray(parsed) && parsed.length) {
          setChallenges(parsed.map(ch => ({
            ...normalizeChallengeRegistry(ch),
            finalProfitTarget: ch.finalProfitTarget ?? ch.brokerProfitTarget ?? ch.expectedGain ?? "400",
            maxMarginPct: ch.maxMarginPct ?? "50",
            hedgeEnabled: ch.hedgeEnabled !== false,
            hedgeStoppedAt: ch.hedgeStoppedAt ?? null,
            operationalChecks: {
              accountBalance: ch.operationalChecks?.accountBalance ?? false,
              finalProfitTarget: ch.operationalChecks?.finalProfitTarget ?? false,
              risk: ch.operationalChecks?.risk ?? false,
              slPoints: ch.operationalChecks?.slPoints ?? false,
              tpProp: ch.operationalChecks?.tpProp ?? false,
              entryPrice: ch.operationalChecks?.entryPrice ?? false
            }
          })));
        }
      }
    } catch {}
    setHydrated(true);
  }, []);

  useEffect(() => {
    if (!hydrated) return;
    try {
      localStorage.setItem("propHedgeV7Challenges", JSON.stringify(challenges));
    } catch {}
  }, [hydrated, challenges]);

  useEffect(() => {
    if (!hydrated) return;
    const roll = () => {
      const today = todayKey();
      setChallenges(prev => prev.map(ch => {
        if (ch.dailyRisk?.date === today) return ch;
        const account = num(ch.accountSize);
        const equity = num(ch.accountBalance);
        return {
          ...ch,
          dailyRisk: {
            date: today,
            startEquity: String(Math.min(equity || account, account || equity))
          }
        };
      }));
    };
    roll();
    const id = setInterval(roll, 60000);
    return () => clearInterval(id);
  }, [hydrated]);

  const symbolsKey = useMemo(
    () => [...new Set(challenges.map(c => c.asset))].sort().join("|"),
    [challenges]
  );

  const initializeExistingChallenge = async () => {
    const ch = challenges.find(x => x.id === existingInitChallengeId);
    if (!ch) return alert("Seleziona la challenge.");

    const propBalance = Number(existingInitPropBalance);
    const brokerBalanceNow = Number(existingInitBrokerBalance);
    const exposure = Number(existingInitExposure);

    if (!Number.isFinite(propBalance) || propBalance < 0) return alert("Saldo Prop non valido.");
    if (!Number.isFinite(brokerBalanceNow) || brokerBalanceNow < 0) return alert("Saldo Broker non valido.");
    if (!Number.isFinite(exposure) || exposure < 0) return alert("Esposizione Broker non valida.");

    const initializedAt = new Date().toISOString();

    try {
      await saveBrokerBalance(brokerBalanceNow);
      setBrokerBalance(String(Number(brokerBalanceNow.toFixed(2))));
      setBrokerBalanceUpdated(true);

      setChallenges(prev => prev.map(x => x.id === ch.id ? {
        ...x,
        accountBalance: String(propBalance),
        importedExisting: {
          initializedAt,
          brokerBalanceAtImport: brokerBalanceNow,
          brokerExposureBaseline: exposure
        }
      } : x));

      setActiveSyncStatus("✅ Prop esistente inizializzata");
      setShowExistingInit(false);
    } catch (e) {
      console.error(e);
      alert("Errore inizializzazione:\\n\\n" + (e?.message || String(e)));
    }
  };

  const sanitizeChallengeForCloud = (ch) => {
    // Salviamo tutto lo stato utile della challenge, evitando valori non serializzabili.
    return {
      ...ch,
      operationalChecks: ch.operationalChecks || {},
      active: ch.active || null
    };
  };

  const syncActiveChallengesToSupabase = async ({ silent = false } = {}) => {
    if (activeSyncLoading) return false;

    setActiveSyncLoading(true);
    if (!silent) setActiveSyncStatus("Sincronizzazione in corso…");

    try {
      const { data: userData } = await supabase.auth.getUser();
      const uid = userData?.user?.id;
      if (!uid) throw new Error("Utente Supabase non autenticato");

      const rows = challenges.map(ch => ({
        user_id: uid,
        challenge_id: ch.id,
        prop_name: ch.name || "Prop",
        state: sanitizeChallengeForCloud(ch),
        updated_at: new Date().toISOString()
      }));

      if (rows.length) {
        const { error: upsertError } = await supabase
          .from("prop_hedge_active_challenges")
          .upsert(rows, { onConflict: "user_id,challenge_id" });

        if (upsertError) throw upsertError;
      }

      // Rimuove dal cloud eventuali challenge eliminate localmente.
      const { data: cloudRows, error: cloudReadError } = await supabase
        .from("prop_hedge_active_challenges")
        .select("challenge_id");

      if (cloudReadError) throw cloudReadError;

      const localIds = new Set(challenges.map(ch => ch.id));
      const staleIds = (cloudRows || [])
        .map(r => r.challenge_id)
        .filter(id => !localIds.has(id));

      if (staleIds.length) {
        const { error: deleteError } = await supabase
          .from("prop_hedge_active_challenges")
          .delete()
          .in("challenge_id", staleIds);

        if (deleteError) throw deleteError;
      }

      const now = new Date();
      setActiveSyncLastAt(now);
      setActiveSyncStatus("✅ Challenge sincronizzate su Supabase");
      return true;
    } catch (e) {
      console.error("Errore sync challenge correnti:", e);
      setActiveSyncStatus("❌ " + (e?.message || "Errore sincronizzazione challenge"));
      if (!silent) {
        alert("Errore sincronizzazione challenge su Supabase:\n\n" + (e?.message || String(e)));
      }
      return false;
    } finally {
      setActiveSyncLoading(false);
    }
  };

  const loadActiveChallengesFromSupabase = async () => {
    try {
      const { data, error } = await supabase
        .from("prop_hedge_active_challenges")
        .select("challenge_id, prop_name, state, updated_at")
        .order("updated_at", { ascending: true });

      if (error) throw error;

      if (Array.isArray(data) && data.length) {
        const restored = data
          .map(row => row?.state)
          .filter(Boolean)
          .map(ch => ({
            ...normalizeChallengeRegistry(ch),
            operationalChecks: ch.operationalChecks || {
              accountBalance: false,
              finalProfitTarget: false,
              risk: false,
              slPoints: false,
              tpProp: false,
              entryPrice: false
            }
          }));

        if (restored.length) {
          setChallenges(restored);
          const latest = data.reduce((max, row) => {
            const d = new Date(row.updated_at || 0);
            return d > max ? d : max;
          }, new Date(0));
          setActiveSyncLastAt(latest.getTime() ? latest : null);
          setActiveSyncStatus("☁️ Challenge ripristinate da Supabase");
        }
      }

      setActiveSyncLoaded(true);
    } catch (e) {
      console.error("Errore caricamento challenge correnti:", e);
      setActiveSyncStatus("⚠️ Stato cloud non disponibile: uso dati locali");
      setActiveSyncLoaded(true);
    }
  };

  const loadBrokerState = async () => {
    try {
      const { data: userData } = await supabase.auth.getUser();
      const uid = userData?.user?.id;
      if (!uid) throw new Error("Utente Supabase non autenticato");

      const { data, error } = await supabase
        .from("prop_hedge_broker_state")
        .select("current_balance")
        .eq("user_id", uid)
        .maybeSingle();

      if (error) throw error;

      if (!data) {
        const initial = num(brokerBalance) || 0;
        const { error: insertError } = await supabase
          .from("prop_hedge_broker_state")
          .insert({ user_id: uid, current_balance: initial });

        if (insertError) throw insertError;
        setBrokerBalance(String(Number(initial.toFixed(2))));
      } else {
        setBrokerBalance(String(Number(Number(data.current_balance || 0).toFixed(2))));
      }

      setBrokerBalanceLoaded(true);
    } catch (e) {
      console.error("Errore caricamento saldo Broker:", e);
      setBrokerBalanceLoaded(false);
    }
  };

  const loadBrokerAdjustments = async () => {
    try {
      const { data, error } = await supabase
        .from("prop_hedge_broker_adjustments")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(100);

      if (error) throw error;
      setBrokerAdjustments(data || []);
    } catch (e) {
      console.error("Errore caricamento movimenti Broker:", e);
    }
  };

  const saveBrokerBalance = async (newBalance) => {
    const { data: userData } = await supabase.auth.getUser();
    const uid = userData?.user?.id;
    if (!uid) throw new Error("Utente Supabase non autenticato");

    const { error } = await supabase
      .from("prop_hedge_broker_state")
      .upsert(
        {
          user_id: uid,
          current_balance: Number(newBalance),
          updated_at: new Date().toISOString()
        },
        { onConflict: "user_id" }
      );

    if (error) throw error;
  };

  const applyBrokerAdjustment = async () => {
    if (brokerAdjustSaving) return;

    const before = num(brokerBalance);
    let after = before;
    let amount = 0;

    if (brokerAdjustType === "correction") {
      after = num(brokerAdjustNewBalance);
      amount = after - before;
    } else {
      amount = Math.abs(num(brokerAdjustAmount));
      if (!amount) {
        alert("Inserisci un importo.");
        return;
      }
      after = brokerAdjustType === "deposit" ? before + amount : before - amount;
    }

    if (!Number.isFinite(after) || after < 0) {
      alert("Il saldo Broker risultante non è valido.");
      return;
    }

    setBrokerAdjustSaving(true);

    try {
      const { data: userData } = await supabase.auth.getUser();
      const uid = userData?.user?.id;
      if (!uid) throw new Error("Utente Supabase non autenticato");

      const movement = brokerAdjustType === "deposit"
        ? Math.abs(amount)
        : brokerAdjustType === "withdrawal"
          ? -Math.abs(amount)
          : amount;

      const { error: adjustmentError } = await supabase
        .from("prop_hedge_broker_adjustments")
        .insert({
          user_id: uid,
          adjustment_type: brokerAdjustType,
          amount: movement,
          balance_before: before,
          balance_after: after,
          note: brokerAdjustNote.trim() || null
        });

      if (adjustmentError) throw adjustmentError;

      await saveBrokerBalance(after);

      setBrokerBalance(String(Number(after.toFixed(2))));
      setBrokerBalanceUpdated(true);
      setBrokerAdjustAmount("");
      setBrokerAdjustNewBalance("");
      setBrokerAdjustNote("");
      setShowBrokerAdjust(false);
      await loadBrokerAdjustments();
    } catch (e) {
      console.error("Errore rettifica saldo Broker:", e);
      alert("Errore nella modifica del saldo Broker: " + (e?.message || String(e)));
    } finally {
      setBrokerAdjustSaving(false);
    }
  };

  const loadHistory = async () => {
    setHistoryLoading(true);
    setHistoryError("");
    try {
      const { data, error } = await supabase
        .from("prop_hedge_operations")
        .select("*")
        .order("closed_at", { ascending: false })
        .limit(500);

      if (error) throw error;
      setHistoryRows(data || []);
    } catch (e) {
      console.error("Errore storico Prop Hedge:", e);
      setHistoryError(e?.message || "Errore caricamento storico");
    } finally {
      setHistoryLoading(false);
    }
  };

  useEffect(() => {
    loadHistory();
    loadBrokerState();
    loadBrokerAdjustments();
    loadActiveChallengesFromSupabase();
  }, []);

  useEffect(() => {
    if (!hydrated || !activeSyncLoaded) return;

    const id = setTimeout(() => {
      syncActiveChallengesToSupabase({ silent: true });
    }, 1800);

    return () => clearTimeout(id);
  }, [hydrated, activeSyncLoaded, challenges]);

  const refreshSymbol = async (symbol) => {
    try {
      setLiveMap(prev => ({
        ...prev,
        [symbol]: { ...(prev[symbol] || {}), status: "loading" }
      }));

      const r = await fetch(`/api/prop-price?symbol=${encodeURIComponent(symbol)}&t=${Date.now()}`, { cache: "no-store" });
      const data = await r.json();

      if (!r.ok || !Number.isFinite(Number(data.price))) {
        throw new Error(data.error || "Prezzo non disponibile");
      }

      const price = Number(data.price);
      const live = {
        status: "live",
        price,
        bid: data.bid ?? null,
        ask: data.ask ?? null,
        source: data.source ?? "",
        time: data.time ?? new Date().toISOString(),
        quoteToUsd: Number.isFinite(Number(data.quoteToUsd)) ? Number(data.quoteToUsd) : 1
      };

      setLiveMap(prev => ({ ...prev, [symbol]: live }));

      setChallenges(prev => prev.map(ch => {
        if (ch.asset !== symbol || ch.active || !ch.autoPrice) return ch;
        const a = ASSETS[symbol] || ASSETS.XAUUSD;
        return {
          ...ch,
          entryPrice: price.toFixed(a.decimals),
          operationalChecks: {
            ...(ch.operationalChecks || {}),
            entryPrice: true
          }
        };
      }));
    } catch (e) {
      setLiveMap(prev => ({
        ...prev,
        [symbol]: { ...(prev[symbol] || {}), status: "error" }
      }));
    }
  };

  useEffect(() => {
    const symbols = symbolsKey ? symbolsKey.split("|") : [];
    symbols.forEach(refreshSymbol);

    const id = setInterval(() => {
      symbols.forEach(refreshSymbol);
    }, 2000);

    return () => clearInterval(id);
  }, [symbolsKey]);

  const setChallenge = (id, patch) => {
    setChallenges(prev => prev.map(ch => ch.id === id ? { ...ch, ...patch } : ch));
  };

  const markOperationalUpdated = (id, key) => {
    setChallenges(prev => prev.map(ch => {
      if (ch.id !== id) return ch;
      return {
        ...ch,
        operationalChecks: {
          ...(ch.operationalChecks || {}),
          [key]: true
        }
      };
    }));
  };

  const resetOperationalChecks = (ch) => ({
    ...(ch.operationalChecks || {}),
    accountBalance: false,
    finalProfitTarget: false,
    risk: false,
    slPoints: false,
    tpProp: false,
    entryPrice: false
  });

  const todayKey = () => {
    const d = new Date();
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, "0");
    const day = String(d.getDate()).padStart(2, "0");
    return `${y}-${m}-${day}`;
  };

  const normalizeChallengeRegistry = (ch) => ({
    ...ch,
    propStage: ch.propStage || "STEP 1",
    dailyDdPct: ch.dailyDdPct ?? "3",
    highImpactNewsAllowed: ch.highImpactNewsAllowed === true,
    propNotes: ch.propNotes || "",
    themeId: ch.themeId || "",
    dailyRisk: ch.dailyRisk?.date ? ch.dailyRisk : {
      date: todayKey(),
      startEquity: String(Math.min(num(ch.accountBalance || ch.accountSize), num(ch.accountSize) || num(ch.accountBalance)))
    }
  });

  const addChallenge = () => {
    const fresh = {
      ...normalizeChallengeRegistry(makeChallenge(`Prop ${challenges.length + 1}`)),
      themeId: PROP_THEMES[challenges.length % PROP_THEMES.length].id
    };
    setRegistryEditingId(null);
    setRegistryDraft(fresh);
    setShowChallengeRegistry(true);
  };

  const openChallengeRegistry = (ch) => {
    setRegistryEditingId(ch.id);
    setRegistryDraft(normalizeChallengeRegistry(ch));
    setShowChallengeRegistry(true);
  };

  const saveChallengeRegistry = () => {
    if (!registryDraft) return;
    const d = normalizeChallengeRegistry(registryDraft);
    if (!String(d.name || "").trim()) return alert("Inserisci il nome della Prop / challenge.");
    if (num(d.accountSize) <= 0) return alert("Inserisci il valore della Prop.");
    if (num(d.ddMax) <= 0) return alert("Inserisci il DD massimo.");
    if (num(d.dailyDdPct) <= 0) return alert("Inserisci il DD giornaliero.");

    const startEquity = Math.min(num(d.accountBalance || d.accountSize), num(d.accountSize));
    const saved = {
      ...d,
      name: String(d.name).trim(),
      dailyRisk: registryEditingId && d.dailyRisk
        ? d.dailyRisk
        : { date: todayKey(), startEquity: String(startEquity) }
    };

    setChallenges(prev => registryEditingId
      ? prev.map(ch => ch.id === registryEditingId ? saved : ch)
      : [...prev, saved]
    );
    setShowChallengeRegistry(false);
    setRegistryDraft(null);
    setRegistryEditingId(null);
  };

  const refreshDailyBaselineIfNeeded = (ch) => {
    const today = todayKey();
    if (ch.dailyRisk?.date === today) return ch;
    const account = num(ch.accountSize);
    const equity = num(ch.accountBalance);
    return {
      ...ch,
      dailyRisk: {
        date: today,
        startEquity: String(Math.min(equity || account, account || equity))
      }
    };
  };

  const dailyRiskInfo = (ch, tracking = null) => {
    const normalized = refreshDailyBaselineIfNeeded(ch);
    const account = num(normalized.accountSize);
    const startEquity = Math.min(num(normalized.dailyRisk?.startEquity) || account, account);
    const pct = num(normalized.dailyDdPct);
    const limit = startEquity * pct / 100;
    const currentEquity = tracking ? num(tracking.propBalanceNow) : num(normalized.accountBalance);
    const used = Math.max(0, startEquity - currentEquity);
    const remaining = limit - used;
    const usedPct = limit > 0 ? (used / limit) * 100 : 0;
    return { startEquity, pct, limit, currentEquity, used, remaining, usedPct };
  };

  const removeChallenge = (id) => {
    const ch = challenges.find(x => x.id === id);
    if (ch?.active) {
      alert("Chiudi o annulla prima l'operazione attiva.");
      return;
    }
    setChallenges(prev => prev.filter(ch => ch.id !== id));
  };

  const stopHedge = (id) => {
    const ch = challenges.find(x => x.id === id);
    if (!ch || ch.hedgeEnabled === false) return;

    const activeNote = ch.active
      ? "\n\nL'operazione Broker già attiva NON verrà chiusa: continuerà ad essere monitorata fino alla normale chiusura o annullamento."
      : "";

    const confirmed = window.confirm(
      `Disattivare le NUOVE coperture Broker per ${ch.name || "questa challenge"}?${activeNote}`
    );
    if (!confirmed) return;

    setChallenge(id, {
      hedgeEnabled: false,
      hedgeStoppedAt: new Date().toISOString()
    });
  };

  const reactivateHedge = (id) => {
    const ch = challenges.find(x => x.id === id);
    if (!ch || ch.hedgeEnabled !== false) return;

    setChallenge(id, {
      hedgeEnabled: true,
      hedgeStoppedAt: null
    });
  };


  const challengeExposureMap = useMemo(() => {
    const result = {};

    for (const ch of challenges) {
      const matching = historyRows.filter(row => {
        if (row.challenge_id) return row.challenge_id === ch.id;
        return row.prop_name === ch.name;
      });

      const brokerNet = matching.reduce(
        (sum, row) => sum + Number(row.broker_pl || 0),
        0
      );

      const importedBaseline = num(ch?.importedExisting?.brokerExposureBaseline);
      result[ch.id] = Math.max(0, importedBaseline + Math.max(0, -brokerNet));
    }

    return result;
  }, [historyRows, challenges]);

  const calcs = useMemo(() => {
    const map = {};
    for (const ch of challenges) {
      map[ch.id] = calcChallenge(
        { ...ch, autoBrokerExposure: challengeExposureMap[ch.id] ?? 0 },
        liveMap[ch.asset]
      );
    }
    return map;
  }, [challenges, liveMap, challengeExposureMap]);

  const trackings = useMemo(() => {
    const map = {};
    for (const ch of challenges) {
      if (ch.active) map[ch.id] = trackOperation(ch.active, liveMap[ch.active.asset]);
    }
    return map;
  }, [challenges, liveMap]);

  const activeChallenges = challenges.filter(ch => ch.active);

  const floatingBrokerPL = activeChallenges.reduce(
    (sum, ch) => sum + (trackings[ch.id]?.brokerPL || 0),
    0
  );

  const brokerEquity = num(brokerBalance) + floatingBrokerPL;

  const activeRemainingExposure = activeChallenges.reduce(
    (sum, ch) => sum + (trackings[ch.id]?.remainingBrokerLoss || 0),
    0
  );

  const brokerNetByAsset = useMemo(() => {
    const net = {};
    for (const ch of activeChallenges) {
      const op = ch.active;
      const signedLots = op.brokerDirection === "BUY" ? op.brokerLots : -op.brokerLots;
      net[op.asset] = (net[op.asset] || 0) + signedLots;
    }
    return net;
  }, [challenges]);

  const placeTrade = (id) => {
    const ch = challenges.find(x => x.id === id);
    const c = calcs[id];
    const hedgeEnabledAtEntry = ch?.hedgeEnabled !== false;

    // Con STOP HEDGE la Prop resta pienamente tradabile: viene monitorata normalmente,
    // ma la nuova gamba Broker parte a 0 lotti e quindi non modifica il saldo Broker.
    if (!ch || !c || !c.px || !c.propLots || (hedgeEnabledAtEntry && !c.brokerLots)) {
      alert("Controlla prezzo, rischio e SL.");
      return;
    }

    const dr = dailyRiskInfo(ch, trackings[id]);
    if (dr.limit > 0 && dr.remaining <= num(ch.risk)) {
      const okRisk = window.confirm(
        `🚨 ATTENZIONE DD GIORNALIERO — ${ch.name}\n\n` +
        `Baseline oggi: $ ${fmt(dr.startEquity,2)}\n` +
        `DD massimo oggi: $ ${fmt(dr.limit,2)}\n` +
        `DD residuo: $ ${fmt(dr.remaining,2)}\n` +
        `Rischio impostato: $ ${fmt(num(ch.risk),2)}\n\n` +
        `QUESTO TRADE PUÒ PORTARTI OLTRE IL DD GIORNALIERO.\n\nProcedere comunque?`
      );
      if (!okRisk) return;
    }

    if (ch.highImpactNewsAllowed === false) {
      const okNews = window.confirm(
        `🚨 REGOLE PROP — ${ch.name}\n\n` +
        `Questa challenge NON consente operazioni durante notizie ad alto impatto.\n\n` +
        `Verifica il calendario economico prima di procedere.\n\nHai verificato e vuoi procedere?`
      );
      if (!okNews) return;
    }

    setChallenge(id, {
      active: {
        asset: ch.asset,
        label: c.a.label,
        decimals: c.a.decimals,
        contract: c.a.contract,
        entry: c.px,
        direction: ch.direction,
        brokerDirection: c.brokerDirection,
        propLots: c.propLots,
        brokerLots: hedgeEnabledAtEntry ? c.brokerLots : 0,
        propTP: c.propTPPrice,
        propSL: c.propSL,
        brokerTP: c.brokerTP,
        brokerSL: c.brokerSL,
        propBalanceStart: num(ch.accountBalance),
        brokerBalanceStart: num(brokerBalance),
        quoteToUsd: c.quoteToUsd,
        maxBrokerLossAtEntry: hedgeEnabledAtEntry ? c.maxBrokerLoss : 0,
        hedgeEnabledAtEntry,
        placedAt: new Date().toISOString()
      },
      closePropPL: "",
      closeBrokerPL: ""
    });
  };

  const cancelTrade = (id) => {
    const live = liveMap[challenges.find(c => c.id === id)?.asset];
    const a = ASSETS[challenges.find(c => c.id === id)?.asset] || ASSETS.XAUUSD;
    setChallenges(prev => prev.map(ch => {
      if (ch.id !== id) return ch;
      return {
        ...ch,
        active: null,
        closePropPL: "",
        closeBrokerPL: "",
        autoPrice: true,
        operationalChecks: resetOperationalChecks(ch),
        entryPrice: Number.isFinite(Number(live?.price)) ? Number(live.price).toFixed(a.decimals) : ch.entryPrice
      };
    }));
  };

  const closeAndUpdate = async (id) => {
    const ch = challenges.find(x => x.id === id);
    const tracking = trackings[id];
    if (!ch?.active || !tracking) return;

    const propPLFinal = ch.closePropPL === "" ? tracking.propPL : num(ch.closePropPL);
    const brokerPLFinal = ch.closeBrokerPL === "" ? tracking.brokerPL : num(ch.closeBrokerPL);

    const newPropBalance = ch.active.propBalanceStart + propPLFinal;
    const newBrokerRealizedBalance = num(brokerBalance) + brokerPLFinal;
    const live = liveMap[ch.active.asset];
    const a = ASSETS[ch.active.asset];

    const historyRecord = {
      challenge_id: ch.id,
      prop_name: ch.name || "Prop",
      asset: ch.active.asset,
      prop_direction: ch.active.direction,
      broker_direction: ch.active.brokerDirection,

      opened_at: ch.active.placedAt,
      closed_at: new Date().toISOString(),

      account_size: num(ch.accountSize),
      prop_balance_start: ch.active.propBalanceStart,
      prop_balance_end: newPropBalance,
      broker_balance_start: ch.active.brokerBalanceStart ?? num(brokerBalance),
      broker_balance_end: newBrokerRealizedBalance,

      prop_cost: num(ch.propCost),
      final_profit_target: num(ch.finalProfitTarget),
      risk_usd: num(ch.risk),
      sl_distance: num(ch.slPoints),
      tp_prop_usd: num(ch.tpProp),
      dd_max_pct: num(ch.ddMax),
      max_margin_pct: num(ch.maxMarginPct),
      leverage: num(ch.leverage),
      broker_exposure_start: challengeExposureMap[ch.id] ?? 0,

      entry_price: ch.active.entry,
      exit_price: tracking.current,

      prop_lots: ch.active.propLots,
      broker_lots: ch.active.brokerLots,

      prop_tp_price: ch.active.propTP,
      prop_sl_price: ch.active.propSL,
      broker_tp_price: ch.active.brokerTP,
      broker_sl_price: ch.active.brokerSL,

      tp_broker_target_usd: calcChallenge({ ...ch, autoBrokerExposure: challengeExposureMap[ch.id] ?? 0 }, liveMap[ch.asset]).brokerTpDollars,
      broker_profit_at_prop_sl: calcChallenge({ ...ch, autoBrokerExposure: challengeExposureMap[ch.id] ?? 0 }, liveMap[ch.asset]).brokerProfitAtPropSL,
      broker_max_loss: ch.active.maxBrokerLossAtEntry ?? calcChallenge({ ...ch, autoBrokerExposure: challengeExposureMap[ch.id] ?? 0 }, liveMap[ch.asset]).maxBrokerLoss,

      prop_pl: propPLFinal,
      broker_pl: brokerPLFinal,
      combined_pl: propPLFinal + brokerPLFinal,

      used_manual_prop_pl: ch.closePropPL !== "",
      used_manual_broker_pl: ch.closeBrokerPL !== "",

      status: "closed",
      metadata: {
        quote_to_usd: tracking.quoteToUsd,
        live_source: live?.source || "",
        live_time: live?.time || null
      }
    };

    try {
      const { data: insertedRows, error } = await supabase
        .from("prop_hedge_operations")
        .insert(historyRecord)
        .select("id")
        .limit(1);

      if (error) throw error;

      const insertedId = insertedRows?.[0]?.id || null;

      try {
        await saveBrokerBalance(newBrokerRealizedBalance);
      } catch (balanceError) {
        if (insertedId) {
          await supabase
            .from("prop_hedge_operations")
            .delete()
            .eq("id", insertedId);
        }
        throw balanceError;
      }
    } catch (e) {
      console.error("Errore salvataggio storico Prop Hedge:", e);
      alert(
        "❌ Non ho salvato l'operazione nello storico Supabase.\\n\\n" +
        (e?.message || String(e)) +
        "\\n\\nL'operazione resta aperta: puoi riprovare senza perdere i dati."
      );
      return;
    }

    setBrokerBalance(String(Number(newBrokerRealizedBalance.toFixed(2))));
    setBrokerBalanceUpdated(false);

    setChallenges(prev => prev.map(row => {
      if (row.id !== id) return row;
      return {
        ...row,
        accountBalance: String(Number(newPropBalance.toFixed(2))),
        active: null,
        closePropPL: "",
        closeBrokerPL: "",
        autoPrice: true,
        operationalChecks: resetOperationalChecks(row),
        entryPrice: Number.isFinite(Number(live?.price))
          ? Number(live.price).toFixed(a.decimals)
          : row.entryPrice
      };
    }));

    await Promise.all([
      loadHistory(),
      loadBrokerState(),
      loadBrokerAdjustments()
    ]);
  };

  const totalCombinedPL = activeChallenges.reduce(
    (sum, ch) => sum + (trackings[ch.id]?.combinedPL || 0),
    0
  );

  const safetyFor = (id) => {
    const c = calcs[id];
    const ch = challenges.find(x => x.id === id);
    if (!c || ch?.active) return null;

    const projectedExposure = activeRemainingExposure + c.maxBrokerLoss;
    const requiredWithBuffer = projectedExposure * 1.20;

    let level = "red";
    if (brokerEquity >= requiredWithBuffer) level = "green";
    else if (brokerEquity >= projectedExposure) level = "yellow";

    return {
      level,
      projectedExposure,
      requiredWithBuffer,
      projectedResidual: brokerEquity - projectedExposure
    };
  };

  const filteredHistory = useMemo(() => {
    return historyRows.filter(row => {
      const propMatch = historyFilters.prop === "TUTTE" || row.prop_name === historyFilters.prop;
      const assetMatch = historyFilters.asset === "TUTTI" || row.asset === historyFilters.asset;
      const resultMatch =
        historyFilters.result === "TUTTI" ||
        (historyFilters.result === "POSITIVO" && Number(row.combined_pl || 0) > 0) ||
        (historyFilters.result === "NEGATIVO" && Number(row.combined_pl || 0) < 0) ||
        (historyFilters.result === "PARI" && Number(row.combined_pl || 0) === 0);

      return propMatch && assetMatch && resultMatch;
    });
  }, [historyRows, historyFilters]);

  const historyStats = useMemo(() => {
    return filteredHistory.reduce((acc, row) => {
      acc.count += 1;
      acc.propPL += Number(row.prop_pl || 0);
      acc.brokerPL += Number(row.broker_pl || 0);
      acc.combinedPL += Number(row.combined_pl || 0);
      if (Number(row.combined_pl || 0) > 0) acc.wins += 1;
      if (Number(row.combined_pl || 0) < 0) acc.losses += 1;
      return acc;
    }, { count:0, propPL:0, brokerPL:0, combinedPL:0, wins:0, losses:0 });
  }, [filteredHistory]);

  const historyPropOptions = useMemo(
    () => [...new Set(historyRows.map(r => r.prop_name).filter(Boolean))].sort(),
    [historyRows]
  );

  const historyAssetOptions = useMemo(
    () => [...new Set(historyRows.map(r => r.asset).filter(Boolean))].sort(),
    [historyRows]
  );


  const safetyStyle = {
    green: { icon:"🟢", title:"CAPITALE SUFFICIENTE", bg:"rgba(34,197,94,.12)", border:"rgba(34,197,94,.45)", color:"#86efac" },
    yellow:{ icon:"🟡", title:"ATTENZIONE — BUFFER RIDOTTO", bg:"rgba(245,158,11,.12)", border:"rgba(245,158,11,.48)", color:"#fde68a" },
    red:   { icon:"🔴", title:"CAPITALE INSUFFICIENTE", bg:"rgba(239,68,68,.12)", border:"rgba(239,68,68,.48)", color:"#fca5a5" }
  };

  return (
    <>
      <style>{`
        @keyframes propMarginBlink {
          0%, 100% { opacity: 1; text-shadow: 0 0 0 rgba(239,68,68,0); }
          50% { opacity: .28; text-shadow: 0 0 16px rgba(239,68,68,.95); }
        }
        .prop-margin-alert-blink { animation: propMarginBlink .85s infinite; }
        .prop-margin-alert-box { animation: propMarginBlink 1.15s infinite; }
      `}</style>
      <div style={{ display:"flex", flexDirection:"column", gap:16 }}>
      {showChallengeRegistry && registryDraft && (
        <div style={{
          position:"fixed",inset:0,zIndex:9999,background:"rgba(2,6,23,.82)",
          display:"flex",alignItems:"center",justifyContent:"center",padding:20
        }}>
          <div style={{
            width:"min(980px,96vw)",maxHeight:"92vh",overflowY:"auto",
            borderRadius:20,border:"1px solid rgba(56,189,248,.38)",
            background:"#07111f",boxShadow:"0 25px 80px rgba(0,0,0,.55)",padding:20
          }}>
            <div style={{display:"flex",justifyContent:"space-between",gap:12,alignItems:"center",marginBottom:16}}>
              <div>
                <div style={{fontSize:21,fontWeight:950,color:"#f8fafc"}}>📋 {registryEditingId ? "SCHEDA PROP" : "NUOVA CHALLENGE PROP"}</div>
                <div style={{fontSize:12,color:"#94a3b8",marginTop:3}}>Anagrafica e regole operative della challenge.</div>
              </div>
              <button style={secondaryButton} onClick={()=>{setShowChallengeRegistry(false);setRegistryDraft(null);setRegistryEditingId(null);}}>✕ Chiudi</button>
            </div>

            <div style={grid2}>
              <div><label style={fieldLabel}>Prop Firm / Nome challenge</label><input style={input} value={registryDraft.name || ""} onChange={e=>setRegistryDraft(d=>({...d,name:e.target.value}))}/></div>
              <div><label style={fieldLabel}>Fase</label><select style={input} value={registryDraft.propStage || "STEP 1"} onChange={e=>setRegistryDraft(d=>({...d,propStage:e.target.value}))}><option>STEP 1</option><option>STEP 2</option><option>FUNDED / REAL</option></select></div>
              <TextNumberField label="Valore Prop / Account Size ($)" value={registryDraft.accountSize || ""} onChange={v=>setRegistryDraft(d=>({...d,accountSize:v,accountBalance: registryEditingId ? d.accountBalance : v}))}/>
              <TextNumberField label="TP Prop ($)" value={registryDraft.tpProp || ""} onChange={v=>setRegistryDraft(d=>({...d,tpProp:v}))}/>
              <TextNumberField label="DD Max Prop (%)" value={registryDraft.ddMax || ""} onChange={v=>setRegistryDraft(d=>({...d,ddMax:v}))}/>
              <TextNumberField label="DD giornaliero Prop (%)" value={registryDraft.dailyDdPct || ""} onChange={v=>setRegistryDraft(d=>({...d,dailyDdPct:v}))}/>
              <TextNumberField label="Costo Prop ($)" value={registryDraft.propCost || ""} onChange={v=>setRegistryDraft(d=>({...d,propCost:v}))}/>
              <TextNumberField label="Guadagno finale desiderato ($)" value={registryDraft.finalProfitTarget || ""} onChange={v=>setRegistryDraft(d=>({...d,finalProfitTarget:v}))}/>
              <TextNumberField label="Leva" value={registryDraft.leverage || ""} onChange={v=>setRegistryDraft(d=>({...d,leverage:v}))}/>
              <TextNumberField label="Margine massimo consentito (%)" value={registryDraft.maxMarginPct || ""} onChange={v=>setRegistryDraft(d=>({...d,maxMarginPct:v}))}/>
              <div>
                <label style={fieldLabel}>Operazioni durante news ad alto impatto</label>
                <select style={input} value={registryDraft.highImpactNewsAllowed ? "SI" : "NO"} onChange={e=>setRegistryDraft(d=>({...d,highImpactNewsAllowed:e.target.value==="SI"}))}>
                  <option value="NO">NO — non consentite</option>
                  <option value="SI">SÌ — consentite</option>
                </select>
              </div>
              <div>
                <label style={fieldLabel}>🎨 Colore identificativo</label>
                <select style={input} value={registryDraft.themeId || ""} onChange={e=>setRegistryDraft(d=>({...d,themeId:e.target.value}))}>
                  <option value="">Automatico</option>
                  {PROP_THEMES.map(x=><option key={x.id} value={x.id}>{x.label}</option>)}
                </select>
              </div>
              <div><label style={fieldLabel}>Note / regole particolari</label><textarea style={{...input,minHeight:82,resize:"vertical"}} value={registryDraft.propNotes || ""} onChange={e=>setRegistryDraft(d=>({...d,propNotes:e.target.value}))}/></div>
            </div>

            <div style={{marginTop:14,padding:"12px 14px",borderRadius:14,border:"1px solid rgba(245,158,11,.35)",background:"rgba(120,53,15,.10)",color:"#fde68a",fontSize:12}}>
              🛡️ DD giornaliero prudenziale: a ogni nuovo giorno la baseline è il minore tra saldo/equity corrente e valore iniziale della Prop. Se sei sopra il valore iniziale, il limite non aumenta.
            </div>

            <div style={{display:"flex",justifyContent:"flex-end",gap:10,marginTop:18}}>
              <button style={secondaryButton} onClick={()=>{setShowChallengeRegistry(false);setRegistryDraft(null);setRegistryEditingId(null);}}>Annulla</button>
              <button style={primaryButtonBlue} onClick={saveChallengeRegistry}>💾 Salva scheda Prop</button>
            </div>
          </div>
        </div>
      )}
      <div style={{ display:"flex", justifyContent:"space-between", gap:12, flexWrap:"wrap", alignItems:"flex-start" }}>
        <div>
          <h2 style={sectionTitle}>📈 Prop Hedge — Multi Challenge</h2>
          <p style={sectionDescription}>
            Più Prop contemporaneamente, un unico Broker condiviso e controllo dell'esposizione aggregata.
          </p>
        </div>
        <div style={{display:"flex",gap:8,flexWrap:"wrap",alignItems:"center"}}>
          <button
            style={secondaryButton}
            onClick={()=>{
              const ch = challenges[0];
              setExistingInitChallengeId(ch?.id || "");
              setExistingInitPropBalance(ch?.accountBalance ?? "");
              setExistingInitBrokerBalance(brokerBalance ?? "");
              setExistingInitExposure(ch?.importedExisting?.brokerExposureBaseline ?? "");
              setShowExistingInit(true);
            }}
          >
            ⚙️ Inizializza Prop esistente
          </button>

          <button
            style={secondaryButton}
            disabled={activeSyncLoading}
            onClick={()=>syncActiveChallengesToSupabase({ silent:false })}
          >
            {activeSyncLoading ? "☁️ Sincronizzo…" : "☁️ Sincronizza ora"}
          </button>

          <button style={primaryButtonBlue} onClick={addChallenge}>+ Aggiungi Challenge</button>
        </div>
      </div>

      <div style={{
        display:"flex",
        justifyContent:"space-between",
        gap:10,
        flexWrap:"wrap",
        alignItems:"center",
        padding:"9px 12px",
        borderRadius:13,
        border:"1px solid rgba(99,102,241,.25)",
        background:"rgba(49,46,129,.06)",
        color:"#a5b4fc",
        fontSize:11
      }}>
        <span>
          <b>☁️ Stato challenge:</b>{" "}
          {activeSyncStatus || (activeSyncLoaded ? "Pronto" : "Caricamento da Supabase…")}
        </span>
        <span style={{color:"#94a3b8"}}>
          {activeSyncLastAt
            ? `Ultima sync: ${new Date(activeSyncLastAt).toLocaleString("it-IT")}`
            : "Nessuna sincronizzazione registrata"}
        </span>
      </div>

      <div style={{
        padding:"10px 12px",
        borderRadius:14,
        border:"1px solid rgba(34,211,238,.28)",
        background:"rgba(8,145,178,.06)",
        color:"#bae6fd",
        fontSize:12
      }}>
        <b style={{color:"#67e8f9"}}>Campi evidenziati = da controllare/aggiornare a ogni operazione.</b>
        {" "}Gli altri parametri sono normalmente strutturali della challenge.
      </div>

      {showExistingInit && (
        <div style={{position:"fixed",inset:0,zIndex:9999,background:"rgba(2,6,23,.84)",display:"flex",alignItems:"center",justifyContent:"center",padding:20}}>
          <div style={{width:"min(560px,96vw)",padding:18,borderRadius:18,background:"#07111f",border:"1px solid rgba(56,189,248,.4)",boxShadow:"0 24px 80px rgba(0,0,0,.6)"}}>
            <div style={{fontSize:19,fontWeight:950,color:"#e2e8f0"}}>⚙️ Inizializza Prop già in corso</div>
            <div style={{fontSize:11,color:"#94a3b8",margin:"5px 0 15px"}}>
              Fotografa la situazione reale di partenza. L'esposizione inserita diventa solo la baseline iniziale; da qui in avanti il sistema continua a calcolarla automaticamente.
            </div>

            <label style={{fontSize:11,color:"#94a3b8"}}>Challenge</label>
            <select style={input} value={existingInitChallengeId} onChange={e=>{
              const id=e.target.value, c=challenges.find(x=>x.id===id);
              setExistingInitChallengeId(id);
              setExistingInitPropBalance(c?.accountBalance ?? "");
              setExistingInitExposure(c?.importedExisting?.brokerExposureBaseline ?? "");
            }}>
              {challenges.map(ch=><option key={ch.id} value={ch.id}>{ch.name || "Prop"}</option>)}
            </select>

            <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:10}}>
              <div>
                <label style={{fontSize:11,color:"#94a3b8"}}>Saldo Prop attuale €</label>
                <input type="number" step="0.01" style={input} value={existingInitPropBalance} onChange={e=>setExistingInitPropBalance(e.target.value)} />
              </div>
              <div>
                <label style={{fontSize:11,color:"#94a3b8"}}>Saldo Broker reale €</label>
                <input type="number" step="0.01" style={input} value={existingInitBrokerBalance} onChange={e=>setExistingInitBrokerBalance(e.target.value)} />
              </div>
            </div>

            <label style={{fontSize:11,color:"#94a3b8"}}>Esposizione Broker attuale €</label>
            <input type="number" min="0" step="0.01" style={input} value={existingInitExposure} onChange={e=>setExistingInitExposure(e.target.value)} />

            <div style={{padding:"10px 11px",borderRadius:11,border:"1px solid rgba(245,158,11,.3)",background:"rgba(180,83,9,.08)",color:"#fde68a",fontSize:11}}>
              Baseline iniziale + perdite Broker già registrate nello storico = esposizione automatica corrente. Non dovrai reinserire questo valore a ogni trade.
            </div>

            <div style={{display:"flex",justifyContent:"flex-end",gap:8,marginTop:16}}>
              <button style={secondaryButton} onClick={()=>setShowExistingInit(false)}>Annulla</button>
              <button style={primaryButtonBlue} onClick={initializeExistingChallenge}>💾 Imposta stato iniziale</button>
            </div>
          </div>
        </div>
      )}

      <MarketEnginePanel
        defaultAsset="XAUUSD"
        challenges={challenges}
        onApplyDirection={(challengeId, suggestedDirection) => {
          // Anche con STOP HEDGE il Market Engine può impostare la direzione della Prop.
          // Lo stop riguarda esclusivamente la nuova gamba Broker.
          setChallenge(challengeId, { direction: suggestedDirection });
        }}
      />

      <div style={{
        ...panel,
        border:"1px solid rgba(56,189,248,.34)",
        background:"linear-gradient(135deg,rgba(14,116,144,.10),rgba(15,23,42,.96))"
      }}>
        <div style={panelHeader}>
          <div>
            <h3 style={panelTitle}>🏦 Broker centrale</h3>
            <p style={panelSubtitle}>Il saldo è condiviso da tutte le coperture attive.</p>
          </div>
          <div style={{ color:"#5eead4", fontWeight:900 }}>
            {activeChallenges.length} operazion{activeChallenges.length === 1 ? "e" : "i"} attiv{activeChallenges.length === 1 ? "a" : "e"}
          </div>
        </div>

        <div style={grid2}>
          <div style={{
            ...statCard,
            border:"1px solid rgba(34,211,238,.38)"
          }}>
            <div style={statLabel}>Saldo Broker realizzato</div>
            <div style={statValue}>$ {fmt(num(brokerBalance),2)}</div>
            <div style={statSub}>
              {brokerBalanceLoaded ? "Persistente su Supabase" : "Caricamento / fallback locale"}
            </div>
            <button
              style={{...secondaryButton,marginTop:10}}
              onClick={() => setShowBrokerAdjust(v => !v)}
            >
              {showBrokerAdjust ? "Chiudi modifica saldo" : "✏️ Modifica saldo Broker"}
            </button>
          </div>
          <div style={statCard}>
            <div style={statLabel}>Equity Broker live</div>
            <div style={{...statValue,color:brokerEquity>=num(brokerBalance)?"#5eead4":"#fca5a5"}}>$ {fmt(brokerEquity,2)}</div>
            <div style={statSub}>Saldo realizzato + P/L floating delle coperture.</div>
          </div>
          <div style={statCard}>
            <div style={statLabel}>P/L Broker floating</div>
            <div style={{...statValue,color:floatingBrokerPL>=0?"#5eead4":"#fca5a5"}}>{signedMoney(floatingBrokerPL)}</div>
            <div style={statSub}>Somma delle sole gambe Broker attive.</div>
          </div>
          <div style={statCard}>
            <div style={statLabel}>Esposizione residua conservativa</div>
            <div style={{...statValue,color:"#fde68a"}}>$ {fmt(activeRemainingExposure,2)}</div>
            <div style={statSub}>Perdita aggiuntiva fino agli SL Broker, sommata in modo prudenziale.</div>
          </div>
          <div style={statCard}>
            <div style={statLabel}>P/L combinato live</div>
            <div style={{...statValue,color:totalCombinedPL>=0?"#5eead4":"#fca5a5"}}>{signedMoney(totalCombinedPL)}</div>
            <div style={statSub}>Prop + Broker di tutte le operazioni attive.</div>
          </div>
        </div>

        {showBrokerAdjust && (
          <div style={{
            marginTop:14,
            padding:14,
            borderRadius:16,
            border:"1px solid rgba(56,189,248,.28)",
            background:"rgba(2,6,23,.48)"
          }}>
            <div style={{display:"flex",justifyContent:"space-between",gap:10,flexWrap:"wrap",alignItems:"center",marginBottom:12}}>
              <div>
                <div style={{fontSize:17,fontWeight:900,color:"#f8fafc"}}>✏️ Modifica saldo Broker</div>
                <div style={{fontSize:12,color:"#94a3b8",marginTop:3}}>
                  Versamenti, prelievi e correzioni vengono registrati su Supabase.
                </div>
              </div>
            </div>

            <div style={grid2}>
              <div>
                <label style={fieldLabel}>Tipo movimento</label>
                <select
                  style={input}
                  value={brokerAdjustType}
                  onChange={e=>setBrokerAdjustType(e.target.value)}
                >
                  <option value="deposit">Versamento</option>
                  <option value="withdrawal">Prelievo</option>
                  <option value="correction">Correzione saldo</option>
                </select>
              </div>

              {brokerAdjustType === "correction" ? (
                <TextNumberField
                  label="Nuovo saldo Broker ($)"
                  value={brokerAdjustNewBalance}
                  onChange={setBrokerAdjustNewBalance}
                />
              ) : (
                <TextNumberField
                  label={brokerAdjustType === "deposit" ? "Importo versamento ($)" : "Importo prelievo ($)"}
                  value={brokerAdjustAmount}
                  onChange={setBrokerAdjustAmount}
                />
              )}

              <div style={{gridColumn:"1 / -1"}}>
                <label style={fieldLabel}>Nota facoltativa</label>
                <input
                  style={input}
                  type="text"
                  value={brokerAdjustNote}
                  placeholder="Es. versamento extra / prelievo / correzione estratto conto"
                  onChange={e=>setBrokerAdjustNote(e.target.value)}
                />
              </div>
            </div>

            <div style={{
              display:"flex",
              gap:10,
              flexWrap:"wrap",
              alignItems:"center"
            }}>
              <button
                style={primaryButtonBlue}
                disabled={brokerAdjustSaving}
                onClick={applyBrokerAdjustment}
              >
                {brokerAdjustSaving ? "Salvo…" : "✅ Conferma modifica saldo"}
              </button>
              <span style={{fontSize:12,color:"#94a3b8"}}>
                Saldo attuale: <b style={{color:"#f8fafc"}}>$ {fmt(num(brokerBalance),2)}</b>
              </span>
            </div>

            {brokerAdjustments.length > 0 && (
              <div style={{marginTop:14}}>
                <div style={{fontSize:12,fontWeight:900,color:"#94a3b8",marginBottom:8}}>ULTIME RETTIFICHE</div>
                <div style={{display:"flex",flexDirection:"column",gap:6}}>
                  {brokerAdjustments.slice(0,5).map(row=>(
                    <div key={row.id} style={{
                      display:"grid",
                      gridTemplateColumns:"150px 110px 120px 1fr",
                      gap:8,
                      alignItems:"center",
                      padding:"8px 10px",
                      borderRadius:10,
                      background:"rgba(15,23,42,.72)",
                      border:"1px solid rgba(51,65,85,.60)",
                      fontSize:11,
                      color:"#cbd5e1"
                    }}>
                      <span>{new Date(row.created_at).toLocaleString("it-IT")}</span>
                      <b>{row.adjustment_type === "deposit" ? "Versamento" : row.adjustment_type === "withdrawal" ? "Prelievo" : "Correzione"}</b>
                      <span style={{color:Number(row.amount)>=0?"#5eead4":"#fca5a5"}}>
                        {signedMoney(Number(row.amount))}
                      </span>
                      <span>{row.note || "—"}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {Object.keys(brokerNetByAsset).length > 0 && (
          <div style={{marginTop:14}}>
            <div style={{color:"#94a3b8",fontSize:12,fontWeight:800,marginBottom:8}}>ESPOSIZIONE NETTA LOTTI BROKER PER ASSET</div>
            <div style={{display:"flex",gap:8,flexWrap:"wrap"}}>
              {Object.entries(brokerNetByAsset).map(([symbol,lots]) => (
                <span key={symbol} style={{
                  padding:"7px 10px", borderRadius:999,
                  border:"1px solid rgba(71,85,105,.8)",
                  background:"rgba(2,6,23,.5)", color:"#e2e8f0", fontWeight:800, fontSize:12
                }}>
                  {symbol}: {lots >= 0 ? "+" : ""}{fmt(lots,2)}
                </span>
              ))}
            </div>
          </div>
        )}
      </div>

      {challenges.map((ch, index) => {
        const c = calcs[ch.id];
        const live = liveMap[ch.asset] || {};
        const tracking = trackings[ch.id];
        const safetyInfo = safetyFor(ch.id);
        const safe = safetyInfo ? safetyStyle[safetyInfo.level] : null;
        const disabled = !!ch.active;
        const theme = getPropTheme(ch, index);

        return (
          <div key={ch.id} style={{
            ...panel,
            background:`linear-gradient(135deg,${theme.bg},rgba(15,23,42,.965))`,
            border: ch.active ? "1px solid rgba(34,197,94,.50)" : `1px solid ${theme.border}`,
            boxShadow:`inset 4px 0 0 ${theme.border}`
          }}>
            <div style={{...panelHeader,padding:"10px 12px",borderRadius:14,background:theme.header,borderBottom:`1px solid ${theme.border}`}}>
              <div style={{flex:"1 1 320px"}}>
                <div style={{display:"flex",gap:10,alignItems:"center",flexWrap:"wrap"}}>
                  <input
                    value={ch.name}
                    disabled={disabled}
                    onChange={e => setChallenge(ch.id,{name:e.target.value})}
                    style={{
                      ...input, marginBottom:0, maxWidth:260, fontSize:18, fontWeight:900,
                      background:"rgba(2,6,23,.55)"
                    }}
                  />
                  {ch.active
                    ? <span style={{color:"#5eead4",fontWeight:900}}>● OPERAZIONE ATTIVA</span>
                    : <span style={{color:live.status==="live"?"#5eead4":live.status==="error"?"#fca5a5":"#fde68a",fontWeight:800,fontSize:13}}>
                        {live.status==="live" ? "● LIVE — Swissquote" : live.status==="error" ? "● Feed non disponibile" : "● aggiornamento…"}
                      </span>
                  }
                </div>
                <div style={{display:"flex",gap:6,flexWrap:"wrap",marginTop:9}}>
                  {[
                    ch.propStage || "STEP 1",
                    `${fmt(num(ch.accountSize)/1000,0)}K`,
                    `DD ${ch.ddMax}%`,
                    `DAILY ${ch.dailyDdPct || "—"}%`,
                    ch.highImpactNewsAllowed ? "NEWS ✓" : "NEWS 🚫"
                  ].map((badge,i)=>(
                    <span key={i} style={{
                      fontSize:10,fontWeight:900,letterSpacing:.25,padding:"4px 7px",borderRadius:999,
                      border:`1px solid ${theme.border}`,background:"rgba(2,6,23,.34)",color:theme.accent
                    }}>{badge}</span>
                  ))}
                </div>
                <p style={{...panelSubtitle,marginTop:7,color:theme.accent}}>Challenge #{index + 1}</p>
              </div>

              <div style={{display:"flex",gap:8,flexWrap:"wrap",alignItems:"center"}}>
                <button
                  style={{...secondaryButton,color:"#bfdbfe",border:"1px solid rgba(59,130,246,.42)"}}
                  onClick={() => openChallengeRegistry(ch)}
                  disabled={!!ch.active}
                  title={ch.active ? "Chiudi prima l'operazione per modificare l'anagrafica." : "Consulta o modifica l'anagrafica della Prop."}
                >
                  📋 SCHEDA PROP
                </button>
                {ch.hedgeEnabled === false ? (
                  <button
                    style={{
                      ...secondaryButton,
                      color:"#bbf7d0",
                      border:"1px solid rgba(34,197,94,.45)",
                      background:"rgba(20,83,45,.28)"
                    }}
                    onClick={() => reactivateHedge(ch.id)}
                  >
                    ▶ RIATTIVA HEDGE
                  </button>
                ) : (
                  <button
                    style={{
                      ...secondaryButton,
                      color:"#fecaca",
                      border:"1px solid rgba(248,113,113,.48)",
                      background:"rgba(127,29,29,.28)"
                    }}
                    onClick={() => stopHedge(ch.id)}
                  >
                    🛑 STOP HEDGE
                  </button>
                )}

                {!ch.active && challenges.length > 1 && (
                  <button
                    style={{...secondaryButton,color:"#fca5a5",border:"1px solid rgba(239,68,68,.35)"}}
                    onClick={() => removeChallenge(ch.id)}
                  >
                    Rimuovi
                  </button>
                )}
              </div>
            </div>

            {ch.hedgeEnabled === false && (
              <div style={{
                marginBottom:14,
                padding:"12px 14px",
                borderRadius:14,
                border:"1px solid rgba(248,113,113,.42)",
                background:"rgba(127,29,29,.18)",
                color:"#fecaca",
                fontWeight:900
              }}>
                🛑 HEDGE DISATTIVATO — la Prop resta tradabile, ma nessuna nuova copertura Broker verrà avviata per questa challenge.
                <div style={{fontSize:11,fontWeight:600,color:"#fca5a5",marginTop:4}}>
                  {ch.hedgeStoppedAt
                    ? `Stop attivato: ${new Date(ch.hedgeStoppedAt).toLocaleString("it-IT")}. `
                    : ""}
                  Le eventuali operazioni già attive restano invariate e continuano a essere monitorate.
                </div>
              </div>
            )}

            {!ch.active && (
              <>
                <div style={grid2}>
                  <div>
                    <label style={fieldLabel}>Asset</label>
                    <select
                      style={input}
                      value={ch.asset}
                      onChange={e => {
                        const symbol = e.target.value;
                        setChallenge(ch.id,{asset:symbol,autoPrice:true,entryPrice:""});
                        refreshSymbol(symbol);
                      }}
                    >
                      {Object.entries(ASSETS).map(([k,v]) => <option key={k} value={k}>{v.label}</option>)}
                    </select>
                  </div>

                  <div>
                    <label style={fieldLabel}>Direzione Prop</label>
                    <select style={input} value={ch.direction} onChange={e => setChallenge(ch.id,{direction:e.target.value})}>
                      <option>BUY</option><option>SELL</option>
                    </select>
                  </div>

                  <TextNumberField label="Valore Prop / Account Size ($)" value={ch.accountSize} onChange={v=>setChallenge(ch.id,{accountSize:v})} />
                  <TextNumberField label="Saldo Account Prop ($)" value={ch.accountBalance} onChange={v=>setChallenge(ch.id,{accountBalance:v})} operational updated={!!ch.operationalChecks?.accountBalance} onOperationalChange={()=>markOperationalUpdated(ch.id,"accountBalance")} />
                  <TextNumberField label="DD Max Prop (%)" value={ch.ddMax} onChange={v=>setChallenge(ch.id,{ddMax:v})} />
                  <TextNumberField label="Costo Prop ($)" value={ch.propCost} onChange={v=>setChallenge(ch.id,{propCost:v})} />
                  <TextNumberField label="Guadagno finale desiderato ($)" value={ch.finalProfitTarget} onChange={v=>setChallenge(ch.id,{finalProfitTarget:v})} operational updated={!!ch.operationalChecks?.finalProfitTarget} onOperationalChange={()=>markOperationalUpdated(ch.id,"finalProfitTarget")} />
                  <TextNumberField label="Rischio ($)" value={ch.risk} onChange={v=>setChallenge(ch.id,{risk:v})} operational updated={!!ch.operationalChecks?.risk} onOperationalChange={()=>markOperationalUpdated(ch.id,"risk")} />
                  <TextNumberField label="SL Distance (punti)" value={ch.slPoints} onChange={v=>setChallenge(ch.id,{slPoints:v})} operational updated={!!ch.operationalChecks?.slPoints} onOperationalChange={()=>markOperationalUpdated(ch.id,"slPoints")} />
                  <TextNumberField label="TP Prop ($)" value={ch.tpProp} onChange={v=>setChallenge(ch.id,{tpProp:v})} operational updated={!!ch.operationalChecks?.tpProp} onOperationalChange={()=>markOperationalUpdated(ch.id,"tpProp")} />
                  <TextNumberField label="Leva" value={ch.leverage} onChange={v=>setChallenge(ch.id,{leverage:v})} />
                  <TextNumberField label="Margine massimo consentito (%)" value={ch.maxMarginPct ?? "50"} onChange={v=>setChallenge(ch.id,{maxMarginPct:v})} />
                  <div style={{
                    padding:"8px 10px",
                    borderRadius:14,
                    border:"1px solid rgba(168,85,247,.34)",
                    background:"rgba(88,28,135,.08)"
                  }}>
                    <label style={{...fieldLabel,marginBottom:6}}>Esposizione Broker challenge — AUTOMATICA</label>
                    <div style={{fontSize:20,fontWeight:900,color:"#d8b4fe"}}>
                      $ {fmt(challengeExposureMap[ch.id] ?? 0,2)}
                    </div>
                    <div style={{fontSize:11,color:"#94a3b8",marginTop:4}}>
                      Derivata dal P/L Broker realizzato nello storico di questa challenge.
                    </div>
                  </div>

                  <div style={{
                    padding:"8px 8px 8px",
                    borderRadius:14,
                    border: ch.operationalChecks?.entryPrice ? "1px solid rgba(34,197,94,.58)" : "1px solid rgba(34,211,238,.38)",
                    background: ch.operationalChecks?.entryPrice ? "rgba(22,163,74,.08)" : "rgba(8,145,178,.07)",
                    boxShadow: ch.operationalChecks?.entryPrice ? "0 0 0 1px rgba(34,197,94,.05) inset" : "0 0 0 1px rgba(34,211,238,.05) inset"
                  }}>
                    <div style={{display:"flex",justifyContent:"space-between",gap:8,alignItems:"center",marginBottom:6}}>
                      <label style={{...fieldLabel,marginBottom:0}}>Prezzo ingresso</label>
                      <span style={{
                        fontSize:9,
                        fontWeight:900,
                        letterSpacing:.55,
                        color: ch.operationalChecks?.entryPrice ? "#86efac" : "#67e8f9",
                        border: ch.operationalChecks?.entryPrice ? "1px solid rgba(34,197,94,.42)" : "1px solid rgba(34,211,238,.35)",
                        background: ch.operationalChecks?.entryPrice ? "rgba(22,163,74,.14)" : "rgba(8,145,178,.12)",
                        borderRadius:999,
                        padding:"3px 6px",
                        whiteSpace:"nowrap"
                      }}>
                        {ch.operationalChecks?.entryPrice ? "AGGIORNATA" : "DA AGGIORNARE"}
                      </span>
                    </div>
                    <div style={{display:"flex",gap:8}}>
                      <input
                        style={{
                          ...input,
                          marginBottom:0,
                          border: ch.operationalChecks?.entryPrice ? "1px solid rgba(34,197,94,.78)" : "1px solid rgba(34,211,238,.72)",
                          boxShadow: ch.operationalChecks?.entryPrice ? "0 0 12px rgba(34,197,94,.10)" : "0 0 12px rgba(34,211,238,.08)",
                          background: ch.operationalChecks?.entryPrice ? "#07150d" : "#071525"
                        }}
                        type="text"
                        inputMode="decimal"
                        value={ch.entryPrice}
                        onFocus={e=>e.currentTarget.select()}
                        onChange={e=>{
                          const raw=e.target.value;
                          if (/^-?[0-9]*[.,]?[0-9]*$/.test(raw) || raw==="") {
                            setChallenge(ch.id,{
                              entryPrice:raw,
                              autoPrice:false,
                              operationalChecks:{
                                ...(ch.operationalChecks || {}),
                                entryPrice:true
                              }
                            });
                          }
                        }}
                      />
                      <button
                        style={{...secondaryButton,whiteSpace:"nowrap"}}
                        onClick={()=>{
                          const lp=liveMap[ch.asset]?.price;
                          const aa=ASSETS[ch.asset];
                          setChallenge(ch.id,{
                            autoPrice:true,
                            entryPrice:Number.isFinite(Number(lp)) ? Number(lp).toFixed(aa.decimals) : ch.entryPrice,
                            operationalChecks:{
                              ...(ch.operationalChecks || {}),
                              entryPrice:true
                            }
                          });
                          refreshSymbol(ch.asset);
                        }}
                      >
                        Usa LIVE
                      </button>
                    </div>
                  </div>
                </div>

                {(() => {
                  const dr = dailyRiskInfo(ch, tracking);
                  const danger = dr.usedPct >= 95;
                  const warn = dr.usedPct >= 85;
                  const caution = dr.usedPct >= 70;
                  const border = danger ? "rgba(239,68,68,.85)" : warn ? "rgba(249,115,22,.72)" : caution ? "rgba(245,158,11,.60)" : "rgba(34,197,94,.35)";
                  const color = danger ? "#fecaca" : warn ? "#fdba74" : caution ? "#fde68a" : "#86efac";
                  return (
                    <div style={{
                      marginTop:14,padding:"13px 15px",borderRadius:15,
                      border:`1px solid ${border}`,
                      background: danger ? "rgba(127,29,29,.25)" : warn ? "rgba(124,45,18,.18)" : caution ? "rgba(120,53,15,.14)" : "rgba(20,83,45,.10)",
                      color
                    }} className={danger ? "prop-margin-alert-box" : ""}>
                      <div style={{fontWeight:950,fontSize:14}}>
                        {danger ? "🚨" : warn ? "🟠" : caution ? "🟡" : "🟢"} DD GIORNALIERO — {fmt(dr.usedPct,1)}% utilizzato
                      </div>
                      <div style={{fontSize:12,fontWeight:750,marginTop:5}}>
                        Baseline: $ {fmt(dr.startEquity,2)} • Limite oggi: $ {fmt(dr.limit,2)} • Usato: $ {fmt(dr.used,2)} • Residuo: $ {fmt(dr.remaining,2)}
                      </div>
                      <div style={{height:8,borderRadius:999,background:"rgba(15,23,42,.75)",overflow:"hidden",marginTop:9}}>
                        <div style={{height:"100%",width:`${Math.min(100,Math.max(0,dr.usedPct))}%`,background:color}} />
                      </div>
                      {danger && <div style={{fontSize:12,fontWeight:950,marginTop:7}}>PERICOLO: sei molto vicino al limite giornaliero della Prop.</div>}
                    </div>
                  );
                })()}

                <div style={statsGrid}>
                  <div style={statCard}><div style={statLabel}>Lotti Prop</div><div style={statValue}>{fmt(c.propLots,3)}</div><div style={statSub}>Rischio / SL Distance</div></div>
                  <div style={statCard}><div style={statLabel}>DD residuo</div><div style={statValue}>$ {fmt(c.ddResidual,2)}</div><div style={statSub}>Rottura a $ {fmt(c.burnBalance,2)}</div></div>
                  <div style={statCard}><div style={statLabel}>Tiri disponibili</div><div style={statValue}>{fmt(c.shots,2)}</div><div style={statSub}>DD residuo / rischio per trade</div></div>
                  <div style={{
                    ...statCard,
                    ...(c.marginExceeded ? {
                      border: "1px solid rgba(239,68,68,.75)",
                      boxShadow: "0 0 0 1px rgba(239,68,68,.16) inset, 0 0 24px rgba(239,68,68,.12)"
                    } : {})
                  }}>
                    <div style={statLabel}>Margine utilizzato</div>
                    <div
                      className={c.marginExceeded ? "prop-margin-alert-blink" : ""}
                      style={{
                        ...statValue,
                        color: c.marginExceeded ? "#ff4d5f" : "#f8fafc"
                      }}
                    >
                      {fmt(c.marginPct,2)}%
                    </div>
                    <div style={{
                      ...statSub,
                      color: c.marginExceeded ? "#fca5a5" : "#aab8ce"
                    }}>
                      Limite Prop: {fmt(c.maxMarginPct,2)}%
                    </div>
                  </div>
                  <div style={statCard}><div style={statLabel}>TP Broker target ($)</div><div style={statValue}>$ {fmt(c.brokerTpDollars,2)}</div><div style={statSub}>[(Costo Prop + Guadagno finale + Esposizione) / Tiri] × 1,10</div></div>
                  <div style={statCard}><div style={statLabel}>Lotti Broker</div><div style={{...statValue,color:"#5eead4"}}>{fmt(c.brokerLots,2)}</div><div style={statSub}>Teorici {fmt(c.brokerLotsRaw,3)}</div></div>
                  <div style={statCard}><div style={statLabel}>Profitto Broker se Prop va in SL</div><div style={{...statValue,color:"#5eead4"}}>+$ {fmt(c.brokerProfitAtPropSL,2)}</div><div style={statSub}>Risultato teorico della copertura</div></div>
                  <div style={statCard}><div style={statLabel}>Perdita max Broker</div><div style={{...statValue,color:"#fca5a5"}}>−$ {fmt(c.maxBrokerLoss,2)}</div><div style={statSub}>Se questa Prop raggiunge il TP</div></div>
                </div>

                {c.marginExceeded && (
                  <div className="prop-margin-alert-box" style={{
                    marginTop:14,
                    padding:"13px 15px",
                    borderRadius:15,
                    background:"rgba(127,29,29,.28)",
                    border:"1px solid rgba(239,68,68,.72)",
                    color:"#fecaca",
                    fontWeight:900
                  }}>
                    🚨 MARGINE MASSIMO SUPERATO — {fmt(c.marginPct,2)}% utilizzato su un massimo consentito di {fmt(c.maxMarginPct,2)}%.
                    <div style={{fontSize:12,fontWeight:650,marginTop:5}}>
                      Riduci i lotti / il rischio oppure aumenta la distanza dello SL prima di piazzare.
                    </div>
                  </div>
                )}

                <div style={orderGrid}>
                  <div style={statCard}>
                    <div style={{fontWeight:900,fontSize:17,marginBottom:8}}>
                      PROP — <span style={{color:ch.direction==="BUY"?"#5eead4":"#fdba74"}}>{ch.direction}</span>
                    </div>
                    <div style={orderRow}><span>Lotti</span><b>{fmt(c.propLots,3)}</b></div>
                    <div style={orderRow}><span>Ingresso</span><b>{fmt(c.px,c.a.decimals)}</b></div>
                    <div style={orderRow}><span>Take Profit</span><b>{fmt(c.propTPPrice,c.a.decimals)}</b></div>
                    <div style={orderRow}><span>Stop Loss</span><b>{fmt(c.propSL,c.a.decimals)}</b></div>
                  </div>

                  <div style={statCard}>
                    <div style={{fontWeight:900,fontSize:17,marginBottom:8}}>
                      BROKER — <span style={{color:c.brokerDirection==="BUY"?"#5eead4":"#fdba74"}}>{c.brokerDirection}</span>
                    </div>
                    <div style={orderRow}><span>Lotti</span><b>{fmt(c.brokerLots,2)}</b></div>
                    <div style={orderRow}><span>Ingresso</span><b>{fmt(c.px,c.a.decimals)}</b></div>
                    <div style={orderRow}><span>Take Profit</span><b>{fmt(c.brokerTP,c.a.decimals)}</b></div>
                    <div style={orderRow}><span>Stop Loss</span><b>{fmt(c.brokerSL,c.a.decimals)}</b></div>
                  </div>
                </div>

                {safe && (
                  <div style={{
                    marginTop:14,padding:"13px 15px",borderRadius:15,
                    background:safe.bg,border:`1px solid ${safe.border}`,color:safe.color,fontWeight:850
                  }}>
                    {safe.icon} {safe.title}
                    <div style={{fontSize:12,fontWeight:600,marginTop:5}}>
                      Se piazzi anche {ch.name}: esposizione Broker conservativa $ {fmt(safetyInfo.projectedExposure,2)}
                      {" • "}equity Broker $ {fmt(brokerEquity,2)}
                      {" • "}buffer dopo esposizione $ {fmt(safetyInfo.projectedResidual,2)}
                      {" • "}prudenziale +20% $ {fmt(safetyInfo.requiredWithBuffer,2)}
                    </div>
                  </div>
                )}

                {(() => {
                  const checks = ch.operationalChecks || {};
                  const requiredKeys = ["accountBalance","finalProfitTarget","risk","slPoints","tpProp","entryPrice"];
                  const done = requiredKeys.filter(k => !!checks[k]).length;
                  const total = requiredKeys.length;
                  const allDone = done === total;
                  return (
                    <div style={{
                      marginTop:14,
                      padding:"11px 13px",
                      borderRadius:14,
                      border: allDone ? "1px solid rgba(34,197,94,.42)" : "1px solid rgba(34,211,238,.25)",
                      background: allDone ? "rgba(22,163,74,.08)" : "rgba(8,145,178,.05)",
                      color: allDone ? "#86efac" : "#bae6fd",
                      fontSize:12,
                      fontWeight:800
                    }}>
                      {allDone
                        ? "✅ Checklist operativa completa"
                        : `Checklist: ${done}/${total} campi challenge aggiornati`}
                    </div>
                  );
                })()}

                <div style={{display:"flex",gap:10,flexWrap:"wrap",marginTop:14}}>
                  <button
                    onClick={()=>placeTrade(ch.id)}
                    style={{
                      border:"none",borderRadius:14,padding:"12px 20px",
                      cursor:"pointer",
                      opacity:1,
                      fontWeight:900,color:"#052e16",background:"linear-gradient(135deg,#4ade80,#22c55e)"
                    }}
                    title={ch.hedgeEnabled === false ? "Avvia il trade sulla Prop senza aprire una nuova copertura Broker." : ""}
                  >
                    {ch.hedgeEnabled === false ? "✅ PIAZZATA PROP — SENZA HEDGE" : "✅ PIAZZATA — AVVIA MONITOR"}
                  </button>
                  <button style={secondaryButton} onClick={()=>refreshSymbol(ch.asset)}>Aggiorna prezzo</button>
                </div>
              </>
            )}

            {ch.active && tracking && (
              <>
                <div style={statsGrid}>
                  <div style={statCard}>
                    <div style={statLabel}>Prezzo ingresso</div>
                    <div style={statValue}>{fmt(ch.active.entry,ch.active.decimals)}</div>
                    <div style={statSub}>Prezzo congelato al click PIAZZATA</div>
                  </div>
                  <div style={statCard}>
                    <div style={statLabel}>Prezzo corrente</div>
                    <div style={statValue}>{fmt(tracking.current,ch.active.decimals)}</div>
                    <div style={statSub}>{ch.active.label}</div>
                  </div>
                  <div style={statCard}>
                    <div style={statLabel}>P/L Prop live</div>
                    <div style={{...statValue,color:tracking.propPL>=0?"#5eead4":"#fca5a5"}}>{signedMoney(tracking.propPL)}</div>
                    <div style={statSub}>Saldo Prop live $ {fmt(tracking.propBalanceNow,2)}</div>
                  </div>
                  <div style={statCard}>
                    <div style={statLabel}>P/L Broker live</div>
                    <div style={{...statValue,color:tracking.brokerPL>=0?"#5eead4":"#fca5a5"}}>{signedMoney(tracking.brokerPL)}</div>
                    <div style={statSub}>Confluisce nell'equity Broker centrale</div>
                  </div>
                  <div style={statCard}>
                    <div style={statLabel}>P/L combinato</div>
                    <div style={{...statValue,color:tracking.combinedPL>=0?"#5eead4":"#fca5a5"}}>{signedMoney(tracking.combinedPL)}</div>
                    <div style={statSub}>Prop + sua copertura Broker</div>
                  </div>
                  <div style={statCard}>
                    <div style={statLabel}>Esposizione Broker residua</div>
                    <div style={{...statValue,color:"#fde68a"}}>$ {fmt(tracking.remainingBrokerLoss,2)}</div>
                    <div style={statSub}>Perdita aggiuntiva teorica fino allo SL Broker</div>
                  </div>
                </div>

                <div style={orderGrid}>
                  <div style={statCard}>
                    <div style={{fontWeight:900,fontSize:17,marginBottom:8}}>PROP — {ch.active.direction}</div>
                    <div style={orderRow}><span>Lotti</span><b>{fmt(ch.active.propLots,3)}</b></div>
                    <div style={orderRow}><span>TP</span><b>{fmt(ch.active.propTP,ch.active.decimals)}</b></div>
                    <div style={orderRow}><span>SL</span><b>{fmt(ch.active.propSL,ch.active.decimals)}</b></div>
                    <div style={orderRow}><span>Saldo iniziale</span><b>$ {fmt(ch.active.propBalanceStart,2)}</b></div>
                  </div>
                  <div style={statCard}>
                    <div style={{fontWeight:900,fontSize:17,marginBottom:8}}>
                      {ch.active.hedgeEnabledAtEntry === false ? "BROKER — NESSUNA COPERTURA" : `BROKER — ${ch.active.brokerDirection}`}
                    </div>
                    <div style={orderRow}><span>Lotti</span><b>{fmt(ch.active.brokerLots,2)}</b></div>
                    {ch.active.hedgeEnabledAtEntry === false ? (
                      <div style={{color:"#fca5a5",fontSize:12,fontWeight:800,marginTop:8}}>Trade Prop aperto con STOP HEDGE attivo.</div>
                    ) : (
                      <>
                        <div style={orderRow}><span>TP</span><b>{fmt(ch.active.brokerTP,ch.active.decimals)}</b></div>
                        <div style={orderRow}><span>SL</span><b>{fmt(ch.active.brokerSL,ch.active.decimals)}</b></div>
                      </>
                    )}
                    <div style={orderRow}><span>P/L live</span><b>{signedMoney(tracking.brokerPL)}</b></div>
                  </div>
                </div>

                <div style={{...panel,marginTop:14,background:"rgba(2,6,23,.42)"}}>
                  <div style={panelHeader}>
                    <div>
                      <h4 style={{...panelTitle,fontSize:17}}>Chiusura reale — {ch.name}</h4>
                      <p style={panelSubtitle}>Lascia vuoto per usare il P/L teorico live, oppure inserisci quello reale.</p>
                    </div>
                  </div>
                  <div style={grid2}>
                    <TextNumberField
                      label="P/L reale Prop ($)"
                      value={ch.closePropPL}
                      placeholder={signedMoney(tracking.propPL)}
                      onChange={v=>setChallenge(ch.id,{closePropPL:v})}
                    />
                    <TextNumberField
                      label="P/L reale Broker ($)"
                      value={ch.closeBrokerPL}
                      placeholder={signedMoney(tracking.brokerPL)}
                      onChange={v=>setChallenge(ch.id,{closeBrokerPL:v})}
                    />
                  </div>
                  <div style={{color:"#cbd5e1",fontSize:13}}>
                    Se chiudi ora:
                    <b style={{marginLeft:8}}>Prop → $ {fmt(
                      ch.active.propBalanceStart + (ch.closePropPL === "" ? tracking.propPL : num(ch.closePropPL)),2
                    )}</b>
                    <b style={{marginLeft:16}}>Broker realizzato → $ {fmt(
                      num(brokerBalance) + (ch.closeBrokerPL === "" ? tracking.brokerPL : num(ch.closeBrokerPL)),2
                    )}</b>
                  </div>
                </div>

                <div style={{display:"flex",gap:10,flexWrap:"wrap",marginTop:14}}>
                  <button
                    onClick={()=>closeAndUpdate(ch.id)}
                    style={{
                      border:"none",borderRadius:14,padding:"12px 20px",cursor:"pointer",
                      fontWeight:900,color:"#052e16",background:"linear-gradient(135deg,#4ade80,#22c55e)"
                    }}
                  >
                    ✅ CHIUDI E AGGIORNA SALDI
                  </button>
                  <button
                    onClick={()=>cancelTrade(ch.id)}
                    style={{
                      border:"1px solid rgba(248,113,113,.55)",borderRadius:14,padding:"12px 20px",
                      cursor:"pointer",fontWeight:900,color:"#fecaca",background:"rgba(127,29,29,.35)"
                    }}
                  >
                    ↩️ ANNULLA / RESET
                  </button>
                </div>
              </>
            )}
          </div>
        );
      })}

      <div style={{
        ...panel,
        border:"1px solid rgba(168,85,247,.34)",
        background:"linear-gradient(135deg,rgba(88,28,135,.08),rgba(15,23,42,.96))"
      }}>
        <div style={panelHeader}>
          <div>
            <h3 style={panelTitle}>🗂️ Storico Prop Hedge</h3>
            <p style={panelSubtitle}>Salvataggio automatico su Supabase quando premi “Chiudi e aggiorna saldi”.</p>
          </div>
          <button style={secondaryButton} onClick={loadHistory}>
            {historyLoading ? "Aggiorno…" : "↻ Aggiorna storico"}
          </button>
        </div>

        {historyError && (
          <div style={{
            padding:"10px 12px",
            borderRadius:12,
            border:"1px solid rgba(239,68,68,.45)",
            background:"rgba(127,29,29,.20)",
            color:"#fecaca",
            marginBottom:14
          }}>
            ❌ {historyError}
          </div>
        )}

        <div style={{
          display:"grid",
          gridTemplateColumns:"repeat(auto-fit,minmax(180px,1fr))",
          gap:10,
          marginBottom:14
        }}>
          <div>
            <label style={fieldLabel}>Prop</label>
            <select
              style={input}
              value={historyFilters.prop}
              onChange={e=>setHistoryFilters(prev=>({...prev,prop:e.target.value}))}
            >
              <option value="TUTTE">Tutte</option>
              {historyPropOptions.map(v=><option key={v} value={v}>{v}</option>)}
            </select>
          </div>

          <div>
            <label style={fieldLabel}>Asset</label>
            <select
              style={input}
              value={historyFilters.asset}
              onChange={e=>setHistoryFilters(prev=>({...prev,asset:e.target.value}))}
            >
              <option value="TUTTI">Tutti</option>
              {historyAssetOptions.map(v=><option key={v} value={v}>{v}</option>)}
            </select>
          </div>

          <div>
            <label style={fieldLabel}>Risultato combinato</label>
            <select
              style={input}
              value={historyFilters.result}
              onChange={e=>setHistoryFilters(prev=>({...prev,result:e.target.value}))}
            >
              <option value="TUTTI">Tutti</option>
              <option value="POSITIVO">Positivo</option>
              <option value="NEGATIVO">Negativo</option>
              <option value="PARI">Pari</option>
            </select>
          </div>
        </div>

        <div style={statsGrid}>
          <div style={statCard}>
            <div style={statLabel}>Operazioni</div>
            <div style={statValue}>{historyStats.count}</div>
            <div style={statSub}>{historyStats.wins} positive • {historyStats.losses} negative</div>
          </div>
          <div style={statCard}>
            <div style={statLabel}>P/L Prop totale</div>
            <div style={{...statValue,color:historyStats.propPL>=0?"#5eead4":"#fca5a5"}}>
              {signedMoney(historyStats.propPL)}
            </div>
          </div>
          <div style={statCard}>
            <div style={statLabel}>P/L Broker totale</div>
            <div style={{...statValue,color:historyStats.brokerPL>=0?"#5eead4":"#fca5a5"}}>
              {signedMoney(historyStats.brokerPL)}
            </div>
          </div>
          <div style={statCard}>
            <div style={statLabel}>P/L combinato</div>
            <div style={{...statValue,color:historyStats.combinedPL>=0?"#5eead4":"#fca5a5"}}>
              {signedMoney(historyStats.combinedPL)}
            </div>
          </div>
        </div>

        <div style={{
          marginTop:14,
          overflowX:"auto",
          border:"1px solid rgba(51,65,85,.78)",
          borderRadius:16
        }}>
          <table style={{width:"100%",borderCollapse:"collapse",minWidth:1250}}>
            <thead>
              <tr style={{background:"#0b1220"}}>
                {[
                  "Data","Prop","Asset","Dir.","Ingresso","Uscita",
                  "Lotti Prop","Lotti Broker","P/L Prop","P/L Broker","Combinato",
                  "Saldo Prop","Saldo Broker"
                ].map(h=>(
                  <th key={h} style={{
                    textAlign:"left",
                    padding:"11px 10px",
                    color:"#94a3b8",
                    fontSize:11,
                    textTransform:"uppercase",
                    letterSpacing:.55,
                    borderBottom:"1px solid rgba(51,65,85,.78)",
                    whiteSpace:"nowrap"
                  }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filteredHistory.length === 0 && (
                <tr>
                  <td colSpan={13} style={{padding:20,color:"#94a3b8",textAlign:"center"}}>
                    {historyLoading ? "Caricamento storico…" : "Nessuna operazione nello storico."}
                  </td>
                </tr>
              )}

              {filteredHistory.map(row => {
                const decimals = ASSETS[row.asset]?.decimals ?? 5;
                const combined = Number(row.combined_pl || 0);
                return (
                  <tr key={row.id} style={{borderBottom:"1px solid rgba(30,41,59,.82)"}}>
                    <td style={{padding:"10px",color:"#cbd5e1",fontSize:12,whiteSpace:"nowrap"}}>
                      {row.closed_at ? new Date(row.closed_at).toLocaleString("it-IT") : "—"}
                    </td>
                    <td style={{padding:"10px",fontWeight:850,color:"#f8fafc"}}>{row.prop_name}</td>
                    <td style={{padding:"10px",color:"#cbd5e1"}}>{row.asset}</td>
                    <td style={{padding:"10px",fontWeight:800,color:row.prop_direction==="BUY"?"#5eead4":"#fdba74"}}>
                      {row.prop_direction}
                    </td>
                    <td style={{padding:"10px",whiteSpace:"nowrap"}}>{fmt(Number(row.entry_price),decimals)}</td>
                    <td style={{padding:"10px",whiteSpace:"nowrap"}}>{fmt(Number(row.exit_price),decimals)}</td>
                    <td style={{padding:"10px"}}>{fmt(Number(row.prop_lots),3)}</td>
                    <td style={{padding:"10px"}}>{fmt(Number(row.broker_lots),2)}</td>
                    <td style={{padding:"10px",color:Number(row.prop_pl)>=0?"#5eead4":"#fca5a5",fontWeight:800}}>
                      {signedMoney(Number(row.prop_pl))}
                    </td>
                    <td style={{padding:"10px",color:Number(row.broker_pl)>=0?"#5eead4":"#fca5a5",fontWeight:800}}>
                      {signedMoney(Number(row.broker_pl))}
                    </td>
                    <td style={{padding:"10px",color:combined>=0?"#5eead4":"#fca5a5",fontWeight:900}}>
                      {signedMoney(combined)}
                    </td>
                    <td style={{padding:"10px",whiteSpace:"nowrap"}}>
                      $ {fmt(Number(row.prop_balance_start),2)} → $ {fmt(Number(row.prop_balance_end),2)}
                    </td>
                    <td style={{padding:"10px",whiteSpace:"nowrap"}}>
                      $ {fmt(Number(row.broker_balance_start),2)} → $ {fmt(Number(row.broker_balance_end),2)}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      <div style={hintBox}>
        V9 Multi Challenge + Storico Supabase: le operazioni attive e i saldi vengono salvati nel browser.
        Il quadro Broker usa un'esposizione residua conservativa, sommando le perdite potenziali delle coperture attive.
        L'esposizione netta in lotti per asset è mostrata separatamente. Prezzi, P/L e saldi restano stime:
        spread, commissioni, swap, slippage e specifiche dei contratti possono creare differenze reali.
      </div>
    </div>
    </>
  );
}
