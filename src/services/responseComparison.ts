import type { ExecutedResponse } from "./serviceRunner";
import { canonicalizeSavedResponseArtifact, type SavedResponseArtifact } from "./savedResponses";
import {
  assertUtf8ByteLimit,
  MAX_COMPARISON_BODY_BYTES,
  MAX_COMPARISON_DIFF_ENTRIES,
  MAX_COMPARISON_JSON_DEPTH,
  MAX_COMPARISON_JSON_NODES,
  MAX_COMPARISON_RAW_LINES
} from "./resourceLimits";

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
  assertUtf8ByteLimit(before.body, MAX_COMPARISON_BODY_BYTES, "Saved response comparison body");
  assertUtf8ByteLimit(after.body, MAX_COMPARISON_BODY_BYTES, "Saved response comparison body");
  before = canonicalizeSavedResponseArtifact(before);
  after = canonicalizeSavedResponseArtifact(after);
  const beforeJson = parseJson(before);
  const afterJson = parseJson(after);
  const kind = beforeJson.valid && afterJson.valid ? "json" : "raw";
  const bodyChanges = kind === "json"
    ? compareJson(beforeJson.value, afterJson.value, "$", { count: 0 })
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
  let value: unknown;
  try {
    value = JSON.parse(artifact.body) as unknown;
  } catch {
    return { valid: false, value: undefined };
  }
  validateJsonShape(value);
  return { valid: true, value };
}

function compareJson(before: unknown, after: unknown, path: string, budget: { count: number }): ResponseBodyChange[] {
  budget.count += 1;
  if (budget.count > MAX_COMPARISON_DIFF_ENTRIES) {
    throw new Error(`Saved response comparison diff output exceeds the safe limit of ${MAX_COMPARISON_DIFF_ENTRIES} entries. Narrow the responses before comparing.`);
  }
  if (Object.is(before, after)) return [{ path, type: "unchanged", before, after }];
  const beforeObject = record(before);
  const afterObject = record(after);
  if (beforeObject && afterObject) {
    const keys = new Set([...Object.keys(beforeObject), ...Object.keys(afterObject)]);
    return [...keys].flatMap((key) => {
      const nextPath = Array.isArray(before) || Array.isArray(after) ? `${path}[${key}]` : `${path}.${key}`;
      if (!(key in beforeObject)) return [{ path: nextPath, type: "added" as const, after: afterObject[key] }];
      if (!(key in afterObject)) return [{ path: nextPath, type: "removed" as const, before: beforeObject[key] }];
      return compareJson(beforeObject[key], afterObject[key], nextPath, budget);
    });
  }
  return [{ path, type: "changed", before, after }];
}

function compareRaw(before: string, after: string): ResponseBodyChange[] {
  const beforeLines = before.split("\n");
  const afterLines = after.split("\n");
  if (Math.max(beforeLines.length, afterLines.length) > MAX_COMPARISON_RAW_LINES) {
    throw new Error(`Saved response comparison diff output exceeds the safe limit of ${MAX_COMPARISON_RAW_LINES} lines. Narrow the responses before comparing.`);
  }
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

function validateJsonShape(value: unknown): void {
  const stack: Array<{ value: unknown; depth: number }> = [{ value, depth: 0 }];
  let nodes = 0;
  while (stack.length) {
    const current = stack.pop() as { value: unknown; depth: number };
    nodes += 1;
    if (nodes > MAX_COMPARISON_JSON_NODES) {
      throw new Error(`Saved response comparison JSON node count exceeds the safe limit of ${MAX_COMPARISON_JSON_NODES}. Narrow the responses before comparing.`);
    }
    if (current.depth > MAX_COMPARISON_JSON_DEPTH) {
      throw new Error(`Saved response comparison JSON depth exceeds the safe limit of ${MAX_COMPARISON_JSON_DEPTH}. Narrow the responses before comparing.`);
    }
    if (Array.isArray(current.value)) {
      current.value.forEach((item) => stack.push({ value: item, depth: current.depth + 1 }));
    } else if (current.value !== null && typeof current.value === "object") {
      const entries = Object.entries(current.value as Record<string, unknown>);
      entries.forEach(([, item]) => stack.push({ value: item, depth: current.depth + 1 }));
    }
  }
}

function record(value: unknown): Record<string, unknown> | undefined {
  if (Array.isArray(value)) return Object.fromEntries(value.map((item, index) => [String(index), item]));
  return value !== null && typeof value === "object" ? value as Record<string, unknown> : undefined;
}
