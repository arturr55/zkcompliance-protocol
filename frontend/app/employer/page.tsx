"use client";

import { useState } from "react";

const DEMO_EMPLOYER = "0x1a0ccaaffc4309a1f923fe5fa8f03e42bdb0af5e92ffaf74307a10182e64c40e";
const DEMO_EMPLOYEE = "0x2b3ddbbffc4309a1f923fe5fa8f03e42bdb0af5e92ffaf74307a10182e64c40f";

interface State {
  kycVerified: boolean;
  escrowBalance: number;
  payrollCommitted: number;
}

export default function EmployerPage() {
  const [state, setState] = useState<State>({
    kycVerified: false,
    escrowBalance: 0,
    payrollCommitted: 0,
  });
  const [log, setLog] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const [depositAmount, setDepositAmount] = useState("50000");
  const [salaryAmount, setSalaryAmount] = useState("10000");
  const [period, setPeriod] = useState("1");
  const [jurisdiction, setJurisdiction] = useState("1");

  function addLog(msg: string) {
    setLog((prev) => [`[${new Date().toLocaleTimeString()}] ${msg}`, ...prev]);
  }

  async function call(action: string, extra?: Record<string, unknown>) {
    setLoading(true);
    try {
      const res = await fetch("/api/employer", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action, employer: DEMO_EMPLOYER, ...extra }),
      });
      const data = await res.json();
      if (!res.ok || data.error) {
        addLog(`❌ ${data.error}`);
        return;
      }
      addLog(`✅ ${data.message}`);

      // Refresh state
      const stateRes = await fetch("/api/employer", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "get_state", employer: DEMO_EMPLOYER }),
      });
      const stateData = await stateRes.json();
      if (!stateData.error) setState(stateData);
    } finally {
      setLoading(false);
    }
  }

  const jurisdictionLabel = (j: string) =>
    j === "1" ? "EU 🇪🇺" : j === "2" ? "US 🇺🇸" : "SG 🇸🇬";

  return (
    <div className="p-8 max-w-3xl">
      <h1 className="text-2xl font-bold text-white mb-1">🏢 Employer Flow</h1>
      <p className="text-gray-400 mb-6 text-sm">
        Verify KYC → Deposit escrow → Issue private salary notes to employees
      </p>

      {/* State card */}
      <div className="bg-gray-900 border border-gray-800 rounded-xl p-5 mb-6 grid grid-cols-3 gap-4">
        <div>
          <div className="text-xs text-gray-500 mb-1">KYC Status</div>
          <div
            className={`text-sm font-semibold ${state.kycVerified ? "text-green-400" : "text-red-400"}`}
          >
            {state.kycVerified ? "✅ Verified" : "❌ Not verified"}
          </div>
        </div>
        <div>
          <div className="text-xs text-gray-500 mb-1">Escrow Balance</div>
          <div className="text-sm font-semibold text-purple-300">
            {state.escrowBalance.toLocaleString()} tokens
          </div>
        </div>
        <div>
          <div className="text-xs text-gray-500 mb-1">Payroll Committed</div>
          <div className="text-sm font-semibold text-blue-300">
            {state.payrollCommitted.toLocaleString()} tokens
          </div>
        </div>
      </div>

      {/* Address info */}
      <div className="bg-gray-900 border border-gray-800 rounded-xl p-4 mb-6 text-xs text-gray-500 space-y-1">
        <div>
          <span className="text-gray-400">Employer:</span>{" "}
          <span className="font-mono">{DEMO_EMPLOYER.slice(0, 20)}…</span>
        </div>
        <div>
          <span className="text-gray-400">Employee:</span>{" "}
          <span className="font-mono">{DEMO_EMPLOYEE.slice(0, 20)}…</span>
        </div>
      </div>

      {/* Step 1: KYC */}
      <div className="bg-gray-900 border border-gray-800 rounded-xl p-5 mb-4">
        <div className="text-sm font-semibold text-gray-200 mb-3">Step 1 — Verify Employer KYC</div>
        <p className="text-xs text-gray-400 mb-4">
          Admin calls <code className="text-purple-300">verify_employer_kyc(employer)</code>. In the
          protocol this is public — sets <code className="text-purple-300">kyc_verified[employer] = true</code>.
        </p>
        <button
          disabled={loading || state.kycVerified}
          onClick={() => call("verify_kyc")}
          className="bg-purple-700 hover:bg-purple-600 disabled:opacity-40 text-white text-sm font-medium px-5 py-2 rounded-lg transition-colors"
        >
          {state.kycVerified ? "Already Verified" : "Verify KYC (as admin)"}
        </button>
      </div>

      {/* Step 2: Deposit */}
      <div className="bg-gray-900 border border-gray-800 rounded-xl p-5 mb-4">
        <div className="text-sm font-semibold text-gray-200 mb-3">Step 2 — Deposit to Escrow</div>
        <p className="text-xs text-gray-400 mb-4">
          Calls <code className="text-purple-300">deposit_payroll(amount)</code>. Requires KYC.
          Escrow balance is public (Proof-of-Reserves).
        </p>
        <div className="flex gap-3 items-center">
          <input
            type="number"
            value={depositAmount}
            onChange={(e) => setDepositAmount(e.target.value)}
            className="bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm text-gray-200 w-32"
          />
          <span className="text-xs text-gray-500">tokens</span>
          <button
            disabled={loading || !state.kycVerified}
            onClick={() => call("deposit", { amount: depositAmount })}
            className="bg-blue-700 hover:bg-blue-600 disabled:opacity-40 text-white text-sm font-medium px-5 py-2 rounded-lg transition-colors"
          >
            Deposit
          </button>
        </div>
      </div>

      {/* Step 3: Issue salary */}
      <div className="bg-gray-900 border border-gray-800 rounded-xl p-5 mb-6">
        <div className="text-sm font-semibold text-gray-200 mb-3">Step 3 — Issue Salary Note (Private)</div>
        <p className="text-xs text-gray-400 mb-4">
          Calls <code className="text-purple-300">issue_salary(employee, amount, period, jurisdiction)</code>.
          This is a <span className="text-purple-300">private</span> function — creates an encrypted UintNote
          only the employee can read. Also creates a ComplianceNote audit trail.
        </p>
        <div className="grid grid-cols-2 gap-3 mb-3">
          <div>
            <label className="text-xs text-gray-500 mb-1 block">Amount</label>
            <input
              type="number"
              value={salaryAmount}
              onChange={(e) => setSalaryAmount(e.target.value)}
              className="bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm text-gray-200 w-full"
            />
          </div>
          <div>
            <label className="text-xs text-gray-500 mb-1 block">Period</label>
            <input
              type="number"
              value={period}
              onChange={(e) => setPeriod(e.target.value)}
              className="bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm text-gray-200 w-full"
            />
          </div>
          <div>
            <label className="text-xs text-gray-500 mb-1 block">Jurisdiction</label>
            <select
              value={jurisdiction}
              onChange={(e) => setJurisdiction(e.target.value)}
              className="bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm text-gray-200 w-full"
            >
              <option value="1">EU 🇪🇺</option>
              <option value="2">US 🇺🇸</option>
              <option value="3">SG 🇸🇬</option>
            </select>
          </div>
        </div>
        <button
          disabled={loading || !state.kycVerified || state.escrowBalance < Number(salaryAmount)}
          onClick={() =>
            call("issue_salary", {
              employee: DEMO_EMPLOYEE,
              amount: salaryAmount,
              period,
              jurisdiction,
            })
          }
          className="bg-green-700 hover:bg-green-600 disabled:opacity-40 text-white text-sm font-medium px-5 py-2 rounded-lg transition-colors"
        >
          Issue Salary Note · {jurisdictionLabel(jurisdiction)}
        </button>
        {state.escrowBalance < Number(salaryAmount) && state.kycVerified && (
          <p className="text-xs text-red-400 mt-2">
            Insufficient escrow — deposit at least {salaryAmount} first
          </p>
        )}
      </div>

      {/* Log */}
      <div className="bg-gray-950 border border-gray-800 rounded-xl p-4">
        <div className="text-xs text-gray-500 mb-2 font-medium">Transaction Log</div>
        {log.length === 0 ? (
          <div className="text-xs text-gray-600">No transactions yet</div>
        ) : (
          <div className="space-y-1">
            {log.map((entry, i) => (
              <div key={i} className="text-xs font-mono text-gray-300">
                {entry}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
