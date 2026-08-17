export const dynamic = "force-dynamic";
export const revalidate = 0;

import { createClient } from "@supabase/supabase-js";


// ============================================================
// SUPABASE ADMIN
// ============================================================

function getSupabaseAdmin() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!url) {
    throw new Error("NEXT_PUBLIC_SUPABASE_URL non configurata");
  }

  if (!serviceKey) {
    throw new Error("SUPABASE_SERVICE_ROLE_KEY non configurata");
  }

  return createClient(url, serviceKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false
    }
  });
}


// ============================================================
// SICUREZZA BRIDGE
// ============================================================

function checkBridgeAuth(request) {
  const expected = String(
    process.env.PROP_BRIDGE_SECRET || ""
  );

  if (!expected) {
    return {
      ok: false,
      status: 500,
      error: "bridge_secret_not_configured"
    };
  }

  const received = String(
    request.headers.get("x-prop-bridge-key") || ""
  );

  if (!received || received !== expected) {
    return {
      ok: false,
      status: 401,
      error: "bridge_unauthorized"
    };
  }

  return { ok: true };
}


// ============================================================
// TROVA ACCOUNT BROKER CENSITO
// ============================================================

async function findBrokerAccount(
  supabase,
  account,
  server
) {
  const { data, error } = await supabase
    .from("prop_broker_accounts")
    .select(`
      id,
      user_id,
      alias,
      broker,
      mt5_login,
      mt5_server,
      account_type,
      active
    `)
    .eq("mt5_login", account)
    .eq("mt5_server", server)
    .eq("active", true)
    .limit(2);

  if (error) {
    throw error;
  }

  if (!data || data.length === 0) {
    return {
      ok: false,
      error: "broker_account_not_registered"
    };
  }

  if (data.length > 1) {
    return {
      ok: false,
      error: "broker_account_ambiguous"
    };
  }

  return {
    ok: true,
    account: data[0]
  };
}


// ============================================================
// GET
//
// Cerca il primo comando PENDING
// per LOGIN + SERVER MT5.
// ============================================================

export async function GET(request) {
  try {

    const auth = checkBridgeAuth(request);

    if (!auth.ok) {
      return Response.json(
        {
          ok: false,
          error: auth.error
        },
        { status: auth.status }
      );
    }


    const { searchParams } =
      new URL(request.url);

    const account = String(
      searchParams.get("account") || ""
    ).trim();

    const server = String(
      searchParams.get("server") || ""
    ).trim();


    if (!account) {
      return Response.json(
        {
          ok: false,
          error: "broker_account_missing"
        },
        { status: 400 }
      );
    }


    if (!server) {
      return Response.json(
        {
          ok: false,
          error: "mt5_server_missing"
        },
        { status: 400 }
      );
    }


    const supabase = getSupabaseAdmin();


    const brokerCheck =
      await findBrokerAccount(
        supabase,
        account,
        server
      );


    if (!brokerCheck.ok) {
      return Response.json(
        {
          ok: false,
          error: brokerCheck.error
        },
        { status: 403 }
      );
    }


    const broker =
      brokerCheck.account;


    const { data, error } = await supabase
      .from("prop_bridge_commands")
      .select(`
        id,
        created_at,
        challenge_id,
        prop_name,
        broker_account,
        symbol,
        side,
        volume,
        entry_price,
        sl,
        tp,
        status
      `)
      .eq("user_id", broker.user_id)
      .eq("broker_account", account)
      .eq("status", "pending")
      .order("created_at", {
        ascending: true
      })
      .limit(1)
      .maybeSingle();


    if (error) {
      console.error(
        "Prop Bridge GET Supabase error:",
        error
      );

      return Response.json(
        {
          ok: false,
          error: "database_error",
          message: error.message
        },
        { status: 500 }
      );
    }


    if (!data) {
      return Response.json({
        ok: true,
        command: null
      });
    }


    return Response.json({
      ok: true,

      broker: {
        id: broker.id,
        alias: broker.alias,
        broker: broker.broker,
        account: broker.mt5_login,
        server: broker.mt5_server
      },

      command: {
        id: data.id,
        challenge_id: data.challenge_id,
        prop_name: data.prop_name,
        broker_account: data.broker_account,
        symbol: data.symbol,
        side: data.side,
        volume: Number(data.volume),

        entry_price:
          data.entry_price === null
            ? null
            : Number(data.entry_price),

        sl:
          data.sl === null
            ? null
            : Number(data.sl),

        tp:
          data.tp === null
            ? null
            : Number(data.tp),

        status: data.status,
        created_at: data.created_at
      }
    });

  } catch (error) {

    console.error(
      "Prop Bridge GET fatal error:",
      error
    );

    return Response.json(
      {
        ok: false,
        error: "internal_error",
        message:
          error?.message || String(error)
      },
      { status: 500 }
    );
  }
}


// ============================================================
// POST
//
// ACTION:
// heartbeat
// claim
// result
// ============================================================

