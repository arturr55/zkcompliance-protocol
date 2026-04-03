// Server-side only — EmbeddedWallet uses LMDB, not browser compatible
import { readFileSync } from "fs";
import { join } from "path";

export const SANDBOX_URL = process.env.AZTEC_SANDBOX_URL ?? "http://localhost:8080";

export const PAYROLL_ARTIFACT_PATH = join(
  process.cwd(),
  "../contracts/target/private_payroll-PrivatePayroll.json"
);

export const ORACLE_ARTIFACT_PATH = join(
  process.cwd(),
  "../oracle/target/compliance_oracle-ComplianceOracle.json"
);

export function loadRawArtifact(path: string) {
  return JSON.parse(readFileSync(path, "utf-8"));
}
