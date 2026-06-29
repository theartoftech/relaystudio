import { invoke } from "@tauri-apps/api/core";
import type { KeyValueRow, ProjectEnvironment, ProjectService, ProjectVariable } from "../project/projectModel";
import { redactRecord, redactValue } from "../lib/redaction";
import { buildUrl, resolveTemplate, validateService, type ValidationIssue } from "./serviceDesigner";

export type ConsolePhase =
  | "prepare"
  | "resolveVariables"
  | "openConnection"
  | "sendRequest"
  | "receiveResponse"
  | "parseResponse"
  | "success"
  | "error";

export interface RunnerConsoleEvent {
  sequence: number;
  phase: ConsolePhase;
  level: "info" | "success" | "error";
  message: string;
}

export interface ExecutableRequest {
  method: ProjectService["method"];
  url: string;
  headers: Record<string, string>;
  redactedHeaders: Record<string, string>;
  body: string | null;
  timeoutMs: number;
}

export interface TransportResponse {
  status: number;
  statusText: string;
  headers: Record<string, string>;
  body: string;
  durationMs: number;
}

export interface ExecutedResponse extends TransportResponse {
  ok: boolean;
  contentType: string;
  prettyBody: string;
  rawBody: string;
  parseError: string | null;
  capturedVariables: ProjectVariable[];
}

export interface ServiceRunResult {
  request: ExecutableRequest | null;
  response: ExecutedResponse | null;
  events: RunnerConsoleEvent[];
  error: string | null;
  validationIssues: ValidationIssue[];
}

export type HttpTransport = (request: ExecutableRequest) => Promise<TransportResponse>;

export async function runServiceRequest(
  service: ProjectService,
  environment: ProjectEnvironment,
  transport: HttpTransport = defaultHttpTransport
): Promise<ServiceRunResult> {
  const events = createEventRecorder();
  events.push("prepare", "info", `Preparing request: ${service.method} ${service.path}`);

  const validationIssues = validateService(service, environment);
  const blockingIssues = validationIssues.filter((issue) => issue.severity === "error");
  if (blockingIssues.length) {
    const message = blockingIssues.map((issue) => issue.message).join(" ");
    events.push("error", "error", message);
    return { request: null, response: null, events: events.items, error: message, validationIssues };
  }

  try {
    events.push("resolveVariables", "info", "Resolving environment variables and auth.");
    const request = buildExecutableRequest(service, environment);
    events.push("openConnection", "info", `Opening connection to ${extractOrigin(request.url)}.`);
    events.push("sendRequest", "info", `Sending request (${request.method}) with ${Object.keys(request.headers).length} header(s).`);

    const transportResponse = await transport(request);
    events.push("receiveResponse", transportResponse.status >= 400 ? "error" : "info", `Received response (${transportResponse.status} ${transportResponse.statusText}) in ${transportResponse.durationMs} ms.`);
    events.push("parseResponse", "info", "Parsing response body.");

    const response = normalizeResponse(service, transportResponse);
    if (response.parseError) {
      events.push("error", "error", response.parseError);
    } else if (response.ok) {
      events.push("success", "success", "Request completed successfully.");
    } else {
      events.push("error", "error", `Request completed with HTTP ${response.status}.`);
    }

    return { request, response, events: events.items, error: response.ok && !response.parseError ? null : response.parseError, validationIssues };
  } catch (error) {
    const message = normalizeRunnerError(error);
    events.push("error", "error", message);
    return { request: null, response: null, events: events.items, error: message, validationIssues };
  }
}

export function buildExecutableRequest(service: ProjectService, environment: ProjectEnvironment): ExecutableRequest {
  const authHeader = buildRuntimeAuthHeader(service, environment);
  const userHeaders = Object.fromEntries(
    service.headers
      .filter((row) => row.enabled && row.name.trim())
      .map((row) => [row.name, resolveTemplate(row.value, environment, false)])
  );
  const headers = {
    ...userHeaders,
    ...(authHeader ? { [authHeader.name]: authHeader.value } : {})
  };
  const redactedHeaders = redactRecord(headers);
  if (authHeader) {
    redactedHeaders[authHeader.name] = redactValue("Authorization", authHeader.value);
  }

  assertRuntimeAuth(service, environment, headers);

  return {
    method: service.method,
    url: buildUrl(service, environment),
    headers,
    redactedHeaders,
    body: service.body.contentType !== "none" && service.body.raw.trim()
      ? resolveTemplate(service.body.raw, environment, false)
      : null,
    timeoutMs: service.timeoutMs
  };
}

export function normalizeResponse(service: ProjectService, response: TransportResponse): ExecutedResponse {
  const contentType = findHeader(response.headers, "content-type");
  const parsed = parseResponseBody(response.body, contentType);
  return {
    ...response,
    ok: response.status >= 200 && response.status < 300,
    contentType,
    prettyBody: parsed.prettyBody,
    rawBody: response.body,
    parseError: parsed.parseError,
    capturedVariables: extractCapturedVariables(service, response.body, contentType)
  };
}

