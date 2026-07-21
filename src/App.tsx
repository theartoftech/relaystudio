import {
  Background,
  Handle,
  MarkerType,
  Position,
  ReactFlow,
  type Connection,
  type Edge,
  type Node,
  type NodeChange,
  type NodeProps,
  type Viewport
} from "@xyflow/react";
import "@xyflow/react/dist/style.css";
import {
  Archive,
  ArrowLeft,
  ArrowRight,
  Box,
  Braces,
  ChevronDown,
  FileJson,
  Folder,
  FolderOpen,
  GitBranch,
  KeyRound,
  Lock,
  Pencil,
  Play,
  Plus,
  RotateCcw,
  Save,
  Search,
  Send,
  SlidersHorizontal,
  Trash2,
  Unlink2,
  X,
  Zap
} from "lucide-react";
import {
  type CSSProperties,
  type KeyboardEvent as ReactKeyboardEvent,
  type MouseEvent as ReactMouseEvent,
  type PointerEvent as ReactPointerEvent,
  type RefObject,
  type ReactNode,
  useEffect,
  useMemo,
  useRef,
  useState
} from "react";
import {
  createEmptyProject,
  createDefaultProjectSettings,
  createSampleProject,
  touchProject,
  type AuthMode,
  type FlowMapping,
  type HttpMethod,
  type KeyValueRow,
  type FlowNodePosition,
  type ProjectEnvironment,
  type ProjectFlow,
  type ProjectService,
  type ProjectSettings,
  type ProjectVariable,
  type RecentProject,
  type RelayProject,
  type SavedResponseMetadata
} from "./project/projectModel";
import { buildDefaultProjectPath, isBrowserFallbackProjectPath, resolveDefaultProjectDirectory } from "./project/defaultProjectPath";
import { createProjectPersistence, type ProjectPersistence } from "./project/projectPersistence";
import { openNativeProjectFilePicker } from "./project/nativeProjectPicker";
import {
  AUTH_MODES,
  HTTP_METHODS,
  buildRequestPreview,
  createService,
  deleteService,
  duplicateService,
  findVariableReferences,
  formatJsonBody,
  minifyJsonBody,
  removeRow,
  reorderService,
  upsertRow,
  type RequestPreview
} from "./services/serviceDesigner";
import {
  addFlowNode,
  addFlowMapping,
  applyFlowTemplate,
  connectFlowNodeToService,
  connectFlowNodes,
  disconnectFlowNodes,
  deleteFlowMapping,
  deleteFlowNode,
  FLOW_TEMPLATES,
  normalizeFlow,
  reorderFlowNode,
  resolveFlowNodeService,
  runFlow,
  updateFlowMapping,
  type FlowTemplateId
} from "./services/flowBuilder";
import {
  centerFlowViewportForNodes,
  nextActiveDragPositions,
  recoverVisibleFlowPositions,
  resetFlowLayoutPositions,
  scrollWorldSizeForNodes,
  type FlowCanvasSize
} from "./services/flowCanvasState";
import { createSavedResponsePersistence, type SavedResponsePersistence } from "./services/savedResponsePersistence";
import {
  artifactToExecutedResponse,
  buildSavedResponseDraft,
  defaultSavedResponsePath
} from "./services/savedResponses";
import { formatResponseDestination, formatResponseSize } from "./services/responseFormatting";
import { createDiagnosticsBundle } from "./services/diagnostics";
import { compareSavedResponses, comparisonToExecutedResponse } from "./services/responseComparison";
import { runServiceRequest, type ExecutableRequest, type ExecutedResponse, type RunnerConsoleEvent } from "./services/serviceRunner";
import {
  approveMultipartFile,
  assertMultipartFilesApproved,
  isMultipartFileApproved,
  type MultipartFileApproval
} from "./services/multipartAuthorization";
import {
  inspectOpenApiUrl,
  loadDiscoveredOpenApiDefinition,
  selectedOperationsToServices,
  type ParsedOpenApi,
  type SwaggerUiDefinitionDiscovery
} from "./services/openApiImporter";
import {
  createNativeShellMenuState,
  getCommandPaletteCommands,
  getPrimaryExecutionCommand,
  parseRecentProjectMenuIndex,
  type NativeShellCommandId,
  type ShellCommandEventPayload,
  type ShellCommandId,
  type ShellCommandTabKind
} from "./shell/shellCommands";
import helpDocument from "./help/relay-studio-help.json";

type TabKind = "welcome" | "request" | "flow" | "response" | "import" | "settings" | "help";
type DesktopPlatform = "macos" | "windows" | "linux" | "web";
type LayoutBreakpoint = "small" | "medium" | "large";

interface WorkbenchTab {
  id: string;
  label: string;
  kind: TabKind;
  method?: HttpMethod;
  dirty?: boolean;
}

interface SessionProjectSnapshot {
  id: string;
  name: string;
  path: string;
  project: RelayProject;
  tabs: WorkbenchTab[];
  activeTabId: string;
  activeServiceId: string;
  activeFlowId: string;
  environment: string;
  projectDirty: boolean;
}

interface ProjectListTarget {
  source: "session" | "recent";
  id?: string;
  name: string;
  path: string;
}

type PendingProjectOpen =
  | { type: "session"; snapshotId: string }
  | { type: "recent"; recent: RecentProject }
  | { type: "path"; path: string };

const initialTabs: WorkbenchTab[] = [
  { id: "welcome", label: "Welcome", kind: "welcome" },
  { id: "login", label: "Login", kind: "request", method: "POST" },
  { id: "create-order", label: "Create Order", kind: "request", method: "POST" },
  { id: "authenticated-read", label: "Authenticated Read", kind: "flow" },
  { id: "current-user-response", label: "current-user.json", kind: "response" }
];

interface LayoutSizes {
  explorerWidth: number;
  inspectorWidth: number;
  bottomDockHeight: number;
}

const defaultLayoutSizes: LayoutSizes = {
  explorerWidth: 292,
  inspectorWidth: 280,
  bottomDockHeight: 240
};

const focusableSelector = [
  "a[href]",
  "button:not([disabled])",
  "input:not([disabled])",
  "select:not([disabled])",
  "textarea:not([disabled])",
  "[tabindex]:not([tabindex='-1'])"
].join(",");

function getLayoutBreakpoint(width: number): LayoutBreakpoint {
  if (width < 641) return "small";
  if (width < 1008) return "medium";
  return "large";
}

function getDesktopPlatform(): DesktopPlatform {
  if (typeof navigator === "undefined") return "web";
  const platform = `${navigator.platform} ${navigator.userAgent}`.toLowerCase();
  if (platform.includes("mac")) return "macos";
  if (platform.includes("win")) return "windows";
  if (platform.includes("linux")) return "linux";
  return "web";
}

function isEditableContextTarget(target: EventTarget | null): boolean {
  return target instanceof HTMLElement && Boolean(target.closest("input, textarea, [contenteditable='true']"));
}

function useWindowBreakpoint(): LayoutBreakpoint {
  const [breakpoint, setBreakpoint] = useState<LayoutBreakpoint>(() => (
    typeof window === "undefined" ? "large" : getLayoutBreakpoint(window.innerWidth)
  ));

  useEffect(() => {
    const updateBreakpoint = () => setBreakpoint(getLayoutBreakpoint(window.innerWidth));
    window.addEventListener("resize", updateBreakpoint);
    return () => window.removeEventListener("resize", updateBreakpoint);
  }, []);

  return breakpoint;
}

function useWindowActiveState(): boolean {
  const [windowActive, setWindowActive] = useState(true);

  useEffect(() => {
    const activate = () => setWindowActive(true);
    const deactivate = () => setWindowActive(false);
    window.addEventListener("focus", activate);
    window.addEventListener("blur", deactivate);
    return () => {
      window.removeEventListener("focus", activate);
      window.removeEventListener("blur", deactivate);
    };
  }, []);

  return windowActive;
}

function useModalBehavior(
  onClose: () => void,
  options?: {
    initialFocusRef?: RefObject<HTMLElement | null>;
    returnFocusRef?: RefObject<HTMLElement | null>;
  }
): RefObject<HTMLElement> {
  const dialogRef = useRef<HTMLElement>(null);
  const previousFocusRef = useRef<HTMLElement | null>(null);

  useEffect(() => {
    previousFocusRef.current = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    const firstFocusable = options?.initialFocusRef?.current ?? dialogRef.current?.querySelector<HTMLElement>(focusableSelector);
    firstFocusable?.focus();

    return () => {
      const previousFocus = previousFocusRef.current;
      const returnFocus = previousFocus && previousFocus !== document.body
        ? previousFocus
        : options?.returnFocusRef?.current;
      if (returnFocus?.isConnected) returnFocus.focus();
    };
  }, [options?.initialFocusRef, options?.returnFocusRef]);

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault();
        onClose();
        return;
      }
      if (event.key !== "Tab") return;

      const dialog = dialogRef.current;
      if (!dialog) return;
      const focusableElements = Array.from(dialog.querySelectorAll<HTMLElement>(focusableSelector))
        .filter((element) => element.getAttribute("aria-hidden") !== "true");
      if (!focusableElements.length) return;

      const firstElement = focusableElements[0];
      const lastElement = focusableElements[focusableElements.length - 1];
      if (event.shiftKey && document.activeElement === firstElement) {
        event.preventDefault();
        lastElement.focus();
      } else if (!event.shiftKey && document.activeElement === lastElement) {
        event.preventDefault();
        firstElement.focus();
      }
    };

    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [onClose]);

  return dialogRef;
}

