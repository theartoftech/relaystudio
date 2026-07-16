import { invoke } from "@tauri-apps/api/core";
import type { HttpVersionPreference, KeyValueRow, ProjectEnvironment, ProjectService, ProjectSettings, ProjectVariable, ResponseFormatDetection } from "../project/projectModel";
import { redactRecord, redactValue } from "../lib/redaction";
import { AppError, normalizeAppError } from "../lib/appError";
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
  multipartParts: MultipartPart[] | null;
  timeoutMs: number;
  httpVersion: HttpVersionPreference;
  sslCertificateVerification: boolean;
  sslTlsKeyLog: boolean;
  disableCookies: boolean;
  responseFormatDetection: ResponseFormatDetection;
  maxResponseTimeMs: number;
  proxy: ProjectSettings["proxy"];
}

export interface MultipartPart {
  name: string;
  value: string;
  kind: "text" | "file";
  contentType: string | null;
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
  typedError: AppError | null;
  validationIssues: ValidationIssue[];
}

export type HttpTransport = (request: ExecutableRequest, signal?: AbortSignal) => Promise<TransportResponse>;

export interface ServiceRunOptions {
  signal?: AbortSignal;
}

export async function runServiceRequest(
  service: ProjectService,
  environment: ProjectEnvironment,
  transport: HttpTransport = defaultHttpTransport,
  settings?: ProjectSettings,
  options: ServiceRunOptions = {}
): Promise<ServiceRunResult> {
  const events = createEventRecorder();
  events.push("prepare", "info", `Preparing request: ${service.method} ${service.path}`);

  const validationIssues = validateService(service, environment);
  const blockingIssues = validationIssues.filter((issue) => issue.severity === "error");
  if (blockingIssues.length) {
    const message = blockingIssues.map((issue) => issue.message).join(" ");
    events.push("error", "error", message);
    return {
      request: null,
      response: null,
      events: events.items,
      error: message,
      typedError: new AppError("validation", "REQUEST_VALIDATION_FAILED", message),
      validationIssues
    };
  }

  try {
    events.push("resolveVariables", "info", "Resolving environment variables and auth.");
    const request = buildExecutableRequest(service, environment, settings);
    events.push("openConnection", "info", `Opening connection to ${extractOrigin(request.url)}.`);
    events.push("sendRequest", "info", `Sending request (${request.method}) with ${Object.keys(request.headers).length} header(s).`);

    let transportResponse: TransportResponse;
    for (let attempt = 0; ; attempt += 1) {
      try {
        if (options.signal?.aborted) {
          throw new DOMException("Cancelled", "AbortError");
        }
        transportResponse = options.signal
          ? await transport(request, options.signal)
          : await transport(request);
        break;
      } catch (error) {
        const typedError = normalizeAppError(error, options.signal?.aborted ? "cancelled" : undefined);
        if (typedError.retryable && attempt < service.retry.attempts && !options.signal?.aborted) {
          events.push("openConnection", "info", `Retrying request after ${typedError.category} failure (${attempt + 1} of ${service.retry.attempts}).`);
          await waitForRetry(service.retry.backoffMs, options.signal);
          continue;
        }
        events.push("error", "error", typedError.message);
        return { request, response: null, events: events.items, error: typedError.message, typedError, validationIssues };
      }
    }
    events.push("receiveResponse", transportResponse.status >= 400 ? "error" : "info", `Received response (${transportResponse.status} ${transportResponse.statusText}) in ${transportResponse.durationMs} ms.`);
    if (request.maxResponseTimeMs > 0 && transportResponse.durationMs > request.maxResponseTimeMs) {
      events.push("error", "error", `Response exceeded the ${request.maxResponseTimeMs} ms maximum response time.`);
    }
    events.push("parseResponse", "info", "Parsing response body.");

    const response = normalizeResponse(service, transportResponse, request.responseFormatDetection);
    if (response.parseError) {
      events.push("error", "error", response.parseError);
    } else if (response.ok) {
      events.push("success", "success", "Request completed successfully.");
    } else {
      events.push("error", "error", `Request completed with HTTP ${response.status}.`);
    }

    const typedError = response.parseError
      ? new AppError("validation", "RESPONSE_PARSE_FAILED", response.parseError)
      : response.ok
        ? null
        : new AppError("http", "HTTP_ERROR", `Request completed with HTTP ${response.status}.`, { status: response.status, retryable: response.status >= 500 });
    return { request, response, events: events.items, error: response.ok && !response.parseError ? null : response.parseError, typedError, validationIssues };
  } catch (error) {
    const typedError = normalizeAppError(error, options.signal?.aborted ? "cancelled" : undefined);
    events.push("error", "error", typedError.message);
    return { request: null, response: null, events: events.items, error: typedError.message, typedError, validationIssues };
  }
}

