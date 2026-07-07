export const PROJECT_FORMAT = "relay-studio-restproj";
export const PROJECT_SCHEMA_VERSION = 1;

export interface ProjectVariable {
  name: string;
  value: string;
  secret: boolean;
}

export interface ProjectEnvironment {
  id: string;
  name: string;
  variables: ProjectVariable[];
}

export type HttpMethod = "GET" | "POST" | "PUT" | "DELETE";
export type AuthMode = "none" | "bearer" | "apiKey" | "basic" | "oauthClientCredentials" | "customHeader";

export interface KeyValueRow {
  id: string;
  name: string;
  value: string;
  enabled: boolean;
}

export interface RequestBodyDefinition {
  contentType: "application/json" | "text/plain" | "none";
  raw: string;
}

export interface RetryPolicy {
  attempts: number;
  backoffMs: number;
}

export interface AuthProfile {
  type: AuthMode;
  tokenVariable?: string;
  apiKeyName?: string;
  apiKeyValue?: string;
  usernameVariable?: string;
  passwordVariable?: string;
  clientIdVariable?: string;
  clientSecretVariable?: string;
  tokenUrl?: string;
  customHeaderName?: string;
  customHeaderValue?: string;
}

export interface ProjectService {
  id: string;
  folder: string;
  name: string;
  method: HttpMethod;
  path: string;
  auth: string;
  timeoutMs: number;
  retry: RetryPolicy;
  headers: KeyValueRow[];
  queryParams: KeyValueRow[];
  pathParams: KeyValueRow[];
  body: RequestBodyDefinition;
  authProfile: AuthProfile;
}

export type FlowNodeStatus = "idle" | "running" | "success" | "failed" | "skipped" | "blocked";
export type FlowEdgeCondition = "success" | "failure";

export interface FlowNodePosition {
  x: number;
  y: number;
}

export interface FlowNode {
  id: string;
  serviceId: string;
  label: string;
  position: FlowNodePosition;
  status: FlowNodeStatus;
}

export interface FlowEdge {
  id: string;
  source: string;
  target: string;
  condition: FlowEdgeCondition;
}

export interface FlowMapping {
  id: string;
  sourceNodeId: string;
  jsonPath: string;
  variableName: string;
  secret: boolean;
}

export interface ProjectFlow {
  id: string;
  name: string;
  steps: string[];
  nodes: FlowNode[];
  edges: FlowEdge[];
  mappings: FlowMapping[];
}

export interface SavedResponseMetadata {
  id: string;
  serviceId: string;
  serviceName: string;
  fileName: string;
  filePath: string;
  method: HttpMethod;
  url: string;
  status: number;
  statusText: string;
  durationMs: number;
  contentType: string;
  sizeBytes: number;
  bodyKind: "json" | "raw";
  redacted: boolean;
  capturedAt: string;
}

export interface RelayProject {
  format: typeof PROJECT_FORMAT;
  schemaVersion: typeof PROJECT_SCHEMA_VERSION;
  id: string;
  name: string;
  createdAt: string;
  updatedAt: string;
  services: ProjectService[];
  environments: ProjectEnvironment[];
  flows: ProjectFlow[];
  savedResponses: SavedResponseMetadata[];
  importSources: Array<{ id: string; label: string; source: string }>;
  settings: ProjectSettings;
}

export type HttpVersionPreference = "auto" | "http1" | "http2";
export type ResponseFormatDetection = "auto" | "json";
export type ThemePreference = "light" | "dark";

export interface ProxySettings {
  enabled: boolean;
  useForHttp: boolean;
  useForHttps: boolean;
  serverUrl: string;
  port: number;
  basicAuthEnabled: boolean;
  username: string;
  password: string;
  bypassList: string;
}

export interface ProjectSettings {
  defaultEnvironmentId: string;
  askToSaveOnClose: boolean;
  askBeforeClosingUnsavedTabs: boolean;
  redactSecretsInConsole: boolean;
  httpVersion: HttpVersionPreference;
  requestTimeoutMs: number;
  maxResponseTimeMs: number;
  sslCertificateVerification: boolean;
  sslTlsKeyLog: boolean;
  disableCookies: boolean;
  responseFormatDetection: ResponseFormatDetection;
  workingDirectory: string;
  theme: ThemePreference;
  proxy: ProxySettings;
}

export interface RecentProject {
  name: string;
  path: string;
  openedAt: string;
}

