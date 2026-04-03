"use client";

import { useState } from "react";

const DEMO_EMPLOYER = "0x1a0ccaaffc4309a1f923fe5fa8f03e42bdb0af5e92ffaf74307a10182e64c40e";
const DEMO_EMPLOYEE = "0x2b3ddbbffc4309a1f923fe5fa8f03e42bdb0af5e92ffaf74307a10182e64c40f";

export default function EmployeePage() {
  const [period, setPeriod] = useState("1");
  const [log, setLog] = useState<{ type: "success" | "error" | "info"; msg: string }[]>([]);
  const [loading, setLoading] = useState(false);
  const [nullifier, setNullifier] = useState<string | null>(null);

  function addLog(type: "success" | "error" | "info", msg: string) {
    setLog((prev) => [{ type, msg: `[${new Date().toLocaleTimeString()}] ${msg}` }, ...prev]);
  }

  async function claimSalary() {
    setLoading(true);
    try {
      const res = await fetch("/api/employee", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "claim_salary",
          employee: DEMO_EMPLOYEE,
          employer: DEMO_EMPLOYER,
          period,
        }),
      });
      const data = await res.json();
      if (!res.ok || data.error) {
        addLog("error", data.error);
        return;
      }
      addLog("success", data.message);
      setNullifier(data.nullifierHash);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="p-8 max-w-3xl">
      <h1 className="text-2xl font-bold text-white mb-1">👤 Employee Flow</h1>
      <p className="text-gray-400 mb-6 text-sm">
        Claim your encrypted salary note — zero-knowledge, no identity disclosed
      </p>

      {/* Privacy explanation */}
      <div className="bg-purple-950 border border-purple-800 rounded-xl p-5 mb-6">
        <div className="text-sm font-semibold text-purple-200 mb-2">How Private Claims Work</div>
        <ul className="text-xs text-purple-300 space-y-1.5 leading-5">
          <li>
            🔒 Your salary is stored as an encrypted{" "}
            <code className="bg-purple-900 px-1 rounded">UintNote</code> — only readable by you
          </li>
          <li>
            🎯 Calling <code className="bg-purple-900 px-1 rounded">claim_salary(employer)</code> uses
            a <code className="bg-purple-900 px-1 rounded">SingleUseClaim</code> that creates a nullifier
          </li>
          <li>
            🚫 Once claimed, the nullifier is committed on-chain — double-spend is impossible
          </li>
          <li>
            👁️ The claim proves you hold the note without revealing your balance to anyone else
          </li>
        </ul>
      </div>

      {/* Address info */}
      <div className="bg-gray-900 border border-gray-800 rounded-xl p-4 mb-6 text-xs text-gray-500 space-y-1">
        <div>
          <span className="text-gray-400">Your address:</span>{" "}
          <span className="font-mono">{DEMO_EMPLOYEE.slice(0, 20)}…</span>
        </div>
        <div>
          <span className="text-gray-400">Employer:</span>{" "}
          <span className="font-mono">{DEMO_EMPLOYER.slice(0, 20)}…</span>
        </div>
      </div>

      {/* Claim form */}
      <div className="bg-gray-900 border border-gray-800 rounded-xl p-5 mb-6">
        <div className="text-sm font-semibold text-gray-200 mb-3">Claim Salary</div>
        <p className="text-xs text-gray-400 mb-4">
          Select the pay period you want to claim. The Noir circuit will prove you own the note
          for that period and create a nullifier to prevent double-claiming.
        </p>
        <div className="flex gap-3 items-end">
          <div>
            <label className="text-xs text-gray-500 mb-1 block">Pay Period</label>
            <input
              type="number"
              value={period}
              onChange={(e) => setPeriod(e.target.value)}
              className="bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm text-gray-200 w-28"
              min="1"
            />
          </div>
          <button
            disabled={loading}
            onClick={claimSalary}
            className="bg-purple-700 hover:bg-purple-600 disabled:opacity-40 text-white text-sm font-medium px-5 py-2 rounded-lg transition-colors"
          >
            {loading ? "Proving…" : "Claim Salary"}
          </button>
        </div>
      </div>

      {/* Nullifier display */}
      {nullifier && (
        <div className="bg-green-950 border border-green-800 rounded-xl p-4 mb-6">
          <div className="text-xs text-green-400 font-medium mb-1">Nullifier committed on-chain</div>
          <div className="text-xs font-mono text-green-300 break-all">{nullifier}</div>
          <div className="text-xs text-green-600 mt-2">
            This nullifier prevents any future claim for period {period}
          </div>
        </div>
      )}

      {/* Log */}
      <div className="bg-gray-950 border border-gray-800 rounded-xl p-4">
        <div className="text-xs text-gray-500 mb-2 font-medium">Activity Log</div>
        {log.length === 0 ? (
          <div className="text-xs text-gray-600">No activity yet</div>
        ) : (
          <div className="space-y-1">
            {log.map((entry, i) => (
              <div
                key={i}
                className={`text-xs font-mono ${
                  entry.type === "error"
                    ? "text-red-400"
                    : entry.type === "success"
                    ? "text-green-400"
                    : "text-gray-300"
                }`}
              >
                {entry.msg}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
