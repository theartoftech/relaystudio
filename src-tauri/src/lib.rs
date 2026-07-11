use serde::{Deserialize, Serialize};
use serde_json::Value;
use std::collections::HashMap;
use std::ffi::OsString;
use std::fs;
use std::path::{Path, PathBuf};
use std::time::{Duration, Instant};
use tauri::menu::{CheckMenuItemBuilder, MenuBuilder, MenuItemBuilder, SubmenuBuilder};
use tauri::{Emitter, Manager};

const PROJECT_FORMAT: &str = "relay-studio-restproj";
const PROJECT_SCHEMA_VERSION: u16 = 1;
const SAVED_RESPONSE_FORMAT: &str = "relay-studio-response";
const SAVED_RESPONSE_SCHEMA_VERSION: u16 = 1;
const MENU_APP_SEARCH_COMMANDS: &str = "app.search_commands";
const MENU_APP_OPEN_SETTINGS: &str = "app.open_settings";
const MENU_FILE_NEW_PROJECT: &str = "file.new_project";
const MENU_OPEN_PROJECT: &str = "file.open_project";
const MENU_SHOW_RECENT_PROJECTS: &str = "file.show_recent_projects";
const MENU_OPEN_RECENT_PREFIX: &str = "file.open_recent.";
const MENU_FILE_SAVE_PROJECT: &str = "file.save_project";
const MENU_FILE_SAVE_PROJECT_AS: &str = "file.save_project_as";
const MENU_FILE_EXIT: &str = "file.exit";
const MENU_WINDOW_CLOSE_ACTIVE_TAB: &str = "window.close_active_tab";
const MENU_WINDOW_CLOSE_WINDOW: &str = "window.close_window";
const MENU_REQUEST_SEND_ACTIVE: &str = "request.send_active";
const MENU_FLOW_RUN_ACTIVE: &str = "flow.run_active";
const MENU_VIEW_TOGGLE_EXPLORER: &str = "view.toggle_explorer";
const MENU_VIEW_TOGGLE_INSPECTOR: &str = "view.toggle_inspector";
const MENU_VIEW_TOGGLE_RESPONSE_DOCK: &str = "view.toggle_response_dock";
const MENU_VIEW_TOGGLE_FLOW_DETAILS: &str = "view.toggle_flow_details";
const SHELL_COMMAND_EVENT: &str = "relay-shell-command";

#[derive(Debug, Serialize, Deserialize, Clone, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
struct RecentProject {
    name: String,
    path: String,
    opened_at: String,
}

#[derive(Debug, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
struct HttpRequestInput {
    method: String,
    url: String,
    headers: HashMap<String, String>,
    body: Option<String>,
    timeout_ms: u64,
    http_version: Option<String>,
    ssl_certificate_verification: Option<bool>,
    ssl_tls_key_log: Option<bool>,
    disable_cookies: Option<bool>,
    proxy: Option<ProxySettingsInput>,
}

#[derive(Debug, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
struct ProxySettingsInput {
    enabled: bool,
    use_for_http: bool,
    use_for_https: bool,
    server_url: String,
    port: u16,
    basic_auth_enabled: bool,
    username: String,
    password: String,
    bypass_list: String,
}

#[derive(Debug, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
struct HttpResponseOutput {
    status: u16,
    status_text: String,
    headers: HashMap<String, String>,
    body: String,
    duration_ms: u128,
}

#[derive(Debug, Serialize, Deserialize, Clone, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
struct ShellCommandEventPayload {
    id: String,
    recent_project: Option<RecentProject>,
    checked: Option<bool>,
}

#[derive(Debug, Serialize, Deserialize, Clone, PartialEq, Eq, Default)]
#[serde(rename_all = "camelCase")]
struct ShellMenuState {
    active_tab_kind: String,
    has_dirty_state: bool,
    can_save_project: bool,
    can_close_active_tab: bool,
    can_send_request: bool,
    can_run_flow: bool,
    explorer_open: bool,
    inspector_open: bool,
    response_dock_open: bool,
    flow_details_open: bool,
}

#[tauri::command]
fn app_version() -> String {
    env!("CARGO_PKG_VERSION").to_string()
}

#[tauri::command]
fn default_project_directory(app: tauri::AppHandle) -> Result<String, String> {
    let document_dir = app
        .path()
        .document_dir()
        .map_err(|error| format!("Could not resolve the documents directory: {error}"))?;
    Ok(default_project_directory_for(&document_dir))
}

#[tauri::command]
fn save_project_file(path: String, project: Value) -> Result<(), String> {
    save_project_file_impl(Path::new(&path), &project)
}

#[tauri::command]
fn open_project_file(path: String) -> Result<Value, String> {
    open_project_file_impl(Path::new(&path))
}

#[tauri::command]
fn project_file_exists(path: String) -> Result<bool, String> {
    let project_path = Path::new(&path);
    validate_project_path(project_path)?;
    Ok(project_path.exists())
}

#[tauri::command]
fn rename_project_file(path: String, name: String) -> Result<(), String> {
    rename_project_file_impl(Path::new(&path), &name)
}

#[tauri::command]
fn delete_project_file(path: String) -> Result<(), String> {
    delete_project_file_impl(Path::new(&path))
}

#[tauri::command]
fn list_recent_projects() -> Result<Vec<RecentProject>, String> {
    read_recent_projects()
}

#[tauri::command]
fn remember_recent_project(project: RecentProject) -> Result<(), String> {
    remember_recent_project_impl(project)
}

#[tauri::command]
fn forget_recent_project(path: String) -> Result<(), String> {
    let project_path = Path::new(&path);
    validate_project_path(project_path)?;
    forget_recent_project_impl(project_path)
}

