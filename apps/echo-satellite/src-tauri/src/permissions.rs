#[cfg(target_os = "macos")]
mod platform {
    use std::process::Command;

    /// Best-effort Screen Recording permission probe (macOS 10.15+).
    pub fn screen_recording_authorized() -> bool {
        let output = Command::new("/usr/bin/swift")
            .arg("-e")
            .arg(
                r#"
import CoreGraphics
print(CGPreflightScreenCaptureAccess())
"#,
            )
            .output();
        match output {
            Ok(out) => {
                let text = String::from_utf8_lossy(&out.stdout);
                text.trim() == "true" || text.trim() == "1"
            }
            Err(_) => false,
        }
    }

    pub fn open_screen_recording_settings() {
        let _ = Command::new("open")
            .arg("x-apple.systempreferences:com.apple.preference.security?Privacy_ScreenCapture")
            .status();
    }
}

#[cfg(not(target_os = "macos"))]
mod platform {
    pub fn screen_recording_authorized() -> bool {
        true
    }

    pub fn open_screen_recording_settings() {}
}

#[derive(serde::Serialize)]
#[serde(rename_all = "camelCase")]
pub struct PermissionStatus {
    pub platform: String,
    pub screen_recording: bool,
    pub hint: Option<String>,
}

pub fn permission_status() -> PermissionStatus {
    let screen_recording = platform::screen_recording_authorized();
    #[cfg(target_os = "macos")]
    let hint = if screen_recording {
        None
    } else {
        Some(
            "Grant Screen Recording for Echo Satellite in System Settings → Privacy & Security."
                .to_string(),
        )
    };
    #[cfg(not(target_os = "macos"))]
    let hint: Option<String> = None;

    PermissionStatus {
        platform: std::env::consts::OS.to_string(),
        screen_recording,
        hint,
    }
}

pub fn open_screen_recording_settings() {
    platform::open_screen_recording_settings();
}
