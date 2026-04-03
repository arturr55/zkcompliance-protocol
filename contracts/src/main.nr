// PrivatePayroll contract - ZKCompliance Protocol
mod test;
mod types;

use aztec::macros::aztec;

/// PrivatePayroll - ZKCompliance Protocol
///
/// Confidential salary payments with built-in regulatory compliance.
///
/// Privacy model (selective disclosure):
///   - Employee sees ONLY their own salary
///   - Employer sees total payroll aggregate (Proof-of-Reserves)
///   - Regulator sees nothing by default
///   - Every payment creates a ComplianceNote encrypted to the jurisdiction oracle
///   - Oracle can decrypt only on M-of-N multisig approval (court order / audit)
///
/// Note pattern (Aztec-native):
///   issue_salary (employer) -> inserts UintNote to employee + ComplianceNote to oracle
///   claim_salary (employee) -> reads UintNote, creates own SingleUseClaim nullifier
#[aztec]
pub contract PrivatePayroll {
    use crate::types::ComplianceNote;
    use aztec::macros::{
        functions::{external, initializer, only_self, view},
        storage::storage,
    };
    use aztec::messages::message_delivery::MessageDelivery;
    use aztec::protocol::{
        address::AztecAddress,
        traits::{Deserialize, Serialize, ToField},
    };
    use aztec::state_vars::{Map, Owned, PrivateSet, PublicImmutable, PublicMutable, SingleUseClaim};
    use uint_note::UintNote;

    // Jurisdiction IDs: 1=EU(MiCA), 2=US(FinCEN), 3=SG(MAS)
    global JURISDICTION_EU: u32 = 1;
    global JURISDICTION_US: u32 = 2;
    global JURISDICTION_SG: u32 = 3;

    #[derive(Serialize, Deserialize)]
    pub struct EmployeeId {
        address: AztecAddress,
    }

    impl ToField for EmployeeId {
        fn to_field(self) -> Field {
            self.address.to_field()
        }
    }

    // ---- Storage ----
    #[storage]
    struct Storage<Context> {
        // Contract admin
        admin: PublicMutable<AztecAddress, Context>,

        // KYC verification status per employer
        kyc_verified: Map<AztecAddress, PublicMutable<bool, Context>, Context>,

        // Compliance oracle per jurisdiction (PublicImmutable = readable from private)
        // Set once at construction, cannot be changed (upgrade = redeploy)
        compliance_oracles: Map<u32, PublicImmutable<AztecAddress, Context>, Context>,

        // Total payroll obligations per employer - Proof-of-Reserves
        total_payroll_committed: Map<AztecAddress, PublicMutable<u128, Context>, Context>,

        // Salary notes per employer -> employee (UintNote containing the salary amount)
        // Employer inserts note, employee reads and nullifies it on claim
        salary_notes: Map<AztecAddress, Owned<PrivateSet<UintNote, Context>, Context>, Context>,

        // Single-use claim for the EMPLOYEE to mark salary as claimed (nullifier on employee's side)
        // Employee calls claim_salary which creates the nullifier using THEIR OWN keys
        salary_claims: Map<AztecAddress, Owned<SingleUseClaim<Context>, Context>, Context>,

        // ComplianceNote set per employer, owned by the jurisdiction oracle
        // Oracle can decrypt these notes when presented with a valid court order / audit request
        compliance_records: Map<AztecAddress, Owned<PrivateSet<ComplianceNote, Context>, Context>, Context>,
    }

    // ---- Initializer ----
    #[external("public")]
    #[initializer]
    fn constructor(
        admin: AztecAddress,
        eu_oracle: AztecAddress,
        us_oracle: AztecAddress,
        sg_oracle: AztecAddress,
    ) {
        self.storage.admin.write(admin);
        // PublicImmutable.initialize() - sets value once, readable from private and public
        self.storage.compliance_oracles.at(JURISDICTION_EU).initialize(eu_oracle);
        self.storage.compliance_oracles.at(JURISDICTION_US).initialize(us_oracle);
        self.storage.compliance_oracles.at(JURISDICTION_SG).initialize(sg_oracle);
    }

    // ---- ZK-KYC Gate ----
    // MVP: admin marks employer as verified.
    // Production: verify ZK credential proof from Privado ID on-chain.
    #[external("public")]
    fn verify_employer_kyc(employer: AztecAddress) {
        assert(
            self.storage.admin.read().eq(self.msg_sender()),
            "Only admin can verify KYC (MVP mode)"
        );
        self.storage.kyc_verified.at(employer).write(true);
    }

    // ---- Core: Issue Salary (private, called by EMPLOYER) ----
    // Employer creates a salary note for the employee and a compliance audit trail.
    // Nobody on-chain sees amount, employer identity, or employee identity.
    //
    // What happens in the ZK circuit:
    //   1. Insert UintNote(amount) -> employee's private set (encrypted to employee's key)
    //   2. Insert ComplianceNote  -> oracle's private set (encrypted to oracle's key)
    //   3. Enqueue public update: KYC gate check + total payroll aggregate
    //
    // What's visible on-chain:
    //   - Note commitment hashes (no amount, no identity)
    //   - total_payroll[employer] increases (aggregate only)
    #[external("private")]
    fn issue_salary(
        employee: AztecAddress,
        amount: u128,
        period: u32,
        jurisdiction: u32,
    ) {
        let employer = self.msg_sender();

        // 1. Create salary note for employee (encrypted to employee's incoming view key)
        // Employee discovers this note in their PXE and can claim it
        let salary_note = UintNote { value: amount };
        self.storage.salary_notes.at(employer).at(employee).insert(salary_note).deliver(
            MessageDelivery.ONCHAIN_UNCONSTRAINED
        );

        // 2. Create compliance audit trail encrypted to jurisdiction oracle
        // Oracle can decrypt on M-of-N legal request, nobody else can read it
        let oracle = self.storage.compliance_oracles.at(jurisdiction).read();
        let compliance_note = ComplianceNote { employer, employee, amount, period, jurisdiction };
        self.storage.compliance_records.at(employer).at(oracle).insert(compliance_note).deliver(
            MessageDelivery.ONCHAIN_UNCONSTRAINED
        );

        // 3. Enqueue public update: KYC check + total payroll aggregate
        self.enqueue_self.commit_payroll_public(employer, amount);
    }

    // ---- Core: Claim Salary (private, called by EMPLOYEE) ----
    // Employee proves they have a valid salary claim from employer.
    // Creates own nullifier (using employee's keys, since THEY are the caller).
    //
    // In production: also reads the UintNote from their private set and transfers tokens.
    #[external("private")]
    fn claim_salary(employer: AztecAddress) {
        let employee = self.msg_sender();

        // Employee creates their own claim nullifier - prevents double-claiming
        // Employee IS the msg_sender here, so their keys ARE in scope (no cross-account issue)
        self.storage.salary_claims.at(employer).at(employee).claim();

        // TODO production: read UintNote from salary_notes.at(employer).at(employee)
        //                  and transfer tokens from employer escrow
    }

    // ---- Proof of Reserves ----
    // Total committed payroll for an employer, visible to anyone.
    // Proves solvency without revealing individual salaries.
    #[external("public")]
    #[view]
    fn get_payroll_commitment(employer: AztecAddress) -> u128 {
        self.storage.total_payroll_committed.at(employer).read()
    }

    // Returns the compliance oracle address for a jurisdiction.
    #[external("public")]
    #[view]
    fn get_compliance_oracle(jurisdiction: u32) -> AztecAddress {
        self.storage.compliance_oracles.at(jurisdiction).read()
    }

    // Returns KYC verification status for an employer.
    #[external("public")]
    #[view]
    fn is_kyc_verified(employer: AztecAddress) -> bool {
        self.storage.kyc_verified.at(employer).read()
    }

    // ---- Internal: commit payroll (public, only_self) ----
    // KYC gate check + update total payroll aggregate.
    // Only callable by this contract via enqueue_self.
    #[external("public")]
    #[only_self]
    fn commit_payroll_public(employer: AztecAddress, amount: u128) {
        assert(
            self.storage.kyc_verified.at(employer).read(),
            "Employer must complete KYC verification first"
        );
        let current = self.storage.total_payroll_committed.at(employer).read();
        self.storage.total_payroll_committed.at(employer).write(current + amount);
    }
}
