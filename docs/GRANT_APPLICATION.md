# Grant Application — Aztec Foundation
## ZKCompliance Protocol: Privacy-First Corporate Payroll & Compliance Infrastructure

**Requested amount:** $30,000 USD  
**Category:** Developer Tooling / Infrastructure  
**Stage:** MVP built, Sandbox deployed, seeking grant to complete Phase 1  
**Contact:** tirionartur@gmail.com  
**Repository:** [your GitHub repo link]

---

## 1. Problem Statement

Every day, thousands of companies pay employees and contractors through traditional banking systems. These payments are fully visible to banks, governments, and anyone with subpoena power — often including competitive intelligence. For crypto-native companies, DAOs, and international teams, this creates three acute problems:

**Problem 1 — Privacy:** A DAO paying 50 contributors reveals salary structure, team size, and compensation philosophy to any on-chain observer. Competitors, future hires, and hostile actors can extract this data freely.

**Problem 2 — Compliance paradox:** Existing privacy tools (Tornado Cash, simple coin mixing) destroy the audit trail entirely — making compliance with MiCA, FinCEN, and FATF regulations impossible. Companies are forced to choose between privacy and legality.

**Problem 3 — No selective disclosure primitive:** There is no production-grade system that allows a company to prove "we paid all employees correctly" to a regulator without revealing which employees, how much, or when — until Aztec.

ZKCompliance solves all three by combining Aztec's programmable privacy with a compliance oracle architecture that enables *selective disclosure on legal request only*.

---

## 2. Solution

ZKCompliance Protocol is a set of Noir smart contracts on Aztec Network that enables:

- **Confidential payroll**: Salary amounts are encrypted to the employee's key. No on-chain amount is ever visible.
- **ZK Proof-of-Reserves**: Employers prove aggregate payroll obligations publicly (e.g., "$500k/month in payroll") without revealing individual salaries — protecting solvency without exposing structure.
- **Compliance notes**: Each payment auto-generates an encrypted ComplianceNote sent to the jurisdiction's oracle. The oracle can only decrypt with M-of-N multisig approval (e.g., 3-of-5 legal board signatures).
- **Multi-jurisdiction support**: EU (MiCA), US (FinCEN), Singapore (MAS PSA) — each jurisdiction has its own oracle with separate viewing keys.

### How it uses Aztec's unique capabilities

| Aztec Primitive | How ZKCompliance uses it |
|----------------|--------------------------|
| Private notes (UintNote) | Salary amount encrypted to employee — invisible to all others |
| Note nullifiers | Prevents double-claiming salary; proves payment happened without revealing details |
| Public state | Aggregate payroll totals — public Proof-of-Reserves |
| PublicImmutable storage | Compliance oracle addresses set at deploy, readable from private context |
| Private → Public enqueue | KYC gate enforced publicly after private transaction executes |
| ComplianceNote (custom) | Encrypted audit trail per payment, stored in oracle's private set |

ZKCompliance would not be possible on any other blockchain. It specifically requires Aztec's hybrid public/private execution model.

---

## 3. Technical Progress

### What is already built (before this grant)

**Smart contract: `PrivatePayroll.nr`**
- Written in Noir, deployed on Aztec Sandbox v4.1.3
- Full implementation of all core functions:
  - `constructor(admin, eu_oracle, us_oracle, sg_oracle)` — public initializer
  - `verify_employer_kyc(employer)` — admin-gated KYC verification
  - `issue_salary(employee, amount, period, jurisdiction)` — **private** — creates UintNote for employee + ComplianceNote for oracle + enqueues public KYC check
  - `claim_salary(employer)` — **private** — employee creates SingleUseClaim nullifier (prevents double-claim)
  - `commit_payroll_public(employer, amount)` — only_self — updates public aggregate
  - View functions: `get_compliance_oracle`, `is_kyc_verified`, `get_payroll_commitment`

**Test suite: 10/10 TXE tests passing**
1. `test_initializer_admin` — admin address stored correctly
2. `test_verify_employer_kyc` — KYC status changes after verification
3. `test_fail_kyc_by_non_admin` — non-admin cannot verify
4. `test_issue_salary_increments_payroll` — payroll aggregate increases
5. `test_issue_salary_twice_accumulates` — two employees sum correctly
6. `test_fail_issue_salary_without_kyc` — issue_salary fails without KYC
7. `test_claim_salary` — employee successfully claims
8. `test_fail_double_claim` — second claim fails (nullifier already used)
9. `test_issue_salary_twice_same_employee_different_periods` — different periods create separate notes
10. `test_get_compliance_oracle` — oracle address returned correctly

**Sandbox deployment (completed today)**
- Aztec Sandbox running locally (Docker, chain 31337)
- Contract deployed: `0x1a0ccaaffc4309a1f923fe5fa8f03e42bdb0af5e92ffaf74307a10182e64c40e`
- All 3 oracle addresses verified on-chain
- Deploy script: `scripts/deploy.js` (reproducible, documented)

---

## 4. Grant Scope — What This Funding Will Build

This grant covers **Phase 1 completion** over 3 months.

### Milestone 1 — ZK-KYC Integration (Month 1) — $8,000

Currently `verify_employer_kyc` is admin-gated (MVP shortcut). This milestone replaces it with real zero-knowledge identity verification:

