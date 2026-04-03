// ZKCompliance Protocol — Deploy Script
// Deploys PrivatePayroll contract to Aztec Sandbox
//
// Usage: node scripts/deploy.js
// Requires: Aztec Sandbox running on http://localhost:8080

// Polyfill Set.prototype.intersection for Node 20 (added in Node 22 / ES2025)
if (!Set.prototype.intersection) {
  Set.prototype.intersection = function (other) {
    const result = new Set();
    for (const item of this) {
      if (other.has(item)) result.add(item);
    }
    return result;
  };
}
if (!Set.prototype.union) {
  Set.prototype.union = function (other) {
    const result = new Set(this);
    for (const item of other) result.add(item);
    return result;
  };
}
if (!Set.prototype.difference) {
  Set.prototype.difference = function (other) {
    const result = new Set();
    for (const item of this) {
      if (!other.has(item)) result.add(item);
    }
    return result;
  };
}

import { createAztecNodeClient } from "@aztec/aztec.js/node";
import { Contract } from "@aztec/aztec.js/contracts";
import { Fr } from "@aztec/aztec.js/fields";
import { getInitialTestAccountsData } from "@aztec/accounts/testing";
import { EmbeddedWallet } from "@aztec/wallets/embedded";
import { loadContractArtifact } from "@aztec/stdlib/abi";
import { readFileSync, writeFileSync } from "fs";
import { fileURLToPath } from "url";
import { dirname, join } from "path";

const __dirname = dirname(fileURLToPath(import.meta.url));
const SANDBOX_URL = process.env.SANDBOX_URL || "http://localhost:8080";
const ARTIFACT_PATH = join(
  __dirname,
  "../contracts/target/private_payroll-PrivatePayroll.json"
);

async function main() {
  console.log("ZKCompliance Protocol — Deployment");
  console.log("=====================================");
  console.log(`Connecting to sandbox at ${SANDBOX_URL}...`);

  const node = createAztecNodeClient(SANDBOX_URL);
  const nodeInfo = await node.getNodeInfo();
  console.log(`Connected: Aztec v${nodeInfo.nodeVersion}, chain ${nodeInfo.l1ChainId}`);

  // Create embedded wallet (in-process, talks to node via HTTP)
  console.log("\nSetting up wallet...");
  const wallet = await EmbeddedWallet.create(node);

  // Use the 3 pre-deployed test accounts from local network setup
  const [adminData, oracleEuData, oracleUsData] = await getInitialTestAccountsData();

  const adminMgr    = await wallet.createSchnorrAccount(adminData.secret, adminData.salt);
  const euMgr       = await wallet.createSchnorrAccount(oracleEuData.secret, oracleEuData.salt);
  const usMgr       = await wallet.createSchnorrAccount(oracleUsData.secret, oracleUsData.salt);

  // Create 4th account (SG oracle) from scratch
  const sgSecret = Fr.random();
  const sgSalt   = Fr.random();
  const sgMgr    = await wallet.createSchnorrAccount(sgSecret, sgSalt);

  const adminAddress    = adminMgr.address;
  const euOracleAddress = euMgr.address;
  const usOracleAddress = usMgr.address;
  const sgOracleAddress = sgMgr.address;

  console.log(`Admin:     ${adminAddress}`);
  console.log(`EU Oracle: ${euOracleAddress}`);
  console.log(`US Oracle: ${usOracleAddress}`);
  console.log(`SG Oracle: ${sgOracleAddress}`);

  // Load contract artifact
  console.log("\nLoading contract artifact...");
  const rawArtifact = JSON.parse(readFileSync(ARTIFACT_PATH, "utf-8"));
  const artifact = loadContractArtifact(rawArtifact);
  console.log(`Artifact: ${artifact.name}`);

  // Deploy contract — send() waits for inclusion by default
  console.log("\nDeploying PrivatePayroll contract...");
  const { contract } = await Contract.deploy(
    wallet,
    artifact,
    [adminAddress, euOracleAddress, usOracleAddress, sgOracleAddress]
  ).send({ from: adminAddress });

  const contractAddress = contract.address;
  console.log(`\nContract deployed at: ${contractAddress}`);

  // Verify deployment — read-only view calls
  console.log("\nVerifying deployment...");
  const { result: euOracle } = await contract.methods
    .get_compliance_oracle(1)
    .simulate({ from: adminAddress });
  const { result: usOracle } = await contract.methods
    .get_compliance_oracle(2)
    .simulate({ from: adminAddress });
  const { result: sgOracle } = await contract.methods
    .get_compliance_oracle(3)
    .simulate({ from: adminAddress });
  const { result: adminKyc } = await contract.methods
    .is_kyc_verified(adminAddress)
    .simulate({ from: adminAddress });

  console.log(`EU Oracle match: ${euOracle.toString() === euOracleAddress.toString()}`);
  console.log(`US Oracle match: ${usOracle.toString() === usOracleAddress.toString()}`);
  console.log(`SG Oracle match: ${sgOracle.toString() === sgOracleAddress.toString()}`);
  console.log(`Admin KYC:       ${adminKyc}`);

  // Save deployment info
  const deployInfo = {
    network: SANDBOX_URL,
    contractAddress: contractAddress.toString(),
    adminAddress: adminAddress.toString(),
    euOracleAddress: euOracleAddress.toString(),
    usOracleAddress: usOracleAddress.toString(),
    sgOracleAddress: sgOracleAddress.toString(),
    deployedAt: new Date().toISOString(),
  };

  writeFileSync(
    join(__dirname, "../deployment.json"),
    JSON.stringify(deployInfo, null, 2)
  );

  console.log("\n=====================================");
  console.log("Deployment successful!");
  console.log(`Contract address: ${contractAddress}`);
  console.log("Saved to: deployment.json");
}

main().catch((err) => {
  console.error("Deployment failed:", err);
  process.exit(1);
});
