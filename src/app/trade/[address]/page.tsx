import TradingLayout from "@/components/trading/TradingLayout";

export default async function TradePage({ params }: { params: Promise<{ address: string }> }) {
  const { address } = await params;
  return <TradingLayout address={address} />;
}
