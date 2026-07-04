import { afterEach, describe, expect, it, vi } from "vitest";
import { openNativeProjectFilePicker } from "./nativeProjectPicker";

const dialogMocks = vi.hoisted(() => ({
  open: vi.fn()
}));

vi.mock("@tauri-apps/plugin-dialog", () => ({
  open: dialogMocks.open
}));

describe("native project picker", () => {
  afterEach(() => {
    dialogMocks.open.mockReset();
  });

  it("opens a native project file picker limited to Relay Studio projects", async () => {
    dialogMocks.open.mockResolvedValue("/private/tmp/test-project-4.restproj");

    await expect(openNativeProjectFilePicker()).resolves.toBe("/private/tmp/test-project-4.restproj");
    expect(dialogMocks.open).toHaveBeenCalledWith({
      title: "Open Project",
      multiple: false,
      filters: [
        {
          name: "Relay Studio Project",
          extensions: ["restproj"]
        }
      ]
    });
  });

  it("returns null when the native picker is cancelled", async () => {
    dialogMocks.open.mockResolvedValue(null);

    await expect(openNativeProjectFilePicker()).resolves.toBeNull();
  });
});
