import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { App } from "./App";
import { createSampleProject } from "./project/projectModel";

describe("Relay Studio shell", () => {
  beforeEach(() => {
    localStorage.clear();
  });

  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  async function openRecentProjectsDialog(): Promise<HTMLElement> {
    fireEvent.click(screen.getByRole("button", { name: /Search commands/i }));
    const palette = screen.getByRole("dialog", { name: "Command palette" });
    fireEvent.click(within(palette).getByRole("button", { name: /Open Recent Projects/i }));
    return screen.findByRole("dialog", { name: "Open Recent Projects" });
  }

  it("renders the core Sprint 2 workbench regions", () => {
    render(<App />);

    expect(screen.getByLabelText("Relay Studio desktop shell")).toBeInTheDocument();
    expect(screen.getByLabelText("Project explorer")).toBeInTheDocument();
    expect(screen.getByLabelText("Workbench")).toBeInTheDocument();
    expect(screen.getByLabelText("Response and console dock")).toBeInTheDocument();
    expect(screen.getByLabelText("Status bar")).toHaveTextContent("Project loaded from sample data.");
    expect(screen.queryByLabelText("Primary navigation")).not.toBeInTheDocument();
    expect(screen.queryByLabelText("Inspector")).not.toBeInTheDocument();
    expect(screen.queryByLabelText("Request construction preview")).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Mark Dirty" })).not.toBeInTheDocument();
  });

  it("collapses and expands explorer sections from the section heading", () => {
    render(<App />);

    const explorer = screen.getByLabelText("Project explorer");
    const requestsHeading = within(explorer).getByRole("button", { name: /Requests 13/i });

    fireEvent.click(requestsHeading);
    expect(within(explorer).queryByRole("button", { name: /Login/i })).not.toBeInTheDocument();
    expect(requestsHeading).toHaveAttribute("aria-expanded", "false");

    fireEvent.click(requestsHeading);
    expect(within(explorer).getByRole("button", { name: /Login/i })).toBeInTheDocument();
    expect(requestsHeading).toHaveAttribute("aria-expanded", "true");
  });

  it("does not show a no-op response body toggle for an empty response", () => {
    render(<App />);

    expect(screen.getByText("No response yet.")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /response body/i })).not.toBeInTheDocument();
  });

  it("opens and closes the optional inspector", () => {
    render(<App />);

    fireEvent.click(screen.getByRole("button", { name: "Show inspector" }));

    const inspector = screen.getByLabelText("Inspector");
    expect(inspector).toBeInTheDocument();
    expect(within(inspector).getByRole("button", { name: "Hide inspector" })).toBeInTheDocument();

    fireEvent.click(within(inspector).getByRole("button", { name: "Hide inspector" }));
    expect(screen.queryByLabelText("Inspector")).not.toBeInTheDocument();
  });

  it("changes inspector content by active editor type", () => {
    render(<App />);

    fireEvent.click(screen.getByRole("button", { name: "Show inspector" }));
    const inspector = screen.getByLabelText("Inspector");
    expect(within(inspector).getByRole("heading", { name: "Request Summary" })).toBeInTheDocument();

    const explorer = screen.getByLabelText("Project explorer");
    fireEvent.click(within(explorer).getByRole("button", { name: /Authenticated Read/i }));

    expect(within(inspector).getByRole("heading", { name: "Flow Summary" })).toBeInTheDocument();
    expect(within(inspector).queryByRole("heading", { name: "Request Summary" })).not.toBeInTheDocument();
  });

  it("exposes keyboard-accessible pane resize handles", () => {
    render(<App />);

    const workspace = screen.getByLabelText("Project explorer").parentElement as HTMLElement;
    expect(screen.getByRole("separator", { name: "Resize explorer" })).toBeInTheDocument();
    expect(screen.getByRole("separator", { name: "Resize utility dock" })).toBeInTheDocument();

    const initialExplorerWidth = Number.parseInt(workspace.style.getPropertyValue("--explorer-width"), 10);
    fireEvent.keyDown(screen.getByRole("separator", { name: "Resize explorer" }), { key: "ArrowRight" });
    expect(workspace.style.getPropertyValue("--explorer-width")).toBe(`${initialExplorerWidth + 16}px`);

    fireEvent.click(screen.getByRole("button", { name: "Show inspector" }));
    expect(screen.getByRole("separator", { name: "Resize inspector" })).toBeInTheDocument();
  });

  it("opens the command palette with keyboard shortcut", () => {
    render(<App />);

    fireEvent.keyDown(window, { key: "k", metaKey: true });

    const dialog = screen.getByRole("dialog", { name: "Command palette" });
    expect(dialog).toBeInTheDocument();
    expect(within(dialog).getByRole("button", { name: /Import API Docs/i })).toBeInTheDocument();
  });

  it("closes the command palette with Escape and restores focus to the command search", async () => {
    render(<App />);

    const searchCommands = screen.getByRole("button", { name: /Search commands/i });
    searchCommands.focus();
    fireEvent.click(searchCommands);
    expect(screen.getByRole("dialog", { name: "Command palette" })).toBeInTheDocument();

    fireEvent.keyDown(document, { key: "Escape" });

    await waitFor(() => {
      expect(screen.queryByRole("dialog", { name: "Command palette" })).not.toBeInTheDocument();
    });
    expect(searchCommands).toHaveFocus();
  });

  it("traps keyboard focus inside the command palette", () => {
    render(<App />);

    const searchCommands = screen.getByRole("button", { name: /Search commands/i });
    fireEvent.click(searchCommands);

    const dialog = screen.getByRole("dialog", { name: "Command palette" });
    const searchInput = within(dialog).getByPlaceholderText("Search commands");
    const lastCommand = within(dialog).getByRole("button", { name: /Toggle Response Dock/i });

    expect(searchInput).toHaveFocus();

    lastCommand.focus();
    fireEvent.keyDown(document, { key: "Tab" });
    expect(searchInput).toHaveFocus();

    fireEvent.keyDown(document, { key: "Tab", shiftKey: true });
    expect(lastCommand).toHaveFocus();
  });

  it("shows flow-specific execution commands in the command palette", () => {
    render(<App />);

    const explorer = screen.getByLabelText("Project explorer");
    fireEvent.click(within(explorer).getByRole("button", { name: /Authenticated Read/i }));
    fireEvent.keyDown(window, { key: "k", metaKey: true });

    const dialog = screen.getByRole("dialog", { name: "Command palette" });
    expect(within(dialog).getByRole("button", { name: /Run Flow/i })).toBeInTheDocument();
    expect(within(dialog).queryByRole("button", { name: /Send Request/i })).not.toBeInTheDocument();
  });

  it("filters the command palette by typed text", () => {
    render(<App />);

    fireEvent.click(screen.getByRole("button", { name: /Search commands/i }));
    const dialog = screen.getByRole("dialog", { name: "Command palette" });
    fireEvent.change(within(dialog).getByPlaceholderText("Search commands"), {
      target: { value: "settings" }
    });

    expect(within(dialog).getByRole("button", { name: /Settings/i })).toBeInTheDocument();
    expect(within(dialog).queryByRole("button", { name: /Open Project/i })).not.toBeInTheDocument();
  });

  it("does not intercept native text editing shortcuts", () => {
    render(<App />);

    for (const key of ["x", "c", "v", "a"]) {
      const event = new KeyboardEvent("keydown", {
        bubbles: true,
        cancelable: true,
        key,
        metaKey: true
      });
      window.dispatchEvent(event);

      expect(event.defaultPrevented).toBe(false);
    }
  });

  it("suppresses browser context menus outside editable text fields", () => {
    render(<App />);

    const shell = screen.getByLabelText("Relay Studio desktop shell");
    const shellContextMenu = new MouseEvent("contextmenu", { bubbles: true, cancelable: true });
    shell.dispatchEvent(shellContextMenu);
    expect(shellContextMenu.defaultPrevented).toBe(true);

    const requestUrl = screen.getByLabelText("Request URL");
    const textContextMenu = new MouseEvent("contextmenu", { bubbles: true, cancelable: true });
    requestUrl.dispatchEvent(textContextMenu);
    expect(textContextMenu.defaultPrevented).toBe(false);
  });

  it("marks platform chrome breakpoint and active window state", async () => {
    const innerWidthSpy = vi.spyOn(window, "innerWidth", "get").mockReturnValue(620);
    render(<App />);

    const shell = screen.getByLabelText("Relay Studio desktop shell");
    expect(shell).toHaveAttribute("data-breakpoint", "small");
    expect(shell).toHaveAttribute("data-window-active", "true");

    innerWidthSpy.mockReturnValue(840);
    fireEvent(window, new Event("resize"));
    expect(shell).toHaveAttribute("data-breakpoint", "medium");

    fireEvent.blur(window);
    await waitFor(() => {
      expect(shell).toHaveAttribute("data-window-active", "false");
    });
  });

  it("opens the project save dialog from the toolbar", async () => {
    render(<App />);

    fireEvent.click(screen.getByRole("button", { name: /^Save$/i }));

    expect(await screen.findByRole("dialog", { name: "Save Project" })).toBeInTheDocument();
    expect(screen.getByLabelText("Project file path")).toHaveValue("/private/tmp/sample-api-regression.restproj");
  });

  it("routes the save keyboard shortcut to the save project dialog", async () => {
    render(<App />);

    fireEvent.keyDown(window, { key: "s", metaKey: true });

    expect(await screen.findByRole("dialog", { name: "Save Project" })).toBeInTheDocument();
    expect(screen.queryByRole("dialog", { name: "Unsaved changes" })).not.toBeInTheDocument();
  });

  it("routes the save-as keyboard shortcut to the save-as project dialog", async () => {
    render(<App />);

    fireEvent.keyDown(window, { key: "s", metaKey: true, shiftKey: true });

    expect(await screen.findByRole("dialog", { name: "Save Project As" })).toBeInTheDocument();
    expect(screen.getByLabelText("Project file path")).toHaveValue("/private/tmp/sample-api-regression.restproj");
  });

  it("routes the close-tab keyboard shortcut to the active tab", () => {
    render(<App />);

    expect(screen.getByRole("tab", { name: /Create Order/i })).toBeInTheDocument();

    fireEvent.keyDown(window, { key: "w", metaKey: true });

    expect(screen.queryByRole("tab", { name: /Create Order/i })).not.toBeInTheDocument();
  });

  it("routes the execution keyboard shortcut to the active request", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response("{\"ok\":true}", {
      status: 200,
      statusText: "OK",
      headers: { "content-type": "application/json" }
    })));
    render(<App />);

    fireEvent.keyDown(window, { key: "Enter", metaKey: true });

    await waitFor(() => {
      expect(screen.getByText("Request completed with HTTP 200.")).toBeInTheDocument();
    });
  });

  it("completes the close-window dirty-state route after discard", async () => {
    const closeSpy = vi.spyOn(window, "close").mockImplementation(() => undefined);
    render(<App />);

    fireEvent.change(screen.getByLabelText("Request URL"), {
      target: { value: "https://api.test.local/v1/orders?status=open" }
    });
    fireEvent.keyDown(window, { key: "w", metaKey: true, shiftKey: true });

    const savePrompt = screen.getByRole("dialog", { name: "Unsaved changes" });
    fireEvent.click(within(savePrompt).getByRole("button", { name: "Do Not Save" }));

    await waitFor(() => {
      expect(closeSpy).toHaveBeenCalledTimes(1);
    });
  });

  it("cancels dirty close-window flow without closing or clearing dirty state", async () => {
    const closeSpy = vi.spyOn(window, "close").mockImplementation(() => undefined);
    render(<App />);

    fireEvent.change(screen.getByLabelText("Request URL"), {
      target: { value: "https://api.test.local/v1/orders?status=open" }
    });
    fireEvent.keyDown(window, { key: "w", metaKey: true, shiftKey: true });

    const savePrompt = screen.getByRole("dialog", { name: "Unsaved changes" });
    expect(within(savePrompt).getByRole("button", { name: "Cancel" })).toHaveFocus();
    fireEvent.keyDown(document, { key: "Escape" });

    await waitFor(() => {
      expect(screen.queryByRole("dialog", { name: "Unsaved changes" })).not.toBeInTheDocument();
    });
    expect(closeSpy).not.toHaveBeenCalled();
    expect(screen.getByRole("button", { name: /^Save \*$/i })).toBeInTheDocument();
  });

  it("keeps dirty close-tab cancellation scoped to the active tab", async () => {
    render(<App />);

    fireEvent.change(screen.getByLabelText("Request URL"), {
      target: { value: "https://api.test.local/v1/orders?status=open" }
    });
    fireEvent.keyDown(window, { key: "w", metaKey: true });

    const savePrompt = screen.getByRole("dialog", { name: "Unsaved changes" });
    fireEvent.click(within(savePrompt).getByRole("button", { name: "Cancel" }));

    await waitFor(() => {
      expect(screen.queryByRole("dialog", { name: "Unsaved changes" })).not.toBeInTheDocument();
    });
    expect(screen.getByRole("tab", { name: /Create Order/i })).toBeInTheDocument();
    expect(screen.getByLabelText("Request URL")).toHaveValue("https://api.test.local/v1/orders?status=open");
    expect(screen.getByRole("button", { name: /^Save \*$/i })).toBeInTheDocument();
  });

  it("updates the request method from the top HTTP method selector", () => {
    render(<App />);

    const explorer = screen.getByLabelText("Project explorer");
    fireEvent.click(within(explorer).getByRole("button", { name: /Health Check/i }));
    fireEvent.change(screen.getByLabelText("HTTP method"), { target: { value: "POST" } });

    expect(screen.getByLabelText("Request method")).toHaveValue("POST");
    expect(screen.getByRole("tab", { name: /POST Health Check/i })).toBeInTheDocument();
    expect(within(explorer).getByRole("button", { name: /POST Health Check/i })).toBeInTheDocument();
  });

  it("keeps active request details synchronized when selecting an open request tab", () => {
    render(<App />);

    const explorer = screen.getByLabelText("Project explorer");
    fireEvent.click(within(explorer).getByRole("button", { name: /Health Check/i }));
    fireEvent.click(screen.getByRole("tab", { name: /Login/i }));
    fireEvent.click(screen.getByRole("tab", { name: /Health Check/i }));

    expect(screen.getByLabelText("Request name")).toHaveValue("Health Check");
    expect(screen.getByLabelText("Request path")).toHaveValue("/api/health");
  });

  it("renders Welcome as an app overview instead of a REST request editor", () => {
    render(<App />);

    fireEvent.click(screen.getByRole("tab", { name: /Welcome/i }));

    expect(screen.getByRole("heading", { name: "Welcome to Relay Studio" })).toBeInTheDocument();
    expect(screen.queryByLabelText("Request composer")).not.toBeInTheDocument();
    expect(screen.queryByLabelText("Request URL")).not.toBeInTheDocument();
    expect(screen.queryByLabelText("Response and console dock")).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Send Request" })).not.toBeInTheDocument();
  });

  it("renders Settings without stale request controls", () => {
    render(<App />);

    fireEvent.keyDown(window, { key: ",", metaKey: true });

    expect(screen.getByRole("heading", { name: "Request Policy" })).toBeInTheDocument();
    expect(screen.getByLabelText("Project settings")).toBeInTheDocument();
    expect(screen.getByLabelText("HTTP version")).toBeInTheDocument();
    expect(screen.getByLabelText("Request timeout ms")).toHaveValue(30000);
    expect(screen.getByLabelText("SSL certificate verification")).toBeChecked();
    expect(screen.getByRole("radiogroup", { name: "Response format detection" })).toBeInTheDocument();
    expect(screen.getByRole("radio", { name: "Auto" })).toBeChecked();
    expect(screen.getByRole("radio", { name: "JSON" })).not.toBeChecked();
    fireEvent.click(screen.getByRole("button", { name: "Workspace" }));
    expect(screen.getByLabelText("Default environment")).toBeInTheDocument();
    expect(screen.getByLabelText("Save on close")).toBeChecked();
    expect(screen.getByLabelText("Always ask when closing unsaved tabs")).toBeChecked();
    expect(screen.getByLabelText("Working directory")).toHaveValue("/private/tmp");
    expect(screen.getByRole("button", { name: "Export Diagnostics" })).toBeInTheDocument();
    expect(screen.queryByLabelText("Request composer")).not.toBeInTheDocument();
    expect(screen.queryByLabelText("Request URL")).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Send Request" })).not.toBeInTheDocument();
  });

  it("changes project settings from the Settings tab", () => {
    render(<App />);

    fireEvent.keyDown(window, { key: ",", metaKey: true });
    fireEvent.change(screen.getByLabelText("Request timeout ms"), {
      target: { value: "45000" }
    });
    expect(screen.getByText("Request timeout updated.")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("radio", { name: "JSON" }));
    expect(screen.getByRole("radio", { name: "JSON" })).toBeChecked();
    expect(screen.getByText("Response format detection set to JSON.")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Workspace" }));
    fireEvent.change(screen.getByLabelText("Default environment"), {
      target: { value: "staging" }
    });

    expect(screen.getByText("Default environment set to Staging Environment.")).toBeInTheDocument();
    expect(screen.getByText("Unsaved changes")).toBeInTheDocument();
    expect(screen.getByLabelText("Default environment")).toHaveValue("staging");
    expect(screen.getAllByText("Staging Environment").length).toBeGreaterThan(0);
  });

  it("updates theme and proxy settings from the Settings tab", () => {
    render(<App />);

    fireEvent.keyDown(window, { key: ",", metaKey: true });
    fireEvent.click(screen.getByRole("button", { name: "Display" }));
    fireEvent.click(screen.getByRole("button", { name: /Dark/ }));

    expect(screen.getByLabelText("Relay Studio desktop shell")).toHaveAttribute("data-theme", "dark");
    expect(screen.getByText("Dark theme enabled.")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Network Proxy" }));
    fireEvent.click(screen.getByLabelText("Use proxy"));
    fireEvent.change(screen.getByLabelText("Proxy server URL"), {
      target: { value: "proxy.internal.test" }
    });
    fireEvent.change(screen.getByLabelText("Proxy server port"), {
      target: { value: "8088" }
    });

    expect(screen.getByLabelText("Use proxy")).toBeChecked();
    expect(screen.getByLabelText("Proxy server URL")).toHaveValue("proxy.internal.test");
    expect(screen.getByLabelText("Proxy server port")).toHaveValue(8088);
    expect(screen.getByText("Proxy port updated.")).toBeInTheDocument();
  });

  it("uses the close prompt setting when closing dirty work", async () => {
    const closeSpy = vi.spyOn(window, "close").mockImplementation(() => undefined);
    render(<App />);

    fireEvent.keyDown(window, { key: ",", metaKey: true });
    fireEvent.click(screen.getByRole("button", { name: "Workspace" }));
    fireEvent.click(screen.getByLabelText("Save on close"));
    fireEvent.change(screen.getByLabelText("Default environment"), {
      target: { value: "staging" }
    });
    fireEvent.keyDown(window, { key: "w", metaKey: true, shiftKey: true });

    expect(screen.queryByRole("dialog", { name: "Unsaved changes" })).not.toBeInTheDocument();
    await waitFor(() => {
      expect(closeSpy).toHaveBeenCalledTimes(1);
    });
  });

  it("creates a new project with an editable starter request", () => {
    render(<App />);

    fireEvent.click(screen.getByRole("button", { name: /Search commands/i }));
    const dialog = screen.getByRole("dialog", { name: "Command palette" });
    fireEvent.click(within(dialog).getByRole("button", { name: /New Project/i }));

    const nameDialog = screen.getByRole("dialog", { name: "New Project" });
    fireEvent.change(within(nameDialog).getByLabelText("Project name"), {
      target: { value: "Developer Demo API" }
    });
    fireEvent.click(within(nameDialog).getByRole("button", { name: "Create Project" }));

    expect(screen.getByRole("tab", { name: /New Request/i })).toBeInTheDocument();
    expect(screen.getByText('New unsaved project "Developer Demo API" created with a starter request.')).toBeInTheDocument();
    const requestUrl = screen.getByLabelText("Request URL");
    expect(requestUrl).not.toHaveAttribute("readonly");
    expect(requestUrl).toHaveValue("https://api.example.com/api/health");
  });

  it("creates a new project from the explorer plus button", async () => {
    render(<App />);

    const explorer = screen.getByLabelText("Project explorer");
    fireEvent.click(within(explorer).getByRole("button", { name: "New project" }));

    const nameDialog = screen.getByRole("dialog", { name: "New Project" });
    fireEvent.change(within(nameDialog).getByLabelText("Project name"), {
      target: { value: "Orders API Demo" }
    });
    fireEvent.click(within(nameDialog).getByRole("button", { name: "Create Project" }));

    expect(screen.getByRole("tab", { name: /New Request/i })).toBeInTheDocument();
    expect(screen.getByText('New unsaved project "Orders API Demo" created with a starter request.')).toBeInTheDocument();
    expect(within(explorer).getByText("Orders API Demo *")).toBeInTheDocument();
    expect(screen.queryByText("New request created.")).not.toBeInTheDocument();

    const recentDialog = await openRecentProjectsDialog();
    fireEvent.click(await within(recentDialog).findByRole("button", { name: /Sample API Regression/i }));

    const savePrompt = screen.getByRole("dialog", { name: "Unsaved changes" });
    expect(within(savePrompt).getByText(/Orders API Demo has unsaved service and flow edits/i)).toBeInTheDocument();
    expect(within(savePrompt).getByText(/unsaved service and flow edits/i)).toBeInTheDocument();
    fireEvent.click(within(savePrompt).getByRole("button", { name: "Do Not Save" }));

    expect(within(explorer).getByText("Sample API Regression")).toBeInTheDocument();
    expect(screen.getByText("Restored Sample API Regression.")).toBeInTheDocument();
  });

  it("removes stale recent projects after a missing file error", async () => {
    const missingPath = "/private/tmp/missing-project.restproj";
    localStorage.setItem("relay-studio:recent-projects", JSON.stringify([
      { name: "Missing Project", path: missingPath, openedAt: "2026-06-27T18:57:00.000Z" }
    ]));
    render(<App />);

    const missingDialog = await openRecentProjectsDialog();
    const missingProject = await within(missingDialog).findByRole("button", { name: /Missing Project/ });
    fireEvent.click(missingProject);

    await waitFor(() => {
      expect(screen.getByText(`Project file was not found: ${missingPath}`)).toBeInTheDocument();
    });
    const recentDialog = await openRecentProjectsDialog();
    expect(within(recentDialog).queryByRole("button", { name: /Missing Project/ })).not.toBeInTheDocument();
    expect(JSON.parse(localStorage.getItem("relay-studio:recent-projects") ?? "[]")).toEqual([]);
  });

  it("reconciles flow tabs when opening and renaming a saved project flow", async () => {
    const path = "/private/tmp/test-project-4.restproj";
    const sample = createSampleProject("2026-06-28T00:00:00.000Z");
    const savedProject = {
      ...sample,
      id: "test-project-4",
      name: "Test Project 4",
      flows: [
        {
          ...sample.flows[0],
          id: "flow-1",
          name: "New Flow 1"
        }
      ]
    };
    localStorage.setItem(`relay-studio:project:${path}`, JSON.stringify(savedProject));
    localStorage.setItem("relay-studio:recent-projects", JSON.stringify([
      { name: "Test Project 4", path, openedAt: "2026-06-28T16:21:00.000Z" }
    ]));
    render(<App />);

    const explorer = screen.getByLabelText("Project explorer");
    const recentDialog = await openRecentProjectsDialog();
    fireEvent.click(await within(recentDialog).findByRole("button", { name: /Test Project 4/ }));

    await waitFor(() => {
      expect(within(explorer).getByRole("button", { name: /New Flow 1/ })).toBeInTheDocument();
    });
    expect(screen.queryByRole("tab", { name: /Authenticated Read/i })).not.toBeInTheDocument();

    fireEvent.click(within(explorer).getByRole("button", { name: /New Flow 1/ }));
    expect(screen.getByRole("tab", { name: /New Flow 1/i })).toBeInTheDocument();

    fireEvent.contextMenu(screen.getByRole("tab", { name: /New Flow 1/i }), { clientX: 420, clientY: 96 });
    const menu = screen.getByRole("menu", { name: "Flow tab context menu" });
    fireEvent.click(within(menu).getByRole("menuitem", { name: "Rename Flow" }));
    const renameDialog = screen.getByRole("dialog", { name: "Rename Flow" });
    fireEvent.change(within(renameDialog).getByLabelText("Project name"), {
      target: { value: "Flow Test" }
    });
    fireEvent.click(within(renameDialog).getByRole("button", { name: "Rename Flow" }));

    await waitFor(() => {
      expect(screen.getByRole("tab", { name: /Flow Test/i })).toBeInTheDocument();
    });
    expect(within(explorer).getByRole("button", { name: /Flow Test/i })).toBeInTheDocument();
    expect(screen.queryByRole("tab", { name: /Authenticated Read/i })).not.toBeInTheDocument();
  });

  it("moves recent projects out of the explorer and into the command surface", async () => {
    localStorage.setItem("relay-studio:recent-projects", JSON.stringify(
      Array.from({ length: 7 }, (_, index) => ({
        name: `Recent Project ${index + 1}`,
        path: `/private/tmp/recent-project-${index + 1}.restproj`,
        openedAt: `2026-06-27T18:5${index}:00.000Z`
      }))
    ));
    render(<App />);

    const explorer = screen.getByLabelText("Project explorer");
    expect(within(explorer).queryByLabelText("Recent Projects")).not.toBeInTheDocument();

    const recentDialog = await openRecentProjectsDialog();
    const recentProjects = within(recentDialog);
    expect(await recentProjects.findByRole("button", { name: /Recent Project 1/ })).toBeInTheDocument();
    expect(recentProjects.getByRole("button", { name: /Recent Project 5/ })).toBeInTheDocument();
    expect(recentProjects.getByRole("button", { name: /Recent Project 7/ })).toBeInTheDocument();
  });

  it("hides a saved recent project when the active dirty project has the same name", async () => {
    localStorage.setItem("relay-studio:recent-projects", JSON.stringify([
      {
        name: "Test Project 2",
        path: "/private/tmp/test-project-2.restproj",
        openedAt: "2026-06-27T19:57:00.000Z"
      }
    ]));
    render(<App />);

    const explorer = screen.getByLabelText("Project explorer");
    fireEvent.click(within(explorer).getByRole("button", { name: "New project" }));
    const nameDialog = screen.getByRole("dialog", { name: "New Project" });
    fireEvent.change(within(nameDialog).getByLabelText("Project name"), {
      target: { value: "Test Project 2" }
    });
    fireEvent.click(within(nameDialog).getByRole("button", { name: "Create Project" }));

    await waitFor(() => {
      expect(within(explorer).getByText("Test Project 2 *")).toBeInTheDocument();
    });
    const recentDialog = await openRecentProjectsDialog();
    await waitFor(() => {
      expect(within(recentDialog).queryByRole("button", { name: /Test Project 2/ })).not.toBeInTheDocument();
    });
  });

  it("keeps the project being left available while switching between recent projects", async () => {
    render(<App />);

    const explorer = screen.getByLabelText("Project explorer");
    fireEvent.click(within(explorer).getByRole("button", { name: "New project" }));
    const nameDialog = screen.getByRole("dialog", { name: "New Project" });
    fireEvent.change(within(nameDialog).getByLabelText("Project name"), {
      target: { value: "New Test Project" }
    });
    fireEvent.click(within(nameDialog).getByRole("button", { name: "Create Project" }));

    fireEvent.click(within(screen.getByLabelText("Primary commands")).getByRole("button", { name: /^Save/i }));
    const saveDialog = await screen.findByRole("dialog", { name: "Save Project" });
    fireEvent.click(within(saveDialog).getByRole("button", { name: "Save Project" }));

    await waitFor(() => {
      expect(screen.getByText("Project saved to /private/tmp/new-test-project.restproj.")).toBeInTheDocument();
    });

    let recentDialog = await openRecentProjectsDialog();
    fireEvent.click(await within(recentDialog).findByRole("button", { name: /Sample API Regression/ }));

    await waitFor(() => {
      expect(screen.getByText("Restored Sample API Regression.")).toBeInTheDocument();
    });
    recentDialog = await openRecentProjectsDialog();
    expect(await within(recentDialog).findByRole("button", { name: /New Test Project/ })).toBeInTheDocument();
    fireEvent.click(within(recentDialog).getByRole("button", { name: "Close recent projects" }));

    recentDialog = await openRecentProjectsDialog();
    fireEvent.click(await within(recentDialog).findByRole("button", { name: /New Test Project/ }));

    await waitFor(() => {
      expect(screen.getByText("Restored New Test Project.")).toBeInTheDocument();
    });
    recentDialog = await openRecentProjectsDialog();
    expect(await within(recentDialog).findByRole("button", { name: /Sample API Regression/ })).toBeInTheDocument();
  });

  it("renames and deletes recent projects from the recent projects command surface", async () => {
    const archivedProject = createSampleProject("2026-06-21T00:00:00.000Z");
    archivedProject.name = "Archived Regression";
    const archivedPath = "/private/tmp/archived-regression.restproj";
    localStorage.setItem(`relay-studio:project:${archivedPath}`, JSON.stringify(archivedProject));
    localStorage.setItem("relay-studio:recent-projects", JSON.stringify([
      { name: archivedProject.name, path: archivedPath, openedAt: archivedProject.createdAt }
    ]));
    render(<App />);

    let recentDialog = await openRecentProjectsDialog();
    let recentProjects = within(recentDialog);

    const recentProject = await recentProjects.findByRole("button", { name: /Archived Regression/ });
    fireEvent.contextMenu(recentProject);
    const menu = screen.getByRole("menu", { name: "Project context menu" });
    fireEvent.click(within(menu).getByRole("menuitem", { name: "Rename Project" }));

    const renameDialog = screen.getByRole("dialog", { name: "Rename Project" });
    fireEvent.change(within(renameDialog).getByLabelText("Project name"), {
      target: { value: "Renamed Regression" }
    });
    fireEvent.click(within(renameDialog).getByRole("button", { name: "Rename Project" }));

    await waitFor(() => {
      expect(screen.getByText("Project renamed to Renamed Regression.")).toBeInTheDocument();
    });

    recentDialog = await openRecentProjectsDialog();
    recentProjects = within(recentDialog);
    fireEvent.contextMenu(await recentProjects.findByRole("button", { name: /Renamed Regression/ }));
    fireEvent.click(within(screen.getByRole("menu", { name: "Project context menu" })).getByRole("menuitem", { name: "Delete Project" }));

    const deleteDialog = screen.getByRole("dialog", { name: "Delete Project" });
    expect(within(deleteDialog).getByText(/This action is destructive/)).toBeInTheDocument();
    fireEvent.click(within(deleteDialog).getByRole("button", { name: "Delete Project" }));

    await waitFor(() => {
      expect(localStorage.getItem(`relay-studio:project:${archivedPath}`)).toBeNull();
    });
  });

  it("creates a request from the tab strip plus button", () => {
    render(<App />);

    fireEvent.click(screen.getByRole("button", { name: "New request tab" }));

    expect(screen.getByRole("tab", { name: /New Request/i })).toBeInTheDocument();
    expect(screen.getByText("New request created.")).toBeInTheDocument();
  });

  it("lets the active request URL be edited directly", () => {
    render(<App />);

    const requestUrl = screen.getByLabelText("Request URL");
    fireEvent.change(requestUrl, {
      target: { value: "https://api.test.local/v1/orders?status=open" }
    });

    expect(requestUrl).toHaveValue("https://api.test.local/v1/orders?status=open");
    expect(screen.getByText("Request URL updated.")).toBeInTheDocument();
  });

  it("selects bearer token variables from the active environment", () => {
    render(<App />);

    const tokenVariable = screen.getByLabelText("Bearer token variable name");

    expect(tokenVariable.tagName).toBe("SELECT");
    expect(tokenVariable).toHaveValue("accessToken");
    expect(within(tokenVariable).getByRole("option", { name: "accessToken" })).toBeInTheDocument();
    expect(within(tokenVariable).getByRole("option", { name: "password" })).toBeInTheDocument();
  });

  it("edits active environment variables from the inspector", async () => {
    render(<App />);

    fireEvent.click(screen.getByRole("button", { name: "Show inspector" }));
    const inspector = screen.getByLabelText("Inspector");

    expect(within(inspector).queryByRole("button", { name: "Variables" })).not.toBeInTheDocument();
    expect(within(inspector).queryByText("Active Environment")).not.toBeInTheDocument();

    fireEvent.change(within(inspector).getByLabelText("Variable value accessToken"), {
      target: { value: "demo-token" }
    });
    fireEvent.click(within(inspector).getByRole("button", { name: /Add Variable/i }));

    await waitFor(() => {
      expect(screen.getByText("Environment variable added.")).toBeInTheDocument();
    });
    expect(within(inspector).getByLabelText("Variable value accessToken")).toHaveValue("demo-token");
    expect(screen.getByRole("option", { name: "newVariable" })).toBeInTheDocument();
  });

  it("opens the visual flow builder from the explorer", () => {
    render(<App />);

    const explorer = screen.getByLabelText("Project explorer");
    fireEvent.click(within(explorer).getByRole("button", { name: /Authenticated Read/i }));

    const builder = screen.getByLabelText("Flow builder");
    expect(builder).toBeInTheDocument();
    expect(within(builder).getByText("Authenticated Read")).toBeInTheDocument();
    expect(within(builder).queryByRole("button", { name: /Run Flow/i })).not.toBeInTheDocument();
    expect(screen.getAllByRole("button", { name: /Run Flow/i })).toHaveLength(1);
    expect(screen.queryByRole("button", { name: "Request actions" })).not.toBeInTheDocument();
    expect(within(builder).getByRole("separator", { name: "Resize flow details" })).toBeInTheDocument();
  });

  it("toggles flow details from the command surface", () => {
    render(<App />);

    const explorer = screen.getByLabelText("Project explorer");
    fireEvent.click(within(explorer).getByRole("button", { name: /Authenticated Read/i }));
    expect(screen.getByLabelText("Flow step details")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: /Search commands/i }));
    fireEvent.click(within(screen.getByRole("dialog", { name: "Command palette" })).getByRole("button", { name: /Toggle Flow Details/i }));

    expect(screen.queryByLabelText("Flow step details")).not.toBeInTheDocument();
    expect(screen.queryByRole("separator", { name: "Resize flow details" })).not.toBeInTheDocument();
  });

  it("regresses view toggle state from the command palette across tab types", () => {
    render(<App />);

    fireEvent.click(screen.getByRole("button", { name: /Search commands/i }));
    fireEvent.click(within(screen.getByRole("dialog", { name: "Command palette" })).getByRole("button", { name: /Toggle Sidebar/i }));

    expect(screen.queryByLabelText("Project explorer")).not.toBeInTheDocument();
    expect(screen.getByLabelText("Status bar")).toHaveTextContent("Sidebar hidden");

    fireEvent.click(screen.getByRole("button", { name: /Search commands/i }));
    fireEvent.click(within(screen.getByRole("dialog", { name: "Command palette" })).getByRole("button", { name: /Toggle Inspector/i }));

    expect(screen.getByLabelText("Inspector")).toBeInTheDocument();
    expect(screen.getByLabelText("Status bar")).toHaveTextContent("Inspector shown");

    fireEvent.click(screen.getByRole("tab", { name: "Welcome" }));
    fireEvent.click(screen.getByRole("button", { name: /Search commands/i }));
    expect(within(screen.getByRole("dialog", { name: "Command palette" })).queryByRole("button", { name: /Toggle Response Dock/i })).not.toBeInTheDocument();
    fireEvent.keyDown(document, { key: "Escape" });

    fireEvent.click(screen.getByRole("tab", { name: /Login/i }));
    expect(screen.getByLabelText("Response and console dock")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: /Search commands/i }));
    fireEvent.click(within(screen.getByRole("dialog", { name: "Command palette" })).getByRole("button", { name: /Toggle Response Dock/i }));

    expect(screen.queryByLabelText("Response and console dock")).not.toBeInTheDocument();
    expect(screen.getByLabelText("Status bar")).toHaveTextContent("Dock hidden");
  });

  it("selects flow steps without dirtying layout or losing detail synchronization", () => {
    render(<App />);

    const explorer = screen.getByLabelText("Project explorer");
    fireEvent.click(within(explorer).getByRole("button", { name: /Authenticated Read/i }));

    const builder = screen.getByLabelText("Flow builder");
    fireEvent.click(within(builder).getByRole("button", { name: "Flow step List Products" }));

    expect(within(screen.getByLabelText("Flow step details")).getByLabelText("Step order")).toHaveTextContent("3");
    expect(within(builder).getByLabelText("Path target")).toHaveDisplayValue("Get Product");
    expect(screen.queryByText("Flow layout updated.")).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: /^Save$/i })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /^Save \*$/i })).not.toBeInTheDocument();
  });

  it("exposes visible flow canvas controls with interaction state", () => {
    render(<App />);

    const explorer = screen.getByLabelText("Project explorer");
    fireEvent.click(within(explorer).getByRole("button", { name: /Authenticated Read/i }));

    const builder = screen.getByLabelText("Flow builder");
    expect(within(builder).getByRole("button", { name: "Zoom In" })).toBeInTheDocument();
    expect(within(builder).getByRole("button", { name: "Zoom Out" })).toBeInTheDocument();
    expect(within(builder).getByRole("button", { name: "Fit View" })).toBeInTheDocument();

    const lockButton = within(builder).getByRole("button", { name: "Lock Flow Layout" });
    fireEvent.click(lockButton);
    expect(within(builder).getByRole("button", { name: "Unlock Flow Layout" })).toHaveAttribute("aria-pressed", "true");
  });

  it("edits response mappings for a selected flow step", async () => {
    render(<App />);

    const explorer = screen.getByLabelText("Project explorer");
    fireEvent.click(within(explorer).getByRole("button", { name: /Authenticated Read/i }));

    const builder = screen.getByLabelText("Flow builder");
    const mappings = within(builder).getByLabelText("Response mappings");
    const variableSummary = within(builder).getByLabelText("Flow variable summary");
    expect(within(mappings).getByText("1 mapping configured.")).toBeInTheDocument();
    expect(within(mappings).queryByDisplayValue("$.accessToken")).not.toBeInTheDocument();
    expect(within(variableSummary).getByText("Captures")).toBeInTheDocument();
    expect(within(variableSummary).getByText("accessToken")).toBeInTheDocument();
    fireEvent.click(within(mappings).getByRole("button", { name: "Manage Response Mappings" }));

    const dialog = screen.getByRole("dialog", { name: "Response Mappings" });
    expect(within(dialog).getByRole("table", { name: "Response mapping table" })).toBeInTheDocument();
    expect(within(dialog).getByDisplayValue("$.accessToken")).toBeInTheDocument();
    expect(within(dialog).queryByRole("button", { name: "Capture Token" })).not.toBeInTheDocument();
    expect(within(dialog).queryByRole("button", { name: "Capture Id" })).not.toBeInTheDocument();
    expect(within(dialog).getByLabelText("JSONPath examples")).toBeInTheDocument();
    expect(within(dialog).getByText("Top-level field named accessToken.")).toBeInTheDocument();
    expect(within(dialog).getByText("First item in an array.")).toBeInTheDocument();

    fireEvent.change(within(dialog).getByLabelText("Mapping 1 variable"), {
      target: { value: "sessionToken" }
    });
    fireEvent.click(within(dialog).getByRole("button", { name: "Add Mapping" }));

    await waitFor(() => {
      expect(screen.getByText("Flow mapping added.")).toBeInTheDocument();
    });
    expect(within(dialog).getByDisplayValue("sessionToken")).toBeInTheDocument();
    expect(within(dialog).getByLabelText("Mapping 2 variable")).toBeInTheDocument();
  });

  it("shows the final flow step response in the response dock after running a flow", async () => {
    const path = "/private/tmp/flow-response-demo.restproj";
    const savedProject = createSampleProject("2026-06-28T20:39:00.000Z");
    const authenticatedRead = savedProject.flows.find((flow) => flow.id === "authenticated-read");
    if (!authenticatedRead) throw new Error("Authenticated Read sample flow is required for this test.");
    savedProject.id = "flow-response-demo";
    savedProject.name = "Flow Response Demo";
    savedProject.flows = [{
      ...authenticatedRead,
      id: "flow-test",
      name: "Flow Test",
      steps: ["login", "current-user", "list-products"],
      nodes: authenticatedRead.nodes.slice(0, 3),
      edges: authenticatedRead.edges.slice(0, 2),
      mappings: authenticatedRead.mappings
    }];
    localStorage.setItem(`relay-studio:project:${path}`, JSON.stringify(savedProject));
    localStorage.setItem("relay-studio:recent-projects", JSON.stringify([
      { name: "Flow Response Demo", path, openedAt: "2026-06-28T20:39:00.000Z" }
    ]));
    vi.stubGlobal("fetch", vi.fn()
      .mockResolvedValueOnce(new Response(JSON.stringify({ accessToken: "flow-token" }), {
        status: 200,
        statusText: "OK",
        headers: { "content-type": "application/json" }
      }))
      .mockResolvedValueOnce(new Response(JSON.stringify({ id: "user-1", name: "QA User" }), {
        status: 200,
        statusText: "OK",
        headers: { "content-type": "application/json" }
      }))
      .mockResolvedValueOnce(new Response(JSON.stringify({
        products: [
          { id: "prod-1001", name: "Configured Keyboard" },
          { id: "prod-1002", name: "Configured Monitor" }
        ]
      }), {
        status: 200,
        statusText: "OK",
        headers: { "content-type": "application/json" }
      }))
    );

    render(<App />);

    const explorer = screen.getByLabelText("Project explorer");
    const recentDialog = await openRecentProjectsDialog();
    fireEvent.click(await within(recentDialog).findByRole("button", { name: /Flow Response Demo/ }));
    await waitFor(() => {
      expect(within(explorer).getByRole("button", { name: /Flow Test/ })).toBeInTheDocument();
    });
    fireEvent.click(within(explorer).getByRole("button", { name: /Flow Test/ }));
    fireEvent.click(screen.getByRole("button", { name: "Run Flow" }));

    await waitFor(() => {
      expect(screen.getByText("Flow run completed.")).toBeInTheDocument();
    });
    expect(screen.getByText(/Configured Keyboard/)).toBeInTheDocument();
    expect(screen.getByText(/Configured Monitor/)).toBeInTheDocument();
    expect(screen.queryByText("No response yet.")).not.toBeInTheDocument();
  });

  it("formats response body size as KB in the response metadata", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response("a".repeat(3467), {
      status: 200,
      statusText: "OK",
      headers: { "content-type": "text/plain" }
    })));
    render(<App />);

    const explorer = screen.getByLabelText("Project explorer");
    fireEvent.click(within(explorer).getByRole("button", { name: /Health Check/i }));
    fireEvent.click(within(screen.getByLabelText("Request composer")).getByRole("button", { name: "Send Request" }));

    await waitFor(() => {
      expect(screen.getByText("3.4 KB")).toBeInTheDocument();
    });
    const responseContent = screen.getByLabelText("Response content");
    const responseMetadata = within(responseContent).getByLabelText("Response metadata");
    expect(within(responseMetadata).queryByRole("button", { name: "Save Response" })).not.toBeInTheDocument();
    expect(within(responseContent).getByRole("button", { name: "Save Response" })).toBeEnabled();
    expect(screen.queryByText("3467 B")).not.toBeInTheDocument();
  });

  it("lets the user cancel an in-flight request and explains the cancellation", async () => {
    vi.stubGlobal("fetch", vi.fn((_url: string, init?: RequestInit) => new Promise((_resolve, reject) => {
      init?.signal?.addEventListener("abort", () => reject(new DOMException("Cancelled", "AbortError")), { once: true });
    })));
    render(<App />);

    const explorer = screen.getByLabelText("Project explorer");
    fireEvent.click(within(explorer).getByRole("button", { name: /Health Check/i }));
    fireEvent.click(within(screen.getByLabelText("Request composer")).getByRole("button", { name: "Send Request" }));
    const cancel = await within(screen.getByLabelText("Request composer")).findByRole("button", { name: "Cancel Request" });
    fireEvent.click(cancel);

    await waitFor(() => {
      expect(screen.getAllByText("Request cancelled.").length).toBeGreaterThan(0);
    });
    expect(within(screen.getByLabelText("Request composer")).getByRole("button", { name: "Send Request" })).toBeEnabled();
  });

  it("creates a new editable flow from the flows section", () => {
    render(<App />);

    const explorer = screen.getByLabelText("Project explorer");
    fireEvent.click(within(explorer).getByRole("button", { name: "New flow" }));

    const builder = screen.getByLabelText("Flow builder");
    expect(within(builder).getByText("New Flow 4")).toBeInTheDocument();
    expect(within(builder).getByText("0 steps - 0 links")).toBeInTheDocument();
    expect(within(builder).getByLabelText("Flow templates")).toBeInTheDocument();
    expect(within(builder).getByRole("button", { name: /Authenticated Read/i })).toBeInTheDocument();
    expect(screen.getByText("New flow created.")).toBeInTheDocument();
  });

  it("adds a missing request directly from the path target", async () => {
    render(<App />);

    const explorer = screen.getByLabelText("Project explorer");
    fireEvent.click(within(explorer).getByRole("button", { name: "New flow" }));
    const builder = screen.getByLabelText("Flow builder");
    fireEvent.change(within(builder).getByLabelText("Add request step"), {
      target: { value: "login" }
    });
    fireEvent.click(within(builder).getByRole("button", { name: "Add Step" }));

    const pathTarget = within(builder).getByLabelText("Path target");
    expect(pathTarget).toBeEnabled();
    expect(within(pathTarget).getByRole("option", { name: "Current User (add step)" })).toBeInTheDocument();
    fireEvent.change(pathTarget, { target: { value: "service:current-user" } });
    fireEvent.click(within(builder).getByRole("button", { name: "Add Success Path" }));

    await waitFor(() => {
      expect(within(builder).getByText("2 steps - 1 links")).toBeInTheDocument();
    });
    expect(within(builder).getAllByText("Current User").length).toBeGreaterThan(0);
    expect(screen.getByText("Success path added.")).toBeInTheDocument();
  });

  it("applies a flow template and marks cleanup work clearly", async () => {
    render(<App />);

    const explorer = screen.getByLabelText("Project explorer");
    fireEvent.click(within(explorer).getByRole("button", { name: "New flow" }));

    const builder = screen.getByLabelText("Flow builder");
    fireEvent.click(within(builder).getByRole("button", { name: /Create Read Cleanup/i }));

    await waitFor(() => {
      expect(within(builder).getByText("4 steps - 3 links")).toBeInTheDocument();
    });
    expect(screen.getByText("Flow template applied.")).toBeInTheDocument();
    expect(within(builder).getAllByText("cleanup").length).toBeGreaterThan(0);
    expect(within(builder).getAllByText(/accessToken/).length).toBeGreaterThan(0);
    expect(within(builder).getAllByText(/orderId/).length).toBeGreaterThan(0);
  });

  it("does not offer sample flow templates when required requests are missing", () => {
    render(<App />);

    const explorer = screen.getByLabelText("Project explorer");
    fireEvent.click(within(explorer).getByRole("button", { name: "New project" }));
    const nameDialog = screen.getByRole("dialog", { name: "New Project" });
    fireEvent.change(within(nameDialog).getByLabelText("Project name"), {
      target: { value: "Minimal API" }
    });
    fireEvent.click(within(nameDialog).getByRole("button", { name: "Create Project" }));
    fireEvent.click(within(explorer).getByRole("button", { name: "New flow" }));

    const builder = screen.getByLabelText("Flow builder");
    expect(within(builder).getByRole("button", { name: /Authenticated Read/ })).toBeDisabled();
    expect(within(builder).getByText(/Requires missing requests: Login, Current User, List Products/)).toBeInTheDocument();
    expect(within(builder).getByText("0 steps - 0 links")).toBeInTheDocument();
  });

  it("shows a flows context menu before creating a flow", () => {
    render(<App />);

    const explorer = screen.getByLabelText("Project explorer");
    fireEvent.contextMenu(within(explorer).getByRole("button", { name: /Flows 3/i }), {
      clientX: 88,
      clientY: 320
    });

    expect(screen.queryByText("New flow created.")).not.toBeInTheDocument();
    const menu = screen.getByRole("menu", { name: "Flows context menu" });
    fireEvent.click(within(menu).getByRole("menuitem", { name: "Add Flow" }));

    const builder = screen.getByLabelText("Flow builder");
    expect(within(builder).getByText("New Flow 4")).toBeInTheDocument();
  });

  it("dismisses explorer context menus with Escape without taking an action", () => {
    render(<App />);

    const explorer = screen.getByLabelText("Project explorer");
    fireEvent.contextMenu(within(explorer).getByRole("button", { name: /Health Check/i }), {
      clientX: 96,
      clientY: 340
    });

    expect(screen.getByRole("menu", { name: "Request context menu" })).toBeInTheDocument();
    fireEvent.keyDown(window, { key: "Escape" });

    expect(screen.queryByRole("menu", { name: "Request context menu" })).not.toBeInTheDocument();
    expect(screen.queryByRole("dialog", { name: "Rename Request" })).not.toBeInTheDocument();
    expect(within(explorer).getByRole("button", { name: /Health Check/i })).toBeInTheDocument();
  });

  it("dismisses tab context menus on outside click without taking an action", () => {
    render(<App />);

    fireEvent.contextMenu(screen.getByRole("tab", { name: /Login/i }), { clientX: 420, clientY: 96 });

    expect(screen.getByRole("menu", { name: "Request tab context menu" })).toBeInTheDocument();
    fireEvent.click(screen.getByLabelText("Workbench"));

    expect(screen.queryByRole("menu", { name: "Request tab context menu" })).not.toBeInTheDocument();
    expect(screen.queryByRole("dialog", { name: "Rename Request" })).not.toBeInTheDocument();
    expect(screen.getByRole("tab", { name: /Login/i })).toBeInTheDocument();
  });

  it("shows a flow row context menu before deleting a flow", () => {
    render(<App />);

    const explorer = screen.getByLabelText("Project explorer");
    fireEvent.contextMenu(within(explorer).getByRole("button", { name: /Authenticated Read/i }), {
      clientX: 96,
      clientY: 340
    });

    expect(within(explorer).getByRole("button", { name: /Authenticated Read/i })).toBeInTheDocument();
    const menu = screen.getByRole("menu", { name: "Flow context menu" });
    fireEvent.click(within(menu).getByRole("menuitem", { name: "Delete Flow" }));

    expect(within(explorer).queryByRole("button", { name: /Authenticated Read/i })).not.toBeInTheDocument();
    expect(screen.getByText("Flow deleted.")).toBeInTheDocument();
  });

  it("renames a flow from the explorer context menu", async () => {
    render(<App />);

    const explorer = screen.getByLabelText("Project explorer");
    fireEvent.contextMenu(within(explorer).getByRole("button", { name: /Authenticated Read/i }), {
      clientX: 96,
      clientY: 340
    });

    const menu = screen.getByRole("menu", { name: "Flow context menu" });
    fireEvent.click(within(menu).getByRole("menuitem", { name: "Rename Flow" }));

    const renameDialog = screen.getByRole("dialog", { name: "Rename Flow" });
    fireEvent.change(within(renameDialog).getByLabelText("Project name"), {
      target: { value: "Session Bootstrap Flow" }
    });
    fireEvent.click(within(renameDialog).getByRole("button", { name: "Rename Flow" }));

    await waitFor(() => {
      expect(within(explorer).getByRole("button", { name: /Session Bootstrap Flow/i })).toBeInTheDocument();
    });
    expect(screen.getByRole("tab", { name: /Session Bootstrap Flow/i })).toBeInTheDocument();
    expect(screen.getByText("Flow renamed to Session Bootstrap Flow.")).toBeInTheDocument();
  });

  it("renames a request from the explorer context menu", async () => {
    render(<App />);

    const explorer = screen.getByLabelText("Project explorer");
    fireEvent.contextMenu(within(explorer).getByRole("button", { name: /Health Check/i }), {
      clientX: 96,
      clientY: 340
    });

    const menu = screen.getByRole("menu", { name: "Request context menu" });
    fireEvent.click(within(menu).getByRole("menuitem", { name: "Rename Request" }));

    const renameDialog = screen.getByRole("dialog", { name: "Rename Request" });
    fireEvent.change(within(renameDialog).getByLabelText("Request name"), {
      target: { value: "Health Probe" }
    });
    fireEvent.click(within(renameDialog).getByRole("button", { name: "Rename Request" }));

    await waitFor(() => {
      expect(within(explorer).getByRole("button", { name: /Health Probe/i })).toBeInTheDocument();
    });
    expect(screen.getByText("Request renamed to Health Probe.")).toBeInTheDocument();
  });

  it("renames an open request from the tab context menu", async () => {
    render(<App />);

    const requestTab = screen.getByRole("tab", { name: /Login/i });
    fireEvent.contextMenu(requestTab, { clientX: 420, clientY: 96 });

    const menu = screen.getByRole("menu", { name: "Request tab context menu" });
    fireEvent.click(within(menu).getByRole("menuitem", { name: "Rename Request" }));

    const renameDialog = screen.getByRole("dialog", { name: "Rename Request" });
    fireEvent.change(within(renameDialog).getByLabelText("Request name"), {
      target: { value: "Session Login" }
    });
    fireEvent.click(within(renameDialog).getByRole("button", { name: "Rename Request" }));

    await waitFor(() => {
      expect(screen.getByRole("tab", { name: /Session Login/i })).toBeInTheDocument();
    });
    expect(screen.getByText("Request renamed to Session Login.")).toBeInTheDocument();
  });

  it("renames an open flow from the tab context menu", async () => {
    render(<App />);

    const flowTab = screen.getByRole("tab", { name: /Authenticated Read/i });
    fireEvent.contextMenu(flowTab, { clientX: 420, clientY: 96 });

    const menu = screen.getByRole("menu", { name: "Flow tab context menu" });
    fireEvent.click(within(menu).getByRole("menuitem", { name: "Rename Flow" }));

    const renameDialog = screen.getByRole("dialog", { name: "Rename Flow" });
    fireEvent.change(within(renameDialog).getByLabelText("Project name"), {
      target: { value: "Authenticated Smoke Flow" }
    });
    fireEvent.click(within(renameDialog).getByRole("button", { name: "Rename Flow" }));

    await waitFor(() => {
      expect(screen.getByRole("tab", { name: /Authenticated Smoke Flow/i })).toBeInTheDocument();
    });
    expect(within(screen.getByLabelText("Project explorer")).getByRole("button", { name: /Authenticated Smoke Flow/i })).toBeInTheDocument();
    expect(screen.getByText("Flow renamed to Authenticated Smoke Flow.")).toBeInTheDocument();
  });

  it("generates request code from the tab context menu and changes language without mutating the project", () => {
    render(<App />);

    const initialStatus = screen.getByLabelText("Status bar").textContent;
    const requestTab = screen.getByRole("tab", { name: /Create Order/i });
    fireEvent.contextMenu(requestTab, { clientX: 420, clientY: 96 });

    const menu = screen.getByRole("menu", { name: "Request tab context menu" });
    fireEvent.pointerEnter(within(menu).getByRole("menuitem", { name: "Generate Code" }));
    const languages = screen.getByRole("menu", { name: "Generate request code language" });
    expect(within(languages).getByRole("menuitem", { name: "Java" })).toBeInTheDocument();
    fireEvent.click(within(languages).getByRole("menuitem", { name: "Python" }));

    const dialog = screen.getByRole("dialog", { name: "Code Example: Create Order" });
    expect(within(dialog).getByLabelText("Code language")).toHaveValue("python");
    const pythonCode = (within(dialog).getByLabelText("Generated code") as HTMLTextAreaElement).value;
    expect(pythonCode).toContain("requests.post");
    expect(pythonCode).not.toContain("sample-access-token");

    fireEvent.change(within(dialog).getByLabelText("Code language"), { target: { value: "ruby" } });
    expect((within(dialog).getByLabelText("Generated code") as HTMLTextAreaElement).value).toContain("Net::HTTP");
    expect(screen.getByLabelText("Status bar").textContent).toBe(initialStatus);
    expect(screen.queryByText("Sample API Regression *", { exact: true })).not.toBeInTheDocument();
  });

  it("opens and navigates the code language submenu with desktop menu keyboard behavior", () => {
    render(<App />);

    fireEvent.contextMenu(screen.getByRole("tab", { name: /Create Order/i }), { clientX: 420, clientY: 96 });
    const generateCode = within(screen.getByRole("menu", { name: "Request tab context menu" }))
      .getByRole("menuitem", { name: "Generate Code" });
    generateCode.focus();
    fireEvent.keyDown(generateCode, { key: "ArrowRight" });

    const languages = screen.getByRole("menu", { name: "Generate request code language" });
    expect(within(languages).getByRole("menuitem", { name: "HTTP" })).toHaveFocus();

    fireEvent.keyDown(within(languages).getByRole("menuitem", { name: "HTTP" }), { key: "Escape" });
    expect(screen.queryByRole("menu", { name: "Request tab context menu" })).not.toBeInTheDocument();
  });

  it("copies generated code and reports clipboard failures actionably", async () => {
    const writeText = vi.fn().mockRejectedValueOnce(new Error("Clipboard permission denied"));
    vi.stubGlobal("navigator", {
      platform: "MacIntel",
      userAgent: "Mozilla/5.0 (Macintosh)",
      clipboard: { writeText }
    });
    render(<App />);

    fireEvent.contextMenu(screen.getByRole("tab", { name: /Login/i }), { clientX: 420, clientY: 96 });
    fireEvent.click(within(screen.getByRole("menu", { name: "Request tab context menu" })).getByRole("menuitem", { name: "Generate Code" }));
    fireEvent.click(within(screen.getByRole("menu", { name: "Generate request code language" })).getByRole("menuitem", { name: "cURL" }));
    const dialog = screen.getByRole("dialog", { name: "Code Example: Login" });
    const generatedCode = (within(dialog).getByLabelText("Generated code") as HTMLTextAreaElement).value;

    fireEvent.click(within(dialog).getByRole("button", { name: "Copy Code" }));

    await waitFor(() => expect(writeText).toHaveBeenCalledWith(generatedCode));
    expect(within(dialog).getByRole("alert")).toHaveTextContent("Clipboard permission denied");

    fireEvent.click(within(dialog).getByRole("button", { name: "Copy Code" }));
    await waitFor(() => expect(within(dialog).getByRole("status")).toHaveTextContent("Copied generated code"));
  });

  it("generates a dependency-ordered flow example from a flow tab", () => {
    render(<App />);

    const flowTab = screen.getByRole("tab", { name: /Authenticated Read/i });
    fireEvent.contextMenu(flowTab, { clientX: 460, clientY: 96 });
    fireEvent.click(within(screen.getByRole("menu", { name: "Flow tab context menu" })).getByRole("menuitem", { name: "Generate Code" }));
    fireEvent.click(within(screen.getByRole("menu", { name: "Generate flow code language" })).getByRole("menuitem", { name: "Java" }));

    const dialog = screen.getByRole("dialog", { name: "Code Example: Authenticated Read" });
    const code = (within(dialog).getByLabelText("Generated code") as HTMLTextAreaElement).value;
    expect(code.indexOf("Step 1: Login")).toBeLessThan(code.indexOf("Step 2: Current User"));
    expect(code.indexOf("Step 2: Current User")).toBeLessThan(code.indexOf("Step 3: List Products"));
    expect(code).toContain("Capture $.accessToken as <ACCESS_TOKEN>");
    expect(code).toContain('flowVariables.put("accessToken", mappedValue_step1_accessToken.asText())');
    expect(code).toContain('"Bearer " + flowVariables.get("accessToken")');
    expect(within(dialog).getByText(/4 requests/)).toBeInTheDocument();
  });

  it("moves selected flow steps repeatedly and creates branch paths", async () => {
    render(<App />);

    const explorer = screen.getByLabelText("Project explorer");
    fireEvent.click(within(explorer).getByRole("button", { name: /Authenticated Read/i }));

    const builder = screen.getByLabelText("Flow builder");
    expect(within(builder).getByText("4 steps - 3 links")).toBeInTheDocument();

    fireEvent.click(within(builder).getByRole("button", { name: "Move Right" }));
    fireEvent.click(within(builder).getByRole("button", { name: "Move Right" }));

    await waitFor(() => {
      expect(within(builder).getByLabelText("Step order")).toHaveTextContent("3");
    });

    fireEvent.click(within(builder).getByRole("button", { name: "Reset Layout" }));
    await waitFor(() => {
      expect(screen.getByText("Flow layout reset.")).toBeInTheDocument();
    });

    fireEvent.change(within(builder).getByLabelText("Path target"), {
      target: { value: "authenticated-read-current-user" }
    });
    fireEvent.click(within(builder).getByRole("button", { name: "Add Failure Path" }));

    await waitFor(() => {
      expect(within(builder).getByText("4 steps - 4 links")).toBeInTheDocument();
    });
    expect(within(builder).getByRole("button", { name: "Remove Failure Path" })).toBeEnabled();
  });

  it("removes an existing flow path from the selected step", async () => {
    render(<App />);

    const explorer = screen.getByLabelText("Project explorer");
    fireEvent.click(within(explorer).getByRole("button", { name: /Authenticated Read/i }));

    const builder = screen.getByLabelText("Flow builder");
    expect(within(builder).getByText("4 steps - 3 links")).toBeInTheDocument();

    fireEvent.change(within(builder).getByLabelText("Path target"), {
      target: { value: "authenticated-read-current-user" }
    });
    fireEvent.click(within(builder).getByRole("button", { name: "Remove Success Path" }));

    await waitFor(() => {
      expect(within(builder).getByText("4 steps - 2 links")).toBeInTheDocument();
    });
    expect(within(builder).getByRole("button", { name: "Add Success Path" })).toBeEnabled();
    expect(screen.getByText("Success path removed.")).toBeInTheDocument();
  });

  it("saves the current project through the browser fallback persistence", async () => {
    render(<App />);

    fireEvent.click(screen.getByRole("button", { name: /^Save$/i }));
    const dialog = await screen.findByRole("dialog", { name: "Save Project" });
    fireEvent.change(within(dialog).getByLabelText("Project file path"), {
      target: { value: "/tmp/ui-save.restproj" }
    });
    expect(within(dialog).queryByLabelText("Project password")).not.toBeInTheDocument();
    fireEvent.click(within(dialog).getByRole("button", { name: "Save Project" }));

    await waitFor(() => {
      expect(screen.getByText("Project saved to /tmp/ui-save.restproj.")).toBeInTheDocument();
    });
  });

  it("keeps the active flow diagram available after saving the project", async () => {
    render(<App />);

    const explorer = screen.getByLabelText("Project explorer");
    fireEvent.click(within(explorer).getByRole("button", { name: /Authenticated Read/i }));
    const builder = screen.getByLabelText("Flow builder");
    expect(within(builder).getAllByText("Login").length).toBeGreaterThan(0);
    expect(within(builder).getAllByText("Current User").length).toBeGreaterThan(0);

    fireEvent.click(screen.getByRole("button", { name: /^Save$/i }));
    const dialog = await screen.findByRole("dialog", { name: "Save Project" });
    fireEvent.change(within(dialog).getByLabelText("Project file path"), {
      target: { value: "/tmp/flow-save.restproj" }
    });
    fireEvent.click(within(dialog).getByRole("button", { name: "Save Project" }));

    await waitFor(() => {
      expect(screen.getByText("Project saved to /tmp/flow-save.restproj.")).toBeInTheDocument();
    });
    expect(screen.getByLabelText("Flow builder")).toBeInTheDocument();
    expect(within(screen.getByLabelText("Flow builder")).getAllByText("Login").length).toBeGreaterThan(0);
    expect(within(screen.getByLabelText("Flow builder")).getAllByText("Current User").length).toBeGreaterThan(0);
    expect(within(screen.getByLabelText("Flow builder")).queryByText("Missing Request")).not.toBeInTheDocument();
  });

  it("requires confirmation before Save As overwrites an existing project", async () => {
    render(<App />);

    fireEvent.click(screen.getByRole("button", { name: /^Save$/i }));
    let dialog = await screen.findByRole("dialog", { name: "Save Project" });
    fireEvent.change(within(dialog).getByLabelText("Project file path"), {
      target: { value: "/tmp/existing.restproj" }
    });
    fireEvent.click(within(dialog).getByRole("button", { name: "Save Project" }));

    await waitFor(() => {
      expect(screen.getByText("Project saved to /tmp/existing.restproj.")).toBeInTheDocument();
    });

    fireEvent.click(screen.getByRole("button", { name: /Search commands/i }));
    const palette = screen.getByRole("dialog", { name: "Command palette" });
    fireEvent.click(within(palette).getByRole("button", { name: /Save Project As/i }));

    dialog = await screen.findByRole("dialog", { name: "Save Project As" });
    fireEvent.change(within(dialog).getByLabelText("Project file path"), {
      target: { value: "/tmp/existing.restproj" }
    });
    fireEvent.click(within(dialog).getByRole("button", { name: "Save Project" }));

    expect(await within(dialog).findByText("A project already exists at this path. Confirm overwrite to continue.")).toBeInTheDocument();
    fireEvent.click(within(dialog).getByRole("button", { name: "Overwrite Project" }));

    await waitFor(() => {
      expect(screen.getByText("Project saved to /tmp/existing.restproj.")).toBeInTheDocument();
    });
  });
});
