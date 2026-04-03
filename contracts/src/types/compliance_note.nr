use aztec::{macros::notes::note, protocol::{address::AztecAddress, traits::Packable}};

/// ComplianceNote - encrypted audit trail per payroll transaction.
///
/// Created during every `issue_salary` call and encrypted to the
/// jurisdiction compliance oracle's key. Nobody else can read it.
///
/// Decryption flow (MiCA / FinCEN / MAS audit):
///   1. Court order / regulatory request arrives
///   2. M-of-N oracle multisig approves decryption request
///   3. Oracle decrypts notes for employer + period
///   4. Regulator sees: employer, employee, amount, period, jurisdiction
///
/// On-chain: only the note commitment hash is visible (no content, no identity).
#[derive(Eq, Packable)]
#[note]
pub struct ComplianceNote {
    /// Employer who issued the salary payment
    pub employer: AztecAddress,
    /// Employee who received the payment
    pub employee: AztecAddress,
    /// Payment amount (in token base units)
    pub amount: u128,
    /// Payroll period identifier (unix timestamp of period start)
    pub period: u32,
    /// Jurisdiction ID: 1=EU(MiCA), 2=US(FinCEN), 3=SG(MAS)
    pub jurisdiction: u32,
}
