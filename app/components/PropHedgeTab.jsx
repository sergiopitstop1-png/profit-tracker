"use client";

import React, { useEffect, useMemo, useState } from "react";
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
    brokerExposure: "0",
    entryPrice: "",
    autoPrice: true,
    active: null,
    closePropPL: "",
    closeBrokerPL: "",
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
  const exposure = num(ch.brokerExposure);
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

function TextNumberField({ label, value, onChange, disabled = false, placeholder = "", operational = false }) {
  return (
    <div style={operational ? {
      padding: "8px 8px 0",
      borderRadius: 14,
      border: "1px solid rgba(34,211,238,.38)",
      background: "rgba(8,145,178,.07)",
      boxShadow: "0 0 0 1px rgba(34,211,238,.05) inset"
    } : undefined}>
      <div style={{display:"flex",justifyContent:"space-between",gap:8,alignItems:"center",marginBottom:6}}>
        <label style={{...fieldLabel,marginBottom:0}}>{label}</label>
        {operational && (
          <span style={{
            fontSize:9,
            fontWeight:900,
            letterSpacing:.55,
            color:"#67e8f9",
            border:"1px solid rgba(34,211,238,.35)",
            background:"rgba(8,145,178,.12)",
            borderRadius:999,
            padding:"3px 6px",
            whiteSpace:"nowrap"
          }}>
            DA AGGIORNARE
          </span>
        )}
      </div>
      <input
        style={{
          ...input,
          opacity: disabled ? 0.62 : 1,
          ...(operational ? {
            border:"1px solid rgba(34,211,238,.72)",
            boxShadow:"0 0 12px rgba(34,211,238,.08)",
            background:"#071525"
          } : {})
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
          if (/^-?[0-9]*[.,]?[0-9]*$/.test(raw) || raw === "") onChange(raw);
        }}
      />
    </div>
  );
}

