export const dynamic = "force-dynamic";
export const revalidate = 0;

/*
  PROP TRADE WATCHDOG v1.04

  Regola fondamentale:
  - il PRIMO TP/SL rilevato diventa evento TERMINALE
  - il trade viene congelato SUBITO su Supabase
  - da quel momento niente altri TP/SL
  - niente altre controtendenze / WAIT / inversioni
  - il frontend ProfitTracker riconcilia poi il Broker reale MT5

  Alert Telegram:
  - primo WAIT
  - secondo WAIT consecutivo
  - forecast opposto all'iniziale
  - M15 contro-trend >= $4
  - M15 contro-trend >= $8
  - TP Prop raggiunto
  - SL Prop raggiunto

  ENV Vercel:
  PROP_WATCHDOG_SECRET
  PROP_WATCHDOG_TELEGRAM_BOT_TOKEN
  PROP_WATCHDOG_TELEGRAM_CHAT_ID
  NEXT_PUBLIC_SUPABASE_URL (o SUPABASE_URL)
  SUPABASE_SERVICE_ROLE_KEY
*/

const SUPABASE_URL =
  process.env.NEXT_PUBLIC_SUPABASE_URL ||
  process.env.SUPABASE_URL;

const SERVICE_KEY =
  process.env.SUPABASE_SERVICE_ROLE_KEY;

const WATCHDOG_SECRET =
  process.env.PROP_WATCHDOG_SECRET;

const TELEGRAM_BOT_TOKEN =
  process.env.PROP_WATCHDOG_TELEGRAM_BOT_TOKEN;

const TELEGRAM_CHAT_ID =
  process.env.PROP_WATCHDOG_TELEGRAM_CHAT_ID;

const ACTIVE_TABLE = "prop_hedge_active_challenges";
const SIGNAL_TABLE = "prop_market_signal_log";
const FEED_TABLE = "prop_market_feed";

function json(data, status = 200) {
  return Response.json(data, {
    status,
    headers: {
      "Cache-Control": "no-store"
    }
  });
}

function headers(extra = {}) {
  return {
    apikey: SERVICE_KEY,
    Authorization: `Bearer ${SERVICE_KEY}`,
    "Content-Type": "application/json",
    ...extra
  };
}

function n(v, d = 0) {
  const x = Number(v);
  return Number.isFinite(x) ? x : d;
}

function fmt(v, digits = 2) {
  const x = Number(v);
  return Number.isFinite(x) ? x.toFixed(digits) : "—";
}

function opposite(d) {
  return d === "BUY" ? "SELL" : d === "SELL" ? "BUY" : "WAIT";
}

function checkEnv() {
  if (!SUPABASE_URL || !SERVICE_KEY) {
    throw new Error("Supabase non configurato");
  }
}

function authOk(request) {
  if (!WATCHDOG_SECRET) return false;
  return request.headers.get("x-watchdog-secret") === WATCHDOG_SECRET;
}

async function rest(path, options = {}) {
  const r = await fetch(`${SUPABASE_URL}/rest/v1/${path}`, {
    ...options,
    headers: headers(options.headers || {}),
    cache: "no-store"
  });

  const t = await r.text();

  let j = null;

  try {
    j = t ? JSON.parse(t) : null;
  } catch {
    j = t;
  }

  if (!r.ok) {
    throw new Error(
      typeof j === "string"
        ? j
        : j?.message || j?.error || `HTTP ${r.status}`
    );
  }

  return j;
}

async function telegram(text) {
  if (!TELEGRAM_BOT_TOKEN || !TELEGRAM_CHAT_ID) {
    return {
      ok: false,
      skipped: "TELEGRAM_ENV_MISSING"
    };
  }

  const r = await fetch(
    `https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendMessage`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        chat_id: TELEGRAM_CHAT_ID,
        text,
        parse_mode: "HTML",
        disable_web_page_preview: true
      })
    }
  );

  const j = await r.json().catch(() => null);

  if (!r.ok || j?.ok === false) {
    throw new Error(
      j?.description || `Telegram HTTP ${r.status}`
    );
  }

  return { ok: true };
}

