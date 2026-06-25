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

const BUY_QUICK = [0.1, 0.5, 1, 5];
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

export default function TradePanel({
  tokenAddress,
  tokenSymbol,
  tokenDecimals = 6,
}: {
  tokenAddress: string;
  tokenSymbol: string;
  tokenDecimals?: number;
}) {
  const { ready, authenticated, login, user } = usePrivy();
  const { wallets } = useWallets();
  const embeddedWallet = wallets[0] ?? null;

  const [side, setSide] = useState<Side>("buy");
  const [amount, setAmount] = useState("");
  const [slippageBps, setSlippageBps] = useState(100); // 1% default
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

  const { fundWallet } = useFundWallet();

  const _alchemy = process.env.NEXT_PUBLIC_ALCHEMY_RPC_URL;
  const rpcUrl = (_alchemy && !_alchemy.includes("YOUR_KEY"))
    ? _alchemy
    : "https://api.mainnet-beta.solana.com";

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

  // Fetch recent trades on mount and after each status change (catches 'success')
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
      // 1. Get serialised Jupiter swap transaction
      const res = await fetch("/api/swap/execute", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ quoteResponse: quote, userPublicKey: embeddedWallet.address }),
      });
      const { swapTransaction, error: jupErr } = await res.json();
      if (jupErr || !swapTransaction) throw new Error(jupErr ?? "No transaction returned");

      // 2. Decode base64 → Uint8Array
      const txBytes = Uint8Array.from(Buffer.from(swapTransaction, "base64"));

      // 3. Sign & send via Privy embedded wallet
      const result = await embeddedWallet.signAndSendTransaction({
        transaction: txBytes,
        chain: "solana:mainnet",
        options: { commitment: "confirmed" },
      });

      // 4. Encode raw signature bytes as base58 for the explorer link
      setTxSig(toBase58(result.signature));
      setStatus("success");
      setAmount("");
      setQuote(null);

      // Persist trade to Supabase (fire and forget)
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

      // 5. Refresh balances
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
      // Translate common opaque errors into plain English
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

  return (
    <div className="flex flex-col h-full">
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

      <div className="flex-1 overflow-y-auto px-4 py-4 flex flex-col gap-4">
        {/* Buy / Sell toggle */}
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
          </div>
        </div>

        {/* Quick-amount buttons */}
        {side === "buy" ? (
          <div className="grid grid-cols-4 gap-1.5">
            {BUY_QUICK.map((q) => (
              <button
                key={q}
                onClick={() => setAmount(String(q))}
                className={`py-1.5 rounded-md text-xs font-semibold border transition-colors cursor-pointer ${
                  parseFloat(amount) === q
                    ? "border-[#606AF7]/60 bg-[#606AF7]/15 text-[#606AF7]"
                    : "border-white/[0.07] bg-white/[0.03] text-white/50 hover:text-white/80 hover:bg-white/[0.06]"
                }`}
              >
                {q} SOL
              </button>
            ))}
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

        {/* Position */}
        <div className="border-t border-white/[0.07] pt-4">
          <p className="text-xs font-bold uppercase tracking-wider text-white/40 mb-3">Your Position</p>
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
        </div>

        {/* Wallet address + fund */}
        {authenticated && embeddedWallet && (
          <div className="border-t border-white/[0.07] pt-4">
            <p className="text-xs font-bold uppercase tracking-wider text-white/40 mb-3">Wallet</p>
            {solBalance != null && solBalance < 0.005 && (
              <div className="mb-2 bg-yellow-500/10 border border-yellow-500/20 rounded-lg px-3 py-2 text-xs text-yellow-400">
                Low SOL balance — deposit SOL to pay for transactions
              </div>
            )}
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

        {/* Recent Trades */}
        {recentTrades.length > 0 && (
          <div className="border-t border-white/[0.07] pt-4">
            <p className="text-xs font-bold uppercase tracking-wider text-white/40 mb-3">Recent Trades</p>
            <div className="flex flex-col gap-1.5">
              {recentTrades.map((t) => (
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
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
