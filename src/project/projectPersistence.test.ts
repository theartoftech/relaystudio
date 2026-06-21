import { beforeEach, describe, expect, it, vi } from "vitest";
import { invoke } from "@tauri-apps/api/core";
import { createSampleProject } from "./projectModel";
import { createProjectPersistence } from "./projectPersistence";

vi.mock("@tauri-apps/api/core", () => ({
  invoke: vi.fn()
}));

describe("browser fallback project persistence", () => {
  beforeEach(() => {
    localStorage.clear();
    delete window.__TAURI_INTERNALS__;
    vi.mocked(invoke).mockReset();
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

  it("deduplicates and limits recent projects", async () => {
    const persistence = await createProjectPersistence();

    for (let index = 0; index < 10; index += 1) {
      await persistence.rememberRecentProject({
        name: `Project ${index}`,
        path: `/tmp/project-${index}.restproj`,
        openedAt: `2026-06-21T00:00:0${index}.000Z`
      });
    }
    await persistence.rememberRecentProject({
      name: "Project 8 Latest",
      path: "/tmp/project-8.restproj",
      openedAt: "2026-06-21T00:01:00.000Z"
    });

    const recents = await persistence.listRecentProjects();
    expect(recents).toHaveLength(8);
    expect(recents[0]).toMatchObject({ name: "Project 8 Latest", path: "/tmp/project-8.restproj" });
    expect(recents.filter((recent) => recent.path === "/tmp/project-8.restproj")).toHaveLength(1);
  });

  it("validates project paths and passwords before storage operations", async () => {
    const persistence = await createProjectPersistence();

    await expect(persistence.saveProject({ path: "", password: "secret", project: createSampleProject() })).rejects.toThrow("Project path is required.");
    await expect(persistence.saveProject({ path: "/tmp/project.json", password: "secret", project: createSampleProject() })).rejects.toThrow("Project file must use the .restproj extension.");
    await expect(persistence.saveProject({ path: "/tmp/project.restproj", password: "", project: createSampleProject() })).rejects.toThrow("Project password is required.");
    await expect(persistence.openProject({ path: "/tmp/missing.restproj", password: "secret" })).rejects.toThrow("Project file was not found");
    await expect(persistence.projectExists("/tmp/missing.restproj")).resolves.toBe(false);
  });
});

describe("Tauri project persistence adapter", () => {
  beforeEach(() => {
    window.__TAURI_INTERNALS__ = {};
    vi.mocked(invoke).mockReset();
  });

  it("delegates save, open, exists, recents, and remember commands to Tauri", async () => {
    const project = createSampleProject("2026-06-21T00:00:00.000Z");
    vi.mocked(invoke)
      .mockResolvedValueOnce(undefined)
      .mockResolvedValueOnce(project)
      .mockResolvedValueOnce(true)
      .mockResolvedValueOnce([{ name: project.name, path: "/tmp/project.restproj", openedAt: project.createdAt }])
      .mockResolvedValueOnce(undefined);

    const persistence = await createProjectPersistence();

    await persistence.saveProject({ path: "/tmp/project.restproj", password: "secret", project });
    await expect(persistence.openProject({ path: "/tmp/project.restproj", password: "secret" })).resolves.toEqual(project);
    await expect(persistence.projectExists("/tmp/project.restproj")).resolves.toBe(true);
    await expect(persistence.listRecentProjects()).resolves.toHaveLength(1);
    await persistence.rememberRecentProject({ name: project.name, path: "/tmp/project.restproj", openedAt: project.createdAt });

    expect(invoke).toHaveBeenNthCalledWith(1, "save_project_file", { path: "/tmp/project.restproj", password: "secret", project });
    expect(invoke).toHaveBeenNthCalledWith(2, "open_project_file", { path: "/tmp/project.restproj", password: "secret" });
    expect(invoke).toHaveBeenNthCalledWith(3, "project_file_exists", { path: "/tmp/project.restproj" });
    expect(invoke).toHaveBeenNthCalledWith(4, "list_recent_projects", undefined);
    expect(invoke).toHaveBeenNthCalledWith(5, "remember_recent_project", {
      project: { name: project.name, path: "/tmp/project.restproj", openedAt: project.createdAt }
    });
  });

  it("validates Tauri inputs before invoking native commands", async () => {
    const persistence = await createProjectPersistence();

    await expect(persistence.openProject({ path: "/tmp/project.restproj", password: "" })).rejects.toThrow("Project password is required.");
    await expect(persistence.projectExists("/tmp/project.json")).rejects.toThrow("Project file must use the .restproj extension.");
    expect(invoke).not.toHaveBeenCalled();
  });
});
