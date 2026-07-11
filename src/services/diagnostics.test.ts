import { describe, expect, it } from "vitest";
import { createSampleProject } from "../project/projectModel";
import { createDiagnosticsBundle } from "./diagnostics";

describe("structured diagnostics", () => {
  it("exports useful structured data with a redaction snapshot", () => {
    const project = createSampleProject();
    const bundle = createDiagnosticsBundle({
      appVersion: "0.1.0",
      platform: "macos",
      project,
      events: [
        { sequence: 1, phase: "sendRequest", level: "info", message: "Authorization: Bearer secret-token-value" },
        { sequence: 2, phase: "error", level: "error", message: "password=super-secret" }
      ],
      generatedAt: "2026-07-11T21:00:00.000Z"
    });
    const snapshot = JSON.stringify(bundle);

    expect(bundle).toMatchObject({
      format: "relay-studio-diagnostics",
      schemaVersion: 1,
      appVersion: "0.1.0",
      platform: "macos",
      project: { schemaVersion: 1, serviceCount: 13 }
    });
    expect(snapshot).not.toContain("secret-token-value");
    expect(snapshot).not.toContain("super-secret");
    expect(snapshot).not.toContain("sample-access-token");
    expect(snapshot).toMatchSnapshot();
  });
});
