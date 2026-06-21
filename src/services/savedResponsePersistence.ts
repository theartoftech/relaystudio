import type { SavedResponseMetadata } from "../project/projectModel";
import { SAVED_RESPONSE_FORMAT, SAVED_RESPONSE_SCHEMA_VERSION, assertSavedResponsePath, validateSavedResponseArtifact, type SavedResponseArtifact } from "./savedResponses";

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
    validateSavedResponseArtifact(input.artifact);
    const key = fallbackResponseKey(input.path);
    if (!input.overwrite && localStorage.getItem(key) !== null) {
      throw new Error("Saved response already exists at this path.");
    }
    localStorage.setItem(key, input.path.endsWith(".txt") ? input.artifact.body : JSON.stringify(input.artifact));
  }

  async readResponse(metadata: SavedResponseMetadata): Promise<SavedResponseArtifact> {
    assertSavedResponsePath(metadata.filePath);
    const raw = localStorage.getItem(fallbackResponseKey(metadata.filePath));
    if (!raw) {
      throw new Error(`Saved response was not found: ${metadata.filePath}`);
    }
    const artifact = metadata.filePath.endsWith(".txt")
      ? artifactFromRawBody(metadata, raw)
      : JSON.parse(raw) as SavedResponseArtifact;
    validateSavedResponseArtifact(artifact);
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
    validateSavedResponseArtifact(input.artifact);
    await invokeTauri("save_response_file", {
      path: input.path,
      overwrite: input.overwrite,
      artifact: input.artifact
    });
  }

  async readResponse(metadata: SavedResponseMetadata): Promise<SavedResponseArtifact> {
    assertSavedResponsePath(metadata.filePath);
    const artifact = await invokeTauri<SavedResponseArtifact>("read_response_file", { metadata });
    validateSavedResponseArtifact(artifact);
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

function artifactFromRawBody(metadata: SavedResponseMetadata, body: string): SavedResponseArtifact {
  return {
    format: SAVED_RESPONSE_FORMAT,
    schemaVersion: SAVED_RESPONSE_SCHEMA_VERSION,
    metadata,
    body
  };
}
