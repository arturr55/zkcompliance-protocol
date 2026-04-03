import { NextRequest, NextResponse } from "next/server";

// NOTE: This is a mock API for demo purposes.
// In a real deployment these calls go to the Aztec Sandbox via EmbeddedWallet.
// EmbeddedWallet is Node-only (LMDB), so all contract calls stay server-side.

// Simulated in-memory state for demo
const state = {
  kycVerified: new Set<string>(),
  escrow: new Map<string, number>(),
  payroll: new Map<string, number>(),
};

export async function POST(req: NextRequest) {
  const body = await req.json();
  const { action, employer } = body;

  try {
    if (action === "verify_kyc") {
      if (!employer) return NextResponse.json({ error: "employer required" }, { status: 400 });
      state.kycVerified.add(employer);
      return NextResponse.json({
        success: true,
        message: `KYC verified for ${employer.slice(0, 10)}…`,
      });
    }

    if (action === "deposit") {
      const { amount } = body;
      if (!employer || !amount)
        return NextResponse.json({ error: "employer and amount required" }, { status: 400 });
      if (!state.kycVerified.has(employer))
        return NextResponse.json({ error: "Employer is not KYC verified" }, { status: 400 });
      const prev = state.escrow.get(employer) ?? 0;
      state.escrow.set(employer, prev + Number(amount));
      return NextResponse.json({
        success: true,
        escrowBalance: state.escrow.get(employer),
        message: `Deposited ${amount} to escrow`,
      });
    }

    if (action === "issue_salary") {
      const { employee, amount, period, jurisdiction } = body;
      if (!employer || !employee || !amount)
        return NextResponse.json({ error: "employer, employee, amount required" }, { status: 400 });
      if (!state.kycVerified.has(employer))
        return NextResponse.json({ error: "Employer is not KYC verified" }, { status: 400 });
      const escrow = state.escrow.get(employer) ?? 0;
      if (escrow < Number(amount))
        return NextResponse.json(
          { error: `Insufficient escrow (${escrow}). Deposit first.` },
          { status: 400 }
        );
      state.escrow.set(employer, escrow - Number(amount));
      const prev = state.payroll.get(employer) ?? 0;
      state.payroll.set(employer, prev + Number(amount));
      return NextResponse.json({
        success: true,
        escrowBalance: state.escrow.get(employer),
        payrollCommitted: state.payroll.get(employer),
        message: `Salary note issued to employee · period ${period} · jurisdiction ${jurisdiction}`,
      });
    }

    if (action === "get_state") {
      if (!employer) return NextResponse.json({ error: "employer required" }, { status: 400 });
      return NextResponse.json({
        kycVerified: state.kycVerified.has(employer),
        escrowBalance: state.escrow.get(employer) ?? 0,
        payrollCommitted: state.payroll.get(employer) ?? 0,
      });
    }

    return NextResponse.json({ error: "Unknown action" }, { status: 400 });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
