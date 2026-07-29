import type { KeyValueRow, ProjectService } from "../project/projectModel";

export interface CreateLinkedGetServiceInput {
  sourceService: ProjectService;
  sourceRequestUrl: string;
  targetUrl: string;
  existingServiceIds: string[];
}

export interface JsonResponseLinkToken {
  text: string;
  href?: string;
}

export function createLinkedGetService(input: CreateLinkedGetServiceInput): ProjectService {
  const sourceUrl = parseHttpUrl(input.sourceRequestUrl, "The source request URL must be an absolute HTTP or HTTPS URL.");
  const targetUrl = parseHttpUrl(input.targetUrl, "Response link must be an absolute HTTP or HTTPS URL.");
  if (targetUrl.username || targetUrl.password) {
    throw new Error("Response link cannot contain embedded credentials.");
  }
  if (sourceUrl.origin !== targetUrl.origin) {
    throw new Error(`Relay Studio will not copy authorization to a different origin (${targetUrl.origin}). Create the request manually and review its authorization.`);
  }
  const queryNames = Array.from(targetUrl.searchParams.keys());
  if (new Set(queryNames).size !== queryNames.length) {
    throw new Error("Response link contains a duplicate query parameter, which Relay Studio request validation does not support.");
  }

  const baseId = `linked-get-${slugForLinkedRequest(targetUrl.pathname)}`;
  const id = uniqueServiceId(baseId, input.existingServiceIds);
  const queryParams: KeyValueRow[] = Array.from(targetUrl.searchParams.entries()).map(([name, value], index) => ({
    id: `${id}-query-${slugForLinkedRequest(name)}-${index + 1}`,
    name,
    value,
    enabled: true
  }));

  return {
    id,
    name: `GET ${targetUrl.pathname || "/"}`,
    folder: input.sourceService.folder,
    method: "GET",
    path: targetUrl.pathname || "/",
    auth: input.sourceService.auth,
    authProfile: { ...input.sourceService.authProfile },
    timeoutMs: input.sourceService.timeoutMs,
    retry: { ...input.sourceService.retry },
    headers: [{ id: `${id}-accept`, name: "Accept", value: "application/json", enabled: true }],
    queryParams,
    pathParams: [],
    body: { contentType: "none", raw: "" }
  };
}

export function tokenizeJsonResponseLinks(body: string): JsonResponseLinkToken[] {
  try {
    JSON.parse(body) as unknown;
  } catch {
    return [{ text: body }];
  }

  const tokens: JsonResponseLinkToken[] = [];
  const jsonString = /"(?:\\.|[^"\\])*"/g;
  let cursor = 0;
  for (const match of body.matchAll(jsonString)) {
    const index = match.index;
    const rawString = match[0];
    if (index > cursor) tokens.push({ text: body.slice(cursor, index) });

    const afterString = body.slice(index + rawString.length);
    const isPropertyName = /^\s*:/.test(afterString);
    const decoded = JSON.parse(rawString) as unknown;
    const href = !isPropertyName && typeof decoded === "string" ? normalizeHttpHref(decoded) : null;
    if (href) {
      tokens.push({ text: "\"" });
      tokens.push({ text: rawString.slice(1, -1), href });
      tokens.push({ text: "\"" });
    } else {
      tokens.push({ text: rawString });
    }
    cursor = index + rawString.length;
  }
  if (cursor < body.length) tokens.push({ text: body.slice(cursor) });
  return tokens.length ? tokens : [{ text: body }];
}

function parseHttpUrl(value: string, message: string): URL {
  let parsed: URL;
  try {
    parsed = new URL(value);
  } catch {
    throw new Error(message);
  }
  if (parsed.protocol !== "http:" && parsed.protocol !== "https:") throw new Error(message);
  return parsed;
}

function normalizeHttpHref(value: string): string | null {
  try {
    const parsed = new URL(value);
    return parsed.protocol === "http:" || parsed.protocol === "https:" ? parsed.href : null;
  } catch {
    return null;
  }
}

function slugForLinkedRequest(value: string): string {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "") || "root";
}

function uniqueServiceId(baseId: string, existingIds: string[]): string {
  const ids = new Set(existingIds);
  if (!ids.has(baseId)) return baseId;
  let suffix = 2;
  while (ids.has(`${baseId}-${suffix}`)) suffix += 1;
  return `${baseId}-${suffix}`;
}
