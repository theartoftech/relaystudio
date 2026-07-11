import { readFileSync } from "fs";
import { resolve } from "path";
import type { HttpMethod, RequestBodyDefinition } from "../../project/projectModel";

export const LIVE_REST_CONFIG_ENV = "RELAY_LIVE_REST_CONFIG";

export interface LiveRestUserCredentials {
  username: string;
  password: string;
}

export interface LiveRestRequestConfig {
  method: HttpMethod;
  path: string;
  auth: "none" | "bearer";
  expectedStatus: number;
  body?: string;
  contentType?: RequestBodyDefinition["contentType"];
  headers?: Array<{ name: string; value: string }>;
  timeoutMs?: number;
}

export interface LiveRestLoginConfig extends LiveRestRequestConfig {
  method: "POST";
  auth: "none";
  body: string;
  contentType: Exclude<RequestBodyDefinition["contentType"], "none">;
  tokenJsonPath: string;
}

export interface LiveRestSuiteConfig {
  baseUrl: string;
  users: {
    admin: LiveRestUserCredentials;
    standard: LiveRestUserCredentials;
    restricted: LiveRestUserCredentials;
  };
  login: LiveRestLoginConfig;
  requests: {
    health: LiveRestRequestConfig;
    currentUser: LiveRestRequestConfig;
    standardRead: LiveRestRequestConfig;
    standardAdminDenied: LiveRestRequestConfig;
    standardSetupWriteDenied: LiveRestRequestConfig;
    restrictedRead: LiveRestRequestConfig;
    restrictedWriteDenied: LiveRestRequestConfig;
    adminAccess: LiveRestRequestConfig;
    adminAudit: LiveRestRequestConfig;
  };
}

export type LiveRestConfigState =
  | { enabled: false; reason: string; configPath: null }
  | { enabled: true; configPath: string; config: LiveRestSuiteConfig };

export function loadOptionalLiveRestConfig(
  env: Record<string, string | undefined> = process.env
): LiveRestConfigState {
  const configuredPath = env[LIVE_REST_CONFIG_ENV]?.trim();
  if (!configuredPath) {
    return {
      enabled: false,
      reason: `Set ${LIVE_REST_CONFIG_ENV} to a local JSON config file to enable live REST acceptance tests.`,
      configPath: null
    };
  }

  const configPath = resolve(configuredPath);
  return {
    enabled: true,
    configPath,
    config: loadLiveRestConfig(configPath)
  };
}

