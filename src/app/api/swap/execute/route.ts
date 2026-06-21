import { NextResponse } from "next/server";

export async function POST(request: Request) {
  let body: { quoteResponse?: unknown; userPublicKey?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const { quoteResponse, userPublicKey } = body;
  if (!quoteResponse || !userPublicKey) {
    return NextResponse.json({ error: "Missing quoteResponse or userPublicKey" }, { status: 400 });
  }

  try {
    const res = await fetch("https://quote-api.jup.ag/v6/swap", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        quoteResponse,
        userPublicKey,
        wrapAndUnwrapSol: true,
        dynamicComputeUnitLimit: true,
        prioritizationFeeLamports: "auto",
      }),
    });
    const data = await res.json();
    if (!res.ok) {
      return NextResponse.json({ error: data.error ?? `Jupiter ${res.status}` }, { status: res.status });
    }
    return NextResponse.json(data);
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 502 });
  }
}
