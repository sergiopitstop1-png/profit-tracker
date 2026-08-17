"use client";

import React, { useEffect, useMemo, useRef, useState } from "react";
import TradingViewChart from "./TradingViewChart";
import {
  panel, panelHeader, panelTitle, panelSubtitle, input,
  primaryButtonBlue, secondaryButton
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
  const [directionModeByChallenge, setDirectionModeByChallenge] = useState({});
  const requestInFlightRef = useRef(false);
  const lastRequestAtRef = useRef(0);
  const [usingFallback, setUsingFallback] = useState(false);
  const activeSymbolRef = useRef(symbol);

  const analyze = async (force = false, requestedSymbol = symbol) => {
    const now = Date.now();

    // Evita doppie richieste sullo stesso asset, ma non blocca un vero cambio asset.
    if (requestInFlightRef.current && requestedSymbol === activeSymbolRef.current) return;
    if (!force && requestedSymbol === activeSymbolRef.current && now - lastRequestAtRef.current < 15_000) return;

    activeSymbolRef.current = requestedSymbol;
    requestInFlightRef.current = true;
    lastRequestAtRef.current = now;
    setLoading(true);
    setError("");
    setUsingFallback(false);

    try {
      const r = await fetch(
        `/api/market-analysis?symbol=${encodeURIComponent(requestedSymbol)}${force ? "&force=1" : ""}`,
        { cache:"no-store" }
      );
      const j = await r.json();

      if (!r.ok || !j?.ok) {
        throw new Error(j?.error || "Analisi non disponibile");
      }

      // Se nel frattempo l'utente ha cambiato di nuovo asset,
      // non mostriamo mai la risposta del simbolo precedente.
      if (activeSymbolRef.current !== requestedSymbol) return;

      setData(j);

      try {
        localStorage.setItem(
          `propMarketLastGood:${requestedSymbol}`,
          JSON.stringify({ savedAt: Date.now(), data: j })
        );
      } catch {}
    } catch (e) {
      if (activeSymbolRef.current !== requestedSymbol) return;

      const message = e?.message || "Errore Market Engine";
      let fallback = null;

      try {
        const raw = localStorage.getItem(`propMarketLastGood:${requestedSymbol}`);
        if (raw) fallback = JSON.parse(raw);
      } catch {}

      if (fallback?.data?.ok) {
        setData(fallback.data);
        setUsingFallback(true);
        setError(
          message.includes("maximum requests")
            ? "Massive rate limit: mostro l’ultima analisi valida salvata per questo asset."
            : `Feed temporaneamente non disponibile: mostro l’ultima analisi valida di ${requestedSymbol}. (${message})`
        );
      } else {
        setData(null);
        setError(message);
      }
    } finally {
      if (activeSymbolRef.current === requestedSymbol) {
        requestInFlightRef.current = false;
        setLoading(false);
      }
    }
  };

  useEffect(() => {
    // Cambio asset: cancella subito il vecchio segnale e analizza il nuovo simbolo.
    activeSymbolRef.current = symbol;
    lastRequestAtRef.current = 0;
    setData(null);
    setError("");
    setUsingFallback(false);

    analyze(false, symbol);

    const id = setInterval(() => analyze(false, symbol), 120000);
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
  const propDirection = data?.combined?.propDirection || "WAIT";
  const signalStrength = data?.combined?.signalStrength || "INSUFFICIENT";

  const signalUi = {
    INSUFFICIENT: { label:"INSUFFICIENTE", color:"#fbbf24", bg:"rgba(180,83,9,.15)", border:"rgba(245,158,11,.50)", min:0, max:29 },
    WEAK: { label:"DEBOLE", color:"#fb923c", bg:"rgba(194,65,12,.14)", border:"rgba(251,146,60,.50)", min:30, max:49 },
    GOOD: { label:"BUONO", color:"#a3e635", bg:"rgba(77,124,15,.14)", border:"rgba(163,230,53,.48)", min:50, max:69 },
    STRONG: { label:"OTTIMO", color:"#4ade80", bg:"rgba(22,101,52,.14)", border:"rgba(74,222,128,.50)", min:70, max:100 },
  }[signalStrength] || { label:"INSUFFICIENTE", color:"#fbbf24", bg:"rgba(180,83,9,.15)", border:"rgba(245,158,11,.50)", min:0, max:29 };
  // I tre pulsanti funzionano come un selettore di modalità.
  // Anche MARKET ENGINE resta selezionabile con segnale insufficiente: in quel caso applica WAIT.
  const canChooseDirection =
    !!targetChallengeId &&
    typeof onApplyDirection === "function";

  const selectedDirectionMode = targetChallengeId
    ? (directionModeByChallenge[targetChallengeId] || "ENGINE")
    : "ENGINE";

  const chooseDirectionMode = (mode, direction) => {
    if (!canChooseDirection) return;
    setDirectionModeByChallenge(prev => ({ ...prev, [targetChallengeId]: mode }));
    onApplyDirection(targetChallengeId, direction);
  };



  return (
    <div style={{
      ...panel,
      border:"1px solid rgba(168,85,247,.34)",
      background:"linear-gradient(135deg,rgba(88,28,135,.10),rgba(15,23,42,.96))"
    }}>
      <div style={panelHeader}>
        <div>
          <h3 style={panelTitle}>🧠 WAR ROOM — Market Engine V2</h3>
          <p style={panelSubtitle}>
            Forecast operativo 0–3H: trend giornata, blocchi 3 ore, rolling momentum e price action.
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

      {loading && !data && (
        <div style={{
          marginBottom:14,
          padding:"15px 16px",
          borderRadius:15,
          border:"1px solid rgba(56,189,248,.34)",
          background:"rgba(14,116,144,.08)",
          color:"#bae6fd",
          fontWeight:900
        }}>
          ⏳ Analisi {ASSETS[symbol] || symbol} in corso…
          <div style={{fontSize:11,fontWeight:600,color:"#94a3b8",marginTop:4}}>
            Il vecchio segnale è stato nascosto per evitare di associare un'analisi all'asset sbagliato.
          </div>
        </div>
      )}

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
          <div style={{fontSize:11,color:"#94a3b8",fontWeight:900,letterSpacing:.7}}>TREND / FORECAST 0–3H</div>
          <div style={{fontSize:28,fontWeight:950,color:theme.color,marginTop:6}}>
            {theme.icon} {data?.combined?.forecastDirection === "BUY" ? "FORECAST RIALZISTA" : data?.combined?.forecastDirection === "SELL" ? "FORECAST RIBASSISTA" : "FORECAST NEUTRALE"}
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
            🎯 DIREZIONE PROP — OPPOSTA AL FORECAST
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

          <div style={{display:"grid",gridTemplateColumns:"minmax(230px,1fr) auto auto",gap:8,alignItems:"stretch"}}>
            <button
              style={{
                ...primaryButtonBlue,
                opacity: !canChooseDirection ? .45 : selectedDirectionMode === "ENGINE" ? .45 : 1,
                cursor: !canChooseDirection || selectedDirectionMode === "ENGINE" ? "default" : "pointer",
                filter: selectedDirectionMode === "ENGINE" ? "brightness(.62) saturate(.72)" : "none",
                boxShadow: selectedDirectionMode === "ENGINE" ? "inset 0 0 0 1px rgba(148,163,184,.20)" : undefined,
                whiteSpace:"nowrap"
              }}
              disabled={!canChooseDirection || selectedDirectionMode === "ENGINE"}
              onClick={()=>chooseDirectionMode("ENGINE", propDirection === "WAIT" ? "WAIT" : propDirection)}
              title={selectedDirectionMode === "ENGINE"
                ? "Market Engine già selezionato"
                : propDirection === "WAIT"
                  ? "Torna al Market Engine: la Prop passerà in WAIT finché non arriva un segnale valido."
                  : `Torna al Market Engine e applica ${propDirection}.`}
            >
              🎯 USA DIREZIONE MARKET ENGINE
            </button>

            <button
              style={{
                ...secondaryButton,
                border:"1px solid rgba(45,212,191,.55)",
                background:"rgba(13,148,136,.14)",
                color:"#5eead4",
                fontWeight:900,
                opacity: !canChooseDirection ? .45 : selectedDirectionMode === "BUY" ? .45 : 1,
                cursor: !canChooseDirection || selectedDirectionMode === "BUY" ? "default" : "pointer",
                filter: selectedDirectionMode === "BUY" ? "brightness(.58) saturate(.65)" : "none",
                boxShadow: selectedDirectionMode === "BUY" ? "inset 0 0 0 1px rgba(45,212,191,.18)" : undefined,
                whiteSpace:"nowrap"
              }}
              disabled={!canChooseDirection || selectedDirectionMode === "BUY"}
              onClick={()=>chooseDirectionMode("BUY", "BUY")}
            >
              🟢 BUY MANUALE
            </button>

            <button
              style={{
                ...secondaryButton,
                border:"1px solid rgba(248,113,113,.55)",
                background:"rgba(185,28,28,.14)",
                color:"#fca5a5",
                fontWeight:900,
                opacity: !canChooseDirection ? .45 : selectedDirectionMode === "SELL" ? .45 : 1,
                cursor: !canChooseDirection || selectedDirectionMode === "SELL" ? "default" : "pointer",
                filter: selectedDirectionMode === "SELL" ? "brightness(.58) saturate(.65)" : "none",
                boxShadow: selectedDirectionMode === "SELL" ? "inset 0 0 0 1px rgba(248,113,113,.18)" : undefined,
                whiteSpace:"nowrap"
              }}
              disabled={!canChooseDirection || selectedDirectionMode === "SELL"}
              onClick={()=>chooseDirectionMode("SELL", "SELL")}
            >
              🔴 SELL MANUALE
            </button>
          </div>
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
            display:"grid",
            gridTemplateColumns:"repeat(auto-fit,minmax(220px,1fr))",
            gap:10,
            marginBottom:12
          }}>
            <div style={{
              padding:"12px 13px",
              borderRadius:14,
              border:"1px solid rgba(34,197,94,.28)",
              background:"rgba(20,83,45,.10)"
            }}>
              <div style={{fontSize:10,fontWeight:950,color:"#94a3b8",letterSpacing:.5}}>REGIME GIORNATA</div>
              <div style={{
                marginTop:5,
                fontSize:20,
                fontWeight:1000,
                color:data?.session?.regime==="BULLISH"?"#5eead4":data?.session?.regime==="BEARISH"?"#fca5a5":"#fde68a"
              }}>
                {data?.session?.regime==="BULLISH"?"🟢 RIALZISTA":data?.session?.regime==="BEARISH"?"🔴 RIBASSISTA":"🟡 NEUTRALE"}
              </div>
              <div style={{fontSize:11,color:"#cbd5e1",marginTop:6}}>
                Open {fmt(data?.session?.open,priceDecimals(symbol))} → {fmt(data?.session?.current,priceDecimals(symbol))}
                {" • "}
                <b style={{color:Number(data?.session?.move)>=0?"#5eead4":"#fca5a5"}}>
                  {Number(data?.session?.move)>=0?"+":""}{fmt(data?.session?.move,2)}
                </b>
              </div>
              <div style={{fontSize:10,color:"#64748b",marginTop:4}}>
                Struttura: {data?.session?.structure || "—"} • posizione range {fmt((Number(data?.session?.positionInRange)||0)*100,0)}%
              </div>
            </div>

            <div style={{
              padding:"12px 13px",
              borderRadius:14,
              border:"1px solid rgba(56,189,248,.28)",
              background:"rgba(14,116,144,.08)"
            }}>
              <div style={{fontSize:10,fontWeight:950,color:"#94a3b8",letterSpacing:.5}}>ROLLING MOMENTUM</div>
              <div style={{display:"grid",gridTemplateColumns:"repeat(2,1fr)",gap:6,marginTop:7}}>
                {[["1H",data?.rolling?.h1],["3H",data?.rolling?.h3],["6H",data?.rolling?.h6],["12H",data?.rolling?.h12]].map(([lab,x])=>(
                  <div key={lab} style={{fontSize:11,color:"#cbd5e1"}}>
                    <b>{lab}</b>{" "}
                    <span style={{color:Number(x?.dollars)>=0?"#5eead4":"#fca5a5",fontWeight:900}}>
                      {Number(x?.dollars)>=0?"+":""}{fmt(Number(x?.dollars)||0,1)}
                    </span>
                  </div>
                ))}
              </div>
            </div>

            <div style={{
              padding:"12px 13px",
              borderRadius:14,
              border:"1px solid rgba(168,85,247,.28)",
              background:"rgba(88,28,135,.08)"
            }}>
              <div style={{fontSize:10,fontWeight:950,color:"#94a3b8",letterSpacing:.5}}>TIPO DI MOVIMENTO</div>
              <div style={{fontSize:18,fontWeight:1000,color:"#e9d5ff",marginTop:6}}>
                {data?.combined?.forecastCondition==="CONTINUATION"?"CONTINUAZIONE":
                 data?.combined?.forecastCondition==="REVERSAL"?"INVERSIONE":
                 data?.combined?.forecastCondition==="PULLBACK_OR_TRANSITION"?"PULLBACK / TRANSIZIONE":"MISTO"}
              </div>
              <div style={{fontSize:10,color:"#94a3b8",marginTop:5}}>
                Accordo famiglie: {data?.combined?.agreement?.agreeCount ?? 0}/4 • conflitti {data?.combined?.agreement?.conflictCount ?? 0}
              </div>
            </div>

            <div style={{
              padding:"12px 13px",
              borderRadius:14,
              border:"1px solid rgba(245,158,11,.28)",
              background:"rgba(120,53,15,.08)"
            }}>
              <div style={{fontSize:10,fontWeight:950,color:"#94a3b8",letterSpacing:.5}}>MACRO / NEWS</div>
              <div style={{fontSize:18,fontWeight:1000,color:"#fde68a",marginTop:6}}>
                NON COLLEGATA
              </div>
              <div style={{fontSize:10,color:"#94a3b8",marginTop:5}}>
                Per ora il forecast usa solo dati di mercato. La macro non modifica lo score.
              </div>
            </div>
          </div>

          <div style={{
            marginBottom:12,
            padding:"11px 12px",
            borderRadius:14,
            border:"1px solid rgba(71,85,105,.50)",
            background:"rgba(2,6,23,.38)"
          }}>
            <div style={{fontSize:10,fontWeight:950,color:"#94a3b8",letterSpacing:.5,marginBottom:8}}>
              BLOCCHI DELLA GIORNATA — 3 ORE
            </div>
            <div style={{display:"flex",gap:7,flexWrap:"wrap"}}>
              {(data?.blocks3h || []).map((b,i)=>(
                <div key={b.key || i} style={{
                  padding:"7px 9px",
                  borderRadius:10,
                  minWidth:88,
                  border:Number(b.move)>0?"1px solid rgba(45,212,191,.30)":Number(b.move)<0?"1px solid rgba(248,113,113,.30)":"1px solid rgba(148,163,184,.25)",
                  background:Number(b.move)>0?"rgba(13,148,136,.08)":Number(b.move)<0?"rgba(153,27,27,.08)":"rgba(30,41,59,.22)"
                }}>
                  <div style={{fontSize:9,color:"#94a3b8",fontWeight:900}}>{b.label}</div>
                  <div style={{
                    fontSize:13,
                    fontWeight:1000,
                    color:Number(b.move)>0?"#5eead4":Number(b.move)<0?"#fca5a5":"#cbd5e1",
                    marginTop:2
                  }}>
                    {Number(b.move)>=0?"+":""}{fmt(Number(b.move)||0,1)}
                  </div>
                </div>
              ))}
            </div>
          </div>

          {(data?.combined?.reasons || []).length > 0 && (
            <div style={{
              marginBottom:12,
              padding:"10px 12px",
              borderRadius:14,
              border:"1px solid rgba(56,189,248,.22)",
              background:"rgba(14,116,144,.05)",
              color:"#cbd5e1",
              fontSize:11,
              lineHeight:1.5
            }}>
              {(data.combined.reasons || []).slice(0,4).map((r,i)=><div key={i}>• {r}</div>)}
            </div>
          )}

          <div style={{
            marginBottom:14,
            padding:"12px",
            borderRadius:16,
            border:"1px solid rgba(56,189,248,.26)",
            background:"rgba(2,6,23,.55)",
            minHeight:"825px",
            overflow:"visible"
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

        </>
      )}

      <div style={{
        marginTop:12,
        padding:"9px 11px",
        borderRadius:12,
        border:"1px solid rgba(71,85,105,.45)",
        background:"rgba(2,6,23,.32)",
        color:"#64748b",
        fontSize:10
      }}>
        V2 operativo in osservazione: il forecast privilegia prezzo, regime della giornata e momentum 0–3H. Gli indicatori restano solo conferme.
      </div>

    </div>
  );
}