#[tauri::command]
fn refresh_app_menu(app: tauri::AppHandle, state: Option<ShellMenuState>) -> Result<(), String> {
    set_app_menu(&app, &state.unwrap_or_default())
}

#[tauri::command]
async fn execute_http_request(request: HttpRequestInput) -> Result<HttpResponseOutput, String> {
    execute_http_request_impl(request).await
}

#[tauri::command]
fn save_response_file(path: String, overwrite: bool, artifact: Value) -> Result<(), String> {
    save_response_file_impl(Path::new(&path), overwrite, &artifact)
}

#[tauri::command]
fn read_response_file(metadata: Value) -> Result<Value, String> {
    read_response_file_impl(&metadata)
}

#[tauri::command]
fn response_file_exists(path: String) -> Result<bool, String> {
    let response_path = Path::new(&path);
    validate_response_path(response_path)?;
    Ok(response_path.exists())
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_dialog::init())
        .invoke_handler(tauri::generate_handler![
            app_version,
            default_project_directory,
            save_project_file,
            open_project_file,
            project_file_exists,
            rename_project_file,
            delete_project_file,
            list_recent_projects,
            remember_recent_project,
            forget_recent_project,
            refresh_app_menu,
            execute_http_request,
            save_response_file,
            read_response_file,
            response_file_exists
        ])
        .setup(|app| {
            set_app_menu(app.handle(), &ShellMenuState::default())?;
            Ok(())
        })
        .on_menu_event(|app, event| {
            handle_app_menu_event(app, event.id().as_ref());
        })
        .run(tauri::generate_context!())
        .expect("error while running Relay Studio");
}

