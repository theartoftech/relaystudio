import { act, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { App } from "./App";
import { createSampleProject } from "./project/projectModel";

const nativeMocks = vi.hoisted(() => ({
  listeners: new Map<string, (event: { payload: unknown }) => void>(),
  invoke: vi.fn(),
  open: vi.fn(),
  closeHandler: null as null | ((event: { preventDefault: () => void }) => void),
  closeWindow: vi.fn(async () => undefined),
  onCloseRequested: vi.fn(async (callback: (event: { preventDefault: () => void }) => void) => {
    nativeMocks.closeHandler = callback;
    return () => {
      nativeMocks.closeHandler = null;
    };
  })
}));

vi.mock("@tauri-apps/api/event", () => ({
  listen: vi.fn(async (name: string, callback: (event: { payload: unknown }) => void) => {
    nativeMocks.listeners.set(name, callback);
    return () => nativeMocks.listeners.delete(name);
  })
}));

vi.mock("@tauri-apps/api/window", () => ({
  getCurrentWindow: vi.fn(() => ({
    close: nativeMocks.closeWindow,
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
    };

    Object.defineProperty(window, "__TAURI_INTERNALS__", {
      configurable: true,
      value: {}
    });
    nativeMocks.listeners.clear();
    nativeMocks.closeHandler = null;
    nativeMocks.closeWindow.mockClear();
    nativeMocks.onCloseRequested.mockClear();
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
      if (command === "default_project_directory") {
        return "C:\\Users\\JeffHaynes\\Documents\\relaystudio";
      }
      if (command === "open_project_file" && args?.path === testProjectPath) {
        return testProject;
      }
      if (command === "save_project_file" || command === "remember_recent_project" || command === "refresh_app_menu") {
        return null;
      }
      throw new Error(`Unexpected Tauri command: ${command}`);
    });
  });

  afterEach(() => {
    delete (window as Window & { __TAURI_INTERNALS__?: unknown }).__TAURI_INTERNALS__;
    vi.restoreAllMocks();
  });

  it("reopens the most recent project when the native app starts", async () => {
    render(<App />);

    expect(await screen.findByRole("heading", { name: "Test Project 4" })).toBeInTheDocument();
    expect(nativeMocks.invoke).toHaveBeenCalledWith("open_project_file", { path: testProjectPath });
  });

  it("starts with an empty project when there is no recent native project", async () => {
    nativeMocks.invoke.mockImplementation(async (command: string) => {
      if (command === "list_recent_projects") return [];
      if (command === "default_project_directory") return "C:\\Users\\JeffHaynes\\Documents\\relaystudio";
      if (command === "refresh_app_menu") return null;
      throw new Error(`Unexpected Tauri command: ${command}`);
    });

    render(<App />);

    expect(await screen.findByRole("heading", { name: "Untitled API Project" })).toBeInTheDocument();
    expect(screen.queryByRole("heading", { name: "Sample API Regression" })).not.toBeInTheDocument();
  });

  it("shows an explicit error and an empty workspace when the latest project cannot be reopened", async () => {
    nativeMocks.invoke.mockImplementation(async (command: string) => {
      if (command === "list_recent_projects") {
        return [{ name: "Missing Project", path: "C:\\missing.restproj", openedAt: "2026-07-10T20:00:00.000Z" }];
      }
      if (command === "default_project_directory") return "C:\\Users\\JeffHaynes\\Documents\\relaystudio";
      if (command === "open_project_file") throw new Error("Project file was not found: C:\\missing.restproj");
      if (command === "refresh_app_menu") return null;
      throw new Error(`Unexpected Tauri command: ${command}`);
    });

    render(<App />);

    expect(await screen.findByRole("heading", { name: "Untitled API Project" })).toBeInTheDocument();
    expect(screen.getByLabelText("Status bar")).toHaveTextContent("Could not reopen the most recent project");
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

  it("does not duplicate the active startup project in the recent-project dialog", async () => {
    render(<App />);

    await screen.findByRole("button", { name: /Search commands/i });
    fireEvent.keyDown(window, { key: "k", metaKey: true });
    fireEvent.click(within(screen.getByRole("dialog", { name: "Command palette" })).getByRole("button", { name: /Open Recent Projects/i }));
    const recentDialog = await screen.findByRole("dialog", { name: "Open Recent Projects" });
    expect(within(recentDialog).getByText("No recent projects yet.")).toBeInTheDocument();
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

  it("defaults native Save Project paths to the platform project directory", async () => {
    render(<App />);

    await screen.findByRole("button", { name: /^Save$/i });
    fireEvent.click(screen.getByRole("button", { name: /^Save$/i }));

    expect(await screen.findByRole("dialog", { name: "Save Project" })).toBeInTheDocument();
    await waitFor(() => {
      expect(screen.getByLabelText("Project file path")).toHaveValue("C:\\Users\\JeffHaynes\\Documents\\relaystudio\\test-project-4.restproj");
    });
    expect(nativeMocks.invoke).toHaveBeenCalledWith("default_project_directory");
  });

  it("uses the native default project directory for Save Project As fallback paths", async () => {
    render(<App />);

    await screen.findByRole("button", { name: /^Save$/i });
    fireEvent.keyDown(window, { key: "s", metaKey: true, shiftKey: true });

    expect(await screen.findByRole("dialog", { name: "Save Project As" })).toBeInTheDocument();
    expect(screen.getByLabelText("Project file path")).toHaveValue("C:\\Users\\JeffHaynes\\Documents\\relaystudio\\test-project-4.restproj");
  });

  it("saves through native persistence and closes the dialog", async () => {
    render(<App />);

    await screen.findByRole("button", { name: /^Save$/i });
    fireEvent.click(screen.getByRole("button", { name: /^Save$/i }));
    const dialog = await screen.findByRole("dialog", { name: "Save Project" });
    fireEvent.click(within(dialog).getByRole("button", { name: "Save Project" }));

    await waitFor(() => {
      expect(screen.queryByRole("dialog", { name: "Save Project" })).not.toBeInTheDocument();
    });
    expect(nativeMocks.invoke).toHaveBeenCalledWith("save_project_file", expect.objectContaining({
      path: "C:\\Users\\JeffHaynes\\Documents\\relaystudio\\test-project-4.restproj"
    }));
    expect(nativeMocks.invoke).toHaveBeenCalledWith("remember_recent_project", expect.any(Object));
  });

  it("shows native save failures inside the dialog", async () => {
    nativeMocks.invoke.mockImplementation(async (command: string) => {
      if (command === "default_project_directory") return "C:\\Users\\JeffHaynes\\Documents\\relaystudio";
      if (command === "list_recent_projects") return [];
      if (command === "save_project_file") throw new Error("Could not write temporary project file: access denied");
      if (command === "refresh_app_menu") return null;
      throw new Error(`Unexpected Tauri command: ${command}`);
    });
    render(<App />);

    await screen.findByRole("button", { name: /^Save$/i });
    fireEvent.click(screen.getByRole("button", { name: /^Save$/i }));
    const dialog = await screen.findByRole("dialog", { name: "Save Project" });
    fireEvent.click(within(dialog).getByRole("button", { name: "Save Project" }));

    expect(await within(dialog).findByRole("alert")).toHaveTextContent("access denied");
    expect(dialog).toBeInTheDocument();
  });

  it("handles native View menu toggles and refreshes checked menu state", async () => {
    render(<App />);

    await waitFor(() => {
      expect(nativeMocks.listeners.has("relay-shell-command")).toBe(true);
    });

    act(() => {
      nativeMocks.listeners.get("relay-shell-command")?.({
        payload: { id: "view.toggle_explorer", checked: false }
      });
    });

    await waitFor(() => {
      expect(screen.queryByLabelText("Project explorer")).not.toBeInTheDocument();
      expect(nativeMocks.invoke).toHaveBeenCalledWith("refresh_app_menu", {
        state: expect.objectContaining({ explorerOpen: false })
      });
    });

    fireEvent.click(screen.getByRole("tab", { name: /Authenticated Read/i }));
    await waitFor(() => {
      expect(screen.getByLabelText("Flow builder")).toBeInTheDocument();
      expect(nativeMocks.invoke).toHaveBeenCalledWith("refresh_app_menu", {
        state: expect.objectContaining({
          activeTabKind: "flow",
          flowDetailsOpen: true
        })
      });
    });
    act(() => {
      nativeMocks.listeners.get("relay-shell-command")?.({
        payload: { id: "view.toggle_flow_details", checked: false }
      });
    });

    await waitFor(() => {
      expect(screen.queryByLabelText("Flow step details")).not.toBeInTheDocument();
      expect(nativeMocks.invoke).toHaveBeenCalledWith("refresh_app_menu", {
        state: expect.objectContaining({
          activeTabKind: "flow",
          flowDetailsOpen: false
        })
      });
    });
  });

  it("refreshes native View menu availability immediately when selecting a flow from Explorer", async () => {
    render(<App />);

    await waitFor(() => {
      expect(nativeMocks.listeners.has("relay-shell-command")).toBe(true);
    });

    fireEvent.click(within(screen.getByLabelText("Project explorer")).getByRole("button", { name: /Authenticated Read/i }));

    await waitFor(() => {
      expect(screen.getByLabelText("Flow builder")).toBeInTheDocument();
      expect(nativeMocks.invoke).toHaveBeenCalledWith("refresh_app_menu", {
        state: expect.objectContaining({
          activeTabKind: "flow",
          flowDetailsOpen: true
        })
      });
    });
  });

  it("applies a native flow-details toggle even if the menu event reaches React before flow tab state settles", async () => {
    render(<App />);

    await waitFor(() => {
      expect(nativeMocks.listeners.has("relay-shell-command")).toBe(true);
    });

    act(() => {
      nativeMocks.listeners.get("relay-shell-command")?.({
        payload: { id: "view.toggle_flow_details", checked: false }
      });
    });
    fireEvent.click(screen.getByRole("tab", { name: /Authenticated Read/i }));

    await waitFor(() => {
      expect(screen.getByLabelText("Flow builder")).toBeInTheDocument();
      expect(screen.queryByLabelText("Flow step details")).not.toBeInTheDocument();
    });
  });

  it("sets native check-menu state explicitly instead of inferring the next toggle", async () => {
    render(<App />);

    await waitFor(() => {
      expect(nativeMocks.listeners.has("relay-shell-command")).toBe(true);
    });

    act(() => {
      nativeMocks.listeners.get("relay-shell-command")?.({
        payload: { id: "view.toggle_flow_details", checked: false }
      });
      nativeMocks.listeners.get("relay-shell-command")?.({
        payload: { id: "view.toggle_flow_details", checked: false }
      });
    });
    fireEvent.click(screen.getByRole("tab", { name: /Authenticated Read/i }));

    await waitFor(() => {
      expect(screen.getByLabelText("Flow builder")).toBeInTheDocument();
      expect(screen.queryByLabelText("Flow step details")).not.toBeInTheDocument();
    });
  });

  it("opens the dirty-work prompt from the native close-request hook", async () => {
    render(<App />);

    await waitFor(() => {
      expect(nativeMocks.onCloseRequested).toHaveBeenCalled();
      expect(nativeMocks.closeHandler).not.toBeNull();
    });

    fireEvent.change(screen.getByLabelText("Request URL"), {
      target: { value: "https://api.test.local/v1/orders?status=open" }
    });
    await waitFor(() => {
      expect(nativeMocks.onCloseRequested).toHaveBeenCalledTimes(2);
    });

    const preventDefault = vi.fn();
    act(() => {
      nativeMocks.closeHandler?.({ preventDefault });
    });

    await waitFor(() => {
      expect(preventDefault).toHaveBeenCalledTimes(1);
      expect(screen.getByRole("dialog", { name: "Unsaved changes" })).toBeInTheDocument();
    });

    fireEvent.click(within(screen.getByRole("dialog", { name: "Unsaved changes" })).getByRole("button", { name: "Cancel" }));
    await waitFor(() => {
      expect(screen.queryByRole("dialog", { name: "Unsaved changes" })).not.toBeInTheDocument();
    });
    expect(nativeMocks.closeWindow).not.toHaveBeenCalled();
  });

  it("keeps the close bypass active until the delayed native close event arrives", async () => {
    render(<App />);

    await waitFor(() => {
      expect(nativeMocks.closeHandler).not.toBeNull();
    });
    fireEvent.change(screen.getByLabelText("Request URL"), {
      target: { value: "https://api.test.local/v1/orders?status=open" }
    });
    await waitFor(() => {
      expect(screen.getByRole("button", { name: /^Save \*$/i })).toBeInTheDocument();
    });
    const dirtyCloseHandler = nativeMocks.closeHandler;
    act(() => {
      dirtyCloseHandler?.({ preventDefault: vi.fn() });
    });
    const prompt = await screen.findByRole("dialog", { name: "Unsaved changes" });
    fireEvent.click(within(prompt).getByRole("button", { name: "Do Not Save" }));
    await waitFor(() => {
      expect(nativeMocks.closeWindow).toHaveBeenCalledTimes(1);
    });

    const delayedPreventDefault = vi.fn();
    act(() => {
      dirtyCloseHandler?.({ preventDefault: delayedPreventDefault });
    });

    expect(delayedPreventDefault).not.toHaveBeenCalled();
    expect(screen.queryByRole("dialog", { name: "Unsaved changes" })).not.toBeInTheDocument();
  });

  it("routes File Exit through the dirty-project close dialog", async () => {
    render(<App />);

    await waitFor(() => {
      expect(nativeMocks.listeners.has("relay-shell-command")).toBe(true);
    });
    fireEvent.change(screen.getByLabelText("Request URL"), {
      target: { value: "https://api.test.local/v1/orders?status=open" }
    });
    act(() => {
      nativeMocks.listeners.get("relay-shell-command")?.({ payload: { id: "file.exit" } });
    });

    const prompt = await screen.findByRole("dialog", { name: "Unsaved changes" });
    fireEvent.click(within(prompt).getByRole("button", { name: "Do Not Save" }));

    await waitFor(() => {
      expect(nativeMocks.closeWindow).toHaveBeenCalledTimes(1);
    });
  });

  it("saves the dirty project before completing an X-triggered exit", async () => {
    render(<App />);

    await waitFor(() => {
      expect(nativeMocks.closeHandler).not.toBeNull();
    });
    const closeRegistrationCount = nativeMocks.onCloseRequested.mock.calls.length;
    fireEvent.change(screen.getByLabelText("Request URL"), {
      target: { value: "https://api.test.local/v1/orders?status=open" }
    });
    await waitFor(() => {
      expect(nativeMocks.onCloseRequested.mock.calls.length).toBeGreaterThan(closeRegistrationCount);
    });
    const preventDefault = vi.fn();
    act(() => {
      nativeMocks.closeHandler?.({ preventDefault });
    });
    const prompt = await screen.findByRole("dialog", { name: "Unsaved changes" });
    fireEvent.click(within(prompt).getByRole("button", { name: "Save And Continue" }));

    const saveDialog = await screen.findByRole("dialog", { name: "Save Project" });
    fireEvent.click(within(saveDialog).getByRole("button", { name: "Save Project" }));

    await waitFor(() => {
      expect(nativeMocks.closeWindow).toHaveBeenCalledTimes(1);
    });
    expect(preventDefault).toHaveBeenCalledTimes(1);
    expect(nativeMocks.invoke).toHaveBeenCalledWith("save_project_file", expect.any(Object));
  });

  it("allows the native close-request hook to close a clean window", async () => {
    render(<App />);

    await waitFor(() => {
      expect(nativeMocks.onCloseRequested).toHaveBeenCalled();
      expect(nativeMocks.closeHandler).not.toBeNull();
    });

    const preventDefault = vi.fn();
    act(() => {
      nativeMocks.closeHandler?.({ preventDefault });
    });

    expect(preventDefault).not.toHaveBeenCalled();
    expect(screen.queryByRole("dialog", { name: "Unsaved changes" })).not.toBeInTheDocument();
    expect(nativeMocks.closeWindow).not.toHaveBeenCalled();
  });

  it("keeps browser mode on the in-app path dialog for non-Tauri tests", async () => {
    delete (window as Window & { __TAURI_INTERNALS__?: unknown }).__TAURI_INTERNALS__;
    render(<App />);

    fireEvent.keyDown(window, { key: "o", metaKey: true });

    expect(screen.getByRole("dialog", { name: "Open Project" })).toBeInTheDocument();
    expect(nativeMocks.open).not.toHaveBeenCalled();
  });
});
