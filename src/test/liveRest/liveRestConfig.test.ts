import { mkdtempSync, rmSync, writeFileSync } from "fs";
import { tmpdir } from "os";
import { join } from "path";
import type { HttpMethod, RequestBodyDefinition } from "../../project/projectModel";
import { LIVE_REST_CONFIG_ENV, loadLiveRestConfig, loadOptionalLiveRestConfig } from "./liveRestConfig";

describe("liveRestConfig", () => {
  let tempDir: string;

  beforeEach(() => {
    tempDir = mkdtempSync(join(tmpdir(), "relay-live-rest-config-"));
  });

  afterEach(() => {
    rmSync(tempDir, { recursive: true, force: true });
  });

  it("reports an explicit disabled state when no config path is provided", () => {
    const state = loadOptionalLiveRestConfig({});

    expect(state.enabled).toBe(false);
    if (state.enabled) {
      throw new Error("Expected disabled live REST state.");
    }
    expect(state.reason).toContain(LIVE_REST_CONFIG_ENV);
  });

  it("throws when the configured file does not exist", () => {
    expect(() => loadOptionalLiveRestConfig({
      [LIVE_REST_CONFIG_ENV]: join(tempDir, "missing.json")
    })).toThrow("Live REST config could not be read");
  });

  it("throws on incomplete config", () => {
    const configPath = join(tempDir, "invalid.json");
    writeFileSync(configPath, JSON.stringify({
      baseUrl: "https://api.example.com",
      users: {
        admin: { username: "admin", password: "secret" }
      }
    }, null, 2));

    expect(() => loadLiveRestConfig(configPath)).toThrow(".users.standard");
  });

  it("rejects checked-in placeholder credentials", () => {
    const configPath = join(tempDir, "placeholder.json");
    const config = validConfig();
    config.users.standard.password = "replace-with-local-secret";
    writeFileSync(configPath, JSON.stringify(config, null, 2));

    expect(() => loadLiveRestConfig(configPath)).toThrow(
      ".users.standard.password must be replaced with a local secret"
    );
  });

  it("rejects non-HTTP targets", () => {
    const configPath = join(tempDir, "file-target.json");
    const config = validConfig();
    config.baseUrl = "file:///tmp/not-a-rest-target";
    writeFileSync(configPath, JSON.stringify(config, null, 2));

    expect(() => loadLiveRestConfig(configPath)).toThrow(
      ".baseUrl must use http or https"
    );
  });

  it("loads a valid config file", () => {
    const configPath = join(tempDir, "live-rest.json");
    writeFileSync(configPath, JSON.stringify(validConfig(), null, 2));

    const config = loadLiveRestConfig(configPath);

    expect(config.baseUrl).toBe("https://api.example.com");
    expect(config.users.restricted.username).toBe("restricted.user");
    expect(config.login.tokenJsonPath).toBe("$.accessToken");
    expect(config.requests.publicProbe).toBeUndefined();
    expect(config.requests.standardAdminDenied.expectedStatus).toBe(403);
    expect(config.requests.standardSetupWriteDenied.body).toContain("\"enabled\": true");
  });

  it("loads an optional unauthenticated public probe with its configured status", () => {
    const configPath = join(tempDir, "public-probe.json");
    const source = validConfig();
    source.requests.publicProbe = {
      method: "GET",
      path: "/api/health",
      auth: "none",
      expectedStatus: 401
    };
    writeFileSync(configPath, JSON.stringify(source, null, 2));

    const config = loadLiveRestConfig(configPath);

    expect(config.requests.publicProbe).toEqual({
      method: "GET",
      path: "/api/health",
      auth: "none",
      expectedStatus: 401,
      body: undefined,
      contentType: undefined,
      headers: [],
      timeoutMs: undefined
    });
  });

  it("rejects an authenticated public probe because no login token exists yet", () => {
    const configPath = join(tempDir, "authenticated-public-probe.json");
    const source = validConfig();
    source.requests.publicProbe = {
      method: "GET",
      path: "/api/health",
      auth: "bearer",
      expectedStatus: 200
    };
    writeFileSync(configPath, JSON.stringify(source, null, 2));

    expect(() => loadLiveRestConfig(configPath)).toThrow(
      ".requests.publicProbe.auth must be none because the public probe runs before login"
    );
  });
});

interface TestRequestConfig {
  method: HttpMethod;
  path: string;
  auth: "none" | "bearer";
  expectedStatus: number;
  contentType?: RequestBodyDefinition["contentType"];
  body?: string;
}

interface TestLiveRestConfig {
  baseUrl: string;
  users: Record<string, { username: string; password: string }>;
  login: TestRequestConfig & { tokenJsonPath: string };
  requests: Record<string, TestRequestConfig> & { publicProbe?: TestRequestConfig };
}

function validConfig(): TestLiveRestConfig {
  return {
    baseUrl: "https://api.example.com",
    users: {
      admin: { username: "admin.user", password: "admin-secret" },
      standard: { username: "standard.user", password: "standard-secret" },
      restricted: { username: "restricted.user", password: "restricted-secret" }
    },
    login: {
      method: "POST",
      path: "/api/auth/login",
      auth: "none",
      expectedStatus: 200,
      contentType: "application/json",
      body: "{\n  \"username\": \"{{username}}\",\n  \"password\": \"{{password}}\"\n}",
      tokenJsonPath: "$.accessToken"
    },
    requests: {
      currentUser: { method: "GET", path: "/api/auth/me", auth: "bearer", expectedStatus: 200 },
      standardRead: { method: "GET", path: "/api/products", auth: "bearer", expectedStatus: 200 },
      standardAdminDenied: { method: "GET", path: "/api/admin/settings", auth: "bearer", expectedStatus: 403 },
      standardSetupWriteDenied: {
        method: "POST",
        path: "/api/admin/config",
        auth: "bearer",
        expectedStatus: 403,
        contentType: "application/json",
        body: "{\n  \"enabled\": true\n}"
      },
      restrictedRead: { method: "GET", path: "/api/products", auth: "bearer", expectedStatus: 200 },
      restrictedWriteDenied: {
        method: "DELETE",
        path: "/api/orders/restricted-check",
        auth: "bearer",
        expectedStatus: 403
      },
      adminAccess: { method: "GET", path: "/api/admin/settings", auth: "bearer", expectedStatus: 200 },
      adminAudit: { method: "GET", path: "/api/admin/audit-events", auth: "bearer", expectedStatus: 200 }
    }
  };
}
