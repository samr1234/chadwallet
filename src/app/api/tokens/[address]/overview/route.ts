import { NextResponse } from "next/server";
import { birdeyeFetch } from "@/lib/birdeye";

export const revalidate = 30;

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ address: string }> }
) {
  const { address } = await params;
  try {
    const data = await birdeyeFetch(`/defi/token_overview?address=${address}`);
    if (!data.data) {

      return NextResponse.json({ error: "No data returned" }, { status: 502 });
    }
    return NextResponse.json(data.data);
  } catch (err) {

    const message = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 502 });
  }
}
