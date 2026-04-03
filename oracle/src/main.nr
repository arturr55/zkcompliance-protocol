// ComplianceOracle contract - ZKCompliance Protocol
mod test;

use aztec::macros::aztec;

/// ComplianceOracle - ZKCompliance Protocol
///
/// M-of-N multisig oracle for authorized audit access to ComplianceNotes.
///
/// Flow:
///   1. Any party submits an audit request for employer X, period Y-Z
///   2. Each approver reviews and signs approve/reject
///   3. Once M approvals reached -> request is approved (audit window opens)
///   4. All access requests are logged on-chain (transparency guarantee)
///   5. Audit window expires after 30 days (time-limited access)
#[aztec]
pub contract ComplianceOracle {
    use aztec::macros::{
        functions::{external, initializer, view},
        storage::storage,
    };
    use aztec::protocol::{
        address::AztecAddress,
        traits::{Deserialize, Packable, Serialize},
    };
    use aztec::state_vars::{Map, PublicImmutable, PublicMutable};

    // Audit window: 30 days in seconds
    global AUDIT_WINDOW_SECONDS: u64 = 2592000;

    // Request status codes
    global STATUS_PENDING: u32 = 0;
    global STATUS_APPROVED: u32 = 1;
    global STATUS_REJECTED: u32 = 2;

    #[derive(Serialize, Deserialize, Packable, Eq)]
    pub struct AuditRequest {
        pub requester: AztecAddress,
        pub employer: AztecAddress,
        pub period_start: u32,
        pub period_end: u32,
        pub submitted_at: u64,
        pub expires_at: u64,
        pub approval_count: u32,
        pub status: u32,
    }

    #[storage]
    struct Storage<Context> {
        // Jurisdiction this oracle covers (1=EU, 2=US, 3=SG)
        jurisdiction: PublicImmutable<u32, Context>,

        // Minimum approvals required (M in M-of-N)
        threshold: PublicImmutable<u32, Context>,

        // How many approvers are registered
        approver_count: PublicImmutable<u32, Context>,

        // Approver slots 0..4 -> AztecAddress (zero = empty slot)
        approvers: Map<u32, PublicImmutable<AztecAddress, Context>, Context>,

        // Total requests submitted (used as sequential ID counter)
        request_count: PublicMutable<u32, Context>,

        // Audit requests by ID
        requests: Map<u32, PublicMutable<AuditRequest, Context>, Context>,

        // Per-request per-approver slot: has this approver voted?
        approvals: Map<u32, Map<u32, PublicMutable<bool, Context>, Context>, Context>,
    }

    // ---- Initializer ----
    #[external("public")]
    #[initializer]
    fn constructor(
        jurisdiction: u32,
        threshold: u32,
        approver_0: AztecAddress,
        approver_1: AztecAddress,
        approver_2: AztecAddress,
        approver_3: AztecAddress,
        approver_4: AztecAddress,
    ) {
        assert((jurisdiction >= 1) & (jurisdiction <= 3), "Invalid jurisdiction: use 1=EU 2=US 3=SG");
        assert(threshold >= 1, "Threshold must be at least 1");
        assert(threshold <= 5, "Threshold cannot exceed 5");

        self.storage.jurisdiction.initialize(jurisdiction);
        self.storage.threshold.initialize(threshold);

        self.storage.approvers.at(0).initialize(approver_0);
        self.storage.approvers.at(1).initialize(approver_1);
        self.storage.approvers.at(2).initialize(approver_2);
        self.storage.approvers.at(3).initialize(approver_3);
        self.storage.approvers.at(4).initialize(approver_4);

        let mut count: u32 = 0;
        if !approver_0.eq(AztecAddress::zero()) { count += 1; }
        if !approver_1.eq(AztecAddress::zero()) { count += 1; }
        if !approver_2.eq(AztecAddress::zero()) { count += 1; }
        if !approver_3.eq(AztecAddress::zero()) { count += 1; }
        if !approver_4.eq(AztecAddress::zero()) { count += 1; }

        assert(count >= threshold, "Not enough approvers to meet threshold");
        self.storage.approver_count.initialize(count);
    }

    // ---- Submit Audit Request ----
    #[external("public")]
    fn submit_audit_request(
        employer: AztecAddress,
        period_start: u32,
        period_end: u32,
    ) -> u32 {
        assert(period_end >= period_start, "period_end must be >= period_start");

        let requester = self.msg_sender();
        let now = self.context.timestamp();
        let request_id = self.storage.request_count.read();

        let request = AuditRequest {
            requester,
            employer,
            period_start,
            period_end,
            submitted_at: now,
            expires_at: now + AUDIT_WINDOW_SECONDS,
            approval_count: 0,
            status: STATUS_PENDING,
        };

        self.storage.requests.at(request_id).write(request);
        self.storage.request_count.write(request_id + 1);

        request_id
    }

    // ---- Approve Request ----
    #[external("public")]
    fn approve_request(request_id: u32) {
        let caller = self.msg_sender();
        let mut slot: u32 = 5;
        for i in 0..5_u32 {
            if self.storage.approvers.at(i).read().eq(caller) { slot = i; }
        }
        assert(slot < 5, "Caller is not a registered approver");

        let mut request = self.storage.requests.at(request_id).read();
        assert(request.status == STATUS_PENDING, "Request is not in pending status");
        assert(self.context.timestamp() <= request.expires_at, "Audit request has expired");

        let already_voted = self.storage.approvals.at(request_id).at(slot).read();
        assert(!already_voted, "Approver has already voted on this request");

        self.storage.approvals.at(request_id).at(slot).write(true);

        request.approval_count += 1;

        if request.approval_count >= self.storage.threshold.read() {
            request.status = STATUS_APPROVED;
        }

        self.storage.requests.at(request_id).write(request);
    }

    // ---- Reject Request ----
    #[external("public")]
    fn reject_request(request_id: u32) {
        let caller = self.msg_sender();
        let mut slot: u32 = 5;
        for i in 0..5_u32 {
            if self.storage.approvers.at(i).read().eq(caller) { slot = i; }
        }
        assert(slot < 5, "Caller is not a registered approver");

        let mut request = self.storage.requests.at(request_id).read();
        assert(request.status == STATUS_PENDING, "Request is not in pending status");

        request.status = STATUS_REJECTED;
        self.storage.requests.at(request_id).write(request);
    }

    // ---- View functions ----

    #[external("public")]
    #[view]
    fn is_request_approved(request_id: u32) -> bool {
        let request = self.storage.requests.at(request_id).read();
        let now = self.context.timestamp();
        (request.status == STATUS_APPROVED) & (now <= request.expires_at)
    }

    #[external("public")]
    #[view]
    fn get_request(request_id: u32) -> AuditRequest {
        self.storage.requests.at(request_id).read()
    }

    #[external("public")]
    #[view]
    fn get_request_count() -> u32 {
        self.storage.request_count.read()
    }

    #[external("public")]
    #[view]
    fn get_threshold() -> u32 {
        self.storage.threshold.read()
    }

    #[external("public")]
    #[view]
    fn get_jurisdiction() -> u32 {
        self.storage.jurisdiction.read()
    }

    #[external("public")]
    #[view]
    fn get_approver(slot: u32) -> AztecAddress {
        self.storage.approvers.at(slot).read()
    }

    #[external("public")]
    #[view]
    fn has_approver_voted(request_id: u32, slot: u32) -> bool {
        self.storage.approvals.at(request_id).at(slot).read()
    }

}