async function latestSignal(symbol, placedAt) {
  const q =
    `${SIGNAL_TABLE}?symbol=eq.${encodeURIComponent(symbol)}` +
    `&signal_m15_time=gte.${encodeURIComponent(placedAt)}` +
    `&select=*` +
    `&order=signal_m15_time.desc&limit=1`;

  const rows = await rest(q);

  return Array.isArray(rows)
    ? rows[0] || null
    : null;
}

async function feed(symbol) {
  const q =
    `${FEED_TABLE}?market_key=eq.${encodeURIComponent(symbol)}` +
    `&select=market_key,m15,updated_at,last_m15_time&limit=1`;

  const rows = await rest(q);

  return Array.isArray(rows)
    ? rows[0] || null
    : null;
}

function lastBar(row) {
  const bars = Array.isArray(row?.m15)
    ? row.m15
    : [];

  if (!bars.length) return null;

  const b = bars[bars.length - 1];

  return {
    t: n(b?.t, null),
    o: n(b?.o, null),
    h: n(b?.h, null),
    l: n(b?.l, null),
    c: n(b?.c, null)
  };
}

function propHit(active, bar) {
  if (
    !bar ||
    !["BUY", "SELL"].includes(active?.direction)
  ) {
    return null;
  }

  const tp = n(active.propTP, NaN);
  const sl = n(active.propSL, NaN);

  if (
    !Number.isFinite(tp) ||
    !Number.isFinite(sl)
  ) {
    return null;
  }

  const buy = active.direction === "BUY";

  const tpHit = buy
    ? bar.h >= tp
    : bar.l <= tp;

  const slHit = buy
    ? bar.l <= sl
    : bar.h >= sl;

  if (tpHit && slHit) {
    return "AMBIGUOUS";
  }

  if (tpHit) {
    return "TP";
  }

  if (slHit) {
    return "SL";
  }

  return null;
}

function propPL(active, exitPrice) {
  const entry = n(active.entry);
  const contract = n(active.contract);
  const lots = n(active.propLots);
  const quoteToUsd = n(active.quoteToUsd, 1);

  if (
    !entry ||
    !contract ||
    !lots
  ) {
    return 0;
  }

  const sign =
    active.direction === "BUY"
      ? 1
      : -1;

  return (
    (exitPrice - entry) *
    contract *
    lots *
    sign *
    quoteToUsd
  );
}

async function patchChallenge(row, nextState) {
  const q =
    `${ACTIVE_TABLE}` +
    `?user_id=eq.${encodeURIComponent(row.user_id)}` +
    `&challenge_id=eq.${encodeURIComponent(row.challenge_id)}`;

  await rest(q, {
    method: "PATCH",
    headers: {
      Prefer: "return=minimal"
    },
    body: JSON.stringify({
      state: nextState,
      updated_at: new Date().toISOString()
    })
  });
}

