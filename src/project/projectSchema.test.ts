import { describe, expect, it } from "vitest";
import { createSampleProject } from "./projectModel";
import { prepareProjectForExport, validateProjectSchema } from "./projectSchema";

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
});