fn set_app_menu(app: &tauri::AppHandle, state: &ShellMenuState) -> Result<(), String> {
    let mut recent_menu_builder = SubmenuBuilder::new(app, "Open Recent");
    let recent_projects = read_recent_projects().unwrap_or_default();
    if recent_projects.is_empty() {
        let empty_recent = MenuItemBuilder::with_id("file.open_recent.empty", "No Recent Projects")
            .enabled(false)
            .build(app)
            .map_err(|error| format!("Could not build empty recent menu item: {error}"))?;
        recent_menu_builder = recent_menu_builder.item(&empty_recent);
    } else {
        for (index, project) in recent_projects.iter().take(10).enumerate() {
            let recent_item = MenuItemBuilder::with_id(
                format!("{MENU_OPEN_RECENT_PREFIX}{index}"),
                format!("{} - {}", project.name, project.path),
            )
            .build(app)
            .map_err(|error| format!("Could not build recent projects item: {error}"))?;
            recent_menu_builder = recent_menu_builder.item(&recent_item);
        }
    }
    let recent_menu = recent_menu_builder
        .build()
        .map_err(|error| format!("Could not build recent projects menu: {error}"))?;

    let search_commands = MenuItemBuilder::with_id(MENU_APP_SEARCH_COMMANDS, "Search Commands")
        .accelerator("CmdOrCtrl+K")
        .build(app)
        .map_err(|error| format!("Could not build search commands menu item: {error}"))?;
    let settings = MenuItemBuilder::with_id(MENU_APP_OPEN_SETTINGS, "Settings")
        .accelerator("CmdOrCtrl+,")
        .build(app)
        .map_err(|error| format!("Could not build settings menu item: {error}"))?;
    let new_project = MenuItemBuilder::with_id(MENU_FILE_NEW_PROJECT, "New Project")
        .accelerator("CmdOrCtrl+N")
        .build(app)
        .map_err(|error| format!("Could not build new project menu item: {error}"))?;
    let open_project = MenuItemBuilder::with_id(MENU_OPEN_PROJECT, "Open Project...")
        .accelerator("CmdOrCtrl+O")
        .build(app)
        .map_err(|error| format!("Could not build open project menu item: {error}"))?;
    let show_recent_projects =
        MenuItemBuilder::with_id(MENU_SHOW_RECENT_PROJECTS, "Open Recent Projects...")
            .build(app)
            .map_err(|error| format!("Could not build open recent projects menu item: {error}"))?;
    let save_project = MenuItemBuilder::with_id(MENU_FILE_SAVE_PROJECT, "Save Project")
        .accelerator("CmdOrCtrl+S")
        .enabled(state.can_save_project)
        .build(app)
        .map_err(|error| format!("Could not build save project menu item: {error}"))?;
    let save_project_as = MenuItemBuilder::with_id(MENU_FILE_SAVE_PROJECT_AS, "Save Project As...")
        .accelerator("CmdOrCtrl+Shift+S")
        .enabled(state.can_save_project)
        .build(app)
        .map_err(|error| format!("Could not build save-as menu item: {error}"))?;
    let exit_app = MenuItemBuilder::with_id(MENU_FILE_EXIT, "Exit")
        .build(app)
        .map_err(|error| format!("Could not build exit menu item: {error}"))?;
    let send_request = MenuItemBuilder::with_id(MENU_REQUEST_SEND_ACTIVE, "Send Request")
        .accelerator("CmdOrCtrl+Enter")
        .enabled(state.can_send_request)
        .build(app)
        .map_err(|error| format!("Could not build send request menu item: {error}"))?;
    let run_flow = MenuItemBuilder::with_id(MENU_FLOW_RUN_ACTIVE, "Run Flow")
        .accelerator("CmdOrCtrl+Enter")
        .enabled(state.can_run_flow)
        .build(app)
        .map_err(|error| format!("Could not build run flow menu item: {error}"))?;
    let close_active_tab =
        MenuItemBuilder::with_id(MENU_WINDOW_CLOSE_ACTIVE_TAB, "Close Tab")
            .accelerator("CmdOrCtrl+W")
            .enabled(state.can_close_active_tab)
            .build(app)
            .map_err(|error| format!("Could not build close tab menu item: {error}"))?;
    let close_window = MenuItemBuilder::with_id(MENU_WINDOW_CLOSE_WINDOW, "Close Window")
        .accelerator("CmdOrCtrl+Shift+W")
        .build(app)
        .map_err(|error| format!("Could not build close window menu item: {error}"))?;
    let toggle_explorer =
        CheckMenuItemBuilder::with_id(MENU_VIEW_TOGGLE_EXPLORER, "Toggle Sidebar")
            .accelerator("CmdOrCtrl+Alt+1")
            .checked(state.explorer_open)
            .build(app)
            .map_err(|error| format!("Could not build sidebar toggle menu item: {error}"))?;
    let toggle_inspector =
        CheckMenuItemBuilder::with_id(MENU_VIEW_TOGGLE_INSPECTOR, "Toggle Inspector")
            .accelerator("CmdOrCtrl+Alt+2")
            .checked(state.inspector_open)
            .build(app)
            .map_err(|error| format!("Could not build inspector toggle menu item: {error}"))?;
    let toggle_response_dock = CheckMenuItemBuilder::with_id(
        MENU_VIEW_TOGGLE_RESPONSE_DOCK,
        "Toggle Response Dock",
    )
    .accelerator("CmdOrCtrl+Alt+3")
    .enabled(shell_menu_supports_response_dock(state))
    .checked(state.response_dock_open)
    .build(app)
    .map_err(|error| format!("Could not build response dock toggle menu item: {error}"))?;
    let toggle_flow_details = CheckMenuItemBuilder::with_id(
        MENU_VIEW_TOGGLE_FLOW_DETAILS,
        "Toggle Flow Details",
    )
    .accelerator("CmdOrCtrl+Alt+4")
    .enabled(shell_menu_supports_flow_details(state))
    .checked(state.flow_details_open)
    .build(app)
    .map_err(|error| format!("Could not build flow details toggle menu item: {error}"))?;

    let mut file_menu_builder = SubmenuBuilder::new(app, "File")
        .item(&new_project)
        .item(&open_project)
        .item(&show_recent_projects)
        .item(&recent_menu)
        .separator()
        .item(&save_project)
        .item(&save_project_as)
        .separator()
        .item(&send_request)
        .item(&run_flow)
        .separator()
        .item(&close_active_tab);
    if !cfg!(target_os = "macos") {
        file_menu_builder = file_menu_builder
            .separator()
            .item(&settings)
            .separator()
            .item(&exit_app);
    }
    let file_menu = file_menu_builder
        .build()
        .map_err(|error| format!("Could not build file menu: {error}"))?;
    let edit_menu = SubmenuBuilder::new(app, "Edit")
        .undo()
        .redo()
        .separator()
        .cut()
        .copy()
        .paste()
        .select_all()
        .build()
        .map_err(|error| format!("Could not build edit menu: {error}"))?;

    let view_menu = SubmenuBuilder::new(app, "View")
        .item(&toggle_explorer)
        .item(&toggle_inspector)
        .item(&toggle_response_dock)
        .item(&toggle_flow_details)
        .build()
        .map_err(|error| format!("Could not build view menu: {error}"))?;
    let window_menu = SubmenuBuilder::new(app, "Window")
        .minimize()
        .maximize()
        .separator()
        .fullscreen()
        .separator()
        .item(&close_window)
        .build()
        .map_err(|error| format!("Could not build window menu: {error}"))?;
    let help_menu = SubmenuBuilder::new(app, "Help")
        .item(&search_commands)
        .build()
        .map_err(|error| format!("Could not build help menu: {error}"))?;

    let mut app_menu_builder = MenuBuilder::new(app);
    if cfg!(target_os = "macos") {
        let app_shell_menu = SubmenuBuilder::new(app, "Relay Studio")
            .about(None)
            .separator()
            .item(&settings)
            .separator()
            .services()
            .separator()
            .hide()
            .hide_others()
            .separator()
            .quit()
            .build()
            .map_err(|error| format!("Could not build app shell menu: {error}"))?;
        app_menu_builder = app_menu_builder.item(&app_shell_menu);
    }
    let app_menu = app_menu_builder
        .item(&file_menu)
        .item(&edit_menu)
        .item(&view_menu)
        .item(&window_menu)
        .item(&help_menu)
        .build()
        .map_err(|error| format!("Could not build application menu: {error}"))?;
    app.set_menu(app_menu)
        .map_err(|error| format!("Could not set application menu: {error}"))?;
    Ok(())
}

fn handle_app_menu_event(app: &tauri::AppHandle, id: &str) {
    let recent_projects = if id.starts_with(MENU_OPEN_RECENT_PREFIX) {
        read_recent_projects().unwrap_or_default()
    } else {
        Vec::new()
    };
    if let Some(mut payload) = shell_command_payload_for_menu_id(id, &recent_projects) {
        payload.checked = checked_state_for_menu_id(app, id);
        let _ = app.emit(SHELL_COMMAND_EVENT, payload);
    }
}

fn checked_state_for_menu_id(app: &tauri::AppHandle, id: &str) -> Option<bool> {
    app.menu()?
        .get(id)?
        .as_check_menuitem()?
        .is_checked()
        .ok()
}

