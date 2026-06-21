// NOTE: Production should verify the Privy JWT before trusting privy_id.

import { NextResponse } from "next/server";
import { getSupabase } from "@/lib/supabase";

interface Trade {
  id: string;
  privy_id: string;
  wallet_address: string | null;
  token_address: string;
  token_symbol: string | null;
  side: "buy" | "sell";
  in_amount: string;
  out_amount: string;
  tx_signature: string;
  created_at: string;
}

interface PostBody {
  privy_id: string;
  wallet_address?: string;
  token_address: string;
  token_symbol?: string;
  side: "buy" | "sell";
  in_amount: string;
  out_amount: string;
  tx_signature: string;
}

export async function GET(request: Request) {
  const supabase = getSupabase();
  if (!supabase) {
    return NextResponse.json({ trades: [] });
  }

  const { searchParams } = new URL(request.url);
  const privy_id = searchParams.get("privy_id");
  const limitParam = searchParams.get("limit");
  const limit = limitParam ? parseInt(limitParam, 10) : 20;

  if (!privy_id) {
    return NextResponse.json({ error: "privy_id query param is required" }, { status: 400 });
  }

  const { data, error } = await supabase
    .from("trades")
    .select("*")
    .eq("privy_id", privy_id)
    .order("created_at", { ascending: false })
    .limit(limit);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ trades: (data ?? []) as Trade[] });
}

export async function POST(request: Request) {
  const supabase = getSupabase();
  if (!supabase) {
    return NextResponse.json({ ok: true });
  }

  let body: PostBody;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const {
    privy_id,
    wallet_address,
    token_address,
    token_symbol,
    side,
    in_amount,
    out_amount,
    tx_signature,
  } = body;

  if (!privy_id || !token_address || !side || !in_amount || !out_amount || !tx_signature) {
    return NextResponse.json(
      { error: "privy_id, token_address, side, in_amount, out_amount, and tx_signature are required" },
      { status: 400 }
    );
  }

  const { error } = await supabase.from("trades").insert({
    privy_id,
    wallet_address: wallet_address ?? null,
    token_address,
    token_symbol: token_symbol ?? null,
    side,
    in_amount,
    out_amount,
    tx_signature,
  });

  if (error && error.code !== "23505") {
    // 23505 = unique_violation on tx_signature — treat as success (already recorded)
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