async function runOne(row) {
  const state = row?.state || {};
  const active = state?.active || null;

  if (!active) {
    return {
      challenge: row.challenge_id,
      status: "NO_ACTIVE"
    };
  }

  /*
    BLOCCO TERMINALE ASSOLUTO.

    Se il trade è già stato congelato da TP/SL,
    il watchdog non deve più fare NULLA.
  */
  if (
    active.monitoringActive === false ||
    active.terminalDetectedAt ||
    active.terminalStatus === "EXIT_DETECTED"
  ) {
    return {
      challenge: row.challenge_id,
      status: "TERMINAL_LOCKED",
      terminalReason:
        active.terminalReason || null
    };
  }

  const symbol = String(
    active.asset ||
    state.asset ||
    "XAUUSD"
  ).toUpperCase();

  const placedAt =
    active.placedAt ||
    new Date(0).toISOString();

  const signal =
    await latestSignal(symbol, placedAt)
      .catch(() => null);

  const feedRow =
    await feed(symbol)
      .catch(() => null);

  const bar = lastBar(feedRow);

  const mon = {
    enabled: true,
    waitCount: 0,
    firstWaitSent: false,
    secondWaitSent: false,
    reversalSent: false,
    m15Warn4SentFor: null,
    m15Warn8SentFor: null,
    tpSent: false,
    slSent: false,
    lastSignalTime: null,
    ...(active.telegram || {})
  };

  /*
    Se Telegram è già disabilitato,
    non continuiamo il watchdog.
  */
  if (mon.enabled === false) {
    return {
      challenge: row.challenge_id,
      status: "WATCHDOG_DISABLED"
    };
  }

  const alerts = [];

  const initial = String(
    active.initialForecast || "WAIT"
  ).toUpperCase();

  const current = String(
    signal?.forecastDirection ||
    signal?.forecast ||
    signal?.direction ||
    signal?.bias ||
    "WAIT"
  ).toUpperCase();

  const signalKey = String(
    signal?.signal_m15_time ||
    signal?.analyzed_at ||
    signal?.created_at ||
    ""
  );

  // -------------------------
  // FORECAST WATCHDOG
  // -------------------------

  if (
    signalKey &&
    signalKey !== mon.lastSignalTime
  ) {
    mon.lastSignalTime = signalKey;

    if (current === "WAIT") {
      mon.waitCount =
        n(mon.waitCount) + 1;

      if (
        mon.waitCount === 1 &&
        !mon.firstWaitSent
      ) {
        await telegram(
          `🟡 <b>PRE-ALERT — TREND IN INDEBOLIMENTO</b>\n` +
          `${state.name || row.prop_name} · ${symbol}\n` +
          `Forecast apertura: <b>${initial}</b>\n` +
          `Forecast corrente: <b>WAIT</b>\n` +
          `Il Market Engine non conferma più il trend iniziale.\n` +
          `⚠️ Controlla subito l'operazione.`
        );

        mon.firstWaitSent = true;
        alerts.push("FIRST_WAIT");
      } else if (
        mon.waitCount >= 2 &&
        !mon.secondWaitSent
      ) {
        await telegram(
          `🟠 <b>ALERT — RISCHIO INVERSIONE ELEVATO</b>\n` +
          `${state.name || row.prop_name} · ${symbol}\n` +
          `Forecast apertura: <b>${initial}</b>\n` +
          `Secondo WAIT consecutivo.\n` +
          `⚠️ Il trend iniziale sta perdendo forza.`
        );

        mon.secondWaitSent = true;
        alerts.push("SECOND_WAIT");
      }
    } else {
      mon.waitCount = 0;
    }

    if (
      ["BUY", "SELL"].includes(initial) &&
      ["BUY", "SELL"].includes(current)
    ) {
      if (
        current === opposite(initial) &&
        !mon.reversalSent
      ) {
        await telegram(
          `🚨 <b>CONTROTENDENZA CONFERMATA</b>\n` +
          `${state.name || row.prop_name} · ${symbol}\n` +
          `Forecast apertura: <b>${initial}</b>\n` +
          `Forecast corrente: <b>${current}</b>\n` +
          `${mon.waitCount > 0
            ? `WAIT precedenti: <b>${mon.waitCount}</b>\n`
            : ""}` +
          `🔴 Il trend si è girato contro lo scenario iniziale.\n` +
          `<b>VALUTA CHIUSURA IMMEDIATA.</b>`
        );

        mon.reversalSent = true;
        alerts.push("REVERSAL");
      }
    }
  }

  // -------------------------
  // M15 CONTROTREND
  // -------------------------

  if (
    bar &&
    Number.isFinite(bar.o) &&
    Number.isFinite(bar.c)
  ) {
    const body =
      bar.c - bar.o;

    const against =
      initial === "SELL"
        ? body
        : initial === "BUY"
          ? -body
          : 0;

    const barKey =
      String(bar.t);

    if (
      against >= 8 &&
      mon.m15Warn8SentFor !== barKey
    ) {
      await telegram(
        `🚨🚨 <b>M15 FORTE CONTROTENDENZA — $${fmt(against, 2)}</b>\n` +
        `${state.name || row.prop_name} · ${symbol}\n` +
        `Forecast apertura: <b>${initial}</b>\n` +
        `M15 Open ${fmt(bar.o, 2)} → Close ${fmt(bar.c, 2)}\n` +
        `<b>Movimento contro trend ≥ $8.</b>\n` +
        `🔴 CONTROLLA / VALUTA CHIUSURA SUBITO.`
      );

      mon.m15Warn8SentFor = barKey;
      mon.m15Warn4SentFor = barKey;

      alerts.push("M15_8");
    } else if (
      against >= 4 &&
      mon.m15Warn4SentFor !== barKey
    ) {
      await telegram(
        `⚠️ <b>M15 CONTROTENDENZA — $${fmt(against, 2)}</b>\n` +
        `${state.name || row.prop_name} · ${symbol}\n` +
        `Forecast apertura: <b>${initial}</b>\n` +
        `M15 Open ${fmt(bar.o, 2)} → Close ${fmt(bar.c, 2)}\n` +
        `🟡 Movimento contro trend ≥ $4. Controlla l'operazione.`
      );

      mon.m15Warn4SentFor = barKey;

      alerts.push("M15_4");
    }
  }

  // -------------------------
  // TP / SL — TERMINAL LOCK
  // -------------------------

  const hit =
    propHit(active, bar);

  if (hit === "AMBIGUOUS") {
    if (
      mon.ambiguousSentFor !==
      String(bar?.t)
    ) {
      await telegram(
        `⚠️ <b>TP E SL ATTRAVERSATI NELLA STESSA M15</b>\n` +
        `${state.name || row.prop_name} · ${symbol}\n` +
        `Ordine intrabar non determinabile.\n` +
        `Verifica manualmente.`
      );

      mon.ambiguousSentFor =
        String(bar?.t);

      alerts.push("AMBIGUOUS");
    }
  } else if (
    hit === "TP" ||
    hit === "SL"
  ) {
    const exit =
      hit === "TP"
        ? n(active.propTP)
        : n(active.propSL);

    const pl =
      propPL(active, exit);

    const newBal =
      n(active.propBalanceStart) +
      pl;

    const detectedAt =
      new Date().toISOString();

    /*
      IMPORTANTISSIMO:

      CONGELIAMO SUBITO SU SUPABASE
      PRIMA DI TELEGRAM
      PRIMA DI QUALSIASI ALTRA COSA.

      Così anche se dopo qualcosa fallisce,
      il trade non può tornare LIVE.
    */

    const lockedMon = {
      ...mon,
      enabled: false,
      tpSent:
        hit === "TP"
          ? true
          : !!mon.tpSent,
      slSent:
        hit === "SL"
          ? true
          : !!mon.slSent
    };

    const terminalLockedState = {
      ...state,

      active: {
        ...active,

        monitoringActive: false,
        terminalAutoCloseEnabled: false,

        terminalDetectedAt:
          detectedAt,

        terminalReason:
          hit,

        terminalPrice:
          exit,

        terminalPropPL:
          pl,

        terminalBalanceTheoretical:
          newBal,

        terminalStatus:
          "EXIT_DETECTED",

        telegram:
          lockedMon
      },

      lastTerminalDetected: {
        event:
          hit,

        exitPrice:
          exit,

        propPL:
          pl,

        balanceTheoretical:
          newBal,

        at:
          detectedAt,

        status:
          "IN_ATTESA_RICONCILIAZIONE_BROKER"
      }
    };

    await patchChallenge(
      row,
      terminalLockedState
    );

    /*
      Solo DOPO il lock
      mandiamo Telegram.
    */

    await telegram(
      `${hit === "TP" ? "✅" : "🚨"} <b>${hit} PROP RAGGIUNTO</b>\n` +
      `${state.name || row.prop_name} · ${symbol}\n` +
      `Direzione Prop: <b>${active.direction}</b>\n` +
      `Entry: ${fmt(active.entry, 2)}\n` +
      `${hit}: ${fmt(exit, 2)}\n` +
      `P/L Prop teorico: <b>${pl >= 0 ? "+" : ""}$${fmt(pl, 2)}</b>\n` +
      `Saldo Prop teorico: <b>$${fmt(newBal, 2)}</b>\n` +
      `⏳ Evento congelato. ProfitTracker sta riconciliando il Broker MT5.`
    );

    alerts.push(hit);

    return {
      challenge:
        row.challenge_id,

      status:
        `TERMINAL_LOCK_${hit}`,

      alerts,

      balanceTheoretical:
        newBal
    };
  }

  // -------------------------
  // SALVA STATO MONITORAGGIO
  // -------------------------

  const nextState = {
    ...state,

    active: {
      ...active,
      telegram:
        mon
    }
  };

  await patchChallenge(
    row,
    nextState
  );

  return {
    challenge:
      row.challenge_id,

    status:
      "MONITORING",

    alerts
  };
}

