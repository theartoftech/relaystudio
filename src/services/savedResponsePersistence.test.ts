import { beforeEach, describe, expect, it, vi } from "vitest";
import { invoke } from "@tauri-apps/api/core";
import { createSampleProject, type ProjectService } from "../project/projectModel";
import { buildExecutableRequest, normalizeResponse } from "./serviceRunner";
import { createSavedResponsePersistence } from "./savedResponsePersistence";
import { buildSavedResponseDraft } from "./savedResponses";

vi.mock("@tauri-apps/api/core", () => ({
  invoke: vi.fn()
}));

const project = createSampleProject("2026-06-21T00:00:00.000Z");
const qa = project.environments[0];
const service = project.services.find((item) => item.id === "create-order") as ProjectService;

function artifact() {
  const response = normalizeResponse(service, {
    status: 200,
    statusText: "OK",
    headers: { "content-type": "application/json" },
    body: `{"ok":true}`,
    durationMs: 22
  });
  return buildSavedResponseDraft({
    service,
    request: buildExecutableRequest(service, qa),
    response,
    filePath: "/tmp/create-order.json",
    capturedAt: "2026-06-21T15:00:00.000Z"
  }).artifact;
}

describe("browser fallback saved response persistence", () => {
  beforeEach(() => {
    localStorage.clear();
    delete window.__TAURI_INTERNALS__;
    vi.mocked(invoke).mockReset();
  });

  it("saves, detects, and reads response artifacts", async () => {
    const persistence = await createSavedResponsePersistence();
    const saved = artifact();

    await expect(persistence.responseExists("/tmp/create-order.json")).resolves.toBe(false);
    await persistence.saveResponse({ path: "/tmp/create-order.json", artifact: saved, overwrite: false });

    await expect(persistence.responseExists("/tmp/create-order.json")).resolves.toBe(true);
    await expect(persistence.readResponse(saved.metadata)).resolves.toEqual(saved);
  });

  it("rejects overwrite attempts without explicit confirmation", async () => {
    const persistence = await createSavedResponsePersistence();
    const saved = artifact();

    await persistence.saveResponse({ path: "/tmp/create-order.json", artifact: saved, overwrite: false });
    await expect(persistence.saveResponse({ path: "/tmp/create-order.json", artifact: saved, overwrite: false })).rejects.toThrow("Saved response already exists at this path.");

    await expect(persistence.saveResponse({ path: "/tmp/create-order.json", artifact: saved, overwrite: true })).resolves.toBeUndefined();
  });

  it("validates paths before fallback storage operations", async () => {
    const persistence = await createSavedResponsePersistence();
    const saved = artifact();

    await expect(persistence.saveResponse({ path: "", artifact: saved, overwrite: false })).rejects.toThrow("Saved response path is required.");
    await expect(persistence.responseExists("/tmp/response.html")).rejects.toThrow("Saved response file must use the .json or .txt extension.");
    await expect(persistence.readResponse({ ...saved.metadata, filePath: "/tmp/missing.json" })).rejects.toThrow("Saved response was not found");
  });

  it("stores raw text files as self-describing Relay artifacts", async () => {
    const persistence = await createSavedResponsePersistence();
    const saved = {
      ...artifact(),
      metadata: {
        ...artifact().metadata,
        filePath: "/tmp/create-order.txt",
        fileName: "create-order.txt",
        bodyKind: "raw" as const,
        contentType: "text/plain"
      },
      body: "plain redacted body"
    };

    await persistence.saveResponse({ path: "/tmp/create-order.txt", artifact: saved, overwrite: false });

    const stored = JSON.parse(localStorage.getItem("relay-studio:saved-response:/tmp/create-order.txt") ?? "{}");
    expect(stored).toMatchObject({ body: "plain redacted body", metadata: { sizeBytes: 19, redacted: true } });
    await expect(persistence.readResponse(saved.metadata)).resolves.toEqual(stored);
  });

  it("re-redacts imported artifacts instead of trusting their redacted flag", async () => {
    const persistence = await createSavedResponsePersistence();
    const saved = artifact();
    const unsafe = {
      ...saved,
      metadata: { ...saved.metadata, url: "https://u:p@example.test/items?api_key=url-secret", redacted: true },
      body: `{"api_key":"body-secret"}`
    };
    localStorage.setItem("relay-studio:saved-response:/tmp/create-order.json", JSON.stringify(unsafe));

    const reopened = await persistence.readResponse(saved.metadata);

    expect(JSON.stringify(reopened)).not.toMatch(/url-secret|body-secret|u:p/);
    expect(reopened.metadata.redacted).toBe(true);
  });
});

describe("Tauri saved response persistence adapter", () => {
  beforeEach(() => {
    window.__TAURI_INTERNALS__ = {};
    vi.mocked(invoke).mockReset();
  });

  it("delegates save, read, and exists commands to Tauri", async () => {
    const saved = artifact();
    vi.mocked(invoke)
      .mockResolvedValueOnce(undefined)
      .mockResolvedValueOnce(saved)
      .mockResolvedValueOnce(true);

    const persistence = await createSavedResponsePersistence();

    await persistence.saveResponse({ path: "/tmp/create-order.json", artifact: saved, overwrite: true });
    await expect(persistence.readResponse(saved.metadata)).resolves.toEqual(saved);
    await expect(persistence.responseExists("/tmp/create-order.json")).resolves.toBe(true);

    expect(invoke).toHaveBeenNthCalledWith(1, "save_response_file", {
      path: "/tmp/create-order.json",
      overwrite: true,
      artifact: saved
    });
    expect(invoke).toHaveBeenNthCalledWith(2, "read_response_file", { metadata: saved.metadata });
    expect(invoke).toHaveBeenNthCalledWith(3, "response_file_exists", { path: "/tmp/create-order.json" });
  });

  it("validates Tauri inputs before invoking native commands", async () => {
    const persistence = await createSavedResponsePersistence();

    await expect(persistence.responseExists("/tmp/response.exe")).rejects.toThrow("Saved response file must use the .json or .txt extension.");
    expect(invoke).not.toHaveBeenCalled();
  });
});
