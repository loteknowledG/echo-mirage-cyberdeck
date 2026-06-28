mod capture;
mod config;
mod mission;
mod pair;
mod pair_server;
mod permissions;
mod ws_client;

use config::{
    clear_credentials, get_or_create_node_id, load_credentials, save_credentials,
    SatelliteCredentials, SatelliteStatus, WsRuntimeStatus, DEFAULT_PAIR_HTTP_PORT,
};
use mission::TestCaptureResult;
use pair::{complete_capture_pair, parse_capture_pair_url, PairParams, PairResult};
use permissions::{
    open_screen_recording_settings as open_macos_screen_recording_settings,
    permission_status,
    PermissionStatus,
};
use pair_server::{spawn_pair_http_server, PairHttpServer};
use parking_lot::Mutex;
use std::sync::atomic::{AtomicBool, Ordering};
use std::sync::Arc;
use tauri::{
    menu::{Menu, MenuItem},
    tray::{MouseButton, MouseButtonState, TrayIconBuilder, TrayIconEvent},
    AppHandle, Manager, RunEvent, State,
};
use ws_client::{spawn_capture_deck_loop, WsController, WsSharedState};

struct AppState {
    armed: AtomicBool,
    pair_http_port: u16,
    ws_shared: Arc<WsSharedState>,
    ws_controller: Mutex<Option<WsController>>,
    pair_server: Mutex<Option<PairHttpServer>>,
}

impl AppState {
    fn new() -> Self {
        Self {
            armed: AtomicBool::new(false),
            pair_http_port: DEFAULT_PAIR_HTTP_PORT,
            ws_shared: Arc::new(WsSharedState::new()),
            ws_controller: Mutex::new(None),
            pair_server: Mutex::new(None),
        }
    }

    fn status_snapshot(&self, app: &AppHandle) -> SatelliteStatus {
        SatelliteStatus {
            armed: self.armed.load(Ordering::SeqCst),
            ws_status: self.ws_shared.ws_status.lock().clone(),
            credentials: load_credentials(app),
            pair_http_port: self.pair_http_port,
            last_error: self.ws_shared.last_error.lock().clone(),
            last_mission_id: self.ws_shared.last_mission_id.lock().clone(),
            missions_handled: self.ws_shared.missions_handled.load(Ordering::SeqCst),
        }
    }

    fn stop_ws(&self) {
        if let Some(controller) = self.ws_controller.lock().take() {
            controller.stop();
        }
        *self.ws_shared.ws_status.lock() = WsRuntimeStatus::Disconnected;
    }

    fn start_ws(&self, creds: SatelliteCredentials) {
        self.stop_ws();
        let controller = spawn_capture_deck_loop(creds, self.ws_shared.clone());
        *self.ws_controller.lock() = Some(controller);
    }

    fn disarm(&self, app: &AppHandle) {
        self.armed.store(false, Ordering::SeqCst);
        self.stop_ws();
        let _ = clear_credentials(app);
    }
}

fn hide_main_window(app: &AppHandle) {
    if let Some(window) = app.get_webview_window("main") {
        let _ = window.hide();
    }
}

fn show_main_window(app: &AppHandle) {
    if let Some(window) = app.get_webview_window("main") {
        let _ = window.show();
        let _ = window.set_focus();
    }
}

fn arm_with_credentials(app: &AppHandle, state: &AppState, creds: SatelliteCredentials) -> Result<(), String> {
    save_credentials(app, &creds)?;
    state.start_ws(creds);
    state.armed.store(true, Ordering::SeqCst);
    hide_main_window(app);
    Ok(())
}

fn ensure_pair_server(app: AppHandle, state: Arc<AppState>) {
    if state.pair_server.lock().is_some() {
        return;
    }

    let port = state.pair_http_port;
    let app_for_pair = app.clone();
    let state_for_pair = state.clone();

    let on_paired = Arc::new(move |creds: SatelliteCredentials| {
        let _ = arm_with_credentials(&app_for_pair, &state_for_pair, creds);
    });

    let server = spawn_pair_http_server(app.clone(), port, on_paired);
    *state.pair_server.lock() = Some(server);
}

#[tauri::command]
fn get_status(app: AppHandle, state: State<'_, Arc<AppState>>) -> SatelliteStatus {
    state.status_snapshot(&app)
}

#[tauri::command]
async fn pair_from_url(
    app: AppHandle,
    state: State<'_, Arc<AppState>>,
    capture_pair_url: String,
) -> Result<PairResult, String> {
    let state = state.inner().clone();
    let mut params = match parse_capture_pair_url(&capture_pair_url) {
        Ok(params) => params,
        Err(reason) => {
            return Ok(PairResult {
                ok: false,
                credentials: None,
                reason: Some(reason),
            });
        }
    };

    if let Ok(node_id) = get_or_create_node_id(&app) {
        params.node_id = node_id;
    }

    let result = complete_capture_pair(params).await;
    if let Some(creds) = result.credentials.clone() {
        if let Err(reason) = arm_with_credentials(&app, &state, creds) {
            return Ok(PairResult {
                ok: false,
                credentials: None,
                reason: Some(reason),
            });
        }
    }
    Ok(result)
}

