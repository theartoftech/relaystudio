import { AppError } from "../lib/appError";
import { isSecretKey, redactJsonValue, redactText, redactUrl, redactValue } from "../lib/redaction";
import {
  createDefaultProjectSettings,
  PROJECT_FORMAT,
  PROJECT_SCHEMA_VERSION,
  type AuthMode,
  type HttpMethod,
  type KeyValueRow,
  type ProjectSettings,
  type RelayProject
} from "./projectModel";

export interface ProjectSchemaIssue {
  path: string;
  message: string;
}

type LegacyProjectSettings = Partial<Omit<ProjectSettings, "proxy">> & {
  proxy?: Partial<ProjectSettings["proxy"]>;
};

const HTTP_METHODS: readonly HttpMethod[] = ["GET", "POST", "PUT", "PATCH", "DELETE", "HEAD", "OPTIONS"];
const AUTH_MODES: readonly AuthMode[] = ["none", "bearer", "apiKey", "basic", "oauthClientCredentials", "customHeader"];
const BODY_TYPES = ["application/json", "text/plain", "application/x-www-form-urlencoded", "multipart/form-data", "none"] as const;

export function validateProjectSchema(value: unknown): ProjectSchemaIssue[] {
  if (!isRecord(value)) return [{ path: "$", message: "Project payload must be an object." }];
  const issues: ProjectSchemaIssue[] = [];
  literal(value.format, PROJECT_FORMAT, "format", issues);
  literal(value.schemaVersion, PROJECT_SCHEMA_VERSION, "schemaVersion", issues);
  requiredString(value.id, "id", issues);
  requiredString(value.name, "name", issues);
  requiredString(value.createdAt, "createdAt", issues);
  requiredString(value.updatedAt, "updatedAt", issues);
  validateArray(value.services, "services", issues, validateService);
  validateArray(value.environments, "environments", issues, validateEnvironment);
  validateArray(value.flows, "flows", issues, validateFlow);
  validateArray(value.savedResponses, "savedResponses", issues, validateSavedResponse);
  validateArray(value.importSources, "importSources", issues, validateImportSource);
  validateSettings(value.settings, "settings", issues);
  return issues;
}

export function parseProjectImport(value: unknown): RelayProject {
  const issues = validateProjectSchema(value);
  if (issues.length) {
    const guidance = "Open the .backup file or create a new project and import supported requests.";
    throw new AppError("schema", "PROJECT_SCHEMA_INVALID", `Project schema is invalid: ${issues.map((issue) => `${issue.path} ${issue.message}`).join(" ")} Recovery: ${guidance}`, {
      guidance
    });
  }
  const project = structuredClone(value) as Omit<RelayProject, "settings"> & { settings: LegacyProjectSettings };
  const defaultEnvironmentId = project.settings.defaultEnvironmentId ?? project.environments[0]?.id ?? "";
  const defaults = createDefaultProjectSettings(defaultEnvironmentId);
  return {
    ...project,
    settings: {
      ...defaults,
      ...project.settings,
      defaultEnvironmentId,
      proxy: {
        ...defaults.proxy,
        ...project.settings.proxy
      }
    }
  };
}

export function prepareProjectForExport(value: unknown): RelayProject {
  const project = parseProjectImport(value);
  const variableNames = new Set(project.environments.flatMap((environment) => environment.variables.map((variable) => variable.name)));
  return {
    ...project,
    environments: project.environments.map((environment) => ({
      ...environment,
      variables: environment.variables.map((variable) => variable.secret || isSecretKey(variable.name) ? { ...variable, value: "", secret: true } : variable)
    })),
    services: project.services.map((service) => ({
      ...service,
      path: redactUrl(service.path),
      headers: service.headers.map(redactProjectRow),
      queryParams: service.queryParams.map(redactProjectRow),
      pathParams: service.pathParams.map(redactProjectRow),
      body: {
        ...service.body,
        raw: redactProjectBody(service.body.raw, service.body.contentType),
        ...(service.body.fields ? { fields: service.body.fields.map(redactProjectRow) } : {})
      },
      authProfile: {
        ...service.authProfile,
        tokenUrl: service.authProfile.tokenUrl ? redactUrl(service.authProfile.tokenUrl) : service.authProfile.tokenUrl,
        apiKeyValue: redactLiteralCredential(service.authProfile.apiKeyValue, variableNames),
        passwordVariable: redactLiteralCredential(service.authProfile.passwordVariable, variableNames),
        clientSecretVariable: redactLiteralCredential(service.authProfile.clientSecretVariable, variableNames),
        customHeaderValue: redactLiteralCredential(service.authProfile.customHeaderValue, variableNames)
      }
    })),
    flows: project.flows.map((flow) => ({
      ...flow,
      mappings: flow.mappings.map((mapping) => ({
        ...mapping,
        secret: mapping.secret || isSecretKey(mapping.variableName) || isSecretKey(mapping.jsonPath)
      }))
    })),
    savedResponses: project.savedResponses.map((response) => ({
      ...response,
      serviceName: redactText(response.serviceName),
      fileName: redactText(response.fileName),
      url: redactUrl(response.url),
      statusText: redactText(response.statusText)
    })),
    importSources: project.importSources.map((source) => ({ ...source, label: redactText(source.label), source: redactUrl(source.source) })),
    settings: {
      ...project.settings,
      proxy: {
        ...project.settings.proxy,
        serverUrl: redactUrl(project.settings.proxy.serverUrl),
        password: ""
      }
    }
  };
}

