use crate::config::DEFAULT_PAIR_HTTP_PORT;
use parking_lot::Mutex;
use rand::Rng;
use serde::{Deserialize, Serialize};
use std::fs;
use std::net::IpAddr;
use std::path::PathBuf;
use std::sync::OnceLock;
use tauri::{AppHandle, Manager};
use uuid::Uuid;

pub const ECHO_SURVEY_TERMINATED_MESSAGE: &str = "ECHO TERMINATED";
const SURVEY_PAIR_PIN_LENGTH: usize = 6;
const PAIRING_TTL_MS: i64 = 15 * 60 * 1000;

static APP: OnceLock<AppHandle> = OnceLock::new();
static CACHED: Mutex<Option<EchoSurveyPairingState>> = Mutex::new(None);

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
struct SpyPairCodeSession {
    pair_id: String,
    pair_secret: String,
    pin: String,
    expires_at: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct SurveyPairedMirageClient {
    pub node_id: String,
    pub mirage_token: String,
    pub paired_at: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct SpyPairedPowerfistClient {
    device_id: String,
    remote_token: String,
    paired_at: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
struct EchoSurveyPairingState {
    echo_node_id: String,
    http_port: u16,
    lan_hosts: Vec<String>,
    updated_at: String,
    echo_survey_active: bool,
    session_epoch: u64,
    mirage_code: Option<SpyPairCodeSession>,
    powerfist_code: Option<SpyPairCodeSession>,
    paired_mirages: Vec<SurveyPairedMirageClient>,
    paired_powerfist: Option<SpyPairedPowerfistClient>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct EchoSurveyPairingStatus {
    pub echo_node_id: String,
    pub echo_host: String,
    pub http_port: u16,
    pub lan_hosts: Vec<String>,
    pub mirage_pin: Option<String>,
    pub powerfist_pin: Option<String>,
    pub mirage_expires_at: Option<String>,
    pub powerfist_expires_at: Option<String>,
    pub paired_mirages: Vec<SurveyPairedMirageClient>,
    pub paired_mirage: Option<SurveyPairedMirageClient>,
    pub paired_powerfist: Option<SpyPairedPowerfistClient>,
    pub echo_survey_active: bool,
    pub session_epoch: u64,
}

pub fn init_spy_echo_pairing(app: AppHandle) {
    let _ = APP.set(app);
}

fn pairing_state_path() -> Result<PathBuf, String> {
    let app = APP.get().ok_or_else(|| "Spy pairing is not initialized.".to_string())?;
    let dir = app
        .path()
        .app_data_dir()
        .map_err(|e| e.to_string())?;
    fs::create_dir_all(&dir).map_err(|e| e.to_string())?;
    Ok(dir.join("echo-spy-pairing.json"))
}

fn get_lan_hosts() -> Vec<String> {
    let mut addrs = Vec::new();
    if let Ok(interfaces) = get_if_addrs::get_if_addrs() {
        for iface in interfaces {
            if let IpAddr::V4(v4) = iface.ip() {
                if !v4.is_loopback() {
                    addrs.push(v4.to_string());
                }
            }
        }
    }
    if addrs.is_empty() {
        addrs.push("127.0.0.1".to_string());
    }
    addrs
}

pub fn preferred_echo_host(lan_hosts: &[String]) -> String {
    if lan_hosts.is_empty() {
        return "127.0.0.1".to_string();
    }
    if let Some(host) = lan_hosts.iter().find(|h| h.starts_with("100.")) {
        return host.clone();
    }
    if let Some(host) = lan_hosts.iter().find(|h| {
        h.starts_with("192.168.")
            || h.starts_with("10.")
            || h.starts_with("172.16.")
            || h.starts_with("172.17.")
            || h.starts_with("172.18.")
            || h.starts_with("172.19.")
            || h.starts_with("172.2")
            || h.starts_with("172.30.")
            || h.starts_with("172.31.")
    }) {
        return host.clone();
    }
    lan_hosts[0].clone()
}

fn session_expired(session: &SpyPairCodeSession) -> bool {
    chrono::DateTime::parse_from_rfc3339(&session.expires_at)
        .map(|dt| dt.timestamp_millis() <= chrono_now_ms())
        .unwrap_or(true)
}

fn new_pair_id() -> String {
    format!("{}", rand::thread_rng().gen_range(10000..100000))
}

fn new_pair_secret() -> String {
    use base64::{engine::general_purpose::URL_SAFE_NO_PAD, Engine as _};
    let bytes: [u8; 9] = rand::random();
    URL_SAFE_NO_PAD.encode(bytes)
}

fn new_pair_pin(taken: &mut std::collections::HashSet<String>) -> Result<String, String> {
    for _ in 0..32 {
        let pin = format!(
            "{:0width$}",
            rand::thread_rng().gen_range(10_u32.pow(SURVEY_PAIR_PIN_LENGTH as u32 - 1)..10_u32.pow(SURVEY_PAIR_PIN_LENGTH as u32)),
            width = SURVEY_PAIR_PIN_LENGTH
        );
        if taken.insert(pin.clone()) {
            return Ok(pin);
        }
    }
    Err("Failed to allocate unique Spy pairing PIN.".to_string())
}

fn normalize_stored_session(session: &SpyPairCodeSession) -> Option<SpyPairCodeSession> {
    let pin = if session.pin.trim().is_empty() {
        session.pair_id.trim().to_string()
    } else {
        session.pin.trim().to_string()
    };
    if pin.len() != SURVEY_PAIR_PIN_LENGTH || !pin.chars().all(|c| c.is_ascii_digit()) {
        return None;
    }
    Some(SpyPairCodeSession {
        pair_id: session.pair_id.clone(),
        pair_secret: session.pair_secret.clone(),
        pin,
        expires_at: session.expires_at.clone(),
    })
}

fn chrono_now_ms() -> i64 {
    chrono::Utc::now().timestamp_millis()
}

fn iso_now() -> String {
    chrono::Utc::now().to_rfc3339()
}

fn default_state() -> EchoSurveyPairingState {
    EchoSurveyPairingState {
        echo_node_id: Uuid::new_v4().to_string(),
        http_port: DEFAULT_PAIR_HTTP_PORT,
        lan_hosts: get_lan_hosts(),
        updated_at: iso_now(),
        echo_survey_active: false,
        session_epoch: 1,
        mirage_code: None,
        powerfist_code: None,
        paired_mirages: Vec::new(),
        paired_powerfist: None,
    }
}

fn load_state() -> Result<EchoSurveyPairingState, String> {
    if let Some(state) = CACHED.lock().clone() {
        return Ok(state);
    }
    let path = pairing_state_path()?;
    let state = match fs::read_to_string(&path) {
        Ok(raw) => {
            let mut parsed: EchoSurveyPairingState =
                serde_json::from_str(&raw).unwrap_or_else(|_| default_state());
            parsed.echo_survey_active = parsed.echo_survey_active;
            parsed.session_epoch = parsed.session_epoch.max(1);
            parsed
        }
        Err(_) => default_state(),
    };
    *CACHED.lock() = Some(state.clone());
    Ok(state)
}

fn save_state(mut state: EchoSurveyPairingState) -> Result<(), String> {
    state.updated_at = iso_now();
    state.lan_hosts = get_lan_hosts();
    state.http_port = DEFAULT_PAIR_HTTP_PORT;
    *CACHED.lock() = Some(state.clone());
    let path = pairing_state_path()?;
    fs::write(path, serde_json::to_string_pretty(&state).map_err(|e| e.to_string())?)
        .map_err(|e| e.to_string())
}

fn create_code_session(taken: &mut std::collections::HashSet<String>) -> Result<SpyPairCodeSession, String> {
    let expires = chrono::Utc::now() + chrono::Duration::milliseconds(PAIRING_TTL_MS);
    Ok(SpyPairCodeSession {
        pair_id: new_pair_id(),
        pair_secret: new_pair_secret(),
        pin: new_pair_pin(taken)?,
        expires_at: expires.to_rfc3339(),
    })
}

pub fn refresh_echo_survey_pair_codes() -> Result<EchoSurveyPairingState, String> {
    let mut state = load_state()?;
    state.echo_survey_active = true;
    let mut taken = std::collections::HashSet::new();
    state.mirage_code = Some(create_code_session(&mut taken)?);
    state.powerfist_code = Some(create_code_session(&mut taken)?);
    save_state(state.clone())?;
    Ok(state)
}

pub fn get_echo_survey_pairing_status() -> Result<EchoSurveyPairingStatus, String> {
    let mut state = load_state()?;
    state.echo_survey_active = true;
    let mut taken = std::collections::HashSet::new();

    let mirage_expired = state
        .mirage_code
        .as_ref()
        .map(|s| session_expired(s))
        .unwrap_or(true);
    let powerfist_expired = state
        .powerfist_code
        .as_ref()
        .map(|s| session_expired(s))
        .unwrap_or(true);

    if mirage_expired {
        if powerfist_expired {
            state = refresh_echo_survey_pair_codes()?;
        } else if let Some(ref pf) = state.powerfist_code {
            if let Some(norm) = normalize_stored_session(pf) {
                taken.insert(norm.pin);
            }
            state.mirage_code = Some(create_code_session(&mut taken)?);
            save_state(state.clone())?;
        }
    } else if powerfist_expired {
        if let Some(ref mc) = state.mirage_code {
            if let Some(norm) = normalize_stored_session(mc) {
                taken.insert(norm.pin);
            }
        }
        state.powerfist_code = Some(create_code_session(&mut taken)?);
        save_state(state.clone())?;
    }

    let host = preferred_echo_host(&state.lan_hosts);
    let mirage_session = state.mirage_code.as_ref().and_then(normalize_stored_session);
    let powerfist_session = state
        .powerfist_code
        .as_ref()
        .and_then(normalize_stored_session);
    let mirage_active = mirage_session
        .as_ref()
        .map(|s| !session_expired(s))
        .unwrap_or(false);
    let powerfist_active = powerfist_session
        .as_ref()
        .map(|s| !session_expired(s))
        .unwrap_or(false);
    let paired_mirages = state.paired_mirages.clone();
    let paired_mirage = paired_mirages.first().cloned();

    Ok(EchoSurveyPairingStatus {
        echo_node_id: state.echo_node_id.clone(),
        echo_host: host,
        http_port: state.http_port,
        lan_hosts: state.lan_hosts.clone(),
        mirage_pin: mirage_active.then(|| mirage_session.as_ref().unwrap().pin.clone()),
        powerfist_pin: powerfist_active.then(|| powerfist_session.as_ref().unwrap().pin.clone()),
        mirage_expires_at: mirage_active.then(|| mirage_session.as_ref().unwrap().expires_at.clone()),
        powerfist_expires_at: powerfist_active
            .then(|| powerfist_session.as_ref().unwrap().expires_at.clone()),
        paired_mirages: paired_mirages.clone(),
        paired_mirage,
        paired_powerfist: state.paired_powerfist.clone(),
        echo_survey_active: state.echo_survey_active,
        session_epoch: state.session_epoch,
    })
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct SurveyPairEnterInput {
    pub pin: String,
    pub role: String,
    pub node_id: Option<String>,
    pub device_id: Option<String>,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct SurveyPairEnterResult {
    pub ok: bool,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub reason: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub role: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub echo_node_id: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub echo_host: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub http_port: Option<u16>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub token: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub node_id: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub device_id: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub session_epoch: Option<u64>,
}

pub fn complete_survey_pair_enter_by_pin(input: SurveyPairEnterInput) -> SurveyPairEnterResult {
    let pin = input.pin.trim().to_string();
    if pin.len() != SURVEY_PAIR_PIN_LENGTH || !pin.chars().all(|c| c.is_ascii_digit()) {
        return SurveyPairEnterResult {
            ok: false,
            reason: Some(format!(
                "Enter the {SURVEY_PAIR_PIN_LENGTH}-digit code from Echo."
            )),
            role: None,
            echo_node_id: None,
            echo_host: None,
            http_port: None,
            token: None,
            node_id: None,
            device_id: None,
            session_epoch: None,
        };
    }

    let state = match load_state() {
        Ok(s) => s,
        Err(reason) => {
            return SurveyPairEnterResult {
                ok: false,
                reason: Some(reason),
                role: None,
                echo_node_id: None,
                echo_host: None,
                http_port: None,
                token: None,
                node_id: None,
                device_id: None,
                session_epoch: None,
            };
        }
    };

    if !state.echo_survey_active {
        return SurveyPairEnterResult {
            ok: false,
            reason: Some(ECHO_SURVEY_TERMINATED_MESSAGE.to_string()),
            role: None,
            echo_node_id: None,
            echo_host: None,
            http_port: None,
            token: None,
            node_id: None,
            device_id: None,
            session_epoch: None,
        };
    }

    let session = if input.role == "powerfist" {
        state.powerfist_code.as_ref()
    } else {
        state.mirage_code.as_ref()
    };

    let Some(normalized) = session.and_then(normalize_stored_session) else {
        return SurveyPairEnterResult {
            ok: false,
            reason: Some("Pairing code expired. Generate new codes on Echo.".to_string()),
            role: None,
            echo_node_id: None,
            echo_host: None,
            http_port: None,
            token: None,
            node_id: None,
            device_id: None,
            session_epoch: None,
        };
    };

    if session_expired(&normalized) {
        return SurveyPairEnterResult {
            ok: false,
            reason: Some("Pairing code expired. Generate new codes on Echo.".to_string()),
            role: None,
            echo_node_id: None,
            echo_host: None,
            http_port: None,
            token: None,
            node_id: None,
            device_id: None,
            session_epoch: None,
        };
    }

    if normalized.pin != pin {
        return SurveyPairEnterResult {
            ok: false,
            reason: Some("Invalid pairing code.".to_string()),
            role: None,
            echo_node_id: None,
            echo_host: None,
            http_port: None,
            token: None,
            node_id: None,
            device_id: None,
            session_epoch: None,
        };
    }

    complete_survey_pair_enter(
        &normalized.pair_id,
        &normalized.pair_secret,
        if input.role == "powerfist" {
            "powerfist"
        } else {
            "mirage"
        },
        input.node_id,
        input.device_id,
    )
}

fn complete_survey_pair_enter(
    pair_id: &str,
    pair_secret: &str,
    role: &str,
    node_id: Option<String>,
    device_id: Option<String>,
) -> SurveyPairEnterResult {
    let mut state = match load_state() {
        Ok(s) => s,
        Err(reason) => {
            return SurveyPairEnterResult {
                ok: false,
                reason: Some(reason),
                role: None,
                echo_node_id: None,
                echo_host: None,
                http_port: None,
                token: None,
                node_id: None,
                device_id: None,
                session_epoch: None,
            };
        }
    };

    if !state.echo_survey_active {
        return SurveyPairEnterResult {
            ok: false,
            reason: Some(ECHO_SURVEY_TERMINATED_MESSAGE.to_string()),
            role: None,
            echo_node_id: None,
            echo_host: None,
            http_port: None,
            token: None,
            node_id: None,
            device_id: None,
            session_epoch: None,
        };
    }

    let session = if role == "powerfist" {
        state.powerfist_code.as_ref()
    } else {
        state.mirage_code.as_ref()
    };

    let Some(session) = session else {
        return SurveyPairEnterResult {
            ok: false,
            reason: Some("Pairing code expired. Generate new codes on Echo.".to_string()),
            role: None,
            echo_node_id: None,
            echo_host: None,
            http_port: None,
            token: None,
            node_id: None,
            device_id: None,
            session_epoch: None,
        };
    };

    if session_expired(session) {
        return SurveyPairEnterResult {
            ok: false,
            reason: Some("Pairing code expired. Generate new codes on Echo.".to_string()),
            role: None,
            echo_node_id: None,
            echo_host: None,
            http_port: None,
            token: None,
            node_id: None,
            device_id: None,
            session_epoch: None,
        };
    }

    if session.pair_id != pair_id || session.pair_secret != pair_secret {
        return SurveyPairEnterResult {
            ok: false,
            reason: Some("Invalid pairing code.".to_string()),
            role: None,
            echo_node_id: None,
            echo_host: None,
            http_port: None,
            token: None,
            node_id: None,
            device_id: None,
            session_epoch: None,
        };
    }

    let host = state.lan_hosts.first().cloned().unwrap_or_else(|| "127.0.0.1".to_string());

    if role == "mirage" {
        let node_id = match node_id.filter(|s| !s.trim().is_empty()) {
            Some(id) => id.trim().to_string(),
            None => {
                return SurveyPairEnterResult {
                    ok: false,
                    reason: Some("nodeId is required for Mirage pairing.".to_string()),
                    role: None,
                    echo_node_id: None,
                    echo_host: None,
                    http_port: None,
                    token: None,
                    node_id: None,
                    device_id: None,
                    session_epoch: None,
                };
            }
        };

        let existing_idx = state
            .paired_mirages
            .iter()
            .position(|m| m.node_id == node_id);
        let mirage_token = existing_idx
            .and_then(|idx| state.paired_mirages.get(idx))
            .map(|m| m.mirage_token.clone())
            .unwrap_or_else(|| hex_token());
        let entry = SurveyPairedMirageClient {
            node_id: node_id.clone(),
            mirage_token: mirage_token.clone(),
            paired_at: iso_now(),
        };
        if let Some(idx) = existing_idx {
            state.paired_mirages[idx] = entry;
        } else {
            state.paired_mirages.push(entry);
        }
        state.mirage_code = None;
        let session_epoch = state.session_epoch;
        let echo_node_id = state.echo_node_id.clone();
        if let Err(reason) = save_state(state) {
            return SurveyPairEnterResult {
                ok: false,
                reason: Some(reason),
                role: None,
                echo_node_id: None,
                echo_host: None,
                http_port: None,
                token: None,
                node_id: None,
                device_id: None,
                session_epoch: None,
            };
        }

        return SurveyPairEnterResult {
            ok: true,
            reason: None,
            role: Some("mirage".to_string()),
            echo_node_id: Some(echo_node_id),
            echo_host: Some(host),
            http_port: Some(DEFAULT_PAIR_HTTP_PORT),
            token: Some(mirage_token),
            node_id: Some(node_id),
            device_id: None,
            session_epoch: Some(session_epoch),
        };
    }

    let device_id = match device_id.filter(|s| !s.trim().is_empty()) {
        Some(id) => id.trim().to_string(),
        None => {
            return SurveyPairEnterResult {
                ok: false,
                reason: Some("deviceId is required for PowerFist pairing.".to_string()),
                role: None,
                echo_node_id: None,
                echo_host: None,
                http_port: None,
                token: None,
                node_id: None,
                device_id: None,
                session_epoch: None,
            };
        }
    };

    let remote_token = state
        .paired_powerfist
        .as_ref()
        .map(|p| p.remote_token.clone())
        .unwrap_or_else(hex_token);
    state.paired_powerfist = Some(SpyPairedPowerfistClient {
        device_id: device_id.clone(),
        remote_token: remote_token.clone(),
        paired_at: iso_now(),
    });
    state.powerfist_code = None;
    let session_epoch = state.session_epoch;
    let echo_node_id = state.echo_node_id.clone();
    if let Err(reason) = save_state(state) {
        return SurveyPairEnterResult {
            ok: false,
            reason: Some(reason),
            role: None,
            echo_node_id: None,
            echo_host: None,
            http_port: None,
            token: None,
            node_id: None,
            device_id: None,
            session_epoch: None,
        };
    }

    SurveyPairEnterResult {
        ok: true,
        reason: None,
        role: Some("powerfist".to_string()),
        echo_node_id: Some(echo_node_id),
        echo_host: Some(host),
        http_port: Some(DEFAULT_PAIR_HTTP_PORT),
        token: Some(remote_token),
        node_id: None,
        device_id: Some(device_id),
        session_epoch: Some(session_epoch),
    }
}

fn hex_token() -> String {
    use rand::RngCore;
    let mut bytes = [0u8; 24];
    rand::thread_rng().fill_bytes(&mut bytes);
    bytes.iter().map(|b| format!("{b:02x}")).collect()
}

pub fn get_linked_spy_mirages() -> Vec<crate::config::SpyMirageLink> {
    let Ok(state) = load_state() else {
        return Vec::new();
    };
    state
        .paired_mirages
        .into_iter()
        .map(|m| crate::config::SpyMirageLink {
            node_id: m.node_id,
            paired_at: m.paired_at,
        })
        .collect()
}
