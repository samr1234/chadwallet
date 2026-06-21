// NOTE: Production should verify the Privy JWT before trusting privy_id.

import { NextResponse } from "next/server";
import { getSupabase } from "@/lib/supabase";

interface WatchlistItem {
  id: string;
  privy_id: string;
  token_address: string;
  token_symbol: string | null;
  token_name: string | null;
  logo_uri: string | null;
  added_at: string;
}

interface PostBody {
  privy_id: string;
  token_address: string;
  token_symbol?: string;
  token_name?: string;
  logo_uri?: string;
}

export async function GET(request: Request) {
  const supabase = getSupabase();
  if (!supabase) {
    return NextResponse.json({ watchlist: [] });
  }

  const { searchParams } = new URL(request.url);
  const privy_id = searchParams.get("privy_id");

  if (!privy_id) {
    return NextResponse.json({ error: "privy_id query param is required" }, { status: 400 });
  }

  const { data, error } = await supabase
    .from("watchlist")
    .select("*")
    .eq("privy_id", privy_id)
    .order("added_at", { ascending: false });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ watchlist: (data ?? []) as WatchlistItem[] });
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

  const { privy_id, token_address, token_symbol, token_name, logo_uri } = body;
  if (!privy_id || !token_address) {
    return NextResponse.json({ error: "privy_id and token_address are required" }, { status: 400 });
  }

  const { error } = await supabase
    .from("watchlist")
    .insert({
      privy_id,
      token_address,
      token_symbol: token_symbol ?? null,
      token_name: token_name ?? null,
      logo_uri: logo_uri ?? null,
    })
    .select()
    // Ignore unique-constraint conflicts (already on watchlist).
    // ignoreDuplicates is not available in all versions; use onConflict with no merge columns instead.
    // The insert will silently do nothing on (privy_id, token_address) conflict.

  if (error && error.code !== "23505") {
    // 23505 = unique_violation — treat as success (already watchlisted)
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
