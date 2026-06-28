use std::fs::{create_dir_all, OpenOptions};
use std::io::Write;
use std::path::PathBuf;
use std::sync::OnceLock;

static LOG_PATH: OnceLock<PathBuf> = OnceLock::new();

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
            return PathBuf::from(home)
                .join("Library/Logs/Echo-Satellite/startup.log");
        }
    }

    #[cfg(target_os = "windows")]
    {
        if let Some(appdata) = std::env::var_os("APPDATA") {
            return PathBuf::from(appdata)
                .join("Echo-Satellite/logs/startup.log");
        }
    }

    if let Some(temp) = std::env::var_os("TEMP").or_else(|| std::env::var_os("TMPDIR")) {
        return PathBuf::from(temp).join("echo-satellite-startup.log");
    }

    PathBuf::from("echo-satellite-startup.log")
}

pub fn log(message: impl AsRef<str>) {
    let message = message.as_ref();
    eprintln!("[echo-satellite] {message}");

    let path = log_file_path();
    if let Some(parent) = path.parent() {
        let _ = create_dir_all(parent);
    }

    if let Ok(mut file) = OpenOptions::new().create(true).append(true).open(path) {
        let _ = writeln!(file, "{message}");
    }
}
