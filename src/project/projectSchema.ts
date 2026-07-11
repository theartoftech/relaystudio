import { AppError } from "../lib/appError";
import { isSecretKey, redactValue } from "../lib/redaction";
import {
  PROJECT_FORMAT,
  PROJECT_SCHEMA_VERSION,
  type RelayProject
} from "./projectModel";

export interface ProjectSchemaIssue {
  path: string;
  message: string;
}

export function validateProjectSchema(value: unknown): ProjectSchemaIssue[] {
  if (!isRecord(value)) return [{ path: "$", message: "Project payload must be an object." }];
  const issues: ProjectSchemaIssue[] = [];
  if (value.format !== PROJECT_FORMAT) issues.push({ path: "format", message: `format must be ${PROJECT_FORMAT}.` });
  if (value.schemaVersion !== PROJECT_SCHEMA_VERSION) issues.push({ path: "schemaVersion", message: `schemaVersion must be ${PROJECT_SCHEMA_VERSION}.` });
  if (typeof value.id !== "string" || !value.id.trim()) issues.push({ path: "id", message: "id is required." });
  if (typeof value.name !== "string" || !value.name.trim()) issues.push({ path: "name", message: "name is required." });
  for (const field of ["services", "environments", "flows", "savedResponses", "importSources"] as const) {
    if (!Array.isArray(value[field])) issues.push({ path: field, message: `${field} must be an array.` });
  }
  if (!isRecord(value.settings)) issues.push({ path: "settings", message: "settings must be an object." });
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
  return structuredClone(value) as RelayProject;
}

export function prepareProjectForExport(value: unknown): RelayProject {
  const project = parseProjectImport(value);
  const variableNames = new Set(project.environments.flatMap((environment) => environment.variables.map((variable) => variable.name)));
  return {
    ...project,
    environments: project.environments.map((environment) => ({
      ...environment,
      variables: environment.variables.map((variable) => variable.secret ? { ...variable, value: "" } : variable)
    })),
    services: project.services.map((service) => ({
      ...service,
      headers: service.headers.map((header) => isSecretKey(header.name) && !header.value.includes("{{")
        ? { ...header, value: redactValue(header.name, header.value) }
        : header),
      body: {
        ...service.body,
        raw: redactProjectBody(service.body.raw, service.body.contentType)
      },
      authProfile: {
        ...service.authProfile,
        apiKeyValue: redactLiteralCredential(service.authProfile.apiKeyValue, variableNames),
        passwordVariable: redactLiteralCredential(service.authProfile.passwordVariable, variableNames),
        clientSecretVariable: redactLiteralCredential(service.authProfile.clientSecretVariable, variableNames),
        customHeaderValue: redactLiteralCredential(service.authProfile.customHeaderValue, variableNames)
      }
    })),
    settings: {
      ...project.settings,
      proxy: { ...project.settings.proxy, password: "" }
    }
  };
}

function redactLiteralCredential(value: string | undefined, variableNames: Set<string>): string | undefined {
  if (!value || value.includes("{{") || variableNames.has(value)) return value;
  return "";
}

function redactProjectBody(body: string, contentType: string): string {
  if (!body.trim() || contentType !== "application/json") return body;
  try {
    return JSON.stringify(redactJsonValue(JSON.parse(body) as unknown), null, 2);
  } catch {
    return body.replace(/("?(?:password|token|secret|api[-_]?key|clientSecret)"?\s*:\s*)"[^"]*"/gi, "$1\"********\"");
  }
}

function redactJsonValue(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(redactJsonValue);
  if (!isRecord(value)) return value;
  return Object.fromEntries(Object.entries(value).map(([key, nested]) => [
    key,
    isSecretKey(key) ? "********" : redactJsonValue(nested)
  ]));
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}
