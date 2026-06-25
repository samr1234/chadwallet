"use client";

import { useEffect, useState } from "react";
import { usePrivy } from "@privy-io/react-auth";
import { useWallets, useFundWallet } from "@privy-io/react-auth/solana";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { Connection, PublicKey, LAMPORTS_PER_SOL } from "@solana/web3.js";
import AuthButton from "@/components/AuthButton";

interface Trade {
  id: string;
  side: "buy" | "sell";
  token_symbol: string;
  token_address: string;
  in_amount: string;
  out_amount: string;
  tx_signature: string;
  created_at: string;
}

interface WatchlistItem {
  id: string;
  token_address: string;
  token_symbol: string | null;
  token_name: string | null;
  logo_uri: string | null;
  added_at: string;
}

function timeAgo(iso: string): string {
  const secs = Math.floor((Date.now() - new Date(iso).getTime()) / 1000);
  if (secs < 60) return `${secs}s ago`;
  if (secs < 3600) return `${Math.floor(secs / 60)}m ago`;
  if (secs < 86400) return `${Math.floor(secs / 3600)}h ago`;
  return `${Math.floor(secs / 86400)}d ago`;
}

function fmtLamports(raw: string, decimals = 9): string {
  const n = parseInt(raw) / Math.pow(10, decimals);
  if (!n || !isFinite(n)) return "0";
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(2)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(2)}K`;
  if (n >= 1) return n.toFixed(4);
  return n.toFixed(6);
}

function avatarGradient(seed: string): string {
  let hash = 0;
  for (let i = 0; i < seed.length; i++) hash = seed.charCodeAt(i) + ((hash << 5) - hash);
  const h1 = ((hash >> 16) & 0xffffff).toString(16).padStart(6, "0");
  const h2 = ((hash >> 8) & 0xffffff).toString(16).padStart(6, "0");
  return `linear-gradient(135deg, #${h1}, #${h2})`;
}

