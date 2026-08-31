import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { pathToFileURL } from "node:url";

interface SecretScanReport {
  findings: string[];
  scannedFiles: number;
  limitations: Array<{ path: string; reason: string }>;
}

interface PackageManifest {
  scripts?: Record<string, string>;
}

function normalizeRepositoryText(value: string): string {
  return value.replace(/\r\n?/g, "\n");
}

function readRepositoryFile(path: string): string {
  return normalizeRepositoryText(readFileSync(resolve(process.cwd(), path), "utf8"));
}

describe("Sprint 18E delivery hardening", () => {
  it("normalizes Windows checkout line endings before inspecting workflow structure", () => {
    expect(normalizeRepositoryText("env:\r\n  LIVE_REST_CONFIG_B64: secret\r"))
      .toBe("env:\n  LIVE_REST_CONFIG_B64: secret\n");
  });

  it("keeps protected live REST configuration out of ordinary gates and scoped in beta packaging", () => {
    const ci = readRepositoryFile(".github/workflows/ci.yml");
    const packageBeta = readRepositoryFile(".github/workflows/package-beta.yml");

    expect(ci).not.toContain("LIVE_REST_CONFIG_B64");
    expect(ci).not.toContain("RELAY_LIVE_REST_CONFIG");
    expect(packageBeta).not.toContain("env:\n      LIVE_REST_CONFIG_B64: ${{ secrets.RELAY_LIVE_REST_CONFIG_B64 }}");
    expect(packageBeta).toContain("name: Materialize protected live REST configuration");
    expect(packageBeta).toContain("env:\n          LIVE_REST_CONFIG_B64: ${{ secrets.RELAY_LIVE_REST_CONFIG_B64 }}");
  });

  it("pins first-party artifact actions and scans packaged output", () => {
    const ci = readRepositoryFile(".github/workflows/ci.yml");
    const packageBeta = readRepositoryFile(".github/workflows/package-beta.yml");

    expect(ci).toMatch(/actions\/checkout@[0-9a-f]{40}/);
    expect(packageBeta).toMatch(/actions\/checkout@[0-9a-f]{40}/);
    expect(packageBeta).toMatch(/actions\/upload-artifact@[0-9a-f]{40}/);
    expect(packageBeta).toContain("npm run check:secrets");
  });

  it("runs the documentation artifact validator as a release gate", () => {
    const manifest = JSON.parse(readRepositoryFile("package.json")) as PackageManifest;
    const workflow = readRepositoryFile(".github/workflows/ci.yml");

    expect(manifest.scripts?.["check:documentation"]).toContain("validate_documentation_artifacts.py");
    expect(workflow).toContain("npm run check:documentation");
  });

  it("detects modern token and credentialed registry canaries", async () => {
    const scanner = await import(pathToFileURL(resolve(process.cwd(), "tools/secret-scan.mjs")).href) as {
      scanFiles: (input: { root: string; files: string[] }) => SecretScanReport;
    };
    const root = mkdtempSync(join(tmpdir(), "relay-studio-secret-scan-"));
    try {
      const githubTokenCanary = `github${"_pat_"}0123456789012345678901234567890123456789`;
      const lockfileContents = `https://build-user:registry-password@example.invalid/package.tgz\n${githubTokenCanary}\n`;
      writeFileSync(join(root, "package-lock.json"), lockfileContents);
      writeFileSync(join(root, "Cargo.lock"), lockfileContents);
      const report = scanner.scanFiles({ root, files: ["package-lock.json", "Cargo.lock"] });
      expect(report.findings).toEqual(expect.arrayContaining([
        expect.stringContaining("credentialed registry URL"),
        expect.stringContaining("GitHub fine-grained token")
      ]));
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  it("does not blanket-exclude dependency lockfiles from Gitleaks", () => {
    const gitleaks = readRepositoryFile(".gitleaks.toml");

    expect(gitleaks).not.toContain("package-lock\\.json");
    expect(gitleaks).not.toContain("src-tauri/Cargo\\.lock");
  });

  it("reports skipped binary content instead of silently treating it as clean", async () => {
    const scanner = await import(pathToFileURL(resolve(process.cwd(), "tools/secret-scan.mjs")).href) as {
      scanFiles: (input: { root: string; files: string[] }) => SecretScanReport;
    };
    const root = mkdtempSync(join(tmpdir(), "relay-studio-secret-scan-"));
    try {
      writeFileSync(join(root, "installer.bin"), Buffer.from([0, 1, 2, 3, 4]));
      const report = scanner.scanFiles({ root, files: ["installer.bin"] });
      expect(report.scannedFiles).toBe(0);
      expect(report.limitations).toEqual([
        { path: "installer.bin", reason: "binary content is not text-scannable" }
      ]);
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  it("detects a token embedded in otherwise skipped binary bytes", async () => {
    const scanner = await import(pathToFileURL(resolve(process.cwd(), "tools/secret-scan.mjs")).href) as {
      scanFiles: (input: { root: string; files: string[] }) => SecretScanReport;
    };
    const root = mkdtempSync(join(tmpdir(), "relay-studio-secret-scan-"));
    try {
      const githubTokenCanary = `github${"_pat_"}0123456789012345678901234567890123456789`;
      writeFileSync(join(root, "bundle.bin"), Buffer.concat([Buffer.from([0, 1, 2]), Buffer.from(githubTokenCanary), Buffer.from([3, 4, 5])]));
      const report = scanner.scanFiles({ root, files: ["bundle.bin"] });
      expect(report.findings).toContain("bundle.bin: GitHub fine-grained token");
      expect(report.limitations).toEqual([
        { path: "bundle.bin", reason: "binary content is not text-scannable" }
      ]);
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  it("reports bundled AppImage system libraries without treating their parser strings as secrets", async () => {
    const scanner = await import(pathToFileURL(resolve(process.cwd(), "tools/secret-scan.mjs")).href) as {
      scanFiles: (input: { root: string; files: string[] }) => SecretScanReport;
    };
    const root = mkdtempSync(join(tmpdir(), "relay-studio-secret-scan-"));
    const systemLibrary = "src-tauri/target/release/bundle/appimage/Relay Studio.AppDir/usr/lib/libgnutls.so.30";
    const applicationBinary = "src-tauri/target/release/bundle/appimage/Relay Studio.AppDir/usr/bin/relay-studio";
    const githubTokenCanary = `github${"_pat_"}0123456789012345678901234567890123456789`;
    const privateKeyHeaderCanary = ["-----BEGIN ", "PRIVATE KEY-----"].join("");
    const awsAccessKeyCanary = ["AK", "IA", "0123456789012345"].join("");
    try {
      mkdirSync(join(root, "src-tauri/target/release/bundle/appimage/Relay Studio.AppDir/usr/lib"), { recursive: true });
      mkdirSync(join(root, "src-tauri/target/release/bundle/appimage/Relay Studio.AppDir/usr/bin"), { recursive: true });
      writeFileSync(join(root, systemLibrary), Buffer.concat([
        Buffer.from([0, 1, 2]),
        Buffer.from(privateKeyHeaderCanary),
        Buffer.from(awsAccessKeyCanary),
        Buffer.from([3, 4, 5])
      ]));
      writeFileSync(join(root, applicationBinary), Buffer.concat([
        Buffer.from([0, 1, 2]),
        Buffer.from(githubTokenCanary),
        Buffer.from([3, 4, 5])
      ]));

      const report = scanner.scanFiles({ root, files: [systemLibrary, applicationBinary] });

      expect(report.findings).toEqual([
        `${applicationBinary}: GitHub fine-grained token`
      ]);
      expect(report.limitations).toEqual(expect.arrayContaining([
        { path: systemLibrary, reason: "packaged system library is not application secret-scannable" },
        { path: applicationBinary, reason: "binary content is not text-scannable" }
      ]));
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });
});
