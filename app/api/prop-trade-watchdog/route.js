export const dynamic = "force-dynamic";
export const revalidate = 0;

/*
  PROP TRADE WATCHDOG v1.04

  Monitora tutte le challenge con state.active presente.
  Funziona anche per operazioni aperte ESTERNAMENTE.

  Alert Telegram:
  - primo WAIT
  - secondo WAIT consecutivo
  - forecast opposto all'iniziale
  - M15 contro-trend >= $4
  - M15 contro-trend >= $8
  - TP Prop raggiunto
  - SL Prop raggiunto

  Su TP/SL aggiorna automaticamente il saldo Prop teorico,
  chiude il monitoraggio e registra lo storico.

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


const ACTIVE_TABLE =
  "prop_hedge_active_challenges";

const SIGNAL_TABLE =
  "prop_market_signal_log";

const FEED_TABLE =
  "prop_market_feed";

const HISTORY_TABLE =
  "prop_hedge_operations";


function json(data, status = 200) {
  return Response.json(
    data,
    {
      status,
      headers: {
        "Cache-Control": "no-store"
      }
    }
  );
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


function opposite(d) {
  return d === "BUY"
    ? "SELL"
    : d === "SELL"
      ? "BUY"
      : "WAIT";
}


function checkEnv() {

  if (
    !SUPABASE_URL ||
    !SERVICE_KEY
  ) {
    throw new Error(
      "Supabase non configurato"
    );
  }

}


function authOk(request) {

  if (!WATCHDOG_SECRET) {
    return false;
  }

  return (
    request.headers.get(
      "x-watchdog-secret"
    ) === WATCHDOG_SECRET
  );

}


async function rest(
  path,
  options = {}
) {

  const r = await fetch(
    `${SUPABASE_URL}/rest/v1/${path}`,
    {
      ...options,

      headers:
        headers(
          options.headers || {}
        ),

      cache:
        "no-store"
    }
  );


  const t =
    await r.text();


  let j = null;

  try {
    j = t
      ? JSON.parse(t)
      : null;
  }
  catch {
    j = t;
  }


  if (!r.ok) {

    throw new Error(
      typeof j === "string"
        ? j
        : (
            j?.message ||
            j?.error ||
            `HTTP ${r.status}`
          )
    );

  }


  return j;
}


async function telegram(text) {

  if (
    !TELEGRAM_BOT_TOKEN ||
    !TELEGRAM_CHAT_ID
  ) {

    return {
      ok: false,
      skipped:
        "TELEGRAM_ENV_MISSING"
    };

  }


  const r = await fetch(
    `https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendMessage`,
    {
      method:
        "POST",

      headers: {
        "Content-Type":
          "application/json"
      },

      body:
        JSON.stringify({
          chat_id:
            TELEGRAM_CHAT_ID,

          text,

          parse_mode:
            "HTML",

          disable_web_page_preview:
            true
        })
    }
  );


  const j =
    await r
      .json()
      .catch(
        () => null
      );


  if (
    !r.ok ||
    j?.ok === false
  ) {

    throw new Error(
      j?.description ||
      `Telegram HTTP ${r.status}`
    );

  }


  return {
    ok: true
  };
}


async function latestSignal(
  symbol,
  placedAt
) {

  const q =

    `${SIGNAL_TABLE}?symbol=eq.${encodeURIComponent(symbol)}` +

    `&signal_m15_time=gte.${encodeURIComponent(placedAt)}` +

    `&select=*` +

    `&order=signal_m15_time.desc&limit=1`;


  const rows =
    await rest(q);


  return Array.isArray(rows)
    ? rows[0] || null
    : null;
}


async function feed(symbol) {

  const q =

    `${FEED_TABLE}?market_key=eq.${encodeURIComponent(symbol)}` +

    `&select=market_key,m15,updated_at,last_m15_time&limit=1`;


  const rows =
    await rest(q);


  return Array.isArray(rows)
    ? rows[0] || null
    : null;
}


function lastBar(row) {

  const bars =
    Array.isArray(
      row?.m15
    )
      ? row.m15
      : [];


  if (!bars.length) {
    return null;
  }


  const b =
    bars[
      bars.length - 1
    ];


  return {

    t:
      n(
        b?.t,
        null
      ),

    o:
      n(
        b?.o,
        null
      ),

    h:
      n(
        b?.h,
        null
      ),

    l:
      n(
        b?.l,
        null
      ),

    c:
      n(
        b?.c,
        null
      )
  };
}


function propHit(
  active,
  bar
) {

  if (
    !bar ||
    ![
      "BUY",
      "SELL"
    ].includes(
      active?.direction
    )
  ) {
    return null;
  }


  const tp =
    n(
      active.propTP,
      NaN
    );

  const sl =
    n(
      active.propSL,
      NaN
    );


  if (
    !Number.isFinite(tp) ||
    !Number.isFinite(sl)
  ) {
    return null;
  }


  const buy =
    active.direction === "BUY";


  const tpHit =
    buy
      ? bar.h >= tp
      : bar.l <= tp;


  const slHit =
    buy
      ? bar.l <= sl
      : bar.h >= sl;


  if (
    tpHit &&
    slHit
  ) {
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


function propPL(
  active,
  exit
) {

  const sign =
    active.direction === "BUY"
      ? 1
      : -1;


  return (

    (
      exit -
      n(active.entry)
    )

    *

    n(
      active.contract,
      100
    )

    *

    n(
      active.propLots
    )

    *

    sign

    *

    n(
      active.quoteToUsd,
      1
    )

  );
}


function fmt(
  v,
  d = 2
) {

  return Number(v)
    .toFixed(d);
}


async function patchChallenge(
  row,
  state
) {

  const q =

    `${ACTIVE_TABLE}?user_id=eq.${encodeURIComponent(row.user_id)}` +

    `&challenge_id=eq.${encodeURIComponent(row.challenge_id)}`;


  await rest(
    q,
    {
      method:
        "PATCH",

      headers: {
        Prefer:
          "return=minimal"
      },

      body:
        JSON.stringify({
          state,
          updated_at:
            new Date()
              .toISOString()
        })
    }
  );

}


async function insertHistory(
  row,
  state,
  active,
  exit,
  event,
  pl
) {

  const brokerDirection =

    active.brokerDirection ||

    opposite(
      active.direction
    );


  const payload = {

    user_id:
      row.user_id,

    opened_at:
      active.placedAt,

    closed_at:
      new Date()
        .toISOString(),

    prop_name:
      state.name ||
      row.prop_name ||
      "Prop",

    asset:
      active.asset,

    prop_direction:
      active.direction,

    broker_direction:
      brokerDirection,

    status:
      "closed",

    account_size:
      n(
        state.accountSize,
        null
      ),

    prop_balance_start:
      n(
        active.propBalanceStart,
        null
      ),

    prop_balance_end:
      n(
        active.propBalanceStart
      ) + pl,

    broker_balance_start:
      n(
        active.brokerBalanceStart,
        null
      ),

    broker_balance_end:
      null,

    prop_cost:
      n(
        state.propCost,
        null
      ),

    final_profit_target:
      n(
        state.finalProfitTarget,
        null
      ),

    risk_usd:
      n(
        state.risk,
        null
      ),

    sl_distance:
      Math.abs(
        n(active.entry) -
        n(active.propSL)
      ),

    tp_prop_usd:
      n(
        state.tpProp,
        null
      ),

    dd_max_pct:
      n(
        state.ddMax,
        null
      ),

    max_margin_pct:
      n(
        state.maxMarginPct,
        null
      ),

    leverage:
      n(
        state.leverage,
        null
      ),

    broker_exposure_start:
      n(
        state.brokerExposure,
        null
      ),

    entry_price:
      n(
        active.entry,
        null
      ),

    exit_price:
      exit,

    prop_lots:
      n(
        active.propLots,
        null
      ),

    broker_lots:
      n(
        active.brokerLots,
        null
      ),

    prop_tp_price:
      n(
        active.propTP,
        null
      ),

    prop_sl_price:
      n(
        active.propSL,
        null
      ),

    broker_tp_price:
      n(
        active.brokerTP,
        null
      ),

    broker_sl_price:
      n(
        active.brokerSL,
        null
      ),

    broker_max_loss:
      n(
        active.maxBrokerLossAtEntry,
        null
      ),

    prop_pl:
      pl,

    broker_pl:
      null,

    combined_pl:
      pl,

    used_manual_prop_pl:
      false,

    used_manual_broker_pl:
      false,

    metadata: {

      automatic_trigger:
        event,

      execution_source:
        active.executionSource ||
        "unknown",

      telegram_watchdog:
        true,

      balance_status:
        "CALCOLATO_NON_CONFERMATO"
    }
  };


  await rest(
    HISTORY_TABLE,
    {
      method:
        "POST",

      headers: {
        Prefer:
          "return=minimal"
      },

      body:
        JSON.stringify(
          payload
        )
    }
  );

}


async function processChallenge(row) {

  const state =
    row?.state || {};


  const active =
    state?.active;


  if (
    !active ||
    active.monitoringActive === false
  ) {

    return {
      challenge:
        row.challenge_id,

      status:
        "NO_ACTIVE"
    };

  }


  const symbol =

    active.asset ||

    state.asset ||

    "XAUUSD";


  const [
    sig,
    fd
  ] =
    await Promise.all([
      latestSignal(
        symbol,
        active.placedAt
      ),
      feed(symbol)
    ]);


  const bar =
    lastBar(fd);


  const mon = {
    ...(
      active.telegram ||
      {}
    )
  };


  const alerts = [];


  const initial =

    String(
      active.initialForecast ||

      opposite(
        active.direction
      ) ||

      "WAIT"
    )
      .toUpperCase();


  const current =

    String(
      sig?.forecast_direction ||
      "WAIT"
    )
      .toUpperCase();


  const signalKey =

    String(
      sig?.signal_m15_time ||
      sig?.id ||
      ""
    );


  if (
    signalKey &&
    signalKey !==
      mon.lastSignalTime
  ) {

    mon.lastSignalTime =
      signalKey;


    if (
      current === "WAIT"
    ) {

      mon.waitCount =
        n(
          mon.waitCount
        ) + 1;


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


        mon.firstWaitSent =
          true;


        alerts.push(
          "FIRST_WAIT"
        );

      }

      else if (
        mon.waitCount >= 2 &&
        !mon.secondWaitSent
      ) {

        await telegram(

          `🟠 <b>ALERT — RISCHIO INVERSIONE ELEVATO</b>\n` +

          `${state.name || row.prop_name} · ${symbol}\n` +

          `Forecast apertura: <b>${initial}</b>\n` +

          `Secondo WAIT consecutivo.\n` +

          `⚠️ Valuta seriamente la chiusura dell'operazione.`

        );


        mon.secondWaitSent =
          true;


        alerts.push(
          "SECOND_WAIT"
        );

      }

    }

    else if (
      [
        "BUY",
        "SELL"
      ].includes(
        current
      )
    ) {

      if (
        current === initial
      ) {

        mon.waitCount =
          0;

        mon.firstWaitSent =
          false;

        mon.secondWaitSent =
          false;

        mon.reversalSent =
          false;

      }

      else if (
        !mon.reversalSent
      ) {

        await telegram(

          `🚨 <b>CONTROTENDENZA CONFERMATA</b>\n` +

          `${state.name || row.prop_name} · ${symbol}\n` +

          `Forecast apertura: <b>${initial}</b>\n` +

          `Forecast corrente: <b>${current}</b>\n` +

          `${
            mon.waitCount > 0
              ? `WAIT precedenti: <b>${mon.waitCount}</b>\n`
              : ""
          }` +

          `🔴 Il trend si è girato contro lo scenario iniziale.\n` +

          `<b>VALUTA CHIUSURA IMMEDIATA.</b>`

        );


        mon.reversalSent =
          true;


        alerts.push(
          "REVERSAL"
        );

      }

    }

  }


  if (
    bar &&
    Number.isFinite(bar.o) &&
    Number.isFinite(bar.c)
  ) {

    const body =
      bar.c -
      bar.o;


    const against =

      initial === "SELL"

        ? body

        : initial === "BUY"

          ? -body

          : 0;


    const barKey =
      String(
        bar.t
      );


    if (
      against >= 8 &&
      mon.m15Warn8SentFor !==
        barKey
    ) {

      await telegram(

        `🚨🚨 <b>M15 FORTE CONTROTENDENZA — $${fmt(against,2)}</b>\n` +

        `${state.name || row.prop_name} · ${symbol}\n` +

        `Forecast apertura: <b>${initial}</b>\n` +

        `M15 Open ${fmt(bar.o,2)} → Close ${fmt(bar.c,2)}\n` +

        `<b>Movimento contro trend ≥ $8.</b>\n` +

        `🔴 CONTROLLA / VALUTA CHIUSURA SUBITO.`

      );


      mon.m15Warn8SentFor =
        barKey;

      mon.m15Warn4SentFor =
        barKey;


      alerts.push(
        "M15_8"
      );

    }

    else if (
      against >= 4 &&
      mon.m15Warn4SentFor !==
        barKey
    ) {

      await telegram(

        `⚠️ <b>M15 CONTROTENDENZA — $${fmt(against,2)}</b>\n` +

        `${state.name || row.prop_name} · ${symbol}\n` +

        `Forecast apertura: <b>${initial}</b>\n` +

        `M15 Open ${fmt(bar.o,2)} → Close ${fmt(bar.c,2)}\n` +

        `🟡 Movimento contro trend ≥ $4. Controlla l'operazione.`

      );


      mon.m15Warn4SentFor =
        barKey;


      alerts.push(
        "M15_4"
      );

    }

  }


  const hit =
    propHit(
      active,
      bar
    );


  if (
    hit === "AMBIGUOUS"
  ) {

    if (
      mon.ambiguousSentFor !==
      String(
        bar?.t
      )
    ) {

      await telegram(

        `⚠️ <b>TP E SL ATTRAVERSATI NELLA STESSA M15</b>\n` +

        `${state.name || row.prop_name} · ${symbol}\n` +

        `Ordine intrabar non determinabile. Verifica manualmente.`

      );


      mon.ambiguousSentFor =
        String(
          bar?.t
        );


      alerts.push(
        "AMBIGUOUS"
      );

    }

  }

  else if (
    hit === "TP" ||
    hit === "SL"
  ) {

    const exit =

      hit === "TP"
        ? n(active.propTP)
        : n(active.propSL);


    const pl =
      propPL(
        active,
        exit
      );


    const newBal =

      n(
        active.propBalanceStart
      ) + pl;


    if (
      (
        hit === "TP" &&
        !mon.tpSent
      )
      ||
      (
        hit === "SL" &&
        !mon.slSent
      )
    ) {

      await telegram(

        `${hit === "TP" ? "✅" : "🚨"} <b>${hit} PROP RAGGIUNTO</b>\n` +

        `${state.name || row.prop_name} · ${symbol}\n` +

        `Direzione Prop: <b>${active.direction}</b>\n` +

        `Entry: ${fmt(active.entry,2)}\n` +

        `${hit}: ${fmt(exit,2)}\n` +

        `P/L Prop calcolato: <b>${pl >= 0 ? "+" : ""}$${fmt(pl,2)}</b>\n` +

        `Nuovo saldo Prop calcolato: <b>$${fmt(newBal,2)}</b>\n` +

        `ProfitTracker registra automaticamente l'esito.`

      );


      if (
        hit === "TP"
      ) {
        mon.tpSent =
          true;
      }
      else {
        mon.slSent =
          true;
      }


      alerts.push(
        hit
      );

    }


    await insertHistory(
      row,
      state,
      active,
      exit,
      hit,
      pl
    );


    const nextState = {

      ...state,

      accountBalance:
        String(
          Number(
            newBal.toFixed(2)
          )
        ),

      active:
        null,

      closePropPL:
        "",

      closeBrokerPL:
        "",

      autoPrice:
        true,

      lastAutoClose: {

        event:
          hit,

        exitPrice:
          exit,

        propPL:
          pl,

        balanceAfter:
          newBal,

        at:
          new Date()
            .toISOString(),

        status:
          "CALCOLATO_NON_CONFERMATO"
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
        `AUTO_${hit}`,

      alerts,

      balance:
        newBal
    };

  }


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


async function authenticatedUser(
  request
) {

  const auth =
    String(
      request.headers.get(
        "authorization"
      ) || ""
    );


  if (
    !auth
      .toLowerCase()
      .startsWith(
        "bearer "
      )
  ) {
    return null;
  }


  const r =
    await fetch(
      `${SUPABASE_URL}/auth/v1/user`,
      {
        method:
          "GET",

        headers: {
          apikey:
            SERVICE_KEY,

          Authorization:
            auth
        },

        cache:
          "no-store"
      }
    );


  if (!r.ok) {
    return null;
  }


  const user =
    await r
      .json()
      .catch(
        () => null
      );


  return user?.id
    ? user
    : null;
}


async function sendManualCloseNotification(
  body
) {

  const name =
    String(
      body?.propName ||
      "Prop"
    );


  const symbol =
    String(
      body?.symbol ||
      "XAUUSD"
    );


  const source =
    String(
      body?.executionSource ||
      "unknown"
    )
      .toUpperCase();


  const propDirection =
    String(
      body?.propDirection ||
      "—"
    );


  const brokerDirection =
    String(
      body?.brokerDirection ||
      "—"
    );


  const propPL =
    Number(
      body?.propPL
    );


  const brokerPL =
    Number(
      body?.brokerPL
    );


  const propBalance =
    Number(
      body?.propBalanceAfter
    );


  const brokerBalance =
    Number(
      body?.brokerBalanceAfter
    );


  const money =
    (v) =>

      Number.isFinite(v)

        ? `${v >= 0 ? "+" : ""}$${Number(v).toFixed(2)}`

        : "—";


  const balance =
    (v) =>

      Number.isFinite(v)

        ? `$${Number(v).toFixed(2)}`

        : "—";


  return telegram(

    `✅ <b>OPERAZIONE CHIUSA MANUALMENTE</b>\n` +

    `${name} · ${symbol}\n` +

    `Origine: <b>${source}</b>\n` +

    `Prop: <b>${propDirection}</b> · Broker: <b>${brokerDirection}</b>\n` +

    `P/L Prop: <b>${money(propPL)}</b>\n` +

    `P/L Broker: <b>${money(brokerPL)}</b>\n` +

    `Saldo Prop: <b>${balance(propBalance)}</b>\n` +

    `Saldo Broker: <b>${balance(brokerBalance)}</b>\n` +

    `📡 Monitoraggio Telegram terminato.`

  );
}


async function sendLifecycleNotification(
  body
) {

  const a =
    String(
      body?.action ||
      ""
    );


  const name =
    String(
      body?.propName ||
      "Prop"
    );


  const symbol =
    String(
      body?.symbol ||
      "XAUUSD"
    );


  const source =
    String(
      body?.executionSource ||
      "unknown"
    )
      .toUpperCase();


  const propDirection =
    String(
      body?.propDirection ||
      "—"
    );


  const brokerDirection =
    String(
      body?.brokerDirection ||
      "—"
    );


  if (
    a === "test_telegram"
  ) {

    return telegram(

      `🟢 <b>PROFITTRACKER WATCHDOG ONLINE</b>\n` +

      `Telegram collegato correttamente.\n` +

      `Route Watchdog v1.04 operativa.`

    );

  }


  if (
    a === "monitor_started"
  ) {

    return telegram(

      `📡 <b>MONITORAGGIO AVVIATO</b>\n` +

      `${name} · ${symbol}\n` +

      `Origine: <b>${source}</b>\n` +

      `Prop: <b>${propDirection}</b> · Broker: <b>${brokerDirection}</b>\n` +

      `Watchdog attivo: WAIT · inversione · M15 $4/$8 · TP/SL.`

    );

  }


  if (
    a === "monitor_stopped"
  ) {

    return telegram(

      `⏹️ <b>MONITORAGGIO INTERROTTO</b>\n` +

      `${name} · ${symbol}\n` +

      `Origine: <b>${source}</b>\n` +

      `Nessun altro alert verrà inviato.`

    );

  }


  throw new Error(
    "AZIONE_LIFECYCLE_NON_VALIDA"
  );
}


async function sendTradingLabNotification(
  body
) {

  const action =
    String(
      body?.action ||
      ""
    );


  const accountAlias =
    String(
      body?.accountAlias ||
      body?.broker ||
      "Broker"
    );


  const accountType =
    String(
      body?.accountType ||
      "real"
    )
      .toUpperCase();


  const login =
    String(
      body?.login ||
      "—"
    );


  const symbol =
    String(
      body?.symbol ||
      "—"
    );


  const side =
    String(
      body?.side ||
      "—"
    )
      .toUpperCase();


  const volume =
    Number(
      body?.volume
    );


  const entry =
    Number(
      body?.entry
    );


  const sl =
    Number(
      body?.sl
    );


  const tp =
    Number(
      body?.tp
    );


  const maxLoss =
    Number(
      body?.maxLossUsd
    );


  const target =
    Number(
      body?.targetUsd
    );


  const ticket =
    String(
      body?.positionTicket ||
      "—"
    );


  const exitPrice =
    Number(
      body?.exitPrice
    );


  const realizedPL =
    Number(
      body?.realizedPL
    );


  const num =
    (
      v,
      d = 2
    ) =>

      Number.isFinite(v)

        ? Number(v)
            .toFixed(d)

        : "—";


  const money =
    (v) =>

      Number.isFinite(v)

        ? `${v >= 0 ? "+" : ""}$${Number(v).toFixed(2)}`

        : "—";


  if (
    action ===
    "lab_test_telegram"
  ) {

    return telegram(

      `🧪 <b>TRADING LAB — TELEGRAM OK</b>\n` +

      `ProfitTracker è collegato al bot.\n` +

      `Le notifiche Trading Lab sono operative.`

    );

  }


  if (
    action ===
    "lab_trade_opened"
  ) {

    return telegram(

      `⚡ <b>TRADING LAB — ORDINE APERTO</b>\n` +

      `${accountAlias} · <b>${accountType}</b> · Login ${login}\n` +

      `${symbol} · <b>${side}</b> · Lotto <b>${Number.isFinite(volume) ? volume : "—"}</b>\n` +

      `Entry: <b>${num(entry,6)}</b>\n` +

      `SL: <b>${num(sl,6)}</b> · rischio ≈ <b>-$${num(maxLoss,2)}</b>\n` +

      `TP: <b>${num(tp,6)}</b> · target ≈ <b>+$${num(target,2)}</b>\n` +

      `Ticket MT5: <b>${ticket}</b>`

    );

  }


  if (
    action ===
    "lab_trade_tp"
  ) {

    return telegram(

      `🎯 <b>TRADING LAB — TAKE PROFIT</b>\n` +

      `${accountAlias} · ${symbol} · <b>${side}</b>\n` +

      `Ticket: <b>${ticket}</b>\n` +

      `Uscita: <b>${num(exitPrice,6)}</b>\n` +

      `P/L realizzato: <b>${money(realizedPL)}</b>`

    );

  }


  if (
    action ===
    "lab_trade_sl"
  ) {

    return telegram(

      `🛑 <b>TRADING LAB — STOP LOSS</b>\n` +

      `${accountAlias} · ${symbol} · <b>${side}</b>\n` +

      `Ticket: <b>${ticket}</b>\n` +

      `Uscita: <b>${num(exitPrice,6)}</b>\n` +

      `P/L realizzato: <b>${money(realizedPL)}</b>`

    );

  }


  if (
    action ===
    "lab_trade_manual_close"
  ) {

    return telegram(

      `✋ <b>TRADING LAB — CHIUSURA MANUALE</b>\n` +

      `${accountAlias} · ${symbol} · <b>${side}</b>\n` +

      `Ticket: <b>${ticket}</b>\n` +

      `Uscita: <b>${num(exitPrice,6)}</b>\n` +

      `P/L realizzato: <b>${money(realizedPL)}</b>`

    );

  }


  throw new Error(
    "AZIONE_TRADING_LAB_NON_VALIDA"
  );
}


async function run() {

  checkEnv();


  const rows =
    await rest(

      `${ACTIVE_TABLE}?select=user_id,challenge_id,prop_name,state,updated_at&order=updated_at.asc&limit=500`

    );


  const active =

    (
      Array.isArray(rows)
        ? rows
        : []
    )
      .filter(
        r =>
          r?.state?.active
      );


  const results =
    [];


  for (
    const row
    of active
  ) {

    try {

      results.push(
        await processChallenge(
          row
        )
      );

    }
    catch (e) {

      results.push({

        challenge:
          row.challenge_id,

        status:
          "ERROR",

        error:
          e?.message ||
          String(e)
      });

    }

  }


  return {

    ok:
      true,

    version:
      "1.04",

    checked:
      active.length,

    results
  };
}


export async function POST(
  request
) {

  try {

    checkEnv();


    let body = {};


    try {

      body =
        await request
          .json();

    }
    catch {}


    if (
      body?.action ===
      "manual_close"
    ) {

      const user =
        await authenticatedUser(
          request
        );


      if (!user) {

        return json(
          {
            ok: false,
            error:
              "UNAUTHORIZED_USER"
          },
          401
        );

      }


      const result =
        await sendManualCloseNotification(
          body
        );


      return json({
        ok: true,
        version: "1.04",
        action: "manual_close",
        telegram: result
      });

    }


    if (
      [
        "test_telegram",
        "monitor_started",
        "monitor_stopped"
      ].includes(
        String(
          body?.action ||
          ""
        )
      )
    ) {

      const user =
        await authenticatedUser(
          request
        );


      if (!user) {

        return json(
          {
            ok: false,
            error:
              "UNAUTHORIZED_USER"
          },
          401
        );

      }


      const result =
        await sendLifecycleNotification(
          body
        );


      return json({
        ok: true,
        version: "1.04",
        action: body.action,
        telegram: result
      });

    }


    if (
      [
        "lab_test_telegram",
        "lab_trade_opened",
        "lab_trade_tp",
        "lab_trade_sl",
        "lab_trade_manual_close"
      ].includes(
        String(
          body?.action ||
          ""
        )
      )
    ) {

      const user =
        await authenticatedUser(
          request
        );


      if (!user) {

        return json(
          {
            ok: false,
            error:
              "UNAUTHORIZED_USER"
          },
          401
        );

      }


      const result =
        await sendTradingLabNotification(
          body
        );


      return json({
        ok: true,
        version: "1.04",
        action: body.action,
        telegram: result
      });

    }


    if (
      !authOk(request)
    ) {

      return json(
        {
          ok: false,
          error:
            "UNAUTHORIZED"
        },
        401
      );

    }


    return json(
      await run()
    );

  }
  catch (e) {

    return json(
      {
        ok: false,
        error:
          e?.message ||
          String(e)
      },
      500
    );

  }

}


export async function GET(
  request
) {

  try {

    if (
      !authOk(request)
    ) {

      return json(
        {
          ok: false,
          error:
            "UNAUTHORIZED"
        },
        401
      );

    }


    return json(
      await run()
    );

  }
  catch (e) {

    return json(
      {
        ok: false,
        error:
          e?.message ||
          String(e)
      },
      500
    );

  }

}
