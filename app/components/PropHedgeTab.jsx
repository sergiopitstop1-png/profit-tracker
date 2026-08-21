"use client";

// PropHedgeTab v1.42 — Trading Lab: recupero richieste SYMBOL_INFO pendenti + countdown 90s

import React, { useEffect, useMemo, useRef, useState } from "react";
import { supabase } from "../profit-tracker/supabaseClient";
import MarketEnginePanel from "./MarketEnginePanel";
import TradingViewChart from "./TradingViewChart";
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

const MT5_LIVE_MAX_AGE_MS = 90000; // heartbeat 30s: margine anti-jitter
const ENGINE_DIRECTION_STORAGE_KEY = "propMarketLatestPropDirection:XAUUSD";

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
    propOrigin: "NEW",
    initialBrokerExposure: "0",
    highImpactNewsAllowed: false,
    propNotes: "",
    themeId: "",
    archived: false,
    archivedAt: null,
    archiveStatus: "",
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
    brokerAccountId: "",
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


function ActivePropRolling3H({ symbol = "XAUUSD" }) {
  const [roll, setRoll] = useState({ blocks: [], loading: true, error: "" });

  useEffect(() => {
    let alive = true;

    const load = async () => {
      try {
        const r = await fetch(
          `/api/market-analysis?symbol=${encodeURIComponent(symbol)}`,
          { cache: "no-store" }
        );
        const j = await r.json();

        if (!r.ok || !j?.ok) {
          throw new Error(j?.error || "Dati 24H non disponibili");
        }

        const raw = Array.isArray(j?.blocks3h) ? j.blocks3h : [];
        const blocks = raw.slice(-8);

        if (alive) {
          setRoll({ blocks, loading: false, error: "" });
        }
      } catch (e) {
        if (alive) {
          setRoll(prev => ({
            ...prev,
            loading: false,
            error: e?.message || "Errore rolling 24H"
          }));
        }
      }
    };

    load();
    const timer = window.setInterval(load, 60_000);

    return () => {
      alive = false;
      window.clearInterval(timer);
    };
  }, [symbol]);

  const blocks = Array.isArray(roll.blocks) ? roll.blocks : [];

  const getMove = (b) => {
    const candidates = [
      b?.move,
      b?.delta,
      b?.priceMove,
      b?.change,
      b?.netMove,
      b?.close != null && b?.open != null ? Number(b.close) - Number(b.open) : null
    ];
    for (const v of candidates) {
      const n = Number(v);
      if (Number.isFinite(n)) return n;
    }
    return 0;
  };

  const getBars = (b) => {
    const candidates = [b?.bars, b?.barCount, b?.count, b?.m15Count];
    for (const v of candidates) {
      const n = Number(v);
      if (Number.isFinite(n)) return n;
    }
    return null;
  };

  return (
    <div style={{
      marginBottom: 12,
      padding: "10px 12px",
      borderRadius: 13,
      border: "1px solid rgba(99,102,241,.30)",
      background: "rgba(30,41,59,.28)"
    }}>
      <div style={{
        display: "flex",
        justifyContent: "space-between",
        alignItems: "center",
        gap: 8,
        flexWrap: "wrap",
        marginBottom: 8
      }}>
        <div>
          <div style={{fontSize:10,fontWeight:1000,color:"#c7d2fe"}}>
            🕒 MOVIMENTO 24H — BLOCCHI DA 3 ORE
          </div>
          <div style={{fontSize:8.5,color:"#64748b",marginTop:2}}>
            Più vecchio a sinistra · blocco corrente a destra
          </div>
        </div>
        <div style={{fontSize:8,color:"#64748b"}}>← 24H FA · ADESSO →</div>
      </div>

      {roll.error && (
        <div style={{fontSize:8.5,color:"#fca5a5",marginBottom:7}}>
          ⚠️ {roll.error}
        </div>
      )}

      <div style={{
        display:"grid",
        gridTemplateColumns:"repeat(8,minmax(78px,1fr))",
        gap:6,
        overflowX:"auto",
        WebkitOverflowScrolling:"touch"
      }}>
        {blocks.map((b, i) => {
          const move = getMove(b);
          const bars = getBars(b);
          const isLast = i === blocks.length - 1;

          // Se la route espone complete=false lo rispettiamo.
          // In alternativa, l'ultimo blocco con meno di 12 M15 è quello in corso.
          const isCurrent =
            isLast &&
            (
              b?.complete === false ||
              (b?.complete == null && bars != null && bars < 12)
            );

          const color =
            move > 0 ? "#5eead4" :
            move < 0 ? "#fb7185" :
            "#cbd5e1";

          return (
            <div
              key={`${b?.label || b?.start || i}-${i}`}
              style={{
                minWidth:78,
                padding:"7px 8px",
                borderRadius:10,
                border:isCurrent
                  ? "1px solid rgba(250,204,21,.85)"
                  : move > 0
                    ? "1px solid rgba(45,212,191,.28)"
                    : move < 0
                      ? "1px solid rgba(248,113,113,.28)"
                      : "1px solid rgba(100,116,139,.25)",
                background:isCurrent
                  ? "rgba(161,98,7,.16)"
                  : "rgba(15,23,42,.36)"
              }}
            >
              <div style={{
                display:"flex",
                justifyContent:"space-between",
                alignItems:"center",
                gap:4
              }}>
                <span style={{
                  fontSize:8,
                  fontWeight:900,
                  color:isCurrent ? "#fde68a" : "#94a3b8",
                  whiteSpace:"nowrap"
                }}>
                  {b?.label || b?.window || `B${i+1}`}
                </span>

                {isCurrent && (
                  <span style={{fontSize:6.7,fontWeight:1000,color:"#facc15"}}>
                    LIVE
                  </span>
                )}
              </div>

              <div style={{
                fontSize:13,
                fontWeight:1000,
                color,
                marginTop:3
              }}>
                {move >= 0 ? "+" : ""}{move.toFixed(1)}
              </div>

              <div style={{
                fontSize:7,
                color:isCurrent ? "#facc15" : "#64748b",
                marginTop:2
              }}>
                {isCurrent
                  ? (bars != null ? `${bars}/12 M15` : "IN CORSO")
                  : "COMPLETO"}
              </div>
            </div>
          );
        })}

        {!blocks.length && (
          <div style={{
            gridColumn:"1 / -1",
            fontSize:9,
            color:"#64748b",
            padding:"5px 2px"
          }}>
            {roll.loading
              ? "Carico movimento ultime 24 ore…"
              : "Nessun blocco disponibile."}
          </div>
        )}
      </div>
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

  // Movimenti di cassa per singolo account Broker MT5 (multi-broker / multi-account)
  const [brokerMovementAccountId, setBrokerMovementAccountId] = useState(null);
  const [brokerMovementType, setBrokerMovementType] = useState("deposit");
  const [brokerMovementAmount, setBrokerMovementAmount] = useState("");
  const [brokerMovementNote, setBrokerMovementNote] = useState("");
  const [brokerMovementSaving, setBrokerMovementSaving] = useState(false);

  const [liveMap, setLiveMap] = useState({});
  const [tradingEnabled, setTradingEnabled] = useState(false);
  const [tradingSyncing, setTradingSyncing] = useState(false);
  const [tradingSessionLoaded, setTradingSessionLoaded] = useState(false);
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

  // Account Broker MT5 multi-account
  const [brokerAccounts, setBrokerAccounts] = useState([]);
  const [brokerAccountsLoading, setBrokerAccountsLoading] = useState(false);
  const [brokerAccountSaving, setBrokerAccountSaving] = useState(false);
  const [brokerAccountEditingId, setBrokerAccountEditingId] = useState(null);
  const [brokerAccountDraft, setBrokerAccountDraft] = useState({
    alias: "",
    broker: "",
    mt5_login: "",
    mt5_server: "",
    account_type: "real",
    active: true
  });

  // Stato live ricevuto dagli EA MT5 via heartbeat -> Vercel -> Supabase
  const [brokerLiveStates, setBrokerLiveStates] = useState([]);
  const [brokerLiveLoading, setBrokerLiveLoading] = useState(false);
  const [brokerLiveError, setBrokerLiveError] = useState("");
  const [brokerLiveUpdatedAt, setBrokerLiveUpdatedAt] = useState(null);

  // Invio comando Prop Hedge -> Supabase -> EA MT5
  const [bridgeSubmitting, setBridgeSubmitting] = useState({});
  const [bridgeClosing, setBridgeClosing] = useState({});

  const [mainView, setMainView] = useState("OPERATIVITA");

  // Trading Lab v0.1 — SOLO LETTURA SPECIFICHE MT5
  // In questa fase NON apre, modifica o chiude ordini.
  const [labBrokerAccountId, setLabBrokerAccountId] = useState("");
  const [labSymbol, setLabSymbol] = useState("EURUSD");
  const [labSymbols, setLabSymbols] = useState([]);
  const [labSymbolsLoading, setLabSymbolsLoading] = useState(false);
  const [labSymbolsError, setLabSymbolsError] = useState("");
  const [labSymbolSearch, setLabSymbolSearch] = useState("");
  const [labSymbolInfo, setLabSymbolInfo] = useState(null);
  const [labSymbolInfoLoading, setLabSymbolInfoLoading] = useState(false);
  const [labSymbolInfoError, setLabSymbolInfoError] = useState("");
  const [labLastCommandId, setLabLastCommandId] = useState(null);
  const [labWaitSeconds, setLabWaitSeconds] = useState(0);

  // Trading Lab — modalità TRADING
  const [labMode, setLabMode] = useState("TRADING");
  const [labSide, setLabSide] = useState("BUY");
  const [labMaxLossUsd, setLabMaxLossUsd] = useState("5");
  const [labTargetUsd, setLabTargetUsd] = useState("20");
  const [labTradePreview, setLabTradePreview] = useState(null);
  const [labTradeSubmitting, setLabTradeSubmitting] = useState(false);
  const [labTradeStatus, setLabTradeStatus] = useState("");
  const [labTradeError, setLabTradeError] = useState("");
  const [labActiveTrades, setLabActiveTrades] = useState(() => {
    try {
      const raw = window.localStorage.getItem("profittracker_lab_active_trades_v1");
      const rows = raw ? JSON.parse(raw) : [];
      return Array.isArray(rows) ? rows : [];
    } catch {
      return [];
    }
  });
  const [labPositionRefreshing, setLabPositionRefreshing] = useState(false);
  const labPositionRefreshLockRef = useRef(false);
  // Trading Lab — modalità ACCUMULO
  // L'importo è esposizione/notional stimata in USD, non margine.
  const [labAccumUsd, setLabAccumUsd] = useState("10");
  const [labAccumPreview, setLabAccumPreview] = useState(null);
  const [labAccumSubmitting, setLabAccumSubmitting] = useState(false);
  const [labAccumStatus, setLabAccumStatus] = useState("");
  const [labAccumError, setLabAccumError] = useState("");
  const [labAccumScanRows, setLabAccumScanRows] = useState([]);
  const [labAccumScanLoading, setLabAccumScanLoading] = useState(false);
  const [labAccumScanError, setLabAccumScanError] = useState("");
  const [labAccumScanProgress, setLabAccumScanProgress] = useState({
    current:0,
    total:0,
    pages:0
  });
  const [labAccumScanFilter, setLabAccumScanFilter] = useState("50");
  const [labAccumCategoryFilter, setLabAccumCategoryFilter] = useState("TUTTI");
  const [labAccumPositions, setLabAccumPositions] = useState(() => {
    try {
      const raw = window.localStorage.getItem("profittracker_lab_accum_positions_v1");
      const rows = raw ? JSON.parse(raw) : [];
      return Array.isArray(rows) ? rows : [];
    } catch {
      return [];
    }
  });



  useEffect(() => {
    try {
      window.localStorage.setItem(
        "profittracker_lab_active_trades_v1",
        JSON.stringify(labActiveTrades)
      );
    } catch {}
  }, [labActiveTrades]);

  useEffect(() => {
    try {
      window.localStorage.setItem(
        "profittracker_lab_accum_positions_v1",
        JSON.stringify(labAccumPositions)
      );
    } catch {}
  }, [labAccumPositions]);

  const [chartSymbol, setChartSymbol] = useState("XAUUSD");
  const [enginePropDirection, setEnginePropDirection] = useState(() => {
    if (typeof window === "undefined") return "WAIT";
    try {
      const saved = JSON.parse(localStorage.getItem(ENGINE_DIRECTION_STORAGE_KEY) || "null");
      const dir = String(saved?.propDirection || "WAIT").toUpperCase();
      return ["BUY","SELL"].includes(dir) ? dir : "WAIT";
    } catch { return "WAIT"; }
  });
  const [engineAnalysisReady, setEngineAnalysisReady] = useState(() => {
    if (typeof window === "undefined") return false;
    try {
      const saved = JSON.parse(localStorage.getItem(ENGINE_DIRECTION_STORAGE_KEY) || "null");
      return ["BUY","SELL"].includes(String(saved?.propDirection || "").toUpperCase());
    } catch { return false; }
  });
  const [engineSignalSnapshot, setEngineSignalSnapshot] = useState({
    forecastDirection: "WAIT",
    propDirection: "WAIT",
    score: null,
    confidence: null,
    analyzedAt: null
  });

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

  // Modalità operativa centrale:
  // - tradingEnabled = sessione manualmente attivata dall'utente
  // - hasActiveTrade = mantiene vivo il monitoraggio essenziale anche dopo STOP TRADING
  const hasActiveTrade = useMemo(() => challenges.some(ch => !!ch.active), [challenges]);
  const tradingRuntimeActive = tradingEnabled || hasActiveTrade;

  const loadTradingSession = async () => {
    try {
      const { data: userData } = await supabase.auth.getUser();
      const uid = userData?.user?.id;
      if (!uid) throw new Error("Utente Supabase non autenticato");

      const { data, error } = await supabase
        .from("prop_trading_session")
        .select("trading_enabled,mode,active_account,active_symbol,started_at,stopped_at,updated_at")
        .eq("user_id", uid)
        .maybeSingle();

      if (error) throw error;

      setTradingEnabled(data?.trading_enabled === true);
      setTradingSessionLoaded(true);
      return data || null;
    } catch (e) {
      console.error("Errore caricamento sessione Trading:", e);
      setTradingEnabled(false);
      setTradingSessionLoaded(true);
      return null;
    }
  };

  const saveTradingSession = async ({ enabled, mode, activeAccount = null, activeSymbol = null }) => {
    const { data: userData } = await supabase.auth.getUser();
    const uid = userData?.user?.id;
    if (!uid) throw new Error("Utente Supabase non autenticato");

    const now = new Date().toISOString();
    const payload = {
      user_id: uid,
      trading_enabled: enabled === true,
      mode: mode || (enabled ? "READY" : "OFF"),
      active_account: activeAccount || null,
      active_symbol: activeSymbol || null,
      updated_at: now
    };

    if (enabled) {
      payload.started_at = now;
      payload.stopped_at = null;
    } else {
      payload.stopped_at = now;
    }

    const { error } = await supabase
      .from("prop_trading_session")
      .upsert(payload, { onConflict: "user_id" });

    if (error) throw error;
    return true;
  };

  const toggleTrading = async () => {
    if (tradingSyncing) return;

    if (tradingEnabled && hasActiveTrade) {
      const ok = window.confirm(
        "Ci sono operazioni ancora aperte.\n\nSTOP TRADING spegnerà Market Engine e impedirà nuove aperture, ma prezzi e monitoraggio resteranno attivi fino alla chiusura dell'ultimo trade.\n\nProcedere?"
      );
      if (!ok) return;
    }

    const nextEnabled = !tradingEnabled;
    const nextMode = nextEnabled
      ? (hasActiveTrade ? "ACTIVE_TRADE" : "READY")
      : (hasActiveTrade ? "ACTIVE_TRADE" : "OFF");

    setTradingSyncing(true);

    try {
      await saveTradingSession({
        enabled: nextEnabled,
        mode: nextMode
      });

      setTradingEnabled(nextEnabled);

      if (nextEnabled) {
        refreshAllSymbols();
        loadBrokerLiveStates({ silent: true });

        alert(
          "✅ TRADING AVVIATO\n\n" +
          "Attendi circa 60 secondi prima di piazzare un’operazione, " +
          "per permettere alle MT5 e al Market Feed di entrare in modalità operativa."
        );
      }
    } catch (e) {
      console.error("Errore cambio stato Trading:", e);
      alert(
        "❌ IMPOSSIBILE CAMBIARE STATO TRADING\n\n" +
        (e?.message || String(e))
      );
    } finally {
      setTradingSyncing(false);
    }
  };

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
      const { data: userData } = await supabase.auth.getUser();
      const uid = userData?.user?.id;
      if (!uid) throw new Error("Utente Supabase non autenticato");

      const { data, error } = await supabase
        .from("prop_hedge_broker_adjustments")
        .select("*")
        .eq("user_id", uid)
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

  const openBrokerMovement = (accountId) => {
    setBrokerMovementAccountId(accountId);
    setBrokerMovementType("deposit");
    setBrokerMovementAmount("");
    setBrokerMovementNote("");
  };

  const closeBrokerMovement = () => {
    if (brokerMovementSaving) return;
    setBrokerMovementAccountId(null);
    setBrokerMovementAmount("");
    setBrokerMovementNote("");
  };

  const applyBrokerAccountMovement = async () => {
    if (brokerMovementSaving || !brokerMovementAccountId) return;

    const account = brokerAccountById(brokerMovementAccountId);
    if (!account) {
      alert("Account Broker non trovato.");
      return;
    }

    const live = brokerLiveStateByAccountId[brokerMovementAccountId] || null;
    if (!live || !Number.isFinite(Number(live.balance))) {
      alert("Saldo MT5 non disponibile per questo account. Aggiorna MT5 e riprova.");
      return;
    }

    const amountAbs = Math.abs(num(brokerMovementAmount));
    if (!amountAbs) {
      alert("Inserisci un importo.");
      return;
    }

    const before = num(live.balance);
    const movement = brokerMovementType === "withdrawal" ? -amountAbs : amountAbs;
    const theoreticalAfter = before + movement;

    if (theoreticalAfter < 0) {
      alert("Il prelievo supera il saldo MT5 attuale.");
      return;
    }

    setBrokerMovementSaving(true);
    try {
      const { data: userData } = await supabase.auth.getUser();
      const uid = userData?.user?.id;
      if (!uid) throw new Error("Utente Supabase non autenticato");

      const { error } = await supabase
        .from("prop_hedge_broker_adjustments")
        .insert({
          user_id: uid,
          broker_account_id: account.id,
          account_alias: account.alias || null,
          broker_name: account.broker || null,
          adjustment_type: brokerMovementType,
          amount: movement,
          balance_before: before,
          balance_after: theoreticalAfter,
          note: brokerMovementNote.trim() || null
        });

      if (error) throw error;

      // IMPORTANTE: non tocchiamo il saldo live. Lo aggiorna solo MT5 tramite heartbeat.
      await loadBrokerAdjustments();
      setBrokerMovementAccountId(null);
      setBrokerMovementAmount("");
      setBrokerMovementNote("");

      alert(
        `✅ Movimento registrato — ${account.alias || account.broker || "Broker"}\n\n` +
        `${brokerMovementType === "deposit" ? "Versamento" : "Prelievo"}: ${signedMoney(movement)}\n` +
        `Saldo MT5 letto: $ ${fmt(before, 2)}\n` +
        `Saldo teorico dopo movimento: $ ${fmt(theoreticalAfter, 2)}\n\n` +
        "Il saldo mostrato da ProfitTracker resterà quello reale ricevuto da MT5."
      );
    } catch (e) {
      console.error("Errore registrazione movimento Broker:", e);
      alert(
        "Errore registrazione movimento Broker:\n\n" +
        (e?.message || String(e)) +
        "\n\nSe l'errore cita broker_account_id/account_alias/broker_name, esegui prima la migrazione SQL indicata."
      );
    } finally {
      setBrokerMovementSaving(false);
    }
  };

  const emptyBrokerAccountDraft = () => ({
    alias: "",
    broker: "",
    mt5_login: "",
    mt5_server: "",
    account_type: "real",
    active: true
  });

  const loadBrokerAccounts = async () => {
    setBrokerAccountsLoading(true);
    try {
      const { data: userData } = await supabase.auth.getUser();
      const uid = userData?.user?.id;
      if (!uid) throw new Error("Utente Supabase non autenticato");

      const { data, error } = await supabase
        .from("prop_broker_accounts")
        .select("id,user_id,alias,broker,mt5_login,mt5_server,account_type,active,created_at,updated_at")
        .eq("user_id", uid)
        .order("active", { ascending: false })
        .order("alias", { ascending: true });

      if (error) throw error;
      setBrokerAccounts(data || []);
    } catch (e) {
      console.error("Errore caricamento account Broker:", e);
      alert("Errore caricamento account Broker: " + (e?.message || String(e)));
    } finally {
      setBrokerAccountsLoading(false);
    }
  };

  const editBrokerAccount = (account) => {
    setBrokerAccountEditingId(account.id);
    setBrokerAccountDraft({
      alias: account.alias || "",
      broker: account.broker || "",
      mt5_login: account.mt5_login || "",
      mt5_server: account.mt5_server || "",
      account_type: account.account_type || "real",
      active: account.active !== false
    });
    setMainView("ACCOUNT_BROKER");
  };

  const resetBrokerAccountEditor = () => {
    setBrokerAccountEditingId(null);
    setBrokerAccountDraft(emptyBrokerAccountDraft());
  };

  const saveBrokerAccount = async () => {
    if (brokerAccountSaving) return;

    const alias = String(brokerAccountDraft.alias || "").trim();
    const broker = String(brokerAccountDraft.broker || "").trim();
    const mt5Login = String(brokerAccountDraft.mt5_login || "").trim();
    const mt5Server = String(brokerAccountDraft.mt5_server || "").trim();

    if (!alias || !broker || !mt5Login || !mt5Server) {
      alert("Compila Alias, Broker, Login MT5 e Server MT5.");
      return;
    }

    setBrokerAccountSaving(true);
    try {
      const { data: userData } = await supabase.auth.getUser();
      const uid = userData?.user?.id;
      if (!uid) throw new Error("Utente Supabase non autenticato");

      const payload = {
        user_id: uid,
        alias,
        broker,
        mt5_login: mt5Login,
        mt5_server: mt5Server,
        account_type: brokerAccountDraft.account_type === "demo" ? "demo" : "real",
        active: brokerAccountDraft.active !== false,
        updated_at: new Date().toISOString()
      };

      let error;
      if (brokerAccountEditingId) {
        ({ error } = await supabase
          .from("prop_broker_accounts")
          .update(payload)
          .eq("id", brokerAccountEditingId)
          .eq("user_id", uid));
      } else {
        ({ error } = await supabase
          .from("prop_broker_accounts")
          .insert(payload));
      }

      if (error) throw error;

      resetBrokerAccountEditor();
      await loadBrokerAccounts();
    } catch (e) {
      console.error("Errore salvataggio account Broker:", e);
      alert("Errore salvataggio account Broker: " + (e?.message || String(e)));
    } finally {
      setBrokerAccountSaving(false);
    }
  };

  const toggleBrokerAccountActive = async (account) => {
    try {
      const { data: userData } = await supabase.auth.getUser();
      const uid = userData?.user?.id;
      if (!uid) throw new Error("Utente Supabase non autenticato");

      const { error } = await supabase
        .from("prop_broker_accounts")
        .update({ active: !account.active, updated_at: new Date().toISOString() })
        .eq("id", account.id)
        .eq("user_id", uid);

      if (error) throw error;
      await loadBrokerAccounts();
    } catch (e) {
      alert("Errore modifica account Broker: " + (e?.message || String(e)));
    }
  };

  const deleteBrokerAccount = async (account) => {
    const usedBy = challenges.filter(ch => ch.brokerAccountId === account.id);
    if (usedBy.length) {
      alert(`Questo account è assegnato a ${usedBy.length} challenge. Cambia prima il conto Broker nelle challenge interessate.`);
      return;
    }

    if (!window.confirm(`Eliminare l'account Broker “${account.alias}”?`)) return;

    try {
      const { data: userData } = await supabase.auth.getUser();
      const uid = userData?.user?.id;
      if (!uid) throw new Error("Utente Supabase non autenticato");

      const { error } = await supabase
        .from("prop_broker_accounts")
        .delete()
        .eq("id", account.id)
        .eq("user_id", uid);

      if (error) throw error;
      await loadBrokerAccounts();
    } catch (e) {
      alert("Errore eliminazione account Broker: " + (e?.message || String(e)));
    }
  };

  const brokerAccountById = (id) => brokerAccounts.find(x => x.id === id) || null;

  const loadBrokerLiveStates = async ({ silent = false } = {}) => {
    if (!silent) setBrokerLiveLoading(true);
    try {
      const { data: userData } = await supabase.auth.getUser();
      const uid = userData?.user?.id;
      if (!uid) throw new Error("Utente Supabase non autenticato");

      const { data, error } = await supabase
        .from("prop_broker_live_state")
        .select("broker_account_id,user_id,mt5_login,mt5_server,balance,credit,equity,margin,free_margin,margin_level,connected,algo_trading,last_seen_at,updated_at")
        .eq("user_id", uid);

      if (error) throw error;

      // v1.19 — CACHE STABILE DEGLI SNAPSHOT MT5
      // Una lettura temporaneamente vuota/incompleta NON deve cancellare
      // l'ultimo snapshot valido già ricevuto dal broker.
      // Aggiorniamo quindi solo i conti realmente presenti nella risposta.
      const incoming = Array.isArray(data) ? data : [];
      setBrokerLiveStates(prev => {
        const byId = new Map((prev || []).map(row => [row.broker_account_id, row]));

        for (const row of incoming) {
          if (!row?.broker_account_id) continue;
          const oldRow = byId.get(row.broker_account_id) || {};

          // Manteniamo l'ultimo valore noto se un singolo campo arriva null/undefined.
          // Lo zero vero, invece, resta zero: non viene scambiato per dato mancante.
          const merged = { ...oldRow, ...row };
          for (const key of ["balance","credit","equity","margin","free_margin","margin_level","connected","algo_trading","last_seen_at","updated_at"]) {
            if (row[key] === null || row[key] === undefined) merged[key] = oldRow[key] ?? row[key];
          }
          byId.set(row.broker_account_id, merged);
        }

        return Array.from(byId.values());
      });

      setBrokerLiveError("");
      setBrokerLiveUpdatedAt(new Date());
    } catch (e) {
      console.error("Errore stato live Broker:", e);
      setBrokerLiveError(e?.message || "Stato live Broker non disponibile");
    } finally {
      if (!silent) setBrokerLiveLoading(false);
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
    loadBrokerAccounts();
    loadBrokerLiveStates();
    loadActiveChallengesFromSupabase();
    loadTradingSession();
  }, []);

  useEffect(() => {
    if (!tradingRuntimeActive) return;

    // Durante TRADING ON (o finché esiste un trade aperto) aggiorniamo lo stato MT5.
    // A riposo non c'è polling continuo verso Supabase.
    loadBrokerLiveStates({ silent: true });
    const id = setInterval(() => {
      loadBrokerLiveStates({ silent: true });
    }, 15000);
    return () => clearInterval(id);
  }, [tradingRuntimeActive]);

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

  const refreshAllSymbols = () => {
    const symbols = symbolsKey ? symbolsKey.split("|") : [];
    symbols.forEach(refreshSymbol);
  };

  useEffect(() => {
    if (!tradingRuntimeActive) return;

    // Prezzi live soltanto durante la sessione Trading o mentre un trade resta aperto.
    const symbols = symbolsKey ? symbolsKey.split("|") : [];
    symbols.forEach(refreshSymbol);

    const id = setInterval(() => {
      symbols.forEach(refreshSymbol);
    }, 5000);

    return () => clearInterval(id);
  }, [symbolsKey, tradingRuntimeActive]);

  const setChallenge = (id, patch) => {
    setChallenges(prev => prev.map(ch => ch.id === id ? { ...ch, ...patch } : ch));
  };

  const applyEngineDirectionToReadyChallenges = (direction) => {
    const dir = String(direction || "WAIT").toUpperCase();
    if (!["BUY","SELL"].includes(dir)) return;

    setChallenges(prev => prev.map(ch => {
      if (ch.archived) return ch;
      // Non cambiamo MAI la direzione di un trade gia' piazzato/aperto.
      if (ch.active) return ch;
      return { ...ch, direction: dir };
    }));
  };

  const setChallengeDirectionManual = (id, nextDirection) => {
    const dir = String(nextDirection || "WAIT").toUpperCase();

    if (
      engineAnalysisReady &&
      ["BUY","SELL"].includes(enginePropDirection) &&
      ["BUY","SELL"].includes(dir) &&
      dir !== enginePropDirection
    ) {
      const ok = window.confirm(
        `⚠️ STAI ANDANDO CONTRO LA PREVISIONE\n\n` +
        `Market Engine: PROP ${enginePropDirection}\n` +
        `Direzione scelta: PROP ${dir}\n\n` +
        `Vuoi mantenere comunque la tua scelta manuale?`
      );
      if (!ok) return;
    }

    setChallenge(id, { direction: dir });
  };

  useEffect(() => {
    if (
      !tradingEnabled ||
      !engineAnalysisReady ||
      !["BUY","SELL"].includes(enginePropDirection)
    ) return;

    // Applica il segnale anche quando si torna da PREVISIONI a OPERATIVITA'.
    // In questo modo una sincronizzazione cloud/UI non puo' lasciare una direzione vecchia.
    applyEngineDirectionToReadyChallenges(enginePropDirection);
  }, [tradingEnabled, engineAnalysisReady, enginePropDirection, mainView]);

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
    propOrigin: ch.propOrigin || (ch.propStage === "STEP 2" ? "STEP_2" : ch.propStage === "FUNDED / REAL" ? "REAL" : "NEW"),
    initialBrokerExposure: String(ch.initialBrokerExposure ?? ch?.importedExisting?.brokerExposureBaseline ?? "0"),
    dailyDdPct: ch.dailyDdPct ?? "3",
    highImpactNewsAllowed: ch.highImpactNewsAllowed === true,
    propNotes: ch.propNotes || "",
    themeId: ch.themeId || "",
    archived: ch.archived === true,
    archivedAt: ch.archivedAt || null,
    archiveStatus: ch.archiveStatus || "",
    brokerAccountId: ch.brokerAccountId || "",
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
    if (num(d.initialBrokerExposure) < 0) return alert("L'esposizione Broker pregressa non può essere negativa.");

    const startEquity = Math.min(num(d.accountBalance || d.accountSize), num(d.accountSize));
    const saved = {
      ...d,
      name: String(d.name).trim(),
      importedExisting: {
        ...(d.importedExisting || {}),
        brokerExposureBaseline: num(d.initialBrokerExposure)
      },
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
    if (!ch) return;
    if (ch.active) {
      alert("⛔ Non puoi archiviare una Prop con un'operazione attiva. Chiudi o annulla prima l'operazione.");
      return;
    }

    const exposureAtArchive = Math.max(0, num(challengeExposureMap?.[id] ?? ch.initialBrokerExposure ?? ch?.importedExisting?.brokerExposureBaseline));

    const choice = window.prompt(
      `📦 ARCHIVIA ${ch.name || "PROP"}\n\n` +
      `1 = SUPERATA STEP 1\n` +
      `2 = SUPERATA STEP 2\n` +
      `3 = PASSATA A FUNDED / REAL\n` +
      `4 = FALLITA\n` +
      `5 = CHIUSA / ALTRO\n\n` +
      `Esposizione Broker finale: $ ${fmt(exposureAtArchive,2)}\n\n` +
      `Scrivi 1, 2, 3, 4 o 5:`
    );
    if (choice === null) return;

    const statuses = {
      "1": "SUPERATA STEP 1",
      "2": "SUPERATA STEP 2",
      "3": "PASSATA A FUNDED / REAL",
      "4": "FALLITA",
      "5": "CHIUSA / ALTRO"
    };
    const archiveStatus = statuses[String(choice).trim()];
    if (!archiveStatus) {
      alert("Selezione non valida. Archiviazione annullata.");
      return;
    }

    const ok = window.confirm(
      `${ch.name || "Challenge"} verrà tolta dall'operatività ma NON cancellata.\n\n` +
      `Esito: ${archiveStatus}\n` +
      `Esposizione Broker congelata: $ ${fmt(exposureAtArchive,2)}\n` +
      `Costo iniziale: $ ${fmt(num(ch.propCost),2)}\n` +
      `Guadagno desiderato: $ ${fmt(num(ch.finalProfitTarget),2)}\n\n` +
      `Resterà consultabile nell'Archivio Challenge. Procedere?`
    );
    if (!ok) return;

    setChallenges(prev => prev.map(x => x.id === id ? {
      ...x,
      archived: true,
      archivedAt: new Date().toISOString(),
      archiveStatus,
      archivedBrokerExposure: exposureAtArchive
    } : x));

    setShowChallengeRegistry(false);
    setRegistryDraft(null);
    setRegistryEditingId(null);
  };

  const restoreChallenge = (id) => {
    setChallenges(prev => prev.map(x => x.id === id ? {
      ...x,
      archived:false,
      archivedAt:null,
      archiveStatus:""
    } : x));
    setMainView("OPERATIVITA");
  };

  const deleteHistoryRow = async (row) => {
    if (!row?.id) return;

    const ok = window.confirm(
      `🗑 ELIMINA OPERAZIONE DALLO STORICO?\n\n` +
      `Prop: ${row.prop_name || "—"}\n` +
      `Data: ${row.closed_at ? new Date(row.closed_at).toLocaleString("it-IT") : "—"}\n` +
      `P/L combinato: ${signedMoney(Number(row.combined_pl || 0))}\n\n` +
      `Questa cancellazione è definitiva su Supabase.`
    );
    if (!ok) return;

    try {
      const { error } = await supabase
        .from("prop_hedge_operations")
        .delete()
        .eq("id", row.id);

      if (error) throw error;
      setHistoryRows(prev => prev.filter(r => r.id !== row.id));
    } catch (e) {
      console.error("Errore eliminazione operazione storico:", e);
      alert("❌ Impossibile eliminare l'operazione:\n\n" + (e?.message || String(e)));
    }
  };

  const deleteFilteredHistory = async () => {
    if (historyFilters.prop === "TUTTE") {
      alert("Per sicurezza seleziona prima una singola Prop nel filtro.");
      return;
    }

    const rowsToDelete = filteredHistory;
    if (!rowsToDelete.length) {
      alert("Non ci sono operazioni da eliminare con i filtri attuali.");
      return;
    }

    const ok1 = window.confirm(
      `🧹 PULIZIA STORICO — ${historyFilters.prop}\n\n` +
      `Verranno eliminate definitivamente ${rowsToDelete.length} operazioni VISIBILI con i filtri attuali.\n\n` +
      `Procedere?`
    );
    if (!ok1) return;

    const typed = window.prompt(
      `Conferma definitiva.\n\nScrivi ELIMINA per cancellare ${rowsToDelete.length} operazioni di ${historyFilters.prop}.`
    );
    if (String(typed || "").trim().toUpperCase() !== "ELIMINA") return;

    try {
      const ids = rowsToDelete.map(r => r.id).filter(Boolean);
      if (!ids.length) return;

      const { error } = await supabase
        .from("prop_hedge_operations")
        .delete()
        .in("id", ids);

      if (error) throw error;

      const deleted = new Set(ids);
      setHistoryRows(prev => prev.filter(r => !deleted.has(r.id)));
    } catch (e) {
      console.error("Errore pulizia storico filtrato:", e);
      alert("❌ Pulizia storico fallita:\n\n" + (e?.message || String(e)));
    }
  };

  const permanentlyDeleteArchivedChallenge = async (ch) => {
    if (!ch?.id || !ch.archived) return;

    const linkedRows = historyRows.filter(
      r => r.challenge_id === ch.id || (!r.challenge_id && r.prop_name === ch.name)
    );

    const ok1 = window.confirm(
      `🚨 ELIMINAZIONE DEFINITIVA — ${ch.name}\n\n` +
      `Verranno cancellati:\n` +
      `• la challenge dall'Archivio\n` +
      `• ${linkedRows.length} operazioni storiche collegate\n\n` +
      `NON sarà possibile ripristinarla.\n\nContinuare?`
    );
    if (!ok1) return;

    const typed = window.prompt(
      `Ultima conferma.\n\nScrivi esattamente:\nELIMINA ${ch.name}`
    );
    if (String(typed || "").trim() !== `ELIMINA ${ch.name}`) {
      alert("Conferma non corrispondente. Nessuna cancellazione eseguita.");
      return;
    }

    try {
      const { data: userData } = await supabase.auth.getUser();
      const uid = userData?.user?.id;
      if (!uid) throw new Error("Utente Supabase non autenticato");

      // 1) Elimina storico collegato tramite challenge_id.
      const { error: historyByIdError } = await supabase
        .from("prop_hedge_operations")
        .delete()
        .eq("challenge_id", ch.id);
      if (historyByIdError) throw historyByIdError;

      // 2) Pulisce eventuali vecchie righe legacy senza challenge_id ma con lo stesso nome.
      const { error: legacyHistoryError } = await supabase
        .from("prop_hedge_operations")
        .delete()
        .is("challenge_id", null)
        .eq("prop_name", ch.name);
      if (legacyHistoryError) throw legacyHistoryError;

      // 3) Elimina subito lo stato cloud della challenge.
      const { error: cloudChallengeError } = await supabase
        .from("prop_hedge_active_challenges")
        .delete()
        .eq("user_id", uid)
        .eq("challenge_id", ch.id);
      if (cloudChallengeError) throw cloudChallengeError;

      // 4) Elimina dallo state locale/browser.
      setChallenges(prev => prev.filter(x => x.id !== ch.id));
      setHistoryRows(prev => prev.filter(
        r => !(r.challenge_id === ch.id || (!r.challenge_id && r.prop_name === ch.name))
      ));

      alert(`✅ ${ch.name} eliminata definitivamente insieme al suo storico.`);
    } catch (e) {
      console.error("Errore eliminazione definitiva challenge:", e);
      alert("❌ Eliminazione definitiva fallita:\n\n" + (e?.message || String(e)));
    }
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

      const importedBaseline = num(ch.initialBrokerExposure ?? ch?.importedExisting?.brokerExposureBaseline);
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

  const brokerLiveStateByAccountId = useMemo(() => {
    const map = {};
    for (const row of brokerLiveStates) map[row.broker_account_id] = row;
    return map;
  }, [brokerLiveStates]);

  const brokerLiveSummary = useMemo(() => {
    const now = Date.now();
    const activeAccounts = brokerAccounts.filter(a => a.active);
    const rows = activeAccounts.map(account => {
      const live = brokerLiveStateByAccountId[account.id] || null;
      const ageMs = live?.last_seen_at ? now - new Date(live.last_seen_at).getTime() : Infinity;
      const online = !!live && live.connected === true && ageMs <= MT5_LIVE_MAX_AGE_MS;
      return { account, live, ageMs, online };
    });

    const withState = rows.filter(x => x.live);
    const balance = withState.reduce((sum, x) => sum + num(x.live.balance), 0);
    const credit = withState.reduce((sum, x) => sum + num(x.live.credit), 0);
    const equity = withState.reduce((sum, x) => sum + num(x.live.equity), 0);
    const margin = withState.reduce((sum, x) => sum + num(x.live.margin), 0);
    const freeMargin = withState.reduce((sum, x) => sum + num(x.live.free_margin), 0);
    const onlineCount = rows.filter(x => x.online).length;

    return {
      rows,
      activeCount: activeAccounts.length,
      withStateCount: withState.length,
      onlineCount,
      balance,
      credit,
      equity,
      margin,
      freeMargin,
      allOnline: activeAccounts.length > 0 && onlineCount === activeAccounts.length
    };
  }, [brokerAccounts, brokerLiveStateByAccountId, brokerLiveStates]);

  // Se esistono heartbeat reali, il Broker centrale usa i valori MT5 aggregati.
  // Il vecchio saldo persistente resta come fallback per compatibilità con lo storico esistente.
  const hasBrokerLiveData = brokerLiveSummary.withStateCount > 0;
  const brokerBalanceCentral = hasBrokerLiveData ? brokerLiveSummary.balance : num(brokerBalance);
  const brokerCreditCentral = hasBrokerLiveData ? brokerLiveSummary.credit : 0;
  const brokerCapitalAvailable = brokerBalanceCentral + brokerCreditCentral;
  const brokerEquity = hasBrokerLiveData ? brokerLiveSummary.equity : num(brokerBalance) + floatingBrokerPL;
  const brokerFloatingLiveReal = hasBrokerLiveData
    ? brokerLiveSummary.equity - brokerLiveSummary.balance - brokerLiveSummary.credit
    : floatingBrokerPL;

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

  const waitForBridgeCommand = async (commandId, { timeoutMs = 30000, intervalMs = 1000 } = {}) => {
    const started = Date.now();

    while (Date.now() - started < timeoutMs) {
      const { data, error } = await supabase
        .from("prop_bridge_commands")
        .select("id,status,command_type,position_ticket,mt5_order,mt5_deal,close_deal,execution_price,realized_pl,result_payload,error_code,error_message,processed_at,closed_at")
        .eq("id", commandId)
        .maybeSingle();

      if (error) throw error;
      if (!data) throw new Error("Comando Bridge non trovato.");

      if (data.status === "executed" || data.status === "failed") return data;
      await new Promise(resolve => setTimeout(resolve, intervalMs));
    }

    return { id: commandId, status: "timeout" };
  };



  const labRoundToDigits = (value, digits) => {
    const d = Math.max(0, Number(digits) || 0);
    const p = Math.pow(10, d);
    return Math.round(Number(value) * p) / p;
  };

  const labCalculateTradingPreview = () => {
    setLabTradePreview(null);
    setLabTradeError("");
    setLabTradeStatus("");

    if (!labSymbolInfo) {
      setLabTradeError("Prima premi LEGGI DATI MT5 per questo asset.");
      return;
    }

    const side = String(labSide || "BUY").toUpperCase();
    const maxLoss = num(labMaxLossUsd);
    const target = num(labTargetUsd);

    if (!["BUY","SELL"].includes(side)) {
      setLabTradeError("Direzione Trading Lab non valida.");
      return;
    }

    if (!(maxLoss > 0)) {
      setLabTradeError("La perdita massima deve essere maggiore di 0 USD.");
      return;
    }

    if (!(target > 0)) {
      setLabTradeError("Il profitto desiderato deve essere maggiore di 0 USD.");
      return;
    }

    const tickSize = Number(labSymbolInfo.tick_size);
    const tickValueProfit = Number(
      labSymbolInfo.tick_value_profit ?? labSymbolInfo.tick_value
    );
    const tickValueLoss = Number(
      labSymbolInfo.tick_value_loss ?? labSymbolInfo.tick_value
    );
    const volumeMin = Number(labSymbolInfo.volume_min);
    const volumeMax = Number(labSymbolInfo.volume_max);
    const volumeStep = Number(labSymbolInfo.volume_step);
    const digits = Number(labSymbolInfo.digits);

    if (!(tickSize > 0) || !(tickValueProfit > 0) || !(tickValueLoss > 0)) {
      setLabTradeError("Tick size/value MT5 non validi per questo asset.");
      return;
    }

    if (!(volumeMin > 0) || !(volumeStep > 0)) {
      setLabTradeError("Volume minimo/step MT5 non validi.");
      return;
    }

    // Prima versione prudente del Lab:
    // il lotto è automatico e parte dal MINIMO eseguibile del broker.
    // In questo modo il Lab ottiene la massima distanza possibile da SL/TP
    // per gli importi monetari scelti, evitando di gonfiare la leva.
    const volume = Math.min(
      volumeMax > 0 ? volumeMax : volumeMin,
      Math.max(volumeMin, volumeMin)
    );

    const liveBid = Number(labSymbolInfo.bid);
    const liveAsk = Number(labSymbolInfo.ask);

    if (
      !Number.isFinite(liveBid) || liveBid <= 0 ||
      !Number.isFinite(liveAsk) || liveAsk <= 0
    ) {
      setLabTradePreview(null);
      setLabTradeError(
        "ASSET SENZA QUOTAZIONE — TRADE NON DISPONIBILE. Bid/Ask MT5 devono essere maggiori di zero."
      );
      return;
    }

    const entry = side === "BUY" ? liveAsk : liveBid;

    // tick_value è riferito a 1 lotto. Il P/L per tick sul volume scelto:
    const lossPerTick = tickValueLoss * volume;
    const profitPerTick = tickValueProfit * volume;

    if (!(lossPerTick > 0) || !(profitPerTick > 0)) {
      setLabTradeError("Valore monetario per tick non calcolabile.");
      return;
    }

    const slTicksRaw = maxLoss / lossPerTick;
    const tpTicksRaw = target / profitPerTick;

    // Arrotondamento prudenziale:
    // SL verso l'interno (mai oltre la perdita richiesta per effetto del rounding);
    // TP verso l'esterno (almeno il target teorico).
    const slTicks = Math.max(1, Math.floor(slTicksRaw + 1e-12));
    const tpTicks = Math.max(1, Math.ceil(tpTicksRaw - 1e-12));

    const slDistance = slTicks * tickSize;
    const tpDistance = tpTicks * tickSize;

    const sl = labRoundToDigits(
      side === "BUY" ? entry - slDistance : entry + slDistance,
      digits
    );

    const tp = labRoundToDigits(
      side === "BUY" ? entry + tpDistance : entry - tpDistance,
      digits
    );

    if (!(sl > 0) || !(tp > 0)) {
      setLabTradeError("SL/TP calcolati non validi.");
      return;
    }

    const estimatedLoss = slTicks * lossPerTick;
    const estimatedProfit = tpTicks * profitPerTick;
    const rr = estimatedLoss > 0 ? estimatedProfit / estimatedLoss : 0;

    setLabTradePreview({
      symbol: labSymbolInfo.resolved_symbol || labSymbolInfo.requested_symbol || labSymbol,
      side,
      entry,
      volume,
      sl,
      tp,
      digits,
      tickSize,
      tickValueProfit,
      tickValueLoss,
      maxLossRequested: maxLoss,
      targetRequested: target,
      estimatedLoss,
      estimatedProfit,
      rr,
      brokerAccountId: labBrokerAccountId,
      calculatedAt: new Date().toISOString(),
      method: "MIN_VOLUME"
    });
  };

  const notifyTradingLabTelegram = async (payload) => {
    try {
      const { data: sessionData } = await supabase.auth.getSession();
      const accessToken = sessionData?.session?.access_token;
      if (!accessToken) return { ok:false, error:"Sessione Supabase assente" };

      const response = await fetch("/api/prop-trade-watchdog", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${accessToken}`
        },
        body: JSON.stringify(payload)
      });

      const result = await response.json().catch(() => null);
      if (!response.ok || result?.ok === false) {
        return { ok:false, error:result?.error || `HTTP ${response.status}` };
      }

      return { ok:true, result };
    } catch (e) {
      console.warn("Trading Lab Telegram:", e);
      return { ok:false, error:e?.message || String(e) };
    }
  };

  const testTradingLabTelegram = async () => {
    setLabTradeError("");
    setLabTradeStatus("📨 Invio messaggio test Telegram…");

    const result = await notifyTradingLabTelegram({
      action: "lab_test_telegram"
    });

    if (result.ok) {
      setLabTradeStatus("✅ Telegram Trading Lab collegato: messaggio test inviato.");
    } else {
      setLabTradeError(`Telegram non inviato: ${result.error || "errore sconosciuto"}`);
      setLabTradeStatus("");
    }
  };


  const requestLabPositionInfo = async (tradeRow) => {
    const account = brokerAccounts.find(x => x.id === tradeRow.brokerAccountId) || null;
    if (!account) throw new Error("Account Trading Lab non trovato.");

    const { data: userData } = await supabase.auth.getUser();
    const uid = userData?.user?.id;
    if (!uid) throw new Error("Utente Supabase non autenticato");

    const payload = {
      user_id: uid,
      challenge_id: tradeRow.challengeId || `LAB-POS-${Date.now()}`,
      prop_name: "TRADING LAB",
      broker_account: String(account.mt5_login),
      symbol: tradeRow.symbol,
      side: tradeRow.side || "BUY",
      volume: 0.01,
      entry_price: null,
      sl: null,
      tp: null,
      command_type: "position_info",
      position_ticket: String(tradeRow.positionTicket),
      status: "pending"
    };

    const { data: command, error: commandError } = await supabase
      .from("prop_bridge_commands")
      .insert(payload)
      .select("id,status,command_type,position_ticket")
      .single();

    if (commandError) throw commandError;

    const result = await waitForBridgeCommand(
      command.id,
      { timeoutMs: tradingEnabled ? 30000 : 90000, intervalMs: 1000 }
    );

    if (result.status === "timeout") {
      throw new Error("Timeout POSITION_INFO");
    }
    if (result.status === "failed") {
      throw new Error(result.error_message || "POSITION_INFO fallito");
    }

    return result?.result_payload || {};
  };

  const refreshLabActiveTrades = async ({ silent = false } = {}) => {
    if (labPositionRefreshLockRef.current || !labActiveTrades.length) return;
    labPositionRefreshLockRef.current = true;
    setLabPositionRefreshing(true);

    try {
      const updates = [];
      const survivors = [];

      for (const tradeRow of labActiveTrades) {
        try {
          const info = await requestLabPositionInfo(tradeRow);

          if (info?.is_open === true) {
            survivors.push({
              ...tradeRow,
              floatingPL: Number(info.floating_pl || 0),
              currentPrice: Number(info.current_price || 0),
              lastCheckedAt: new Date().toISOString()
            });
            continue;
          }

          const realizedPL = Number(info?.realized_pl);
          const exitPrice = Number(info?.exit_price);
          const reason = String(info?.close_reason || "OTHER").toUpperCase();

          let action = "lab_trade_manual_close";
          if (reason === "TP") action = "lab_trade_tp";
          else if (reason === "SL") action = "lab_trade_sl";

          await notifyTradingLabTelegram({
            action,
            accountAlias: tradeRow.accountAlias,
            accountType: tradeRow.accountType,
            login: tradeRow.login,
            symbol: tradeRow.symbol,
            side: tradeRow.side,
            volume: tradeRow.volume,
            positionTicket: tradeRow.positionTicket,
            exitPrice: Number.isFinite(exitPrice) ? exitPrice : null,
            realizedPL: Number.isFinite(realizedPL) ? realizedPL : null
          });

          updates.push({
            ticket: tradeRow.positionTicket,
            reason,
            realizedPL
          });
        } catch (e) {
          survivors.push({
            ...tradeRow,
            lastCheckError: e?.message || String(e)
          });
        }
      }

      setLabActiveTrades(survivors);

      if (!silent) {
        if (updates.length) {
          setLabTradeStatus(
            `✅ Aggiornamento posizioni completato: ${updates.length} posizione/i chiusa/e rilevata/e e notificata/e su Telegram.`
          );
        } else {
          setLabTradeStatus("✅ Posizioni Trading Lab aggiornate.");
        }
      }
    } finally {
      labPositionRefreshLockRef.current = false;
      setLabPositionRefreshing(false);
    }
  };

  const closeLabTradeManually = async (tradeRow) => {
    if (!tradeRow?.positionTicket) return;

    const account = brokerAccounts.find(x => x.id === tradeRow.brokerAccountId) || null;
    if (!account) {
      setLabTradeError("Account Trading Lab non trovato.");
      return;
    }

    const ok = window.confirm(
      `Chiudere manualmente ${tradeRow.side} ${tradeRow.symbol}\n` +
      `Ticket ${tradeRow.positionTicket} su ${tradeRow.accountAlias}?`
    );
    if (!ok) return;

    try {
      setLabTradeError("");
      setLabTradeStatus("⏳ Invio chiusura Trading Lab al Bridge…");

      const { data: userData } = await supabase.auth.getUser();
      const uid = userData?.user?.id;
      if (!uid) throw new Error("Utente Supabase non autenticato");

      const payload = {
        user_id: uid,
        challenge_id: tradeRow.challengeId || `LAB-CLOSE-${Date.now()}`,
        prop_name: "TRADING LAB",
        broker_account: String(account.mt5_login),
        symbol: tradeRow.symbol,
        side: tradeRow.side || "BUY",
        volume: 0.01,
        entry_price: null,
        sl: null,
        tp: null,
        command_type: "close",
        position_ticket: String(tradeRow.positionTicket),
        status: "pending"
      };

      const { data: command, error: commandError } = await supabase
        .from("prop_bridge_commands")
        .insert(payload)
        .select("id,status,command_type,position_ticket")
        .single();

      if (commandError) throw commandError;

      const result = await waitForBridgeCommand(
        command.id,
        { timeoutMs: 30000, intervalMs: 750 }
      );

      if (result.status !== "executed") {
        throw new Error(result.error_message || `Chiusura non eseguita: ${result.status}`);
      }

      const realizedPL = Number(result.realized_pl);
      const exitPrice = Number(result.execution_price);

      await notifyTradingLabTelegram({
        action: "lab_trade_manual_close",
        accountAlias: tradeRow.accountAlias,
        accountType: tradeRow.accountType,
        login: tradeRow.login,
        symbol: tradeRow.symbol,
        side: tradeRow.side,
        volume: tradeRow.volume,
        positionTicket: tradeRow.positionTicket,
        exitPrice: Number.isFinite(exitPrice) ? exitPrice : null,
        realizedPL: Number.isFinite(realizedPL) ? realizedPL : null
      });

      setLabActiveTrades(prev =>
        prev.filter(x => String(x.positionTicket) !== String(tradeRow.positionTicket))
      );

      setLabTradeStatus(
        `✅ Posizione chiusa · Ticket ${tradeRow.positionTicket} · ` +
        `P/L ${Number.isFinite(realizedPL) ? (realizedPL >= 0 ? "+" : "") + "$" + fmt(realizedPL,2) : "n/d"} · 📨 Telegram OK`
      );

      await loadBrokerLiveStates({ silent: true });
    } catch (e) {
      setLabTradeError(e?.message || String(e));
    }
  };



  const scanAccumuloAssets = async () => {
    if (labAccumScanLoading) return;

    const account = brokerAccounts.find(x => x.id === labBrokerAccountId) || null;
    setLabAccumScanError("");
    setLabAccumScanRows([]);
    setLabAccumScanProgress({ current:0, total:0, pages:0 });

    if (!account) {
      setLabAccumScanError("Seleziona prima un account Broker.");
      return;
    }

    setLabAccumScanLoading(true);

    try {
      const { data: userData } = await supabase.auth.getUser();
      const uid = userData?.user?.id;
      if (!uid) throw new Error("Utente Supabase non autenticato");

      let offset = 0;
      let hasMore = true;
      let pageCount = 0;
      let allRows = [];
      let total = 0;

      while (hasMore) {
        pageCount += 1;

        const payload = {
          user_id: uid,
          challenge_id: `LAB-SCAN-${Date.now()}-${offset}`,
          prop_name: "TRADING LAB ACCUMULO",
          broker_account: String(account.mt5_login),
          symbol: `ACCUM_SCAN:${offset}`,
          side: "BUY",
          volume: 0.01,
          entry_price: null,
          sl: null,
          tp: null,
          command_type: "accum_scan",
          position_ticket: null,
          status: "pending"
        };

        const { data: command, error: commandError } = await supabase
          .from("prop_bridge_commands")
          .insert(payload)
          .select("id,status,created_at,updated_at")
          .single();

        if (commandError) throw commandError;
        if (!command?.id) throw new Error(`ACCUM_SCAN offset ${offset} creata senza ID.`);

        const result = await waitForBridgeCommand(
          command.id,
          { timeoutMs: 90000, intervalMs: 1000 }
        );

        if (result.status === "timeout") {
          throw new Error(`Timeout scanner asset al blocco ${offset}-${offset+19}.`);
        }
        if (result.status === "failed") {
          throw new Error(
            result.error_message ||
            `Scanner asset fallito al blocco ${offset}-${offset+19}.`
          );
        }

        const rp = result?.result_payload || {};
        const rows = Array.isArray(rp.rows) ? rp.rows : [];

        total = Number(rp.total || total || 0);

        const normalized = rows
          .map(x => ({
            symbol:String(x?.s || ""),
            description:String(x?.d || ""),
            category:String(x?.c || "ALTRO").toUpperCase(),
            minUsd:Number(x?.m),
            volumeMin:Number(x?.v),
            ask:Number(x?.a)
          }))
          .filter(x => x.symbol && Number.isFinite(x.minUsd) && x.minUsd > 0);

        allRows = allRows.concat(normalized);

        // Aggiorna già la tabella mentre procede.
        const deduped = Array.from(
          new Map(allRows.map(row => [row.symbol, row])).values()
        ).sort((a,b) => a.minUsd - b.minUsd);

        setLabAccumScanRows(deduped);

        offset = Number(rp.next_offset ?? (offset + 20));
        hasMore = rp.has_more === true;

        setLabAccumScanProgress({
          current: Math.min(offset, total || offset),
          total: total || offset,
          pages: pageCount
        });

        // Safety fuse.
        if (pageCount > 40) {
          throw new Error("Scanner interrotto: troppe pagine ricevute.");
        }
      }

      const finalRows = Array.from(
        new Map(allRows.map(row => [row.symbol, row])).values()
      ).sort((a,b) => a.minUsd - b.minUsd);

      setLabAccumScanRows(finalRows);

      if (!finalRows.length) {
        setLabAccumScanError(
          "Nessun asset con quotazione valida trovato nello scanner."
        );
      } else {
        setLabAccumStatus(
          `✅ Scanner completo: ${finalRows.length} asset quotati su ${total || finalRows.length} analizzati in ${pageCount} blocchi.`
        );
      }

    } catch (e) {
      setLabAccumScanError(e?.message || String(e));
    } finally {
      setLabAccumScanLoading(false);
    }
  };

  const chooseAccumScanAsset = async (symbol) => {
    setLabSymbol(symbol);
    setLabSymbolInfo(null);
    setLabTradePreview(null);
    setLabAccumPreview(null);
    setLabSymbolInfoError("");
    setLabAccumError("");
    setLabAccumStatus(`Asset ${symbol} selezionato. Premi LEGGI DATI MT5 per il dettaglio.`);
  };

  const labCalculateAccumuloPreview = () => {
    setLabAccumPreview(null);
    setLabAccumError("");
    setLabAccumStatus("");

    if (!labSymbolInfo) {
      setLabAccumError("Prima premi LEGGI DATI MT5 per questo asset.");
      return;
    }

    const requestedUsd = num(labAccumUsd);
    if (!(requestedUsd > 0)) {
      setLabAccumError("L'importo da accumulare deve essere maggiore di 0 USD.");
      return;
    }

    const bid = Number(labSymbolInfo.bid);
    const ask = Number(labSymbolInfo.ask);
    const tickSize = Number(labSymbolInfo.tick_size);
    const tickValue = Number(
      labSymbolInfo.tick_value_profit ??
      labSymbolInfo.tick_value ??
      labSymbolInfo.tick_value_loss
    );
    const volumeMin = Number(labSymbolInfo.volume_min);
    const volumeMax = Number(labSymbolInfo.volume_max);
    const volumeStep = Number(labSymbolInfo.volume_step);
    const digits = Number(labSymbolInfo.digits);

    if (!(ask > 0) || !(bid > 0)) {
      setLabAccumError("Asset senza quotazione live: accumulo non disponibile.");
      return;
    }
    if (!(tickSize > 0) || !(tickValue > 0)) {
      setLabAccumError("Tick size/value MT5 non validi per calcolare l'esposizione in USD.");
      return;
    }
    if (!(volumeMin > 0) || !(volumeStep > 0)) {
      setLabAccumError("Volume minimo/step MT5 non validi.");
      return;
    }

    // Conversione robusta in valuta conto:
    // notional USD stimato per 1 lotto = prezzo * tickValue / tickSize.
    // Funziona anche quando la valuta profitto non è USD perché MT5 restituisce
    // tickValue già convertito nella valuta del conto.
    const notionalPerLotUsd = ask * tickValue / tickSize;
    if (!(notionalPerLotUsd > 0) || !Number.isFinite(notionalPerLotUsd)) {
      setLabAccumError("Esposizione USD per lotto non calcolabile.");
      return;
    }

    const rawVolume = requestedUsd / notionalPerLotUsd;
    const stepUnits = Math.round(rawVolume / volumeStep);
    let volume = stepUnits * volumeStep;

    // Non possiamo inviare meno del minimo broker.
    if (volume < volumeMin) volume = volumeMin;
    if (volumeMax > 0 && volume > volumeMax) volume = volumeMax;

    // Evita residui floating tipo 0.009999999.
    const stepDecimals = Math.max(
      0,
      (String(volumeStep).split(".")[1] || "").length
    );
    volume = Number(volume.toFixed(Math.max(stepDecimals, 2)));

    const actualUsd = volume * notionalPerLotUsd;
    const minimumUsd = volumeMin * notionalPerLotUsd;
    const differenceUsd = actualUsd - requestedUsd;
    const forcedMinimum = requestedUsd + 1e-9 < minimumUsd;

    setLabAccumPreview({
      symbol: labSymbolInfo.resolved_symbol || labSymbolInfo.requested_symbol || labSymbol,
      side: "BUY",
      entry: labRoundToDigits(ask, digits),
      requestedUsd,
      volume,
      actualUsd,
      minimumUsd,
      differenceUsd,
      forcedMinimum,
      brokerAccountId: labBrokerAccountId,
      calculatedAt: new Date().toISOString()
    });
  };

  const submitLabAccumulo = async () => {
    if (labAccumSubmitting) return;

    setLabAccumError("");
    setLabAccumStatus("");

    const preview = labAccumPreview;
    if (!preview) {
      setLabAccumError("Calcola prima l'accumulo.");
      return;
    }

    const account = brokerAccounts.find(x => x.id === labBrokerAccountId) || null;
    if (!account) {
      setLabAccumError("Account Broker non trovato.");
      return;
    }

    const live = brokerLiveStateByAccountId[account.id] || null;
    const liveAgeMs = live?.last_seen_at
      ? Date.now() - new Date(live.last_seen_at).getTime()
      : Infinity;
    const online =
      !!live &&
      live.connected === true &&
      liveAgeMs <= MT5_LIVE_MAX_AGE_MS;

    if (!online) {
      setLabAccumError("La MT5 deve essere ONLINE per inviare l'accumulo.");
      return;
    }
    if (!tradingEnabled) {
      setLabAccumError("Premi AVVIA TRADING prima di inviare un accumulo reale.");
      return;
    }

    const isReal = String(account.account_type || "real").toLowerCase() === "real";
    const summary =
      `${preview.symbol} · BUY senza SL/TP\n` +
      `Importo richiesto: $ ${fmt(preview.requestedUsd,2)}\n` +
      `Lotto eseguibile: ${preview.volume}\n` +
      `Esposizione effettiva stimata: $ ${fmt(preview.actualUsd,2)}\n` +
      `Minimo broker stimato: $ ${fmt(preview.minimumUsd,2)}`;

    if (isReal) {
      const ok = window.confirm(
        `⚠️ ACCUMULO SU DENARO REALE — ${account.alias || account.broker}\n\n` +
        `${summary}\n\n` +
        `NESSUNO STOP LOSS · NESSUN TAKE PROFIT.\n` +
        `La posizione resta aperta finché non la chiudi tu.\n\nProcedere?`
      );
      if (!ok) return;

      const typed = window.prompt(
        `Conferma finale ACCUMULO REALE.\n\nScrivi ACCUMULA per acquistare ${preview.symbol}.`
      );
      if (String(typed || "").trim().toUpperCase() !== "ACCUMULA") {
        setLabAccumStatus("Accumulo annullato.");
        return;
      }
    } else {
      const ok = window.confirm(`🧪 ACCUMULO DEMO\n\n${summary}\n\nInviare?`);
      if (!ok) return;
    }

    setLabAccumSubmitting(true);

    try {
      const { data: userData } = await supabase.auth.getUser();
      const uid = userData?.user?.id;
      if (!uid) throw new Error("Utente Supabase non autenticato");

      const { data: existing, error: existingError } = await supabase
        .from("prop_bridge_commands")
        .select("id,status")
        .eq("user_id", uid)
        .eq("broker_account", String(account.mt5_login))
        .in("status", ["pending","processing"])
        .limit(1);

      if (existingError) throw existingError;
      if (Array.isArray(existing) && existing.length) {
        throw new Error("Esiste già un comando pending/processing su questo conto. Attendi.");
      }

      const accumId = `LAB-ACCUM-${Date.now()}`;

      const commandPayload = {
        user_id: uid,
        challenge_id: accumId,
        prop_name: "TRADING LAB ACCUMULO",
        broker_account: String(account.mt5_login),
        symbol: preview.symbol,
        side: "BUY",
        volume: Number(preview.volume),
        entry_price: Number(preview.entry),
        sl: 0,
        tp: 0,
        command_type: "open",
        position_ticket: null,
        status: "pending"
      };

      const { data: command, error: commandError } = await supabase
        .from("prop_bridge_commands")
        .insert(commandPayload)
        .select("id,status")
        .single();

      if (commandError) throw commandError;
      if (!command?.id) throw new Error("Comando ACCUMULO creato senza ID.");

      setLabLastCommandId(command.id);
      setLabAccumStatus("⏳ Accumulo inviato al Bridge. Attendo MT5…");

      const result = await waitForBridgeCommand(
        command.id,
        { timeoutMs: 30000, intervalMs: 750 }
      );

      if (result.status === "timeout") {
        throw new Error("Timeout: MT5 non ha confermato l'accumulo entro 30 secondi.");
      }
      if (result.status === "failed") {
        throw new Error(
          `ACCUMULO FALLITO${result.error_code ? ` [${result.error_code}]` : ""}: ` +
          `${result.error_message || "errore MT5 non specificato"}`
        );
      }
      if (result.status !== "executed") {
        throw new Error(`Stato Bridge inatteso: ${result.status}`);
      }

      const executionPrice = Number.isFinite(Number(result.execution_price))
        ? Number(result.execution_price)
        : preview.entry;

      if (result.position_ticket) {
        setLabAccumPositions(prev => {
          const next = prev.filter(
            x => String(x.positionTicket) !== String(result.position_ticket)
          );
          next.push({
            id: `ACC-${result.position_ticket}`,
            challengeId: accumId,
            brokerAccountId: account.id,
            accountAlias: account.alias || account.broker || String(account.mt5_login),
            accountType: account.account_type || "real",
            login: String(account.mt5_login),
            symbol: preview.symbol,
            side: "BUY",
            volume: Number(preview.volume),
            requestedUsd: Number(preview.requestedUsd),
            actualUsd: Number(preview.actualUsd),
            entry: executionPrice,
            positionTicket: String(result.position_ticket),
            openedAt: new Date().toISOString()
          });
          return next;
        });
      }

      setLabAccumStatus(
        `✅ ACCUMULO ESEGUITO · ${preview.symbol} · Lotto ${preview.volume} · ` +
        `Ticket ${result.position_ticket || "—"} · Entry ${executionPrice}`
      );

      await loadBrokerLiveStates({ silent: true });
      setLabAccumPreview(null);

    } catch (e) {
      console.error("Trading Lab ACCUMULO:", e);
      setLabAccumError(e?.message || String(e));
    } finally {
      setLabAccumSubmitting(false);
    }
  };

  const submitLabTrade = async () => {
    if (labTradeSubmitting) return;
    setLabTradeError("");
    setLabTradeStatus("");

    const preview = labTradePreview;
    if (!preview) {
      setLabTradeError("Calcola prima il trade.");
      return;
    }

    const account = brokerAccounts.find(x => x.id === labBrokerAccountId) || null;
    if (!account) {
      setLabTradeError("Account Broker non trovato.");
      return;
    }

    const live = brokerLiveStateByAccountId[account.id] || null;
    const liveAgeMs = live?.last_seen_at
      ? Date.now() - new Date(live.last_seen_at).getTime()
      : Infinity;
    const online =
      !!live &&
      live.connected === true &&
      liveAgeMs <= MT5_LIVE_MAX_AGE_MS;

    if (!online) {
      setLabTradeError(
        "Per INVIA ORDINE la MT5 deve essere ONLINE con heartbeat recente. Premi AVVIA TRADING e attendi che il conto passi ONLINE."
      );
      return;
    }

    if (!tradingEnabled) {
      setLabTradeError("Premi AVVIA TRADING prima di inviare un ordine reale.");
      return;
    }

    const isReal = String(account.account_type || "real").toLowerCase() === "real";

    const summary =
      `${preview.symbol} · ${preview.side}\n` +
      `Lotto: ${preview.volume}\n` +
      `Entry stimato: ${preview.entry}\n` +
      `SL: ${preview.sl} ≈ -$ ${fmt(preview.estimatedLoss,2)}\n` +
      `TP: ${preview.tp} ≈ +$ ${fmt(preview.estimatedProfit,2)}\n` +
      `R/R: 1:${fmt(preview.rr,2)}`;

    if (isReal) {
      const confirmReal = window.confirm(
        `⚠️ ORDINE SU DENARO REALE — ${account.alias || account.broker}\n\n` +
        `${summary}\n\n` +
        `Questo ordine verrà inviato davvero alla MT5.\n\nProcedere?`
      );
      if (!confirmReal) return;

      const typed = window.prompt(
        `Conferma finale DENARO REALE.\n\nScrivi ORDINA per inviare ${preview.side} ${preview.symbol}.`
      );
      if (String(typed || "").trim().toUpperCase() !== "ORDINA") {
        setLabTradeStatus("Ordine annullato.");
        return;
      }
    } else {
      const ok = window.confirm(
        `🧪 ORDINE TRADING LAB — CONTO DEMO\n\n${summary}\n\nInviare?`
      );
      if (!ok) return;
    }

    setLabTradeSubmitting(true);

    try {
      const { data: userData } = await supabase.auth.getUser();
      const uid = userData?.user?.id;
      if (!uid) throw new Error("Utente Supabase non autenticato");

      const { data: existing, error: existingError } = await supabase
        .from("prop_bridge_commands")
        .select("id,status,broker_account,symbol,command_type,prop_name")
        .eq("user_id", uid)
        .eq("broker_account", String(account.mt5_login))
        .in("status", ["pending","processing"])
        .limit(1);

      if (existingError) throw existingError;
      if (Array.isArray(existing) && existing.length) {
        throw new Error(
          `Esiste già un comando ${existing[0].status} sul conto ${account.alias || account.mt5_login}. Attendi che venga completato.`
        );
      }

      const labTradeId = `LAB-TRADE-${Date.now()}`;

      const commandPayload = {
        user_id: uid,
        challenge_id: labTradeId,
        prop_name: "TRADING LAB",
        broker_account: String(account.mt5_login),
        symbol: preview.symbol,
        side: preview.side,
        volume: Number(preview.volume),
        entry_price: Number(preview.entry),
        sl: Number(preview.sl),
        tp: Number(preview.tp),
        command_type: "open",
        position_ticket: null,
        status: "pending"
      };

      const { data: command, error: commandError } = await supabase
        .from("prop_bridge_commands")
        .insert(commandPayload)
        .select("id,status,command_type,broker_account,symbol,side,volume,sl,tp")
        .single();

      if (commandError) throw commandError;
      if (!command?.id) throw new Error("Comando Trading Lab creato senza ID.");

      setLabLastCommandId(command.id);
      setLabTradeStatus("Ordine inviato al Bridge. Attendo conferma MT5…");

      const result = await waitForBridgeCommand(
        command.id,
        { timeoutMs: 30000, intervalMs: 750 }
      );

      if (result.status === "timeout") {
        throw new Error(
          "Timeout: MT5 non ha confermato l'apertura entro 30 secondi. Controlla MT5 prima di riprovare."
        );
      }

      if (result.status === "failed") {
        throw new Error(
          `APERTURA FALLITA${result.error_code ? ` [${result.error_code}]` : ""}: ` +
          `${result.error_message || "errore MT5 non specificato"}`
        );
      }

      if (result.status !== "executed") {
        throw new Error(`Stato Bridge inatteso: ${result.status}`);
      }

      const executionPrice = Number.isFinite(Number(result.execution_price))
        ? Number(result.execution_price)
        : preview.entry;

      const telegramResult = await notifyTradingLabTelegram({
        action: "lab_trade_opened",
        accountAlias: account.alias || account.broker || String(account.mt5_login),
        accountType: account.account_type || "real",
        login: String(account.mt5_login),
        symbol: preview.symbol,
        side: preview.side,
        volume: Number(preview.volume),
        entry: executionPrice,
        sl: Number(preview.sl),
        tp: Number(preview.tp),
        maxLossUsd: Number(preview.estimatedLoss),
        targetUsd: Number(preview.estimatedProfit),
        positionTicket: result.position_ticket || null
      });

      setLabTradeStatus(
        `✅ ORDINE ESEGUITO · Ticket ${result.position_ticket || "—"} · Prezzo ${executionPrice}` +
        (telegramResult.ok ? " · 📨 Telegram OK" : " · ⚠️ Telegram non inviato")
      );

      if (result.position_ticket) {
        setLabActiveTrades(prev => {
          const next = prev.filter(
            x => String(x.positionTicket) !== String(result.position_ticket)
          );

          next.push({
            id: `LAB-${result.position_ticket}`,
            challengeId: labTradeId,
            brokerAccountId: account.id,
            accountAlias: account.alias || account.broker || String(account.mt5_login),
            accountType: account.account_type || "real",
            login: String(account.mt5_login),
            symbol: preview.symbol,
            side: preview.side,
            volume: Number(preview.volume),
            entry: executionPrice,
            sl: Number(preview.sl),
            tp: Number(preview.tp),
            maxLossUsd: Number(preview.estimatedLoss),
            targetUsd: Number(preview.estimatedProfit),
            positionTicket: String(result.position_ticket),
            openedAt: new Date().toISOString(),
            floatingPL: 0,
            currentPrice: executionPrice
          });

          return next;
        });
      }

      await loadBrokerLiveStates({ silent: true });

      // Dopo l'esecuzione invalidiamo la preview perché Bid/Ask potrebbero essere cambiati.
      setLabTradePreview(null);

    } catch (e) {
      console.error("Trading Lab OPEN:", e);
      setLabTradeError(e?.message || String(e));
    } finally {
      setLabTradeSubmitting(false);
    }
  };


  useEffect(() => {
    if (!labActiveTrades.length) return undefined;

    // Solo mentre esistono posizioni Trading Lab aperte.
    // Il lock impedisce sovrapposizioni se una risposta MT5 impiega più di 15 sec.
    const timer = window.setInterval(() => {
      refreshLabActiveTrades({ silent: true });
    }, 15000);

    return () => window.clearInterval(timer);
  }, [labActiveTrades.length, tradingEnabled]);

  const requestLabSymbolList = async (accountId = labBrokerAccountId) => {
    if (labSymbolsLoading) return;

    const account = brokerAccounts.find(x => x.id === accountId) || null;
    setLabSymbolsError("");
    setLabSymbols([]);

    if (!account) {
      setLabSymbolsError("Seleziona un account Broker.");
      return;
    }

    if (account.active === false) {
      setLabSymbolsError("L'account Broker selezionato è disattivato.");
      return;
    }

    setLabSymbolsLoading(true);

    try {
      const { data: userData } = await supabase.auth.getUser();
      const uid = userData?.user?.id;
      if (!uid) throw new Error("Utente Supabase non autenticato");

      // Recupera un'eventuale richiesta recente già in corso.
      const { data: existing, error: existingError } = await supabase
        .from("prop_bridge_commands")
        .select("id,status,broker_account,command_type,created_at,updated_at,result_payload")
        .eq("user_id", uid)
        .eq("broker_account", String(account.mt5_login))
        .eq("command_type", "symbol_list")
        .in("status", ["pending", "processing"])
        .order("created_at", { ascending: false })
        .limit(1);

      if (existingError) throw existingError;

      let command = null;
      if (Array.isArray(existing) && existing.length) {
        const pending = existing[0];
        const bornAt = new Date(pending.created_at || pending.updated_at || 0).getTime();
        const ageMs = Number.isFinite(bornAt) ? Date.now() - bornAt : Infinity;

        if (ageMs <= 180000) {
          command = pending;
        } else {
          await supabase
            .from("prop_bridge_commands")
            .update({
              status: "failed",
              error_code: "stale_symbol_list",
              error_message: "Richiesta SYMBOL_LIST scaduta dal Trading Lab",
              processed_at: new Date().toISOString(),
              updated_at: new Date().toISOString()
            })
            .eq("user_id", uid)
            .eq("id", pending.id)
            .in("status", ["pending", "processing"]);
        }
      }

      if (!command) {
        const payload = {
          user_id: uid,
          challenge_id: `LAB-LIST-${Date.now()}`,
          prop_name: "TRADING LAB",
          broker_account: String(account.mt5_login),
          symbol: "SYMBOL_LIST",
          side: "BUY",
          volume: 0.01,
          entry_price: null,
          sl: null,
          tp: null,
          command_type: "symbol_list",
          position_ticket: null,
          status: "pending"
        };

        const { data: inserted, error: commandError } = await supabase
          .from("prop_bridge_commands")
          .insert(payload)
          .select("id,status,command_type,broker_account,created_at,updated_at")
          .single();

        if (commandError) throw commandError;
        if (!inserted?.id) throw new Error("Richiesta SYMBOL_LIST creata senza ID.");
        command = inserted;
      }

      const result = await waitForBridgeCommand(
        command.id,
        { timeoutMs: 90000, intervalMs: 750 }
      );

      const rp = result?.result_payload || {};
      const rows = Array.isArray(rp.symbols) ? rp.symbols : [];

      if (!rows.length) {
        throw new Error("La MT5 non ha restituito simboli disponibili.");
      }

      // v1.14 Bridge restituisce una lista LIGHT di stringhe.
      // Manteniamo compatibilità anche con l'eventuale vecchio formato a oggetti.
      const normalized = rows
        .map(x => {
          if (typeof x === "string") {
            return {
              symbol: x,
              description: "",
              path: "",
              currency_base: "",
              currency_profit: ""
            };
          }
          if (x && x.symbol) {
            return {
              symbol: String(x.symbol),
              description: String(x.description || ""),
              path: String(x.path || ""),
              currency_base: String(x.currency_base || ""),
              currency_profit: String(x.currency_profit || "")
            };
          }
          return null;
        })
        .filter(Boolean)
        .sort((a,b) => a.symbol.localeCompare(b.symbol));

      setLabSymbols(normalized);

      // Se il simbolo corrente non esiste sul nuovo broker, seleziona il primo.
      const currentExists = normalized.some(x => x.symbol === labSymbol);
      if (!currentExists && normalized[0]?.symbol) {
        setLabSymbol(normalized[0].symbol);
        setLabSymbolInfo(null);
        setLabTradePreview(null);
      }
    } catch (e) {
      setLabSymbolsError(e?.message || String(e));
    } finally {
      setLabSymbolsLoading(false);
    }
  };

  const requestLabSymbolInfo = async () => {
    if (labSymbolInfoLoading) return;

    const account = brokerAccounts.find(x => x.id === labBrokerAccountId) || null;
    const symbol = String(labSymbol || "").trim().toUpperCase();

    setLabSymbolInfo(null);
    setLabSymbolInfoError("");
    setLabLastCommandId(null);

    if (!account) {
      setLabSymbolInfoError("Seleziona un account Broker.");
      return;
    }

    if (!symbol) {
      setLabSymbolInfoError("Inserisci un asset/simbolo MT5.");
      return;
    }

    if (account.active === false) {
      setLabSymbolInfoError("L'account Broker selezionato è disattivato.");
      return;
    }

    const liveState = brokerLiveStateByAccountId[account.id] || null;
    const liveAgeMs = liveState?.last_seen_at
      ? Date.now() - new Date(liveState.last_seen_at).getTime()
      : Infinity;

    const online =
      !!liveState &&
      liveState.connected === true &&
      liveAgeMs <= MT5_LIVE_MAX_AGE_MS;

    // IMPORTANTE:
    // con TRADING OFF il Bridge entra in SLEEP e NON manda heartbeat continuo.
    // Continua però a fare GET ogni 60 secondi, quindi SYMBOL_INFO resta utilizzabile.
    // Per questo motivo qui NON blocchiamo più la richiesta se l'heartbeat è vecchio.
    const labBridgeMode = online ? "ONLINE" : "SLEEP";

    setLabSymbolInfoLoading(true);
    setLabWaitSeconds(90);

    const labCountdownTimer = window.setInterval(() => {
      setLabWaitSeconds(prev => {
        if (prev <= 1) {
          window.clearInterval(labCountdownTimer);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    try {
      const { data: userData } = await supabase.auth.getUser();
      const uid = userData?.user?.id;
      if (!uid) throw new Error("Utente Supabase non autenticato");

      // Un solo SYMBOL_INFO alla volta per conto.
      // Se ne esiste già uno, NON generiamo un doppione:
      // - se è recente, riprendiamo ad attenderne il risultato;
      // - se è vecchio oltre 3 minuti, lo marchiamo failed e ne creiamo uno nuovo.
      const { data: existing, error: existingError } = await supabase
        .from("prop_bridge_commands")
        .select("id,status,broker_account,symbol,command_type,created_at,updated_at")
        .eq("user_id", uid)
        .eq("broker_account", String(account.mt5_login))
        .eq("command_type", "symbol_info")
        .in("status", ["pending", "processing"])
        .order("created_at", { ascending: false })
        .limit(1);

      if (existingError) throw existingError;

      let command = null;

      if (Array.isArray(existing) && existing.length) {
        const pending = existing[0];
        const bornAt = new Date(pending.created_at || pending.updated_at || 0).getTime();
        const ageMs = Number.isFinite(bornAt) ? Date.now() - bornAt : Infinity;

        if (ageMs <= 180000) {
          command = pending;
          setLabTradeStatus(
            `♻️ Riprendo la richiesta MT5 già pendente (${pending.id}).`
          );
        } else {
          const { error: staleError } = await supabase
            .from("prop_bridge_commands")
            .update({
              status: "failed",
              error_code: "stale_symbol_info",
              error_message: "Richiesta SYMBOL_INFO scaduta dal Trading Lab",
              processed_at: new Date().toISOString(),
              updated_at: new Date().toISOString()
            })
            .eq("user_id", uid)
            .eq("id", pending.id)
            .in("status", ["pending", "processing"]);

          if (staleError) throw staleError;
        }
      }

      if (!command) {
        const payload = {
          user_id: uid,
          challenge_id: `LAB-SYMBOL-${Date.now()}`,
          prop_name: "TRADING LAB",
          broker_account: String(account.mt5_login),
          symbol,
          // Valori neutri: SYMBOL_INFO non li usa.
          side: "BUY",
          volume: 0.01,
          entry_price: null,
          sl: null,
          tp: null,
          command_type: "symbol_info",
          position_ticket: null,
          status: "pending"
        };

        const { data: inserted, error: commandError } = await supabase
          .from("prop_bridge_commands")
          .insert(payload)
          .select("id,status,command_type,broker_account,symbol,created_at,updated_at")
          .single();

        if (commandError) throw commandError;
        if (!inserted?.id) throw new Error("Richiesta SYMBOL_INFO creata senza ID.");
        command = inserted;
      }

      setLabLastCommandId(command.id);

      const result = await waitForBridgeCommand(
        command.id,
        { timeoutMs: 90000, intervalMs: 750 }
      );

      if (result.status === "timeout") {
        throw new Error(
          "Timeout: la MT5 non ha risposto entro 90 secondi. Con Trading OFF il Bridge controlla i comandi ogni 60 secondi; se non risponde, controlla che MT5 ed EA siano realmente aperti."
        );
      }

      if (result.status === "failed") {
        throw new Error(
          `SYMBOL_INFO fallito${result.error_code ? ` [${result.error_code}]` : ""}: ` +
          `${result.error_message || "errore MT5 non specificato"}`
        );
      }

      if (result.status !== "executed") {
        throw new Error(`Stato SYMBOL_INFO inatteso: ${result.status}`);
      }

      const info = result.result_payload;
      if (!info || typeof info !== "object") {
        throw new Error(
          "MT5 ha risposto ma result_payload è vuoto. Verifica route v1.11 e colonna result_payload."
        );
      }

      setLabSymbolInfo({
        ...info,
        requested_account_id: account.id,
        requested_account_alias: account.alias || account.broker || account.mt5_login,
        requested_account_type: account.account_type || "real",
        requested_login: account.mt5_login,
        requested_server: account.mt5_server,
        fetched_at: new Date().toISOString()
      });

      await loadBrokerLiveStates({ silent: true });
    } catch (e) {
      console.error("Trading Lab SYMBOL_INFO:", e);
      setLabSymbolInfoError(e?.message || String(e));
    } finally {
      window.clearInterval(labCountdownTimer);
      setLabWaitSeconds(0);
      setLabSymbolInfoLoading(false);
    }
  };

  const buildMonitoringSnapshot = (ch, c, executionSource = "profittracker") => {
    const forecastFromEngine = String(
      engineSignalSnapshot?.forecastDirection ||
      (["BUY","SELL"].includes(enginePropDirection)
        ? (enginePropDirection === "BUY" ? "SELL" : "BUY")
        : "WAIT")
    ).toUpperCase();

    return {
      executionSource,
      monitoringActive: true,
      initialForecast: forecastFromEngine,
      initialForecastConfidence: Number.isFinite(Number(engineSignalSnapshot?.confidence))
        ? Number(engineSignalSnapshot.confidence)
        : null,
      initialForecastScore: Number.isFinite(Number(engineSignalSnapshot?.score))
        ? Number(engineSignalSnapshot.score)
        : null,
      initialForecastAt: engineSignalSnapshot?.analyzedAt || new Date().toISOString(),
      telegram: {
        enabled: true,
        waitCount: 0,
        firstWaitSent: false,
        secondWaitSent: false,
        reversalSent: false,
        m15Warn4SentFor: null,
        m15Warn8SentFor: null,
        tpSent: false,
        slSent: false,
        lastSignalTime: null
      }
    };
  };

  const placeExternalTrade = async (id) => {
    const ch = challenges.find(x => x.id === id);
    const c = calcs[id];
    if (!ch || !c || !c.px || !c.propLots) {
      alert("Controlla prezzo, rischio, SL e lotti Prop prima di avviare il monitoraggio.");
      return;
    }

    if (!tradingEnabled) {
      alert("⛔ TRADING NON ATTIVO\\n\\nPremi AVVIA TRADING prima di registrare un'operazione esterna.");
      return;
    }

    const selectedBrokerAccount = brokerAccountById(ch?.brokerAccountId);
    const selectedBrokerLiveState = selectedBrokerAccount
      ? brokerLiveStateByAccountId[selectedBrokerAccount.id] || null
      : null;

    const ok = window.confirm(
      `📡 OPERAZIONE PIAZZATA ESTERNAMENTE — ${ch.name}\\n\\n` +
      `Prop: ${ch.direction} ${c.propLots.toFixed(2)} ${ch.asset}\\n` +
      `Broker previsto: ${c.brokerDirection} ${c.brokerLots.toFixed(2)}\\n` +
      `Entry: ${c.px.toFixed(c.a.decimals)}\\n` +
      `TP Prop: ${c.propTPPrice.toFixed(c.a.decimals)}\\n` +
      `SL Prop: ${c.propSL.toFixed(c.a.decimals)}\\n\\n` +
      `ProfitTracker NON invierà ordini al Broker.\\n` +
      `Attiverà soltanto monitoraggio, saldi e alert Telegram.\\n\\nConfermi?`
    );
    if (!ok) return;

    const placedAt = new Date().toISOString();
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
        brokerLots: c.brokerLots,
        propTP: c.propTPPrice,
        propSL: c.propSL,
        brokerTP: c.brokerTP,
        brokerSL: c.brokerSL,
        propBalanceStart: num(ch.accountBalance),
        brokerBalanceStart: selectedBrokerLiveState
          ? num(selectedBrokerLiveState.balance)
          : num(brokerBalance),
        quoteToUsd: c.quoteToUsd,
        maxBrokerLossAtEntry: c.maxBrokerLoss,
        hedgeEnabledAtEntry: true,
        brokerAccountId: selectedBrokerAccount?.id || "",
        brokerAlias: selectedBrokerAccount?.alias || "ESTERNO",
        brokerName: selectedBrokerAccount?.broker || "ESTERNO",
        brokerLogin: selectedBrokerAccount?.mt5_login || "",
        brokerServer: selectedBrokerAccount?.mt5_server || "",
        bridgeCommandId: null,
        bridgeCommandStatus: null,
        placedAt,
        ...buildMonitoringSnapshot(ch, c, "external")
      },
      closePropPL: "",
      closeBrokerPL: ""
    });

    alert(
      `✅ MONITORAGGIO ATTIVATO\\n\\n` +
      `${ch.name} · ${ch.asset}\\n` +
      `Origine: ESTERNA / MANUALE\\n` +
      `ProfitTracker ora considera l'operazione APERTA e la seguirà per alert, TP/SL e saldo Prop.`
    );
  };

  const placeTrade = async (id) => {
    const ch = challenges.find(x => x.id === id);
    const c = calcs[id];
    const hedgeEnabledAtEntry = ch?.hedgeEnabled !== false;
    const selectedBrokerAccount = brokerAccountById(ch?.brokerAccountId);
    const selectedBrokerLiveState = selectedBrokerAccount
      ? brokerLiveStateByAccountId[selectedBrokerAccount.id] || null
      : null;
    const selectedBrokerBalanceAtEntry = hedgeEnabledAtEntry && selectedBrokerLiveState
      ? num(selectedBrokerLiveState.balance)
      : num(brokerBalance);

    if (bridgeSubmitting[id]) return;

    if (!tradingEnabled) {
      alert("⛔ TRADING NON ATTIVO\n\nPremi AVVIA TRADING prima di piazzare una nuova operazione.");
      return;
    }

    if (hedgeEnabledAtEntry && !selectedBrokerAccount) {
      alert("Seleziona il conto Broker MT5 da usare per questa Prop.");
      return;
    }

    if (hedgeEnabledAtEntry && selectedBrokerAccount?.active === false) {
      alert("Il conto Broker selezionato è disattivato. Riattivalo o scegli un altro conto.");
      return;
    }

    if (hedgeEnabledAtEntry) {
      // Le MT5 vengono avviate automaticamente con Windows: niente più launcher remoto.
      // Per sicurezza verifichiamo direttamente l'heartbeat dell'EA del conto selezionato.
      const liveAgeMs = selectedBrokerLiveState?.last_seen_at
        ? Date.now() - new Date(selectedBrokerLiveState.last_seen_at).getTime()
        : Infinity;
      const selectedMt5Online = !!selectedBrokerLiveState &&
        selectedBrokerLiveState.connected === true &&
        liveAgeMs <= 30000;

      if (!selectedMt5Online) {
        alert(
          `⛔ MT5 NON LIVE — ${selectedBrokerAccount.alias || selectedBrokerAccount.broker}\n\n` +
          "La MT5 deve essere aperta, connessa e con l'EA operativo.\n" +
          "La PIAZZATA è bloccata per sicurezza."
        );
        return;
      }

      const safety = safetyFor(id);
      if (!safety || safety.reason === "NO_ACCOUNT") {
        alert("Seleziona un conto Broker MT5 valido prima di piazzare.");
        return;
      }
      if (safety.reason === "OFFLINE") {
        alert(`⛔ ${safety.brokerAlias} non ha un heartbeat MT5 online recente.\n\nOperazione bloccata per sicurezza.`);
        return;
      }
      if (safety.level === "red") {
        alert(
          `⛔ COPERTURA NON SOSTENIBILE — ${safety.brokerAlias}\n\n` +
          `Equity account: $ ${fmt(safety.brokerEquity,2)}\n` +
          `Esposizione conservativa dopo questo trade: $ ${fmt(safety.projectedExposure,2)}\n` +
          `Buffer risultante: $ ${fmt(safety.projectedResidual,2)}\n\n` +
          `La PIAZZATA è bloccata: gli altri conti Broker non vengono usati per coprire questa Prop.`
        );
        return;
      }
    }

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

    setBridgeSubmitting(prev => ({ ...prev, [id]: true }));

    try {
      let bridgeCommandId = null;

      if (hedgeEnabledAtEntry) {
        const { data: userData } = await supabase.auth.getUser();
        const uid = userData?.user?.id;
        if (!uid) throw new Error("Utente Supabase non autenticato");

        // Protezione anti-doppione lato UI/database: non creiamo un nuovo comando
        // se questa challenge ne ha già uno pending o processing.
        const { data: existingCommands, error: existingError } = await supabase
          .from("prop_bridge_commands")
          .select("id,status,broker_account,symbol,side,volume")
          .eq("user_id", uid)
          .eq("challenge_id", ch.id)
          .in("status", ["pending", "processing"])
          .limit(1);

        if (existingError) throw existingError;

        if (Array.isArray(existingCommands) && existingCommands.length) {
          const existing = existingCommands[0];
          throw new Error(
            `Esiste già un comando ${existing.status} per ${ch.name} (ID ${existing.id}). ` +
            `Nessun nuovo comando è stato creato.`
          );
        }

        const commandPayload = {
          user_id: uid,
          challenge_id: ch.id,
          prop_name: ch.name || "Prop",
          broker_account: String(selectedBrokerAccount.mt5_login),
          symbol: ch.asset,
          side: c.brokerDirection,
          volume: Number(c.brokerLots),
          entry_price: Number(c.px),
          sl: Number(c.brokerSL),
          tp: Number(c.brokerTP),
          command_type: "open",
          position_ticket: null,
          status: "pending"
        };

        const { data: insertedCommand, error: commandError } = await supabase
          .from("prop_bridge_commands")
          .insert(commandPayload)
          .select("id,status,command_type,broker_account,symbol,side,volume,sl,tp,position_ticket")
          .single();

        if (commandError) throw commandError;
        bridgeCommandId = insertedCommand?.id || null;

        if (!bridgeCommandId) {
          throw new Error("Comando Bridge creato senza ID. Operazione annullata.");
        }
      }

      const placedAt = new Date().toISOString();

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
          brokerBalanceStart: selectedBrokerBalanceAtEntry,
          quoteToUsd: c.quoteToUsd,
          maxBrokerLossAtEntry: hedgeEnabledAtEntry ? c.maxBrokerLoss : 0,
          hedgeEnabledAtEntry,
          brokerAccountId: hedgeEnabledAtEntry ? selectedBrokerAccount?.id || "" : "",
          brokerAlias: hedgeEnabledAtEntry ? selectedBrokerAccount?.alias || "" : "",
          brokerName: hedgeEnabledAtEntry ? selectedBrokerAccount?.broker || "" : "",
          brokerLogin: hedgeEnabledAtEntry ? selectedBrokerAccount?.mt5_login || "" : "",
          brokerServer: hedgeEnabledAtEntry ? selectedBrokerAccount?.mt5_server || "" : "",
          bridgeCommandId,
          bridgeCommandStatus: hedgeEnabledAtEntry ? "pending" : null,
          placedAt,
          ...buildMonitoringSnapshot(ch, c, "profittracker")
        },
        closePropPL: "",
        closeBrokerPL: ""
      });

      if (hedgeEnabledAtEntry) {
        alert(
          `✅ COMANDO BRIDGE CREATO\n\n` +
          `Prop: ${ch.name}\n` +
          `Broker: ${selectedBrokerAccount.alias} — ${selectedBrokerAccount.mt5_login}\n` +
          `Ordine: ${c.brokerDirection} ${c.brokerLots.toFixed(2)} ${ch.asset}\n` +
          `TP: ${c.brokerTP.toFixed(c.a.decimals)}\n` +
          `SL: ${c.brokerSL.toFixed(c.a.decimals)}\n\n` +
          `Command ID: ${bridgeCommandId}\n` +
          `Stato: pending`
        );
      }
    } catch (e) {
      console.error("Errore creazione comando Prop Bridge:", e);
      alert(
        `❌ COMANDO BROKER NON CREATO\n\n` +
        `${e?.message || String(e)}\n\n` +
        `La challenge NON è stata avviata.`
      );
    } finally {
      setBridgeSubmitting(prev => ({ ...prev, [id]: false }));
    }
  };

  const notifyManualCloseTelegram = async ({
    ch,
    propPL,
    brokerPL,
    propBalanceAfter,
    brokerBalanceAfter
  }) => {
    try {
      const { data: sessionData } = await supabase.auth.getSession();
      const accessToken = sessionData?.session?.access_token;
      if (!accessToken) return false;

      const response = await fetch("/api/prop-trade-watchdog", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${accessToken}`
        },
        body: JSON.stringify({
          action: "manual_close",
          propName: ch?.name || "Prop",
          symbol: ch?.active?.asset || ch?.asset || "XAUUSD",
          executionSource: ch?.active?.executionSource || "profittracker",
          propDirection: ch?.active?.direction || ch?.direction || "—",
          brokerDirection: ch?.active?.brokerDirection || "—",
          propPL,
          brokerPL,
          propBalanceAfter,
          brokerBalanceAfter
        })
      });

      const payload = await response.json().catch(() => null);
      if (!response.ok || payload?.ok === false) {
        console.warn("Telegram manual close non inviato:", payload);
        return false;
      }
      return true;
    } catch (e) {
      console.warn("Telegram manual close error:", e);
      return false;
    }
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
    if (bridgeClosing[id]) return;

    setBridgeClosing(prev => ({ ...prev, [id]: true }));

    try {
      let brokerPLFromMt5 = null;
      let brokerExitPrice = tracking.current;
      let bridgeCloseCommandId = null;

      // Se la copertura Broker era attiva, PRIMA chiudiamo davvero la posizione MT5.
      if (
        ch.active.executionSource !== "external" &&
        ch.active.hedgeEnabledAtEntry &&
        num(ch.active.brokerLots) > 0
      ) {
        const { data: userData } = await supabase.auth.getUser();
        const uid = userData?.user?.id;
        if (!uid) throw new Error("Utente Supabase non autenticato");

        if (!ch.active.bridgeCommandId) {
          throw new Error("Manca il Command ID di apertura Broker: chiusura automatica bloccata.");
        }

        const { data: openCommand, error: openCommandError } = await supabase
          .from("prop_bridge_commands")
          .select("id,status,command_type,position_ticket,mt5_order,mt5_deal,execution_price,error_code,error_message")
          .eq("user_id", uid)
          .eq("id", ch.active.bridgeCommandId)
          .maybeSingle();

        if (openCommandError) throw openCommandError;
        if (!openCommand) throw new Error("Comando di apertura Broker non trovato.");
        if (openCommand.status !== "executed") {
          throw new Error(
            `La copertura Broker non risulta EXECUTED (stato: ${openCommand.status || "sconosciuto"}). ` +
            `Non posso inviare una chiusura automatica sicura.`
          );
        }
        if (!openCommand.position_ticket) {
          throw new Error("MT5 non ha restituito il position ticket dell'apertura. Chiusura automatica bloccata.");
        }

        // Evita doppi CLOSE sulla stessa challenge.
        const { data: existingClose, error: existingCloseError } = await supabase
          .from("prop_bridge_commands")
          .select("id,status")
          .eq("user_id", uid)
          .eq("challenge_id", ch.id)
          .eq("command_type", "close")
          .in("status", ["pending", "processing"])
          .limit(1);

        if (existingCloseError) throw existingCloseError;
        if (Array.isArray(existingClose) && existingClose.length) {
          throw new Error(`Esiste già un comando CLOSE ${existingClose[0].status} per questa challenge.`);
        }

        const closePayload = {
          user_id: uid,
          challenge_id: ch.id,
          prop_name: ch.name || "Prop",
          broker_account: String(ch.active.brokerLogin || ""),
          symbol: ch.active.asset,
          side: ch.active.brokerDirection,
          volume: Number(ch.active.brokerLots),
          entry_price: Number(tracking.current),
          sl: null,
          tp: null,
          command_type: "close",
          position_ticket: String(openCommand.position_ticket),
          status: "pending"
        };

        const { data: closeCommand, error: closeCommandError } = await supabase
          .from("prop_bridge_commands")
          .insert(closePayload)
          .select("id,status,command_type,position_ticket")
          .single();

        if (closeCommandError) throw closeCommandError;
        bridgeCloseCommandId = closeCommand?.id || null;
        if (!bridgeCloseCommandId) throw new Error("Comando CLOSE creato senza ID.");

        const closeResult = await waitForBridgeCommand(bridgeCloseCommandId, { timeoutMs: 30000, intervalMs: 1000 });

        if (closeResult.status === "timeout") {
          throw new Error(
            "Timeout: MT5 non ha confermato la chiusura entro 30 secondi. " +
            "La challenge resta aperta: controlla MT5 prima di riprovare."
          );
        }

        if (closeResult.status === "failed") {
          throw new Error(
            `CHIUSURA BROKER FALLITA${closeResult.error_code ? ` [${closeResult.error_code}]` : ""}: ` +
            `${closeResult.error_message || "errore MT5 non specificato"}`
          );
        }

        if (closeResult.status !== "executed") {
          throw new Error(`Stato chiusura Broker inatteso: ${closeResult.status}`);
        }

        if (Number.isFinite(Number(closeResult.realized_pl))) {
          brokerPLFromMt5 = Number(closeResult.realized_pl);
        }
        if (Number.isFinite(Number(closeResult.execution_price))) {
          brokerExitPrice = Number(closeResult.execution_price);
        }
      }

      const propPLFinal = ch.closePropPL === "" ? tracking.propPL : num(ch.closePropPL);
      // Se MT5 ha chiuso davvero, il P/L reale restituito dal broker ha priorità su stima/manuale.
      const brokerPLFinal = brokerPLFromMt5 !== null
        ? brokerPLFromMt5
        : (ch.closeBrokerPL === "" ? tracking.brokerPL : num(ch.closeBrokerPL));

      const newPropBalance = ch.active.propBalanceStart + propPLFinal;
      // Storico multi-account: il saldo Broker della riga appartiene SOLO al conto assegnato alla Prop.
      const brokerAccountBalanceStart = Number.isFinite(Number(ch.active.brokerBalanceStart))
        ? Number(ch.active.brokerBalanceStart)
        : num(brokerBalance);
      const newBrokerRealizedBalance = brokerAccountBalanceStart + brokerPLFinal;
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
        exit_price: brokerExitPrice,

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
        used_manual_broker_pl: brokerPLFromMt5 === null && ch.closeBrokerPL !== "",

        status: "closed",
        metadata: {
          quote_to_usd: tracking.quoteToUsd,
          live_source: live?.source || "",
          live_time: live?.time || null,
          bridge_open_command_id: ch.active.bridgeCommandId || null,
          bridge_close_command_id: bridgeCloseCommandId,
          broker_position_ticket: ch.active.bridgePositionTicket || null,
          broker_close_execution_price: brokerExitPrice,
          broker_account_id: ch.active.brokerAccountId || null,
          broker_login: ch.active.brokerLogin || null,
          broker_alias: ch.active.brokerAlias || null,
          broker_pl_source: brokerPLFromMt5 !== null ? "mt5_realized" : (ch.closeBrokerPL !== "" ? "manual" : "theoretical")
        }
      };

      const { data: insertedRows, error } = await supabase
        .from("prop_hedge_operations")
        .insert(historyRecord)
        .select("id")
        .limit(1);

      if (error) throw error;

      const insertedId = insertedRows?.[0]?.id || null;

      // Con heartbeat MT5 live il saldo reale arriva direttamente dai singoli conti:
      // non sovrascriviamo il vecchio saldo Broker globale con il saldo di un solo account.
      if (!hasBrokerLiveData) {
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

        setBrokerBalance(String(Number(newBrokerRealizedBalance.toFixed(2))));
        setBrokerBalanceUpdated(false);
      }

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
        loadBrokerAdjustments(),
        loadBrokerLiveStates({ silent: true })
      ]);

      await notifyManualCloseTelegram({
        ch,
        propPL: propPLFinal,
        brokerPL: brokerPLFinal,
        propBalanceAfter: newPropBalance,
        brokerBalanceAfter: newBrokerRealizedBalance
      });

      if (bridgeCloseCommandId) {
        alert(
          `✅ BROKER CHIUSO E SALDI AGGIORNATI\n\n` +
          `Prop: ${ch.name}\n` +
          `P/L Broker MT5: ${signedMoney(brokerPLFinal)}\n` +
          `Close Command: ${bridgeCloseCommandId}`
        );
      }
    } catch (e) {
      console.error("Errore chiusura Prop Hedge:", e);
      alert(
        "❌ CHIUSURA / AGGIORNAMENTO NON COMPLETATO\n\n" +
        (e?.message || String(e)) +
        "\n\nLa challenge resta aperta. Controlla MT5 e riprova solo dopo aver verificato lo stato reale della posizione."
      );
    } finally {
      setBridgeClosing(prev => ({ ...prev, [id]: false }));
    }
  };

  const totalCombinedPL = activeChallenges.reduce(
    (sum, ch) => sum + (trackings[ch.id]?.combinedPL || 0),
    0
  );

  // Sicurezza PER SINGOLO ACCOUNT BROKER: una Prop usa solo l'equity del conto MT5 assegnato.
  // Le altre MT5 non possono "prestare" capitale a questa challenge.
  const safetyFor = (id) => {
    const c = calcs[id];
    const ch = challenges.find(x => x.id === id);
    if (!c || ch?.active || ch?.hedgeEnabled === false) return null;

    const account = brokerAccountById(ch?.brokerAccountId);
    if (!account) {
      return { level:"red", reason:"NO_ACCOUNT", brokerAlias:"Nessun conto", brokerEquity:0, currentExposure:0, projectedExposure:c.maxBrokerLoss, requiredWithBuffer:c.maxBrokerLoss * 1.20, projectedResidual:-c.maxBrokerLoss };
    }

    const live = brokerLiveStateByAccountId[account.id] || null;
    const ageMs = live?.last_seen_at ? Date.now() - new Date(live.last_seen_at).getTime() : Infinity;
    const hasSnapshot = !!live;
    const online = hasSnapshot && live.connected === true && ageMs <= MT5_LIVE_MAX_AGE_MS;
    // Mai trasformare un dato momentaneamente vecchio in equity zero.
    // Manteniamo l'ultimo snapshot reale e segnaliamo STALE.
    const accountEquity = hasSnapshot ? num(live.equity) : 0;

    // Somma soltanto il rischio residuo delle operazioni già attive SULLO STESSO conto MT5.
    const currentExposure = activeChallenges.reduce((sum, activeCh) => {
      if (activeCh.active?.brokerAccountId !== account.id) return sum;
      return sum + (trackings[activeCh.id]?.remainingBrokerLoss || 0);
    }, 0);

    const projectedExposure = currentExposure + c.maxBrokerLoss;
    const requiredWithBuffer = projectedExposure * 1.20;

    let level = "red";
    let reason = "OK";

    if (!hasSnapshot) {
      level = "stale";
      reason = "NO_LIVE_DATA";
    } else if (!online) {
      level = "stale";
      reason = "STALE";
    } else if (accountEquity >= requiredWithBuffer) {
      level = "green";
    } else if (accountEquity >= projectedExposure) {
      level = "yellow";
    }

    return {
      level,
      reason,
      brokerAlias: account.alias || account.broker || "Broker",
      brokerEquity: accountEquity,
      currentExposure,
      projectedExposure,
      requiredWithBuffer,
      projectedResidual: accountEquity - projectedExposure,
      online,
      ageMs,
      hasSnapshot
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


  const jumpToChallenge = (challengeId) => {
    setMainView("OPERATIVITA");

    // Aspetta il render della vista Operatività e poi porta la Prop in cima.
    window.setTimeout(() => {
      const el = document.getElementById(`prop-card-${challengeId}`);
      if (!el) return;

      el.scrollIntoView({
        behavior: "smooth",
        block: "start"
      });

      // Piccolo highlight temporaneo per individuarla al volo.
      el.animate(
        [
          { boxShadow: "0 0 0 0 rgba(56,189,248,0)" },
          { boxShadow: "0 0 0 4px rgba(56,189,248,.42), 0 0 34px rgba(56,189,248,.22)" },
          { boxShadow: "0 0 0 0 rgba(56,189,248,0)" }
        ],
        { duration: 1200, easing: "ease-out" }
      );
    }, 60);
  };

  const safetyStyle = {
    green: { icon:"🟢", title:"CAPITALE SUFFICIENTE", bg:"rgba(34,197,94,.12)", border:"rgba(34,197,94,.45)", color:"#86efac" },
    yellow:{ icon:"🟡", title:"ATTENZIONE — BUFFER RIDOTTO", bg:"rgba(245,158,11,.12)", border:"rgba(245,158,11,.48)", color:"#fde68a" },
    red:   { icon:"🔴", title:"CAPITALE INSUFFICIENTE", bg:"rgba(239,68,68,.12)", border:"rgba(239,68,68,.48)", color:"#fca5a5" },
    stale: { icon:"⚪", title:"DATI MT5 TEMPORANEAMENTE NON AGGIORNATI", bg:"rgba(100,116,139,.12)", border:"rgba(148,163,184,.42)", color:"#cbd5e1" }
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
              <div>
                <label style={fieldLabel}>Origine Prop</label>
                <select style={input} value={registryDraft.propOrigin || "NEW"} onChange={e=>setRegistryDraft(d=>({...d,propOrigin:e.target.value}))}>
                  <option value="NEW">Nuova challenge</option>
                  <option value="STEP_2">Passaggio a Step 2</option>
                  <option value="REAL">Conto Funded / Real</option>
                </select>
              </div>
              <div>
                <label style={fieldLabel}>Conto Broker predefinito per questa Prop</label>
                <select style={input} value={registryDraft.brokerAccountId || ""} onChange={e=>setRegistryDraft(d=>({...d,brokerAccountId:e.target.value}))}>
                  <option value="">— Seleziona account Broker —</option>
                  {brokerAccounts.filter(a=>a.active).map(a=>(
                    <option key={a.id} value={a.id}>{a.alias} — {a.broker} ({a.mt5_login})</option>
                  ))}
                </select>
              </div>
              <TextNumberField label="Valore Prop / Account Size ($)" value={registryDraft.accountSize || ""} onChange={v=>setRegistryDraft(d=>({...d,accountSize:v,accountBalance: registryEditingId ? d.accountBalance : v}))}/>
              <TextNumberField label="TP Prop ($)" value={registryDraft.tpProp || ""} onChange={v=>setRegistryDraft(d=>({...d,tpProp:v}))}/>
              <TextNumberField label="DD Max Prop (%)" value={registryDraft.ddMax || ""} onChange={v=>setRegistryDraft(d=>({...d,ddMax:v}))}/>
              <TextNumberField label="DD giornaliero Prop (%)" value={registryDraft.dailyDdPct || ""} onChange={v=>setRegistryDraft(d=>({...d,dailyDdPct:v}))}/>
              <TextNumberField label="Costo iniziale da recuperare ($)" value={registryDraft.propCost || ""} onChange={v=>setRegistryDraft(d=>({...d,propCost:v}))}/>
              <TextNumberField label="Esposizione Broker pregressa ($)" value={registryDraft.initialBrokerExposure || "0"} onChange={v=>setRegistryDraft(d=>({...d,initialBrokerExposure:v}))}/>
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

            <div style={{marginTop:14,padding:"12px 14px",borderRadius:14,border:"1px solid rgba(34,197,94,.30)",background:"rgba(20,83,45,.10)",color:"#bbf7d0",fontSize:12,lineHeight:1.55}}>
              <b>Recupero economico:</b> costo iniziale + esposizione Broker pregressa + guadagno desiderato.
              Per una challenge nuova lascia l'esposizione a 0. Per Step 2 / Funded / Real inserisci l'esposizione ereditata dalla fase precedente.
            </div>

            <div style={{marginTop:14,padding:"12px 14px",borderRadius:14,border:"1px solid rgba(245,158,11,.35)",background:"rgba(120,53,15,.10)",color:"#fde68a",fontSize:12}}>
              🛡️ DD giornaliero prudenziale: a ogni nuovo giorno la baseline è il minore tra saldo/equity corrente e valore iniziale della Prop. Se sei sopra il valore iniziale, il limite non aumenta.
            </div>

            <div style={{display:"flex",justifyContent:"space-between",gap:10,marginTop:18,flexWrap:"wrap"}}>
              <div>
                {registryEditingId && !challenges.find(x=>x.id===registryEditingId)?.archived && (
                  <button
                    style={{...secondaryButton,color:"#fecdd3",border:"1px solid rgba(244,63,94,.55)",background:"rgba(127,29,29,.16)"}}
                    onClick={()=>removeChallenge(registryEditingId)}
                  >
                    📦 ARCHIVIA PROP
                  </button>
                )}
              </div>
              <div style={{display:"flex",gap:10,flexWrap:"wrap"}}>
                <button style={secondaryButton} onClick={()=>{setShowChallengeRegistry(false);setRegistryDraft(null);setRegistryEditingId(null);}}>Annulla</button>
                <button style={primaryButtonBlue} onClick={saveChallengeRegistry}>💾 Salva scheda Prop</button>
              </div>
            </div>
          </div>
        </div>
      )}
      <div style={{ display:"flex", justifyContent:"space-between", gap:12, flexWrap:"wrap", alignItems:"flex-start" }}>
        <div>
          <h2 style={sectionTitle}>📈 Prop Hedge — Multi Challenge</h2>
          <p style={sectionDescription}>
            Più Prop contemporaneamente, con conto Broker dedicato per ogni challenge e controllo dell'esposizione aggregata.
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

          <button
            style={{
              ...primaryButtonBlue,
              border: tradingEnabled ? "1px solid rgba(248,113,113,.72)" : "1px solid rgba(34,197,94,.72)",
              background: tradingEnabled
                ? "linear-gradient(135deg,#991b1b,#dc2626)"
                : "linear-gradient(135deg,#166534,#16a34a)",
              color:"#ffffff",
              minWidth:170
            }}
            disabled={tradingSyncing || !tradingSessionLoaded}
            onClick={toggleTrading}
            title={tradingEnabled ? "Ferma la sessione di trading" : "Attiva Market Engine, prezzi live e operatività"}
          >
            {tradingSyncing
              ? "⏳ AGGIORNO TRADING…"
              : tradingEnabled
                ? "🔴 STOP TRADING"
                : "🟢 AVVIA TRADING"}
          </button>

          <button
            style={secondaryButton}
            onClick={refreshAllSymbols}
            title="Aggiorna una sola volta i prezzi senza avviare la sessione"
          >
            ↻ Prezzi ora
          </button>

          <button style={primaryButtonBlue} onClick={addChallenge}>+ Aggiungi Challenge</button>
        </div>
      </div>

      <div style={{display:"flex",gap:8,flexWrap:"wrap",padding:6,borderRadius:16,border:"1px solid rgba(51,65,85,.72)",background:"rgba(2,6,23,.42)"}}>
        {[["OPERATIVITA","📈 OPERATIVITÀ"],["PREVISIONI","🔮 PREVISIONI OPERATIVE"],["ACCOUNT_BROKER","⚙️ ACCOUNT BROKER"],["TRADING_LAB","🧪 TRADING LAB"],["STORICO","📚 STORICO PROP"],["ARCHIVIO","🗂️ ARCHIVIO CHALLENGE"]].map(([key,label])=>(
          <button key={key} onClick={()=>setMainView(key)} style={{
            ...secondaryButton,
            background:mainView===key?"rgba(30,64,175,.48)":"rgba(15,23,42,.48)",
            border:mainView===key?"1px solid rgba(96,165,250,.72)":"1px solid rgba(71,85,105,.58)",
            color:mainView===key?"#dbeafe":"#94a3b8"
          }}>{label}</button>
        ))}

        <div style={{
          marginLeft:"auto",
          padding:"9px 12px",
          borderRadius:12,
          border: tradingRuntimeActive ? "1px solid rgba(34,197,94,.38)" : "1px solid rgba(100,116,139,.45)",
          background: tradingRuntimeActive ? "rgba(22,163,74,.10)" : "rgba(15,23,42,.48)",
          color: tradingRuntimeActive ? "#86efac" : "#94a3b8",
          fontSize:11,
          fontWeight:900
        }}>
          {tradingEnabled
            ? "🟢 SESSIONE TRADING ATTIVA"
            : hasActiveTrade
              ? "🟠 SOLO MONITORAGGIO TRADE"
              : "⚫ TRADING IN PAUSA"}
        </div>
      </div>

      {mainView === "OPERATIVITA" && (<>

      <div style={{
        display:"flex",
        gap:8,
        flexWrap:"wrap",
        alignItems:"center",
        padding:"9px 10px",
        borderRadius:14,
        border:"1px solid rgba(56,189,248,.26)",
        background:"rgba(2,6,23,.52)"
      }}>
        <span style={{
          color:"#64748b",
          fontSize:10,
          fontWeight:950,
          letterSpacing:.55,
          marginRight:2
        }}>
          VAI ALLA PROP
        </span>

        {challenges.filter(ch => !ch.archived).map((ch,index) => {
          const theme = getPropTheme(ch,index);
          return (
            <button
              key={`jump-${ch.id}`}
              onClick={()=>jumpToChallenge(ch.id)}
              title={`Vai direttamente a ${ch.name || "Prop"}`}
              style={{
                ...secondaryButton,
                padding:"7px 11px",
                border:`1px solid ${theme.border}`,
                background:ch.active ? "rgba(20,83,45,.20)" : theme.bg,
                color:ch.active ? "#86efac" : theme.accent,
                fontWeight:950,
                boxShadow:ch.active ? "0 0 12px rgba(34,197,94,.10)" : "none"
              }}
            >
              {ch.active ? "● " : ""}{ch.name || "Prop"}
            </button>
          );
        })}
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

      <div style={{
        ...panel,
        border:"1px solid rgba(59,130,246,.34)",
        background:"linear-gradient(135deg,rgba(30,64,175,.08),rgba(15,23,42,.96))"
      }}>
        <div style={{...panelHeader,alignItems:"center"}}>
          <div>
            <h3 style={panelTitle}>📈 Grafico TradingView</h3>
            <p style={panelSubtitle}>Grafico operativo indipendente dal Market Engine. Cambia asset liberamente senza modificare la previsione, che per ora resta calibrata su XAUUSD.</p>
          </div>

          <div style={{display:"flex",gap:8,alignItems:"center",flexWrap:"wrap"}}>
            <label style={{fontSize:14,color:"#94a3b8",fontWeight:900}}>ASSET GRAFICO</label>
            <select
              value={chartSymbol}
              onChange={e=>setChartSymbol(e.target.value)}
              style={{...input,marginBottom:0,minWidth:190,padding:"8px 10px"}}
            >
              {Object.entries(ASSETS).map(([key,asset]) => (
                <option key={key} value={key}>{asset?.label || key}</option>
              ))}
            </select>
            <div style={{
              color:"#93c5fd",
              fontSize:9,
              fontWeight:900,
              border:"1px solid rgba(59,130,246,.28)",
              background:"rgba(30,64,175,.10)",
              padding:"6px 9px",
              borderRadius:999
            }}>
              TradingView Advanced Chart
            </div>
          </div>
        </div>

        <div style={{fontSize:11,color:"#cbd5e1",marginBottom:9}}>
          Visualizzazione corrente: <b style={{color:"#93c5fd"}}>{ASSETS[chartSymbol]?.label || chartSymbol}</b>
        </div>

        <TradingViewChart symbol={chartSymbol} />
      </div>

      <div style={{
        ...panel,
        border:"1px solid rgba(56,189,248,.34)",
        background:"linear-gradient(135deg,rgba(14,116,144,.10),rgba(15,23,42,.96))"
      }}>
        <div style={panelHeader}>
          <div>
            <h3 style={panelTitle}>🏦 Broker centrale</h3>
            <p style={panelSubtitle}>Somma automatica dei conti Broker MT5 attivi. Aggiornamento rapido solo durante Trading/monitoraggio.</p>
          </div>
          <div style={{display:"flex",gap:10,flexWrap:"wrap",alignItems:"center"}}>
            <span style={{ color:brokerLiveSummary.allOnline?"#5eead4":"#fde68a", fontWeight:900 }}>
              {brokerLiveSummary.onlineCount}/{brokerLiveSummary.activeCount} MT5 online
            </span>
            <span style={{ color:"#5eead4", fontWeight:900 }}>
              {activeChallenges.length} operazion{activeChallenges.length === 1 ? "e" : "i"} attiv{activeChallenges.length === 1 ? "a" : "e"}
            </span>
            <button style={secondaryButton} onClick={()=>loadBrokerLiveStates()} disabled={brokerLiveLoading}>
              {brokerLiveLoading ? "Aggiorno…" : "↻ Aggiorna MT5"}
            </button>
          </div>
        </div>

        {brokerLiveError && (
          <div style={{...hintBox,border:"1px solid rgba(239,68,68,.35)",color:"#fecaca",marginBottom:12}}>
            ⚠️ {brokerLiveError}
          </div>
        )}

        <div style={grid2}>
          <div style={{...statCard,border:"1px solid rgba(34,211,238,.38)"}}>
            <div style={statLabel}>Saldo Broker totale</div>
            <div style={statValue}>$ {fmt(brokerBalanceCentral,2)}</div>
            <div style={statSub}>
              {hasBrokerLiveData
                ? `${brokerLiveSummary.withStateCount}/${brokerLiveSummary.activeCount} account con dato MT5${brokerLiveSummary.allOnline ? " • LIVE" : " • include ultimo dato noto"}`
                : (brokerBalanceLoaded ? "Fallback saldo storico Supabase" : "Caricamento / fallback locale")}
            </div>
            {!hasBrokerLiveData && (
              <button style={{...secondaryButton,marginTop:10}} onClick={() => setShowBrokerAdjust(v => !v)}>
                {showBrokerAdjust ? "Chiudi modifica saldo" : "✏️ Modifica saldo fallback"}
              </button>
            )}
          </div>
          <div style={statCard}>
            <div style={statLabel}>Credito / Bonus Broker</div>
            <div style={{...statValue,color:brokerCreditCentral>0?"#c4b5fd":"#cbd5e1"}}>$ {fmt(brokerCreditCentral,2)}</div>
            <div style={statSub}>{hasBrokerLiveData ? "Somma ACCOUNT_CREDIT degli account MT5 attivi." : "Nessun credito live disponibile."}</div>
          </div>
          <div style={statCard}>
            <div style={statLabel}>Capitale Broker disponibile</div>
            <div style={{...statValue,color:"#67e8f9"}}>$ {fmt(brokerCapitalAvailable,2)}</div>
            <div style={statSub}>Saldo + credito/bonus Broker aggregato.</div>
          </div>
          <div style={statCard}>
            <div style={statLabel}>Equity Broker totale live</div>
            <div style={{...statValue,color:brokerEquity>=brokerCapitalAvailable?"#5eead4":"#fca5a5"}}>$ {fmt(brokerEquity,2)}</div>
            <div style={statSub}>Somma equity MT5 degli account attivi con heartbeat disponibile.</div>
          </div>
          <div style={statCard}>
            <div style={statLabel}>P/L Broker floating reale</div>
            <div style={{...statValue,color:brokerFloatingLiveReal>=0?"#5eead4":"#fca5a5"}}>{signedMoney(brokerFloatingLiveReal)}</div>
            <div style={statSub}>{hasBrokerLiveData ? "Equity MT5 − saldo MT5 − credito/bonus." : "Fallback: stima delle gambe Broker attive."}</div>
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

        {brokerLiveSummary.rows.length > 0 && (
          <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(260px,1fr))",gap:10,marginTop:14}}>
            {brokerLiveSummary.rows.map(({account,live,ageMs,online}) => {
              const seconds = Number.isFinite(ageMs) ? Math.max(0, Math.floor(ageMs / 1000)) : null;
              return (
                <div key={account.id} style={{
                  padding:"12px 13px",borderRadius:14,
                  border:online?"1px solid rgba(34,197,94,.38)":"1px solid rgba(245,158,11,.34)",
                  background:online?"rgba(20,83,45,.10)":"rgba(120,53,15,.10)"
                }}>
                  <div style={{display:"flex",justifyContent:"space-between",gap:8,alignItems:"center"}}>
                    <div style={{fontWeight:950,color:"#f8fafc"}}>{account.alias}</div>
                    <div style={{fontSize:11,fontWeight:900,color:online?"#86efac":"#fde68a"}}>
                      {online ? "🟢 ONLINE" : live ? "🟡 DATO NON LIVE" : "⚫ MAI CONNESSO"}
                    </div>
                  </div>
                  <div style={{fontSize:11,color:"#94a3b8",marginTop:3}}>{account.broker} • {account.mt5_login} • {account.mt5_server}</div>
                  {live ? (
                    <>
                      <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:8,marginTop:10}}>
                        <div><span style={{fontSize:14,color:"#94a3b8"}}>Saldo</span><div style={{fontWeight:900}}>$ {fmt(num(live.balance),2)}</div></div>
                        <div><span style={{fontSize:14,color:"#94a3b8"}}>Credito / Bonus</span><div style={{fontWeight:900,color:num(live.credit)>0?"#c4b5fd":"#cbd5e1"}}>$ {fmt(num(live.credit),2)}</div></div>
                        <div><span style={{fontSize:14,color:"#94a3b8"}}>Equity</span><div style={{fontWeight:900,color:num(live.equity)>=num(live.balance)+num(live.credit)?"#5eead4":"#fca5a5"}}>$ {fmt(num(live.equity),2)}</div></div>
                        <div><span style={{fontSize:14,color:"#94a3b8"}}>Floating reale</span><div style={{fontWeight:900,color:(num(live.equity)-num(live.balance)-num(live.credit))>=0?"#5eead4":"#fca5a5"}}>{signedMoney(num(live.equity)-num(live.balance)-num(live.credit))}</div></div>
                        <div><span style={{fontSize:14,color:"#94a3b8"}}>Margine libero</span><div style={{fontWeight:850}}>$ {fmt(num(live.free_margin),2)}</div></div>
                        <div><span style={{fontSize:14,color:"#94a3b8"}}>Algo</span><div style={{fontWeight:850,color:live.algo_trading?"#86efac":"#fca5a5"}}>{live.algo_trading?"ON":"OFF"}</div></div>
                      </div>
                      <div style={{fontSize:14,color:"#94a3b8",marginTop:8}}>Ultimo heartbeat: {seconds !== null ? `${seconds}s fa` : "—"}</div>
                      <button
                        style={{...secondaryButton,marginTop:10,width:"100%"}}
                        onClick={() => openBrokerMovement(account.id)}
                      >
                        💰 Registra versamento / prelievo
                      </button>
                    </>
                  ) : (
                    <div style={{fontSize:11,color:"#fde68a",marginTop:9}}>Avvia PropHedgeBridge su questa MT5 per ricevere i dati reali.</div>
                  )}
                </div>
              );
            })}
          </div>
        )}

        {brokerMovementAccountId && (() => {
          const account = brokerAccountById(brokerMovementAccountId);
          const live = brokerLiveStateByAccountId[brokerMovementAccountId] || null;
          const currentBalance = live ? num(live.balance) : 0;
          const amountAbs = Math.abs(num(brokerMovementAmount));
          const signedAmount = brokerMovementType === "withdrawal" ? -amountAbs : amountAbs;
          const theoreticalAfter = currentBalance + signedAmount;

          if (!account) return null;

          return (
            <div style={{
              marginTop:14,
              padding:14,
              borderRadius:16,
              border:"1px solid rgba(45,212,191,.34)",
              background:"rgba(2,6,23,.58)"
            }}>
              <div style={{display:"flex",justifyContent:"space-between",gap:10,flexWrap:"wrap",alignItems:"center",marginBottom:12}}>
                <div>
                  <div style={{fontSize:17,fontWeight:950,color:"#f8fafc"}}>💰 Movimento Broker — {account.alias}</div>
                  <div style={{fontSize:11,color:"#94a3b8",marginTop:3}}>
                    {account.broker} • {account.mt5_login} • {account.mt5_server}
                  </div>
                </div>
                <button style={secondaryButton} onClick={closeBrokerMovement} disabled={brokerMovementSaving}>Chiudi</button>
              </div>

              <div style={{
                display:"grid",
                gridTemplateColumns:"repeat(auto-fit,minmax(180px,1fr))",
                gap:10,
                marginBottom:12
              }}>
                <div style={statCard}>
                  <div style={statLabel}>Saldo MT5 attuale</div>
                  <div style={statValue}>$ {fmt(currentBalance,2)}</div>
                  <div style={statSub}>Dato reale ricevuto dall'EA.</div>
                </div>
                <div style={statCard}>
                  <div style={statLabel}>Saldo teorico dopo movimento</div>
                  <div style={{...statValue,color:theoreticalAfter>=0?"#5eead4":"#fca5a5"}}>$ {fmt(theoreticalAfter,2)}</div>
                  <div style={statSub}>Solo controllo contabile: non modifica MT5.</div>
                </div>
              </div>

              <div style={grid2}>
                <div>
                  <label style={fieldLabel}>Tipo movimento</label>
                  <select style={input} value={brokerMovementType} onChange={e=>setBrokerMovementType(e.target.value)}>
                    <option value="deposit">Versamento</option>
                    <option value="withdrawal">Prelievo</option>
                  </select>
                </div>

                <TextNumberField
                  label={brokerMovementType === "deposit" ? "Importo versamento ($)" : "Importo prelievo ($)"}
                  value={brokerMovementAmount}
                  onChange={setBrokerMovementAmount}
                />

                <div style={{gridColumn:"1 / -1"}}>
                  <label style={fieldLabel}>Nota facoltativa</label>
                  <input
                    style={input}
                    type="text"
                    value={brokerMovementNote}
                    placeholder="Es. ricarica capitale / prelievo utili"
                    onChange={e=>setBrokerMovementNote(e.target.value)}
                  />
                </div>
              </div>

              <div style={{display:"flex",gap:10,flexWrap:"wrap",alignItems:"center",marginTop:12}}>
                <button
                  style={primaryButtonBlue}
                  disabled={brokerMovementSaving || !live || !amountAbs || theoreticalAfter < 0}
                  onClick={applyBrokerAccountMovement}
                >
                  {brokerMovementSaving ? "Registro…" : "✅ Registra movimento"}
                </button>
                <span style={{fontSize:11,color:"#94a3b8"}}>
                  Il saldo reale non viene alterato: ProfitTracker continuerà a leggerlo direttamente da MT5.
                </span>
              </div>
            </div>
          );
        })()}

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
                      gridTemplateColumns:"150px 120px 110px 120px 1fr",
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
                      <b style={{color:"#93c5fd"}}>{row.account_alias || "Fallback generale"}</b>
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

      {challenges.filter(ch => !ch.archived).map((ch, index) => {
        const c = calcs[ch.id];
        const live = liveMap[ch.asset] || {};
        const tracking = trackings[ch.id];
        const safetyInfo = safetyFor(ch.id);
        const safe = safetyInfo ? safetyStyle[safetyInfo.level] : null;
        const disabled = !!ch.active;
        const theme = getPropTheme(ch, index);

        return (
          <div
            key={ch.id}
            id={`prop-card-${ch.id}`}
            style={{
            ...panel,
            scrollMarginTop:"18px",
            background:`linear-gradient(135deg,${theme.bg},rgba(15,23,42,.965))`,
            border: ch.active ? "3px solid rgba(34,197,94,.72)" : `3px solid ${theme.border}`,
            boxShadow:`0 0 0 1px ${theme.border}, 0 0 18px ${theme.bg}, inset 5px 0 0 ${theme.border}`
          }}>
            <div style={{...panelHeader,padding:"10px 12px",borderRadius:14,background:theme.header,borderBottom:`1px solid ${theme.border}`}}>
              <div style={{flex:"1 1 320px"}}>
                <div style={{display:"flex",gap:10,alignItems:"center",flexWrap:"wrap"}}>
                  <input
                    value={ch.name}
                    disabled={disabled}
                    onChange={e => setChallenge(ch.id,{name:e.target.value})}
                    style={{
                      ...input, marginBottom:0, maxWidth:360, minWidth:220, fontSize:28, fontWeight:1000,
                      lineHeight:1.05, color:"#ffe600", letterSpacing:.4,
                      textShadow:"0 0 10px rgba(255,230,0,.30)",
                      border:`1px solid ${theme.border}`,
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

                {!ch.active && challenges.filter(x => !x.archived).length > 1 && (
                  <button
                    style={{...secondaryButton,color:"#fca5a5",border:"1px solid rgba(239,68,68,.35)"}}
                    onClick={() => removeChallenge(ch.id)}
                  >
                    🗂️ Archivia
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
                    <select style={input} value={ch.direction} onChange={e => setChallengeDirectionManual(ch.id,e.target.value)}>
                      <option>BUY</option><option>SELL</option>
                    </select>
                  </div>

                  <div>
                    <label style={fieldLabel}>Conto Broker per questa Prop</label>
                    <select
                      style={{...input,border: ch.hedgeEnabled !== false && !ch.brokerAccountId ? "1px solid rgba(248,113,113,.72)" : input.border}}
                      value={ch.brokerAccountId || ""}
                      onChange={e => setChallenge(ch.id,{brokerAccountId:e.target.value})}
                      disabled={ch.hedgeEnabled === false}
                    >
                      <option value="">— Seleziona account Broker —</option>
                      {brokerAccounts.filter(a=>a.active).map(a=>(
                        <option key={a.id} value={a.id}>{a.alias} — {a.broker} • {a.mt5_login}</option>
                      ))}
                    </select>
                    <div style={{fontSize:11,color: ch.hedgeEnabled === false ? "#94a3b8" : ch.brokerAccountId ? "#86efac" : "#fca5a5",marginTop:4}}>
                      {ch.hedgeEnabled === false
                        ? "Hedge disattivato: nessun conto Broker necessario."
                        : ch.brokerAccountId
                          ? (()=>{ const a=brokerAccountById(ch.brokerAccountId); return a ? `${a.mt5_server} • ${String(a.account_type || "real").toUpperCase()}` : "Account non più disponibile"; })()
                          : "Obbligatorio prima di PIAZZATA."}
                    </div>
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
                      Conto: {safetyInfo.brokerAlias}
                      {" • "}equity conto $ {fmt(safetyInfo.brokerEquity,2)}
                      {safetyInfo.reason === "STALE" ? ` • ultimo dato valido ${Math.max(0, Math.round((safetyInfo.ageMs || 0) / 1000))}s fa` : ""}
                      {safetyInfo.reason === "NO_LIVE_DATA" ? " • nessuno snapshot MT5 disponibile" : ""}
                      {" • "}esposizione già attiva sul conto $ {fmt(safetyInfo.currentExposure,2)}
                      {" • "}esposizione dopo {ch.name} $ {fmt(safetyInfo.projectedExposure,2)}
                      {" • "}buffer $ {fmt(safetyInfo.projectedResidual,2)}
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
                    disabled={!tradingEnabled || bridgeSubmitting[ch.id] || (ch.hedgeEnabled !== false && (safetyInfo?.level === "red" || safetyInfo?.level === "stale"))}
                    style={{
                      border:"none",borderRadius:14,padding:"12px 20px",
                      cursor:(!tradingEnabled || bridgeSubmitting[ch.id] || (ch.hedgeEnabled !== false && (safetyInfo?.level === "red" || safetyInfo?.level === "stale"))) ? "not-allowed" : "pointer",
                      opacity:(!tradingEnabled || bridgeSubmitting[ch.id] || (ch.hedgeEnabled !== false && (safetyInfo?.level === "red" || safetyInfo?.level === "stale"))) ? .45 : 1,
                      fontWeight:900,color:"#052e16",background:"linear-gradient(135deg,#4ade80,#22c55e)"
                    }}
                    title={!tradingEnabled
                      ? "Premi AVVIA TRADING per abilitare nuove operazioni."
                      : safetyInfo?.level === "stale"
                        ? "Attendo un dato MT5 recente prima di abilitare l'ordine."
                        : (ch.hedgeEnabled === false ? "Avvia il trade sulla Prop senza aprire una nuova copertura Broker." : "")}
                  >
                    {!tradingEnabled
                      ? "🔒 AVVIA TRADING PER OPERARE"
                      : bridgeSubmitting[ch.id]
                        ? "⏳ CREAZIONE COMANDO…"
                        : (ch.hedgeEnabled === false ? "✅ PIAZZATA PROP — SENZA HEDGE" : "✅ PIAZZATA — INVIA AL BRIDGE")}
                  </button>
                  <button
                    onClick={()=>placeExternalTrade(ch.id)}
                    disabled={!tradingEnabled || !!ch.active}
                    style={{
                      ...secondaryButton,
                      border:"1px solid rgba(250,204,21,.50)",
                      color:"#fde68a",
                      background:"rgba(113,63,18,.20)",
                      fontWeight:950
                    }}
                    title="Usa questo pulsante se hai aperto l'operazione con il vecchio bot o manualmente. ProfitTracker non invia ordini: attiva solo monitoraggio, alert Telegram e tracciamento saldi."
                  >
                    📡 PIAZZATA ESTERNAMENTE — MONITORA TELEGRAM
                  </button>
                  <button style={secondaryButton} onClick={()=>refreshSymbol(ch.asset)}>Aggiorna prezzo</button>
                </div>
              </>
            )}

            {ch.active && tracking && (
              <>
                <div style={{
                  marginBottom:12,
                  padding:"10px 12px",
                  borderRadius:12,
                  border:"1px solid rgba(56,189,248,.28)",
                  background:"rgba(14,116,144,.07)",
                  display:"flex",
                  justifyContent:"space-between",
                  gap:10,
                  flexWrap:"wrap",
                  alignItems:"center"
                }}>
                  <div>
                    <div style={{fontSize:10,fontWeight:1000,color:"#bae6fd"}}>
                      📡 WATCHDOG TELEGRAM ATTIVO
                    </div>
                    <div style={{fontSize:9,color:"#94a3b8",marginTop:3}}>
                      Origine operazione: <b style={{color:"#e2e8f0"}}>
                        {ch.active.executionSource === "external" ? "ESTERNA / MANUALE" : "PROFITTRACKER"}
                      </b>
                      {" · "}Forecast apertura: <b style={{color:"#fde68a"}}>{ch.active.initialForecast || "—"}</b>
                    </div>
                  </div>
                  <div style={{fontSize:9,color:"#94a3b8",lineHeight:1.5}}>
                    Alert: <b>M15 $4 / $8</b> · <b>1° WAIT / 2° WAIT</b> · <b>inversione</b> · <b>TP / SL</b> · <b>chiusura manuale</b>
                  </div>
                </div>

                <ActivePropRolling3H
                  symbol={String(ch?.active?.asset || ch?.asset || "XAUUSD").toUpperCase()}
                />

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
                    disabled={!!bridgeClosing[ch.id]}
                    style={{
                      border:"none",borderRadius:14,padding:"12px 20px",
                      cursor:bridgeClosing[ch.id] ? "wait" : "pointer",
                      opacity:bridgeClosing[ch.id] ? .55 : 1,
                      fontWeight:900,color:"#052e16",background:"linear-gradient(135deg,#4ade80,#22c55e)"
                    }}
                  >
                    {bridgeClosing[ch.id] ? "⏳ CHIUSURA BROKER IN CORSO…" : "✅ CHIUDI E AGGIORNA SALDI"}
                  </button>
                  <button
                    onClick={()=>cancelTrade(ch.id)}
                    style={{
                      border:"1px solid rgba(248,113,113,.55)",borderRadius:14,padding:"12px 20px",
                      cursor:"pointer",fontWeight:900,color:"#fecaca",background:"rgba(127,29,29,.35)"
                    }}
                  >
                    ⏹️ STOP MONITORAGGIO / RESET
                  </button>
                </div>
              </>
            )}
          </div>
        );
      })}

      </>)}


      {mainView === "PREVISIONI" && (
        <>
          <MarketEnginePanel
            defaultAsset="XAUUSD"
            challenges={challenges.filter(ch => !ch.archived)}
            onApplyDirection={(challengeId, suggestedDirection) => {
              setChallengeDirectionManual(challengeId, suggestedDirection);
            }}
            onSignalUpdate={(payload) => {
              const next = String(payload?.propDirection || "WAIT").toUpperCase();
              const ready = ["BUY","SELL"].includes(next);
              setEnginePropDirection(next);
              setEngineAnalysisReady(ready);
              setEngineSignalSnapshot({
                forecastDirection: String(payload?.forecastDirection || "WAIT").toUpperCase(),
                propDirection: next,
                score: Number.isFinite(Number(payload?.score)) ? Number(payload.score) : null,
                confidence: Number.isFinite(Number(payload?.confidence)) ? Number(payload.confidence) : null,
                analyzedAt: payload?.analyzedAt || new Date().toISOString()
              });

              try {
                if (ready) {
                  localStorage.setItem(ENGINE_DIRECTION_STORAGE_KEY, JSON.stringify({
                    propDirection: next,
                    forecastDirection: String(payload?.forecastDirection || "WAIT").toUpperCase(),
                    analyzedAt: payload?.analyzedAt || new Date().toISOString()
                  }));
                }
              } catch {}

              if (tradingEnabled && ready) {
                applyEngineDirectionToReadyChallenges(next);
              }
            }}
          />
        </>
      )}

      {mainView === "ACCOUNT_BROKER" && (
        <div style={{...panel,border:"1px solid rgba(34,211,238,.30)",background:"linear-gradient(135deg,rgba(8,145,178,.07),rgba(15,23,42,.96))"}}>
          <div style={panelHeader}>
            <div>
              <h3 style={panelTitle}>⚙️ Account Broker MT5</h3>
              <p style={panelSubtitle}>Censimento multi-account. Ogni Prop può scegliere un conto diverso. Nessuna password viene salvata qui.</p>
            </div>
            <button style={secondaryButton} onClick={()=>{ loadBrokerAccounts(); loadBrokerLiveStates(); }}>
              {(brokerAccountsLoading || brokerLiveLoading) ? "Aggiorno…" : "↻ Aggiorna"}
            </button>
          </div>

          <div style={{
            marginBottom:20,
            padding:"15px",
            borderRadius:16,
            border:"1px solid rgba(56,189,248,.30)",
            background:"rgba(8,145,178,.06)"
          }}>
            <div style={{fontSize:15,fontWeight:950,color:"#e2e8f0"}}>🖥️ MT5 avviate automaticamente con Windows</div>
            <div style={{fontSize:12,color:"#94a3b8",marginTop:5}}>
              Il vecchio Launcher remoto non è più usato. Lo stato operativo viene verificato direttamente dagli heartbeat degli EA MT5.
              Durante TRADING OFF non viene eseguito polling continuo dal ProfitTracker.
            </div>
          </div>

          <div style={{...grid2,marginBottom:18}}>
            <div><label style={fieldLabel}>Alias account</label><input style={input} placeholder="es. Ultimate Principale" value={brokerAccountDraft.alias} onChange={e=>setBrokerAccountDraft(d=>({...d,alias:e.target.value}))}/></div>
            <div><label style={fieldLabel}>Broker</label><input style={input} placeholder="es. Ultimate Markets" value={brokerAccountDraft.broker} onChange={e=>setBrokerAccountDraft(d=>({...d,broker:e.target.value}))}/></div>
            <div><label style={fieldLabel}>Login MT5</label><input style={input} placeholder="Numero conto" value={brokerAccountDraft.mt5_login} onChange={e=>setBrokerAccountDraft(d=>({...d,mt5_login:e.target.value.replace(/\s/g,"")}))}/></div>
            <div><label style={fieldLabel}>Server MT5</label><input style={input} placeholder="es. UltimateMarkets-Live 1" value={brokerAccountDraft.mt5_server} onChange={e=>setBrokerAccountDraft(d=>({...d,mt5_server:e.target.value}))}/></div>
            <div><label style={fieldLabel}>Tipo conto</label><select style={input} value={brokerAccountDraft.account_type} onChange={e=>setBrokerAccountDraft(d=>({...d,account_type:e.target.value}))}><option value="real">REAL</option><option value="demo">DEMO</option></select></div>
            <div><label style={fieldLabel}>Stato</label><select style={input} value={brokerAccountDraft.active ? "SI" : "NO"} onChange={e=>setBrokerAccountDraft(d=>({...d,active:e.target.value==="SI"}))}><option value="SI">ATTIVO</option><option value="NO">DISATTIVATO</option></select></div>
          </div>

          <div style={{display:"flex",gap:10,flexWrap:"wrap",marginBottom:20}}>
            <button style={primaryButtonBlue} onClick={saveBrokerAccount} disabled={brokerAccountSaving}>{brokerAccountSaving ? "Salvo…" : brokerAccountEditingId ? "💾 Salva modifiche" : "+ Aggiungi account"}</button>
            {brokerAccountEditingId && <button style={secondaryButton} onClick={resetBrokerAccountEditor}>Annulla modifica</button>}
          </div>

          {brokerAccounts.length === 0 ? (
            <div style={hintBox}>Nessun account Broker censito. Aggiungi il primo account MT5 qui sopra.</div>
          ) : (
            <div style={{display:"grid",gap:10}}>
              {brokerAccounts.map(a=>{
                const assigned = challenges.filter(ch=>ch.brokerAccountId===a.id && !ch.archived);
                const live = brokerLiveStateByAccountId[a.id] || null;
                const ageMs = live?.last_seen_at ? Date.now() - new Date(live.last_seen_at).getTime() : Infinity;
                const online = !!live && live.connected === true && ageMs <= MT5_LIVE_MAX_AGE_MS;
                return (
                  <div key={a.id} style={{padding:"13px 14px",borderRadius:14,border:a.active?"1px solid rgba(34,197,94,.30)":"1px solid rgba(100,116,139,.35)",background:a.active?"rgba(20,83,45,.08)":"rgba(30,41,59,.34)"}}>
                    <div style={{display:"flex",justifyContent:"space-between",gap:12,flexWrap:"wrap",alignItems:"center"}}>
                      <div>
                        <div style={{fontSize:16,fontWeight:950,color:a.active?"#bbf7d0":"#cbd5e1"}}>{a.alias} <span style={{fontSize:11,color:"#94a3b8"}}>• {String(a.account_type||"real").toUpperCase()}</span></div>
                        <div style={{fontSize:12,color:"#cbd5e1",marginTop:4}}>{a.broker} • Login {a.mt5_login} • {a.mt5_server}</div>
                        <div style={{fontSize:11,color:online?"#86efac":live?"#fde68a":"#94a3b8",marginTop:4,fontWeight:850}}>
                          {online ? "🟢 MT5 ONLINE" : live ? "🟡 MT5 NON LIVE" : "⚫ MT5 MAI CONNESSA"}
                          {live ? ` • Saldo $ ${fmt(num(live.balance),2)} • Bonus $ ${fmt(num(live.credit),2)} • Equity $ ${fmt(num(live.equity),2)}` : ""}
                        </div>
                        <div style={{fontSize:11,color:"#93c5fd",marginTop:4}}>Assegnato a: {assigned.length ? assigned.map(ch=>ch.name).join(", ") : "nessuna Prop"}</div>
                      </div>
                      <div style={{display:"flex",gap:8,flexWrap:"wrap"}}>
                        <button style={secondaryButton} onClick={()=>editBrokerAccount(a)}>✏️ Modifica</button>
                        <button style={{...secondaryButton,color:a.active?"#fde68a":"#86efac"}} onClick={()=>toggleBrokerAccountActive(a)}>{a.active?"⏸ Disattiva":"▶ Attiva"}</button>
                        <button style={{...secondaryButton,color:"#fca5a5",border:"1px solid rgba(239,68,68,.35)"}} onClick={()=>deleteBrokerAccount(a)}>🗑 Elimina</button>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {mainView === "STORICO" && (
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
          <div style={{display:"flex",gap:8,flexWrap:"wrap",justifyContent:"flex-end"}}>
            {historyFilters.prop !== "TUTTE" && (
              <button
                style={{...secondaryButton,color:"#fecaca",border:"1px solid rgba(239,68,68,.45)",background:"rgba(127,29,29,.12)"}}
                onClick={deleteFilteredHistory}
              >
                🧹 Elimina storico Prop filtrata
              </button>
            )}
            <button style={secondaryButton} onClick={loadHistory}>
              {historyLoading ? "Aggiorno…" : "↻ Aggiorna storico"}
            </button>
          </div>
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
                  "Saldo Prop","Saldo Broker","Azioni"
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
                  <td colSpan={14} style={{padding:20,color:"#94a3b8",textAlign:"center"}}>
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
                    <td style={{padding:"8px 10px",whiteSpace:"nowrap"}}>
                      <button
                        title="Elimina definitivamente questa operazione"
                        style={{
                          ...secondaryButton,
                          padding:"6px 9px",
                          color:"#fecaca",
                          border:"1px solid rgba(239,68,68,.42)",
                          background:"rgba(127,29,29,.12)"
                        }}
                        onClick={()=>deleteHistoryRow(row)}
                      >
                        🗑
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
      )}


      {mainView === "TRADING_LAB" && (
        <div style={{
          ...panel,
          border:"1px solid rgba(34,211,238,.32)",
          background:"linear-gradient(135deg,rgba(8,145,178,.07),rgba(2,6,23,.96))"
        }}>
          <div style={panelHeader}>
            <div>
              <h3 style={panelTitle}>🧪 Trading Lab</h3>
              <p style={panelSubtitle}>
                Trading multi-asset: scegli il conto e ProfitTracker carica tutti gli asset realmente disponibili su quella MT5. Poi imposta perdita massima e profitto desiderato in USD.
              </p>
            </div>
            <span style={{
              padding:"6px 10px",
              borderRadius:999,
              fontSize:10,
              fontWeight:950,
              color:"#67e8f9",
              border:"1px solid rgba(34,211,238,.38)",
              background:"rgba(8,145,178,.12)"
            }}>
              TRADING LAB
            </span>
          </div>

          <div style={{
            display:"grid",
            gridTemplateColumns:"repeat(auto-fit,minmax(240px,1fr))",
            gap:12,
            marginTop:12
          }}>
            <div>
              <label style={fieldLabel}>Broker / Account MT5</label>
              <select
                style={input}
                value={labBrokerAccountId}
                onChange={e=>{
                  const nextAccountId = e.target.value;
                  setLabBrokerAccountId(nextAccountId);
                  setLabSymbolInfo(null);
                  setLabSymbolInfoError("");
                  setLabSymbols([]);
                  setLabSymbolsError("");
                  setLabSymbolSearch("");
                  setLabTradePreview(null);
                  setLabTradeError("");
                  setLabTradeStatus("");
                  if (nextAccountId) {
                    window.setTimeout(() => requestLabSymbolList(nextAccountId), 0);
                  }
                }}
              >
                <option value="">— Seleziona account —</option>
                {brokerAccounts
                  .filter(a => a.active !== false)
                  .map(a => {
                    const live = brokerLiveStateByAccountId[a.id] || null;
                    const ageMs = live?.last_seen_at
                      ? Date.now() - new Date(live.last_seen_at).getTime()
                      : Infinity;
                    const online = !!live && live.connected === true && ageMs <= MT5_LIVE_MAX_AGE_MS;
                    const type = String(a.account_type || "real").toUpperCase();
                    return (
                      <option key={a.id} value={a.id}>
                        {a.alias || a.broker || a.mt5_login} — {type} — {online ? "ONLINE" : "SLEEP"}
                      </option>
                    );
                  })}
              </select>
            </div>

            <div>
              <label style={fieldLabel}>Asset / simbolo MT5</label>
              <div style={{display:"grid",gridTemplateColumns:"1fr auto",gap:8}}>
                <select
                  style={input}
                  value={labSymbol}
                  disabled={!labBrokerAccountId || labSymbolsLoading || !labSymbols.length}
                  onChange={e=>{
                    setLabSymbol(String(e.target.value || ""));
                    setLabSymbolInfo(null);
                    setLabSymbolInfoError("");
                    setLabTradePreview(null);
                    setLabTradeError("");
                    setLabTradeStatus("");
                  }}
                >
                  {!labSymbols.length && (
                    <option value={labSymbol || ""}>
                      {labSymbolsLoading ? "⏳ Carico tutti gli asset MT5..." : "— Carica asset del broker —"}
                    </option>
                  )}
                  {labSymbols
                    .filter(x => {
                      const q = String(labSymbolSearch || "").trim().toLowerCase();
                      if (!q) return true;
                      return (
                        x.symbol.toLowerCase().includes(q) ||
                        x.description.toLowerCase().includes(q) ||
                        x.path.toLowerCase().includes(q)
                      );
                    })
                    .map(x => (
                      <option key={x.symbol} value={x.symbol}>
                        {x.symbol}{x.description ? ` — ${x.description}` : ""}
                      </option>
                    ))}
                </select>
                <button
                  type="button"
                  style={{...primaryButtonBlue,padding:"10px 14px",whiteSpace:"nowrap",opacity:labSymbolsLoading?.65:1}}
                  disabled={!labBrokerAccountId || labSymbolsLoading}
                  onClick={()=>requestLabSymbolList()}
                  title="Ricarica tutti gli strumenti disponibili dalla MT5 selezionata"
                >
                  {labSymbolsLoading ? "⏳ ASSET..." : "↻ ASSET"}
                </button>
              </div>

              {labSymbols.length > 0 && (
                <div style={{display:"flex",gap:8,alignItems:"center",marginTop:7}}>
                  <input
                    style={{...input,padding:"8px 10px",fontSize:12}}
                    type="text"
                    value={labSymbolSearch}
                    placeholder={`Cerca tra ${labSymbols.length} asset...`}
                    onChange={e=>setLabSymbolSearch(e.target.value)}
                  />
                  <span style={{fontSize:11,color:"#67e8f9",fontWeight:800,whiteSpace:"nowrap"}}>
                    {labSymbols.length} disponibili
                  </span>
                </div>
              )}

              {labSymbolsError && (
                <div style={{marginTop:7,fontSize:11,color:"#fca5a5",fontWeight:800}}>
                  ❌ {labSymbolsError}
                </div>
              )}
            </div>
          </div>

          {labBrokerAccountId && (() => {
            const a = brokerAccounts.find(x => x.id === labBrokerAccountId);
            const live = a ? brokerLiveStateByAccountId[a.id] || null : null;
            if (!a) return null;
            const type = String(a.account_type || "real").toUpperCase();
            const isReal = type === "REAL";
            return (
              <div style={{
                marginTop:12,
                padding:"12px 14px",
                borderRadius:14,
                border:isReal
                  ? "1px solid rgba(248,113,113,.38)"
                  : "1px solid rgba(34,197,94,.34)",
                background:isReal
                  ? "rgba(127,29,29,.10)"
                  : "rgba(20,83,45,.10)",
                color:isReal ? "#fecaca" : "#bbf7d0",
                fontSize:12,
                lineHeight:1.55
              }}>
                <b>{isReal ? "⚠️ DENARO REALE" : "🟢 CONTO DEMO"}</b>
                {" · "}
                {a.alias || a.broker} · Login {a.mt5_login}
                {live && (
                  <>
                    {" · "}Saldo $ {fmt(Number(live.balance || 0),2)}
                    {" · "}Equity $ {fmt(Number(live.equity || 0),2)}
                    {" · "}Margine libero $ {fmt(Number(live.free_margin || 0),2)}
                  </>
                )}
                <div style={{marginTop:5,color:"#94a3b8",fontSize:10}}>
                  Se il conto appare SLEEP con Trading in pausa è normale: il Bridge riduce il polling a 60s e sospende l'heartbeat continuo. LEGGI DATI MT5 resta disponibile.
                </div>
              </div>
            );
          })()}

          <div style={{display:"flex",gap:10,flexWrap:"wrap",alignItems:"center",marginTop:14}}>
            <button
              style={{
                ...primaryButtonBlue,
                opacity:labSymbolInfoLoading ? .65 : 1
              }}
              disabled={labSymbolInfoLoading}
              onClick={requestLabSymbolInfo}
            >
              {labSymbolInfoLoading ? `⏳ ATTENDI ${labWaitSeconds || 90} SEC...` : "🔍 LEGGI DATI MT5"}
            </button>

            {labLastCommandId && (
              <span style={{fontSize:10,color:"#64748b"}}>
                Command ID: {labLastCommandId}
              </span>
            )}
          </div>

          {labSymbolInfoError && (
            <div style={{
              marginTop:14,
              padding:"12px 14px",
              borderRadius:13,
              border:"1px solid rgba(248,113,113,.38)",
              background:"rgba(127,29,29,.12)",
              color:"#fecaca",
              fontSize:12,
              fontWeight:800
            }}>
              ❌ {labSymbolInfoError}
            </div>
          )}

          {labSymbolInfo && (
            <>
              <div style={{marginTop:18,...sectionTitle}}>Specifiche reali ricevute dalla MT5</div>
              <div style={{...sectionDescription,marginBottom:12}}>
                Il simbolo richiesto viene risolto direttamente dal Broker. Questi dati saranno la base del calcolo automatico lotto / SL / TP.
              </div>

              <div style={{
                display:"grid",
                gridTemplateColumns:"repeat(auto-fit,minmax(185px,1fr))",
                gap:10
              }}>
                {[
                  ["Simbolo MT5", labSymbolInfo.resolved_symbol || labSymbolInfo.requested_symbol || "—"],
                  ["Bid", Number.isFinite(Number(labSymbolInfo.bid)) ? String(labSymbolInfo.bid) : "—"],
                  ["Ask", Number.isFinite(Number(labSymbolInfo.ask)) ? String(labSymbolInfo.ask) : "—"],
                  ["Digits", labSymbolInfo.digits ?? "—"],
                  ["Point", labSymbolInfo.point ?? "—"],
                  ["Tick size", labSymbolInfo.tick_size ?? "—"],
                  ["Tick value", Number.isFinite(Number(labSymbolInfo.tick_value)) ? `$ ${fmt(Number(labSymbolInfo.tick_value),6)}` : "—"],
                  ["Tick value profit", Number.isFinite(Number(labSymbolInfo.tick_value_profit)) ? `$ ${fmt(Number(labSymbolInfo.tick_value_profit),6)}` : "—"],
                  ["Tick value loss", Number.isFinite(Number(labSymbolInfo.tick_value_loss)) ? `$ ${fmt(Number(labSymbolInfo.tick_value_loss),6)}` : "—"],
                  ["Contract size", Number.isFinite(Number(labSymbolInfo.contract_size)) ? fmt(Number(labSymbolInfo.contract_size),2) : "—"],
                  ["Volume min", labSymbolInfo.volume_min ?? "—"],
                  ["Volume max", labSymbolInfo.volume_max ?? "—"],
                  ["Volume step", labSymbolInfo.volume_step ?? "—"],
                  ["Valuta base", labSymbolInfo.currency_base || "—"],
                  ["Valuta profitto", labSymbolInfo.currency_profit || "—"],
                  ["Valuta margine", labSymbolInfo.currency_margin || "—"]
                ].map(([label,value])=>(
                  <div key={label} style={statCard}>
                    <div style={statLabel}>{label}</div>
                    <div style={{...statValue,fontSize:18}}>{value}</div>
                  </div>
                ))}
              </div>

              <div style={{
                marginTop:14,
                padding:"12px 14px",
                borderRadius:13,
                border:"1px solid rgba(34,197,94,.30)",
                background:"rgba(20,83,45,.08)",
                color:"#bbf7d0",
                fontSize:12,
                lineHeight:1.55
              }}>
                ✅ Comunicazione Trading Lab → Supabase → Bridge → MT5 → ProfitTracker riuscita.
                Nessun ordine è stato eseguito.
              </div>
            </>
          )}


          <div style={{
            marginTop:20,
            padding:"15px 16px",
            borderRadius:15,
            border:"1px solid rgba(34,197,94,.28)",
            background:"rgba(20,83,45,.06)"
          }}>
            <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",gap:10,flexWrap:"wrap"}}>
              <div>
                {labSymbolInfo && (
            Number(labSymbolInfo.bid) <= 0 || Number(labSymbolInfo.ask) <= 0
          ) && (
            <div style={{marginTop:10,border:"2px solid rgba(239,68,68,.65)",background:"rgba(127,29,29,.20)",borderRadius:10,padding:"12px 14px",fontSize:13,color:"#fca5a5",fontWeight:950}}>
              ⚠️ ASSET SENZA QUOTAZIONE — TRADE NON DISPONIBILE
              <div style={{fontSize:10,marginTop:4,color:"#fecaca",fontWeight:700}}>
                Il simbolo esiste sulla MT5, ma Bid/Ask non sono attivi. Il Lab blocca il calcolo e l'invio ordine.
              </div>
            </div>
          )}

          <div style={{fontSize:17,fontWeight:950,color:"#dcfce7"}}>⚡ Modalità TRADING</div>
                <div style={{fontSize:11,color:"#86efac",marginTop:3}}>
                  Tu scegli soltanto direzione, perdita massima e target in USD. Lotto, SL e TP li calcola il Lab.
                </div>
              </div>
              <span style={{
                padding:"5px 9px",
                borderRadius:999,
                fontSize:9,
                fontWeight:950,
                color:"#fde68a",
                border:"1px solid rgba(250,204,21,.35)",
                background:"rgba(161,98,7,.10)"
              }}>
                METODO PRUDENTE: LOTTO MINIMO BROKER
              </span>
            </div>

            <div style={{
              display:"grid",
              gridTemplateColumns:"repeat(auto-fit,minmax(200px,1fr))",
              gap:12,
              marginTop:14
            }}>
              <div>
                <label style={fieldLabel}>Direzione</label>
                <select
                  style={input}
                  value={labSide}
                  onChange={e=>{
                    setLabSide(e.target.value);
                    setLabTradePreview(null);
                    setLabTradeError("");
                    setLabTradeStatus("");
                  }}
                >
                  <option value="BUY">BUY</option>
                  <option value="SELL">SELL</option>
                </select>
              </div>

              <div>
                <label style={fieldLabel}>Perdita massima ($)</label>
                <input
                  style={input}
                  type="text"
                  inputMode="decimal"
                  value={labMaxLossUsd}
                  onFocus={e=>e.currentTarget.select()}
                  onChange={e=>{
                    const raw=e.target.value;
                    if (/^[0-9]*[.,]?[0-9]*$/.test(raw) || raw==="") {
                      setLabMaxLossUsd(raw);
                      setLabTradePreview(null);
                      setLabTradeError("");
                      setLabTradeStatus("");
                    }
                  }}
                />
              </div>

              <div>
                <label style={fieldLabel}>Profitto desiderato ($)</label>
                <input
                  style={input}
                  type="text"
                  inputMode="decimal"
                  value={labTargetUsd}
                  onFocus={e=>e.currentTarget.select()}
                  onChange={e=>{
                    const raw=e.target.value;
                    if (/^[0-9]*[.,]?[0-9]*$/.test(raw) || raw==="") {
                      setLabTargetUsd(raw);
                      setLabTradePreview(null);
                      setLabTradeError("");
                      setLabTradeStatus("");
                    }
                  }}
                />
              </div>
            </div>

            <div style={{display:"flex",gap:10,flexWrap:"wrap",marginTop:14}}>
              <button
                style={primaryButtonBlue}
                onClick={labCalculateTradingPreview}
               disabled={
                  !labSymbolInfo ||
                  !(Number(labSymbolInfo.bid) > 0) ||
                  !(Number(labSymbolInfo.ask) > 0)
                }>
                🧮 CALCOLA TRADE
              </button>
              <button
                type="button"
                style={{
                  ...secondaryButton,
                  padding:"12px 18px",
                  fontSize:13,
                  border:"1px solid rgba(34,211,238,.42)",
                  color:"#a5f3fc"
                }}
                onClick={testTradingLabTelegram}
              >
                📨 TEST TELEGRAM LAB
              </button>
            </div>

            {labTradePreview && (
              <div style={{marginTop:16}}>
                <div style={{
                  display:"grid",
                  gridTemplateColumns:"repeat(auto-fit,minmax(175px,1fr))",
                  gap:10
                }}>
                  {[
                    ["Asset",labTradePreview.symbol],
                    ["Direzione",labTradePreview.side],
                    ["Lotto automatico",String(labTradePreview.volume)],
                    ["Entry stimato",String(labTradePreview.entry)],
                    ["Stop Loss",String(labTradePreview.sl)],
                    ["Take Profit",String(labTradePreview.tp)],
                    ["Perdita teorica",`−$ ${fmt(labTradePreview.estimatedLoss,2)}`],
                    ["Profitto teorico",`+$ ${fmt(labTradePreview.estimatedProfit,2)}`],
                    ["R/R",`1:${fmt(labTradePreview.rr,2)}`]
                  ].map(([label,value])=>(
                    <div key={label} style={statCard}>
                      <div style={statLabel}>{label}</div>
                      <div style={{...statValue,fontSize:18}}>{value}</div>
                    </div>
                  ))}
                </div>

                <div style={{
                  marginTop:12,
                  padding:"11px 13px",
                  borderRadius:12,
                  border:"1px solid rgba(250,204,21,.28)",
                  background:"rgba(161,98,7,.08)",
                  color:"#fde68a",
                  fontSize:11,
                  lineHeight:1.55
                }}>
                  <b>Nota:</b> questa prima modalità automatica usa il lotto minimo consentito dal broker e ricava da lì le distanze di SL/TP.
                  Spread, commissioni e slippage possono far differire leggermente il P/L reale dagli importi impostati.
                </div>

                <button
                  style={{
                    ...primaryButtonBlue,
                    marginTop:12,
                    background:labTradeSubmitting ? "#475569" : undefined,
                    opacity:labTradeSubmitting ? .65 : 1
                  }}
                  disabled={labTradeSubmitting}
                  onClick={submitLabTrade}
                >
                  {labTradeSubmitting ? "⏳ INVIO AL BRIDGE…" : "🚀 INVIA ORDINE AL BRIDGE"}
                </button>
              </div>
            )}

            {labTradeStatus && (
              <div style={{
                marginTop:12,
                padding:"11px 13px",
                borderRadius:12,
                border:"1px solid rgba(34,197,94,.30)",
                background:"rgba(20,83,45,.10)",
                color:"#bbf7d0",
                fontSize:12,
                fontWeight:850
              }}>
                {labTradeStatus}
              </div>
            )}

            {labTradeError && (
              <div style={{
                marginTop:12,
                padding:"11px 13px",
                borderRadius:12,
                border:"1px solid rgba(248,113,113,.38)",
                background:"rgba(127,29,29,.12)",
                color:"#fecaca",
                fontSize:12,
                fontWeight:850
              }}>
                ❌ {labTradeError}
              </div>
            )}
          </div>


          <div style={{
            marginTop:18,
            padding:"14px",
            borderRadius:14,
            border:"1px solid rgba(34,211,238,.28)",
            background:"rgba(8,47,73,.10)"
          }}>
            <div style={{
              display:"flex",
              justifyContent:"space-between",
              alignItems:"center",
              gap:10,
              flexWrap:"wrap"
            }}>
              <div>
                <div style={{fontSize:20,fontWeight:950,color:"#cffafe"}}>
                  📡 Posizioni Trading Lab attive
                </div>
                <div style={{fontSize:12,color:"#67e8f9",marginTop:4}}>
                  LIVE ogni 15 sec finché esiste una posizione aperta · TP/SL notificati su Telegram · zero polling quando non ci sono trade.
                </div>
              </div>

              <button
                type="button"
                style={{...secondaryButton,padding:"9px 12px"}}
                disabled={labPositionRefreshing || !labActiveTrades.length}
                onClick={()=>refreshLabActiveTrades({ silent:false })}
              >
                {labPositionRefreshing ? "⏳ CONTROLLO…" : "↻ AGGIORNA POSIZIONI"}
              </button>
            </div>

            {!labActiveTrades.length ? (
              <div style={{marginTop:12,fontSize:11,color:"#94a3b8"}}>
                Nessuna posizione Trading Lab attiva registrata.
              </div>
            ) : (
              <div style={{display:"grid",gap:10,marginTop:12}}>
                {labActiveTrades.map(row => (
                  <div
                    key={row.id || row.positionTicket}
                    style={{
                      border:"1px solid rgba(100,116,139,.35)",
                      borderRadius:12,
                      padding:"16px",
                      background:"rgba(15,23,42,.55)"
                    }}
                  >
                    <div style={{
                      display:"grid",
                      gridTemplateColumns:"repeat(auto-fit,minmax(190px,1fr))",
                      gap:8
                    }}>
                      {(() => {
                        const floating = Number(row.floatingPL || 0);
                        const current = Number(row.currentPrice || row.entry || 0);
                        const tp = Number(row.tp || 0);
                        const sl = Number(row.sl || 0);
                        const target = Number(row.targetUsd || 0);
                        const maxLoss = Number(row.maxLossUsd || 0);

                        const usdToTp = Math.max(0, target - floating);
                        const usdToSl = Math.max(0, maxLoss + floating);
                        const priceToTp = current && tp ? Math.abs(tp - current) : null;
                        const priceToSl = current && sl ? Math.abs(current - sl) : null;

                        return [
                          ["Broker",row.accountAlias],
                          ["Asset",row.symbol],
                          ["Direzione",row.side],
                          ["Lotto",String(row.volume)],
                          ["Ticket",String(row.positionTicket)],
                          ["Entry",String(row.entry)],
                          ["Prezzo LIVE",current ? String(current) : "—"],
                          ["P/L LIVE",`${floating>=0?"+":""}$ ${fmt(floating,2)}`],
                          ["TP",String(row.tp)],
                          ["Manca al TP",`$ ${fmt(usdToTp,2)}${priceToTp!==null ? ` · Δ ${fmt(priceToTp,6)}` : ""}`],
                          ["SL",String(row.sl)],
                          ["Margine allo SL",`$ ${fmt(usdToSl,2)}${priceToSl!==null ? ` · Δ ${fmt(priceToSl,6)}` : ""}`],
                          ["Ultimo update",row.lastCheckedAt ? new Date(row.lastCheckedAt).toLocaleTimeString("it-IT") : "in attesa…"]
                        ];
                      })().map(([label,value])=>(
                        <div key={label} style={{
                          fontSize:14,
                          color:"#94a3b8",
                          lineHeight:1.45
                        }}>
                          <b style={{
                            color:"#cbd5e1",
                            fontSize:13,
                            textTransform:"uppercase",
                            letterSpacing:.35
                          }}>
                            {label}:
                          </b>{" "}
                          <span style={{
                            color:"#f8fafc",
                            fontSize:17,
                            fontWeight:900
                          }}>
                            {value}
                          </span>
                        </div>
                      ))}
                    </div>

                    {(() => {
                      const entry = Number(row.entry || 0);
                      const current = Number(row.currentPrice || row.entry || 0);
                      const tp = Number(row.tp || 0);
                      const sl = Number(row.sl || 0);
                      const side = String(row.side || "BUY").toUpperCase();

                      const minPx = Math.min(sl, tp);
                      const maxPx = Math.max(sl, tp);
                      const span = maxPx - minPx;

                      let currentPct = span > 0 ? ((current - minPx) / span) * 100 : 50;
                      let entryPct = span > 0 ? ((entry - minPx) / span) * 100 : 50;

                      currentPct = Math.max(0, Math.min(100, currentPct));
                      entryPct = Math.max(0, Math.min(100, entryPct));

                      const towardTp =
                        side === "BUY"
                          ? current >= entry
                          : current <= entry;

                      const moveFromEntry =
                        entry > 0 ? current - entry : 0;

                      return (
                        <div style={{
                          marginTop:12,
                          padding:"12px 12px 10px",
                          borderRadius:12,
                          border:"1px solid rgba(56,189,248,.28)",
                          background:"rgba(15,23,42,.62)"
                        }}>
                          <div style={{
                            display:"flex",
                            justifyContent:"space-between",
                            alignItems:"center",
                            gap:10,
                            flexWrap:"wrap",
                            marginBottom:8
                          }}>
                            <div style={{
                              fontSize:16,
                              fontWeight:950,
                              color:"#e0f2fe"
                            }}>
                              📈 MOVIMENTO OPERAZIONE
                            </div>

                            <div style={{
                              fontSize:15,
                              fontWeight:950,
                              color:towardTp ? "#5eead4" : "#fca5a5"
                            }}>
                              {towardTp ? "VERSO TP" : "VERSO SL"} · Δ PREZZO {moveFromEntry >= 0 ? "+" : ""}{fmt(moveFromEntry,6)}
                            </div>
                          </div>

                          <div style={{
                            position:"relative",
                            height:28,
                            borderRadius:999,
                            overflow:"hidden",
                            border:"1px solid rgba(100,116,139,.45)",
                            background:"linear-gradient(90deg, rgba(127,29,29,.40) 0%, rgba(30,41,59,.55) 50%, rgba(6,95,70,.40) 100%)"
                          }}>
                            <div style={{
                              position:"absolute",
                              left:`${entryPct}%`,
                              top:0,
                              bottom:0,
                              width:2,
                              background:"#f8fafc",
                              opacity:.9,
                              transform:"translateX(-1px)",
                              zIndex:2
                            }} />

                            <div style={{
                              position:"absolute",
                              left:`${currentPct}%`,
                              top:"50%",
                              width:18,
                              height:18,
                              borderRadius:"50%",
                              background:towardTp ? "#2dd4bf" : "#fb7185",
                              border:"2px solid #f8fafc",
                              boxShadow:"0 0 10px rgba(255,255,255,.35)",
                              transform:"translate(-50%,-50%)",
                              zIndex:3,
                              transition:"left .45s ease"
                            }} />
                          </div>

                          <div style={{
                            display:"grid",
                            gridTemplateColumns:"1fr 1fr 1fr",
                            gap:8,
                            marginTop:7,
                            fontSize:13
                          }}>
                            <div style={{color:"#fca5a5",fontWeight:900}}>
                              SL {sl}
                            </div>
                            <div style={{textAlign:"center",color:"#e2e8f0",fontWeight:900}}>
                              ENTRY {entry}
                            </div>
                            <div style={{textAlign:"right",color:"#5eead4",fontWeight:900}}>
                              TP {tp}
                            </div>
                          </div>

                          <div style={{
                            marginTop:8,
                            display:"flex",
                            justifyContent:"space-between",
                            gap:12,
                            flexWrap:"wrap",
                            fontSize:14
                          }}>
                            <span style={{color:"#94a3b8"}}>
                              Prezzo live: <b style={{color:"#f8fafc"}}>{current}</b>
                            </span>
                            <span style={{color:"#94a3b8"}}>
                              P/L: <b style={{color:Number(row.floatingPL||0) >= 0 ? "#5eead4" : "#fca5a5"}}>
                                {Number(row.floatingPL||0) >= 0 ? "+" : ""}$ {fmt(Number(row.floatingPL||0),2)}
                              </b>
                            </span>
                          </div>
                        </div>
                      );
                    })()}

                    {row.lastCheckError && (
                      <div style={{marginTop:8,fontSize:13,color:"#fca5a5"}}>
                        Ultimo controllo: {row.lastCheckError}
                      </div>
                    )}

                    <button
                      type="button"
                      style={{
                        ...secondaryButton,
                        marginTop:10,
                        border:"1px solid rgba(248,113,113,.45)",
                        color:"#fecaca"
                      }}
                      onClick={()=>closeLabTradeManually(row)}
                    >
                      ✋ CHIUDI POSIZIONE
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>



          <div style={{
            marginTop:20,
            padding:"18px",
            borderRadius:16,
            border:"1px solid rgba(14,165,233,.38)",
            background:"linear-gradient(135deg,rgba(7,89,133,.11),rgba(15,23,42,.80))"
          }}>
            <div style={{
              display:"flex",
              justifyContent:"space-between",
              alignItems:"center",
              gap:12,
              flexWrap:"wrap"
            }}>
              <div>
                <div style={{fontSize:20,fontWeight:950,color:"#e0f2fe"}}>
                  🔎 Scanner asset per ACCUMULO
                </div>
                <div style={{fontSize:12,color:"#7dd3fc",marginTop:4}}>
                  Scansione completa paginata: legge automaticamente tutti gli asset in blocchi sicuri da 20, evitando il limite JSON del Bridge.
                </div>
              </div>

              <button
                type="button"
                style={{...primaryButtonBlue,padding:"12px 16px"}}
                disabled={labAccumScanLoading || !labBrokerAccountId}
                onClick={scanAccumuloAssets}
              >
                {labAccumScanLoading
                  ? `⏳ SCANSIONE ${labAccumScanProgress.current}/${labAccumScanProgress.total || "?"}`
                  : "🔎 SCANSIONA TUTTI GLI ASSET"}
              </button>
            </div>

            {labAccumScanError && (
              <div style={{
                marginTop:12,padding:"10px 12px",borderRadius:10,
                border:"1px solid rgba(248,113,113,.45)",
                color:"#fecaca",fontSize:13,fontWeight:850
              }}>
                ❌ {labAccumScanError}
              </div>
            )}

            {labAccumScanRows.length > 0 && (
              <>
                <div style={{
                  display:"grid",
                  gridTemplateColumns:"minmax(190px,280px) minmax(180px,260px) 1fr",
                  gap:12,
                  alignItems:"end",
                  marginTop:14
                }}>
                  <div>
                    <label style={fieldLabel}>Minimo fino a ($)</label>
                    <input
                      style={input}
                      type="number"
                      min="0"
                      step="1"
                      value={labAccumScanFilter}
                      onChange={e=>setLabAccumScanFilter(e.target.value)}
                    />
                  </div>

                  <div>
                    <label style={fieldLabel}>Categoria</label>
                    <select
                      style={input}
                      value={labAccumCategoryFilter}
                      onChange={e=>setLabAccumCategoryFilter(e.target.value)}
                    >
                      {["TUTTI","AZIONE","ETF","FOREX","CRYPTO","INDICE","METAL","ENERGY","COMMODITY","ALTRO"].map(x=>(
                        <option key={x} value={x}>{x}</option>
                      ))}
                    </select>
                  </div>

                  <div style={{fontSize:12,color:"#bae6fd",paddingBottom:10}}>
                    Ricevuti <b>{labAccumScanRows.length}</b> asset finora.
                    {labAccumScanLoading && (
                      <> · blocco <b>{labAccumScanProgress.pages}</b> · progresso <b>{labAccumScanProgress.current}/{labAccumScanProgress.total || "?"}</b></>
                    )}
                    {!labAccumScanLoading && <> Ordinati dal minimo più basso.</>}
                  </div>
                </div>

                <div style={{
                  marginTop:12,
                  maxHeight:420,
                  overflowY:"auto",
                  border:"1px solid rgba(100,116,139,.30)",
                  borderRadius:12
                }}>
                  <div style={{
                    display:"grid",
                    gridTemplateColumns:".8fr 1.7fr .75fr .75fr .65fr .75fr auto",
                    gap:8,
                    padding:"10px 12px",
                    position:"sticky",
                    top:0,
                    zIndex:2,
                    background:"#0f172a",
                    color:"#7dd3fc",
                    fontSize:11,
                    fontWeight:950,
                    textTransform:"uppercase"
                  }}>
                    <div>Ticker</div>
                    <div>Nome / descrizione</div>
                    <div>Tipo</div>
                    <div>Minimo $</div>
                    <div>Lotto min</div>
                    <div>Ask</div>
                    <div></div>
                  </div>

                  {labAccumScanRows
                    .filter(row => {
                      const max = Number(labAccumScanFilter);
                      const maxOk = !(max > 0) || row.minUsd <= max;
                      const catOk =
                        labAccumCategoryFilter === "TUTTI" ||
                        row.category === labAccumCategoryFilter;
                      return maxOk && catOk;
                    })
                    .slice(0,250)
                    .map((row,index)=>(
                      <div
                        key={`${row.symbol}-${index}`}
                        style={{
                          display:"grid",
                          gridTemplateColumns:".8fr 1.7fr .75fr .75fr .65fr .75fr auto",
                          gap:8,
                          alignItems:"center",
                          padding:"10px 12px",
                          borderTop:"1px solid rgba(100,116,139,.18)",
                          fontSize:13
                        }}
                      >
                        <div style={{fontWeight:950,color:"#f8fafc",fontSize:14}}>
                          {row.symbol}
                        </div>
                        <div style={{color:"#e2e8f0",fontWeight:800}}>
                          {row.description || "Descrizione non disponibile"}
                        </div>
                        <div>
                          <span style={{
                            display:"inline-block",
                            padding:"4px 7px",
                            borderRadius:999,
                            border:"1px solid rgba(56,189,248,.30)",
                            color:"#bae6fd",
                            fontSize:10,
                            fontWeight:950
                          }}>
                            {row.category}
                          </span>
                        </div>
                        <div style={{
                          fontWeight:950,
                          color:row.minUsd <= 10 ? "#5eead4" :
                                row.minUsd <= 50 ? "#fde68a" : "#fca5a5"
                        }}>
                          $ {fmt(row.minUsd,2)}
                        </div>
                        <div style={{color:"#cbd5e1"}}>{row.volumeMin}</div>
                        <div style={{color:"#cbd5e1"}}>{row.ask}</div>
                        <button
                          type="button"
                          style={{...secondaryButton,padding:"7px 10px",fontSize:11}}
                          onClick={()=>chooseAccumScanAsset(row.symbol)}
                        >
                          USA
                        </button>
                      </div>
                    ))}
                </div>

                <div style={{marginTop:9,fontSize:10,color:"#94a3b8",lineHeight:1.5}}>
                  Lo scanner mostra solo i simboli che in quel momento hanno una quotazione valida.
                  Il “Minimo $” è esposizione/nozionale stimata del lotto minimo, non il margine richiesto.
                </div>
              </>
            )}
          </div>

          <div style={{
            marginTop:20,
            padding:"18px",
            borderRadius:16,
            border:"1px solid rgba(168,85,247,.42)",
            background:"linear-gradient(135deg,rgba(88,28,135,.13),rgba(15,23,42,.82))"
          }}>
            <div style={{
              display:"flex",
              justifyContent:"space-between",
              alignItems:"center",
              gap:12,
              flexWrap:"wrap"
            }}>
              <div>
                <div style={{fontSize:20,fontWeight:950,color:"#f3e8ff"}}>
                  🪙 Modalità ACCUMULO
                </div>
                <div style={{fontSize:12,color:"#d8b4fe",marginTop:4}}>
                  Scegli quanto vuoi accumulare in USD. Il Lab calcola il lotto MT5 eseguibile. Nessun SL e nessun TP.
                </div>
              </div>
              <div style={{
                padding:"7px 11px",
                borderRadius:999,
                border:"1px solid rgba(250,204,21,.45)",
                color:"#fde68a",
                fontSize:11,
                fontWeight:950
              }}>
                BUY · LUNGO PER ACCUMULO
              </div>
            </div>

            <div style={{
              display:"grid",
              gridTemplateColumns:"minmax(220px,1fr) auto",
              gap:12,
              alignItems:"end",
              marginTop:16
            }}>
              <div>
                <label style={fieldLabel}>Quanto vuoi accumulare ($)</label>
                <input
                  style={input}
                  type="number"
                  min="0.01"
                  step="0.01"
                  value={labAccumUsd}
                  onChange={e=>{
                    setLabAccumUsd(e.target.value);
                    setLabAccumPreview(null);
                    setLabAccumError("");
                  }}
                  placeholder="Es. 1, 2, 5, 50, 1000..."
                />
              </div>

              <button
                type="button"
                style={{...primaryButtonBlue,padding:"13px 18px"}}
                onClick={labCalculateAccumuloPreview}
              >
                🧮 CALCOLA ACCUMULO
              </button>
            </div>

            {labAccumError && (
              <div style={{
                marginTop:12,padding:"10px 12px",borderRadius:10,
                border:"1px solid rgba(248,113,113,.45)",
                color:"#fecaca",fontSize:13,fontWeight:850
              }}>
                ❌ {labAccumError}
              </div>
            )}

            {labAccumStatus && (
              <div style={{
                marginTop:12,padding:"10px 12px",borderRadius:10,
                border:"1px solid rgba(52,211,153,.35)",
                color:"#a7f3d0",fontSize:13,fontWeight:850
              }}>
                {labAccumStatus}
              </div>
            )}

            {labAccumPreview && (
              <div style={{
                marginTop:16,
                padding:"16px",
                borderRadius:14,
                border:"1px solid rgba(192,132,252,.38)",
                background:"rgba(30,41,59,.55)"
              }}>
                <div style={{fontSize:17,fontWeight:950,color:"#f5f3ff"}}>
                  Anteprima accumulo — {labAccumPreview.symbol}
                </div>

                <div style={{
                  display:"grid",
                  gridTemplateColumns:"repeat(auto-fit,minmax(190px,1fr))",
                  gap:12,
                  marginTop:12
                }}>
                  {[
                    ["Richiesto",`$ ${fmt(labAccumPreview.requestedUsd,2)}`],
                    ["Lotto MT5",String(labAccumPreview.volume)],
                    ["Esposizione effettiva",`$ ${fmt(labAccumPreview.actualUsd,2)}`],
                    ["Minimo broker",`$ ${fmt(labAccumPreview.minimumUsd,2)}`],
                    ["Entry stimato",String(labAccumPreview.entry)],
                    ["SL / TP","NESSUNO"]
                  ].map(([label,value])=>(
                    <div key={label} style={{
                      padding:"11px 12px",
                      borderRadius:11,
                      border:"1px solid rgba(100,116,139,.35)",
                      background:"rgba(2,6,23,.35)"
                    }}>
                      <div style={{fontSize:11,color:"#a78bfa",fontWeight:900,textTransform:"uppercase"}}>
                        {label}
                      </div>
                      <div style={{fontSize:19,color:"#fff",fontWeight:950,marginTop:4}}>
                        {value}
                      </div>
                    </div>
                  ))}
                </div>

                {labAccumPreview.forcedMinimum && (
                  <div style={{
                    marginTop:12,
                    padding:"12px",
                    borderRadius:11,
                    border:"1px solid rgba(251,191,36,.48)",
                    background:"rgba(120,53,15,.16)",
                    color:"#fde68a",
                    fontSize:13,
                    fontWeight:850,
                    lineHeight:1.5
                  }}>
                    ⚠️ L'importo richiesto è sotto il minimo eseguibile di questo asset.
                    Con il lotto minimo del broker l'esposizione reale sarebbe circa
                    <b> $ {fmt(labAccumPreview.actualUsd,2)}</b>. Non inviare se non vuoi questa esposizione.
                  </div>
                )}

                {!labAccumPreview.forcedMinimum && Math.abs(labAccumPreview.differenceUsd) > 0.01 && (
                  <div style={{marginTop:10,fontSize:12,color:"#c4b5fd"}}>
                    Arrotondamento lotto MT5: differenza stimata rispetto all'importo richiesto
                    {" "}<b>{labAccumPreview.differenceUsd >= 0 ? "+" : ""}$ {fmt(labAccumPreview.differenceUsd,2)}</b>.
                  </div>
                )}

                <button
                  type="button"
                  disabled={labAccumSubmitting}
                  style={{
                    ...primaryButtonBlue,
                    marginTop:14,
                    padding:"13px 18px",
                    opacity:labAccumSubmitting ? .6 : 1
                  }}
                  onClick={submitLabAccumulo}
                >
                  {labAccumSubmitting ? "⏳ INVIO ACCUMULO…" : "🪙 INVIA ACCUMULO"}
                </button>
              </div>
            )}

            <div style={{
              marginTop:16,
              padding:"12px",
              borderRadius:12,
              border:"1px solid rgba(100,116,139,.30)",
              background:"rgba(2,6,23,.28)"
            }}>
              <div style={{fontSize:15,fontWeight:950,color:"#e9d5ff"}}>
                📚 Accumuli registrati
              </div>

              {!labAccumPositions.length ? (
                <div style={{marginTop:8,fontSize:12,color:"#94a3b8"}}>
                  Nessun accumulo ancora registrato.
                </div>
              ) : (
                <div style={{display:"grid",gap:8,marginTop:10}}>
                  {labAccumPositions.map(row=>(
                    <div key={row.id || row.positionTicket} style={{
                      display:"grid",
                      gridTemplateColumns:"repeat(auto-fit,minmax(150px,1fr))",
                      gap:8,
                      padding:"10px 12px",
                      borderRadius:10,
                      border:"1px solid rgba(100,116,139,.28)"
                    }}>
                      {[
                        ["Broker",row.accountAlias],
                        ["Asset",row.symbol],
                        ["Lotto",row.volume],
                        ["Richiesto",`$ ${fmt(row.requestedUsd,2)}`],
                        ["Esposizione",`$ ${fmt(row.actualUsd,2)}`],
                        ["Entry",row.entry],
                        ["Ticket",row.positionTicket]
                      ].map(([label,value])=>(
                        <div key={label} style={{fontSize:12,color:"#94a3b8"}}>
                          <b style={{color:"#e2e8f0"}}>{label}:</b>{" "}
                          <span style={{color:"#fff",fontWeight:850}}>{value}</span>
                        </div>
                      ))}
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div style={{
              marginTop:12,
              color:"#94a3b8",
              fontSize:11,
              lineHeight:1.55
            }}>
              Nota: “$ accumulati” indica l'esposizione/notional stimata convertita nella valuta del conto,
              non il margine bloccato dal broker. Su CFD/Forex il lotto minimo può rendere impossibili importi
              molto piccoli come $1 o $2.
            </div>
          </div>
        </div>
      )}

      {mainView === "ARCHIVIO" && (
        <div style={{
          ...panel,
          border:"1px solid rgba(148,163,184,.30)",
          background:"linear-gradient(135deg,rgba(71,85,105,.07),rgba(15,23,42,.96))"
        }}>
          <div style={panelHeader}>
            <div>
              <h3 style={panelTitle}>🗂️ Archivio Challenge</h3>
              <p style={panelSubtitle}>Le challenge archiviate possono essere ripristinate oppure eliminate definitivamente insieme al loro storico.</p>
            </div>
          </div>

          {challenges.filter(ch => ch.archived).length === 0 ? (
            <div style={{padding:"28px 12px",textAlign:"center",color:"#94a3b8",fontWeight:800}}>
              Nessuna challenge archiviata.
            </div>
          ) : (
            <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(340px,1fr))",gap:14}}>
              {challenges.filter(ch => ch.archived).map((ch,index)=>{
                const theme = getPropTheme(ch,index);
                const rows = historyRows.filter(r => r.challenge_id === ch.id || (!r.challenge_id && r.prop_name === ch.name));
                const propPL = rows.reduce((s,r)=>s+Number(r.prop_pl||0),0);
                const brokerPL = rows.reduce((s,r)=>s+Number(r.broker_pl||0),0);
                const combined = propPL + brokerPL;
                return (
                  <div key={ch.id} style={{
                    padding:17,borderRadius:17,
                    border:`2px solid ${theme.border}`,
                    background:`linear-gradient(135deg,${theme.bg},rgba(2,6,23,.58))`,
                    boxShadow:`inset 4px 0 0 ${theme.border}`
                  }}>
                    <div style={{display:"flex",justifyContent:"space-between",gap:10,alignItems:"flex-start",flexWrap:"wrap"}}>
                      <div>
                        <div style={{fontSize:24,fontWeight:1000,color:"#ffe600",textShadow:"0 0 8px rgba(255,230,0,.25)"}}>{ch.name}</div>
                        <div style={{display:"flex",gap:6,flexWrap:"wrap",marginTop:8}}>
                          {[ch.propStage||"—",`${fmt(num(ch.accountSize)/1000,0)}K`,`DD ${ch.ddMax}%`,`DAILY ${ch.dailyDdPct||"—"}%`,ch.highImpactNewsAllowed?"NEWS ✓":"NEWS 🚫"].map((x,i)=>(
                            <span key={i} style={{fontSize:10,fontWeight:900,padding:"4px 7px",borderRadius:999,border:`1px solid ${theme.border}`,color:theme.accent}}>{x}</span>
                          ))}
                        </div>
                      </div>
                      <span style={{
                        padding:"6px 9px",borderRadius:999,fontSize:11,fontWeight:950,
                        border:"1px solid rgba(251,191,36,.45)",color:"#fde68a",background:"rgba(120,53,15,.18)"
                      }}>{ch.archiveStatus || "ARCHIVIATA"}</span>
                    </div>

                    <div style={{marginTop:15,display:"grid",gridTemplateColumns:"repeat(2,minmax(0,1fr))",gap:8}}>
                      <div style={statCard}><div style={statLabel}>Operazioni</div><div style={statValue}>{rows.length}</div></div>
                      <div style={statCard}><div style={statLabel}>Saldo Prop finale</div><div style={statValue}>$ {fmt(num(ch.accountBalance),2)}</div></div>
                      <div style={statCard}><div style={statLabel}>P/L Prop storico</div><div style={{...statValue,color:propPL>=0?"#5eead4":"#fca5a5"}}>{signedMoney(propPL)}</div></div>
                      <div style={statCard}>
                        <div style={statLabel}>Esposizione Broker finale</div>
                        <div style={{...statValue,color:"#fca5a5"}}>
                          −$ {fmt(Math.abs(num(ch.archivedBrokerExposure ?? challengeExposureMap[ch.id] ?? ch.initialBrokerExposure ?? ch?.importedExisting?.brokerExposureBaseline)),2)}
                        </div>
                      </div>
                    </div>

                    <div style={{marginTop:12,padding:"16px 18px",borderRadius:12,background:"rgba(2,6,23,.40)",border:"1px solid rgba(71,85,105,.45)",fontSize:15,lineHeight:1.75,color:"#cbd5e1"}}>
                      Risultato combinato storico: <b style={{color:combined>=0?"#86efac":"#fca5a5"}}>{signedMoney(combined)}</b><br/>
                      Costo Prop: <b>$ {fmt(num(ch.propCost),2)}</b> • Target desiderato: <b>$ {fmt(num(ch.finalProfitTarget),2)}</b><br/>
                      P/L Broker storico registrato: <b style={{color:brokerPL>=0?"#86efac":"#fca5a5"}}>{signedMoney(brokerPL)}</b><br/>
                      <span style={{fontSize:16,fontWeight:900}}>Capitale da recuperare:</span> <b style={{color:"#fca5a5",fontSize:18}}>−$ {fmt(
                        Math.abs(num(ch.archivedBrokerExposure ?? challengeExposureMap[ch.id] ?? ch.initialBrokerExposure ?? ch?.importedExisting?.brokerExposureBaseline))
                        + Math.abs(num(ch.propCost)),
                        2
                      )}</b> <span style={{color:"#94a3b8"}}>(esposizione Broker + costo Prop)</span><br/>
                      Archiviata: <b>{ch.archivedAt ? new Date(ch.archivedAt).toLocaleString("it-IT") : "—"}</b>
                    </div>

                    <div style={{display:"flex",gap:8,flexWrap:"wrap",marginTop:13}}>
                      <button style={secondaryButton} onClick={()=>openChallengeRegistry(ch)}>📋 SCHEDA PROP</button>
                      <button style={{...secondaryButton,color:"#bbf7d0",border:"1px solid rgba(34,197,94,.42)"}} onClick={()=>restoreChallenge(ch.id)}>↩ RIPRISTINA</button>
                      <button
                        style={{...secondaryButton,color:"#fecaca",border:"1px solid rgba(239,68,68,.50)",background:"rgba(127,29,29,.14)"}}
                        onClick={()=>permanentlyDeleteArchivedChallenge(ch)}
                      >
                        🗑 ELIMINA DEFINITIVAMENTE
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

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
