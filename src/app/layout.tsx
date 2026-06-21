import type { Metadata } from "next";
import { Roboto, Roboto_Mono } from "next/font/google";
import Providers from "@/components/providers/Providers";
import "./globals.css";

const roboto = Roboto({
  variable: "--font-roboto",
  subsets: ["latin"],
  weight: ["400", "500", "700", "900"],
});

const robotoMono = Roboto_Mono({
  variable: "--font-roboto-mono",
  subsets: ["latin"],
  weight: ["400", "500", "700"],
});

export const metadata: Metadata = {
  title: "ChadWallet — Trade Solana Like a Chad",
  description: "The fastest way to trade Solana tokens. Sign in with Apple or Google.",
  icons: { icon: "/favicon.ico" },
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" className={`${roboto.variable} ${robotoMono.variable} h-full`}>
      <body className="min-h-full flex flex-col bg-[#060510] text-[#eaedff]">
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