fn shell_command_payload_for_menu_id(
    id: &str,
    recent_projects: &[RecentProject],
) -> Option<ShellCommandEventPayload> {
    if is_shell_command_menu_id(id) {
        return Some(ShellCommandEventPayload {
            id: id.to_string(),
            recent_project: None,
            checked: None,
        });
    }
    let index_text = id.strip_prefix(MENU_OPEN_RECENT_PREFIX)?;
    let index = index_text.parse::<usize>().ok()?;
    recent_projects
        .get(index)
        .cloned()
        .map(|project| ShellCommandEventPayload {
            id: format!("{MENU_OPEN_RECENT_PREFIX}{index}"),
            recent_project: Some(project),
            checked: None,
        })
}

fn is_shell_command_menu_id(id: &str) -> bool {
    matches!(
        id,
        MENU_APP_SEARCH_COMMANDS
            | MENU_APP_OPEN_SETTINGS
            | MENU_FILE_NEW_PROJECT
            | MENU_OPEN_PROJECT
            | MENU_SHOW_RECENT_PROJECTS
            | MENU_FILE_SAVE_PROJECT
            | MENU_FILE_SAVE_PROJECT_AS
            | MENU_FILE_EXIT
            | MENU_WINDOW_CLOSE_ACTIVE_TAB
            | MENU_WINDOW_CLOSE_WINDOW
            | MENU_REQUEST_SEND_ACTIVE
            | MENU_FLOW_RUN_ACTIVE
            | MENU_VIEW_TOGGLE_EXPLORER
            | MENU_VIEW_TOGGLE_INSPECTOR
            | MENU_VIEW_TOGGLE_RESPONSE_DOCK
            | MENU_VIEW_TOGGLE_FLOW_DETAILS
    )
}

fn shell_menu_supports_response_dock(state: &ShellMenuState) -> bool {
    !matches!(
        state.active_tab_kind.as_str(),
        "welcome" | "settings" | "import"
    )
}

fn shell_menu_supports_flow_details(state: &ShellMenuState) -> bool {
    state.active_tab_kind == "flow"
}

fn apply_proxy_settings(
    mut builder: reqwest::ClientBuilder,
    proxy: Option<&ProxySettingsInput>,
) -> Result<reqwest::ClientBuilder, String> {
    let Some(proxy_settings) = proxy else {
        return Ok(builder);
    };
    if !proxy_settings.enabled || proxy_settings.server_url.trim().is_empty() {
        return Ok(builder);
    }
    let endpoint = proxy_endpoint(proxy_settings);
    if proxy_settings.use_for_http && proxy_settings.use_for_https {
        return Ok(builder.proxy(build_proxy(&endpoint, proxy_settings, "all")?));
    }
    if proxy_settings.use_for_http {
        builder = builder.proxy(build_proxy(&endpoint, proxy_settings, "http")?);
    }
    if proxy_settings.use_for_https {
        builder = builder.proxy(build_proxy(&endpoint, proxy_settings, "https")?);
    }
    Ok(builder)
}

fn build_proxy(
    endpoint: &str,
    settings: &ProxySettingsInput,
    scope: &str,
) -> Result<reqwest::Proxy, String> {
    let proxy = match scope {
        "http" => reqwest::Proxy::http(endpoint),
        "https" => reqwest::Proxy::https(endpoint),
        _ => reqwest::Proxy::all(endpoint),
    }
    .map_err(|error| format!("Invalid proxy configuration: {error}"))?;
    if settings.basic_auth_enabled {
        Ok(proxy.basic_auth(&settings.username, &settings.password))
    } else {
        Ok(proxy)
    }
}

fn proxy_endpoint(settings: &ProxySettingsInput) -> String {
    let server = settings.server_url.trim();
    if server.contains("://") {
        server.to_string()
    } else {
        format!("http://{}:{}", server, settings.port)
    }
}

async fn execute_http_request_impl(
    request: HttpRequestInput,
) -> Result<HttpResponseOutput, String> {
    validate_http_request(&request)?;

    let method = reqwest::Method::from_bytes(request.method.as_bytes())
        .map_err(|_| format!("Unsupported HTTP method: {}", request.method))?;
    let mut client_builder = reqwest::Client::builder()
        .timeout(Duration::from_millis(request.timeout_ms));
    if request.ssl_certificate_verification == Some(false) {
        client_builder = client_builder.danger_accept_invalid_certs(true);
    }
    if request.http_version.as_deref() == Some("http1") {
        client_builder = client_builder.http1_only();
    }
    client_builder = apply_proxy_settings(client_builder, request.proxy.as_ref())?;
    let client = client_builder
        .build()
        .map_err(|error| format!("Could not create HTTP client: {error}"))?;

    let mut builder = client.request(method, &request.url);
    for (name, value) in &request.headers {
        builder = builder.header(name, value);
    }
    if let Some(body) = request.body {
        builder = builder.body(body);
    }

    let started = Instant::now();
    let response = builder.send().await.map_err(|error| {
        if error.is_timeout() {
            "Request timed out.".to_string()
        } else if error.is_connect() {
            format!("Network connection failed: {error}")
        } else {
            format!("HTTP request failed: {error}")
        }
    })?;
    let status = response.status();
    let status_text = status.canonical_reason().unwrap_or("").to_string();
    let headers = response
        .headers()
        .iter()
        .map(|(name, value)| {
            (
                name.to_string(),
                value.to_str().unwrap_or("<binary header>").to_string(),
            )
        })
        .collect();
    let body = response
        .text()
        .await
        .map_err(|error| format!("Could not read response body: {error}"))?;

    Ok(HttpResponseOutput {
        status: status.as_u16(),
        status_text,
        headers,
        body,
        duration_ms: started.elapsed().as_millis(),
    })
}

