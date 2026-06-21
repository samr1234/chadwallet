"use client";

import { useEffect, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { usePrivy } from "@privy-io/react-auth";
import { Star } from "lucide-react";

interface Token {
  address: string;
  symbol: string;
  name: string;
  price: number;
  change24h: number;
  logoURI?: string;
}

function formatPrice(p: number): string {
  if (!p) return "$0";
  if (p >= 1000) return `$${p.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  if (p >= 1) return `$${p.toFixed(2)}`;
  if (p >= 0.01) return `$${p.toFixed(4)}`;
  return `$${p.toFixed(8)}`;
}

function TokenLogo({ token }: { token: Token }) {
  const [errored, setErrored] = useState(false);

  if (!token.logoURI || errored) {
    return (
      <div className="w-8 h-8 rounded-full bg-[#1a1830] flex items-center justify-center text-xs font-bold text-[#9ba3d4] shrink-0">
        {token.symbol?.[0] ?? "?"}
      </div>
    );
  }

  return (
    <img
      src={token.logoURI}
      alt={token.symbol}
      className="w-8 h-8 rounded-full object-cover shrink-0"
      onError={() => setErrored(true)}
    />
  );
}

function SkeletonRow() {
  return (
    <div className="flex items-center gap-3 px-3 py-2.5">
      <div className="w-8 h-8 rounded-full bg-white/10 animate-pulse shrink-0" />
      <div className="flex-1 min-w-0">
        <div className="h-3.5 w-14 bg-white/10 rounded animate-pulse mb-1.5" />
        <div className="h-3 w-20 bg-white/10 rounded animate-pulse" />
      </div>
      <div className="text-right">
        <div className="h-3.5 w-12 bg-white/10 rounded animate-pulse mb-1.5" />
        <div className="h-3 w-8 bg-white/10 rounded animate-pulse ml-auto" />
      </div>
    </div>
  );
}

export default function TokenList({ address, horizontal = false }: { address: string; horizontal?: boolean }) {
  const [tokens, setTokens] = useState<Token[]>([]);
  const [loading, setLoading] = useState(true);
  const [watchlist, setWatchlist] = useState<Set<string>>(new Set());
  const { authenticated, user } = usePrivy();
  const router = useRouter();

  useEffect(() => {
    if (!authenticated || !user?.id) return;
    fetch(`/api/watchlist?privy_id=${user.id}`)
      .then((r) => r.json())
      .then((data) => {
        if (data.watchlist) {
          setWatchlist(new Set(data.watchlist.map((w: { token_address: string }) => w.token_address)));
        }
      })
      .catch(() => {});
  }, [authenticated, user?.id]);

  function toggleStar(token: Token, e: React.MouseEvent) {
    e.stopPropagation();
    if (!user?.id) return;
    const isStarred = watchlist.has(token.address);
    // Optimistic update
    setWatchlist((prev) => {
      const next = new Set(prev);
      if (isStarred) {
        next.delete(token.address);
      } else {
        next.add(token.address);
      }
      return next;
    });
    if (isStarred) {
      fetch(`/api/watchlist/${token.address}?privy_id=${user.id}`, { method: "DELETE" }).catch(() => {});
    } else {
      fetch("/api/watchlist", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          privy_id: user.id,
          token_address: token.address,
          token_symbol: token.symbol,
          token_name: token.name,
        }),
      }).catch(() => {});
    }
  }

  const fetchTokens = useCallback(() => {
    fetch("/api/tokens/trending")
      .then((r) => r.json())
      .then((data) => {
        if (data.tokens) setTokens(data.tokens);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, []);

  useEffect(() => {
    fetchTokens();
    const id = setInterval(fetchTokens, 30_000);
    return () => clearInterval(id);
  }, [fetchTokens]);

  // Horizontal strip for mobile
  if (horizontal) {
    return (
      <div className="flex overflow-x-auto gap-2 px-3 py-2.5 scrollbar-none">
        {loading
          ? Array.from({ length: 8 }).map((_, i) => (
              <div key={i} className="shrink-0 w-20 h-14 rounded-xl bg-white/5 animate-pulse" />
            ))
          : tokens.map((token) => {
              const isActive = token.address === address;
              const positive = token.change24h >= 0;
              return (
                <button
                  key={token.address}
                  onClick={() => router.push(`/trade/${token.address}`)}
                  className={`shrink-0 flex flex-col items-center gap-1 px-3 py-2 rounded-xl border transition-colors cursor-pointer ${
                    isActive
                      ? "bg-[#606AF7]/15 border-[#606AF7]/40"
                      : "bg-white/[0.03] border-white/[0.07] hover:bg-white/[0.06]"
                  }`}
                >
                  <div className="w-7 h-7 rounded-full overflow-hidden shrink-0 flex items-center justify-center bg-[#1a1830]">
                    {token.logoURI
                      ? <img src={token.logoURI} alt={token.symbol} className="w-full h-full object-cover" onError={(e) => { (e.target as HTMLImageElement).style.display = "none"; }} />
                      : <span className="text-[10px] font-bold text-[#9ba3d4]">{token.symbol?.[0] ?? "?"}</span>
                    }
                  </div>
                  <span className="text-[10px] font-bold text-[#eaedff]">{token.symbol}</span>
                  <span className={`text-[9px] font-semibold ${positive ? "text-green-400" : "text-red-400"}`}>
                    {positive ? "+" : ""}{token.change24h.toFixed(1)}%
                  </span>
                </button>
              );
            })}
      </div>
    );
  }

  return (
    <>
      <div className="shrink-0 px-3 py-3 flex items-center justify-between border-b border-white/[0.07]">
        <span className="text-xs font-bold uppercase tracking-wider text-white/50">Tokens</span>
        <span className="flex items-center gap-1.5">
          <span className="w-1.5 h-1.5 rounded-full bg-green-400 animate-pulse" />
          <span className="text-[10px] text-white/30">Live</span>
        </span>
      </div>

      <div className="flex-1 overflow-y-auto">
        {loading ? (
          Array.from({ length: 12 }).map((_, i) => <SkeletonRow key={i} />)
        ) : tokens.length === 0 ? (
          <p className="text-center text-xs text-white/30 py-8">No tokens</p>
        ) : (
          tokens.map((token) => {
            const isActive = token.address === address;
            const positive = token.change24h >= 0;
            return (
              <button
                key={token.address}
                onClick={() => router.push(`/trade/${token.address}`)}
                className={`group w-full flex items-center gap-3 px-3 py-2.5 cursor-pointer transition-colors text-left relative ${
                  isActive
                    ? "bg-[#606AF7]/10 border-l-2 border-[#606AF7]"
                    : "border-l-2 border-transparent hover:bg-white/[0.04]"
                }`}
              >
                <TokenLogo token={token} />
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-bold truncate">{token.symbol}</p>
                  <p className="text-[11px] text-white/35 truncate">{token.name}</p>
                </div>
                <div className="text-right shrink-0">
                  <p className="text-xs font-semibold">{formatPrice(token.price)}</p>
                  <p className={`text-[11px] font-medium ${positive ? "text-green-400" : "text-red-400"}`}>
                    {positive ? "+" : ""}{token.change24h.toFixed(2)}%
                  </p>
                </div>
                {user && (
                  <button
                    onClick={(e) => toggleStar(token, e)}
                    className={`shrink-0 p-1 rounded transition-colors ${
                      watchlist.has(token.address)
                        ? "text-yellow-400"
                        : "text-white/0 group-hover:text-white/30 hover:text-yellow-400!"
                    }`}
                  >
                    <Star className="w-3 h-3" fill={watchlist.has(token.address) ? "currentColor" : "none"} />
                  </button>
                )}
              </button>
            );
          })
        )}
      </div>
    </>
  );
}
