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

export interface ProjectService {
  id: string;
  folder: string;
  name: string;
  method: "GET" | "POST" | "PUT" | "DELETE";
  path: string;
  auth: string;
}

export interface ProjectFlow {
  id: string;
  name: string;
  steps: string[];
}

export interface SavedResponseMetadata {
  id: string;
  serviceId: string;
  fileName: string;
  status: number;
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
  settings: {
    askToSaveOnClose: boolean;
    redactSecretsInConsole: boolean;
  };
}

export interface RecentProject {
  name: string;
  path: string;
  openedAt: string;
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
      { id: "login", folder: "Auth", name: "Login", method: "POST", path: "/api/auth/login", auth: "none" },
      { id: "refresh-token", folder: "Auth", name: "Refresh Token", method: "POST", path: "/api/auth/refresh", auth: "bearer" },
      { id: "current-user", folder: "Auth", name: "Current User", method: "GET", path: "/api/auth/me", auth: "bearer" },
      { id: "list-products", folder: "Products", name: "List Products", method: "GET", path: "/api/products", auth: "bearer" },
      { id: "get-product", folder: "Products", name: "Get Product", method: "GET", path: "/api/products/{productId}", auth: "bearer" },
      { id: "search-products", folder: "Products", name: "Search Products", method: "GET", path: "/api/products/search?q={query}", auth: "bearer" },
      { id: "create-order", folder: "Orders", name: "Create Order", method: "POST", path: "/api/orders", auth: "bearer" },
      { id: "get-order", folder: "Orders", name: "Get Order", method: "GET", path: "/api/orders/{orderId}", auth: "bearer" },
      { id: "update-order", folder: "Orders", name: "Update Order", method: "PUT", path: "/api/orders/{orderId}", auth: "bearer" },
      { id: "cleanup-order", folder: "Orders", name: "Cleanup Order", method: "DELETE", path: "/api/orders/{orderId}", auth: "bearer" },
      { id: "admin-settings", folder: "Admin", name: "Admin Settings", method: "GET", path: "/api/admin/settings", auth: "bearer" },
      { id: "audit-events", folder: "Admin", name: "Audit Events", method: "GET", path: "/api/admin/audit-events", auth: "bearer" }
    ],
    environments: [
      {
        id: "qa",
        name: "QA Environment",
        variables: [
          { name: "baseUrl", value: "https://api.example.com", secret: false },
          { name: "accessToken", value: "sample-access-token", secret: true },
          { name: "productId", value: "prod-1001", secret: false },
          { name: "orderId", value: "ord-20260621-0001", secret: false }
        ]
      },
      { id: "staging", name: "Staging Environment", variables: [{ name: "baseUrl", value: "https://staging.example.com", secret: false }] },
      { id: "production", name: "Production Environment", variables: [{ name: "baseUrl", value: "https://api.example.com", secret: false }] }
    ],
    flows: [
      { id: "authenticated-read", name: "Authenticated Read", steps: ["login", "current-user", "list-products", "get-product"] },
      { id: "create-cleanup", name: "Create And Cleanup", steps: ["login", "create-order", "get-order", "cleanup-order"] },
      { id: "product-search", name: "Product Search", steps: ["login", "search-products"] }
    ],
    savedResponses: [
      { id: "current-user-response", serviceId: "current-user", fileName: "current-user.json", status: 200, capturedAt: now },
      { id: "create-order-response", serviceId: "create-order", fileName: "create-order.json", status: 200, capturedAt: now },
      { id: "forbidden-admin-response", serviceId: "admin-settings", fileName: "forbidden-admin.json", status: 403, capturedAt: now }
    ],
    importSources: [],
    settings: {
      askToSaveOnClose: true,
      redactSecretsInConsole: true
    }
  };
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
