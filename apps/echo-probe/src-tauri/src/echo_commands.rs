use crate::capture;
use crate::echo_extension_bridge::EchoExtensionBridge;
use serde::Deserialize;
use serde_json::{json, Value};

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct EchoCommandPayload {
    pub prompt: Option<String>,
    pub png_base64: Option<String>,
    #[serde(default)]
    pub png_base64_list: Vec<String>,
}

pub async fn execute_echo_probe_command(
    action: &str,
    bridge: &EchoExtensionBridge,
    tab_id: Option<i64>,
    payload: Option<EchoCommandPayload>,
) -> Value {
    match action {
        "echo.screenshot" => execute_screenshot().await,
        "echo.ext-list-tabs" => list_extension_tabs(bridge).await,
        "echo.ext-capture-text" => capture_extension_tab(bridge, tab_id).await,
        "echo.ext-capture-active" => capture_extension_active_tab(bridge).await,
        "echo.ext-bridge-status" => {
            json!({
                "ok": true,
                "message": "echo-extension bridge status.",
                "bridge": bridge.status(),
            })
        }
        "echo.start-listening" | "echo.stop-listening" | "echo.save-recording" => json!({
            "ok": false,
            "reason": "Echo listening/STT is not yet supported on Echo Probe.",
        }),
        "echo.copy-selected" | "echo.read-clipboard" => json!({
            "ok": false,
            "reason": "Clipboard commands are not yet supported on Echo Probe — use Echo Satellite (Electron) or copy manually.",
        }),
        "echo.solve-codex" => {
            let _ = payload;
            json!({
                "ok": false,
                "reason": "Codex solve is not yet supported on Echo Probe — use Echo Satellite (Electron).",
            })
        }
        _ => json!({
            "ok": false,
            "reason": format!("Unknown Echo command: {action}"),
        }),
    }
}

pub fn read_echo_listening_state() -> Value {
    json!({
        "listening": false,
        "supported": false,
        "message": "Echo listening is not yet supported on Echo Probe.",
    })
}

async fn execute_screenshot() -> Value {
    match capture::capture_primary_monitor_png_base64() {
        Ok(png_base64) => {
            let dimensions = capture::capture_primary_monitor_dimensions().ok();
            let bytes = png_base64.len();
            let (width, height) = dimensions.unwrap_or((0, 0));
            json!({
                "ok": true,
                "message": format!("Screenshot {width}×{height} captured on Echo (PNG {bytes} bytes)."),
                "pngBase64": png_base64,
                "mimeType": "image/png",
                "width": width,
                "height": height,
            })
        }
        Err(reason) => json!({ "ok": false, "reason": reason }),
    }
}

async fn list_extension_tabs(bridge: &EchoExtensionBridge) -> Value {
    match bridge.enqueue("list-tabs", None).await {
        Ok(result) => {
            if result.get("ok").and_then(|v| v.as_bool()) != Some(true) {
                return json!({
                    "ok": false,
                    "reason": result.get("reason").and_then(|v| v.as_str()).unwrap_or("echo-extension list-tabs failed."),
                    "bridge": bridge.status(),
                });
            }
            let tabs = result.get("tabs").cloned().unwrap_or(json!([]));
            let count = tabs.as_array().map(|a| a.len()).unwrap_or(0);
            json!({
                "ok": true,
                "message": format!("Listed {count} Chrome tab(s) via echo-extension."),
                "tabs": tabs,
                "bridge": bridge.status(),
            })
        }
        Err(reason) => json!({
            "ok": false,
            "reason": reason,
            "bridge": bridge.status(),
        }),
    }
}

async fn capture_extension_tab(bridge: &EchoExtensionBridge, tab_id: Option<i64>) -> Value {
    let Some(tab_id) = tab_id else {
        return json!({
            "ok": false,
            "reason": "tabId is required for echo.ext-capture-text.",
        });
    };
    match bridge.enqueue("capture-tab", Some(tab_id)).await {
        Ok(result) => {
            if result.get("ok").and_then(|v| v.as_bool()) != Some(true) {
                return json!({
                    "ok": false,
                    "reason": result.get("reason").and_then(|v| v.as_str()).unwrap_or("echo-extension capture-tab failed."),
                    "bridge": bridge.status(),
                });
            }
            json!({
                "ok": true,
                "message": result.get("message").and_then(|v| v.as_str()).unwrap_or(&format!("Captured tab {tab_id} via echo-extension.")),
                "snapshot": result.get("snapshot").cloned(),
                "bridge": bridge.status(),
            })
        }
        Err(reason) => json!({
            "ok": false,
            "reason": reason,
            "bridge": bridge.status(),
        }),
    }
}

async fn capture_extension_active_tab(bridge: &EchoExtensionBridge) -> Value {
    match bridge.enqueue("capture-active", None).await {
        Ok(result) => {
            if result.get("ok").and_then(|v| v.as_bool()) != Some(true) {
                return json!({
                    "ok": false,
                    "reason": result.get("reason").and_then(|v| v.as_str()).unwrap_or("echo-extension capture-active failed."),
                    "bridge": bridge.status(),
                });
            }
            json!({
                "ok": true,
                "message": result.get("message").and_then(|v| v.as_str()).unwrap_or("Captured active tab via echo-extension."),
                "snapshot": result.get("snapshot").cloned(),
                "bridge": bridge.status(),
            })
        }
        Err(reason) => json!({
            "ok": false,
            "reason": reason,
            "bridge": bridge.status(),
        }),
    }
}
