"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";

export interface TickerToken {
  address: string;
  symbol: string;
  name: string;
  price: number;
  change24h: number;
  logoURI?: string;
}

const MOCK_TOKENS: TickerToken[] = [
  // { address: "So11111111111111111111111111111111111111112",  symbol: "SOL",   name: "Solana",         price: 168.42,     change24h:  3.21 },
  // { address: "DezXAZ8z7PnrnRJjz3wXBoRgixCa6xjnB7YaB1pPB263", symbol: "BONK", name: "Bonk",          price: 0.00002341, change24h: -2.10 },
  // { address: "EKpQGSJtjMFqKZ9KQanSqYXRcF8fBopzLHYxdM65zcjm", symbol: "WIF",  name: "dogwifhat",     price: 2.87,       change24h:  7.45 },
  // { address: "JUPyiwrYJFskUPiHa7hkeR8VUtAeFoSYbKedZNsDvCN",  symbol: "JUP",  name: "Jupiter",       price: 0.9134,     change24h:  1.83 },
  // { address: "jtojtomepa8bduh8dcxvnwbs7gbhxopozarlhxy4pwa",  symbol: "JTO",  name: "Jito",          price: 3.41,       change24h: -0.72 },
  // { address: "HZ1JovNiVvGqDMcGqMRggra1k99Q6MkXWzG5T5aMFmXk", symbol: "PYTH", name: "Pyth Network",  price: 0.2871,     change24h:  5.14 },
  // { address: "7vfCXTUXx5WJV5JADk17DUJ4ksgau7utNKj4b963voxs", symbol: "WEN",  name: "Wen",           price: 0.00008234, change24h: 12.30 },
  // { address: "rndrizKT3MK1iimdxRdWabcF7Zg7AR5T4nud4EkHBof",  symbol: "RNDR", name: "Render",        price: 7.23,       change24h:  2.94 },
  // { address: "orcaEKTdK7LKz57vaAYr9QeNsVEPfiu6QeMU1kektZE",  symbol: "ORCA", name: "Orca",          price: 3.51,       change24h: -1.20 },
  // { address: "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v",  symbol: "USDC", name: "USD Coin",      price: 1.0001,     change24h:  0.01 },
  // { address: "mSoLzYCxHdYgdzU16g5QSh3i5K3z3KZK7ytfqcJm7So",  symbol: "mSOL", name: "Marinade SOL",  price: 185.20,     change24h:  3.10 },
  // { address: "4k3Dyjzvzp8eMZWUXbBCjEvwSkkk59S5iCNLY3QrkX6R", symbol: "RAY",  name: "Raydium",       price: 2.14,       change24h: -1.80 },
];

function formatPrice(price: number): string {
  if (price >= 1000) return `$${price.toLocaleString("en-US", { maximumFractionDigits: 2 })}`;
  if (price >= 1)    return `$${price.toFixed(2)}`;
  if (price >= 0.01) return `$${price.toFixed(4)}`;
  return `$${price.toFixed(8)}`;
}

interface Props {
  direction?: "left" | "right";
  speed?: number;
}

export default function TokenTicker({ direction = "left", speed = 40 }: Props) {
  const router = useRouter();
  const [tokens, setTokens] = useState<TickerToken[]>(MOCK_TOKENS);
  const [live, setLive] = useState(false);

  useEffect(() => {
    async function fetchTokens() {
      try {
        const res = await fetch("/api/tokens/trending", { cache: "no-store" });
        if (!res.ok) return;
        const data = await res.json();
        if (Array.isArray(data.tokens) && data.tokens.length > 0) {
          setTokens(data.tokens);
          setLive(true);
        }
      } catch {
        // silently fall back to mock data
      }
    }

    fetchTokens();
    const interval = setInterval(fetchTokens, 30_000);
    return () => clearInterval(interval);
  }, []);

  const doubled = [...tokens, ...tokens];

  return (
    <div className="w-full overflow-hidden bg-[#0e0c1e]/80 backdrop-blur-sm border-y border-white/[0.06] py-2.5">
      {/* Live indicator */}
      {live && (
        <span className="absolute left-3 top-1/2 -translate-y-1/2 flex items-center gap-1 z-10 pointer-events-none">
          <span className="w-1.5 h-1.5 rounded-full bg-green-400 animate-pulse" />
        </span>
      )}
      <div
        className={direction === "left" ? "animate-ticker" : "animate-ticker-reverse"}
        style={{ animationDuration: `${speed}s`, display: "flex", width: "max-content" }}
      >
        {doubled.map((token, i) => {
          const up = token.change24h >= 0;
          return (
            <button
              key={`${token.address}-${i}`}
              onClick={() => router.push(`/trade/${token.address}`)}
              className="flex items-center gap-2 px-5 cursor-pointer group shrink-0"
            >
              {token.logoURI && (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={token.logoURI}
                  alt={token.symbol}
                  className="w-4 h-4 rounded-full shrink-0"
                  onError={(e) => { (e.target as HTMLImageElement).style.display = "none"; }}
                />
              )}
              <span className="text-[13px] font-bold text-[#eaedff] group-hover:text-white transition-colors">
                {token.symbol}
              </span>
              <span className="text-[13px] text-[#9ba3d4]">
                {formatPrice(token.price)}
              </span>
              <span className={`text-[12px] font-medium ${up ? "text-green-400" : "text-red-400"}`}>
                {up ? "+" : ""}{token.change24h.toFixed(2)}%
              </span>
              <span className="text-white/10 ml-1">•</span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
