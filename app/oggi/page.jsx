"use client";
import { useState, useEffect } from "react";
import { createClient } from "../../lib/supabase-browser";
import UserGreeting from "../components/UserGreeting"; // app/components/ sta un livello sopra app/oggi/
import {
  LEAGUES, DOMESTIC_LEAGUES, CUP_LEAGUES,
  getSignals, calibrateFootballProbability, calcEV,
  calcRatings, currentSeasonFor, getSeasonData,
  fetchOddsForLeague, matchOdds, computeFixtureModel,
} from "../../lib/pronox/footballModel";

const API_FD = "/api/footballdata";
const supabase = createClient();

// ─── COMPONENTE ───────────────────────────────────────────────

export default function Oggi() {

  const [date, setDate] = useState(() => new Date().toISOString().split("T")[0]);
  const [selectedLeagues, setSelectedLeagues] = useState([]);
  const [matches, setMatches] = useState([]);
  const [loading, setLoading] = useState(false);
  const [progress, setProgress] = useState("");
  const [filter, setFilter] = useState("all");
  const [savingId, setSavingId] = useState(null);
  const [savedMap, setSavedMap] = useState({});
  const [checkingId, setCheckingId] = useState(null);
  const [pianoMap, setPianoMap] = useState({});
  const [sports, setSports] = useState(["calcio"]);

  const toggleLeague = (code) => {
    setSelectedLeagues(prev => prev.includes(code) ? prev.filter(x => x !== code) : [...prev, code]);
  };

  const toggleSport = (s) => {
    setSports(prev => prev.includes(s) ? prev.filter(x => x !== s) : [...prev, s]);
  };

  const load = async () => {
    setLoading(true);
    setMatches([]);
    setSavedMap({});
    setPianoMap({});
    const all = [];
    const today = date;

    if (sports.includes("calcio") && selectedLeagues.length > 0) {

    const needsDomestic = selectedLeagues.some(c => CUP_LEAGUES.includes(c));
    const leaguesToLoad = needsDomestic
      ? [...new Set([...selectedLeagues, ...DOMESTIC_LEAGUES])]
      : selectedLeagues;

    const allRatings = {};
    const allAvgs = {};
    const allMatches = {};

    for (const code of leaguesToLoad) {
      const league = LEAGUES.find(l => l.code === code);
      if (!league) continue;
      setProgress(`Carico ${league.flag} ${league.name}...`);
      let seasonMatches = await getSeasonData(code, supabase);
      const finishedCount = seasonMatches.filter(m => m.status === "FINISHED").length;

      // Stagione nuova appena iniziata: poche partite finite non bastano per
      // ratings affidabili. Invece di uno switch netto "vecchia stagione SI/NO",
      // mescoliamo lo storico della stagione precedente con quello nuovo — il
      // peso per recenza (timeWeight, già esistente) sfuma da solo l'importanza
      // delle partite vecchie mano a mano che si accumulano quelle nuove, senza
      // salti bruschi nelle previsioni quando si supera una soglia fissa.
      const MIN_FINISHED_FOR_FRESH_DATA = 15; // sopra questa soglia non serve più lo storico vecchio
      let ratingsSource = seasonMatches;
      if (finishedCount < MIN_FINISHED_FOR_FRESH_DATA) {
        const currentSeasonYear = parseInt(currentSeasonFor(code), 10);
        const priorSeason = String(currentSeasonYear - 1);
        const priorMatches = await getSeasonData(code, supabase, priorSeason);
        if (priorMatches.length > 0) {
          ratingsSource = [...priorMatches, ...seasonMatches]; // timeWeight sfuma da sé le più vecchie
          setProgress(`${league.flag} ${league.name}: stagione nuova, integro storico ${priorSeason}...`);
        }
      }

      allMatches[code] = seasonMatches; // per H2H e fixture del giorno resta la stagione corrente
      const { teams, lgAvgHome, lgAvgAway } = calcRatings(ratingsSource, today);
      allRatings[code] = teams;
      allAvgs[code] = { lgAvgHome, lgAvgAway };
    }

    // Carica quote per ogni lega selezionata
    const allOdds = {};
    for (const code of selectedLeagues) {
      const league = LEAGUES.find(l => l.code === code);
      if (!league?.oddsKey) continue;
      setProgress(`Carico quote ${league.flag} ${league.name}...`);
      allOdds[code] = await fetchOddsForLeague(league.oddsKey, date);
    }

    // Carica eventi news recenti (infortuni, squalifiche, formazioni) delle
    // ultime 72 ore - alimentati dal lettore news automatico (pronox_news_signals).
    // Se la query fallisce per qualsiasi motivo, proseguiamo comunque senza
    // penalità piuttosto che bloccare il calcolo dei pronostici.
    let recentNews = [];
    try {
      setProgress("📰 Controllo ultime notizie infortuni/formazioni...");
      const seventyTwoHoursAgo = new Date(Date.now() - 72 * 60 * 60 * 1000).toISOString();
      const { data: newsData, error: newsError } = await supabase
        .from("pronox_news_signals")
        .select("squadra_o_torneo, giocatore, tipo, gravita, affidabilita, sport, note, processato_at")
        .eq("sport", "calcio")
        .gte("processato_at", seventyTwoHoursAgo);
      if (newsError) {
        console.error("Errore caricamento pronox_news_signals:", newsError);
      } else {
        recentNews = newsData || [];
      }
    } catch (e) {
      console.error("Errore caricamento news:", e);
    }

    for (const code of selectedLeagues) {
      const league = LEAGUES.find(l => l.code === code);
      if (!league) continue;
      setProgress(`Cerco partite ${league.flag} ${league.name}...`);

      let fixtures = [];
      for (let attempt = 0; attempt < 4; attempt++) {
        try {
          const r = await fetch(`${API_FD}?endpoint=competitions/${code}/matches&dateFrom=${date}&dateTo=${date}`);
          const d = await r.json();
          fixtures = d.matches || [];
          if (fixtures.length > 0) break;
        } catch (e) {}
        if (attempt < 3) await new Promise(r => setTimeout(r, 2500));
      }

      const seasonMatchesForH2H = allMatches[code] || [];

      for (const fix of fixtures) {
        const {
          lH, lA, probs, h2h, hasRatings, resH, resA, newsImpactH, newsImpactA,
        } = computeFixtureModel({ fix, code, allRatings, allAvgs, seasonMatchesForH2H, recentNews });
        const signals = getSignals(probs);
        const time = fix.utcDate ? new Date(fix.utcDate).toLocaleTimeString("it-IT", { hour: "2-digit", minute: "2-digit" }) : "--:--";

        // Abbina quote bookmaker
        const oddsData = matchOdds(allOdds[code] || {}, fix.homeTeam.name, fix.awayTeam.name);

        // Calcola EV e VALUE per ogni segnale
        const signalsWithEV = signals.map(s => {
          let bookOdds = null;
          if (oddsData) {
            if (s.label === "CASA VINCE") bookOdds = oddsData.o1;
            else if (s.label === "OSPITE VINCE") bookOdds = oddsData.o2;
            else if (s.label === "OVER 2.5") bookOdds = oddsData.oOver25;
            else if (s.label === "UNDER 2.5") bookOdds = oddsData.oUnder25;
          }
          const rawProb = s.prob;
          const calibratedProb = calibrateFootballProbability(s.label, rawProb, oddsData);
          const ev = bookOdds ? calcEV(calibratedProb, bookOdds) : null;
          const isValue = ev !== null && ev > 0.03; // almeno 3% EV sulla confidence V2
          return {
            ...s,
            rawProb,
            prob: calibratedProb,
            fairOdds: 1 / calibratedProb,
            strong: calibratedProb >= 0.72,
            bookOdds, ev, isValue,
          };
        });

        const hasValue = signalsWithEV.some(s => s.isValue);

        all.push({
          id: fix.id,
          home: { name: fix.homeTeam.name, crest: fix.homeTeam.crest },
          away: { name: fix.awayTeam.name, crest: fix.awayTeam.crest },
          time, league, probs, lH, lA,
          signals: signalsWithEV,
          hasRatings, hasValue,
          fdId: fix.id,
          ratingSource: resH?.leagueCode,
          formH: resH?.rating.formStr || "",
          formA: resA?.rating.formStr || "",
          h2h,
          oddsData,
          newsEventsHome: newsImpactH.events,
          newsEventsAway: newsImpactA.events,
        });
      }
    }

    all.sort((a, b) => {
      if (b.hasValue !== a.hasValue) return b.hasValue ? 1 : -1;
      return (b.signals[0]?.prob || 0) - (a.signals[0]?.prob || 0);
    });

    } // fine blocco calcio

    if (sports.includes("tennis")) {
      setProgress("🎾 Cerco partite di tennis...");
      try {
        const r = await fetch(`/api/tennis/matches?date=${date}`);
        const d = await r.json();
        const tennisMatches = (d.matches || []).map((m, i) => {
          const valueSuspiciousSignals = [
            m.isValueA && { label: `${m.playerA.name} vince`, prob: m.probA, isValue: true, ev: m.evA, fairOdds: 1 / m.probA, bookOdds: m.oddsA, color: "#c8f135", strong: m.probA > 0.65 },
            m.isValueB && { label: `${m.playerB.name} vince`, prob: m.probB, isValue: true, ev: m.evB, fairOdds: 1 / m.probB, bookOdds: m.oddsB, color: "#4af0c4", strong: m.probB > 0.65 },
            m.suspiciousA && { label: `${m.playerA.name} vince`, prob: m.probA, isSuspicious: true, ev: m.evA, fairOdds: 1 / m.probA, bookOdds: m.oddsA, color: "#f0794a" },
            m.suspiciousB && { label: `${m.playerB.name} vince`, prob: m.probB, isSuspicious: true, ev: m.evB, fairOdds: 1 / m.probB, bookOdds: m.oddsB, color: "#f0794a" },
          ].filter(Boolean);

          // Nessun value bet e nessun sospetto: se i dati sono affidabili
          // (non lowDataPlayer), mostriamo comunque il pronostico secco del
          // modello — utile per tracciare l'accuratezza nel tempo, anche
          // quando il mercato non lascia margine da sfruttare.
          let signals = valueSuspiciousSignals;
          if (signals.length === 0 && !m.lowDataPlayer) {
            const favorsA = m.probA >= m.probB;
            signals = [{
              label: `${favorsA ? m.playerA.name : m.playerB.name} vince`,
              prob: favorsA ? m.probA : m.probB,
              isPlain: true,
              ev: null,
              fairOdds: 1 / (favorsA ? m.probA : m.probB),
              bookOdds: favorsA ? m.oddsA : m.oddsB,
              color: "#7dd3fc",
            }];
          }

          return {
          isTennis: true,
          id: `tennis_${date}_${i}`,
          tour: m.tour,
          league: { name: m.tournament ? `🎾 ${m.tournament} · ${m.tour}` : `🎾 Tennis ${m.tour}` },
          time: m.commenceTime ? new Date(m.commenceTime).toLocaleTimeString("it-IT", { hour: "2-digit", minute: "2-digit" }) : "--:--",
          home: { name: m.playerA.name, crest: null },
          away: { name: m.playerB.name, crest: null },
          playerA: m.playerA,
          playerB: m.playerB,
          probs: { h: m.probA, a: m.probB },
          oddsData: m.oddsA && m.oddsB ? { o1: m.oddsA, o2: m.oddsB } : null,
          signals,
          hasValue: m.isValueA || m.isValueB,
          statsWarning: !m.playerA.statsFound || !m.playerB.statsFound,
          };
        });
        // Nascondiamo le partite che mostrerebbero SOLO il triangolo di
        // sospetto (nessun segnale VALUE vero, nessun pronostico neutro) —
        // non vengono mai usate, quindi solo rumore visivo. Restano visibili
        // sia le partite con un vero value bet, sia quelle col pronostico
        // neutro (utile per tracciare l'accuratezza), sia quelle mute.
        const tennisMatchesFiltered = tennisMatches.filter(m => m.hasValue || !m.signals.some(s => s.isSuspicious));
        all.push(...tennisMatchesFiltered);
      } catch (e) {
        console.error("Errore caricamento tennis:", e);
      }
    }

    // Feed locale per Lucy: esporta ESATTAMENTE i pronostici calcolati da PronoX
    // (stesso dominio/browser, nessuna nuova API e nessuna duplicazione del modello).
    try {
      const lucyFeed = {
        version: 1,
        date,
        generatedAt: new Date().toISOString(),
        matches: all.map(m => ({
          sport: m.isTennis ? 'tennis' : 'calcio',
          id: m.id,
          league: m.league?.name || '',
          time: m.time || '',
          home: m.home?.name || '',
          away: m.away?.name || '',
          signals: (m.signals || []).filter(x => !x?.isSuspicious).map(x => ({
            label: x.label, type: x.type || (m.isTennis ? 'TENNIS_ML' : ''),
            prob: Number(x.prob || 0), strong: !!x.strong, isValue: !!x.isValue,
            fairOdds: Number(x.fairOdds || 0), bookOdds: Number(x.bookOdds || 0) || null
          })),
          probs: m.probs || null,
          tennisOdds: m.isTennis && m.oddsData ? {
            a: Number(m.oddsData.o1 || 0) || null,
            b: Number(m.oddsData.o2 || 0) || null
          } : null
        }))
      };
      localStorage.setItem('pronox_lucy_feed_v1', JSON.stringify(lucyFeed));
    } catch (e) { console.warn('Feed Lucy non salvato:', e); }

    setMatches(all);
    setLoading(false);
    setProgress("");
  };

  // Modalità Lucy automatica: ProfitTracker apre PronoX invisibilmente sullo
  // stesso dominio. Il motore reale di PronoX calcola e pubblica il feed,
  // senza che Sergio debba aprire o avviare manualmente questa pagina.
  useEffect(() => {
    try {
      const qs=new URLSearchParams(window.location.search);
      if(qs.get('lucy_auto')==='1') load();
    } catch {}
    // Esecuzione una sola volta al mount della pagina nascosta.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const saveSignal = async (match, signal) => {
    const key = `${match.id}_${signal.label}`;
    setSavingId(key);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      // pronox_archive.match_id è un bigint: gli id calcio (numerici, da
      // football-data.org) vanno bene così, ma quelli tennis sono stringhe
      // tipo "tennis_2026-08-01_0" — li convertiamo in un numero sintetico
      // ma comunque univoco (data + indice della partita in quel giorno).
      let numericMatchId;
      if (match.isTennis) {
        const idxPart = match.id.split("_").pop();
        numericMatchId = parseInt(date.replace(/-/g, ""), 10) * 1000 + parseInt(idxPart, 10);
      } else {
        numericMatchId = match.id;
      }
      const { error } = await supabase.from("pronox_archive").insert({
        match_id: numericMatchId, match_date: date, match_time: match.time,
        league: match.league.name, home_team: match.home.name, away_team: match.away.name,
        prediction_type: signal.type, prediction_label: signal.label,
        probability: parseFloat((signal.prob * 100).toFixed(1)),
        lambda_home: match.isTennis ? 0 : parseFloat(match.lH.toFixed(3)),
        lambda_away: match.isTennis ? 0 : parseFloat(match.lA.toFixed(3)),
        status: "PENDING",
        user_id: user?.id || null,
      });
      if (error) {
        console.error("Errore salvataggio pronox_archive:", error);
        alert(`Salvataggio fallito: ${error.message}`);
      } else {
        setSavedMap(prev => ({ ...prev, [key]: "PENDING" }));
      }
    } catch (e) { console.error(e); alert(`Salvataggio fallito: ${e.message || e}`); }
    setSavingId(null);
  };

  const verifyResult = async (match, signal) => {
    const key = `${match.id}_${signal.label}`;
    if (match.isTennis) {
      // Verifica risultati tennis non ancora implementata (serve una fonte
      // punteggi live per il tennis) — per ora si può solo salvare il segnale.
      return;
    }
    setCheckingId(key);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      const r = await fetch(`${API_FD}?endpoint=matches/${match.fdId}`);
      const d = await r.json();
      const m = d.match || d;
      if (!m || m.status !== "FINISHED") { setCheckingId(null); return; }
      const ftHome = m.score?.fullTime?.home ?? 0;
      const ftAway = m.score?.fullTime?.away ?? 0;
      const htHome = m.score?.halfTime?.home ?? 0;
      const htAway = m.score?.halfTime?.away ?? 0;
      const total = ftHome + ftAway;
      let outcome = "LOSS";
      if (signal.label === "CASA VINCE") outcome = ftHome > ftAway ? "WIN" : "LOSS";
      else if (signal.label === "OSPITE VINCE") outcome = ftAway > ftHome ? "WIN" : "LOSS";
      else if (signal.label === "OVER 2.5") outcome = total > 2.5 ? "WIN" : "LOSS";
      else if (signal.label === "UNDER 2.5") outcome = total < 2.5 ? "WIN" : "LOSS";
      else if (signal.label === "BTTS SÌ") outcome = ftHome > 0 && ftAway > 0 ? "WIN" : "LOSS";
      else if (signal.label === "OVER 0.5 HT") outcome = (htHome + htAway) > 0 ? "WIN" : "LOSS";
      else if (signal.label === "TRADING O0.5 HT → U2.5 LIVE") outcome = (htHome + htAway) >= 1 && total <= 2 ? "WIN" : "LOSS";
      await supabase.from("pronox_archive")
        .update({ status: outcome, ft_home_goals: ftHome, ft_away_goals: ftAway, ht_home_goals: htHome, ht_away_goals: htAway, result_checked_at: new Date().toISOString() })
        .eq("match_id", match.id).eq("prediction_label", signal.label).eq("user_id", user?.id);
      setSavedMap(prev => ({ ...prev, [key]: outcome }));
    } catch (e) { console.error(e); }
    setCheckingId(null);
  };

  const addToPlan = async (match, signal) => {
    const key = `${match.id}_${signal.label}_piano`;
    setPianoMap(prev => ({ ...prev, [key]: "saving" }));
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { setPianoMap(prev => ({ ...prev, [key]: null })); return; }
      const { data: plan } = await supabase.from("pronox_plans").select("id").eq("status", "ACTIVE").eq("user_id", user.id).single();
      if (!plan) { alert("Nessun piano attivo!"); setPianoMap(prev => ({ ...prev, [key]: null })); return; }
      const { error } = await supabase.from("pronox_bets").insert({
        plan_id: plan.id, match_date: date, match_time: match.time,
        league: match.league.name, home_team: match.home.name, away_team: match.away.name,
        prediction_label: signal.label, prediction_type: signal.type,
        probability: parseFloat((signal.prob * 100).toFixed(1)),
        lambda_home: match.isTennis ? 0 : parseFloat(match.lH.toFixed(3)),
        lambda_away: match.isTennis ? 0 : parseFloat(match.lA.toFixed(3)),
        status: "PENDING",
        user_id: user.id,
      });
      if (error) {
        console.error("Errore salvataggio pronox_bets:", error);
        alert(`Salvataggio nel piano fallito: ${error.message}`);
        setPianoMap(prev => ({ ...prev, [key]: null }));
      } else {
        setPianoMap(prev => ({ ...prev, [key]: "saved" }));
      }
    } catch (e) { console.error(e); alert(`Salvataggio nel piano fallito: ${e.message || e}`); setPianoMap(prev => ({ ...prev, [key]: null })); }
  };

  const filtered = matches.filter(m => {
    if (filter === "signal") return m.signals.length > 0;
    if (filter === "strong") return m.signals.some(s => s.strong);
    if (filter === "over") return m.probs.o25 > 0.65;
    if (filter === "value") return m.hasValue;
    if (filter === "trading") return m.signals.some(s => s.type === "TRADING");
    return true;
  });

  const strongCount = matches.filter(m => m.signals.some(s => s.strong)).length;
  const signalCount = matches.filter(m => m.signals.length > 0).length;
  const valueCount = matches.filter(m => m.hasValue).length;

  const formColor = (r) => r === "W" ? "#c8f135" : r === "D" ? "#ffd060" : "#ff5c5c";

  return (
    <div style={{ minHeight: "100vh", background: "#0d0f14", color: "#e8ecf5", fontFamily: "system-ui, sans-serif", padding: "24px 16px" }}>
      <div style={{ maxWidth: 860, margin: "0 auto" }}>
        <h1 style={{ fontSize: 26, fontWeight: 800, marginBottom: 4 }}>
          PRONO<span style={{ color: "#c8f135" }}>X</span>
          <span style={{ fontSize: 13, fontWeight: 400, color: "#6b7490" }}> · partite del giorno</span>
        </h1>
        <div style={{ fontSize: 11, color: "#6b7490", marginBottom: 12, letterSpacing: "0.08em" }}>
          © Sergio Apicella · PronoX 2026
        </div>
        <div style={{ display: "flex", gap: 16, marginBottom: 20, alignItems: "center" }}>
          <a href="/" style={{ fontSize: 12, color: "#6b7490", textDecoration: "none" }}>← home</a>
          <a href="/archivio" style={{ fontSize: 12, color: "#6b7490", textDecoration: "none" }}>📊 archivio</a>
          <a href="/storico-pronostici" style={{ fontSize: 12, color: "#6b7490", textDecoration: "none" }}>📈 storico</a>
          <a href="/piano" style={{ fontSize: 12, color: "#c8f135", textDecoration: "none", fontWeight: 700 }}>🎯 piano</a>
          <a href="/proptracker" style={{ fontSize: 12, color: "#6b7490", textDecoration: "none" }}>📈 Prop Tracker</a>
          <div style={{ marginLeft: "auto" }}>
            <UserGreeting />
          </div>
        </div>

        <div style={{ background: "#161920", border: "1px solid #2a2f3f", borderRadius: 14, padding: 20, marginBottom: 16 }}>
          <div style={{ display: "flex", gap: 12, alignItems: "flex-end", flexWrap: "wrap", marginBottom: 14 }}>
            <div>
              <label style={lbl}>Data</label>
              <input type="date" value={date} onChange={e => setDate(e.target.value)} style={{ ...inp, width: 160 }} />
            </div>
            <div>
              <label style={lbl}>Filtra</label>
              <select value={filter} onChange={e => setFilter(e.target.value)} style={{ ...sel, minWidth: 200 }}>
                <option value="all">Tutte le partite</option>
                <option value="value">🎆 Solo VALUE bet</option>
                <option value="signal">Con almeno un segnale</option>
                <option value="strong">Solo segnali forti</option>
                <option value="over">Over 2.5 probabile</option>
                <option value="trading">Trading O0.5 HT + U2.5</option>
              </select>
            </div>
            <div>
              <label style={lbl}>Sport</label>
              <div style={{ display: "flex", gap: 8 }}>
                {[
                  { key: "calcio", label: "⚽ Calcio" },
                  { key: "tennis", label: "🎾 Tennis" },
                ].map(s => (
                  <button key={s.key} onClick={() => toggleSport(s.key)}
                    style={{ padding: "9px 16px", borderRadius: 8, fontSize: 13, fontWeight: 700, cursor: "pointer", border: "1px solid", background: sports.includes(s.key) ? "#c8f135" : "transparent", color: sports.includes(s.key) ? "#0d0f14" : "#6b7490", borderColor: sports.includes(s.key) ? "#c8f135" : "#2a2f3f" }}>
                    {s.label}
                  </button>
                ))}
              </div>
            </div>
          </div>
          {sports.includes("calcio") && (
            <div>
              <label style={lbl}>Leghe (seleziona 1-3 per risultati stabili)</label>
              <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
                {LEAGUES.map(l => (
                  <button key={l.code} onClick={() => toggleLeague(l.code)}
                    style={{ padding: "6px 14px", borderRadius: 20, fontSize: 12, fontWeight: 600, cursor: "pointer", border: "1px solid", background: selectedLeagues.includes(l.code) ? "#c8f135" : "transparent", color: selectedLeagues.includes(l.code) ? "#0d0f14" : "#6b7490", borderColor: selectedLeagues.includes(l.code) ? "#c8f135" : "#2a2f3f" }}>
                    {l.flag} {l.name}
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>

        <button onClick={load} disabled={loading || (sports.includes("calcio") && selectedLeagues.length === 0) || sports.length === 0}
          style={{ width: "100%", padding: 14, fontSize: 15, fontWeight: 800, borderRadius: 10, border: "none", cursor: loading || (sports.includes("calcio") && selectedLeagues.length === 0) || sports.length === 0 ? "not-allowed" : "pointer", background: loading || (sports.includes("calcio") && selectedLeagues.length === 0) || sports.length === 0 ? "#2a2f3f" : "#c8f135", color: loading || (sports.includes("calcio") && selectedLeagues.length === 0) || sports.length === 0 ? "#6b7490" : "#0d0f14", marginBottom: 20 }}>
          {loading ? `⏳ ${progress}` : sports.length === 0 ? "Seleziona uno sport" : (sports.includes("calcio") && selectedLeagues.length === 0) ? "Seleziona almeno una lega" : "ANALIZZA PARTITE DEL GIORNO ↗"}
        </button>

        {matches.length > 0 && (
          <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 10, marginBottom: 16 }}>
            {[
              ["Partite", matches.length, "#e8ecf5"],
              ["Segnali", signalCount, "#4af0c4"],
              ["Forti", strongCount, "#c8f135"],
              ["🎆 VALUE", valueCount, "#ff9f43"],
            ].map(([l, v, c]) => (
              <div key={l} style={{ background: "#161920", border: `1px solid ${l === "🎆 VALUE" && v > 0 ? "rgba(255,159,67,0.4)" : "#2a2f3f"}`, borderRadius: 10, padding: "14px 12px", textAlign: "center" }}>
                <div style={{ fontSize: 10, color: "#6b7490", fontWeight: 700, letterSpacing: "0.08em", marginBottom: 6, textTransform: "uppercase" }}>{l}</div>
                <div style={{ fontSize: 28, fontWeight: 700, color: c }}>{v}</div>
              </div>
            ))}
          </div>
        )}

        {filtered.map(m => (
          m.isTennis ? (
            <div key={m.id} style={{ background: "#161920", border: `1px solid ${m.hasValue ? "rgba(255,159,67,0.5)" : "#2a2f3f"}`, borderRadius: 14, padding: 18, marginBottom: 10 }}>
              <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 12 }}>
                <div style={{ fontSize: 11, color: "#6b7490", fontWeight: 700, letterSpacing: "0.08em" }}>
                  {m.league.name} · {m.time}
                </div>
                <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                  {m.hasValue && <span style={{ fontSize: 11, fontWeight: 800, color: "#ff9f43", background: "rgba(255,159,67,0.15)", padding: "2px 8px", borderRadius: 6 }}>🎆 VALUE</span>}
                  {m.statsWarning && <span style={{ fontSize: 11, color: "#f0794a" }}>⚠ stats stimate</span>}
                </div>
              </div>

              <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 12 }}>
                <div style={{ flex: 1 }}>
                  <div style={{ fontWeight: 700, fontSize: 15 }}>{m.home.name}</div>
                  <div style={{ fontSize: 12, color: "#6b7490", marginTop: 2 }}>{(m.probs.h * 100).toFixed(0)}% · servizio {m.playerA?.servePct ? (m.playerA.servePct * 100).toFixed(0) + "%" : "—"}</div>
                </div>
                <div style={{ color: "#6b7490", fontSize: 13, fontWeight: 600 }}>vs</div>
                <div style={{ flex: 1, textAlign: "right" }}>
                  <div style={{ fontWeight: 700, fontSize: 15 }}>{m.away.name}</div>
                  <div style={{ fontSize: 12, color: "#6b7490", marginTop: 2 }}>{(m.probs.a * 100).toFixed(0)}% · servizio {m.playerB?.servePct ? (m.playerB.servePct * 100).toFixed(0) + "%" : "—"}</div>
                </div>
              </div>

              {m.oddsData && (
                <div style={{ display: "grid", gridTemplateColumns: "repeat(2, 1fr)", gap: 6, marginBottom: 12 }}>
                  {[["1", m.oddsData.o1], ["2", m.oddsData.o2]].map(([l, v]) => (
                    <div key={l} style={{ background: "#0d0f14", border: "1px solid rgba(255,159,67,0.2)", borderRadius: 8, padding: "8px 4px", textAlign: "center" }}>
                      <div style={{ fontSize: 9, color: "#ff9f43", fontWeight: 700, letterSpacing: "0.06em", marginBottom: 3 }}>{l} 📖</div>
                      <div style={{ fontSize: 15, fontWeight: 700, color: "#e8ecf5", fontFamily: "monospace" }}>{v ? v.toFixed(2) : "—"}</div>
                    </div>
                  ))}
                </div>
              )}

              {m.signals.length > 0 ? (
                <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                  {m.signals.map((s, i) => {
                    const key = `${m.id}_${s.label}`;
                    const savedStatus = savedMap[key];
                    return (
                      <div key={i} style={{ borderRadius: 8, border: `1px solid ${s.isValue ? "rgba(255,159,67,0.6)" : s.isSuspicious ? "rgba(240,121,74,0.5)" : "#2a2f3f"}`, background: s.isValue ? "rgba(255,159,67,0.08)" : s.isSuspicious ? "rgba(240,121,74,0.08)" : "rgba(255,255,255,0.03)", padding: "10px 14px" }}>
                        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: (s.isValue || s.isSuspicious) ? 8 : 0 }}>
                          <span style={{ fontSize: 13, fontWeight: 700, color: s.isValue ? "#ff9f43" : s.isSuspicious ? "#f0794a" : "#e8ecf5" }}>
                            {s.isValue ? "🎆 " : s.isSuspicious ? "⚠️ " : "→ "}{s.label}
                          </span>
                          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                            <span style={{ fontSize: 13, fontFamily: "monospace", color: s.color, fontWeight: 600 }}>{(s.prob * 100).toFixed(1)}%</span>
                            {s.bookOdds && <span style={{ fontSize: 12, fontFamily: "monospace", color: "#6b7490" }}>@{s.bookOdds.toFixed(2)}</span>}
                            {!s.isSuspicious && !savedStatus && (
                              <button onClick={() => saveSignal(m, s)} disabled={savingId === key}
                                style={{ fontSize: 12, padding: "5px 12px", borderRadius: 8, border: `1px solid ${s.color}60`, background: `${s.color}15`, color: s.color, cursor: "pointer", fontWeight: 700 }}>
                                {savingId === key ? "..." : "☑ Salva"}
                              </button>
                            )}
                            {savedStatus === "PENDING" && <span style={{ fontSize: 12, padding: "5px 10px", borderRadius: 8, background: "rgba(255,208,96,0.1)", color: "#ffd060", fontWeight: 700 }}>⏳ salvato</span>}
                           
                            {pianoMap[`${m.id}_${s.label}_piano`] === "saved" ? (
    <span style={{ fontSize: 12, padding: "5px 10px", borderRadius: 8, background: "rgba(200,241,53,0.15)", color: "#c8f135", fontWeight: 700 }}>🎯</span>
  ) : (
    <button onClick={() => addToPlan(m, s)} disabled={pianoMap[`${m.id}_${s.label}_piano`] === "saving"}
      style={{ fontSize: 12, padding: "5px 12px", borderRadius: 8, border: "1px solid rgba(200,241,53,0.4)", background: "rgba(200,241,53,0.08)", color: "#c8f135", cursor: "pointer", fontWeight: 700 }}>
      {pianoMap[`${m.id}_${s.label}_piano`] === "saving" ? "..." : "+ Piano"}
    </button>
  )}

                          </div>
                        </div>
                        {s.isValue && s.ev !== null && (
                          <div style={{ fontSize: 11, color: "#ff9f43", background: "rgba(255,159,67,0.1)", borderRadius: 6, padding: "4px 10px", display: "inline-block" }}>
                            Quota equa: {s.fairOdds.toFixed(2)} · Book: {s.bookOdds.toFixed(2)} · EV: +{(s.ev * 100).toFixed(1)}%
                          </div>
                        )}
                        {s.isSuspicious && s.ev !== null && (
                          <div style={{ fontSize: 11, color: "#f0794a", background: "rgba(240,121,74,0.1)", borderRadius: 6, padding: "4px 10px", display: "inline-block" }}>
                            EV +{(s.ev * 100).toFixed(1)}% — fuori scala, probabile stima inaffidabile: non salvabile
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              ) : (
                <div style={{ fontSize: 12, color: "#6b7490", padding: "8px 0" }}>— Nessun value bet · skip</div>
              )}
            </div>
          ) : (
          <div key={m.id} style={{ background: "#161920", border: `1px solid ${m.hasValue ? "rgba(255,159,67,0.5)" : m.signals.some(s => s.strong) ? "rgba(200,241,53,0.4)" : m.signals.length > 0 ? "rgba(74,240,196,0.25)" : "#2a2f3f"}`, borderRadius: 14, padding: 18, marginBottom: 10 }}>

            <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 12 }}>
              <div style={{ fontSize: 11, color: "#6b7490", fontWeight: 700, letterSpacing: "0.08em" }}>
                {m.league.flag} {m.league.name} · {m.time}
              </div>
              <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                {m.hasValue && <span style={{ fontSize: 11, fontWeight: 800, color: "#ff9f43", background: "rgba(255,159,67,0.15)", padding: "2px 8px", borderRadius: 6 }}>🎆 VALUE</span>}
                {m.ratingSource && CUP_LEAGUES.includes(m.league.code) && (
                  <span style={{ fontSize: 10, color: "#4af0c4" }}>dati: {LEAGUES.find(l => l.code === m.ratingSource)?.name}</span>
                )}
                {!m.hasRatings && <span style={{ fontSize: 11, color: "#f0794a" }}>⚠ N/D</span>}
              </div>
            </div>

            <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 12 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 8, flex: 1 }}>
                {m.home.crest && <img src={m.home.crest} style={{ width: 28, height: 28 }} alt="" />}
                <div>
                  <div style={{ fontWeight: 700, fontSize: 15 }}>{m.home.name}</div>
                  {m.formH && (
                    <div style={{ display: "flex", gap: 2, marginTop: 3 }}>
                      {m.formH.split("").map((r, i) => (
                        <span key={i} style={{ fontSize: 9, fontWeight: 700, color: formColor(r), background: `${formColor(r)}20`, padding: "1px 4px", borderRadius: 3 }}>{r}</span>
                      ))}
                    </div>
                  )}
                </div>
              </div>
              <div style={{ textAlign: "center" }}>
                {m.oddsData ? (
                  <div style={{ display: "flex", gap: 6 }}>
                    {[m.oddsData.o1, m.oddsData.oX, m.oddsData.o2].map((q, i) => (
                      <div key={i} style={{ background: "#0d0f14", border: "1px solid #2a2f3f", borderRadius: 6, padding: "4px 8px", textAlign: "center", minWidth: 40 }}>
                        <div style={{ fontSize: 9, color: "#6b7490", marginBottom: 2 }}>{["1","X","2"][i]}</div>
                        <div style={{ fontSize: 13, fontWeight: 700, color: "#e8ecf5", fontFamily: "monospace" }}>{q ? q.toFixed(2) : "—"}</div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div style={{ color: "#6b7490", fontSize: 13, fontWeight: 600 }}>vs</div>
                )}
              </div>
              <div style={{ display: "flex", alignItems: "center", gap: 8, flex: 1, justifyContent: "flex-end" }}>
                <div style={{ textAlign: "right" }}>
                  <div style={{ fontWeight: 700, fontSize: 15 }}>{m.away.name}</div>
                  {m.formA && (
                    <div style={{ display: "flex", gap: 2, marginTop: 3, justifyContent: "flex-end" }}>
                      {m.formA.split("").map((r, i) => (
                        <span key={i} style={{ fontSize: 9, fontWeight: 700, color: formColor(r), background: `${formColor(r)}20`, padding: "1px 4px", borderRadius: 3 }}>{r}</span>
                      ))}
                    </div>
                  )}
                </div>
                {m.away.crest && <img src={m.away.crest} style={{ width: 28, height: 28 }} alt="" />}
              </div>
            </div>

            {m.h2h.count > 0 && (
              <div style={{ fontSize: 11, color: "#6b7490", marginBottom: 10 }}>
                H2H ultimi {m.h2h.count}: <span style={{ color: "#c8f135" }}>{m.h2h.hWins}V</span> - <span style={{ color: "#ffd060" }}>{m.h2h.count - m.h2h.hWins - m.h2h.aWins}P</span> - <span style={{ color: "#4af0c4" }}>{m.h2h.aWins}V</span>
              </div>
            )}

            <div style={{ background: "#0d0f14", border: "1px solid #2a2f3f", borderRadius: 10, padding: "12px 16px", marginBottom: 12 }}>
              <div style={{ fontSize: 10, color: "#6b7490", fontWeight: 700, letterSpacing: "0.1em", textTransform: "uppercase", marginBottom: 10 }}>Gol probabili</div>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  {m.home.crest && <img src={m.home.crest} style={{ width: 20, height: 20 }} alt="" />}
                  <span style={{ fontSize: 13 }}>{m.home.name}</span>
                </div>
                <span style={{ fontSize: 24, fontWeight: 700, color: "#c8f135", fontFamily: "monospace" }}>{m.lH.toFixed(2)}</span>
              </div>
              <div style={{ height: 1, background: "#2a2f3f", marginBottom: 8 }} />
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  {m.away.crest && <img src={m.away.crest} style={{ width: 20, height: 20 }} alt="" />}
                  <span style={{ fontSize: 13 }}>{m.away.name}</span>
                </div>
                <span style={{ fontSize: 24, fontWeight: 700, color: "#4af0c4", fontFamily: "monospace" }}>{m.lA.toFixed(2)}</span>
              </div>
            </div>

            <div style={{ display: "grid", gridTemplateColumns: "repeat(5, 1fr)", gap: 6, marginBottom: m.oddsData ? 8 : 12 }}>
              {[
                ["1", (m.probs.h * 100).toFixed(0) + "%"],
                ["X", (m.probs.d * 100).toFixed(0) + "%"],
                ["2", (m.probs.a * 100).toFixed(0) + "%"],
                ["O2.5", (m.probs.o25 * 100).toFixed(0) + "%"],
                ["BTTS", (m.probs.btts * 100).toFixed(0) + "%"],
              ].map(([l, v]) => (
                <div key={l} style={{ background: "#0d0f14", border: "1px solid #2a2f3f", borderRadius: 8, padding: "8px 4px", textAlign: "center" }}>
                  <div style={{ fontSize: 9, color: "#6b7490", fontWeight: 700, letterSpacing: "0.06em", marginBottom: 3 }}>{l}</div>
                  <div style={{ fontSize: 15, fontWeight: 600 }}>{v}</div>
                </div>
              ))}
            </div>

            {m.oddsData && (
              <div style={{ display: "grid", gridTemplateColumns: "repeat(5, 1fr)", gap: 6, marginBottom: 12 }}>
                {[
                  ["1", m.oddsData.o1],
                  ["X", m.oddsData.oX],
                  ["2", m.oddsData.o2],
                  ["O2.5", m.oddsData.oOver25],
                  ["U2.5", m.oddsData.oUnder25],
                ].map(([l, v]) => (
                  <div key={l} style={{ background: "#0d0f14", border: "1px solid rgba(255,159,67,0.2)", borderRadius: 8, padding: "8px 4px", textAlign: "center" }}>
                    <div style={{ fontSize: 9, color: "#ff9f43", fontWeight: 700, letterSpacing: "0.06em", marginBottom: 3 }}>{l} 📖</div>
                    <div style={{ fontSize: 15, fontWeight: 700, color: "#e8ecf5", fontFamily: "monospace" }}>{v ? v.toFixed(2) : "—"}</div>
                  </div>
                ))}
              </div>
            )}

            {m.signals.length > 0 ? (
              <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                {m.signals.map((s, i) => {
                  const key = `${m.id}_${s.label}`;
                  const savedStatus = savedMap[key];
                  const pianoStatus = pianoMap[`${m.id}_${s.label}_piano`];
                  return (
                    <div key={i} style={{ borderRadius: 8, border: `1px solid ${s.isValue ? "rgba(255,159,67,0.6)" : s.strong ? s.color + "50" : "#2a2f3f"}`, background: s.isValue ? "rgba(255,159,67,0.08)" : s.strong ? `${s.color}10` : "rgba(255,255,255,0.03)", padding: "10px 14px" }}>
                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: s.isValue ? 8 : 0 }}>
                        <span style={{ fontSize: 13, fontWeight: 700, color: s.isValue ? "#ff9f43" : s.strong ? s.color : "#e8ecf5" }}>
                          {s.isValue ? "🎆 " : s.strong ? "🔥 " : "→ "}{s.label}
                        </span>
                        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                          <span style={{ fontSize: 13, fontFamily: "monospace", color: s.color, fontWeight: 600 }}>{(s.prob * 100).toFixed(1)}%</span>
                          {s.bookOdds && (
                            <span style={{ fontSize: 12, fontFamily: "monospace", color: s.isValue ? "#ff9f43" : "#6b7490", fontWeight: s.isValue ? 700 : 400 }}>
                              @{s.bookOdds.toFixed(2)}
                            </span>
                          )}
                          {!savedStatus && (
                            <button onClick={() => saveSignal(m, s)} disabled={savingId === key}
                              style={{ fontSize: 12, padding: "5px 12px", borderRadius: 8, border: `1px solid ${s.color}60`, background: `${s.color}15`, color: s.color, cursor: "pointer", fontWeight: 700 }}>
                              {savingId === key ? "..." : "☑ Salva"}
                            </button>
                          )}
                          {savedStatus === "PENDING" && (
                            <button onClick={() => verifyResult(m, s)} disabled={checkingId === key}
                              style={{ fontSize: 12, padding: "5px 12px", borderRadius: 8, border: "1px solid rgba(255,208,96,0.4)", background: "rgba(255,208,96,0.1)", color: "#ffd060", cursor: "pointer", fontWeight: 700 }}>
                              {checkingId === key ? "..." : "⏳ Verifica"}
                            </button>
                          )}
                          {savedStatus === "WIN" && <span style={{ fontSize: 12, padding: "5px 10px", borderRadius: 8, background: "rgba(200,241,53,0.15)", color: "#c8f135", fontWeight: 700 }}>✓ WIN</span>}
                          {savedStatus === "LOSS" && <span style={{ fontSize: 12, padding: "5px 10px", borderRadius: 8, background: "rgba(255,92,92,0.15)", color: "#ff5c5c", fontWeight: 700 }}>✗ LOSS</span>}
                          {pianoStatus === "saved" ? (
                            <span style={{ fontSize: 12, padding: "5px 10px", borderRadius: 8, background: "rgba(200,241,53,0.15)", color: "#c8f135", fontWeight: 700 }}>🎯</span>
                          ) : (
                            <button onClick={() => addToPlan(m, s)} disabled={pianoStatus === "saving"}
                              style={{ fontSize: 12, padding: "5px 12px", borderRadius: 8, border: "1px solid rgba(200,241,53,0.4)", background: "rgba(200,241,53,0.08)", color: "#c8f135", cursor: "pointer", fontWeight: 700 }}>
                              {pianoStatus === "saving" ? "..." : "+ Piano"}
                            </button>
                          )}
                        </div>
                      </div>
                      {s.isValue && s.ev !== null && (
                        <div style={{ fontSize: 11, color: "#ff9f43", background: "rgba(255,159,67,0.1)", borderRadius: 6, padding: "4px 10px", display: "inline-block" }}>
                          Quota equa: {s.fairOdds.toFixed(2)} · Book: {s.bookOdds.toFixed(2)} · EV: +{(s.ev * 100).toFixed(1)}%
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            ) : (
              <div style={{ fontSize: 12, color: "#6b7490", padding: "8px 0" }}>— Nessun segnale chiaro · skip</div>
            )}
          </div>
          )
        ))}

        {matches.length === 0 && !loading && (
          <div style={{ textAlign: "center", color: "#6b7490", padding: "40px 0", fontSize: 14 }}>
            {sports.includes("calcio") && selectedLeagues.length === 0 ? "Seleziona una o due leghe e clicca Analizza" : "Seleziona sport/leghe e clicca Analizza"}
          </div>
        )}
      </div>
    </div>
  );
}

const lbl = { fontSize: 11, fontWeight: 700, color: "#6b7490", letterSpacing: "0.06em", textTransform: "uppercase", display: "block", marginBottom: 5 };
const inp = { background: "#0d0f14", border: "1px solid #2a2f3f", borderRadius: 8, padding: "9px 12px", color: "#e8ecf5", fontSize: 14, outline: "none", boxSizing: "border-box" };
const sel = { background: "#0d0f14", border: "1px solid #2a2f3f", borderRadius: 8, padding: "9px 12px", color: "#e8ecf5", fontSize: 14, outline: "none", boxSizing: "border-box" };
