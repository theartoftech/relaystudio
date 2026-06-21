import type { RecentProject, RelayProject } from "./projectModel";

export interface SaveProjectInput {
  path: string;
  password: string;
  project: RelayProject;
}

export interface OpenProjectInput {
  path: string;
  password: string;
}

export interface ProjectPersistence {
  saveProject(input: SaveProjectInput): Promise<void>;
  openProject(input: OpenProjectInput): Promise<RelayProject>;
  projectExists(path: string): Promise<boolean>;
  listRecentProjects(): Promise<RecentProject[]>;
  rememberRecentProject(project: RecentProject): Promise<void>;
}

const STORAGE_PREFIX = "relay-studio:project:";
const RECENTS_KEY = "relay-studio:recent-projects";

async function invokeTauri<T>(command: string, args?: Record<string, unknown>): Promise<T> {
  const { invoke } = await import("@tauri-apps/api/core");
  return invoke<T>(command, args);
}

async function hasTauriRuntime(): Promise<boolean> {
  return "__TAURI_INTERNALS__" in window;
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

function assertPassword(password: string) {
  if (!password) {
    throw new Error("Project password is required.");
  }
}

class BrowserFallbackPersistence implements ProjectPersistence {
  async saveProject({ path, password, project }: SaveProjectInput): Promise<void> {
    assertProjectPath(path);
    assertPassword(password);
    localStorage.setItem(fallbackProjectKey(path), JSON.stringify({ password, project }));
  }

  async openProject({ path, password }: OpenProjectInput): Promise<RelayProject> {
    assertProjectPath(path);
    assertPassword(password);
    const raw = localStorage.getItem(fallbackProjectKey(path));
    if (!raw) {
      throw new Error(`Project file was not found: ${path}`);
    }
    const parsed = JSON.parse(raw) as { password: string; project: RelayProject };
    if (parsed.password !== password) {
      throw new Error("Wrong project password.");
    }
    return parsed.project;
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
    const next = [project, ...current.filter((recent) => recent.path !== project.path)].slice(0, 8);
    localStorage.setItem(RECENTS_KEY, JSON.stringify(next));
  }
}

class TauriPersistence implements ProjectPersistence {
  async saveProject(input: SaveProjectInput): Promise<void> {
    assertProjectPath(input.path);
    assertPassword(input.password);
    await invokeTauri("save_project_file", {
      path: input.path,
      password: input.password,
      project: input.project
    });
  }

  async openProject(input: OpenProjectInput): Promise<RelayProject> {
    assertProjectPath(input.path);
    assertPassword(input.password);
    return invokeTauri("open_project_file", {
      path: input.path,
      password: input.password
    });
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
}

export async function createProjectPersistence(): Promise<ProjectPersistence> {
  if (await hasTauriRuntime()) {
    return new TauriPersistence();
  }
  return new BrowserFallbackPersistence();
}
