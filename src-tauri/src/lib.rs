use aes_gcm::aead::{Aead, KeyInit};
use aes_gcm::{Aes256Gcm, Key, Nonce};
use base64::engine::general_purpose::STANDARD as BASE64;
use base64::Engine;
use pbkdf2::pbkdf2_hmac;
use rand::RngCore;
use serde::{Deserialize, Serialize};
use serde_json::Value;
use sha2::Sha256;
use std::fs;
use std::path::{Path, PathBuf};

const PROJECT_FORMAT: &str = "relay-studio-restproj";
const PROJECT_SCHEMA_VERSION: u16 = 1;
const KDF_ITERATIONS: u32 = 120_000;

#[derive(Debug, Serialize, Deserialize, Clone, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
struct RecentProject {
    name: String,
    path: String,
    opened_at: String,
}

#[derive(Debug, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
struct EncryptionMetadata {
    algorithm: String,
    kdf: String,
    iterations: u32,
    salt: String,
    nonce: String,
}

#[derive(Debug, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
struct ProjectEnvelope {
    format: String,
    schema_version: u16,
    encryption: EncryptionMetadata,
    ciphertext: String,
}

#[tauri::command]
fn app_version() -> String {
    env!("CARGO_PKG_VERSION").to_string()
}

#[tauri::command]
fn save_project_file(path: String, password: String, project: Value) -> Result<(), String> {
    save_project_file_impl(Path::new(&path), &password, &project)
}

#[tauri::command]
fn open_project_file(path: String, password: String) -> Result<Value, String> {
    open_project_file_impl(Path::new(&path), &password)
}

#[tauri::command]
fn project_file_exists(path: String) -> Result<bool, String> {
    let project_path = Path::new(&path);
    validate_project_path(project_path)?;
    Ok(project_path.exists())
}

#[tauri::command]
fn list_recent_projects() -> Result<Vec<RecentProject>, String> {
    read_recent_projects()
}

#[tauri::command]
fn remember_recent_project(project: RecentProject) -> Result<(), String> {
    remember_recent_project_impl(project)
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .invoke_handler(tauri::generate_handler![
            app_version,
            save_project_file,
            open_project_file,
            project_file_exists,
            list_recent_projects,
            remember_recent_project
        ])
        .run(tauri::generate_context!())
        .expect("error while running Relay Studio");
}