export function App() {
  const [project, setProject] = useState<RelayProject>(() => createSampleProject());
  const [defaultProjectDirectory, setDefaultProjectDirectory] = useState("/private/tmp");
  const [projectPath, setProjectPath] = useState(() => buildDefaultProjectPath("Sample API Regression"));
  const [projectDirty, setProjectDirty] = useState(false);
  const [shellReady, setShellReady] = useState(() => !hasTauriRuntimeSync());
  const [sessionProjects, setSessionProjects] = useState<SessionProjectSnapshot[]>([]);
  const [recentProjects, setRecentProjects] = useState<RecentProject[]>([]);
  const [persistence, setPersistence] = useState<ProjectPersistence | null>(null);
  const [savedResponsePersistence, setSavedResponsePersistence] = useState<SavedResponsePersistence | null>(null);
  const [projectMessage, setProjectMessage] = useState("Project loaded from sample data.");
  const [projectError, setProjectError] = useState<string | null>(null);
  const [projectDialog, setProjectDialog] = useState<null | {
    mode: "open" | "save";
    title: string;
    path: string;
  }>(null);
  const [newProjectDialogOpen, setNewProjectDialogOpen] = useState(false);
  const [renameProjectDialog, setRenameProjectDialog] = useState<ProjectListTarget | null>(null);
  const [deleteProjectDialog, setDeleteProjectDialog] = useState<ProjectListTarget | null>(null);
  const [renameFlowDialog, setRenameFlowDialog] = useState<ProjectFlow | null>(null);
  const [renameRequestDialog, setRenameRequestDialog] = useState<ProjectService | null>(null);
  const [tabs, setTabs] = useState(initialTabs);
  const [activeTabId, setActiveTabId] = useState("create-order");
  const [activeServiceId, setActiveServiceId] = useState("create-order");
  const [activeFlowId, setActiveFlowId] = useState("authenticated-read");
  const [explorerOpen, setExplorerOpen] = useState(true);
  const [inspectorOpen, setInspectorOpen] = useState(false);
  const [flowDetailsOpen, setFlowDetailsOpen] = useState(true);
  const [layoutSizes, setLayoutSizes] = useState(defaultLayoutSizes);
  const [environment, setEnvironment] = useState(() => getDefaultEnvironmentName(createSampleProject()));
  const [commandPaletteOpen, setCommandPaletteOpen] = useState(false);
  const [responseVisible, setResponseVisible] = useState(true);
  const [savePromptOpen, setSavePromptOpen] = useState(false);
  const [recentProjectsDialogOpen, setRecentProjectsDialogOpen] = useState(false);
  const [pendingTabCloseId, setPendingTabCloseId] = useState<string | null>(null);
  const [pendingProjectOpen, setPendingProjectOpen] = useState<PendingProjectOpen | null>(null);
  const [saveThenOpenProject, setSaveThenOpenProject] = useState<PendingProjectOpen | null>(null);
  const [pendingWindowClose, setPendingWindowClose] = useState(false);
  const [consoleFilter, setConsoleFilter] = useState("All Events");
  const [runnerResponse, setRunnerResponse] = useState<ExecutedResponse | null>(null);
  const [runnerRequest, setRunnerRequest] = useState<ExecutableRequest | null>(null);
  const [runnerEvents, setRunnerEvents] = useState<RunnerConsoleEvent[]>([]);
  const [runnerError, setRunnerError] = useState<string | null>(null);
  const [runnerRunning, setRunnerRunning] = useState(false);
  const [multipartFileApprovals, setMultipartFileApprovals] = useState<MultipartFileApproval[]>([]);
  const runnerAbortControllerRef = useRef<AbortController | null>(null);
  const [editableRequestUrl, setEditableRequestUrl] = useState<string | null>(null);
  const [saveResponseDialog, setSaveResponseDialog] = useState<null | {
    path: string;
    warning: string | null;
  }>(null);

  const activeTab = tabs.find((tab) => tab.id === activeTabId) ?? tabs[0];
  const hasDirtyState = projectDirty || tabs.some((tab) => tab.dirty);
  const canCloseActiveTab = !(tabs.length === 1 && activeTab.kind === "welcome");
  const groupedServices = useMemo(() => groupServices(project), [project]);
  const activeEnvironment = useMemo(() => {
    return project.environments.find((item) => item.name === environment) ?? project.environments[0];
  }, [environment, project.environments]);
  const activeService = project.services.find((service) => service.id === activeServiceId) ?? project.services[0];
  const activeFlow = project.flows.find((flow) => flow.id === activeFlowId) ?? project.flows[0];
  const projectSettings = getProjectSettings(project);
  const requestPreview = activeService && activeEnvironment ? buildRequestPreview(activeService, activeEnvironment) : null;
  const welcomeTabActive = activeTab.kind === "welcome";
  const layoutBreakpoint = useWindowBreakpoint();
  const desktopPlatform = getDesktopPlatform();
  const windowActive = useWindowActiveState();
  const allowWindowCloseRef = useRef(false);
  const shellCommandHandlerRef = useRef<(payload: ShellCommandEventPayload) => void>(() => {});
  const commandSearchButtonRef = useRef<HTMLButtonElement>(null);
  const shellCommandContext = {
    activeTabKind: activeTab.kind,
    hasDirtyState,
    runnerRunning,
    canCloseActiveTab,
    explorerOpen,
    inspectorOpen,
    responseDockOpen: responseVisible,
    flowDetailsOpen
  } as const;
  const commandPaletteCommands = getCommandPaletteCommands(shellCommandContext);
  const primaryExecutionCommand = getPrimaryExecutionCommand(shellCommandContext);
  const showEnvironmentSelector = activeTab.kind === "request" || activeTab.kind === "flow";
  const nativeShellMenuState = createNativeShellMenuState(shellCommandContext);
  const workspaceClassName = [
    "workspace-grid",
    explorerOpen ? "" : "explorer-hidden",
    inspectorOpen ? "inspector-open" : ""
  ].filter(Boolean).join(" ");

  shellCommandHandlerRef.current = (payload) => {
    void executeShellCommand(payload.id, payload);
  };

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      const commandKey = event.metaKey || event.ctrlKey;
      if (!commandKey) {
        if (event.key === "Escape") {
          setCommandPaletteOpen(false);
        }
        return;
      }

      const normalizedKey = event.key.toLowerCase();
      if (normalizedKey === "k") {
        event.preventDefault();
        void executeShellCommand("app.search_commands");
        return;
      }
      if (normalizedKey === "s") {
        event.preventDefault();
        void executeShellCommand(event.shiftKey ? "file.save_project_as" : "file.save_project");
        return;
      }
      if (normalizedKey === "o" && !event.shiftKey && !event.altKey) {
        event.preventDefault();
        void executeShellCommand("file.open_project");
        return;
      }
      if (normalizedKey === "w") {
        event.preventDefault();
        void executeShellCommand(event.shiftKey ? "window.close_window" : "window.close_active_tab");
        return;
      }
      if (normalizedKey === "," && !event.shiftKey && !event.altKey) {
        event.preventDefault();
        void executeShellCommand("app.open_settings");
        return;
      }
      if (normalizedKey === "enter" && !event.shiftKey && !event.altKey && primaryExecutionCommand) {
        event.preventDefault();
        void executeShellCommand(primaryExecutionCommand.id);
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [primaryExecutionCommand]);

  useEffect(() => {
    function refreshButtonTooltips() {
      document.querySelectorAll<HTMLButtonElement>("button").forEach((button) => {
        if (button.title.trim() && button.dataset.autoTitle !== "true") return;
        const label = button.getAttribute("aria-label")?.trim() || button.textContent?.replace(/\s+/g, " ").trim();
        if (label) {
          button.title = label;
          button.dataset.autoTitle = "true";
        }
      });
    }

    refreshButtonTooltips();
    const observer = new MutationObserver(refreshButtonTooltips);
    observer.observe(document.body, { childList: true, subtree: true, characterData: true });
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    let cancelled = false;

    async function initializeShell() {
      const nativeRuntime = hasTauriRuntimeSync();
      try {
        const [createdPersistence, createdSavedResponsePersistence, resolvedProjectDirectory] = await Promise.all([
          createProjectPersistence(),
          createSavedResponsePersistence(),
          resolveDefaultProjectDirectory()
        ]);
        const recent = await createdPersistence.listRecentProjects();
        if (cancelled) return;
        setPersistence(createdPersistence);
        setSavedResponsePersistence(createdSavedResponsePersistence);
        setDefaultProjectDirectory(resolvedProjectDirectory);
        setRecentProjects(recent);
        if (nativeRuntime) {
          const latest = recent[0];
          if (latest) {
            try {
              const opened = await createdPersistence.openProject({ path: latest.path });
              if (cancelled) return;
              applyProjectToWorkspace(opened, latest.path, `Reopened ${opened.name} from ${latest.path}.`);
            } catch (error) {
              if (cancelled) return;
              const emptyProject = createEmptyProject();
              applyProjectToWorkspace(emptyProject, "", "Started an empty project because the most recent project could not be reopened.");
              setProjectError(`Could not reopen the most recent project: ${error instanceof Error ? error.message : String(error)}`);
            }
          } else {
            const emptyProject = createEmptyProject();
            applyProjectToWorkspace(emptyProject, "", "Started a new empty project.");
          }
        } else {
          setProjectPath((currentPath) => (
            currentPath === buildDefaultProjectPath("Sample API Regression")
              ? buildDefaultProjectPath(project.name, resolvedProjectDirectory)
              : currentPath
          ));
        }
      } catch (error) {
        if (!cancelled) {
          if (nativeRuntime) {
            applyProjectToWorkspace(createEmptyProject(), "", "Started an empty project after startup failed.");
          }
          setProjectError(error instanceof Error ? error.message : String(error));
        }
      } finally {
        if (!cancelled) setShellReady(true);
      }
    }

    void initializeShell();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    let unsubscribeShellCommand: undefined | (() => void);

    async function registerMenuListeners() {
      try {
        const { listen } = await import("@tauri-apps/api/event");
        unsubscribeShellCommand = await listen<ShellCommandEventPayload>("relay-shell-command", (event) => {
          shellCommandHandlerRef.current(event.payload);
        });
      } catch {
        unsubscribeShellCommand = undefined;
      }
    }

    void registerMenuListeners();
    return () => {
      unsubscribeShellCommand?.();
    };
  }, []);

  useEffect(() => {
    let unsubscribe: undefined | (() => void);

    async function registerCloseHook() {
      try {
        const { getCurrentWindow } = await import("@tauri-apps/api/window");
        const currentWindow = getCurrentWindow();
        unsubscribe = await currentWindow.onCloseRequested((event) => {
          if (allowWindowCloseRef.current) {
            allowWindowCloseRef.current = false;
            return;
          }
          if (hasDirtyState) {
            event.preventDefault();
            setPendingProjectOpen(null);
            setPendingWindowClose(true);
            setSavePromptOpen(true);
          }
        });
      } catch {
        window.onbeforeunload = hasDirtyState ? () => true : null;
      }
    }

    void registerCloseHook();
    return () => {
      unsubscribe?.();
      window.onbeforeunload = null;
    };
  }, [hasDirtyState]);

  useEffect(() => {
    if (!shellReady) return;
    void syncNativeMenu(nativeShellMenuState);
  }, [
    shellReady,
    nativeShellMenuState.activeTabKind,
    nativeShellMenuState.hasDirtyState,
    nativeShellMenuState.canSaveProject,
    nativeShellMenuState.canCloseActiveTab,
    nativeShellMenuState.canSendRequest,
    nativeShellMenuState.canRunFlow,
    nativeShellMenuState.explorerOpen,
    nativeShellMenuState.inspectorOpen,
    nativeShellMenuState.responseDockOpen,
    nativeShellMenuState.flowDetailsOpen
  ]);

  const computedRequestUrl = useMemo(() => {
    if (activeTab.kind === "flow") {
      return "{{baseUrl}}/flow/authenticated-read";
    }
    if (activeTab.kind === "response") {
      return "responses/current-user-2026-06-21.json";
    }
    return requestPreview?.url ?? "{{baseUrl}}/api/orders";
  }, [activeTab.kind, requestPreview?.url]);
  const requestUrl = editableRequestUrl ?? computedRequestUrl;
  const activeTabHasComposer = activeTab.kind === "request" || activeTab.kind === "flow";
  const activeTabHasBottomDock = activeTabHasComposer || activeTab.kind === "response";
  const activeTabUsesFullWorkbench = !activeTabHasBottomDock;
  const workspaceStyle = {
    "--explorer-width": `${layoutSizes.explorerWidth}px`,
    "--inspector-width": `${layoutSizes.inspectorWidth}px`
  } as CSSProperties;
  const workbenchStyle = {
    "--bottom-dock-height": `${layoutSizes.bottomDockHeight}px`
  } as CSSProperties;

  useEffect(() => {
    setEditableRequestUrl(null);
  }, [activeServiceId, activeTab.kind, environment]);

  if (!shellReady) {
    return <StartupShell />;
  }

  function openPlaceholderTab(kind: TabKind, label: string) {
    const id = `${kind}-${label.toLowerCase().replace(/[^a-z0-9]+/g, "-")}`;
    setTabs((current) => (current.some((tab) => tab.id === id) ? current : [...current, { id, kind, label }]));
    setActiveTabId(id);
  }

  async function executeShellCommand(id: NativeShellCommandId, payload?: ShellCommandEventPayload) {
    const recentProjectMenuIndex = parseRecentProjectMenuIndex(id);
    if (recentProjectMenuIndex !== null) {
      if (payload?.recentProject) {
        requestOpenRecentProject(payload.recentProject);
        return;
      }
      const projectPersistence = persistence ?? await createProjectPersistence();
      if (!persistence) setPersistence(projectPersistence);
      const currentRecentProjects = recentProjects.length ? recentProjects : await projectPersistence.listRecentProjects();
      const recent = currentRecentProjects[recentProjectMenuIndex];
      if (recent) {
        requestOpenRecentProject(recent);
      }
      return;
    }
    switch (id) {
      case "app.search_commands":
        setCommandPaletteOpen(true);
        return;
      case "app.open_import":
        openPlaceholderTab("import", "Import API Docs");
        return;
      case "app.open_settings":
        openPlaceholderTab("settings", "Settings");
        return;
      case "app.open_help":
        openPlaceholderTab("help", "Help");
        return;
      case "file.new_project":
        setNewProjectDialogOpen(true);
        return;
      case "file.open_project":
        await requestOpenProjectFromShell();
        return;
      case "file.show_recent_projects":
        setRecentProjectsDialogOpen(true);
        return;
      case "file.open_recent":
        if (payload?.recentProject) {
          requestOpenRecentProject(payload.recentProject);
        }
        return;
      case "file.save_project":
        await openSaveProjectDialog("Save Project", projectPath);
        return;
      case "file.save_project_as":
        await openSaveProjectDialog("Save Project As", "");
        return;
      case "file.exit":
        await requestCloseWindowRequested();
        return;
      case "window.close_active_tab":
        if (canCloseActiveTab) {
          closeTab(activeTabId);
        }
        return;
      case "window.close_window":
        await requestCloseWindowRequested();
        return;
      case "request.send_active":
        if (activeTab.kind === "request") {
          await handleSendRequest();
        }
        return;
      case "flow.run_active":
        if (activeTab.kind === "flow") {
          await handleRunFlow();
        }
        return;
      case "view.toggle_explorer":
        setExplorerOpen((current) => typeof payload?.checked === "boolean" ? payload.checked : !current);
        return;
      case "view.toggle_inspector":
        setInspectorOpen((current) => typeof payload?.checked === "boolean" ? payload.checked : !current);
        return;
      case "view.toggle_response_dock":
        if (!["welcome", "settings", "import", "help"].includes(activeTab.kind)) {
          setResponseVisible((current) => typeof payload?.checked === "boolean" ? payload.checked : !current);
        }
        return;
      case "view.toggle_flow_details":
        setFlowDetailsOpen((current) => typeof payload?.checked === "boolean" ? payload.checked : !current);
        return;
      default:
        throw new Error(`Unhandled shell command: ${id}`);
    }
  }

  async function requestCloseWindowRequested() {
    if (hasDirtyState && projectSettings.askToSaveOnClose) {
      setPendingProjectOpen(null);
      setPendingWindowClose(true);
      setSavePromptOpen(true);
      return;
    }
    await closeWindowWithBypass();
  }

  async function requestCloseWindowNow() {
    try {
      const { getCurrentWindow } = await import("@tauri-apps/api/window");
      await getCurrentWindow().close();
    } catch {
      window.close();
    }
  }

  async function closeWindowWithBypass() {
    allowWindowCloseRef.current = true;
    try {
      await requestCloseWindowNow();
    } catch (error) {
      allowWindowCloseRef.current = false;
      setProjectError(`Could not close Relay Studio: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  function closeTab(id: string) {
    const tab = tabs.find((item) => item.id === id);
    if (tab?.dirty && projectSettings.askBeforeClosingUnsavedTabs) {
      setPendingTabCloseId(id);
      setPendingProjectOpen(null);
      setPendingWindowClose(false);
      setSavePromptOpen(true);
      return;
    }
    closeTabNow(id);
  }

  function closeTabNow(id: string) {
    setTabs((current) => {
      const next = current.filter((tab) => tab.id !== id);
      if (activeTabId === id) {
        setActiveTabId(next[Math.max(0, next.length - 1)]?.id ?? "welcome");
      }
      return next.length ? next : initialTabs.slice(0, 1);
    });
  }

  function handleSelectService(service: ProjectService) {
    setActiveServiceId(service.id);
    setTabs((current) => (
      current.some((tab) => tab.id === service.id)
        ? current
        : [...current, { id: service.id, label: service.name, kind: "request", method: service.method }]
    ));
    setActiveTabId(service.id);
    syncNativeMenuForTabKind("request");
  }

  function handleSelectFlow(flow: ProjectFlow) {
    setActiveFlowId(flow.id);
    setTabs((current) => (
      current.some((tab) => tab.id === flow.id)
        ? current
        : [...current, { id: flow.id, label: flow.name, kind: "flow" }]
    ));
    setActiveTabId(flow.id);
    syncNativeMenuForTabKind("flow");
  }

  function handleSelectTab(tabId: string) {
    const tab = tabs.find((item) => item.id === tabId);
    setActiveTabId(tabId);
    if (tab?.kind === "request" && project.services.some((service) => service.id === tab.id)) {
      setActiveServiceId(tab.id);
    }
    if (tab?.kind === "flow" && project.flows.some((flow) => flow.id === tab.id)) {
      setActiveFlowId(tab.id);
    }
    if (tab) {
      syncNativeMenuForTabKind(tab.kind);
    }
  }

  function updateProjectServices(nextServices: ProjectService[], message = "Request definition updated.") {
    setProject((current) => touchProject({ ...current, services: nextServices }));
    setProjectDirty(true);
    setTabs((current) => current.map((tab) => (tab.id === activeTabId ? { ...tab, dirty: true } : tab)));
    setProjectMessage(message);
    setProjectError(null);
  }

  function updateProjectFlows(nextFlows: ProjectFlow[], message = "Flow definition updated.") {
    setProject((current) => touchProject({ ...current, flows: nextFlows }));
    setProjectDirty(true);
    setTabs((current) => current.map((tab) => (tab.id === activeTabId ? { ...tab, dirty: true } : tab)));
    setProjectMessage(message);
    setProjectError(null);
  }

  function updateFlow(flowId: string, updater: (flow: ProjectFlow) => ProjectFlow, message?: string) {
    setProject((current) => touchProject({
      ...current,
      flows: current.flows.map((flow) => (
        flow.id === flowId ? updater(normalizeFlow(flow)) : flow
      ))
    }));
    setProjectDirty(true);
    setTabs((current) => current.map((tab) => (tab.id === activeTabId ? { ...tab, dirty: true } : tab)));
    setProjectMessage(message ?? "Flow definition updated.");
    setProjectError(null);
  }

  function updateActiveService(updater: (service: ProjectService) => ProjectService, message?: string) {
    if (!activeService) return;
    const updatedService = updater(activeService);
    updateProjectServices(
      project.services.map((service) => (service.id === activeService.id ? updatedService : service)),
      message
    );
    setTabs((current) => current.map((tab) => (
      tab.id === activeService.id ? { ...tab, label: updatedService.name, method: updatedService.method, dirty: true } : tab
    )));
  }

  function handleRenameRequest(serviceId: string, name: string) {
    const requestName = name.trim();
    if (!requestName) {
      setProjectError("Request name is required.");
      return;
    }
    if (!project.services.some((service) => service.id === serviceId)) {
      setProjectError("Request could not be renamed because it no longer exists.");
      setRenameRequestDialog(null);
      return;
    }

    updateProjectServices(
      project.services.map((service) => (service.id === serviceId ? { ...service, name: requestName } : service)),
      `Request renamed to ${requestName}.`
    );
    setTabs((current) => current.map((tab) => (
      tab.id === serviceId ? { ...tab, label: requestName, dirty: true } : tab
    )));
    setRenameRequestDialog(null);
  }

  function handleRequestUrlChange(value: string) {
    setEditableRequestUrl(value);
    if (!activeService || !activeEnvironment || activeTab.kind !== "request") return;
    const parsed = parseRequestUrlForService(activeService, activeEnvironment, value);
    if (!parsed) return;

    setProject((current) => touchProject({
      ...current,
      services: current.services.map((service) => (
        service.id === activeService.id ? parsed.service : service
      )),
      environments: current.environments.map((item) => (
        item.id === activeEnvironment.id ? parsed.environment : item
      ))
    }));
    setProjectDirty(true);
    setTabs((current) => current.map((tab) => (tab.id === activeService.id ? { ...tab, dirty: true } : tab)));
    setProjectMessage("Request URL updated.");
    setProjectError(null);
  }

  function handleCreateService() {
    const next = createService({ id: `service-${project.services.length + 1}` });
    updateProjectServices([...project.services, next], "New request created.");
    handleSelectService(next);
  }

  function handleImportServices(parsed: ParsedOpenApi, selectedIds: string[], saveAfterImport: boolean) {
    const imported = selectedOperationsToServices(parsed, selectedIds, project.services.map((service) => service.id));
    if (!imported.length) throw new Error("Select at least one REST service to add.");
    setProject((current) => touchProject({
      ...current,
      services: [...current.services, ...imported],
      environments: current.environments.map((item) => item.name === environment
        ? { ...item, variables: upsertEnvironmentVariable(item.variables, { name: "baseUrl", value: parsed.serverUrl, secret: false }) }
        : item)
    }));
    setProjectDirty(true);
    setProjectMessage(`${imported.length} REST service${imported.length === 1 ? "" : "s"} imported from ${parsed.title}.`);
    setProjectError(null);
    handleSelectService(imported[0]);
    if (saveAfterImport) {
      void openSaveProjectDialog("Save Project", projectPath);
    }
  }

  function handleDuplicateService() {
    if (!activeService) return;
    const copy = duplicateService(activeService, project.services.map((service) => service.id));
    updateProjectServices([...project.services, copy], "Request duplicated.");
    handleSelectService(copy);
  }

  function handleDeleteService() {
    if (!activeService) return;
    handleDeleteRequest(activeService.id);
  }

  function handleDeleteRequest(serviceId: string) {
    if (!project.services.some((service) => service.id === serviceId)) {
      setProjectError("Request could not be deleted because it no longer exists.");
      return;
    }
    const nextServices = deleteService(project.services, serviceId);
    updateProjectServices(nextServices, "Request deleted.");
    setTabs((current) => current.filter((tab) => tab.id !== serviceId));
    if (activeService?.id === serviceId) {
      const nextActive = nextServices[0];
      if (nextActive) handleSelectService(nextActive);
      else setActiveTabId("welcome");
    }
  }

  function handleMoveService(direction: "up" | "down") {
    if (!activeService) return;
    updateProjectServices(reorderService(project.services, activeService.id, direction), "Request order updated.");
  }

  function handleAddFlowNode(flowId: string, serviceId: string) {
    const service = project.services.find((item) => item.id === serviceId);
    if (!service) return;
    updateFlow(flowId, (flow) => addFlowNode(flow, service), "Flow step added.");
  }

  function handleDeleteFlowNode(flowId: string, nodeId: string) {
    updateFlow(flowId, (flow) => deleteFlowNode(flow, nodeId), "Flow step deleted.");
  }

  function handleConnectFlowNodes(flowId: string, source: string, target: string, condition: "success" | "failure") {
    updateFlow(flowId, (flow) => connectFlowNodes(flow, source, target, condition), `${condition === "success" ? "Success" : "Failure"} path added.`);
  }

  function handleConnectFlowNodeToService(flowId: string, source: string, serviceId: string, condition: "success" | "failure") {
    const service = project.services.find((item) => item.id === serviceId);
    if (!service) {
      setProjectError("Path target request no longer exists.");
      return;
    }
    updateFlow(flowId, (flow) => connectFlowNodeToService(flow, source, service, condition), `${condition === "success" ? "Success" : "Failure"} path added.`);
  }

  function handleDisconnectFlowNodes(flowId: string, source: string, target: string, condition: "success" | "failure") {
    updateFlow(flowId, (flow) => disconnectFlowNodes(flow, source, target, condition), `${condition === "success" ? "Success" : "Failure"} path removed.`);
  }

  function handleReorderFlowNode(flowId: string, nodeId: string, direction: "left" | "right") {
    updateFlow(flowId, (flow) => reorderFlowNode(flow, nodeId, direction), "Flow step order updated.");
  }

  function handleMoveFlowNode(flowId: string, nodeId: string, position: { x: number; y: number }) {
    const flow = project.flows.find((item) => item.id === flowId);
    const node = flow ? normalizeFlow(flow).nodes.find((item) => item.id === nodeId) : undefined;
    if (!node || positionsEqual(node.position, position)) return;
    updateFlow(flowId, (currentFlow) => ({
      ...currentFlow,
      nodes: normalizeFlow(currentFlow).nodes.map((currentNode) => (
        currentNode.id === nodeId ? { ...currentNode, position } : currentNode
      ))
    }), "Flow layout updated.");
  }

  function handleResetFlowLayout(flowId: string) {
    updateFlow(flowId, (flow) => {
      const normalized = normalizeFlow(flow);
      const positions = resetFlowLayoutPositions(normalized.nodes);
      return {
        ...normalized,
        nodes: normalized.nodes.map((node) => ({
          ...node,
          position: positions[node.id] ?? node.position
        }))
      };
    }, "Flow layout reset.");
  }

  function handleAddFlowMapping(flowId: string, sourceNodeId: string, preset?: Partial<Omit<FlowMapping, "id" | "sourceNodeId">>) {
    updateFlow(flowId, (flow) => addFlowMapping(flow, sourceNodeId, preset), "Flow mapping added.");
  }

  function handleUpdateFlowMapping(flowId: string, mappingId: string, patch: Partial<Omit<FlowMapping, "id">>) {
    updateFlow(flowId, (flow) => updateFlowMapping(flow, mappingId, patch), "Flow mapping updated.");
  }

  function handleDeleteFlowMapping(flowId: string, mappingId: string) {
    updateFlow(flowId, (flow) => deleteFlowMapping(flow, mappingId), "Flow mapping deleted.");
  }

  function handleApplyFlowTemplate(flowId: string, templateId: FlowTemplateId) {
    updateFlow(flowId, (flow) => applyFlowTemplate(flow, templateId), "Flow template applied.");
  }

  function handleCreateFlow() {
    const flowNumber = project.flows.length + 1;
    const nextFlow: ProjectFlow = {
      id: `flow-${flowNumber}`,
      name: `New Flow ${flowNumber}`,
      steps: [],
      nodes: [],
      edges: [],
      mappings: []
    };
    updateProjectFlows([...project.flows, nextFlow], "New flow created.");
    handleSelectFlow(nextFlow);
  }

  function handleDeleteFlow(flowId: string) {
    const nextFlows = project.flows.filter((flow) => flow.id !== flowId);
    updateProjectFlows(nextFlows, "Flow deleted.");
    setTabs((current) => {
      const nextTabs = current.filter((tab) => tab.id !== flowId);
      if (activeTabId === flowId) {
        setActiveTabId(nextFlows[0]?.id ?? activeService?.id ?? "welcome");
      }
      return nextTabs.length ? nextTabs : initialTabs.slice(0, 1);
    });
    if (activeFlowId === flowId) {
      setActiveFlowId(nextFlows[0]?.id ?? "");
    }
  }

  function handleRenameFlow(flowId: string, name: string) {
    const flowName = name.trim();
    if (!flowName) {
      setProjectError("Flow name is required.");
      return;
    }
    if (!project.flows.some((flow) => flow.id === flowId)) {
      setProjectError("Flow could not be renamed because it no longer exists.");
      setRenameFlowDialog(null);
      return;
    }

    updateProjectFlows(
      project.flows.map((flow) => (flow.id === flowId ? { ...flow, name: flowName } : flow)),
      `Flow renamed to ${flowName}.`
    );
    setTabs((current) => current.map((tab) => (
      tab.id === flowId || (tab.id === activeTabId && activeFlowId === flowId && tab.kind === "flow")
        ? { ...tab, id: flowId, label: flowName, kind: "flow", dirty: true }
        : tab
    )));
    if (activeFlowId === flowId) setActiveTabId(flowId);
    setRenameFlowDialog(null);
  }

  function updateActiveEnvironment(updater: (environment: ProjectEnvironment) => ProjectEnvironment, message = "Environment updated.") {
    if (!activeEnvironment) return;
    setProject((current) => touchProject({
      ...current,
      environments: current.environments.map((item) => (
        item.id === activeEnvironment.id ? updater(item) : item
      ))
    }));
    setProjectDirty(true);
    setTabs((current) => current.map((tab) => (tab.id === activeTabId ? { ...tab, dirty: true } : tab)));
    setProjectMessage(message);
    setProjectError(null);
  }

  function updateProjectSettings(
    updater: (settings: RelayProject["settings"]) => RelayProject["settings"],
    message: string
  ) {
    setProject((current) => {
      const settings = updater(getProjectSettings(current));
      return touchProject({
        ...current,
        settings
      });
    });
    setProjectDirty(true);
    setTabs((current) => current.map((tab) => (tab.id === activeTabId ? { ...tab, dirty: true } : tab)));
    setProjectMessage(message);
    setProjectError(null);
  }

  function handleDefaultEnvironmentChange(environmentId: string) {
    const selectedEnvironment = project.environments.find((item) => item.id === environmentId);
    if (!selectedEnvironment) {
      setProjectError("Default environment could not be updated because the selected environment no longer exists.");
      return;
    }
    setEnvironment(selectedEnvironment.name);
    updateProjectSettings((settings) => ({
      ...settings,
      defaultEnvironmentId: selectedEnvironment.id
    }), `Default environment set to ${selectedEnvironment.name}.`);
  }

  function handleProjectSettingChange<K extends keyof ProjectSettings>(key: K, value: ProjectSettings[K], message: string) {
    updateProjectSettings((settings) => ({
      ...settings,
      [key]: value
    }), message);
  }

  function handleProxySettingChange<K extends keyof ProjectSettings["proxy"]>(key: K, value: ProjectSettings["proxy"][K], message: string) {
    updateProjectSettings((settings) => ({
      ...settings,
      proxy: {
        ...settings.proxy,
        [key]: value
      }
    }), message);
  }

  function handleAddEnvironmentVariable() {
    updateActiveEnvironment((current) => ({
      ...current,
      variables: [
        ...current.variables,
        { name: uniqueEnvironmentVariableName(current.variables, "newVariable"), value: "", secret: false }
      ]
    }), "Environment variable added.");
  }

  function handleUpdateEnvironmentVariable(index: number, patch: Partial<ProjectVariable>) {
    updateActiveEnvironment((current) => ({
      ...current,
      variables: current.variables.map((variable, variableIndex) => (
        variableIndex === index ? { ...variable, ...patch } : variable
      ))
    }), "Environment variable updated.");
  }

  function handleDeleteEnvironmentVariable(index: number) {
    updateActiveEnvironment((current) => ({
      ...current,
      variables: current.variables.filter((_variable, variableIndex) => variableIndex !== index)
    }), "Environment variable deleted.");
  }

  async function handleSendRequest() {
    if (activeTab.kind === "flow") {
      await handleRunFlow();
      return;
    }
    if (!activeService || !activeEnvironment) return;
    let serviceForRun = activeService;
    let environmentForRun = activeEnvironment;
    if (editableRequestUrl && editableRequestUrl !== computedRequestUrl) {
      const parsed = parseRequestUrlForService(activeService, activeEnvironment, editableRequestUrl);
      if (!parsed) {
        setProjectError("Request URL must be an absolute http(s) URL or a relative path starting with /.");
        return;
      }
      serviceForRun = parsed.service;
      environmentForRun = parsed.environment;
    }
    const destinationUrl = buildRequestPreview(serviceForRun, environmentForRun).url;
    try {
      assertMultipartFilesApproved(multipartFileApprovals, serviceForRun, destinationUrl);
    } catch (error) {
      setProjectError(error instanceof Error ? error.message : String(error));
      return;
    }

    const controller = new AbortController();
    runnerAbortControllerRef.current = controller;
    setRunnerRunning(true);
    setRunnerError(null);
    setResponseVisible(true);

    const result = await runServiceRequest(serviceForRun, environmentForRun, undefined, projectSettings, { signal: controller.signal });
    setRunnerRequest(result.request);
    setRunnerEvents(result.events);
    setRunnerResponse(result.response);
    setRunnerError(result.error);

    if (result.response?.capturedVariables.length) {
      setProject((current) => touchProject({
        ...current,
        environments: current.environments.map((item) => (
          item.id === activeEnvironment.id
            ? { ...item, variables: mergeCapturedVariables(item.variables, result.response!.capturedVariables) }
            : item
        ))
      }));
      setProjectDirty(true);
      setProjectMessage("Captured secret response variables into the active environment.");
    } else if (result.response) {
      setProjectMessage(`Request completed with HTTP ${result.response.status}.`);
    } else if (result.error) {
      setProjectError(result.error);
    }

    if (runnerAbortControllerRef.current === controller) runnerAbortControllerRef.current = null;
    setRunnerRunning(false);
  }

  async function handleRunFlow() {
    if (!activeFlow || !activeEnvironment) return;
    try {
      for (const serviceId of activeFlow.steps) {
        const service = project.services.find((candidate) => candidate.id === serviceId);
        if (service) assertMultipartFilesApproved(multipartFileApprovals, service, buildRequestPreview(service, activeEnvironment).url);
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      setProjectError(message);
      setRunnerError(message);
      return;
    }
    const controller = new AbortController();
    runnerAbortControllerRef.current = controller;
    setRunnerRunning(true);
    setRunnerError(null);
    setResponseVisible(true);

    const result = await runFlow(activeFlow, project.services, activeEnvironment, undefined, { signal: controller.signal });
    setProject((current) => touchProject({
      ...current,
      flows: current.flows.map((flow) => (
        flow.id === activeFlow.id ? result.flow : flow
      )),
      // Flow mappings live only in the cloned runtime environment. Persisting
      // result.environment here would write captured credentials into the
      // project file after a run.
      environments: current.environments
    }));
    setProjectDirty(true);
    setTabs((current) => current.map((tab) => (tab.id === activeTabId ? { ...tab, dirty: true } : tab)));
    setProjectMessage(result.error === "Flow cancelled."
      ? "Flow cancelled."
      : result.issues.some((issue) => issue.severity === "error")
        ? "Flow blocked or failed during mapping."
        : "Flow run completed.");
    setProjectError(null);
    setRunnerEvents(result.events);
    setRunnerResponse(result.response);
    setRunnerRequest(result.request);
    setRunnerError(result.issues.length ? result.issues.map((issue) => issue.message).join(" ") : result.error);
    if (runnerAbortControllerRef.current === controller) runnerAbortControllerRef.current = null;
    setRunnerRunning(false);
  }

  function handleCancelRun() {
    runnerAbortControllerRef.current?.abort();
    setProjectMessage(activeTab.kind === "flow" ? "Cancelling flow…" : "Cancelling request…");
  }

  function handleExportDiagnostics() {
    const bundle = createDiagnosticsBundle({
      appVersion: "0.1.0",
      platform: getDesktopPlatform(),
      project,
      events: runnerEvents
    });
    const blob = new Blob([JSON.stringify(bundle, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = `relay-studio-diagnostics-${Date.now()}.json`;
    anchor.click();
    URL.revokeObjectURL(url);
    setProjectMessage("Redacted diagnostics bundle exported.");
    setProjectError(null);
  }

  function openSaveResponseDialog() {
    if (!activeService || !runnerResponse) {
      setProjectError("Send a request before saving a response.");
      return;
    }
    const path = defaultSavedResponsePath(activeService, runnerResponse);
    setSaveResponseDialog({
      path,
      warning: runnerResponse.contentType.toLowerCase().includes("json") && !runnerResponse.parseError
        ? null
        : "Non-JSON responses save as redacted raw text."
    });
  }

  async function handleSaveResponse(path: string, overwrite: boolean) {
    if (!activeService || !runnerRequest || !runnerResponse) {
      setProjectError("No completed request response is available to save.");
      return;
    }
    try {
      const responsePersistence = savedResponsePersistence ?? await createSavedResponsePersistence();
      if (!savedResponsePersistence) setSavedResponsePersistence(responsePersistence);
      const draft = buildSavedResponseDraft({
        service: activeService,
        request: runnerRequest,
        response: runnerResponse,
        filePath: path
      });
      await responsePersistence.saveResponse({ path, artifact: draft.artifact, overwrite });
      setProject((current) => touchProject({
        ...current,
        savedResponses: [
          draft.metadata,
          ...current.savedResponses.filter((response) => response.filePath !== draft.metadata.filePath)
        ]
      }));
      setProjectDirty(true);
      setTabs((current) => current.map((tab) => (tab.id === activeTabId ? { ...tab, dirty: true } : tab)));
      setSaveResponseDialog(null);
      setProjectMessage(draft.warning ? `Saved response to ${path}. ${draft.warning}` : `Saved response to ${path}.`);
      setProjectError(null);
    } catch (error) {
      setProjectError(error instanceof Error ? error.message : String(error));
    }
  }

  function handleApproveMultipartFile(fieldId: string): void {
    if (!activeService) return;
    try {
      const approval = approveMultipartFile(activeService, fieldId, requestUrl);
      setMultipartFileApprovals((current) => [
        ...current.filter((item) => !(item.serviceId === approval.serviceId && item.fieldId === approval.fieldId)),
        approval
      ]);
      setProjectMessage(`Approved ${approval.filePath.replace(/\\/g, "/").split("/").pop() || "local file"} for ${approval.destinationOrigin} during this session.`);
      setProjectError(null);
    } catch (error) {
      setProjectError(error instanceof Error ? error.message : String(error));
    }
  }

  async function handleSavedResponseExists(path: string) {
    const responsePersistence = savedResponsePersistence ?? await createSavedResponsePersistence();
    if (!savedResponsePersistence) setSavedResponsePersistence(responsePersistence);
    return responsePersistence.responseExists(path);
  }

  function handleAppContextMenu(event: ReactMouseEvent<HTMLElement>) {
    if (!isEditableContextTarget(event.target)) {
      event.preventDefault();
    }
  }

  async function handleOpenSavedResponse(metadata: SavedResponseMetadata) {
    try {
      const responsePersistence = savedResponsePersistence ?? await createSavedResponsePersistence();
      if (!savedResponsePersistence) setSavedResponsePersistence(responsePersistence);
      const artifact = await responsePersistence.readResponse(metadata);
      const response = artifactToExecutedResponse(artifact);
      setRunnerResponse(response);
      setRunnerRequest(null);
      setRunnerError(response.parseError);
      setRunnerEvents([
        { sequence: 1, phase: "prepare", level: "info", message: `Loaded saved response: ${metadata.fileName}.` },
        { sequence: 2, phase: "success", level: response.ok ? "success" : "error", message: `Saved response reopened with HTTP ${response.status}.` }
      ]);
      setResponseVisible(true);
      setTabs((current) => (
        current.some((tab) => tab.id === metadata.id)
          ? current
          : [...current, { id: metadata.id, label: metadata.fileName, kind: "response", method: metadata.method }]
      ));
      setActiveTabId(metadata.id);
      setProjectMessage(`Loaded saved response from ${metadata.filePath}.`);
      setProjectError(null);
    } catch (error) {
      setProjectError(error instanceof Error ? error.message : String(error));
    }
  }

  async function handleCompareSavedResponses(before: SavedResponseMetadata, after: SavedResponseMetadata) {
    try {
      const responsePersistence = savedResponsePersistence ?? await createSavedResponsePersistence();
      if (!savedResponsePersistence) setSavedResponsePersistence(responsePersistence);
      const [beforeArtifact, afterArtifact] = await Promise.all([
        responsePersistence.readResponse(before),
        responsePersistence.readResponse(after)
      ]);
      const comparison = compareSavedResponses(beforeArtifact, afterArtifact);
      const response = comparisonToExecutedResponse(comparison);
      const tabId = `comparison:${before.id}:${after.id}`;
      setRunnerResponse(response);
      setRunnerRequest(null);
      setRunnerError(null);
      setRunnerEvents([
        { sequence: 1, phase: "prepare", level: "info", message: `Comparing redacted responses: ${before.fileName} and ${after.fileName}.` },
        { sequence: 2, phase: "success", level: "success", message: `${comparison.summary.added + comparison.summary.removed + comparison.summary.changed} response difference(s) found.` }
      ]);
      setResponseVisible(true);
      setTabs((current) => current.some((tab) => tab.id === tabId)
        ? current
        : [...current, { id: tabId, label: `${before.fileName} ↔ ${after.fileName}`, kind: "response", method: before.method }]);
      setActiveTabId(tabId);
      setProjectMessage(`Compared ${before.fileName} with ${after.fileName}.`);
      setProjectError(null);
    } catch (error) {
      setProjectError(error instanceof Error ? error.message : String(error));
    }
  }

  return (
    <main
      className="app-shell"
      aria-label="Relay Studio desktop shell"
      data-breakpoint={layoutBreakpoint}
      data-platform={desktopPlatform}
      data-theme={projectSettings.theme}
      data-window-active={windowActive ? "true" : "false"}
      onContextMenu={handleAppContextMenu}
    >
      <TopCommandBar
        activeTab={activeTab}
        primaryExecutionCommandLabel={null}
        projectName={project.name}
        projectDirty={hasDirtyState}
        environment={environment}
        onEnvironmentChange={setEnvironment}
        commandSearchButtonRef={commandSearchButtonRef}
        onOpenCommandPalette={() => void executeShellCommand("app.search_commands")}
        onSave={() => void executeShellCommand("file.save_project")}
        onRunPrimaryAction={() => {
          if (primaryExecutionCommand) {
            void executeShellCommand(primaryExecutionCommand.id);
          }
        }}
        inspectorOpen={inspectorOpen}
        onToggleInspector={() => void executeShellCommand("view.toggle_inspector")}
        runnerRunning={runnerRunning}
        showEnvironmentSelector={showEnvironmentSelector}
      />

      <section className={workspaceClassName} style={workspaceStyle}>
        {explorerOpen ? (
          <>
            <ProjectExplorer
              groupedServices={groupedServices}
              project={project}
              projectDirty={hasDirtyState}
              onCreateProject={() => setNewProjectDialogOpen(true)}
              activeServiceId={activeService?.id ?? ""}
              onSelectService={handleSelectService}
              onCreateRequest={handleCreateService}
              onRenameRequest={(serviceId) => {
                const service = project.services.find((item) => item.id === serviceId);
                if (service) setRenameRequestDialog(service);
              }}
              onDeleteRequest={handleDeleteRequest}
              activeFlowId={activeFlow?.id ?? ""}
              onSelectFlow={handleSelectFlow}
              onCreateFlow={handleCreateFlow}
              onDeleteFlow={handleDeleteFlow}
              onRenameFlow={(flowId) => {
                const flow = project.flows.find((item) => item.id === flowId);
                if (flow) setRenameFlowDialog(flow);
              }}
              onOpenSavedResponse={handleOpenSavedResponse}
              onCompareSavedResponses={(before, after) => void handleCompareSavedResponses(before, after)}
            />
            <ResizeHandle
              ariaLabel="Resize explorer"
              orientation="vertical"
              onResize={(delta) => setLayoutSizes((current) => ({
                ...current,
                explorerWidth: clamp(current.explorerWidth + delta, 240, 520)
              }))}
            />
          </>
        ) : null}

        <section
          className={[
            "workbench",
            welcomeTabActive ? "welcome-workbench" : "",
            activeTabUsesFullWorkbench ? "full-workbench" : ""
          ].filter(Boolean).join(" ")}
          aria-label="Workbench"
          style={workbenchStyle}
        >
          <TabStrip
            tabs={tabs}
            activeTabId={activeTabId}
            onSelect={handleSelectTab}
            onClose={closeTab}
            onNewTab={handleCreateService}
            onRenameRequest={(serviceId) => {
              const service = project.services.find((item) => item.id === serviceId);
              if (service) setRenameRequestDialog(service);
            }}
            onRenameFlow={(flowId) => {
              const flow = project.flows.find((item) => item.id === flowId);
              if (flow) setRenameFlowDialog(flow);
            }}
          />
          {activeTabHasComposer ? (
            <RequestComposer
              requestUrl={requestUrl}
              activeTab={activeTab}
              onRequestUrlChange={handleRequestUrlChange}
              onMethodChange={(method) => {
                if (activeTab.kind === "request") {
                  updateActiveService((service) => ({ ...service, method }), "HTTP method updated.");
                }
              }}
              onSendRequest={handleSendRequest}
              onCancelRun={handleCancelRun}
              runnerRunning={runnerRunning}
            />
          ) : null}
          <RequestEditor
            activeTab={activeTab}
            project={project}
            projectPath={projectPath}
            hasDirtyState={hasDirtyState}
            activeEnvironmentName={activeEnvironment?.name ?? ""}
            onDefaultEnvironmentChange={handleDefaultEnvironmentChange}
            onAskToSaveOnCloseChange={(askToSaveOnClose) => updateProjectSettings((settings) => ({
              ...settings,
              askToSaveOnClose
            }), askToSaveOnClose ? "Close prompt enabled." : "Close prompt disabled.")}
            onSettingChange={handleProjectSettingChange}
            onProxySettingChange={handleProxySettingChange}
            onExportDiagnostics={handleExportDiagnostics}
            onImportServices={handleImportServices}
            activeService={activeService}
            activeFlow={activeFlow}
            flowDetailsOpen={flowDetailsOpen}
            services={project.services}
            activeEnvironment={activeEnvironment}
            requestPreview={requestPreview}
            requestUrl={requestUrl}
            multipartFileApprovals={multipartFileApprovals}
            onApproveMultipartFile={handleApproveMultipartFile}
            onCreateService={handleCreateService}
            onDuplicateService={handleDuplicateService}
            onDeleteService={handleDeleteService}
            onMoveService={handleMoveService}
            onUpdateService={updateActiveService}
            onAddFlowNode={handleAddFlowNode}
            onDeleteFlowNode={handleDeleteFlowNode}
            onConnectFlowNodes={handleConnectFlowNodes}
            onConnectFlowNodeToService={handleConnectFlowNodeToService}
            onDisconnectFlowNodes={handleDisconnectFlowNodes}
            onReorderFlowNode={handleReorderFlowNode}
            onMoveFlowNode={handleMoveFlowNode}
            onResetFlowLayout={handleResetFlowLayout}
            onAddFlowMapping={handleAddFlowMapping}
            onUpdateFlowMapping={handleUpdateFlowMapping}
            onDeleteFlowMapping={handleDeleteFlowMapping}
            onApplyFlowTemplate={handleApplyFlowTemplate}
          />
          {activeTabHasBottomDock && responseVisible ? (
            <>
              <ResizeHandle
                ariaLabel="Resize utility dock"
                orientation="horizontal"
                onResize={(delta) => setLayoutSizes((current) => ({
                  ...current,
                  bottomDockHeight: clamp(current.bottomDockHeight - delta, 180, 520)
                }))}
              />
              <BottomDock
                responseVisible={responseVisible}
                onToggleResponse={() => setResponseVisible((visible) => !visible)}
                consoleFilter={consoleFilter}
                onConsoleFilterChange={setConsoleFilter}
                runnerResponse={runnerResponse}
                runnerEvents={runnerEvents}
                runnerError={runnerError}
                canSaveResponse={Boolean(runnerResponse && runnerRequest)}
                onSaveResponse={openSaveResponseDialog}
              />
            </>
          ) : null}
        </section>

        {inspectorOpen ? (
          <>
            <ResizeHandle
              ariaLabel="Resize inspector"
              className="inspector-resize-handle"
              orientation="vertical"
              onResize={(delta) => setLayoutSizes((current) => ({
                ...current,
                inspectorWidth: clamp(current.inspectorWidth - delta, 240, 460)
              }))}
            />
            <Inspector
              environment={activeEnvironment}
              activeTab={activeTab}
              activeService={activeService}
              activeFlow={activeFlow}
              runnerResponse={runnerResponse}
              onAddVariable={handleAddEnvironmentVariable}
              onClose={() => setInspectorOpen(false)}
              onDeleteVariable={handleDeleteEnvironmentVariable}
              onUpdateVariable={handleUpdateEnvironmentVariable}
            />
          </>
        ) : null}
      </section>
      <StatusBar
        projectName={project.name}
        dirty={hasDirtyState}
        message={projectError ?? projectMessage}
        error={Boolean(projectError)}
        explorerOpen={explorerOpen}
        inspectorOpen={inspectorOpen}
        responseDockOpen={responseVisible && activeTabHasBottomDock}
      />

      {commandPaletteOpen ? (
        <CommandPalette
          commands={commandPaletteCommands}
          returnFocusRef={commandSearchButtonRef}
          onClose={() => setCommandPaletteOpen(false)}
          onChoose={(id) => {
            setCommandPaletteOpen(false);
            void executeShellCommand(id);
          }}
        />
      ) : null}

      {savePromptOpen ? (
        <SavePrompt
          projectName={project.name}
          onCancel={() => {
            setPendingTabCloseId(null);
            setPendingProjectOpen(null);
            setSaveThenOpenProject(null);
            setPendingWindowClose(false);
            setSavePromptOpen(false);
          }}
          onDiscard={() => {
            setSavePromptOpen(false);
            if (pendingWindowClose) {
              setPendingWindowClose(false);
              void closeWindowWithBypass();
              return;
            }
            setProjectDirty(false);
            setTabs((current) => current.map((tab) => ({ ...tab, dirty: false })));
            if (pendingTabCloseId) {
              const tabId = pendingTabCloseId;
              setPendingTabCloseId(null);
              closeTabNow(tabId);
              return;
            }
            const pending = pendingProjectOpen;
            setPendingProjectOpen(null);
            if (pending) void openPendingProject(pending, { preserveCurrent: false });
          }}
          onSave={() => {
            if (pendingProjectOpen) {
              setSaveThenOpenProject(pendingProjectOpen);
              setPendingProjectOpen(null);
            }
            setPendingTabCloseId(null);
            setSavePromptOpen(false);
            void openSaveProjectDialog("Save Project", projectPath);
          }}
        />
      ) : null}
      {recentProjectsDialogOpen ? (
        <RecentProjectsDialog
          sessionProjects={sessionProjects}
          recentProjects={recentProjects}
          activeProjectName={project.name}
          activeProjectPath={projectPath}
          onClose={() => setRecentProjectsDialogOpen(false)}
          onOpenSessionProject={(snapshotId) => {
            setRecentProjectsDialogOpen(false);
            requestOpenSessionProject(snapshotId);
          }}
          onOpenRecent={(recent) => {
            setRecentProjectsDialogOpen(false);
            requestOpenRecentProject(recent);
          }}
          onRenameProject={(target) => {
            setRecentProjectsDialogOpen(false);
            setRenameProjectDialog(target);
          }}
          onDeleteProject={(target) => {
            setRecentProjectsDialogOpen(false);
            setDeleteProjectDialog(target);
          }}
        />
      ) : null}

      {projectDialog ? (
        <ProjectFileDialog
          dialog={projectDialog}
          error={projectError}
          projectName={project.name}
          defaultDirectory={defaultProjectDirectory}
          recentProjects={recentProjects}
          projectExists={handleProjectExists}
          onCancel={() => {
            setSaveThenOpenProject(null);
            setPendingWindowClose(false);
            setProjectDialog(null);
          }}
          onSubmit={async ({ path }) => {
            if (projectDialog.mode === "save") {
              await handleSaveProject(path);
            } else {
              await handleOpenProject(path);
            }
          }}
        />
      ) : null}

      {newProjectDialogOpen ? (
        <ProjectNameDialog
          title="New Project"
          initialName="Untitled API Project"
          submitLabel="Create Project"
          onCancel={() => setNewProjectDialogOpen(false)}
          onSubmit={handleCreateNamedProject}
        />
      ) : null}

      {renameProjectDialog ? (
        <ProjectNameDialog
          title="Rename Project"
          initialName={renameProjectDialog.name}
          submitLabel="Rename Project"
          onCancel={() => setRenameProjectDialog(null)}
          onSubmit={(name) => handleRenameProject(renameProjectDialog, name)}
        />
      ) : null}

      {deleteProjectDialog ? (
        <DeleteProjectDialog
          target={deleteProjectDialog}
          onCancel={() => setDeleteProjectDialog(null)}
          onDelete={() => handleDeleteProject(deleteProjectDialog)}
        />
      ) : null}

      {renameFlowDialog ? (
        <ProjectNameDialog
          title="Rename Flow"
          initialName={renameFlowDialog.name}
          submitLabel="Rename Flow"
          onCancel={() => setRenameFlowDialog(null)}
          onSubmit={(name) => handleRenameFlow(renameFlowDialog.id, name)}
        />
      ) : null}

      {renameRequestDialog ? (
        <ProjectNameDialog
          title="Rename Request"
          initialName={renameRequestDialog.name}
          submitLabel="Rename Request"
          fieldLabel="Request name"
          onCancel={() => setRenameRequestDialog(null)}
          onSubmit={(name) => handleRenameRequest(renameRequestDialog.id, name)}
        />
      ) : null}

      {saveResponseDialog ? (
        <SaveResponseDialog
          dialog={saveResponseDialog}
          responseExists={handleSavedResponseExists}
          onCancel={() => setSaveResponseDialog(null)}
          onSubmit={handleSaveResponse}
        />
      ) : null}
    </main>
  );

  function handleCreateNamedProject(name: string) {
    const projectName = name.trim();
    const snapshot = createSessionProjectSnapshot();
    const starterService = createService({
      id: "request-1",
      folder: "Requests",
      name: "New Request",
      method: "GET",
      path: "/api/health",
      auth: "none",
      authProfile: { type: "none" }
    });
    const nextProject = {
      ...createEmptyProject(),
      id: slugForId(projectName),
      name: projectName,
      services: [starterService]
    };
    setSessionProjects((current) => upsertSessionProjectSnapshot(current, snapshot));
    setProject(nextProject);
    setProjectPath("");
    setEnvironment(getDefaultEnvironmentName(nextProject));
    setActiveServiceId(starterService.id);
    setActiveFlowId(nextProject.flows[0]?.id ?? "");
    setProjectDirty(true);
    setTabs([
      { id: "welcome", label: "Welcome", kind: "welcome" },
      { id: starterService.id, label: starterService.name, kind: "request", method: starterService.method, dirty: true }
    ]);
    setActiveTabId(starterService.id);
    setEditableRequestUrl(null);
    setNewProjectDialogOpen(false);
    setProjectMessage(`New unsaved project "${projectName}" created with a starter request.`);
    setProjectError(null);
  }

  function createSessionProjectSnapshot(): SessionProjectSnapshot {
    return {
      id: `${project.id}:${projectPath || "unsaved"}`,
      name: project.name,
      path: projectPath,
      project,
      tabs,
      activeTabId,
      activeServiceId,
      activeFlowId,
      environment,
      projectDirty
    };
  }

  function requestOpenSessionProject(snapshotId: string) {
    requestProjectOpen({ type: "session", snapshotId });
  }

  function requestOpenRecentProject(recent: RecentProject) {
    requestProjectOpen({ type: "recent", recent });
  }

  function requestOpenProjectPath(path: string) {
    requestProjectOpen({ type: "path", path });
  }

  async function requestOpenProjectFromShell() {
    if (!hasTauriRuntimeSync()) {
      setProjectDialog({ mode: "open", title: "Open Project", path: "" });
      return;
    }
    try {
      const selectedPath = await openNativeProjectFilePicker();
      if (!selectedPath) return;
      requestOpenProjectPath(selectedPath);
    } catch (error) {
      setProjectError(`Could not open native project picker: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  async function openSaveProjectDialog(title: "Save Project" | "Save Project As", currentPath: string) {
    setProjectError(null);
    const path = await resolveSaveProjectPath(currentPath);
    setProjectDialog({ mode: "save", title, path });
  }

  async function resolveSaveProjectPath(currentPath: string): Promise<string> {
    if (currentPath && !isBrowserFallbackProjectPath(currentPath)) {
      return currentPath;
    }
    const directory = await resolveNativeProjectDirectoryForSave();
    return buildDefaultProjectPath(project.name, directory);
  }

  async function resolveNativeProjectDirectoryForSave(): Promise<string> {
    if (!isBrowserFallbackProjectPath(buildDefaultProjectPath(project.name, defaultProjectDirectory))) {
      return defaultProjectDirectory;
    }
    const resolvedProjectDirectory = await resolveDefaultProjectDirectory();
    setDefaultProjectDirectory(resolvedProjectDirectory);
    return resolvedProjectDirectory;
  }

  function requestProjectOpen(pending: PendingProjectOpen) {
    if (hasDirtyState) {
      setPendingWindowClose(false);
      setPendingProjectOpen(pending);
      setSavePromptOpen(true);
      return;
    }
    void openPendingProject(pending, { preserveCurrent: true });
  }

  async function openPendingProject(pending: PendingProjectOpen, options: { preserveCurrent: boolean }) {
    if (options.preserveCurrent) {
      preserveCurrentProjectBeforeSwitch(pending);
    }
    if (pending.type === "session") {
      openSessionProjectNow(pending.snapshotId);
    } else if (pending.type === "recent") {
      await handleOpenProject(pending.recent.path);
    } else {
      await handleOpenProject(pending.path);
    }
  }

  function preserveCurrentProjectBeforeSwitch(pending: PendingProjectOpen) {
    const snapshot = createSessionProjectSnapshot();
    if (pending.type === "session" && pending.snapshotId === snapshot.id) return;
    if (pending.type === "recent" && pending.recent.path === projectPath) return;
    if (pending.type === "path" && pending.path === projectPath) return;
    setSessionProjects((current) => upsertSessionProjectSnapshot(current, snapshot));
  }

  function openSessionProjectNow(snapshotId: string) {
    const snapshot = sessionProjects.find((item) => item.id === snapshotId);
    if (!snapshot) return;
    const restoredTabs = reconcileTabsForProject(snapshot.project, snapshot.tabs);
    const restoredActiveTabId = reconcileActiveTabId(snapshot.project, restoredTabs, snapshot.activeTabId, snapshot.activeServiceId, snapshot.activeFlowId);
    setSessionProjects((current) => current.filter((item) => item.id !== snapshotId));
    setProject(snapshot.project);
    setProjectPath(snapshot.path);
    setTabs(restoredTabs);
    setActiveTabId(restoredActiveTabId);
    setActiveServiceId(snapshot.activeServiceId);
    setActiveFlowId(snapshot.activeFlowId);
    setEnvironment(snapshot.environment || getDefaultEnvironmentName(snapshot.project));
    setProjectDirty(snapshot.projectDirty);
    setEditableRequestUrl(null);
    setProjectMessage(`Restored ${snapshot.name}.`);
    setProjectError(null);
  }

  async function handleSaveProject(path: string) {
    try {
      const projectPersistence = persistence ?? await createProjectPersistence();
      if (!persistence) setPersistence(projectPersistence);
      const updated = touchProject(normalizeProjectForSave(project));
      await projectPersistence.saveProject({ path, project: updated });
      const recent = { name: updated.name, path, openedAt: new Date().toISOString() };
      await projectPersistence.rememberRecentProject(recent);
      setProject(updated);
      setProjectPath(path);
      setProjectDirty(false);
      setTabs((current) => current.map((tab) => ({ ...tab, dirty: false })));
      await refreshRecentProjects(projectPersistence);
      setProjectDialog(null);
      const pending = saveThenOpenProject;
      setSaveThenOpenProject(null);
      if (pendingWindowClose) {
        setPendingWindowClose(false);
        await closeWindowWithBypass();
      } else if (pending) {
        await openPendingProject(pending, { preserveCurrent: true });
      } else {
        setProjectMessage(`Project saved to ${path}.`);
      }
      setProjectError(null);
    } catch (error) {
      setProjectError(error instanceof Error ? error.message : String(error));
    }
  }

  async function handleOpenProject(path: string) {
    const projectPersistence = persistence ?? await createProjectPersistence();
    if (!persistence) setPersistence(projectPersistence);
    try {
      const opened = await projectPersistence.openProject({ path });
      const recent = { name: opened.name, path, openedAt: new Date().toISOString() };
      await projectPersistence.rememberRecentProject(recent);
      applyProjectToWorkspace(opened, path, `Project opened from ${path}.`);
      await refreshRecentProjects(projectPersistence);
      setProjectDialog(null);
      setProjectError(null);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      if (message.startsWith("Project file was not found")) {
        try {
          await projectPersistence.removeRecentProject(path);
          await refreshRecentProjects(projectPersistence);
        } catch {
          setRecentProjects((current) => current.filter((recent) => recent.path !== path));
        }
      }
      setProjectDialog(null);
      setProjectError(message);
    }
  }

  function applyProjectToWorkspace(opened: RelayProject, path: string, message: string): void {
    setProject(opened);
    setProjectPath(path);
    setEnvironment(getDefaultEnvironmentName(opened));
    setActiveServiceId(opened.services[0]?.id ?? "");
    setActiveFlowId(opened.flows[0]?.id ?? "");
    setProjectDirty(false);
    const openedTabs = createDefaultTabsForProject(opened);
    setTabs(openedTabs);
    setActiveTabId(opened.services[0]?.id ?? opened.flows[0]?.id ?? openedTabs[0]?.id ?? "welcome");
    setEditableRequestUrl(null);
    setMultipartFileApprovals([]);
    setProjectMessage(message);
  }

  async function handleProjectExists(path: string) {
    const projectPersistence = persistence ?? await createProjectPersistence();
    if (!persistence) setPersistence(projectPersistence);
    return projectPersistence.projectExists(path);
  }

  async function handleRenameProject(target: ProjectListTarget, name: string) {
    const projectName = name.trim();
    try {
      const projectPersistence = persistence ?? await createProjectPersistence();
      if (!persistence) setPersistence(projectPersistence);
      if (target.path) {
        await projectPersistence.renameProject({ path: target.path, name: projectName });
        await refreshRecentProjects(projectPersistence);
      }
      setSessionProjects((current) => current.map((snapshot) => (
        snapshot.id === target.id || (target.path && snapshot.path === target.path)
          ? { ...snapshot, name: projectName, project: { ...snapshot.project, name: projectName } }
          : snapshot
      )));
      if (target.path && target.path === projectPath) {
        setProject((current) => ({ ...current, name: projectName }));
      }
      setRenameProjectDialog(null);
      setProjectMessage(`Project renamed to ${projectName}.`);
      setProjectError(null);
    } catch (error) {
      setProjectError(error instanceof Error ? error.message : String(error));
    }
  }

  async function handleDeleteProject(target: ProjectListTarget) {
    try {
      const projectPersistence = persistence ?? await createProjectPersistence();
      if (!persistence) setPersistence(projectPersistence);
      if (target.path) {
        await projectPersistence.deleteProject(target.path);
        await refreshRecentProjects(projectPersistence);
      }
      setSessionProjects((current) => current.filter((snapshot) => (
        snapshot.id !== target.id && (!target.path || snapshot.path !== target.path)
      )));
      if (target.path && target.path === projectPath) {
        setProjectPath("");
        setProjectDirty(true);
        setTabs((current) => current.map((tab) => ({ ...tab, dirty: true })));
      }
      setDeleteProjectDialog(null);
      setProjectMessage(`Deleted project ${target.name}.`);
      setProjectError(null);
    } catch (error) {
      setProjectError(error instanceof Error ? error.message : String(error));
    }
  }

  async function refreshRecentProjects(projectPersistence: ProjectPersistence) {
    const recent = await projectPersistence.listRecentProjects();
    setRecentProjects(recent);
    await syncNativeMenu();
  }

  async function syncNativeMenu(state = nativeShellMenuState) {
    try {
      const { invoke } = await import("@tauri-apps/api/core");
      await invoke("refresh_app_menu", { state });
    } catch {
      // Browser fallback does not have a native menu to refresh.
    }
  }

  function syncNativeMenuForTabKind(activeTabKind: TabKind) {
    if (!shellReady) return;
    void syncNativeMenu(createNativeShellMenuState({
      ...shellCommandContext,
      activeTabKind: activeTabKind as ShellCommandTabKind
    }));
  }
}

function StartupShell() {
  return (
    <main className="app-shell startup-shell" aria-label="Relay Studio starting">
      <div className="startup-panel" role="status" aria-live="polite">
        <span className="brand-mark" aria-hidden="true"><Zap size={24} strokeWidth={2.4} /></span>
        <div>
          <strong>Relay Studio</strong>
          <span>Preparing workspace...</span>
        </div>
      </div>
    </main>
  );
}

interface TopCommandBarProps {
  activeTab: WorkbenchTab;
  primaryExecutionCommandLabel: string | null;
  projectName: string;
  projectDirty: boolean;
  environment: string;
  inspectorOpen: boolean;
  runnerRunning: boolean;
  showEnvironmentSelector: boolean;
  commandSearchButtonRef: RefObject<HTMLButtonElement>;
  onEnvironmentChange: (environment: string) => void;
  onOpenCommandPalette: () => void;
  onSave: () => void;
  onRunPrimaryAction: () => void;
  onToggleInspector: () => void;
}

function TopCommandBar(props: TopCommandBarProps) {
  return (
    <header className="top-command-bar">
      <div className="brand-lockup" aria-label="Relay Studio">
        <span className="brand-mark" aria-hidden="true"><Zap size={24} strokeWidth={2.4} /></span>
        <div>
          <strong>Relay Studio</strong>
          <span>{props.projectName}</span>
        </div>
      </div>
      <button
        className="command-search"
        ref={props.commandSearchButtonRef}
        type="button"
        onMouseDown={(event) => event.currentTarget.focus()}
        onClick={props.onOpenCommandPalette}
      >
        <Search size={17} />
        <span>Search commands</span>
        <kbd>Cmd K</kbd>
      </button>
      <div className="toolbar-actions" aria-label="Primary commands">
        <button type="button" className="icon-command" onClick={props.onSave}>
          <Save size={18} />
          <span>{props.projectDirty ? "Save *" : "Save"}</span>
        </button>
        {props.primaryExecutionCommandLabel ? (
          <button
            type="button"
            className="primary-command"
            aria-label={props.primaryExecutionCommandLabel}
            title={props.primaryExecutionCommandLabel}
            onClick={props.onRunPrimaryAction}
            disabled={props.runnerRunning}
          >
            {props.primaryExecutionCommandLabel === "Run Flow" ? <Play size={18} /> : <Send size={18} />}
            <span>{props.runnerRunning ? "Running..." : props.primaryExecutionCommandLabel}</span>
          </button>
        ) : null}
        {props.showEnvironmentSelector ? (
          <label className="environment-select">
            <span className="status-dot" />
            <select value={props.environment} onChange={(event) => props.onEnvironmentChange(event.target.value)}>
              <option>QA Environment</option>
              <option>Staging Environment</option>
              <option>Production Environment</option>
            </select>
          </label>
        ) : null}
        <button
          type="button"
          className={props.inspectorOpen ? "chrome-icon active" : "chrome-icon"}
          aria-label={props.inspectorOpen ? "Hide inspector" : "Show inspector"}
          aria-pressed={props.inspectorOpen}
          onClick={props.onToggleInspector}
        >
          <SlidersHorizontal size={19} />
        </button>
      </div>
    </header>
  );
}

function ResizeHandle({
  ariaLabel,
  className = "",
  orientation,
  onResize
}: {
  ariaLabel: string;
  className?: string;
  orientation: "vertical" | "horizontal";
  onResize: (delta: number) => void;
}) {
  function startResize(event: ReactPointerEvent<HTMLDivElement>) {
    event.preventDefault();
    const start = orientation === "vertical" ? event.clientX : event.clientY;
    let last = start;

    function handleMove(moveEvent: PointerEvent) {
      const current = orientation === "vertical" ? moveEvent.clientX : moveEvent.clientY;
      onResize(current - last);
      last = current;
    }

    function stopResize() {
      window.removeEventListener("pointermove", handleMove);
      window.removeEventListener("pointerup", stopResize);
    }

    window.addEventListener("pointermove", handleMove);
    window.addEventListener("pointerup", stopResize);
  }

  function nudge(event: ReactKeyboardEvent<HTMLDivElement>) {
    const keys = orientation === "vertical" ? ["ArrowLeft", "ArrowRight"] : ["ArrowUp", "ArrowDown"];
    if (!keys.includes(event.key)) return;
    event.preventDefault();
    const direction = event.key === "ArrowRight" || event.key === "ArrowDown" ? 1 : -1;
    onResize(direction * 16);
  }

  return (
    <div
      aria-label={ariaLabel}
      aria-orientation={orientation}
      className={`resize-handle ${orientation} ${className}`.trim()}
      role="separator"
      tabIndex={0}
      onKeyDown={nudge}
      onPointerDown={startResize}
    />
  );
}

function ProjectExplorer(props: {
  groupedServices: Array<{ folder: string; items: ProjectService[] }>;
  project: RelayProject;
  projectDirty: boolean;
  activeServiceId: string;
  onSelectService: (service: ProjectService) => void;
  onCreateRequest: () => void;
  onRenameRequest: (serviceId: string) => void;
  onDeleteRequest: (serviceId: string) => void;
  activeFlowId: string;
  onSelectFlow: (flow: ProjectFlow) => void;
  onCreateFlow: () => void;
  onDeleteFlow: (flowId: string) => void;
  onRenameFlow: (flowId: string) => void;
  onCreateProject: () => void;
  onOpenSavedResponse: (metadata: SavedResponseMetadata) => void;
  onCompareSavedResponses: (before: SavedResponseMetadata, after: SavedResponseMetadata) => void;
}) {
  const [contextMenu, setContextMenu] = useState<null | {
    x: number;
    y: number;
    target: "requests" | "request" | "flows" | "flow";
    serviceId?: string;
    flowId?: string;
  }>(null);
  const [comparisonIds, setComparisonIds] = useState<string[]>([]);

  useEffect(() => {
    const available = new Set(props.project.savedResponses.map((response) => response.id));
    setComparisonIds((current) => current.filter((id) => available.has(id)).slice(0, 2));
  }, [props.project.savedResponses]);

  useEffect(() => {
    if (!contextMenu) return;
    function closeContextMenu() {
      setContextMenu(null);
    }
    window.addEventListener("click", closeContextMenu);
    window.addEventListener("keydown", closeContextMenu);
    return () => {
      window.removeEventListener("click", closeContextMenu);
      window.removeEventListener("keydown", closeContextMenu);
    };
  }, [contextMenu]);

  return (
    <aside className="project-explorer" aria-label="Project explorer">
      <div className="pane-title">
        <div>
          <p>Explorer</p>
          <h1>{props.project.name}{props.projectDirty ? " *" : ""}</h1>
          <span>{props.project.services.length} requests - {props.project.flows.length} flows</span>
        </div>
        <button type="button" aria-label="New project" onClick={props.onCreateProject}><Plus size={17} /></button>
      </div>
      <label className="explorer-search">
        <Search size={16} />
        <input placeholder="Search projects and requests" />
      </label>
      <div className="tree-scroll">
        <TreeSection
          title="Requests"
          count={String(props.project.services.length)}
          onContextMenu={(position) => setContextMenu({ ...position, target: "requests" })}
        >
          {props.groupedServices.map((group) => (
            <div className="tree-folder" key={group.folder}>
              <button type="button" className="tree-folder-label">
                <ChevronDown size={15} />
                <Folder size={16} />
                <span>{group.folder}</span>
              </button>
              {group.items.map((item) => (
                <button
                  type="button"
                  className={item.id === props.activeServiceId ? "tree-item selected" : "tree-item"}
                  key={item.id}
                  onClick={() => props.onSelectService(item)}
                  onContextMenu={(event) => {
                    event.preventDefault();
                    event.stopPropagation();
                    setContextMenu({
                      x: event.clientX,
                      y: event.clientY,
                      target: "request",
                      serviceId: item.id
                    });
                  }}
                >
                  <span className={`method method-${item.method.toLowerCase()}`}>{item.method}</span>
                  <span>{item.name}</span>
                </button>
              ))}
            </div>
          ))}
        </TreeSection>
        <TreeSection
          title="Flows"
          count={String(props.project.flows.length)}
          actionLabel="New flow"
          onAction={props.onCreateFlow}
          onContextMenu={(position) => setContextMenu({ ...position, target: "flows" })}
        >
          {props.project.flows.map((flow) => (
            <button
              type="button"
              className={flow.id === props.activeFlowId ? "tree-item selected" : "tree-item"}
              key={flow.id}
              onClick={() => props.onSelectFlow(flow)}
              onContextMenu={(event) => {
                event.preventDefault();
                event.stopPropagation();
                setContextMenu({
                  x: event.clientX,
                  y: event.clientY,
                  target: "flow",
                  flowId: flow.id
                });
              }}
            >
              <GitBranch size={15} />
              <span>{flow.name}</span>
            </button>
          ))}
        </TreeSection>
        {contextMenu ? (
          <div
            className="tree-context-menu"
            role="menu"
            aria-label={contextMenuLabel(contextMenu.target)}
            style={{ left: contextMenu.x, top: contextMenu.y }}
            onClick={(event) => event.stopPropagation()}
          >
            {contextMenu.target === "requests" ? (
              <button type="button" role="menuitem" onClick={() => {
                setContextMenu(null);
                props.onCreateRequest();
              }}>
                <Plus size={14} />
                <span>Add Request</span>
              </button>
            ) : null}
            {contextMenu.target === "request" && contextMenu.serviceId ? (
              <>
                <button type="button" role="menuitem" onClick={() => {
                  const serviceId = contextMenu.serviceId as string;
                  setContextMenu(null);
                  props.onRenameRequest(serviceId);
                }}>
                  <Pencil size={14} />
                  <span>Rename Request</span>
                </button>
                <button type="button" role="menuitem" className="danger" onClick={() => {
                  const serviceId = contextMenu.serviceId as string;
                  setContextMenu(null);
                  props.onDeleteRequest(serviceId);
                }}>
                  <Trash2 size={14} />
                  <span>Delete Request</span>
                </button>
              </>
            ) : null}
            {contextMenu.target === "flows" ? (
              <button type="button" role="menuitem" onClick={() => {
                setContextMenu(null);
                props.onCreateFlow();
              }}>
                <Plus size={14} />
                <span>Add Flow</span>
              </button>
            ) : null}
            {contextMenu.target === "flow" && contextMenu.flowId ? (
              <>
                <button type="button" role="menuitem" onClick={() => {
                  const flowId = contextMenu.flowId as string;
                  setContextMenu(null);
                  props.onRenameFlow(flowId);
                }}>
                  <Pencil size={14} />
                  <span>Rename Flow</span>
                </button>
                <button type="button" role="menuitem" className="danger" onClick={() => {
                  const flowId = contextMenu.flowId as string;
                  setContextMenu(null);
                  props.onDeleteFlow(flowId);
                }}>
                  <Trash2 size={14} />
                  <span>Delete Flow</span>
                </button>
              </>
            ) : null}
          </div>
        ) : null}
        <TreeSection title="Environments" count="3">
          {["QA Environment", "Staging Environment", "Production Environment"].map((environment) => (
            <button type="button" className="tree-item" key={environment}>
              <span className={environment.startsWith("Production") ? "env-dot danger" : "env-dot"} />
              <span>{environment}</span>
            </button>
          ))}
        </TreeSection>
        <TreeSection title="Variables" count="2">
          <button type="button" className="tree-item">
            <Braces size={15} />
            <span>Global Variables</span>
          </button>
          <button type="button" className="tree-item">
            <Lock size={15} />
            <span>Vault (Encrypted)</span>
          </button>
        </TreeSection>
        <TreeSection title="Saved Responses" count={String(props.project.savedResponses.length)}>
          {props.project.savedResponses.map((response) => (
            <div className="saved-response-row" key={response.id}>
              <input
                type="checkbox"
                aria-label={`Select ${response.fileName} for comparison`}
                checked={comparisonIds.includes(response.id)}
                disabled={!comparisonIds.includes(response.id) && comparisonIds.length >= 2}
                onChange={(event) => setComparisonIds((current) => event.target.checked ? [...current, response.id] : current.filter((id) => id !== response.id))}
              />
              <button
                type="button"
                className={response.status >= 400 ? "tree-item warning" : "tree-item"}
                onClick={() => props.onOpenSavedResponse(response)}
                title={`${response.method} ${response.status} - ${response.filePath}`}
              >
                <FileJson size={15} />
                <span>{response.fileName}</span>
              </button>
            </div>
          ))}
          {props.project.savedResponses.length >= 2 ? (
            <button
              type="button"
              className="compare-responses-button"
              disabled={comparisonIds.length !== 2}
              onClick={() => {
                const selected = comparisonIds.map((id) => props.project.savedResponses.find((response) => response.id === id)).filter((response): response is SavedResponseMetadata => Boolean(response));
                if (selected.length === 2) props.onCompareSavedResponses(selected[0], selected[1]);
              }}
            >
              Compare selected responses
            </button>
          ) : null}
        </TreeSection>
      </div>
    </aside>
  );
}

function RecentProjectsDialog({
  sessionProjects,
  recentProjects,
  activeProjectName,
  activeProjectPath,
  onClose,
  onOpenSessionProject,
  onOpenRecent,
  onRenameProject,
  onDeleteProject
}: {
  sessionProjects: SessionProjectSnapshot[];
  recentProjects: RecentProject[];
  activeProjectName: string;
  activeProjectPath: string;
  onClose: () => void;
  onOpenSessionProject: (snapshotId: string) => void;
  onOpenRecent: (recent: RecentProject) => void;
  onRenameProject: (target: ProjectListTarget) => void;
  onDeleteProject: (target: ProjectListTarget) => void;
}) {
  const [contextMenu, setContextMenu] = useState<null | {
    x: number;
    y: number;
    target: ProjectListTarget;
  }>(null);
  const closeButtonRef = useRef<HTMLButtonElement | null>(null);
  const dialogRef = useModalBehavior(onClose, { initialFocusRef: closeButtonRef });
  const visibleSessionProjects = sessionProjects
    .filter((snapshot) => !isActiveProjectListTarget(activeProjectName, activeProjectPath, snapshot.name, snapshot.path))
    .slice(0, 5);
  const visibleSessionProjectPaths = new Set(visibleSessionProjects.map((snapshot) => snapshot.path).filter(Boolean));
  const visibleSessionProjectNames = new Set(visibleSessionProjects.map((snapshot) => snapshot.name.toLowerCase()));
  const visibleRecentProjects = recentProjects.filter((recent) => (
    !isActiveProjectListTarget(activeProjectName, activeProjectPath, recent.name, recent.path)
      && !visibleSessionProjectPaths.has(recent.path)
      && !visibleSessionProjectNames.has(recent.name.toLowerCase())
  )).slice(0, Math.max(0, 10 - visibleSessionProjects.length));
  const hasProjects = visibleSessionProjects.length > 0 || visibleRecentProjects.length > 0;

  useEffect(() => {
    if (!contextMenu) return;
    function closeContextMenu() {
      setContextMenu(null);
    }
    window.addEventListener("click", closeContextMenu);
    window.addEventListener("keydown", closeContextMenu);
    return () => {
      window.removeEventListener("click", closeContextMenu);
      window.removeEventListener("keydown", closeContextMenu);
    };
  }, [contextMenu]);

  return (
    <div className="modal-backdrop" role="presentation" onMouseDown={onClose}>
      <section ref={dialogRef} className="project-file-dialog recent-projects-dialog" role="dialog" aria-modal="true" aria-label="Open Recent Projects" onMouseDown={(event) => event.stopPropagation()}>
        <header>
          <h2>Open Recent Projects</h2>
          <button ref={closeButtonRef} type="button" aria-label="Close recent projects" onClick={onClose}><X size={18} /></button>
        </header>
        <div className="recent-project-picker">
          {visibleSessionProjects.length ? (
            <>
              <strong>Open workspaces</strong>
              {visibleSessionProjects.map((snapshot) => (
                <button
                  type="button"
                  key={snapshot.id}
                  onClick={() => onOpenSessionProject(snapshot.id)}
                  onContextMenu={(event) => {
                    event.preventDefault();
                    setContextMenu({
                      x: event.clientX,
                      y: event.clientY,
                      target: { source: "session", id: snapshot.id, name: snapshot.name, path: snapshot.path }
                    });
                  }}
                >
                  <FolderOpen size={15} />
                  <span>{snapshot.name}</span>
                  <em>{snapshot.path || "Unsaved session"}</em>
                </button>
              ))}
            </>
          ) : null}
          {visibleRecentProjects.length ? (
            <>
              <strong>Recent files</strong>
              {visibleRecentProjects.map((recent) => (
                <button
                  type="button"
                  key={recent.path}
                  onClick={() => onOpenRecent(recent)}
                  onContextMenu={(event) => {
                    event.preventDefault();
                    setContextMenu({
                      x: event.clientX,
                      y: event.clientY,
                      target: { source: "recent", name: recent.name, path: recent.path }
                    });
                  }}
                >
                  <FolderOpen size={15} />
                  <span>{recent.name}</span>
                  <em>{recent.path}</em>
                </button>
              ))}
            </>
          ) : null}
          {!hasProjects ? <p className="empty-inline">No recent projects yet.</p> : null}
        </div>
        {contextMenu ? (
          <div
            className="tree-context-menu"
            role="menu"
            aria-label="Project context menu"
            style={{ left: contextMenu.x, top: contextMenu.y }}
            onClick={(event) => event.stopPropagation()}
          >
            <button type="button" role="menuitem" onClick={() => {
              const target = contextMenu.target;
              setContextMenu(null);
              onRenameProject(target);
            }}>
              <Pencil size={14} />
              <span>Rename Project</span>
            </button>
            <button type="button" role="menuitem" className="danger" onClick={() => {
              const target = contextMenu.target;
              setContextMenu(null);
              onDeleteProject(target);
            }}>
              <Trash2 size={14} />
              <span>Delete Project</span>
            </button>
          </div>
        ) : null}
      </section>
    </div>
  );
}

function StatusBar({
  projectName,
  dirty,
  message,
  error,
  explorerOpen,
  inspectorOpen,
  responseDockOpen
}: {
  projectName: string;
  dirty: boolean;
  message: string;
  error: boolean;
  explorerOpen: boolean;
  inspectorOpen: boolean;
  responseDockOpen: boolean;
}) {
  return (
    <footer className={error ? "status-bar error" : "status-bar"} aria-label="Status bar">
      <span>{projectName}{dirty ? " *" : ""}</span>
      <strong>{message}</strong>
      <span>Sidebar {explorerOpen ? "shown" : "hidden"}</span>
      <span>Inspector {inspectorOpen ? "shown" : "hidden"}</span>
      <span>Dock {responseDockOpen ? "shown" : "hidden"}</span>
    </footer>
  );
}

function TreeSection({
  title,
  count,
  actionLabel,
  onAction,
  onContextMenu,
  children
}: {
  title: string;
  count: string;
  actionLabel?: string;
  onAction?: () => void;
  onContextMenu?: (position: { x: number; y: number }) => void;
  children: React.ReactNode;
}) {
  const [expanded, setExpanded] = useState(true);

  return (
    <section className={onAction ? "tree-section has-action" : "tree-section"} aria-label={title}>
      <button
        type="button"
        className={expanded ? "tree-section-heading expanded" : "tree-section-heading"}
        aria-expanded={expanded}
        onClick={() => setExpanded((current) => !current)}
        onContextMenu={onContextMenu ? (event) => {
          event.preventDefault();
          onContextMenu({ x: event.clientX, y: event.clientY });
        } : undefined}
      >
        <ChevronDown size={15} />
        <span>{title}</span>
        <em>{count}</em>
      </button>
      {onAction && actionLabel ? (
        <button type="button" className="tree-section-action" aria-label={actionLabel} onClick={onAction}>
          <Plus size={14} />
        </button>
      ) : null}
      {expanded ? children : null}
    </section>
  );
}

function TabStrip(props: {
  tabs: WorkbenchTab[];
  activeTabId: string;
  onSelect: (id: string) => void;
  onClose: (id: string) => void;
  onNewTab: () => void;
  onRenameRequest: (id: string) => void;
  onRenameFlow: (id: string) => void;
}) {
  const [contextMenu, setContextMenu] = useState<null | { x: number; y: number; tabId: string; kind: "request" | "flow" }>(null);

  useEffect(() => {
    if (!contextMenu) return;
    function closeContextMenu() {
      setContextMenu(null);
    }
    window.addEventListener("click", closeContextMenu);
    window.addEventListener("keydown", closeContextMenu);
    return () => {
      window.removeEventListener("click", closeContextMenu);
      window.removeEventListener("keydown", closeContextMenu);
    };
  }, [contextMenu]);

  return (
    <div className="tab-strip" role="tablist" aria-label="Open editors">
      {props.tabs.map((tab) => (
        <button
          type="button"
          role="tab"
          aria-selected={tab.id === props.activeTabId}
          key={tab.id}
          className={tab.id === props.activeTabId ? "tab active" : "tab"}
          onClick={() => props.onSelect(tab.id)}
          onContextMenu={isRequestOrFlowTabKind(tab.kind) ? (event) => {
            event.preventDefault();
            const kind = tab.kind === "request" ? "request" : "flow";
            setContextMenu({ x: event.clientX, y: event.clientY, tabId: tab.id, kind });
          } : undefined}
        >
          {tab.method ? <span className={`tab-method method-${tab.method.toLowerCase()}`}>{tab.method}</span> : null}
          {tab.kind === "flow" ? <GitBranch size={15} /> : null}
          {tab.kind === "response" ? <FileJson size={15} /> : null}
          <span>{tab.label}</span>
          {tab.dirty ? <span className="dirty-dot" aria-label="Unsaved changes" /> : null}
          <X size={14} onClick={(event) => {
            event.stopPropagation();
            props.onClose(tab.id);
          }} />
        </button>
      ))}
      <button type="button" className="new-tab" aria-label="New request tab" onClick={props.onNewTab}>
        <Plus size={17} />
      </button>
      {contextMenu ? (
        <div
          className="tree-context-menu"
          role="menu"
          aria-label={contextMenu.kind === "flow" ? "Flow tab context menu" : "Request tab context menu"}
          style={{ left: contextMenu.x, top: contextMenu.y }}
          onClick={(event) => event.stopPropagation()}
        >
          {contextMenu.kind === "flow" ? (
            <button type="button" role="menuitem" onClick={() => {
              const tabId = contextMenu.tabId;
              setContextMenu(null);
              props.onRenameFlow(tabId);
            }}>
              <Pencil size={14} />
              <span>Rename Flow</span>
            </button>
          ) : (
            <button type="button" role="menuitem" onClick={() => {
              const tabId = contextMenu.tabId;
              setContextMenu(null);
              props.onRenameRequest(tabId);
            }}>
              <Pencil size={14} />
              <span>Rename Request</span>
            </button>
          )}
        </div>
      ) : null}
    </div>
  );
}

function RequestComposer({
  requestUrl,
  activeTab,
  onRequestUrlChange,
  onMethodChange,
  onSendRequest,
  onCancelRun,
  runnerRunning
}: {
  requestUrl: string;
  activeTab: WorkbenchTab;
  onRequestUrlChange: (value: string) => void;
  onMethodChange: (method: HttpMethod) => void;
  onSendRequest: () => void;
  onCancelRun: () => void;
  runnerRunning: boolean;
}) {
  return (
    <div className="request-composer" aria-label="Request composer">
      <div className="breadcrumb">
        <span>Sample API Regression</span>
        <span>Requests</span>
        <span>{activeTab.label}</span>
      </div>
      <div className="request-row">
        <select aria-label="HTTP method" value={activeTab.method ?? "POST"} onChange={(event) => onMethodChange(event.target.value as HttpMethod)}>
          {HTTP_METHODS.map((method) => <option key={method}>{method}</option>)}
        </select>
        <input
          aria-label="Request URL"
          value={requestUrl}
          readOnly={activeTab.kind !== "request"}
          onChange={(event) => onRequestUrlChange(event.target.value)}
        />
        <select aria-label="Protocol" defaultValue="HTTP/1.1">
          <option>HTTP/1.1</option>
          <option>HTTP/2</option>
        </select>
        <button
          type="button"
          className="primary-command send-button"
          aria-label={runnerRunning ? (activeTab.kind === "flow" ? "Cancel Flow" : "Cancel Request") : (activeTab.kind === "flow" ? "Run Flow" : "Send Request")}
          title={runnerRunning ? "Cancel current execution" : (activeTab.kind === "flow" ? "Run Flow" : "Send Request")}
          onClick={runnerRunning ? onCancelRun : onSendRequest}
        >
          {runnerRunning ? <X size={18} /> : activeTab.kind === "flow" ? <Play size={18} /> : <Send size={18} />}
          <span>{runnerRunning ? (activeTab.kind === "flow" ? "Cancel Flow" : "Cancel Request") : activeTab.kind === "flow" ? "Run Flow" : "Send Request"}</span>
        </button>
      </div>
    </div>
  );
}

function RequestEditor({
  activeTab,
  project,
  projectPath,
  hasDirtyState,
  activeEnvironmentName,
  onDefaultEnvironmentChange,
  onAskToSaveOnCloseChange,
  onSettingChange,
  onProxySettingChange,
  onExportDiagnostics,
  onImportServices,
  activeService,
  activeFlow,
  flowDetailsOpen,
  services,
  activeEnvironment,
  requestPreview,
  requestUrl,
  multipartFileApprovals,
  onApproveMultipartFile,
  onCreateService,
  onDuplicateService,
  onDeleteService,
  onMoveService,
  onUpdateService,
  onAddFlowNode,
  onDeleteFlowNode,
  onConnectFlowNodes,
  onConnectFlowNodeToService,
  onDisconnectFlowNodes,
  onReorderFlowNode,
  onMoveFlowNode,
  onResetFlowLayout,
  onAddFlowMapping,
  onUpdateFlowMapping,
  onDeleteFlowMapping,
  onApplyFlowTemplate
}: {
  activeTab: WorkbenchTab;
  project: RelayProject;
  projectPath: string;
  hasDirtyState: boolean;
  activeEnvironmentName: string;
  onDefaultEnvironmentChange: (environmentId: string) => void;
  onAskToSaveOnCloseChange: (enabled: boolean) => void;
  onSettingChange: <K extends keyof ProjectSettings>(key: K, value: ProjectSettings[K], message: string) => void;
  onProxySettingChange: <K extends keyof ProjectSettings["proxy"]>(key: K, value: ProjectSettings["proxy"][K], message: string) => void;
  onExportDiagnostics: () => void;
  onImportServices: (parsed: ParsedOpenApi, selectedIds: string[], saveAfterImport: boolean) => void;
  activeService: ProjectService | undefined;
  activeFlow: ProjectFlow | undefined;
  flowDetailsOpen: boolean;
  services: ProjectService[];
  activeEnvironment: ProjectEnvironment | undefined;
  requestPreview: RequestPreview | null;
  requestUrl: string;
  multipartFileApprovals: MultipartFileApproval[];
  onApproveMultipartFile: (fieldId: string) => void;
  onCreateService: () => void;
  onDuplicateService: () => void;
  onDeleteService: () => void;
  onMoveService: (direction: "up" | "down") => void;
  onUpdateService: (updater: (service: ProjectService) => ProjectService, message?: string) => void;
  onAddFlowNode: (flowId: string, serviceId: string) => void;
  onDeleteFlowNode: (flowId: string, nodeId: string) => void;
  onConnectFlowNodes: (flowId: string, source: string, target: string, condition: "success" | "failure") => void;
  onConnectFlowNodeToService: (flowId: string, source: string, serviceId: string, condition: "success" | "failure") => void;
  onDisconnectFlowNodes: (flowId: string, source: string, target: string, condition: "success" | "failure") => void;
  onReorderFlowNode: (flowId: string, nodeId: string, direction: "left" | "right") => void;
  onMoveFlowNode: (flowId: string, nodeId: string, position: { x: number; y: number }) => void;
  onResetFlowLayout: (flowId: string) => void;
  onAddFlowMapping: (flowId: string, sourceNodeId: string, preset?: Partial<Omit<FlowMapping, "id" | "sourceNodeId">>) => void;
  onUpdateFlowMapping: (flowId: string, mappingId: string, patch: Partial<Omit<FlowMapping, "id">>) => void;
  onDeleteFlowMapping: (flowId: string, mappingId: string) => void;
  onApplyFlowTemplate: (flowId: string, templateId: FlowTemplateId) => void;
}) {
  if (activeTab.kind === "welcome") {
    return <WelcomeView />;
  }

  if (activeTab.kind === "import") {
    return <ImportApiView onImportServices={onImportServices} />;
  }

  if (activeTab.kind === "help") {
    return <HelpView />;
  }

  if (activeTab.kind === "flow") {
    if (!activeFlow) {
      return <PlaceholderView title="No Flow Selected" description="Select a flow from the explorer to model chained REST calls." />;
    }
    return (
      <FlowBuilderEditor
        flow={activeFlow}
        flowDetailsOpen={flowDetailsOpen}
        services={services}
        onAddFlowNode={onAddFlowNode}
        onDeleteFlowNode={onDeleteFlowNode}
        onConnectFlowNodes={onConnectFlowNodes}
        onConnectFlowNodeToService={onConnectFlowNodeToService}
        onDisconnectFlowNodes={onDisconnectFlowNodes}
        onReorderFlowNode={onReorderFlowNode}
        onMoveFlowNode={onMoveFlowNode}
        onResetFlowLayout={onResetFlowLayout}
        onAddFlowMapping={onAddFlowMapping}
        onUpdateFlowMapping={onUpdateFlowMapping}
        onDeleteFlowMapping={onDeleteFlowMapping}
        onApplyFlowTemplate={onApplyFlowTemplate}
      />
    );
  }

  if (activeTab.kind === "settings") {
    return (
      <ProjectSettingsView
        project={project}
        projectPath={projectPath}
        hasDirtyState={hasDirtyState}
        activeEnvironmentName={activeEnvironmentName}
        onDefaultEnvironmentChange={onDefaultEnvironmentChange}
        onAskToSaveOnCloseChange={onAskToSaveOnCloseChange}
        onSettingChange={onSettingChange}
        onProxySettingChange={onProxySettingChange}
        onExportDiagnostics={onExportDiagnostics}
      />
    );
  }

  if (!activeService || !activeEnvironment || !requestPreview) {
    return <PlaceholderView title="No Request Selected" description="Create or select a request to edit its REST call." />;
  }

  return (
    <ServiceDesignerEditor
      service={activeService}
      environment={activeEnvironment}
      requestUrl={requestUrl}
      multipartFileApprovals={multipartFileApprovals}
      onApproveMultipartFile={onApproveMultipartFile}
      onCreateService={onCreateService}
      onDuplicateService={onDuplicateService}
      onDeleteService={onDeleteService}
      onMoveService={onMoveService}
      onUpdateService={onUpdateService}
    />
  );
}

function ServiceDesignerEditor(props: {
  service: ProjectService;
  environment: ProjectEnvironment;
  requestUrl: string;
  multipartFileApprovals: MultipartFileApproval[];
  onApproveMultipartFile: (fieldId: string) => void;
  onCreateService: () => void;
  onDuplicateService: () => void;
  onDeleteService: () => void;
  onMoveService: (direction: "up" | "down") => void;
  onUpdateService: (updater: (service: ProjectService) => ProjectService, message?: string) => void;
}) {
  const [activePanel, setActivePanel] = useState("Authorization");
  const service = props.service;

  function update(patch: Partial<ProjectService>, message?: string) {
    props.onUpdateService((current) => ({ ...current, ...patch }), message);
  }

  function updateAuth(type: AuthMode) {
    const defaultProfile = type === "none" ? { type } : { type, tokenVariable: "accessToken" };
    update({ auth: type, authProfile: { ...defaultProfile } }, "Authorization updated.");
  }

  return (
    <section className="editor-surface service-designer" aria-label="REST request designer">
      <nav className="editor-tabs" aria-label="Request editor tabs">
        {["Authorization", "Headers", "Query Params", "Path Params", "Body", "Retry", "Settings"].map((tab) => (
          <button type="button" className={activePanel === tab ? "active" : ""} key={tab} onClick={() => setActivePanel(tab)}>
            {tab}
            {tab === "Body" && service.body.contentType !== "none" ? <span className="green-dot" /> : null}
          </button>
        ))}
      </nav>
      <div className="service-designer-main">
        <section className="service-detail-panel">
          <header>
            <strong>Request Detail</strong>
            <div>
              <button type="button" onClick={props.onCreateService}>New Request</button>
              <button type="button" onClick={props.onDuplicateService}>Duplicate</button>
              <button type="button" onClick={() => props.onMoveService("up")}>Move Up</button>
              <button type="button" onClick={() => props.onMoveService("down")}>Move Down</button>
              <button type="button" onClick={props.onDeleteService}>Delete</button>
            </div>
          </header>
          <div className="service-form-grid">
            <label>
              <span>Request name</span>
              <input aria-label="Request name" value={service.name} onChange={(event) => update({ name: event.target.value }, "Request renamed.")} />
            </label>
            <label>
              <span>Folder</span>
              <input aria-label="Request folder" value={service.folder} onChange={(event) => update({ folder: event.target.value }, "Request folder updated.")} />
            </label>
            <label>
              <span>Method</span>
              <select aria-label="Request method" value={service.method} onChange={(event) => update({ method: event.target.value as HttpMethod }, "HTTP method updated.")}>
                {HTTP_METHODS.map((method) => <option key={method}>{method}</option>)}
              </select>
            </label>
            <label>
              <span>Path</span>
              <input aria-label="Request path" value={service.path} onChange={(event) => update({ path: event.target.value }, "Request path updated.")} />
            </label>
            <label>
              <span>Timeout ms</span>
              <input aria-label="Timeout ms" type="number" value={service.timeoutMs} onChange={(event) => update({ timeoutMs: Number(event.target.value) }, "Timeout updated.")} />
            </label>
          </div>
          {activePanel === "Authorization" ? (
            <AuthorizationPanel
              environment={props.environment}
              service={service}
              onAuthModeChange={updateAuth}
              onUpdateService={props.onUpdateService}
            />
          ) : null}
          {activePanel === "Headers" ? (
            <RowsPanel title="Headers" rows={service.headers} onChange={(headers) => update({ headers }, "Headers updated.")} />
          ) : null}
          {activePanel === "Query Params" ? (
            <RowsPanel title="Query Params" rows={service.queryParams} onChange={(queryParams) => update({ queryParams }, "Query params updated.")} />
          ) : null}
          {activePanel === "Path Params" ? (
            <RowsPanel title="Path Params" rows={service.pathParams} onChange={(pathParams) => update({ pathParams }, "Path params updated.")} />
          ) : null}
          {activePanel === "Body" ? (
            <BodyPanel
              service={service}
              requestUrl={props.requestUrl}
              multipartFileApprovals={props.multipartFileApprovals}
              onApproveMultipartFile={props.onApproveMultipartFile}
              onUpdate={update}
            />
          ) : null}
          {activePanel === "Retry" ? (
            <RetryPanel service={service} onUpdate={update} />
          ) : null}
          {activePanel === "Settings" ? (
            <SettingsPanel service={service} environment={props.environment} />
          ) : null}
        </section>
      </div>
    </section>
  );
}

function AuthorizationPanel(props: {
  environment: ProjectEnvironment;
  service: ProjectService;
  onAuthModeChange: (type: AuthMode) => void;
  onUpdateService: (updater: (service: ProjectService) => ProjectService, message?: string) => void;
}) {
  const auth = props.service.authProfile;
  const variableNames = props.environment.variables.map((variable) => variable.name);
  const selectedTokenVariable = auth.tokenVariable ?? "";
  const selectedVariableExists = variableNames.includes(selectedTokenVariable);

  function updateAuthProfile(patch: ProjectService["authProfile"]) {
    props.onUpdateService((service) => ({ ...service, authProfile: { ...service.authProfile, ...patch } }), "Authorization updated.");
  }

  return (
    <section className="auth-panel">
      <div className="form-grid">
        <label>
          <span>Authorization type</span>
          <select aria-label="Authorization type" value={auth.type} onChange={(event) => props.onAuthModeChange(event.target.value as AuthMode)}>
            {AUTH_MODES.map((mode) => <option value={mode} key={mode}>{authLabel(mode)}</option>)}
          </select>
        </label>
        {auth.type === "bearer" ? (
          <label>
            <span>Bearer token variable name</span>
            <select
              aria-label="Bearer token variable name"
              value={selectedTokenVariable}
              onChange={(event) => updateAuthProfile({ type: auth.type, tokenVariable: event.target.value })}
            >
              {!selectedTokenVariable ? <option value="">Select token variable</option> : null}
              {selectedTokenVariable && !selectedVariableExists ? (
                <option value={selectedTokenVariable}>Missing: {selectedTokenVariable}</option>
              ) : null}
              {variableNames.map((name) => (
                <option value={name} key={name}>{name}</option>
              ))}
            </select>
          </label>
        ) : null}
        {auth.type === "apiKey" ? (
          <>
            <label><span>Header name</span><input aria-label="API key header" value={auth.apiKeyName ?? ""} onChange={(event) => updateAuthProfile({ type: auth.type, apiKeyName: event.target.value })} /></label>
            <label><span>Header value</span><input aria-label="API key value" value={auth.apiKeyValue ?? ""} onChange={(event) => updateAuthProfile({ type: auth.type, apiKeyValue: event.target.value })} /></label>
          </>
        ) : null}
        {auth.type === "basic" ? (
          <>
            <label><span>Username or variable</span><input aria-label="Username or variable" value={auth.usernameVariable ?? ""} onChange={(event) => updateAuthProfile({ type: auth.type, usernameVariable: event.target.value })} /></label>
            <label><span>Password or variable</span><input aria-label="Password or variable" value={auth.passwordVariable ?? ""} onChange={(event) => updateAuthProfile({ type: auth.type, passwordVariable: event.target.value })} /></label>
          </>
        ) : null}
        {auth.type === "oauthClientCredentials" ? (
          <>
            <label><span>Token URL</span><input aria-label="Token URL" value={auth.tokenUrl ?? ""} onChange={(event) => updateAuthProfile({ type: auth.type, tokenUrl: event.target.value })} /></label>
            <label><span>Client ID variable</span><input aria-label="Client ID variable" value={auth.clientIdVariable ?? ""} onChange={(event) => updateAuthProfile({ type: auth.type, clientIdVariable: event.target.value })} /></label>
            <label><span>Client secret variable</span><input aria-label="Client secret variable" value={auth.clientSecretVariable ?? ""} onChange={(event) => updateAuthProfile({ type: auth.type, clientSecretVariable: event.target.value })} /></label>
          </>
        ) : null}
        {auth.type === "customHeader" ? (
          <>
            <label><span>Header name</span><input aria-label="Custom auth header" value={auth.customHeaderName ?? ""} onChange={(event) => updateAuthProfile({ type: auth.type, customHeaderName: event.target.value })} /></label>
            <label><span>Header value</span><input aria-label="Custom auth value" value={auth.customHeaderValue ?? ""} onChange={(event) => updateAuthProfile({ type: auth.type, customHeaderValue: event.target.value })} /></label>
          </>
        ) : null}
      </div>
    </section>
  );
}

function RowsPanel({
  title,
  rows,
  onChange,
  allowFiles = false,
  isFileApproved,
  onApproveFile
}: {
  title: string;
  rows: KeyValueRow[];
  onChange: (rows: KeyValueRow[]) => void;
  allowFiles?: boolean;
  isFileApproved?: (fieldId: string) => boolean;
  onApproveFile?: (fieldId: string) => void;
}) {
  function updateRow(row: KeyValueRow) {
    onChange(upsertRow(rows, row));
  }

  return (
    <section className="rows-panel" aria-label={title}>
      <header>
        <strong>{title}</strong>
        <button type="button" onClick={() => onChange([...rows, { id: `${title}-${rows.length + 1}`, name: "", value: "", enabled: true, ...(allowFiles ? { valueType: "text" as const } : {}) }])}>
          Add {title === "Headers" ? "Header" : title === "Form Fields" ? "Field" : "Param"}
        </button>
      </header>
      {rows.length ? rows.map((row, index) => {
        const fieldLabel = row.name || `field ${index + 1}`;
        return (
        <div className={allowFiles ? `kv-row form-field-row${row.valueType === "file" ? " file-form-field-row" : ""}` : "kv-row"} key={row.id}>
          <label><input aria-label={`${row.name || title} enabled`} type="checkbox" checked={row.enabled} onChange={(event) => updateRow({ ...row, enabled: event.target.checked })} /></label>
          <input aria-label={`${title} name`} value={row.name} placeholder="Name" onChange={(event) => updateRow({ ...row, name: event.target.value })} />
          {allowFiles ? (
            <select
              aria-label={`${title} ${fieldLabel} type`}
              value={row.valueType ?? "text"}
              onChange={(event) => {
                const valueType = event.target.value as "text" | "file";
                updateRow({ ...row, valueType, contentType: valueType === "file" ? row.contentType || "application/octet-stream" : undefined });
              }}
            >
              <option value="text">Text</option>
              <option value="file">File</option>
            </select>
          ) : null}
          <input aria-label={allowFiles ? `${title} ${fieldLabel} value` : `${title} value`} value={row.value} placeholder={row.valueType === "file" ? "Local file path" : "Value"} onChange={(event) => updateRow({ ...row, value: event.target.value })} />
          {allowFiles ? row.valueType === "file" ? (
            <>
              <input aria-label={`${title} ${fieldLabel} content type`} value={row.contentType ?? "application/octet-stream"} placeholder="Content type" onChange={(event) => updateRow({ ...row, contentType: event.target.value })} />
              <button
                type="button"
                className={isFileApproved?.(row.id) ? "file-approval approved" : "file-approval"}
                disabled={!row.enabled || !row.value.trim()}
                aria-label={`${isFileApproved?.(row.id) ? "Approved" : "Approve"} ${fieldLabel} file for this session`}
                onClick={() => onApproveFile?.(row.id)}
              >
                {isFileApproved?.(row.id) ? "Approved for session" : "Approve file"}
              </button>
            </>
          ) : <span className="form-content-type-spacer" aria-hidden="true" /> : null}
          <button type="button" onClick={() => onChange(removeRow(rows, row.id))}>Remove</button>
        </div>
      ); }) : <p className="empty-inline">No {title.toLowerCase()} configured.</p>}
    </section>
  );
}

function BodyPanel({
  service,
  requestUrl,
  multipartFileApprovals,
  onApproveMultipartFile,
  onUpdate
}: {
  service: ProjectService;
  requestUrl: string;
  multipartFileApprovals: MultipartFileApproval[];
  onApproveMultipartFile: (fieldId: string) => void;
  onUpdate: (patch: Partial<ProjectService>, message?: string) => void;
}) {
  const [formatError, setFormatError] = useState<string | null>(null);

  function updateBody(raw: string) {
    setFormatError(null);
    onUpdate({ body: { ...service.body, raw } }, "Request body updated.");
  }

  function transformBody(transform: (raw: string) => string) {
    try {
      updateBody(transform(service.body.raw));
    } catch {
      setFormatError("Body is not valid JSON.");
    }
  }

  return (
    <section className="body-editor" aria-label="JSON body editor">
      <header>
        <span>Request Body</span>
        <div>
          <select aria-label="Body content type" value={service.body.contentType} onChange={(event) => onUpdate({ body: { ...service.body, contentType: event.target.value as ProjectService["body"]["contentType"] } }, "Body content type updated.")}>
            <option value="none">No Body</option>
            <option value="application/json">JSON</option>
            <option value="text/plain">Text</option>
            <option value="application/x-www-form-urlencoded">Form URL Encoded</option>
            <option value="multipart/form-data">Multipart Form</option>
          </select>
          {service.body.contentType === "application/json" ? (
            <>
              <button type="button" onClick={() => transformBody(formatJsonBody)}>Beautify</button>
              <button type="button" onClick={() => transformBody(minifyJsonBody)}>Minify</button>
            </>
          ) : null}
        </div>
      </header>
      {["application/x-www-form-urlencoded", "multipart/form-data"].includes(service.body.contentType) ? (
        <>
          <p className="body-editor-note">Text fields are encoded at send time. Desktop file fields require approval for the exact local path and destination during each Relay Studio session; saved projects do not retain that authority.</p>
          <RowsPanel
            title="Form Fields"
            rows={service.body.fields ?? []}
            allowFiles={service.body.contentType === "multipart/form-data"}
            isFileApproved={(fieldId) => multipartFileApprovals.some((approval) => isMultipartFileApproved(approval, service, fieldId, requestUrl))}
            onApproveFile={onApproveMultipartFile}
            onChange={(fields) => onUpdate({ body: { ...service.body, fields } }, "Request form fields updated.")}
          />
        </>
      ) : (
        <textarea aria-label="Request body" value={service.body.raw} onChange={(event) => updateBody(event.target.value)} />
      )}
      {formatError ? <p className="field-error">{formatError}</p> : null}
    </section>
  );
}

function RetryPanel({ service, onUpdate }: { service: ProjectService; onUpdate: (patch: Partial<ProjectService>, message?: string) => void }) {
  return (
    <section className="retry-panel">
      <label>
        <span>Retry attempts</span>
        <input aria-label="Retry attempts" type="number" value={service.retry.attempts} onChange={(event) => onUpdate({ retry: { ...service.retry, attempts: Number(event.target.value) } }, "Retry attempts updated.")} />
      </label>
      <label>
        <span>Backoff ms</span>
        <input aria-label="Retry backoff ms" type="number" value={service.retry.backoffMs} onChange={(event) => onUpdate({ retry: { ...service.retry, backoffMs: Number(event.target.value) } }, "Retry backoff updated.")} />
      </label>
    </section>
  );
}

function SettingsPanel({ service, environment }: { service: ProjectService; environment: ProjectEnvironment }) {
  return (
    <section className="settings-panel">
      <dl>
        <dt>Environment</dt><dd>{environment.name}</dd>
        <dt>Timeout</dt><dd>{service.timeoutMs} ms</dd>
        <dt>Retry</dt><dd>{service.retry.attempts} attempt(s), {service.retry.backoffMs} ms backoff</dd>
      </dl>
    </section>
  );
}

function authLabel(mode: AuthMode): string {
  return {
    none: "No Auth",
    bearer: "Bearer Token",
    apiKey: "API Key",
    basic: "Basic Auth",
    oauthClientCredentials: "OAuth Client Credentials",
    customHeader: "Custom Header"
  }[mode];
}

function getProjectSettings(project: RelayProject): ProjectSettings {
  const savedSettings = project.settings as Partial<ProjectSettings> | undefined;
  const defaultEnvironmentId = savedSettings?.defaultEnvironmentId && project.environments.some((environment) => environment.id === savedSettings.defaultEnvironmentId)
    ? savedSettings.defaultEnvironmentId
    : project.environments[0]?.id ?? "";
  const defaults = createDefaultProjectSettings(defaultEnvironmentId);
  return {
    ...defaults,
    ...savedSettings,
    defaultEnvironmentId,
    requestTimeoutMs: boundedNumber(savedSettings?.requestTimeoutMs, 1, 300_000, defaults.requestTimeoutMs),
    maxResponseTimeMs: boundedNumber(savedSettings?.maxResponseTimeMs, 0, 300_000, defaults.maxResponseTimeMs),
    workingDirectory: savedSettings?.workingDirectory?.trim() || defaults.workingDirectory,
    proxy: {
      ...defaults.proxy,
      ...savedSettings?.proxy,
      port: boundedNumber(savedSettings?.proxy?.port, 1, 65_535, defaults.proxy.port)
    }
  };
}

function boundedNumber(value: unknown, min: number, max: number, fallback: number): number {
  const parsed = typeof value === "number" ? value : Number(value);
  if (!Number.isFinite(parsed)) return fallback;
  return Math.min(Math.max(Math.round(parsed), min), max);
}

function getDefaultEnvironmentName(project: RelayProject): string {
  const settings = getProjectSettings(project);
  return project.environments.find((environment) => environment.id === settings.defaultEnvironmentId)?.name
    ?? project.environments[0]?.name
    ?? "QA Environment";
}

function normalizeProjectForSave(project: RelayProject): RelayProject {
  return {
    ...project,
    settings: getProjectSettings(project),
    flows: project.flows.map((flow) => normalizeFlow(flow))
  };
}

interface FlowCanvasNodeData extends Record<string, unknown> {
  label: string;
  method: string;
  serviceName: string;
  missingRequest: boolean;
  status: string;
  cleanup: boolean;
  mappingCount: number;
  capturedVariables: string[];
  consumedVariables: string[];
}

type FlowCanvasNode = Node<FlowCanvasNodeData, "flowStep">;

const flowNodeTypes = {
  flowStep: FlowStepNode
};

const defaultFlowViewport: Viewport = { x: 0, y: 0, zoom: 1 };
const flowNodeWidth = 164;
const flowNodeHeight = 84;
const flowCanvasPadding = 36;
const flowDragThresholdPx = 3;

interface FlowCanvasDragState {
  nodeId: string;
  startPointer: FlowNodePosition;
  startPosition: FlowNodePosition;
}

function FlowBuilderEditor(props: {
  flow: ProjectFlow;
  flowDetailsOpen: boolean;
  services: ProjectService[];
  onAddFlowNode: (flowId: string, serviceId: string) => void;
  onDeleteFlowNode: (flowId: string, nodeId: string) => void;
  onConnectFlowNodes: (flowId: string, source: string, target: string, condition: "success" | "failure") => void;
  onConnectFlowNodeToService: (flowId: string, source: string, serviceId: string, condition: "success" | "failure") => void;
  onDisconnectFlowNodes: (flowId: string, source: string, target: string, condition: "success" | "failure") => void;
  onReorderFlowNode: (flowId: string, nodeId: string, direction: "left" | "right") => void;
  onMoveFlowNode: (flowId: string, nodeId: string, position: { x: number; y: number }) => void;
  onResetFlowLayout: (flowId: string) => void;
  onAddFlowMapping: (flowId: string, sourceNodeId: string, preset?: Partial<Omit<FlowMapping, "id" | "sourceNodeId">>) => void;
  onUpdateFlowMapping: (flowId: string, mappingId: string, patch: Partial<Omit<FlowMapping, "id">>) => void;
  onDeleteFlowMapping: (flowId: string, mappingId: string) => void;
  onApplyFlowTemplate: (flowId: string, templateId: FlowTemplateId) => void;
}) {
  const flow = normalizeFlow(props.flow);
  const templateOptions = FLOW_TEMPLATES.map((template) => ({
    template,
    missingRequestNames: flowTemplateRequiredServiceIds(template.id)
      .filter((serviceId) => !resolveFlowNodeService({ serviceId, label: requestIdToLabel(serviceId) }, props.services).service)
      .map(requestIdToLabel)
  }));
  const [selectedNodeId, setSelectedNodeId] = useState(flow.nodes[0]?.id ?? "");
  const [serviceId, setServiceId] = useState(props.services[0]?.id ?? "");
  const [branchTargetId, setBranchTargetId] = useState(flow.nodes[1]?.id ?? "");
  const [flowDetailsWidth, setFlowDetailsWidth] = useState(248);
  const [dragPositions, setDragPositions] = useState<Record<string, { x: number; y: number }>>({});
  const [flowViewport, setFlowViewport] = useState<Viewport>(defaultFlowViewport);
  const [flowCanvasSize, setFlowCanvasSize] = useState<FlowCanvasSize | null>(null);
  const [flowInteractive, setFlowInteractive] = useState(true);
  const [mappingDialogOpen, setMappingDialogOpen] = useState(false);
  const activeDraggedNodeId = useRef<string | null>(null);
  const previousSelectedNodeId = useRef(selectedNodeId);
  const dragState = useRef<FlowCanvasDragState | null>(null);
  const flowCanvasRef = useRef<HTMLDivElement | null>(null);
  const recoveredPositions = recoverVisibleFlowPositions(flow.nodes, flowCanvasSize);
  const flowCanvasKey = flow.id;
  const selectedNode = flow.nodes.find((node) => node.id === selectedNodeId) ?? flow.nodes[0];
  const selectedService = selectedNode ? resolveFlowNodeService(selectedNode, props.services).service : undefined;
  const missingRequestCount = flow.nodes.filter((node) => !resolveFlowNodeService(node, props.services).service).length;
  const selectedMappings = selectedNode ? flow.mappings.filter((mapping) => mapping.sourceNodeId === selectedNode.id) : [];
  const selectedConsumedVariables = flowConsumedVariables(selectedService);
  const selectedIsCleanupStep = isCleanupService(selectedService);
  const branchTargets = selectedNode ? flow.nodes.filter((node) => node.id !== selectedNode.id) : [];
  const unrepresentedTargetServices = useMemo(() => selectedNode ? props.services.filter((service) => (
    service.id !== selectedNode.serviceId && !flow.nodes.some((node) => node.serviceId === service.id)
  )) : [], [flow.nodes, props.services, selectedNode]);
  const branchTargetServiceId = branchTargetId.startsWith("service:") ? branchTargetId.slice("service:".length) : "";
  const branchTarget = branchTargetServiceId ? undefined : branchTargets.find((node) => node.id === branchTargetId) ?? branchTargets[0];
  const branchTargetService = branchTargetServiceId
    ? unrepresentedTargetServices.find((service) => service.id === branchTargetServiceId)
    : undefined;
  const selectedIndex = selectedNode ? flow.nodes.findIndex((node) => node.id === selectedNode.id) : -1;
  const successPathExists = Boolean(selectedNode && branchTarget && flow.edges.some((edge) => (
    edge.source === selectedNode.id && edge.target === branchTarget.id && edge.condition === "success"
  )));
  const failurePathExists = Boolean(selectedNode && branchTarget && flow.edges.some((edge) => (
    edge.source === selectedNode.id && edge.target === branchTarget.id && edge.condition === "failure"
  )));
  const nodes: FlowCanvasNode[] = flow.nodes.map((node) => {
    const service = resolveFlowNodeService(node, props.services).service;
    return {
      id: node.id,
      type: "flowStep",
      position: dragPositions[node.id] ?? recoveredPositions?.[node.id] ?? node.position,
      data: {
        label: node.label,
        method: service?.method ?? "GET",
        serviceName: service?.name ?? "Missing Request",
        missingRequest: !service,
        status: node.status,
        cleanup: isCleanupService(service),
        mappingCount: flow.mappings.filter((mapping) => mapping.sourceNodeId === node.id).length,
        capturedVariables: flow.mappings
          .filter((mapping) => mapping.sourceNodeId === node.id)
          .map((mapping) => mapping.variableName)
          .filter(Boolean),
        consumedVariables: flowConsumedVariables(service)
      }
    };
  });
  const edges: Edge[] = flow.edges.map((edge) => ({
    id: edge.id,
    source: edge.source,
    target: edge.target,
    label: edge.condition === "success" ? "Success" : "Failure",
    animated: edge.condition === "success",
    markerEnd: { type: MarkerType.ArrowClosed },
    style: {
      stroke: edge.condition === "success" ? "#1f9d55" : "#cf2e2e",
      strokeWidth: 2
    },
    labelStyle: {
      fill: edge.condition === "success" ? "#1f9d55" : "#cf2e2e",
      fontWeight: 800
    }
  }));
  const flowCanvasWorldSize = scrollWorldSizeForNodes(nodes, flowCanvasSize, {
    viewport: flowViewport,
    nodeWidth: flowNodeWidth,
    nodeHeight: flowNodeHeight,
    padding: flowCanvasPadding
  });

  function connect(connection: Connection) {
    if (!connection.source || !connection.target) return;
    props.onConnectFlowNodes(flow.id, connection.source, connection.target, "success");
  }

  function handleNodeChanges(changes: NodeChange<FlowCanvasNode>[]) {
    const nextDragPositions = nextActiveDragPositions(activeDraggedNodeId.current, changes);
    if (nextDragPositions) setDragPositions(nextDragPositions);
  }

  function startCanvasNodeDrag(event: ReactPointerEvent<HTMLButtonElement>, node: FlowCanvasNode) {
    if (event.button !== 0 || !flowInteractive) return;
    event.preventDefault();
    event.currentTarget.setPointerCapture(event.pointerId);
    activeDraggedNodeId.current = node.id;
    dragState.current = {
      nodeId: node.id,
      startPointer: { x: event.clientX, y: event.clientY },
      startPosition: node.position
    };
    setSelectedNodeId(node.id);
  }

  function moveCanvasNode(event: ReactPointerEvent<HTMLButtonElement>) {
    const currentDrag = dragState.current;
    if (!currentDrag) return;
    const position = {
      x: currentDrag.startPosition.x + (event.clientX - currentDrag.startPointer.x) / flowViewport.zoom,
      y: currentDrag.startPosition.y + (event.clientY - currentDrag.startPointer.y) / flowViewport.zoom
    };
    setDragPositions({ [currentDrag.nodeId]: position });
  }

  function stopCanvasNodeDrag(event: ReactPointerEvent<HTMLButtonElement>) {
    const currentDrag = dragState.current;
    if (!currentDrag) return;
    event.currentTarget.releasePointerCapture(event.pointerId);
    const pointerDelta = Math.hypot(
      event.clientX - currentDrag.startPointer.x,
      event.clientY - currentDrag.startPointer.y
    );
    const position = {
      x: currentDrag.startPosition.x + (event.clientX - currentDrag.startPointer.x) / flowViewport.zoom,
      y: currentDrag.startPosition.y + (event.clientY - currentDrag.startPointer.y) / flowViewport.zoom
    };
    activeDraggedNodeId.current = null;
    dragState.current = null;
    setDragPositions({});
    if (pointerDelta >= flowDragThresholdPx && !positionsEqual(currentDrag.startPosition, position)) {
      props.onMoveFlowNode(flow.id, currentDrag.nodeId, position);
    }
  }

  function zoomFlow(direction: "in" | "out") {
    setFlowViewport((current) => {
      const nextZoom = clamp(current.zoom * (direction === "in" ? 1.15 : 0.85), 0.35, 1.8);
      return centerFlowViewportForNodes(nodes, flowCanvasSize, nextZoom, {
        nodeWidth: flowNodeWidth,
        nodeHeight: flowNodeHeight,
        padding: flowCanvasPadding
      });
    });
  }

  function fitFlowToView() {
    if (!flowCanvasSize || !nodes.length) {
      setFlowViewport(defaultFlowViewport);
      return;
    }
    const minX = Math.min(...nodes.map((node) => node.position.x));
    const minY = Math.min(...nodes.map((node) => node.position.y));
    const maxX = Math.max(...nodes.map((node) => node.position.x + flowNodeWidth));
    const maxY = Math.max(...nodes.map((node) => node.position.y + flowNodeHeight));
    const availableWidth = Math.max(1, flowCanvasSize.width - flowCanvasPadding * 2);
    const availableHeight = Math.max(1, flowCanvasSize.height - flowCanvasPadding * 2);
    const nextZoom = clamp(Math.min(
      availableWidth / Math.max(1, maxX - minX),
      availableHeight / Math.max(1, maxY - minY),
      1
    ), 0.35, 1.2);
    setFlowViewport(centerFlowViewportForNodes(nodes, flowCanvasSize, nextZoom, {
      nodeWidth: flowNodeWidth,
      nodeHeight: flowNodeHeight,
      padding: flowCanvasPadding
    }));
  }

  function defaultFlowViewportForCurrentCanvas() {
    if (!flowCanvasSize || !nodes.length) return defaultFlowViewport;
    return centerFlowViewportForNodes(nodes, flowCanvasSize, 1, {
      nodeWidth: flowNodeWidth,
      nodeHeight: flowNodeHeight,
      padding: flowCanvasPadding
    });
  }

  useEffect(() => {
    if (!flow.nodes.some((node) => node.id === selectedNodeId)) {
      setSelectedNodeId(flow.nodes[0]?.id ?? "");
    }
  }, [flow.nodes, selectedNodeId]);

  useEffect(() => {
    setFlowViewport(defaultFlowViewportForCurrentCanvas());
    if (flowCanvasRef.current) {
      flowCanvasRef.current.scrollLeft = 0;
      flowCanvasRef.current.scrollTop = 0;
    }
  }, [flow.id]);

  useEffect(() => {
    const element = flowCanvasRef.current;
    if (!element || typeof ResizeObserver === "undefined") return undefined;
    const observer = new ResizeObserver((entries) => {
      const entry = entries[0];
      if (!entry) return;
      const width = Math.floor(entry.contentRect.width);
      const height = Math.floor(entry.contentRect.height);
      if (width < 120 || height < 120) return;
      setFlowCanvasSize((current) => (
        current?.width === width && current.height === height ? current : { width, height }
      ));
    });
    observer.observe(element);
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    if (!selectedNode) return;
    const selectionChanged = previousSelectedNodeId.current !== selectedNode.id;
    previousSelectedNodeId.current = selectedNode.id;
    const currentServiceTarget = branchTargetId.startsWith("service:")
      ? unrepresentedTargetServices.find((service) => service.id === branchTargetId.slice("service:".length))
      : undefined;
    const connectedTargetId = flow.edges.find((edge) => edge.source === selectedNode.id && edge.condition === "success")?.target
      ?? flow.edges.find((edge) => edge.source === selectedNode.id)?.target;
    const nextTarget = (selectionChanged ? flow.nodes.find((node) => node.id === connectedTargetId) : undefined)
      ?? flow.nodes.find((node) => node.id !== selectedNode.id && node.id === branchTargetId)
      ?? flow.nodes[selectedIndex + 1]
      ?? flow.nodes.find((node) => node.id !== selectedNode.id);
    setBranchTargetId(!selectionChanged && currentServiceTarget ? branchTargetId : nextTarget?.id ?? (unrepresentedTargetServices[0] ? `service:${unrepresentedTargetServices[0].id}` : ""));
  }, [branchTargetId, flow.edges, flow.nodes, selectedIndex, selectedNode, unrepresentedTargetServices]);

  return (
    <section className="editor-surface flow-builder" aria-label="Flow builder">
      <div className="flow-toolbar">
        <div>
          <strong>{flow.name}</strong>
          <span>{flow.nodes.length} steps - {flow.edges.length} links</span>
          {missingRequestCount ? <span className="flow-warning">{missingRequestCount} missing request{missingRequestCount === 1 ? "" : "s"}</span> : null}
        </div>
        <label>
          <span>Add request step</span>
          <select value={serviceId} onChange={(event) => setServiceId(event.target.value)}>
            {props.services.map((service) => <option value={service.id} key={service.id}>{service.name}</option>)}
          </select>
        </label>
        <div className="flow-toolbar-actions" aria-label="Flow editing actions">
          <button type="button" className="flow-icon-button" aria-label="Add Step" title="Add Step" onClick={() => props.onAddFlowNode(flow.id, serviceId)}>
            <Plus size={15} />
          </button>
          <button type="button" className="flow-icon-button" aria-label="Move Left" title="Move Left" disabled={!selectedNode || selectedIndex <= 0} onClick={() => selectedNode && props.onReorderFlowNode(flow.id, selectedNode.id, "left")}>
            <ArrowLeft size={15} />
          </button>
          <button type="button" className="flow-icon-button" aria-label="Move Right" title="Move Right" disabled={!selectedNode || selectedIndex >= flow.nodes.length - 1} onClick={() => selectedNode && props.onReorderFlowNode(flow.id, selectedNode.id, "right")}>
            <ArrowRight size={15} />
          </button>
          <button type="button" className="flow-icon-button" aria-label="Reset Layout" title="Reset Layout" onClick={() => props.onResetFlowLayout(flow.id)}>
            <RotateCcw size={15} />
          </button>
          <button type="button" className="flow-icon-button danger" aria-label="Delete Step" title="Delete Step" disabled={!selectedNode} onClick={() => selectedNode && props.onDeleteFlowNode(flow.id, selectedNode.id)}>
            <Trash2 size={15} />
          </button>
        </div>
      </div>
      <div
        className={props.flowDetailsOpen ? "flow-main" : "flow-main flow-details-hidden"}
        style={{ "--flow-details-width": `${flowDetailsWidth}px` } as CSSProperties}
      >
        {!flow.nodes.length ? (
          <div className="flow-template-panel" aria-label="Flow templates">
            <strong>Start with a flow template</strong>
            <p>Choose a common REST chain, then adjust the steps and mappings.</p>
            <div className="flow-template-actions">
              {templateOptions.map(({ template, missingRequestNames }) => (
                <button
                  type="button"
                  key={template.id}
                  disabled={missingRequestNames.length > 0}
                  onClick={() => props.onApplyFlowTemplate(flow.id, template.id)}
                >
                  <span>{template.name}</span>
                  <small>{template.description}</small>
                  {missingRequestNames.length ? (
                    <small className="template-missing-requests">
                      Requires missing requests: {missingRequestNames.join(", ")}
                    </small>
                  ) : null}
                </button>
              ))}
            </div>
          </div>
        ) : null}
        <div className="flow-canvas-shell" ref={flowCanvasRef} aria-label="Flow canvas">
          <div
            className="flow-canvas-scroll-world"
            style={{
              width: `${flowCanvasWorldSize.width}px`,
              height: `${flowCanvasWorldSize.height}px`
            }}
          >
            <ReactFlow
              key={flowCanvasKey}
              nodes={nodes}
              edges={edges}
              nodeTypes={flowNodeTypes}
              viewport={flowViewport}
              width={flowCanvasWorldSize.width}
              height={flowCanvasWorldSize.height}
              autoPanOnNodeDrag={false}
              panOnDrag={false}
              panOnScroll={false}
              preventScrolling={false}
              onConnect={connect}
              onNodesChange={handleNodeChanges}
              onNodeClick={(_event, node) => setSelectedNodeId(node.id)}
              onNodeDragStart={(_event, node) => {
                setFlowViewport(defaultFlowViewportForCurrentCanvas());
                activeDraggedNodeId.current = node.id;
                setSelectedNodeId(node.id);
              }}
              onNodeDragStop={(_event, node) => {
                activeDraggedNodeId.current = null;
                setFlowViewport(defaultFlowViewportForCurrentCanvas());
                setDragPositions({});
                const original = flow.nodes.find((currentNode) => currentNode.id === node.id)?.position;
                if (original && !positionsEqual(original, node.position)) {
                  props.onMoveFlowNode(flow.id, node.id, node.position);
                }
              }}
            >
              <Background />
            </ReactFlow>
            <FlowRenderLayer
              nodes={nodes}
              edges={edges}
              selectedNodeId={selectedNode?.id ?? ""}
              viewport={flowViewport}
              interactive={flowInteractive}
              onNodeSelect={setSelectedNodeId}
              onNodePointerDown={startCanvasNodeDrag}
              onNodePointerMove={moveCanvasNode}
              onNodePointerUp={stopCanvasNodeDrag}
            />
          </div>
          <div className="flow-control-panel" aria-label="Control Panel">
            <button type="button" aria-label="Zoom In" title="Zoom In" onClick={() => zoomFlow("in")}><Plus size={17} /></button>
            <button type="button" aria-label="Zoom Out" title="Zoom Out" onClick={() => zoomFlow("out")}>-</button>
            <button type="button" aria-label="Fit View" title="Fit View" onClick={fitFlowToView}>[]</button>
            <button
              type="button"
              aria-label={flowInteractive ? "Lock Flow Layout" : "Unlock Flow Layout"}
              aria-pressed={!flowInteractive}
              title={flowInteractive ? "Lock Flow Layout" : "Unlock Flow Layout"}
              onClick={() => setFlowInteractive((current) => !current)}
            >
              {flowInteractive ? "Lock" : "Unlock"}
            </button>
          </div>
        </div>
        {props.flowDetailsOpen ? (
          <ResizeHandle
            ariaLabel="Resize flow details"
            orientation="vertical"
            onResize={(delta) => setFlowDetailsWidth((current) => clamp(current - delta, 210, 390))}
          />
        ) : null}
        {props.flowDetailsOpen ? <aside className="flow-side-panel" aria-label="Flow step details">
          <h2>Step Details</h2>
          {selectedNode ? (
            <>
              <dl>
                <dt>Step</dt><dd>{selectedNode.label}</dd>
                <dt>Request</dt><dd>{selectedService?.name ?? "Missing Request"}</dd>
                <dt>Status</dt><dd className={`flow-status-text ${selectedNode.status}`}>{selectedNode.status}</dd>
                <dt>Order</dt><dd aria-label="Step order">{flow.nodes.findIndex((node) => node.id === selectedNode.id) + 1}</dd>
                {selectedIsCleanupStep ? <><dt>Role</dt><dd>Cleanup</dd></> : null}
              </dl>
              <section className="flow-variable-summary" aria-label="Flow variable summary">
                <div>
                  <strong>Captures</strong>
                  {selectedMappings.length ? (
                    <div className="flow-chip-list">
                      {selectedMappings.map((mapping) => (
                        <span className={`flow-chip ${mapping.secret ? "secret" : ""}`} key={mapping.id}>
                          {mapping.variableName || "Unnamed"} <small>{mapping.jsonPath}</small>
                        </span>
                      ))}
                    </div>
                  ) : <p className="empty-inline">No variables captured.</p>}
                </div>
                <div>
                  <strong>Consumes</strong>
                  {selectedConsumedVariables.length ? (
                    <div className="flow-chip-list">
                      {selectedConsumedVariables.map((name) => <span className="flow-chip" key={name}>{name}</span>)}
                    </div>
                  ) : <p className="empty-inline">No variables used.</p>}
                </div>
              </section>
              <label className="flow-branch-target">
                <span>Path target</span>
                <select value={branchTargetService ? `service:${branchTargetService.id}` : branchTarget?.id ?? ""} onChange={(event) => setBranchTargetId(event.target.value)} disabled={!branchTargets.length && !unrepresentedTargetServices.length}>
                  {branchTargets.map((node) => (
                    <option value={node.id} key={node.id}>{node.label}</option>
                  ))}
                  {unrepresentedTargetServices.map((service) => (
                    <option value={`service:${service.id}`} key={`service:${service.id}`}>{service.name} (add step)</option>
                  ))}
                </select>
              </label>
              <section className="flow-paths-panel" aria-label="Flow paths">
                <header><strong>Paths</strong></header>
                <div className="flow-path-row success">
                  <span>Success</span>
                  <em>{successPathExists && branchTarget ? branchTarget.label : "No target"}</em>
                  <button
                    type="button"
                    className={successPathExists ? "flow-path-icon remove" : "flow-path-icon success"}
                    aria-label={successPathExists ? "Remove Success Path" : "Add Success Path"}
                    title={successPathExists ? "Remove Success Path" : "Add Success Path"}
                    disabled={!branchTarget && !branchTargetService}
                    onClick={() => {
                      if (branchTargetService) {
                        props.onConnectFlowNodeToService(flow.id, selectedNode.id, branchTargetService.id, "success");
                        return;
                      }
                      if (!branchTarget) return;
                      if (successPathExists) {
                        props.onDisconnectFlowNodes(flow.id, selectedNode.id, branchTarget.id, "success");
                      } else {
                        props.onConnectFlowNodes(flow.id, selectedNode.id, branchTarget.id, "success");
                      }
                    }}
                  >
                    {successPathExists ? <Unlink2 size={14} /> : <Plus size={14} />}
                  </button>
                </div>
                <div className="flow-path-row failure">
                  <span>Failure</span>
                  <em>{failurePathExists && branchTarget ? branchTarget.label : "No target"}</em>
                  <button
                    type="button"
                    className={failurePathExists ? "flow-path-icon remove" : "flow-path-icon failure"}
                    aria-label={failurePathExists ? "Remove Failure Path" : "Add Failure Path"}
                    title={failurePathExists ? "Remove Failure Path" : "Add Failure Path"}
                    disabled={!branchTarget && !branchTargetService}
                    onClick={() => {
                      if (branchTargetService) {
                        props.onConnectFlowNodeToService(flow.id, selectedNode.id, branchTargetService.id, "failure");
                        return;
                      }
                      if (!branchTarget) return;
                      if (failurePathExists) {
                        props.onDisconnectFlowNodes(flow.id, selectedNode.id, branchTarget.id, "failure");
                      } else {
                        props.onConnectFlowNodes(flow.id, selectedNode.id, branchTarget.id, "failure");
                      }
                    }}
                  >
                    {failurePathExists ? <Unlink2 size={14} /> : <Plus size={14} />}
                  </button>
                </div>
              </section>
              <section className="flow-mapping-panel" aria-label="Response mappings">
                <header>
                  <strong>Response Mappings</strong>
                  <button type="button" className="flow-action-button compact" aria-label="Manage Response Mappings" title="Manage Response Mappings" onClick={() => setMappingDialogOpen(true)}>
                    Manage
                  </button>
                </header>
                <p className="flow-mapping-summary">
                  {selectedMappings.length
                    ? `${selectedMappings.length} mapping${selectedMappings.length === 1 ? "" : "s"} configured.`
                    : "No response mappings configured."}
                </p>
                {selectedMappings.length ? (
                  <div className="flow-chip-list" aria-label="Configured mappings">
                    {selectedMappings.slice(0, 3).map((mapping) => (
                      <span className={`flow-chip ${mapping.secret ? "secret" : ""}`} key={mapping.id}>
                        {mapping.variableName || "Unnamed"} <small>{mapping.jsonPath}</small>
                      </span>
                    ))}
                    {selectedMappings.length > 3 ? <span className="flow-chip">+{selectedMappings.length - 3} more</span> : null}
                  </div>
                ) : null}
              </section>
            </>
          ) : (
            <p>No step selected.</p>
          )}
        </aside> : null}
      </div>
      {mappingDialogOpen && selectedNode ? (
        <FlowMappingsDialog
          flow={flow}
          node={selectedNode}
          mappings={selectedMappings}
          onClose={() => setMappingDialogOpen(false)}
          onAddMapping={(preset) => props.onAddFlowMapping(flow.id, selectedNode.id, preset)}
          onUpdateMapping={(mappingId, patch) => props.onUpdateFlowMapping(flow.id, mappingId, patch)}
          onDeleteMapping={(mappingId) => props.onDeleteFlowMapping(flow.id, mappingId)}
        />
      ) : null}
    </section>
  );
}

function FlowMappingsDialog({
  flow,
  node,
  mappings,
  onClose,
  onAddMapping,
  onUpdateMapping,
  onDeleteMapping
}: {
  flow: ProjectFlow;
  node: ProjectFlow["nodes"][number];
  mappings: FlowMapping[];
  onClose: () => void;
  onAddMapping: (preset?: Partial<Omit<FlowMapping, "id" | "sourceNodeId">>) => void;
  onUpdateMapping: (mappingId: string, patch: Partial<Omit<FlowMapping, "id">>) => void;
  onDeleteMapping: (mappingId: string) => void;
}) {
  const closeButtonRef = useRef<HTMLButtonElement | null>(null);
  const dialogRef = useModalBehavior(onClose, { initialFocusRef: closeButtonRef });

  return (
    <div className="modal-backdrop" role="presentation">
      <section ref={dialogRef} className="project-file-dialog flow-mappings-dialog" role="dialog" aria-modal="true" aria-label="Response Mappings">
        <header>
          <div>
            <strong>Response Mappings</strong>
            <span>{flow.name} / {node.label}</span>
          </div>
          <button ref={closeButtonRef} type="button" aria-label="Close response mappings dialog" onClick={onClose}><X size={17} /></button>
        </header>
        <div className="flow-mappings-dialog-body">
          <div className="flow-mappings-dialog-toolbar" aria-label="Mapping actions">
            <button type="button" className="flow-action-button compact" onClick={() => onAddMapping()}>
              <Plus size={14} />
              <span>Add Mapping</span>
            </button>
          </div>
          <section className="jsonpath-help" aria-label="JSONPath examples">
            <div>
              <strong>JSONPath</strong>
              <p>Use JSONPath to pick a value from this step's JSON response and save it as a variable for later steps.</p>
            </div>
            <dl>
              <dt><code>$.accessToken</code></dt>
              <dd>Top-level field named accessToken.</dd>
              <dt><code>$.user.id</code></dt>
              <dd>Nested field inside user.</dd>
              <dt><code>$.items[0].id</code></dt>
              <dd>First item in an array.</dd>
              <dt><code>$.items[*].sku</code></dt>
              <dd>All sku values from an array.</dd>
            </dl>
          </section>
          {mappings.length ? (
            <div className="flow-mappings-table" role="table" aria-label="Response mapping table">
              <div role="row" className="flow-mappings-table-header">
                <span role="columnheader">Variable</span>
                <span role="columnheader">JSONPath</span>
                <span role="columnheader">Secret</span>
                <span role="columnheader">Actions</span>
              </div>
              {mappings.map((mapping, index) => (
                <div role="row" className="flow-mappings-table-row" key={mapping.id}>
                  <label>
                    <span>Variable</span>
                    <input
                      aria-label={`Mapping ${index + 1} variable`}
                      value={mapping.variableName}
                      onChange={(event) => onUpdateMapping(mapping.id, { variableName: event.target.value })}
                    />
                  </label>
                  <label>
                    <span>JSONPath</span>
                    <input
                      aria-label={`Mapping ${index + 1} JSONPath`}
                      value={mapping.jsonPath}
                      onChange={(event) => onUpdateMapping(mapping.id, { jsonPath: event.target.value })}
                    />
                  </label>
                  <label className="flow-mapping-secret compact">
                    <input
                      aria-label={`Mapping ${index + 1} secret`}
                      type="checkbox"
                      checked={mapping.secret}
                      onChange={(event) => onUpdateMapping(mapping.id, { secret: event.target.checked })}
                    />
                    <span>Secret</span>
                  </label>
                  <button type="button" className="flow-icon-button danger small" aria-label={`Delete mapping ${index + 1}`} onClick={() => onDeleteMapping(mapping.id)}>
                    <Trash2 size={14} />
                  </button>
                </div>
              ))}
            </div>
          ) : (
            <p className="empty-inline">No response mappings for this step.</p>
          )}
        </div>
        <footer>
          <button type="button" className="primary-command" onClick={onClose}>Done</button>
        </footer>
      </section>
    </div>
  );
}

function FlowStepNode({ data }: NodeProps<FlowCanvasNode>) {
  return <FlowNodeCard data={data} showHandles />;
}

function FlowNodeCard({ data, showHandles = false }: { data: FlowCanvasNodeData; showHandles?: boolean }) {
  return (
    <div className={`flow-node-card ${data.status} ${data.cleanup ? "cleanup" : ""} ${data.missingRequest ? "missing-request" : ""}`}>
      {showHandles ? <Handle type="target" position={Position.Left} /> : null}
      <span className={`method method-${data.method.toLowerCase()}`}>{data.method}</span>
      <strong>{data.label}</strong>
      <em>{data.serviceName}</em>
      <div className="node-badges">
        {data.missingRequest ? <small>missing request</small> : null}
        {data.cleanup ? <small>cleanup</small> : null}
        {data.capturedVariables.slice(0, 2).map((name) => <small key={name}>captures {name}</small>)}
        {data.mappingCount > data.capturedVariables.length ? <small>{data.mappingCount} capture{data.mappingCount === 1 ? "" : "s"}</small> : null}
        {data.consumedVariables.length ? <small>{data.consumedVariables.length} variable{data.consumedVariables.length === 1 ? "" : "s"}</small> : null}
        {!data.cleanup && !data.mappingCount && !data.consumedVariables.length ? <small>{data.status}</small> : null}
      </div>
      {showHandles ? <Handle type="source" position={Position.Right} /> : null}
    </div>
  );
}

function FlowRenderLayer({
  nodes,
  edges,
  selectedNodeId,
  viewport,
  interactive,
  onNodeSelect,
  onNodePointerDown,
  onNodePointerMove,
  onNodePointerUp
}: {
  nodes: FlowCanvasNode[];
  edges: Edge[];
  selectedNodeId: string;
  viewport: Viewport;
  interactive: boolean;
  onNodeSelect: (nodeId: string) => void;
  onNodePointerDown: (event: ReactPointerEvent<HTMLButtonElement>, node: FlowCanvasNode) => void;
  onNodePointerMove: (event: ReactPointerEvent<HTMLButtonElement>) => void;
  onNodePointerUp: (event: ReactPointerEvent<HTMLButtonElement>) => void;
}) {
  const nodesById = new Map(nodes.map((node) => [node.id, node]));

  return (
    <div
      className="flow-render-layer"
      aria-label="Rendered flow diagram"
    >
      <div
        className="flow-render-world"
        style={{
          transform: `translate(${viewport.x}px, ${viewport.y}px) scale(${viewport.zoom})`
        }}
      >
        <svg className="flow-route-layer">
          {edges.map((edge) => {
            const source = nodesById.get(edge.source);
            const target = nodesById.get(edge.target);
            if (!source || !target) return null;
            const sourceX = source.position.x + flowNodeWidth;
            const sourceY = source.position.y + flowNodeHeight / 2;
            const targetX = target.position.x;
            const targetY = target.position.y + flowNodeHeight / 2;
            const midpoint = Math.max(36, (targetX - sourceX) / 2);
            const path = `M ${sourceX} ${sourceY} C ${sourceX + midpoint} ${sourceY}, ${targetX - midpoint} ${targetY}, ${targetX} ${targetY}`;
            return (
              <g className={`flow-route ${edge.label === "Failure" ? "failure" : "success"}`} key={edge.id}>
                <path d={path} />
                <text x={(sourceX + targetX) / 2} y={(sourceY + targetY) / 2 - 8}>{edge.label}</text>
              </g>
            );
          })}
        </svg>
        {nodes.map((node) => (
          <button
            type="button"
            className={node.id === selectedNodeId ? "flow-render-node selected" : "flow-render-node"}
            aria-label={`Flow step ${node.data.label}`}
            data-testid={`flow-render-node-${node.id}`}
            aria-disabled={!interactive}
            onClick={() => onNodeSelect(node.id)}
            key={node.id}
            onPointerDown={(event) => onNodePointerDown(event, node)}
            onPointerMove={onNodePointerMove}
            onPointerUp={onNodePointerUp}
            onPointerCancel={onNodePointerUp}
            style={{
              transform: `translate(${node.position.x}px, ${node.position.y}px)`
            }}
          >
            <FlowNodeCard data={node.data} />
          </button>
        ))}
      </div>
    </div>
  );
}

function flowConsumedVariables(service?: ProjectService): string[] {
  if (!service) return [];
  const values = [
    service.path,
    ...service.headers.map((row) => row.value),
    ...service.queryParams.map((row) => row.value),
    ...service.pathParams.map((row) => row.value),
    service.body.raw
  ];
  const references = values.flatMap((value) => findVariableReferences(value));
  const auth = service.authProfile;

  if (auth.type === "bearer" && auth.tokenVariable) references.push(auth.tokenVariable);
  if (auth.type === "apiKey" && auth.apiKeyValue) references.push(...findVariableReferences(auth.apiKeyValue));
  if (auth.type === "basic") {
    if (auth.usernameVariable) references.push(auth.usernameVariable);
    if (auth.passwordVariable) references.push(auth.passwordVariable);
  }
  if (auth.type === "oauthClientCredentials") {
    if (auth.tokenUrl) references.push(...findVariableReferences(auth.tokenUrl));
    if (auth.clientIdVariable) references.push(auth.clientIdVariable);
    if (auth.clientSecretVariable) references.push(auth.clientSecretVariable);
  }
  if (auth.type === "customHeader" && auth.customHeaderValue) {
    references.push(...findVariableReferences(auth.customHeaderValue));
  }

  return references
    .map((name) => name.trim())
    .filter(Boolean)
    .filter((name, index, names) => names.indexOf(name) === index);
}

function isCleanupService(service?: ProjectService): boolean {
  if (!service) return false;
  const searchable = `${service.id} ${service.name}`.toLowerCase();
  return service.method === "DELETE"
    || searchable.includes("cleanup")
    || searchable.includes("delete")
    || searchable.includes("cancel");
}

function flowTemplateRequiredServiceIds(templateId: FlowTemplateId): string[] {
  if (templateId === "authenticated-read") {
    return ["login", "current-user", "list-products"];
  }
  return ["login", "create-order", "get-order", "cleanup-order"];
}

function requestIdToLabel(serviceId: string): string {
  return serviceId
    .split("-")
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

function WelcomeView() {
  return (
    <section className="welcome-view" aria-label="Welcome overview">
      <div>
        <h1>Welcome to Relay Studio</h1>
        <p>
          Relay Studio is a desktop REST workspace for designing requests, managing environment variables,
          saving response evidence, and building multi-step API flows.
        </p>
        <p>
          Use the explorer to open or create requests, then promote repeatable chains into flows when one
          request needs data captured from another.
        </p>
        <p>
          Projects are saved as local <code>.restproj</code> files so demos and test workspaces can move
          between machines without requiring a hosted backend.
        </p>
      </div>
    </section>
  );
}

function ImportApiView({ onImportServices }: { onImportServices: (parsed: ParsedOpenApi, selectedIds: string[], saveAfterImport: boolean) => void }) {
  const [url, setUrl] = useState("");
  const [parsed, setParsed] = useState<ParsedOpenApi | null>(null);
  const [discovery, setDiscovery] = useState<SwaggerUiDefinitionDiscovery | null>(null);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function inspectDefinition() {
    setLoading(true);
    setError("");
    setParsed(null);
    setDiscovery(null);
    try {
      const result = await inspectOpenApiUrl(url);
      if (result.kind === "swagger-ui") {
        setDiscovery(result);
        setSelectedIds([]);
      } else {
        setParsed(result.parsed);
        setSelectedIds(result.parsed.operations.map((operation) => operation.id));
      }
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : String(reason));
    } finally {
      setLoading(false);
    }
  }

  async function loadDiscoveredDefinition() {
    if (!discovery) return;
    setLoading(true);
    setError("");
    try {
      const result = await loadDiscoveredOpenApiDefinition(discovery);
      setParsed(result);
      setSelectedIds(result.operations.map((operation) => operation.id));
      setDiscovery(null);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : String(reason));
    } finally {
      setLoading(false);
    }
  }

  function changeUrl(value: string) {
    setUrl(value);
    setParsed(null);
    setDiscovery(null);
    setSelectedIds([]);
    setError("");
  }

  function addSelected(saveAfterImport: boolean) {
    if (!parsed || !selectedIds.length) {
      setError("Select at least one REST service to add.");
      return;
    }
    try {
      onImportServices(parsed, selectedIds, saveAfterImport);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : String(reason));
    }
  }

  return (
    <section className="api-import-view" aria-label="Import API definition">
      <header>
        <h1>Import Swagger / OpenAPI</h1>
        <p>Enter a Swagger UI page or direct OpenAPI JSON/YAML URL. Inspect first, then choose exactly which REST services to add.</p>
      </header>
      <div className="api-import-source">
        <label htmlFor="api-definition-url">Swagger UI or definition URL</label>
        <div>
          <input id="api-definition-url" value={url} onChange={(event) => changeUrl(event.target.value)} placeholder="https://api.example.com/swagger/index.html" />
          <button type="button" className="primary-button" disabled={loading || !url.trim()} onClick={() => void inspectDefinition()}>{loading ? "Inspecting…" : "Inspect Definition"}</button>
        </div>
      </div>
      {error ? <div className="api-import-error" role="alert">{error}</div> : null}
      {discovery ? (
        <section className="api-import-destination-review" aria-label="Swagger UI definition destination review">
          <div>
            <strong>Review discovered definition destination</strong>
            <p>Relay Studio inspected the Swagger UI page but has not requested its definition yet.</p>
          </div>
          <dl>
            <dt>Swagger UI page</dt><dd><code>{discovery.pageUrl}</code></dd>
            <dt>Definition destination</dt><dd><code>{discovery.definitionUrl}</code></dd>
          </dl>
          {new URL(discovery.pageUrl).origin !== new URL(discovery.definitionUrl).origin ? (
            <p className="api-import-destination-warning">The definition uses a different origin. Load it only if you recognize and trust this destination.</p>
          ) : null}
          <div className="api-import-destination-actions">
            <button type="button" className="primary-button" disabled={loading} onClick={() => void loadDiscoveredDefinition()}>{loading ? "Loading…" : "Load Discovered Definition"}</button>
            <button type="button" disabled={loading} onClick={() => setDiscovery(null)}>Cancel</button>
          </div>
        </section>
      ) : null}
      {parsed ? (
        <div className="api-import-results">
          <div className="api-import-summary">
            <div><strong>{parsed.title}</strong><span>OpenAPI {parsed.version}</span></div>
            <code>{parsed.serverUrl}</code>
          </div>
          <div className="api-import-review" aria-label="Import review summary">
            <span>{parsed.review.operationCount} operations</span>
            <span>{parsed.review.externalDocumentCount} external documents</span>
            <span>{parsed.review.formBodyCount} form bodies</span>
            <span>{parsed.review.deprecatedCount} deprecated</span>
          </div>
          <div className="api-import-actions">
            <span>{selectedIds.length} of {parsed.operations.length} selected</span>
            <button type="button" title="Select every discovered REST operation." onClick={() => setSelectedIds(parsed.operations.map((operation) => operation.id))}>Select All</button>
            <button type="button" title="Clear all selected REST operations." onClick={() => setSelectedIds([])}>Clear</button>
            <button type="button" title="Add selected REST operations to the current project without saving it yet." disabled={!selectedIds.length} onClick={() => addSelected(false)}>Add {selectedIds.length} Selected</button>
            <button type="button" className="primary-button" title="Add selected REST operations to the current project and open the Save Project dialog." disabled={!selectedIds.length} onClick={() => addSelected(true)}>Add and Save {selectedIds.length} Selected</button>
          </div>
          <div className="api-operation-list" aria-label="Discovered REST services">
            {parsed.operations.map((operation) => (
              <label key={operation.id} className={operation.deprecated ? "deprecated" : ""}>
                <input type="checkbox" checked={selectedIds.includes(operation.id)} onChange={(event) => setSelectedIds((current) => event.target.checked ? [...current, operation.id] : current.filter((id) => id !== operation.id))} />
                <span className={`method-badge method-${operation.method.toLowerCase()}`}>{operation.method}</span>
                <span><strong>{operation.label}</strong><code>{operation.path}</code></span>
                <small>{operation.tag}{operation.deprecated ? " · Deprecated" : ""}</small>
              </label>
            ))}
          </div>
        </div>
      ) : null}
    </section>
  );
}

function HelpView() {
  return (
    <article className="help-view" aria-label="Relay Studio help">
      <header>
        <h1>{helpDocument.title}</h1>
        <p>{helpDocument.introduction}</p>
      </header>
      {helpDocument.sections.map((section) => (
        <section key={section.title}>
          <h2>{section.title}</h2>
          <p>{section.body}</p>
          <ol>
            {section.steps.map((step) => <li key={step}>{step}</li>)}
          </ol>
        </section>
      ))}
    </article>
  );
}

function ProjectSettingsView({
  project,
  projectPath,
  hasDirtyState,
  activeEnvironmentName,
  onDefaultEnvironmentChange,
  onAskToSaveOnCloseChange,
  onSettingChange,
  onProxySettingChange,
  onExportDiagnostics
}: {
  project: RelayProject;
  projectPath: string;
  hasDirtyState: boolean;
  activeEnvironmentName: string;
  onDefaultEnvironmentChange: (environmentId: string) => void;
  onAskToSaveOnCloseChange: (enabled: boolean) => void;
  onSettingChange: <K extends keyof ProjectSettings>(key: K, value: ProjectSettings[K], message: string) => void;
  onProxySettingChange: <K extends keyof ProjectSettings["proxy"]>(key: K, value: ProjectSettings["proxy"][K], message: string) => void;
  onExportDiagnostics: () => void;
}) {
  const [activeSection, setActiveSection] = useState<"request" | "display" | "proxy" | "workspace">("request");
  const settings = getProjectSettings(project);
  const sections = [
    { id: "request" as const, label: "Request Policy" },
    { id: "display" as const, label: "Display" },
    { id: "proxy" as const, label: "Network Proxy" },
    { id: "workspace" as const, label: "Workspace" }
  ];

  return (
    <section className="project-settings-view" aria-label="Project settings">
      <aside className="settings-nav" aria-label="Settings sections">
        <strong>Settings</strong>
        <span>{project.name}</span>
        {sections.map((section) => (
          <button
            type="button"
            key={section.id}
            className={activeSection === section.id ? "active" : ""}
            onClick={() => setActiveSection(section.id)}
          >
            {section.label}
          </button>
        ))}
      </aside>
      <div className="settings-detail">
        {activeSection === "request" ? (
          <section className="settings-section" aria-label="Request policy settings">
            <h2>Request Policy</h2>
            <p>Control how Relay Studio sends requests, parses responses, and protects local request data.</p>
            <SettingsRow label="HTTP version" help="Choose the protocol preference used when sending requests.">
              <select
                aria-label="HTTP version"
                value={settings.httpVersion}
                onChange={(event) => onSettingChange("httpVersion", event.target.value as ProjectSettings["httpVersion"], "HTTP version preference updated.")}
              >
                <option value="auto">Auto</option>
                <option value="http1">HTTP/1.1</option>
                <option value="http2">HTTP/2</option>
              </select>
            </SettingsRow>
            <SettingsRow label="Request timeout" help="Maximum wait time before Relay Studio cancels a request.">
              <NumberSetting ariaLabel="Request timeout ms" value={settings.requestTimeoutMs} unit="ms" min={1} max={300000} onChange={(value) => onSettingChange("requestTimeoutMs", value, "Request timeout updated.")} />
            </SettingsRow>
            <SettingsRow label="Max response time" help="Flag responses that take longer than this threshold. Set to 0 to disable the warning.">
              <NumberSetting ariaLabel="Max response time ms" value={settings.maxResponseTimeMs} unit="ms" min={0} max={300000} onChange={(value) => onSettingChange("maxResponseTimeMs", value, "Max response time updated.")} />
            </SettingsRow>
            <SettingsToggle label="SSL certificate verification" checked={settings.sslCertificateVerification} onChange={(value) => onSettingChange("sslCertificateVerification", value, value ? "SSL certificate verification enabled." : "SSL certificate verification disabled.")} />
            <SettingsToggle label="SSL/TLS key log" help="Enable TLS session key logging for transport debugging." checked={settings.sslTlsKeyLog} onChange={(value) => onSettingChange("sslTlsKeyLog", value, value ? "SSL/TLS key logging enabled." : "SSL/TLS key logging disabled.")} />
            <SettingsToggle label="Disable cookies" help="Prevent browser-mode requests from sending cookies." checked={settings.disableCookies} onChange={(value) => onSettingChange("disableCookies", value, value ? "Cookies disabled for requests." : "Cookies enabled for requests.")} />
            <SettingsRow label="Response format detection" help="Auto follows response headers. JSON forces JSON parsing.">
              <div className="settings-radio-group" role="radiogroup" aria-label="Response format detection">
                <label><input type="radio" name="response-format-detection" checked={settings.responseFormatDetection === "auto"} onChange={() => onSettingChange("responseFormatDetection", "auto", "Response format detection set to Auto.")} /> Auto</label>
                <label><input type="radio" name="response-format-detection" checked={settings.responseFormatDetection === "json"} onChange={() => onSettingChange("responseFormatDetection", "json", "Response format detection set to JSON.")} /> JSON</label>
              </div>
            </SettingsRow>
          </section>
        ) : null}

        {activeSection === "display" ? (
          <section className="settings-section" aria-label="Display settings">
            <h2>Display</h2>
            <p>Choose the application theme used by the desktop shell.</p>
            <div className="theme-choice-grid">
              <button type="button" className={settings.theme === "light" ? "theme-choice active" : "theme-choice"} onClick={() => onSettingChange("theme", "light", "Light theme enabled.")}>
                <ThemePreview tone="light" />
                <strong>Light</strong>
                <em>Bright surfaces for daytime API work.</em>
              </button>
              <button type="button" className={settings.theme === "dark" ? "theme-choice active" : "theme-choice"} onClick={() => onSettingChange("theme", "dark", "Dark theme enabled.")}>
                <ThemePreview tone="dark" />
                <strong>Dark</strong>
                <em>Reduced-glare surfaces for low-light work.</em>
              </button>
            </div>
          </section>
        ) : null}

        {activeSection === "proxy" ? (
          <section className="settings-section" aria-label="Network proxy settings">
            <h2>Network Proxy</h2>
            <p>Route outbound REST traffic through a proxy when your network requires one.</p>
            <SettingsToggle label="Use proxy" checked={settings.proxy.enabled} onChange={(value) => onProxySettingChange("enabled", value, value ? "Proxy enabled." : "Proxy disabled.")} />
            <SettingsToggle label="Use proxy for HTTP" checked={settings.proxy.useForHttp} onChange={(value) => onProxySettingChange("useForHttp", value, "HTTP proxy routing updated.")} />
            <SettingsToggle label="Use proxy for HTTPS" checked={settings.proxy.useForHttps} onChange={(value) => onProxySettingChange("useForHttps", value, "HTTPS proxy routing updated.")} />
            <SettingsRow label="Proxy server" help="Enter a hostname or URL without credentials.">
              <div className="settings-inline-fields">
                <input aria-label="Proxy server URL" value={settings.proxy.serverUrl} placeholder="proxy.example.com" onChange={(event) => onProxySettingChange("serverUrl", event.target.value, "Proxy server updated.")} />
                <NumberSetting ariaLabel="Proxy server port" value={settings.proxy.port} unit="port" min={1} max={65535} onChange={(value) => onProxySettingChange("port", value, "Proxy port updated.")} />
              </div>
            </SettingsRow>
            <SettingsToggle label="Proxy basic auth" checked={settings.proxy.basicAuthEnabled} onChange={(value) => onProxySettingChange("basicAuthEnabled", value, value ? "Proxy basic auth enabled." : "Proxy basic auth disabled.")} />
            {settings.proxy.basicAuthEnabled ? (
              <SettingsRow label="Proxy credentials" help="Credentials are stored in the project file until app-level secure storage is added.">
                <div className="settings-inline-fields">
                  <input aria-label="Proxy username" value={settings.proxy.username} onChange={(event) => onProxySettingChange("username", event.target.value, "Proxy username updated.")} />
                  <input aria-label="Proxy password" type="password" value={settings.proxy.password} onChange={(event) => onProxySettingChange("password", event.target.value, "Proxy password updated.")} />
                </div>
              </SettingsRow>
            ) : null}
            <SettingsRow label="Proxy bypass list" help="Comma-separated hostnames that should connect directly.">
              <input aria-label="Proxy bypass list" value={settings.proxy.bypassList} placeholder="localhost,127.0.0.1" onChange={(event) => onProxySettingChange("bypassList", event.target.value, "Proxy bypass list updated.")} />
            </SettingsRow>
          </section>
        ) : null}

        {activeSection === "workspace" ? (
          <section className="settings-section" aria-label="Workspace settings">
            <h2>Workspace</h2>
            <p>Set project-level workspace behavior and file defaults.</p>
            <SettingsRow label="Default environment" help={`Current active environment: ${activeEnvironmentName || "None"}.`}>
              <select
                aria-label="Default environment"
                value={settings.defaultEnvironmentId}
                onChange={(event) => onDefaultEnvironmentChange(event.target.value)}
              >
                {project.environments.map((environment) => (
                  <option key={environment.id} value={environment.id}>{environment.name}</option>
                ))}
              </select>
            </SettingsRow>
            <SettingsRow label="Working directory" help="Default folder used for local project assets and response artifacts.">
              <input aria-label="Working directory" value={settings.workingDirectory} onChange={(event) => onSettingChange("workingDirectory", event.target.value, "Working directory updated.")} />
            </SettingsRow>
            <SettingsToggle label="Save on close" help="Ask before leaving unsaved project work." checked={settings.askToSaveOnClose} onChange={onAskToSaveOnCloseChange} />
            <SettingsToggle label="Always ask when closing unsaved tabs" checked={settings.askBeforeClosingUnsavedTabs} onChange={(value) => onSettingChange("askBeforeClosingUnsavedTabs", value, value ? "Unsaved tab close prompt enabled." : "Unsaved tab close prompt disabled.")} />
            <SettingsRow label="Project file" help="Read-only path for the current project.">
              <output>{projectPath || "Unsaved project"}</output>
            </SettingsRow>
            <SettingsRow label="Project status" help="Read-only save state for this workspace.">
              <output>{hasDirtyState ? "Unsaved changes" : "Saved"}</output>
            </SettingsRow>
            <SettingsRow label="Diagnostics bundle" help="Export app, platform, schema, project counts, and recent console events with secrets redacted.">
              <button type="button" onClick={onExportDiagnostics}>Export Diagnostics</button>
            </SettingsRow>
          </section>
        ) : null}
      </div>
    </section>
  );
}

function SettingsRow({ label, help, children }: { label: string; help?: string; children: ReactNode }) {
  return (
    <div className="settings-row">
      <div>
        <strong>{label}</strong>
        {help ? <p>{help}</p> : null}
      </div>
      <div>{children}</div>
    </div>
  );
}

function SettingsToggle({ label, help, checked, onChange }: { label: string; help?: string; checked: boolean; onChange: (checked: boolean) => void }) {
  return (
    <SettingsRow label={label} help={help}>
      <label className="settings-switch">
        <input aria-label={label} type="checkbox" checked={checked} onChange={(event) => onChange(event.target.checked)} />
        <span />
      </label>
    </SettingsRow>
  );
}

function NumberSetting({ ariaLabel, value, unit, min, max, onChange }: { ariaLabel: string; value: number; unit: string; min: number; max: number; onChange: (value: number) => void }) {
  return (
    <label className="number-setting">
      <input
        aria-label={ariaLabel}
        type="number"
        min={min}
        max={max}
        value={value}
        onChange={(event) => onChange(boundedNumber(event.target.value, min, max, value))}
      />
      <span>{unit}</span>
    </label>
  );
}

function ThemePreview({ tone }: { tone: "light" | "dark" }) {
  return (
    <span className={`theme-preview ${tone}-preview`} aria-hidden="true">
      <span className="theme-preview-titlebar">
        <span />
        <span />
        <span />
      </span>
      <span className="theme-preview-body">
        <span className="theme-preview-sidebar">
          <span className="theme-preview-icon" />
          <span />
          <span />
          <span />
        </span>
        <span className="theme-preview-canvas">
          <span className="theme-preview-toolbar">
            <span />
            <span className="theme-preview-primary-button" />
            <span className="theme-preview-secondary-button" />
          </span>
          <span className="theme-preview-card">
            <span />
            <span />
            <span className="theme-preview-status">
              <span />
              <span />
            </span>
          </span>
        </span>
      </span>
    </span>
  );
}

function PlaceholderView({ title, description }: { title: string; description: string }) {
  return (
    <section className="placeholder-view">
      <Box size={32} />
      <h2>{title}</h2>
      <p>{description}</p>
    </section>
  );
}

type UtilityDockTab = "Response" | "Console" | "Problems";

function BottomDock(props: {
  responseVisible: boolean;
  onToggleResponse: () => void;
  consoleFilter: string;
  onConsoleFilterChange: (value: string) => void;
  runnerResponse: ExecutedResponse | null;
  runnerEvents: RunnerConsoleEvent[];
  runnerError: string | null;
  canSaveResponse: boolean;
  onSaveResponse: () => void;
}) {
  const [responseTab, setResponseTab] = useState<"Pretty" | "Raw" | "Headers" | "Error">("Pretty");
  const [utilityTab, setUtilityTab] = useState<UtilityDockTab>("Response");
  const filteredEvents = props.consoleFilter === "Errors Only"
    ? props.runnerEvents.filter((event) => event.level === "error")
    : props.runnerEvents;
  const responseText = props.runnerResponse?.prettyBody || props.runnerResponse?.rawBody || "";
  const canToggleResponseBody = Boolean(props.runnerResponse || props.runnerError);

  return (
    <section className="bottom-dock" aria-label="Response and console dock">
      <header className="utility-header">
        <nav aria-label="Utility dock tabs">
          {(["Response", "Console", "Problems"] as const).map((tab) => (
            <button type="button" className={utilityTab === tab ? "active" : ""} onClick={() => setUtilityTab(tab)} key={tab}>
              {tab}
            </button>
          ))}
        </nav>
        {utilityTab === "Response" ? (
          <>
            <nav aria-label="Response tabs">
              {(["Pretty", "Raw", "Headers", "Error"] as const).map((tab) => (
                <button type="button" className={responseTab === tab ? "active" : ""} onClick={() => setResponseTab(tab)} key={tab}>{tab}</button>
              ))}
            </nav>
            {canToggleResponseBody ? (
              <button
                type="button"
                className="response-toggle"
                aria-label={props.responseVisible ? "Hide response body" : "Show response body"}
                onClick={props.onToggleResponse}
              >
                {props.responseVisible ? "Hide Body" : "Show Body"}
              </button>
            ) : null}
          </>
        ) : null}
        {utilityTab === "Console" ? (
          <>
            <select value={props.consoleFilter} onChange={(event) => props.onConsoleFilterChange(event.target.value)}>
              <option>All Events</option>
              <option>Errors Only</option>
              <option>Current Request</option>
            </select>
            <label><input type="checkbox" defaultChecked /> Timestamps</label>
            <button type="button">Clear</button>
          </>
        ) : null}
      </header>
      {utilityTab === "Response" ? (
        <div className="utility-panel response-dock">
          {props.responseVisible && props.runnerResponse ? (
            <div className="response-content" aria-label="Response content">
              <div className="response-meta">
                <div className="response-summary" aria-label="Response metadata">
                  <span className={`response-pill ${props.runnerResponse.ok ? "success" : "error"}`}>
                    {props.runnerResponse.status} {props.runnerResponse.statusText}
                  </span>
                  <span className="response-pill">{props.runnerResponse.durationMs} ms</span>
                  <span className="response-pill">{formatResponseSize(props.runnerResponse.rawBody)}</span>
                  {props.runnerResponse.finalUrl ? (
                    <span className="response-final-url" title={formatResponseDestination(props.runnerResponse.finalUrl)}>
                      Final origin: {formatResponseDestination(props.runnerResponse.finalUrl)}
                    </span>
                  ) : null}
                </div>
              </div>
              <button className="response-save-button" type="button" disabled={!props.canSaveResponse} onClick={props.onSaveResponse}>Save Response</button>
              <div className="response-body">
                {responseTab === "Pretty" ? <pre>{responseText || "No response body."}</pre> : null}
                {responseTab === "Raw" ? <pre>{props.runnerResponse.rawBody || "No response body."}</pre> : null}
                {responseTab === "Headers" ? <pre>{JSON.stringify(props.runnerResponse.headers, null, 2)}</pre> : null}
                {responseTab === "Error" ? <pre>{props.runnerError ?? props.runnerResponse.parseError ?? (props.runnerResponse.ok ? "No errors." : `HTTP ${props.runnerResponse.status} ${props.runnerResponse.statusText}`)}</pre> : null}
              </div>
            </div>
          ) : props.responseVisible && props.runnerError ? (
            <div className="empty-response error">
              <Archive size={34} />
              <strong>Request failed.</strong>
              <span>{props.runnerError}</span>
            </div>
          ) : (
            <div className="empty-response">
              <Archive size={34} />
              <strong>No response yet.</strong>
              <span>Send the request to inspect status, headers, timing, and body.</span>
            </div>
          )}
        </div>
      ) : null}
      {utilityTab === "Console" ? (
        <div className="utility-panel console-dock">
          <ol>
            {filteredEvents.length ? filteredEvents.map((event) => (
              <li className={event.level} key={event.sequence}>
                <span>{String(event.sequence).padStart(2, "0")}</span>
                <em>{event.message}</em>
              </li>
            )) : (
              <li><span>--</span><em>Send a request to see execution events.</em></li>
            )}
          </ol>
        </div>
      ) : null}
      {utilityTab === "Problems" ? (
        <div className={props.runnerError ? "utility-panel problems-dock error" : "utility-panel problems-dock"}>
          {props.runnerError ? (
            <>
              <strong>1 problem</strong>
              <p>{props.runnerError}</p>
            </>
          ) : (
            <>
              <strong>No problems</strong>
              <p>Validation and runtime errors will appear here.</p>
            </>
          )}
        </div>
      ) : null}
    </section>
  );
}

function Inspector({
  environment,
  activeTab,
  activeService,
  activeFlow,
  runnerResponse,
  onAddVariable,
  onClose,
  onDeleteVariable,
  onUpdateVariable
}: {
  environment: ProjectEnvironment | undefined;
  activeTab: WorkbenchTab;
  activeService: ProjectService | undefined;
  activeFlow: ProjectFlow | undefined;
  runnerResponse: ExecutedResponse | null;
  onAddVariable: () => void;
  onClose: () => void;
  onDeleteVariable: (index: number) => void;
  onUpdateVariable: (index: number, patch: Partial<ProjectVariable>) => void;
}) {
  const [variableFilter, setVariableFilter] = useState("");
  const variables = environment?.variables ?? [];
  const visibleVariables = variables
    .map((variable, index) => ({ variable, index }))
    .filter(({ variable }) => variable.name.toLowerCase().includes(variableFilter.toLowerCase()));

  return (
    <aside className="inspector" aria-label="Inspector">
      <div className="inspector-tabs">
        <button type="button" className="active">Inspector</button>
        <button type="button" aria-label="Hide inspector" onClick={onClose}><X size={16} /></button>
      </div>
      {activeTab.kind === "request" ? (
        <>
          <section className="inspector-variables-panel">
            <h2>Variables</h2>
            <label className="filter-field">
              <Search size={15} />
              <input
                aria-label="Filter variables"
                placeholder="Filter variables"
                value={variableFilter}
                onChange={(event) => setVariableFilter(event.target.value)}
              />
            </label>
            {visibleVariables.length ? visibleVariables.map(({ variable, index }) => (
              <VariableRow
                key={`${variable.name}-${index}`}
                index={index}
                variable={variable}
                onDelete={onDeleteVariable}
                onUpdate={onUpdateVariable}
              />
            )) : <p className="empty-inline">No variables match the filter.</p>}
            <button type="button" className="secondary-full" onClick={onAddVariable}><Plus size={16} /> Add Variable</button>
          </section>
          <section>
            <h2>Request Summary</h2>
            <div className="snapshot-grid">
              <span>Editor</span><strong>{activeService?.name ?? activeTab.label}</strong>
              <span>Method</span><strong>{activeService?.method ?? activeTab.method ?? "N/A"}</strong>
              <span>Auth</span><strong>{activeService ? authLabel(activeService.authProfile.type) : "N/A"}</strong>
              <span>Environment</span><strong>{environment?.name ?? "No environment"}</strong>
            </div>
          </section>
        </>
      ) : null}
      {activeTab.kind === "flow" ? (
        <section>
          <h2>Flow Summary</h2>
          <div className="snapshot-grid">
            <span>Flow</span><strong>{activeFlow?.name ?? activeTab.label}</strong>
            <span>Steps</span><strong>{activeFlow?.nodes.length ?? 0}</strong>
            <span>Routes</span><strong>{activeFlow?.edges.length ?? 0}</strong>
            <span>Mappings</span><strong>{activeFlow?.mappings.length ?? 0}</strong>
          </div>
        </section>
      ) : null}
      {activeTab.kind === "response" ? (
        <section>
          <h2>Response Summary</h2>
          <div className="snapshot-grid">
            <span>Status</span><strong>{runnerResponse ? `${runnerResponse.status} ${runnerResponse.statusText}` : "Not loaded"}</strong>
            <span>Timing</span><strong>{runnerResponse ? `${runnerResponse.durationMs} ms` : "N/A"}</strong>
            <span>Size</span><strong>{runnerResponse ? formatResponseSize(runnerResponse.rawBody) : "N/A"}</strong>
            <span>Body</span><strong>{runnerResponse?.contentType ?? "N/A"}</strong>
          </div>
        </section>
      ) : null}
      {activeTab.kind === "welcome" || activeTab.kind === "settings" || activeTab.kind === "import" ? (
        <section>
          <h2>Shell Context</h2>
          <div className="snapshot-grid">
            <span>Tab</span><strong>{activeTab.label}</strong>
            <span>Editor</span><strong>{activeTab.kind}</strong>
            <span>Environment</span><strong>{environment?.name ?? "No environment"}</strong>
          </div>
        </section>
      ) : null}
    </aside>
  );
}

function VariableRow({
  index,
  variable,
  onDelete,
  onUpdate
}: {
  index: number;
  variable: ProjectVariable;
  onDelete: (index: number) => void;
  onUpdate: (index: number, patch: Partial<ProjectVariable>) => void;
}) {
  return (
    <div className="variable-row">
      <input
        aria-label={`Variable name ${index + 1}`}
        value={variable.name}
        onChange={(event) => onUpdate(index, { name: event.target.value })}
      />
      <input
        aria-label={`Variable value ${variable.name || index + 1}`}
        type={variable.secret ? "password" : "text"}
        value={variable.value}
        onChange={(event) => onUpdate(index, { value: event.target.value })}
      />
      <label className="variable-secret-toggle" title="Secret">
        <input
          aria-label={`Secret ${variable.name || index + 1}`}
          checked={variable.secret}
          type="checkbox"
          onChange={(event) => onUpdate(index, { secret: event.target.checked })}
        />
        <KeyRound size={14} />
      </label>
      <button type="button" aria-label={`Delete variable ${variable.name || index + 1}`} onClick={() => onDelete(index)}>
        <Trash2 size={14} />
      </button>
    </div>
  );
}

function CommandPalette({
  commands,
  returnFocusRef,
  onClose,
  onChoose
}: {
  commands: Array<{ id: ShellCommandId; label: string; shortcut?: string }>;
  returnFocusRef: RefObject<HTMLButtonElement>;
  onClose: () => void;
  onChoose: (id: ShellCommandId) => void;
}) {
  const [query, setQuery] = useState("");
  const searchInputRef = useRef<HTMLInputElement | null>(null);
  const dialogRef = useModalBehavior(onClose, { initialFocusRef: searchInputRef, returnFocusRef });
  const filteredCommands = commands.filter((command) => command.label.toLowerCase().includes(query.trim().toLowerCase()));

  return (
    <div className="modal-backdrop" role="presentation" onMouseDown={onClose}>
      <section ref={dialogRef} className="command-palette" role="dialog" aria-modal="true" aria-label="Command palette" onMouseDown={(event) => event.stopPropagation()}>
        <label>
          <Search size={18} />
          <input ref={searchInputRef} placeholder="Search commands" value={query} onChange={(event) => setQuery(event.target.value)} />
          <kbd>Esc</kbd>
        </label>
        <div>
          {filteredCommands.map((command) => (
            <button type="button" key={command.id} onClick={() => onChoose(command.id)}>
              <span>{command.label}</span>
              <em>{command.shortcut ?? ""}</em>
            </button>
          ))}
          {!filteredCommands.length ? <p className="empty-inline">No matching commands.</p> : null}
        </div>
      </section>
    </div>
  );
}

function groupServices(project: RelayProject): Array<{ folder: string; items: ProjectService[] }> {
  const grouped = new Map<string, ProjectService[]>();
  for (const service of project.services) {
    const current = grouped.get(service.folder) ?? [];
    current.push(service);
    grouped.set(service.folder, current);
  }

  return Array.from(grouped.entries()).map(([folder, items]) => ({ folder, items }));
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max);
}

