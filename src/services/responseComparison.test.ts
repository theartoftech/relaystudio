import { compareSavedResponses, comparisonToExecutedResponse } from "./responseComparison";
import type { SavedResponseArtifact } from "./savedResponses";
import { MAX_COMPARISON_BODY_BYTES, MAX_COMPARISON_DIFF_ENTRIES } from "./resourceLimits";

function artifact(id: string, body: string, contentType = "application/json", status = 200): SavedResponseArtifact {
  return {
    format: "relay-studio-response",
    schemaVersion: 1,
    metadata: {
      id,
      serviceId: "users",
      serviceName: "Users",
      fileName: `${id}.json`,
      filePath: `/tmp/${id}.json`,
      method: "GET",
      url: "https://api.test/users",
      status,
      statusText: status === 200 ? "OK" : "Created",
      durationMs: id === "before" ? 20 : 35,
      contentType,
      sizeBytes: body.length,
      bodyKind: contentType.includes("json") ? "json" : "raw",
      redacted: true,
      capturedAt: id === "before" ? "2026-07-14T00:00:00Z" : "2026-07-15T00:00:00Z"
    },
    body
  };
}

describe("saved response comparison", () => {
  it("reports typed JSON additions, removals, changes, and metadata deltas", () => {
    const comparison = compareSavedResponses(
      artifact("before", JSON.stringify({ id: 1, token: "********", removed: true })),
      artifact("after", JSON.stringify({ id: 2, token: "********", added: "yes" }), "application/json", 201)
    );

    expect(comparison.kind).toBe("json");
    expect(comparison.summary).toEqual({ added: 1, removed: 1, changed: 1, unchanged: 1 });
    expect(comparison.bodyChanges).toEqual(expect.arrayContaining([
      expect.objectContaining({ path: "$.id", type: "changed", before: 1, after: 2 }),
      expect.objectContaining({ path: "$.removed", type: "removed" }),
      expect.objectContaining({ path: "$.added", type: "added" })
    ]));
    expect(comparison.metadataChanges.map((change) => change.field)).toEqual(expect.arrayContaining(["status", "durationMs"]));
    expect(JSON.stringify(comparison)).not.toContain("real-secret");
  });

  it("falls back to deterministic raw line comparison and rejects invalid artifacts", () => {
    const comparison = compareSavedResponses(artifact("before", "one\ntwo", "text/plain"), artifact("after", "one\nthree", "text/plain"));
    expect(comparison.kind).toBe("raw");
    expect(comparison.bodyChanges).toEqual([expect.objectContaining({ path: "line 2", type: "changed" })]);
    expect(comparisonToExecutedResponse(comparison).prettyBody).toContain('"kind": "raw"');

    const imported = artifact("after", `{"api_key":"comparison-secret"}`);
    imported.metadata.redacted = false;
    const importedComparison = compareSavedResponses(artifact("before", "{}"), imported);
    expect(JSON.stringify(importedComparison)).not.toContain("comparison-secret");
  });

  it("compares arrays, identical JSON, malformed JSON, and raw added or removed lines", () => {
    const arrays = compareSavedResponses(artifact("before", '[1,2]'), artifact("after", '[1,3,4]'));
    expect(arrays.bodyChanges).toEqual(expect.arrayContaining([
      expect.objectContaining({ path: "$[1]", type: "changed" }),
      expect.objectContaining({ path: "$[2]", type: "added" })
    ]));
    expect(compareSavedResponses(artifact("before", '{"same":true}'), artifact("after", '{"same":true}')).summary.unchanged).toBe(1);
    expect(compareSavedResponses(artifact("before", "{bad"), artifact("after", "{}"))).toMatchObject({ kind: "raw" });
    expect(compareSavedResponses(artifact("before", "one", "text/plain"), artifact("after", "one\ntwo", "text/plain")).bodyChanges[0]).toMatchObject({ type: "added" });
    expect(compareSavedResponses(artifact("before", "one\ntwo", "text/plain"), artifact("after", "one", "text/plain")).bodyChanges[0]).toMatchObject({ type: "removed" });
  });

  it("rejects oversized bodies and diff amplification before comparison", () => {
    const boundary = "x".repeat(MAX_COMPARISON_BODY_BYTES);
    expect(() => compareSavedResponses(artifact("before", boundary, "text/plain"), artifact("after", boundary, "text/plain"))).not.toThrow();
    expect(() => compareSavedResponses(artifact("before", `${boundary}x`, "text/plain"), artifact("after", "ok", "text/plain"))).toThrow("Saved response comparison body exceeds");

    const manyLines = Array.from({ length: MAX_COMPARISON_DIFF_ENTRIES + 1 }, (_, index) => `line-${index}`).join("\n");
    expect(() => compareSavedResponses(artifact("before", manyLines, "text/plain"), artifact("after", "", "text/plain"))).toThrow("diff output exceeds");

    const manyChangesBefore = Object.fromEntries(Array.from({ length: MAX_COMPARISON_DIFF_ENTRIES + 1 }, (_, index) => [`field${index}`, index]));
    const manyChangesAfter = Object.fromEntries(Array.from({ length: MAX_COMPARISON_DIFF_ENTRIES + 1 }, (_, index) => [`field${index}`, index + 1]));
    expect(() => compareSavedResponses(artifact("before", JSON.stringify(manyChangesBefore)), artifact("after", JSON.stringify(manyChangesAfter)))).toThrow("diff output exceeds");
  });

  it("rejects deeply nested JSON before recursive comparison", () => {
    let before = "0";
    let after = "1";
    for (let index = 0; index < 65; index += 1) {
      before = `{"nested":${before}}`;
      after = `{"nested":${after}}`;
    }
    expect(() => compareSavedResponses(artifact("before", before), artifact("after", after))).toThrow("JSON depth exceeds");
  });
});
