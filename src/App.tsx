import {
  Archive,
  Bell,
  BookOpen,
  Box,
  Braces,
  CheckCircle2,
  ChevronDown,
  Clock3,
  Code2,
  Database,
  Download,
  FileJson,
  FilePlus2,
  FileText,
  Folder,
  FolderInput,
  FolderOpen,
  GitBranch,
  KeyRound,
  Lock,
  Play,
  Plus,
  Save,
  Search,
  Send,
  Settings,
  Shield,
  SlidersHorizontal,
  Terminal,
  UserCircle,
  X
} from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import {
  createEmptyProject,
  createSampleProject,
  touchProject,
  type AuthMode,
  type HttpMethod,
  type KeyValueRow,
  type ProjectEnvironment,
  type ProjectService,
  type ProjectVariable,
  type RecentProject,
  type RelayProject,
  type SavedResponseMetadata
} from "./project/projectModel";
import { createProjectPersistence, type ProjectPersistence } from "./project/projectPersistence";
import {
  AUTH_MODES,
  HTTP_METHODS,
  buildRequestPreview,
  createService,
  deleteService,
  duplicateService,
  formatJsonBody,
  minifyJsonBody,
  removeRow,
  reorderService,
  upsertRow,
  type RequestPreview
} from "./services/serviceDesigner";
import { createSavedResponsePersistence, type SavedResponsePersistence } from "./services/savedResponsePersistence";
import {
  artifactToExecutedResponse,
  buildSavedResponseDraft,
  defaultSavedResponsePath
} from "./services/savedResponses";
import { runServiceRequest, type ExecutableRequest, type ExecutedResponse, type RunnerConsoleEvent } from "./services/serviceRunner";

type Area = "Projects" | "Services" | "Runner" | "Flows" | "Saved Responses" | "Settings";
type TabKind = "welcome" | "request" | "flow" | "response" | "import" | "settings";

interface WorkbenchTab {
  id: string;
  label: string;
  kind: TabKind;
  method?: "GET" | "POST" | "PUT" | "DELETE";
  dirty?: boolean;
}

const primaryAreas: Array<{ area: Area; icon: typeof FileText; label: string }> = [
  { area: "Projects", icon: FolderOpen, label: "Projects" },
  { area: "Services", icon: FileText, label: "Services" },
  { area: "Runner", icon: Play, label: "Runner" },
  { area: "Flows", icon: GitBranch, label: "Flows" },
  { area: "Saved Responses", icon: Archive, label: "Saved Responses" },
  { area: "Settings", icon: Settings, label: "Settings" }
];

const initialTabs: WorkbenchTab[] = [
  { id: "welcome", label: "Welcome", kind: "welcome" },
  { id: "login", label: "Login", kind: "request", method: "POST" },
  { id: "create-order", label: "Create Order", kind: "request", method: "POST" },
  { id: "authenticated-read", label: "Authenticated Read", kind: "flow" },
  { id: "current-user-response", label: "current-user.json", kind: "response" }
];

const commandItems = [
  "New Project",
  "Import API Docs",
  "Open Project",
  "Save Project",
  "Save Project As",
  "Send Request",
  "Run Flow",
  "Save Response",
  "Manage Environments",
  "Settings"
];

