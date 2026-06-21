"use client";

import { useEffect, useRef, useState } from "react";
import { usePrivy } from "@privy-io/react-auth";

interface Props {
  size?: "sm" | "md";
}

function PrivyAuthButton({ size }: Required<Props>) {
  const { ready, authenticated, user, login, logout } = usePrivy();
  const [open, setOpen] = useState(false);
  const [copied, setCopied] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  // Close dropdown when clicking outside
  useEffect(() => {
    function onClickOutside(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", onClickOutside);
    return () => document.removeEventListener("mousedown", onClickOutside);
  }, []);

  if (!ready) {
    return (
      <div
        className={`bg-white/5 rounded-lg animate-pulse ${
          size === "sm" ? "h-9 w-20" : "h-10 w-24"
        }`}
      />
    );
  }

  if (authenticated) {
    const solanaWallet = user?.linkedAccounts?.find(
      (a) => a.type === "wallet" && (a as { chainType?: string }).chainType === "solana"
    ) as { address?: string } | undefined;

    const walletAddress = solanaWallet?.address;
    const email = user?.google?.email ?? user?.apple?.email;

    const display = walletAddress
      ? `${walletAddress.slice(0, 4)}…${walletAddress.slice(-4)}`
      : (email ?? "Connected").split("@")[0].slice(0, 12);

    function copyAddress() {
      if (!walletAddress) return;
      navigator.clipboard.writeText(walletAddress);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    }

    return (
      <div ref={ref} className="relative">
        <button
          onClick={() => setOpen((o) => !o)}
          className={`cursor-pointer bg-white/10 hover:bg-white/15 border border-white/10 rounded-lg font-semibold transition-colors flex items-center gap-2 ${
            size === "sm" ? "h-9 px-3 text-xs" : "h-10 px-4 text-sm"
          }`}
        >
          <span className="w-2 h-2 rounded-full bg-green-400 shrink-0" />
          {display}
          <svg className={`w-3 h-3 text-white/40 transition-transform ${open ? "rotate-180" : ""}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
          </svg>
        </button>

        {open && (
          <div className="absolute right-0 mt-2 w-56 bg-[#0e0c1e] border border-white/[0.08] rounded-xl shadow-xl z-50 overflow-hidden">
            {/* Profile info */}
            <div className="px-4 py-3 border-b border-white/[0.07]">
              {email && (
                <p className="text-xs text-white/50 truncate mb-1">{email}</p>
              )}
              {walletAddress && (
                <button
                  onClick={copyAddress}
                  className="flex items-center gap-1.5 text-xs text-[#eaedff] hover:text-white transition-colors cursor-pointer group w-full text-left"
                >
                  <span className="font-mono">{walletAddress.slice(0, 6)}…{walletAddress.slice(-6)}</span>
                  <span className={`ml-auto text-[10px] ${copied ? "text-green-400" : "text-white/30 group-hover:text-white/60"}`}>
                    {copied ? "Copied!" : "Copy"}
                  </span>
                </button>
              )}
            </div>

            {/* Actions */}
            <div className="p-1.5">
              <button
                onClick={() => { setOpen(false); logout(); }}
                className="w-full flex items-center gap-2 px-3 py-2 text-xs text-red-400 hover:bg-red-500/10 rounded-lg transition-colors cursor-pointer"
              >
                <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
                </svg>
                Sign out
              </button>
            </div>
          </div>
        )}
      </div>
    );
  }

  return (
    <button
      onClick={login}
      className={`cursor-pointer bg-[#606AF7] hover:bg-[#7c85ff] rounded-lg font-bold transition-colors ${
        size === "sm" ? "h-9 px-4 text-xs" : "h-10 px-5 text-sm"
      }`}
    >
      Sign In
    </button>
  );
}

export default function AuthButton({ size = "md" }: Props) {
  if (!process.env.NEXT_PUBLIC_PRIVY_APP_ID) {
    return (
      <button
        className={`cursor-not-allowed opacity-40 bg-[#606AF7] rounded-lg font-bold ${
          size === "sm" ? "h-9 px-4 text-xs" : "h-10 px-5 text-sm"
        }`}
      >
        Sign In
      </button>
    );
  }
  return <PrivyAuthButton size={size} />;
}
