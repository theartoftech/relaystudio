import { readFileSync } from "node:fs";
import { resolve } from "node:path";

interface PackageManifest {
  scripts?: Record<string, string>;
}

interface TauriConfiguration {
  app?: {
    security?: {
      capabilities?: string[];
      csp?: Record<string, string | string[]> | string | null;
    };
  };
}

function readRepositoryFile(path: string): string {
  return readFileSync(resolve(process.cwd(), path), "utf8");
}

function readJsonFile<T>(path: string): T {
  return JSON.parse(readRepositoryFile(path)) as T;
}

describe("Sprint 13 release gates", () => {
  it("exposes complete local quality and security commands", () => {
    const manifest = readJsonFile<PackageManifest>("package.json");

    expect(manifest.scripts).toMatchObject({
      "check:types": "tsc -b --pretty false",
      "check:rust": expect.stringContaining("clippy"),
      "check:rust-coverage": expect.stringContaining("--fail-under-lines 90"),
      "check:secrets": expect.stringContaining("secret-scan"),
      "check:licenses": expect.stringContaining("license-check"),
      "check:dependencies": expect.stringContaining("audit"),
      "verify:release": expect.stringContaining("check:secrets")
    });
  });

  it("makes every release-blocking gate explicit in CI", () => {
    const workflow = readRepositoryFile(".github/workflows/ci.yml");

    for (const requiredGate of [
      "npm run check:types",
      "npm run lint",
      "npm run test:coverage",
      "npm run test:component",
      "npm run test:e2e",
      "cargo test",
      "cargo clippy",
      "cargo +nightly llvm-cov",
      "npm audit",
      "cargo deny --manifest-path src-tauri/Cargo.toml check",
      "gitleaks"
    ]) {
      expect(workflow).toContain(requiredGate);
    }

    expect(workflow).toContain("--fail-under-lines 90");
    expect(workflow).not.toContain("RELAY_LIVE_REST_CONFIG");
    expect(workflow).not.toContain("npm run test:live-rest");
  });

  it("keeps external live REST validation out of ordinary main validation", () => {
    const workflow = readRepositoryFile(".github/workflows/ci.yml");

    expect(workflow).not.toContain("live-rest:");
    expect(workflow).not.toContain("RELAY_LIVE_REST_CONFIG_B64");
  });

  it("enables a restrictive CSP and selects the reviewed capability", () => {
    const config = readJsonFile<TauriConfiguration>("src-tauri/tauri.conf.json");
    const security = config.app?.security;

    expect(security?.capabilities).toEqual(["default"]);
    expect(security?.csp).toMatchObject({
      "default-src": "'self'",
      "object-src": "'none'",
      "script-src": "'self'",
      "connect-src": expect.stringContaining("https:")
    });
  });

  it("checks dependency advisories, licenses, and repository plus artifact secrets", () => {
    const denyConfig = readRepositoryFile("deny.toml");
    const secretScanner = readRepositoryFile("tools/secret-scan.mjs");
    const licenseChecker = readRepositoryFile("tools/license-check.mjs");

    expect(denyConfig).toContain("[advisories]");
    expect(denyConfig).toContain("[licenses]");
    expect(secretScanner).toContain("src-tauri/target/release/bundle");
    expect(secretScanner).toContain("dist");
    expect(licenseChecker).toContain("package-lock.json");
    expect(licenseChecker).toContain("Unapproved npm dependency license");
  });
});
