"use client";

import { useState, useEffect } from "react";
import { usePrivy } from "@privy-io/react-auth";
import { useWallets, useFundWallet } from "@privy-io/react-auth/solana";
import { Connection, PublicKey, LAMPORTS_PER_SOL } from "@solana/web3.js";

const SOL_MINT = "So11111111111111111111111111111111111111112";
const BASE58_CHARS = "123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz";

function toBase58(bytes: Uint8Array): string {
  const digits: number[] = [0];
  for (let i = 0; i < bytes.length; i++) {
    let carry = bytes[i];
    for (let j = 0; j < digits.length; j++) {
      carry += digits[j] << 8;
      digits[j] = carry % 58;
      carry = (carry / 58) | 0;
    }
    while (carry > 0) { digits.push(carry % 58); carry = (carry / 58) | 0; }
  }
  let str = "";
  for (let i = 0; i < bytes.length && bytes[i] === 0; i++) str += "1";
  for (let i = digits.length - 1; i >= 0; i--) str += BASE58_CHARS[digits[i]];
  return str;
}

type Side = "buy" | "sell";
type SwapStatus = "idle" | "confirming" | "success" | "error";
type AboutTab = "5M" | "1H" | "4H" | "1D";
type PosTab = "open" | "closed";

const BUY_QUICK_USD = [10, 100, 500, 1000];
const SELL_PCTS = [25, 50, 75, 100];

interface JupQuote {
  inputMint: string;
  inAmount: string;
  outputMint: string;
  outAmount: string;
  priceImpactPct: string;
  [key: string]: unknown;
}

interface RecentTrade {
  id: string;
  side: string;
  token_symbol: string;
  in_amount: string;
  out_amount: string;
  tx_signature: string;
  created_at: string;
}

function timeAgo(iso: string): string {
  const secs = Math.floor((Date.now() - new Date(iso).getTime()) / 1000);
  if (secs < 60) return `${secs}s ago`;
  if (secs < 3600) return `${Math.floor(secs / 60)}m ago`;
  if (secs < 86400) return `${Math.floor(secs / 3600)}h ago`;
  return `${Math.floor(secs / 86400)}d ago`;
}

function fmt(n: number): string {
  if (!n || !isFinite(n)) return "0";
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(2)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(2)}K`;
  return n.toFixed(4);
}

function fmtUsd(n: number): string {
  if (n >= 1_000_000) return `$${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `$${(n / 1_000).toFixed(1)}K`;
  return `$${n.toFixed(0)}`;
}

interface TokenStats {
  symbol?: string;
  priceChange5mPercent?: number;
  priceChange1hPercent?: number;
  priceChange4hPercent?: number;
  priceChange24hPercent?: number;
  buy24h?: number;
  sell24h?: number;
  vBuy24hUSD?: number;
  vSell24hUSD?: number;
  uniqueWallet24h?: number;
  extensions?: { description?: string; website?: string; twitter?: string };
}

interface RugRisk {
  name: string;
  description: string;
  level: "danger" | "warn" | "info";
}

interface RugResult {
  score?: number;
  risks?: RugRisk[];
}

function DualBar({ leftPct }: { leftPct: number }) {
  return (
    <div className="flex h-1.5 rounded-full overflow-hidden">
      <div className="h-full bg-green-400/70 transition-all" style={{ width: `${Math.max(0, Math.min(100, leftPct))}%` }} />
      <div className="h-full bg-orange-400/60 transition-all flex-1" />
    </div>
  );
}

