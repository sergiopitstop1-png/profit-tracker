export const dynamic = "force-dynamic";
export const revalidate = 0;

import { createClient } from "@supabase/supabase-js";

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

async function getTradingSession(
  supabase,
  userId
) {
  const { data, error } = await supabase
    .from("prop_trading_session")
    .select(
      "trading_enabled,mode,active_account,active_symbol,started_at,stopped_at,updated_at"
    )
    .eq("user_id", userId)
    .maybeSingle();

  if (error) {
    throw error;
  }

  if (!data) {
    return {
      trading_enabled: false,
      mode: "OFF",
      active_account: null,
      active_symbol: null,
      started_at: null,
      stopped_at: null,
      updated_at: null
    };
  }

  return {
    trading_enabled:
      data.trading_enabled === true,

    mode:
      data.mode ||
      (
        data.trading_enabled
          ? "READY"
          : "OFF"
      ),

    active_account:
      data.active_account || null,

    active_symbol:
      data.active_symbol || null,

    started_at:
      data.started_at || null,

    stopped_at:
      data.stopped_at || null,

    updated_at:
      data.updated_at || null
  };
}

function nullableFiniteNumber(value) {
  if (
    value === null ||
    value === undefined ||
    value === ""
  ) {
    return null;
  }

  const n = Number(value);

  return Number.isFinite(n)
    ? n
    : null;
}

async function saveAccountSnapshotFromResult(
  supabase,
  broker,
  body,
  now
) {
  const balance =
    nullableFiniteNumber(
      body?.balance
    );

  const credit =
    nullableFiniteNumber(
      body?.credit ?? 0
    );

  const equity =
    nullableFiniteNumber(
      body?.equity
    );

  const margin =
    nullableFiniteNumber(
      body?.margin
    );

  const freeMargin =
    nullableFiniteNumber(
      body?.free_margin
    );

  const marginLevel =
    nullableFiniteNumber(
      body?.margin_level
    );

  const complete =
    balance !== null &&
    credit !== null &&
    equity !== null &&
    margin !== null &&
    freeMargin !== null;

  if (!complete) {
    return {
      saved: false,
      state: null
    };
  }

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

    connected:
      body?.connected !== false,

    algo_trading:
      body?.algo_trading !== false,

    last_seen_at:
      now,

    updated_at:
      now
  };

  const {
    data,
    error
  } = await supabase
    .from(
      "prop_broker_live_state"
    )
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
    throw error;
  }

  return {
    saved: true,

    state: {
      broker_account_id:
        data.broker_account_id,

      account:
        data.mt5_login,

      server:
        data.mt5_server,

      balance:
        Number(
          data.balance
        ),

      credit:
        Number(
          data.credit || 0
        ),

      equity:
        Number(
          data.equity
        ),

      margin:
        Number(
          data.margin
        ),

      free_margin:
        Number(
          data.free_margin
        ),

      margin_level:
        data.margin_level === null
          ? null
          : Number(
              data.margin_level
            ),

      connected:
        data.connected,

      algo_trading:
        data.algo_trading,

      last_seen_at:
        data.last_seen_at
    }
  };
}

