"use client";

import { useRouter } from "next/navigation";
import { usePrivy } from "@privy-io/react-auth";

const TRADE_URL = "/trade/So11111111111111111111111111111111111111112";

export default function StartTradingButton({ className, children }: { className: string; children: React.ReactNode }) {
  const { ready, authenticated, login } = usePrivy();
  const router = useRouter();

  function handleClick() {
    if (!ready) return;
    if (authenticated) {
      router.push(TRADE_URL);
    } else {
      login();
    }
  }

  return (
    <button onClick={handleClick} className={`cursor-pointer ${className}`}>
      {children}
    </button>
  );
}
