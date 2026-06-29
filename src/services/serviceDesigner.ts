import type { AuthMode, HttpMethod, KeyValueRow, ProjectEnvironment, ProjectService } from "../project/projectModel";
import { redactValue } from "../lib/redaction";

export const HTTP_METHODS: HttpMethod[] = ["GET", "POST", "PUT", "DELETE"];
export const AUTH_MODES: AuthMode[] = ["none", "bearer", "apiKey", "basic", "oauthClientCredentials", "customHeader"];

export interface ValidationIssue {
  field: string;
  message: string;
  severity: "error" | "warning";
}

export interface RequestPreview {
  method: HttpMethod;
  url: string;
  headers: KeyValueRow[];
  queryParams: KeyValueRow[];
  pathParams: KeyValueRow[];
  body: string | null;
  generatedAuthHeader: KeyValueRow | null;
  issues: ValidationIssue[];
}

export function createService(partial: Partial<ProjectService> = {}): ProjectService {
  const id = partial.id ?? `service-${Date.now()}`;
  const authType = partial.authProfile?.type ?? "bearer";
  return {
    id,
    folder: partial.folder ?? "Requests",
    name: partial.name ?? "New Request",
    method: partial.method ?? "GET",
    path: partial.path ?? "/api/new-request",
    auth: partial.auth ?? authType,
    timeoutMs: partial.timeoutMs ?? 30_000,
    retry: partial.retry ?? { attempts: 1, backoffMs: 250 },
    headers: partial.headers ?? [{ id: `${id}-accept`, name: "Accept", value: "application/json", enabled: true }],
    queryParams: partial.queryParams ?? [],
    pathParams: partial.pathParams ?? [],
    body: partial.body ?? { contentType: "none", raw: "" },
    authProfile: partial.authProfile ?? { type: authType, tokenVariable: "accessToken" }
  };
}

export function duplicateService(service: ProjectService, existingIds: string[]): ProjectService {
  const id = uniqueId(`${service.id}-copy`, existingIds);
  return {
    ...service,
    id,
    name: `${service.name} Copy`,
    headers: cloneRows(service.headers, id),
    queryParams: cloneRows(service.queryParams, id),
    pathParams: cloneRows(service.pathParams, id)
  };
}

export function renameService(service: ProjectService, name: string): ProjectService {
  return { ...service, name: name.trim() || service.name };
}

export function deleteService(services: ProjectService[], id: string): ProjectService[] {
  return services.filter((service) => service.id !== id);
}

export function reorderService(services: ProjectService[], id: string, direction: "up" | "down"): ProjectService[] {
  const index = services.findIndex((service) => service.id === id);
  if (index < 0) return services;
  const target = direction === "up" ? index - 1 : index + 1;
  if (target < 0 || target >= services.length) return services;
  const next = services.slice();
  const [service] = next.splice(index, 1);
  next.splice(target, 0, service);
  return next;
}

export function upsertRow(rows: KeyValueRow[], row: KeyValueRow): KeyValueRow[] {
  return rows.some((current) => current.id === row.id)
    ? rows.map((current) => (current.id === row.id ? row : current))
    : [...rows, row];
}

export function removeRow(rows: KeyValueRow[], id: string): KeyValueRow[] {
  return rows.filter((row) => row.id !== id);
}

export function validateService(service: ProjectService, environment?: ProjectEnvironment): ValidationIssue[] {
  const issues: ValidationIssue[] = [];

  if (!HTTP_METHODS.includes(service.method)) {
    issues.push({ field: "method", message: "Unsupported HTTP method.", severity: "error" });
  }
  if (!service.name.trim()) {
    issues.push({ field: "name", message: "Request name is required.", severity: "error" });
  }
  if (!service.path.startsWith("/")) {
    issues.push({ field: "path", message: "Path must start with /.", severity: "error" });
  }
  if (service.timeoutMs < 1 || service.timeoutMs > 300_000) {
    issues.push({ field: "timeoutMs", message: "Timeout must be between 1 ms and 300000 ms.", severity: "error" });
  }
  if (service.retry.attempts < 0 || service.retry.attempts > 10) {
    issues.push({ field: "retry.attempts", message: "Retry attempts must be between 0 and 10.", severity: "error" });
  }
  if (service.retry.backoffMs < 0 || service.retry.backoffMs > 60_000) {
    issues.push({ field: "retry.backoffMs", message: "Retry backoff must be between 0 ms and 60000 ms.", severity: "error" });
  }

  issues.push(...validateDuplicateNames("headers", service.headers));
  issues.push(...validateDuplicateNames("queryParams", service.queryParams));
  issues.push(...validatePathParams(service));
  issues.push(...validateBody(service));
  issues.push(...validateAuth(service, environment));
  issues.push(...validateVariables(service, environment));

  return issues;
}

