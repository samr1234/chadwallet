import { NextResponse } from "next/server";
import { Connection, PublicKey } from "@solana/web3.js";

export const revalidate = 60;

const SOL_MINT = "So11111111111111111111111111111111111111112";

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ address: string }> }
) {
  const { address } = await params;

  // Native SOL has no SPL holder list — return empty
  if (address === SOL_MINT) {
    return NextResponse.json({ items: [] });
  }

  // Use Alchemy RPC if configured, otherwise fall back to public Solana mainnet
  const rpc =
    process.env.NEXT_PUBLIC_ALCHEMY_RPC_URL?.includes("YOUR_KEY") || !process.env.NEXT_PUBLIC_ALCHEMY_RPC_URL
      ? "https://api.mainnet-beta.solana.com"
      : process.env.NEXT_PUBLIC_ALCHEMY_RPC_URL;

  try {
    const connection = new Connection(rpc, "confirmed");
    const mint = new PublicKey(address);

    // Get top 20 holders (free, no API key)
    const [largestAccounts, supplyRes] = await Promise.all([
      connection.getTokenLargestAccounts(mint),
      connection.getTokenSupply(mint),
    ]);

    const totalSupply = Number(supplyRes.value.amount);
    const decimals = supplyRes.value.decimals;

    const items = largestAccounts.value.map((acc, i) => ({
      rank: i + 1,
      owner: acc.address.toBase58(),
      uiAmount: acc.uiAmount ?? 0,
      percentage: totalSupply > 0 ? (Number(acc.amount) / totalSupply) * 100 : 0,
      decimals,
    }));

    return NextResponse.json({ items });
  } catch (err) {
    console.error("Holders fetch failed:", err);
    return NextResponse.json({ items: [] });
  }
}
