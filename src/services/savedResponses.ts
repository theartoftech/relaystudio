import type { SavedResponseMetadata } from "../project/projectModel";
import { redactJsonValue, redactText, redactUrl } from "../lib/redaction";
import type { ExecutableRequest, ExecutedResponse } from "./serviceRunner";
import { parseResponseBody } from "./serviceRunner";
import type { ProjectService } from "../project/projectModel";

export const SAVED_RESPONSE_FORMAT = "relay-studio-response";
export const SAVED_RESPONSE_SCHEMA_VERSION = 1;
export const LARGE_RESPONSE_WARNING_BYTES = 1_000_000;

export interface SavedResponseArtifact {
  format: typeof SAVED_RESPONSE_FORMAT;
  schemaVersion: typeof SAVED_RESPONSE_SCHEMA_VERSION;
  metadata: SavedResponseMetadata;
  body: string;
}

export interface SavedResponseDraft {
  metadata: SavedResponseMetadata;
  artifact: SavedResponseArtifact;
  warning: string | null;
}

export function buildSavedResponseDraft(input: {
  service: ProjectService;
  request: ExecutableRequest;
  response: ExecutedResponse;
  filePath: string;
  capturedAt?: string;
}): SavedResponseDraft {
  assertSavedResponsePath(input.filePath);
  const capturedAt = input.capturedAt ?? new Date().toISOString();
  const redactedBody = redactResponseBody(input.response.rawBody, input.response.contentType);
  const bodyKind = isJsonResponse(redactedBody, input.response.contentType) ? "json" : "raw";
  const metadata: SavedResponseMetadata = {
    id: savedResponseId(input.service.id, capturedAt),
    serviceId: input.service.id,
    serviceName: redactText(input.service.name),
    fileName: fileNameFromPath(input.filePath),
    filePath: input.filePath,
    method: input.request.method,
    url: redactUrl(input.request.url),
    status: input.response.status,
    statusText: redactText(input.response.statusText),
    durationMs: input.response.durationMs,
    contentType: input.response.contentType,
    sizeBytes: redactedBody.length,
    bodyKind,
    redacted: true,
    capturedAt
  };
  const artifact: SavedResponseArtifact = {
    format: SAVED_RESPONSE_FORMAT,
    schemaVersion: SAVED_RESPONSE_SCHEMA_VERSION,
    metadata,
    body: redactedBody
  };

  return {
    metadata,
    artifact,
    warning: responseWarning(metadata)
  };
}

export function artifactToExecutedResponse(artifact: SavedResponseArtifact): ExecutedResponse {
  const canonical = canonicalizeSavedResponseArtifact(artifact);
  const parsed = parseResponseBody(canonical.body, canonical.metadata.contentType);
  return {
    status: canonical.metadata.status,
    statusText: canonical.metadata.statusText,
    headers: {
      "content-type": canonical.metadata.contentType,
      "x-relay-studio-saved-response": canonical.metadata.capturedAt
    },
    body: canonical.body,
    durationMs: canonical.metadata.durationMs,
    ok: canonical.metadata.status >= 200 && canonical.metadata.status < 300,
    contentType: canonical.metadata.contentType,
    prettyBody: parsed.prettyBody,
    rawBody: canonical.body,
    parseError: parsed.parseError,
    capturedVariables: [],
    finalUrl: canonical.metadata.url
  };
}

export function defaultSavedResponsePath(service: ProjectService, response: ExecutedResponse, capturedAt = new Date().toISOString()): string {
  const extension = isJsonResponse(response.rawBody, response.contentType) ? "json" : "txt";
  const timestamp = capturedAt.replace(/[:.]/g, "-");
  return `/private/tmp/${slugify(service.name)}-${timestamp}.${extension}`;
}

export function assertSavedResponsePath(path: string) {
  if (!path.trim()) {
    throw new Error("Saved response path is required.");
  }
  if (!/\.(json|txt)$/i.test(path)) {
    throw new Error("Saved response file must use the .json or .txt extension.");
  }
}

