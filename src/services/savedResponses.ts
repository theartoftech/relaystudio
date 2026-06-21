import type { SavedResponseMetadata } from "../project/projectModel";
import { isSecretKey, redactValue } from "../lib/redaction";
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
    serviceName: input.service.name,
    fileName: fileNameFromPath(input.filePath),
    filePath: input.filePath,
    method: input.request.method,
    url: input.request.url,
    status: input.response.status,
    statusText: input.response.statusText,
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
  validateSavedResponseArtifact(artifact);
  const parsed = parseResponseBody(artifact.body, artifact.metadata.contentType);
  return {
    status: artifact.metadata.status,
    statusText: artifact.metadata.statusText,
    headers: {
      "content-type": artifact.metadata.contentType,
      "x-relay-studio-saved-response": artifact.metadata.capturedAt
    },
    body: artifact.body,
    durationMs: artifact.metadata.durationMs,
    ok: artifact.metadata.status >= 200 && artifact.metadata.status < 300,
    contentType: artifact.metadata.contentType,
    prettyBody: parsed.prettyBody,
    rawBody: artifact.body,
    parseError: parsed.parseError,
    capturedVariables: []
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
  if (artifact.format !== SAVED_RESPONSE_FORMAT) {
    throw new Error("Unsupported saved response file format.");
  }
  if (artifact.schemaVersion !== SAVED_RESPONSE_SCHEMA_VERSION) {
    throw new Error(`Unsupported saved response schema version: ${artifact.schemaVersion}`);
  }
  assertSavedResponsePath(artifact.metadata.filePath);
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
      return redactRawBody(body);
    }
  }
  return redactRawBody(body);
}

function redactJsonValue(value: unknown): unknown {
  if (Array.isArray(value)) {
    return value.map(redactJsonValue);
  }
  if (value && typeof value === "object") {
    return Object.fromEntries(
      Object.entries(value as Record<string, unknown>).map(([key, nested]) => [
        key,
        isSecretKey(key) ? redactValue(key, String(nested ?? "")) : redactJsonValue(nested)
      ])
    );
  }
  return value;
}

function redactRawBody(body: string): string {
  return body
    .replace(/bearer\s+[a-z0-9._~+/-]+=*/gi, "Bearer ********")
    .replace(/("?(?:accessToken|access_token|token|password|secret|clientSecret)"?\s*[:=]\s*)("[^"]+"|[^\s,}]+)/gi, "$1\"********\"");
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
