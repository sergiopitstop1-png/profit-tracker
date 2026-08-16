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
// MT5 chiede il primo comando pending per il proprio account.
// Per ora resta compatibile con la v1.04 dell'EA.
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
// Prima funzione di controllo della coda.
//
// action = claim
//
// Cambia:
// pending -> processing
//
// IMPORTANTE:
// l'UPDATE viene eseguito SOLO se il comando è ANCORA pending.
// Questo è il primo vero blocco contro la doppia presa in carico.
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


    // --------------------------------------------------------
    // Controlli base
    // --------------------------------------------------------

    if (!action) {
      return Response.json(
        {
          ok: false,
          error: "action_missing"
        },
        { status: 400 }
      );
    }

    if (action !== "claim") {
      return Response.json(
        {
          ok: false,
          error: "action_not_supported"
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


    // --------------------------------------------------------
    // Supabase
    // --------------------------------------------------------

    const supabase = getSupabaseAdmin();

    const now = new Date().toISOString();


    // --------------------------------------------------------
    // CLAIM ATOMICO
    //
    // Aggiorna il record SOLO SE:
    //
    // id = commandId
    // broker_account = account
    // status = pending
    //
    // Se un altro Bridge lo avesse già preso,
    // non viene modificato nulla.
    // --------------------------------------------------------

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


    // --------------------------------------------------------
    // Nessun record modificato:
    // il comando non esiste oppure non è più pending.
    // --------------------------------------------------------

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


    // --------------------------------------------------------
    // Presa in carico riuscita
    // --------------------------------------------------------

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
