import { NextResponse } from "next/server";

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ address: string }> }
) {
  const { address } = await params;

  // Try Helius first (free tier, needs HELIUS_API_KEY in .env.local)
  const helixKey = process.env.HELIUS_API_KEY;
  if (helixKey) {
    try {
      const res = await fetch(
        `https://api.helius.xyz/v0/addresses/${address}/transactions?api-key=${helixKey}&type=SWAP&limit=30`
      );
      if (res.ok) {
        const data = await res.json();
        const items = (Array.isArray(data) ? data : []).map(
          (tx: {
            signature?: string;
            timestamp?: number;
            tokenTransfers?: Array<{
              mint?: string;
              fromUserAccount?: string;
              toUserAccount?: string;
              tokenAmount?: number;
            }>;
            nativeTransfers?: Array<{ amount?: number }>;
            type?: string;
          }) => {
            const inTransfer = tx.tokenTransfers?.find((t) => t.mint === address);
            const solTransfer = tx.nativeTransfers?.[0];
            return {
              txHash: tx.signature ?? "",
              blockUnixTime: tx.timestamp ?? 0,
              side: inTransfer ? "sell" : "buy",
              from: { uiAmount: solTransfer?.amount ? solTransfer.amount / 1e9 : 0, symbol: "SOL" },
              to: { uiAmount: inTransfer?.tokenAmount ?? 0, symbol: "" },
              owner: inTransfer?.fromUserAccount ?? inTransfer?.toUserAccount ?? "",
            };
          }
        );
        return NextResponse.json({ items });
      }
    } catch {
      // fall through to BirdEye
    }
  }

  // Fallback: BirdEye (requires paid plan for this endpoint)
  const birdeyeKey = process.env.BIRDEYE_API_KEY;
  if (birdeyeKey) {
    try {
      const res = await fetch(
        `https://public-api.birdeye.so/defi/trades/token?address=${address}&offset=0&limit=30&tx_type=swap`,
        { headers: { "X-API-KEY": birdeyeKey, "x-chain": "solana" } }
      );
      if (res.ok) {
        const data = await res.json();
        return NextResponse.json({ items: data.data?.items ?? [] });
      }
      const errBody = await res.json().catch(() => ({}));
      console.error("BirdEye trades error:", res.status, errBody);
    } catch {
      // fall through
    }
  }

  return NextResponse.json({ items: [] });
}