fn validate_http_request(request: &HttpRequestInput) -> Result<(), String> {
    match request.method.as_str() {
        "GET" | "POST" | "PUT" | "DELETE" => {}
        method => return Err(format!("Unsupported HTTP method: {method}")),
    }
    if !(request.url.starts_with("http://") || request.url.starts_with("https://")) {
        return Err("Request URL must start with http:// or https://.".to_string());
    }
    if request.timeout_ms == 0 || request.timeout_ms > 300_000 {
        return Err("Request timeout must be between 1 ms and 300000 ms.".to_string());
    }
    Ok(())
}

fn save_project_file_impl(path: &Path, project: &Value) -> Result<(), String> {
    validate_project_path(path)?;
    validate_project_schema(project)?;

    let serialized = serde_json::to_vec_pretty(project)
        .map_err(|error| format!("Project serialization failed: {error}"))?;

    if let Some(parent) = path.parent() {
        fs::create_dir_all(parent)
            .map_err(|error| format!("Could not create project directory: {error}"))?;
    }

    if path.exists() {
        let backup_path = backup_path_for(path);
        fs::copy(path, &backup_path)
            .map_err(|error| format!("Could not create project backup: {error}"))?;
    }

    let temp_path = temp_path_for(path);
    fs::write(&temp_path, serialized)
        .map_err(|error| format!("Could not write temporary project file: {error}"))?;
    fs::rename(&temp_path, path)
        .map_err(|error| format!("Could not finalize project save: {error}"))?;

    Ok(())
}

fn open_project_file_impl(path: &Path) -> Result<Value, String> {
    validate_project_path(path)?;

    let raw = fs::read(path).map_err(|error| {
        if error.kind() == std::io::ErrorKind::NotFound {
            format!("Project file was not found: {}", path.display())
        } else {
            format!("Could not read project file: {error}")
        }
    })?;
    let project: Value = serde_json::from_slice(&raw)
        .map_err(|error| format!("Project file is corrupted or unsupported: {error}"))?;
    if project.get("encryption").is_some() && project.get("ciphertext").is_some() {
        return Err("Password-protected project files are no longer supported.".to_string());
    }
    validate_project_schema(&project)?;

    Ok(project)
}

fn rename_project_file_impl(path: &Path, name: &str) -> Result<(), String> {
    validate_project_path(path)?;
    validate_project_name(name)?;
    let mut project = open_project_file_impl(path)?;
    let object = project
        .as_object_mut()
        .ok_or_else(|| "Project file payload must be a JSON object.".to_string())?;
    object.insert("name".to_string(), Value::String(name.trim().to_string()));
    save_project_file_impl(path, &project)?;
    rename_recent_project_impl(path, name.trim())
}

fn delete_project_file_impl(path: &Path) -> Result<(), String> {
    validate_project_path(path)?;
    fs::remove_file(path).map_err(|error| {
        if error.kind() == std::io::ErrorKind::NotFound {
            format!("Project file was not found: {}", path.display())
        } else {
            format!("Could not delete project file: {error}")
        }
    })?;
    forget_recent_project_impl(path)
}

fn validate_project_path(path: &Path) -> Result<(), String> {
    if path.as_os_str().is_empty() {
        return Err("Project path is required.".to_string());
    }
    if path.extension().and_then(|ext| ext.to_str()) != Some("restproj") {
        return Err("Project file must use the .restproj extension.".to_string());
    }
    Ok(())
}

fn default_project_directory_for(document_dir: &Path) -> String {
    document_dir.join("relaystudio").display().to_string()
}

fn validate_project_name(name: &str) -> Result<(), String> {
    if name.trim().is_empty() {
        return Err("Project name is required.".to_string());
    }
    Ok(())
}

fn validate_project_schema(project: &Value) -> Result<(), String> {
    if project.get("format").and_then(Value::as_str) != Some(PROJECT_FORMAT) {
        return Err("Unsupported project file format.".to_string());
    }
    if project.get("schemaVersion").and_then(Value::as_u64) != Some(PROJECT_SCHEMA_VERSION.into()) {
        return Err("Unsupported project schema version.".to_string());
    }
    Ok(())
}

fn validate_response_path(path: &Path) -> Result<(), String> {
    if path.as_os_str().is_empty() {
        return Err("Saved response path is required.".to_string());
    }
    match path.extension().and_then(|ext| ext.to_str()) {
        Some("json") | Some("txt") => Ok(()),
        _ => Err("Saved response file must use the .json or .txt extension.".to_string()),
    }
}

fn save_response_file_impl(path: &Path, overwrite: bool, artifact: &Value) -> Result<(), String> {
    validate_response_path(path)?;
    validate_response_artifact(artifact)?;

    if path.exists() && !overwrite {
        return Err("Saved response already exists at this path.".to_string());
    }

    if let Some(parent) = path.parent() {
        fs::create_dir_all(parent)
            .map_err(|error| format!("Could not create saved response directory: {error}"))?;
    }

    let bytes = if path.extension().and_then(|ext| ext.to_str()) == Some("txt") {
        artifact
            .get("body")
            .and_then(Value::as_str)
            .ok_or_else(|| "Saved response body is required.".to_string())?
            .as_bytes()
            .to_vec()
    } else {
        serde_json::to_vec_pretty(artifact)
            .map_err(|error| format!("Saved response serialization failed: {error}"))?
    };
    let temp_path = response_temp_path_for(path);
    fs::write(&temp_path, bytes)
        .map_err(|error| format!("Could not write temporary saved response file: {error}"))?;
    fs::rename(&temp_path, path)
        .map_err(|error| format!("Could not finalize saved response file: {error}"))?;
    Ok(())
}

