#![cfg_attr(coverage_nightly, feature(coverage_attribute))]

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
const MAX_MULTIPART_FILE_BYTES: u64 = 25 * 1024 * 1024;
const MAX_HTTP_RESPONSE_BODY_BYTES: u64 = 5 * 1024 * 1024;
const MAX_PROJECT_FILE_BYTES: u64 = 4 * 1024 * 1024;
const MENU_APP_SEARCH_COMMANDS: &str = "app.search_commands";
const MENU_APP_OPEN_SETTINGS: &str = "app.open_settings";
const MENU_APP_OPEN_HELP: &str = "app.open_help";
const MENU_APP_OPEN_IMPORT: &str = "app.open_import";
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
    #[serde(default)]
    multipart_parts: Option<Vec<MultipartPartInput>>,
    timeout_ms: u64,
    http_version: Option<String>,
    ssl_certificate_verification: Option<bool>,
    ssl_tls_key_log: Option<bool>,
    disable_cookies: Option<bool>,
    proxy: Option<ProxySettingsInput>,
}

#[derive(Debug, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
struct MultipartPartInput {
    name: String,
    value: String,
    kind: String,
    content_type: Option<String>,
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
    final_url: String,
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
#[cfg_attr(coverage_nightly, coverage(off))]
fn default_project_directory(app: tauri::AppHandle) -> Result<String, String> {
    let document_dir = app
        .path()
        .document_dir()
        .map_err(|error| format!("Could not resolve the documents directory: {error}"))?;
    Ok(default_project_directory_for(&document_dir))
}

#[tauri::command]
#[cfg_attr(coverage_nightly, coverage(off))]
fn save_project_file(path: String, project: Value) -> Result<(), String> {
    save_project_file_impl(Path::new(&path), &project)
}

#[tauri::command]
#[cfg_attr(coverage_nightly, coverage(off))]
fn open_project_file(path: String) -> Result<Value, String> {
    open_project_file_impl(Path::new(&path))
}

#[tauri::command]
#[cfg_attr(coverage_nightly, coverage(off))]
fn restore_project_backup(path: String) -> Result<(), String> {
    restore_project_backup_impl(Path::new(&path))
}

#[tauri::command]
#[cfg_attr(coverage_nightly, coverage(off))]
fn project_file_exists(path: String) -> Result<bool, String> {
    let project_path = Path::new(&path);
    validate_project_path(project_path)?;
    Ok(project_path.exists())
}

#[tauri::command]
#[cfg_attr(coverage_nightly, coverage(off))]
fn rename_project_file(path: String, name: String) -> Result<(), String> {
    rename_project_file_impl(Path::new(&path), &name)
}

#[tauri::command]
#[cfg_attr(coverage_nightly, coverage(off))]
fn delete_project_file(path: String) -> Result<(), String> {
    delete_project_file_impl(Path::new(&path))
}

#[tauri::command]
#[cfg_attr(coverage_nightly, coverage(off))]
fn list_recent_projects() -> Result<Vec<RecentProject>, String> {
    read_recent_projects()
}

#[tauri::command]
#[cfg_attr(coverage_nightly, coverage(off))]
fn remember_recent_project(project: RecentProject) -> Result<(), String> {
    remember_recent_project_impl(project)
}

#[tauri::command]
#[cfg_attr(coverage_nightly, coverage(off))]
fn forget_recent_project(path: String) -> Result<(), String> {
    let project_path = Path::new(&path);
    validate_project_path(project_path)?;
    forget_recent_project_impl(project_path)
}

#[tauri::command]
#[cfg_attr(coverage_nightly, coverage(off))]
fn refresh_app_menu(app: tauri::AppHandle, state: Option<ShellMenuState>) -> Result<(), String> {
    set_app_menu(&app, &state.unwrap_or_default())
}

#[tauri::command]
#[cfg_attr(coverage_nightly, coverage(off))]
async fn execute_http_request(request: HttpRequestInput) -> Result<HttpResponseOutput, String> {
    execute_http_request_impl(request).await
}

#[tauri::command]
#[cfg_attr(coverage_nightly, coverage(off))]
fn save_response_file(path: String, overwrite: bool, artifact: Value) -> Result<(), String> {
    save_response_file_impl(Path::new(&path), overwrite, &artifact)
}

#[tauri::command]
#[cfg_attr(coverage_nightly, coverage(off))]
fn read_response_file(metadata: Value) -> Result<Value, String> {
    read_response_file_impl(&metadata)
}

#[tauri::command]
#[cfg_attr(coverage_nightly, coverage(off))]
fn response_file_exists(path: String) -> Result<bool, String> {
    let response_path = Path::new(&path);
    validate_response_path(response_path)?;
    Ok(response_path.exists())
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
#[cfg_attr(coverage_nightly, coverage(off))]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_dialog::init())
        .invoke_handler(tauri::generate_handler![
            app_version,
            default_project_directory,
            save_project_file,
            open_project_file,
            restore_project_backup,
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

#[cfg_attr(coverage_nightly, coverage(off))]
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
    let open_help = MenuItemBuilder::with_id(MENU_APP_OPEN_HELP, "Relay Studio Help")
        .build(app)
        .map_err(|error| format!("Could not build help menu item: {error}"))?;
    let open_import = MenuItemBuilder::with_id(MENU_APP_OPEN_IMPORT, "Import API Definition...")
        .build(app)
        .map_err(|error| format!("Could not build import API definition menu item: {error}"))?;
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
    let close_active_tab = MenuItemBuilder::with_id(MENU_WINDOW_CLOSE_ACTIVE_TAB, "Close Tab")
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
    let toggle_response_dock =
        CheckMenuItemBuilder::with_id(MENU_VIEW_TOGGLE_RESPONSE_DOCK, "Toggle Response Dock")
            .accelerator("CmdOrCtrl+Alt+3")
            .enabled(shell_menu_supports_response_dock(state))
            .checked(state.response_dock_open)
            .build(app)
            .map_err(|error| format!("Could not build response dock toggle menu item: {error}"))?;
    let toggle_flow_details =
        CheckMenuItemBuilder::with_id(MENU_VIEW_TOGGLE_FLOW_DETAILS, "Toggle Flow Details")
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
        .item(&open_import)
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
        .item(&open_help)
        .separator()
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

#[cfg_attr(coverage_nightly, coverage(off))]
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

#[cfg_attr(coverage_nightly, coverage(off))]
fn checked_state_for_menu_id(app: &tauri::AppHandle, id: &str) -> Option<bool> {
    app.menu()?.get(id)?.as_check_menuitem()?.is_checked().ok()
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
            | MENU_APP_OPEN_HELP
            | MENU_APP_OPEN_IMPORT
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
    let mut proxy = match scope {
        "http" => reqwest::Proxy::http(endpoint),
        "https" => reqwest::Proxy::https(endpoint),
        _ => reqwest::Proxy::all(endpoint),
    }
    .map_err(|error| format!("Invalid proxy configuration: {error}"))?;
    if !settings.bypass_list.trim().is_empty() {
        proxy = proxy.no_proxy(validated_no_proxy(&settings.bypass_list)?);
    }
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

fn validated_no_proxy(bypass_list: &str) -> Result<Option<reqwest::NoProxy>, String> {
    let trimmed = bypass_list.trim();
    if trimmed.is_empty() {
        return Ok(None);
    }
    for entry in trimmed.split(',').map(str::trim) {
        if !valid_proxy_bypass_entry(entry) {
            return Err(format!(
                "Invalid proxy bypass entry: {entry}. Use comma-separated hostnames, domains, IP addresses, CIDR ranges, or *. Ports and URL schemes are not supported."
            ));
        }
    }
    let parsed = reqwest::NoProxy::from_string(trimmed).ok_or_else(|| {
        "Proxy bypass list could not be applied. Use comma-separated hostnames, domains, IP addresses, CIDR ranges, or *.".to_string()
    })?;
    Ok(Some(parsed))
}

fn valid_proxy_bypass_entry(entry: &str) -> bool {
    if entry == "*" || entry.parse::<std::net::IpAddr>().is_ok() {
        return true;
    }
    if let Some((address, prefix)) = entry.split_once('/') {
        let Ok(address) = address.parse::<std::net::IpAddr>() else {
            return false;
        };
        let Ok(prefix) = prefix.parse::<u8>() else {
            return false;
        };
        return match address {
            std::net::IpAddr::V4(_) => prefix <= 32,
            std::net::IpAddr::V6(_) => prefix <= 128,
        };
    }
    let domain = entry.strip_prefix('.').unwrap_or(entry);
    !domain.is_empty()
        && domain.len() <= 253
        && domain.split('.').all(|label| {
            !label.is_empty()
                && label.len() <= 63
                && label
                    .bytes()
                    .all(|byte| byte.is_ascii_alphanumeric() || byte == b'-')
                && label
                    .as_bytes()
                    .first()
                    .is_some_and(u8::is_ascii_alphanumeric)
                && label
                    .as_bytes()
                    .last()
                    .is_some_and(u8::is_ascii_alphanumeric)
        })
}

async fn execute_http_request_impl(
    request: HttpRequestInput,
) -> Result<HttpResponseOutput, String> {
    validate_http_request(&request)?;

    let method = reqwest::Method::from_bytes(request.method.as_bytes())
        .map_err(|_| format!("Unsupported HTTP method: {}", request.method))?;
    let mut client_builder = reqwest::Client::builder()
        .timeout(Duration::from_millis(request.timeout_ms))
        .redirect(same_origin_redirect_policy());
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
    if let Some(parts) = request
        .multipart_parts
        .as_ref()
        .filter(|parts| !parts.is_empty())
    {
        builder = builder.multipart(build_multipart_form(parts)?);
    } else if let Some(body) = request.body {
        builder = builder.body(body);
    }

    let started = Instant::now();
    let response = builder.send().await.map_err(http_request_error)?;
    if response.status().is_redirection() {
        let current_url = response.url();
        let location = response
            .headers()
            .get(reqwest::header::LOCATION)
            .ok_or_else(|| {
                format!(
                    "Redirect response from {} did not include a Location header.",
                    current_url.origin().ascii_serialization()
                )
            })?
            .to_str()
            .map_err(|_| {
                format!(
                    "Redirect response from {} included an invalid Location header.",
                    current_url.origin().ascii_serialization()
                )
            })?;
        let destination = current_url.join(location).map_err(|_| {
            format!(
                "Redirect response from {} included an invalid Location URL.",
                current_url.origin().ascii_serialization()
            )
        })?;
        return Err(format!(
            "Cross-origin redirect blocked: {} cannot redirect to {}. Review the destination and send it explicitly.",
            current_url.origin().ascii_serialization(),
            destination.origin().ascii_serialization()
        ));
    }
    let status = response.status();
    let status_text = status.canonical_reason().unwrap_or("").to_string();
    let final_url = response.url().to_string();
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
    if response
        .content_length()
        .is_some_and(|length| length > MAX_HTTP_RESPONSE_BODY_BYTES)
    {
        return Err(format!(
            "HTTP response body exceeds the safe limit of {} MiB. Request a smaller response.",
            MAX_HTTP_RESPONSE_BODY_BYTES / (1024 * 1024)
        ));
    }
    let mut response = response;
    let mut body_bytes = Vec::new();
    while let Some(chunk) = response
        .chunk()
        .await
        .map_err(|error| format!("Could not read response body: {error}"))?
    {
        if body_bytes.len() as u64 + chunk.len() as u64 > MAX_HTTP_RESPONSE_BODY_BYTES {
            return Err(format!(
                "HTTP response body exceeds the safe limit of {} MiB. Request a smaller response.",
                MAX_HTTP_RESPONSE_BODY_BYTES / (1024 * 1024)
            ));
        }
        body_bytes.extend_from_slice(&chunk);
    }
    let body = String::from_utf8_lossy(&body_bytes).into_owned();

    Ok(HttpResponseOutput {
        status: status.as_u16(),
        status_text,
        headers,
        body,
        duration_ms: started.elapsed().as_millis(),
        final_url,
    })
}

fn same_origin_redirect_policy() -> reqwest::redirect::Policy {
    reqwest::redirect::Policy::custom(|attempt| {
        if attempt.previous().len() >= 10 {
            return attempt.error(std::io::Error::other(
                "Redirect limit exceeded after 10 requests.",
            ));
        }
        if attempt
            .previous()
            .last()
            .is_some_and(|previous| !same_origin(previous, attempt.url()))
        {
            return attempt.stop();
        }
        attempt.follow()
    })
}

fn http_request_error(error: reqwest::Error) -> String {
    if error.is_timeout() {
        return "Request timed out.".to_string();
    }
    if error.is_connect() {
        return format!("Network connection failed: {error}");
    }
    if error.is_redirect() {
        let mut source = std::error::Error::source(&error);
        while let Some(cause) = source {
            let message = cause.to_string();
            if message.contains("Redirect limit exceeded") {
                return message;
            }
            source = cause.source();
        }
        return "HTTP redirect failed. Review the redirect destination and try the final URL explicitly."
            .to_string();
    }
    format!("HTTP request failed: {error}")
}

fn same_origin(left: &reqwest::Url, right: &reqwest::Url) -> bool {
    left.scheme() == right.scheme()
        && left.host_str() == right.host_str()
        && left.port_or_known_default() == right.port_or_known_default()
}

fn validate_http_request(request: &HttpRequestInput) -> Result<(), String> {
    match request.method.as_str() {
        "GET" | "POST" | "PUT" | "PATCH" | "DELETE" | "HEAD" | "OPTIONS" => {}
        method => return Err(format!("Unsupported HTTP method: {method}")),
    }
    if !(request.url.starts_with("http://") || request.url.starts_with("https://")) {
        return Err("Request URL must start with http:// or https://.".to_string());
    }
    if request.timeout_ms == 0 || request.timeout_ms > 300_000 {
        return Err("Request timeout must be between 1 ms and 300000 ms.".to_string());
    }
    if let Some(parts) = request
        .multipart_parts
        .as_ref()
        .filter(|parts| !parts.is_empty())
    {
        if request.body.is_some() {
            return Err(
                "Multipart requests cannot include both a raw body and structured parts."
                    .to_string(),
            );
        }
        if request
            .headers
            .keys()
            .any(|name| name.eq_ignore_ascii_case("content-type"))
        {
            return Err("Do not set Content-Type manually for multipart file uploads; Relay Studio generates the boundary.".to_string());
        }
        validate_multipart_parts(parts)?;
    }
    Ok(())
}

fn validate_multipart_parts(parts: &[MultipartPartInput]) -> Result<(), String> {
    for part in parts {
        if part.name.trim().is_empty() {
            return Err("Multipart part names are required.".to_string());
        }
        if part.name.contains(['\r', '\n']) {
            return Err("Multipart part names cannot contain line breaks.".to_string());
        }
        match part.kind.as_str() {
            "text" => {}
            "file" if part.value.trim().is_empty() => {
                return Err(format!(
                    "Multipart file field '{}' requires a local file path.",
                    part.name
                ));
            }
            "file" => {}
            kind => return Err(format!("Unsupported multipart part kind: {kind}.")),
        }
    }
    Ok(())
}

fn build_multipart_form(parts: &[MultipartPartInput]) -> Result<reqwest::multipart::Form, String> {
    validate_multipart_parts(parts)?;
    let mut form = reqwest::multipart::Form::new();
    for part in parts {
        if part.kind == "text" {
            form = form.text(part.name.clone(), part.value.clone());
            continue;
        }
        let path = Path::new(&part.value);
        let metadata = fs::metadata(path).map_err(|error| {
            format!(
                "Could not access multipart file {}: {error}",
                path.display()
            )
        })?;
        if !metadata.is_file() {
            return Err(format!(
                "Multipart file path is not a file: {}",
                path.display()
            ));
        }
        if metadata.len() > MAX_MULTIPART_FILE_BYTES {
            return Err(format!(
                "Multipart file {} exceeds the 25 MB limit.",
                path.display()
            ));
        }
        let bytes = fs::read(path).map_err(|error| {
            format!("Could not read multipart file {}: {error}", path.display())
        })?;
        let file_name = path
            .file_name()
            .and_then(|name| name.to_str())
            .ok_or_else(|| format!("Multipart file name is not valid UTF-8: {}", path.display()))?;
        let mut file_part = reqwest::multipart::Part::bytes(bytes).file_name(file_name.to_string());
        if let Some(content_type) = part
            .content_type
            .as_deref()
            .filter(|value| !value.trim().is_empty())
        {
            file_part = file_part.mime_str(content_type).map_err(|error| {
                format!(
                    "Invalid multipart content type for '{}': {error}",
                    part.name
                )
            })?;
        }
        form = form.part(part.name.clone(), file_part);
    }
    Ok(form)
}

fn save_project_file_impl(path: &Path, project: &Value) -> Result<(), String> {
    validate_project_path(path)?;
    validate_project_schema(project)?;

    let serialized = serde_json::to_vec_pretty(project)
        .map_err(|error| format!("Project serialization failed: {error}"))?;
    if serialized.len() as u64 > MAX_PROJECT_FILE_BYTES {
        return Err(format!(
            "Project file exceeds the safe limit of {} MiB. Remove oversized response data before saving.",
            MAX_PROJECT_FILE_BYTES / (1024 * 1024)
        ));
    }

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

    let raw =
        read_file_with_limit(path, MAX_PROJECT_FILE_BYTES, "project file").map_err(|error| {
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

fn restore_project_backup_impl(path: &Path) -> Result<(), String> {
    validate_project_path(path)?;
    let backup_path = backup_path_for(path);
    let raw = read_file_with_limit(&backup_path, MAX_PROJECT_FILE_BYTES, "project backup")
        .map_err(|error| format!("Could not restore project backup: {error}"))?;
    let project: Value = serde_json::from_slice(&raw)
        .map_err(|error| format!("Could not restore project backup: invalid JSON: {error}"))?;
    validate_project_schema(&project)?;
    let temp_path = temp_path_for(path);
    fs::write(&temp_path, raw)
        .map_err(|error| format!("Could not write restored project: {error}"))?;
    fs::rename(&temp_path, path)
        .map_err(|error| format!("Could not finalize project restore: {error}"))
}

fn read_file_with_limit(path: &Path, limit: u64, label: &str) -> Result<Vec<u8>, std::io::Error> {
    let metadata = fs::metadata(path)?;
    if metadata.len() > limit {
        return Err(std::io::Error::other(format!(
            "{label} exceeds the safe limit of {} MiB",
            limit / (1024 * 1024)
        )));
    }
    fs::read(path)
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
    validate_response_artifact_path(path, artifact)?;

    if path.exists() && !overwrite {
        return Err("Saved response already exists at this path.".to_string());
    }

    if let Some(parent) = path.parent() {
        fs::create_dir_all(parent)
            .map_err(|error| format!("Could not create saved response directory: {error}"))?;
    }

    let bytes = serde_json::to_vec_pretty(artifact)
        .map_err(|error| format!("Saved response serialization failed: {error}"))?;
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

    let artifact = serde_json::from_str::<Value>(&raw).map_err(|error| {
        if path.extension().and_then(|ext| ext.to_str()) == Some("txt") {
            "Legacy raw .txt response artifacts cannot be reopened safely. Re-send the request and save a new response artifact.".to_string()
        } else {
            format!("Saved response file is corrupted or unsupported: {error}")
        }
    })?;

    validate_response_artifact(&artifact)?;
    validate_response_artifact_path(path, &artifact)?;
    Ok(artifact)
}

fn validate_response_artifact_path(path: &Path, artifact: &Value) -> Result<(), String> {
    let artifact_path = artifact
        .get("metadata")
        .and_then(|value| value.get("filePath"))
        .and_then(Value::as_str)
        .ok_or_else(|| "Saved response metadata file path is required.".to_string())?;
    if Path::new(artifact_path) != path {
        return Err("Saved response artifact path does not match the approved project metadata. Re-send the request and save a new response artifact.".to_string());
    }
    Ok(())
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

#[cfg_attr(coverage_nightly, coverage(off))]
fn recent_projects_path() -> Result<PathBuf, String> {
    let home = home_directory_from(|name| std::env::var_os(name))
        .ok_or_else(|| "The user home directory is not available.".to_string())?;
    Ok(home.join(".relaystudio").join("recent-projects.json"))
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

#[cfg_attr(coverage_nightly, coverage(off))]
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

#[cfg_attr(coverage_nightly, coverage(off))]
fn remember_recent_project_impl(project: RecentProject) -> Result<(), String> {
    let mut recent = read_recent_projects().unwrap_or_default();
    recent.retain(|item| item.path != project.path);
    recent.insert(0, project);
    recent.truncate(10);
    write_recent_projects(&recent)
}

#[cfg_attr(coverage_nightly, coverage(off))]
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

#[cfg_attr(coverage_nightly, coverage(off))]
fn forget_recent_project_impl(path: &Path) -> Result<(), String> {
    let path_text = path.to_string_lossy().to_string();
    let mut recent = read_recent_projects().unwrap_or_default();
    recent.retain(|project| project.path != path_text);
    write_recent_projects(&recent)
}

#[cfg_attr(coverage_nightly, coverage(off))]
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
    use std::io::{Read, Write};
    use std::net::{SocketAddr, TcpListener};
    use std::sync::mpsc::{self, Receiver};
    use std::thread::JoinHandle;
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
        let capabilities: Value =
            serde_json::from_str(include_str!("../capabilities/default.json"))
                .expect("default capabilities should be valid json");
        let permissions = capabilities["permissions"]
            .as_array()
            .expect("default capabilities should include permissions");

        assert!(permissions
            .iter()
            .any(|permission| { permission.as_str() == Some("core:window:allow-close") }));
        assert!(permissions
            .iter()
            .any(|permission| { permission.as_str() == Some("core:window:allow-destroy") }));
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
    fn project_backup_restores_last_valid_save() {
        let dir = tempdir().expect("tempdir");
        let path = dir.path().join("recovery.restproj");
        let original = json!({
            "format": "relay-studio-restproj",
            "schemaVersion": 1,
            "name": "Original"
        });
        let updated = json!({
            "format": "relay-studio-restproj",
            "schemaVersion": 1,
            "name": "Updated"
        });

        save_project_file_impl(&path, &original).expect("save original");
        save_project_file_impl(&path, &updated).expect("save updated");
        restore_project_backup_impl(&path).expect("restore backup");

        assert_eq!(
            open_project_file_impl(&path).expect("open restored"),
            original
        );
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
    fn project_open_and_backup_restore_reject_oversized_files_before_parsing() {
        let dir = tempdir().expect("tempdir");
        let path = dir.path().join("oversized.restproj");
        fs::write(&path, vec![b'{'; (MAX_PROJECT_FILE_BYTES + 1) as usize])
            .expect("write oversized project");
        let error = open_project_file_impl(&path).expect_err("oversized project");
        assert!(error.contains("safe limit"));

        let backup = backup_path_for(&path);
        fs::write(&backup, vec![b'{'; (MAX_PROJECT_FILE_BYTES + 1) as usize])
            .expect("write oversized backup");
        let restore_error = restore_project_backup_impl(&path).expect_err("oversized backup");
        assert!(restore_error.contains("safe limit"));
    }

    #[test]
    fn http_request_validation_accepts_supported_requests() {
        let request = test_http_request("GET", "https://api.example.com/api/health");

        assert!(validate_http_request(&request).is_ok());
    }

    #[test]
    fn http_request_validation_rejects_unsupported_inputs() {
        let mut request = test_http_request("TRACE", "https://api.example.com/api/health");

        assert_eq!(
            validate_http_request(&request).expect_err("unsupported method"),
            "Unsupported HTTP method: TRACE"
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

        request.timeout_ms = 300_001;
        assert_eq!(
            validate_http_request(&request).expect_err("excessive timeout"),
            "Request timeout must be between 1 ms and 300000 ms."
        );
    }

    #[test]
    fn native_http_request_returns_status_headers_and_body() {
        let listener = TcpListener::bind("127.0.0.1:0").expect("bind local server");
        let address = listener.local_addr().expect("local address");
        let server = std::thread::spawn(move || {
            let (mut stream, _) = listener.accept().expect("accept request");
            let mut request_bytes = [0_u8; 2048];
            let bytes_read = stream.read(&mut request_bytes).expect("read request");
            let request_text = String::from_utf8_lossy(&request_bytes[..bytes_read]);
            assert!(request_text.starts_with("GET /health HTTP/1.1"));
            stream
                .write_all(b"HTTP/1.1 200 OK\r\nContent-Type: application/json\r\nX-Relay-Test: covered\r\nContent-Length: 11\r\nConnection: close\r\n\r\n{\"ok\":true}")
                .expect("write response");
        });
        let request = test_http_request("GET", &format!("http://{address}/health"));

        let response = tauri::async_runtime::block_on(execute_http_request_impl(request))
            .expect("execute local request");
        server.join().expect("join local server");

        assert_eq!(response.status, 200);
        assert_eq!(response.status_text, "OK");
        assert_eq!(response.body, "{\"ok\":true}");
        assert_eq!(
            response.headers.get("x-relay-test"),
            Some(&"covered".to_string())
        );
        assert_eq!(response.final_url, format!("http://{address}/health"));
    }

    #[test]
    fn native_http_request_rejects_content_length_over_limit_before_body_read() {
        let body_length = MAX_HTTP_RESPONSE_BODY_BYTES + 1;
        let response = format!(
            "HTTP/1.1 200 OK\r\nContent-Length: {body_length}\r\nConnection: close\r\n\r\n"
        );
        let (address, requests, server) = spawn_test_server(response.into_bytes());
        let request = test_http_request("GET", &format!("http://{address}/oversized"));

        let error = tauri::async_runtime::block_on(execute_http_request_impl(request))
            .expect_err("declared oversized response");
        server.join().expect("join oversized server");
        assert!(requests.recv().expect("request result").is_some());
        assert!(error.contains("safe limit"));
    }

    #[test]
    fn native_http_request_rejects_chunked_body_after_streaming_limit() {
        let body = vec![b'x'; (MAX_HTTP_RESPONSE_BODY_BYTES + 1) as usize];
        let mut response = format!(
            "HTTP/1.1 200 OK\r\nTransfer-Encoding: chunked\r\nConnection: close\r\n\r\n{:x}\r\n",
            body.len()
        )
        .into_bytes();
        response.extend_from_slice(&body);
        response.extend_from_slice(b"\r\n0\r\n\r\n");
        let (address, requests, server) = spawn_test_server(response);
        let request = test_http_request("GET", &format!("http://{address}/chunked"));

        let error = tauri::async_runtime::block_on(execute_http_request_impl(request))
            .expect_err("chunked oversized response");
        server.join().expect("join chunked server");
        assert!(requests.recv().expect("request result").is_some());
        assert!(error.contains("safe limit"));
    }

    #[test]
    fn native_http_request_follows_same_origin_redirects_and_returns_final_url() {
        let listener = TcpListener::bind("127.0.0.1:0").expect("bind redirect server");
        let address = listener.local_addr().expect("redirect server address");
        let server = std::thread::spawn(move || {
            let (mut first, _) = listener.accept().expect("accept initial request");
            let mut first_request = [0_u8; 2048];
            let first_length = first
                .read(&mut first_request)
                .expect("read initial request");
            let first_text = String::from_utf8_lossy(&first_request[..first_length]);
            assert!(first_text.starts_with("GET /start HTTP/1.1"));
            assert!(first_text
                .to_ascii_lowercase()
                .contains("x-api-key: synthetic-key"));
            first
                .write_all(b"HTTP/1.1 302 Found\r\nLocation: /final\r\nContent-Length: 0\r\nConnection: close\r\n\r\n")
                .expect("write redirect");

            let (mut second, _) = listener.accept().expect("accept redirected request");
            let mut second_request = [0_u8; 2048];
            let second_length = second
                .read(&mut second_request)
                .expect("read redirected request");
            let second_text = String::from_utf8_lossy(&second_request[..second_length]);
            assert!(second_text.starts_with("GET /final HTTP/1.1"));
            assert!(second_text
                .to_ascii_lowercase()
                .contains("x-api-key: synthetic-key"));
            second
                .write_all(b"HTTP/1.1 200 OK\r\nContent-Type: text/plain\r\nContent-Length: 5\r\nConnection: close\r\n\r\nfinal")
                .expect("write final response");
        });
        let mut request = test_http_request("GET", &format!("http://{address}/start"));
        request
            .headers
            .insert("X-API-Key".to_string(), "synthetic-key".to_string());

        let response = tauri::async_runtime::block_on(execute_http_request_impl(request))
            .expect("follow same-origin redirect");
        server.join().expect("join redirect server");

        assert_eq!(response.status, 200);
        assert_eq!(response.body, "final");
        assert_eq!(response.final_url, format!("http://{address}/final"));
    }

    #[test]
    fn native_http_request_blocks_cross_origin_redirects_before_forwarding_headers() {
        let (target_address, target_requests, target_server) = spawn_test_server(
            b"HTTP/1.1 200 OK\r\nContent-Length: 6\r\nConnection: close\r\n\r\ntarget".to_vec(),
        );
        let redirect_response = format!(
            "HTTP/1.1 302 Found\r\nLocation: http://{target_address}/capture\r\nContent-Length: 0\r\nConnection: close\r\n\r\n"
        )
        .into_bytes();
        let (source_address, source_requests, source_server) = spawn_test_server(redirect_response);
        let mut request = test_http_request("GET", &format!("http://{source_address}/start"));
        request
            .headers
            .insert("X-API-Key".to_string(), "synthetic-key".to_string());

        let error = tauri::async_runtime::block_on(execute_http_request_impl(request))
            .expect_err("cross-origin redirect must be blocked");

        source_server.join().expect("join source server");
        target_server.join().expect("join target server");
        assert!(source_requests
            .recv()
            .expect("source request result")
            .is_some());
        assert!(target_requests
            .recv()
            .expect("target request result")
            .is_none());
        assert!(error.contains("Cross-origin redirect blocked"));
        assert!(!error.contains("synthetic-key"));
    }

    #[test]
    fn native_http_request_rejects_redirects_without_a_destination() {
        let (address, requests, server) = spawn_test_server(
            b"HTTP/1.1 302 Found\r\nContent-Length: 0\r\nConnection: close\r\n\r\n".to_vec(),
        );
        let request = test_http_request("GET", &format!("http://{address}/start"));

        let error = tauri::async_runtime::block_on(execute_http_request_impl(request))
            .expect_err("redirect without Location must be rejected");

        server.join().expect("join redirect server");
        assert!(requests.recv().expect("request result").is_some());
        assert!(error.contains("did not include a Location header"));
        assert!(!error.contains("/start"));
    }

    #[test]
    fn native_http_request_rejects_excessive_same_origin_redirects() {
        let listener = TcpListener::bind("127.0.0.1:0").expect("bind redirect loop server");
        listener
            .set_nonblocking(true)
            .expect("configure redirect loop server");
        let address = listener.local_addr().expect("redirect loop server address");
        let server = std::thread::spawn(move || {
            let deadline = Instant::now() + Duration::from_secs(2);
            let mut requests = 0;
            while Instant::now() < deadline {
                match listener.accept() {
                    Ok((mut stream, _)) => {
                        let mut request = [0_u8; 2048];
                        let _bytes_read = stream.read(&mut request).expect("read loop request");
                        stream
                            .write_all(b"HTTP/1.1 302 Found\r\nLocation: /loop\r\nContent-Length: 0\r\nConnection: close\r\n\r\n")
                            .expect("write loop redirect");
                        requests += 1;
                    }
                    Err(error) if error.kind() == std::io::ErrorKind::WouldBlock => {
                        if requests > 10 {
                            break;
                        }
                        std::thread::sleep(Duration::from_millis(10));
                    }
                    Err(error) => panic!("accept loop request: {error}"),
                }
            }
            requests
        });
        let request = test_http_request("GET", &format!("http://{address}/loop"));

        let error = tauri::async_runtime::block_on(execute_http_request_impl(request))
            .expect_err("redirect loop must be rejected");
        let requests = server.join().expect("join redirect loop server");

        assert_eq!(requests, 10);
        assert!(error.contains("Redirect limit exceeded after 10 requests"));
    }

    #[test]
    fn native_http_request_honors_configured_proxy_bypass_hosts() {
        let (target_address, target_requests, target_server) = spawn_test_server(
            b"HTTP/1.1 200 OK\r\nContent-Length: 6\r\nConnection: close\r\n\r\ndirect".to_vec(),
        );
        let (proxy_address, proxy_requests, proxy_server) = spawn_test_server(
            b"HTTP/1.1 200 OK\r\nContent-Length: 5\r\nConnection: close\r\n\r\nproxy".to_vec(),
        );
        let mut request = test_http_request("GET", &format!("http://{target_address}/health"));
        request.proxy = Some(ProxySettingsInput {
            enabled: true,
            use_for_http: true,
            use_for_https: true,
            server_url: format!("http://{proxy_address}"),
            port: proxy_address.port(),
            basic_auth_enabled: false,
            username: String::new(),
            password: String::new(),
            bypass_list: "localhost, 127.0.0.1".to_string(),
        });

        let response = tauri::async_runtime::block_on(execute_http_request_impl(request))
            .expect("execute bypassed request");

        target_server.join().expect("join target server");
        proxy_server.join().expect("join proxy server");
        assert_eq!(response.body, "direct");
        assert!(target_requests
            .recv()
            .expect("target request result")
            .is_some());
        assert!(proxy_requests
            .recv()
            .expect("proxy request result")
            .is_none());
    }

    #[test]
    fn proxy_bypass_list_rejects_malformed_or_port_specific_entries() {
        assert!(
            validated_no_proxy("localhost, .example.test, 127.0.0.1, 192.168.0.0/16, ::1")
                .expect("valid proxy bypass list")
                .is_some()
        );

        for invalid in [
            "https://example.test",
            "localhost:8080",
            "bad host",
            "192.168.0.0/99",
            "*.example.test",
        ] {
            let error = validated_no_proxy(invalid).expect_err("malformed proxy bypass entry");
            assert!(error.contains("Invalid proxy bypass entry"));
            assert!(error.contains(invalid));
        }
    }

    #[test]
    fn native_http_request_sends_text_and_file_multipart_parts() {
        let directory = tempdir().expect("tempdir");
        let file_path = directory.path().join("asset.png");
        fs::write(&file_path, b"relay-file-bytes").expect("write multipart fixture");
        let listener = TcpListener::bind("127.0.0.1:0").expect("bind local server");
        let address = listener.local_addr().expect("local address");
        let server = std::thread::spawn(move || {
            let (mut stream, _) = listener.accept().expect("accept request");
            let mut request = Vec::new();
            let mut buffer = [0_u8; 4096];
            loop {
                let bytes_read = stream.read(&mut buffer).expect("read multipart request");
                if bytes_read == 0 {
                    break;
                }
                request.extend_from_slice(&buffer[..bytes_read]);
                let Some(header_end) = request
                    .windows(4)
                    .position(|window| window == b"\r\n\r\n")
                    .map(|index| index + 4)
                else {
                    continue;
                };
                let headers = String::from_utf8_lossy(&request[..header_end]);
                let content_length = headers.lines().find_map(|line| {
                    line.to_ascii_lowercase()
                        .strip_prefix("content-length: ")
                        .and_then(|value| value.trim().parse::<usize>().ok())
                });
                if content_length.is_some_and(|length| request.len() >= header_end + length) {
                    break;
                }
            }
            let request_text = String::from_utf8_lossy(&request);
            assert!(request_text.starts_with("POST /upload HTTP/1.1"));
            assert!(request_text.contains("multipart/form-data; boundary="));
            assert!(request_text.contains("name=\"description\""));
            assert!(request_text.contains("Profile image"));
            assert!(request_text.contains("name=\"asset\""));
            assert!(request_text.contains("filename=\"asset.png\""));
            assert!(request_text.contains("Content-Type: image/png"));
            assert!(request_text.contains("relay-file-bytes"));
            stream
                .write_all(
                    b"HTTP/1.1 204 No Content\r\nContent-Length: 0\r\nConnection: close\r\n\r\n",
                )
                .expect("write response");
        });
        let mut request = test_http_request("POST", &format!("http://{address}/upload"));
        request.multipart_parts = Some(vec![
            MultipartPartInput {
                name: "description".to_string(),
                value: "Profile image".to_string(),
                kind: "text".to_string(),
                content_type: None,
            },
            MultipartPartInput {
                name: "asset".to_string(),
                value: file_path.to_string_lossy().to_string(),
                kind: "file".to_string(),
                content_type: Some("image/png".to_string()),
            },
        ]);

        let response = tauri::async_runtime::block_on(execute_http_request_impl(request))
            .expect("execute multipart request");
        server.join().expect("join local server");
        assert_eq!(response.status, 204);
    }

    #[test]
    fn multipart_file_validation_rejects_missing_and_oversized_files() {
        let missing = vec![MultipartPartInput {
            name: "asset".to_string(),
            value: "/missing/relay-studio.bin".to_string(),
            kind: "file".to_string(),
            content_type: None,
        }];
        let missing_error = match build_multipart_form(&missing) {
            Err(error) => error,
            Ok(_) => panic!("missing file should fail"),
        };
        assert!(missing_error.contains("Could not access multipart file"));

        let directory = tempdir().expect("tempdir");
        let oversized_path = directory.path().join("oversized.bin");
        fs::File::create(&oversized_path)
            .expect("create oversized fixture")
            .set_len(MAX_MULTIPART_FILE_BYTES + 1)
            .expect("size fixture");
        let oversized = vec![MultipartPartInput {
            name: "asset".to_string(),
            value: oversized_path.to_string_lossy().to_string(),
            kind: "file".to_string(),
            content_type: None,
        }];
        let oversized_error = match build_multipart_form(&oversized) {
            Err(error) => error,
            Ok(_) => panic!("oversized file should fail"),
        };
        assert!(oversized_error.contains("exceeds the 25 MB limit"));
    }

    #[test]
    fn multipart_request_validation_rejects_conflicting_and_malformed_parts() {
        let mut request = test_http_request("POST", "https://api.example.com/upload");
        request.body = Some("raw body".to_string());
        request.multipart_parts = Some(vec![MultipartPartInput {
            name: "description".to_string(),
            value: "Profile image".to_string(),
            kind: "text".to_string(),
            content_type: None,
        }]);
        assert!(validate_http_request(&request)
            .expect_err("raw body conflict")
            .contains("cannot include both a raw body and structured parts"));

        request.body = None;
        request.headers.insert(
            "Content-Type".to_string(),
            "multipart/form-data".to_string(),
        );
        assert!(validate_http_request(&request)
            .expect_err("manual content type")
            .contains("Relay Studio generates the boundary"));

        assert_eq!(
            validate_multipart_parts(&[MultipartPartInput {
                name: "  ".to_string(),
                value: "value".to_string(),
                kind: "text".to_string(),
                content_type: None,
            }])
            .expect_err("blank name"),
            "Multipart part names are required."
        );
        assert!(validate_multipart_parts(&[MultipartPartInput {
            name: "bad\nname".to_string(),
            value: "value".to_string(),
            kind: "text".to_string(),
            content_type: None,
        }])
        .expect_err("line break")
        .contains("cannot contain line breaks"));
        assert!(validate_multipart_parts(&[MultipartPartInput {
            name: "asset".to_string(),
            value: String::new(),
            kind: "file".to_string(),
            content_type: None,
        }])
        .expect_err("empty file path")
        .contains("requires a local file path"));
        assert_eq!(
            validate_multipart_parts(&[MultipartPartInput {
                name: "asset".to_string(),
                value: "value".to_string(),
                kind: "stream".to_string(),
                content_type: None,
            }])
            .expect_err("unsupported kind"),
            "Unsupported multipart part kind: stream."
        );
    }

    #[test]
    fn multipart_file_validation_rejects_directories_and_invalid_content_types() {
        let directory = tempdir().expect("tempdir");
        let directory_part = vec![MultipartPartInput {
            name: "asset".to_string(),
            value: directory.path().to_string_lossy().to_string(),
            kind: "file".to_string(),
            content_type: None,
        }];
        assert!(match build_multipart_form(&directory_part) {
            Err(error) => error,
            Ok(_) => panic!("directory should fail"),
        }
        .contains("is not a file"));

        let file_path = directory.path().join("asset.bin");
        fs::write(&file_path, b"fixture").expect("write fixture");
        let invalid_content_type = vec![MultipartPartInput {
            name: "asset".to_string(),
            value: file_path.to_string_lossy().to_string(),
            kind: "file".to_string(),
            content_type: Some("not a media type".to_string()),
        }];
        assert!(match build_multipart_form(&invalid_content_type) {
            Err(error) => error,
            Ok(_) => panic!("invalid content type should fail"),
        }
        .contains("Invalid multipart content type"));
    }

    #[test]
    fn proxy_configuration_normalizes_endpoints_and_rejects_invalid_urls() {
        let mut settings = ProxySettingsInput {
            enabled: true,
            use_for_http: true,
            use_for_https: true,
            server_url: "proxy.example.com".to_string(),
            port: 8080,
            basic_auth_enabled: false,
            username: String::new(),
            password: String::new(),
            bypass_list: String::new(),
        };

        assert_eq!(proxy_endpoint(&settings), "http://proxy.example.com:8080");
        assert!(apply_proxy_settings(reqwest::Client::builder(), Some(&settings)).is_ok());
        settings.use_for_https = false;
        assert!(apply_proxy_settings(reqwest::Client::builder(), Some(&settings)).is_ok());
        settings.use_for_http = false;
        settings.use_for_https = true;
        settings.basic_auth_enabled = true;
        settings.username = "proxy-user".to_string();
        settings.password = "proxy-password".to_string();
        assert!(apply_proxy_settings(reqwest::Client::builder(), Some(&settings)).is_ok());
        settings.server_url = "://invalid".to_string();
        assert!(apply_proxy_settings(reqwest::Client::builder(), Some(&settings)).is_err());
        settings.enabled = false;
        assert!(apply_proxy_settings(reqwest::Client::builder(), Some(&settings)).is_ok());
        assert!(apply_proxy_settings(reqwest::Client::builder(), None).is_ok());
    }

    #[test]
    fn project_paths_names_and_delete_failures_are_explicit() {
        assert_eq!(
            validate_project_path(Path::new("")).unwrap_err(),
            "Project path is required."
        );
        assert_eq!(
            validate_project_path(Path::new("project.json")).unwrap_err(),
            "Project file must use the .restproj extension."
        );
        assert_eq!(
            validate_project_name("  ").unwrap_err(),
            "Project name is required."
        );

        let dir = tempdir().expect("tempdir");
        let missing = dir.path().join("missing.restproj");
        assert!(open_project_file_impl(&missing)
            .unwrap_err()
            .contains("was not found"));
        assert!(delete_project_file_impl(&missing)
            .unwrap_err()
            .contains("was not found"));
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
            serde_json::from_str::<Value>(&fs::read_to_string(&path).expect("read response artifact")).expect("parse response artifact"),
            artifact
        );
        assert_eq!(
            read_response_file_impl(&artifact["metadata"]).expect("read response"),
            artifact
        );
    }

    #[test]
    fn saved_response_reader_rejects_disguised_local_text_and_mismatched_paths() {
        let dir = tempdir().expect("tempdir");
        let text_path = dir.path().join("private.txt");
        fs::write(&text_path, "local file contents").expect("write local text");
        let metadata = json!({
            "id": "response-1",
            "filePath": text_path.to_string_lossy(),
            "fileName": "private.txt"
        });

        assert!(read_response_file_impl(&metadata)
            .expect_err("disguised text")
            .contains("Legacy raw .txt response artifacts cannot be reopened safely"));

        let other_path = dir.path().join("other.json");
        let artifact = json!({
            "format": SAVED_RESPONSE_FORMAT,
            "schemaVersion": SAVED_RESPONSE_SCHEMA_VERSION,
            "metadata": {
                "id": "response-2",
                "filePath": other_path.to_string_lossy(),
                "fileName": "other.json"
            },
            "body": "{}"
        });
        fs::write(&text_path, serde_json::to_vec(&artifact).expect("serialize artifact")).expect("write artifact");
        assert!(read_response_file_impl(&metadata)
            .expect_err("path mismatch")
            .contains("does not match the approved project metadata"));
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
            MENU_APP_OPEN_HELP,
            MENU_APP_OPEN_IMPORT,
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
        assert!(
            shell_command_payload_for_menu_id("file.open_recent.1", &recent_projects).is_none()
        );
        assert!(
            shell_command_payload_for_menu_id("file.open_recent.foo", &recent_projects).is_none()
        );
    }

    #[test]
    fn default_project_directory_uses_relaystudio_under_documents() {
        let directory =
            default_project_directory_for(Path::new("C:\\Users\\JeffHaynes\\Documents"));
        assert!(directory.ends_with("relaystudio"));
        assert!(directory.contains("Documents"));
    }

    fn test_http_request(method: &str, url: &str) -> HttpRequestInput {
        HttpRequestInput {
            method: method.to_string(),
            url: url.to_string(),
            headers: HashMap::new(),
            body: None,
            multipart_parts: None,
            timeout_ms: 30_000,
            http_version: None,
            ssl_certificate_verification: None,
            ssl_tls_key_log: None,
            disable_cookies: None,
            proxy: None,
        }
    }

    fn spawn_test_server(
        response: Vec<u8>,
    ) -> (SocketAddr, Receiver<Option<String>>, JoinHandle<()>) {
        let listener = TcpListener::bind("127.0.0.1:0").expect("bind test server");
        listener
            .set_nonblocking(true)
            .expect("configure nonblocking test server");
        let address = listener.local_addr().expect("test server address");
        let (sender, receiver) = mpsc::channel();
        let server = std::thread::spawn(move || {
            let deadline = Instant::now() + Duration::from_secs(2);
            loop {
                match listener.accept() {
                    Ok((mut stream, _)) => {
                        stream
                            .set_nonblocking(false)
                            .expect("configure blocking test stream");
                        let mut request = [0_u8; 4096];
                        let length = stream.read(&mut request).expect("read test request");
                        let _ = stream.write_all(&response);
                        sender
                            .send(Some(
                                String::from_utf8_lossy(&request[..length]).to_string(),
                            ))
                            .expect("send captured request");
                        return;
                    }
                    Err(error) if error.kind() == std::io::ErrorKind::WouldBlock => {
                        if Instant::now() >= deadline {
                            sender.send(None).expect("send empty request result");
                            return;
                        }
                        std::thread::sleep(Duration::from_millis(10));
                    }
                    Err(error) => panic!("accept test request: {error}"),
                }
            }
        });
        (address, receiver, server)
    }
}