- Integrate **Privado ID** (formerly Polygon ID) — the leading ZK identity protocol on EVM
- Employer generates a W3C Verifiable Credential proof off-chain
- Contract verifies the ZK proof on-chain without seeing raw identity data
- What's proven: "this address belongs to a KYC-verified legal entity in jurisdiction X"
- What's hidden: company name, registration number, directors, address

**Deliverable:** `verify_employer_kyc_zk(proof, public_inputs)` function + integration tests

### Milestone 2 — Compliance Oracle Contract (Month 2) — $10,000

Currently oracles are simple addresses. This milestone builds the full oracle contract:

- `ComplianceOracle.nr` contract with M-of-N multisig requirement (configurable, e.g. 3-of-5)
- Oracle holds jurisdiction viewing keys encrypted to multisig members
- Decryption request flow: employer/regulator submits request → multisig approves → oracle decrypts specific ComplianceNotes for the requested period
- All decryption requests logged on-chain (transparency)
- Time-limited access windows (e.g., audit window = 30 days)

**Deliverable:** Full `ComplianceOracle.nr` contract + request/approval flow + tests

### Milestone 3 — Token Integration & Escrow (Month 2) — $5,000

Currently `claim_salary` creates the nullifier but does not transfer tokens (TODO in code). This milestone implements actual token movement:

- Integration with Aztec's native token standard
- Employer deposits payroll into escrow before `issue_salary`
- `claim_salary` atomically transfers tokens + nullifies the note
- Private balance management so employer payroll pool is confidential

**Deliverable:** Full end-to-end payroll flow with real token transfers

### Milestone 4 — Aztec Testnet Deploy + Frontend (Month 3) — $7,000

- Deploy contracts to **Aztec public testnet** (alpha/devnet)
- **Next.js frontend** using `aztec.js`:
  - Employer dashboard: KYC verification flow, issue salary, view aggregate payroll
  - Employee dashboard: view pending salary notes, claim salary
  - Compliance oracle dashboard: view pending audit requests, approve/reject
- Wallet integration (Obsidian wallet or custom embedded wallet flow)
- Public demo accessible at a URL

**Deliverable:** Live testnet deployment + public frontend demo + tutorial video

---

## 5. Budget Breakdown

| Milestone | Work | Cost |
|-----------|------|------|
| M1: ZK-KYC | Privado ID integration, Noir circuit, tests | $8,000 |
| M2: Compliance Oracle | M-of-N multisig oracle contract, request flow | $10,000 |
| M3: Token Escrow | Token integration, claim flow with transfers | $5,000 |
| M4: Testnet + Frontend | Deploy + Next.js UI + wallet integration | $7,000 |
| **Total** | | **$30,000** |

---

## 6. Why Aztec Foundation Should Fund This

**Strategic fit:** ZKCompliance is a flagship demonstration of Aztec's core value proposition — privacy with compliance. It is not a DeFi protocol or NFT project; it is infrastructure that enterprises will actually use.

**Ecosystem impact:**
- Demonstrates Aztec to corporate/institutional market (payroll = every company)
- First production-grade compliance tooling on Aztec
- Open-source code becomes reference implementation for privacy + compliance patterns
- Attracts enterprise developers who see compliance as a blocker to adoption

**Technical credibility:** 
- 10/10 tests passing on TXE (the most realistic Aztec test environment)
- Sandbox deployed and verified (not just whitepaper)
- Uses advanced Aztec primitives: private notes, nullifiers, private→public enqueue, PublicImmutable, custom note types

**Market timing:** MiCA regulation went into effect in the EU in 2024. Companies are actively looking for compliant crypto payroll solutions. ZKCompliance is uniquely positioned to be the first privacy-preserving, MiCA-compliant payroll protocol.

---

## 7. Team

**Artur** — Lead Developer  
Full-stack developer with experience in Rust, TypeScript, Python, Flutter. Built and deployed multiple products including a live VPN service (Hiddi VPN, 100+ users). Learned Noir and Aztec from scratch for this project and reached working contract + 10/10 tests in Phase 1.

Currently working full-time on ZKCompliance. No outside funding.

---

## 8. Open Source Commitment

ZKCompliance will be fully open-source (MIT license) upon grant completion. All contracts, tests, deployment scripts, and frontend code will be published on GitHub. The compliance oracle architecture and Privado ID integration patterns will be documented as Aztec ecosystem reference materials.

---

## 9. Roadmap Beyond Phase 1

**Phase 2 (months 4-6):** Confidential supplier payments (B2B), Gnosis Safe module, Travel Rule ZK-proof (FATF R.16)

**Phase 3 (months 7-12):** Private cap table management, anonymous on-chain governance, Fireblocks SDK integration, Regulatory Dashboard

Long-term goal: ZKCompliance becomes the compliance layer for all private finance on Aztec — payroll, B2B payments, and institutional treasury management.

---

## 10. Links

- **Repository:** [GitHub link]
- **Architecture doc:** [link to ARCHITECTURE.md]  
- **Demo video:** [link — to be recorded after testnet deploy]
- **Privacy Policy / Legal:** ZKCompliance is infrastructure. It does not custody funds. Users interact with smart contracts directly.

---

*Application submitted: April 2026*  
*Contact: tirionartur@gmail.com*
