"use client";

import React, { useEffect, useMemo, useRef, useState } from "react";
import TradingViewChart from "./TradingViewChart";
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
  const requestInFlightRef = useRef(false);
  const lastRequestAtRef = useRef(0);
  const [usingFallback, setUsingFallback] = useState(false);

  const analyze = async (force = false) => {
    const now = Date.now();

    if (requestInFlightRef.current) return;
    if (!force && now - lastRequestAtRef.current < 15_000) return;

    requestInFlightRef.current = true;
    lastRequestAtRef.current = now;
    setLoading(true);
    setError("");
    setUsingFallback(false);

    try {
      const r = await fetch(
        `/api/market-analysis?symbol=${encodeURIComponent(symbol)}${force ? "&force=1" : ""}`,
        { cache:"no-store" }
      );
      const j = await r.json();

      if (!r.ok || !j?.ok) {
        throw new Error(j?.error || "Analisi non disponibile");
      }

      setData(j);

      try {
        localStorage.setItem(
          `propMarketLastGood:${symbol}`,
          JSON.stringify({ savedAt: Date.now(), data: j })
        );
      } catch {}
    } catch (e) {
      const message = e?.message || "Errore Market Engine";
      let fallback = null;

      try {
        const raw = localStorage.getItem(`propMarketLastGood:${symbol}`);
        if (raw) fallback = JSON.parse(raw);
      } catch {}

      if (fallback?.data?.ok) {
        setData(fallback.data);
        setUsingFallback(true);
        setError(
          message.includes("maximum requests")
            ? "Massive rate limit: mostro l’ultima analisi valida salvata."
            : `Feed temporaneamente non disponibile: mostro l’ultima analisi valida. (${message})`
        );
      } else {
        setError(message);
      }
    } finally {
      requestInFlightRef.current = false;
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

  const signalUi = {
    INSUFFICIENT: { label:"INSUFFICIENTE", color:"#fbbf24", bg:"rgba(180,83,9,.15)", border:"rgba(245,158,11,.50)", min:0, max:29 },
    WEAK: { label:"DEBOLE", color:"#fb923c", bg:"rgba(194,65,12,.14)", border:"rgba(251,146,60,.50)", min:30, max:49 },
    GOOD: { label:"BUONO", color:"#a3e635", bg:"rgba(77,124,15,.14)", border:"rgba(163,230,53,.48)", min:50, max:69 },
    STRONG: { label:"OTTIMO", color:"#4ade80", bg:"rgba(22,101,52,.14)", border:"rgba(74,222,128,.50)", min:70, max:100 },
  }[signalStrength] || { label:"INSUFFICIENTE", color:"#fbbf24", bg:"rgba(180,83,9,.15)", border:"rgba(245,158,11,.50)", min:0, max:29 };
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
          <button
            style={{...secondaryButton,opacity:loading?.55:1}}
            disabled={loading}
            onClick={()=>analyze(false)}
          >
            {loading ? "Analizzo…" : "↻ Aggiorna"}
          </button>
          <button
            style={{...primaryButtonBlue,opacity:loading?.55:1}}
            disabled={loading}
            onClick={()=>analyze(true)}
            title="Bypassa la cache. Usa 2 chiamate Massive."
          >
            Forza nuova analisi
          </button>
        </div>
      </div>

      <div style={{
        display:"grid",
        gridTemplateColumns:"minmax(220px,.8fr) minmax(260px,1.1fr) minmax(310px,1.25fr) minmax(290px,1.1fr)",
        gap:12,
        alignItems:"stretch",
        marginBottom:14
      }}>
        <div style={{display:"flex",flexDirection:"column",justifyContent:"center"}}>
          <label style={{display:"block",color:"#93c5fd",fontSize:13,marginBottom:6}}>Asset da analizzare</label>
          <select style={input} value={symbol} onChange={e=>setSymbol(e.target.value)}>
            {Object.entries(ASSETS).map(([k,v]) => <option key={k} value={k}>{v}</option>)}
          </select>
        </div>

        <div style={{
          padding:"16px",
          borderRadius:16,
          background:theme.bg,
          border:`1px solid ${theme.border}`,
          display:"flex",
          flexDirection:"column",
          justifyContent:"center"
        }}>
          <div style={{fontSize:11,color:"#94a3b8",fontWeight:900,letterSpacing:.7}}>MARKET BIAS</div>
          <div style={{fontSize:28,fontWeight:950,color:theme.color,marginTop:6}}>
            {theme.icon} {theme.label}
          </div>
          <div style={{display:"flex",gap:12,flexWrap:"wrap",marginTop:10,alignItems:"baseline"}}>
            <div style={{fontSize:22,fontWeight:950,color:"#f8fafc"}}>
              Score {fmt(data?.combined?.score,1)}
            </div>
            <div style={{fontSize:13,fontWeight:900,color:"#cbd5e1"}}>
              Confidence {fmt(data?.combined?.confidence,0)}/100
            </div>
          </div>
          <div style={{fontSize:10,color:"#94a3b8",marginTop:6}}>
            Forza dello score, non probabilità statistica.
          </div>
        </div>

        <div style={{
          padding:"16px",
          borderRadius:16,
          border: propDirection === "BUY"
            ? "1px solid rgba(45,212,191,.48)"
            : propDirection === "SELL"
              ? "1px solid rgba(248,113,113,.48)"
              : "1px solid rgba(245,158,11,.42)",
          background: propDirection === "BUY"
            ? "linear-gradient(135deg,rgba(13,148,136,.12),rgba(15,23,42,.96))"
            : propDirection === "SELL"
              ? "linear-gradient(135deg,rgba(153,27,27,.16),rgba(15,23,42,.96))"
              : "linear-gradient(135deg,rgba(180,83,9,.12),rgba(15,23,42,.96))",
          display:"flex",
          flexDirection:"column",
          justifyContent:"center",
          boxShadow: propDirection === "WAIT"
            ? "none"
            : `0 0 30px ${propDirection === "BUY" ? "rgba(45,212,191,.08)" : "rgba(248,113,113,.08)"}`
        }}>
          <div style={{fontSize:11,color:"#94a3b8",fontWeight:900,letterSpacing:.65}}>
            🎯 DIREZIONE PROP — OPPOSTA AL BIAS
          </div>

          <div style={{
            marginTop:4,
            fontSize: propDirection === "WAIT" ? 24 : 48,
            lineHeight:1,
            fontWeight:1000,
            letterSpacing:1,
            color:
              propDirection === "BUY" ? "#5eead4" :
              propDirection === "SELL" ? "#fb7185" :
              "#fde68a",
            textShadow:
              propDirection === "BUY" ? "0 0 22px rgba(45,212,191,.28)" :
              propDirection === "SELL" ? "0 0 22px rgba(248,113,113,.28)" :
              "none"
          }}>
            {propDirection === "WAIT"
              ? "⚠️ ATTENDI"
              : `${propDirection === "BUY" ? "▲" : "▼"} ${propDirection}`}
          </div>

          <div style={{
            marginTop:12,
            padding:"9px 10px",
            borderRadius:11,
            background:"rgba(2,6,23,.40)",
            border:"1px solid rgba(148,163,184,.16)",
            color:"#cbd5e1",
            fontSize:11
          }}>
            {propDirection === "WAIT"
              ? "Segnale insufficiente: nessuna direzione applicabile."
              : "Direzione suggerita per la Prop con obiettivo movimento contrario verso SL."}
          </div>
        </div>

        <div style={{
          padding:"16px",
          borderRadius:16,
          border:`1px solid ${signalUi.border}`,
          background:signalUi.bg,
          display:"flex",
          flexDirection:"column",
          justifyContent:"center"
        }}>
          <div style={{fontSize:11,color:"#94a3b8",fontWeight:900,letterSpacing:.65}}>QUALITÀ DEL SEGNALE</div>
          <div style={{
            marginTop:6,
            fontSize:28,
            fontWeight:1000,
            color:signalUi.color
          }}>
            {signalUi.label}
          </div>
          <div style={{fontSize:13,fontWeight:900,color:"#e2e8f0",marginTop:3}}>
            Confidence {fmt(data?.combined?.confidence,0)}/100
          </div>

          <div style={{display:"grid",gridTemplateColumns:"repeat(4,1fr)",gap:4,marginTop:12}}>
            {[
              ["INSUFF.","0–29","#ef4444"],
              ["DEBOLE","30–49","#f59e0b"],
              ["BUONO","50–69","#84cc16"],
              ["OTTIMO","70–100","#22c55e"]
            ].map(([lab,range,color],i)=>(
              <div key={lab} style={{textAlign:"center"}}>
                <div style={{
                  height:8,
                  borderRadius:999,
                  background:color,
                  opacity:
                    (signalStrength==="INSUFFICIENT"&&i===0) ||
                    (signalStrength==="WEAK"&&i===1) ||
                    (signalStrength==="GOOD"&&i===2) ||
                    (signalStrength==="STRONG"&&i===3) ? 1 : .28,
                  boxShadow:
                    (signalStrength==="INSUFFICIENT"&&i===0) ||
                    (signalStrength==="WEAK"&&i===1) ||
                    (signalStrength==="GOOD"&&i===2) ||
                    (signalStrength==="STRONG"&&i===3) ? `0 0 10px ${color}` : "none"
                }} />
                <div style={{fontSize:9,fontWeight:900,color:"#cbd5e1",marginTop:4}}>{lab}</div>
                <div style={{fontSize:8,color:"#64748b"}}>{range}</div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {challenges.length > 0 && (
        <div style={{
          display:"grid",
          gridTemplateColumns:"minmax(180px,320px) auto",
          gap:8,
          alignItems:"end",
          marginBottom:14
        }}>
          <div>
            <label style={{display:"block",fontSize:10,color:"#94a3b8",marginBottom:4}}>
              Applica direzione a challenge
            </label>
            <select
              style={{...input,marginBottom:0,padding:"9px 10px"}}
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

      {error && (
        <div style={{
          padding:"12px 14px",
          borderRadius:14,
          border: usingFallback ? "1px solid rgba(245,158,11,.45)" : "1px solid rgba(239,68,68,.45)",
          background: usingFallback ? "rgba(180,83,9,.14)" : "rgba(127,29,29,.18)",
          color: usingFallback ? "#fde68a" : "#fecaca",
          marginBottom:14
        }}>
          {usingFallback ? "⚠️" : "❌"} {error}
          {usingFallback && (
            <div style={{fontSize:11,marginTop:4,opacity:.9}}>
              La War Room mostra l’ultima analisi valida invece di azzerarsi.
            </div>
          )}
        </div>
      )}

      {data && (
        <>
          <div style={{
            marginBottom:14,
            padding:"12px",
            borderRadius:16,
            border:"1px solid rgba(56,189,248,.26)",
            background:"rgba(2,6,23,.55)",
            overflow:"hidden"
          }}>
            <div style={{
              display:"flex",
              justifyContent:"space-between",
              alignItems:"center",
              gap:10,
              flexWrap:"wrap",
              marginBottom:9
            }}>
              <div>
                <div style={{fontSize:13,fontWeight:950,color:"#e2e8f0"}}>
                  📈 TradingView — {ASSETS[symbol] || symbol}
                </div>
                <div style={{fontSize:10,color:"#64748b",marginTop:2}}>
                  Grafico visuale sincronizzato con l'asset selezionato nel Market Engine.
                </div>
              </div>
              <div style={{
                fontSize:10,
                color:"#93c5fd",
                border:"1px solid rgba(59,130,246,.28)",
                background:"rgba(30,64,175,.10)",
                padding:"5px 8px",
                borderRadius:999
              }}>
                TradingView Advanced Chart
              </div>
            </div>
            <TradingViewChart symbol={symbol} />
          </div>

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
            {Number.isFinite(Number(data.apiCallsUsed)) ? ` • ${data.apiCallsUsed} chiamate Massive` : ""}
          </div>
        </>
      )}

      <div style={hintBox}>
        Market Engine sperimentale: combina trend EMA, RSI, MACD, ATR e struttura prezzi.
        I timeframe anormalmente vecchi rispetto agli altri vengono marcati OBSOLETI ed esclusi dallo score.
        La "Direzione Prop" è volutamente opposta al bias di mercato e richiede conferma manuale tramite pulsante.
        Lo score è descrittivo e non costituisce previsione certa, segnale operativo o consulenza finanziaria.
        La V10.2 usa solo 2 chiamate Massive per analisi: M15 + H1; H4 e D1 vengono aggregati localmente.
        Cache 2 minuti, blocco anti-doppia richiesta e fallback sull'ultima analisi valida proteggono dal rate limit.
      </div>
    </div>
  );
}