async function runWatchdog() {
  const rows = await rest(
    `${ACTIVE_TABLE}?select=user_id,challenge_id,prop_name,state,updated_at`
  );

  if (!Array.isArray(rows)) {
    return [];
  }

  const out = [];

  for (const row of rows) {
    try {
      const result =
        await runOne(row);

      out.push(result);
    } catch (e) {
      out.push({
        challenge:
          row?.challenge_id || null,

        status:
          "ERROR",

        error:
          e?.message || String(e)
      });
    }
  }

  return out;
}

export async function GET(request) {
  try {
    checkEnv();

    if (!authOk(request)) {
      return json(
        {
          ok: false,
          error: "Unauthorized"
        },
        401
      );
    }

    const results =
      await runWatchdog();

    return json({
      ok: true,
      version: "1.04",
      results,
      at:
        new Date().toISOString()
    });
  } catch (e) {
    return json(
      {
        ok: false,
        version: "1.04",
        error:
          e?.message || String(e)
      },
      500
    );
  }
}

export async function POST(request) {
  try {
    checkEnv();

    /*
      Manteniamo compatibilità con le chiamate
      frontend esistenti.
    */

    const auth =
      request.headers.get("authorization") || "";

    const body =
      await request.json().catch(() => ({}));

    const action =
      String(body?.action || "");

    if (action === "lab_test_telegram") {
      await telegram(
        `✅ <b>TEST PROFITTRACKER</b>\n` +
        `Telegram collegato correttamente.`
      );

      return json({
        ok: true
      });
    }

    if (action === "manual_close") {
      await telegram(
        `✅ <b>CHIUSURA MANUALE PROFITTRACKER</b>\n` +
        `${body?.propName || "Prop"} · ${body?.symbol || "—"}\n` +
        `Prop: ${body?.propDirection || "—"}\n` +
        `Broker: ${body?.brokerDirection || "—"}\n` +
        `P/L Prop: ${Number(body?.propPL) >= 0 ? "+" : ""}$${fmt(body?.propPL, 2)}\n` +
        `P/L Broker: ${Number(body?.brokerPL) >= 0 ? "+" : ""}$${fmt(body?.brokerPL, 2)}`
      );

      return json({
        ok: true
      });
    }

    if (
      action === "lab_trade_opened" ||
      action === "lab_trade_tp" ||
      action === "lab_trade_sl" ||
      action === "lab_trade_manual_close"
    ) {
      await telegram(
        `📊 <b>TRADING LAB</b>\n` +
        `${body?.symbol || "—"} · ${body?.side || "—"}\n` +
        `Volume: ${body?.volume ?? "—"}\n` +
        `${Number.isFinite(Number(body?.entry))
          ? `Entry: ${fmt(body.entry, 5)}\n`
          : ""}` +
        `${Number.isFinite(Number(body?.exitPrice))
          ? `Exit: ${fmt(body.exitPrice, 5)}\n`
          : ""}` +
        `${Number.isFinite(Number(body?.realizedPL))
          ? `P/L: ${Number(body.realizedPL) >= 0 ? "+" : ""}$${fmt(body.realizedPL, 2)}`
          : ""}`
      );

      return json({
        ok: true
      });
    }

    /*
      Se non è una notifica frontend,
      trattiamo POST come esecuzione watchdog
      se arriva col secret.
    */

    if (
      request.headers.get("x-watchdog-secret") ===
      WATCHDOG_SECRET
    ) {
      const results =
        await runWatchdog();

      return json({
        ok: true,
        version: "1.04",
        results,
        at:
          new Date().toISOString()
      });
    }

    /*
      Compatibilità permissiva con frontend già autenticato:
      se arriva Authorization, non lo usiamo per leggere Supabase,
      ma permettiamo solo le azioni esplicite sopra.
    */

    if (auth) {
      return json(
        {
          ok: false,
          error: "Azione non supportata"
        },
        400
      );
    }

    return json(
      {
        ok: false,
        error: "Unauthorized"
      },
      401
    );
  } catch (e) {
    return json(
      {
        ok: false,
        version: "1.04",
        error:
          e?.message || String(e)
      },
      500
    );
  }
}