function positionsEqual(first: FlowNodePosition, second: FlowNodePosition): boolean {
  return Math.abs(first.x - second.x) < 0.5 && Math.abs(first.y - second.y) < 0.5;
}

function contextMenuLabel(target: "requests" | "request" | "flows" | "flow"): string {
  if (target === "requests") return "Requests context menu";
  if (target === "request") return "Request context menu";
  if (target === "flows") return "Flows context menu";
  return "Flow context menu";
}

function createDefaultTabsForProject(project: RelayProject): WorkbenchTab[] {
  return reconcileTabsForProject(project, [
    { id: "welcome", label: "Welcome", kind: "welcome" },
    ...project.services.slice(0, 2).map((service) => ({
      id: service.id,
      label: service.name,
      kind: "request" as const,
      method: service.method
    })),
    ...project.flows.slice(0, 1).map((flow) => ({
      id: flow.id,
      label: flow.name,
      kind: "flow" as const
    })),
    ...project.savedResponses.slice(0, 1).map((response) => ({
      id: response.id,
      label: response.fileName,
      kind: "response" as const,
      method: response.method
    }))
  ]);
}

function reconcileTabsForProject(project: RelayProject, tabs: WorkbenchTab[]): WorkbenchTab[] {
  const reconciled = tabs.flatMap((tab): WorkbenchTab[] => {
    if (tab.kind === "welcome") return [{ ...tab, id: "welcome", label: "Welcome" }];
    if (tab.kind === "request") {
      const service = project.services.find((item) => item.id === tab.id);
      return service ? [{ ...tab, label: service.name, method: service.method }] : [];
    }
    if (tab.kind === "flow") {
      const flow = project.flows.find((item) => item.id === tab.id);
      return flow ? [{ ...tab, label: flow.name }] : [];
    }
    if (tab.kind === "response") {
      const response = project.savedResponses.find((item) => item.id === tab.id);
      return response ? [{ ...tab, label: response.fileName, method: response.method }] : [];
    }
    return [tab];
  });
  return reconciled.some((tab) => tab.id === "welcome")
    ? reconciled
    : [{ id: "welcome", label: "Welcome", kind: "welcome" }, ...reconciled];
}

