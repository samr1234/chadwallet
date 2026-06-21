// NOTE: Production should verify the Privy JWT before trusting privy_id.

import { NextResponse } from "next/server";
import { getSupabase } from "@/lib/supabase";

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ address: string }> }
) {
  const supabase = getSupabase();
  if (!supabase) {
    return NextResponse.json({ error: "Supabase not configured" }, { status: 503 });
  }

  const { address } = await params;
  const { searchParams } = new URL(request.url);
  const privy_id = searchParams.get("privy_id");

  if (!privy_id) {
    return NextResponse.json({ error: "privy_id query param is required" }, { status: 400 });
  }

  const { error } = await supabase
    .from("watchlist")
    .delete()
    .eq("privy_id", privy_id)
    .eq("token_address", address);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
