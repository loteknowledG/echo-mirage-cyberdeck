use serde::{Deserialize, Serialize};
use std::fs;
use std::path::PathBuf;
use tauri::{AppHandle, Manager};

pub const DEFAULT_PAIR_HTTP_PORT: u16 = 3050;
pub const ECHO_NODE_LABEL: &str = "echo";

#[derive(Debug, Clone, Serialize, Deserialize, Default)]
#[serde(rename_all = "camelCase")]
pub struct SatelliteCredentials {
    pub node_id: String,
    pub mirage_host: String,
    pub mirage_http_port: u16,
    pub ws_host: String,
    pub ws_port: u16,
    pub capture_token: String,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "lowercase")]
pub enum WsRuntimeStatus {
    Disconnected,
    Connecting,
    Connected,
    Error,
}

impl Default for WsRuntimeStatus {
    fn default() -> Self {
        Self::Disconnected
    }
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct SatelliteStatus {
    pub armed: bool,
    pub ws_status: WsRuntimeStatus,
    pub credentials: Option<SatelliteCredentials>,
    pub pair_http_port: u16,
    pub last_error: Option<String>,
    pub last_mission_id: Option<String>,
    pub missions_handled: u64,
}

pub fn config_path(app: &AppHandle) -> Result<PathBuf, String> {
    let dir = app
        .path()
        .app_config_dir()
        .map_err(|e| e.to_string())?;
    fs::create_dir_all(&dir).map_err(|e| e.to_string())?;
    Ok(dir.join("satellite-credentials.json"))
}

pub fn load_credentials(app: &AppHandle) -> Option<SatelliteCredentials> {
    let path = config_path(app).ok()?;
    let raw = fs::read_to_string(path).ok()?;
    serde_json::from_str(&raw).ok()
}

pub fn save_credentials(app: &AppHandle, creds: &SatelliteCredentials) -> Result<(), String> {
    let path = config_path(app)?;
    let raw = serde_json::to_string_pretty(creds).map_err(|e| e.to_string())?;
    fs::write(path, raw).map_err(|e| e.to_string())
}

pub fn clear_credentials(app: &AppHandle) -> Result<(), String> {
    if let Ok(path) = config_path(app) {
        let _ = fs::remove_file(path);
    }
    Ok(())
}

pub fn get_or_create_node_id(app: &AppHandle) -> Result<String, String> {
    if let Some(creds) = load_credentials(app) {
        if !creds.node_id.is_empty() {
            return Ok(creds.node_id);
        }
    }
    Ok(uuid::Uuid::new_v4().to_string())
}
