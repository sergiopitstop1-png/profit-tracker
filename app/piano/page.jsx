"use client";
import { useState, useEffect } from "react";
import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
);

function calcMasanielloSmussato(cassaAttuale, obiettivoPerc, numPartite, vittorieAttese, bets) {
  const target = cassaAttuale * (obiettivoPerc / 100);
  const betsDone = bets.filter(b => b.status !== "PENDING").length;
  const betsRemaining = numPartite - betsDone;
  const winsRemaining = vittorieAttese - bets.filter(b => b.status === "WIN").length;
  
  if (betsRemaining <= 0 || winsRemaining <= 0) return 0;

  // Fattore smussamento: inizia al 60% e sale al 100% verso fine piano
  const progress = betsDone / numPartite;
  const smoothFactor = 0.6 + (0.4 * progress);
  
  // Calcola guadagno mancante
  const profittoAttuale = bets.filter(b => b.status === "WIN").reduce((s, b) => s + (b.profitto || 0), 0);
  const targetRimanente = Math.max(0, target - profittoAttuale);
  
  // Puntata base = target rimanente / vittorie rimanenti
  const puntataBase = targetRimanente / winsRemaining;
  
  // Applica smussamento e limita al 5% della cassa attuale
  const puntata = puntataBase * smoothFactor;
  const maxPuntata = cassaAttuale * 0.05;
  
  return Math.min(puntata, maxPuntata);
}

function calcPuntataConQuota(puntataBase, quota) {
  if (!quota || quota <= 1) return puntataBase;
  // Aggiusta per quota: quote basse = puntata più alta, quote alte = puntata più bassa
  const quoteRef = 2.0;
  const fattoreQuota = quoteRef / quota;
  return puntataBase * Math.sqrt(fattoreQuota);
}

