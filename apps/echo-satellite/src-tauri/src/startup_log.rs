use serde::{Deserialize, Serialize};
use std::fs::{create_dir_all, read_to_string, OpenOptions, write};
use std::io::Write as _;
use std::panic::{self, PanicHookInfo};
use std::path::PathBuf;
use std::sync::{Once, OnceLock};
use uuid::Uuid;

static LOG_PATH: OnceLock<PathBuf> = OnceLock::new();
static SESSION_ID: OnceLock<String> = OnceLock::new();
static PREVIOUS_SESSION: OnceLock<Option<SessionRecord>> = OnceLock::new();
static PANIC_HOOK: Once = Once::new();

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct SessionRecord {
    pub session_id: String,
    pub version: String,
    pub platform: String,
    pub tray_mode: String,
    pub started_at_unix: u64,
    pub status: String,
    pub last_message: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct DiagnosticsReport {
    pub version: String,
    pub platform: String,
    pub tray_mode: String,
    pub log_path: String,
    pub session_id: String,
    pub previous_session_crashed: bool,
    pub previous_session: Option<SessionRecord>,
    pub log_tail: String,
    pub support_hint: String,
}

fn state_file_path() -> PathBuf {
    log_file_path().with_file_name("last-session.json")
}

pub fn log_file_path() -> PathBuf {
    if let Some(path) = LOG_PATH.get() {
        return path.clone();
    }

    let path = default_log_path();
    let _ = LOG_PATH.set(path.clone());
    path
}

fn default_log_path() -> PathBuf {
    #[cfg(target_os = "macos")]
    {
        if let Some(home) = std::env::var_os("HOME") {
            return PathBuf::from(home).join("Library/Logs/Echo-Satellite/startup.log");
        }
    }

    #[cfg(target_os = "windows")]
    {
        if let Some(appdata) = std::env::var_os("APPDATA") {
            return PathBuf::from(appdata).join("Echo-Satellite/logs/startup.log");
        }
    }

    if let Some(temp) = std::env::var_os("TEMP").or_else(|| std::env::var_os("TMPDIR")) {
        return PathBuf::from(temp).join("echo-satellite-startup.log");
    }

    PathBuf::from("echo-satellite-startup.log")
}

fn now_unix() -> u64 {
    std::time::SystemTime::now()
        .duration_since(std::time::UNIX_EPOCH)
        .map(|d| d.as_secs())
        .unwrap_or(0)
}

pub fn tray_mode_label() -> &'static str {
    #[cfg(feature = "system-tray")]
    {
        "system-tray"
    }
    #[cfg(not(feature = "system-tray"))]
    {
        "window-only (macOS 15+ safe mode)"
    }
}

fn append_log_line(line: &str) {
    eprintln!("[echo-satellite] {line}");

    let path = log_file_path();
    if let Some(parent) = path.parent() {
        let _ = create_dir_all(parent);
    }

    if let Ok(mut file) = OpenOptions::new()
        .create(true)
        .append(true)
        .open(&path)
    {
        let _ = writeln!(file, "{line}");
    }
}

pub fn log(message: impl AsRef<str>) {
    let ts = now_unix();
    append_log_line(&format!("[{ts}] {}", message.as_ref()));
}

/// Log a numbered startup step and persist it as the last-known-good checkpoint.
pub fn step(phase: &str, n: u8, total: u8, detail: impl AsRef<str>) {
    let line = format!("[{phase} {n}/{total}] {}", detail.as_ref());
    log(&line);
    mark_session_status("running", Some(line));
}

fn write_session(record: &SessionRecord) {
    if let Some(parent) = state_file_path().parent() {
        let _ = create_dir_all(parent);
    }
    if let Ok(raw) = serde_json::to_string_pretty(record) {
        let _ = write(state_file_path(), raw);
    }
}

fn read_session() -> Option<SessionRecord> {
    let raw = read_to_string(state_file_path()).ok()?;
    serde_json::from_str(&raw).ok()
}