export default function PropHedgeTab() {
  const [challenges, setChallenges] = useState(DEFAULT_CHALLENGES);
  const [brokerBalance, setBrokerBalance] = useState("5000");
  const [liveMap, setLiveMap] = useState({});
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    try {
      const savedChallenges = localStorage.getItem("propHedgeV7Challenges");
      const savedBrokerBalance = localStorage.getItem("propHedgeV7BrokerBalance");
      if (savedChallenges) {
        const parsed = JSON.parse(savedChallenges);
        if (Array.isArray(parsed) && parsed.length) {
          setChallenges(parsed.map(ch => ({
            ...ch,
            finalProfitTarget: ch.finalProfitTarget ?? ch.brokerProfitTarget ?? ch.expectedGain ?? "400",
            maxMarginPct: ch.maxMarginPct ?? "50"
          })));
        }
      }
      if (savedBrokerBalance !== null) setBrokerBalance(savedBrokerBalance);
    } catch {}
    setHydrated(true);
  }, []);

  useEffect(() => {
    if (!hydrated) return;
    try {
      localStorage.setItem("propHedgeV7Challenges", JSON.stringify(challenges));
      localStorage.setItem("propHedgeV7BrokerBalance", brokerBalance);
    } catch {}
  }, [hydrated, challenges, brokerBalance]);

  const symbolsKey = useMemo(
    () => [...new Set(challenges.map(c => c.asset))].sort().join("|"),
    [challenges]
  );

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
        return { ...ch, entryPrice: price.toFixed(a.decimals) };
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

  const addChallenge = () => {
    setChallenges(prev => [...prev, makeChallenge(`Prop ${prev.length + 1}`)]);
  };

  const removeChallenge = (id) => {
    const ch = challenges.find(x => x.id === id);
    if (ch?.active) {
      alert("Chiudi o annulla prima l'operazione attiva.");
      return;
    }
    setChallenges(prev => prev.filter(ch => ch.id !== id));
  };

  const calcs = useMemo(() => {
    const map = {};
    for (const ch of challenges) {
      map[ch.id] = calcChallenge(ch, liveMap[ch.asset]);
    }
    return map;
  }, [challenges, liveMap]);

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
    if (!ch || !c || !c.px || !c.propLots || !c.brokerLots) {
      alert("Controlla prezzo, rischio e SL.");
      return;
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
        brokerLots: c.brokerLots,
        propTP: c.propTPPrice,
        propSL: c.propSL,
        brokerTP: c.brokerTP,
        brokerSL: c.brokerSL,
        propBalanceStart: num(ch.accountBalance),
        quoteToUsd: c.quoteToUsd,
        maxBrokerLossAtEntry: c.maxBrokerLoss,
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
        entryPrice: Number.isFinite(Number(live?.price)) ? Number(live.price).toFixed(a.decimals) : ch.entryPrice
      };
    }));
  };

  const closeAndUpdate = (id) => {
    const ch = challenges.find(x => x.id === id);
    const tracking = trackings[id];
    if (!ch?.active || !tracking) return;

    const propPLFinal = ch.closePropPL === "" ? tracking.propPL : num(ch.closePropPL);
    const brokerPLFinal = ch.closeBrokerPL === "" ? tracking.brokerPL : num(ch.closeBrokerPL);

    const newPropBalance = ch.active.propBalanceStart + propPLFinal;
    const newBrokerRealizedBalance = num(brokerBalance) + brokerPLFinal;
    const live = liveMap[ch.active.asset];
    const a = ASSETS[ch.active.asset];

    setBrokerBalance(String(Number(newBrokerRealizedBalance.toFixed(2))));

    setChallenges(prev => prev.map(row => {
      if (row.id !== id) return row;
      return {
        ...row,
        accountBalance: String(Number(newPropBalance.toFixed(2))),
        active: null,
        closePropPL: "",
        closeBrokerPL: "",
        autoPrice: true,
        entryPrice: Number.isFinite(Number(live?.price)) ? Number(live.price).toFixed(a.decimals) : row.entryPrice
      };
    }));
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
      <div style={{ display:"flex", justifyContent:"space-between", gap:12, flexWrap:"wrap", alignItems:"flex-start" }}>
        <div>
          <h2 style={sectionTitle}>📈 Prop Hedge — Multi Challenge</h2>
          <p style={sectionDescription}>
            Più Prop contemporaneamente, un unico Broker condiviso e controllo dell'esposizione aggregata.
          </p>
        </div>
        <button style={primaryButtonBlue} onClick={addChallenge}>+ Aggiungi Challenge</button>
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
          <TextNumberField label="Saldo Broker realizzato ($)" value={brokerBalance} onChange={setBrokerBalance} operational />
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

        return (
          <div key={ch.id} style={{
            ...panel,
            border: ch.active ? "1px solid rgba(34,197,94,.42)" : "1px solid rgba(51,65,85,.95)"
          }}>
            <div style={panelHeader}>
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
                <p style={{...panelSubtitle,marginTop:8}}>Challenge #{index + 1}</p>
              </div>

              {!ch.active && challenges.length > 1 && (
                <button
                  style={{...secondaryButton,color:"#fca5a5",border:"1px solid rgba(239,68,68,.35)"}}
                  onClick={() => removeChallenge(ch.id)}
                >
                  Rimuovi
                </button>
              )}
            </div>

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
                  <TextNumberField label="Saldo Account Prop ($)" value={ch.accountBalance} onChange={v=>setChallenge(ch.id,{accountBalance:v})} operational />
                  <TextNumberField label="DD Max Prop (%)" value={ch.ddMax} onChange={v=>setChallenge(ch.id,{ddMax:v})} />
                  <TextNumberField label="Costo Prop ($)" value={ch.propCost} onChange={v=>setChallenge(ch.id,{propCost:v})} />
                  <TextNumberField label="Guadagno finale desiderato ($)" value={ch.finalProfitTarget} onChange={v=>setChallenge(ch.id,{finalProfitTarget:v})} operational />
                  <TextNumberField label="Rischio ($)" value={ch.risk} onChange={v=>setChallenge(ch.id,{risk:v})} operational />
                  <TextNumberField label="SL Distance (punti)" value={ch.slPoints} onChange={v=>setChallenge(ch.id,{slPoints:v})} operational />
                  <TextNumberField label="TP Prop ($)" value={ch.tpProp} onChange={v=>setChallenge(ch.id,{tpProp:v})} operational />
                  <TextNumberField label="Leva" value={ch.leverage} onChange={v=>setChallenge(ch.id,{leverage:v})} />
                  <TextNumberField label="Margine massimo consentito (%)" value={ch.maxMarginPct ?? "50"} onChange={v=>setChallenge(ch.id,{maxMarginPct:v})} />
                  <TextNumberField label="Esposizione Broker attuale ($)" value={ch.brokerExposure} onChange={v=>setChallenge(ch.id,{brokerExposure:v})} operational />

                  <div style={{
                    padding:"8px 8px 8px",
                    borderRadius:14,
                    border:"1px solid rgba(34,211,238,.38)",
                    background:"rgba(8,145,178,.07)",
                    boxShadow:"0 0 0 1px rgba(34,211,238,.05) inset"
                  }}>
                    <div style={{display:"flex",justifyContent:"space-between",gap:8,alignItems:"center",marginBottom:6}}>
                      <label style={{...fieldLabel,marginBottom:0}}>Prezzo ingresso</label>
                      <span style={{
                        fontSize:9,fontWeight:900,letterSpacing:.55,color:"#67e8f9",
                        border:"1px solid rgba(34,211,238,.35)",
                        background:"rgba(8,145,178,.12)",
                        borderRadius:999,padding:"3px 6px",whiteSpace:"nowrap"
                      }}>DA AGGIORNARE</span>
                    </div>
                    <div style={{display:"flex",gap:8}}>
                      <input
                        style={{
                          ...input,
                          marginBottom:0,
                          border:"1px solid rgba(34,211,238,.72)",
                          boxShadow:"0 0 12px rgba(34,211,238,.08)",
                          background:"#071525"
                        }}
                        type="text"
                        inputMode="decimal"
                        value={ch.entryPrice}
                        onFocus={e=>e.currentTarget.select()}
                        onChange={e=>{
                          const raw=e.target.value;
                          if (/^-?[0-9]*[.,]?[0-9]*$/.test(raw) || raw==="") {
                            setChallenge(ch.id,{entryPrice:raw,autoPrice:false});
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
                            entryPrice:Number.isFinite(Number(lp)) ? Number(lp).toFixed(aa.decimals) : ch.entryPrice
                          });
                          refreshSymbol(ch.asset);
                        }}
                      >
                        Usa LIVE
                      </button>
                    </div>
                  </div>
                </div>

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

                <div style={{display:"flex",gap:10,flexWrap:"wrap",marginTop:14}}>
                  <button
                    onClick={()=>placeTrade(ch.id)}
                    style={{
                      border:"none",borderRadius:14,padding:"12px 20px",cursor:"pointer",
                      fontWeight:900,color:"#052e16",background:"linear-gradient(135deg,#4ade80,#22c55e)"
                    }}
                  >
                    ✅ PIAZZATA — AVVIA MONITOR
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
                    <div style={{fontWeight:900,fontSize:17,marginBottom:8}}>BROKER — {ch.active.brokerDirection}</div>
                    <div style={orderRow}><span>Lotti</span><b>{fmt(ch.active.brokerLots,2)}</b></div>
                    <div style={orderRow}><span>TP</span><b>{fmt(ch.active.brokerTP,ch.active.decimals)}</b></div>
                    <div style={orderRow}><span>SL</span><b>{fmt(ch.active.brokerSL,ch.active.decimals)}</b></div>
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

      <div style={hintBox}>
        V7 Multi Challenge: le operazioni attive e i saldi vengono salvati nel browser.
        Il quadro Broker usa un'esposizione residua conservativa, sommando le perdite potenziali delle coperture attive.
        L'esposizione netta in lotti per asset è mostrata separatamente. Prezzi, P/L e saldi restano stime:
        spread, commissioni, swap, slippage e specifiche dei contratti possono creare differenze reali.
      </div>
    </div>
    </>
  );
}
