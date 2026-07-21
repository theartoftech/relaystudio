import type { RecentProject, RelayProject } from "./projectModel";
import { AppError } from "../lib/appError";
import { parseProjectImport, prepareProjectForExport } from "./projectSchema";
import { assertUtf8ByteLimit, MAX_PROJECT_FILE_BYTES } from "../services/resourceLimits";

export interface SaveProjectInput {
  path: string;
  project: RelayProject;
}

export interface OpenProjectInput {
  path: string;
}

export interface RenameProjectInput {
  path: string;
  name: string;
}

export interface ProjectPersistence {
  saveProject(input: SaveProjectInput): Promise<void>;
  openProject(input: OpenProjectInput): Promise<RelayProject>;
  restoreProjectBackup(path: string): Promise<void>;
  projectExists(path: string): Promise<boolean>;
  listRecentProjects(): Promise<RecentProject[]>;
  rememberRecentProject(project: RecentProject): Promise<void>;
  removeRecentProject(path: string): Promise<void>;
  renameProject(input: RenameProjectInput): Promise<void>;
  deleteProject(path: string): Promise<void>;
}

const STORAGE_PREFIX = "relay-studio:project:";
const RECENTS_KEY = "relay-studio:recent-projects";
const activeSavePaths = new Set<string>();

async function invokeTauri<T>(command: string, args?: Record<string, unknown>): Promise<T> {
  const { invoke } = await import("@tauri-apps/api/core");
  return invoke<T>(command, args);
}

async function hasTauriRuntime(): Promise<boolean> {
  if ("__TAURI_INTERNALS__" in window) {
    return true;
  }
  try {
    await invokeTauri("app_version");
    return true;
  } catch {
    return false;
  }
}

function fallbackProjectKey(path: string): string {
  return `${STORAGE_PREFIX}${path}`;
}

function assertProjectPath(path: string) {
  if (!path.trim()) {
    throw new Error("Project path is required.");
  }
  if (!path.endsWith(".restproj")) {
    throw new Error("Project file must use the .restproj extension.");
  }
}

function assertProjectName(name: string) {
  if (!name.trim()) {
    throw new Error("Project name is required.");
  }
}

class BrowserFallbackPersistence implements ProjectPersistence {
  async saveProject({ path, project }: SaveProjectInput): Promise<void> {
    assertProjectPath(path);
    await withSaveGuard(path, async () => {
      const key = fallbackProjectKey(path);
      const existing = localStorage.getItem(key);
      if (existing) localStorage.setItem(`${key}:backup`, existing);
      const serialized = JSON.stringify(prepareProjectForExport(project));
      assertUtf8ByteLimit(serialized, MAX_PROJECT_FILE_BYTES, "Project file");
      localStorage.setItem(key, serialized);
    });
  }

  async openProject({ path }: OpenProjectInput): Promise<RelayProject> {
    assertProjectPath(path);
    const raw = localStorage.getItem(fallbackProjectKey(path));
    if (!raw) {
      throw new Error(`Project file was not found: ${path}`);
    }
    assertUtf8ByteLimit(raw, MAX_PROJECT_FILE_BYTES, "Project file");
    const parsed = JSON.parse(raw) as RelayProject | { project: RelayProject };
    return parseProjectImport("project" in parsed ? parsed.project : parsed);
  }

  async restoreProjectBackup(path: string): Promise<void> {
    assertProjectPath(path);
    const key = fallbackProjectKey(path);
    const backup = localStorage.getItem(`${key}:backup`);
    if (!backup) throw new AppError("filesystem", "PROJECT_BACKUP_MISSING", `Project recovery backup was not found: ${path}`);
    assertUtf8ByteLimit(backup, MAX_PROJECT_FILE_BYTES, "Project recovery backup");
    parseProjectImport(JSON.parse(backup) as unknown);
    localStorage.setItem(key, backup);
  }

  async projectExists(path: string): Promise<boolean> {
    assertProjectPath(path);
    return localStorage.getItem(fallbackProjectKey(path)) !== null;
  }