function reconcileActiveTabId(
  project: RelayProject,
  tabs: WorkbenchTab[],
  activeTabId: string,
  activeServiceId: string,
  activeFlowId: string
): string {
  if (tabs.some((tab) => tab.id === activeTabId)) return activeTabId;
  if (activeFlowId && project.flows.some((flow) => flow.id === activeFlowId) && tabs.some((tab) => tab.id === activeFlowId)) return activeFlowId;
  if (activeServiceId && project.services.some((service) => service.id === activeServiceId) && tabs.some((tab) => tab.id === activeServiceId)) return activeServiceId;
  return tabs[0]?.id ?? "welcome";
}

function isRequestOrFlowTabKind(kind: TabKind): kind is "request" | "flow" {
  return kind === "request" || kind === "flow";
}

function mergeCapturedVariables(current: ProjectVariable[], captured: ProjectVariable[]): ProjectVariable[] {
  const next = current.slice();
  for (const variable of captured) {
    const index = next.findIndex((item) => item.name === variable.name);
    if (index >= 0) {
      next[index] = variable;
    } else {
      next.push(variable);
    }
  }
  return next;
}

function parseRequestUrlForService(
  service: ProjectService,
  environment: ProjectEnvironment,
  value: string
): { service: ProjectService; environment: ProjectEnvironment } | null {
  const trimmed = value.trim();
  if (!trimmed) return null;

  let parsedUrl: URL;
  let baseUrl: string | null = null;
  if (/^https?:\/\//i.test(trimmed)) {
    try {
      parsedUrl = new URL(trimmed);
      baseUrl = parsedUrl.origin;
    } catch {
      return null;
    }
  } else if (trimmed.startsWith("/")) {
    try {
      parsedUrl = new URL(trimmed, "https://relay-studio.local");
    } catch {
      return null;
    }
  } else {
    return null;
  }

  const queryParams = Array.from(parsedUrl.searchParams.entries()).map(([name, paramValue], index) => ({
    id: `${service.id}-query-${slugForId(name)}-${index + 1}`,
    name,
    value: paramValue,
    enabled: true
  }));
  const nextService = {
    ...service,
    path: parsedUrl.pathname || "/",
    queryParams
  };
  const nextEnvironment = baseUrl
    ? {
      ...environment,
      variables: upsertEnvironmentVariable(environment.variables, {
        name: "baseUrl",
        value: baseUrl,
        secret: false
      })
    }
    : environment;

  return { service: nextService, environment: nextEnvironment };
}

