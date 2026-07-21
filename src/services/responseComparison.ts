import type { ExecutedResponse } from "./serviceRunner";
import { canonicalizeSavedResponseArtifact, type SavedResponseArtifact } from "./savedResponses";

export type ResponseChangeType = "added" | "removed" | "changed" | "unchanged";

export interface ResponseBodyChange {
  path: string;
  type: ResponseChangeType;
  before?: unknown;
  after?: unknown;
}

export interface ResponseMetadataChange {
  field: "status" | "statusText" | "durationMs" | "contentType" | "sizeBytes";
  before: string | number;
  after: string | number;
}

export interface SavedResponseComparison {
  kind: "json" | "raw";
  beforeFile: string;
  afterFile: string;
  summary: Record<ResponseChangeType, number>;
  metadataChanges: ResponseMetadataChange[];
  bodyChanges: ResponseBodyChange[];
}

export function compareSavedResponses(before: SavedResponseArtifact, after: SavedResponseArtifact): SavedResponseComparison {
  before = canonicalizeSavedResponseArtifact(before);
  after = canonicalizeSavedResponseArtifact(after);
  const beforeJson = parseJson(before);
  const afterJson = parseJson(after);
  const kind = beforeJson.valid && afterJson.valid ? "json" : "raw";
  const bodyChanges = kind === "json"
    ? compareJson(beforeJson.value, afterJson.value, "$")
    : compareRaw(before.body, after.body);
  const summary = bodyChanges.reduce<Record<ResponseChangeType, number>>((counts, change) => ({
    ...counts,
    [change.type]: counts[change.type] + 1
  }), { added: 0, removed: 0, changed: 0, unchanged: 0 });
  return {
    kind,
    beforeFile: before.metadata.fileName,
    afterFile: after.metadata.fileName,
    summary,
    metadataChanges: metadataChanges(before, after),
    bodyChanges: bodyChanges.filter((change) => change.type !== "unchanged" || bodyChanges.length === 1)
  };
}

export function comparisonToExecutedResponse(comparison: SavedResponseComparison): ExecutedResponse {
  const body = JSON.stringify(comparison, null, 2);
  return {
    status: 200,
    statusText: "Comparison",
    headers: { "content-type": "application/json", "x-relay-studio-response-comparison": "redacted" },
    body,
    durationMs: 0,
    ok: true,
    contentType: "application/json",
    prettyBody: body,
    rawBody: body,
    parseError: null,
    capturedVariables: [],
    finalUrl: ""
  };
}

function metadataChanges(before: SavedResponseArtifact, after: SavedResponseArtifact): ResponseMetadataChange[] {
  const fields: ResponseMetadataChange["field"][] = ["status", "statusText", "durationMs", "contentType", "sizeBytes"];
  return fields.flatMap((field) => before.metadata[field] === after.metadata[field] ? [] : [{
    field,
    before: before.metadata[field],
    after: after.metadata[field]
  }]);
}

function parseJson(artifact: SavedResponseArtifact): { valid: boolean; value: unknown } {
  if (!artifact.metadata.contentType.toLowerCase().includes("json")) return { valid: false, value: undefined };
  try {
    return { valid: true, value: JSON.parse(artifact.body) };
  } catch {
    return { valid: false, value: undefined };
  }
}

function compareJson(before: unknown, after: unknown, path: string): ResponseBodyChange[] {
  if (Object.is(before, after)) return [{ path, type: "unchanged", before, after }];
  const beforeObject = record(before);
  const afterObject = record(after);
  if (beforeObject && afterObject) {
    const keys = new Set([...Object.keys(beforeObject), ...Object.keys(afterObject)]);
    return [...keys].flatMap((key) => {
      const nextPath = Array.isArray(before) || Array.isArray(after) ? `${path}[${key}]` : `${path}.${key}`;
      if (!(key in beforeObject)) return [{ path: nextPath, type: "added" as const, after: afterObject[key] }];
      if (!(key in afterObject)) return [{ path: nextPath, type: "removed" as const, before: beforeObject[key] }];
      return compareJson(beforeObject[key], afterObject[key], nextPath);
    });
  }
  return [{ path, type: "changed", before, after }];
}

function compareRaw(before: string, after: string): ResponseBodyChange[] {
  const beforeLines = before.split("\n");
  const afterLines = after.split("\n");
  const length = Math.max(beforeLines.length, afterLines.length);
  return Array.from({ length }, (_, index): ResponseBodyChange => {
    const path = `line ${index + 1}`;
    if (index >= beforeLines.length) return { path, type: "added", after: afterLines[index] };
    if (index >= afterLines.length) return { path, type: "removed", before: beforeLines[index] };
    return beforeLines[index] === afterLines[index]
      ? { path, type: "unchanged", before: beforeLines[index], after: afterLines[index] }
      : { path, type: "changed", before: beforeLines[index], after: afterLines[index] };
  }).filter((change) => change.type !== "unchanged");
}

function record(value: unknown): Record<string, unknown> | undefined {
  if (Array.isArray(value)) return Object.fromEntries(value.map((item, index) => [String(index), item]));
  return value !== null && typeof value === "object" ? value as Record<string, unknown> : undefined;
}
