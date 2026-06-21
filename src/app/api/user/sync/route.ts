// NOTE: Production should verify the Privy JWT before trusting privy_id from the request body.

import { NextResponse } from "next/server";
import { getSupabase } from "@/lib/supabase";

interface SyncBody {
  privy_id: string;
  wallet_address?: string;
  email?: string;
}

export async function POST(request: Request) {
  const supabase = getSupabase();
  if (!supabase) {
    return NextResponse.json({ ok: true });
  }

  let body: SyncBody;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const { privy_id, wallet_address, email } = body;
  if (!privy_id) {
    return NextResponse.json({ error: "privy_id is required" }, { status: 400 });
  }

  const { error } = await supabase
    .from("profiles")
    .upsert(
      {
        privy_id,
        wallet_address: wallet_address ?? null,
        email: email ?? null,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "privy_id" }
    );

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