function validateService(value: unknown, path: string, issues: ProjectSchemaIssue[]): void {
  if (!record(value, path, issues)) return;
  requiredString(value.id, `${path}.id`, issues);
  stringValue(value.folder, `${path}.folder`, issues);
  requiredString(value.name, `${path}.name`, issues);
  enumValue(value.method, HTTP_METHODS, `${path}.method`, issues);
  stringValue(value.path, `${path}.path`, issues);
  enumValue(value.auth, AUTH_MODES, `${path}.auth`, issues);
  numberValue(value.timeoutMs, `${path}.timeoutMs`, issues, 0);
  if (record(value.retry, `${path}.retry`, issues)) {
    numberValue(value.retry.attempts, `${path}.retry.attempts`, issues, 0);
    numberValue(value.retry.backoffMs, `${path}.retry.backoffMs`, issues, 0);
  }
  validateArray(value.headers, `${path}.headers`, issues, validateKeyValueRow);
  validateArray(value.queryParams, `${path}.queryParams`, issues, validateKeyValueRow);
  validateArray(value.pathParams, `${path}.pathParams`, issues, validateKeyValueRow);
  if (record(value.body, `${path}.body`, issues)) {
    enumValue(value.body.contentType, BODY_TYPES, `${path}.body.contentType`, issues);
    stringValue(value.body.raw, `${path}.body.raw`, issues);
    if (value.body.fields !== undefined) validateArray(value.body.fields, `${path}.body.fields`, issues, validateKeyValueRow);
  }
  if (record(value.authProfile, `${path}.authProfile`, issues)) {
    enumValue(value.authProfile.type, AUTH_MODES, `${path}.authProfile.type`, issues);
    for (const key of ["tokenVariable", "apiKeyName", "apiKeyValue", "usernameVariable", "passwordVariable", "clientIdVariable", "clientSecretVariable", "tokenUrl", "customHeaderName", "customHeaderValue"] as const) {
      if (value.authProfile[key] !== undefined) stringValue(value.authProfile[key], `${path}.authProfile.${key}`, issues);
    }
  }
}

function validateKeyValueRow(value: unknown, path: string, issues: ProjectSchemaIssue[]): void {
  if (!record(value, path, issues)) return;
  requiredString(value.id, `${path}.id`, issues);
  stringValue(value.name, `${path}.name`, issues);
  stringValue(value.value, `${path}.value`, issues);
  booleanValue(value.enabled, `${path}.enabled`, issues);
  if (value.valueType !== undefined) enumValue(value.valueType, ["text", "file"] as const, `${path}.valueType`, issues);
  if (value.contentType !== undefined) stringValue(value.contentType, `${path}.contentType`, issues);
}

function validateEnvironment(value: unknown, path: string, issues: ProjectSchemaIssue[]): void {
  if (!record(value, path, issues)) return;
  requiredString(value.id, `${path}.id`, issues);
  requiredString(value.name, `${path}.name`, issues);
  validateArray(value.variables, `${path}.variables`, issues, (variable, variablePath, variableIssues) => {
    if (!record(variable, variablePath, variableIssues)) return;
    requiredString(variable.name, `${variablePath}.name`, variableIssues);
    stringValue(variable.value, `${variablePath}.value`, variableIssues);
    booleanValue(variable.secret, `${variablePath}.secret`, variableIssues);
  });
}

