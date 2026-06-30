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
  if (!addr || addr.length < 10) return addr;
  return `${addr.slice(0, 5)}…${addr.slice(-4)}`;
}

function formatUsd(n: number): string {
  if (n >= 1_000_000) return `$${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `$${(n / 1_000).toFixed(1)}K`;
  return `$${n.toFixed(2)}`;
}

function formatMc(n: number): string {
  if (!n) return "—";
  if (n >= 1_000_000_000) return `$${(n / 1_000_000_000).toFixed(1)}B`;
  if (n >= 1_000_000) return `$${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `$${(n / 1_000).toFixed(0)}K`;
  return `$${n.toFixed(0)}`;
}

function timeAgo(unixTime: number): string {
  const diff = Math.floor(Date.now() / 1000) - unixTime;
  if (diff < 60) return `${diff}s`;
  if (diff < 3600) return `${Math.floor(diff / 60)}m`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h`;
  return `${Math.floor(diff / 86400)}d`;
}

const AVATAR_COLORS = [
  "#6366f1", "#8b5cf6", "#ec4899", "#f59e0b",
  "#10b981", "#3b82f6", "#ef4444", "#14b8a6",
];

function avatarColor(addr: string): string {
  return AVATAR_COLORS[(addr?.charCodeAt(2) ?? 0) % AVATAR_COLORS.length];
}

function SkeletonRow() {
  return (
    <div className="flex items-center px-4 py-2.5 gap-3 border-b border-white/4">
      <div className="w-6 h-6 rounded-full bg-white/10 animate-pulse shrink-0" />
      <div className="flex-1 h-3 rounded bg-white/10 animate-pulse" />
      <div className="w-10 h-3 rounded bg-white/10 animate-pulse" />
      <div className="w-14 h-3 rounded bg-white/10 animate-pulse" />
      <div className="w-16 h-3 rounded bg-white/10 animate-pulse" />
      <div className="w-8  h-3 rounded bg-white/10 animate-pulse" />
    </div>
  );
}

type TradeFilter = "all" | "buy" | "sell";

export default function LiveTrades({ address, tokenMc }: { address: string; tokenMc?: number }) {
  const [trades, setTrades] = useState<TradeItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [filter, setFilter] = useState<TradeFilter>("all");

  const fetchTrades = useCallback(() => {
    fetch(`/api/tokens/${address}/trades`)
      .then((r) => r.json())
      .then((data) => {
        if (data.items) { setTrades(data.items); setError(false); }
        else setError(true);
        setLoading(false);
      })
      .catch(() => { setError(true); setLoading(false); });
  }, [address]);

  useEffect(() => {
    setLoading(true);
    setTrades([]);
    fetchTrades();
    const id = setInterval(fetchTrades, 10_000);
    return () => clearInterval(id);
  }, [fetchTrades]);

  if (error && !loading && trades.length === 0) {
    return <p className="text-center text-xs text-white/30 py-8">Failed to load swaps</p>;
  }

  const filtered = filter === "all" ? trades : trades.filter((t) => t.side === filter);

  return (
    <div className="w-full text-xs">
      {/* Filter + Header */}
      <div className="sticky top-0 bg-[#060510] z-10 border-b border-white/[0.07]">
        <div className="flex gap-1 px-4 pt-2 pb-1.5">
          {(["all", "buy", "sell"] as TradeFilter[]).map((f) => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              className={`px-2.5 py-0.5 rounded-full text-[10px] font-semibold capitalize transition-colors cursor-pointer ${
                filter === f
                  ? f === "buy" ? "bg-green-400/20 text-green-400"
                    : f === "sell" ? "bg-red-400/20 text-red-400"
                    : "bg-white/10 text-white/80"
                  : "text-white/30 hover:text-white/60"
              }`}
            >
              {f === "all" ? "All" : f === "buy" ? "Buys" : "Sells"}
            </button>
          ))}
        </div>
        <div className="flex items-center px-4 py-1.5">
          <span className="flex-1 text-white/35 font-medium">Trader</span>
          <span className="w-14 text-left text-white/35 font-medium">Action</span>
          <span className="w-20 text-right text-white/35 font-medium">Amount</span>
          <span className="w-20 text-right text-white/35 font-medium">Market Cap</span>
          <span className="w-10 text-right text-white/35 font-medium">Time</span>
        </div>
      </div>

      {loading && trades.length === 0
        ? Array.from({ length: 12 }).map((_, i) => <SkeletonRow key={i} />)
        : filtered.length === 0 ? (
            <p className="text-center text-white/30 py-8">No {filter === "all" ? "" : filter} trades</p>
          ) : filtered.map((trade, i) => {
            const isBuy     = trade.side === "buy";
            const ownerAddr = trade.owner ?? trade.from?.address ?? "";
            return (
              <div
                key={trade.txHash ?? i}
                className="flex items-center px-4 py-2.5 border-b border-white/4 hover:bg-white/2.5 transition-colors gap-3"
              >
                {/* Trader */}
                <div className="flex items-center gap-2 flex-1 min-w-0">
                  <div
                    className="w-6 h-6 rounded-full shrink-0 flex items-center justify-center text-[9px] font-bold text-white/90"
                    style={{ background: avatarColor(ownerAddr) }}
                  >
                    {ownerAddr?.[0]?.toUpperCase() ?? "?"}
                  </div>
                  <a
                    href={`https://solscan.io/account/${ownerAddr}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="font-mono text-white/60 hover:text-[#606AF7] transition-colors truncate"
                    onClick={(e) => e.stopPropagation()}
                  >
                    {truncateAddress(ownerAddr)}
                  </a>
                </div>

                {/* Action */}
                <div className="w-14 shrink-0 flex justify-end">
                  <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold ${
                    isBuy ? "bg-green-950/80 text-green-400" : "bg-red-950/80 text-red-400"
                  }`}>
                    {isBuy ? "Buy" : "Sell"}
                  </span>
                </div>

                {/* Amount */}
                <span className="w-20 text-right font-semibold shrink-0">
                  {formatUsd(trade.volume ?? 0)}
                </span>

                {/* Market Cap */}
                <span className="w-20 text-right text-white/50 shrink-0">
                  {formatMc(tokenMc ?? 0)}
                </span>

                {/* Time */}
                <span className="w-10 text-right text-white/35 shrink-0">
                  {timeAgo(trade.blockUnixTime)}
                </span>
              </div>
            );
          })}
    </div>
  );
}