export function parseResponseBody(body: string, contentType: string): { prettyBody: string; parseError: string | null } {
  if (!body.trim()) {
    return { prettyBody: "", parseError: null };
  }
  if (!contentType.toLowerCase().includes("json")) {
    return { prettyBody: body, parseError: null };
  }
  try {
    return { prettyBody: JSON.stringify(JSON.parse(body), null, 2), parseError: null };
  } catch {
    return { prettyBody: body, parseError: "Response body is not valid JSON." };
  }
}

export function extractCapturedVariables(service: ProjectService, body: string, contentType: string): ProjectVariable[] {
  if (service.id !== "login" || !contentType.toLowerCase().includes("json")) {
    return [];
  }
  try {
    const parsed = JSON.parse(body) as Record<string, unknown>;
    const token = parsed.accessToken ?? parsed.token ?? parsed.access_token;
    return typeof token === "string" && token
      ? [{ name: "accessToken", value: token, secret: true }]
      : [];
  } catch {
    return [];
  }
}

export async function defaultHttpTransport(request: ExecutableRequest): Promise<TransportResponse> {
  if ("__TAURI_INTERNALS__" in window) {
    return invoke<TransportResponse>("execute_http_request", { request });
  }
  return fetchHttpTransport(request);
}

export async function fetchHttpTransport(request: ExecutableRequest): Promise<TransportResponse> {
  const controller = new AbortController();
  const started = performance.now();
  const timeout = window.setTimeout(() => controller.abort(), request.timeoutMs);
  try {
    const response = await fetch(request.url, {
      method: request.method,
      headers: request.headers,
      body: request.body,
      signal: controller.signal
    });
    const body = await response.text();
    return {
      status: response.status,
      statusText: response.statusText,
      headers: Object.fromEntries(response.headers.entries()),
      body,
      durationMs: Math.round(performance.now() - started)
    };
  } finally {
    window.clearTimeout(timeout);
  }
}

function buildRuntimeAuthHeader(service: ProjectService, environment: ProjectEnvironment): KeyValueRow | null {
  const auth = service.authProfile;
  if (auth.type === "none") return null;
  if (auth.type === "bearer" && auth.tokenVariable) {
    const token = variableValue(environment, auth.tokenVariable);
    return { id: "generated-auth", name: "Authorization", value: `Bearer ${token}`, enabled: true };
  }
  if (auth.type === "apiKey" && auth.apiKeyName && auth.apiKeyValue) {
    return { id: "generated-auth", name: auth.apiKeyName, value: resolveTemplate(auth.apiKeyValue, environment, false), enabled: true };
  }
  if (auth.type === "basic" && auth.usernameVariable && auth.passwordVariable) {
    return {
      id: "generated-auth",
      name: "Authorization",
      value: `Basic ${credentialValue(environment, auth.usernameVariable)}:${credentialValue(environment, auth.passwordVariable)}`,
      enabled: true
    };
  }
  if (auth.type === "oauthClientCredentials") {
    return { id: "generated-auth", name: "Authorization", value: "Bearer {{oauthToken}}", enabled: true };
  }
  if (auth.type === "customHeader" && auth.customHeaderName && auth.customHeaderValue) {
    return { id: "generated-auth", name: auth.customHeaderName, value: resolveTemplate(auth.customHeaderValue, environment, false), enabled: true };
  }
  return null;
}

function assertRuntimeAuth(service: ProjectService, environment: ProjectEnvironment, headers: Record<string, string>) {
  if (service.authProfile.type === "bearer") {
    const tokenVariable = service.authProfile.tokenVariable;
    const token = tokenVariable ? variableValue(environment, tokenVariable) : "";
    if (!token.trim()) {
      throw new Error("Bearer token variable is empty.");
    }
  }
  if (headers.Authorization) {
    headers.Authorization = headers.Authorization.replace(/^Bearer\s+(.+)$/i, (_match, token: string) => {
      if (!token.trim()) throw new Error("Bearer token variable is empty.");
      return `Bearer ${token}`;
    });
  }
}

function extractOrigin(url: string): string {
  try {
    return new URL(url).origin;
  } catch {
    return url;
  }
}

function findHeader(headers: Record<string, string>, name: string): string {
  const entry = Object.entries(headers).find(([key]) => key.toLowerCase() === name.toLowerCase());
  return entry?.[1] ?? "";
}

function variableValue(environment: ProjectEnvironment, name: string): string {
  return environment.variables.find((variable) => variable.name === name)?.value ?? "";
}

function credentialValue(environment: ProjectEnvironment, value: string): string {
  const trimmed = value.trim();
  if (trimmed.includes("{{")) {
    return resolveTemplate(trimmed, environment, false);
  }
  return environment.variables.find((variable) => variable.name === trimmed)?.value ?? trimmed;
}

function normalizeRunnerError(error: unknown): string {
  if (error instanceof DOMException && error.name === "AbortError") {
    return "Request timed out.";
  }
  if (error instanceof Error) {
    return error.message;
  }
  return String(error);
}

function createEventRecorder() {
  const items: RunnerConsoleEvent[] = [];
  return {
    items,
    push(phase: ConsolePhase, level: RunnerConsoleEvent["level"], message: string) {
      items.push({ sequence: items.length + 1, phase, level, message: redactConsoleMessage(message) });
    }
  };
}

function redactConsoleMessage(message: string): string {
  return message.replace(/Bearer\s+[A-Za-z0-9._~+/=-]{8,}/gi, (match) => redactValue("Authorization", match));
}
