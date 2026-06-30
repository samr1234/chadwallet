"use client";

import { useEffect, useState } from "react";

interface HolderItem {
  owner: string;
  amount?: number;
  uiAmount?: number;
  percentage?: number;
}

function truncateAddress(addr: string): string {
  if (!addr || addr.length < 10) return addr;
  return `${addr.slice(0, 5)}…${addr.slice(-4)}`;
}

function formatAmount(n: number): string {
  if (n >= 1_000_000_000) return `${(n / 1_000_000_000).toFixed(2)}B`;
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(2)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
  return n.toFixed(2);
}

function formatUsd(n: number): string {
  if (n >= 1_000_000) return `$${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `$${(n / 1_000).toFixed(1)}K`;
  return `$${n.toFixed(2)}`;
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
      <div className="w-24 h-3 rounded bg-white/10 animate-pulse" />
      <div className="w-16 h-3 rounded bg-white/10 animate-pulse" />
      <div className="w-20 h-3 rounded bg-white/10 animate-pulse" />
    </div>
  );
}

export default function TokenHolders({ address, tokenPrice }: { address: string; tokenPrice?: number }) {
  const [holders, setHolders] = useState<HolderItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  useEffect(() => {
    const load = () =>
      fetch(`/api/tokens/${address}/holders`)
        .then((r) => r.json())
        .then((data) => {
          if (data.items) { setHolders(data.items); setError(false); }
          else setError(true);
          setLoading(false);
        })
        .catch(() => { setError(true); setLoading(false); });

    setLoading(true);
    setHolders([]);
    load();
    const id = setInterval(load, 30_000);
    return () => clearInterval(id);
  }, [address]);

  if (error && !loading && holders.length === 0) {
    return <p className="text-center text-xs text-white/30 py-8">Failed to load holders</p>;
  }

  return (
    <div className="w-full text-xs">
      {/* Header */}
      <div className="flex items-center px-4 py-2 border-b border-white/[0.07] sticky top-0 bg-[#060510] z-10">
        <span className="flex-1 text-white/35 font-medium">Trader</span>
        <span className="w-28 text-right text-white/35 font-medium">Position</span>
        <span className="w-24 text-right text-white/35 font-medium">PnL</span>
        <span className="w-24 text-right text-white/35 font-medium">Avg Entry</span>
      </div>

      {loading && holders.length === 0
        ? Array.from({ length: 15 }).map((_, i) => <SkeletonRow key={i} />)
        : holders.map((holder) => {
            const amt      = holder.uiAmount ?? holder.amount ?? 0;
            const usdValue = tokenPrice ? amt * tokenPrice : null;

            return (
              <div
                key={holder.owner}
                className="flex items-center px-4 py-2.5 border-b border-white/4 hover:bg-white/2.5 transition-colors gap-3"
              >
                {/* Trader */}
                <div className="flex items-center gap-2 flex-1 min-w-0">
                  <div
                    className="w-6 h-6 rounded-full shrink-0 flex items-center justify-center text-[9px] font-bold text-white/90"
                    style={{ background: avatarColor(holder.owner) }}
                  >
                    {holder.owner?.[0]?.toUpperCase() ?? "?"}
                  </div>
                  <a
                    href={`https://solscan.io/account/${holder.owner}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="font-mono text-white/60 hover:text-[#606AF7] transition-colors truncate"
                  >
                    {truncateAddress(holder.owner)}
                  </a>
                </div>

                {/* Position */}
                <div className="w-28 text-right shrink-0">
                  {usdValue != null && (
                    <p className="font-semibold text-white/90">{formatUsd(usdValue)}</p>
                  )}
                  <p className="text-white/40 text-[10px]">
                    {formatAmount(amt)}
                    {holder.percentage != null && (
                      <span className="ml-1 text-white/25">({holder.percentage.toFixed(2)}%)</span>
                    )}
                  </p>
                </div>

                {/* PnL */}
                <div className="w-24 text-right shrink-0">
                  <span className="text-white/25">—</span>
                </div>

                {/* Avg Entry */}
                <div className="w-24 text-right shrink-0">
                  <span className="text-white/25">—</span>
                </div>
              </div>
            );
          })}
    </div>
  );
}
