"use client";

import React, { useEffect, useMemo, useState } from "react";
import {
  panel, panelHeader, panelTitle, panelSubtitle, input,
  primaryButtonBlue, secondaryButton, statCard, statLabel,
  statValue, statSub, statsGrid, hintBox
} from "./styles";

const ASSETS = {
  XAUUSD: "XAU/USD — Oro",
  XAGUSD: "XAG/USD — Argento",
  EURUSD: "EUR/USD",
  GBPUSD: "GBP/USD",
  USDJPY: "USD/JPY",
  USDCHF: "USD/CHF",
  USDCAD: "USD/CAD",
  AUDUSD: "AUD/USD",
  NZDUSD: "NZD/USD",
  EURGBP: "EUR/GBP",
  EURJPY: "EUR/JPY",
  EURCHF: "EUR/CHF",
  EURAUD: "EUR/AUD",
  GBPJPY: "GBP/JPY",
  GBPCHF: "GBP/CHF",
  GBPAUD: "GBP/AUD",
  AUDJPY: "AUD/JPY",
  CADJPY: "CAD/JPY",
  CHFJPY: "CHF/JPY",
  NZDJPY: "NZD/JPY",
};

function fmt(v, d = 2) {
  const n = Number(v);
  if (!Number.isFinite(n)) return "—";
  return n.toLocaleString("it-IT", {
    minimumFractionDigits: d,
    maximumFractionDigits: d
  });
}

function priceDecimals(symbol) {
  if (symbol.includes("JPY")) return 3;
  if (symbol.startsWith("XAU")) return 3;
  if (symbol.startsWith("XAG")) return 4;
  return 5;
}

function biasTheme(bias) {
  if (bias === "BUY") {
    return {
      color:"#5eead4",
      bg:"rgba(13,148,136,.10)",
      border:"rgba(45,212,191,.38)",
      icon:"🟢",
      label:"BIAS RIALZISTA"
    };
  }
  if (bias === "SELL") {
    return {
      color:"#fca5a5",
      bg:"rgba(185,28,28,.10)",
      border:"rgba(248,113,113,.38)",
      icon:"🔴",
      label:"BIAS RIBASSISTA"
    };
  }
  return {
    color:"#fde68a",
    bg:"rgba(180,83,9,.10)",
    border:"rgba(251,191,36,.35)",
    icon:"🟡",
    label:"BIAS NEUTRALE"
  };
}

