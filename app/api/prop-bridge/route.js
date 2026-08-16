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

export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url);

    const account = String(searchParams.get("account") || "").trim();

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
      console.error("Prop Bridge Supabase error:", error);

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
          data.entry_price === null ? null : Number(data.entry_price),
        sl:
          data.sl === null ? null : Number(data.sl),
        tp:
          data.tp === null ? null : Number(data.tp),
        status: data.status,
        created_at: data.created_at
      }
    });

  } catch (error) {
    console.error("Prop Bridge fatal error:", error);

    return Response.json(
      {
        ok: false,
        error: "internal_error",
        message: error?.message || String(error)
      },
      { status: 500 }
    );
  }
}
