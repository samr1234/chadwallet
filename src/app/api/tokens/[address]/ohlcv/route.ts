import { NextResponse } from "next/server";
import { birdeyeFetch } from "@/lib/birdeye";

const LOOKBACK: Record<string, number> = {
  "1m": 2 * 60 * 60,
  "5m": 12 * 60 * 60,
  "15m": 24 * 60 * 60,
  "1H": 7 * 24 * 60 * 60,
  "4H": 30 * 24 * 60 * 60,
  "1D": 90 * 24 * 60 * 60,
};

export async function GET(
  req: Request,
  { params }: { params: Promise<{ address: string }> }
) {
  const { address } = await params;
  const { searchParams } = new URL(req.url);
  const type = searchParams.get("type") ?? "15m";
  const to = Math.floor(Date.now() / 1000);
  const lookback = LOOKBACK[type] ?? LOOKBACK["15m"];
  const from = to - lookback;

  try {
    const data = await birdeyeFetch(
      `/defi/ohlcv?address=${address}&type=${type}&time_from=${from}&time_to=${to}`,
      0
    );
    return NextResponse.json({ items: data.data?.items ?? [] });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 502 });
  }
}