fn read_response_file_impl(metadata: &Value) -> Result<Value, String> {
    let path_text = metadata
        .get("filePath")
        .and_then(Value::as_str)
        .ok_or_else(|| "Saved response metadata file path is required.".to_string())?;
    let path = Path::new(path_text);
    validate_response_path(path)?;

    let raw = fs::read_to_string(path).map_err(|error| {
        if error.kind() == std::io::ErrorKind::NotFound {
            format!("Saved response was not found: {}", path.display())
        } else {
            format!("Could not read saved response file: {error}")
        }
    })?;

    let artifact = if path.extension().and_then(|ext| ext.to_str()) == Some("txt") {
        serde_json::json!({
            "format": SAVED_RESPONSE_FORMAT,
            "schemaVersion": SAVED_RESPONSE_SCHEMA_VERSION,
            "metadata": metadata,
            "body": raw
        })
    } else {
        serde_json::from_str::<Value>(&raw)
            .map_err(|error| format!("Saved response file is corrupted or unsupported: {error}"))?
    };

    validate_response_artifact(&artifact)?;
    Ok(artifact)
}

fn validate_response_artifact(artifact: &Value) -> Result<(), String> {
    if artifact.get("format").and_then(Value::as_str) != Some(SAVED_RESPONSE_FORMAT) {
        return Err("Unsupported saved response file format.".to_string());
    }
    if artifact.get("schemaVersion").and_then(Value::as_u64)
        != Some(SAVED_RESPONSE_SCHEMA_VERSION.into())
    {
        return Err("Unsupported saved response schema version.".to_string());
    }
    let metadata = artifact
        .get("metadata")
        .ok_or_else(|| "Saved response metadata is required.".to_string())?;
    let file_path = metadata
        .get("filePath")
        .and_then(Value::as_str)
        .ok_or_else(|| "Saved response metadata file path is required.".to_string())?;
    validate_response_path(Path::new(file_path))?;
    if artifact.get("body").and_then(Value::as_str).is_none() {
        return Err("Saved response body is required.".to_string());
    }
    Ok(())
}

fn temp_path_for(path: &Path) -> PathBuf {
    path.with_extension("restproj.tmp")
}

fn backup_path_for(path: &Path) -> PathBuf {
    path.with_extension("restproj.bak")
}

fn response_temp_path_for(path: &Path) -> PathBuf {
    let extension = path
        .extension()
        .and_then(|ext| ext.to_str())
        .unwrap_or("tmp");
    path.with_extension(format!("{extension}.tmp"))
}

fn recent_projects_path() -> Result<PathBuf, String> {
    let home = home_directory_from(|name| std::env::var_os(name))
        .ok_or_else(|| "The user home directory is not available.".to_string())?;
    Ok(home
        .join(".relaystudio")
        .join("recent-projects.json"))
}

fn home_directory_from(get_env: impl Fn(&str) -> Option<OsString>) -> Option<PathBuf> {
    if let Some(home) = get_env("HOME").filter(|value| !value.is_empty()) {
        return Some(PathBuf::from(home));
    }
    if let Some(profile) = get_env("USERPROFILE").filter(|value| !value.is_empty()) {
        return Some(PathBuf::from(profile));
    }

    let drive = get_env("HOMEDRIVE").filter(|value| !value.is_empty())?;
    let path = get_env("HOMEPATH").filter(|value| !value.is_empty())?;
    Some(PathBuf::from(format!(
        "{}{}",
        drive.to_string_lossy(),
        path.to_string_lossy()
    )))
}

fn read_recent_projects() -> Result<Vec<RecentProject>, String> {
    let path = recent_projects_path()?;
    if !path.exists() {
        return Ok(Vec::new());
    }
    let raw =
        fs::read(&path).map_err(|error| format!("Could not read recent projects: {error}"))?;
    serde_json::from_slice(&raw)
        .map_err(|error| format!("Recent projects file is invalid: {error}"))
}

fn remember_recent_project_impl(project: RecentProject) -> Result<(), String> {
    let mut recent = read_recent_projects().unwrap_or_default();
    recent.retain(|item| item.path != project.path);
    recent.insert(0, project);
    recent.truncate(10);
    write_recent_projects(&recent)
}

fn rename_recent_project_impl(path: &Path, name: &str) -> Result<(), String> {
    let path_text = path.to_string_lossy().to_string();
    let recent = read_recent_projects()
        .unwrap_or_default()
        .into_iter()
        .map(|project| {
            if project.path == path_text {
                RecentProject {
                    name: name.to_string(),
                    ..project
                }
            } else {
                project
            }
        })
        .collect::<Vec<_>>();
    write_recent_projects(&recent)
}

fn forget_recent_project_impl(path: &Path) -> Result<(), String> {
    let path_text = path.to_string_lossy().to_string();
    let mut recent = read_recent_projects().unwrap_or_default();
    recent.retain(|project| project.path != path_text);
    write_recent_projects(&recent)
}

fn write_recent_projects(recent: &[RecentProject]) -> Result<(), String> {
    let path = recent_projects_path()?;
    if let Some(parent) = path.parent() {
        fs::create_dir_all(parent)
            .map_err(|error| format!("Could not create recent projects directory: {error}"))?;
    }
    let serialized = serde_json::to_vec_pretty(&recent)
        .map_err(|error| format!("Could not serialize recent projects: {error}"))?;
    fs::write(path, serialized).map_err(|error| format!("Could not write recent projects: {error}"))
}

#[cfg(test)]
mod tests {
    use super::*;
    use serde_json::json;
    use tempfile::tempdir;

    #[test]
    fn exposes_package_version() {
        assert_eq!(app_version(), env!("CARGO_PKG_VERSION"));
    }