function validateFlow(value: unknown, path: string, issues: ProjectSchemaIssue[]): void {
  if (!record(value, path, issues)) return;
  requiredString(value.id, `${path}.id`, issues);
  requiredString(value.name, `${path}.name`, issues);
  validateArray(value.steps, `${path}.steps`, issues, (step, stepPath, stepIssues) => stringValue(step, stepPath, stepIssues));
  validateArray(value.nodes, `${path}.nodes`, issues, (node, nodePath, nodeIssues) => {
    if (!record(node, nodePath, nodeIssues)) return;
    requiredString(node.id, `${nodePath}.id`, nodeIssues);
    requiredString(node.serviceId, `${nodePath}.serviceId`, nodeIssues);
    requiredString(node.label, `${nodePath}.label`, nodeIssues);
    if (record(node.position, `${nodePath}.position`, nodeIssues)) {
      numberValue(node.position.x, `${nodePath}.position.x`, nodeIssues);
      numberValue(node.position.y, `${nodePath}.position.y`, nodeIssues);
    }
    enumValue(node.status, ["idle", "running", "success", "failed", "skipped", "blocked", "cancelled"] as const, `${nodePath}.status`, nodeIssues);
  });
  validateArray(value.edges, `${path}.edges`, issues, (edge, edgePath, edgeIssues) => {
    if (!record(edge, edgePath, edgeIssues)) return;
    requiredString(edge.id, `${edgePath}.id`, edgeIssues);
    requiredString(edge.source, `${edgePath}.source`, edgeIssues);
    requiredString(edge.target, `${edgePath}.target`, edgeIssues);
    enumValue(edge.condition, ["success", "failure"] as const, `${edgePath}.condition`, edgeIssues);
  });
  validateArray(value.mappings, `${path}.mappings`, issues, (mapping, mappingPath, mappingIssues) => {
    if (!record(mapping, mappingPath, mappingIssues)) return;
    requiredString(mapping.id, `${mappingPath}.id`, mappingIssues);
    requiredString(mapping.sourceNodeId, `${mappingPath}.sourceNodeId`, mappingIssues);
    requiredString(mapping.jsonPath, `${mappingPath}.jsonPath`, mappingIssues);
    requiredString(mapping.variableName, `${mappingPath}.variableName`, mappingIssues);
    booleanValue(mapping.secret, `${mappingPath}.secret`, mappingIssues);
  });
}

function validateSavedResponse(value: unknown, path: string, issues: ProjectSchemaIssue[]): void {
  if (!record(value, path, issues)) return;
  for (const key of ["id", "serviceId", "serviceName", "fileName", "filePath", "url", "statusText", "contentType", "capturedAt"] as const) {
    requiredString(value[key], `${path}.${key}`, issues);
  }
  enumValue(value.method, HTTP_METHODS, `${path}.method`, issues);
  numberValue(value.status, `${path}.status`, issues, 0);
  numberValue(value.durationMs, `${path}.durationMs`, issues, 0);
  numberValue(value.sizeBytes, `${path}.sizeBytes`, issues, 0);
  enumValue(value.bodyKind, ["json", "raw"] as const, `${path}.bodyKind`, issues);
  booleanValue(value.redacted, `${path}.redacted`, issues);
}

function validateImportSource(value: unknown, path: string, issues: ProjectSchemaIssue[]): void {
  if (!record(value, path, issues)) return;
  requiredString(value.id, `${path}.id`, issues);
  requiredString(value.label, `${path}.label`, issues);
  requiredString(value.source, `${path}.source`, issues);
}

