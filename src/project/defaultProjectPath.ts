const BROWSER_FALLBACK_PROJECT_DIRECTORY = "/private/tmp";

export function slugProjectFileName(projectName: string): string {
  const slug = projectName.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
  return `${slug || "relay-studio-project"}.restproj`;
}

export function joinProjectPath(directory: string, fileName: string): string {
  const separator = directory.includes("\\") ? "\\" : "/";
  return `${directory.replace(/[\\/]+$/, "")}${separator}${fileName}`;
}

export function buildDefaultProjectPath(projectName: string, directory = BROWSER_FALLBACK_PROJECT_DIRECTORY): string {
  return joinProjectPath(directory, slugProjectFileName(projectName));
}

export async function resolveDefaultProjectDirectory(): Promise<string> {
  if (!("__TAURI_INTERNALS__" in window)) {
    return BROWSER_FALLBACK_PROJECT_DIRECTORY;
  }

  const { invoke } = await import("@tauri-apps/api/core");
  return invoke<string>("default_project_directory");
}