    #[test]
    fn resolves_windows_home_without_home_environment_variable() {
        let home = home_directory_from(|name| match name {
            "USERPROFILE" => Some(OsString::from(r"C:\Users\JeffHaynes")),
            _ => None,
        });

        assert_eq!(home, Some(PathBuf::from(r"C:\Users\JeffHaynes")));
    }

    #[test]
    fn resolves_windows_home_from_drive_and_path() {
        let home = home_directory_from(|name| match name {
            "HOMEDRIVE" => Some(OsString::from("G:")),
            "HOMEPATH" => Some(OsString::from(r"\Jeff OneDrive")),
            _ => None,
        });

        assert_eq!(home, Some(PathBuf::from(r"G:\Jeff OneDrive")));
    }

    #[test]
    fn default_capabilities_allow_window_close_lifecycle() {
        let capabilities: Value = serde_json::from_str(include_str!("../capabilities/default.json"))
            .expect("default capabilities should be valid json");
        let permissions = capabilities["permissions"]
            .as_array()
            .expect("default capabilities should include permissions");

        assert!(permissions.iter().any(|permission| {
            permission.as_str() == Some("core:window:allow-close")
        }));
        assert!(permissions.iter().any(|permission| {
            permission.as_str() == Some("core:window:allow-destroy")
        }));
    }

    #[test]
    fn project_file_round_trips_without_password() {
        let dir = tempdir().expect("tempdir");
        let path = dir.path().join("sample.restproj");
        let project = json!({
            "format": "relay-studio-restproj",
            "schemaVersion": 1,
            "name": "Sample API Regression",
            "variables": [{ "name": "accessToken", "value": "secret-token", "secret": true }]
        });

        save_project_file_impl(&path, &project).expect("save");
        let raw = fs::read_to_string(&path).expect("read");
        assert!(raw.contains("Sample API Regression"));

        let opened = open_project_file_impl(&path).expect("open");
        assert_eq!(opened, project);
    }

    #[test]
    fn password_protected_project_file_is_rejected() {
        let dir = tempdir().expect("tempdir");
        let path = dir.path().join("sample.restproj");
        let envelope = json!({
            "format": "relay-studio-restproj",
            "schemaVersion": 1,
            "encryption": { "algorithm": "AES-256-GCM" },
            "ciphertext": "abc123"
        });

        fs::write(
            &path,
            serde_json::to_string_pretty(&envelope).expect("serialize"),
        )
        .expect("write envelope");
        let error = open_project_file_impl(&path).expect_err("encrypted project");

        assert!(error.contains("Password-protected project files are no longer supported"));
    }

    #[test]
    fn corrupted_project_file_is_rejected() {
        let dir = tempdir().expect("tempdir");
        let path = dir.path().join("sample.restproj");
        fs::write(&path, "{not valid json").expect("write corrupted file");

        let error = open_project_file_impl(&path).expect_err("corrupted file");

        assert!(error.contains("corrupted or unsupported"));
    }

    #[test]
    fn http_request_validation_accepts_supported_requests() {
        let request = test_http_request("GET", "https://api.example.com/api/health");

        assert!(validate_http_request(&request).is_ok());
    }

    #[test]
    fn http_request_validation_rejects_unsupported_inputs() {
        let mut request = test_http_request("PATCH", "https://api.example.com/api/health");

        assert_eq!(
            validate_http_request(&request).expect_err("unsupported method"),
            "Unsupported HTTP method: PATCH"
        );

        request.method = "GET".to_string();
        request.url = "ftp://api.example.com/api/health".to_string();
        assert_eq!(
            validate_http_request(&request).expect_err("unsupported url"),
            "Request URL must start with http:// or https://."
        );

        request.url = "https://api.example.com/api/health".to_string();
        request.timeout_ms = 0;
        assert_eq!(
            validate_http_request(&request).expect_err("bad timeout"),
            "Request timeout must be between 1 ms and 300000 ms."
        );
    }

    #[test]
    fn saved_response_json_round_trips() {
        let dir = tempdir().expect("tempdir");
        let path = dir.path().join("response.json");
        let artifact = json!({
            "format": SAVED_RESPONSE_FORMAT,
            "schemaVersion": SAVED_RESPONSE_SCHEMA_VERSION,
            "metadata": {
                "id": "response-1",
                "filePath": path.to_string_lossy(),
                "fileName": "response.json"
            },
            "body": "{\"ok\":true}"
        });

        save_response_file_impl(&path, false, &artifact).expect("save response");
        let opened = read_response_file_impl(&artifact["metadata"]).expect("read response");

        assert_eq!(opened, artifact);
    }

    #[test]
    fn saved_response_raw_body_round_trips_with_metadata() {
        let dir = tempdir().expect("tempdir");
        let path = dir.path().join("response.txt");
        let artifact = json!({
            "format": SAVED_RESPONSE_FORMAT,
            "schemaVersion": SAVED_RESPONSE_SCHEMA_VERSION,
            "metadata": {
                "id": "response-1",
                "filePath": path.to_string_lossy(),
                "fileName": "response.txt"
            },
            "body": "plain response"
        });

        save_response_file_impl(&path, false, &artifact).expect("save response");

        assert_eq!(
            fs::read_to_string(&path).expect("read raw file"),
            "plain response"
        );
        assert_eq!(
            read_response_file_impl(&artifact["metadata"]).expect("read response"),
            artifact
        );
    }

    #[test]
    fn saved_response_requires_overwrite_confirmation() {
        let dir = tempdir().expect("tempdir");
        let path = dir.path().join("response.json");
        let artifact = json!({
            "format": SAVED_RESPONSE_FORMAT,
            "schemaVersion": SAVED_RESPONSE_SCHEMA_VERSION,
            "metadata": {
                "id": "response-1",
                "filePath": path.to_string_lossy(),
                "fileName": "response.json"
            },
            "body": "{}"
        });

        save_response_file_impl(&path, false, &artifact).expect("save response");
        let error = save_response_file_impl(&path, false, &artifact).expect_err("overwrite");

        assert_eq!(error, "Saved response already exists at this path.");
        assert!(save_response_file_impl(&path, true, &artifact).is_ok());
    }

