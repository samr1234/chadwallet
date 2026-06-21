import { NextResponse } from "next/server";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);

  const inputMint = searchParams.get("inputMint");
  const outputMint = searchParams.get("outputMint");
  const amount = searchParams.get("amount");

  if (!inputMint || !outputMint || !amount) {
    return NextResponse.json({ error: "Missing inputMint, outputMint, or amount" }, { status: 400 });
  }

  if (!searchParams.has("slippageBps")) {
    searchParams.set("slippageBps", "50");
  }

  try {
    const res = await fetch(
      `https://quote-api.jup.ag/v6/quote?${searchParams.toString()}`,
      { headers: { Accept: "application/json" } }
    );
    const data = await res.json();
    if (!res.ok) {
      return NextResponse.json({ error: data.error ?? `Jupiter ${res.status}` }, { status: res.status });
    }
    return NextResponse.json(data);
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 502 });
  }
}
