import { execFileSync } from "node:child_process";
import { existsSync, lstatSync, readFileSync, readdirSync } from "node:fs";
import { extname, join, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const repositoryRoot = resolve(import.meta.dirname, "..");
const generatedArtifactRoots = ["dist", "src-tauri/target/release/bundle"];
const maximumTextFileBytes = 5 * 1024 * 1024;
const ignoredExtensions = new Set([
  ".icns", ".ico", ".jpg", ".jpeg", ".png", ".gif", ".pdf", ".woff", ".woff2", ".zip", ".gz"
]);

const signatures = [
  { name: "private key", expression: /-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----/g },
  { name: "AWS access key", expression: /AKIA[A-Z0-9]{16}/g },
  { name: "GitHub token", expression: /gh[pousr]_[A-Za-z0-9]{30,}/g },
  { name: "GitHub fine-grained token", expression: /github_pat_[A-Za-z0-9_]{20,}/g },
  { name: "OpenAI project key", expression: /sk-proj-[A-Za-z0-9_-]{20,}/g },
  { name: "Slack token", expression: /xox[abprs]-[A-Za-z0-9-]{20,}/g },
  { name: "credentialed registry URL", expression: /https?:\/\/[^\s/:@]+:[^\s@]+@/g }
];

/** @typedef {{ name: string; expression: RegExp }} SecretSignature */
/** @typedef {{ path: string; reason: string }} ScanLimitation */
/** @typedef {{ findings: string[]; scannedFiles: number; limitations: ScanLimitation[]; candidates: number }} SecretScanReport */

/** @returns {string[]} */
function trackedAndUntrackedFiles() {
  const output = execFileSync("git", ["ls-files", "--cached", "--others", "--exclude-standard", "-z"], {
    cwd: repositoryRoot,
    encoding: "utf8"
  });
  return output.split("\0").filter(Boolean);
}

/** @param {string} root @returns {string[]} */
function filesUnder(root) {
  const absoluteRoot = resolve(root);
  if (!existsSync(absoluteRoot)) return [];
  /** @type {string[]} */
  const files = [];
  /** @param {string} directory */
  function visit(directory) {
    for (const entry of readdirSync(directory, { withFileTypes: true })) {
      const path = join(directory, entry.name);
      if (entry.isDirectory()) visit(path);
      else if (entry.isFile()) files.push(path);
    }
  }
  visit(absoluteRoot);
  return files;
}

/** @param {string} content @param {string} relativePath @returns {string[]} */
function findSignatures(content, relativePath) {
  /** @type {string[]} */
  const findings = [];
  for (const signature of /** @type {SecretSignature[]} */ (signatures)) {
    if (signature.name === "credentialed registry URL" && !/\/(?:package-lock\.json|Cargo\.lock)$/.test(`/${relativePath}`)) continue;
    signature.expression.lastIndex = 0;
    if (signature.expression.test(content)) findings.push(`${relativePath}: ${signature.name}`);
  }
  return findings;
}

/** @param {string} relativePath @returns {boolean} */
function isPackagedSystemLibrary(relativePath) {
  const normalizedPath = relativePath.replaceAll("\\", "/");
  return /(?:^|\/)[^/]+\.AppDir\/usr\/lib(?:\/|$)/.test(normalizedPath);
}

/**
 * Scan explicit repository or generated-artifact files. The explicit input form is used by tests and
 * keeps the scanner deterministic; the CLI supplies the tracked/untracked plus generated candidates.
 * @param {{ root?: string; files: string[] }} input
 * @returns {SecretScanReport}
 */
export function scanFiles(input) {
  const root = resolve(input.root ?? repositoryRoot);
  /** @type {string[]} */
  const findings = [];
  /** @type {ScanLimitation[]} */
  const limitations = [];
  let scannedFiles = 0;

  for (const candidate of input.files) {
    const absolutePath = resolve(root, candidate);
    const relativePath = relative(root, absolutePath) || candidate;
    if (!existsSync(absolutePath) || !lstatSync(absolutePath).isFile()) continue;

    const stat = lstatSync(absolutePath);
    if (stat.size > maximumTextFileBytes) {
      limitations.push({ path: relativePath, reason: `file exceeds ${maximumTextFileBytes} bytes` });
      continue;
    }

    if (isPackagedSystemLibrary(relativePath)) {
      limitations.push({ path: relativePath, reason: "packaged system library is not application secret-scannable" });
      continue;
    }

    const bytes = readFileSync(absolutePath);
    const binaryContent = bytes.toString("latin1");
    const binaryFindings = findSignatures(binaryContent, relativePath);
    findings.push(...binaryFindings);

    if (ignoredExtensions.has(extname(relativePath).toLowerCase())) {
      limitations.push({ path: relativePath, reason: "binary extension is not text-scannable" });
      continue;
    }
    const content = bytes.toString("utf8");
    if (content.includes("\u0000")) {
      limitations.push({ path: relativePath, reason: "binary content is not text-scannable" });
      continue;
    }
    scannedFiles += 1;
    findings.push(...findSignatures(content, relativePath));
  }

  return { findings: [...new Set(findings)], scannedFiles, limitations, candidates: input.files.length };
}

/** @returns {string[]} */
function resolveCandidates() {
  return [
    ...trackedAndUntrackedFiles().map((path) => resolve(repositoryRoot, path)),
    ...generatedArtifactRoots.flatMap((path) => filesUnder(resolve(repositoryRoot, path)))
  ];
}

/** @param {SecretScanReport} report */
function printReport(report) {
  console.log(`Secret scan inspected ${report.scannedFiles} text files out of ${report.candidates} repository and generated-artifact files.`);
  if (report.limitations.length > 0) {
    const counts = new Map();
    for (const limitation of report.limitations) counts.set(limitation.reason, (counts.get(limitation.reason) ?? 0) + 1);
    const summary = [...counts.entries()].map(([reason, count]) => `${count} ${reason}`).join(", ");
    console.log(`Secret scan limitations (${report.limitations.length}; ${summary}).`);
    for (const limitation of report.limitations.slice(0, 20)) console.log(`- ${limitation.path}: ${limitation.reason}`);
    if (report.limitations.length > 20) console.log(`- ... ${report.limitations.length - 20} additional files reported as limitations.`);
  }
}

const isMain = process.argv[1] && resolve(process.argv[1]) === resolve(fileURLToPath(import.meta.url));
if (isMain) {
  const report = scanFiles({ files: resolveCandidates() });
  printReport(report);
  if (report.findings.length > 0) {
    throw new Error(`Secret scan failed:\n${report.findings.join("\n")}`);
  }
}
