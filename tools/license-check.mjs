import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const repositoryRoot = resolve(import.meta.dirname, "..");
const lockfile = JSON.parse(readFileSync(resolve(repositoryRoot, "package-lock.json"), "utf8"));
const approvedLicenses = new Set([
  "0BSD",
  "Apache-2.0",
  "Apache-2.0 OR MIT",
  "BSD-2-Clause",
  "BSD-3-Clause",
  "BlueOak-1.0.0",
  "ISC",
  "MIT",
  "MIT OR Apache-2.0",
  "MIT-0",
  "MPL-2.0",
  "Python-2.0"
]);

if (!lockfile.packages || typeof lockfile.packages !== "object") {
  throw new Error("package-lock.json does not contain a packages map.");
}

const dependencies = Object.entries(lockfile.packages).filter(([path]) => path.length > 0);
const findings = [];
for (const [path, metadata] of dependencies) {
  const license = metadata?.license;
  if (typeof license !== "string" || !license.trim()) {
    findings.push(`${path}: missing npm dependency license`);
  } else if (!approvedLicenses.has(license)) {
    findings.push(`${path}: Unapproved npm dependency license ${license}`);
  }
}

if (findings.length > 0) {
  throw new Error(`Npm license check failed:\n${findings.join("\n")}`);
}

console.log(`Npm license check passed for ${dependencies.length} locked packages.`);
