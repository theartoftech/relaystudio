import { parse as parseYaml } from "yaml";
import type { AuthProfile, HttpMethod, KeyValueRow, ProjectService } from "../project/projectModel";
import { createService } from "./serviceDesigner";

type JsonObject = Record<string, unknown>;
const methods = ["get", "post", "put", "delete"] as const;

export interface OpenApiOperation {
  id: string;
  label: string;
  method: HttpMethod;
  path: string;
  tag: string;
  deprecated: boolean;
  parameters: JsonObject[];
  requestBody?: JsonObject;
  security?: JsonObject[];
}

export interface ParsedOpenApi {
  title: string;
  version: string;
  definitionUrl: string;
  serverUrl: string;
  operations: OpenApiOperation[];
  securitySchemes: JsonObject;
  globalSecurity: JsonObject[];
  document: JsonObject;
}

export function discoverDefinitionUrl(html: string, pageUrl: string): string {
  const patterns = [
    /\burl\s*:\s*["']([^"']+)["']/i,
    /["']configUrl["']\s*:\s*["']([^"']+)["']/i,
    /\bconfigUrl\s*:\s*["']([^"']+)["']/i
  ];
  for (const pattern of patterns) {
    const match = html.match(pattern);
    if (match?.[1]) return new URL(match[1], pageUrl).toString();
  }
  throw new Error("Swagger UI page does not expose an OpenAPI definition URL. Enter the direct JSON or YAML definition URL.");
}

export function parseOpenApiText(text: string, definitionUrl: string): ParsedOpenApi {
  let value: unknown;
  try {
    value = JSON.parse(text);
  } catch {
    try {
      value = parseYaml(text);
    } catch (error) {
      throw new Error(`OpenAPI definition is not valid JSON or YAML: ${error instanceof Error ? error.message : String(error)}`);
    }
  }
  return parseOpenApiDocument(value, definitionUrl);
}

export function parseOpenApiDocument(value: unknown, definitionUrl: string): ParsedOpenApi {
  const root = object(value, "OpenAPI definition must be an object.");
  const paths = object(root.paths, "OpenAPI definition is missing paths.");
  const operations: OpenApiOperation[] = [];
  for (const [path, pathValue] of Object.entries(paths)) {
    const pathItem = optionalObject(pathValue);
    if (!pathItem || !path.startsWith("/")) continue;
    const commonParameters = arrayOfObjects(pathItem.parameters);
    for (const method of methods) {
      const operation = optionalObject(pathItem[method]);
      if (!operation) continue;
      const operationId = string(operation.operationId) || `${method}-${path}`;
      operations.push({
        id: `${method}:${path}`,
        label: string(operation.summary) || operationId,
        method: method.toUpperCase() as HttpMethod,
        path,
        tag: arrayOfStrings(operation.tags)[0] || "Imported",
        deprecated: operation.deprecated === true,
        parameters: mergeParameters(commonParameters, arrayOfObjects(operation.parameters)),
        requestBody: optionalObject(resolveReference(operation.requestBody, root)),
        security: operation.security === undefined ? undefined : arrayOfObjects(operation.security)
      });
    }
  }
  if (!operations.length) throw new Error("OpenAPI definition contains no supported REST operations (GET, POST, PUT, or DELETE).");
  const info = optionalObject(root.info) ?? {};
  return {
    title: string(info.title) || "Imported API",
    version: string(root.openapi) || string(root.swagger) || "unknown",
    definitionUrl,
    serverUrl: resolveServerUrl(root, definitionUrl),
    operations,
    securitySchemes: optionalObject(optionalObject(root.components)?.securitySchemes) ?? optionalObject(root.securityDefinitions) ?? {},
    globalSecurity: arrayOfObjects(root.security)
    ,document: root
  };
}

export function selectedOperationsToServices(parsed: ParsedOpenApi, selectedIds: string[], existingIds: string[]): ProjectService[] {
  const used = new Set(existingIds);
  return parsed.operations.filter((operation) => selectedIds.includes(operation.id)).map((operation) => {
    const baseId = slug(operation.label || operation.id);
    let id = baseId;
    let suffix = 2;
    while (used.has(id)) id = `${baseId}-${suffix++}`;
    used.add(id);
    const rows = parameterRows(operation.parameters, parsed.document);
    return createService({
      id,
      folder: operation.tag,
      name: operation.label,
      method: operation.method,
      path: operation.path,
      headers: rows.headers,
      queryParams: rows.query,
      pathParams: rows.path,
      body: requestBody(operation.requestBody, parsed.document),
      authProfile: authProfile(operation.security ?? parsed.globalSecurity, parsed.securitySchemes),
      auth: authProfile(operation.security ?? parsed.globalSecurity, parsed.securitySchemes).type
    });
  });
}

export async function loadOpenApiFromUrl(inputUrl: string): Promise<ParsedOpenApi> {
  const url = validatedUrl(inputUrl);
  const first = await fetchText(url);
  const contentType = first.contentType.toLowerCase();
  const looksHtml = contentType.includes("text/html") || /^\s*<!doctype html|^\s*<html/i.test(first.body);
  if (!looksHtml) return parseOpenApiText(first.body, url);
  const definitionUrl = discoverDefinitionUrl(first.body, url);
  const definition = await fetchText(definitionUrl);
  return parseOpenApiText(definition.body, definitionUrl);
}

async function fetchText(url: string): Promise<{ body: string; contentType: string }> {
  if ("__TAURI_INTERNALS__" in window) {
    const { invoke } = await import("@tauri-apps/api/core");
    const response = await invoke<{ status: number; statusText: string; headers: Record<string, string>; body: string }>("execute_http_request", {
      request: { method: "GET", url, headers: { Accept: "application/json, application/yaml, text/yaml, text/html" }, body: null, timeoutMs: 30000 }
    });
    if (response.status < 200 || response.status >= 300) throw new Error(`OpenAPI URL returned HTTP ${response.status} ${response.statusText}.`);
    return { body: response.body, contentType: header(response.headers, "content-type") };
  }
  const response = await fetch(url, { headers: { Accept: "application/json, application/yaml, text/yaml, text/html" } });
  if (!response.ok) throw new Error(`OpenAPI URL returned HTTP ${response.status} ${response.statusText}.`);
  return { body: await response.text(), contentType: response.headers.get("content-type") ?? "" };
}

function parameterRows(parameters: JsonObject[], root: JsonObject): { headers: KeyValueRow[]; query: KeyValueRow[]; path: KeyValueRow[] } {
  const result = { headers: [] as KeyValueRow[], query: [] as KeyValueRow[], path: [] as KeyValueRow[] };
  parameters.forEach((raw, index) => {
    const parameter = optionalObject(resolveReference(raw, root)) ?? raw;
    const location = string(parameter.in);
    const name = string(parameter.name);
    if (!name || !["header", "query", "path"].includes(location)) return;
    const schema = optionalObject(parameter.schema) ?? {};
    const value = exampleValue(parameter.example ?? schema.example ?? schema.default, name);
    const row = { id: `import-${location}-${index}`, name, value, enabled: parameter.required === true || value !== "" };
    if (location === "header" && !["authorization", "content-type", "accept"].includes(name.toLowerCase())) result.headers.push(row);
    if (location === "query") result.query.push(row);
    if (location === "path") result.path.push({ ...row, value, enabled: true });
  });
  return result;
}

function requestBody(body: JsonObject | undefined, root: JsonObject): ProjectService["body"] {
  if (!body) return { contentType: "none", raw: "" };
  const resolved = optionalObject(resolveReference(body, root)) ?? body;
  const content = optionalObject(resolved.content);
  const json = content ? optionalObject(content["application/json"]) : undefined;
  if (!json) return { contentType: "none", raw: "" };
  const schema = optionalObject(resolveReference(json.schema, root));
  const value = json.example ?? schemaExample(schema);
  return { contentType: "application/json", raw: JSON.stringify(value ?? {}, null, 2) };
}

function authProfile(security: JsonObject[], schemes: JsonObject): AuthProfile {
  const name = Object.keys(security[0] ?? {})[0];
  const scheme = name ? optionalObject(schemes[name]) : undefined;
  if (!scheme) return { type: "none" };
  if (string(scheme.type) === "http" && string(scheme.scheme).toLowerCase() === "bearer") return { type: "bearer", tokenVariable: "accessToken" };
  if (string(scheme.type) === "http" && string(scheme.scheme).toLowerCase() === "basic") return { type: "basic", usernameVariable: "username", passwordVariable: "password" };
  if (string(scheme.type) === "basic") return { type: "basic", usernameVariable: "username", passwordVariable: "password" };
  if (string(scheme.type) === "apiKey") return { type: "apiKey", apiKeyName: string(scheme.name) || "X-API-Key", apiKeyValue: "{{apiKey}}" };
  return { type: "none" };
}

function resolveServerUrl(root: JsonObject, definitionUrl: string): string {
  const server = optionalObject(Array.isArray(root.servers) ? root.servers[0] : undefined);
  if (server && string(server.url)) return new URL(string(server.url), definitionUrl).toString().replace(/\/$/, "");
  if (string(root.swagger) === "2.0") return `${string(root.schemes && (root.schemes as unknown[])[0]) || "https"}://${string(root.host)}${string(root.basePath)}`.replace(/\/$/, "");
  return new URL(definitionUrl).origin;
}

function resolveReference(value: unknown, root: JsonObject): unknown {
  const item = optionalObject(value);
  const ref = item && string(item.$ref);
  if (!ref?.startsWith("#/")) return value;
  return ref.slice(2).split("/").reduce<unknown>((current, key) => optionalObject(current)?.[key.replace(/~1/g, "/").replace(/~0/g, "~")], root);
}
function mergeParameters(a: JsonObject[], b: JsonObject[]): JsonObject[] { const map = new Map<string, JsonObject>(); [...a, ...b].forEach((p) => map.set(`${string(p.in)}:${string(p.name)}`, p)); return [...map.values()]; }
function schemaExample(schema: JsonObject | undefined): unknown { if (!schema) return {}; if (schema.example !== undefined) return schema.example; if (string(schema.type) === "array") return [schemaExample(optionalObject(schema.items))]; const properties = optionalObject(schema.properties); if (properties) return Object.fromEntries(Object.entries(properties).map(([key, value]) => [key, schemaExample(optionalObject(value))])); if (schema.default !== undefined) return schema.default; if (Array.isArray(schema.enum)) return schema.enum[0]; if (string(schema.type) === "boolean") return false; if (["integer", "number"].includes(string(schema.type))) return 0; return ""; }
function validatedUrl(value: string): string { const trimmed = value.trim(); if (!trimmed) throw new Error("Swagger UI or OpenAPI URL is required."); const url = new URL(trimmed); if (!["http:", "https:"].includes(url.protocol)) throw new Error("Swagger UI or OpenAPI URL must use HTTP or HTTPS."); return url.toString(); }
function header(headers: Record<string, string>, name: string): string { return Object.entries(headers).find(([key]) => key.toLowerCase() === name)?.[1] ?? ""; }
function object(value: unknown, message: string): JsonObject { const result = optionalObject(value); if (!result) throw new Error(message); return result; }
function optionalObject(value: unknown): JsonObject | undefined { return value !== null && typeof value === "object" && !Array.isArray(value) ? value as JsonObject : undefined; }
function arrayOfObjects(value: unknown): JsonObject[] { return Array.isArray(value) ? value.map(optionalObject).filter((item): item is JsonObject => Boolean(item)) : []; }
function arrayOfStrings(value: unknown): string[] { return Array.isArray(value) ? value.filter((item): item is string => typeof item === "string") : []; }
function string(value: unknown): string { return typeof value === "string" ? value : ""; }
function exampleValue(value: unknown, name: string): string { if (value === undefined || value === null) return ""; return typeof value === "string" ? value : JSON.stringify(value) || `{{${name}}}`; }
function slug(value: string): string { return value.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") || "imported-request"; }
