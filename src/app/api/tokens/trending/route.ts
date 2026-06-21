import { NextResponse } from "next/server";

export const revalidate = 60;

let memCache: { tokens: unknown[]; ts: number } | null = null;
let inFlight: Promise<unknown[]> | null = null;
const CACHE_TTL = 30_000;

async function fetchFromBirdEye(): Promise<unknown[]> {
  const apiKey = process.env.BIRDEYE_API_KEY!;
  const res = await fetch(
    "https://public-api.birdeye.so/defi/tokenlist?sort_by=v24hUSD&sort_type=desc&offset=0&limit=24&min_liquidity=50000",
    {
      headers: { "X-API-KEY": apiKey, "x-chain": "solana" },
      next: { revalidate: 60 },
    }
  );
  if (!res.ok) throw new Error(`BirdEye returned ${res.status}`);
  const data = await res.json();
  return (data?.data?.tokens ?? []).map(
    (t: {
      address: string;
      symbol: string;
      name: string;
      price: number;
      priceChange24hPercent?: number;
      v24hChangePercent?: number;
      logoURI?: string;
    }) => ({
      address: t.address,
      symbol: t.symbol,
      name: t.name,
      price: t.price ?? 0,
      change24h: t.priceChange24hPercent ?? t.v24hChangePercent ?? 0,
      logoURI: t.logoURI,
    })
  );
}

export async function GET() {
  const apiKey = process.env.BIRDEYE_API_KEY;
  if (!apiKey) {
    return NextResponse.json({ error: "BIRDEYE_API_KEY not set" }, { status: 500 });
  }

  // Serve from cache if fresh
  if (memCache && Date.now() - memCache.ts < CACHE_TTL) {
    return NextResponse.json({ tokens: memCache.tokens });
  }

  // Deduplicate concurrent requests — second caller awaits the same fetch
  if (!inFlight) {
    inFlight = fetchFromBirdEye()
      .then((tokens) => { memCache = { tokens, ts: Date.now() }; return tokens; })
      .finally(() => { inFlight = null; });
  }

  try {
    const tokens = await inFlight;
    return NextResponse.json({ tokens });
  } catch (err) {
    console.error("BirdEye fetch failed:", err);
    return NextResponse.json({ error: "Failed to fetch tokens" }, { status: 502 });
  }
}
