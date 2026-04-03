# ZKCompliance Protocol — Architecture

## Overview

Privacy-first corporate payment infrastructure built on Aztec Network.
Enables confidential payroll, supplier payments, and treasury management
with built-in regulatory compliance (MiCA, FinCEN, MAS).

## Core Principle: Selective Disclosure

```
                    ┌─────────────────────────────────┐
                    │      ZKCompliance Protocol       │
                    └──────────────┬──────────────────┘
                                   │
          ┌────────────────────────┼────────────────────────┐
          │                        │                        │
    ┌─────▼──────┐         ┌───────▼──────┐        ┌───────▼──────┐
    │  Employee  │         │  Employer    │         │  Regulator   │
    │  sees:     │         │  sees:       │         │  sees:       │
    │  own salary│         │  all payroll │         │  nothing     │
    │  only      │         │  totals      │         │  by default  │
    └────────────┘         └──────────────┘        └──────┬───────┘
                                                           │
                                                    Court order /
                                                    Audit request
                                                           │
                                                    ┌──────▼───────┐
                                                    │  Compliance  │
                                                    │  Oracle      │
                                                    │  (M-of-N)    │
                                                    │  decrypts    │
                                                    └──────────────┘
```

## Modules (Phased Roadmap)

### Phase 1 — MVP (months 1-3)
- **PrivatePayroll**: Confidential salary payments for DAOs and crypto companies
- **ZK-KYC Gate**: Verify employer identity via Privado ID without revealing details
- **ComplianceNote**: Auto-generated encrypted audit trail per transaction
- **ZK Proof-of-Reserves**: Prove total payroll obligations without individual disclosure

### Phase 2 — Growth (months 4-6)
- **ConfidentialSupplier**: B2B payments with hidden contract terms
- **Gnosis Safe Module**: Integration for existing Safe multisig users
- **Multi-jurisdiction Oracle**: Separate viewing keys per regulator (EU/US/SG)
- **Travel Rule ZK-proof**: FATF R.16 compliance via selective disclosure

### Phase 3 — Enterprise (months 7-12)
- **PrivateCapTable**: Hidden investor equity structure
- **AnonymousVoting**: On-chain governance without revealing positions
- **Fireblocks SDK**: Institutional custody integration
- **Regulatory Dashboard**: Auditor portal for authorized disclosure requests

## Transaction Flow: Private Payroll

```
1. SETUP
   Employer → verify_employer_kyc(zkProof from Privado ID)
   Admin    → set_compliance_oracle(jurisdiction=EU, oracle=0x...)

2. PAY EMPLOYEE
   Employer calls set_salary(employee, amount, period, jurisdiction=EU)
   
   Inside ZK circuit (private, off-chain computation):
   ├── Create ValueNote(amount) → encrypted to employee's key
   └── Create ComplianceNote(employer, employee, amount, period)
       └── encrypted to EU compliance oracle key
   
   On-chain (public, visible to everyone):
   └── Nullifier + note commitment (no amount, no identity)
   
   Public state update:
   └── total_payroll[employer] += amount (aggregate only)

3. EMPLOYEE CLAIMS
   Employee calls claim_salary(amount)
   ZK proof: "I have a note with value=amount, signed by employer"
   Result: salary transferred, note nullified (can't claim twice)

4. REGULATOR AUDIT (only on legal request)
   Regulator → Compliance Oracle contract
   Oracle requires M-of-N multisig approval (e.g., 3-of-5 legal board)
   Oracle decrypts ComplianceNotes for requested employer/period
   Regulator sees: employer, employees, amounts, dates
   Nobody else sees anything
```

## Compliance Architecture

### Jurisdictions Supported
| ID | Jurisdiction | Regulation | Key Holder |
|----|-------------|------------|------------|
| 1  | European Union | MiCA, GDPR | EU Compliance Oracle |
| 2  | United States | SEC, FinCEN | US Compliance Oracle |
| 3  | Singapore | MAS PSA | SG Compliance Oracle |
| 4  | Global | FATF R.16 | Multi-jurisdiction Oracle |

### ZK-KYC Integration
- **Provider**: Privado ID (formerly Polygon ID)
- **Flow**: Identity provider issues W3C Verifiable Credential → user generates ZK proof → contract verifies proof without seeing raw data
- **What's proven**: "This address belongs to a KYC-verified entity in jurisdiction X"
- **What's hidden**: Name, passport number, date of birth, address

### Compliance Oracle (M-of-N Multisig)
```
Oracle Contract:
├── Holds viewing keys per jurisdiction (encrypted)
├── Requires M-of-N signatures to decrypt (e.g., 3-of-5)
├── Logs all decryption requests on-chain (transparency)
├── Time-limited access (e.g., audit window = 30 days)
└── Cannot decrypt proactively — only on request
```

## Security Model

- **Employee privacy**: Salary amount visible only to employee + compliance oracle
- **Employer privacy**: Individual supplier terms hidden from competitors  
- **Regulator access**: Authorized-only, logged, time-limited
- **No backdoor**: Oracle requires M-of-N multisig — no single point of failure
- **Audit trail**: All oracle access requests are public on-chain

## Grant Strategy

Target: **Aztec Foundation Grant** ($10k-$50k range)
- Aztec actively funds ecosystem projects
- This is a flagship use case (enterprise + compliance)
- Deliverable: working MVP + documentation = strong grant application

Secondary: **MiCA compliance tooling grants** from EU Blockchain Observatory

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Privacy L2 | Aztec Network |
| Contract language | Noir (via aztec-nargo) |
| Identity | Privado ID |
| Frontend | Next.js + aztec.js |
| Testing | Aztec Sandbox (Docker) |
| Deployment | Aztec Testnet → Mainnet |
