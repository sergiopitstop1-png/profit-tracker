"use client";

import React, { useEffect, useMemo, useRef } from "react";

const TV_SYMBOLS = {
  XAUUSD: "OANDA:XAUUSD",
  XAGUSD: "OANDA:XAGUSD",
  EURUSD: "OANDA:EURUSD",
  GBPUSD: "OANDA:GBPUSD",
  USDJPY: "OANDA:USDJPY",
  USDCHF: "OANDA:USDCHF",
  USDCAD: "OANDA:USDCAD",
  AUDUSD: "OANDA:AUDUSD",
  NZDUSD: "OANDA:NZDUSD",
  EURGBP: "OANDA:EURGBP",
  EURJPY: "OANDA:EURJPY",
  EURCHF: "OANDA:EURCHF",
  EURAUD: "OANDA:EURAUD",
  GBPJPY: "OANDA:GBPJPY",
  GBPCHF: "OANDA:GBPCHF",
  GBPAUD: "OANDA:GBPAUD",
  AUDJPY: "OANDA:AUDJPY",
  CADJPY: "OANDA:CADJPY",
  CHFJPY: "OANDA:CHFJPY",
  NZDJPY: "OANDA:NZDJPY",
};

function normalizeTradingViewSymbol(symbol) {
  const raw = String(symbol || "XAUUSD").trim().toUpperCase();

  // I broker possono esporre simboli come XAUUSD.x, XAUUSDm, EURUSD.a ecc.
  // Per il grafico TradingView ci serve il simbolo base OANDA.
  const known = Object.keys(TV_SYMBOLS).find(key => raw === key || raw.startsWith(key));
  if (known) return TV_SYMBOLS[known];

  // Fallback: prova comunque OANDA con il simbolo ricevuto ripulito dai suffissi più comuni.
  const base = raw
    .replace(/[._-].*$/, "")
    .replace(/[^A-Z0-9]/g, "");

  return TV_SYMBOLS[base] || `OANDA:${base || "XAUUSD"}`;
}

export default function TradingViewChart({
  symbol = "XAUUSD",
  interval = "15",
  height = 650,
  showEma = true,
}) {
  const container = useRef(null);
  const tvSymbol = useMemo(() => normalizeTradingViewSymbol(symbol), [symbol]);
  const safeHeight = Number.isFinite(Number(height)) ? Number(height) : 650;

  useEffect(() => {
    if (!container.current) return undefined;

    container.current.innerHTML = "";

    const widget = document.createElement("div");
    widget.className = "tradingview-widget-container__widget";
    widget.style.height = `${safeHeight}px`;
    widget.style.minHeight = `${safeHeight}px`;
    widget.style.width = "100%";
    container.current.appendChild(widget);

    const script = document.createElement("script");
    script.src = "https://s3.tradingview.com/external-embedding/embed-widget-advanced-chart.js";
    script.type = "text/javascript";
    script.async = true;

    const config = {
      autosize: false,
      width: "100%",
      height: safeHeight,
      symbol: tvSymbol,
      interval: String(interval || "15"),
      timezone: "Europe/Rome",
      theme: "dark",
      style: "1",
      locale: "it",
      backgroundColor: "rgba(2, 6, 23, 1)",
      gridColor: "rgba(51, 65, 85, 0.28)",
      withdateranges: true,
      hide_side_toolbar: false,
      hide_top_toolbar: false,
      allow_symbol_change: false,
      save_image: false,
      calendar: false,
      support_host: "https://www.tradingview.com",
    };

    if (showEma) {
      // Due EMA indipendenti, pre-caricate direttamente nel widget TradingView.
      // Restano visibili anche senza abbonamento TradingView personale del browser.
      config.studies = [
        {
          id: "MAExp@tv-basicstudies",
          version: 60,
          inputs: { length: 20 },
          overrides: { "Plot.color": "#facc15", "Plot.linewidth": 3 },
        },
        {
          id: "MAExp@tv-basicstudies",
          version: 60,
          inputs: { length: 50 },
          overrides: { "Plot.color": "#22c55e", "Plot.linewidth": 3 },
        },
      ];
    }

    script.innerHTML = JSON.stringify(config);
    container.current.appendChild(script);

    return () => {
      if (container.current) container.current.innerHTML = "";
    };
  }, [tvSymbol, interval, safeHeight, showEma]);

  return (
    <div>
      {showEma && (
        <div style={{
          display: "flex",
          gap: 8,
          alignItems: "center",
          flexWrap: "wrap",
          marginBottom: 8,
          fontSize: 11,
          color: "#cbd5e1",
        }}>
          <span style={{
            padding: "5px 9px",
            borderRadius: 999,
            border: "1px solid rgba(250,204,21,.45)",
            background: "rgba(250,204,21,.08)",
            color: "#facc15",
            fontWeight: 900,
          }}>
            EMA 20
          </span>
          <span style={{
            padding: "5px 9px",
            borderRadius: 999,
            border: "1px solid rgba(34,197,94,.40)",
            background: "rgba(22,163,74,.08)",
            color: "#22c55e",
            fontWeight: 900,
          }}>
            EMA 50
          </span>
          <span style={{ color: "#64748b" }}>
            M15: EMA20 sopra EMA50 = rialzista · EMA20 sotto EMA50 = ribassista
          </span>
        </div>
      )}

      <div
        ref={container}
        className="tradingview-widget-container"
        style={{
          height: `${safeHeight}px`,
          minHeight: `${safeHeight}px`,
          width: "100%",
          position: "relative",
        }}
      />
    </div>
  );
}
