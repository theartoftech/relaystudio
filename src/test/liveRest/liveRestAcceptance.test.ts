import { evaluateJsonPath } from "../../services/flowBuilder";
import { fetchHttpTransport, runServiceRequest } from "../../services/serviceRunner";
import type {
  KeyValueRow,
  ProjectEnvironment,
  ProjectService,
  ProjectVariable,
  RequestBodyDefinition
} from "../../project/projectModel";
import type { LiveRestRequestConfig, LiveRestUserCredentials } from "./liveRestConfig";
import { loadOptionalLiveRestConfig } from "./liveRestConfig";

const liveRestState = loadOptionalLiveRestConfig();

if (!liveRestState.enabled) {
  describe.skip("live REST acceptance", () => {
    it(`SKIPPED: ${liveRestState.reason}`, () => undefined);
  });
} else {
  const { config } = liveRestState;

  describe("live REST acceptance", () => {
    it("reaches the health endpoint without auth", async () => {
      const result = await executeScenario("health-check", config.requests.health);

      assertStatus(result.response?.status, config.requests.health.expectedStatus, "health endpoint");
      expect(result.error).toBeNull();
    });

    it("lets the standard user read and denies admin/setup routes", async () => {
      const accessToken = await loginAs(config.users.standard);

      const currentUser = await executeScenario("current-user", config.requests.currentUser, accessToken);
      assertStatus(currentUser.response?.status, config.requests.currentUser.expectedStatus, "current user");
      assertAuthHeaderRedaction(currentUser.request?.headers.Authorization, currentUser.request?.redactedHeaders.Authorization);

      const standardRead = await executeScenario("standard-read", config.requests.standardRead, accessToken);
      assertStatus(standardRead.response?.status, config.requests.standardRead.expectedStatus, "standard read");

      const adminDenied = await executeScenario("standard-admin-denied", config.requests.standardAdminDenied, accessToken);
      assertStatus(adminDenied.response?.status, config.requests.standardAdminDenied.expectedStatus, "standard admin denial");
      expect(adminDenied.events[adminDenied.events.length - 1]?.message).toBe(`Request completed with HTTP ${config.requests.standardAdminDenied.expectedStatus}.`);

      const setupDenied = await executeScenario("standard-setup-write-denied", config.requests.standardSetupWriteDenied, accessToken);
      assertStatus(setupDenied.response?.status, config.requests.standardSetupWriteDenied.expectedStatus, "standard setup write denial");
    });

    it("lets the restricted user read and denies protected writes", async () => {
      const accessToken = await loginAs(config.users.restricted);

      const restrictedRead = await executeScenario("restricted-read", config.requests.restrictedRead, accessToken);
      assertStatus(restrictedRead.response?.status, config.requests.restrictedRead.expectedStatus, "restricted read");

      const restrictedWriteDenied = await executeScenario("restricted-write-denied", config.requests.restrictedWriteDenied, accessToken);
      assertStatus(restrictedWriteDenied.response?.status, config.requests.restrictedWriteDenied.expectedStatus, "restricted write denial");
      expect(restrictedWriteDenied.events[restrictedWriteDenied.events.length - 1]?.message).toBe(`Request completed with HTTP ${config.requests.restrictedWriteDenied.expectedStatus}.`);
    });

    it("lets the admin user access admin settings and audit data", async () => {
      const accessToken = await loginAs(config.users.admin);

      const adminAccess = await executeScenario("admin-access", config.requests.adminAccess, accessToken);
      assertStatus(adminAccess.response?.status, config.requests.adminAccess.expectedStatus, "admin settings");

      const adminAudit = await executeScenario("admin-audit", config.requests.adminAudit, accessToken);
      assertStatus(adminAudit.response?.status, config.requests.adminAudit.expectedStatus, "admin audit");
      assertAuthHeaderRedaction(adminAudit.request?.headers.Authorization, adminAudit.request?.redactedHeaders.Authorization);
    });
  });

  async function loginAs(credentials: LiveRestUserCredentials): Promise<string> {
    const loginResult = await executeScenario("login", config.login, undefined, credentials);
    assertStatus(loginResult.response?.status, config.login.expectedStatus, `login for ${credentials.username}`);
    expect(loginResult.error).toBeNull();

    const token = extractStringValue(loginResult.response?.rawBody, config.login.tokenJsonPath, `login token for ${credentials.username}`);
    expect(token).not.toHaveLength(0);
    assertSanitizedDiagnostics(loginResult, [credentials.password, token]);
    return token;
  }
}