export function createDefaultProjectSettings(defaultEnvironmentId = "qa"): ProjectSettings {
  return {
    defaultEnvironmentId,
    askToSaveOnClose: true,
    askBeforeClosingUnsavedTabs: true,
    redactSecretsInConsole: true,
    httpVersion: "auto",
    requestTimeoutMs: 30_000,
    maxResponseTimeMs: 60_000,
    sslCertificateVerification: true,
    sslTlsKeyLog: false,
    disableCookies: false,
    responseFormatDetection: "auto",
    workingDirectory: "/private/tmp",
    theme: "light",
    proxy: {
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

function service(input: {
  id: string;
  folder: string;
  name: string;
  method: HttpMethod;
  path: string;
  auth?: AuthMode;
  headers?: KeyValueRow[];
  queryParams?: KeyValueRow[];
  pathParams?: KeyValueRow[];
  body?: RequestBodyDefinition;
}): ProjectService {
  const auth = input.auth ?? "bearer";
  return {
    id: input.id,
    folder: input.folder,
    name: input.name,
    method: input.method,
    path: input.path,
    auth,
    timeoutMs: 30_000,
    retry: { attempts: 1, backoffMs: 250 },
    headers: input.headers ?? [{ id: `${input.id}-content-type`, name: "Content-Type", value: "application/json", enabled: true }],
    queryParams: input.queryParams ?? [],
    pathParams: input.pathParams ?? [],
    body: input.body ?? { contentType: "none", raw: "" },
    authProfile: auth === "none" ? { type: "none" } : { type: auth, tokenVariable: "accessToken" }
  };
}

function flow(input: { id: string; name: string; steps: string[]; mappings?: Omit<FlowMapping, "id" | "sourceNodeId">[] }): ProjectFlow {
  const nodes = input.steps.map((serviceId, index) => ({
    id: `${input.id}-${serviceId}`,
    serviceId,
    label: serviceIdToLabel(serviceId),
    position: { x: 80 + index * 230, y: 120 + (index % 2) * 92 },
    status: "idle" as FlowNodeStatus
  }));
  return {
    ...input,
    nodes,
    edges: nodes.slice(1).map((node, index) => ({
      id: `${nodes[index].id}-success-${node.id}`,
      source: nodes[index].id,
      target: node.id,
      condition: "success" as FlowEdgeCondition
    })),
    mappings: (input.mappings ?? []).map((mapping, index) => ({
      ...mapping,
      id: `${input.id}-mapping-${index + 1}`,
      sourceNodeId: nodes[index]?.id ?? nodes[0]?.id ?? ""
    }))
  };
}

export function createSampleProject(now = new Date().toISOString()): RelayProject {
  return {
    format: PROJECT_FORMAT,
    schemaVersion: PROJECT_SCHEMA_VERSION,
    id: "sample-api-regression",
    name: "Sample API Regression",
    createdAt: now,
    updatedAt: now,
    services: [
      service({
        id: "health-check",
        folder: "Utilities",
        name: "Health Check",
        method: "GET",
        path: "/api/health",
        auth: "none"
      }),
      service({
        id: "login",
        folder: "Auth",
        name: "Login",
        method: "POST",
        path: "/api/auth/login",
        auth: "none",
        body: {
          contentType: "application/json",
          raw: `{
  "username": "{{username}}",
  "password": "{{password}}"
}`
        }
      }),
      service({ id: "refresh-token", folder: "Auth", name: "Refresh Token", method: "POST", path: "/api/auth/refresh" }),
      service({ id: "current-user", folder: "Auth", name: "Current User", method: "GET", path: "/api/auth/me" }),
      service({ id: "list-products", folder: "Products", name: "List Products", method: "GET", path: "/api/products" }),
      service({
        id: "get-product",
        folder: "Products",
        name: "Get Product",
        method: "GET",
        path: "/api/products/{productId}",
        pathParams: [{ id: "get-product-product-id", name: "productId", value: "{{productId}}", enabled: true }]
      }),
      service({
        id: "search-products",
        folder: "Products",
        name: "Search Products",
        method: "GET",
        path: "/api/products/search",
        queryParams: [{ id: "search-products-query", name: "q", value: "{{query}}", enabled: true }]
      }),
      service({
        id: "create-order",
        folder: "Orders",
        name: "Create Order",
        method: "POST",
        path: "/api/orders",
        body: {
          contentType: "application/json",
          raw: `{
  "productId": "{{productId}}",
  "quantity": 1,
  "shippingMethod": "standard"
}`
        }
      }),
      service({
        id: "get-order",
        folder: "Orders",
        name: "Get Order",
        method: "GET",
        path: "/api/orders/{orderId}",
        pathParams: [{ id: "get-order-order-id", name: "orderId", value: "{{orderId}}", enabled: true }]
      }),
      service({
        id: "update-order",
        folder: "Orders",
        name: "Update Order",
        method: "PUT",
        path: "/api/orders/{orderId}",
        pathParams: [{ id: "update-order-order-id", name: "orderId", value: "{{orderId}}", enabled: true }],
        body: {
          contentType: "application/json",
          raw: `{
  "status": "submitted"
}`
        }
      }),
      service({
        id: "cleanup-order",
        folder: "Orders",
        name: "Cleanup Order",
        method: "DELETE",
        path: "/api/orders/{orderId}",
        pathParams: [{ id: "cleanup-order-order-id", name: "orderId", value: "{{orderId}}", enabled: true }]
      }),
      service({ id: "admin-settings", folder: "Admin", name: "Admin Settings", method: "GET", path: "/api/admin/settings" }),
      service({ id: "audit-events", folder: "Admin", name: "Audit Events", method: "GET", path: "/api/admin/audit-events" })
    ],
    environments: [
      {
        id: "qa",
        name: "QA Environment",
        variables: [
          { name: "baseUrl", value: "https://api.example.com", secret: false },
          { name: "accessToken", value: "sample-access-token", secret: true },
          { name: "username", value: "qa_user", secret: false },
          { name: "password", value: "sample-password", secret: true },
          { name: "query", value: "keyboard", secret: false },
          { name: "productId", value: "prod-1001", secret: false },
          { name: "orderId", value: "ord-20260621-0001", secret: false }
        ]
      },
      { id: "staging", name: "Staging Environment", variables: [{ name: "baseUrl", value: "https://staging.example.com", secret: false }] },
      { id: "production", name: "Production Environment", variables: [{ name: "baseUrl", value: "https://api.example.com", secret: false }] }
    ],
    flows: [
      flow({
        id: "authenticated-read",
        name: "Authenticated Read",
        steps: ["login", "current-user", "list-products", "get-product"],
        mappings: [{ jsonPath: "$.accessToken", variableName: "accessToken", secret: true }]
      }),
      flow({
        id: "create-cleanup",
        name: "Create Update Read Cleanup",
        steps: ["login", "create-order", "update-order", "get-order", "cleanup-order"],
        mappings: [
          { jsonPath: "$.accessToken", variableName: "accessToken", secret: true },
          { jsonPath: "$.id", variableName: "orderId", secret: false }
        ]
      }),
      flow({
        id: "product-search",
        name: "Product Search",
        steps: ["login", "search-products"],
        mappings: [{ jsonPath: "$.accessToken", variableName: "accessToken", secret: true }]
      })
    ],
    savedResponses: [
      {
        id: "current-user-response",
        serviceId: "current-user",
        serviceName: "Current User",
        fileName: "current-user.json",
        filePath: "/private/tmp/current-user.json",
        method: "GET",
        url: "https://api.example.com/api/auth/me",
        status: 200,
        statusText: "OK",
        durationMs: 245,
        contentType: "application/json",
        sizeBytes: 128,
        bodyKind: "json",
        redacted: true,
        capturedAt: now
      },
      {
        id: "create-order-response",
        serviceId: "create-order",
        serviceName: "Create Order",
        fileName: "create-order.json",
        filePath: "/private/tmp/create-order.json",
        method: "POST",
        url: "https://api.example.com/api/orders",
        status: 200,
        statusText: "OK",
        durationMs: 289,
        contentType: "application/json",
        sizeBytes: 96,
        bodyKind: "json",
        redacted: true,
        capturedAt: now
      },
      {
        id: "forbidden-admin-response",
        serviceId: "admin-settings",
        serviceName: "Admin Settings",
        fileName: "forbidden-admin.json",
        filePath: "/private/tmp/forbidden-admin.json",
        method: "GET",
        url: "https://api.example.com/api/admin/settings",
        status: 403,
        statusText: "Forbidden",
        durationMs: 112,
        contentType: "application/json",
        sizeBytes: 72,
        bodyKind: "json",
        redacted: true,
        capturedAt: now
      }
    ],
    importSources: [],
    settings: createDefaultProjectSettings("qa")
  };
}

function serviceIdToLabel(serviceId: string): string {
  return serviceId
    .split("-")
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

export function createEmptyProject(now = new Date().toISOString()): RelayProject {
  return {
    ...createSampleProject(now),
    id: `project-${Date.now()}`,
    name: "Untitled API Project",
    services: [],
    flows: [],
    savedResponses: [],
    importSources: []
  };
}

export function touchProject(project: RelayProject, now = new Date().toISOString()): RelayProject {
  return {
    ...project,
    updatedAt: now
  };
}