    #[test]
    fn saved_response_validation_rejects_unsupported_inputs() {
        let dir = tempdir().expect("tempdir");
        let path = dir.path().join("response.html");
        let artifact = json!({
            "format": SAVED_RESPONSE_FORMAT,
            "schemaVersion": SAVED_RESPONSE_SCHEMA_VERSION,
            "metadata": {
                "filePath": path.to_string_lossy()
            },
            "body": "{}"
        });

        assert_eq!(
            validate_response_path(&path).expect_err("invalid extension"),
            "Saved response file must use the .json or .txt extension."
        );
        assert_eq!(
            validate_response_artifact(&json!({ "format": "unknown" }))
                .expect_err("invalid format"),
            "Unsupported saved response file format."
        );
        assert_eq!(
            validate_response_artifact(&artifact).expect_err("invalid artifact path"),
            "Saved response file must use the .json or .txt extension."
        );
    }

    #[test]
    fn shell_menu_disables_response_dock_for_non_workbench_tabs() {
        let hidden_state = ShellMenuState {
            active_tab_kind: "settings".to_string(),
            ..ShellMenuState::default()
        };
        let visible_state = ShellMenuState {
            active_tab_kind: "response".to_string(),
            ..ShellMenuState::default()
        };

        assert!(!shell_menu_supports_response_dock(&hidden_state));
        assert!(shell_menu_supports_response_dock(&visible_state));
    }

    #[test]
    fn shell_menu_enables_flow_details_only_for_flow_tabs() {
        let hidden_state = ShellMenuState {
            active_tab_kind: "request".to_string(),
            ..ShellMenuState::default()
        };
        let visible_state = ShellMenuState {
            active_tab_kind: "flow".to_string(),
            ..ShellMenuState::default()
        };

        assert!(!shell_menu_supports_flow_details(&hidden_state));
        assert!(shell_menu_supports_flow_details(&visible_state));
    }

    #[test]
    fn shell_menu_recognizes_contract_command_ids() {
        assert!(is_shell_command_menu_id(MENU_FILE_SAVE_PROJECT));
        assert!(is_shell_command_menu_id(MENU_FILE_EXIT));
        assert!(is_shell_command_menu_id(MENU_VIEW_TOGGLE_INSPECTOR));
        assert!(is_shell_command_menu_id(MENU_VIEW_TOGGLE_FLOW_DETAILS));
        assert!(!is_shell_command_menu_id("file.open_recent.0"));
        assert!(!is_shell_command_menu_id("unknown"));
    }

    #[test]
    fn shell_menu_payloads_cover_app_owned_menu_items() {
        let command_ids = [
            MENU_APP_SEARCH_COMMANDS,
            MENU_APP_OPEN_SETTINGS,
            MENU_FILE_NEW_PROJECT,
            MENU_OPEN_PROJECT,
            MENU_SHOW_RECENT_PROJECTS,
            MENU_FILE_SAVE_PROJECT,
            MENU_FILE_SAVE_PROJECT_AS,
            MENU_FILE_EXIT,
            MENU_WINDOW_CLOSE_ACTIVE_TAB,
            MENU_WINDOW_CLOSE_WINDOW,
            MENU_REQUEST_SEND_ACTIVE,
            MENU_FLOW_RUN_ACTIVE,
            MENU_VIEW_TOGGLE_EXPLORER,
            MENU_VIEW_TOGGLE_INSPECTOR,
            MENU_VIEW_TOGGLE_RESPONSE_DOCK,
            MENU_VIEW_TOGGLE_FLOW_DETAILS,
        ];

        for id in command_ids {
            let payload = shell_command_payload_for_menu_id(id, &[])
                .unwrap_or_else(|| panic!("Missing payload for menu id {id}"));
            assert_eq!(payload.id, id);
            assert_eq!(payload.recent_project, None);
        }
    }

    #[test]
    fn shell_menu_payloads_route_recent_project_submenu_items() {
        let recent_projects = vec![RecentProject {
            name: "Test Project 4".to_string(),
            path: "/private/tmp/test-project-4.restproj".to_string(),
            opened_at: "2026-06-27T22:36:08.277Z".to_string(),
        }];

        let payload = shell_command_payload_for_menu_id("file.open_recent.0", &recent_projects)
            .expect("recent project payload");
        assert_eq!(payload.id, "file.open_recent.0");
        assert_eq!(payload.recent_project, Some(recent_projects[0].clone()));
        assert!(shell_command_payload_for_menu_id("file.open_recent.1", &recent_projects).is_none());
        assert!(shell_command_payload_for_menu_id("file.open_recent.foo", &recent_projects).is_none());
    }

    #[test]
    fn default_project_directory_uses_relaystudio_under_documents() {
        let directory = default_project_directory_for(Path::new("C:\\Users\\JeffHaynes\\Documents"));
        assert!(directory.ends_with("relaystudio"));
        assert!(directory.contains("Documents"));
    }

    fn test_http_request(method: &str, url: &str) -> HttpRequestInput {
        HttpRequestInput {
            method: method.to_string(),
            url: url.to_string(),
            headers: HashMap::new(),
            body: None,
            timeout_ms: 30_000,
            http_version: None,
            ssl_certificate_verification: None,
            ssl_tls_key_log: None,
            disable_cookies: None,
            proxy: None,
        }
    }
}
