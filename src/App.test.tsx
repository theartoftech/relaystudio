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
    expect(screen.getByLabelText("Primary navigation")).toBeInTheDocument();
    expect(screen.getByLabelText("Project explorer")).toBeInTheDocument();
    expect(screen.getByLabelText("Workbench")).toBeInTheDocument();
    expect(screen.getByLabelText("Inspector")).toBeInTheDocument();
    expect(screen.getByLabelText("Response and console dock")).toBeInTheDocument();
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

    fireEvent.click(screen.getByRole("button", { name: /Save Project/i }));

    expect(screen.getByRole("dialog", { name: "Save Project" })).toBeInTheDocument();
    expect(screen.getByLabelText("Project file path")).toHaveValue("/private/tmp/sample-api-regression.restproj");
  });

  it("creates a new project with an editable starter request", () => {
    render(<App />);

    fireEvent.click(screen.getByRole("button", { name: /^New$/i }));

    expect(screen.getByRole("tab", { name: /New Request/i })).toBeInTheDocument();
    expect(screen.getByText("New unsaved project created with a starter request.")).toBeInTheDocument();
    const requestUrl = screen.getByLabelText("Request URL");
    expect(requestUrl).not.toHaveAttribute("readonly");
    expect(requestUrl).toHaveValue("https://api.example.com/api/health");
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

  it("saves the current project through the browser fallback persistence", async () => {
    render(<App />);

    fireEvent.click(screen.getByRole("button", { name: /Save Project/i }));
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

    fireEvent.click(screen.getByRole("button", { name: /Save Project/i }));
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

    fireEvent.click(screen.getByRole("button", { name: /Search services/i }));
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
