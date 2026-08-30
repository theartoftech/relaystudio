import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";

interface BundleConfiguration {
  active?: boolean;
  targets?: string | string[];
  category?: string;
  shortDescription?: string;
  longDescription?: string;
  createUpdaterArtifacts?: boolean;
}

interface TauriConfiguration {
  productName?: string;
  version?: string;
  identifier?: string;
  bundle?: BundleConfiguration;
}

function readRepositoryFile(path: string): string {
  return readFileSync(resolve(process.cwd(), path), "utf8");
}

function readJsonFile<T>(path: string): T {
  return JSON.parse(readRepositoryFile(path)) as T;
}

describe("Sprint 14 cross-platform packaging", () => {
  it("defines complete beta bundle metadata", () => {
    const config = readJsonFile<TauriConfiguration>("src-tauri/tauri.conf.json");

    expect(config).toMatchObject({
      productName: "Relay Studio",
      identifier: "studio.relay.desktop",
      bundle: {
        active: true,
        targets: "all",
        category: "DeveloperTool",
        shortDescription: expect.stringContaining("REST"),
        longDescription: expect.stringContaining("flow"),
        createUpdaterArtifacts: false
      }
    });
    expect(config.version).toBe("0.1.0");
  });

  it("builds and retains native installers on macOS, Windows, and Linux", () => {
    const workflow = readRepositoryFile(".github/workflows/package-beta.yml");

    for (const runner of ["macos-latest", "windows-latest", "ubuntu-22.04"]) {
      expect(workflow).toContain(runner);
    }
    for (const bundle of ["dmg", "nsis", "msi", "deb", "appimage"]) {
      expect(workflow.toLowerCase()).toContain(bundle);
    }
    expect(workflow).toContain("npm run verify");
    expect(workflow).toContain("cargo test --manifest-path src-tauri/Cargo.toml");
    expect(workflow).toContain("npm run tauri build");
    expect(workflow).toContain("actions/upload-artifact");
    expect(workflow).toContain("if-no-files-found: error");
  });

  it("packages distinct Apple Silicon and Intel macOS installers", () => {
    const workflow = readRepositoryFile(".github/workflows/package-beta.yml");

    expect(workflow).toContain("name: macOS Apple Silicon");
    expect(workflow).toContain("os: macos-latest");
    expect(workflow).toContain("expected_arch: arm64");
    expect(workflow).toContain("artifact: relay-studio-macos-arm64-beta");
    expect(workflow).toContain("name: macOS Intel");
    expect(workflow).toContain("os: macos-15-intel");
    expect(workflow).toContain("expected_arch: x86_64");
    expect(workflow).toContain("artifact: relay-studio-macos-x86_64-beta");
    expect(workflow).toContain("name: Verify macOS package architecture");
    expect(workflow).toContain('grep "${{ matrix.expected_arch }}"');
  });

  it("blocks beta packaging until configured live REST acceptance passes", () => {
    const workflow = readRepositoryFile(".github/workflows/package-beta.yml");

    expect(workflow).toContain("live-rest:");
    expect(workflow).toContain("RELAY_LIVE_REST_CONFIG_B64");
    expect(workflow).toContain("npm run test:live-rest");
    expect(workflow).toContain("needs: live-rest");
    expect(workflow).toContain("Live REST configuration is required before beta packaging.");
  });

  it("documents platform validation and signing decisions", () => {
    const manualPath = resolve(
      process.cwd(),
      "documentation/word/Relay-Studio-Security-Platform-and-Release-Manual.docx"
    );
    const traceability = readJsonFile<{
      entries?: Array<{ source?: string; action?: string; destination?: string }>;
    }>("documentation/documentation-traceability.json");

    expect(existsSync(manualPath)).toBe(true);
    for (const historicalSource of [
      "documentation/sprint-14-platform-validation.md",
      "documentation/sprint-14-beta-release-notes.md"
    ]) {
      expect(traceability.entries).toContainEqual({
        source: historicalSource,
        action: "consolidate-remove",
        destination: "documentation/word/Relay-Studio-Security-Platform-and-Release-Manual.docx"
      });
    }
  });

  it("bundles an offline help file and exposes it through the native Help menu", () => {
    const helpFile = readJsonFile<{ title?: string; sections?: unknown[] }>("src/help/relay-studio-help.json");
    const rustShell = readRepositoryFile("src-tauri/src/lib.rs");

    expect(helpFile.title).toBe("Relay Studio Help");
    expect(helpFile.sections?.length).toBeGreaterThan(5);
    expect(rustShell).toContain("MENU_APP_OPEN_HELP");
    expect(rustShell).toContain('"Relay Studio Help"');
  });

  it("exposes OpenAPI import from the native File menu", () => {
    const rustShell = readRepositoryFile("src-tauri/src/lib.rs");

    expect(rustShell).toContain("MENU_APP_OPEN_IMPORT");
    expect(rustShell).toContain('"Import API Definition..."');
    expect(rustShell).toContain("file_menu_builder");
  });
});