export function buildRequestPreview(service: ProjectService, environment: ProjectEnvironment): RequestPreview {
  const generatedAuthHeader = buildAuthHeader(service, environment);
  const headers = service.headers.filter((row) => row.enabled);
  const queryParams = service.queryParams.filter((row) => row.enabled);
  const pathParams = service.pathParams.filter((row) => row.enabled);
  const body = service.body.contentType !== "none" && service.body.raw.trim() ? service.body.raw : null;

  return {
    method: service.method,
    url: buildUrl(service, environment),
    headers,
    queryParams,
    pathParams,
    body,
    generatedAuthHeader,
    issues: validateService(service, environment)
  };
}

export function buildUrl(service: ProjectService, environment: ProjectEnvironment): string {
  const baseUrl = environment.variables.find((variable) => variable.name === "baseUrl")?.value ?? "";
  const path = applyPathParams(service.path, service.pathParams, environment);
  const query = service.queryParams
    .filter((row) => row.enabled && row.name.trim())
    .map((row) => `${encodeURIComponent(row.name)}=${encodeURIComponent(resolveVariable(row.value, environment, false))}`)
    .join("&");
  return `${baseUrl}${path}${query ? `?${query}` : ""}`;
}

export function resolveTemplate(value: string, environment: ProjectEnvironment, redactSecrets: boolean): string {
  return value.replace(/\{\{\s*([a-zA-Z0-9_.-]+)\s*\}\}/g, (_match, name: string) => {
    const variable = environment.variables.find((item) => item.name === name);
    if (!variable) return `{{${name}}}`;
    return redactSecrets && variable.secret ? redactValue(variable.name, variable.value) : variable.value;
  });
}

export function formatJsonBody(raw: string): string {
  return JSON.stringify(JSON.parse(raw), null, 2);
}

export function minifyJsonBody(raw: string): string {
  return JSON.stringify(JSON.parse(raw));
}

export function findVariableReferences(value: string): string[] {
  const references = new Set<string>();
  for (const match of value.matchAll(/\{\{\s*([a-zA-Z0-9_.-]+)\s*\}\}/g)) {
    references.add(match[1]);
  }
  return Array.from(references);
}

function validateDuplicateNames(field: string, rows: KeyValueRow[]): ValidationIssue[] {
  const issues: ValidationIssue[] = [];
  const seen = new Set<string>();
  for (const row of rows.filter((item) => item.enabled && item.name.trim())) {
    const key = row.name.trim().toLowerCase();
    if (seen.has(key)) {
      issues.push({ field, message: `Duplicate ${field === "headers" ? "header" : "parameter"}: ${row.name}.`, severity: "error" });
    }
    seen.add(key);
  }
  return issues;
}

function validatePathParams(service: ProjectService): ValidationIssue[] {
  const issues: ValidationIssue[] = [];
  const required = Array.from(service.path.matchAll(/\{([a-zA-Z0-9_.-]+)\}/g)).map((match) => match[1]);
  const provided = new Set(service.pathParams.filter((row) => row.enabled && row.value.trim()).map((row) => row.name));
  for (const name of required) {
    if (!provided.has(name)) {
      issues.push({ field: "pathParams", message: `Missing path parameter: ${name}.`, severity: "error" });
    }
  }
  return issues;
}

function validateBody(service: ProjectService): ValidationIssue[] {
  if (service.body.contentType !== "application/json" || !service.body.raw.trim()) {
    return [];
  }
  try {
    JSON.parse(service.body.raw);
    return [];
  } catch {
    return [{ field: "body", message: "Request body is not valid JSON.", severity: "error" }];
  }
}

