export const dynamic = "force-dynamic";
export const revalidate = 0;

import { createClient } from "@supabase/supabase-js";

const BROKER_ACCOUNT = "62137292";

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
// GET
//
// Restituisce il primo comando PENDING destinato
// all'account Broker indicato.
//
// MT5:
// GET /api/prop-bridge?account=62137292
// ============================================================

export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url);

    const account = String(
      searchParams.get("account") || ""
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


    if (account !== BROKER_ACCOUNT) {
      return Response.json(
        {
          ok: false,
          error: "broker_account_not_allowed"
        },
        { status: 403 }
      );
    }


    const supabase = getSupabaseAdmin();


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
      .eq("broker_account", account)
      .eq("status", "pending")
      .order("created_at", { ascending: true })
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
// Supporta:
//
// action = "claim"
// pending -> processing
//
// action = "result"
// processing -> executed
// oppure
// processing -> failed
//
// IMPORTANTE:
// nessuna di queste funzioni apre trade.
// ============================================================

export async function POST(request) {
  try {
    const body = await request.json();


    const action = String(
      body?.action || ""
    ).trim();


    const account = String(
      body?.account || ""
    ).trim();


    const commandId = String(
      body?.command_id || ""
    ).trim();


    // ========================================================
    // CONTROLLI COMUNI
    // ========================================================

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


    if (account !== BROKER_ACCOUNT) {
      return Response.json(
        {
          ok: false,
          error: "broker_account_not_allowed"
        },
        { status: 403 }
      );
    }


    if (!commandId) {
      return Response.json(
        {
          ok: false,
          error: "command_id_missing"
        },
        { status: 400 }
      );
    }


    const supabase = getSupabaseAdmin();

    const now = new Date().toISOString();


    // ========================================================
    // ACTION: CLAIM
    //
    // pending -> processing
    //
    // L'UPDATE riesce SOLO se il comando è ancora pending.
    // ========================================================

    if (action === "claim") {

      const { data, error } = await supabase
        .from("prop_bridge_commands")
        .update({
          status: "processing",
          updated_at: now
        })
        .eq("id", commandId)
        .eq("broker_account", account)
        .eq("status", "pending")
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
          "Prop Bridge CLAIM Supabase error:",
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
            error: "command_not_pending"
          },
          { status: 409 }
        );
      }


      return Response.json({
        ok: true,
        claimed: true,

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
          created_at: data.created_at,
          updated_at: data.updated_at
        }
      });
    }


    // ========================================================
    // ACTION: RESULT
    //
    // Riceve il risultato dell'esecuzione MT5.
    //
    // processing -> executed
    // processing -> failed
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
            error: "invalid_result_status"
          },
          { status: 400 }
        );
      }


      // ------------------------------------------------------
      // DATI RISULTATO
      // ------------------------------------------------------

      const mt5Order =
        body?.mt5_order === null ||
        body?.mt5_order === undefined ||
        body?.mt5_order === ""
          ? null
          : String(body.mt5_order);


      const mt5Deal =
        body?.mt5_deal === null ||
        body?.mt5_deal === undefined ||
        body?.mt5_deal === ""
          ? null
          : String(body.mt5_deal);


      const executionPrice =
        body?.execution_price === null ||
        body?.execution_price === undefined ||
        body?.execution_price === ""
          ? null
          : Number(body.execution_price);


      const errorCode =
        body?.error_code === null ||
        body?.error_code === undefined ||
        body?.error_code === ""
          ? null
          : String(body.error_code);


      const errorMessage =
        body?.error_message === null ||
        body?.error_message === undefined ||
        body?.error_message === ""
          ? null
          : String(body.error_message);


      // ------------------------------------------------------
      // VALIDAZIONE EXECUTED
      // ------------------------------------------------------

      if (resultStatus === "executed") {

        if (
          executionPrice !== null &&
          !Number.isFinite(executionPrice)
        ) {
          return Response.json(
            {
              ok: false,
              error: "invalid_execution_price"
            },
            { status: 400 }
          );
        }
      }


      // ------------------------------------------------------
      // COSTRUZIONE UPDATE
      // ------------------------------------------------------

      const updateData = {
        status: resultStatus,

        mt5_order: mt5Order,
        mt5_deal: mt5Deal,

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

        processed_at: now,
        updated_at: now
      };


      // ------------------------------------------------------
      // UPDATE PROTETTO
      //
      // Viene aggiornato SOLO un comando:
      //
      // - con quell'ID
      // - destinato a quell'account
      // - attualmente PROCESSING
      //
      // Quindi un risultato ripetuto NON può riscrivere
      // un comando già EXECUTED o FAILED.
      // ------------------------------------------------------

      const { data, error } = await supabase
        .from("prop_bridge_commands")
        .update(updateData)
        .eq("id", commandId)
        .eq("broker_account", account)
        .eq("status", "processing")
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
          "Prop Bridge RESULT Supabase error:",
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


      // ------------------------------------------------------
      // Se non abbiamo aggiornato nulla:
      // il comando non era più PROCESSING.
      // ------------------------------------------------------

      if (!data) {
        return Response.json(
          {
            ok: false,
            saved: false,
            error: "command_not_processing"
          },
          { status: 409 }
        );
      }


      // ------------------------------------------------------
      // RISULTATO REGISTRATO
      // ------------------------------------------------------

      return Response.json({
        ok: true,
        saved: true,

        command: {
          id: data.id,
          challenge_id: data.challenge_id,
          broker_account: data.broker_account,
          symbol: data.symbol,
          side: data.side,
          volume: Number(data.volume),

          status: data.status,

          mt5_order:
            data.mt5_order === null
              ? null
              : String(data.mt5_order),

          mt5_deal:
            data.mt5_deal === null
              ? null
              : String(data.mt5_deal),

          execution_price:
            data.execution_price === null
              ? null
              : Number(data.execution_price),

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
        error: "action_not_supported"
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
          error?.message || String(error)
      },
      { status: 500 }
    );
  }
}