export default function TradePanel({
  tokenAddress,
  tokenSymbol,
  tokenDecimals = 6,
  tokenStats,
}: {
  tokenAddress: string;
  tokenSymbol: string;
  tokenDecimals?: number;
  tokenStats?: TokenStats;
}) {
  const { ready, authenticated, login, user } = usePrivy();
  const { wallets } = useWallets();
  const embeddedWallet = wallets[0] ?? null;

  const [side, setSide] = useState<Side>("buy");
  const [amount, setAmount] = useState("");
  const [slippageBps, setSlippageBps] = useState(100);
  const [showSlippage, setShowSlippage] = useState(false);
  const [recentTrades, setRecentTrades] = useState<RecentTrade[]>([]);
  const [solBalance, setSolBalance] = useState<number | null>(null);
  const [tokenBalance, setTokenBalance] = useState<number | null>(null);
  const [quote, setQuote] = useState<JupQuote | null>(null);
  const [quoteLoading, setQuoteLoading] = useState(false);
  const [status, setStatus] = useState<SwapStatus>("idle");
  const [txSig, setTxSig] = useState("");
  const [errMsg, setErrMsg] = useState("");
  const [copied, setCopied] = useState(false);
  const [aboutTab, setAboutTab] = useState<AboutTab>("1H");
  const [solPrice, setSolPrice] = useState(150);
  const [posTab, setPosTab] = useState<PosTab>("open");
  const [rugResult, setRugResult] = useState<RugResult | null>(null);

  const { fundWallet } = useFundWallet();

  const _alchemy = process.env.NEXT_PUBLIC_ALCHEMY_RPC_URL;
  const rpcUrl = (_alchemy && !_alchemy.includes("YOUR_KEY"))
    ? _alchemy
    : "https://api.mainnet-beta.solana.com";

  // Fetch SOL price once on mount
  useEffect(() => {
    fetch(`/api/tokens/${SOL_MINT}/overview`)
      .then((r) => r.json())
      .then((d) => { if (d.price) setSolPrice(d.price); })
      .catch(() => {});
  }, []);

  // Fetch RugCheck whenever token changes
  useEffect(() => {
    setRugResult(null);
    fetch(`/api/tokens/${tokenAddress}/rugcheck`)
      .then((r) => r.json())
      .then((d) => { if (!d.error) setRugResult(d); })
      .catch(() => {});
  }, [tokenAddress]);

  // Fetch SOL + token balances whenever the wallet or token changes
  useEffect(() => {
    if (!authenticated || !embeddedWallet?.address) return;
    const connection = new Connection(rpcUrl);
    const pubkey = new PublicKey(embeddedWallet.address);

    connection.getBalance(pubkey)
      .then((l) => setSolBalance(l / LAMPORTS_PER_SOL))
      .catch(() => {});

    if (tokenAddress !== SOL_MINT) {
      connection
        .getParsedTokenAccountsByOwner(pubkey, { mint: new PublicKey(tokenAddress) })
        .then((res) => {
          const ui = res.value[0]?.account.data.parsed.info.tokenAmount.uiAmount ?? 0;
          setTokenBalance(ui);
        })
        .catch(() => {});
    } else {
      setTokenBalance(null);
    }
  }, [authenticated, embeddedWallet?.address, tokenAddress, rpcUrl]);

  // Reset state whenever the token changes
  useEffect(() => {
    setAmount("");
    setQuote(null);
    setStatus("idle");
    setErrMsg("");
    setTokenBalance(null);
  }, [tokenAddress]);

  // Fetch recent trades on mount and after each status change
  useEffect(() => {
    if (!user?.id) return;
    fetch(`/api/trades?privy_id=${user.id}&limit=5`)
      .then((r) => r.json())
      .then((d) => { if (Array.isArray(d.trades)) setRecentTrades(d.trades); })
      .catch(() => {});
  }, [user?.id, status]);

  // Debounced live quote
  useEffect(() => {
    const num = parseFloat(amount);
    if (!num || num <= 0) { setQuote(null); return; }

    setQuoteLoading(true);
    const inputDecimals = side === "buy" ? 9 : tokenDecimals;
    const atomicAmount = Math.round(num * Math.pow(10, inputDecimals));
    const inputMint = side === "buy" ? SOL_MINT : tokenAddress;
    const outputMint = side === "buy" ? tokenAddress : SOL_MINT;

    const timer = setTimeout(async () => {
      try {
        const res = await fetch(
          `/api/swap/quote?inputMint=${inputMint}&outputMint=${outputMint}&amount=${atomicAmount}&slippageBps=${slippageBps}`
        );
        const data = await res.json();
        if (data.error) throw new Error(data.error);
        setQuote(data as JupQuote);
      } catch {
        setQuote(null);
      } finally {
        setQuoteLoading(false);
      }
    }, 500);

    return () => { clearTimeout(timer); setQuoteLoading(false); };
  }, [amount, side, tokenAddress, tokenDecimals, slippageBps]);

  const estimatedOut = quote
    ? side === "buy"
      ? parseInt(quote.outAmount) / Math.pow(10, tokenDecimals)
      : parseInt(quote.outAmount) / LAMPORTS_PER_SOL
    : null;

  const priceImpact = quote ? parseFloat(quote.priceImpactPct) : 0;

  async function handleSwap() {
    if (!embeddedWallet || !quote) return;
    setStatus("confirming");
    setErrMsg("");

    try {
      const res = await fetch("/api/swap/execute", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ quoteResponse: quote, userPublicKey: embeddedWallet.address }),
      });
      const { swapTransaction, error: jupErr } = await res.json();
      if (jupErr || !swapTransaction) throw new Error(jupErr ?? "No transaction returned");

      const txBytes = Uint8Array.from(Buffer.from(swapTransaction, "base64"));

      const result = await embeddedWallet.signAndSendTransaction({
        transaction: txBytes,
        chain: "solana:mainnet",
        options: { commitment: "confirmed" },
      });

      setTxSig(toBase58(result.signature));
      setStatus("success");
      setAmount("");
      setQuote(null);

      if (user?.id) {
        fetch("/api/trades", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            privy_id: user.id,
            wallet_address: embeddedWallet?.address,
            token_address: tokenAddress,
            token_symbol: tokenSymbol,
            side,
            in_amount: quote.inAmount,
            out_amount: quote.outAmount,
            tx_signature: toBase58(result.signature),
          }),
        }).catch(() => {});
      }

      const connection = new Connection(rpcUrl);
      const pubkey = new PublicKey(embeddedWallet.address);
      connection.getBalance(pubkey).then((l) => setSolBalance(l / LAMPORTS_PER_SOL)).catch(() => {});
      if (tokenAddress !== SOL_MINT) {
        connection
          .getParsedTokenAccountsByOwner(pubkey, { mint: new PublicKey(tokenAddress) })
          .then((r) => setTokenBalance(r.value[0]?.account.data.parsed.info.tokenAmount.uiAmount ?? 0))
          .catch(() => {});
      }
    } catch (err) {
      let msg = err instanceof Error ? err.message : String(err);
      if (msg.includes("0x1771") || msg.toLowerCase().includes("slippage")) {
        msg = "Slippage tolerance exceeded — try increasing slippage (gear icon)";
      } else if (msg.toLowerCase().includes("insufficient lamports") || msg.toLowerCase().includes("insufficient funds")) {
        msg = "Not enough SOL — deposit SOL to your wallet first";
      } else if (msg.toLowerCase().includes("blockhash not found") || msg.toLowerCase().includes("expired")) {
        msg = "Transaction expired — please try again";
      } else if (msg.toLowerCase().includes("user rejected") || msg.toLowerCase().includes("cancelled")) {
        msg = "Transaction cancelled";
      }
      setErrMsg(msg);
      setStatus("error");
    }
  }

  function switchSide(s: Side) {
    setSide(s);
    setAmount("");
    setQuote(null);
    setStatus("idle");
    setErrMsg("");
  }

  const canTrade = authenticated && !!embeddedWallet && parseFloat(amount) > 0 && !!quote && !quoteLoading;
  const isConfirming = status === "confirming";

  // About section derived values
  const aboutPriceVal =
    aboutTab === "5M" ? tokenStats?.priceChange5mPercent
    : aboutTab === "1H" ? tokenStats?.priceChange1hPercent
    : aboutTab === "4H" ? tokenStats?.priceChange4hPercent
    : tokenStats?.priceChange24hPercent;

  const buys = tokenStats?.buy24h ?? 0;
  const sells = tokenStats?.sell24h ?? 0;
  const totalTrades = buys + sells || 1;
  const buyPct = (buys / totalTrades) * 100;
  const buyVol = tokenStats?.vBuy24hUSD ?? 0;
  const sellVol = tokenStats?.vSell24hUSD ?? 0;
  const totalVol = buyVol + sellVol || 1;
  const buyVolPct = (buyVol / totalVol) * 100;
  const uniq = tokenStats?.uniqueWallet24h ?? 0;
  const estBuyers = uniq > 0 ? Math.round((buys / totalTrades) * uniq) : 0;
  const estSellers = uniq - estBuyers;

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="shrink-0 px-4 py-3 border-b border-white/[0.07] flex items-center justify-between">
        <p className="text-xs font-bold uppercase tracking-wider text-white/50">Trade</p>
        <div className="relative">
          <button
            onClick={() => setShowSlippage((v) => !v)}
            className="flex items-center gap-1.5 text-[11px] text-white/40 hover:text-white/70 transition-colors cursor-pointer"
            title="Slippage tolerance"
          >
            <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
              <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
            </svg>
            {(slippageBps / 100).toFixed(1)}%
          </button>
          {showSlippage && (
            <div className="absolute right-0 top-6 z-20 bg-[#0e0c1e] border border-white/[0.07] rounded-xl p-3 shadow-xl w-44">
              <p className="text-[10px] text-white/40 uppercase tracking-wider mb-2">Slippage tolerance</p>
              <div className="grid grid-cols-4 gap-1">
                {[50, 100, 200, 500].map((bps) => (
                  <button
                    key={bps}
                    onClick={() => { setSlippageBps(bps); setShowSlippage(false); setQuote(null); }}
                    className={`py-1.5 rounded-md text-[11px] font-semibold transition-colors cursor-pointer ${
                      slippageBps === bps
                        ? "bg-[#606AF7]/20 text-[#606AF7]"
                        : "bg-white/5 text-white/50 hover:bg-white/10"
                    }`}
                  >
                    {(bps / 100).toFixed(1)}%
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Auth gate — unauthenticated users see a clean sign-in prompt */}
      {!authenticated && (
        <div className="flex-1 flex flex-col items-center justify-center gap-4 px-6 text-center">
          <div className="w-12 h-12 rounded-2xl bg-[#606AF7]/15 flex items-center justify-center">
            <svg className="w-6 h-6 text-[#606AF7]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M16.5 10.5V6.75a4.5 4.5 0 10-9 0v3.75m-.75 11.25h10.5a2.25 2.25 0 002.25-2.25v-6.75a2.25 2.25 0 00-2.25-2.25H6.75a2.25 2.25 0 00-2.25 2.25v6.75a2.25 2.25 0 002.25 2.25z" />
            </svg>
          </div>
          <div>
            <p className="text-sm font-bold text-[#eaedff] mb-1">Sign in to trade</p>
            <p className="text-xs text-white/35">Connect your wallet to buy and sell {tokenSymbol}</p>
          </div>
          <button
            onClick={login}
            className="w-full py-3 rounded-xl bg-[#606AF7] hover:bg-[#7c85ff] text-sm font-bold transition-colors cursor-pointer"
          >
            Sign In
          </button>
        </div>
      )}

      {/* Buy / Sell toggle — always visible at top */}
      {authenticated && <>
      <div className="shrink-0 px-4 pt-4 pb-0">
        <div className="flex rounded-lg overflow-hidden border border-white/[0.07] p-0.5 bg-[#0e0c1e]">
          {(["buy", "sell"] as Side[]).map((s) => (
            <button
              key={s}
              onClick={() => switchSide(s)}
              className={`flex-1 py-2 text-sm font-bold capitalize rounded-md transition-all cursor-pointer ${
                side === s
                  ? s === "buy"
                    ? "bg-green-500/20 text-green-400"
                    : "bg-red-500/20 text-red-400"
                  : "text-white/30 hover:text-white/60"
              }`}
            >
              {s}
            </button>
          ))}
        </div>
      </div>

      <div className="flex-1 overflow-y-auto px-4 py-4 flex flex-col gap-4">

        {/* Amount input */}
        <div>
          <label className="text-xs text-white/40 mb-1.5 block">
            {side === "buy" ? "Amount (SOL)" : `Amount (${tokenSymbol})`}
          </label>
          <div className="flex items-center bg-[#0e0c1e] border border-white/[0.07] rounded-lg px-3 focus-within:border-[#606AF7]/50 transition-colors">
            {side === "buy" && <span className="text-white/40 text-sm mr-1.5">◎</span>}
            <input
              type="number"
              min="0"
              step="any"
              value={amount}
              onChange={(e) => { setAmount(e.target.value); setStatus("idle"); setErrMsg(""); }}
              placeholder="0.00"
              className="flex-1 bg-transparent py-2.5 text-sm text-[#eaedff] placeholder:text-white/25 focus:outline-none [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
            />
            {side === "buy" && amount && solPrice > 0 && (
              <span className="text-white/25 text-xs shrink-0">
                ≈${(parseFloat(amount) * solPrice).toFixed(0)}
              </span>
            )}
          </div>
        </div>

        {/* Quick-amount buttons */}
        {side === "buy" ? (
          <div className="grid grid-cols-4 gap-1.5">
            {BUY_QUICK_USD.map((q) => {
              const solAmt = q / solPrice;
              const isSelected = amount !== "" && Math.abs(parseFloat(amount) - solAmt) < 0.000001;
              return (
                <button
                  key={q}
                  onClick={() => setAmount(solAmt.toFixed(5))}
                  className={`py-1.5 rounded-md text-xs font-semibold border transition-colors cursor-pointer ${
                    isSelected
                      ? "border-[#606AF7]/60 bg-[#606AF7]/15 text-[#606AF7]"
                      : "border-white/[0.07] bg-white/[0.03] text-white/50 hover:text-white/80 hover:bg-white/[0.06]"
                  }`}
                >
                  ${q}
                </button>
              );
            })}
          </div>
        ) : (
          <div className="grid grid-cols-4 gap-1.5">
            {SELL_PCTS.map((pct) => (
              <button
                key={pct}
                onClick={() => {
                  if (tokenBalance != null && tokenBalance > 0) {
                    const decimals = Math.min(tokenDecimals, 6);
                    setAmount(((tokenBalance * pct) / 100).toFixed(decimals));
                  }
                }}
                className="py-1.5 rounded-md text-xs font-semibold border border-white/[0.07] bg-white/[0.03] text-white/50 hover:text-white/80 hover:bg-white/[0.06] transition-colors cursor-pointer"
              >
                {pct === 100 ? "MAX" : `${pct}%`}
              </button>
            ))}
          </div>
        )}

        {/* Quote summary */}
        <div className="bg-[#0e0c1e] rounded-lg px-3 py-3 space-y-2 border border-white/[0.07]">
          <div className="flex justify-between text-xs">
            <span className="text-white/40">Est. {side === "buy" ? tokenSymbol : "SOL"}</span>
            <span className="font-semibold">
              {quoteLoading ? (
                <span className="text-white/30 animate-pulse">…</span>
              ) : estimatedOut != null ? (
                side === "buy" ? fmt(estimatedOut) : `${estimatedOut.toFixed(5)} SOL`
              ) : "—"}
            </span>
          </div>
          <div className="flex justify-between text-xs">
            <span className="text-white/40">Price impact</span>
            <span className={priceImpact > 1 ? "text-red-400 font-semibold" : "text-white/60"}>
              {quote ? `${priceImpact.toFixed(2)}%` : "—"}
            </span>
          </div>
          <div className="flex justify-between text-xs">
            <span className="text-white/40">{side === "buy" ? "SOL balance" : `${tokenSymbol} balance`}</span>
            <span className="text-white/60">
              {side === "buy"
                ? solBalance != null ? `${solBalance.toFixed(4)} SOL` : "—"
                : tokenBalance != null ? `${fmt(tokenBalance)} ${tokenSymbol}` : "—"}
            </span>
          </div>
        </div>

        {/* Success banner */}
        {status === "success" && txSig && (
          <a
            href={`https://solscan.io/tx/${txSig}`}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-2 bg-green-500/10 border border-green-500/20 rounded-lg px-3 py-2.5 text-xs text-green-400 hover:bg-green-500/15 transition-colors"
          >
            <span className="w-1.5 h-1.5 rounded-full bg-green-400 shrink-0 animate-pulse" />
            Swap confirmed! View on Solscan ↗
          </a>
        )}

        {/* Error banner */}
        {status === "error" && errMsg && (
          <div className="bg-red-500/10 border border-red-500/20 rounded-lg px-3 py-2.5 text-xs text-red-400">
            {errMsg}
          </div>
        )}

        {/* Insufficient balance warning */}
        {authenticated && side === "buy" && solBalance != null && solBalance < 0.005 && (
          <div className="flex items-center gap-2 bg-red-500/10 border border-red-500/20 rounded-lg px-3 py-2 text-xs text-red-400">
            <svg className="w-3.5 h-3.5 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z" />
            </svg>
            Insufficient SOL balance
          </div>
        )}

        {/* CTA */}
        {!ready ? (
          <div className="w-full h-11 rounded-xl bg-white/10 animate-pulse" />
        ) : !authenticated ? (
          <button
            onClick={login}
            className="w-full py-3 rounded-xl bg-[#606AF7] hover:bg-[#7c85ff] text-sm font-bold transition-colors cursor-pointer"
          >
            Sign in to trade
          </button>
        ) : (
          <button
            onClick={
              status === "success"
                ? () => { setStatus("idle"); setTxSig(""); }
                : handleSwap
            }
            disabled={status !== "success" && (!canTrade || isConfirming)}
            className={`w-full py-3 rounded-xl text-sm font-bold transition-colors ${
              status === "success"
                ? "bg-green-500/20 text-green-400 cursor-pointer hover:bg-green-500/30"
                : canTrade && !isConfirming
                  ? side === "buy"
                    ? "bg-[#606AF7] hover:bg-[#7c85ff] cursor-pointer"
                    : "bg-red-500 hover:bg-red-400 cursor-pointer"
                  : "bg-white/10 text-white/30 cursor-not-allowed"
            }`}
          >
            {isConfirming
              ? "Confirming…"
              : status === "success"
                ? "Trade again"
                : side === "buy"
                  ? `Buy ${tokenSymbol}`
                  : `Sell ${tokenSymbol}`}
          </button>
        )}

        <div className="border-t border-white/[0.07]" />

        {/* ── About section ── */}
        {tokenStats && (
          <div className="space-y-3">
            <p className="text-sm font-bold text-[#eaedff]">
              About {tokenStats.symbol ?? tokenSymbol}
            </p>

            {tokenStats.extensions?.description && (
              <p className="text-[11px] text-white/30 leading-relaxed line-clamp-3">
                {tokenStats.extensions.description}
              </p>
            )}


            {/* RugCheck badge */}
            {rugResult && (
              <div className={`flex items-start gap-2 rounded-lg px-3 py-2 border text-[11px] ${
                rugResult.risks?.some(r => r.level === "danger")
                  ? "bg-red-500/10 border-red-500/20"
                  : rugResult.risks?.some(r => r.level === "warn")
                    ? "bg-yellow-500/10 border-yellow-500/20"
                    : "bg-green-500/10 border-green-500/20"
              }`}>
                <svg className={`w-3.5 h-3.5 shrink-0 mt-0.5 ${
                  rugResult.risks?.some(r => r.level === "danger") ? "text-red-400"
                  : rugResult.risks?.some(r => r.level === "warn") ? "text-yellow-400"
                  : "text-green-400"
                }`} fill="currentColor" viewBox="0 0 24 24">
                  <path d="M12 2L4 7v5c0 5.25 3.4 10.15 8 11.35C16.6 22.15 20 17.25 20 12V7l-8-5z" />
                </svg>
                <div className="flex-1 min-w-0">
                  {rugResult.risks && rugResult.risks.length > 0 ? (
                    <div className="space-y-0.5">
                      {rugResult.risks.slice(0, 3).map((r, i) => (
                        <p key={i} className={`${
                          r.level === "danger" ? "text-red-400" : r.level === "warn" ? "text-yellow-400" : "text-white/40"
                        }`}>
                          {r.name}
                        </p>
                      ))}
                      {rugResult.risks.length > 3 && (
                        <p className="text-white/25">+{rugResult.risks.length - 3} more</p>
                      )}
                    </div>
                  ) : (
                    <p className="text-green-400">No risks detected</p>
                  )}
                </div>
              </div>
            )}

            {/* Timeframe tabs */}
            <div className="flex gap-0.5 bg-[#0e0c1e] p-0.5 rounded-lg border border-white/[0.07]">
              {(["5M", "1H", "4H", "1D"] as AboutTab[]).map((tab) => {
                const val =
                  tab === "5M" ? tokenStats.priceChange5mPercent
                  : tab === "1H" ? tokenStats.priceChange1hPercent
                  : tab === "4H" ? tokenStats.priceChange4hPercent
                  : tokenStats.priceChange24hPercent;
                const isActive = aboutTab === tab;
                return (
                  <button
                    key={tab}
                    onClick={() => setAboutTab(tab)}
                    className={`flex-1 py-1.5 rounded-md text-[11px] font-semibold transition-colors cursor-pointer flex flex-col items-center gap-0.5 ${
                      isActive ? "bg-[#1a1830] text-white" : "text-white/30 hover:text-white/60"
                    }`}
                  >
                    <span>{tab}</span>
                    {val != null && (
                      <span className={`text-[9px] font-bold leading-none ${val >= 0 ? "text-green-400" : "text-red-400"}`}>
                        {val >= 0 ? "+" : ""}{val.toFixed(1)}%
                      </span>
                    )}
                  </button>
                );
              })}
            </div>

            {/* Active tab price highlight */}
            {aboutPriceVal != null && (
              <div className={`text-center py-1.5 rounded-lg text-sm font-bold ${
                aboutPriceVal >= 0
                  ? "bg-green-400/10 text-green-400"
                  : "bg-red-400/10 text-red-400"
              }`}>
                {aboutPriceVal >= 0 ? "+" : ""}{aboutPriceVal.toFixed(2)}%
                <span className="text-[10px] font-normal ml-1.5 opacity-60">({aboutTab})</span>
              </div>
            )}

            {/* Dual-bar stats (24h data) */}
            {(buys > 0 || sells > 0) && (
              <div className="space-y-2.5">
                <div>
                  <div className="flex justify-between text-[11px] font-semibold mb-1">
                    <span className="text-green-400">{buys.toLocaleString()} buys</span>
                    <span className="text-orange-400">{sells.toLocaleString()} sells</span>
                  </div>
                  <DualBar leftPct={buyPct} />
                </div>

                {(buyVol > 0 || sellVol > 0) && (
                  <div>
                    <div className="flex justify-between text-[11px] font-semibold mb-1">
                      <span className="text-green-400">{fmtUsd(buyVol)} vol.</span>
                      <span className="text-orange-400">{fmtUsd(sellVol)} vol.</span>
                    </div>
                    <DualBar leftPct={buyVolPct} />
                  </div>
                )}

                {uniq > 0 && (
                  <div>
                    <div className="flex justify-between text-[11px] font-semibold mb-1">
                      <span className="text-green-400">{estBuyers.toLocaleString()} buyers</span>
                      <span className="text-orange-400">{estSellers.toLocaleString()} sellers</span>
                    </div>
                    <DualBar leftPct={buyPct} />
                  </div>
                )}

                <div className="flex justify-center">
                  <button className="text-[11px] text-white/35 hover:text-white/60 px-3 py-1 rounded-full border border-white/[0.07] hover:border-white/20 transition-colors cursor-pointer">
                    View more
                  </button>
                </div>
              </div>
            )}
          </div>
        )}

        <div className="border-t border-white/[0.07]" />

        {/* ── Your positions ── */}
        <div className="border-t border-white/[0.07] pt-4">
          <div className="flex items-center justify-between mb-3">
            <p className="text-xs font-bold uppercase tracking-wider text-white/40">Your positions</p>
            <div className="flex bg-[#0e0c1e] rounded-md p-0.5 border border-white/[0.07]">
              <button
                onClick={() => setPosTab("open")}
                className={`px-2.5 py-1 rounded text-[10px] font-semibold transition-colors cursor-pointer flex items-center gap-1 ${
                  posTab === "open" ? "bg-[#1a1830] text-white" : "text-white/30 hover:text-white/60"
                }`}
              >
                Open
                {posTab === "open" && <span className="w-1.5 h-1.5 rounded-full bg-green-400 shrink-0" />}
              </button>
              <button
                onClick={() => setPosTab("closed")}
                className={`px-2.5 py-1 rounded text-[10px] font-semibold transition-colors cursor-pointer ${
                  posTab === "closed" ? "bg-[#1a1830] text-white" : "text-white/30 hover:text-white/60"
                }`}
              >
                Closed
              </button>
            </div>
          </div>

          {posTab === "open" ? (
            <div className="bg-[#0e0c1e] rounded-lg px-3 py-3 border border-white/[0.07]">
              <div className="flex justify-between text-xs mb-1.5">
                <span className="text-white/40">{tokenSymbol} holdings</span>
                <span className="font-semibold">
                  {tokenBalance != null ? `${fmt(tokenBalance)} ${tokenSymbol}` : "—"}
                </span>
              </div>
              <div className="flex justify-between text-xs">
                <span className="text-white/40">SOL balance</span>
                <span className={`${solBalance != null && solBalance < 0.005 ? "text-yellow-400" : "text-white/60"}`}>
                  {solBalance != null ? `${solBalance.toFixed(4)} SOL` : "—"}
                </span>
              </div>
            </div>
          ) : (
            <div className="flex flex-col gap-1.5">
              {recentTrades.length > 0 ? recentTrades.map((t) => (
                <a
                  key={t.id}
                  href={`https://solscan.io/tx/${t.tx_signature}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="bg-[#0e0c1e] rounded-lg px-3 py-2 border border-white/[0.07] flex items-center justify-between gap-2 hover:border-white/20 transition-colors"
                >
                  <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded ${
                    t.side === "buy" ? "bg-green-500/20 text-green-400" : "bg-red-500/20 text-red-400"
                  }`}>
                    {t.side.toUpperCase()}
                  </span>
                  <span className="text-xs text-white/60 flex-1 truncate">{t.token_symbol}</span>
                  <span className="text-[10px] text-white/30">{timeAgo(t.created_at)}</span>
                </a>
              )) : (
                <p className="text-xs text-white/30 text-center py-4">No closed positions</p>
              )}
            </div>
          )}
        </div>

        {/* Wallet */}
        {authenticated && embeddedWallet && (
          <div className="border-t border-white/[0.07] pt-4">
            <p className="text-xs font-bold uppercase tracking-wider text-white/40 mb-3">Wallet</p>
            <div className="bg-[#0e0c1e] rounded-lg border border-white/[0.07] overflow-hidden">
              <div className="flex items-center gap-2 px-3 py-2">
                <span className="text-[11px] text-white/40 font-mono truncate flex-1">
                  {embeddedWallet.address}
                </span>
                <button
                  onClick={() => {
                    navigator.clipboard.writeText(embeddedWallet.address);
                    setCopied(true);
                    setTimeout(() => setCopied(false), 1500);
                  }}
                  className="shrink-0 text-[11px] text-white/40 hover:text-white/80 transition-colors cursor-pointer"
                  title="Copy address"
                >
                  {copied ? "✓" : "Copy"}
                </button>
              </div>
              <div className="border-t border-white/[0.07]">
                <button
                  onClick={() => fundWallet({ address: embeddedWallet.address })}
                  className="w-full py-2 text-xs font-semibold text-[#606AF7] hover:bg-[#606AF7]/10 transition-colors cursor-pointer"
                >
                  + Fund with card / crypto
                </button>
              </div>
            </div>
          </div>
        )}

      </div>
      </>}
    </div>
  );
}