function upsertEnvironmentVariable(variables: ProjectVariable[], variable: ProjectVariable): ProjectVariable[] {
  return variables.some((item) => item.name === variable.name)
    ? variables.map((item) => (item.name === variable.name ? variable : item))
    : [...variables, variable];
}

function uniqueEnvironmentVariableName(variables: ProjectVariable[], baseName: string): string {
  const names = new Set(variables.map((variable) => variable.name));
  if (!names.has(baseName)) return baseName;
  let index = 2;
  while (names.has(`${baseName}${index}`)) {
    index += 1;
  }
  return `${baseName}${index}`;
}

function slugForId(value: string): string {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") || "param";
}

function isActiveProjectListTarget(
  activeName: string,
  activePath: string,
  candidateName: string,
  candidatePath: string
): boolean {
  if (activePath && candidatePath) {
    return activePath === candidatePath;
  }
  return activeName.trim().toLowerCase() === candidateName.trim().toLowerCase();
}

function hasTauriRuntimeSync(): boolean {
  return typeof window !== "undefined" && "__TAURI_INTERNALS__" in window;
}

function ProjectNameDialog({
  title,
  initialName,
  submitLabel,
  fieldLabel = "Project name",
  onCancel,
  onSubmit
}: {
  title: string;
  initialName: string;
  submitLabel: string;
  fieldLabel?: string;
  onCancel: () => void;
  onSubmit: (name: string) => void | Promise<void>;
}) {
  const [name, setName] = useState(initialName);
  const [submitting, setSubmitting] = useState(false);
  const nameInputRef = useRef<HTMLInputElement | null>(null);
  const dialogRef = useModalBehavior(onCancel, { initialFocusRef: nameInputRef });
  const trimmedName = name.trim();

  return (
    <div className="modal-backdrop" role="presentation">
      <section ref={dialogRef} className="project-file-dialog" role="dialog" aria-modal="true" aria-label={title}>
        <header>
          <strong>{title}</strong>
          <button type="button" aria-label={`Close ${title.toLowerCase()} dialog`} onClick={onCancel}><X size={17} /></button>
        </header>
        <form
          onSubmit={(event) => {
            event.preventDefault();
            if (!trimmedName) return;
            setSubmitting(true);
            void Promise.resolve(onSubmit(trimmedName)).finally(() => setSubmitting(false));
          }}
        >
          <label>
            <span>{fieldLabel}</span>
            <input
              ref={nameInputRef}
              aria-label={fieldLabel}
              value={name}
              onChange={(event) => setName(event.target.value)}
              onFocus={(event) => event.target.select()}
            />
          </label>
          {!trimmedName ? <p className="overwrite-warning">{fieldLabel} is required.</p> : null}
          <div>
            <button type="submit" className="primary-command" disabled={submitting || !trimmedName}>
              {submitting ? "Working..." : submitLabel}
            </button>
            <button type="button" onClick={onCancel}>Cancel</button>
          </div>
        </form>
      </section>
    </div>
  );
}

