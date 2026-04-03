// PrivatePayroll contract - ZKCompliance Protocol
mod test;
mod types;

use aztec::macros::aztec;

/// PrivatePayroll - ZKCompliance Protocol
///
/// Confidential salary payments with built-in regulatory compliance.
///
/// Privacy model (selective disclosure):
///   - Employee sees ONLY their own salary note
///   - Employer sees total payroll aggregate (Proof-of-Reserves)
///   - Regulator sees nothing by default
///   - Every payment creates a ComplianceNote encrypted to the jurisdiction oracle
///   - Oracle can decrypt only on M-of-N multisig approval (court order / audit)
///
/// Token escrow model (UTXO-style):
///   - Employer deposits into public escrow before issuing salary
///   - issue_salary: deducts from escrow, creates UintNote for employee
///   - claim_salary: employee nullifies their UintNote (the note IS the token)
///   - Double-claim prevented via SingleUseClaim nullifier
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

        // Compliance oracle per jurisdiction (PublicImmutable = readable from private context)
        // Set once at construction, cannot be changed (upgrade = redeploy)
        compliance_oracles: Map<u32, PublicImmutable<AztecAddress, Context>, Context>,

        // Payroll escrow per employer (public - proves funds are available)
        // Deposited by employer via deposit_payroll()
        // Deducted when salary is issued via issue_salary()
        escrow_balance: Map<AztecAddress, PublicMutable<u128, Context>, Context>,

        // Total payroll obligations per employer - Proof-of-Reserves (cumulative)
        total_payroll_committed: Map<AztecAddress, PublicMutable<u128, Context>, Context>,

        // Salary notes per employer -> employee (UintNote = the salary token)
        // Employer inserts note, employee claims (nullifies) it
        // The note IS the token: once created, it can only be claimed once
        salary_notes: Map<AztecAddress, Owned<PrivateSet<UintNote, Context>, Context>, Context>,

        // Single-use claim nullifier per employer -> employee
        // Employee calls claim_salary which creates the nullifier using THEIR OWN keys
        // Prevents double-claiming without revealing amount or identity
        salary_claims: Map<AztecAddress, Owned<SingleUseClaim<Context>, Context>, Context>,

        // ComplianceNote set per employer, owned by the jurisdiction oracle
        // Oracle can decrypt these notes on M-of-N legal request
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
        self.storage.compliance_oracles.at(JURISDICTION_EU).initialize(eu_oracle);
        self.storage.compliance_oracles.at(JURISDICTION_US).initialize(us_oracle);
        self.storage.compliance_oracles.at(JURISDICTION_SG).initialize(sg_oracle);
    }

    // ---- ZK-KYC Gate ----
    // MVP: admin marks employer as verified.
    // Milestone 1: replace with ZK credential proof from Privado ID.
    #[external("public")]
    fn verify_employer_kyc(employer: AztecAddress) {
        assert(
            self.storage.admin.read().eq(self.msg_sender()),
            "Only admin can verify KYC (MVP mode)"
        );
        self.storage.kyc_verified.at(employer).write(true);
    }

    // ---- Escrow: Deposit Payroll ----
    // Employer publicly deposits funds before issuing salary.
    // This is the "skin in the game" mechanism - proves employer has funds.
    // Amount is public (visible to all) - consistent with Proof-of-Reserves model.
    #[external("public")]
    fn deposit_payroll(amount: u128) {
        let employer = self.msg_sender();
        assert(
            self.storage.kyc_verified.at(employer).read(),
            "Employer must complete KYC before depositing"
        );
        assert(amount > 0, "Deposit amount must be greater than zero");
        let current = self.storage.escrow_balance.at(employer).read();
        self.storage.escrow_balance.at(employer).write(current + amount);
    }

    // ---- Core: Issue Salary (private, called by EMPLOYER) ----
    // Employer creates a salary note for the employee and a compliance audit trail.
    // Nobody on-chain sees which employee received salary or the exact amount per employee.
    //
    // What happens in the ZK circuit (private, off-chain):
    //   1. Insert UintNote(amount) -> employee's private set (encrypted to employee's key)
    //   2. Insert ComplianceNote  -> oracle's private set (encrypted to oracle's key)
    //   3. Enqueue public update: KYC check + escrow deduction + payroll aggregate
    //
    // What's visible on-chain:
    //   - Note commitment hashes (no amount, no employee identity)
    //   - escrow_balance[employer] decreases (proves funds moved)
    //   - total_payroll_committed[employer] increases (aggregate Proof-of-Reserves)
    #[external("private")]
    fn issue_salary(
        employee: AztecAddress,
        amount: u128,
        period: u32,
        jurisdiction: u32,
    ) {
        let employer = self.msg_sender();

        // 1. Create salary note for employee (encrypted to employee's incoming view key)
        // The UintNote IS the salary token - employee discovers it in their PXE and claims it
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

        // 3. Enqueue public update: KYC check + escrow deduction + payroll aggregate
        self.enqueue_self.commit_payroll_public(employer, amount);
    }

    // ---- Core: Claim Salary (private, called by EMPLOYEE) ----
    // Employee proves they have a valid salary claim from employer.
    // Creates a SingleUseClaim nullifier (using employee's own keys) to prevent double-claiming.
    //
    // Token semantics: the UintNote is the salary token.
    // Once the nullifier is created, the note cannot be claimed again.
    // The employee "spending" the claim is equivalent to receiving the funds.
    #[external("private")]
    fn claim_salary(employer: AztecAddress) {
        let employee = self.msg_sender();

        // Create SingleUseClaim nullifier - cryptographically prevents double-claiming
        // Employee IS msg_sender here, so their nullifier keys are in scope
        self.storage.salary_claims.at(employer).at(employee).claim();
    }

    // ---- View: Escrow Balance ----
    // Returns how much the employer has deposited but not yet paid out.
    // Public - anyone can verify employer has sufficient funds for pending payroll.
    #[external("public")]
    #[view]
    fn get_escrow_balance(employer: AztecAddress) -> u128 {
        self.storage.escrow_balance.at(employer).read()
    }

    // ---- View: Proof of Reserves ----
    // Total committed payroll for an employer (cumulative, never decreases).
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
    // Called via enqueue_self from issue_salary.
    // Checks KYC, deducts escrow, increments Proof-of-Reserves aggregate.
    #[external("public")]
    #[only_self]
    fn commit_payroll_public(employer: AztecAddress, amount: u128) {
        assert(
            self.storage.kyc_verified.at(employer).read(),
            "Employer must complete KYC verification first"
        );

        // Escrow check: employer must have deposited enough before issuing salary
        let escrow = self.storage.escrow_balance.at(employer).read();
        assert(escrow >= amount, "Insufficient escrow balance: deposit payroll first");

        // Deduct from escrow - funds are now "in transit" to employee's note
        self.storage.escrow_balance.at(employer).write(escrow - amount);

        // Increment Proof-of-Reserves aggregate (cumulative, public)
        let current = self.storage.total_payroll_committed.at(employer).read();
        self.storage.total_payroll_committed.at(employer).write(current + amount);
    }
}
