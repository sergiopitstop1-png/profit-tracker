"use client";

import React, { useEffect, useRef } from "react";

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

export default function TradingViewChart({ symbol = "XAUUSD" }) {
  const container = useRef(null);
  const tvSymbol = TV_SYMBOLS[symbol] || `OANDA:${symbol}`;

  useEffect(() => {
    if (!container.current) return;
    container.current.innerHTML = "";

    const widget = document.createElement("div");
    widget.className = "tradingview-widget-container__widget";
    widget.style.height = "100%";
    widget.style.minHeight = "1000px";
    widget.style.width = "100%";
    container.current.appendChild(widget);

    const script = document.createElement("script");
    script.src = "https://s3.tradingview.com/external-embedding/embed-widget-advanced-chart.js";
    script.type = "text/javascript";
    script.async = true;
    script.innerHTML = JSON.stringify({
      autosize: true,
      symbol: tvSymbol,
      interval: "1",
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
      support_host: "https://www.tradingview.com"
    });
    container.current.appendChild(script);
  }, [tvSymbol]);

  return (
    <div
      ref={container}
      className="tradingview-widget-container"
      style={{ height: "1000px", width: "100%" }}
    />
  );
}
