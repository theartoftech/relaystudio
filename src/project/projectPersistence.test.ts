import { beforeEach, describe, expect, it } from "vitest";
import { createSampleProject } from "./projectModel";
import { createProjectPersistence } from "./projectPersistence";

describe("browser fallback project persistence", () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it("round trips a project through .restproj storage", async () => {
    const persistence = await createProjectPersistence();
    const project = createSampleProject("2026-06-21T00:00:00.000Z");

    await persistence.saveProject({
      path: "/tmp/sample-api-regression.restproj",
      password: "secret",
      project
    });

    await expect(persistence.projectExists("/tmp/sample-api-regression.restproj")).resolves.toBe(true);

    const opened = await persistence.openProject({
      path: "/tmp/sample-api-regression.restproj",
      password: "secret"
    });

    expect(opened).toEqual(project);
  });

  it("rejects a wrong password", async () => {
    const persistence = await createProjectPersistence();

    await persistence.saveProject({
      path: "/tmp/sample-api-regression.restproj",
      password: "secret",
      project: createSampleProject()
    });

    await expect(
      persistence.openProject({
        path: "/tmp/sample-api-regression.restproj",
        password: "wrong"
      })
    ).rejects.toThrow("Wrong project password.");
  });

  it("tracks recent projects", async () => {
    const persistence = await createProjectPersistence();

    await persistence.rememberRecentProject({
      name: "Sample API Regression",
      path: "/tmp/sample-api-regression.restproj",
      openedAt: "2026-06-21T00:00:00.000Z"
    });

    await expect(persistence.listRecentProjects()).resolves.toHaveLength(1);
  });
});
