"use client";

import { useEffect, useState } from "react";
import Image from "next/image";
import { usePrivy } from "@privy-io/react-auth";
import AuthButton from "@/components/AuthButton";
import TokenList from "@/components/trading/TokenList";
import PriceChart from "@/components/trading/PriceChart";
import TradePanel from "@/components/trading/TradePanel";
import LiveTrades from "@/components/trading/LiveTrades";
import TokenHolders from "@/components/trading/TokenHolders";

interface TokenOverview {
  address: string;
  symbol: string;
  name: string;
  price: number;
  priceChange24hPercent?: number;
  mc?: number;
  v24hUSD?: number;
  logoURI?: string;
  supply?: number;
  decimals?: number;
}

type ActiveTab = "trades" | "holders";
type MobileTab = "chart" | "trade";

function formatLargeNumber(n: number): string {
  if (!n) return "$0";
  if (n >= 1_000_000_000) return `$${(n / 1_000_000_000).toFixed(2)}B`;
  if (n >= 1_000_000) return `$${(n / 1_000_000).toFixed(2)}M`;
  if (n >= 1_000) return `$${(n / 1_000).toFixed(1)}K`;
  return `$${n.toFixed(2)}`;
}

function formatPrice(p: number): string {
  if (!p) return "$0";
  if (p >= 1000) return `$${p.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  if (p >= 1) return `$${p.toFixed(2)}`;
  if (p >= 0.01) return `$${p.toFixed(4)}`;
  return `$${p.toFixed(8)}`;
}

function HeaderSkeleton() {
  return (
    <div className="flex items-center gap-6 flex-1 min-w-0">
      <div className="w-8 h-8 rounded-full bg-white/10 animate-pulse shrink-0" />
      <div className="flex flex-col gap-1.5">
        <div className="h-4 w-24 rounded bg-white/10 animate-pulse" />
        <div className="h-3 w-32 rounded bg-white/10 animate-pulse" />
      </div>
    </div>
  );
}

export default function TradingLayout({ address }: { address: string }) {
  const { ready, authenticated, user, login } = usePrivy();
  const [tokenData, setTokenData] = useState<TokenOverview | null>(null);
  const [activeTab, setActiveTab] = useState<ActiveTab>("trades");
  const [mobileTab, setMobileTab] = useState<MobileTab>("chart");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!authenticated || !user) return;
    const solWallet = user.linkedAccounts?.find(
      (a: { type: string; chainType?: string }) => a.type === "wallet" && a.chainType === "solana"
    ) as { address?: string } | undefined;
    fetch("/api/user/sync", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        privy_id: user.id,
        wallet_address: solWallet?.address,
        email: user.google?.email ?? user.apple?.email,
      }),
    }).catch(() => {});
  }, [authenticated, user]);

  useEffect(() => {
    // Don't clear tokenData — keep old token visible until new one loads to avoid flicker
    setLoading(true);

    const load = () =>
      fetch(`/api/tokens/${address}/overview`)
        .then((r) => r.json())
        .then((data) => { if (!data.error) setTokenData(data); })
        .catch(() => {})
        .finally(() => setLoading(false));

    load();
    const id = setInterval(load, 30_000);
    return () => clearInterval(id);
  }, [address]);

  const change = tokenData?.priceChange24hPercent ?? 0;

  // Auth gate
  if (!ready || !authenticated) {
    return (
      <div className="h-screen flex flex-col bg-[#060510] items-center justify-center gap-6 px-6">
        <a href="/" className="flex items-center gap-2.5 mb-2">
          <Image src="/logo.png" alt="ChadWallet" width={48} height={48} className="rounded-xl" />
          <span className="text-xl font-black tracking-tight text-[#eaedff]">Chad<span className="text-[#606AF7]">Wallet</span></span>
        </a>
        <div className="text-center">
          <h1 className="text-2xl font-bold tracking-tight text-[#eaedff] mb-2">Sign in to start trading</h1>
          <p className="text-sm text-white/40">Connect your wallet to trade Solana tokens.</p>
        </div>
        {ready ? (
          <button onClick={login} className="cursor-pointer bg-[#606AF7] hover:bg-[#7c85ff] transition-colors rounded-xl px-10 py-3 font-bold text-sm">
            Sign In
          </button>
        ) : (
          <div className="w-32 h-10 rounded-xl bg-white/5 animate-pulse" />
        )}
      </div>
    );
  }

  // Shared token header strip
  const tokenHeader = (
    <div className="shrink-0 px-4 py-3 border-b border-white/[0.07] flex items-center gap-4 min-w-0">
      {loading ? (
        <HeaderSkeleton />
      ) : tokenData ? (
        <>
          {tokenData.logoURI ? (
            <img src={tokenData.logoURI} alt={tokenData.symbol} className="w-8 h-8 rounded-full shrink-0 object-cover" />
          ) : (
            <div className="w-8 h-8 rounded-full bg-[#1a1830] shrink-0 flex items-center justify-center text-xs font-bold text-[#9ba3d4]">
              {tokenData.symbol?.[0] ?? "?"}
            </div>
          )}
          <div className="min-w-0">
            <div className="flex items-baseline gap-2">
              <span className="font-bold text-sm">{tokenData.symbol}</span>
              <span className="text-xs text-white/30 truncate">{tokenData.name}</span>
            </div>
            <div className="flex items-center gap-3 mt-0.5">
              <span className="text-base font-bold">{formatPrice(tokenData.price)}</span>
              <span className={`text-xs font-semibold ${change >= 0 ? "text-green-400" : "text-red-400"}`}>
                {change >= 0 ? "+" : ""}{change.toFixed(2)}%
              </span>
            </div>
          </div>
          <div className="hidden lg:flex items-center gap-6 ml-4 text-xs">
            <div>
              <p className="text-white/40 mb-0.5">Market Cap</p>
              <p className="font-semibold">{formatLargeNumber(tokenData.mc ?? 0)}</p>
            </div>
            <div>
              <p className="text-white/40 mb-0.5">24h Volume</p>
              <p className="font-semibold">{formatLargeNumber(tokenData.v24hUSD ?? 0)}</p>
            </div>
          </div>
        </>
      ) : (
        <p className="text-sm text-white/30">Token not found</p>
      )}
    </div>
  );

  // Shared chart + trades/holders panel
  const chartPanel = (
    <div className="flex-1 flex flex-col overflow-hidden">
      <div className="shrink-0">
        <PriceChart address={address} />
      </div>
      <div className="flex-1 flex flex-col overflow-hidden border-t border-white/[0.07]">
        <div className="shrink-0 flex border-b border-white/[0.07]">
          {(["trades", "holders"] as ActiveTab[]).map((tab) => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={`px-5 py-2.5 text-xs font-semibold capitalize transition-colors relative cursor-pointer ${
                activeTab === tab ? "text-[#eaedff]" : "text-white/40 hover:text-white/70"
              }`}
            >
              {tab === "trades" ? "Live Trades" : "Holders"}
              {activeTab === tab && <span className="absolute bottom-0 left-0 right-0 h-0.5 bg-[#606AF7]" />}
            </button>
          ))}
        </div>
        <div className="flex-1 overflow-y-auto">
          {activeTab === "trades" ? <LiveTrades address={address} /> : <TokenHolders address={address} />}
        </div>
      </div>
    </div>
  );

  return (
    <div className="h-screen flex flex-col bg-[#060510] overflow-hidden">
      {/* Header */}
      <header className="h-14 shrink-0 flex items-center px-4 gap-4 border-b border-white/[0.07]">
        <a href="/" className="flex items-center gap-2 shrink-0">
          <Image src="/logo.png" alt="ChadWallet" width={40} height={40} className="rounded-lg" />
          <span className="font-bold text-sm hidden sm:block">ChadWallet</span>
        </a>
        <div className="ml-auto">
          <AuthButton size="sm" />
        </div>
      </header>

      {/* ── Desktop layout (md+): 3 columns ── */}
      <main className="hidden md:flex flex-1 overflow-hidden">
        <aside className="w-64 border-r border-white/[0.07] flex flex-col overflow-hidden">
          <TokenList address={address} />
        </aside>

        <section className="flex-1 flex flex-col overflow-hidden">
          {tokenHeader}
          {chartPanel}
        </section>

        <aside className="w-80 border-l border-white/[0.07] flex flex-col overflow-hidden">
          <TradePanel
            tokenAddress={address}
            tokenSymbol={tokenData?.symbol ?? "…"}
            tokenDecimals={tokenData?.decimals ?? 6}
          />
        </aside>
      </main>

      {/* ── Mobile layout: stacked with bottom tabs ── */}
      <div className="flex md:hidden flex-1 flex-col overflow-hidden">
        {tokenHeader}

        {/* Horizontal token strip */}
        <div className="shrink-0 border-b border-white/[0.07]">
          <TokenList address={address} horizontal />
        </div>

        <div className="flex-1 overflow-hidden">
          {mobileTab === "chart" && (
            <div className="h-full flex flex-col overflow-hidden">
              {chartPanel}
            </div>
          )}
          {mobileTab === "trade" && (
            <div className="h-full overflow-y-auto">
              <TradePanel
                tokenAddress={address}
                tokenSymbol={tokenData?.symbol ?? "…"}
                tokenDecimals={tokenData?.decimals ?? 6}
              />
            </div>
          )}
        </div>

        {/* Bottom tab bar */}
        <nav className="shrink-0 flex border-t border-white/[0.07] bg-[#060510]">
          {([
            { id: "chart", label: "Chart", icon: "📈" },
            { id: "trade", label: "Trade", icon: "⚡" },
          ] as { id: MobileTab; label: string; icon: string }[]).map((tab) => (
            <button
              key={tab.id}
              onClick={() => setMobileTab(tab.id)}
              className={`flex-1 flex flex-col items-center justify-center py-3 gap-1 text-[10px] font-semibold transition-colors cursor-pointer ${
                mobileTab === tab.id ? "text-[#606AF7]" : "text-white/30"
              }`}
            >
              <span className="text-lg leading-none">{tab.icon}</span>
              {tab.label}
            </button>
          ))}
        </nav>
      </div>
    </div>
  );
}