fn save_project_file_impl(path: &Path, password: &str, project: &Value) -> Result<(), String> {
    validate_project_path(path)?;
    validate_password(password)?;

    let envelope = encrypt_project(password, project)?;
    let serialized = serde_json::to_vec_pretty(&envelope)
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

fn open_project_file_impl(path: &Path, password: &str) -> Result<Value, String> {
    validate_project_path(path)?;
    validate_password(password)?;

    let raw = fs::read(path).map_err(|error| {
        if error.kind() == std::io::ErrorKind::NotFound {
            format!("Project file was not found: {}", path.display())
        } else {
            format!("Could not read project file: {error}")
        }
    })?;
    let envelope: ProjectEnvelope = serde_json::from_slice(&raw)
        .map_err(|error| format!("Project file is corrupted or unsupported: {error}"))?;

    decrypt_project(password, &envelope)
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

fn validate_password(password: &str) -> Result<(), String> {
    if password.is_empty() {
        return Err("Project password is required.".to_string());
    }
    Ok(())
}

fn encrypt_project(password: &str, project: &Value) -> Result<ProjectEnvelope, String> {
    let plaintext = serde_json::to_vec(project)
        .map_err(|error| format!("Project serialization failed: {error}"))?;
    let mut salt = [0u8; 16];
    let mut nonce_bytes = [0u8; 12];
    rand::thread_rng().fill_bytes(&mut salt);
    rand::thread_rng().fill_bytes(&mut nonce_bytes);

    let mut key_bytes = [0u8; 32];
    pbkdf2_hmac::<Sha256>(password.as_bytes(), &salt, KDF_ITERATIONS, &mut key_bytes);
    let key = Key::<Aes256Gcm>::from_slice(&key_bytes);
    let cipher = Aes256Gcm::new(key);
    let nonce = Nonce::from_slice(&nonce_bytes);
    let ciphertext = cipher
        .encrypt(nonce, plaintext.as_ref())
        .map_err(|_| "Project encryption failed.".to_string())?;

    Ok(ProjectEnvelope {
        format: PROJECT_FORMAT.to_string(),
        schema_version: PROJECT_SCHEMA_VERSION,
        encryption: EncryptionMetadata {
            algorithm: "AES-256-GCM".to_string(),
            kdf: "PBKDF2-HMAC-SHA256".to_string(),
            iterations: KDF_ITERATIONS,
            salt: BASE64.encode(salt),
            nonce: BASE64.encode(nonce_bytes),
        },
        ciphertext: BASE64.encode(ciphertext),
    })
}

fn decrypt_project(password: &str, envelope: &ProjectEnvelope) -> Result<Value, String> {
    if envelope.format != PROJECT_FORMAT {
        return Err("Unsupported project file format.".to_string());
    }
    if envelope.schema_version != PROJECT_SCHEMA_VERSION {
        return Err(format!(
            "Unsupported project schema version: {}",
            envelope.schema_version
        ));
    }
    if envelope.encryption.algorithm != "AES-256-GCM"
        || envelope.encryption.kdf != "PBKDF2-HMAC-SHA256"
    {
        return Err("Unsupported project encryption settings.".to_string());
    }

    let salt = BASE64
        .decode(&envelope.encryption.salt)
        .map_err(|_| "Project file has invalid encryption salt.".to_string())?;
    let nonce_bytes = BASE64
        .decode(&envelope.encryption.nonce)
        .map_err(|_| "Project file has invalid encryption nonce.".to_string())?;
    let ciphertext = BASE64
        .decode(&envelope.ciphertext)
        .map_err(|_| "Project file has invalid encrypted payload.".to_string())?;

    let mut key_bytes = [0u8; 32];
    pbkdf2_hmac::<Sha256>(
        password.as_bytes(),
        &salt,
        envelope.encryption.iterations,
        &mut key_bytes,
    );
    let key = Key::<Aes256Gcm>::from_slice(&key_bytes);
    let cipher = Aes256Gcm::new(key);
    let nonce = Nonce::from_slice(&nonce_bytes);
    let plaintext = cipher
        .decrypt(nonce, ciphertext.as_ref())
        .map_err(|_| "Wrong project password or corrupted project file.".to_string())?;

    serde_json::from_slice(&plaintext)
        .map_err(|error| format!("Decrypted project payload is invalid: {error}"))
}

fn temp_path_for(path: &Path) -> PathBuf {
    path.with_extension("restproj.tmp")
}

fn backup_path_for(path: &Path) -> PathBuf {
    path.with_extension("restproj.bak")
}

fn recent_projects_path() -> Result<PathBuf, String> {
    let home = std::env::var_os("HOME").ok_or_else(|| "HOME is not available.".to_string())?;
    Ok(PathBuf::from(home)
        .join(".relaystudio")
        .join("recent-projects.json"))
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
    recent.truncate(8);

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
    fn encrypted_project_round_trips() {
        let dir = tempdir().expect("tempdir");
        let path = dir.path().join("sample.restproj");
        let project = json!({
            "format": "relay-studio-restproj",
            "schemaVersion": 1,
            "name": "Sample API Regression",
            "variables": [{ "name": "accessToken", "value": "secret-token", "secret": true }]
        });

        save_project_file_impl(&path, "password", &project).expect("save");
        let raw = fs::read_to_string(&path).expect("read");
        assert!(!raw.contains("secret-token"));

        let opened = open_project_file_impl(&path, "password").expect("open");
        assert_eq!(opened, project);
    }

    #[test]
    fn wrong_password_is_rejected() {
        let dir = tempdir().expect("tempdir");
        let path = dir.path().join("sample.restproj");
        let project = json!({ "name": "Sample API Regression" });

        save_project_file_impl(&path, "password", &project).expect("save");
        let error = open_project_file_impl(&path, "wrong").expect_err("wrong password");

        assert!(error.contains("Wrong project password"));
    }

    #[test]
    fn corrupted_project_file_is_rejected() {
        let dir = tempdir().expect("tempdir");
        let path = dir.path().join("sample.restproj");
        fs::write(&path, "{not valid json").expect("write corrupted file");

        let error = open_project_file_impl(&path, "password").expect_err("corrupted file");

        assert!(error.contains("corrupted or unsupported"));
    }
}