function DeleteProjectDialog({
  target,
  onCancel,
  onDelete
}: {
  target: ProjectListTarget;
  onCancel: () => void;
  onDelete: () => void | Promise<void>;
}) {
  const [submitting, setSubmitting] = useState(false);
  const cancelButtonRef = useRef<HTMLButtonElement | null>(null);
  const dialogRef = useModalBehavior(onCancel, { initialFocusRef: cancelButtonRef });
  return (
    <div className="modal-backdrop" role="presentation">
      <section ref={dialogRef} className="project-file-dialog" role="dialog" aria-modal="true" aria-label="Delete Project">
        <header>
          <strong>Delete Project</strong>
          <button type="button" aria-label="Close delete project dialog" onClick={onCancel}><X size={17} /></button>
        </header>
        <form
          onSubmit={(event) => {
            event.preventDefault();
            setSubmitting(true);
            void Promise.resolve(onDelete()).finally(() => setSubmitting(false));
          }}
        >
          <p className="delete-warning">
            This action is destructive and will completely delete the project file for <strong>{target.name}</strong>.
          </p>
          {target.path ? <p className="project-path-copy">{target.path}</p> : <p className="project-path-copy">This unsaved project will be removed from Recent Projects.</p>}
          <div>
            <button type="submit" className="primary-command danger-command" disabled={submitting}>
              {submitting ? "Deleting..." : "Delete Project"}
            </button>
            <button ref={cancelButtonRef} type="button" onClick={onCancel}>Cancel</button>
          </div>
        </form>
      </section>
    </div>
  );
}

