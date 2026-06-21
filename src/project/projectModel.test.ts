import { describe, expect, it, vi } from "vitest";
import { PROJECT_FORMAT, PROJECT_SCHEMA_VERSION, createEmptyProject, createSampleProject, touchProject } from "./projectModel";

describe("project model", () => {
  it("creates a versioned sample project with REST service designer fields", () => {
    const project = createSampleProject("2026-06-21T00:00:00.000Z");
    const createOrder = project.services.find((service) => service.id === "create-order");

    expect(project).toMatchObject({
      format: PROJECT_FORMAT,
      schemaVersion: PROJECT_SCHEMA_VERSION,
      name: "Sample API Regression"
    });
    expect(project.services).toHaveLength(13);
    expect(project.services.find((service) => service.id === "health-check")).toMatchObject({
      method: "GET",
      path: "/api/health",
      authProfile: { type: "none" }
    });
    expect(project.environments[0].variables.map((variable) => variable.name)).toContain("baseUrl");
    expect(createOrder).toMatchObject({
      method: "POST",
      path: "/api/orders",
      timeoutMs: 30000,
      retry: { attempts: 1, backoffMs: 250 },
      authProfile: { type: "bearer", tokenVariable: "accessToken" },
      body: { contentType: "application/json" }
    });
  });

  it("creates an empty project shell without sample services or evidence", () => {
    vi.spyOn(Date, "now").mockReturnValue(123456);

    const project = createEmptyProject("2026-06-21T00:00:00.000Z");

    expect(project).toMatchObject({
      id: "project-123456",
      name: "Untitled API Project",
      services: [],
      flows: [],
      savedResponses: [],
      importSources: []
    });
  });

  it("touches updatedAt without replacing project content", () => {
    const project = createSampleProject("2026-06-21T00:00:00.000Z");

    expect(touchProject(project, "2026-06-21T01:00:00.000Z")).toEqual({
      ...project,
      updatedAt: "2026-06-21T01:00:00.000Z"
    });
  });
});
