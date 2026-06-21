"use client";

import { useEffect, useState } from "react";

interface HolderItem {
  owner: string;
  amount?: number;
  uiAmount?: number;
  percentage?: number;
}

function truncateAddress(addr: string): string {
  if (!addr || addr.length < 8) return addr;
  return `${addr.slice(0, 4)}…${addr.slice(-4)}`;
}

function formatAmount(n: number): string {
  if (n >= 1_000_000_000) return `${(n / 1_000_000_000).toFixed(2)}B`;
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(2)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
  return n.toFixed(2);
}

function SkeletonRow({ rank }: { rank: number }) {
  return (
    <tr>
      <td className="px-4 py-2.5 text-white/20 text-xs">{rank}</td>
      <td className="px-4 py-2.5">
        <div className="h-3 w-24 rounded bg-white/10 animate-pulse" />
      </td>
      <td className="px-4 py-2.5">
        <div className="h-3 w-16 rounded bg-white/10 animate-pulse ml-auto" />
      </td>
      <td className="px-4 py-2.5">
        <div className="flex items-center gap-2 justify-end">
          <div className="h-3 w-8 rounded bg-white/10 animate-pulse" />
          <div className="h-1.5 w-[60px] rounded-full bg-white/10 animate-pulse" />
        </div>
      </td>
    </tr>
  );
}

export default function TokenHolders({ address }: { address: string }) {
  const [holders, setHolders] = useState<HolderItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  useEffect(() => {
    setLoading(true);
    setHolders([]);
    fetch(`/api/tokens/${address}/holders`)
      .then((r) => r.json())
      .then((data) => {
        if (data.items) {
          setHolders(data.items);
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

  if (error && !loading && holders.length === 0) {
    return <p className="text-center text-xs text-white/30 py-8">Failed to load holders</p>;
  }

  const maxPct = holders.reduce((m, h) => Math.max(m, h.percentage ?? 0), 0) || 1;

  return (
    <table className="w-full text-xs">
      <thead className="sticky top-0 bg-[#060510] z-10">
        <tr className="border-b border-white/[0.07]">
          <th className="px-4 py-2 text-left text-white/35 font-medium w-10">#</th>
          <th className="px-4 py-2 text-left text-white/35 font-medium">Address</th>
          <th className="px-4 py-2 text-right text-white/35 font-medium">Amount</th>
          <th className="px-4 py-2 text-right text-white/35 font-medium">% Supply</th>
        </tr>
      </thead>
      <tbody>
        {loading && holders.length === 0
          ? Array.from({ length: 15 }).map((_, i) => <SkeletonRow key={i} rank={i + 1} />)
          : holders.map((holder, i) => {
              const pct = holder.percentage ?? 0;
              const amt = holder.uiAmount ?? holder.amount ?? 0;
              const barWidth = Math.min(100, (pct / maxPct) * 100);
              return (
                <tr key={holder.owner} className="border-b border-white/[0.04] hover:bg-white/[0.025] transition-colors">
                  <td className="px-4 py-2.5 text-white/25">{i + 1}</td>
                  <td className="px-4 py-2.5 font-mono text-white/60">{truncateAddress(holder.owner)}</td>
                  <td className="px-4 py-2.5 text-right text-white/70 font-medium">{formatAmount(amt)}</td>
                  <td className="px-4 py-2.5">
                    <div className="flex items-center gap-2 justify-end">
                      <span className="text-white/50">{pct.toFixed(2)}%</span>
                      <div className="w-[60px] h-1.5 bg-white/10 rounded-full overflow-hidden">
                        <div
                          className="h-full bg-[#606AF7] rounded-full transition-all duration-500"
                          style={{ width: `${barWidth}%` }}
                        />
                      </div>
                    </div>
                  </td>
                </tr>
              );
            })}
      </tbody>
    </table>
  );
}
