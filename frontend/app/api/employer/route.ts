import { NextRequest, NextResponse } from "next/server";
import { isSandboxAvailable, getSandboxWalletAndContract } from "@/lib/sandbox";

// In-memory mock state (used when sandbox not available)
const mockState = {
  kycVerified: new Set<string>(),
  escrow: new Map<string, number>(),
  payroll: new Map<string, number>(),
};

async function handleReal(action: string, body: any): Promise<NextResponse | null> {
  try {
    const available = await isSandboxAvailable();
    if (!available) return null;

    const { contract, adminAddress } = await getSandboxWalletAndContract();
    const { AztecAddress } = await import("@aztec/aztec.js/addresses");

    if (action === "verify_kyc") {
      const employer = AztecAddress.fromString(body.employer);
      await contract.methods.verify_employer_kyc(employer).send({ from: adminAddress }).wait();
      return NextResponse.json({ success: true, message: `KYC verified on-chain for ${body.employer.slice(0, 10)}…`, real: true });
    }

    if (action === "deposit") {
      const employer = AztecAddress.fromString(body.employer);
      await contract.methods.deposit_payroll(BigInt(body.amount)).send({ from: employer }).wait();
      const balance = await contract.methods.get_escrow_balance(employer).simulate();
      return NextResponse.json({ success: true, escrowBalance: Number(balance), message: `Deposited ${body.amount} on-chain`, real: true });
    }

    if (action === "issue_salary") {
      const employer = AztecAddress.fromString(body.employer);
      const employee = AztecAddress.fromString(body.employee);
      await contract.methods
        .issue_salary(employee, BigInt(body.amount), Number(body.period), Number(body.jurisdiction))
        .send({ from: employer })
        .wait();
      const escrow = await contract.methods.get_escrow_balance(employer).simulate();
      const payroll = await contract.methods.get_payroll_commitment(employer).simulate();
      return NextResponse.json({
        success: true,
        escrowBalance: Number(escrow),
        payrollCommitted: Number(payroll),
        message: `Salary note issued on-chain · period ${body.period}`,
        real: true,
      });
    }

    if (action === "get_state") {
      const employer = AztecAddress.fromString(body.employer);
      const kyc = await contract.methods.is_kyc_verified(employer).simulate();
      const escrow = await contract.methods.get_escrow_balance(employer).simulate();
      const payroll = await contract.methods.get_payroll_commitment(employer).simulate();
      return NextResponse.json({ kycVerified: kyc, escrowBalance: Number(escrow), payrollCommitted: Number(payroll), real: true });
    }

    return null;
  } catch (e) {
    // Fall through to mock
    console.error("Sandbox call failed, using mock:", e);
    return null;
  }
}

export async function POST(req: NextRequest) {
  const body = await req.json();
  const { action, employer } = body;

  // Try real sandbox first
  const realResult = await handleReal(action, body);
  if (realResult) return realResult;

  // Mock fallback
  try {
    if (action === "verify_kyc") {
      if (!employer) return NextResponse.json({ error: "employer required" }, { status: 400 });
      mockState.kycVerified.add(employer);
      return NextResponse.json({ success: true, message: `KYC verified for ${employer.slice(0, 10)}… (demo)` });
    }

    if (action === "deposit") {
      const { amount } = body;
      if (!employer || !amount) return NextResponse.json({ error: "employer and amount required" }, { status: 400 });
      if (!mockState.kycVerified.has(employer)) return NextResponse.json({ error: "Employer is not KYC verified" }, { status: 400 });
      const prev = mockState.escrow.get(employer) ?? 0;
      mockState.escrow.set(employer, prev + Number(amount));
      return NextResponse.json({ success: true, escrowBalance: mockState.escrow.get(employer), message: `Deposited ${amount} to escrow (demo)` });
    }

    if (action === "issue_salary") {
      const { employee, amount, period, jurisdiction } = body;
      if (!employer || !employee || !amount) return NextResponse.json({ error: "employer, employee, amount required" }, { status: 400 });
      if (!mockState.kycVerified.has(employer)) return NextResponse.json({ error: "Employer is not KYC verified" }, { status: 400 });
      const escrow = mockState.escrow.get(employer) ?? 0;
      if (escrow < Number(amount)) return NextResponse.json({ error: `Insufficient escrow (${escrow}). Deposit first.` }, { status: 400 });
      mockState.escrow.set(employer, escrow - Number(amount));
      const prev = mockState.payroll.get(employer) ?? 0;
      mockState.payroll.set(employer, prev + Number(amount));
      return NextResponse.json({
        success: true,
        escrowBalance: mockState.escrow.get(employer),
        payrollCommitted: mockState.payroll.get(employer),
        message: `Salary note issued · period ${period} · jurisdiction ${jurisdiction} (demo)`,
      });
    }

    if (action === "get_state") {
      if (!employer) return NextResponse.json({ error: "employer required" }, { status: 400 });
      return NextResponse.json({
        kycVerified: mockState.kycVerified.has(employer),
        escrowBalance: mockState.escrow.get(employer) ?? 0,
        payrollCommitted: mockState.payroll.get(employer) ?? 0,
      });
    }

    return NextResponse.json({ error: "Unknown action" }, { status: 400 });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
