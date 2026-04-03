"use client";

import { useEffect, useState } from "react";

const DEMO_EMPLOYER = "0x1a0ccaaffc4309a1f923fe5fa8f03e42bdb0af5e92ffaf74307a10182e64c40e";
const APPROVER_NAMES = ["EU Regulator", "Tax Authority", "External Auditor"];

interface AuditRequest {
  id: number;
  requester: string;
  employer: string;
  periodStart: number;
  periodEnd: number;
  submittedAt: number;
  expiresAt: number;
  approvalCount: number;
  status: 0 | 1 | 2;
  approverVotes: number[];
}

const STATUS_LABEL: Record<number, { text: string; color: string }> = {
  0: { text: "PENDING", color: "text-yellow-400" },
  1: { text: "APPROVED", color: "text-green-400" },
  2: { text: "REJECTED", color: "text-red-400" },
};

export default function OraclePage() {
  const [requests, setRequests] = useState<AuditRequest[]>([]);
  const [threshold, setThreshold] = useState(2);
  const [loading, setLoading] = useState(false);
  const [log, setLog] = useState<string[]>([]);
  const [periodStart, setPeriodStart] = useState("1");
  const [periodEnd, setPeriodEnd] = useState("3");

  function addLog(msg: string) {
    setLog((prev) => [`[${new Date().toLocaleTimeString()}] ${msg}`, ...prev]);
  }

  async function refresh() {
    const res = await fetch("/api/oracle", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "list" }),
    });
    const data = await res.json();
    if (!data.error) {
      setRequests(data.requests);
      setThreshold(data.threshold);
    }
  }

  useEffect(() => {
    refresh();
  }, []);

  async function callOracle(action: string, extra?: Record<string, unknown>) {
    setLoading(true);
    try {
      const res = await fetch("/api/oracle", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action, ...extra }),
      });
      const data = await res.json();
      if (!res.ok || data.error) {
        addLog(`❌ ${data.error}`);
      } else {
        addLog(`✅ Action "${action}" succeeded`);
        await refresh();
      }
    } finally {
      setLoading(false);
    }
  }

  function formatDate(ts: number) {
    return new Date(ts * 1000).toLocaleDateString();
  }

  return (
    <div className="p-8 max-w-4xl">
      <h1 className="text-2xl font-bold text-white mb-1">⚖️ Compliance Oracle</h1>
      <p className="text-gray-400 mb-6 text-sm">
        M-of-N multisig audit access control · threshold: {threshold}-of-{APPROVER_NAMES.length} approvers
      </p>

      {/* Architecture note */}
      <div className="bg-gray-900 border border-gray-800 rounded-xl p-5 mb-6">
        <div className="text-sm font-semibold text-gray-200 mb-2">How the Oracle Works</div>
        <div className="grid grid-cols-3 gap-4 text-xs text-gray-400">
          <div>
            <div className="text-gray-200 font-medium mb-1">1. Submit Request</div>
            Any party submits an audit request for employer X, period Y–Z.
          </div>
          <div>
            <div className="text-gray-200 font-medium mb-1">2. Approvers Vote</div>
            Registered approvers approve or reject. Once {threshold} approve → access granted.
          </div>
          <div>
            <div className="text-gray-200 font-medium mb-1">3. 30-Day Window</div>
            Approved requests expire after 30 days. Time-limited audit access only.
          </div>
        </div>
      </div>

      {/* Approvers */}
      <div className="bg-gray-900 border border-gray-800 rounded-xl p-5 mb-6">
        <div className="text-sm font-semibold text-gray-200 mb-3">
          Registered Approvers ({threshold}-of-{APPROVER_NAMES.length})
        </div>
        <div className="flex gap-3 flex-wrap">
          {APPROVER_NAMES.map((name, i) => (
            <div
              key={i}
              className="bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-xs"
            >
              <span className="text-gray-400 mr-1">#{i}</span>
              <span className="text-gray-200">{name}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Submit new request */}
      <div className="bg-gray-900 border border-gray-800 rounded-xl p-5 mb-6">
        <div className="text-sm font-semibold text-gray-200 mb-3">Submit Audit Request</div>
        <div className="flex gap-3 items-end flex-wrap">
          <div>
            <label className="text-xs text-gray-500 mb-1 block">Period Start</label>
            <input
              type="number"
              value={periodStart}
              onChange={(e) => setPeriodStart(e.target.value)}
              className="bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm text-gray-200 w-24"
            />
          </div>
          <div>
            <label className="text-xs text-gray-500 mb-1 block">Period End</label>
            <input
              type="number"
              value={periodEnd}
              onChange={(e) => setPeriodEnd(e.target.value)}
              className="bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm text-gray-200 w-24"
            />
          </div>
          <button
            disabled={loading}
            onClick={() =>
              callOracle("submit", {
                requester: "0xREQUESTER",
                employer: DEMO_EMPLOYER,
                periodStart: Number(periodStart),
                periodEnd: Number(periodEnd),
              })
            }
            className="bg-purple-700 hover:bg-purple-600 disabled:opacity-40 text-white text-sm font-medium px-5 py-2 rounded-lg transition-colors"
          >
            Submit Request
          </button>
        </div>
      </div>

      {/* Requests list */}
      <div className="mb-6">
        <div className="text-sm font-semibold text-gray-200 mb-3">
          Audit Requests ({requests.length})
        </div>
        {requests.length === 0 ? (
          <div className="bg-gray-900 border border-gray-800 rounded-xl p-6 text-center text-xs text-gray-600">
            No audit requests yet. Submit one above.
          </div>
        ) : (
          <div className="space-y-3">
            {requests.map((r) => (
              <div
                key={r.id}
                className="bg-gray-900 border border-gray-800 rounded-xl p-4"
              >
                <div className="flex items-start justify-between mb-3">
                  <div>
                    <span className="text-xs text-gray-500 mr-2">#{r.id}</span>
                    <span className={`text-xs font-bold ${STATUS_LABEL[r.status].color}`}>
                      {STATUS_LABEL[r.status].text}
                    </span>
                  </div>
                  <div className="text-xs text-gray-500">
                    Submitted: {formatDate(r.submittedAt)} · Expires: {formatDate(r.expiresAt)}
                  </div>
                </div>
                <div className="text-xs text-gray-400 mb-3 space-y-0.5">
                  <div>
                    <span className="text-gray-500">Employer:</span>{" "}
                    <span className="font-mono">{r.employer.slice(0, 20)}…</span>
                  </div>
                  <div>
                    <span className="text-gray-500">Period:</span> {r.periodStart} → {r.periodEnd}
                  </div>
                  <div>
                    <span className="text-gray-500">Approvals:</span> {r.approvalCount}/{threshold}
                  </div>
                </div>

                {/* Approver vote buttons */}
                {r.status === 0 && (
                  <div className="flex gap-2 flex-wrap">
                    {APPROVER_NAMES.map((name, slot) => {
                      const voted = r.approverVotes.includes(slot);
                      return (
                        <div key={slot} className="flex gap-1">
                          <button
                            disabled={loading || voted}
                            onClick={() =>
                              callOracle("approve", { requestId: r.id, approverSlot: slot })
                            }
                            className="bg-green-800 hover:bg-green-700 disabled:opacity-40 text-white text-xs px-3 py-1 rounded-lg transition-colors"
                          >
                            {voted ? "✓ " : ""}Approve ({name})
                          </button>
                          <button
                            disabled={loading}
                            onClick={() =>
                              callOracle("reject", { requestId: r.id, approverSlot: slot })
                            }
                            className="bg-red-900 hover:bg-red-800 disabled:opacity-40 text-white text-xs px-3 py-1 rounded-lg transition-colors"
                          >
                            Reject
                          </button>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Log */}
      <div className="bg-gray-950 border border-gray-800 rounded-xl p-4">
        <div className="text-xs text-gray-500 mb-2 font-medium">Activity Log</div>
        {log.length === 0 ? (
          <div className="text-xs text-gray-600">No activity yet</div>
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
