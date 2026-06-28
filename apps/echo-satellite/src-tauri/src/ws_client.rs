use crate::capture::capture_primary_monitor_png_base64;
use crate::config::{SatelliteCredentials, WsRuntimeStatus};
use crate::mission::{build_capture_ws_url, ingest_mission_png, MissionEnvelope};
use crate::startup_log;
use futures_util::StreamExt;
use parking_lot::Mutex;
use std::sync::atomic::{AtomicBool, AtomicU64, Ordering};
use std::sync::Arc;
use std::time::Duration;
use tokio_tungstenite::{connect_async, tungstenite::Message};

pub struct WsController {
    stop: Arc<AtomicBool>,
    join: parking_lot::Mutex<Option<tauri::async_runtime::JoinHandle<()>>>,
}

impl WsController {
    pub fn stop(&self) {
        self.stop.store(true, Ordering::SeqCst);
        if let Some(handle) = self.join.lock().take() {
            handle.abort();
        }
    }
}

pub struct WsSharedState {
    pub ws_status: Mutex<WsRuntimeStatus>,
    pub last_error: Mutex<Option<String>>,
    pub last_mission_id: Mutex<Option<String>>,
    pub missions_handled: AtomicU64,
}

impl WsSharedState {
    pub fn new() -> Self {
        Self {
            ws_status: Mutex::new(WsRuntimeStatus::Disconnected),
            last_error: Mutex::new(None),
            last_mission_id: Mutex::new(None),
            missions_handled: AtomicU64::new(0),
        }
    }

    fn set_status(&self, status: WsRuntimeStatus) {
        *self.ws_status.lock() = status;
    }

    fn set_error(&self, message: Option<String>) {
        *self.last_error.lock() = message;
    }
}

pub fn spawn_capture_deck_loop(
    creds: SatelliteCredentials,
    shared: Arc<WsSharedState>,
) -> WsController {
    let stop = Arc::new(AtomicBool::new(false));
    let stop_flag = stop.clone();

    let handle = tauri::async_runtime::spawn(async move {
        startup_log::log("ws-client: loop started");
        while !stop_flag.load(Ordering::SeqCst) {
            shared.set_status(WsRuntimeStatus::Connecting);
            shared.set_error(None);

            let ws_url = build_capture_ws_url(&creds);
            startup_log::log(format!("ws-client: connecting to {ws_url}"));
            let connect_result = connect_async(&ws_url).await;

            let Ok((mut ws, _)) = connect_result else {
                shared.set_status(WsRuntimeStatus::Error);
                shared.set_error(Some("WebSocket connect failed.".to_string()));
                startup_log::log("ws-client: connect FAILED, retry in 2.5s");
                tokio::time::sleep(Duration::from_millis(2500)).await;
                continue;
            };

            shared.set_status(WsRuntimeStatus::Connected);
            startup_log::log("ws-client: connected");

            loop {
                if stop_flag.load(Ordering::SeqCst) {
                    let _ = ws.close(None).await;
                    break;
                }

                let next = tokio::time::timeout(Duration::from_secs(30), ws.next()).await;

                let message = match next {
                    Ok(Some(Ok(msg))) => msg,
                    Ok(Some(Err(_))) | Ok(None) => break,
                    Err(_) => continue,
                };

                if !message.is_text() {
                    continue;
                }

                let text = message.into_text().unwrap_or_default();
                let Ok(parsed) = serde_json::from_str::<MissionEnvelope>(&text) else {
                    continue;
                };

                if parsed.message_type != "mission" || parsed.kind != "silent-capture-solve" {
                    continue;
                }

                let mission_id = parsed.mission_id.clone();
                match capture_primary_monitor_png_base64() {
                    Ok(png_base64) => match ingest_mission_png(&parsed, &png_base64).await {
                        Ok(()) => {
                            shared.missions_handled.fetch_add(1, Ordering::SeqCst);
                            *shared.last_mission_id.lock() = Some(mission_id);
                            shared.set_error(None);
                        }
                        Err(reason) => {
                            shared.set_error(Some(reason));
                        }
                    },
                    Err(error) => {
                        shared.set_error(Some(error));
                    }
                }
            }

            shared.set_status(WsRuntimeStatus::Disconnected);
            if stop_flag.load(Ordering::SeqCst) {
                break;
            }
            tokio::time::sleep(Duration::from_millis(2500)).await;
        }

        shared.set_status(WsRuntimeStatus::Disconnected);
    });

    WsController {
        stop,
        join: parking_lot::Mutex::new(Some(handle)),
    }
}
