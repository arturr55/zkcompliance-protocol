# ZKCompliance Protocol

Privacy-first corporate payroll & compliance infrastructure on **Aztec Network**.

Zero-knowledge salary payments with built-in regulatory compliance (MiCA, FinCEN, MAS).

**🌐 Live Demo: [zkcompliance-protocol.vercel.app](https://zkcompliance-protocol.vercel.app)**

## What it does

- **Confidential payroll** — salary amounts encrypted to employee's key, invisible to everyone else
- **ZK Proof-of-Reserves** — employer proves aggregate payroll obligations without revealing individual salaries
- **Compliance notes** — auto-generated encrypted audit trail per payment, accessible only to jurisdiction oracle on legal request
- **Multi-jurisdiction** — EU (MiCA), US (FinCEN), Singapore (MAS PSA)

## Architecture

```
Employee sees: own salary only
Employer sees: aggregate totals
Regulator sees: nothing by default
               → audit request + M-of-N oracle approval → full disclosure
```

## Status

- [x] PrivatePayroll contract (Noir) — 14/14 TXE tests passing
- [x] Token Escrow (Milestone 3)
- [x] ComplianceOracle M-of-N contract — 12/12 TXE tests passing
- [x] Aztec Sandbox deployment
- [x] Next.js Frontend demo (Milestone 4) — [live](https://zkcompliance-protocol.vercel.app)
- [ ] ZK-KYC integration (Privado ID) — Milestone 1
- [ ] Aztec public testnet deploy

## Quick Start

### Requirements

- Node.js 20 (via nvm)
- nargo v1.0.0-beta.19
- Docker (for Aztec Sandbox)
- Foundry (anvil)

### Run tests

```bash
# Start TXE server
export NVM_DIR="$HOME/.nvm" && . "$NVM_DIR/nvm.sh" && nvm use 20
nohup txe 8080 > /tmp/txe.log 2>&1 &
sleep 12

# Run tests
cd contracts
export PATH="$HOME/.nargo/bin:$PATH"
nargo test --oracle-resolver http://localhost:8080
```

### Deploy to Sandbox

```bash
# Start Anvil (L1)
anvil --port 8545 --block-time 1 &

# Start Aztec Sandbox
docker run -d --name aztec-sandbox --network host \
  aztecprotocol/aztec:4.1.3 \
  start --local-network --l1-rpc-urls http://127.0.0.1:8545

# Wait ~30s, then deploy
cd /path/to/zkcompliance
npm install
node scripts/deploy.js
```

## Docs

- [Architecture](docs/ARCHITECTURE.md)
- [Grant Application](docs/GRANT_APPLICATION.md)

## License

[Business Source License 1.1](LICENSE) — free for research & evaluation, commercial use requires permission until 2029-04-03, then converts to MIT.

Contact: tirionartur@gmail.com