fn current_session_id() -> String {
    SESSION_ID
        .get_or_init(|| Uuid::new_v4().to_string())
        .clone()
}

pub fn install_panic_hook() {
    PANIC_HOOK.call_once(|| {
        let default_hook = panic::take_hook();
        panic::set_hook(Box::new(move |info: &PanicHookInfo<'_>| {
            let message = panic_message(info);
            let location = info
                .location()
                .map(|loc| format!("{}:{}:{}", loc.file(), loc.line(), loc.column()))
                .unwrap_or_else(|| "unknown location".to_string());
            log(format!("PANIC at {location}: {message}"));
            mark_session_status("panic", Some(format!("{location}: {message}")));
            default_hook(info);
        }));
    });
}

fn panic_message(info: &PanicHookInfo<'_>) -> String {
    info.payload()
        .downcast_ref::<&str>()
        .map(|s| (*s).to_string())
        .or_else(|| info.payload().downcast_ref::<String>().cloned())
        .unwrap_or_else(|| "unknown panic payload".to_string())
}

pub fn begin_session(version: &str) {
    install_panic_hook();

    let previous = read_session();
    if previous.as_ref().is_some_and(|prev| prev.status == "running") {
        let prev = previous.as_ref().unwrap();
        log(format!(
            "PREVIOUS SESSION CRASHED OR HUNG (id={}, last_step={})",
            prev.session_id,
            prev.last_message.clone().unwrap_or_else(|| "?".to_string())
        ));
        let _ = PREVIOUS_SESSION.set(previous);
    } else {
        let _ = PREVIOUS_SESSION.set(None);
    }

    let session_id = current_session_id();
    log(format!(
        "SESSION BEGIN id={session_id} v={version} os={} tray={}",
        std::env::consts::OS,
        tray_mode_label()
    ));

    write_session(&SessionRecord {
        session_id,
        version: version.to_string(),
        platform: std::env::consts::OS.to_string(),
        tray_mode: tray_mode_label().to_string(),
        started_at_unix: now_unix(),
        status: "running".to_string(),
        last_message: Some("[boot 0/8] session begin".to_string()),
    });
}

pub fn mark_session_status(status: &str, last_message: Option<String>) {
    let session_id = current_session_id();
    write_session(&SessionRecord {
        session_id,
        version: env!("CARGO_PKG_VERSION").to_string(),
        platform: std::env::consts::OS.to_string(),
        tray_mode: tray_mode_label().to_string(),
        started_at_unix: now_unix(),
        status: status.to_string(),
        last_message,
    });
}

pub fn mark_session_ok(detail: &str) {
    log(format!("SESSION OK: {detail}"));
    mark_session_status("ok", Some(detail.to_string()));
}

pub fn build_diagnostics_report() -> DiagnosticsReport {
    let previous_session = PREVIOUS_SESSION.get().and_then(|slot| slot.clone());
    let previous_session_crashed = previous_session.is_some();

    let log_tail = read_to_string(log_file_path())
        .map(|raw| tail_lines(&raw, 80))
        .unwrap_or_else(|_| "(log file not written yet)".to_string());

    let support_hint = if previous_session_crashed {
        "Previous launch stopped before finishing startup. The last numbered step in the log is where it died. Copy diagnostics below.".to_string()
    } else {
        "Numbered [boot N/8] lines show startup progress. If it crashes, reopen — the last step is the crash point.".to_string()
    };

    DiagnosticsReport {
        version: env!("CARGO_PKG_VERSION").to_string(),
        platform: std::env::consts::OS.to_string(),
        tray_mode: tray_mode_label().to_string(),
        log_path: log_file_path().display().to_string(),
        session_id: current_session_id(),
        previous_session_crashed,
        previous_session,
        log_tail,
        support_hint,
    }
}

fn tail_lines(raw: &str, max_lines: usize) -> String {
    let lines: Vec<&str> = raw.lines().collect();
    if lines.len() <= max_lines {
        return raw.to_string();
    }
    lines[lines.len() - max_lines..].join("\n")
}