export function buildExecutableRequest(service: ProjectService, environment: ProjectEnvironment, settings?: ProjectSettings): ExecutableRequest {
  const authHeader = buildRuntimeAuthHeader(service, environment);
  const body = buildRequestBody(service, environment);
  const generatedContentType = service.body.contentType === "application/x-www-form-urlencoded" || service.body.contentType === "multipart/form-data";
  const userHeaders = Object.fromEntries(
    service.headers
      .filter((row) => row.enabled && row.name.trim() && !(generatedContentType && row.name.toLowerCase() === "content-type"))
      .map((row) => [row.name, resolveTemplate(row.value, environment, false)])
  );
  const headers = {
    ...userHeaders,
    ...(body.contentType && !hasHeader(userHeaders, "content-type") ? { "Content-Type": body.contentType } : {}),
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
    body: body.value,
    multipartParts: body.multipartParts,
    timeoutMs: settings?.requestTimeoutMs ?? service.timeoutMs,
    httpVersion: settings?.httpVersion ?? "auto",
    sslCertificateVerification: settings?.sslCertificateVerification ?? true,
    sslTlsKeyLog: settings?.sslTlsKeyLog ?? false,
    disableCookies: settings?.disableCookies ?? false,
    responseFormatDetection: settings?.responseFormatDetection ?? "auto",
    maxResponseTimeMs: settings?.maxResponseTimeMs ?? 60_000,
    proxy: settings?.proxy ?? {
      enabled: false,
      useForHttp: true,
      useForHttps: true,
      serverUrl: "",
      port: 8080,
      basicAuthEnabled: false,
      username: "",
      password: "",
      bypassList: "localhost,127.0.0.1"
    }
  };
}

function buildRequestBody(service: ProjectService, environment: ProjectEnvironment): { value: string | null; contentType: string | null; multipartParts: MultipartPart[] | null } {
  const body = service.body;
  if (body.contentType === "none") return { value: null, contentType: null, multipartParts: null };
  if (body.contentType === "application/json" || body.contentType === "text/plain") {
    return {
      value: body.raw.trim() ? resolveTemplate(body.raw, environment, false) : null,
      contentType: body.contentType,
      multipartParts: null
    };
  }
  const fields = (body.fields ?? []).filter((field) => field.enabled);
  if (fields.some((field) => !field.name.trim())) throw new Error("Enabled form fields require a name.");
  const resolved = fields.map((field) => ({
    name: field.name,
    value: resolveTemplate(field.value, environment, false),
    kind: field.valueType === "file" ? "file" as const : "text" as const,
    contentType: field.contentType?.trim() || null
  }));
  if (body.contentType === "application/x-www-form-urlencoded") {
    if (resolved.some((field) => field.kind === "file")) throw new Error("File fields require a multipart/form-data body.");
    const params = new URLSearchParams();
    resolved.forEach((field) => params.append(field.name, field.value));
    return { value: params.toString() || null, contentType: body.contentType, multipartParts: null };
  }
  if (resolved.some((field) => field.kind === "file")) {
    if (resolved.some((field) => field.kind === "file" && !field.value.trim())) throw new Error("Enabled multipart file fields require a local file path.");
    resolved.forEach((field) => escapeMultipartName(field.name));
    return { value: null, contentType: null, multipartParts: resolved };
  }
  const boundary = `relay-studio-${stableBoundary(resolved.map(({ name, value }) => ({ name, value })))}`;
  const value = resolved.length
    ? `${resolved.map((field) => `--${boundary}\r\nContent-Disposition: form-data; name="${escapeMultipartName(field.name)}"\r\n\r\n${field.value}\r\n`).join("")}--${boundary}--\r\n`
    : null;
  return { value, contentType: `${body.contentType}; boundary=${boundary}`, multipartParts: null };
}

function stableBoundary(fields: Array<{ name: string; value: string }>): string {
  let hash = 2166136261;
  for (const character of JSON.stringify(fields)) {
    hash ^= character.charCodeAt(0);
    hash = Math.imul(hash, 16777619);
  }
  return (hash >>> 0).toString(16).padStart(8, "0");
}

function escapeMultipartName(value: string): string {
  if (/\r|\n/.test(value)) throw new Error("Multipart field names cannot contain line breaks.");
  return value.replace(/\\/g, "\\\\").replace(/"/g, "\\\"");
}

function hasHeader(headers: Record<string, string>, name: string): boolean {
  return Object.keys(headers).some((headerName) => headerName.toLowerCase() === name.toLowerCase());
}

export function normalizeResponse(service: ProjectService, response: TransportResponse, responseFormatDetection: ResponseFormatDetection = "auto"): ExecutedResponse {
  const contentType = findHeader(response.headers, "content-type");
  const parsed = parseResponseBody(response.body, responseFormatDetection === "json" ? "application/json" : contentType);
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

export async function defaultHttpTransport(request: ExecutableRequest, signal?: AbortSignal): Promise<TransportResponse> {
  if ("__TAURI_INTERNALS__" in window) {
    return invoke<TransportResponse>("execute_http_request", { request });
  }
  return fetchHttpTransport(request, signal);
}

export async function fetchHttpTransport(request: ExecutableRequest, signal?: AbortSignal): Promise<TransportResponse> {
  if (request.multipartParts) {
    throw new Error("Multipart file uploads require Relay Studio desktop mode. Open this project in the desktop app to send local files.");
  }
  const controller = new AbortController();
  const started = performance.now();
  const timeout = window.setTimeout(() => controller.abort(), request.timeoutMs);
  const cancel = () => controller.abort();
  signal?.addEventListener("abort", cancel, { once: true });
  try {
    const response = await fetch(request.url, {
      method: request.method,
      headers: request.headers,
    body: request.body,
      signal: controller.signal,
      credentials: request.disableCookies ? "omit" : "same-origin"
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
    signal?.removeEventListener("abort", cancel);
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

async function waitForRetry(backoffMs: number, signal?: AbortSignal): Promise<void> {
  if (backoffMs <= 0) return;
  await new Promise<void>((resolve, reject) => {
    const timeout = window.setTimeout(() => {
      signal?.removeEventListener("abort", cancel);
      resolve();
    }, backoffMs);
    const cancel = () => {
      window.clearTimeout(timeout);
      signal?.removeEventListener("abort", cancel);
      reject(new DOMException("Cancelled", "AbortError"));
    };
    signal?.addEventListener("abort", cancel, { once: true });
  });
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
