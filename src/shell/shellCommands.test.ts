import {
  createNativeShellMenuState,
  getCommandPaletteCommands,
  getPrimaryExecutionCommand,
  parseRecentProjectMenuIndex,
  type ShellCommandContext
} from "./shellCommands";

describe("shellCommands", () => {
  it("shows request execution in the command palette only for request tabs", () => {
    const requestCommands = getCommandPaletteCommands(context({ activeTabKind: "request" })).map((command) => command.label);
    const flowCommands = getCommandPaletteCommands(context({ activeTabKind: "flow" })).map((command) => command.label);
    const settingsCommands = getCommandPaletteCommands(context({ activeTabKind: "settings" })).map((command) => command.label);

    expect(requestCommands).toContain("Send Request");
    expect(requestCommands).toContain("Open Recent Projects");
    expect(requestCommands).not.toContain("Run Flow");
    expect(flowCommands).toContain("Run Flow");
    expect(flowCommands).not.toContain("Send Request");
    expect(settingsCommands).not.toContain("Send Request");
    expect(settingsCommands).not.toContain("Run Flow");
  });

  it("keeps response-dock toggle out of non-workbench tabs", () => {
    const welcomeCommands = getCommandPaletteCommands(context({ activeTabKind: "welcome" })).map((command) => command.label);
    const responseCommands = getCommandPaletteCommands(context({ activeTabKind: "response" })).map((command) => command.label);

    expect(welcomeCommands).not.toContain("Toggle Response Dock");
    expect(responseCommands).toContain("Toggle Response Dock");
  });

  it("derives the correct primary execution command for the active tab", () => {
    expect(getPrimaryExecutionCommand(context({ activeTabKind: "request" }))?.label).toBe("Send Request");
    expect(getPrimaryExecutionCommand(context({ activeTabKind: "flow" }))?.label).toBe("Run Flow");
    expect(getPrimaryExecutionCommand(context({ activeTabKind: "settings" }))).toBeNull();
  });

  it("creates native menu state from shell context", () => {
    const menuState = createNativeShellMenuState(context({
      activeTabKind: "flow",
      hasDirtyState: true,
      runnerRunning: false,
      canCloseActiveTab: true,
      explorerOpen: false,
      inspectorOpen: true,
      responseDockOpen: true
    }));

    expect(menuState).toEqual({
      activeTabKind: "flow",
      hasDirtyState: true,
      canSaveProject: true,
      canCloseActiveTab: true,
      canSendRequest: false,
      canRunFlow: true,
      explorerOpen: false,
      inspectorOpen: true,
      responseDockOpen: true
    });
  });

  it("parses indexed recent-project menu ids", () => {
    expect(parseRecentProjectMenuIndex("file.open_recent.0")).toBe(0);
    expect(parseRecentProjectMenuIndex("file.open_recent.9")).toBe(9);
    expect(parseRecentProjectMenuIndex("file.open_recent")).toBeNull();
    expect(parseRecentProjectMenuIndex("file.open_recent.foo")).toBeNull();
  });
});

function context(overrides?: Partial<ShellCommandContext>): ShellCommandContext {
  return {
    activeTabKind: "request",
    hasDirtyState: false,
    runnerRunning: false,
    canCloseActiveTab: true,
    explorerOpen: true,
    inspectorOpen: false,
    responseDockOpen: true,
    ...overrides
  };
}