export function validateSavedResponseArtifact(artifact: SavedResponseArtifact) {
  validateSavedResponseStructure(artifact);
  if (artifact.metadata.redacted !== true) throw new Error("Saved response artifact must be redacted before use.");
}

export function canonicalizeSavedResponseArtifact(artifact: SavedResponseArtifact): SavedResponseArtifact {
  validateSavedResponseStructure(artifact);
  const body = redactResponseBody(artifact.body, artifact.metadata.contentType);
  const canonical: SavedResponseArtifact = {
    ...structuredClone(artifact),
    metadata: {
      ...structuredClone(artifact.metadata),
      serviceName: redactText(artifact.metadata.serviceName),
      fileName: redactText(artifact.metadata.fileName),
      url: redactUrl(artifact.metadata.url),
      statusText: redactText(artifact.metadata.statusText),
      sizeBytes: body.length,
      redacted: true
    },
    body
  };
  validateSavedResponseArtifact(canonical);
  return canonical;
}

function validateSavedResponseStructure(artifact: SavedResponseArtifact): void {
  if (!artifact || typeof artifact !== "object") throw new Error("Saved response artifact must be an object.");
  if (artifact.format !== SAVED_RESPONSE_FORMAT) throw new Error("Unsupported saved response file format.");
  if (artifact.schemaVersion !== SAVED_RESPONSE_SCHEMA_VERSION) throw new Error(`Unsupported saved response schema version: ${artifact.schemaVersion}`);
  if (!artifact.metadata || typeof artifact.metadata !== "object") throw new Error("Saved response metadata is required.");
  for (const [field, label] of [
    ["id", "id"], ["serviceId", "service id"], ["serviceName", "service name"], ["fileName", "file name"],
    ["filePath", "file path"], ["url", "URL"], ["statusText", "status text"], ["contentType", "content type"], ["capturedAt", "capture timestamp"]
  ] as const) {
    if (typeof artifact.metadata[field] !== "string" || !artifact.metadata[field].trim()) throw new Error(`Saved response ${label} metadata is required.`);
  }
  assertSavedResponsePath(artifact.metadata.filePath);
  for (const field of ["status", "durationMs", "sizeBytes"] as const) {
    if (typeof artifact.metadata[field] !== "number" || !Number.isFinite(artifact.metadata[field])) throw new Error(`Saved response ${field} metadata must be a finite number.`);
  }
  if (typeof artifact.body !== "string") throw new Error("Saved response body is required.");
}

export function responseWarning(metadata: SavedResponseMetadata): string | null {
  if (metadata.sizeBytes > LARGE_RESPONSE_WARNING_BYTES) {
    return "Large response saved. Reopening may take longer than usual.";
  }
  if (metadata.bodyKind === "raw") {
    return "Non-JSON response saved as raw text.";
  }
  return null;
}

export function redactResponseBody(body: string, contentType: string): string {
  if (!body.trim()) return body;
  if (contentType.toLowerCase().includes("json")) {
    try {
      return JSON.stringify(redactJsonValue(JSON.parse(body)), null, 2);
    } catch {
      return redactText(body);
    }
  }
  return redactText(body);
}

function isJsonResponse(body: string, contentType: string): boolean {
  if (!contentType.toLowerCase().includes("json")) return false;
  if (!body.trim()) return true;
  try {
    JSON.parse(body);
    return true;
  } catch {
    return false;
  }
}

function fileNameFromPath(path: string): string {
  const normalized = path.replace(/\\/g, "/");
  const segments = normalized.split("/");
  return segments[segments.length - 1] || "response.json";
}

function savedResponseId(serviceId: string, capturedAt: string): string {
  return `${serviceId}-response-${capturedAt.replace(/[^a-z0-9]+/gi, "-").replace(/^-|-$/g, "").toLowerCase()}`;
}

function slugify(value: string): string {
  const slug = value.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
  return slug || "response";
}