function validateSettings(value: unknown, path: string, issues: ProjectSchemaIssue[]): void {
  if (!record(value, path, issues)) return;
  if (value.defaultEnvironmentId !== undefined) requiredString(value.defaultEnvironmentId, `${path}.defaultEnvironmentId`, issues);
  for (const key of ["askToSaveOnClose", "askBeforeClosingUnsavedTabs", "redactSecretsInConsole", "sslCertificateVerification", "sslTlsKeyLog", "disableCookies"] as const) {
    if (value[key] !== undefined) booleanValue(value[key], `${path}.${key}`, issues);
  }
  if (value.httpVersion !== undefined) enumValue(value.httpVersion, ["auto", "http1", "http2"] as const, `${path}.httpVersion`, issues);
  if (value.requestTimeoutMs !== undefined) numberValue(value.requestTimeoutMs, `${path}.requestTimeoutMs`, issues, 0);
  if (value.maxResponseTimeMs !== undefined) numberValue(value.maxResponseTimeMs, `${path}.maxResponseTimeMs`, issues, 0);
  if (value.responseFormatDetection !== undefined) enumValue(value.responseFormatDetection, ["auto", "json"] as const, `${path}.responseFormatDetection`, issues);
  if (value.workingDirectory !== undefined) stringValue(value.workingDirectory, `${path}.workingDirectory`, issues);
  if (value.theme !== undefined) enumValue(value.theme, ["light", "dark"] as const, `${path}.theme`, issues);
  if (value.proxy !== undefined && record(value.proxy, `${path}.proxy`, issues)) {
    for (const key of ["enabled", "useForHttp", "useForHttps", "basicAuthEnabled"] as const) {
      if (value.proxy[key] !== undefined) booleanValue(value.proxy[key], `${path}.proxy.${key}`, issues);
    }
    for (const key of ["serverUrl", "username", "password", "bypassList"] as const) {
      if (value.proxy[key] !== undefined) stringValue(value.proxy[key], `${path}.proxy.${key}`, issues);
    }
    if (value.proxy.port !== undefined) numberValue(value.proxy.port, `${path}.proxy.port`, issues, 0);
  }
}

function redactProjectRow(row: KeyValueRow): KeyValueRow {
  if (row.valueType === "file") return { ...row, value: "" };
  if (!isSecretKey(row.name) || row.value.includes("{{")) return row;
  return { ...row, value: redactValue(row.name, row.value) };
}

function redactLiteralCredential(value: string | undefined, variableNames: Set<string>): string | undefined {
  if (!value || value.includes("{{") || variableNames.has(value)) return value;
  return "";
}

function redactProjectBody(body: string, contentType: string): string {
  if (!body.trim()) return body;
  if (contentType !== "application/json") return redactText(body);
  try {
    return JSON.stringify(redactJsonValue(JSON.parse(body) as unknown), null, 2);
  } catch {
    return redactText(body);
  }
}

type ArrayValidator = (value: unknown, path: string, issues: ProjectSchemaIssue[]) => void;

function validateArray(value: unknown, path: string, issues: ProjectSchemaIssue[], validate: ArrayValidator): void {
  if (!Array.isArray(value)) {
    issues.push({ path, message: `${path.split(".").pop()} must be an array.` });
    return;
  }
  value.forEach((item, index) => validate(item, `${path}[${index}]`, issues));
}

function record(value: unknown, path: string, issues: ProjectSchemaIssue[]): value is Record<string, unknown> {
  if (isRecord(value)) return true;
  issues.push({ path, message: "must be an object." });
  return false;
}

function requiredString(value: unknown, path: string, issues: ProjectSchemaIssue[]): void {
  if (typeof value !== "string" || !value.trim()) issues.push({ path, message: "is required and must be a string." });
}

function stringValue(value: unknown, path: string, issues: ProjectSchemaIssue[]): void {
  if (typeof value !== "string") issues.push({ path, message: "must be a string." });
}

function booleanValue(value: unknown, path: string, issues: ProjectSchemaIssue[]): void {
  if (typeof value !== "boolean") issues.push({ path, message: "must be a boolean." });
}

function numberValue(value: unknown, path: string, issues: ProjectSchemaIssue[], minimum?: number): void {
  if (typeof value !== "number" || !Number.isFinite(value) || (minimum !== undefined && value < minimum)) {
    issues.push({ path, message: minimum === undefined ? "must be a finite number." : `must be a finite number greater than or equal to ${minimum}.` });
  }
}

function literal(value: unknown, expected: string | number, path: string, issues: ProjectSchemaIssue[]): void {
  if (value !== expected) issues.push({ path, message: `${path} must be ${expected}.` });
}

function enumValue<T extends string>(value: unknown, allowed: readonly T[], path: string, issues: ProjectSchemaIssue[]): void {
  if (typeof value !== "string" || !allowed.includes(value as T)) issues.push({ path, message: `must be one of ${allowed.join(", ")}.` });
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}