export default function Piano() {
  const [plans, setPlans] = useState([]);
  const [activePlan, setActivePlan] = useState(null);
  const [bets, setBets] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showNewPlan, setShowNewPlan] = useState(false);
  const [saving, setSaving] = useState(false);
  const [autoCheckingId, setAutoCheckingId] = useState(null);

  const [formCassa, setFormCassa] = useState("");
  const [formObiettivo, setFormObiettivo] = useState("15");
  const [formPartite, setFormPartite] = useState("10");
  const [formVittorie, setFormVittorie] = useState("6");
  const [formNote, setFormNote] = useState("");

  useEffect(() => { loadData(); }, []);

  const loadData = async () => {
    setLoading(true);
    const { data: plansData } = await supabase
      .from("pronox_plans")
      .select("*")
      .order("created_at", { ascending: false });
    
    const allPlans = plansData || [];
    setPlans(allPlans);
    
    const active = allPlans.find(p => p.status === "ACTIVE");
    if (active) {
      setActivePlan(active);
      const { data: betsData } = await supabase
        .from("pronox_bets")
        .select("*")
        .eq("plan_id", active.id)
        .order("created_at", { ascending: true });
      setBets(betsData || []);
    }
    setLoading(false);
  };

  const createPlan = async () => {
    if (!formCassa || !formObiettivo || !formPartite || !formVittorie) return;
    setSaving(true);
    
    // Chiudi piano attivo se esiste
    if (activePlan) {
      await supabase.from("pronox_plans").update({ status: "CLOSED" }).eq("id", activePlan.id);
    }

    const { data } = await supabase.from("pronox_plans").insert({
      cassa_iniziale: parseFloat(formCassa),
      obiettivo_perc: parseFloat(formObiettivo),
      num_partite: parseInt(formPartite),
      vittorie_attese: parseInt(formVittorie),
      cassa_attuale: parseFloat(formCassa),
      status: "ACTIVE",
      note: formNote,
    }).select().single();

    setSaving(false);
    setShowNewPlan(false);
    setFormCassa(""); setFormNote("");
    loadData();
  };

 const updateBetQuota = async (betId, quota) => {
  const val = parseFloat(quota.replace(",", "."));
  if (isNaN(val) || val <= 1) return;
  await supabase.from("pronox_bets").update({ quota: val }).eq("id", betId);
  setBets(prev => prev.map(b => b.id === betId ? { ...b, quota: val } : b));
};

  const confirmBet = async (bet) => {
    if (!bet.quota || bet.quota <= 1) { alert("Inserisci una quota valida!"); return; }
    if (!activePlan) return;

    const puntataBase = calcMasanielloSmussato(
      activePlan.cassa_attuale, activePlan.obiettivo_perc,
      activePlan.num_partite, activePlan.vittorie_attese, bets
    );
    // Arrotonda all'euro
    const puntata = Math.round(calcPuntataConQuota(puntataBase, bet.quota));

    await supabase.from("pronox_bets").update({ puntata, status: "IN_CORSO" }).eq("id", bet.id);
    await supabase.from("pronox_plans").update({ cassa_attuale: activePlan.cassa_attuale - puntata }).eq("id", activePlan.id);
    
    setActivePlan(prev => ({ ...prev, cassa_attuale: prev.cassa_attuale - puntata }));
    setBets(prev => prev.map(b => b.id === bet.id ? { ...b, puntata, status: "IN_CORSO" } : b));
  };

  const verifyBet = async (bet, outcome) => {
    if (!activePlan) return;
    const profitto = outcome === "WIN" ? Math.round((bet.puntata * bet.quota) - bet.puntata) : -bet.puntata;
    const nuovaCassa = Math.round(activePlan.cassa_attuale + (outcome === "WIN" ? bet.puntata * bet.quota : 0));

    await supabase.from("pronox_bets").update({ status: outcome, profitto }).eq("id", bet.id);
    await supabase.from("pronox_plans").update({ cassa_attuale: nuovaCassa }).eq("id", activePlan.id);

    const updatedBets = bets.map(b => b.id === bet.id ? { ...b, status: outcome, profitto } : b);
    setBets(updatedBets);
    setActivePlan(prev => ({ ...prev, cassa_attuale: nuovaCassa }));

    const totalDone = updatedBets.filter(b => b.status !== "PENDING" && b.status !== "IN_CORSO").length;
    if (totalDone >= activePlan.num_partite) {
      await supabase.from("pronox_plans").update({ status: "COMPLETED" }).eq("id", activePlan.id);
      setActivePlan(prev => ({ ...prev, status: "COMPLETED" }));
    }
  };

  const autoVerifyBet = async (bet) => {
    if (!activePlan) return;
    setAutoCheckingId(bet.id);
    try {
      const r = await fetch(`/api/footballdata?endpoint=matches/${bet.match_id_fd || bet.id}`);
      const d = await r.json();
      const m = d.match || d;
      if (!m || m.status !== "FINISHED") {
        alert("Partita non ancora terminata — riprova più tardi!");
        setAutoCheckingId(null);
        return;
      }
      const ftHome = m.score?.fullTime?.home ?? 0;
      const ftAway = m.score?.fullTime?.away ?? 0;
      const htHome = m.score?.halfTime?.home ?? 0;
      const htAway = m.score?.halfTime?.away ?? 0;
      const total = ftHome + ftAway;
      let outcome = "LOSS";
      const label = bet.prediction_label;
      if (label === "CASA VINCE") outcome = ftHome > ftAway ? "WIN" : "LOSS";
      else if (label === "OSPITE VINCE") outcome = ftAway > ftHome ? "WIN" : "LOSS";
      else if (label === "OVER 2.5") outcome = total > 2.5 ? "WIN" : "LOSS";
      else if (label === "UNDER 2.5") outcome = total < 2.5 ? "WIN" : "LOSS";
      else if (label === "OVER 0.5 HT") outcome = (htHome + htAway) > 0 ? "WIN" : "LOSS";
      else if (label === "BTTS SÌ") outcome = ftHome > 0 && ftAway > 0 ? "WIN" : "LOSS";
      else if (label === "TRADING O0.5 HT → U2.5 LIVE") outcome = (htHome + htAway) >= 1 && total <= 2 ? "WIN" : "LOSS";
      await verifyBet(bet, outcome);
    } catch (e) { console.error(e); alert("Errore nella verifica automatica"); }
    setAutoCheckingId(null);
  };

  const deleteBet = async (betId) => {
    if (!confirm("Rimuovere questa puntata dal piano?")) return;
    await supabase.from("pronox_bets").delete().eq("id", betId);
    setBets(prev => prev.filter(b => b.id !== betId));
  };

  const closePlan = async () => {
    if (!confirm("Chiudere il piano attivo?")) return;
    await supabase.from("pronox_plans").update({ status: "CLOSED" }).eq("id", activePlan.id);
    setActivePlan(null);
    setBets([]);
    loadData();
  };

  // Calcoli stats
  const wins = bets.filter(b => b.status === "WIN").length;
  const losses = bets.filter(b => b.status === "LOSS").length;
  const inCorso = bets.filter(b => b.status === "IN_CORSO").length;
  const pending = bets.filter(b => b.status === "PENDING").length;
  const totalDone = wins + losses;
  const profittoTot = bets.reduce((s, b) => s + (b.profitto || 0), 0);
  const winRate = totalDone > 0 ? ((wins / totalDone) * 100).toFixed(0) : "—";
  
  const puntataConsigliata = activePlan ? calcMasanielloSmussato(
    activePlan.cassa_attuale, activePlan.obiettivo_perc,
    activePlan.num_partite, activePlan.vittorie_attese, bets
  ) : 0;

  const targetEuro = activePlan ? activePlan.cassa_iniziale * (activePlan.obiettivo_perc / 100) : 0;
  const progressPerc = targetEuro > 0 ? Math.min(100, (profittoTot / targetEuro) * 100) : 0;

  const statusColor = (s) => {
    if (s === "WIN") return "#c8f135";
    if (s === "LOSS") return "#ff5c5c";
    if (s === "IN_CORSO") return "#ffd060";
    return "#6b7490";
  };

  const statusLabel = (s) => {
    if (s === "WIN") return "✓ WIN";
    if (s === "LOSS") return "✗ LOSS";
    if (s === "IN_CORSO") return "▶ In corso";
    return "⏳ In attesa";
  };

  return (
    <div style={{ minHeight: "100vh", background: "#0d0f14", color: "#e8ecf5", fontFamily: "system-ui, sans-serif", padding: "24px 16px" }}>
      <div style={{ maxWidth: 760, margin: "0 auto" }}>

        <h1 style={{ fontSize: 28, fontWeight: 800, marginBottom: 4 }}>
          PRONO<span style={{ color: "#c8f135" }}>X</span>
          <span style={{ fontSize: 13, fontWeight: 400, color: "#6b7490" }}> · piano staking</span>
        </h1>
        <div style={{ display: "flex", gap: 16, marginBottom: 24 }}>
          <a href="/" style={{ fontSize: 12, color: "#6b7490", textDecoration: "none" }}>← home</a>
          <a href="/oggi" style={{ fontSize: 12, color: "#6b7490", textDecoration: "none" }}>📅 partite del giorno</a>
          <a href="/archivio" style={{ fontSize: 12, color: "#6b7490", textDecoration: "none" }}>📊 archivio</a>
        </div>

        {loading ? (
          <div style={{ textAlign: "center", color: "#6b7490", padding: "40px 0" }}>Carico...</div>
        ) : (
          <>
            {/* Nessun piano attivo */}
            {!activePlan && !showNewPlan && (
              <div style={{ textAlign: "center", padding: "40px 0" }}>
                <div style={{ fontSize: 14, color: "#6b7490", marginBottom: 20 }}>Nessun piano attivo — creane uno per iniziare</div>
                <button onClick={() => setShowNewPlan(true)}
                  style={{ padding: "14px 32px", borderRadius: 10, border: "none", background: "#c8f135", color: "#0d0f14", fontWeight: 800, fontSize: 15, cursor: "pointer" }}>
                  + Nuovo piano
                </button>
              </div>
            )}

            {/* Form nuovo piano */}
            {showNewPlan && (
              <div style={card}>
                <div style={cardTitle}>NUOVO PIANO</div>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginBottom: 12 }}>
                  <div>
                    <label style={lbl}>Cassa iniziale (€)</label>
                    <input type="number" value={formCassa} onChange={e => setFormCassa(e.target.value)} placeholder="500" style={inp} />
                  </div>
                  <div>
                    <label style={lbl}>Obiettivo (%)</label>
                    <input type="number" value={formObiettivo} onChange={e => setFormObiettivo(e.target.value)} placeholder="15" style={inp} />
                  </div>
                  <div>
                    <label style={lbl}>Numero partite</label>
                    <input type="number" value={formPartite} onChange={e => setFormPartite(e.target.value)} placeholder="10" style={inp} />
                  </div>
                  <div>
                    <label style={lbl}>Vittorie attese</label>
                    <input type="number" value={formVittorie} onChange={e => setFormVittorie(e.target.value)} placeholder="6" style={inp} />
                  </div>
                </div>
                <div style={{ marginBottom: 12 }}>
                  <label style={lbl}>Note (opzionale)</label>
                  <input type="text" value={formNote} onChange={e => setFormNote(e.target.value)} placeholder="Es. Solo Over 2.5 Champions" style={inp} />
                </div>
                {formCassa && (
                  <div style={{ background: "#0d0f14", borderRadius: 8, padding: "10px 14px", marginBottom: 12, fontSize: 13, color: "#4af0c4" }}>
                    Target: €{(parseFloat(formCassa || 0) * parseFloat(formObiettivo || 0) / 100).toFixed(2)} · Puntata iniziale stimata: €{(parseFloat(formCassa || 0) * parseFloat(formObiettivo || 0) / 100 / parseFloat(formVittorie || 1) * 0.6).toFixed(2)}
                  </div>
                )}
                <div style={{ display: "flex", gap: 10 }}>
                  <button onClick={createPlan} disabled={saving}
                    style={{ flex: 1, padding: "12px", borderRadius: 10, border: "none", background: "#c8f135", color: "#0d0f14", fontWeight: 800, fontSize: 14, cursor: "pointer" }}>
                    {saving ? "Salvo..." : "CREA PIANO ↗"}
                  </button>
                  <button onClick={() => setShowNewPlan(false)}
                    style={{ padding: "12px 20px", borderRadius: 10, border: "1px solid #2a2f3f", background: "transparent", color: "#6b7490", cursor: "pointer" }}>
                    Annulla
                  </button>
                </div>
              </div>
            )}

            {/* Piano attivo */}
            {activePlan && (
              <>
                {/* Header piano */}
                <div style={card}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 16 }}>
                    <div>
                      <div style={cardTitle}>PIANO ATTIVO</div>
                      {activePlan.note && <div style={{ fontSize: 12, color: "#6b7490", marginBottom: 8 }}>{activePlan.note}</div>}
                    </div>
                    <div style={{ display: "flex", gap: 8 }}>
                      <button onClick={() => setShowNewPlan(true)}
                        style={{ fontSize: 12, padding: "6px 12px", borderRadius: 8, border: "1px solid #2a2f3f", background: "transparent", color: "#6b7490", cursor: "pointer" }}>
                        + Nuovo
                      </button>
                      <button onClick={closePlan}
                        style={{ fontSize: 12, padding: "6px 12px", borderRadius: 8, border: "1px solid rgba(255,92,92,0.3)", background: "transparent", color: "#ff5c5c", cursor: "pointer" }}>
                        Chiudi
                      </button>
                    </div>
                  </div>

                  {/* Stats piano */}
                  <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 10, marginBottom: 16 }}>
                    {[
                      ["Cassa", "€" + Math.round(activePlan.cassa_attuale), profittoTot >= 0 ? "#c8f135" : "#ff5c5c"],
                      ["Profitto", (profittoTot >= 0 ? "+" : "") + "€" + Math.round(profittoTot), profittoTot >= 0 ? "#c8f135" : "#ff5c5c"],
                      ["Win Rate", winRate + (winRate !== "—" ? "%" : ""), "#4af0c4"],
                      ["Partite", `${totalDone}/${activePlan.num_partite}`, "#ffd060"],
                    ].map(([l, v, c]) => (
                      <div key={l} style={{ background: "#0d0f14", borderRadius: 8, padding: "10px", textAlign: "center" }}>
                        <div style={{ fontSize: 9, color: "#6b7490", fontWeight: 700, letterSpacing: "0.08em", marginBottom: 4, textTransform: "uppercase" }}>{l}</div>
                        <div style={{ fontSize: 16, fontWeight: 700, color: c }}>{v}</div>
                      </div>
                    ))}
                  </div>

                  {/* Barra progresso */}
                  <div style={{ marginBottom: 12 }}>
                    <div style={{ display: "flex", justifyContent: "space-between", fontSize: 11, color: "#6b7490", marginBottom: 5 }}>
                      <span>Progresso verso obiettivo {activePlan.obiettivo_perc}%</span>
                      <span>€{profittoTot.toFixed(2)} / €{targetEuro.toFixed(2)}</span>
                    </div>
                    <div style={{ background: "#2a2f3f", borderRadius: 4, height: 6 }}>
                      <div style={{ width: `${Math.max(0, progressPerc)}%`, height: "100%", borderRadius: 4, background: progressPerc >= 100 ? "#c8f135" : progressPerc >= 50 ? "#4af0c4" : "#ffd060", transition: "width 0.5s" }} />
                    </div>
                  </div>

                  {/* Puntata consigliata */}
                  <div style={{ background: "rgba(200,241,53,0.08)", border: "1px solid rgba(200,241,53,0.25)", borderRadius: 8, padding: "10px 14px", fontSize: 13 }}>
                    <span style={{ color: "#6b7490" }}>Puntata base consigliata: </span>
                    <span style={{ color: "#c8f135", fontWeight: 700, fontFamily: "monospace", fontSize: 16 }}>€{Math.round(puntataConsigliata)}</span>
                    <span style={{ color: "#6b7490", fontSize: 11, marginLeft: 8 }}>(adattata per quota su ogni puntata)</span>
                  </div>
                </div>

                {/* Lista puntate */}
                {bets.length === 0 ? (
                  <div style={{ textAlign: "center", color: "#6b7490", padding: "30px 0", fontSize: 13 }}>
                    Nessuna puntata ancora — vai su <a href="/oggi" style={{ color: "#c8f135" }}>partite del giorno</a> e usa il tasto <strong style={{ color: "#c8f135" }}>+ Piano</strong>
                  </div>
                ) : (
                  bets.map(bet => (
                    <div key={bet.id} style={{ background: "#161920", border: `1px solid ${bet.status === "WIN" ? "rgba(200,241,53,0.3)" : bet.status === "LOSS" ? "rgba(255,92,92,0.2)" : bet.status === "IN_CORSO" ? "rgba(255,208,96,0.25)" : "#2a2f3f"}`, borderRadius: 12, padding: 16, marginBottom: 10 }}>

                      {/* Header */}
                      <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 8 }}>
                        <div style={{ fontSize: 11, color: "#6b7490" }}>{bet.league} · {bet.match_date} · {bet.match_time}</div>
                        <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                          <span style={{ fontSize: 11, padding: "3px 10px", borderRadius: 6, background: `${statusColor(bet.status)}20`, color: statusColor(bet.status), fontWeight: 700 }}>
                            {statusLabel(bet.status)}
                          </span>
                          {bet.status === "PENDING" && (
                            <button onClick={() => deleteBet(bet.id)}
                              style={{ fontSize: 11, padding: "3px 8px", borderRadius: 6, border: "1px solid #2a2f3f", background: "transparent", color: "#6b7490", cursor: "pointer" }}>✕</button>
                          )}
                        </div>
                      </div>

                      {/* Partita */}
                      <div style={{ fontSize: 14, fontWeight: 700, marginBottom: 6 }}>
                        {bet.home_team} <span style={{ color: "#6b7490", fontWeight: 400 }}>vs</span> {bet.away_team}
                      </div>

                      {/* Segnale */}
                      <div style={{ fontSize: 13, color: "#4af0c4", marginBottom: 10 }}>
                        {bet.prediction_label} · <span style={{ color: "#c8f135" }}>{bet.probability}%</span>
                      </div>

                      {/* Quota + puntata */}
                      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 10, marginBottom: 10 }}>
                        <div>
                          <label style={lbl}>Quota</label>
                          {bet.status === "PENDING" ? (
                           <input type="text" placeholder="Es. 1.85"
  defaultValue=""
  onBlur={e => updateBetQuota(bet.id, e.target.value)}
  style={inp} />
                          ) : (
                            <div style={{ ...inp, color: "#ffd060" }}>{bet.quota || "—"}</div>
                          )}
                        </div>
                        <div>
                          <label style={lbl}>Puntata (€)</label>
                          <div style={{ ...inp, color: "#c8f135", fontWeight: 700 }}>
                            {bet.puntata ? "€" + Math.round(bet.puntata) : bet.status === "PENDING" && bet.quota > 1 ? "€" + Math.round(calcPuntataConQuota(puntataConsigliata, bet.quota)) : "—"}
                          </div>
                        </div>
                        <div>
                          <label style={lbl}>Profitto (€)</label>
                          <div style={{ ...inp, color: bet.profitto >= 0 ? "#c8f135" : "#ff5c5c", fontWeight: 700 }}>
                            {bet.profitto !== null && bet.profitto !== undefined ? (bet.profitto >= 0 ? "+" : "") + "€" + Math.round(bet.profitto) : "—"}
                          </div>
                        </div>
                      </div>

                      {/* Azioni */}
                      {bet.status === "PENDING" && bet.quota > 1 && (
                        <button onClick={() => confirmBet(bet)}
                          style={{ width: "100%", padding: "10px", borderRadius: 8, border: "none", background: "#ffd060", color: "#0d0f14", fontWeight: 800, cursor: "pointer", fontSize: 13 }}>
                          ▶ Conferma puntata — €{Math.round(calcPuntataConQuota(puntataConsigliata, bet.quota))}
                        </button>
                      )}

                      {bet.status === "IN_CORSO" && (
                        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                          <button onClick={() => autoVerifyBet(bet)} disabled={autoCheckingId === bet.id}
                            style={{ width: "100%", padding: "10px", borderRadius: 8, border: "1px solid rgba(74,240,196,0.4)", background: "rgba(74,240,196,0.1)", color: "#4af0c4", fontWeight: 800, cursor: "pointer", fontSize: 13 }}>
                            {autoCheckingId === bet.id ? "⏳ Verifico..." : "🔄 Verifica automatica"}
                          </button>
                          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
                            <button onClick={() => verifyBet(bet, "WIN")}
                              style={{ padding: "10px", borderRadius: 8, border: "none", background: "rgba(200,241,53,0.2)", color: "#c8f135", fontWeight: 800, cursor: "pointer", fontSize: 13 }}>
                              ✓ WIN
                            </button>
                            <button onClick={() => verifyBet(bet, "LOSS")}
                              style={{ padding: "10px", borderRadius: 8, border: "none", background: "rgba(255,92,92,0.2)", color: "#ff5c5c", fontWeight: 800, cursor: "pointer", fontSize: 13 }}>
                              ✗ LOSS
                            </button>
                          </div>
                        </div>
                      )}
                    </div>
                  ))
                )}
              </>
            )}
          </>
        )}
      </div>
    </div>
  );
}

const lbl = { fontSize: 11, fontWeight: 700, color: "#6b7490", letterSpacing: "0.06em", textTransform: "uppercase", display: "block", marginBottom: 5 };
const inp = { background: "#0d0f14", border: "1px solid #2a2f3f", borderRadius: 8, padding: "9px 12px", color: "#e8ecf5", fontFamily: "monospace", fontSize: 14, outline: "none", width: "100%", boxSizing: "border-box" };
const card = { background: "#161920", border: "1px solid #2a2f3f", borderRadius: 14, padding: "20px", marginBottom: 14 };
const cardTitle = { fontSize: 11, fontWeight: 700, color: "#6b7490", letterSpacing: "0.12em", textTransform: "uppercase", marginBottom: 14 };