#[tauri::command]
async fn pair_manual(
    app: AppHandle,
    state: State<'_, Arc<AppState>>,
    mirage_host: String,
    mirage_http_port: u16,
    pair_id: String,
    pair_secret: String,
) -> Result<PairResult, String> {
    let state = state.inner().clone();
    let node_id = match get_or_create_node_id(&app) {
        Ok(id) => id,
        Err(reason) => {
            return Ok(PairResult {
                ok: false,
                credentials: None,
                reason: Some(reason),
            });
        }
    };

    let result = complete_capture_pair(PairParams {
        mirage_host,
        mirage_http_port,
        pair_id,
        pair_secret,
        node_id,
    })
    .await;

    if let Some(creds) = result.credentials.clone() {
        if let Err(reason) = arm_with_credentials(&app, &state, creds) {
            return Ok(PairResult {
                ok: false,
                credentials: None,
                reason: Some(reason),
            });
        }
    }
    Ok(result)
}

#[tauri::command]
fn test_capture() -> TestCaptureResult {
    match capture::capture_primary_monitor_png_base64() {
        Ok(png_base64) => {
            let dimensions = capture::capture_primary_monitor_dimensions().ok();
            TestCaptureResult {
                ok: true,
                width: dimensions.map(|d| d.0),
                height: dimensions.map(|d| d.1),
                png_bytes: Some(png_base64.len()),
                error: None,
            }
        }
        Err(error) => TestCaptureResult {
            ok: false,
            width: None,
            height: None,
            png_bytes: None,
            error: Some(error),
        },
    }
}

#[tauri::command]
fn disarm(app: AppHandle, state: State<'_, Arc<AppState>>) -> SatelliteStatus {
    state.disarm(&app);
    show_main_window(&app);
    state.status_snapshot(&app)
}

#[tauri::command]
fn show_setup(app: AppHandle) -> Result<(), String> {
    show_main_window(&app);
    Ok(())
}

#[tauri::command]
fn hide_to_tray(app: AppHandle) -> Result<(), String> {
    hide_main_window(&app);
    Ok(())
}

#[tauri::command]
fn check_permissions() -> PermissionStatus {
    permission_status()
}

#[tauri::command]
fn open_screen_recording_settings() -> Result<(), String> {
    open_macos_screen_recording_settings();
    Ok(())
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .manage(Arc::new(AppState::new()))
        .setup(|app| {
            let state = app.state::<Arc<AppState>>().inner().clone();
            ensure_pair_server(app.handle().clone(), state.clone());

            if let Some(creds) = load_credentials(app.handle()) {
                let _ = arm_with_credentials(app.handle(), &state, creds);
            }

            let show_item = MenuItem::with_id(app, "show", "Show setup", true, None::<&str>)?;
            let disarm_item = MenuItem::with_id(app, "disarm", "Disarm", true, None::<&str>)?;
            let quit_item = MenuItem::with_id(app, "quit", "Quit", true, None::<&str>)?;
            let tray_menu = Menu::with_items(app, &[&show_item, &disarm_item, &quit_item])?;

            let _tray = TrayIconBuilder::new()
                .icon(app.default_window_icon().unwrap().clone())
                .menu(&tray_menu)
                .tooltip("Echo Satellite")
                .on_menu_event(|app, event| match event.id.as_ref() {
                    "show" => {
                        show_main_window(&app);
                    }
                    "disarm" => {
                        let state = app.state::<Arc<AppState>>();
                        state.disarm(&app);
                        show_main_window(&app);
                    }
                    "quit" => {
                        app.exit(0);
                    }
                    _ => {}
                })
                .on_tray_icon_event(|tray, event| {
                    if let TrayIconEvent::Click {
                        button: MouseButton::Left,
                        button_state: MouseButtonState::Up,
                        ..
                    } = event
                    {
                        let app = tray.app_handle();
                        show_main_window(&app);
                    }
                })
                .build(app)?;

            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            get_status,
            pair_from_url,
            pair_manual,
            test_capture,
            disarm,
            show_setup,
            hide_to_tray,
            check_permissions,
            open_screen_recording_settings,
        ])
        .build(tauri::generate_context!())
        .expect("error while running tauri application")
        .run(|app, event| {
            if let RunEvent::ExitRequested { api, .. } = event {
                let state = app.state::<Arc<AppState>>();
                if state.armed.load(Ordering::SeqCst) {
                    api.prevent_exit();
                    hide_main_window(app);
                }
            }
        });
}