export function loadLiveRestConfig(configPath: string): LiveRestSuiteConfig {
  const resolvedPath = resolve(configPath);
  let raw: string;
  try {
    raw = readFileSync(resolvedPath, "utf8");
  } catch (error) {
    throw new Error(`Live REST config could not be read at ${resolvedPath}. ${error instanceof Error ? error.message : String(error)}`);
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch (error) {
    throw new Error(`Live REST config at ${resolvedPath} is not valid JSON. ${error instanceof Error ? error.message : String(error)}`);
  }

  return parseLiveRestSuiteConfig(parsed, resolvedPath);
}

function parseLiveRestSuiteConfig(value: unknown, sourceLabel: string): LiveRestSuiteConfig {
  const config = expectObject(value, sourceLabel);
  const baseUrl = expectString(config.baseUrl, `${sourceLabel}.baseUrl`);
  assertUrl(baseUrl, `${sourceLabel}.baseUrl`);

  return {
    baseUrl,
    users: {
      admin: parseCredentials(config.users, "admin", sourceLabel),
      standard: parseCredentials(config.users, "standard", sourceLabel),
      restricted: parseCredentials(config.users, "restricted", sourceLabel)
    },
    login: parseLoginConfig(config.login, sourceLabel),
    requests: {
      health: parseRequestConfig(config.requests, "health", sourceLabel),
      currentUser: parseRequestConfig(config.requests, "currentUser", sourceLabel),
      standardRead: parseRequestConfig(config.requests, "standardRead", sourceLabel),
      standardAdminDenied: parseRequestConfig(config.requests, "standardAdminDenied", sourceLabel),
      standardSetupWriteDenied: parseRequestConfig(config.requests, "standardSetupWriteDenied", sourceLabel),
      restrictedRead: parseRequestConfig(config.requests, "restrictedRead", sourceLabel),
      restrictedWriteDenied: parseRequestConfig(config.requests, "restrictedWriteDenied", sourceLabel),
      adminAccess: parseRequestConfig(config.requests, "adminAccess", sourceLabel),
      adminAudit: parseRequestConfig(config.requests, "adminAudit", sourceLabel)
    }
  };
}

function parseCredentials(value: unknown, role: "admin" | "standard" | "restricted", sourceLabel: string): LiveRestUserCredentials {
  const users = expectObject(value, `${sourceLabel}.users`);
  const credentials = expectObject(users[role], `${sourceLabel}.users.${role}`);
  const passwordLabel = `${sourceLabel}.users.${role}.password`;
  const password = expectNonEmptyString(credentials.password, passwordLabel);
  if (password === "replace-with-local-secret") {
    throw new Error(`${passwordLabel} must be replaced with a local secret.`);
  }
  return {
    username: expectNonEmptyString(credentials.username, `${sourceLabel}.users.${role}.username`),
    password
  };
}

function parseLoginConfig(value: unknown, sourceLabel: string): LiveRestLoginConfig {
  const login = expectObject(value, `${sourceLabel}.login`);
  const config = parseRequestConfig({ login }, "login", sourceLabel);
  const tokenJsonPath = expectNonEmptyString(login.tokenJsonPath, `${sourceLabel}.login.tokenJsonPath`);

  if (config.method !== "POST") {
    throw new Error(`${sourceLabel}.login.method must be POST.`);
  }
  if (config.auth !== "none") {
    throw new Error(`${sourceLabel}.login.auth must be none.`);
  }
  if (!config.body) {
    throw new Error(`${sourceLabel}.login.body is required.`);
  }
  if (!config.contentType || config.contentType === "none") {
    throw new Error(`${sourceLabel}.login.contentType must be application/json or text/plain.`);
  }
  if (!config.body.includes("{{username}}") || !config.body.includes("{{password}}")) {
    throw new Error(`${sourceLabel}.login.body must include {{username}} and {{password}} placeholders.`);
  }

  return {
    method: "POST",
    path: config.path,
    auth: "none",
    expectedStatus: config.expectedStatus,
    body: config.body,
    contentType: config.contentType,
    headers: config.headers,
    timeoutMs: config.timeoutMs,
    tokenJsonPath
  };
}

function parseRequestConfig(value: unknown, key: string, sourceLabel: string): LiveRestRequestConfig {
  const requests = expectObject(value, `${sourceLabel}.requests`);
  const request = expectObject(requests[key], `${sourceLabel}.requests.${key}`);
  const body = optionalString(request.body, `${sourceLabel}.requests.${key}.body`);
  const contentType = optionalContentType(request.contentType, `${sourceLabel}.requests.${key}.contentType`);
  if (body && !contentType) {
    throw new Error(`${sourceLabel}.requests.${key}.contentType is required when body is provided.`);
  }
  if (!body && contentType) {
    throw new Error(`${sourceLabel}.requests.${key}.body is required when contentType is provided.`);
  }

  return {
    method: expectHttpMethod(request.method, `${sourceLabel}.requests.${key}.method`),
    path: expectNonEmptyString(request.path, `${sourceLabel}.requests.${key}.path`),
    auth: expectAuthMode(request.auth, `${sourceLabel}.requests.${key}.auth`),
    expectedStatus: expectHttpStatus(request.expectedStatus, `${sourceLabel}.requests.${key}.expectedStatus`),
    body,
    contentType,
    headers: parseHeaders(request.headers, `${sourceLabel}.requests.${key}.headers`),
    timeoutMs: optionalTimeout(request.timeoutMs, `${sourceLabel}.requests.${key}.timeoutMs`)
  };
}

function parseHeaders(value: unknown, label: string): Array<{ name: string; value: string }> {
  if (typeof value === "undefined") {
    return [];
  }
  if (!Array.isArray(value)) {
    throw new Error(`${label} must be an array.`);
  }
  return value.map((header, index) => {
    const row = expectObject(header, `${label}[${index}]`);
    return {
      name: expectNonEmptyString(row.name, `${label}[${index}].name`),
      value: expectString(row.value, `${label}[${index}].value`)
    };
  });
}

function optionalTimeout(value: unknown, label: string): number | undefined {
  if (typeof value === "undefined") {
    return undefined;
  }
  if (typeof value !== "number" || !Number.isInteger(value) || value <= 0) {
    throw new Error(`${label} must be a positive integer.`);
  }
  return value;
}

function optionalContentType(value: unknown, label: string): RequestBodyDefinition["contentType"] | undefined {
  if (typeof value === "undefined") {
    return undefined;
  }
  if (value !== "application/json" && value !== "text/plain" && value !== "none") {
    throw new Error(`${label} must be application/json, text/plain, or none.`);
  }
  return value;
}

function optionalString(value: unknown, label: string): string | undefined {
  if (typeof value === "undefined") {
    return undefined;
  }
  return expectString(value, label);
}

function expectObject(value: unknown, label: string): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new Error(`${label} must be an object.`);
  }
  return value as Record<string, unknown>;
}

function expectString(value: unknown, label: string): string {
  if (typeof value !== "string") {
    throw new Error(`${label} must be a string.`);
  }
  return value;
}

function expectNonEmptyString(value: unknown, label: string): string {
  const text = expectString(value, label).trim();
  if (!text) {
    throw new Error(`${label} must not be empty.`);
  }
  return text;
}

function expectHttpMethod(value: unknown, label: string): HttpMethod {
  if (value !== "GET" && value !== "POST" && value !== "PUT" && value !== "DELETE") {
    throw new Error(`${label} must be GET, POST, PUT, or DELETE.`);
  }
  return value;
}

function expectAuthMode(value: unknown, label: string): "none" | "bearer" {
  if (value !== "none" && value !== "bearer") {
    throw new Error(`${label} must be none or bearer.`);
  }
  return value;
}

function expectHttpStatus(value: unknown, label: string): number {
  if (typeof value !== "number" || !Number.isInteger(value) || value < 100 || value > 599) {
    throw new Error(`${label} must be an integer HTTP status code.`);
  }
  return value;
}

function assertUrl(value: string, label: string) {
  try {
    const url = new URL(value);
    if (url.protocol !== "http:" && url.protocol !== "https:") {
      throw new Error(`${label} must use http or https.`);
    }
  } catch (error) {
    if (error instanceof Error && error.message === `${label} must use http or https.`) {
      throw error;
    }
    throw new Error(`${label} must be a valid absolute URL. ${error instanceof Error ? error.message : String(error)}`);
  }
}
