import { describe, expect, it } from "vitest";
import { createSampleProject } from "./projectModel";
import { parseProjectImport, prepareProjectForExport, validateProjectSchema } from "./projectSchema";

describe("project schema hardening", () => {
  it("accepts the current schema and rejects unsupported project payloads with recovery guidance", () => {
    expect(validateProjectSchema(createSampleProject())).toEqual([]);
    expect(validateProjectSchema({ format: "other", schemaVersion: 99 })).toEqual(expect.arrayContaining([
      expect.objectContaining({ path: "format" }),
      expect.objectContaining({ path: "schemaVersion" }),
      expect.objectContaining({ path: "services" })
    ]));
    expect(() => prepareProjectForExport({ format: "other" })).toThrow("Project schema is invalid");
  });

  it("redacts secrets from exported project state without mutating the workspace", () => {
    const project = createSampleProject();
    project.services[0] = {
      ...project.services[0],
      headers: [{ id: "auth", name: "Authorization", value: "Bearer literal-header-secret", enabled: true }],
      body: { contentType: "application/json", raw: `{"password":"literal-body-secret","visible":"ok"}` },
      authProfile: { type: "apiKey", apiKeyName: "X-API-Key", apiKeyValue: "literal-api-key-secret" }
    };
    const exported = prepareProjectForExport(project);
    const originalSecret = project.environments[0].variables.find((variable) => variable.name === "accessToken");
    const exportedSecret = exported.environments[0].variables.find((variable) => variable.name === "accessToken");

    expect(originalSecret?.value).toBe("sample-access-token");
    expect(exportedSecret?.value).toBe("");
    expect(exported.settings.proxy.password).toBe("");
    expect(JSON.stringify(exported)).not.toContain("literal-header-secret");
    expect(JSON.stringify(exported)).not.toContain("literal-body-secret");
    expect(JSON.stringify(exported)).not.toContain("literal-api-key-secret");
    expect(exported.services[0].body.raw).toContain('"visible": "ok"');
  });

  it("rejects malformed nested state with path-specific recovery guidance", () => {
    const malformed = createSampleProject();
    (malformed.services[0] as unknown as { retry: unknown }).retry = { attempts: "many", backoffMs: 10 };
    (malformed.flows[0].nodes[0] as unknown as { position: unknown }).position = { x: 10, y: "down" };
    (malformed.savedResponses[0] as unknown as { status: unknown }).status = "200";

    const issues = validateProjectSchema(malformed);

    expect(issues).toEqual(expect.arrayContaining([
      expect.objectContaining({ path: "services[0].retry.attempts" }),
      expect.objectContaining({ path: "flows[0].nodes[0].position.y" }),
      expect.objectContaining({ path: "savedResponses[0].status" })
    ]));
    expect(() => parseProjectImport(malformed)).toThrow(/Recovery: Open the \.backup file/);
  });

  it("migrates legacy schema-v1 settings and accepts zero retry attempts", () => {
    const legacy = structuredClone(createSampleProject()) as unknown as Record<string, unknown>;
    const services = legacy.services as Array<Record<string, unknown>>;
    services[0] = {
      ...services[0],
      retry: { attempts: 0, backoffMs: 0 }
    };
    legacy.settings = {
      askToSaveOnClose: true,
      redactSecretsInConsole: true,
      proxy: { enabled: true }
    };

    expect(validateProjectSchema(legacy)).toEqual([]);
    const migrated = parseProjectImport(legacy);

    expect(migrated.services[0].retry.attempts).toBe(0);
    expect(migrated.settings.defaultEnvironmentId).toBe(migrated.environments[0].id);
    expect(migrated.settings.askBeforeClosingUnsavedTabs).toBe(true);
    expect(migrated.settings.proxy.enabled).toBe(true);
    expect(migrated.settings.proxy.useForHttps).toBe(true);

    const withoutProxy = structuredClone(legacy);
    delete (withoutProxy.settings as Record<string, unknown>).proxy;
    expect(parseProjectImport(withoutProxy).settings.proxy.enabled).toBe(false);
  });

  it("reports malformed nested collections and settings without unsafe casts", () => {
    const malformed = structuredClone(createSampleProject()) as unknown as Record<string, unknown>;
    const services = malformed.services as Array<Record<string, unknown>>;
    services[0] = {
      ...services[0],
      method: "TRACE",
      timeoutMs: Number.POSITIVE_INFINITY,
      retry: null,
      headers: [null],
      queryParams: [{ id: "", name: 4, value: false, enabled: "yes", valueType: "stream", contentType: 3 }],
      body: { contentType: "application/xml", raw: 7, fields: "not-an-array" },
      authProfile: { type: "unknown", tokenUrl: 9 }
    };
    const environments = malformed.environments as Array<Record<string, unknown>>;
    environments[0] = { ...environments[0], variables: [null] };
    const flows = malformed.flows as Array<Record<string, unknown>>;
    flows[0] = { ...flows[0], steps: [7], nodes: [null], edges: [null], mappings: [null] };
    const savedResponses = malformed.savedResponses as Array<Record<string, unknown>>;
    savedResponses[0] = { ...savedResponses[0], method: "TRACE", bodyKind: "binary", redacted: "yes" };
    const importSources = malformed.importSources as Array<Record<string, unknown>>;
    importSources.push({ id: "", label: 2, source: false });
    malformed.settings = {
      defaultEnvironmentId: "",
      askToSaveOnClose: "yes",
      askBeforeClosingUnsavedTabs: true,
      redactSecretsInConsole: true,
      httpVersion: "http3",
      requestTimeoutMs: -1,
      maxResponseTimeMs: 10,
      sslCertificateVerification: true,
      sslTlsKeyLog: false,
      disableCookies: false,
      responseFormatDetection: "xml",
      workingDirectory: 5,
      theme: "system",
      proxy: null
    };

    const paths = validateProjectSchema(malformed).map((issue) => issue.path);

    expect(paths).toEqual(expect.arrayContaining([
      "services[0].method",
      "services[0].retry",
      "services[0].headers[0]",
      "services[0].body.fields",
      "environments[0].variables[0]",
      "flows[0].nodes[0]",
      "savedResponses[0].bodyKind",
      "importSources[0].label",
      "settings.proxy"
    ]));
  });

  it("removes persisted file authority and canonicalizes project secret surfaces", () => {
    const project = createSampleProject();
    project.environments[0].variables.push({ name: "api_key", value: "mislabelled-secret", secret: false });
    project.services[0] = {
      ...project.services[0],
      path: "https://user:pass@example.test/items?token=path-secret&visible=yes",
      queryParams: [{ id: "query", name: "api_key", value: "query-secret", enabled: true }],
      pathParams: [{ id: "path", name: "access_token", value: "path-param-secret", enabled: true }],
      body: {
        contentType: "multipart/form-data",
        raw: "",
        fields: [
          { id: "secret-field", name: "api-key", value: "form-secret", enabled: true, valueType: "text" },
          { id: "file", name: "asset", value: "/private/tmp/private.txt", enabled: true, valueType: "file" },
          { id: "visible", name: "description", value: "keep me", enabled: true, valueType: "text" }
        ]
      }
    };
    project.savedResponses[0].url = "https://u:p@example.test/orders?apiKey=response-secret&visible=yes";
    project.importSources.push({ id: "credentialled", label: "Imported", source: "https://u:p@example.test/openapi.json?api_key=import-secret" });

    const exported = prepareProjectForExport(project);
    const serialized = JSON.stringify(exported);

    expect(serialized).not.toMatch(/mislabelled-secret|query-secret|path-param-secret|form-secret|private\.txt|response-secret|import-secret|user:pass|u:p/);
    expect(exported.services[0].body.fields?.find((field) => field.id === "file")?.value).toBe("");
    expect(exported.services[0].body.fields?.find((field) => field.id === "visible")?.value).toBe("keep me");
    expect(exported.savedResponses[0].url).toContain("apiKey=********");
  });
});