export function App() {
  const [project, setProject] = useState<RelayProject>(() => createSampleProject());
  const [projectPath, setProjectPath] = useState("/private/tmp/sample-api-regression.restproj");
  const [projectDirty, setProjectDirty] = useState(false);
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
  const [activeArea, setActiveArea] = useState<Area>("Services");
  const [tabs, setTabs] = useState(initialTabs);
  const [activeTabId, setActiveTabId] = useState("create-order");
  const [activeServiceId, setActiveServiceId] = useState("create-order");
  const [environment, setEnvironment] = useState("QA Environment");
  const [commandPaletteOpen, setCommandPaletteOpen] = useState(false);
  const [responseVisible, setResponseVisible] = useState(true);
  const [savePromptOpen, setSavePromptOpen] = useState(false);
  const [consoleFilter, setConsoleFilter] = useState("All Events");
  const [runnerResponse, setRunnerResponse] = useState<ExecutedResponse | null>(null);
  const [runnerRequest, setRunnerRequest] = useState<ExecutableRequest | null>(null);
  const [runnerEvents, setRunnerEvents] = useState<RunnerConsoleEvent[]>([]);
  const [runnerError, setRunnerError] = useState<string | null>(null);
  const [runnerRunning, setRunnerRunning] = useState(false);
  const [saveResponseDialog, setSaveResponseDialog] = useState<null | {
    path: string;
    warning: string | null;
  }>(null);

  const activeTab = tabs.find((tab) => tab.id === activeTabId) ?? tabs[0];
  const hasDirtyState = projectDirty || tabs.some((tab) => tab.dirty);
  const groupedServices = useMemo(() => groupServices(project), [project]);
  const activeEnvironment = useMemo(() => {
    return project.environments.find((item) => item.name === environment) ?? project.environments[0];
  }, [environment, project.environments]);
  const activeService = project.services.find((service) => service.id === activeServiceId) ?? project.services[0];
  const requestPreview = activeService && activeEnvironment ? buildRequestPreview(activeService, activeEnvironment) : null;

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      const commandKey = event.metaKey || event.ctrlKey;
      if (commandKey && event.key.toLowerCase() === "k") {
        event.preventDefault();
        setCommandPaletteOpen(true);
      }
      if (commandKey && event.key.toLowerCase() === "s") {
        event.preventDefault();
        setSavePromptOpen(true);
      }
      if (event.key === "Escape") {
        setCommandPaletteOpen(false);
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, []);

  useEffect(() => {
    void createProjectPersistence().then(async (createdPersistence) => {
      setPersistence(createdPersistence);
      setRecentProjects(await createdPersistence.listRecentProjects());
    });
    void createSavedResponsePersistence().then(setSavedResponsePersistence);
  }, []);

  useEffect(() => {
    let unsubscribe: undefined | (() => void);

    async function registerCloseHook() {
      try {
        const { getCurrentWindow } = await import("@tauri-apps/api/window");
        const currentWindow = getCurrentWindow();
        unsubscribe = await currentWindow.onCloseRequested((event) => {
          if (hasDirtyState) {
            event.preventDefault();
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

  const requestUrl = useMemo(() => {
    if (activeTab.kind === "flow") {
      return "{{baseUrl}}/flow/authenticated-read";
    }
    if (activeTab.kind === "response") {
      return "responses/current-user-2026-06-21.json";
    }
    return requestPreview?.url ?? "{{baseUrl}}/api/orders";
  }, [activeTab.kind, requestPreview?.url]);

  function openPlaceholderTab(kind: TabKind, label: string) {
    const id = `${kind}-${label.toLowerCase().replace(/[^a-z0-9]+/g, "-")}`;
    setTabs((current) => (current.some((tab) => tab.id === id) ? current : [...current, { id, kind, label }]));
    setActiveTabId(id);
  }

  function closeTab(id: string) {
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
    setActiveArea("Services");
    setTabs((current) => (
      current.some((tab) => tab.id === service.id)
        ? current
        : [...current, { id: service.id, label: service.name, kind: "request", method: service.method }]
    ));
    setActiveTabId(service.id);
  }

  function updateProjectServices(nextServices: ProjectService[], message = "Service definition updated.") {
    setProject((current) => touchProject({ ...current, services: nextServices }));
    setProjectDirty(true);
    setTabs((current) => current.map((tab) => (tab.id === activeTabId ? { ...tab, dirty: true } : tab)));
    setProjectMessage(message);
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

  function handleCreateService() {
    const next = createService({ id: `service-${project.services.length + 1}` });
    updateProjectServices([...project.services, next], "New service created.");
    handleSelectService(next);
  }

  function handleDuplicateService() {
    if (!activeService) return;
    const copy = duplicateService(activeService, project.services.map((service) => service.id));
    updateProjectServices([...project.services, copy], "Service duplicated.");
    handleSelectService(copy);
  }

  function handleDeleteService() {
    if (!activeService) return;
    const nextServices = deleteService(project.services, activeService.id);
    updateProjectServices(nextServices, "Service deleted.");
    const nextActive = nextServices[0];
    if (nextActive) {
      handleSelectService(nextActive);
    }
  }

  function handleMoveService(direction: "up" | "down") {
    if (!activeService) return;
    updateProjectServices(reorderService(project.services, activeService.id, direction), "Service order updated.");
  }

  async function handleSendRequest() {
    if (!activeService || !activeEnvironment) return;
    setRunnerRunning(true);
    setRunnerError(null);
    setResponseVisible(true);

    const result = await runServiceRequest(activeService, activeEnvironment);
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

    setRunnerRunning(false);
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

  async function handleSavedResponseExists(path: string) {
    const responsePersistence = savedResponsePersistence ?? await createSavedResponsePersistence();
    if (!savedResponsePersistence) setSavedResponsePersistence(responsePersistence);
    return responsePersistence.responseExists(path);
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
      setActiveArea("Saved Responses");
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

  return (
    <main className="app-shell" aria-label="Relay Studio desktop shell">
      <TopCommandBar
        projectDirty={hasDirtyState}
        environment={environment}
        onEnvironmentChange={setEnvironment}
        onOpenCommandPalette={() => setCommandPaletteOpen(true)}
        onOpenImport={() => openPlaceholderTab("import", "Import API Docs")}
        onNewProject={handleNewProject}
        onOpenProject={() => setProjectDialog({ mode: "open", title: "Open Project", path: projectPath })}
        onSave={() => setProjectDialog({ mode: "save", title: "Save Project", path: projectPath })}
        onSendRequest={handleSendRequest}
        runnerRunning={runnerRunning}
      />

      <section className="workspace-grid">
        <ActivityRail activeArea={activeArea} onAreaChange={setActiveArea} />
        <ProjectExplorer
          activeArea={activeArea}
          groupedServices={groupedServices}
          project={project}
          projectDirty={hasDirtyState}
          recentProjects={recentProjects}
          projectMessage={projectMessage}
          projectError={projectError}
          onMarkDirty={markProjectDirty}
          onOpenRecent={(recent) => setProjectDialog({ mode: "open", title: "Open Recent Project", path: recent.path })}
          onOpenSettings={() => openPlaceholderTab("settings", "Settings")}
          onOpenImport={() => openPlaceholderTab("import", "Import API Docs")}
          activeServiceId={activeService?.id ?? ""}
          onSelectService={handleSelectService}
          onOpenSavedResponse={handleOpenSavedResponse}
        />

        <section className="workbench" aria-label="Workbench">
          <TabStrip tabs={tabs} activeTabId={activeTabId} onSelect={setActiveTabId} onClose={closeTab} />
          <RequestComposer requestUrl={requestUrl} activeTab={activeTab} onSendRequest={handleSendRequest} runnerRunning={runnerRunning} />
          <RequestEditor
            activeTab={activeTab}
            activeService={activeService}
            activeEnvironment={activeEnvironment}
            requestPreview={requestPreview}
            onCreateService={handleCreateService}
            onDuplicateService={handleDuplicateService}
            onDeleteService={handleDeleteService}
            onMoveService={handleMoveService}
            onUpdateService={updateActiveService}
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
        </section>

        <Inspector environment={environment} activeTab={activeTab} />
      </section>

      {commandPaletteOpen ? (
        <CommandPalette onClose={() => setCommandPaletteOpen(false)} onChoose={(label) => {
          setCommandPaletteOpen(false);
          if (label === "Import API Docs") openPlaceholderTab("import", label);
          if (label === "Settings") openPlaceholderTab("settings", label);
          if (label === "New Project") handleNewProject();
          if (label === "Open Project") setProjectDialog({ mode: "open", title: "Open Project", path: projectPath });
          if (label === "Save Project") setProjectDialog({ mode: "save", title: "Save Project", path: projectPath });
          if (label === "Save Project As") setProjectDialog({ mode: "save", title: "Save Project As", path: "" });
          if (label === "Send Request") void handleSendRequest();
          if (label === "Save Response") openSaveResponseDialog();
        }} />
      ) : null}

      {savePromptOpen ? (
        <SavePrompt
          onCancel={() => setSavePromptOpen(false)}
          onDiscard={() => {
            setProjectDirty(false);
            setTabs((current) => current.map((tab) => ({ ...tab, dirty: false })));
            setSavePromptOpen(false);
          }}
          onSave={() => {
            setSavePromptOpen(false);
            setProjectDialog({ mode: "save", title: "Save Project", path: projectPath });
          }}
        />
      ) : null}

      {projectDialog ? (
        <ProjectFileDialog
          dialog={projectDialog}
          projectName={project.name}
          projectExists={handleProjectExists}
          onCancel={() => setProjectDialog(null)}
          onSubmit={async ({ path, password }) => {
            if (projectDialog.mode === "save") {
              await handleSaveProject(path, password);
            } else {
              await handleOpenProject(path, password);
            }
          }}
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

  function markProjectDirty(message = "Project has unsaved changes.") {
    setProjectDirty(true);
    setTabs((current) => current.map((tab) => (tab.id === activeTabId ? { ...tab, dirty: true } : tab)));
    setProjectMessage(message);
    setProjectError(null);
  }

  function handleNewProject() {
    const nextProject = createEmptyProject();
    setProject(nextProject);
    setProjectPath("");
    setEnvironment(nextProject.environments[0]?.name ?? "QA Environment");
    setActiveServiceId("");
    setProjectDirty(true);
    setTabs(initialTabs.map((tab) => ({ ...tab, dirty: tab.id === "welcome" })));
    setActiveTabId("welcome");
    setProjectMessage("New unsaved project created.");
    setProjectError(null);
  }

  async function handleSaveProject(path: string, password: string) {
    try {
      const projectPersistence = persistence ?? await createProjectPersistence();
      if (!persistence) setPersistence(projectPersistence);
      const updated = touchProject(project);
      await projectPersistence.saveProject({ path, password, project: updated });
      const recent = { name: updated.name, path, openedAt: new Date().toISOString() };
      await projectPersistence.rememberRecentProject(recent);
      setProject(updated);
      setProjectPath(path);
      setProjectDirty(false);
      setTabs((current) => current.map((tab) => ({ ...tab, dirty: false })));
      setRecentProjects(await projectPersistence.listRecentProjects());
      setProjectDialog(null);
      setProjectMessage(`Project saved to ${path}.`);
      setProjectError(null);
    } catch (error) {
      setProjectError(error instanceof Error ? error.message : String(error));
    }
  }

  async function handleOpenProject(path: string, password: string) {
    try {
      const projectPersistence = persistence ?? await createProjectPersistence();
      if (!persistence) setPersistence(projectPersistence);
      const opened = await projectPersistence.openProject({ path, password });
      const recent = { name: opened.name, path, openedAt: new Date().toISOString() };
      await projectPersistence.rememberRecentProject(recent);
      setProject(opened);
      setProjectPath(path);
      setEnvironment(opened.environments[0]?.name ?? "QA Environment");
      setActiveServiceId(opened.services[0]?.id ?? "");
      setProjectDirty(false);
      setTabs(initialTabs.map((tab) => ({ ...tab, dirty: false })));
      setActiveTabId("welcome");
      setRecentProjects(await projectPersistence.listRecentProjects());
      setProjectDialog(null);
      setProjectMessage(`Project opened from ${path}.`);
      setProjectError(null);
    } catch (error) {
      setProjectError(error instanceof Error ? error.message : String(error));
    }
  }

  async function handleProjectExists(path: string) {
    const projectPersistence = persistence ?? await createProjectPersistence();
    if (!persistence) setPersistence(projectPersistence);
    return projectPersistence.projectExists(path);
  }
}

interface TopCommandBarProps {
  projectDirty: boolean;
  environment: string;
  runnerRunning: boolean;
  onEnvironmentChange: (environment: string) => void;
  onOpenCommandPalette: () => void;
  onOpenImport: () => void;
  onNewProject: () => void;
  onOpenProject: () => void;
  onSave: () => void;
  onSendRequest: () => void;
}

function TopCommandBar(props: TopCommandBarProps) {
  return (
    <header className="top-command-bar">
      <div className="window-controls" aria-hidden="true">
        <span className="control close" />
        <span className="control minimize" />
        <span className="control zoom" />
      </div>
      <div className="brand-lockup" aria-label="Relay Studio">
        <span className="brand-mark">RS</span>
        <div>
          <strong>Relay Studio</strong>
          <span>Sample API Regression</span>
        </div>
      </div>
      <button className="command-search" type="button" onClick={props.onOpenCommandPalette}>
        <Search size={17} />
        <span>Search services, flows, variables...</span>
        <kbd>Cmd K</kbd>
      </button>
      <div className="toolbar-actions" aria-label="Primary commands">
        <button type="button" className="icon-command" onClick={props.onNewProject}>
          <FilePlus2 size={18} />
          <span>New</span>
        </button>
        <button type="button" className="icon-command" onClick={props.onOpenProject}>
          <FolderInput size={18} />
          <span>Open</span>
        </button>
        <button type="button" className="icon-command" onClick={props.onOpenImport}>
          <Download size={18} />
          <span>Import API Docs</span>
        </button>
        <button type="button" className="icon-command" onClick={props.onSave}>
          <Save size={18} />
          <span>{props.projectDirty ? "Save Project *" : "Save Project"}</span>
        </button>
        <button type="button" className="primary-command" onClick={props.onSendRequest} disabled={props.runnerRunning}>
          <Send size={18} />
          <span>{props.runnerRunning ? "Sending..." : "Send Request"}</span>
        </button>
        <label className="environment-select">
          <span className="status-dot" />
          <select value={props.environment} onChange={(event) => props.onEnvironmentChange(event.target.value)}>
            <option>QA Environment</option>
            <option>Staging Environment</option>
            <option>Production Environment</option>
          </select>
        </label>
        <button type="button" className="chrome-icon" aria-label="History"><Clock3 size={19} /></button>
        <button type="button" className="chrome-icon" aria-label="Notifications"><Bell size={19} /></button>
        <button type="button" className="chrome-icon" aria-label="Settings"><Settings size={19} /></button>
        <button type="button" className="chrome-icon" aria-label="User"><UserCircle size={21} /></button>
      </div>
    </header>
  );
}

function ActivityRail({ activeArea, onAreaChange }: { activeArea: Area; onAreaChange: (area: Area) => void }) {
  return (
    <nav className="activity-rail" aria-label="Primary navigation">
      {primaryAreas.map(({ area, icon: Icon, label }) => (
        <button
          key={area}
          type="button"
          className={area === activeArea ? "active" : ""}
          aria-current={area === activeArea ? "page" : undefined}
          onClick={() => onAreaChange(area)}
        >
          <Icon size={21} />
          <span>{label}</span>
        </button>
      ))}
    </nav>
  );
}

function ProjectExplorer(props: {
  activeArea: Area;
  groupedServices: Array<{ folder: string; items: ProjectService[] }>;
  project: RelayProject;
  projectDirty: boolean;
  recentProjects: RecentProject[];
  projectMessage: string;
  projectError: string | null;
  activeServiceId: string;
  onSelectService: (service: ProjectService) => void;
  onMarkDirty: () => void;
  onOpenRecent: (recent: RecentProject) => void;
  onOpenImport: () => void;
  onOpenSettings: () => void;
  onOpenSavedResponse: (metadata: SavedResponseMetadata) => void;
}) {
  return (
    <aside className="project-explorer" aria-label="Project explorer">
      <div className="pane-title">
        <div>
          <p>Explorer</p>
          <h1>{props.project.name}{props.projectDirty ? " *" : ""}</h1>
          <span>{props.project.services.length} services - {props.project.flows.length} flows</span>
        </div>
        <button type="button" aria-label="New item"><Plus size={17} /></button>
      </div>
      <label className="explorer-search">
        <Search size={16} />
        <input placeholder="Search projects and services" />
      </label>
      <button type="button" className="import-callout" onClick={props.onOpenImport}>
        <Database size={18} />
        <span>No OpenAPI source linked</span>
        <strong>Import API Docs</strong>
      </button>
      <div className="tree-scroll">
        <TreeSection title="Services" count={String(props.project.services.length)}>
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
                >
                  <span className={`method method-${item.method.toLowerCase()}`}>{item.method}</span>
                  <span>{item.name}</span>
                </button>
              ))}
            </div>
          ))}
        </TreeSection>
        <TreeSection title="Flows" count="3">
          {props.project.flows.map((flow) => (
            <button type="button" className="tree-item" key={flow.id}>
              <GitBranch size={15} />
              <span>{flow.name}</span>
            </button>
          ))}
        </TreeSection>
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
            <button
              type="button"
              className={response.status >= 400 ? "tree-item warning" : "tree-item"}
              key={response.id}
              onClick={() => props.onOpenSavedResponse(response)}
              title={`${response.method} ${response.status} - ${response.filePath}`}
            >
              <FileJson size={15} />
              <span>{response.fileName}</span>
            </button>
          ))}
        </TreeSection>
        <TreeSection title="Recent Projects" count={String(props.recentProjects.length)}>
          {props.recentProjects.length ? props.recentProjects.map((recent) => (
            <button type="button" className="tree-item recent-project" key={recent.path} onClick={() => props.onOpenRecent(recent)}>
              <FolderOpen size={15} />
              <span>{recent.name}</span>
            </button>
          )) : (
            <span className="tree-empty">No recent projects yet.</span>
          )}
        </TreeSection>
      </div>
      <div className={props.projectError ? "project-status error" : "project-status"}>
        {props.projectError ?? props.projectMessage}
      </div>
      <div className="explorer-footer">
        <span>{props.activeArea}</span>
        <button type="button" onClick={props.onMarkDirty}>Mark Dirty</button>
        <button type="button" onClick={props.onOpenSettings}>Settings</button>
      </div>
    </aside>
  );
}

function TreeSection({ title, count, children }: { title: string; count: string; children: React.ReactNode }) {
  return (
    <section className="tree-section">
      <button type="button" className="tree-section-heading">
        <ChevronDown size={15} />
        <span>{title}</span>
        <em>{count}</em>
      </button>
      {children}
    </section>
  );
}

function TabStrip(props: {
  tabs: WorkbenchTab[];
  activeTabId: string;
  onSelect: (id: string) => void;
  onClose: (id: string) => void;
}) {
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
      <button type="button" className="new-tab" aria-label="Open new tab">
        <Plus size={17} />
      </button>
    </div>
  );
}

function RequestComposer({
  requestUrl,
  activeTab,
  onSendRequest,
  runnerRunning
}: {
  requestUrl: string;
  activeTab: WorkbenchTab;
  onSendRequest: () => void;
  runnerRunning: boolean;
}) {
  return (
    <div className="request-composer" aria-label="Request composer">
      <div className="breadcrumb">
        <span>Sample API Regression</span>
        <span>Services</span>
        <span>{activeTab.label}</span>
      </div>
      <div className="request-row">
        <select aria-label="HTTP method" value={activeTab.method ?? "POST"} onChange={() => undefined}>
          <option>GET</option>
          <option>POST</option>
          <option>PUT</option>
          <option>DELETE</option>
        </select>
        <input aria-label="Request URL" value={requestUrl} readOnly />
        <select aria-label="Protocol" defaultValue="HTTP/1.1">
          <option>HTTP/1.1</option>
          <option>HTTP/2</option>
        </select>
        <button type="button" className="primary-command send-button" onClick={onSendRequest} disabled={runnerRunning}>
          <Send size={18} />
          <span>{runnerRunning ? "Sending..." : "Send Request"}</span>
        </button>
        <button type="button" className="split-action" aria-label="Request actions">
          <ChevronDown size={17} />
        </button>
      </div>
    </div>
  );
}

function RequestEditor({
  activeTab,
  activeService,
  activeEnvironment,
  requestPreview,
  onCreateService,
  onDuplicateService,
  onDeleteService,
  onMoveService,
  onUpdateService
}: {
  activeTab: WorkbenchTab;
  activeService: ProjectService | undefined;
  activeEnvironment: ProjectEnvironment | undefined;
  requestPreview: RequestPreview | null;
  onCreateService: () => void;
  onDuplicateService: () => void;
  onDeleteService: () => void;
  onMoveService: (direction: "up" | "down") => void;
  onUpdateService: (updater: (service: ProjectService) => ProjectService, message?: string) => void;
}) {
  if (activeTab.kind === "welcome") {
    return <PlaceholderView title="Welcome" description="Open a service, import API docs, or run a flow." />;
  }

  if (activeTab.kind === "import") {
    return <PlaceholderView title="Import API Docs" description="Paste an OpenAPI URL or choose a local Swagger file to preview services." />;
  }

  if (activeTab.kind === "flow") {
    return <FlowPlaceholder />;
  }

  if (activeTab.kind === "settings") {
    return <PlaceholderView title="Settings" description="Manage defaults, close behavior, redaction, and encrypted project settings." />;
  }

  if (!activeService || !activeEnvironment || !requestPreview) {
    return <PlaceholderView title="No Service Selected" description="Create or select a service to edit its reusable REST request." />;
  }

  return (
    <ServiceDesignerEditor
      service={activeService}
      environment={activeEnvironment}
      preview={requestPreview}
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
  preview: RequestPreview;
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
    <section className="editor-surface service-designer" aria-label="REST service designer">
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
            <strong>Service Detail</strong>
            <div>
              <button type="button" onClick={props.onCreateService}>New Service</button>
              <button type="button" onClick={props.onDuplicateService}>Duplicate</button>
              <button type="button" onClick={() => props.onMoveService("up")}>Move Up</button>
              <button type="button" onClick={() => props.onMoveService("down")}>Move Down</button>
              <button type="button" onClick={props.onDeleteService}>Delete</button>
            </div>
          </header>
          <div className="service-form-grid">
            <label>
              <span>Service name</span>
              <input aria-label="Service name" value={service.name} onChange={(event) => update({ name: event.target.value }, "Service renamed.")} />
            </label>
            <label>
              <span>Folder</span>
              <input aria-label="Service folder" value={service.folder} onChange={(event) => update({ folder: event.target.value }, "Service folder updated.")} />
            </label>
            <label>
              <span>Method</span>
              <select aria-label="Service method" value={service.method} onChange={(event) => update({ method: event.target.value as HttpMethod }, "HTTP method updated.")}>
                {HTTP_METHODS.map((method) => <option key={method}>{method}</option>)}
              </select>
            </label>
            <label>
              <span>Path</span>
              <input aria-label="Service path" value={service.path} onChange={(event) => update({ path: event.target.value }, "Service path updated.")} />
            </label>
            <label>
              <span>Timeout ms</span>
              <input aria-label="Timeout ms" type="number" value={service.timeoutMs} onChange={(event) => update({ timeoutMs: Number(event.target.value) }, "Timeout updated.")} />
            </label>
          </div>
          {activePanel === "Authorization" ? (
            <AuthorizationPanel service={service} preview={props.preview} onAuthModeChange={updateAuth} onUpdateService={props.onUpdateService} />
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
            <BodyPanel service={service} onUpdate={update} />
          ) : null}
          {activePanel === "Retry" ? (
            <RetryPanel service={service} onUpdate={update} />
          ) : null}
          {activePanel === "Settings" ? (
            <SettingsPanel service={service} environment={props.environment} preview={props.preview} />
          ) : null}
        </section>
        <RequestPreviewPanel preview={props.preview} />
      </div>
    </section>
  );
}

function AuthorizationPanel(props: {
  service: ProjectService;
  preview: RequestPreview;
  onAuthModeChange: (type: AuthMode) => void;
  onUpdateService: (updater: (service: ProjectService) => ProjectService, message?: string) => void;
}) {
  const auth = props.service.authProfile;

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
            <span>Token variable</span>
            <div className="input-with-icon">
              <input aria-label="Token variable" value={auth.tokenVariable ?? ""} onChange={(event) => updateAuthProfile({ type: auth.type, tokenVariable: event.target.value })} />
              <Braces size={16} />
            </div>
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
            <label><span>Username variable</span><input aria-label="Username variable" value={auth.usernameVariable ?? ""} onChange={(event) => updateAuthProfile({ type: auth.type, usernameVariable: event.target.value })} /></label>
            <label><span>Password variable</span><input aria-label="Password variable" value={auth.passwordVariable ?? ""} onChange={(event) => updateAuthProfile({ type: auth.type, passwordVariable: event.target.value })} /></label>
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
      <div className="generated-preview">
        <div>
          <strong>Generated request auth</strong>
          <span className="status-ready"><CheckCircle2 size={16} /> {props.preview.issues.some((issue) => issue.field === "auth") ? "Needs input" : "Ready"}</span>
        </div>
        <dl>
          <dt>{props.preview.generatedAuthHeader?.name ?? "Auth"}</dt>
          <dd>{props.preview.generatedAuthHeader?.value ?? "No generated auth header"}</dd>
        </dl>
        <p>Generated auth stays separate from user-defined headers and redacts secret values.</p>
      </div>
    </section>
  );
}

function RowsPanel({ title, rows, onChange }: { title: string; rows: KeyValueRow[]; onChange: (rows: KeyValueRow[]) => void }) {
  function updateRow(row: KeyValueRow) {
    onChange(upsertRow(rows, row));
  }

  return (
    <section className="rows-panel" aria-label={title}>
      <header>
        <strong>{title}</strong>
        <button type="button" onClick={() => onChange([...rows, { id: `${title}-${rows.length + 1}`, name: "", value: "", enabled: true }])}>
          Add {title === "Headers" ? "Header" : "Param"}
        </button>
      </header>
      {rows.length ? rows.map((row) => (
        <div className="kv-row" key={row.id}>
          <label><input aria-label={`${row.name || title} enabled`} type="checkbox" checked={row.enabled} onChange={(event) => updateRow({ ...row, enabled: event.target.checked })} /></label>
          <input aria-label={`${title} name`} value={row.name} placeholder="Name" onChange={(event) => updateRow({ ...row, name: event.target.value })} />
          <input aria-label={`${title} value`} value={row.value} placeholder="Value" onChange={(event) => updateRow({ ...row, value: event.target.value })} />
          <button type="button" onClick={() => onChange(removeRow(rows, row.id))}>Remove</button>
        </div>
      )) : <p className="empty-inline">No {title.toLowerCase()} configured.</p>}
    </section>
  );
}

function BodyPanel({ service, onUpdate }: { service: ProjectService; onUpdate: (patch: Partial<ProjectService>, message?: string) => void }) {
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
          </select>
          <button type="button" onClick={() => transformBody(formatJsonBody)}>Beautify</button>
          <button type="button" onClick={() => transformBody(minifyJsonBody)}>Minify</button>
        </div>
      </header>
      <textarea aria-label="Request body" value={service.body.raw} onChange={(event) => updateBody(event.target.value)} />
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

function SettingsPanel({ service, environment, preview }: { service: ProjectService; environment: ProjectEnvironment; preview: RequestPreview }) {
  return (
    <section className="settings-panel">
      <dl>
        <dt>Environment</dt><dd>{environment.name}</dd>
        <dt>Timeout</dt><dd>{service.timeoutMs} ms</dd>
        <dt>Retry</dt><dd>{service.retry.attempts} attempt(s), {service.retry.backoffMs} ms backoff</dd>
        <dt>Validation</dt><dd>{preview.issues.length ? `${preview.issues.length} issue(s)` : "Ready"}</dd>
      </dl>
    </section>
  );
}

function RequestPreviewPanel({ preview }: { preview: RequestPreview }) {
  return (
    <aside className="request-preview-panel" aria-label="Request construction preview">
      <header>
        <strong>Request Preview</strong>
        <span className={preview.issues.some((issue) => issue.severity === "error") ? "preview-status error" : "preview-status"}>{preview.issues.length ? "Needs Review" : "Ready"}</span>
      </header>
      <dl>
        <dt>Method</dt><dd>{preview.method}</dd>
        <dt>URL</dt><dd>{preview.url}</dd>
        <dt>Generated Auth</dt><dd>{preview.generatedAuthHeader ? `${preview.generatedAuthHeader.name}: ${preview.generatedAuthHeader.value}` : "None"}</dd>
        <dt>Headers</dt><dd>{preview.headers.length}</dd>
        <dt>Query Params</dt><dd>{preview.queryParams.length}</dd>
        <dt>Path Params</dt><dd>{preview.pathParams.length}</dd>
      </dl>
      <section>
        <strong>Validation</strong>
        {preview.issues.length ? (
          <ul>
            {preview.issues.map((issue) => <li key={`${issue.field}-${issue.message}`} className={issue.severity}>{issue.message}</li>)}
          </ul>
        ) : <p>No blocking issues.</p>}
      </section>
    </aside>
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

function FlowPlaceholder() {
  return (
    <section className="flow-placeholder" aria-label="Flow editor placeholder">
      {["Login", "Current User", "List Products", "Get Product", "Save Response"].map((step, index) => (
        <div className="flow-node" key={step}>
          <span>{index + 1}</span>
          <strong>{step}</strong>
          <em>{index < 2 ? "POST" : "GET"}</em>
        </div>
      ))}
    </section>
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
  const filteredEvents = props.consoleFilter === "Errors Only"
    ? props.runnerEvents.filter((event) => event.level === "error")
    : props.runnerEvents;
  const responseText = props.runnerResponse?.prettyBody || props.runnerResponse?.rawBody || "";

  return (
    <section className="bottom-dock" aria-label="Response and console dock">
      <div className="response-dock">
        <header>
          <nav aria-label="Response tabs">
            {(["Pretty", "Raw", "Headers", "Error"] as const).map((tab) => (
              <button type="button" className={responseTab === tab ? "active" : ""} onClick={() => setResponseTab(tab)} key={tab}>{tab}</button>
            ))}
          </nav>
          <button
            type="button"
            className="response-toggle"
            aria-label={props.responseVisible ? "Show empty response state" : "Show sample response"}
            onClick={props.onToggleResponse}
          >
            {props.responseVisible ? "Empty" : "Body"}
          </button>
        </header>
        {props.responseVisible && props.runnerResponse ? (
          <div className="response-content">
            <div className="response-meta">
              <span className={props.runnerResponse.ok ? "http-ok" : "http-error"}>{props.runnerResponse.status} {props.runnerResponse.statusText}</span>
              <span>{props.runnerResponse.durationMs} ms</span>
              <span>{props.runnerResponse.rawBody.length} B</span>
              <button type="button" disabled={!props.canSaveResponse} onClick={props.onSaveResponse}>Save Response</button>
            </div>
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
      <div className="console-dock">
        <header>
          <strong><Terminal size={17} /> Console</strong>
          <select value={props.consoleFilter} onChange={(event) => props.onConsoleFilterChange(event.target.value)}>
            <option>All Events</option>
            <option>Errors Only</option>
            <option>Current Request</option>
          </select>
          <label><input type="checkbox" defaultChecked /> Show Timestamps</label>
          <button type="button">Clear</button>
          <button type="button">Export Log</button>
        </header>
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
    </section>
  );
}

function Inspector({ environment, activeTab }: { environment: string; activeTab: WorkbenchTab }) {
  return (
    <aside className="inspector" aria-label="Inspector">
      <div className="inspector-tabs">
        <button type="button" className="active">Inspector</button>
        <button type="button">Variables</button>
      </div>
      <section>
        <h2>Environment</h2>
        <label>
          <span>Active Environment</span>
          <select value={environment} onChange={() => undefined}>
            <option>{environment}</option>
          </select>
        </label>
      </section>
      <section>
        <h2>Variables</h2>
        <label className="filter-field">
          <Search size={15} />
          <input placeholder="Filter variables" />
        </label>
        <VariableRow name="baseUrl" value="https://api.example.com" />
        <VariableRow name="accessToken" value="********" secret />
        <VariableRow name="productId" value="prod-1001" />
        <VariableRow name="orderId" value="ord-20260621-0001" />
        <button type="button" className="secondary-full"><Plus size={16} /> Add Variable</button>
      </section>
      <section>
        <h2>Auth Snapshot</h2>
        <div className="snapshot-grid">
          <span>Type</span><strong>Bearer Token</strong>
          <span>Token</span><strong>{"{{accessToken}}"}</strong>
          <span>Status</span><strong className="ready-text">Ready</strong>
        </div>
      </section>
      <section>
        <h2>Request Summary</h2>
        <div className="snapshot-grid">
          <span>Editor</span><strong>{activeTab.label}</strong>
          <span>Method</span><strong>{activeTab.method ?? "N/A"}</strong>
          <span>Headers</span><strong>2</strong>
          <span>Body</span><strong>application/json</strong>
        </div>
      </section>
      <div className="inspector-rail" aria-label="Inspector modes">
        <button type="button" className="active" aria-label="Authorization"><Shield size={18} /></button>
        <button type="button" aria-label="Variables"><Braces size={18} /></button>
        <button type="button" aria-label="Scripts"><Code2 size={18} /></button>
        <button type="button" aria-label="Docs"><BookOpen size={18} /></button>
        <button type="button" aria-label="Settings"><SlidersHorizontal size={18} /></button>
      </div>
    </aside>
  );
}

function VariableRow({ name, value, secret = false }: { name: string; value: string; secret?: boolean }) {
  return (
    <div className="variable-row">
      <span>{name}</span>
      <code>{value}</code>
      {secret ? <KeyRound size={14} /> : null}
    </div>
  );
}

function CommandPalette({ onClose, onChoose }: { onClose: () => void; onChoose: (label: string) => void }) {
  return (
    <div className="modal-backdrop" role="presentation" onMouseDown={onClose}>
      <section className="command-palette" role="dialog" aria-modal="true" aria-label="Command palette" onMouseDown={(event) => event.stopPropagation()}>
        <label>
          <Search size={18} />
          <input autoFocus placeholder="Search commands" />
          <kbd>Esc</kbd>
        </label>
        <div>
          {commandItems.map((label) => (
            <button type="button" key={label} onClick={() => onChoose(label)}>
              <span>{label}</span>
              <em>{label === "Send Request" ? "Cmd Enter" : label === "Settings" ? "Cmd ," : ""}</em>
            </button>
          ))}
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

function ProjectFileDialog({
  dialog,
  projectName,
  projectExists,
  onCancel,
  onSubmit
}: {
  dialog: { mode: "open" | "save"; title: string; path: string };
  projectName: string;
  projectExists: (path: string) => Promise<boolean>;
  onCancel: () => void;
  onSubmit: (input: { path: string; password: string }) => Promise<void>;
}) {
  const [path, setPath] = useState(dialog.path || `/private/tmp/${projectName.toLowerCase().replace(/[^a-z0-9]+/g, "-")}.restproj`);
  const [password, setPassword] = useState("relay-studio");
  const [submitting, setSubmitting] = useState(false);
  const [overwritePending, setOverwritePending] = useState(false);

  useEffect(() => {
    setOverwritePending(false);
  }, [path, password]);

  async function handleSubmit() {
    if (dialog.mode === "save" && path !== dialog.path && !overwritePending && await projectExists(path)) {
      setOverwritePending(true);
      return;
    }
    await onSubmit({ path, password });
  }

  return (
    <div className="modal-backdrop" role="presentation">
      <section className="project-file-dialog" role="dialog" aria-modal="true" aria-label={dialog.title}>
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
            <input value={path} onChange={(event) => setPath(event.target.value)} placeholder="/path/to/project.restproj" />
          </label>
          <label>
            <span>Project password</span>
            <input value={password} onChange={(event) => setPassword(event.target.value)} type="password" />
          </label>
          <p>Project files use the `.restproj` extension. Secret-bearing project data is encrypted with the password before it is written.</p>
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
      <section className="project-file-dialog save-response-dialog" role="dialog" aria-modal="true" aria-label="Save Response">
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
            <input value={path} onChange={(event) => setPath(event.target.value)} placeholder="/path/to/response.json" />
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

function SavePrompt({
  onCancel,
  onDiscard,
  onSave
}: {
  onCancel: () => void;
  onDiscard: () => void;
  onSave: () => void;
}) {
  return (
    <div className="modal-backdrop" role="presentation">
      <section className="save-prompt" role="dialog" aria-modal="true" aria-label="Unsaved changes">
        <header>
          <strong>Unsaved changes</strong>
          <button type="button" aria-label="Close prompt" onClick={onCancel}><X size={17} /></button>
        </header>
        <p>Sample API Regression has unsaved service and flow edits.</p>
        <div>
          <button type="button" className="primary-command" onClick={onSave}>Save And Continue</button>
          <button type="button" onClick={onDiscard}>Do Not Save</button>
          <button type="button" onClick={onCancel}>Cancel</button>
        </div>
      </section>
    </div>
  );
}
