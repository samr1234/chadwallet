import { NextResponse } from "next/server";

export const revalidate = 60;

// Top Solana tokens by market cap — used as the trending feed
const SOLANA_TOKENS = [
  "So11111111111111111111111111111111111111112",   // SOL
  "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v", // USDC
  "Es9vMFrzaCERmJfrF4H2FYD4KCoNkY11McCe8BenwNYB", // USDT
  "JUPyiwrYJFskUPiHa7hkeR8VUtAeFoSYbKedZNsDvCN",  // JUP
  "DezXAZ8z7PnrnRJjz3wXBoRgixCa6xjnB7YaB1pPB263", // BONK
  "EKpQGSJtjMFqKZ9KQanSqYXRcF8fBopzLHYxdM65zcjm", // WIF
  "4k3Dyjzvzp8eMZWUXbBCjEvwSkkk59S5iCNLY3QrkX6R", // RAY
  "HZ1JovNiVvGrGNiiYvEozEVgZ58xaU3RKwX8eACQBCt3", // PYTH
  "orcaEKTdK7LKz57vaAYr9QeNsVEPfiu6QeMU1kektZE",  // ORCA
  "7GCihgDB8fe6KNjn2MYtkzZcRjQy3t9GHdC8uHYmW2hr", // POPCAT
  "ukHH6c7mMyiWCf1b9pnWe25TSpkDDt3H5pQZgZ74J82",  // BOME
  "mSoLzYCxHdYgdzU16g5QSh3i5K3z3KZK7ytfqcJm7So",  // mSOL
  "7vfCXTUXx5WJV5JADk17DUJ4ksgau7utNKj4b963voxs",  // ETH (Wormhole)
  "3NZ9JMVBmGAqocybic2c7LQCJScmgsAZ6vQqTDzcqmJh",  // WBTC (Wormhole)
  "bSo13r4TkiE4KumL71LsHTPpL2euBYLFx6h9HP3piy1",  // bSOL
  "MNDEFzGvMt87ueuHvVU9VcTqsAP5b3fTGPsHuuPA5ey",  // MNDE
  "nosXBVoaCTtYdLvKY6Csb4AC8JCdQKKAaWYtx2ZMoo7",  // NOS
  "jtojtomepa8bdya54sydheff3mkhkmkzoe5nmjfpohj",   // JTO
  "WENWENvqqNya429ubCdR81ZmD69brwQaaBYY6p3LCpk",   // WEN
  "MEFNBXixkEbait3xn9bkm8WszbpWjZuBXqHpk4tukCk",  // MEME
].join(",");

let memCache: { tokens: unknown[]; ts: number } | null = null;
const CACHE_TTL = 30_000;

interface DexPair {
  baseToken: { address: string; symbol: string; name: string };
  priceUsd?: string;
  priceChange?: { h24?: number };
  volume?: { h24?: number };
  liquidity?: { usd?: number };
  info?: { imageUrl?: string };
}

async function fetchFromDexScreener(): Promise<unknown[]> {
  const res = await fetch(
    `https://api.dexscreener.com/latest/dex/tokens/${SOLANA_TOKENS}`,
    { headers: { Accept: "application/json" }, next: { revalidate: 60 } }
  );

  if (!res.ok) {
    throw new Error(`DexScreener ${res.status}`);
  }

  const data = await res.json();
  const pairs: DexPair[] = data?.pairs ?? [];

  if (!pairs.length) throw new Error("DexScreener returned no pairs");

  // Pick the most liquid pair per unique base token address
  const best = new Map<string, DexPair>();
  for (const pair of pairs) {
    const addr = pair.baseToken?.address;
    if (!addr) continue;
    const existing = best.get(addr);
    const liq = pair.liquidity?.usd ?? 0;
    const existingLiq = existing?.liquidity?.usd ?? 0;
    if (!existing || liq > existingLiq) best.set(addr, pair);
  }

  return Array.from(best.values()).map((p) => ({
    address: p.baseToken.address,
    symbol:  p.baseToken.symbol,
    name:    p.baseToken.name,
    price:   parseFloat(p.priceUsd ?? "0"),
    change24h: p.priceChange?.h24 ?? 0,
    logoURI: p.info?.imageUrl ?? null,
  }));
}

export async function GET() {
  // Serve fresh cache
  if (memCache && Date.now() - memCache.ts < CACHE_TTL) {
    return NextResponse.json({ tokens: memCache.tokens });
  }

  try {
    const tokens = await fetchFromDexScreener();
    memCache = { tokens, ts: Date.now() };
    return NextResponse.json({ tokens });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error("[trending] DexScreener fetch failed:", message);

    // Serve stale cache if we have anything
    if (memCache?.tokens.length) {
      return NextResponse.json({ tokens: memCache.tokens });
    }

    return NextResponse.json({ error: message }, { status: 502 });
  }
}
