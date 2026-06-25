"use client";

import { PrivyProvider } from "@privy-io/react-auth";
import { createSolanaRpc, createSolanaRpcSubscriptions } from "@solana/kit";

export default function Providers({ children }: { children: React.ReactNode }) {
  const appId = process.env.NEXT_PUBLIC_PRIVY_APP_ID;

  if (!appId) {
    return <>{children}</>;
  }

  const alchemyHttp = process.env.NEXT_PUBLIC_ALCHEMY_RPC_URL;
  const alchemyWss  = alchemyHttp?.replace("https://", "wss://");
  const solanaRpcs  = alchemyHttp && alchemyWss
    ? {
        "solana:mainnet": {
          rpc: createSolanaRpc(alchemyHttp),
          rpcSubscriptions: createSolanaRpcSubscriptions(alchemyWss),
          blockExplorerUrl: "https://solscan.io",
        },
      } as const
    : undefined;

  return (
    <PrivyProvider
      appId={appId}
      config={{
        loginMethods: ["google", "apple"],
        appearance: {
          theme: "dark",
          accentColor: "#606AF7",
        },
        embeddedWallets: {
          solana: {
            createOnLogin: "users-without-wallets",
            ...(solanaRpcs ? { rpcs: solanaRpcs } : {}),
          },
        },
      }}
    >
      {children}
    </PrivyProvider>
  );
}
