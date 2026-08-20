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

export default function MarketEnginePanel({ defaultAsset = "XAUUSD", challenges = [], onApplyDirection = null, onSignalUpdate = null, labOnly = false }) {
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

  // Market Engine Lab — storico e validazione segnali
  const [labOpen, setLabOpen] = useState(false);
  const [labRows, setLabRows] = useState([]);
  const [labLoading, setLabLoading] = useState(false);
  const [labError, setLabError] = useState("");
  const [labLimit, setLabLimit] = useState(25);
  const [labStatsData, setLabStatsData] = useState(null);
  const [labStatsLoading, setLabStatsLoading] = useState(false);
  const [labStatsError, setLabStatsError] = useState("");

  // Prop/Broker Path Analysis — lettura separata, non modifica il Market Engine
  const [pathHours, setPathHours] = useState(1);
  const [pathPropTarget, setPathPropTarget] = useState(40);
  const [pathData, setPathData] = useState(null);
  const [pathLoading, setPathLoading] = useState(false);
  const [pathError, setPathError] = useState("");

  // First Touch Simulator — simula TP/SL reali della Prop sui percorsi M15 salvati
  const [ftHours, setFtHours] = useState(1);
  const [ftTpPoints, setFtTpPoints] = useState(1000);
  const [ftSlPoints, setFtSlPoints] = useState(1000);
  const [ftData, setFtData] = useState(null);
  const [ftLoading, setFtLoading] = useState(false);
  const [ftError, setFtError] = useState("");
  const [detailsOpen, setDetailsOpen] = useState(false);

  // Operational Decision Engine — traduce target monetario + lotti in un piano operativo
  const [opTargetUsd, setOpTargetUsd] = useState(5000);
  const [opLots, setOpLots] = useState(1);
  const [opSlPoints, setOpSlPoints] = useState(1000);
  const [opData, setOpData] = useState({});
  const [opLoading, setOpLoading] = useState(false);
  const [opError, setOpError] = useState("");

  // Rileva schermi stretti (mobile) per passare le griglie a colonne fisse a 1 colonna impilata
  const [isNarrow, setIsNarrow] = useState(false);
  useEffect(() => {
    const check = () => setIsNarrow(window.innerWidth < 640);
    check();
    window.addEventListener("resize", check);
    return () => window.removeEventListener("resize", check);
  }, []);

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
    // Cambio asset: cancella subito il vecchio segnale.
    // In modalità labOnly NON richiamiamo market-analysis: il Lab legge solo lo storico.
    activeSymbolRef.current = symbol;
    lastRequestAtRef.current = 0;
    setData(null);
    setError("");
    setUsingFallback(false);

    if (labOnly) return;

    analyze(false, symbol);

    const id = setInterval(() => analyze(false, symbol), 120000);
    return () => clearInterval(id);
  }, [symbol, labOnly]);

  useEffect(() => {
    if (!targetChallengeId && challenges.length) {
      setTargetChallengeId(challenges[0].id);
    } else if (targetChallengeId && !challenges.some(c => c.id === targetChallengeId)) {
      setTargetChallengeId(challenges[0]?.id || "");
    }
  }, [challenges, targetChallengeId]);

  const loadLab = async (requestedSymbol = symbol, requestedLimit = labLimit) => {
    setLabLoading(true);
    setLabStatsLoading(true);
    setLabError("");
    setLabStatsError("");

    try {
      const limitValue = requestedLimit === "ALL" ? "ALL" : Number(requestedLimit || 25);
      const r = await fetch(
        `/api/market-signal-stats?symbol=${encodeURIComponent(requestedSymbol)}&include_rows=1&limit=${encodeURIComponent(limitValue)}`,
        { cache:"no-store" }
      );
      const j = await r.json();
      if (!r.ok || !j?.ok) throw new Error(j?.error || "Market Engine Lab non disponibile");

      setLabStatsData(j);
      setLabRows(Array.isArray(j?.rows) ? j.rows : []);
    } catch (e) {
      const message = e?.message || "Errore Market Engine Lab";
      setLabError(message);
      setLabStatsError(message);
    } finally {
      setLabLoading(false);
      setLabStatsLoading(false);
    }
  };

  useEffect(() => {
    loadLab(symbol, labLimit);

    // Un'unica lettura leggera al minuto:
    // - poche righe aggregate dalla view Supabase
    // - solo le righe della tabella richieste dall'utente
    const id = setInterval(() => loadLab(symbol, labLimit), 60_000);

    return () => clearInterval(id);
  }, [symbol, labLimit]);


  const loadPathAnalysis = async (requestedSymbol = symbol, requestedHours = pathHours) => {
    setPathLoading(true);
    setPathError("");

    try {
      const r = await fetch(
        `/api/market-signal-path-stats?symbol=${encodeURIComponent(requestedSymbol)}&hours=${encodeURIComponent(requestedHours)}`,
        { cache:"no-store" }
      );
      const j = await r.json();
      if (!r.ok || !j?.ok) throw new Error(j?.error || "Prop/Broker Path Analysis non disponibile");
      setPathData(j);
    } catch (e) {
      setPathData(null);
      setPathError(e?.message || "Errore Prop/Broker Path Analysis");
    } finally {
      setPathLoading(false);
    }
  };

  useEffect(() => {
    loadPathAnalysis(symbol, pathHours);
    const id = setInterval(() => loadPathAnalysis(symbol, pathHours), 60_000);
    return () => clearInterval(id);
  }, [symbol, pathHours]);

  const loadFirstTouch = async (
    requestedSymbol = symbol,
    requestedHours = ftHours,
    requestedTp = ftTpPoints,
    requestedSl = ftSlPoints
  ) => {
    setFtLoading(true);
    setFtError("");

    try {
      const tp = Math.max(1, Number(requestedTp) || 1000);
      const sl = Math.max(1, Number(requestedSl) || 1000);
      const r = await fetch(
        `/api/market-signal-first-touch?symbol=${encodeURIComponent(requestedSymbol)}&hours=${encodeURIComponent(requestedHours)}&tp=${encodeURIComponent(tp)}&sl=${encodeURIComponent(sl)}&pointSize=0.01`,
        { cache:"no-store" }
      );
      const j = await r.json();
      if (!r.ok || !j?.ok) throw new Error(j?.error || "First Touch Simulator non disponibile");
      setFtData(j);
    } catch (e) {
      setFtData(null);
      setFtError(e?.message || "Errore First Touch Simulator");
    } finally {
      setFtLoading(false);
    }
  };

  useEffect(() => {
    loadFirstTouch(symbol, 1, 1000, 1000);
  }, [symbol]);

  const operationalTarget = useMemo(() => {
    const targetUsd = Math.max(0, Number(opTargetUsd) || 0);
    const lots = Math.max(0, Number(opLots) || 0);
    if (!targetUsd || !lots) return null;

    // XAUUSD: contract size 100 oz; P/L = movimento prezzo × 100 × lotti.
    // 1 punto MT5 = 0,01 di prezzo. Quindi, su oro, targetPoints = targetUsd / lots.
    const priceDistance = targetUsd / (100 * lots);
    const targetPoints = Math.round(priceDistance / 0.01);
    return { targetUsd, lots, priceDistance, targetPoints };
  }, [opTargetUsd, opLots]);

  const loadOperationalPlan = async () => {
    if (symbol !== "XAUUSD") {
      setOpData({});
      setOpError("Operational Decision Engine v1 è calibrato per XAUUSD.");
      return;
    }
    if (!operationalTarget) {
      setOpData({});
      setOpError("Inserisci guadagno Prop e lotti maggiori di zero.");
      return;
    }

    setOpLoading(true);
    setOpError("");
    try {
      const sl = Math.max(1, Number(opSlPoints) || 1000);
      // Checkpoint operativi: prime 3 ore + prosecuzione a blocchi di 3 ore fino a 24H.
      const operationalHours = [1,2,3,6,9,12,15,18,21,24];
      const calls = operationalHours.map(async h => {
        const r = await fetch(`/api/market-signal-first-touch?symbol=XAUUSD&hours=${h}&tp=${operationalTarget.targetPoints}&sl=${sl}&pointSize=0.01`, { cache:"no-store" });
        const j = await r.json();
        if (!r.ok || !j?.ok) throw new Error(j?.error || `First Touch ${h}H non disponibile`);
        return [h, j];
      });
      const entries = await Promise.all(calls);
      setOpData(Object.fromEntries(entries));
    } catch (e) {
      setOpData({});
      setOpError(e?.message || "Errore Operational Decision Engine");
    } finally {
      setOpLoading(false);
    }
  };

  useEffect(() => {
    if (labOnly || symbol !== "XAUUSD" || !operationalTarget) return;
    const id = window.setTimeout(() => loadOperationalPlan(), 450);
    return () => window.clearTimeout(id);
  }, [labOnly, symbol, operationalTarget?.targetPoints, opSlPoints]);

  const fallbackLabStats = useMemo(() => {
    const directional = labRows.filter(r => ["BUY","SELL"].includes(String(r?.forecast_direction || "").toUpperCase()));
    const completed = directional.filter(r => r?.direction_correct_3h === true || r?.direction_correct_3h === false);
    const pct = (field) => {
      const x = directional.filter(r => r?.[field] === true || r?.[field] === false);
      if (!x.length) return null;
      return 100 * x.filter(r => r?.[field] === true).length / x.length;
    };
    return {
      total:labRows.length,
      pending:labRows.filter(r => r?.evaluation_status !== "COMPLETED").length,
      completed:completed.length,
      wr1:pct("direction_correct_1h"),
      wr2:pct("direction_correct_2h"),
      wr3:pct("direction_correct_3h")
    };
  }, [labRows]);

  const globalSummary = labStatsData?.summary || null;
  const labStats = globalSummary ? {
    total: globalSummary.total ?? 0,
    pending: (globalSummary.pending ?? 0) + (globalSummary.partial ?? 0),
    completed: globalSummary.completed ?? 0,
    wr1: globalSummary.winRate1h,
    wr2: globalSummary.winRate2h,
    wr3: globalSummary.winRate3h
  } : fallbackLabStats;

  const resultBadge = (row, h) => {
    const v = row?.[`direction_correct_${h}h`];
    const evaluated = row?.[`evaluated_${h}h_at`];
    if (!evaluated) return { label:"⏳", color:"#94a3b8" };
    if (v === true) return { label:"✅ WIN", color:"#4ade80" };
    if (v === false) return { label:"❌ LOSS", color:"#fb7185" };
    return { label:"—", color:"#94a3b8" };
  };

  const confidenceBands = Array.isArray(labStatsData?.confidenceBands)
    ? labStatsData.confidenceBands
    : [];

  const buyStats = labStatsData?.byDirection?.BUY || null;
  const sellStats = labStatsData?.byDirection?.SELL || null;
  const waitStats = labStatsData?.byDirection?.WAIT || null;

  const pathSummary = pathData?.summary || null;
  const pathPropLevels = Array.isArray(pathData?.propLevels) ? pathData.propLevels : [];
  const pathSequence = Array.isArray(pathData?.sequenceByLevel) ? pathData.sequenceByLevel : [];
  const pathRecoveryRows = Array.isArray(pathData?.recoveryByPropTarget) ? pathData.recoveryByPropTarget : [];
  const selectedRecovery = pathRecoveryRows.find(x => Number(x?.propTarget) === Number(pathPropTarget)) || null;

  const ftSummary = ftData?.summary || null;
  const ftConfig = ftData?.configuration || null;

  const renderFirstTouchBucket = (title, bucket, accent, subtitle = "") => {
    if (!bucket) return null;

    return (
      <div style={{padding:"10px 11px",borderRadius:12,border:`1px solid ${accent}55`,background:"rgba(2,6,23,.32)"}}>
        <div style={{fontSize:10,fontWeight:1000,color:accent}}>{title}</div>
        {subtitle && <div style={{fontSize:8.5,color:"#64748b",marginTop:2}}>{subtitle}</div>}
        <div style={{fontSize:9,color:"#94a3b8",marginTop:4}}>Campione: <b style={{color:"#e2e8f0"}}>{bucket.signals ?? 0}</b></div>
        <div style={{display:"grid",gridTemplateColumns:"repeat(2,minmax(0,1fr))",gap:6,marginTop:7}}>
          {[
            ["✅ TP PROP",bucket.tp,bucket.tpPct,"#4ade80"],
            ["❌ SL PROP",bucket.sl,bucket.slPct,"#fb7185"],
            ["⏳ NESSUNO",bucket.none,bucket.nonePct,"#fde68a"],
            ["⚠️ AMBIGUO",bucket.ambiguous,bucket.ambiguousPct,"#c4b5fd"]
          ].map(([lab,count,pctVal,color])=>(
            <div key={lab} style={{padding:"7px 8px",borderRadius:9,border:"1px solid rgba(71,85,105,.30)",background:"rgba(15,23,42,.38)"}}>
              <div style={{fontSize:8.5,fontWeight:950,color:"#94a3b8"}}>{lab}</div>
              <div style={{fontSize:15,fontWeight:1000,color,marginTop:2}}>{pctVal==null?"—":`${fmt(pctVal,1)}%`}</div>
              <div style={{fontSize:8,color:"#64748b"}}>{count ?? 0}/{bucket.signals ?? 0}</div>
            </div>
          ))}
        </div>
      </div>
    );
  };

  const renderLabPanel = () => (
    <div style={{
      marginTop:14,
      border:"1px solid rgba(168,85,247,.32)",
      borderRadius:16,
      background:"rgba(2,6,23,.42)",
      overflow:"hidden"
    }}>
      <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",gap:10,flexWrap:"wrap",padding:"13px 14px",borderBottom:labOpen?"1px solid rgba(71,85,105,.38)":"none"}}>
        <div>
          <div style={{fontSize:15,fontWeight:1000,color:"#f3e8ff"}}>🧪 MARKET ENGINE LAB — Validazione segnali</div>
          <div style={{fontSize:10,color:"#94a3b8",marginTop:3}}>
            Statistiche globali sull'intero storico. La tabella sotto mostra solo la finestra selezionata.
          </div>
          {labStatsData?.engineVersion && (
            <div style={{fontSize:9,color:"#64748b",marginTop:3}}>
              Baseline statistica: {labStatsData.engineVersion}
            </div>
          )}
        </div>

        <div style={{display:"flex",gap:8,flexWrap:"wrap",alignItems:"center"}}>
          <select
            value={String(labLimit)}
            onChange={e=>setLabLimit(e.target.value === "ALL" ? "ALL" : Number(e.target.value))}
            style={{...input,marginBottom:0,padding:"8px 10px",minWidth:135}}
            title="Numero di righe mostrate nella tabella"
          >
            <option value="25">Ultimi 25</option>
            <option value="100">Ultimi 100</option>
            <option value="500">Ultimi 500</option>
            <option value="ALL">Tutti (max 5000)</option>
          </select>

          <button
            style={secondaryButton}
            onClick={()=>loadLab(symbol, labLimit)}
            disabled={labLoading || labStatsLoading}
          >
            {(labLoading || labStatsLoading) ? "Aggiorno…" : "↻ Aggiorna Lab"}
          </button>

          <button style={secondaryButton} onClick={()=>setLabOpen(v=>!v)}>
            {labOpen?"Nascondi":"Mostra"}
          </button>
        </div>
      </div>

      {labOpen && (
        <div style={{padding:14}}>
          <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(120px,1fr))",gap:8,marginBottom:10}}>
            {[
              ["SEGNALI STORICI",labStats.total,"#e2e8f0"],
              ["IN VALUTAZIONE",labStats.pending,"#fde68a"],
              ["COMPLETATI",labStats.completed,"#c4b5fd"],
              ["WIN RATE 1H",labStats.wr1==null?"—":`${fmt(labStats.wr1,1)}%`,"#5eead4"],
              ["WIN RATE 2H",labStats.wr2==null?"—":`${fmt(labStats.wr2,1)}%`,"#5eead4"],
              ["WIN RATE 3H",labStats.wr3==null?"—":`${fmt(labStats.wr3,1)}%`,"#4ade80"]
            ].map(([lab,val,color])=>(
              <div key={lab} style={{padding:"10px 11px",borderRadius:12,border:"1px solid rgba(71,85,105,.42)",background:"rgba(15,23,42,.55)"}}>
                <div style={{fontSize:9,fontWeight:900,color:"#64748b"}}>{lab}</div>
                <div style={{fontSize:20,fontWeight:1000,color,marginTop:3}}>{val}</div>
              </div>
            ))}
          </div>

          {globalSummary && (
            <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(135px,1fr))",gap:8,marginBottom:12}}>
              {[
                ["🟢 BUY",globalSummary.buy ?? 0,buyStats?.winRate3h,"#5eead4"],
                ["🔴 SELL",globalSummary.sell ?? 0,sellStats?.winRate3h,"#fb7185"],
                ["🟡 WAIT",globalSummary.wait ?? 0,null,"#fde68a"],
                ["MFE MEDIO 3H",globalSummary.avgMfeAtr3h == null ? "—" : `${fmt(globalSummary.avgMfeAtr3h,2)} ATR`,null,"#4ade80"],
                ["MAE MEDIO 3H",globalSummary.avgMaeAtr3h == null ? "—" : `${fmt(globalSummary.avgMaeAtr3h,2)} ATR`,null,"#fb7185"]
              ].map(([lab,val,wr,color])=>(
                <div key={lab} style={{padding:"9px 10px",borderRadius:11,border:"1px solid rgba(71,85,105,.34)",background:"rgba(15,23,42,.38)"}}>
                  <div style={{fontSize:9,fontWeight:900,color:"#64748b"}}>{lab}</div>
                  <div style={{fontSize:17,fontWeight:1000,color,marginTop:3}}>{val}</div>
                  {wr != null && <div style={{fontSize:9,color:"#94a3b8",marginTop:2}}>WR 3H {fmt(wr,1)}%</div>}
                </div>
              ))}
            </div>
          )}

          {confidenceBands.length > 0 && (
            <div style={{marginBottom:12,padding:"10px 11px",borderRadius:12,border:"1px solid rgba(56,189,248,.20)",background:"rgba(14,116,144,.05)"}}>
              <div style={{fontSize:10,fontWeight:950,color:"#93c5fd",marginBottom:8}}>AFFIDABILITÀ PER FASCIA DI CONFIDENCE — SOLO BUY/SELL</div>
              <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(135px,1fr))",gap:7}}>
                {confidenceBands.map(b=>(
                  <div key={b.band} style={{padding:"8px 9px",borderRadius:10,border:"1px solid rgba(71,85,105,.34)",background:"rgba(2,6,23,.34)"}}>
                    <div style={{fontSize:11,fontWeight:1000,color:"#e2e8f0"}}>CONF. {b.band}</div>
                    <div style={{fontSize:9,color:"#64748b",marginTop:2}}>Segnali {b.total}</div>
                    <div style={{fontSize:11,color:"#cbd5e1",marginTop:5}}>
                      1H <b style={{color:"#5eead4"}}>{b.winRate1h==null?"—":`${fmt(b.winRate1h,1)}%`}</b>
                      {" • "}2H <b style={{color:"#5eead4"}}>{b.winRate2h==null?"—":`${fmt(b.winRate2h,1)}%`}</b>
                    </div>
                    <div style={{fontSize:12,color:"#cbd5e1",marginTop:3}}>
                      3H <b style={{color:"#4ade80"}}>{b.winRate3h==null?"—":`${fmt(b.winRate3h,1)}%`}</b>
                      <span style={{fontSize:9,color:"#64748b"}}> ({b.evaluated3h || 0} valutati)</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          <div style={{
            marginBottom:12,
            padding:"11px 12px",
            borderRadius:13,
            border:"1px solid rgba(168,85,247,.28)",
            background:"linear-gradient(135deg,rgba(88,28,135,.08),rgba(2,6,23,.46))"
          }}>
            <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",gap:10,flexWrap:"wrap",marginBottom:9}}>
              <div>
                <div style={{fontSize:11,fontWeight:1000,color:"#e9d5ff"}}>
                  🧭 PROP / BROKER PATH ANALYSIS — SOLO LOSS DEL FORECAST
                </div>
                <div style={{fontSize:9,color:"#94a3b8",marginTop:3}}>
                  Misura cosa sarebbe successo alla strategia hedge quando il forecast chiude in LOSS. La direzione Prop è opposta al forecast.
                </div>
              </div>
              <div style={{display:"flex",gap:7,flexWrap:"wrap"}}>
                {[1,2,3].map(h=>(
                  <button
                    key={h}
                    onClick={()=>setPathHours(h)}
                    style={{
                      ...secondaryButton,
                      padding:"7px 11px",
                      opacity:pathHours===h?1:.65,
                      border:pathHours===h?"1px solid rgba(196,181,253,.65)":"1px solid rgba(71,85,105,.45)",
                      background:pathHours===h?"rgba(109,40,217,.18)":"rgba(15,23,42,.45)",
                      color:pathHours===h?"#e9d5ff":"#94a3b8"
                    }}
                  >
                    {h}H
                  </button>
                ))}
                <button
                  style={{...secondaryButton,padding:"7px 11px"}}
                  onClick={()=>loadPathAnalysis(symbol,pathHours)}
                  disabled={pathLoading}
                >
                  {pathLoading?"Analizzo…":"↻ Path"}
                </button>
              </div>
            </div>

            {pathError && (
              <div style={{padding:"9px 10px",marginBottom:9,borderRadius:10,border:"1px solid rgba(248,113,113,.35)",background:"rgba(127,29,29,.12)",color:"#fecaca",fontSize:10}}>
                ❌ {pathError}
              </div>
            )}

            {pathSummary && (
              <>
                <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(135px,1fr))",gap:7,marginBottom:9}}>
                  {[
                    ["LOSS ANALIZZATI",pathSummary.losses ?? 0,"#fb7185"],
                    ["Δ PROP MEDIO",pathSummary.avgPropDelta==null?"—":`+$${fmt(pathSummary.avgPropDelta,2)}`,"#fde68a"],
                    ["Δ PROP MAX",pathSummary.maxPropDelta==null?"—":`+$${fmt(pathSummary.maxPropDelta,2)}`,"#fbbf24"],
                    ["Δ BROKER MEDIO",pathSummary.avgBrokerDelta==null?"—":`+$${fmt(pathSummary.avgBrokerDelta,2)}`,"#5eead4"],
                    ["Δ BROKER MAX",pathSummary.maxBrokerDelta==null?"—":`+$${fmt(pathSummary.maxBrokerDelta,2)}`,"#2dd4bf"]
                  ].map(([lab,val,color])=>(
                    <div key={lab} style={{padding:"9px 10px",borderRadius:10,border:"1px solid rgba(71,85,105,.34)",background:"rgba(15,23,42,.40)"}}>
                      <div style={{fontSize:8.5,fontWeight:950,color:"#64748b"}}>{lab} — {pathHours}H</div>
                      <div style={{fontSize:17,fontWeight:1000,color,marginTop:3}}>{val}</div>
                    </div>
                  ))}
                </div>

                <div style={{marginBottom:9,padding:"9px 10px",borderRadius:11,border:"1px solid rgba(251,191,36,.18)",background:"rgba(120,53,15,.06)"}}>
                  <div style={{fontSize:10,fontWeight:950,color:"#fde68a",marginBottom:7}}>
                    QUANTI LOSS AVREBBERO RAGGIUNTO UN TP PROP?
                  </div>
                  <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(105px,1fr))",gap:6}}>
                    {pathPropLevels.map(x=>(
                      <div key={x.level} style={{padding:"7px 8px",borderRadius:9,border:"1px solid rgba(71,85,105,.30)",background:"rgba(2,6,23,.30)"}}>
                        <div style={{fontSize:10,fontWeight:1000,color:"#f8fafc"}}>PROP +${x.level}</div>
                        <div style={{fontSize:16,fontWeight:1000,color:"#fbbf24",marginTop:2}}>
                          {x.pct==null?"—":`${fmt(x.pct,1)}%`}
                        </div>
                        <div style={{fontSize:8.5,color:"#64748b"}}>{x.hitCount || 0}/{pathSummary.losses || 0} loss</div>
                      </div>
                    ))}
                  </div>
                </div>

                <div style={{display:"grid",gridTemplateColumns:isNarrow?"1fr":"minmax(190px,.7fr) minmax(320px,1.6fr)",gap:8,marginBottom:9}}>
                  <div style={{padding:"9px 10px",borderRadius:11,border:"1px solid rgba(56,189,248,.18)",background:"rgba(14,116,144,.05)"}}>
                    <div style={{fontSize:9,fontWeight:950,color:"#93c5fd",marginBottom:6}}>SE IL TP PROP NON ARRIVA</div>
                    <label style={{fontSize:9,color:"#94a3b8",display:"block",marginBottom:4}}>TP Prop ipotetico</label>
                    <select
                      value={String(pathPropTarget)}
                      onChange={e=>setPathPropTarget(Number(e.target.value))}
                      style={{...input,marginBottom:0,padding:"7px 9px"}}
                    >
                      {[20,30,40,50,60,70].map(v=><option key={v} value={v}>+${v}</option>)}
                    </select>
                    <div style={{fontSize:11,color:"#cbd5e1",marginTop:7}}>
                      Operazioni ancora aperte:{" "}
                      <b style={{color:"#fde68a"}}>{selectedRecovery?.remainingCount ?? 0}</b>
                      <span style={{fontSize:9,color:"#64748b"}}> loss</span>
                    </div>
                  </div>

                  <div style={{padding:"9px 10px",borderRadius:11,border:"1px solid rgba(45,212,191,.18)",background:"rgba(13,148,136,.05)"}}>
                    <div style={{fontSize:9,fontWeight:950,color:"#5eead4",marginBottom:6}}>
                      TRA QUESTE, QUANTE HANNO POI DATO ESCURSIONE AL BROKER?
                    </div>
                    <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(90px,1fr))",gap:6}}>
                      {(selectedRecovery?.brokerLevels || []).map(x=>(
                        <div key={x.level} style={{padding:"7px 8px",borderRadius:9,border:"1px solid rgba(71,85,105,.30)",background:"rgba(2,6,23,.28)"}}>
                          <div style={{fontSize:9.5,fontWeight:950,color:"#e2e8f0"}}>BROKER +${x.level}</div>
                          <div style={{fontSize:15,fontWeight:1000,color:"#5eead4",marginTop:2}}>
                            {x.pct==null?"—":`${fmt(x.pct,1)}%`}
                          </div>
                          <div style={{fontSize:8,color:"#64748b"}}>{x.hitCount || 0}/{selectedRecovery?.remainingCount || 0}</div>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>

                {pathSequence.length > 0 && (
                  <div style={{padding:"9px 10px",borderRadius:11,border:"1px solid rgba(71,85,105,.32)",background:"rgba(2,6,23,.28)"}}>
                    <div style={{fontSize:9,fontWeight:950,color:"#c4b5fd",marginBottom:6}}>
                      ORDINE DEI MOVIMENTI QUANDO ENTRAMBI I LATI TOCCANO LO STESSO LIVELLO
                    </div>
                    <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(125px,1fr))",gap:6}}>
                      {pathSequence.map(x=>(
                        <div key={x.level} style={{padding:"7px 8px",borderRadius:9,border:"1px solid rgba(71,85,105,.28)"}}>
                          <div style={{fontSize:9.5,fontWeight:1000,color:"#e2e8f0"}}>${x.level}</div>
                          <div style={{fontSize:8.5,color:"#fde68a",marginTop:3}}>Prop prima {x.propFirst || 0}</div>
                          <div style={{fontSize:8.5,color:"#5eead4"}}>Broker prima {x.brokerFirst || 0}</div>
                          <div style={{fontSize:8.5,color:"#94a3b8"}}>Stessa M15 {x.ambiguous || 0}</div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                <div style={{fontSize:8.5,color:"#64748b",marginTop:7,lineHeight:1.45}}>
                  “LOSS” resta il giudizio statistico sul forecast. Qui misuriamo separatamente se quel LOSS avrebbe favorito la Prop,
                  se avrebbe lasciato l'operazione aperta e quale escursione avrebbe poi offerto il Broker. I tocchi nella stessa M15
                  sono marcati come ambigui: con OHLC M15 non possiamo conoscere l'ordine intrabar.
                </div>
              </>
            )}
          </div>

          <div style={{
            marginBottom:12,
            padding:"11px 12px",
            borderRadius:13,
            border:"1px solid rgba(34,197,94,.28)",
            background:"linear-gradient(135deg,rgba(20,83,45,.07),rgba(2,6,23,.48))"
          }}>
            <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",gap:10,flexWrap:"wrap",marginBottom:10}}>
              <div>
                <div style={{fontSize:11,fontWeight:1000,color:"#bbf7d0"}}>
                  🎯 FIRST TOUCH SIMULATOR — TP / SL PROP
                </div>
                <div style={{fontSize:9,color:"#94a3b8",marginTop:3,lineHeight:1.45}}>
                  Ricostruisce il percorso M15 di TUTTI i forecast BUY/SELL e stabilisce quale livello della Prop viene toccato per primo.
                  Forecast BUY = Prop SELL; Forecast SELL = Prop BUY.
                </div>
              </div>
              <div style={{display:"flex",gap:6,flexWrap:"wrap"}}>
                {[1,2,3].map(h=>(
                  <button
                    key={h}
                    onClick={()=>setFtHours(h)}
                    style={{
                      ...secondaryButton,
                      padding:"7px 11px",
                      opacity:ftHours===h?1:.65,
                      border:ftHours===h?"1px solid rgba(74,222,128,.58)":"1px solid rgba(71,85,105,.45)",
                      background:ftHours===h?"rgba(22,101,52,.18)":"rgba(15,23,42,.45)",
                      color:ftHours===h?"#bbf7d0":"#94a3b8"
                    }}
                  >
                    {h}H
                  </button>
                ))}
              </div>
            </div>

            <div style={{display:"grid",gridTemplateColumns:isNarrow?"1fr":"repeat(3,minmax(150px,1fr)) auto",gap:8,alignItems:"end",marginBottom:10}}>
              <div>
                <label style={{fontSize:9,color:"#94a3b8",display:"block",marginBottom:4}}>TP Prop — punti MT5</label>
                <input
                  type="number"
                  min="1"
                  step="50"
                  value={ftTpPoints}
                  onChange={e=>setFtTpPoints(e.target.value)}
                  style={{...input,marginBottom:0,padding:"8px 9px"}}
                />
              </div>

              <div>
                <label style={{fontSize:9,color:"#94a3b8",display:"block",marginBottom:4}}>SL Prop — punti MT5</label>
                <input
                  type="number"
                  min="1"
                  step="50"
                  value={ftSlPoints}
                  onChange={e=>setFtSlPoints(e.target.value)}
                  style={{...input,marginBottom:0,padding:"8px 9px"}}
                />
              </div>

              <div>
                <label style={{fontSize:9,color:"#94a3b8",display:"block",marginBottom:4}}>Preset rapidi</label>
                <div style={{display:"flex",gap:5,flexWrap:"wrap"}}>
                  {[500,750,1000,1250,1500].map(v=>(
                    <button
                      key={v}
                      onClick={()=>{setFtTpPoints(v);setFtSlPoints(v);}}
                      style={{...secondaryButton,padding:"7px 8px",fontSize:9}}
                    >
                      {v}
                    </button>
                  ))}
                </div>
              </div>

              <button
                style={{...primaryButtonBlue,padding:"9px 13px",whiteSpace:"nowrap",opacity:ftLoading?.6:1}}
                disabled={ftLoading}
                onClick={()=>loadFirstTouch(symbol,ftHours,ftTpPoints,ftSlPoints)}
              >
                {ftLoading?"Simulo…":"▶ Simula"}
              </button>
            </div>

            <div style={{fontSize:8.5,color:"#64748b",marginBottom:9}}>
              Su XAUUSD il simulatore usa <b style={{color:"#cbd5e1"}}>1 punto = 0,01</b> di prezzo.
              {ftConfig && <> Configurazione calcolata: TP <b style={{color:"#4ade80"}}>{fmt(ftConfig.tpPriceDistance,2)}$</b> · SL <b style={{color:"#fb7185"}}>{fmt(ftConfig.slPriceDistance,2)}$</b> · {ftConfig.hours}H.</>}
            </div>

            {ftError && (
              <div style={{padding:"9px 10px",marginBottom:9,borderRadius:10,border:"1px solid rgba(248,113,113,.35)",background:"rgba(127,29,29,.12)",color:"#fecaca",fontSize:10}}>
                ❌ {ftError}
              </div>
            )}

            {ftSummary && (
              <>
                <div style={{display:"grid",gridTemplateColumns:isNarrow?"1fr":"repeat(3,minmax(190px,1fr))",gap:8}}>
                  {renderFirstTouchBucket("TUTTI I SEGNALI",ftSummary.total,"#93c5fd","Risultato operativo Prop indipendentemente dal WIN/LOSS del forecast")}
                  {renderFirstTouchBucket("FORECAST WIN",ftSummary.forecastWin,"#4ade80","Il motore aveva ragione all'orizzonte selezionato")}
                  {renderFirstTouchBucket("FORECAST LOSS",ftSummary.forecastLoss,"#fb7185","Il motore aveva torto all'orizzonte selezionato")}
                </div>

                <div style={{display:"flex",gap:10,flexWrap:"wrap",marginTop:9,fontSize:8.5,color:"#64748b"}}>
                  <span>Segnali con path: <b style={{color:"#cbd5e1"}}>{ftData?.sourceSignals ?? 0}</b></span>
                  <span>Analizzati: <b style={{color:"#cbd5e1"}}>{ftData?.analyzedSignals ?? 0}</b></span>
                  <span>Pending esclusi: <b style={{color:"#cbd5e1"}}>{ftData?.skipped?.pending ?? 0}</b></span>
                  <span>Path mancanti: <b style={{color:"#cbd5e1"}}>{ftData?.skipped?.noPath ?? 0}</b></span>
                </div>

                <div style={{fontSize:8.5,color:"#64748b",marginTop:7,lineHeight:1.45}}>
                  TP/SL vengono controllati candela per candela e la simulazione si ferma al primo evento. Se TP e SL sono entrambi attraversati nella stessa M15, il caso è AMBIGUO perché l'OHLC non permette di conoscere l'ordine intrabar.
                </div>
              </>
            )}
          </div>

          {labStatsError && (
            <div style={{padding:"10px 12px",marginBottom:10,borderRadius:12,border:"1px solid rgba(245,158,11,.35)",color:"#fde68a",background:"rgba(120,53,15,.12)"}}>
              ⚠️ Statistiche globali non disponibili: {labStatsError}. Mostro temporaneamente i calcoli sulla tabella caricata.
            </div>
          )}

          {labError && (
            <div style={{padding:"10px 12px",marginBottom:10,borderRadius:12,border:"1px solid rgba(248,113,113,.35)",color:"#fecaca",background:"rgba(127,29,29,.15)"}}>
              ❌ {labError}
            </div>
          )}

          <div style={{display:"flex",justifyContent:"space-between",gap:10,alignItems:"center",flexWrap:"wrap",marginBottom:7}}>
            <div style={{fontSize:10,color:"#94a3b8",fontWeight:900}}>
              STORICO VISIBILE — {labRows.length} righe
            </div>
            <div style={{fontSize:9,color:"#64748b"}}>
              Le statistiche sopra non dipendono dal numero di righe mostrate qui.
            </div>
          </div>

          <div style={{overflowX:"auto",WebkitOverflowScrolling:"touch",border:"1px solid rgba(71,85,105,.35)",borderRadius:12}}>
            <table style={{width:"100%",minWidth:980,borderCollapse:"collapse",fontSize:10}}>
              <thead>
                <tr style={{background:"rgba(15,23,42,.92)",color:"#94a3b8",textAlign:"left"}}>
                  {["CHIUSURA M15","FORECAST","CONF.","SCORE","ENTRY","1H","2H","3H","MFE 3H","MAE 3H","STATO"].map(h=><th key={h} style={{padding:"9px 8px",borderBottom:"1px solid rgba(71,85,105,.45)",whiteSpace:"nowrap"}}>{h}</th>)}
                </tr>
              </thead>
              <tbody>
                {labRows.map(row=>{
                  const dir=String(row?.forecast_direction||"WAIT").toUpperCase();
                  const b1=resultBadge(row,1), b2=resultBadge(row,2), b3=resultBadge(row,3);
                  return (
                    <tr key={row.id} style={{borderBottom:"1px solid rgba(51,65,85,.35)",color:"#cbd5e1"}}>
                      <td style={{padding:"8px",whiteSpace:"nowrap"}}>{row?.signal_m15_time ? new Date(new Date(row.signal_m15_time).getTime() + 15 * 60 * 1000).toLocaleString("it-IT",{timeZone:"Europe/Rome",day:"2-digit",month:"2-digit",hour:"2-digit",minute:"2-digit",hour12:false}) : "—"}</td>
                      <td style={{padding:"8px",fontWeight:1000,color:dir==="BUY"?"#5eead4":dir==="SELL"?"#fb7185":"#fde68a"}}>{dir}</td>
                      <td style={{padding:"8px"}}>{fmt(row?.confidence_raw,0)}</td>
                      <td style={{padding:"8px"}}>{fmt(row?.price_score,1)}</td>
                      <td style={{padding:"8px"}}>{fmt(row?.entry_price,priceDecimals(symbol))}</td>
                      <td style={{padding:"8px",fontWeight:900,color:b1.color,whiteSpace:"nowrap"}}>{b1.label}</td>
                      <td style={{padding:"8px",fontWeight:900,color:b2.color,whiteSpace:"nowrap"}}>{b2.label}</td>
                      <td style={{padding:"8px",fontWeight:900,color:b3.color,whiteSpace:"nowrap"}}>{b3.label}</td>
                      <td style={{padding:"8px",color:Number(row?.mfe_atr_3h)>=0?"#4ade80":"#cbd5e1"}}>{row?.mfe_atr_3h==null?"—":`${fmt(row.mfe_atr_3h,2)} ATR`}</td>
                      <td style={{padding:"8px",color:Number(row?.mae_atr_3h)<0?"#fb7185":"#cbd5e1"}}>{row?.mae_atr_3h==null?"—":`${fmt(row.mae_atr_3h,2)} ATR`}</td>
                      <td style={{padding:"8px",fontWeight:900,color:row?.evaluation_status==="COMPLETED"?"#4ade80":"#fde68a"}}>{row?.evaluation_status||"PENDING"}</td>
                    </tr>
                  );
                })}
                {!labLoading && labRows.length===0 && <tr><td colSpan={11} style={{padding:18,textAlign:"center",color:"#64748b"}}>Nessun segnale archiviato per {symbol}.</td></tr>}
              </tbody>
            </table>
          </div>

          <div style={{fontSize:9,color:"#64748b",marginTop:8}}>
            WAIT è escluso dalla win-rate BUY/SELL. Le statistiche globali arrivano dalla view aggregata Supabase; la tabella può restare corta senza perdere lo storico.
          </div>
        </div>
      )}
    </div>
  );

  // Con Trading OFF il parent può renderizzare soltanto il Lab.
  // Nessuna analisi live viene richiesta in questa modalità.
  if (labOnly) {
    return renderLabPanel();
  }

  const theme = biasTheme(data?.combined?.bias || "NEUTRAL");
  const propDirection = data?.combined?.propDirection || "WAIT";
  const signalStrength = data?.combined?.signalStrength || "INSUFFICIENT";

  useEffect(() => {
    if (typeof onSignalUpdate !== "function") return;

    const forecastDirection = String(data?.combined?.forecastDirection || "WAIT").toUpperCase();
    const nextPropDirection = String(propDirection || "WAIT").toUpperCase();

    onSignalUpdate({
      symbol,
      forecastDirection,
      propDirection: nextPropDirection,
      score: Number(data?.combined?.score),
      confidence: Number(data?.combined?.confidence),
      signalStrength,
      analyzedAt: data ? new Date().toISOString() : null
    });
  }, [
    onSignalUpdate,
    symbol,
    data?.combined?.forecastDirection,
    data?.combined?.score,
    data?.combined?.confidence,
    propDirection,
    signalStrength
  ]);

  const forecastDirection = data?.combined?.forecastDirection || "WAIT";
  const brokerDirection = forecastDirection;
  const operationalHours = [1,2,3,6,9,12,15,18,21,24];

  /*
    FIRST TOUCH -> OPERATIONAL SCORE v2

    La direzione continua a venire dal Market Engine.
    Il First Touch NON cambia BUY/SELL: misura quanto bene
    la strategia Prop opposta al forecast ha lavorato storicamente
    con il TP/SL realmente impostato.

    1H/2H/3H = cuore della decisione di ingresso.
    6H-24H   = coda del trade, usata automaticamente solo
               quando il checkpoint ha almeno 10 segnali maturi.
  */
  const opHorizons = operationalHours.map(h => {
    const bucket = opData?.[h]?.summary?.total || null;
    if (!bucket) {
      return {
        h,
        bucket:null,
        resolvedRate:null,
        propEdge:null,
        firstTouchScore:null,
        reliability:0
      };
    }

    const signals = Number(bucket.signals || 0);
    const tpPct = Number(bucket.tpPct);
    const nonePct = Number(bucket.nonePct);
    const ambiguousPct = Number(bucket.ambiguousPct);

    const resolved = Number(bucket.tp || 0) + Number(bucket.sl || 0);
    const propEdge = resolved > 0
      ? 100 * Number(bucket.tp || 0) / resolved
      : null;

    // TP = 100 punti di qualita', SL = 0.
    // APERTA e AMBIGUA valgono 50: non sono ancora vittoria o sconfitta.
    const firstTouchScore =
      [tpPct, nonePct, ambiguousPct].every(Number.isFinite)
        ? Math.max(0, Math.min(100, tpPct + nonePct * 0.50 + ambiguousPct * 0.50))
        : null;

    // Il peso cresce col campione: da 30 segnali in su il checkpoint e' a peso pieno.
    const reliability = Math.max(0, Math.min(1, signals / 30));

    return {
      h,
      bucket,
      resolvedRate: signals ? 100 * resolved / signals : null,
      propEdge,
      firstTouchScore,
      reliability
    };
  });

  const weightedAverage = (rows, weightFn) => {
    let weighted = 0;
    let totalWeight = 0;

    for (const x of rows) {
      if (!Number.isFinite(x.firstTouchScore)) continue;
      const w = Math.max(0, Number(weightFn(x)) || 0) * x.reliability;
      if (!w) continue;
      weighted += x.firstTouchScore * w;
      totalWeight += w;
    }

    return totalWeight > 0 ? weighted / totalWeight : null;
  };

  // Ingresso: privilegiamo 1H, poi 2H, poi 3H.
  const entryRows = opHorizons.filter(
    x => x.h <= 3 && Number(x.bucket?.signals || 0) > 0
  );

  const entryFirstTouchScore = weightedAverage(
    entryRows,
    x => x.h === 1 ? 1.40 : x.h === 2 ? 1.20 : 1.00
  );

  // Coda operativa: entra nel motore appena ci sono almeno 10 casi maturi.
  const tailRows = opHorizons.filter(
    x => x.h >= 6 && Number(x.bucket?.signals || 0) >= 10
  );

  const tailFirstTouchScore = weightedAverage(
    tailRows,
    x => ({
      6:0.85,
      9:0.75,
      12:0.65,
      15:0.55,
      18:0.50,
      21:0.45,
      24:0.40
    }[x.h] || 0)
  );

  // Le prime 3H restano dominanti. La coda puo' affinare,
  // non ribaltare da sola l'indicazione.
  const firstTouchIntegratedScore =
    entryFirstTouchScore == null
      ? tailFirstTouchScore
      : tailFirstTouchScore == null
        ? entryFirstTouchScore
        : entryFirstTouchScore * 0.75 + tailFirstTouchScore * 0.25;

  const forecastConfidence = Number(data?.combined?.confidence);

  // La Prop e' opposta al forecast:
  // confidence forecast alta = rischio maggiore per la Prop.
  const counterForecastScore =
    Number.isFinite(forecastConfidence)
      ? 100 - forecastConfidence
      : 50;

  // 80% comportamento operativo reale First Touch
  // 20% forza/confidence del forecast in senso contrarian.
  const operationalScore =
    firstTouchIntegratedScore == null
      ? null
      : Math.max(
          0,
          Math.min(
            100,
            firstTouchIntegratedScore * 0.80 +
            counterForecastScore * 0.20
          )
        );

  const recentDirectional = labRows
    .filter(r => ["BUY","SELL"].includes(String(r?.forecast_direction || "").toUpperCase()))
    .slice(0,4)
    .map(r => String(r.forecast_direction).toUpperCase());
  const stability = recentDirectional.length < 2
    ? "DATI INSUFFIC."
    : new Set(recentDirectional).size === 1
      ? "ALTA"
      : recentDirectional[0] === recentDirectional[1]
        ? "MEDIA"
        : "BASSA";

  const opLabel = operationalScore == null
    ? { text:"IN ATTESA DATI", color:"#94a3b8", icon:"⚪" }
    : operationalScore >= 65
      ? { text:"PROP FAVORITA", color:"#4ade80", icon:"🟢" }
      : operationalScore >= 52
        ? { text:"PROP MODERATAMENTE FAVORITA", color:"#a3e635", icon:"🟢" }
        : operationalScore >= 42
          ? { text:"EQUILIBRIO — ATTENDI CONFERMA", color:"#fde68a", icon:"🟡" }
          : operationalScore >= 30
            ? { text:"BROKER FAVORITO", color:"#fb923c", icon:"🟠" }
            : { text:"FORTE RISCHIO PROP", color:"#fb7185", icon:"🔴" };

  const bestHorizon = opHorizons
    .filter(x => x.h <= 3 && x.bucket && Number.isFinite(x.firstTouchScore))
    .sort((a,b) => (b.firstTouchScore || 0) - (a.firstTouchScore || 0))[0] || null;

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

      <div style={{
        marginBottom:14,padding:"15px",borderRadius:17,
        border:"1px solid rgba(34,211,238,.38)",
        background:"linear-gradient(135deg,rgba(8,145,178,.10),rgba(30,41,59,.72))"
      }}>
        <div style={{display:"flex",justifyContent:"space-between",gap:10,alignItems:"flex-start",flexWrap:"wrap",marginBottom:12}}>
          <div>
            <div style={{fontSize:17,fontWeight:1000,color:"#cffafe"}}>🧭 OPERATIONAL DECISION ENGINE</div>
            <div style={{fontSize:10,color:"#94a3b8",marginTop:3}}>Inserisci il profitto che vuoi ottenere sulla Prop e i lotti: il motore traduce il target in movimento XAUUSD e confronta TP/SL con lo storico reale dei path M15.</div>
          </div>
          <button style={{...secondaryButton,padding:"7px 10px"}} onClick={()=>setDetailsOpen(v=>!v)}>{detailsOpen?"Nascondi sviluppi":"Mostra sviluppi"}</button>
        </div>

        <div style={{display:"grid",gridTemplateColumns:isNarrow?"1fr":"repeat(3,minmax(150px,1fr)) auto",gap:8,alignItems:"end"}}>
          <div><label style={{fontSize:9,color:"#94a3b8",display:"block",marginBottom:4}}>Guadagno desiderato Prop ($)</label><input type="number" min="1" step="100" value={opTargetUsd} onChange={e=>setOpTargetUsd(e.target.value)} style={{...input,marginBottom:0}} /></div>
          <div><label style={{fontSize:9,color:"#94a3b8",display:"block",marginBottom:4}}>Lotti Prop</label><input type="number" min="0.01" step="0.01" value={opLots} onChange={e=>setOpLots(e.target.value)} style={{...input,marginBottom:0}} /></div>
          <div><label style={{fontSize:9,color:"#94a3b8",display:"block",marginBottom:4}}>SL distance (punti MT5)</label><input type="number" min="1" step="50" value={opSlPoints} onChange={e=>setOpSlPoints(e.target.value)} style={{...input,marginBottom:0}} /></div>
          <button style={{...primaryButtonBlue,padding:"9px 12px",opacity:opLoading?.6:1}} disabled={opLoading} onClick={loadOperationalPlan}>{opLoading?"Calcolo…":"↻ Calcola piano"}</button>
        </div>

        {operationalTarget && <div style={{fontSize:10,color:"#cbd5e1",marginTop:9}}>Target <b style={{color:"#4ade80"}}>+${fmt(operationalTarget.targetUsd,0)}</b> con <b>{fmt(operationalTarget.lots,2)} lotti</b> = movimento prezzo <b style={{color:"#67e8f9"}}>${fmt(operationalTarget.priceDistance,2)}</b> = <b>{operationalTarget.targetPoints} punti</b>. SL {Math.max(1,Number(opSlPoints)||1000)} pt = <b style={{color:"#fb7185"}}>${fmt((Math.max(1,Number(opSlPoints)||1000))*0.01,2)}</b> di prezzo.</div>}
        {opError && <div style={{marginTop:9,color:"#fecaca",fontSize:10}}>⚠️ {opError}</div>}

        <div style={{display:"grid",gridTemplateColumns:isNarrow?"1fr":"repeat(4,minmax(160px,1fr))",gap:8,marginTop:12}}>
          <div style={{padding:"11px",borderRadius:12,border:"1px solid rgba(71,85,105,.4)",background:"rgba(2,6,23,.38)"}}><div style={{fontSize:9,color:"#64748b",fontWeight:950}}>DIREZIONE PROP</div><div style={{fontSize:25,fontWeight:1000,color:propDirection==="BUY"?"#5eead4":propDirection==="SELL"?"#fb7185":"#fde68a",marginTop:3}}>{propDirection==="WAIT"?"ATTENDI":propDirection}</div><div style={{fontSize:9,color:"#64748b"}}>Opposta al forecast {forecastDirection}</div></div>
          <div style={{padding:"11px",borderRadius:12,border:"1px solid rgba(71,85,105,.4)",background:"rgba(2,6,23,.38)"}}><div style={{fontSize:9,color:"#64748b",fontWeight:950}}>DIREZIONE BROKER</div><div style={{fontSize:25,fontWeight:1000,color:brokerDirection==="BUY"?"#5eead4":brokerDirection==="SELL"?"#fb7185":"#fde68a",marginTop:3}}>{brokerDirection==="WAIT"?"ATTENDI":brokerDirection}</div><div style={{fontSize:9,color:"#64748b"}}>Stessa direzione del forecast</div></div>
          <div style={{padding:"11px",borderRadius:12,border:`1px solid ${opLabel.color}55`,background:"rgba(2,6,23,.38)"}}><div style={{fontSize:9,color:"#64748b",fontWeight:950}}>INDICAZIONE OPERATIVA</div><div style={{fontSize:16,fontWeight:1000,color:opLabel.color,marginTop:5}}>{opLabel.icon} {opLabel.text}</div><div style={{fontSize:9,color:"#64748b",marginTop:3}}>Indice orientativo, non certezza di mercato</div></div>
          <div style={{padding:"11px",borderRadius:12,border:"1px solid rgba(71,85,105,.4)",background:"rgba(2,6,23,.38)"}}>
            <div style={{fontSize:9,color:"#64748b",fontWeight:950}}>SCORE / STABILITÀ</div>
            <div style={{fontSize:22,fontWeight:1000,color:"#e2e8f0",marginTop:3}}>{operationalScore==null?"—":`${fmt(operationalScore,0)}/100`}</div>
            <div style={{fontSize:9,color:"#94a3b8"}}>
              Stabilità segnale: <b>{stability}</b>{bestHorizon?` • miglior finestra ${bestHorizon.h}H`:""}
            </div>
            <div style={{fontSize:8.5,color:"#64748b",marginTop:5,lineHeight:1.45}}>
              First Touch 1–3H: <b style={{color:"#bae6fd"}}>{entryFirstTouchScore==null?"—":`${fmt(entryFirstTouchScore,1)}/100`}</b>
              {" • "}
              Coda 6–24H: <b style={{color:tailFirstTouchScore==null?"#64748b":"#c4b5fd"}}>{tailFirstTouchScore==null?"non ancora matura":`${fmt(tailFirstTouchScore,1)}/100`}</b>
              {tailRows.length > 0 ? ` (${tailRows.length} checkpoint usati)` : ""}
            </div>
          </div>
        </div>

        <div style={{fontSize:9,fontWeight:950,color:"#64748b",marginTop:10,marginBottom:5}}>PRIME ORE</div>
        <div style={{display:"grid",gridTemplateColumns:isNarrow?"1fr":"repeat(3,minmax(190px,1fr))",gap:8}}>
          {opHorizons.filter(x=>x.h<=3).map(({h,bucket}) => <div key={h} style={{padding:"10px 11px",borderRadius:12,border:"1px solid rgba(56,189,248,.22)",background:"rgba(2,6,23,.32)"}}>
            <div style={{fontSize:11,fontWeight:1000,color:"#bae6fd"}}>ENTRO {h}H</div>
            {!bucket ? <div style={{fontSize:10,color:"#64748b",marginTop:7}}>{opLoading?"Calcolo…":"—"}</div> : <div style={{display:"grid",gridTemplateColumns:"repeat(3,1fr)",gap:5,marginTop:7}}>
              <div><div style={{fontSize:8,color:"#64748b"}}>TP PROP</div><b style={{color:"#4ade80"}}>{fmt(bucket.tpPct,1)}%</b></div>
              <div><div style={{fontSize:8,color:"#64748b"}}>SL PROP</div><b style={{color:"#fb7185"}}>{fmt(bucket.slPct,1)}%</b></div>
              <div><div style={{fontSize:8,color:"#64748b"}}>APERTA</div><b style={{color:"#fde68a"}}>{fmt(bucket.nonePct,1)}%</b></div>
            </div>}
            {bucket && <div style={{fontSize:8,color:"#64748b",marginTop:6}}>Campione {bucket.signals || 0} • first-touch sul path M15</div>}
          </div>)}
        </div>

        <div style={{fontSize:9,fontWeight:950,color:"#a5b4fc",marginTop:12,marginBottom:5}}>PROSECUZIONE OPERAZIONE — FINO A 24H</div>
        <div style={{display:"grid",gridTemplateColumns:isNarrow?"1fr":"repeat(auto-fit,minmax(155px,1fr))",gap:8}}>
          {opHorizons.filter(x=>x.h>3).map(({h,bucket}) => <div key={h} style={{padding:"10px 11px",borderRadius:12,border:"1px solid rgba(129,140,248,.24)",background:"rgba(30,27,75,.16)"}}>
            <div style={{fontSize:11,fontWeight:1000,color:"#c7d2fe"}}>ENTRO {h}H</div>
            {!bucket ? <div style={{fontSize:10,color:"#64748b",marginTop:7}}>{opLoading?"Calcolo…":"—"}</div> : <div style={{display:"grid",gridTemplateColumns:"repeat(3,1fr)",gap:5,marginTop:7}}>
              <div><div style={{fontSize:8,color:"#64748b"}}>TP PROP</div><b style={{color:"#4ade80"}}>{fmt(bucket.tpPct,1)}%</b></div>
              <div><div style={{fontSize:8,color:"#64748b"}}>SL PROP</div><b style={{color:"#fb7185"}}>{fmt(bucket.slPct,1)}%</b></div>
              <div><div style={{fontSize:8,color:"#64748b"}}>APERTA</div><b style={{color:"#fde68a"}}>{fmt(bucket.nonePct,1)}%</b></div>
            </div>}
            {bucket && <div style={{fontSize:8,color:"#64748b",marginTop:6}}>Campione {bucket.signals || 0} • cumulativo dal segnale</div>}
          </div>)}
        </div>
        <div style={{fontSize:8.5,color:"#64748b",marginTop:7,lineHeight:1.45}}>
          🧠 <b style={{color:"#94a3b8"}}>First Touch integrato nello score:</b> 1H/2H/3H vengono sempre usati.
          I checkpoint 6H/9H/12H/15H/18H/21H/24H entrano automaticamente appena ciascuno raggiunge almeno
          <b style={{color:"#c4b5fd"}}> 10 segnali maturi</b>, con peso inferiore alle prime 3 ore.
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
        gridTemplateColumns: isNarrow ? "1fr" : "minmax(220px,.8fr) minmax(260px,1.1fr) minmax(310px,1.25fr) minmax(290px,1.1fr)",
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
          gridTemplateColumns: isNarrow ? "1fr" : "minmax(180px,320px) auto",
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

          <div style={{display:"grid",gridTemplateColumns: isNarrow ? "1fr" : "minmax(230px,1fr) auto auto",gap:8,alignItems:"stretch"}}>
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

      {detailsOpen && data && (
        <>
          <div style={{
            display:"grid",
            gridTemplateColumns:"repeat(auto-fit,minmax(min(220px,100%),1fr))",
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

      <div style={{display:"flex",justifyContent:"flex-end",marginTop:4}}><button style={secondaryButton} onClick={()=>setLabOpen(v=>!v)}>{labOpen?"Nascondi Market Engine Lab":"Mostra Market Engine Lab"}</button></div>
      {labOpen && renderLabPanel()}

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