export async function POST(request) {
  try {

    const auth = checkBridgeAuth(request);

    if (!auth.ok) {
      return Response.json(
        {
          ok: false,
          error: auth.error
        },
        { status: auth.status }
      );
    }


    const body =
      await request.json();


    const action = String(
      body?.action || ""
    )
      .trim()
      .toLowerCase();


    const account = String(
      body?.account || ""
    ).trim();


    const server = String(
      body?.server || ""
    ).trim();


    if (!action) {
      return Response.json(
        {
          ok: false,
          error: "action_missing"
        },
        { status: 400 }
      );
    }


    if (!account) {
      return Response.json(
        {
          ok: false,
          error: "broker_account_missing"
        },
        { status: 400 }
      );
    }


    if (!server) {
      return Response.json(
        {
          ok: false,
          error: "mt5_server_missing"
        },
        { status: 400 }
      );
    }


    const supabase =
      getSupabaseAdmin();


    const brokerCheck =
      await findBrokerAccount(
        supabase,
        account,
        server
      );


    if (!brokerCheck.ok) {
      return Response.json(
        {
          ok: false,
          error: brokerCheck.error
        },
        { status: 403 }
      );
    }


    const broker =
      brokerCheck.account;


    const now =
      new Date().toISOString();


    // ========================================================
    // HEARTBEAT
    // ========================================================

    if (action === "heartbeat") {

      const balance =
        Number(body?.balance);

      const credit =
        Number(body?.credit ?? 0);

      const equity =
        Number(body?.equity);

      const margin =
        Number(body?.margin);

      const freeMargin =
        Number(body?.free_margin);


      const marginLevel =
        body?.margin_level === null ||
        body?.margin_level === undefined ||
        body?.margin_level === ""
          ? null
          : Number(body.margin_level);


      if (
        !Number.isFinite(balance) ||
        !Number.isFinite(credit) ||
        !Number.isFinite(equity) ||
        !Number.isFinite(margin) ||
        !Number.isFinite(freeMargin)
      ) {
        return Response.json(
          {
            ok: false,
            error: "invalid_account_values"
          },
          { status: 400 }
        );
      }


      if (
        marginLevel !== null &&
        !Number.isFinite(marginLevel)
      ) {
        return Response.json(
          {
            ok: false,
            error: "invalid_margin_level"
          },
          { status: 400 }
        );
      }


      const connected =
        body?.connected === true;

      const algoTrading =
        body?.algo_trading === true;


      const liveRow = {
        broker_account_id:
          broker.id,

        user_id:
          broker.user_id,

        mt5_login:
          broker.mt5_login,

        mt5_server:
          broker.mt5_server,

        balance,

        credit,

        equity,

        margin,

        free_margin:
          freeMargin,

        margin_level:
          marginLevel,

        connected,

        algo_trading:
          algoTrading,

        last_seen_at:
          now,

        updated_at:
          now
      };


      const {
        data,
        error
      } = await supabase
        .from("prop_broker_live_state")
        .upsert(
          liveRow,
          {
            onConflict:
              "broker_account_id"
          }
        )
        .select(`
          broker_account_id,
          mt5_login,
          mt5_server,
          balance,
          credit,
          equity,
          margin,
          free_margin,
          margin_level,
          connected,
          algo_trading,
          last_seen_at
        `)
        .single();


      if (error) {
        console.error(
          "Heartbeat Supabase error:",
          error
        );

        return Response.json(
          {
            ok: false,
            error: "database_error",
            message: error.message
          },
          { status: 500 }
        );
      }


      return Response.json({
        ok: true,
        heartbeat: true,

        broker: {
          id: broker.id,
          alias: broker.alias,
          broker: broker.broker
        },

        state: {
          account:
            data.mt5_login,

          server:
            data.mt5_server,

          balance:
            Number(data.balance),

          credit:
            Number(data.credit || 0),

          equity:
            Number(data.equity),

          margin:
            Number(data.margin),

          free_margin:
            Number(data.free_margin),

          margin_level:
            data.margin_level === null
              ? null
              : Number(data.margin_level),

          connected:
            data.connected,

          algo_trading:
            data.algo_trading,

          last_seen_at:
            data.last_seen_at
        }
      });
    }


    // ========================================================
    // CLAIM / RESULT
    // ========================================================

    const commandId = String(
      body?.command_id || ""
    ).trim();


    if (!commandId) {
      return Response.json(
        {
          ok: false,
          error: "command_id_missing"
        },
        { status: 400 }
      );
    }


    // ========================================================
    // CLAIM
    // pending -> processing
    // ========================================================

    if (action === "claim") {

      const {
        data,
        error
      } = await supabase
        .from("prop_bridge_commands")
        .update({
          status: "processing",
          updated_at: now
        })
        .eq(
          "user_id",
          broker.user_id
        )
        .eq(
          "id",
          commandId
        )
        .eq(
          "broker_account",
          account
        )
        .eq(
          "status",
          "pending"
        )
        .select(`
          id,
          challenge_id,
          prop_name,
          broker_account,
          symbol,
          side,
          volume,
          entry_price,
          sl,
          tp,
          status,
          created_at,
          updated_at
        `)
        .maybeSingle();


      if (error) {
        console.error(
          "CLAIM Supabase error:",
          error
        );

        return Response.json(
          {
            ok: false,
            error: "database_error",
            message: error.message
          },
          { status: 500 }
        );
      }


      if (!data) {
        return Response.json(
          {
            ok: false,
            claimed: false,
            error:
              "command_not_pending"
          },
          { status: 409 }
        );
      }


      return Response.json({
        ok: true,
        claimed: true,

        command: {
          id: data.id,
          challenge_id:
            data.challenge_id,
          prop_name:
            data.prop_name,
          broker_account:
            data.broker_account,
          symbol:
            data.symbol,
          side:
            data.side,

          volume:
            Number(data.volume),

          entry_price:
            data.entry_price === null
              ? null
              : Number(
                  data.entry_price
                ),

          sl:
            data.sl === null
              ? null
              : Number(data.sl),

          tp:
            data.tp === null
              ? null
              : Number(data.tp),

          status:
            data.status,

          created_at:
            data.created_at,

          updated_at:
            data.updated_at
        }
      });
    }


    // ========================================================
    // RESULT
    // processing -> executed / failed
    // ========================================================

    if (action === "result") {

      const resultStatus = String(
        body?.status || ""
      )
        .trim()
        .toLowerCase();


      if (
        resultStatus !== "executed" &&
        resultStatus !== "failed"
      ) {
        return Response.json(
          {
            ok: false,
            error:
              "invalid_result_status"
          },
          { status: 400 }
        );
      }


      const mt5Order =
        body?.mt5_order === null ||
        body?.mt5_order === undefined ||
        body?.mt5_order === ""
          ? null
          : String(
              body.mt5_order
            );


      const mt5Deal =
        body?.mt5_deal === null ||
        body?.mt5_deal === undefined ||
        body?.mt5_deal === ""
          ? null
          : String(
              body.mt5_deal
            );


      const executionPrice =
        body?.execution_price === null ||
        body?.execution_price === undefined ||
        body?.execution_price === ""
          ? null
          : Number(
              body.execution_price
            );


      const errorCode =
        body?.error_code === null ||
        body?.error_code === undefined ||
        body?.error_code === ""
          ? null
          : String(
              body.error_code
            );


      const errorMessage =
        body?.error_message === null ||
        body?.error_message === undefined ||
        body?.error_message === ""
          ? null
          : String(
              body.error_message
            );


      if (
        executionPrice !== null &&
        !Number.isFinite(
          executionPrice
        )
      ) {
        return Response.json(
          {
            ok: false,
            error:
              "invalid_execution_price"
          },
          { status: 400 }
        );
      }


      const updateData = {
        status:
          resultStatus,

        mt5_order:
          mt5Order,

        mt5_deal:
          mt5Deal,

        execution_price:
          executionPrice,

        error_code:
          resultStatus === "failed"
            ? errorCode
            : null,

        error_message:
          resultStatus === "failed"
            ? errorMessage
            : null,

        processed_at:
          now,

        updated_at:
          now
      };


      const {
        data,
        error
      } = await supabase
        .from("prop_bridge_commands")
        .update(updateData)
        .eq(
          "user_id",
          broker.user_id
        )
        .eq(
          "id",
          commandId
        )
        .eq(
          "broker_account",
          account
        )
        .eq(
          "status",
          "processing"
        )
        .select(`
          id,
          challenge_id,
          broker_account,
          symbol,
          side,
          volume,
          status,
          mt5_order,
          mt5_deal,
          execution_price,
          error_code,
          error_message,
          processed_at,
          updated_at
        `)
        .maybeSingle();


      if (error) {
        console.error(
          "RESULT Supabase error:",
          error
        );

        return Response.json(
          {
            ok: false,
            error: "database_error",
            message: error.message
          },
          { status: 500 }
        );
      }


      if (!data) {
        return Response.json(
          {
            ok: false,
            saved: false,
            error:
              "command_not_processing"
          },
          { status: 409 }
        );
      }


      return Response.json({
        ok: true,
        saved: true,

        command: {
          id:
            data.id,

          challenge_id:
            data.challenge_id,

          broker_account:
            data.broker_account,

          symbol:
            data.symbol,

          side:
            data.side,

          volume:
            Number(data.volume),

          status:
            data.status,

          mt5_order:
            data.mt5_order === null
              ? null
              : String(
                  data.mt5_order
                ),

          mt5_deal:
            data.mt5_deal === null
              ? null
              : String(
                  data.mt5_deal
                ),

          execution_price:
            data.execution_price === null
              ? null
              : Number(
                  data.execution_price
                ),

          error_code:
            data.error_code,

          error_message:
            data.error_message,

          processed_at:
            data.processed_at,

          updated_at:
            data.updated_at
        }
      });
    }


    // ========================================================
    // ACTION NON SUPPORTATA
    // ========================================================

    return Response.json(
      {
        ok: false,
        error:
          "action_not_supported"
      },
      { status: 400 }
    );

  } catch (error) {

    console.error(
      "Prop Bridge POST fatal error:",
      error
    );

    return Response.json(
      {
        ok: false,
        error: "internal_error",
        message:
          error?.message ||
          String(error)
      },
      { status: 500 }
    );
  }
}