export async function GET(request) {
  try {
    const auth =
      checkBridgeAuth(
        request
      );

    if (!auth.ok) {
      return Response.json(
        {
          ok: false,
          error:
            auth.error
        },
        {
          status:
            auth.status
        }
      );
    }

    const {
      searchParams
    } = new URL(
      request.url
    );

    const account =
      String(
        searchParams.get(
          "account"
        ) || ""
      ).trim();

    const server =
      String(
        searchParams.get(
          "server"
        ) || ""
      ).trim();

    if (!account) {
      return Response.json(
        {
          ok: false,
          error:
            "broker_account_missing"
        },
        {
          status: 400
        }
      );
    }

    if (!server) {
      return Response.json(
        {
          ok: false,
          error:
            "mt5_server_missing"
        },
        {
          status: 400
        }
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
          error:
            brokerCheck.error
        },
        {
          status: 403
        }
      );
    }

    const broker =
      brokerCheck.account;

    const trading =
      await getTradingSession(
        supabase,
        broker.user_id
      );

    const {
      data,
      error
    } = await supabase
      .from(
        "prop_bridge_commands"
      )
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
        command_type,
        position_ticket,
        result_payload,
        status
      `)
      .eq(
        "user_id",
        broker.user_id
      )
      .eq(
        "broker_account",
        account
      )
      .eq(
        "status",
        "pending"
      )
      .order(
        "created_at",
        {
          ascending: true
        }
      )
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
          error:
            "database_error",
          message:
            error.message
        },
        {
          status: 500
        }
      );
    }

    if (!data) {
      return Response.json({
        ok: true,

        trading,

        command:
          null
      });
    }

    return Response.json({
      ok: true,

      trading,

      broker: {
        broker_account_id:
          broker.id,

        alias:
          broker.alias,

        broker:
          broker.broker,

        account:
          broker.mt5_login,

        server:
          broker.mt5_server
      },

      command: {
        id:
          data.id,

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
          Number(
            data.volume
          ),

        entry_price:
          data.entry_price === null
            ? null
            : Number(
                data.entry_price
              ),

        sl:
          data.sl === null
            ? null
            : Number(
                data.sl
              ),

        tp:
          data.tp === null
            ? null
            : Number(
                data.tp
              ),

        command_type:
          data.command_type ||
          "open",

        position_ticket:
          data.position_ticket,

        result_payload:
          data.result_payload ||
          null,

        status:
          data.status,

        created_at:
          data.created_at
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

        error:
          "internal_error",

        message:
          error?.message ||
          String(error)
      },
      {
        status: 500
      }
    );
  }
}

export async function POST(request) {
  try {
    const auth =
      checkBridgeAuth(
        request
      );

    if (!auth.ok) {
      return Response.json(
        {
          ok: false,
          error:
            auth.error
        },
        {
          status:
            auth.status
        }
      );
    }

    const body =
      await request.json();

    const action =
      String(
        body?.action || ""
      )
        .trim()
        .toLowerCase();

    const account =
      String(
        body?.account || ""
      ).trim();

    const server =
      String(
        body?.server || ""
      ).trim();

    if (!action) {
      return Response.json(
        {
          ok: false,
          error:
            "action_missing"
        },
        {
          status: 400
        }
      );
    }

    if (!account) {
      return Response.json(
        {
          ok: false,
          error:
            "broker_account_missing"
        },
        {
          status: 400
        }
      );
    }

    if (!server) {
      return Response.json(
        {
          ok: false,
          error:
            "mt5_server_missing"
        },
        {
          status: 400
        }
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
          error:
            brokerCheck.error
        },
        {
          status: 403
        }
      );
    }

    const broker =
      brokerCheck.account;

    const now =
      new Date()
        .toISOString();

    if (
      action ===
      "heartbeat"
    ) {
      const balance =
        Number(
          body?.balance
        );

      const credit =
        Number(
          body?.credit ?? 0
        );

      const equity =
        Number(
          body?.equity
        );

      const margin =
        Number(
          body?.margin
        );

      const freeMargin =
        Number(
          body?.free_margin
        );

      const marginLevel =
        body?.margin_level === null ||
        body?.margin_level === undefined ||
        body?.margin_level === ""
          ? null
          : Number(
              body.margin_level
            );

      if (
        !Number.isFinite(
          balance
        ) ||
        !Number.isFinite(
          credit
        ) ||
        !Number.isFinite(
          equity
        ) ||
        !Number.isFinite(
          margin
        ) ||
        !Number.isFinite(
          freeMargin
        )
      ) {
        return Response.json(
          {
            ok: false,
            error:
              "invalid_account_values"
          },
          {
            status: 400
          }
        );
      }

      if (
        marginLevel !== null &&
        !Number.isFinite(
          marginLevel
        )
      ) {
        return Response.json(
          {
            ok: false,
            error:
              "invalid_margin_level"
          },
          {
            status: 400
          }
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
        .from(
          "prop_broker_live_state"
        )
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

            error:
              "database_error",

            message:
              error.message
          },
          {
            status: 500
          }
        );
      }

      return Response.json({
        ok: true,

        heartbeat:
          true,

        broker: {
          broker_account_id:
            broker.id,

          alias:
            broker.alias,

          broker:
            broker.broker
        },

        state: {
          account:
            data.mt5_login,

          server:
            data.mt5_server,

          balance:
            Number(
              data.balance
            ),

          credit:
            Number(
              data.credit || 0
            ),

          equity:
            Number(
              data.equity
            ),

          margin:
            Number(
              data.margin
            ),

          free_margin:
            Number(
              data.free_margin
            ),

          margin_level:
            data.margin_level === null
              ? null
              : Number(
                  data.margin_level
                ),

          connected:
            data.connected,

          algo_trading:
            data.algo_trading,

          last_seen_at:
            data.last_seen_at
        }
      });
    }

    const commandId =
      String(
        body?.command_id || ""
      ).trim();

    if (!commandId) {
      return Response.json(
        {
          ok: false,
          error:
            "command_id_missing"
        },
        {
          status: 400
        }
      );
    }

    if (
      action ===
      "claim"
    ) {
      const {
        data,
        error
      } = await supabase
        .from(
          "prop_bridge_commands"
        )
        .update({
          status:
            "processing",

          updated_at:
            now
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
          command_type,
          position_ticket,
          result_payload,
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

            error:
              "database_error",

            message:
              error.message
          },
          {
            status: 500
          }
        );
      }

      if (!data) {
        return Response.json(
          {
            ok: false,

            claimed:
              false,

            error:
              "command_not_pending"
          },
          {
            status: 409
          }
        );
      }

      return Response.json({
        ok: true,

        claimed:
          true,

        command: {
          id:
            data.id,

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
            Number(
              data.volume
            ),

          entry_price:
            data.entry_price === null
              ? null
              : Number(
                  data.entry_price
                ),

          sl:
            data.sl === null
              ? null
              : Number(
                  data.sl
                ),

          tp:
            data.tp === null
              ? null
              : Number(
                  data.tp
                ),

          command_type:
            data.command_type ||
            "open",

          position_ticket:
            data.position_ticket,

          result_payload:
            data.result_payload ||
            null,

          status:
            data.status,

          created_at:
            data.created_at,

          updated_at:
            data.updated_at
        }
      });
    }

    if (
      action ===
      "result"
    ) {
      const resultStatus =
        String(
          body?.status || ""
        )
          .trim()
          .toLowerCase();

      if (
        resultStatus !==
          "executed" &&
        resultStatus !==
          "failed"
      ) {
        return Response.json(
          {
            ok: false,

            error:
              "invalid_result_status"
          },
          {
            status: 400
          }
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

      const positionTicket =
        body?.position_ticket === null ||
        body?.position_ticket === undefined ||
        body?.position_ticket === ""
          ? null
          : String(
              body.position_ticket
            );

      const closeDeal =
        body?.close_deal === null ||
        body?.close_deal === undefined ||
        body?.close_deal === ""
          ? null
          : String(
              body.close_deal
            );

      const realizedPl =
        body?.realized_pl === null ||
        body?.realized_pl === undefined ||
        body?.realized_pl === ""
          ? null
          : Number(
              body.realized_pl
            );

      const resultPayload =
        body?.result_payload &&
        typeof body.result_payload === "object" &&
        !Array.isArray(
          body.result_payload
        )
          ? body.result_payload
          : null;

      if (
        realizedPl !== null &&
        !Number.isFinite(
          realizedPl
        )
      ) {
        return Response.json(
          {
            ok: false,

            error:
              "invalid_realized_pl"
          },
          {
            status: 400
          }
        );
      }

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
          {
            status: 400
          }
        );
      }

      let accountSnapshot = {
        saved: false,
        state: null
      };

      if (
        resultStatus ===
        "executed"
      ) {
        try {
          accountSnapshot =
            await saveAccountSnapshotFromResult(
              supabase,
              broker,
              body,
              now
            );

        } catch (
          snapshotError
        ) {
          console.error(
            "RESULT account snapshot error:",
            snapshotError
          );

          accountSnapshot = {
            saved: false,
            state: null
          };
        }
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

        position_ticket:
          positionTicket,

        close_deal:
          closeDeal,

        realized_pl:
          realizedPl,

        result_payload:
          resultPayload,

        closed_at:
          closeDeal
            ? now
            : null,

        error_code:
          resultStatus ===
          "failed"
            ? errorCode
            : null,

        error_message:
          resultStatus ===
          "failed"
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
        .from(
          "prop_bridge_commands"
        )
        .update(
          updateData
        )
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
          command_type,
          position_ticket,
          status,
          mt5_order,
          mt5_deal,
          execution_price,
          close_deal,
          realized_pl,
          result_payload,
          closed_at,
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

            error:
              "database_error",

            message:
              error.message
          },
          {
            status: 500
          }
        );
      }

      if (!data) {
        return Response.json(
          {
            ok: false,

            saved:
              false,

            error:
              "command_not_processing"
          },
          {
            status: 409
          }
        );
      }

      return Response.json({
        ok: true,

        saved:
          true,

        account_state_saved:
          accountSnapshot.saved,

        account_state:
          accountSnapshot.state,

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
            Number(
              data.volume
            ),

          command_type:
            data.command_type ||
            "open",

          position_ticket:
            data.position_ticket,

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

          close_deal:
            data.close_deal,

          realized_pl:
            data.realized_pl === null
              ? null
              : Number(
                  data.realized_pl
                ),

          result_payload:
            data.result_payload ||
            null,

          closed_at:
            data.closed_at,

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

    return Response.json(
      {
        ok: false,

        error:
          "action_not_supported"
      },
      {
        status: 400
      }
    );

  } catch (error) {
    console.error(
      "Prop Bridge POST fatal error:",
      error
    );

    return Response.json(
      {
        ok: false,

        error:
          "internal_error",

        message:
          error?.message ||
          String(error)
      },
      {
        status: 500
      }
    );
  }
}
