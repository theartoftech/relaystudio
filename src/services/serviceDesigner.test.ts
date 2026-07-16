import { describe, expect, it } from "vitest";
import { createSampleProject, type ProjectEnvironment, type ProjectService } from "../project/projectModel";
import {
  buildRequestPreview,
  buildUrl,
  createService,
  deleteService,
  duplicateService,
  findVariableReferences,
  formatJsonBody,
  minifyJsonBody,
  removeRow,
  renameService,
  reorderService,
  upsertRow,
  validateService
} from "./serviceDesigner";

const project = createSampleProject("2026-06-21T00:00:00.000Z");
const qa = project.environments[0];
const createOrder = project.services.find((service) => service.id === "create-order") as ProjectService;

describe("service designer helpers", () => {
  it("creates a default reusable REST service", () => {
    expect(createService({ id: "health", name: "Health Check", path: "/health" })).toMatchObject({
      id: "health",
      name: "Health Check",
      method: "GET",
      path: "/health",
      timeoutMs: 30000,
      authProfile: { type: "bearer", tokenVariable: "accessToken" }
    });
  });

  it("duplicates, renames, deletes, and reorders services", () => {
    const copy = duplicateService(createOrder, project.services.map((service) => service.id));
    expect(copy.id).toBe("create-order-copy");
    expect(copy.name).toBe("Create Order Copy");
    expect(copy.headers[0].id).toBe("create-order-copy-0");

    expect(renameService(copy, " Submit Order ")).toMatchObject({ name: "Submit Order" });
    expect(renameService(copy, "   ")).toMatchObject({ name: "Create Order Copy" });
    expect(deleteService([createOrder, copy], createOrder.id)).toEqual([copy]);
    expect(reorderService([createOrder, copy], copy.id, "up")).toEqual([copy, createOrder]);
    expect(reorderService([createOrder, copy], createOrder.id, "up")).toEqual([createOrder, copy]);
    expect(reorderService([createOrder, copy], "missing", "down")).toEqual([createOrder, copy]);
  });

  it("upserts and removes request rows", () => {
    const first = { id: "one", name: "Accept", value: "application/json", enabled: true };
    const replacement = { ...first, value: "text/plain" };

    expect(upsertRow([], first)).toEqual([first]);
    expect(upsertRow([first], replacement)).toEqual([replacement]);
    expect(removeRow([replacement], "one")).toEqual([]);
  });

  it("builds a resolved URL from base URL, path params, and query params", () => {
    const service = {
      ...project.services.find((item) => item.id === "search-products")!,
      pathParams: [{ id: "category", name: "category", value: "office supplies", enabled: true }],
      path: "/api/products/{category}"
    };

    expect(buildUrl(service, qa)).toBe("https://api.example.com/api/products/office%20supplies?q=keyboard");
    expect(buildUrl(project.services.find((item) => item.id === "get-product")!, qa)).toBe("https://api.example.com/api/products/prod-1001");
  });

  it("builds a redacted bearer auth preview", () => {
    const preview = buildRequestPreview(createOrder, qa);

    expect(preview.method).toBe("POST");
    expect(preview.url).toBe("https://api.example.com/api/orders");
    expect(preview.generatedAuthHeader).toEqual({
      id: "generated-auth",
      name: "Authorization",
      value: "Bearer ********",
      enabled: true
    });
    expect(preview.body).toContain("productId");
    expect(preview.issues).toEqual([]);
  });

  it("builds previews for all supported auth modes without exposing secrets", () => {
    const apiKey = buildRequestPreview(createService({
      authProfile: { type: "apiKey", apiKeyName: "X-API-Key", apiKeyValue: "{{accessToken}}" }
    }), qa);
    const basic = buildRequestPreview(createService({
      authProfile: { type: "basic", usernameVariable: "username", passwordVariable: "password" }
    }), qa);
    const oauth = buildRequestPreview(createService({
      authProfile: {
        type: "oauthClientCredentials",
        clientIdVariable: "username",
        clientSecretVariable: "password",
        tokenUrl: "{{baseUrl}}/oauth/token"
      }
    }), qa);
    const custom = buildRequestPreview(createService({
      authProfile: { type: "customHeader", customHeaderName: "X-Relay-Auth", customHeaderValue: "{{password}}" }
    }), qa);
    const none = buildRequestPreview(createService({ authProfile: { type: "none" }, auth: "none" }), qa);

    expect(apiKey.generatedAuthHeader?.value).toBe("********");
    expect(basic.generatedAuthHeader?.value).toBe("Basic qa_user:********");
    expect(oauth.generatedAuthHeader?.value).toBe("Bearer ********");
    expect(custom.generatedAuthHeader).toMatchObject({ name: "X-Relay-Auth", value: "********" });
    expect(none.generatedAuthHeader).toBeNull();
  });

  it("accepts literal basic auth credentials when no matching variables exist", () => {
    const preview = buildRequestPreview(createService({
      authProfile: { type: "basic", usernameVariable: "admin", passwordVariable: "CpqStudio!2026" }
    }), qa);

    expect(preview.issues).toEqual([]);
    expect(preview.generatedAuthHeader?.value).toBe("Basic admin:********");
  });

  it("validates unsupported methods, bad paths, ranges, duplicates, missing path params, and malformed JSON", () => {
    const service = {
      ...createOrder,
      method: "TRACE",
      path: "api/orders/{orderId}",
      timeoutMs: 0,
      retry: { attempts: 11, backoffMs: 60_001 },
      headers: [
        { id: "a", name: "X-Test", value: "one", enabled: true },
        { id: "b", name: "x-test", value: "two", enabled: true }
      ],
      queryParams: [
        { id: "qa", name: "mode", value: "one", enabled: true },
        { id: "qb", name: "mode", value: "two", enabled: true }
      ],
      pathParams: [],
      body: { contentType: "application/json", raw: "{ broken" }
    } as unknown as ProjectService;

    expect(validateService(service, qa).map((issue) => issue.field)).toEqual([
      "method",
      "path",
      "timeoutMs",
      "retry.attempts",
      "retry.backoffMs",
      "headers",
      "queryParams",
      "pathParams",
      "body"
    ]);
  });

  it("validates missing auth details for each credential mode", () => {
    const modes = [
      { type: "bearer" },
      { type: "apiKey" },
      { type: "basic" },
      { type: "oauthClientCredentials" },
      { type: "customHeader" }
    ] as const;

    expect(modes.map((authProfile) => validateService(createService({ authProfile }), qa)[0].message)).toEqual([
      "Bearer auth requires an existing token variable name.",
      "API key auth requires a header name and value.",
      "Basic auth requires username and password.",
      "OAuth client credentials require client id, client secret, and token URL.",
      "Custom header auth requires a header name and value."
    ]);
  });

  it("warns on unknown variable references", () => {
    const service = createService({
      headers: [{ id: "h", name: "X-Unknown", value: "{{missing}}", enabled: true }],
      body: { contentType: "text/plain", raw: "{{alsoMissing}}" }
    });

    expect(validateService(service, qa).filter((issue) => issue.field === "variables").map((issue) => issue.message)).toEqual([
      "Unknown variable: missing.",
      "Unknown variable: alsoMissing."
    ]);
  });

  it("validates multipart file paths and rejects file fields in URL-encoded bodies", () => {
    const missingPath = createService({
      body: {
        contentType: "multipart/form-data",
        raw: "",
        fields: [{ id: "upload", name: "upload", value: "", enabled: true, valueType: "file" }]
      }
    });
    const incompatible = createService({
      body: {
        contentType: "application/x-www-form-urlencoded",
        raw: "",
        fields: [{ id: "upload", name: "upload", value: "/private/tmp/file.txt", enabled: true, valueType: "file" }]
      }
    });

    expect(validateService(missingPath, qa)).toEqual(expect.arrayContaining([
      expect.objectContaining({ field: "body.fields", message: "Enabled multipart file fields require a local file path." })
    ]));
    expect(validateService(incompatible, qa)).toEqual(expect.arrayContaining([
      expect.objectContaining({ field: "body.fields", message: "File fields require a multipart/form-data body." })
    ]));
  });

  it("formats and minifies JSON bodies", () => {
    expect(formatJsonBody(`{"a":1}`)).toBe("{\n  \"a\": 1\n}");
    expect(minifyJsonBody(`{\n  "a": 1\n}`)).toBe("{\"a\":1}");
    expect(() => formatJsonBody("{bad")).toThrow();
  });

  it("finds unique variable references", () => {
    expect(findVariableReferences("{{baseUrl}}/{{ id }}/{{baseUrl}}/{{api.token}}")).toEqual(["baseUrl", "id", "api.token"]);
  });

  it("handles missing baseUrl in previews without throwing", () => {
    const environment: ProjectEnvironment = { id: "empty", name: "Empty", variables: [] };

    expect(buildRequestPreview(createOrder, environment).url).toBe("/api/orders");
  });
});
