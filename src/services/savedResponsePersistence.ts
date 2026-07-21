import type { SavedResponseMetadata } from "../project/projectModel";
import { assertSavedResponsePath, canonicalizeSavedResponseArtifact, type SavedResponseArtifact } from "./savedResponses";

export interface SaveResponseFileInput {
  path: string;
  artifact: SavedResponseArtifact;
  overwrite: boolean;
}

export interface SavedResponsePersistence {
  saveResponse(input: SaveResponseFileInput): Promise<void>;
  readResponse(metadata: SavedResponseMetadata): Promise<SavedResponseArtifact>;
  responseExists(path: string): Promise<boolean>;
}

const STORAGE_PREFIX = "relay-studio:saved-response:";

async function invokeTauri<T>(command: string, args?: Record<string, unknown>): Promise<T> {
  const { invoke } = await import("@tauri-apps/api/core");
  return invoke<T>(command, args);
}

async function hasTauriRuntime(): Promise<boolean> {
  return "__TAURI_INTERNALS__" in window;
}

function fallbackResponseKey(path: string): string {
  return `${STORAGE_PREFIX}${path}`;
}

class BrowserFallbackSavedResponsePersistence implements SavedResponsePersistence {
  async saveResponse(input: SaveResponseFileInput): Promise<void> {
    assertSavedResponsePath(input.path);
    const artifact = canonicalizeSavedResponseArtifact(input.artifact);
    assertArtifactPath(input.path, artifact);
    const key = fallbackResponseKey(input.path);
    if (!input.overwrite && localStorage.getItem(key) !== null) {
      throw new Error("Saved response already exists at this path.");
    }
    localStorage.setItem(key, JSON.stringify(artifact));
  }

  async readResponse(metadata: SavedResponseMetadata): Promise<SavedResponseArtifact> {
    assertSavedResponsePath(metadata.filePath);
    const raw = localStorage.getItem(fallbackResponseKey(metadata.filePath));
    if (!raw) {
      throw new Error(`Saved response was not found: ${metadata.filePath}`);
    }
    let parsed: SavedResponseArtifact;
    try {
      parsed = JSON.parse(raw) as SavedResponseArtifact;
    } catch {
      throw new Error("Legacy raw .txt response artifacts cannot be reopened safely. Re-send the request and save a new response artifact.");
    }
    const artifact = canonicalizeSavedResponseArtifact(parsed);
    assertArtifactPath(metadata.filePath, artifact);
    return artifact;
  }

  async responseExists(path: string): Promise<boolean> {
    assertSavedResponsePath(path);
    return localStorage.getItem(fallbackResponseKey(path)) !== null;
  }
}

class TauriSavedResponsePersistence implements SavedResponsePersistence {
  async saveResponse(input: SaveResponseFileInput): Promise<void> {
    assertSavedResponsePath(input.path);
    const artifact = canonicalizeSavedResponseArtifact(input.artifact);
    assertArtifactPath(input.path, artifact);
    await invokeTauri("save_response_file", {
      path: input.path,
      overwrite: input.overwrite,
      artifact
    });
  }

  async readResponse(metadata: SavedResponseMetadata): Promise<SavedResponseArtifact> {
    assertSavedResponsePath(metadata.filePath);
    const artifact = canonicalizeSavedResponseArtifact(await invokeTauri<SavedResponseArtifact>("read_response_file", { metadata }));
    assertArtifactPath(metadata.filePath, artifact);
    return artifact;
  }

  async responseExists(path: string): Promise<boolean> {
    assertSavedResponsePath(path);
    return invokeTauri("response_file_exists", { path });
  }
}

export async function createSavedResponsePersistence(): Promise<SavedResponsePersistence> {
  if (await hasTauriRuntime()) {
    return new TauriSavedResponsePersistence();
  }
  return new BrowserFallbackSavedResponsePersistence();
}

function assertArtifactPath(requestedPath: string, artifact: SavedResponseArtifact): void {
  if (artifact.metadata.filePath !== requestedPath) {
    throw new Error("Saved response artifact path does not match the approved project metadata. Re-send the request and save a new response artifact.");
  }
}
