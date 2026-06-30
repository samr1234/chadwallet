import { NextResponse } from "next/server";

export const revalidate = 60;

let memCache: { tokens: unknown[]; ts: number } | null = null;
let inFlight: Promise<unknown[]> | null = null;
const CACHE_TTL = 60_000;

async function fetchFromBirdEye(): Promise<unknown[]> {
  const apiKey = process.env.BIRDEYE_API_KEY!;
  const res = await fetch(
    "https://public-api.birdeye.so/defi/tokenlist?sort_by=mc&sort_type=desc&offset=0&limit=20",
    {
      headers: { "X-API-KEY": apiKey, "x-chain": "solana", Accept: "application/json" },
      next: { revalidate: 60 },
    }
  );

  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new Error(`BirdEye ${res.status}: ${body.slice(0, 300)}`);
  }

  const data = await res.json();
  const tokens = data?.data?.tokens ?? [];

  if (!Array.isArray(tokens) || tokens.length === 0) {
    throw new Error("BirdEye returned empty token list");
  }

  return tokens.map((t: {
    address: string; symbol: string; name: string;
    price: number; priceChange24hPercent?: number;
    v24hChangePercent?: number; logoURI?: string;
  }) => ({
    address:  t.address,
    symbol:   t.symbol,
    name:     t.name,
    price:    t.price ?? 0,
    change24h: t.priceChange24hPercent ?? t.v24hChangePercent ?? 0,
    logoURI:  t.logoURI,
  }));
}

export async function GET() {
  const apiKey = process.env.BIRDEYE_API_KEY;
  if (!apiKey) {
    return NextResponse.json({ error: "BIRDEYE_API_KEY not set" }, { status: 500 });
  }

  if (memCache && Date.now() - memCache.ts < CACHE_TTL) {
    return NextResponse.json({ tokens: memCache.tokens });
  }

  if (!inFlight) {
    inFlight = fetchFromBirdEye()
      .then((tokens) => { memCache = { tokens, ts: Date.now() }; return tokens; })
      .finally(() => { inFlight = null; });
  }

  try {
    const tokens = await inFlight;
    return NextResponse.json({ tokens });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error("[trending] BirdEye failed:", message);

    if (memCache?.tokens.length) {
      return NextResponse.json({ tokens: memCache.tokens });
    }

    return NextResponse.json({ error: message }, { status: 502 });
  }
}
