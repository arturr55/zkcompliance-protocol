// Server-side only — EmbeddedWallet uses LMDB (Node.js only)
// Polyfill Set methods for Node 20
function polyfillSets() {
  if (!Set.prototype.intersection) {
    (Set.prototype as any).intersection = function (other: Set<unknown>) {
      const result = new Set();
      for (const item of this) if (other.has(item)) result.add(item);
      return result;
    };
  }
  if (!Set.prototype.union) {
    (Set.prototype as any).union = function (other: Set<unknown>) {
      const result = new Set(this);
      for (const item of other) result.add(item);
      return result;
    };
  }
  if (!Set.prototype.difference) {
    (Set.prototype as any).difference = function (other: Set<unknown>) {
      const result = new Set();
      for (const item of this) if (!other.has(item)) result.add(item);
      return result;
    };
  }
}

export const SANDBOX_URL = process.env.AZTEC_SANDBOX_URL ?? "http://localhost:8080";

export async function isSandboxAvailable(): Promise<boolean> {
  try {
    const res = await fetch(SANDBOX_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ jsonrpc: "2.0", method: "aztec_blockNumber", params: [], id: 1 }),
      signal: AbortSignal.timeout(3000),
    });
    return res.ok;
  } catch {
    return false;
  }
}

let _wallet: any = null;
let _contract: any = null;

export async function getSandboxWalletAndContract() {
  polyfillSets();

  if (_wallet && _contract) return { wallet: _wallet, contract: _contract };

  const { createAztecNodeClient } = await import("@aztec/aztec.js/node");
  const { Contract } = await import("@aztec/aztec.js/contracts");
  const { EmbeddedWallet } = await import("@aztec/wallets/embedded");
  const { getInitialTestAccountsData } = await import("@aztec/accounts/testing");
  const { loadContractArtifact } = await import("@aztec/stdlib/abi");
  const { readFileSync } = await import("fs");
  const { join } = await import("path");

  const node = createAztecNodeClient(SANDBOX_URL);
  const wallet = await EmbeddedWallet.create(node);

  const [adminData] = await getInitialTestAccountsData();
  const adminMgr = await wallet.createSchnorrAccount(adminData.secret, adminData.salt);
  const adminAddress = adminMgr.address;

  const artifactPath = join(
    process.cwd(),
    "../contracts/target/private_payroll-PrivatePayroll.json"
  );
  const rawArtifact = JSON.parse(readFileSync(artifactPath, "utf-8"));
  const artifact = loadContractArtifact(rawArtifact);

  // Try to load existing deployment address
  let contractAddress: string | null = null;
  try {
    const deploymentPath = join(process.cwd(), "../deployment.json");
    const deployment = JSON.parse(readFileSync(deploymentPath, "utf-8"));
    contractAddress = deployment.contractAddress;
  } catch {
    // No deployment.json — need to deploy first
  }

  if (!contractAddress) {
    throw new Error("No deployment.json found. Run: node scripts/deploy.js");
  }

  const { AztecAddress } = await import("@aztec/aztec.js/addresses");
  const contract = await Contract.at(AztecAddress.fromString(contractAddress), artifact, wallet);

  _wallet = wallet;
  _contract = contract;

  return { wallet, contract, adminAddress };
}