async function executeScenario(
  serviceId: string,
  requestConfig: LiveRestRequestConfig,
  accessToken?: string,
  credentials?: LiveRestUserCredentials
) {
  if (!liveRestState.enabled) {
    throw new Error("Live REST config is not enabled.");
  }

  const environment = createEnvironment(liveRestState.config.baseUrl, accessToken, credentials);
  const service = createService(serviceId, requestConfig);
  return runServiceRequest(service, environment, fetchHttpTransport);
}

function createEnvironment(
  baseUrl: string,
  accessToken?: string,
  credentials?: LiveRestUserCredentials
): ProjectEnvironment {
  const variables: ProjectVariable[] = [
    { name: "baseUrl", value: baseUrl, secret: false },
    { name: "accessToken", value: accessToken ?? "", secret: true },
    { name: "username", value: credentials?.username ?? "", secret: false },
    { name: "password", value: credentials?.password ?? "", secret: true }
  ];

  return {
    id: "live-rest",
    name: "Live REST",
    variables
  };
}

function createService(serviceId: string, requestConfig: LiveRestRequestConfig): ProjectService {
  const headers = normalizeHeaders(requestConfig.headers ?? [], requestConfig.contentType);
  return {
    id: serviceId,
    folder: "Live REST",
    name: serviceId,
    method: requestConfig.method,
    path: requestConfig.path,
    auth: requestConfig.auth,
    timeoutMs: requestConfig.timeoutMs ?? 30_000,
    retry: { attempts: 0, backoffMs: 0 },
    headers,
    queryParams: [],
    pathParams: [],
    body: createBody(requestConfig.body, requestConfig.contentType),
    authProfile: requestConfig.auth === "bearer"
      ? { type: "bearer", tokenVariable: "accessToken" }
      : { type: "none" }
  };
}

function createBody(body: string | undefined, contentType: RequestBodyDefinition["contentType"] | undefined): RequestBodyDefinition {
  if (!body) {
    return { contentType: "none", raw: "" };
  }
  if (!contentType || contentType === "none") {
    throw new Error("Live REST request body requires a concrete content type.");
  }
  return {
    contentType,
    raw: body
  };
}

function normalizeHeaders(
  headers: Array<{ name: string; value: string }>,
  contentType: RequestBodyDefinition["contentType"] | undefined
): KeyValueRow[] {
  const rows = headers.map((header, index) => ({
    id: `header-${index + 1}`,
    name: header.name,
    value: header.value,
    enabled: true
  }));

  if (contentType && contentType !== "none" && !rows.some((header) => header.name.toLowerCase() === "content-type")) {
    rows.unshift({
      id: "generated-content-type",
      name: "Content-Type",
      value: contentType,
      enabled: true
    });
  }

  return rows;
}

function extractStringValue(body: string | undefined, jsonPath: string, label: string): string {
  if (!body) {
    throw new Error(`Expected response body for ${label}.`);
  }
  const value = evaluateJsonPath(body, jsonPath);
  if (typeof value !== "string" || !value.trim()) {
    throw new Error(`Expected ${label} at ${jsonPath} to be a non-empty string.`);
  }
  return value;
}

function assertStatus(actual: number | undefined, expected: number, label: string) {
  expect(actual, `${label} status`).toBe(expected);
}

function assertAuthHeaderRedaction(actual: string | undefined, redacted: string | undefined) {
  expect(actual).toMatch(/^Bearer\s+\S+/);
  expect(redacted).toBe("Bearer ********");
}

function assertSanitizedDiagnostics(
  result: Awaited<ReturnType<typeof executeScenario>>,
  sensitiveValues: string[]
): void {
  const diagnostics = JSON.stringify({
    events: result.events,
    redactedHeaders: result.request?.redactedHeaders,
    error: result.error,
    validationIssues: result.validationIssues
  });

  for (const sensitiveValue of sensitiveValues) {
    expect(diagnostics).not.toContain(sensitiveValue);
  }
}
