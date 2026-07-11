import { beforeEach, describe, expect, it, vi } from "vitest";
import { invoke } from "@tauri-apps/api/core";
import { createSampleProject } from "./projectModel";
import { createProjectPersistence } from "./projectPersistence";
import { prepareProjectForExport } from "./projectSchema";

vi.mock("@tauri-apps/api/core", () => ({
  invoke: vi.fn()
}));

describe("browser fallback project persistence", () => {
  beforeEach(() => {
    localStorage.clear();
    delete window.__TAURI_INTERNALS__;
    vi.mocked(invoke).mockReset();
    vi.mocked(invoke).mockRejectedValue(new Error("Tauri runtime is not available"));
  });

  it("round trips a project through .restproj storage", async () => {
    const persistence = await createProjectPersistence();
    const project = createSampleProject("2026-06-21T00:00:00.000Z");

    await persistence.saveProject({
      path: "/tmp/sample-api-regression.restproj",
      project
    });

    await expect(persistence.projectExists("/tmp/sample-api-regression.restproj")).resolves.toBe(true);

    const opened = await persistence.openProject({
      path: "/tmp/sample-api-regression.restproj"
    });

    expect(opened).toEqual(expect.objectContaining({ id: project.id, name: project.name }));
    expect(opened.environments[0].variables.find((variable) => variable.name === "accessToken")?.value).toBe("");
  });

  it("creates and restores a browser recovery backup before overwriting a project", async () => {
    const persistence = await createProjectPersistence();
    const path = "/tmp/recovery.restproj";
    const original = createSampleProject("2026-06-21T00:00:00.000Z");
    const updated = { ...original, name: "Updated" };

    await persistence.saveProject({ path, project: original });
    await persistence.saveProject({ path, project: updated });
    await persistence.restoreProjectBackup(path);

    await expect(persistence.openProject({ path })).resolves.toMatchObject({ name: original.name });
  });

  it("opens legacy browser fallback entries without requiring a password", async () => {
    const persistence = await createProjectPersistence();
    const project = createSampleProject();

    localStorage.setItem("relay-studio:project:/tmp/sample-api-regression.restproj", JSON.stringify({ password: "secret", project }));

    await expect(persistence.openProject({ path: "/tmp/sample-api-regression.restproj" })).resolves.toEqual(project);
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

  it("deduplicates and limits recent projects to ten entries", async () => {
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
    expect(recents).toHaveLength(10);
    expect(recents[0]).toMatchObject({ name: "Project 8 Latest", path: "/tmp/project-8.restproj" });
    expect(recents.filter((recent) => recent.path === "/tmp/project-8.restproj")).toHaveLength(1);
  });

  it("renames and deletes browser fallback projects and recent entries", async () => {
    const persistence = await createProjectPersistence();
    const project = createSampleProject("2026-06-21T00:00:00.000Z");
    const path = "/tmp/sample-api-regression.restproj";

    await persistence.saveProject({ path, project });
    await persistence.rememberRecentProject({ name: project.name, path, openedAt: project.createdAt });
    await persistence.renameProject({ path, name: "Renamed Regression" });

    await expect(persistence.openProject({ path })).resolves.toMatchObject({ name: "Renamed Regression" });
    await expect(persistence.listRecentProjects()).resolves.toEqual([
      { name: "Renamed Regression", path, openedAt: project.createdAt }
    ]);

    await persistence.removeRecentProject(path);
    await expect(persistence.listRecentProjects()).resolves.toEqual([]);
    await persistence.rememberRecentProject({ name: "Renamed Regression", path, openedAt: project.createdAt });

    await persistence.deleteProject(path);

    await expect(persistence.projectExists(path)).resolves.toBe(false);
    await expect(persistence.listRecentProjects()).resolves.toEqual([]);
  });

  it("validates project paths before storage operations", async () => {
    const persistence = await createProjectPersistence();

    await expect(persistence.saveProject({ path: "", project: createSampleProject() })).rejects.toThrow("Project path is required.");
    await expect(persistence.saveProject({ path: "/tmp/project.json", project: createSampleProject() })).rejects.toThrow("Project file must use the .restproj extension.");
    await expect(persistence.renameProject({ path: "/tmp/project.restproj", name: "" })).rejects.toThrow("Project name is required.");
    await expect(persistence.openProject({ path: "/tmp/missing.restproj" })).rejects.toThrow("Project file was not found");
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
      .mockResolvedValueOnce(undefined)
      .mockResolvedValueOnce(undefined)
      .mockResolvedValueOnce(undefined)
      .mockResolvedValueOnce(undefined);

    const persistence = await createProjectPersistence();

    await persistence.saveProject({ path: "/tmp/project.restproj", project });
    await expect(persistence.openProject({ path: "/tmp/project.restproj" })).resolves.toEqual(project);
    await expect(persistence.projectExists("/tmp/project.restproj")).resolves.toBe(true);
    await expect(persistence.listRecentProjects()).resolves.toHaveLength(1);
    await persistence.renameProject({ path: "/tmp/project.restproj", name: "Renamed Project" });
    await persistence.deleteProject("/tmp/project.restproj");
    await persistence.removeRecentProject("/tmp/project.restproj");
    await persistence.rememberRecentProject({ name: project.name, path: "/tmp/project.restproj", openedAt: project.createdAt });

    expect(invoke).toHaveBeenNthCalledWith(1, "save_project_file", {
      path: "/tmp/project.restproj",
      project: prepareProjectForExport(project)
    });
    expect(invoke).toHaveBeenNthCalledWith(2, "open_project_file", { path: "/tmp/project.restproj" });
    expect(invoke).toHaveBeenNthCalledWith(3, "project_file_exists", { path: "/tmp/project.restproj" });
    expect(invoke).toHaveBeenNthCalledWith(4, "list_recent_projects", undefined);
    expect(invoke).toHaveBeenNthCalledWith(5, "rename_project_file", { path: "/tmp/project.restproj", name: "Renamed Project" });
    expect(invoke).toHaveBeenNthCalledWith(6, "delete_project_file", { path: "/tmp/project.restproj" });
    expect(invoke).toHaveBeenNthCalledWith(7, "forget_recent_project", { path: "/tmp/project.restproj" });
    expect(invoke).toHaveBeenNthCalledWith(8, "remember_recent_project", {
      project: { name: project.name, path: "/tmp/project.restproj", openedAt: project.createdAt }
    });
  });

  it("validates Tauri inputs before invoking native commands", async () => {
    const persistence = await createProjectPersistence();

    await expect(persistence.renameProject({ path: "/tmp/project.restproj", name: "" })).rejects.toThrow("Project name is required.");
    await expect(persistence.projectExists("/tmp/project.json")).rejects.toThrow("Project file must use the .restproj extension.");
    expect(invoke).not.toHaveBeenCalled();
  });

  it("guards concurrent saves to the same path", async () => {
    let finishSave: (() => void) | undefined;
    vi.mocked(invoke).mockImplementation((command) => {
      if (command === "save_project_file") {
        return new Promise<void>((resolve) => { finishSave = resolve; });
      }
      return Promise.resolve("0.1.0");
    });
    const persistence = await createProjectPersistence();
    const input = { path: "/tmp/concurrent.restproj", project: createSampleProject() };

    const first = persistence.saveProject(input);
    await expect(persistence.saveProject(input)).rejects.toThrow("A save is already in progress");
    await vi.waitFor(() => expect(finishSave).toBeTypeOf("function"));
    finishSave?.();
    await first;
  });

  it("detects Tauri through app_version when the internal marker is missing", async () => {
    delete window.__TAURI_INTERNALS__;
    vi.mocked(invoke)
      .mockResolvedValueOnce("0.1.0")
      .mockResolvedValueOnce([]);

    const persistence = await createProjectPersistence();
    await expect(persistence.listRecentProjects()).resolves.toEqual([]);

    expect(invoke).toHaveBeenNthCalledWith(1, "app_version", undefined);
    expect(invoke).toHaveBeenNthCalledWith(2, "list_recent_projects", undefined);
  });
});
