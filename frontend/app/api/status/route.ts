import { NextResponse } from "next/server";
import { SANDBOX_URL } from "@/lib/aztec";

export async function GET() {
  try {
    // Aztec node exposes a simple JSON-RPC endpoint
    const res = await fetch(SANDBOX_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ jsonrpc: "2.0", method: "aztec_blockNumber", params: [], id: 1 }),
      signal: AbortSignal.timeout(5000),
    });

    if (!res.ok) {
      return NextResponse.json({ connected: false, error: `HTTP ${res.status}` });
    }

    const json = await res.json();
    const blockNumber = json.result ?? 0;
    return NextResponse.json({ connected: true, blockNumber });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e);
    return NextResponse.json({ connected: false, error: msg });
  }
}
