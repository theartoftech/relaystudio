import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { beforeEach, describe, expect, it } from "vitest";
import { App } from "./App";

describe("Relay Studio shell", () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it("renders the core Sprint 2 workbench regions", () => {
    render(<App />);

    expect(screen.getByLabelText("Relay Studio desktop shell")).toBeInTheDocument();
    expect(screen.getByLabelText("Project explorer")).toBeInTheDocument();
    expect(screen.getByLabelText("Workbench")).toBeInTheDocument();
    expect(screen.getByLabelText("Response and console dock")).toBeInTheDocument();
    expect(screen.queryByLabelText("Primary navigation")).not.toBeInTheDocument();
    expect(screen.queryByLabelText("Inspector")).not.toBeInTheDocument();
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

  it("exposes keyboard-accessible pane resize handles", () => {
    render(<App />);

    const workspace = screen.getByLabelText("Project explorer").parentElement as HTMLElement;
    expect(screen.getByRole("separator", { name: "Resize explorer" })).toBeInTheDocument();
    expect(screen.getByRole("separator", { name: "Resize utility dock" })).toBeInTheDocument();

    fireEvent.keyDown(screen.getByRole("separator", { name: "Resize explorer" }), { key: "ArrowRight" });
    expect(workspace.style.getPropertyValue("--explorer-width")).toBe("334px");

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

  it("opens the project save dialog from the toolbar", () => {
    render(<App />);

    fireEvent.click(screen.getByRole("button", { name: /^Save$/i }));

    expect(screen.getByRole("dialog", { name: "Save Project" })).toBeInTheDocument();
    expect(screen.getByLabelText("Project file path")).toHaveValue("/private/tmp/sample-api-regression.restproj");
  });

  it("creates a new project with an editable starter request", () => {
    render(<App />);

    fireEvent.click(screen.getByRole("button", { name: /Search commands/i }));
    const dialog = screen.getByRole("dialog", { name: "Command palette" });
    fireEvent.click(within(dialog).getByRole("button", { name: /New Project/i }));

    expect(screen.getByRole("tab", { name: /New Request/i })).toBeInTheDocument();
    expect(screen.getByText("New unsaved project created with a starter request.")).toBeInTheDocument();
    const requestUrl = screen.getByLabelText("Request URL");
    expect(requestUrl).not.toHaveAttribute("readonly");
    expect(requestUrl).toHaveValue("https://api.example.com/api/health");
  });

  it("creates a request from the tab strip plus button", () => {
    render(<App />);

    fireEvent.click(screen.getByRole("button", { name: "New request" }));

    expect(screen.getByRole("tab", { name: /New Service/i })).toBeInTheDocument();
    expect(screen.getByText("New service created.")).toBeInTheDocument();
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

  it("opens the visual flow builder from the explorer", () => {
    render(<App />);

    const explorer = screen.getByLabelText("Project explorer");
    fireEvent.click(within(explorer).getByRole("button", { name: /Authenticated Read/i }));

    const builder = screen.getByLabelText("Flow builder");
    expect(builder).toBeInTheDocument();
    expect(within(builder).getByText("Authenticated Read")).toBeInTheDocument();
    expect(within(builder).getByRole("button", { name: /Run Flow/i })).toBeInTheDocument();
    expect(within(builder).getByRole("separator", { name: "Resize flow details" })).toBeInTheDocument();
  });

  it("creates a new editable flow from the flows section", () => {
    render(<App />);

    const explorer = screen.getByLabelText("Project explorer");
    fireEvent.click(within(explorer).getByRole("button", { name: "New flow" }));

    const builder = screen.getByLabelText("Flow builder");
    expect(within(builder).getByText("New Flow 4")).toBeInTheDocument();
    expect(within(builder).getByText("0 steps - 0 links")).toBeInTheDocument();
    expect(screen.getByText("New flow created.")).toBeInTheDocument();
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

    fireEvent.change(within(builder).getByLabelText("Path target"), {
      target: { value: "authenticated-read-current-user" }
    });
    fireEvent.click(within(builder).getByRole("button", { name: "Add Failure Path" }));

    await waitFor(() => {
      expect(within(builder).getByText("4 steps - 4 links")).toBeInTheDocument();
    });
    expect(within(builder).getByRole("button", { name: "Failure Path Exists" })).toBeDisabled();
  });

  it("saves the current project through the browser fallback persistence", async () => {
    render(<App />);

    fireEvent.click(screen.getByRole("button", { name: /^Save$/i }));
    const dialog = screen.getByRole("dialog", { name: "Save Project" });
    fireEvent.change(within(dialog).getByLabelText("Project file path"), {
      target: { value: "/tmp/ui-save.restproj" }
    });
    fireEvent.change(within(dialog).getByLabelText("Project password"), {
      target: { value: "secret" }
    });
    fireEvent.click(within(dialog).getByRole("button", { name: "Save Project" }));

    await waitFor(() => {
      expect(screen.getByText("Project saved to /tmp/ui-save.restproj.")).toBeInTheDocument();
    });
  });

  it("requires confirmation before Save As overwrites an existing project", async () => {
    render(<App />);

    fireEvent.click(screen.getByRole("button", { name: /^Save$/i }));
    let dialog = screen.getByRole("dialog", { name: "Save Project" });
    fireEvent.change(within(dialog).getByLabelText("Project file path"), {
      target: { value: "/tmp/existing.restproj" }
    });
    fireEvent.change(within(dialog).getByLabelText("Project password"), {
      target: { value: "secret" }
    });
    fireEvent.click(within(dialog).getByRole("button", { name: "Save Project" }));

    await waitFor(() => {
      expect(screen.getByText("Project saved to /tmp/existing.restproj.")).toBeInTheDocument();
    });

    fireEvent.click(screen.getByRole("button", { name: /Search commands/i }));
    const palette = screen.getByRole("dialog", { name: "Command palette" });
    fireEvent.click(within(palette).getByRole("button", { name: /Save Project As/i }));

    dialog = screen.getByRole("dialog", { name: "Save Project As" });
    fireEvent.change(within(dialog).getByLabelText("Project file path"), {
      target: { value: "/tmp/existing.restproj" }
    });
    fireEvent.change(within(dialog).getByLabelText("Project password"), {
      target: { value: "secret" }
    });
    fireEvent.click(within(dialog).getByRole("button", { name: "Save Project" }));

    expect(await within(dialog).findByText("A project already exists at this path. Confirm overwrite to continue.")).toBeInTheDocument();
    fireEvent.click(within(dialog).getByRole("button", { name: "Overwrite Project" }));

    await waitFor(() => {
      expect(screen.getByText("Project saved to /tmp/existing.restproj.")).toBeInTheDocument();
    });
  });
});
