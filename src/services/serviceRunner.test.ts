import { beforeEach, describe, expect, it, vi } from "vitest";
import { invoke } from "@tauri-apps/api/core";
import { createSampleProject, type ProjectEnvironment, type ProjectService } from "../project/projectModel";
import {
  buildExecutableRequest,
  defaultHttpTransport,
  extractCapturedVariables,
  fetchHttpTransport,
  normalizeResponse,
  parseResponseBody,
  runServiceRequest,
  type HttpTransport
} from "./serviceRunner";
import { MAX_RESPONSE_BODY_BYTES } from "./resourceLimits";

vi.mock("@tauri-apps/api/core", () => ({
  invoke: vi.fn()
}));

const project = createSampleProject("2026-06-21T00:00:00.000Z");
const qa = project.environments[0];
const createOrder = project.services.find((service) => service.id === "create-order") as ProjectService;
const login = project.services.find((service) => service.id === "login") as ProjectService;
const health = project.services.find((service) => service.id === "health-check") as ProjectService;

describe("service runner", () => {
  beforeEach(() => {
    delete window.__TAURI_INTERNALS__;
    vi.mocked(invoke).mockReset();
    vi.restoreAllMocks();
  });

  it("builds an executable request with resolved variables and redacted diagnostics", () => {
    const request = buildExecutableRequest(createOrder, qa);

    expect(request).toMatchObject({
      method: "POST",
      url: "https://api.example.com/api/orders",
      timeoutMs: 30000
    });
    expect(request.headers.Authorization).toBe("Bearer sample-access-token");
    expect(request.redactedHeaders.Authorization).toBe("Bearer ********");
    expect(request.body).toContain("prod-1001");
    expect(request.body).not.toContain("{{productId}}");
  });

  it("encodes URL-encoded and multipart form bodies with resolved variables", () => {
    const urlEncoded = buildExecutableRequest({
      ...createOrder,
      method: "PATCH",
      headers: [{ id: "old", name: "Content-Type", value: "application/json", enabled: true }],
      body: {
        contentType: "application/x-www-form-urlencoded",
        raw: "",
        fields: [
          { id: "status", name: "status", value: "ready & waiting", enabled: true },
          { id: "product", name: "product", value: "{{productId}}", enabled: true },
          { id: "ignored", name: "ignored", value: "no", enabled: false }
        ]
      }
    }, qa);

    expect(urlEncoded.method).toBe("PATCH");
    expect(urlEncoded.headers["Content-Type"]).toBe("application/x-www-form-urlencoded");
    expect(urlEncoded.body).toBe("status=ready+%26+waiting&product=prod-1001");

    const multipart = buildExecutableRequest({
      ...createOrder,
      headers: [],
      body: {
        contentType: "multipart/form-data",
        raw: "",
        fields: [{ id: "note", name: "note", value: "hello {{username}}", enabled: true }]
      }
    }, qa);

    expect(multipart.headers["Content-Type"]).toMatch(/^multipart\/form-data; boundary=relay-studio-/);
    expect(multipart.body).toContain('Content-Disposition: form-data; name="note"');
    expect(multipart.body).toContain("hello qa_user");
  });

  it("builds structured mixed multipart parts without reading local files in the frontend", () => {
    const request = buildExecutableRequest({
      ...createOrder,
      headers: [{ id: "manual", name: "Content-Type", value: "multipart/form-data", enabled: true }],
      body: {
        contentType: "multipart/form-data",
        raw: "",
        fields: [
          { id: "note", name: "note", value: "hello {{username}}", enabled: true, valueType: "text" },
          { id: "attachment", name: "attachment", value: "/private/tmp/{{productId}}.png", enabled: true, valueType: "file", contentType: "image/png" }
        ]
      }
    }, qa);

    expect(request.body).toBeNull();
    expect(request.headers).not.toHaveProperty("Content-Type");
    expect(request.multipartParts).toEqual([
      { name: "note", value: "hello qa_user", kind: "text", contentType: null },
      { name: "attachment", value: "/private/tmp/prod-1001.png", kind: "file", contentType: "image/png" }
    ]);
  });

  it("rejects file-backed multipart requests in browser development mode", async () => {
    const request = buildExecutableRequest({
      ...createOrder,
      headers: [],
      body: {
        contentType: "multipart/form-data",
        raw: "",
        fields: [{ id: "attachment", name: "attachment", value: "/private/tmp/report.pdf", enabled: true, valueType: "file" }]
      }
    }, qa);

    await expect(fetchHttpTransport(request)).rejects.toThrow("Multipart file uploads require Relay Studio desktop mode");
  });

  it("rejects malformed form rows instead of silently dropping them", () => {
    expect(() => buildExecutableRequest({
      ...createOrder,
      body: {
        contentType: "application/x-www-form-urlencoded",
        raw: "",
        fields: [{ id: "blank", name: " ", value: "value", enabled: true }]
      }
    }, qa)).toThrow("Enabled form fields require a name.");
  });

  it("handles empty forms and rejects multipart header injection", () => {
    const empty = buildExecutableRequest({
      ...createOrder,
      headers: [],
      body: { contentType: "application/x-www-form-urlencoded", raw: "", fields: [] }
    }, qa);
    expect(empty.body).toBeNull();

    expect(() => buildExecutableRequest({
      ...createOrder,
      headers: [],
      body: { contentType: "multipart/form-data", raw: "", fields: [{ id: "bad", name: "bad\r\nheader", value: "x", enabled: true }] }
    }, qa)).toThrow("cannot contain line breaks");
  });

  it("applies project request settings to executable requests and response parsing", async () => {
    const settings = {
      ...project.settings,
      requestTimeoutMs: 45_000,
      maxResponseTimeMs: 10,
      responseFormatDetection: "json" as const,
      disableCookies: true
    };
    const request = buildExecutableRequest(createOrder, qa, settings);

    expect(request.timeoutMs).toBe(45_000);
    expect(request.disableCookies).toBe(true);
    expect(request.responseFormatDetection).toBe("json");

    const result = await runServiceRequest(createOrder, qa, async () => ({
      status: 200,
      statusText: "OK",
      headers: { "content-type": "text/plain" },
      body: `{"ok":true}`,
      durationMs: 42
    }), settings);

    expect(result.response?.prettyBody).toContain('"ok": true');
    expect(result.events.map((event) => event.message)).toContain("Response exceeded the 10 ms maximum response time.");
  });

  it("runs a successful request with deterministic console event order", async () => {
    const transport = vi.fn().mockResolvedValue({
      status: 200,
      statusText: "OK",
      headers: { "content-type": "application/json" },
      body: `{"orderId":"ord-1","status":"created"}`,
      durationMs: 42
    }) as HttpTransport & ReturnType<typeof vi.fn>;

    const result = await runServiceRequest(createOrder, qa, transport);

    expect(transport).toHaveBeenCalledWith(expect.objectContaining({ url: "https://api.example.com/api/orders" }));
    expect(result.response?.prettyBody).toContain('"orderId": "ord-1"');
    expect(result.error).toBeNull();
    expect(result.events.map((event) => event.phase)).toEqual([
      "prepare",
      "resolveVariables",
      "openConnection",
      "sendRequest",
      "receiveResponse",
      "parseResponse",
      "success"
    ]);
  });

  it("blocks invalid service definitions before transport execution", async () => {
    const transport = vi.fn();
    const invalid = { ...createOrder, path: "api/orders" };

    const result = await runServiceRequest(invalid, qa, transport);

    expect(transport).not.toHaveBeenCalled();
    expect(result.error).toBe("Path must start with /.");
    expect(result.events.map((event) => event.phase)).toEqual(["prepare", "error"]);
  });

  it("reports missing bearer tokens before sending", async () => {
    const environment: ProjectEnvironment = {
      ...qa,
      variables: qa.variables.map((variable) => variable.name === "accessToken" ? { ...variable, value: "" } : variable)
    };

    const result = await runServiceRequest(createOrder, environment, vi.fn());

    expect(result.error).toBe("Bearer token variable is empty.");
    expect(result.events[result.events.length - 1]).toMatchObject({ phase: "error", message: "Bearer token variable is empty." });
  });

  it("classifies non-2xx responses without treating them as transport failures", async () => {
    const result = await runServiceRequest(createOrder, qa, async () => ({
      status: 403,
      statusText: "Forbidden",
      headers: { "content-type": "application/json" },
      body: `{"message":"forbidden"}`,
      durationMs: 17
    }));

    expect(result.response?.ok).toBe(false);
    expect(result.response?.status).toBe(403);
    expect(result.error).toBeNull();
    expect(result.events[result.events.length - 1]).toMatchObject({ phase: "error", message: "Request completed with HTTP 403." });
  });

  it("captures login bearer tokens without logging the token", async () => {
    const result = await runServiceRequest(login, qa, async () => ({
      status: 200,
      statusText: "OK",
      headers: { "content-type": "application/json" },
      body: `{"accessToken":"secret-login-token","user":{"id":"u_1"}}`,
      durationMs: 31
    }));

    expect(result.response?.capturedVariables).toEqual([{ name: "accessToken", value: "secret-login-token", secret: true }]);
    expect(result.events.map((event) => event.message).join(" ")).not.toContain("secret-login-token");
  });

  it("reports malformed JSON responses", async () => {
    const response = normalizeResponse(createOrder, {
      status: 200,
      statusText: "OK",
      headers: { "Content-Type": "application/json" },
      body: "{ broken",
      durationMs: 9
    });

    expect(response.parseError).toBe("Response body is not valid JSON.");
    expect(response.prettyBody).toBe("{ broken");
  });

  it("emits parse errors during a completed run", async () => {
    const result = await runServiceRequest(createOrder, qa, async () => ({
      status: 200,
      statusText: "OK",
      headers: { "content-type": "application/json" },
      body: "{ broken",
      durationMs: 12
    }));

    expect(result.error).toBe("Response body is not valid JSON.");
    expect(result.events.map((event) => event.phase)).toContain("parseResponse");
    expect(result.events[result.events.length - 1]).toMatchObject({ phase: "error", message: "Response body is not valid JSON." });
  });

  it("passes through raw non-JSON bodies and empty bodies", () => {
    expect(parseResponseBody("plain text", "text/plain")).toEqual({ prettyBody: "plain text", parseError: null });
    expect(parseResponseBody("", "application/json")).toEqual({ prettyBody: "", parseError: null });
  });

  it("rejects response bodies larger than the execution limit before formatting", () => {
    expect(() => normalizeResponse(createOrder, {
      status: 200,
      statusText: "OK",
      headers: { "content-type": "application/json" },
      body: "x".repeat(MAX_RESPONSE_BODY_BYTES + 1),
      durationMs: 1
    })).toThrow("Response body exceeds");
  });

  it("ignores token capture for non-login, non-json, invalid, or tokenless responses", () => {
    expect(extractCapturedVariables(createOrder, `{"accessToken":"ignored"}`, "application/json")).toEqual([]);
    expect(extractCapturedVariables(login, "not-json", "application/json")).toEqual([]);
    expect(extractCapturedVariables(login, `{"user":"u_1"}`, "application/json")).toEqual([]);
    expect(extractCapturedVariables(login, `{"accessToken":"ignored"}`, "text/plain")).toEqual([]);
  });

  it("runs unauthenticated health checks without generated auth", () => {
    const request = buildExecutableRequest(health, qa);

    expect(request.url).toBe("https://api.example.com/api/health");
    expect(request.headers.Authorization).toBeUndefined();
    expect(request.body).toBeNull();
  });

  it("builds runtime headers for alternate auth modes", () => {
    const apiKey = buildExecutableRequest({
      ...health,
      authProfile: { type: "apiKey", apiKeyName: "X-API-Key", apiKeyValue: "{{accessToken}}" },
      auth: "apiKey"
    }, qa);
    const basic = buildExecutableRequest({
      ...health,
      authProfile: { type: "basic", usernameVariable: "username", passwordVariable: "password" },
      auth: "basic"
    }, qa);
    const oauth = buildExecutableRequest({
      ...health,
      authProfile: { type: "oauthClientCredentials", clientIdVariable: "username", clientSecretVariable: "password", tokenUrl: "{{baseUrl}}/oauth/token" },
      auth: "oauthClientCredentials"
    }, qa);
    const custom = buildExecutableRequest({
      ...health,
      authProfile: { type: "customHeader", customHeaderName: "X-Custom-Auth", customHeaderValue: "{{password}}" },
      auth: "customHeader"
    }, qa);

    expect(apiKey.headers["X-API-Key"]).toBe("sample-access-token");
    expect(apiKey.redactedHeaders["X-API-Key"]).toBe("Bearer ********");
    expect(basic.headers.Authorization).toBe("Basic qa_user:sample-password");
    expect(oauth.headers.Authorization).toBe("Bearer {{oauthToken}}");
    expect(custom.headers["X-Custom-Auth"]).toBe("sample-password");
    expect(custom.redactedHeaders["X-Custom-Auth"]).toBe("Bearer ********");
  });

  it("uses literal basic auth credentials when they are not environment variable names", () => {
    const request = buildExecutableRequest({
      ...health,
      authProfile: { type: "basic", usernameVariable: "admin", passwordVariable: "CpqStudio!2026" },
      auth: "basic"
    }, qa);

    expect(request.headers.Authorization).toBe("Basic admin:CpqStudio!2026");
  });

  it("normalizes network and timeout errors into console errors", async () => {
    const network = await runServiceRequest(createOrder, qa, async () => {
      throw new Error("Network connection failed.");
    });
    const timeout = await runServiceRequest(createOrder, qa, async () => {
      throw new DOMException("Aborted", "AbortError");
    });

    expect(network.error).toBe("Network connection failed.");
    expect(timeout.error).toBe("Request timed out.");
    expect(network.typedError).toMatchObject({ category: "network", retryable: true });
    expect(timeout.typedError).toMatchObject({ category: "timeout", retryable: true });
  });

  it("retries retryable transport failures and records each retry", async () => {
    const transport = vi.fn()
      .mockRejectedValueOnce(new Error("Network connection failed."))
      .mockResolvedValueOnce({
        status: 200,
        statusText: "OK",
        headers: { "content-type": "application/json" },
        body: `{"ok":true}`,
        durationMs: 4
      });

    const result = await runServiceRequest({
      ...createOrder,
      retry: { attempts: 1, backoffMs: 0 }
    }, qa, transport);

    expect(transport).toHaveBeenCalledTimes(2);
    expect(result.error).toBeNull();
    expect(result.events.map((event) => event.message)).toContain("Retrying request after network failure (1 of 1).");
  });

  it("cancels a running request without retrying", async () => {
    const controller = new AbortController();
    const transport: HttpTransport = vi.fn(async (_request, signal) => new Promise<never>((_resolve, reject) => {
      signal?.addEventListener("abort", () => reject(new DOMException("Cancelled", "AbortError")), { once: true });
    }));

    const pending = runServiceRequest(createOrder, qa, transport, undefined, { signal: controller.signal });
    controller.abort();
    const result = await pending;

    expect(result.error).toBe("Request cancelled.");
    expect(result.typedError).toMatchObject({ category: "cancelled", code: "REQUEST_CANCELLED" });
    expect(transport).toHaveBeenCalledTimes(1);
  });

  it("normalizes non-Error thrown values", async () => {
    const result = await runServiceRequest(createOrder, qa, async () => {
      throw "string failure";
    });

    expect(result.error).toBe("string failure");
  });

  it("keeps invalid origins readable in console diagnostics", async () => {
    const environment = {
      ...qa,
      variables: qa.variables.map((variable) => variable.name === "baseUrl" ? { ...variable, value: "not-a-url" } : variable)
    };
    const result = await runServiceRequest(health, environment, async () => ({
      status: 200,
      statusText: "OK",
      headers: {},
      body: "",
      durationMs: 1
    }));

    expect(result.response?.contentType).toBe("");
    expect(result.events.find((event) => event.phase === "openConnection")?.message).toBe("Opening connection to not-a-url/api/health.");
  });

  it("delegates default transport to Tauri when available", async () => {
    window.__TAURI_INTERNALS__ = {};
    vi.mocked(invoke).mockResolvedValueOnce({
      status: 200,
      statusText: "OK",
      headers: {},
      body: "",
      durationMs: 1,
      finalUrl: "https://api.example.com/api/health/final"
    });

    await expect(defaultHttpTransport(buildExecutableRequest(health, qa))).resolves.toMatchObject({
      status: 200,
      finalUrl: "https://api.example.com/api/health/final"
    });
    expect(invoke).toHaveBeenCalledWith("execute_http_request", { request: buildExecutableRequest(health, qa) });
    delete window.__TAURI_INTERNALS__;
  });

  it("uses fetch transport outside Tauri", async () => {
    const originalFetch = window.fetch;
    vi.spyOn(performance, "now").mockReturnValueOnce(10).mockReturnValueOnce(25);
    window.fetch = vi.fn().mockResolvedValue({
      status: 200,
      statusText: "OK",
      url: "https://api.example.com/api/health/final",
      headers: new Headers({ "content-type": "application/json" }),
      text: () => Promise.resolve(`{"ok":true}`)
    });

    await expect(fetchHttpTransport(buildExecutableRequest(health, qa))).resolves.toMatchObject({
      status: 200,
      durationMs: 15,
      finalUrl: "https://api.example.com/api/health/final",
      body: `{"ok":true}`
    });
    expect(window.fetch).toHaveBeenCalledWith(
      "https://api.example.com/api/health",
      expect.objectContaining({ redirect: "manual" })
    );
    window.fetch = originalFetch;
  });

  it("blocks redirects in browser development mode before Fetch can replay request credentials", async () => {
    const originalFetch = window.fetch;
    window.fetch = vi.fn().mockResolvedValue(new Response(null, {
      status: 302,
      headers: { Location: "https://other.example.com/collect" }
    }));

    await expect(fetchHttpTransport(buildExecutableRequest(health, qa))).rejects.toThrow(
      "Browser development mode blocked an HTTP redirect"
    );
    expect(window.fetch).toHaveBeenCalledWith(
      "https://api.example.com/api/health",
      expect.objectContaining({ redirect: "manual" })
    );
    window.fetch = originalFetch;
  });

  it("rejects browser responses whose declared body exceeds the limit", async () => {
    const originalFetch = window.fetch;
    window.fetch = vi.fn().mockResolvedValue({
      status: 200,
      statusText: "OK",
      url: "https://api.example.com/api/health",
      headers: new Headers({ "content-length": String(MAX_RESPONSE_BODY_BYTES + 1) }),
      text: () => Promise.resolve("not-read")
    });

    await expect(fetchHttpTransport(buildExecutableRequest(health, qa))).rejects.toThrow("Response body exceeds");
    expect(window.fetch).toHaveBeenCalledTimes(1);
    window.fetch = originalFetch;
  });

  it("reads browser response streams within the byte limit", async () => {
    const originalFetch = window.fetch;
    const stream = new ReadableStream<Uint8Array>({
      start(controller) {
        controller.enqueue(new TextEncoder().encode('{"ok":true}'));
        controller.close();
      }
    });
    window.fetch = vi.fn().mockResolvedValue({
      status: 200,
      statusText: "OK",
      url: "https://api.example.com/api/health",
      headers: new Headers({ "content-type": "application/json" }),
      body: stream
    });

    await expect(fetchHttpTransport(buildExecutableRequest(health, qa))).resolves.toMatchObject({ body: '{"ok":true}' });
    window.fetch = originalFetch;
  });

  it("cancels a browser response stream after the byte limit", async () => {
    const originalFetch = window.fetch;
    const cancel = vi.fn().mockResolvedValue(undefined);
    const stream = new ReadableStream<Uint8Array>({
      pull(controller) {
        controller.enqueue(new Uint8Array(MAX_RESPONSE_BODY_BYTES + 1));
      },
      cancel
    });
    window.fetch = vi.fn().mockResolvedValue({
      status: 200,
      statusText: "OK",
      url: "https://api.example.com/api/health",
      headers: new Headers(),
      body: stream
    });

    await expect(fetchHttpTransport(buildExecutableRequest(health, qa))).rejects.toThrow("Response body exceeds");
    expect(cancel).toHaveBeenCalled();
    window.fetch = originalFetch;
  });
});
