import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { App } from "./App";
import { createSampleProject } from "./project/projectModel";

const nativeMocks = vi.hoisted(() => ({
  listeners: new Map<string, (event: { payload: unknown }) => void>(),
  invoke: vi.fn(),
  open: vi.fn(),
  onCloseRequested: vi.fn(async () => undefined)
}));

vi.mock("@tauri-apps/api/event", () => ({
  listen: vi.fn(async (name: string, callback: (event: { payload: unknown }) => void) => {
    nativeMocks.listeners.set(name, callback);
    return () => nativeMocks.listeners.delete(name);
  })
}));

vi.mock("@tauri-apps/api/window", () => ({
  getCurrentWindow: vi.fn(() => ({
    close: vi.fn(async () => undefined),
    onCloseRequested: nativeMocks.onCloseRequested
  }))
}));

vi.mock("@tauri-apps/api/core", () => ({
  invoke: nativeMocks.invoke
}));

vi.mock("@tauri-apps/plugin-dialog", () => ({
  open: nativeMocks.open
}));

describe("Relay Studio native shell commands", () => {
  const testProjectPath = "/private/tmp/test-project-4.restproj";

  beforeEach(() => {
    const sampleProject = createSampleProject("2026-06-28T00:00:00.000Z");
    const testProject = {
      ...sampleProject,
      id: "test-project-4",
      name: "Test Project 4",
      services: [
        {
          ...sampleProject.services[0],
          id: "test-project-4-health",
          name: "Project 4 Health",
          folder: "Project 4",
          path: "/api/project-4/health"
        }
      ],
      flows: []
    };

    Object.defineProperty(window, "__TAURI_INTERNALS__", {
      configurable: true,
      value: {}
    });
    nativeMocks.listeners.clear();
    nativeMocks.open.mockReset();
    nativeMocks.invoke.mockReset();
    nativeMocks.invoke.mockImplementation(async (command: string, args?: { path?: string }) => {
      if (command === "list_recent_projects") {
        return [
          {
            name: "Test Project 4",
            path: testProjectPath,
            openedAt: "2026-07-02T21:00:00.000Z"
          }
        ];
      }
      if (command === "open_project_file" && args?.path === testProjectPath) {
        return testProject;
      }
      if (command === "remember_recent_project" || command === "refresh_app_menu") {
        return null;
      }
      throw new Error(`Unexpected Tauri command: ${command}`);
    });
  });

  afterEach(() => {
    delete (window as Window & { __TAURI_INTERNALS__?: unknown }).__TAURI_INTERNALS__;
    vi.restoreAllMocks();
  });

  it("opens the payload project from a native Open Recent submenu event", async () => {
    render(<App />);

    await waitFor(() => {
      expect(nativeMocks.listeners.has("relay-shell-command")).toBe(true);
    });

    nativeMocks.listeners.get("relay-shell-command")?.({
      payload: {
        id: "file.open_recent.0",
        recentProject: {
          name: "Test Project 4",
          path: testProjectPath,
          openedAt: "2026-07-02T21:00:00.000Z"
        }
      }
    });

    await waitFor(() => {
      expect(screen.getByRole("heading", { name: "Test Project 4" })).toBeInTheDocument();
    });
    expect(nativeMocks.invoke).toHaveBeenCalledWith("open_project_file", { path: testProjectPath });
  });

  it("opens a native file picker for the Open Project menu event", async () => {
    nativeMocks.open.mockResolvedValue(testProjectPath);
    render(<App />);

    await waitFor(() => {
      expect(nativeMocks.listeners.has("relay-shell-command")).toBe(true);
    });
    nativeMocks.listeners.get("relay-shell-command")?.({
      payload: { id: "file.open_project" }
    });

    await waitFor(() => {
      expect(nativeMocks.open).toHaveBeenCalledWith(expect.objectContaining({
        title: "Open Project",
        multiple: false
      }));
      expect(screen.getByRole("heading", { name: "Test Project 4" })).toBeInTheDocument();
    });
  });

  it("keeps browser mode on the in-app path dialog for non-Tauri tests", async () => {
    delete (window as Window & { __TAURI_INTERNALS__?: unknown }).__TAURI_INTERNALS__;
    render(<App />);

    fireEvent.keyDown(window, { key: "o", metaKey: true });

    expect(screen.getByRole("dialog", { name: "Open Project" })).toBeInTheDocument();
    expect(nativeMocks.open).not.toHaveBeenCalled();
  });
});
