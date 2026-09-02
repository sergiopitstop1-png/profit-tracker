"use client";

import React, { useEffect, useRef } from "react";

// Stessa tecnica di TradingViewChart.jsx: script ufficiale TradingView, nessuna
// chiave API, nessun backend — si aggiorna da solo in tempo reale.
export default function MarketOverviewWidget({ height = 420 }) {
  const container = useRef(null);

  useEffect(() => {
    if (!container.current) return undefined;

    container.current.innerHTML = "";

    const widget = document.createElement("div");
    widget.className = "tradingview-widget-container__widget";
    container.current.appendChild(widget);

    const script = document.createElement("script");
    script.src = "https://s3.tradingview.com/external-embedding/embed-widget-market-overview.js";
    script.type = "text/javascript";
    script.async = true;
    script.innerHTML = JSON.stringify({
      colorTheme: "dark",
      dateRange: "1D",
      showChart: true,
      locale: "it",
      width: "100%",
      height,
      largeChartUrl: "",
      isTransparent: true,
      showSymbolLogo: true,
      showFloatingTooltip: false,
      plotLineColorGrowing: "rgba(74, 222, 128, 1)",
      plotLineColorFalling: "rgba(239, 68, 68, 1)",
      gridLineColor: "rgba(42, 46, 57, 0.35)",
      scaleFontColor: "rgba(148, 163, 184, 1)",
      belowLineFillColorGrowing: "rgba(74, 222, 128, 0.12)",
      belowLineFillColorFalling: "rgba(239, 68, 68, 0.12)",
      belowLineFillColorGrowingBottom: "rgba(74, 222, 128, 0)",
      belowLineFillColorFallingBottom: "rgba(239, 68, 68, 0)",
      symbolActiveColor: "rgba(56, 189, 248, 0.15)",
      tabs: [
        {
          title: "Indici",
          symbols: [
            { s: "FOREXCOM:SPXUSD", d: "S&P 500" },
            { s: "FOREXCOM:NSXUSD", d: "Nasdaq 100" },
            { s: "FOREXCOM:DJI", d: "Dow Jones" },
            { s: "INDEX:DEU40", d: "DAX" },
            { s: "FOREXCOM:UKXGBP", d: "FTSE 100" },
            { s: "TVC:FTSEMIB", d: "FTSE MIB" },
            { s: "INDEX:NKY", d: "Nikkei 225" },
          ],
          originalTitle: "Indices",
        },
      ],
    });
    container.current.appendChild(script);

    return () => {
      if (container.current) container.current.innerHTML = "";
    };
  }, [height]);

  return (
    <div
      ref={container}
      className="tradingview-widget-container"
      style={{ height: `${height}px`, minHeight: `${height}px`, width: "100%" }}
    />
  );
}
