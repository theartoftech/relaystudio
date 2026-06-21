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
import { createEmptyProject, createSampleProject, touchProject, type RecentProject, type RelayProject } from "./project/projectModel";
import { createProjectPersistence, type ProjectPersistence } from "./project/projectPersistence";

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
  const [environment, setEnvironment] = useState("QA Environment");
  const [commandPaletteOpen, setCommandPaletteOpen] = useState(false);
  const [responseVisible, setResponseVisible] = useState(true);
  const [savePromptOpen, setSavePromptOpen] = useState(false);
  const [consoleFilter, setConsoleFilter] = useState("All Events");

  const activeTab = tabs.find((tab) => tab.id === activeTabId) ?? tabs[0];
  const hasDirtyState = projectDirty || tabs.some((tab) => tab.dirty);
  const groupedServices = useMemo(() => groupServices(project), [project]);

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
    return "{{baseUrl}}/api/orders";
  }, [activeTab.kind]);

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
        />

        <section className="workbench" aria-label="Workbench">
          <TabStrip tabs={tabs} activeTabId={activeTabId} onSelect={setActiveTabId} onClose={closeTab} />
          <RequestComposer requestUrl={requestUrl} activeTab={activeTab} />
          <RequestEditor activeTab={activeTab} />
          <BottomDock
            responseVisible={responseVisible}
            onToggleResponse={() => setResponseVisible((visible) => !visible)}
            consoleFilter={consoleFilter}
            onConsoleFilterChange={setConsoleFilter}
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
  onEnvironmentChange: (environment: string) => void;
  onOpenCommandPalette: () => void;
  onOpenImport: () => void;
  onNewProject: () => void;
  onOpenProject: () => void;
  onSave: () => void;
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
        <button type="button" className="primary-command">
          <Send size={18} />
          <span>Send Request</span>
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
  groupedServices: Array<{ folder: string; items: Array<{ method: string; label: string }> }>;
  project: RelayProject;
  projectDirty: boolean;
  recentProjects: RecentProject[];
  projectMessage: string;
  projectError: string | null;
  onMarkDirty: () => void;
  onOpenRecent: (recent: RecentProject) => void;
  onOpenImport: () => void;
  onOpenSettings: () => void;
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
                  className={item.label === "Create Order" ? "tree-item selected" : "tree-item"}
                  key={item.label}
                >
                  <span className={`method method-${item.method.toLowerCase()}`}>{item.method}</span>
                  <span>{item.label}</span>
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
        <TreeSection title="Saved Responses" count="3">
          {props.project.savedResponses.map((response) => (
            <button type="button" className={response.status >= 400 ? "tree-item warning" : "tree-item"} key={response.id}>
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

function RequestComposer({ requestUrl, activeTab }: { requestUrl: string; activeTab: WorkbenchTab }) {
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
        <button type="button" className="primary-command send-button">
          <Send size={18} />
          <span>Send Request</span>
        </button>
        <button type="button" className="split-action" aria-label="Request actions">
          <ChevronDown size={17} />
        </button>
      </div>
    </div>
  );
}

function RequestEditor({ activeTab }: { activeTab: WorkbenchTab }) {
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

  return (
    <section className="editor-surface" aria-label="Request editor">
      <nav className="editor-tabs" aria-label="Request editor tabs">
        {["Authorization", "Headers 2", "Query Params", "Path Params", "Body", "Retry", "Tests", "Settings", "Pre Scripts"].map((tab, index) => (
          <button type="button" className={index === 0 ? "active" : ""} key={tab}>
            {tab}
            {tab === "Body" ? <span className="green-dot" /> : null}
          </button>
        ))}
      </nav>
      <div className="editor-main">
        <section className="auth-panel">
          <div className="form-grid">
            <label>
              <span>Authorization type</span>
              <select defaultValue="Bearer Token">
                <option>Bearer Token</option>
                <option>No Auth</option>
                <option>Basic Auth</option>
                <option>API Key</option>
                <option>OAuth Client Credentials</option>
                <option>Custom Header</option>
              </select>
            </label>
            <label>
              <span>Token variable</span>
              <div className="input-with-icon">
                <input value="{{accessToken}}" readOnly />
                <Braces size={16} />
              </div>
            </label>
            <fieldset>
              <legend>Apply token to</legend>
              <label><input type="radio" name="token-target" defaultChecked /> Authorization header</label>
              <label><input type="radio" name="token-target" /> Custom header</label>
              <label><input type="radio" name="token-target" /> Query parameter</label>
            </fieldset>
          </div>
          <div className="generated-preview">
            <div>
              <strong>Generated request header</strong>
              <span className="status-ready"><CheckCircle2 size={16} /> Ready</span>
            </div>
            <dl>
              <dt>Authorization</dt>
              <dd>Bearer ********</dd>
              <dt>Content-Type</dt>
              <dd>application/json</dd>
            </dl>
            <p>Generated auth is previewed here. User-defined headers stay in the Headers tab.</p>
          </div>
        </section>
        <section className="body-editor" aria-label="JSON body editor">
          <header>
            <span>Request Body</span>
            <div>
              <button type="button">Beautify</button>
              <button type="button">Minify</button>
            </div>
          </header>
          <pre>{`{
  "productId": "{{productId}}",
  "quantity": 1,
  "shippingMethod": "standard"
}`}</pre>
        </section>
      </div>
    </section>
  );
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
}) {
  return (
    <section className="bottom-dock" aria-label="Response and console dock">
      <div className="response-dock">
        <header>
          <nav aria-label="Response tabs">
            <button type="button" className="active">Response</button>
            <button type="button">Headers</button>
            <button type="button">Cookies</button>
            <button type="button">Tests</button>
            <button type="button">Metrics</button>
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
        {props.responseVisible ? (
          <div className="response-content">
            <div className="response-meta">
              <span className="http-ok">200 OK</span>
              <span>245 ms</span>
              <span>1.23 KB</span>
              <button type="button">Save Response</button>
            </div>
            <div className="response-body">
              <pre>{`{
  "orderId": "ord-20260621-0001",
  "status": "created",
  "total": 1226.25,
  "currency": "USD"
}`}</pre>
            </div>
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
          <li><span>09:40:59</span><em>Preparing request: POST {"{{baseUrl}}/api/orders"}</em></li>
          <li><span>09:41:00</span><em>Opening connection to {"{{baseUrl}}"} (TLS 1.3)</em></li>
          <li><span>09:41:00</span><em>Authorization header prepared from secret variable.</em></li>
          <li><span>09:41:01</span><em>Received response (200 OK) in 245 ms.</em></li>
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

function groupServices(project: RelayProject): Array<{ folder: string; items: Array<{ method: string; label: string }> }> {
  const grouped = new Map<string, Array<{ method: string; label: string }>>();
  for (const service of project.services) {
    const current = grouped.get(service.folder) ?? [];
    current.push({ method: service.method, label: service.name });
    grouped.set(service.folder, current);
  }

  return Array.from(grouped.entries()).map(([folder, items]) => ({ folder, items }));
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
