"use client";

import { useEffect, useState, useCallback } from "react";

interface TradeItem {
  txHash?: string;
  blockUnixTime: number;
  side: "buy" | "sell";
  from: { address: string; uiAmount: number };
  to: { address: string; uiAmount: number };
  volume: number;
  owner?: string;
  source?: string;
}

function truncateAddress(addr: string): string {
  if (!addr || addr.length < 8) return addr;
  return `${addr.slice(0, 4)}…${addr.slice(-4)}`;
}

function formatUsd(n: number): string {
  if (n >= 1_000_000) return `$${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `$${(n / 1_000).toFixed(1)}K`;
  return `$${n.toFixed(2)}`;
}

function formatTokenAmt(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
  return n.toFixed(2);
}

function timeAgo(unixTime: number): string {
  const diff = Math.floor(Date.now() / 1000) - unixTime;
  if (diff < 60) return `${diff}s ago`;
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
  return `${Math.floor(diff / 86400)}d ago`;
}

function SkeletonRow() {
  return (
    <tr>
      {[1, 2, 3, 4, 5].map((i) => (
        <td key={i} className="px-4 py-2.5">
          <div className="h-3 rounded bg-white/10 animate-pulse" style={{ width: `${[64, 40, 56, 56, 40][i - 1]}%` }} />
        </td>
      ))}
    </tr>
  );
}

export default function LiveTrades({ address }: { address: string }) {
  const [trades, setTrades] = useState<TradeItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  const fetchTrades = useCallback(() => {
    fetch(`/api/tokens/${address}/trades`)
      .then((r) => r.json())
      .then((data) => {
        if (data.items) {
          setTrades(data.items);
          setError(false);
        } else {
          setError(true);
        }
        setLoading(false);
      })
      .catch(() => {
        setError(true);
        setLoading(false);
      });
  }, [address]);

  useEffect(() => {
    setLoading(true);
    setTrades([]);
    fetchTrades();
    const id = setInterval(fetchTrades, 10_000);
    return () => clearInterval(id);
  }, [fetchTrades]);

  if (error && !loading && trades.length === 0) {
    return <p className="text-center text-xs text-white/30 py-8">Failed to load trades</p>;
  }

  return (
    <table className="w-full text-xs">
      <thead className="sticky top-0 bg-[#060510] z-10">
        <tr className="border-b border-white/[0.07]">
          <th className="px-4 py-2 text-left text-white/35 font-medium">Trader</th>
          <th className="px-4 py-2 text-left text-white/35 font-medium">Type</th>
          <th className="px-4 py-2 text-right text-white/35 font-medium">USD</th>
          <th className="px-4 py-2 text-right text-white/35 font-medium">Tokens</th>
          <th className="px-4 py-2 text-right text-white/35 font-medium">Time</th>
        </tr>
      </thead>
      <tbody>
        {loading && trades.length === 0
          ? Array.from({ length: 10 }).map((_, i) => <SkeletonRow key={i} />)
          : trades.map((trade, i) => {
              const isBuy = trade.side === "buy";
              const ownerAddr = trade.owner ?? trade.from?.address ?? "";
              const tokenAmt = isBuy ? trade.to?.uiAmount : trade.from?.uiAmount;
              return (
                <tr key={trade.txHash ?? i} className="border-b border-white/[0.04] hover:bg-white/[0.025] transition-colors">
                  <td className="px-4 py-2.5 font-mono text-white/60">{truncateAddress(ownerAddr)}</td>
                  <td className="px-4 py-2.5">
                    <span
                      className={`inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-bold ${
                        isBuy ? "bg-green-400/10 text-green-400" : "bg-red-400/10 text-red-400"
                      }`}
                    >
                      {isBuy ? "Buy" : "Sell"}
                    </span>
                  </td>
                  <td className="px-4 py-2.5 text-right font-medium">{formatUsd(trade.volume ?? 0)}</td>
                  <td className="px-4 py-2.5 text-right text-white/50">{formatTokenAmt(tokenAmt ?? 0)}</td>
                  <td className="px-4 py-2.5 text-right text-white/35">{timeAgo(trade.blockUnixTime)}</td>
                </tr>
              );
            })}
      </tbody>
    </table>
  );
}