export default function MarketEnginePanel({ defaultAsset = "XAUUSD", challenges = [], onApplyDirection = null }) {
  const [symbol, setSymbol] = useState(defaultAsset);
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [targetChallengeId, setTargetChallengeId] = useState("");

  const analyze = async (force = false) => {
    if (loading) return;
    setLoading(true);
    setError("");

    try {
      const r = await fetch(
        `/api/market-analysis?symbol=${encodeURIComponent(symbol)}${force ? "&force=1" : ""}`,
        { cache:"no-store" }
      );
      const j = await r.json();
      if (!r.ok || !j?.ok) throw new Error(j?.error || "Analisi non disponibile");
      setData(j);
    } catch (e) {
      setError(e?.message || "Errore Market Engine");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    analyze(false);
    const id = setInterval(() => analyze(false), 120000);
    return () => clearInterval(id);
  }, [symbol]);

  useEffect(() => {
    if (!targetChallengeId && challenges.length) {
      setTargetChallengeId(challenges[0].id);
    } else if (targetChallengeId && !challenges.some(c => c.id === targetChallengeId)) {
      setTargetChallengeId(challenges[0]?.id || "");
    }
  }, [challenges, targetChallengeId]);

  const theme = biasTheme(data?.combined?.bias || "NEUTRAL");
  const tfOrder = ["M15","H1","H4","D1"];

  const propDirection = data?.combined?.propDirection || "WAIT";
  const signalStrength = data?.combined?.signalStrength || "INSUFFICIENT";
  const canApplyDirection =
    propDirection !== "WAIT" &&
    signalStrength !== "INSUFFICIENT" &&
    !!targetChallengeId &&
    typeof onApplyDirection === "function";

  const formatBarTime = (ts) => {
    if (!Number.isFinite(Number(ts))) return "—";
    return new Date(Number(ts)).toLocaleString("it-IT");
  };

  const lagText = (ms) => {
    if (!Number.isFinite(Number(ms))) return "";
    const minutes = Math.round(Number(ms) / 60000);
    if (minutes < 60) return `${minutes} min`;
    const hours = Math.round(minutes / 60);
    if (hours < 48) return `${hours} h`;
    return `${Math.round(hours / 24)} gg`;
  };

  return (
    <div style={{
      ...panel,
      border:"1px solid rgba(168,85,247,.34)",
      background:"linear-gradient(135deg,rgba(88,28,135,.10),rgba(15,23,42,.96))"
    }}>
      <div style={panelHeader}>
        <div>
          <h3 style={panelTitle}>🧠 WAR ROOM — Market Engine</h3>
          <p style={panelSubtitle}>
            Analisi quantitativa multi-timeframe basata su candele Massive.
          </p>
        </div>
        <div style={{display:"flex",gap:8,flexWrap:"wrap"}}>
          <button style={secondaryButton} onClick={()=>analyze(false)}>
            {loading ? "Analizzo…" : "↻ Aggiorna"}
          </button>
          <button style={primaryButtonBlue} onClick={()=>analyze(true)}>
            Forza nuova analisi
          </button>
        </div>
      </div>

      <div style={{
        display:"grid",
        gridTemplateColumns:"minmax(220px,320px) 1fr",
        gap:14,
        alignItems:"end",
        marginBottom:14
      }}>
        <div>
          <label style={{display:"block",color:"#93c5fd",fontSize:13,marginBottom:6}}>Asset da analizzare</label>
          <select style={input} value={symbol} onChange={e=>setSymbol(e.target.value)}>
            {Object.entries(ASSETS).map(([k,v]) => <option key={k} value={k}>{v}</option>)}
          </select>
        </div>

        <div style={{
          padding:"14px 16px",
          borderRadius:16,
          background:theme.bg,
          border:`1px solid ${theme.border}`
        }}>
          <div style={{fontSize:12,color:"#94a3b8",fontWeight:800,letterSpacing:.6}}>MARKET BIAS</div>
          <div style={{
            display:"flex",
            gap:12,
            alignItems:"baseline",
            flexWrap:"wrap",
            marginTop:4
          }}>
            <div style={{fontSize:26,fontWeight:950,color:theme.color}}>
              {theme.icon} {theme.label}
            </div>
            <div style={{fontSize:18,fontWeight:900,color:"#f8fafc"}}>
              Score {fmt(data?.combined?.score,1)}
            </div>
            <div style={{fontSize:14,fontWeight:800,color:"#cbd5e1"}}>
              Confidence {fmt(data?.combined?.confidence,0)}/100
            </div>
          </div>

          <div style={{
            marginTop:12,
            padding:"12px 13px",
            borderRadius:13,
            border:"1px solid rgba(148,163,184,.24)",
            background:"rgba(2,6,23,.34)"
          }}>
            <div style={{fontSize:11,color:"#94a3b8",fontWeight:800,letterSpacing:.55}}>
              🎯 DIREZIONE PROP (opposta al bias)
            </div>
            <div style={{
              marginTop:4,
              fontSize:23,
              fontWeight:950,
              color:
                propDirection === "BUY" ? "#5eead4" :
                propDirection === "SELL" ? "#fca5a5" :
                "#fde68a"
            }}>
              {propDirection === "WAIT"
                ? "⚠️ ATTENDI — SEGNALE INSUFFICIENTE"
                : `${propDirection === "BUY" ? "🟢" : "🔴"} ${propDirection}`}
            </div>
            <div style={{fontSize:11,color:"#94a3b8",marginTop:4}}>
              Qualità segnale: <b style={{color:"#e2e8f0"}}>{signalStrength}</b>.
              {" "}Sotto confidence 30/100 non viene proposta alcuna direzione.
            </div>
          </div>

          {challenges.length > 0 && (
            <div style={{
              display:"grid",
              gridTemplateColumns:"minmax(170px,1fr) auto",
              gap:8,
              alignItems:"end",
              marginTop:10
            }}>
              <div>
                <label style={{display:"block",fontSize:10,color:"#94a3b8",marginBottom:4}}>
                  Applica a challenge
                </label>
                <select
                  style={{...input,marginBottom:0,padding:"8px 10px"}}
                  value={targetChallengeId}
                  onChange={e=>setTargetChallengeId(e.target.value)}
                >
                  {challenges.map(ch=>(
                    <option key={ch.id} value={ch.id}>
                      {ch.name || "Prop"}
                    </option>
                  ))}
                </select>
              </div>

              <button
                style={{
                  ...primaryButtonBlue,
                  opacity: canApplyDirection ? 1 : .45,
                  cursor: canApplyDirection ? "pointer" : "not-allowed",
                  whiteSpace:"nowrap"
                }}
                disabled={!canApplyDirection}
                onClick={()=>{
                  if (canApplyDirection) {
                    onApplyDirection(targetChallengeId, propDirection);
                  }
                }}
              >
                🎯 USA DIREZIONE MARKET ENGINE
              </button>
            </div>
          )}

          <div style={{fontSize:11,color:"#94a3b8",marginTop:8}}>
            La confidence è forza dello score, NON una probabilità statistica di successo.
          </div>
        </div>
      </div>

      {error && (
        <div style={{
          padding:"12px 14px",
          borderRadius:14,
          border:"1px solid rgba(239,68,68,.45)",
          background:"rgba(127,29,29,.18)",
          color:"#fecaca",
          marginBottom:14
        }}>
          ❌ {error}
        </div>
      )}

      {data && (
        <>
          <div style={statsGrid}>
            {tfOrder.map(tf => {
              const x = data.timeframes?.[tf];
              const fresh = data.combined?.freshness?.[tf];
              const stale = !!fresh?.stale;
              const t = biasTheme(x?.bias || "NEUTRAL");
              return (
                <div key={tf} style={{
                  ...statCard,
                  border: stale ? "1px solid rgba(245,158,11,.62)" : `1px solid ${t.border}`,
                  opacity: stale ? .72 : 1
                }}>
                  <div style={{display:"flex",justifyContent:"space-between",gap:8,alignItems:"center"}}>
                    <div style={statLabel}>{tf}</div>
                    {stale && (
                      <span style={{
                        fontSize:9,fontWeight:900,color:"#fde68a",
                        border:"1px solid rgba(245,158,11,.45)",
                        background:"rgba(180,83,9,.12)",
                        borderRadius:999,padding:"3px 6px"
                      }}>
                        ⚠️ OBSOLETO
                      </span>
                    )}
                  </div>
                  <div style={{...statValue,color:stale ? "#fde68a" : t.color,fontSize:24}}>
                    {x?.bias || "—"} {Number.isFinite(Number(x?.score)) ? `(${fmt(x.score,0)})` : ""}
                  </div>
                  <div style={statSub}>
                    RSI {fmt(x?.rsi14,1)} • ATR {fmt(x?.atrPct,3)}%
                  </div>
                  <div style={{fontSize:10,color:stale?"#fde68a":"#94a3b8",marginTop:5}}>
                    Ultima candela: {formatBarTime(x?.timestamp)}
                    {fresh?.lagMs ? ` • lag ${lagText(fresh.lagMs)}` : ""}
                    {stale ? " • escluso dallo score" : ""}
                  </div>
                  <div style={{marginTop:8,fontSize:11,color:"#94a3b8",lineHeight:1.45}}>
                    EMA20 {fmt(x?.ema20,priceDecimals(symbol))}<br/>
                    EMA50 {fmt(x?.ema50,priceDecimals(symbol))}<br/>
                    EMA200 {fmt(x?.ema200,priceDecimals(symbol))}
                  </div>
                </div>
              );
            })}
          </div>

          <div style={{
            display:"grid",
            gridTemplateColumns:"repeat(auto-fit,minmax(280px,1fr))",
            gap:14,
            marginTop:14
          }}>
            {tfOrder.map(tf => {
              const x = data.timeframes?.[tf];
              const t = biasTheme(x?.bias || "NEUTRAL");
              return (
                <div key={tf} style={{
                  ...statCard,
                  opacity:data.combined?.freshness?.[tf]?.stale ? .72 : 1
                }}>
                  <div style={{
                    fontWeight:900,
                    fontSize:16,
                    color:data.combined?.freshness?.[tf]?.stale ? "#fde68a" : t.color,
                    marginBottom:4
                  }}>
                    {tf} — {x?.bias}
                    {data.combined?.freshness?.[tf]?.stale ? " ⚠️" : ""}
                  </div>
                  <div style={{
                    fontSize:10,
                    color:data.combined?.freshness?.[tf]?.stale ? "#fde68a" : "#94a3b8",
                    marginBottom:8
                  }}>
                    {formatBarTime(x?.timestamp)}
                    {data.combined?.freshness?.[tf]?.stale ? " • escluso dallo score" : ""}
                  </div>

                  <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:8,fontSize:12}}>
                    <div>
                      <span style={{color:"#94a3b8"}}>Ultimo close</span>
                      <div style={{fontWeight:850,color:"#f8fafc"}}>
                        {fmt(x?.lastClose,priceDecimals(symbol))}
                      </div>
                    </div>
                    <div>
                      <span style={{color:"#94a3b8"}}>RSI 14</span>
                      <div style={{fontWeight:850,color:"#f8fafc"}}>{fmt(x?.rsi14,1)}</div>
                    </div>
                    <div>
                      <span style={{color:"#94a3b8"}}>MACD hist.</span>
                      <div style={{fontWeight:850,color:Number(x?.macd?.histogram)>=0?"#5eead4":"#fca5a5"}}>
                        {fmt(x?.macd?.histogram,6)}
                      </div>
                    </div>
                    <div>
                      <span style={{color:"#94a3b8"}}>ATR 14</span>
                      <div style={{fontWeight:850,color:"#f8fafc"}}>{fmt(x?.atr14,priceDecimals(symbol))}</div>
                    </div>
                    <div>
                      <span style={{color:"#94a3b8"}}>Supporto 20</span>
                      <div style={{fontWeight:850,color:"#5eead4"}}>{fmt(x?.support20,priceDecimals(symbol))}</div>
                    </div>
                    <div>
                      <span style={{color:"#94a3b8"}}>Resistenza 20</span>
                      <div style={{fontWeight:850,color:"#fca5a5"}}>{fmt(x?.resistance20,priceDecimals(symbol))}</div>
                    </div>
                  </div>

                  <div style={{
                    marginTop:10,
                    paddingTop:9,
                    borderTop:"1px solid rgba(51,65,85,.65)",
                    color:"#cbd5e1",
                    fontSize:11,
                    lineHeight:1.5
                  }}>
                    {(x?.reasons || []).map((r,i)=><div key={i}>• {r}</div>)}
                  </div>
                </div>
              );
            })}
          </div>

          <div style={{
            marginTop:14,
            padding:"11px 13px",
            borderRadius:14,
            border:"1px solid rgba(71,85,105,.65)",
            background:"rgba(2,6,23,.42)",
            color:"#94a3b8",
            fontSize:11
          }}>
            Allineamento utilizzato: BUY {data.combined?.alignment?.buy ?? 0} •
            SELL {data.combined?.alignment?.sell ?? 0} •
            NEUTRAL {data.combined?.alignment?.neutral ?? 0}
            {" • "}
            TF validi: {(data.combined?.usableTimeframes || []).join(", ") || "nessuno"}
            {(data.combined?.staleTimeframes || []).length
              ? ` • esclusi: ${(data.combined?.staleTimeframes || []).join(", ")}`
              : ""}
            {" • "}
            Generata: {data.generatedAt ? new Date(data.generatedAt).toLocaleString("it-IT") : "—"}
            {data.cache ? " • cache Vercel" : ""}
          </div>
        </>
      )}

      <div style={hintBox}>
        Market Engine sperimentale: combina trend EMA, RSI, MACD, ATR e struttura prezzi.
        I timeframe anormalmente vecchi rispetto agli altri vengono marcati OBSOLETI ed esclusi dallo score.
        La "Direzione Prop" è volutamente opposta al bias di mercato e richiede conferma manuale tramite pulsante.
        Lo score è descrittivo e non costituisce previsione certa, segnale operativo o consulenza finanziaria.
        Sul piano gratuito Massive l'analisi usa cache di 2 minuti per non bruciare il limite API.
      </div>
    </div>
  );
}