export default function ProfilePage() {
  const { ready, authenticated, user, login } = usePrivy();
  const { wallets } = useWallets();
  const embeddedWallet = wallets[0] ?? null;
  const { fundWallet } = useFundWallet();
  const router = useRouter();

  const [trades, setTrades] = useState<Trade[]>([]);
  const [watchlist, setWatchlist] = useState<WatchlistItem[]>([]);
  const [solBalance, setSolBalance] = useState<number | null>(null);
  const [copied, setCopied] = useState(false);
  const [loadingData, setLoadingData] = useState(true);

  const _alchemy = process.env.NEXT_PUBLIC_ALCHEMY_RPC_URL;
  const rpcUrl = (_alchemy && !_alchemy.includes("YOUR_KEY"))
    ? _alchemy
    : "https://api.mainnet-beta.solana.com";

  const email = user?.google?.email ?? user?.apple?.email;
  const displayName = email
    ? email.split("@")[0]
    : embeddedWallet?.address
      ? `${embeddedWallet.address.slice(0, 6)}…${embeddedWallet.address.slice(-4)}`
      : "Anonymous";

  // Fetch balance
  useEffect(() => {
    if (!embeddedWallet?.address) return;
    const connection = new Connection(rpcUrl);
    connection
      .getBalance(new PublicKey(embeddedWallet.address))
      .then((l) => setSolBalance(l / LAMPORTS_PER_SOL))
      .catch(() => {});
  }, [embeddedWallet?.address, rpcUrl]);

  // Fetch trades + watchlist
  useEffect(() => {
    if (!user?.id) return;
    setLoadingData(true);
    Promise.all([
      fetch(`/api/trades?privy_id=${user.id}&limit=50`).then((r) => r.json()),
      fetch(`/api/watchlist?privy_id=${user.id}`).then((r) => r.json()),
    ])
      .then(([tradeData, watchData]) => {
        if (Array.isArray(tradeData.trades)) setTrades(tradeData.trades);
        if (Array.isArray(watchData.watchlist)) setWatchlist(watchData.watchlist);
      })
      .catch(() => {})
      .finally(() => setLoadingData(false));
  }, [user?.id]);

  // Auth gate
  if (!ready) {
    return (
      <div className="h-screen flex items-center justify-center bg-[#060510]">
        <div className="w-8 h-8 rounded-full border-2 border-[#606AF7]/30 border-t-[#606AF7] animate-spin" />
      </div>
    );
  }

  if (!authenticated) {
    return (
      <div className="h-screen flex flex-col bg-[#060510] items-center justify-center gap-6 px-6">
        <a href="/" className="flex items-center gap-2.5 mb-2">
          <Image src="/logo.png" alt="ChadWallet" width={48} height={48} className="rounded-xl" />
          <span className="text-xl font-black tracking-tight text-[#eaedff]">Chad<span className="text-[#606AF7]">Wallet</span></span>
        </a>
        <div className="text-center">
          <h1 className="text-2xl font-bold text-[#eaedff] mb-2">Sign in to view your profile</h1>
          <p className="text-sm text-white/40">Your trades and watchlist live here.</p>
        </div>
        <button
          onClick={login}
          className="cursor-pointer bg-[#606AF7] hover:bg-[#7c85ff] transition-colors rounded-xl px-10 py-3 font-bold text-sm"
        >
          Sign In
        </button>
      </div>
    );
  }

  const buys  = trades.filter((t) => t.side === "buy");
  const sells = trades.filter((t) => t.side === "sell");

  const avatarSeed = embeddedWallet?.address ?? email ?? "chad";

  return (
    <div className="min-h-screen flex flex-col bg-[#060510]">
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

      <main className="flex-1 max-w-3xl mx-auto w-full px-4 py-8 flex flex-col gap-6">

        {/* Profile card */}
        <div className="bg-[#0e0c1e] rounded-2xl border border-white/[0.07] p-6 flex flex-col sm:flex-row items-start sm:items-center gap-5">
          {/* Avatar */}
          <div
            className="w-16 h-16 rounded-2xl shrink-0 flex items-center justify-center text-2xl font-black text-white shadow-lg"
            style={{ background: avatarGradient(avatarSeed) }}
          >
            {displayName[0]?.toUpperCase() ?? "C"}
          </div>

          <div className="flex-1 min-w-0">
            <h1 className="text-xl font-bold text-[#eaedff] truncate">{displayName}</h1>
            {email && <p className="text-xs text-white/40 mt-0.5 truncate">{email}</p>}

            {embeddedWallet && (
              <div className="mt-2 flex items-center gap-2">
                <span className="text-[11px] font-mono text-white/40 truncate max-w-[200px]">
                  {embeddedWallet.address}
                </span>
                <button
                  onClick={() => {
                    navigator.clipboard.writeText(embeddedWallet.address);
                    setCopied(true);
                    setTimeout(() => setCopied(false), 1500);
                  }}
                  className="text-[11px] text-white/40 hover:text-white/80 transition-colors cursor-pointer shrink-0"
                >
                  {copied ? "✓" : "Copy"}
                </button>
              </div>
            )}
          </div>

          {/* Balance + fund */}
          <div className="flex flex-col items-end gap-2 shrink-0">
            <div className="text-right">
              <p className="text-[11px] text-white/40 mb-0.5">SOL Balance</p>
              <p className="text-lg font-bold text-[#eaedff]">
                {solBalance != null ? `${solBalance.toFixed(4)} SOL` : "—"}
              </p>
            </div>
            {embeddedWallet && (
              <button
                onClick={() => fundWallet({ address: embeddedWallet.address })}
                className="cursor-pointer text-xs font-semibold bg-[#606AF7]/15 text-[#606AF7] hover:bg-[#606AF7]/25 transition-colors rounded-lg px-3 py-1.5"
              >
                + Fund Wallet
              </button>
            )}
          </div>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-3 gap-3">
          {[
            { label: "Total Trades", value: trades.length },
            { label: "Buys", value: buys.length, color: "text-green-400" },
            { label: "Sells", value: sells.length, color: "text-red-400" },
          ].map((s) => (
            <div key={s.label} className="bg-[#0e0c1e] rounded-xl border border-white/[0.07] px-4 py-4 text-center">
              <p className={`text-2xl font-black mb-1 ${s.color ?? "text-[#eaedff]"}`}>{s.value}</p>
              <p className="text-[11px] text-white/40 uppercase tracking-wide">{s.label}</p>
            </div>
          ))}
        </div>

        {/* Watchlist */}
        <section>
          <h2 className="text-sm font-bold text-white/50 uppercase tracking-wider mb-3">Watchlist</h2>
          {loadingData ? (
            <div className="flex gap-2 flex-wrap">
              {[1, 2, 3].map((i) => (
                <div key={i} className="h-9 w-20 rounded-lg bg-white/5 animate-pulse" />
              ))}
            </div>
          ) : watchlist.length === 0 ? (
            <div className="bg-[#0e0c1e] rounded-xl border border-white/[0.07] px-4 py-6 text-center">
              <p className="text-sm text-white/30">No tokens saved yet</p>
              <p className="text-xs text-white/20 mt-1">Star tokens on the trading page to save them here</p>
            </div>
          ) : (
            <div className="flex gap-2 flex-wrap">
              {watchlist.map((item) => (
                <button
                  key={item.id}
                  onClick={() => router.push(`/trade/${item.token_address}`)}
                  className="cursor-pointer flex items-center gap-2 bg-[#0e0c1e] hover:bg-[#1a1830] border border-white/[0.07] hover:border-white/20 rounded-lg px-3 py-2 transition-colors"
                >
                  {item.logo_uri ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={item.logo_uri} alt={item.token_symbol ?? ""} className="w-5 h-5 rounded-full" onError={(e) => { (e.target as HTMLImageElement).style.display = "none"; }} />
                  ) : (
                    <div className="w-5 h-5 rounded-full bg-[#1a1830] flex items-center justify-center text-[9px] font-bold text-white/50">
                      {(item.token_symbol ?? "?")[0]}
                    </div>
                  )}
                  <span className="text-xs font-semibold">{item.token_symbol ?? item.token_address.slice(0, 6)}</span>
                </button>
              ))}
            </div>
          )}
        </section>

        {/* Trade history */}
        <section>
          <h2 className="text-sm font-bold text-white/50 uppercase tracking-wider mb-3">Trade History</h2>
          {loadingData ? (
            <div className="flex flex-col gap-2">
              {[1, 2, 3, 4].map((i) => (
                <div key={i} className="h-14 rounded-xl bg-white/5 animate-pulse" />
              ))}
            </div>
          ) : trades.length === 0 ? (
            <div className="bg-[#0e0c1e] rounded-xl border border-white/[0.07] px-4 py-8 text-center">
              <p className="text-sm text-white/30">No trades yet</p>
              <p className="text-xs text-white/20 mt-1">Your completed trades will appear here</p>
              <button
                onClick={() => router.push("/trade/So11111111111111111111111111111111111111112")}
                className="cursor-pointer mt-4 bg-[#606AF7]/15 text-[#606AF7] hover:bg-[#606AF7]/25 transition-colors rounded-lg px-4 py-2 text-xs font-semibold"
              >
                Start Trading
              </button>
            </div>
          ) : (
            <div className="flex flex-col gap-1.5">
              {trades.map((t) => {
                const isBuy = t.side === "buy";
                const inLabel  = isBuy ? `${fmtLamports(t.in_amount, 9)} SOL` : `${fmtLamports(t.in_amount, 6)} ${t.token_symbol}`;
                const outLabel = isBuy ? `${fmtLamports(t.out_amount, 6)} ${t.token_symbol}` : `${fmtLamports(t.out_amount, 9)} SOL`;
                return (
                  <a
                    key={t.id}
                    href={`https://solscan.io/tx/${t.tx_signature}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="bg-[#0e0c1e] hover:bg-[#1a1830] border border-white/[0.07] hover:border-white/15 rounded-xl px-4 py-3 flex items-center gap-3 transition-colors group"
                  >
                    <span className={`shrink-0 text-[10px] font-black px-2 py-1 rounded-md ${
                      isBuy ? "bg-green-500/15 text-green-400" : "bg-red-500/15 text-red-400"
                    }`}>
                      {t.side.toUpperCase()}
                    </span>
                    <span className="text-sm font-bold text-[#eaedff] w-16 shrink-0">{t.token_symbol}</span>
                    <div className="flex-1 min-w-0 flex items-center gap-1.5 text-xs text-white/50">
                      <span className="truncate">{inLabel}</span>
                      <span className="text-white/20 shrink-0">→</span>
                      <span className="truncate">{outLabel}</span>
                    </div>
                    <span className="text-[11px] text-white/30 shrink-0">{timeAgo(t.created_at)}</span>
                    <svg className="w-3.5 h-3.5 text-white/20 group-hover:text-white/50 transition-colors shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                    </svg>
                  </a>
                );
              })}
            </div>
          )}
        </section>

      </main>
    </div>
  );
}
