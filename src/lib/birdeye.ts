const BASE = "https://public-api.birdeye.so";

export async function birdeyeFetch(path: string, revalidate = 30) {
  const res = await fetch(`${BASE}${path}`, {
    headers: { "X-API-KEY": process.env.BIRDEYE_API_KEY!, "x-chain": "solana" },
    next: { revalidate },
  });
  if (!res.ok) throw new Error(`BirdEye ${res.status}: ${path}`);
  return res.json();
}