  async listRecentProjects(): Promise<RecentProject[]> {
    const raw = localStorage.getItem(RECENTS_KEY);
    return raw ? (JSON.parse(raw) as RecentProject[]) : [];
  }

  async rememberRecentProject(project: RecentProject): Promise<void> {
    const current = await this.listRecentProjects();
    const next = [project, ...current.filter((recent) => recent.path !== project.path)].slice(0, 10);
    localStorage.setItem(RECENTS_KEY, JSON.stringify(next));
  }

  async removeRecentProject(path: string): Promise<void> {
    assertProjectPath(path);
    const current = await this.listRecentProjects();
    localStorage.setItem(RECENTS_KEY, JSON.stringify(current.filter((recent) => recent.path !== path)));
  }

  async renameProject({ path, name }: RenameProjectInput): Promise<void> {
    assertProjectPath(path);
    assertProjectName(name);
    const key = fallbackProjectKey(path);
    const raw = localStorage.getItem(key);
    if (raw) {
      const parsed = JSON.parse(raw) as RelayProject | { project: RelayProject };
      const project = "project" in parsed ? parsed.project : parsed;
      localStorage.setItem(key, JSON.stringify({ ...project, name: name.trim(), updatedAt: new Date().toISOString() }));
    }
    const recent = await this.listRecentProjects();
    localStorage.setItem(RECENTS_KEY, JSON.stringify(recent.map((item) => (
      item.path === path ? { ...item, name: name.trim() } : item
    ))));
  }

  async deleteProject(path: string): Promise<void> {
    assertProjectPath(path);
    localStorage.removeItem(fallbackProjectKey(path));
    const recent = await this.listRecentProjects();
    localStorage.setItem(RECENTS_KEY, JSON.stringify(recent.filter((item) => item.path !== path)));
  }
}

class TauriPersistence implements ProjectPersistence {
  async saveProject(input: SaveProjectInput): Promise<void> {
    assertProjectPath(input.path);
    await withSaveGuard(input.path, async () => {
      await invokeTauri("save_project_file", {
        path: input.path,
        project: prepareProjectForExport(input.project)
      });
    });
  }

  async openProject(input: OpenProjectInput): Promise<RelayProject> {
    assertProjectPath(input.path);
    const project = await invokeTauri<unknown>("open_project_file", {
      path: input.path
    });
    return parseProjectImport(project);
  }

  async restoreProjectBackup(path: string): Promise<void> {
    assertProjectPath(path);
    await invokeTauri("restore_project_backup", { path });
  }

  async projectExists(path: string): Promise<boolean> {
    assertProjectPath(path);
    return invokeTauri("project_file_exists", { path });
  }

  async listRecentProjects(): Promise<RecentProject[]> {
    return invokeTauri("list_recent_projects");
  }

  async rememberRecentProject(project: RecentProject): Promise<void> {
    await invokeTauri("remember_recent_project", { project });
  }

  async removeRecentProject(path: string): Promise<void> {
    assertProjectPath(path);
    await invokeTauri("forget_recent_project", { path });
  }

  async renameProject(input: RenameProjectInput): Promise<void> {
    assertProjectPath(input.path);
    assertProjectName(input.name);
    await invokeTauri("rename_project_file", { path: input.path, name: input.name.trim() });
  }

  async deleteProject(path: string): Promise<void> {
    assertProjectPath(path);
    await invokeTauri("delete_project_file", { path });
  }
}

export async function createProjectPersistence(): Promise<ProjectPersistence> {
  if (await hasTauriRuntime()) {
    return new TauriPersistence();
  }
  return new BrowserFallbackPersistence();
}

async function withSaveGuard(path: string, save: () => Promise<void>): Promise<void> {
  if (activeSavePaths.has(path)) {
    throw new AppError("filesystem", "CONCURRENT_SAVE_BLOCKED", `A save is already in progress for ${path}.`);
  }
  activeSavePaths.add(path);
  try {
    await save();
  } finally {
    activeSavePaths.delete(path);
  }
}
