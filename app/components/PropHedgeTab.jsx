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
const grid2 = { display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(240px,1fr))", gap: 14 };
const orderGrid = { display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(300px,1fr))", gap: 14, marginTop: 16 };
const orderRow = { display: "flex", justifyContent: "space-between", gap: 16, padding: "8px 0", borderBottom: "1px solid rgba(51,65,85,.55)" };

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

export default function PropHedgeTab() {
  const [asset, setAsset] = useState("XAUUSD");
  const [direction, setDirection] = useState("BUY");
  const [accountSize, setAccountSize] = useState("100000");
  const [propCost, setPropCost] = useState("350");
  const [expectedGain, setExpectedGain] = useState("400");
  const [risk, setRisk] = useState("1000");
  const [slPoints, setSlPoints] = useState("700");
  const [tpProp, setTpProp] = useState("10000");
  const [price, setPrice] = useState("");
  const [leverage, setLeverage] = useState("20");
  const [accountBalance, setAccountBalance] = useState("101545");
  const [ddMax, setDdMax] = useState("6");
  const [brokerExposure, setBrokerExposure] = useState("416");
  const [brokerBalance, setBrokerBalance] = useState("3000");
  const [live, setLive] = useState({ status: "loading", bid: null, ask: null, price: null, time: null, source: "", quoteToUsd: 1 });
  const [placed, setPlaced] = useState(null);
  const [closePropPL, setClosePropPL] = useState("");
  const [closeBrokerPL, setCloseBrokerPL] = useState("");

  const a = ASSETS[asset];

  const refreshPrice = async () => {
    try {
      setLive(s => ({ ...s, status: "loading" }));
      const r = await fetch(`/api/prop-price?symbol=${encodeURIComponent(asset)}&t=${Date.now()}`, { cache: "no-store" });
      const data = await r.json();
      if (!r.ok || !Number.isFinite(Number(data.price))) throw new Error(data.error || "Prezzo non disponibile");
      const p = Number(data.price);
      setPrice(p.toFixed(a.decimals));
      setLive({
        status: "live",
        bid: data.bid ?? null,
        ask: data.ask ?? null,
        price: p,
        time: data.time ?? null,
        source: data.source ?? "",
        quoteToUsd: Number.isFinite(Number(data.quoteToUsd)) ? Number(data.quoteToUsd) : 1
      });
    } catch (e) {
      setLive(s => ({ ...s, status: "error" }));
    }
  };

  useEffect(() => {
    refreshPrice();
    const id = setInterval(refreshPrice, 2000);
    return () => clearInterval(id);
  }, [asset]);

  const c = useMemo(() => {
    const account = num(accountSize);
    const bal = num(accountBalance);
    const dd = num(ddMax);
    const r = num(risk);
    const sl = num(slPoints);
    const px = num(price);
    const lev = num(leverage);
    const exposure = num(brokerExposure);
    const brokerBal = num(brokerBalance);
    const quoteToUsd = Number.isFinite(live.quoteToUsd) && live.quoteToUsd > 0 ? live.quoteToUsd : 1;

    const burnBalance = account * (1 - dd / 100);
    const ddResidual = Math.max(0, bal - burnBalance);
    const riskPct = account > 0 ? (r / account) * 100 : 0;
    const shots = r > 0 ? ddResidual / r : 0;

    const propLots = sl > 0 ? r / sl : 0;
    const marginPct = account > 0 && lev > 0
      ? ((propLots * a.contract * px) / lev / account) * 100
      : 0;

    const brokerTpDollars = shots > 0
      ? ((num(expectedGain) + num(propCost) + exposure) * 1.10) / shots
      : 0;

    const slMove = sl * a.point;
    const tpMove = propLots > 0 ? num(tpProp) / (propLots * a.contract * quoteToUsd) : 0;

    const brokerLotsRaw = slMove > 0
      ? brokerTpDollars / (a.contract * slMove * quoteToUsd)
      : 0;
    const brokerLots = ceilStep(brokerLotsRaw, a.lotStep);

    const propSL = direction === "BUY" ? px - slMove : px + slMove;
    const propTPPrice = direction === "BUY" ? px + tpMove : px - tpMove;
    const brokerDirection = direction === "BUY" ? "SELL" : "BUY";
    const brokerTP = propSL;
    const brokerSL = propTPPrice;

    // Perdita del broker nello scenario in cui la Prop raggiunge il proprio TP.
    const maxBrokerLoss = Math.abs(propTPPrice - px) * a.contract * brokerLots * quoteToUsd;
    const brokerResidualWorst = brokerBal - maxBrokerLoss;
    const prudentialRequired = maxBrokerLoss * 1.20;

    let brokerSafety = "red";
    if (brokerBal >= prudentialRequired) brokerSafety = "green";
    else if (brokerBal >= maxBrokerLoss) brokerSafety = "yellow";

    return {
      burnBalance, ddResidual, riskPct, shots, propLots, marginPct,
      brokerTpDollars, slMove, tpMove, brokerLotsRaw, brokerLots,
      propSL, propTPPrice, brokerDirection, brokerTP, brokerSL, px,
      maxBrokerLoss, brokerResidualWorst, prudentialRequired, brokerSafety, quoteToUsd
    };
  }, [
    asset, direction, accountSize, propCost, expectedGain, risk, slPoints, tpProp,
    price, leverage, accountBalance, ddMax, brokerExposure, brokerBalance, a, live.quoteToUsd
  ]);

  const tracking = useMemo(() => {
    if (!placed) return null;
    const current = Number.isFinite(Number(live.price)) ? Number(live.price) : num(price);
    const delta = current - placed.entry;
    const propSign = placed.direction === "BUY" ? 1 : -1;
    const brokerSign = placed.brokerDirection === "BUY" ? 1 : -1;

    const propPL = delta * placed.contract * placed.propLots * propSign * placed.quoteToUsd;
    const brokerPL = delta * placed.contract * placed.brokerLots * brokerSign * placed.quoteToUsd;
    const propBalanceNow = placed.propBalanceStart + propPL;
    const brokerBalanceNow = placed.brokerBalanceStart + brokerPL;
    const combinedPL = propPL + brokerPL;

    return { current, delta, propPL, brokerPL, propBalanceNow, brokerBalanceNow, combinedPL };
  }, [placed, live.price, price]);

  const placeTrade = () => {
    if (!c.px || !c.propLots || !c.brokerLots) return;
    setClosePropPL("");
    setCloseBrokerPL("");
    setPlaced({
      asset,
      label: a.label,
      decimals: a.decimals,
      contract: a.contract,
      entry: c.px,
      direction,
      brokerDirection: c.brokerDirection,
      propLots: c.propLots,
      brokerLots: c.brokerLots,
      propTP: c.propTPPrice,
      propSL: c.propSL,
      brokerTP: c.brokerTP,
      brokerSL: c.brokerSL,
      propBalanceStart: num(accountBalance),
      brokerBalanceStart: num(brokerBalance),
      quoteToUsd: c.quoteToUsd,
      placedAt: new Date().toISOString()
    });
  };

  const resetTrade = () => {
    setPlaced(null);
    setClosePropPL("");
    setCloseBrokerPL("");
  };

  const closeAndUpdateBalances = () => {
    if (!placed || !tracking) return;

    const propPLFinal = closePropPL === "" ? tracking.propPL : num(closePropPL);
    const brokerPLFinal = closeBrokerPL === "" ? tracking.brokerPL : num(closeBrokerPL);

    const newPropBalance = placed.propBalanceStart + propPLFinal;
    const newBrokerBalance = placed.brokerBalanceStart + brokerPLFinal;

    setAccountBalance(String(Number(newPropBalance.toFixed(2))));
    setBrokerBalance(String(Number(newBrokerBalance.toFixed(2))));
    setPlaced(null);
    setClosePropPL("");
    setCloseBrokerPL("");
  };

  const Field = ({ label, value, setValue, step = "any", disabled = false }) => (
    <div>
      <label style={fieldLabel}>{label}</label>
      <input
        style={{ ...input, opacity: disabled ? 0.65 : 1 }}
        type="text"
        inputMode="decimal"
        autoComplete="off"
        value={value}
        disabled={disabled}
        onFocus={e => e.currentTarget.select()}
        onChange={e => {
          const raw = e.target.value;
          // Consente tastiera italiana: numeri, virgola, punto e segno meno.
          if (/^-?[0-9]*[.,]?[0-9]*$/.test(raw) || raw === "") {
            setValue(raw);
          }
        }}
      />
    </div>
  );

  const safetyStyles = {
    green: { bg: "rgba(34,197,94,.13)", border: "rgba(34,197,94,.48)", color: "#86efac", icon: "🟢", title: "COPERTURA SOSTENIBILE" },
    yellow: { bg: "rgba(245,158,11,.13)", border: "rgba(245,158,11,.50)", color: "#fde68a", icon: "🟡", title: "ATTENZIONE — BUFFER RIDOTTO" },
    red: { bg: "rgba(239,68,68,.13)", border: "rgba(239,68,68,.52)", color: "#fca5a5", icon: "🔴", title: "SALDO BROKER INSUFFICIENTE" }
  };
  const safety = safetyStyles[c.brokerSafety];

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      <div>
        <h2 style={sectionTitle}>📈 Prop Hedge</h2>
        <p style={sectionDescription}>Dimensionamento, controllo capitale Broker e monitoraggio live dopo l’ingresso.</p>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(420px,1fr))", gap: 16 }}>
        <div style={panel}>
          <div style={panelHeader}>
            <div>
              <h3 style={panelTitle}>Parametri Prop</h3>
              <p style={panelSubtitle}>Account, rischio e obiettivi.</p>
            </div>
          </div>
          <div style={grid2}>
            <Field label="Valore Prop / Account Size ($)" value={accountSize} setValue={setAccountSize} disabled={!!placed} />
            <Field label="Costo Prop ($)" value={propCost} setValue={setPropCost} disabled={!!placed} />
            <Field label="Guadagno atteso ($)" value={expectedGain} setValue={setExpectedGain} disabled={!!placed} />
            <Field label="Rischio ($)" value={risk} setValue={setRisk} disabled={!!placed} />
            <Field label="SL Distance (punti)" value={slPoints} setValue={setSlPoints} disabled={!!placed} />
            <Field label="TP Prop ($)" value={tpProp} setValue={setTpProp} disabled={!!placed} />
            <Field label="DD Max Prop (%)" value={ddMax} setValue={setDdMax} step="0.1" disabled={!!placed} />
          </div>
        </div>

        <div style={panel}>
          <div style={panelHeader}>
            <div>
              <h3 style={panelTitle}>Mercato e Drawdown</h3>
              <p style={panelSubtitle}>Prezzo live via API Vercel con fallback manuale.</p>
            </div>
          </div>

          <div style={grid2}>
            <div>
              <label style={fieldLabel}>Asset</label>
              <select style={input} value={asset} disabled={!!placed} onChange={e => setAsset(e.target.value)}>
                {Object.entries(ASSETS).map(([k,v]) => <option key={k} value={k}>{v.label}</option>)}
              </select>
            </div>
            <div>
              <label style={fieldLabel}>Direzione Prop</label>
              <select style={input} value={direction} disabled={!!placed} onChange={e => setDirection(e.target.value)}>
                <option>BUY</option><option>SELL</option>
              </select>
            </div>

            <Field label="Prezzo strumento / Ingresso" value={price} setValue={setPrice} disabled={!!placed} />
            <Field label="Leva" value={leverage} setValue={setLeverage} disabled={!!placed} />
            <Field label="Saldo Account Prop ($)" value={accountBalance} setValue={setAccountBalance} disabled={!!placed} />
            <Field label="Esposizione Broker attuale ($)" value={brokerExposure} setValue={setBrokerExposure} disabled={!!placed} />
            <Field label="Saldo Broker disponibile ($)" value={brokerBalance} setValue={setBrokerBalance} disabled={!!placed} />
          </div>

          <div style={{ display:"flex", gap:10, flexWrap:"wrap", alignItems:"center" }}>
            <button style={primaryButtonBlue} onClick={refreshPrice}>Aggiorna prezzo</button>
            <button style={secondaryButton} disabled={!!placed} onClick={() => setAccountBalance(accountSize)}>
              Sincronizza saldo con Valore Prop
            </button>
            <span style={{ fontSize:13, color: live.status==="live" ? "#5eead4" : live.status==="error" ? "#fca5a5" : "#fde68a" }}>
              {live.status==="live"
                ? `● LIVE ${live.source ? "— "+live.source : ""}`
                : live.status==="error"
                  ? "● Feed non disponibile: usa il prezzo manuale"
                  : "● aggiornamento…"}
            </span>
          </div>
        </div>
      </div>

      <div style={panel}>
        <div style={panelHeader}>
          <div>
            <h3 style={panelTitle}>Controllo capitale Broker — prima di piazzare</h3>
            <p style={panelSubtitle}>Scenario peggiore: la Prop raggiunge il proprio Take Profit e il Broker va contro.</p>
          </div>
        </div>

        <div style={statsGrid}>
          <div style={statCard}>
            <div style={statLabel}>Perdita max Broker</div>
            <div style={{ ...statValue, color:"#fca5a5" }}>−$ {fmt(c.maxBrokerLoss,2)}</div>
            <div style={statSub}>Perdita teorica se la Prop arriva al TP.</div>
          </div>
          <div style={statCard}>
            <div style={statLabel}>Saldo Broker</div>
            <div style={statValue}>$ {fmt(num(brokerBalance),2)}</div>
            <div style={statSub}>Capitale disponibile prima dell’ingresso.</div>
          </div>
          <div style={statCard}>
            <div style={statLabel}>Saldo residuo scenario peggiore</div>
            <div style={{ ...statValue, color: c.brokerResidualWorst >= 0 ? "#5eead4" : "#fca5a5" }}>
              $ {fmt(c.brokerResidualWorst,2)}
            </div>
            <div style={statSub}>Saldo Broker − perdita massima teorica.</div>
          </div>
          <div style={statCard}>
            <div style={statLabel}>Capitale prudenziale +20%</div>
            <div style={statValue}>$ {fmt(c.prudentialRequired,2)}</div>
            <div style={statSub}>Buffer aggiuntivo per non lavorare al limite.</div>
          </div>
        </div>

        <div style={{
          marginTop:14, padding:"14px 16px", borderRadius:16,
          background:safety.bg, border:`1px solid ${safety.border}`, color:safety.color,
          fontWeight:800
        }}>
          {safety.icon} {safety.title}
          <div style={{fontSize:12,fontWeight:600,marginTop:5,opacity:.9}}>
            {c.brokerSafety === "green" && `Hai almeno il 20% di buffer oltre alla perdita massima teorica.`}
            {c.brokerSafety === "yellow" && `Il saldo copre la perdita teorica, ma non raggiunge il buffer prudenziale del 20%.`}
            {c.brokerSafety === "red" && `Mancano $ ${fmt(Math.max(0, c.maxBrokerLoss - num(brokerBalance)),2)} per coprire la perdita teorica massima.`}
          </div>
        </div>
      </div>

      <div style={panel}>
        <div style={panelHeader}>
          <div>
            <h3 style={panelTitle}>Risultati e ordini</h3>
            <p style={panelSubtitle}>Valori da controllare prima di confermare l’operazione.</p>
          </div>
        </div>

        <div style={statsGrid}>
          <div style={statCard}><div style={statLabel}>Lotti Prop</div><div style={statValue}>{fmt(c.propLots,3)}</div><div style={statSub}>Rischio / SL Distance</div></div>
          <div style={statCard}><div style={statLabel}>Margine utilizzato</div><div style={statValue}>{fmt(c.marginPct,2)}%</div><div style={statSub}>Lotti × contract × prezzo / leva / saldo</div></div>
          <div style={statCard}><div style={statLabel}>DD residuo</div><div style={statValue}>$ {fmt(c.ddResidual,2)}</div><div style={statSub}>Saldo attuale − saldo di rottura (${fmt(c.burnBalance,2)})</div></div>
          <div style={statCard}><div style={statLabel}>Tiri disponibili</div><div style={statValue}>{fmt(c.shots,2)}</div><div style={statSub}>DD residuo / rischio per trade</div></div>
          <div style={statCard}><div style={statLabel}>TP Broker ($)</div><div style={statValue}>$ {fmt(c.brokerTpDollars,2)}</div><div style={statSub}>(Guadagno + costo + esposizione) × 1,10 / tiri</div></div>
          <div style={statCard}><div style={statLabel}>Lotti Broker</div><div style={{...statValue,color:"#5eead4"}}>{fmt(c.brokerLots,2)}</div><div style={statSub}>Teorici {fmt(c.brokerLotsRaw,3)} → arrotondati a {a.lotStep}</div></div>
        </div>

        <div style={orderGrid}>
          <div style={statCard}>
            <div style={{fontWeight:900,fontSize:18,marginBottom:8}}>
              PROP — <span style={{color:direction==="BUY"?"#5eead4":"#fdba74"}}>{direction}</span>
            </div>
            <div style={orderRow}><span>Asset</span><b>{a.label}</b></div>
            <div style={orderRow}><span>Lotti</span><b>{fmt(c.propLots,3)}</b></div>
            <div style={orderRow}><span>Ingresso</span><b>{fmt(c.px,a.decimals)}</b></div>
            <div style={orderRow}><span>Take Profit</span><b>{fmt(c.propTPPrice,a.decimals)}</b></div>
            <div style={orderRow}><span>Stop Loss</span><b>{fmt(c.propSL,a.decimals)}</b></div>
          </div>

          <div style={statCard}>
            <div style={{fontWeight:900,fontSize:18,marginBottom:8}}>
              BROKER — <span style={{color:c.brokerDirection==="BUY"?"#5eead4":"#fdba74"}}>{c.brokerDirection}</span>
            </div>
            <div style={orderRow}><span>Asset</span><b>{a.label}</b></div>
            <div style={orderRow}><span>Lotti</span><b>{fmt(c.brokerLots,2)}</b></div>
            <div style={orderRow}><span>Ingresso</span><b>{fmt(c.px,a.decimals)}</b></div>
            <div style={orderRow}><span>Take Profit</span><b>{fmt(c.brokerTP,a.decimals)}</b></div>
            <div style={orderRow}><span>Stop Loss</span><b>{fmt(c.brokerSL,a.decimals)}</b></div>
          </div>
        </div>

        <div style={{ display:"flex", gap:10, flexWrap:"wrap", marginTop:16 }}>
          {!placed ? (
            <button
              onClick={placeTrade}
              style={{
                border:"none", borderRadius:14, padding:"13px 22px", cursor:"pointer",
                fontWeight:900, fontSize:15, color:"#052e16",
                background:"linear-gradient(135deg,#4ade80,#22c55e)"
              }}
            >
              ✅ PIAZZATA — AVVIA MONITOR
            </button>
          ) : (
            <>
              <button
                onClick={closeAndUpdateBalances}
                style={{
                  border:"none", borderRadius:14, padding:"13px 22px",
                  cursor:"pointer", fontWeight:900, fontSize:15, color:"#052e16",
                  background:"linear-gradient(135deg,#4ade80,#22c55e)"
                }}
              >
                ✅ CHIUDI E AGGIORNA SALDI
              </button>
              <button
                onClick={resetTrade}
                style={{
                  border:"1px solid rgba(248,113,113,.55)", borderRadius:14, padding:"13px 22px",
                  cursor:"pointer", fontWeight:900, fontSize:15, color:"#fecaca",
                  background:"rgba(127,29,29,.35)"
                }}
              >
                ↩️ ANNULLA / RESET
              </button>
            </>
          )}
        </div>
      </div>

      {placed && tracking && (
        <div style={{
          ...panel,
          border:"1px solid rgba(34,197,94,.42)",
          boxShadow:"0 20px 48px rgba(0,0,0,.26), 0 0 0 1px rgba(34,197,94,.08) inset"
        }}>
          <div style={panelHeader}>
            <div>
              <h3 style={panelTitle}>⚡ Monitor operazione LIVE</h3>
              <p style={panelSubtitle}>
                Ingresso congelato a {fmt(placed.entry, placed.decimals)} • prezzo corrente {fmt(tracking.current, placed.decimals)}
              </p>
            </div>
            <div style={{color:"#5eead4",fontWeight:900}}>● OPERAZIONE ATTIVA</div>
          </div>

          <div style={statsGrid}>
            <div style={statCard}>
              <div style={statLabel}>Movimento dal piazzato</div>
              <div style={{...statValue,color:tracking.delta>=0?"#5eead4":"#fca5a5"}}>
                {tracking.delta >= 0 ? "+" : ""}{fmt(tracking.delta, placed.decimals)}
              </div>
              <div style={statSub}>{placed.label}</div>
            </div>

            <div style={statCard}>
              <div style={statLabel}>P/L Prop live</div>
              <div style={{...statValue,color:tracking.propPL>=0?"#5eead4":"#fca5a5"}}>{signedMoney(tracking.propPL)}</div>
              <div style={statSub}>Saldo: $ {fmt(tracking.propBalanceNow,2)}</div>
            </div>

            <div style={statCard}>
              <div style={statLabel}>P/L Broker live</div>
              <div style={{...statValue,color:tracking.brokerPL>=0?"#5eead4":"#fca5a5"}}>{signedMoney(tracking.brokerPL)}</div>
              <div style={statSub}>Saldo: $ {fmt(tracking.brokerBalanceNow,2)}</div>
            </div>

            <div style={statCard}>
              <div style={statLabel}>P/L combinato</div>
              <div style={{...statValue,color:tracking.combinedPL>=0?"#5eead4":"#fca5a5"}}>{signedMoney(tracking.combinedPL)}</div>
              <div style={statSub}>Somma teorica delle due gambe.</div>
            </div>
          </div>

          <div style={{...panel, marginTop:16, background:"rgba(2,6,23,.42)"}}>
            <div style={panelHeader}>
              <div>
                <h4 style={{...panelTitle,fontSize:18}}>Chiusura reale</h4>
                <p style={panelSubtitle}>Opzionale: inserisci il P/L reale se differisce da quello teorico del feed. Lascia vuoto per usare il P/L live.</p>
              </div>
            </div>
            <div style={grid2}>
              <div>
                <label style={fieldLabel}>P/L reale Prop ($)</label>
                <input
                  style={input}
                  type="text"
                  inputMode="decimal"
                  autoComplete="off"
                  placeholder={signedMoney(tracking.propPL)}
                  value={closePropPL}
                  onChange={e => {
                    const raw = e.target.value;
                    if (/^-?[0-9]*[.,]?[0-9]*$/.test(raw) || raw === "") setClosePropPL(raw);
                  }}
                />
              </div>
              <div>
                <label style={fieldLabel}>P/L reale Broker ($)</label>
                <input
                  style={input}
                  type="text"
                  inputMode="decimal"
                  autoComplete="off"
                  placeholder={signedMoney(tracking.brokerPL)}
                  value={closeBrokerPL}
                  onChange={e => {
                    const raw = e.target.value;
                    if (/^-?[0-9]*[.,]?[0-9]*$/.test(raw) || raw === "") setCloseBrokerPL(raw);
                  }}
                />
              </div>
            </div>
            <div style={{
              marginTop:10, padding:"10px 12px", borderRadius:12,
              background:"rgba(15,23,42,.8)", border:"1px solid rgba(51,65,85,.75)",
              color:"#cbd5e1", fontSize:13
            }}>
              Se chiudi ora:
              <b style={{marginLeft:8}}>Prop → $ {fmt(
                placed.propBalanceStart + (closePropPL === "" ? tracking.propPL : num(closePropPL)), 2
              )}</b>
              <b style={{marginLeft:16}}>Broker → $ {fmt(
                placed.brokerBalanceStart + (closeBrokerPL === "" ? tracking.brokerPL : num(closeBrokerPL)), 2
              )}</b>
            </div>
          </div>

          <div style={orderGrid}>
            <div style={statCard}>
              <div style={{fontWeight:900,fontSize:18,marginBottom:8}}>
                PROP — <span style={{color:placed.direction==="BUY"?"#5eead4":"#fdba74"}}>{placed.direction}</span>
              </div>
              <div style={orderRow}><span>Saldo iniziale</span><b>$ {fmt(placed.propBalanceStart,2)}</b></div>
              <div style={orderRow}><span>Saldo live</span><b style={{color:tracking.propBalanceNow>=placed.propBalanceStart?"#5eead4":"#fca5a5"}}>$ {fmt(tracking.propBalanceNow,2)}</b></div>
              <div style={orderRow}><span>TP</span><b>{fmt(placed.propTP,placed.decimals)}</b></div>
              <div style={orderRow}><span>SL</span><b>{fmt(placed.propSL,placed.decimals)}</b></div>
            </div>

            <div style={statCard}>
              <div style={{fontWeight:900,fontSize:18,marginBottom:8}}>
                BROKER — <span style={{color:placed.brokerDirection==="BUY"?"#5eead4":"#fdba74"}}>{placed.brokerDirection}</span>
              </div>
              <div style={orderRow}><span>Saldo iniziale</span><b>$ {fmt(placed.brokerBalanceStart,2)}</b></div>
              <div style={orderRow}><span>Saldo live</span><b style={{color:tracking.brokerBalanceNow>=placed.brokerBalanceStart?"#5eead4":"#fca5a5"}}>$ {fmt(tracking.brokerBalanceNow,2)}</b></div>
              <div style={orderRow}><span>TP</span><b>{fmt(placed.brokerTP,placed.decimals)}</b></div>
              <div style={orderRow}><span>SL</span><b>{fmt(placed.brokerSL,placed.decimals)}</b></div>
            </div>
          </div>
        </div>
      )}

      <div style={hintBox}>
        Il monitor è teorico e usa il prezzo del feed, non il prezzo esatto di esecuzione del tuo broker/prop.
        Spread, commissioni, swap, slippage e specifiche del contratto possono produrre differenze reali.
      </div>
    </div>
  );
}
