"use client";

import React, { useEffect, useMemo, useState } from "react";
import {
  panel, panelHeader, panelTitle, panelSubtitle, input,
  primaryButtonBlue, secondaryButton, statCard, statLabel,
  statValue, statSub, statsGrid, hintBox, sectionTitle, sectionDescription
} from "./styles";

const ASSETS = {
  XAUUSD: { label: "XAU/USD — Oro", contract: 100, point: 0.01, decimals: 3, lotStep: 0.01 },
  XAGUSD: { label: "XAG/USD — Argento", contract: 5000, point: 0.001, decimals: 4, lotStep: 0.01 },
  EURUSD: { label: "EUR/USD", contract: 100000, point: 0.0001, decimals: 5, lotStep: 0.01 },
  GBPUSD: { label: "GBP/USD", contract: 100000, point: 0.0001, decimals: 5, lotStep: 0.01 },
  USDJPY: { label: "USD/JPY", contract: 100000, point: 0.01, decimals: 3, lotStep: 0.01 },
  USDCHF: { label: "USD/CHF", contract: 100000, point: 0.0001, decimals: 5, lotStep: 0.01 },
  USDCAD: { label: "USD/CAD", contract: 100000, point: 0.0001, decimals: 5, lotStep: 0.01 },
  AUDUSD: { label: "AUD/USD", contract: 100000, point: 0.0001, decimals: 5, lotStep: 0.01 },
  NZDUSD: { label: "NZD/USD", contract: 100000, point: 0.0001, decimals: 5, lotStep: 0.01 },
  EURGBP: { label: "EUR/GBP", contract: 100000, point: 0.0001, decimals: 5, lotStep: 0.01 },
  EURJPY: { label: "EUR/JPY", contract: 100000, point: 0.01, decimals: 3, lotStep: 0.01 },
  EURCHF: { label: "EUR/CHF", contract: 100000, point: 0.0001, decimals: 5, lotStep: 0.01 },
  EURAUD: { label: "EUR/AUD", contract: 100000, point: 0.0001, decimals: 5, lotStep: 0.01 },
  GBPJPY: { label: "GBP/JPY", contract: 100000, point: 0.01, decimals: 3, lotStep: 0.01 },
  GBPCHF: { label: "GBP/CHF", contract: 100000, point: 0.0001, decimals: 5, lotStep: 0.01 },
  GBPAUD: { label: "GBP/AUD", contract: 100000, point: 0.0001, decimals: 5, lotStep: 0.01 },
  AUDJPY: { label: "AUD/JPY", contract: 100000, point: 0.01, decimals: 3, lotStep: 0.01 },
  CADJPY: { label: "CAD/JPY", contract: 100000, point: 0.01, decimals: 3, lotStep: 0.01 },
  CHFJPY: { label: "CHF/JPY", contract: 100000, point: 0.01, decimals: 3, lotStep: 0.01 },
  NZDJPY: { label: "NZD/JPY", contract: 100000, point: 0.01, decimals: 3, lotStep: 0.01 },
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
  const [live, setLive] = useState({ status: "loading", bid: null, ask: null, price: null, time: null, source: "" });

  const a = ASSETS[asset];

  const refreshPrice = async () => {
    try {
      setLive(s => ({ ...s, status: "loading" }));
      const r = await fetch(`/api/prop-price?symbol=${encodeURIComponent(asset)}&t=${Date.now()}`, { cache: "no-store" });
      const data = await r.json();
      if (!r.ok || !Number.isFinite(Number(data.price))) throw new Error(data.error || "Prezzo non disponibile");
      const p = Number(data.price);
      setPrice(p.toFixed(a.decimals));
      setLive({ status: "live", bid: data.bid ?? null, ask: data.ask ?? null, price: p, time: data.time ?? null, source: data.source ?? "" });
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

    const burnBalance = account * (1 - dd / 100);
    const ddResidual = Math.max(0, bal - burnBalance);
    const riskPct = account > 0 ? (r / account) * 100 : 0;
    const shots = r > 0 ? ddResidual / r : 0;

    // Formula supplied by user: Lotti Prop = Rischio / SL Distance.
    const propLots = sl > 0 ? r / sl : 0;
    const marginPct = account > 0 && lev > 0
      ? ((propLots * a.contract * px) / lev / account) * 100
      : 0;

    const brokerTpDollars = shots > 0
      ? ((num(expectedGain) + num(propCost) + exposure) * 1.10) / shots
      : 0;

    const slMove = sl * a.point;
    const tpMove = propLots > 0 ? num(tpProp) / (propLots * a.contract) : 0;

    // Broker sizing based on the movement to Prop SL: hedge earns brokerTpDollars if Prop hits SL.
    const brokerLotsRaw = slMove > 0 ? brokerTpDollars / (a.contract * slMove) : 0;
    const brokerLots = ceilStep(brokerLotsRaw, a.lotStep);

    const propSL = direction === "BUY" ? px - slMove : px + slMove;
    const propTPPrice = direction === "BUY" ? px + tpMove : px - tpMove;
    const brokerDirection = direction === "BUY" ? "SELL" : "BUY";
    const brokerTP = propSL;
    const brokerSL = propTPPrice;

    return {
      burnBalance, ddResidual, riskPct, shots, propLots, marginPct,
      brokerTpDollars, slMove, tpMove, brokerLotsRaw, brokerLots,
      propSL, propTPPrice, brokerDirection, brokerTP, brokerSL, px
    };
  }, [asset, direction, accountSize, propCost, expectedGain, risk, slPoints, tpProp, price, leverage, accountBalance, ddMax, brokerExposure, a]);

  const Field = ({ label, value, setValue, step = "any" }) => (
    <div>
      <label style={fieldLabel}>{label}</label>
      <input style={input} type="number" step={step} value={value} onChange={e => setValue(e.target.value)} />
    </div>
  );

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      <div>
        <h2 style={sectionTitle}>📈 Prop Hedge</h2>
        <p style={sectionDescription}>Dimensionamento Prop, drawdown, copertura Broker e prezzi operativi TP/SL.</p>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(420px,1fr))", gap: 16 }}>
        <div style={panel}>
          <div style={panelHeader}><div><h3 style={panelTitle}>Parametri Prop</h3><p style={panelSubtitle}>Account, rischio e obiettivi.</p></div></div>
          <div style={grid2}>
            <Field label="Valore Prop / Account Size ($)" value={accountSize} setValue={setAccountSize} />
            <Field label="Costo Prop ($)" value={propCost} setValue={setPropCost} />
            <Field label="Guadagno atteso ($)" value={expectedGain} setValue={setExpectedGain} />
            <Field label="Rischio ($)" value={risk} setValue={setRisk} />
            <Field label="SL Distance (punti)" value={slPoints} setValue={setSlPoints} />
            <Field label="TP Prop ($)" value={tpProp} setValue={setTpProp} />
            <Field label="DD Max Prop (%)" value={ddMax} setValue={setDdMax} step="0.1" />
          </div>
        </div>

        <div style={panel}>
          <div style={panelHeader}><div><h3 style={panelTitle}>Mercato e Drawdown</h3><p style={panelSubtitle}>Prezzo live via API Vercel con fallback manuale.</p></div></div>
          <div style={grid2}>
            <div>
              <label style={fieldLabel}>Asset</label>
              <select style={input} value={asset} onChange={e => setAsset(e.target.value)}>
                {Object.entries(ASSETS).map(([k,v]) => <option key={k} value={k}>{v.label}</option>)}
              </select>
            </div>
            <div>
              <label style={fieldLabel}>Direzione Prop</label>
              <select style={input} value={direction} onChange={e => setDirection(e.target.value)}>
                <option>BUY</option><option>SELL</option>
              </select>
            </div>
            <Field label="Prezzo strumento / Ingresso" value={price} setValue={setPrice} />
            <Field label="Leva" value={leverage} setValue={setLeverage} />
            <Field label="Saldo Account ($)" value={accountBalance} setValue={setAccountBalance} />
            <Field label="Esposizione Broker attuale ($)" value={brokerExposure} setValue={setBrokerExposure} />
          </div>
          <div style={{ display:"flex", gap:10, flexWrap:"wrap", alignItems:"center" }}>
            <button style={primaryButtonBlue} onClick={refreshPrice}>Aggiorna prezzo</button>
            <button style={secondaryButton} onClick={() => setAccountBalance(accountSize)}>Sincronizza saldo con Valore Prop</button>
            <span style={{ fontSize:13, color: live.status==="live" ? "#5eead4" : live.status==="error" ? "#fca5a5" : "#fde68a" }}>
              {live.status==="live" ? `● LIVE ${live.source ? "— "+live.source : ""}` : live.status==="error" ? "● Feed non disponibile: usa il prezzo manuale" : "● aggiornamento…"}
            </span>
          </div>
        </div>
      </div>

      <div style={panel}>
        <div style={panelHeader}><div><h3 style={panelTitle}>Risultati</h3><p style={panelSubtitle}>Ricalcolo immediato ad ogni modifica.</p></div></div>
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
            <div style={{fontWeight:900,fontSize:18,marginBottom:8}}>PROP — <span style={{color:direction==="BUY"?"#5eead4":"#fdba74"}}>{direction}</span></div>
            <div style={orderRow}><span>Asset</span><b>{a.label}</b></div>
            <div style={orderRow}><span>Lotti</span><b>{fmt(c.propLots,3)}</b></div>
            <div style={orderRow}><span>Ingresso</span><b>{fmt(c.px,a.decimals)}</b></div>
            <div style={orderRow}><span>Take Profit</span><b>{fmt(c.propTPPrice,a.decimals)}</b></div>
            <div style={orderRow}><span>Stop Loss</span><b>{fmt(c.propSL,a.decimals)}</b></div>
          </div>
          <div style={statCard}>
            <div style={{fontWeight:900,fontSize:18,marginBottom:8}}>BROKER — <span style={{color:c.brokerDirection==="BUY"?"#5eead4":"#fdba74"}}>{c.brokerDirection}</span></div>
            <div style={orderRow}><span>Asset</span><b>{a.label}</b></div>
            <div style={orderRow}><span>Lotti</span><b>{fmt(c.brokerLots,2)}</b></div>
            <div style={orderRow}><span>Ingresso</span><b>{fmt(c.px,a.decimals)}</b></div>
            <div style={orderRow}><span>Take Profit</span><b>{fmt(c.brokerTP,a.decimals)}</b></div>
            <div style={orderRow}><span>Stop Loss</span><b>{fmt(c.brokerSL,a.decimals)}</b></div>
          </div>
        </div>

        <div style={hintBox}>
          Prezzo manuale sempre disponibile. Il feed live è indicativo: verifica i prezzi effettivi e le specifiche del contratto del broker/prop prima di piazzare gli ordini.
        </div>
      </div>
    </div>
  );
}
