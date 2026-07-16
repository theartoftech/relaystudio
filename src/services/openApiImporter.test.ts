import { discoverDefinitionUrl, loadOpenApiFromUrl, parseOpenApiDocument, parseOpenApiText, selectedOperationsToServices } from "./openApiImporter";

const document = {
  openapi: "3.0.4",
  info: { title: "Orders API", version: "1" },
  servers: [{ url: "https://api.example.com/v1" }],
  components: { securitySchemes: { bearerAuth: { type: "http", scheme: "bearer" } } },
  security: [{ bearerAuth: [] }],
  paths: {
    "/orders/{orderId}": {
      parameters: [{ name: "orderId", in: "path", required: true, schema: { type: "string" } }],
      get: { operationId: "getOrder", summary: "Get order", parameters: [{ name: "expand", in: "query", schema: { type: "boolean", example: true } }] },
      post: { operationId: "updateOrder", requestBody: { content: { "application/json": { schema: { type: "object", properties: { status: { type: "string", example: "ready" } } } } } } }
    }
  }
};

describe("OpenAPI importer", () => {
  it("discovers relative definitions from Swagger UI HTML", () => {
    expect(discoverDefinitionUrl('<script>SwaggerUIBundle({ url: "./openapi.json" })</script>', "https://example.com/docs/")).toBe("https://example.com/docs/openapi.json");
    expect(discoverDefinitionUrl('<script>url: "/v3/api-docs"</script>', "https://example.com/swagger")).toBe("https://example.com/v3/api-docs");
  });

  it("parses selectable operations and converts selected operations without secrets", () => {
    const parsed = parseOpenApiDocument(document, "https://example.com/openapi.json");
    expect(parsed.operations.map((operation) => operation.label)).toEqual(["Get order", "updateOrder"]);

    const services = selectedOperationsToServices(parsed, parsed.operations.map((operation) => operation.id), []);
    expect(services).toHaveLength(2);
    expect(services[0]).toMatchObject({ method: "GET", path: "/orders/{orderId}", authProfile: { type: "bearer", tokenVariable: "accessToken" } });
    expect(services[0].queryParams[0].value).toBe("true");
    expect(services[1].body.raw).toContain('"status": "ready"');
    expect(JSON.stringify(services)).not.toContain("Bearer ey");
  });

  it("rejects documents without supported operations", () => {
    expect(() => parseOpenApiDocument({ openapi: "3.0.0", paths: {} }, "https://example.com/openapi.json")).toThrow("supported REST operations");
  });

  it("parses YAML, references, arrays, defaults, enums, and API key auth", () => {
    const parsed = parseOpenApiText(`
openapi: 3.0.4
info: { title: Catalog API }
servers: [{ url: /api }]
security: [{ apiKey: [] }]
components:
  securitySchemes:
    apiKey: { type: apiKey, in: header, name: X-API-Key }
  parameters:
    trace: { name: X-Trace, in: header, schema: { type: string, default: trace-1 } }
  schemas:
    item:
      type: object
      properties:
        enabled: { type: boolean }
        count: { type: integer }
        role: { type: string, enum: [admin, user] }
paths:
  /items:
    get:
      tags: [Catalog]
      parameters: [{ $ref: '#/components/parameters/trace' }]
    post:
      requestBody:
        content:
          application/json:
            schema: { $ref: '#/components/schemas/item' }
`, "https://example.com/openapi.yaml");
    const services = selectedOperationsToServices(parsed, parsed.operations.map((item) => item.id), ["get-items"]);
    expect(parsed.serverUrl).toBe("https://example.com/api");
    expect(services[0].id).toBe("get-items-2");
    expect(services[0].headers[0]).toMatchObject({ name: "X-Trace", value: "trace-1" });
    expect(services[0].authProfile).toMatchObject({ type: "apiKey", apiKeyName: "X-API-Key", apiKeyValue: "{{apiKey}}" });
    expect(services[1].body.raw).toContain('"role": "admin"');
  });

  it("supports Swagger 2 base paths and basic auth", () => {
    const parsed = parseOpenApiDocument({ swagger: "2.0", info: { title: "Legacy" }, schemes: ["http"], host: "legacy.test", basePath: "/v2", securityDefinitions: { basic: { type: "basic" } }, security: [{ basic: [] }], paths: { "/users": { delete: { description: "remove" } } } }, "https://legacy.test/swagger.json");
    const service = selectedOperationsToServices(parsed, ["delete:/users"], [])[0];
    expect(parsed.serverUrl).toBe("http://legacy.test/v2");
    expect(service.authProfile).toMatchObject({ type: "basic", usernameVariable: "username", passwordVariable: "password" });
  });

  it("handles operation overrides, ignored headers, path placeholders, and explicit examples", () => {
    const parsed = parseOpenApiDocument({ openapi: "3.0.0", info: {}, components: { securitySchemes: { oauth: { type: "oauth2" } } }, security: [{ oauth: [] }], paths: { "/pets/{id}": { parameters: [{ name: "id", in: "path", required: true }, { name: "Authorization", in: "header" }], put: { deprecated: true, tags: [], parameters: [{ name: "q", in: "query", example: [1, 2] }, { name: "X-Optional", in: "header" }], requestBody: { content: { "application/json": { example: { name: "Fido" } } } } } } } }, "https://pets.test/spec.json");
    const service = selectedOperationsToServices(parsed, ["put:/pets/{id}"], [])[0];
    expect(parsed.title).toBe("Imported API");
    expect(service.pathParams[0].value).toBe("");
    expect(service.queryParams[0].value).toBe("[1,2]");
    expect(service.headers).toHaveLength(1);
    expect(service.body.raw).toContain("Fido");
    expect(service.authProfile.type).toBe("none");
  });

  it("loads direct definitions and Swagger pages and reports HTTP failures", async () => {
    const fetchMock = vi.spyOn(globalThis, "fetch");
    fetchMock.mockResolvedValueOnce(new Response(JSON.stringify(document), { status: 200, headers: { "content-type": "application/json" } }));
    expect((await loadOpenApiFromUrl("https://example.com/openapi.json")).operations).toHaveLength(2);
    fetchMock.mockResolvedValueOnce(new Response('<script>url: "./spec.yaml"</script>', { status: 200, headers: { "content-type": "text/html" } }));
    fetchMock.mockResolvedValueOnce(new Response("openapi: 3.0.0\npaths:\n  /health:\n    get: {}", { status: 200 }));
    expect((await loadOpenApiFromUrl("https://example.com/docs/")).definitionUrl).toBe("https://example.com/docs/spec.yaml");
    fetchMock.mockResolvedValueOnce(new Response("missing", { status: 404, statusText: "Not Found" }));
    await expect(loadOpenApiFromUrl("https://example.com/missing")).rejects.toThrow("HTTP 404");
    fetchMock.mockRestore();
  });

  it("resolves same-origin external references and imports PATCH form bodies", async () => {
    const fetchMock = vi.spyOn(globalThis, "fetch");
    fetchMock.mockImplementation(async (input) => String(input).endsWith("common.yaml") ? new Response(`
parameters:
  profileId: { name: id, in: path, required: true, schema: { type: string, format: uuid } }
requestBodies:
  profileForm:
    content:
      application/x-www-form-urlencoded:
        schema:
          type: object
          properties:
            displayName: { type: string, example: Developer }
            password: { type: string, example: should-never-import }
`, { status: 200, headers: { "content-type": "application/yaml" } }) : new Response(JSON.stringify({
      openapi: "3.1.0",
      info: { title: "Developer API" },
      paths: {
        "/profiles/{id}": {
          patch: {
            parameters: [{ $ref: "./common.yaml#/parameters/profileId" }],
            requestBody: { $ref: "./common.yaml#/requestBodies/profileForm" }
          }
        }
      }
    }), { status: 200, headers: { "content-type": "application/json" } }));

    const parsed = await loadOpenApiFromUrl("https://api.test/openapi.json");
    const service = selectedOperationsToServices(parsed, ["patch:/profiles/{id}"], [])[0];

    expect(service.method).toBe("PATCH");
    expect(service.pathParams[0]).toMatchObject({ name: "id", enabled: true });
    expect(service.body.contentType).toBe("application/x-www-form-urlencoded");
    expect(service.body.fields).toEqual(expect.arrayContaining([
      expect.objectContaining({ name: "displayName", value: "Developer" }),
      expect.objectContaining({ name: "password", value: "{{password}}" })
    ]));
    expect(JSON.stringify(service)).not.toContain("should-never-import");
    fetchMock.mockRestore();
  });

  it("imports binary multipart properties as empty local file fields", () => {
    const parsed = parseOpenApiDocument({
      openapi: "3.1.0",
      info: { title: "Upload API" },
      paths: {
        "/assets": {
          post: {
            summary: "Upload asset",
            requestBody: {
              content: {
                "multipart/form-data": {
                  encoding: { asset: { contentType: "image/png" } },
                  schema: {
                    type: "object",
                    properties: {
                      description: { type: "string", example: "Profile image" },
                      asset: { type: "string", format: "binary", example: "/Users/example/private.png" }
                    }
                  }
                }
              }
            }
          }
        }
      }
    }, "https://api.test/openapi.json");

    const service = selectedOperationsToServices(parsed, ["post:/assets"], [])[0];
    expect(service.body.fields).toEqual([
      expect.objectContaining({ name: "description", value: "Profile image", valueType: "text" }),
      expect.objectContaining({ name: "asset", value: "", valueType: "file", contentType: "image/png" })
    ]);
    expect(JSON.stringify(service)).not.toContain("private.png");
  });

  it("rejects cross-origin, circular, and unreachable external references", async () => {
    const fetchMock = vi.spyOn(globalThis, "fetch");
    fetchMock.mockResolvedValueOnce(new Response(JSON.stringify({ openapi: "3.0.0", paths: { "/x": { get: { parameters: [{ $ref: "https://other.test/common.json#/id" }] } } } }), { status: 200 }));
    await expect(loadOpenApiFromUrl("https://api.test/openapi.json")).rejects.toThrow("Cross-origin OpenAPI reference is blocked");

    fetchMock.mockResolvedValueOnce(new Response(JSON.stringify({ openapi: "3.0.0", paths: { "/x": { get: { parameters: [{ $ref: "./common.json#/a" }] } } } }), { status: 200 }));
    fetchMock.mockResolvedValueOnce(new Response(JSON.stringify({ a: { $ref: "#/b" }, b: { $ref: "#/a" } }), { status: 200 }));
    await expect(loadOpenApiFromUrl("https://api.test/openapi.json")).rejects.toThrow("Circular OpenAPI reference");

    fetchMock.mockResolvedValueOnce(new Response(JSON.stringify({ openapi: "3.0.0", paths: { "/x": { get: { parameters: [{ $ref: "./missing.json#/id" }] } } } }), { status: 200 }));
    fetchMock.mockResolvedValueOnce(new Response("missing", { status: 404, statusText: "Not Found" }));
    await expect(loadOpenApiFromUrl("https://api.test/openapi.json")).rejects.toThrow("HTTP 404");
    fetchMock.mockRestore();
  });

  it("rejects malformed, missing, and excessively deep reference graphs", async () => {
    const fetchMock = vi.spyOn(globalThis, "fetch");
    fetchMock.mockImplementation(async (input) => {
      const url = String(input);
      if (url.endsWith("malformed.json")) return new Response(JSON.stringify({ value: { name: "id", in: "query" } }), { status: 200 });
      if (url.endsWith("scalar.json")) return new Response("- not-an-object", { status: 200 });
      return new Response(JSON.stringify({ openapi: "3.0.0", paths: { "/x": { get: { parameters: [{ $ref: url.includes("missing-root") ? "./malformed.json#/missing" : url.includes("scalar-root") ? "./scalar.json#/0" : "./malformed.json#value" }] } } } }), { status: 200 });
    });
    await expect(loadOpenApiFromUrl("https://api.test/malformed-root.json")).rejects.toThrow("Malformed OpenAPI reference");
    await expect(loadOpenApiFromUrl("https://api.test/missing-root.json")).rejects.toThrow("target was not found");
    await expect(loadOpenApiFromUrl("https://api.test/scalar-root.json")).rejects.toThrow("Referenced OpenAPI document must be an object");
    fetchMock.mockRestore();

    let nested: Record<string, unknown> = { get: {} };
    for (let index = 0; index < 34; index += 1) nested = { nested };
    const deepFetch = vi.spyOn(globalThis, "fetch").mockResolvedValue(new Response(JSON.stringify({ openapi: "3.0.0", paths: { "/x": nested } }), { status: 200 }));
    await expect(loadOpenApiFromUrl("https://api.test/deep.json")).rejects.toThrow("depth exceeds");
    deepFetch.mockRestore();
  });

  it("creates safe examples for composition and common formats", () => {
    const parsed = parseOpenApiDocument({
      openapi: "3.1.0",
      paths: { "/examples": { options: {}, head: {}, post: { requestBody: { content: { "application/json": { schema: {
        type: "object",
        properties: {
          id: { type: "string", format: "uuid" },
          createdAt: { type: "string", format: "date-time" },
          choice: { oneOf: [{ type: "string", enum: ["safe"] }, { type: "integer" }] },
          password: { type: "string", example: "real-secret" }
        }
      } } } } } } }
    }, "https://api.test/openapi.json");
    const service = selectedOperationsToServices(parsed, ["post:/examples"], [])[0];
    expect(parsed.operations.map((operation) => operation.method)).toEqual(["POST", "HEAD", "OPTIONS"]);
    expect(parsed.review).toMatchObject({ operationCount: 3, externalDocumentCount: 0, formBodyCount: 0 });
    expect(service.body.raw).toContain("00000000-0000-4000-8000-000000000000");
    expect(service.body.raw).toContain("{{password}}");
    expect(service.body.raw).not.toContain("real-secret");
  });

  it("creates examples for arrays, allOf, anyOf, defaults, dates, email, and write-only-safe objects", () => {
    const parsed = parseOpenApiDocument({ openapi: "3.1.0", paths: { "/examples": { post: { requestBody: { content: { "application/json": { schema: {
      type: "object",
      properties: {
        list: { type: "array", items: { type: "boolean" } },
        combined: { allOf: [{ type: "object", properties: { count: { type: "number" } } }, { type: "object", properties: { date: { type: "string", format: "date" } } }] },
        fallback: { anyOf: [{ type: "string", default: "chosen" }, { type: "number" }] },
        email: { type: "string", format: "email" },
        ignored: { type: "string", readOnly: true }
      }
    } } } } } } } }, "https://api.test/openapi.json");
    const body = JSON.parse(selectedOperationsToServices(parsed, ["post:/examples"], [])[0].body.raw);
    expect(body).toEqual({ list: [false], combined: { count: 0, date: "2026-01-01" }, fallback: "chosen", email: "developer@example.invalid" });
  });

  it("rejects invalid URL protocols, malformed definitions, and undiscoverable pages", async () => {
    await expect(loadOpenApiFromUrl("file:///tmp/openapi.json")).rejects.toThrow("HTTP or HTTPS");
    await expect(loadOpenApiFromUrl(" ")).rejects.toThrow("required");
    expect(() => parseOpenApiText("not: [valid", "https://example.com/spec.yaml")).toThrow("valid JSON or YAML");
    expect(() => parseOpenApiDocument(null, "https://example.com/spec.json")).toThrow("must be an object");
    expect(() => parseOpenApiDocument({ openapi: "3.0.0" }, "https://example.com/spec.json")).toThrow("missing paths");
    expect(() => discoverDefinitionUrl("<html>Swagger UI</html>", "https://example.com/docs")).toThrow("does not expose");
  });
});
