import type { RecentProject } from "../project/projectModel";

export type ShellCommandTabKind = "welcome" | "request" | "flow" | "response" | "import" | "settings";

export type ShellCommandId =
  | "app.search_commands"
  | "app.open_import"
  | "app.open_settings"
  | "file.new_project"
  | "file.open_project"
  | "file.show_recent_projects"
  | "file.open_recent"
  | "file.save_project"
  | "file.save_project_as"
  | "window.close_active_tab"
  | "window.close_window"
  | "request.send_active"
  | "flow.run_active"
  | "view.toggle_explorer"
  | "view.toggle_inspector"
  | "view.toggle_response_dock";

export type RecentProjectMenuCommandId = `file.open_recent.${number}`;
export type NativeShellCommandId = ShellCommandId | RecentProjectMenuCommandId;

export interface ShellCommandContext {
  activeTabKind: ShellCommandTabKind;
  hasDirtyState: boolean;
  runnerRunning: boolean;
  canCloseActiveTab: boolean;
  explorerOpen: boolean;
  inspectorOpen: boolean;
  responseDockOpen: boolean;
}

export interface ShellCommandDefinition {
  id: ShellCommandId;
  label: string;
  shortcut?: string;
  visible: (context: ShellCommandContext) => boolean;
  enabled: (context: ShellCommandContext) => boolean;
}

export interface ShellPaletteCommand {
  id: ShellCommandId;
  label: string;
  shortcut?: string;
}

export interface NativeShellMenuState {
  activeTabKind: ShellCommandTabKind;
  hasDirtyState: boolean;
  canSaveProject: boolean;
  canCloseActiveTab: boolean;
  canSendRequest: boolean;
  canRunFlow: boolean;
  explorerOpen: boolean;
  inspectorOpen: boolean;
  responseDockOpen: boolean;
}

export interface ShellCommandEventPayload {
  id: NativeShellCommandId;
  recentProject?: RecentProject;
}

const shellCommandDefinitions: ShellCommandDefinition[] = [
  command("app.search_commands", "Search Commands", {
    shortcut: "CmdOrCtrl+K"
  }),
  command("app.open_import", "Import API Docs"),
  command("app.open_settings", "Settings", {
    shortcut: "CmdOrCtrl+,"
  }),
  command("file.new_project", "New Project", {
    shortcut: "CmdOrCtrl+N"
  }),
  command("file.open_project", "Open Project", {
    shortcut: "CmdOrCtrl+O"
  }),
  command("file.show_recent_projects", "Open Recent Projects"),
  command("file.open_recent", "Open Recent", {
    visible: () => false
  }),
  command("file.save_project", "Save Project", {
    shortcut: "CmdOrCtrl+S"
  }),
  command("file.save_project_as", "Save Project As", {
    shortcut: "CmdOrCtrl+Shift+S"
  }),
  command("window.close_active_tab", "Close Tab", {
    shortcut: "CmdOrCtrl+W",
    enabled: (context) => context.canCloseActiveTab
  }),
  command("window.close_window", "Close Window", {
    shortcut: "CmdOrCtrl+Shift+W"
  }),
  command("request.send_active", "Send Request", {
    shortcut: "CmdOrCtrl+Enter",
    visible: (context) => context.activeTabKind === "request",
    enabled: (context) => !context.runnerRunning
  }),
  command("flow.run_active", "Run Flow", {
    shortcut: "CmdOrCtrl+Enter",
    visible: (context) => context.activeTabKind === "flow",
    enabled: (context) => !context.runnerRunning
  }),
  command("view.toggle_explorer", "Toggle Sidebar"),
  command("view.toggle_inspector", "Toggle Inspector"),
  command("view.toggle_response_dock", "Toggle Response Dock", {
    visible: (context) => !["welcome", "settings", "import"].includes(context.activeTabKind)
  })
];

export function getCommandDefinition(id: ShellCommandId): ShellCommandDefinition {
  const definition = shellCommandDefinitions.find((commandDefinition) => commandDefinition.id === id);
  if (!definition) {
    throw new Error(`Unknown shell command: ${id}`);
  }
  return definition;
}

export function getCommandPaletteCommands(context: ShellCommandContext): ShellPaletteCommand[] {
  return shellCommandDefinitions
    .filter((definition) => definition.visible(context))
    .filter((definition) => definition.id !== "window.close_window")
    .map((definition) => ({
      id: definition.id,
      label: definition.label,
      shortcut: definition.shortcut
    }));
}

export function createNativeShellMenuState(context: ShellCommandContext): NativeShellMenuState {
  return {
    activeTabKind: context.activeTabKind,
    hasDirtyState: context.hasDirtyState,
    canSaveProject: getCommandDefinition("file.save_project").enabled(context),
    canCloseActiveTab: getCommandDefinition("window.close_active_tab").enabled(context),
    canSendRequest: getCommandDefinition("request.send_active").visible(context) && getCommandDefinition("request.send_active").enabled(context),
    canRunFlow: getCommandDefinition("flow.run_active").visible(context) && getCommandDefinition("flow.run_active").enabled(context),
    explorerOpen: context.explorerOpen,
    inspectorOpen: context.inspectorOpen,
    responseDockOpen: context.responseDockOpen
  };
}

export function parseRecentProjectMenuIndex(id: string): number | null {
  const match = /^file\.open_recent\.(\d+)$/.exec(id);
  if (!match) {
    return null;
  }
  return Number.parseInt(match[1], 10);
}

export function getPrimaryExecutionCommand(context: ShellCommandContext): ShellPaletteCommand | null {
  if (context.activeTabKind === "request") {
    return toPaletteCommand(getCommandDefinition("request.send_active"));
  }
  if (context.activeTabKind === "flow") {
    return toPaletteCommand(getCommandDefinition("flow.run_active"));
  }
  return null;
}

function toPaletteCommand(definition: ShellCommandDefinition): ShellPaletteCommand {
  return {
    id: definition.id,
    label: definition.label,
    shortcut: definition.shortcut
  };
}

function command(
  id: ShellCommandId,
  label: string,
  options?: {
    shortcut?: string;
    visible?: (context: ShellCommandContext) => boolean;
    enabled?: (context: ShellCommandContext) => boolean;
  }
): ShellCommandDefinition {
  return {
    id,
    label,
    shortcut: options?.shortcut,
    visible: options?.visible ?? (() => true),
    enabled: options?.enabled ?? (() => true)
  };
}
