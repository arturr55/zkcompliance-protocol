"use client";

import { useEffect, useState } from "react";
import Link from "next/link";

interface SandboxStatus {
  connected: boolean;
  blockNumber?: number;
  error?: string;
}

export default function OverviewPage() {
  const [status, setStatus] = useState<SandboxStatus>({ connected: false });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/status")
      .then((r) => r.json())
      .then((data) => setStatus(data))
      .catch(() => setStatus({ connected: false, error: "API unreachable" }))
      .finally(() => setLoading(false));
  }, []);

  const features = [
    {
      icon: "🔒",
      title: "Private Salary Notes",
      desc: "Salaries stored as encrypted UintNotes — only the employee can read them.",
    },
    {
      icon: "✅",
      title: "KYC Verification",
      desc: "Employer identity verified on-chain before any payroll can be issued.",
    },
    {
      icon: "🏦",
      title: "Token Escrow",
      desc: "Employers pre-deposit funds. Escrow atomically deducts on each salary issuance.",
    },
    {
      icon: "⚖️",
      title: "Compliance Oracle",
      desc: "M-of-N multisig approvers authorize time-limited audit access to records.",
    },
    {
      icon: "🔑",
      title: "SingleUseClaim",
      desc: "Nullifier-based claim prevents double-spending without revealing identity.",
    },
    {
      icon: "📊",
      title: "Proof of Reserves",
      desc: "Total committed payroll is public — auditors verify solvency without seeing salaries.",
    },
  ];

  return (
    <div className="p-8 max-w-4xl">
      <h1 className="text-3xl font-bold text-white mb-1">ZKCompliance Protocol</h1>
      <p className="text-gray-400 mb-8">
        Private Payroll &amp; Compliance on{" "}
        <span className="text-purple-400 font-medium">Aztec Network</span>
      </p>

      {/* Sandbox status */}
      <div className="bg-gray-900 border border-gray-800 rounded-xl p-5 mb-8 flex items-center gap-4">
        <div
          className={`w-3 h-3 rounded-full ${
            loading ? "bg-yellow-500 animate-pulse" : status.connected ? "bg-green-500" : "bg-red-500"
          }`}
        />
        <div>
          <div className="text-sm font-medium text-gray-200">
            {loading
              ? "Connecting to Aztec Sandbox…"
              : status.connected
              ? `Sandbox connected — block #${status.blockNumber}`
              : `Sandbox offline — ${status.error ?? "not reachable"}`}
          </div>
          <div className="text-xs text-gray-500 mt-0.5">
            localhost:8080 · chain 31337 · Aztec v4.1.3
          </div>
        </div>
      </div>

      {/* Feature grid */}
      <h2 className="text-lg font-semibold text-gray-200 mb-4">Protocol Features</h2>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-10">
        {features.map((f) => (
          <div
            key={f.title}
            className="bg-gray-900 border border-gray-800 rounded-xl p-4"
          >
            <div className="text-2xl mb-2">{f.icon}</div>
            <div className="text-sm font-semibold text-gray-100 mb-1">{f.title}</div>
            <div className="text-xs text-gray-400 leading-5">{f.desc}</div>
          </div>
        ))}
      </div>

      {/* Quick links */}
      <h2 className="text-lg font-semibold text-gray-200 mb-4">Try the Demo</h2>
      <div className="flex flex-wrap gap-3">
        <Link
          href="/employer"
          className="bg-purple-700 hover:bg-purple-600 text-white text-sm font-medium px-5 py-2.5 rounded-lg transition-colors"
        >
          🏢 Employer Flow
        </Link>
        <Link
          href="/employee"
          className="bg-gray-800 hover:bg-gray-700 text-white text-sm font-medium px-5 py-2.5 rounded-lg transition-colors"
        >
          👤 Employee Flow
        </Link>
        <Link
          href="/oracle"
          className="bg-gray-800 hover:bg-gray-700 text-white text-sm font-medium px-5 py-2.5 rounded-lg transition-colors"
        >
          ⚖️ Compliance Oracle
        </Link>
      </div>
    </div>
  );
}
