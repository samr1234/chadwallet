import { NextResponse } from "next/server";
import { Connection, PublicKey } from "@solana/web3.js";
import type { ParsedMessageAccount } from "@solana/web3.js";

const SOL_MINT = "So11111111111111111111111111111111111111112";

async function getSolPrice(apiKey: string): Promise<number> {
  try {
    const res = await fetch(
      `https://public-api.birdeye.so/defi/price?address=${SOL_MINT}`,
      { headers: { "X-API-KEY": apiKey, "x-chain": "solana" } }
    );
    if (res.ok) {
      const d = await res.json();
      return (d.data?.value as number) || 150;
    }
  } catch {}
  return 150;
}

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ address: string }> }
) {
  const { address } = await params;
  const birdeyeKey = process.env.BIRDEYE_API_KEY;

  // 1. Try BirdEye trades endpoint (works on paid plans)
  if (birdeyeKey) {
    try {
      const res = await fetch(
        `https://public-api.birdeye.so/defi/trades/token?address=${address}&offset=0&limit=30&tx_type=swap`,
        { headers: { "X-API-KEY": birdeyeKey, "x-chain": "solana" } }
      );
      if (res.ok) {
        const data = await res.json();
        const items = data.data?.items ?? [];
        if (items.length > 0) return NextResponse.json({ items });
      } else {
        await res.text().catch(() => {});
      }
    } catch {}
  }

  // 2. Solana RPC fallback — parse on-chain swap transactions
  const rpcUrl =
    !process.env.NEXT_PUBLIC_ALCHEMY_RPC_URL ||
    process.env.NEXT_PUBLIC_ALCHEMY_RPC_URL.includes("YOUR_KEY")
      ? "https://api.mainnet-beta.solana.com"
      : process.env.NEXT_PUBLIC_ALCHEMY_RPC_URL!;

  try {
    const connection = new Connection(rpcUrl, "confirmed");
    const mint = new PublicKey(address);

    const [sigInfos, solPrice] = await Promise.all([
      connection.getSignaturesForAddress(mint, { limit: 40 }),
      birdeyeKey ? getSolPrice(birdeyeKey) : Promise.resolve(150),
    ]);

    const validSigs = sigInfos
      .filter((s) => !s.err)
      .slice(0, 20)
      .map((s) => s.signature);

    if (!validSigs.length) return NextResponse.json({ items: [] });

    const txs = await connection.getParsedTransactions(validSigs, {
      maxSupportedTransactionVersion: 0,
    });

    const items: object[] = [];

    for (let i = 0; i < txs.length; i++) {
      const tx = txs[i];
      if (!tx || tx.meta?.err) continue;

      const accountKeys = tx.transaction.message.accountKeys as ParsedMessageAccount[];
      const signerAddr = accountKeys[0]?.pubkey?.toBase58() ?? "";
      if (!signerAddr) continue;

      const pre  = tx.meta?.preTokenBalances  ?? [];
      const post = tx.meta?.postTokenBalances ?? [];

      // Find the signer's token balance change for this mint
      const userPre  = pre.find((p) => p.mint === address && p.owner === signerAddr);
      const userPost = post.find((p) => p.mint === address && p.owner === signerAddr);
      const tokenDelta =
        (userPost?.uiTokenAmount.uiAmount ?? 0) -
        (userPre?.uiTokenAmount.uiAmount ?? 0);

      if (Math.abs(tokenDelta) < 1e-6) continue;

      // SOL spent / received by the signer (lamports → SOL)
      const solChangeLamports = Math.abs(
        (tx.meta?.postBalances[0] ?? 0) - (tx.meta?.preBalances[0] ?? 0)
      );
      const solChange = solChangeLamports / 1e9;

      // Skip pure token transfers (no meaningful SOL movement)
      if (solChange < 0.0005) continue;

      const side: "buy" | "sell" = tokenDelta > 0 ? "buy" : "sell";

      items.push({
        txHash: validSigs[i],
        blockUnixTime: tx.blockTime ?? 0,
        side,
        from: { address: signerAddr, uiAmount: Math.abs(tokenDelta) },
        to:   { address: signerAddr, uiAmount: Math.abs(tokenDelta) },
        volume: solChange * solPrice,
        owner: signerAddr,
      });
    }

    return NextResponse.json({ items });
  } catch {
    return NextResponse.json({ items: [] });
  }
}