function ProjectFileDialog({
  dialog,
  error,
  projectName,
  defaultDirectory,
  recentProjects,
  projectExists,
  onCancel,
  onSubmit
}: {
  dialog: { mode: "open" | "save"; title: string; path: string };
  error: string | null;
  projectName: string;
  defaultDirectory: string;
  recentProjects: RecentProject[];
  projectExists: (path: string) => Promise<boolean>;
  onCancel: () => void;
  onSubmit: (input: { path: string }) => Promise<void>;
}) {
  const [path, setPath] = useState(dialog.path || buildDefaultProjectPath(projectName, defaultDirectory));
  const [submitting, setSubmitting] = useState(false);
  const [overwritePending, setOverwritePending] = useState(false);
  const pathInputRef = useRef<HTMLInputElement | null>(null);
  const dialogRef = useModalBehavior(onCancel, { initialFocusRef: pathInputRef });

  useEffect(() => {
    setOverwritePending(false);
  }, [path]);

  async function handleSubmit() {
    if (dialog.mode === "save" && path !== dialog.path && !overwritePending && await projectExists(path)) {
      setOverwritePending(true);
      return;
    }
    await onSubmit({ path });
  }

  async function openRecent(pathToOpen: string) {
    setPath(pathToOpen);
    setSubmitting(true);
    try {
      await onSubmit({ path: pathToOpen });
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="modal-backdrop" role="presentation">
      <section ref={dialogRef} className="project-file-dialog" role="dialog" aria-modal="true" aria-label={dialog.title}>
        <header>
          <strong>{dialog.title}</strong>
          <button type="button" aria-label="Close project dialog" onClick={onCancel}><X size={17} /></button>
        </header>
        <form
          onSubmit={(event) => {
            event.preventDefault();
            setSubmitting(true);
            void handleSubmit().finally(() => setSubmitting(false));
          }}
        >
          <label>
            <span>Project file path</span>
            <input ref={pathInputRef} value={path} onChange={(event) => setPath(event.target.value)} placeholder="/path/to/project.restproj" />
          </label>
          {dialog.mode === "open" && recentProjects.length ? (
            <section className="recent-project-picker" aria-label="Recent projects">
              <strong>Recent Projects</strong>
              {recentProjects.map((recent) => (
                <button type="button" key={recent.path} onClick={() => void openRecent(recent.path)} disabled={submitting}>
                  <FolderOpen size={15} />
                  <span>{recent.name}</span>
                  <em>{recent.path}</em>
                </button>
              ))}
            </section>
          ) : null}
          <p>Project files use the `.restproj` extension. Secret values remain redacted in the workspace and console output.</p>
          {error ? <p className="dialog-error" role="alert">{error}</p> : null}
          {overwritePending ? <p className="overwrite-warning">A project already exists at this path. Confirm overwrite to continue.</p> : null}
          <div>
            <button type="submit" className="primary-command" disabled={submitting}>
              {submitting ? "Working..." : overwritePending ? "Overwrite Project" : dialog.mode === "save" ? "Save Project" : "Open Project"}
            </button>
            <button type="button" onClick={onCancel}>Cancel</button>
          </div>
        </form>
      </section>
    </div>
  );
}

function SaveResponseDialog({
  dialog,
  responseExists,
  onCancel,
  onSubmit
}: {
  dialog: { path: string; warning: string | null };
  responseExists: (path: string) => Promise<boolean>;
  onCancel: () => void;
  onSubmit: (path: string, overwrite: boolean) => Promise<void>;
}) {
  const [path, setPath] = useState(dialog.path);
  const [submitting, setSubmitting] = useState(false);
  const [overwritePending, setOverwritePending] = useState(false);
  const [fieldError, setFieldError] = useState<string | null>(null);
  const pathInputRef = useRef<HTMLInputElement | null>(null);
  const dialogRef = useModalBehavior(onCancel, { initialFocusRef: pathInputRef });

  useEffect(() => {
    setOverwritePending(false);
    setFieldError(null);
  }, [path]);

  async function handleSubmit() {
    setFieldError(null);
    try {
      if (!overwritePending && await responseExists(path)) {
        setOverwritePending(true);
        return;
      }
      await onSubmit(path, overwritePending);
    } catch (error) {
      setFieldError(error instanceof Error ? error.message : String(error));
    }
  }

  return (
    <div className="modal-backdrop" role="presentation">
      <section ref={dialogRef} className="project-file-dialog save-response-dialog" role="dialog" aria-modal="true" aria-label="Save Response">
        <header>
          <strong>Save Response</strong>
          <button type="button" aria-label="Close response dialog" onClick={onCancel}><X size={17} /></button>
        </header>
        <form
          onSubmit={(event) => {
            event.preventDefault();
            setSubmitting(true);
            void handleSubmit().finally(() => setSubmitting(false));
          }}
        >
          <label>
            <span>Response file path</span>
            <input ref={pathInputRef} value={path} onChange={(event) => setPath(event.target.value)} placeholder="/path/to/response.json" />
          </label>
          <p>Use `.json` for structured response artifacts or `.txt` for redacted raw response bodies. Project metadata keeps status, timing, and source service details.</p>
          {dialog.warning ? <p className="response-warning">{dialog.warning}</p> : null}
          {overwritePending ? <p className="overwrite-warning">A saved response already exists at this path. Confirm overwrite to continue.</p> : null}
          {fieldError ? <p className="overwrite-warning">{fieldError}</p> : null}
          <div>
            <button type="submit" className="primary-command" disabled={submitting}>
              {submitting ? "Working..." : overwritePending ? "Overwrite Response" : "Save Response"}
            </button>
            <button type="button" onClick={onCancel}>Cancel</button>
          </div>
        </form>
      </section>
    </div>
  );
}

function upsertSessionProjectSnapshot(
  current: SessionProjectSnapshot[],
  snapshot: SessionProjectSnapshot
): SessionProjectSnapshot[] {
  return [
    snapshot,
    ...current.filter((item) => item.id !== snapshot.id)
  ].slice(0, 5);
}

function SavePrompt({
  projectName,
  onCancel,
  onDiscard,
  onSave
}: {
  projectName: string;
  onCancel: () => void;
  onDiscard: () => void;
  onSave: () => void;
}) {
  const cancelButtonRef = useRef<HTMLButtonElement | null>(null);
  const dialogRef = useModalBehavior(onCancel, { initialFocusRef: cancelButtonRef });

  return (
    <div className="modal-backdrop" role="presentation">
      <section ref={dialogRef} className="save-prompt" role="dialog" aria-modal="true" aria-label="Unsaved changes">
        <header>
          <strong>Unsaved changes</strong>
          <button type="button" aria-label="Close prompt" onClick={onCancel}><X size={17} /></button>
        </header>
        <p>{projectName} has unsaved service and flow edits.</p>
        <div>
          <button type="button" className="primary-command" onClick={onSave}>Save And Continue</button>
          <button type="button" onClick={onDiscard}>Do Not Save</button>
          <button ref={cancelButtonRef} type="button" onClick={onCancel}>Cancel</button>
        </div>
      </section>
    </div>
  );
}