function validateAuth(service: ProjectService, environment?: ProjectEnvironment): ValidationIssue[] {
  const auth = service.authProfile;
  if (auth.type === "none") return [];

  const variableNames = new Set(environment?.variables.map((variable) => variable.name) ?? []);
  if (auth.type === "bearer" && !hasVariable(auth.tokenVariable, variableNames)) {
    return [{ field: "auth", message: "Bearer auth requires an existing token variable name.", severity: "error" }];
  }
  if (auth.type === "apiKey" && (!auth.apiKeyName?.trim() || !auth.apiKeyValue?.trim())) {
    return [{ field: "auth", message: "API key auth requires a header name and value.", severity: "error" }];
  }
  if (auth.type === "basic" && (!auth.usernameVariable?.trim() || !auth.passwordVariable?.trim())) {
    return [{ field: "auth", message: "Basic auth requires username and password.", severity: "error" }];
  }
  if (auth.type === "oauthClientCredentials" && (!hasVariable(auth.clientIdVariable, variableNames) || !hasVariable(auth.clientSecretVariable, variableNames) || !auth.tokenUrl?.trim())) {
    return [{ field: "auth", message: "OAuth client credentials require client id, client secret, and token URL.", severity: "error" }];
  }
  if (auth.type === "customHeader" && (!auth.customHeaderName?.trim() || !auth.customHeaderValue?.trim())) {
    return [{ field: "auth", message: "Custom header auth requires a header name and value.", severity: "error" }];
  }

  return [];
}

function validateVariables(service: ProjectService, environment?: ProjectEnvironment): ValidationIssue[] {
  const variableNames = new Set(environment?.variables.map((variable) => variable.name) ?? []);
  const values = [
    service.path,
    ...service.headers.map((row) => row.value),
    ...service.queryParams.map((row) => row.value),
    ...service.pathParams.map((row) => row.value),
    service.body.raw
  ];
  return values.flatMap((value) => findVariableReferences(value))
    .filter((name, index, names) => names.indexOf(name) === index)
    .filter((name) => !variableNames.has(name))
    .map((name) => ({ field: "variables", message: `Unknown variable: ${name}.`, severity: "warning" as const }));
}

function buildAuthHeader(service: ProjectService, environment: ProjectEnvironment): KeyValueRow | null {
  const auth = service.authProfile;
  if (auth.type === "none") return null;
  if (auth.type === "bearer" && auth.tokenVariable) {
    return authRow("Authorization", `Bearer ${resolveVariable(`{{${auth.tokenVariable}}}`, environment, true)}`);
  }
  if (auth.type === "apiKey" && auth.apiKeyName && auth.apiKeyValue) {
    return authRow(auth.apiKeyName, resolveVariable(auth.apiKeyValue, environment, true));
  }
  if (auth.type === "basic" && auth.usernameVariable && auth.passwordVariable) {
    const username = resolveCredential(auth.usernameVariable, environment, false, "username");
    const password = resolveCredential(auth.passwordVariable, environment, true, "password");
    return authRow("Authorization", `Basic ${username}:${password}`);
  }
  if (auth.type === "oauthClientCredentials") {
    return authRow("Authorization", "Bearer ********");
  }
  if (auth.type === "customHeader" && auth.customHeaderName && auth.customHeaderValue) {
    return authRow(auth.customHeaderName, resolveVariable(auth.customHeaderValue, environment, true));
  }
  return null;
}

function authRow(name: string, value: string): KeyValueRow {
  return { id: "generated-auth", name, value, enabled: true };
}

function applyPathParams(path: string, params: KeyValueRow[], environment: ProjectEnvironment): string {
  return params.filter((row) => row.enabled).reduce((current, row) => {
    return current.split(`{${row.name}}`).join(encodeURIComponent(resolveTemplate(row.value, environment, false)));
  }, path);
}

function resolveVariable(value: string, environment: ProjectEnvironment, redactSecrets: boolean): string {
  return resolveTemplate(value, environment, redactSecrets);
}

function resolveCredential(value: string, environment: ProjectEnvironment, redactSecrets: boolean, secretKey: string): string {
  const trimmed = value.trim();
  if (trimmed.includes("{{")) {
    return resolveTemplate(trimmed, environment, redactSecrets);
  }
  const variable = environment.variables.find((item) => item.name === trimmed);
  if (!variable) {
    return redactSecrets ? redactValue(secretKey, trimmed) : trimmed;
  }
  return redactSecrets && variable.secret ? redactValue(variable.name, variable.value) : variable.value;
}

function hasVariable(name: string | undefined, variableNames: Set<string>): boolean {
  return Boolean(name?.trim() && variableNames.has(name));
}

function cloneRows(rows: KeyValueRow[], prefix: string): KeyValueRow[] {
  return rows.map((row, index) => ({ ...row, id: `${prefix}-${index}` }));
}

function uniqueId(base: string, existingIds: string[]): string {
  let next = base;
  let counter = 2;
  while (existingIds.includes(next)) {
    next = `${base}-${counter}`;
    counter += 1;
  }
  return next;
}
