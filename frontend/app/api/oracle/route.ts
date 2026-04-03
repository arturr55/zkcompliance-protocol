import { NextRequest, NextResponse } from "next/server";

interface AuditRequest {
  id: number;
  requester: string;
  employer: string;
  periodStart: number;
  periodEnd: number;
  submittedAt: number;
  expiresAt: number;
  approvalCount: number;
  status: 0 | 1 | 2; // PENDING | APPROVED | REJECTED
  approverVotes: Set<number>;
}

// Demo state
const requests: AuditRequest[] = [];
const THRESHOLD = 2;
const APPROVERS = [
  "0xAPPROVER_0",
  "0xAPPROVER_1",
  "0xAPPROVER_2",
];
const AUDIT_WINDOW = 30 * 24 * 3600; // 30 days in seconds

export async function POST(req: NextRequest) {
  const body = await req.json();
  const { action } = body;

  try {
    if (action === "submit") {
      const { requester, employer, periodStart, periodEnd } = body;
      if (!employer || periodEnd < periodStart)
        return NextResponse.json({ error: "Invalid request params" }, { status: 400 });

      const now = Math.floor(Date.now() / 1000);
      const request: AuditRequest = {
        id: requests.length,
        requester: requester ?? "0xANON",
        employer,
        periodStart: Number(periodStart),
        periodEnd: Number(periodEnd),
        submittedAt: now,
        expiresAt: now + AUDIT_WINDOW,
        approvalCount: 0,
        status: 0,
        approverVotes: new Set(),
      };
      requests.push(request);
      return NextResponse.json({ success: true, requestId: request.id });
    }

    if (action === "approve") {
      const { requestId, approverSlot } = body;
      const req2 = requests[Number(requestId)];
      if (!req2) return NextResponse.json({ error: "Request not found" }, { status: 404 });
      if (req2.status !== 0)
        return NextResponse.json({ error: "Request is not in pending status" }, { status: 400 });
      if (approverSlot < 0 || approverSlot >= APPROVERS.length)
        return NextResponse.json({ error: "Invalid approver slot" }, { status: 400 });
      if (req2.approverVotes.has(Number(approverSlot)))
        return NextResponse.json({ error: "Approver has already voted" }, { status: 400 });

      req2.approverVotes.add(Number(approverSlot));
      req2.approvalCount += 1;
      if (req2.approvalCount >= THRESHOLD) req2.status = 1;

      return NextResponse.json({
        success: true,
        approvalCount: req2.approvalCount,
        status: req2.status,
      });
    }

    if (action === "reject") {
      const { requestId, approverSlot } = body;
      const req2 = requests[Number(requestId)];
      if (!req2) return NextResponse.json({ error: "Request not found" }, { status: 404 });
      if (req2.status !== 0)
        return NextResponse.json({ error: "Request is not in pending status" }, { status: 400 });
      if (approverSlot < 0 || approverSlot >= APPROVERS.length)
        return NextResponse.json({ error: "Invalid approver slot" }, { status: 400 });

      req2.status = 2;
      return NextResponse.json({ success: true, status: req2.status });
    }

    if (action === "list") {
      return NextResponse.json({
        requests: requests.map((r) => ({
          ...r,
          approverVotes: Array.from(r.approverVotes),
        })),
        threshold: THRESHOLD,
        approvers: APPROVERS,
      });
    }

    return NextResponse.json({ error: "Unknown action" }, { status: 400 });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
