import { NextResponse } from "next/server";
import { birdeyeFetch } from "@/lib/birdeye";

const LOOKBACK: Record<string, number> = {
  "1m":  6  * 60 * 60,
  "5m":  2  * 24 * 60 * 60,
  "15m": 5  * 24 * 60 * 60,
  "1H":  30 * 24 * 60 * 60,
  "4H":  120 * 24 * 60 * 60,
  "1D":  365 * 24 * 60 * 60,
};

// Ordered from finest to coarsest — used for auto-fallback
const FALLBACK_CHAIN: string[] = ["1m", "5m", "15m", "1H", "4H", "1D"];

async function fetchOHLCV(address: string, type: string) {
  const to = Math.floor(Date.now() / 1000);
  const from = to - (LOOKBACK[type] ?? LOOKBACK["1H"]);
  const data = await birdeyeFetch(
    `/defi/ohlcv?address=${address}&type=${type}&time_from=${from}&time_to=${to}`,
    0
  );
  return (data.data?.items ?? []) as unknown[];
}

export async function GET(
  req: Request,
  { params }: { params: Promise<{ address: string }> }
) {
  const { address } = await params;
  const { searchParams } = new URL(req.url);
  const requested = searchParams.get("type") ?? "1H";

  // Build fallback list: start from requested timeframe, try coarser ones if empty
  const startIdx = FALLBACK_CHAIN.indexOf(requested);
  const candidates = startIdx >= 0
    ? FALLBACK_CHAIN.slice(startIdx)
    : [requested, ...FALLBACK_CHAIN];

  for (const type of candidates) {
    try {
      const items = await fetchOHLCV(address, type);
      if (items.length > 0) {
        return NextResponse.json({ items, resolvedType: type });
      }
    } catch {
      // try next
    }
  }

  return NextResponse.json({ items: [], resolvedType: requested });
}
