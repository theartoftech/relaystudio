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

  it("rejects invalid URL protocols, malformed definitions, and undiscoverable pages", async () => {
    await expect(loadOpenApiFromUrl("file:///tmp/openapi.json")).rejects.toThrow("HTTP or HTTPS");
    await expect(loadOpenApiFromUrl(" ")).rejects.toThrow("required");
    expect(() => parseOpenApiText("not: [valid", "https://example.com/spec.yaml")).toThrow("valid JSON or YAML");
    expect(() => parseOpenApiDocument(null, "https://example.com/spec.json")).toThrow("must be an object");
    expect(() => parseOpenApiDocument({ openapi: "3.0.0" }, "https://example.com/spec.json")).toThrow("missing paths");
    expect(() => discoverDefinitionUrl("<html>Swagger UI</html>", "https://example.com/docs")).toThrow("does not expose");
  });
});
