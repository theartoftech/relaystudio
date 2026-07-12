import { execFileSync } from "node:child_process";
import { existsSync, lstatSync, readFileSync, readdirSync } from "node:fs";
import { extname, join, relative, resolve } from "node:path";

const repositoryRoot = resolve(import.meta.dirname, "..");
const generatedArtifactRoots = ["dist", "src-tauri/target/release/bundle"];
const maximumTextFileBytes = 5 * 1024 * 1024;
const ignoredExtensions = new Set([
  ".icns", ".ico", ".jpg", ".jpeg", ".png", ".gif", ".pdf", ".woff", ".woff2", ".zip", ".gz"
]);

const signatures = [
  { name: "private key", expression: new RegExp(`-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE ${"KEY"}-----`, "g") },
  { name: "AWS access key", expression: new RegExp(`A${"KIA"}[A-Z0-9]{16}`, "g") },
  { name: "GitHub token", expression: new RegExp(`g${"h"}[pousr]_[A-Za-z0-9]{30,}`, "g") },
  { name: "OpenAI project key", expression: new RegExp(`s${"k-proj-"}[A-Za-z0-9_-]{20,}`, "g") },
  { name: "Slack token", expression: new RegExp(`x${"ox"}[abprs]-[A-Za-z0-9-]{20,}`, "g") }
];

/** @returns {string[]} */
function trackedAndUntrackedFiles() {
  const output = execFileSync("git", ["ls-files", "--cached", "--others", "--exclude-standard", "-z"], {
    cwd: repositoryRoot,
    encoding: "utf8"
  });
  return output.split("\0").filter(Boolean);
}

/** @param {string} root */
function filesUnder(root) {
  const absoluteRoot = resolve(repositoryRoot, root);
  if (!existsSync(absoluteRoot)) return [];
  /** @type {string[]} */
  const files = [];
  /** @param {string} directory */
  function visit(directory) {
    for (const entry of readdirSync(directory, { withFileTypes: true })) {
      const path = join(directory, entry.name);
      if (entry.isDirectory()) visit(path);
      else if (entry.isFile()) files.push(relative(repositoryRoot, path));
    }
  }
  visit(absoluteRoot);
  return files;
}

const candidates = new Set([
  ...trackedAndUntrackedFiles(),
  ...generatedArtifactRoots.flatMap(filesUnder)
]);
/** @type {string[]} */
const findings = [];

for (const candidate of candidates) {
  const absolutePath = resolve(repositoryRoot, candidate);
  if (!existsSync(absolutePath) || !lstatSync(absolutePath).isFile()) continue;
  if (ignoredExtensions.has(extname(candidate).toLowerCase())) continue;
  if (lstatSync(absolutePath).size > maximumTextFileBytes) continue;

  const content = readFileSync(absolutePath, "utf8");
  if (content.includes("\u0000")) continue;
  for (const signature of signatures) {
    signature.expression.lastIndex = 0;
    if (signature.expression.test(content)) findings.push(`${candidate}: ${signature.name}`);
  }
}

if (findings.length > 0) {
  throw new Error(`Secret scan failed:\n${findings.join("\n")}`);
}

console.log(`Secret scan passed for ${candidates.size} repository and generated-artifact files.`);
