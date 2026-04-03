import { NextRequest, NextResponse } from "next/server";

// Simulated in-memory state for demo (shared across requests in dev)
const claimed = new Set<string>(); // "employer:employee:period"

export async function POST(req: NextRequest) {
  const body = await req.json();
  const { action, employee, employer, period } = body;

  try {
    if (action === "claim_salary") {
      if (!employee || !employer || !period)
        return NextResponse.json(
          { error: "employee, employer, period required" },
          { status: 400 }
        );

      const key = `${employer}:${employee}:${period}`;
      if (claimed.has(key))
        return NextResponse.json({ error: "Salary already claimed (nullifier spent)" }, { status: 400 });

      claimed.add(key);
      return NextResponse.json({
        success: true,
        message: `Salary claimed · nullifier committed · period ${period}`,
        nullifierHash: "0x" + Buffer.from(key).toString("hex").slice(0, 64),
      });
    }

    return NextResponse.json({ error: "Unknown action" }, { status: 400 });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
