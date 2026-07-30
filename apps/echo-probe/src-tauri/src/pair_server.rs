use crate::config::{get_or_create_node_id, DEFAULT_PAIR_HTTP_PORT, SatelliteCredentials};
use crate::echo_commands::{execute_echo_probe_command, read_echo_listening_state, EchoCommandPayload};
use crate::echo_extension_bridge::EchoExtensionBridge;
use crate::pair::{complete_capture_pair, PairParams};
use crate::spy_echo_pairing::{
    complete_survey_pair_enter_by_pin, get_echo_survey_pairing_status, refresh_echo_survey_pair_codes,
    SurveyPairEnterInput,
};
use crate::startup_log;
use axum::{
    extract::{Query, State},
    http::{Method, StatusCode},
    response::{Html, IntoResponse},
    routing::{get, post},
    Json, Router,
};
use parking_lot::Mutex;
use serde::Deserialize;
use serde_json::{json, Value};
use std::net::SocketAddr;
use std::sync::Arc;
use tauri::AppHandle;
use tower_http::cors::{Any, CorsLayer};

#[derive(Clone)]
pub struct PairServerState {
    pub app: AppHandle,
    pub bridge: EchoExtensionBridge,
    pub on_paired: Arc<dyn Fn(SatelliteCredentials) + Send + Sync>,
    pub build_spy_status: Arc<dyn Fn() -> Value + Send + Sync>,
}

#[derive(Debug, Deserialize)]
struct CapturePairQuery {
    #[serde(rename = "pairId")]
    pair_id: String,
    #[serde(rename = "pairSecret")]
    pair_secret: String,
    #[serde(rename = "mirageHost")]
    mirage_host: String,
    #[serde(rename = "mirageHttpPort")]
    mirage_http_port: u16,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
struct SurveyPairEnterBody {
    pin: String,
    role: Option<String>,
    node_id: Option<String>,
    device_id: Option<String>,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
struct EchoCommandBody {
    action: String,
    tab_id: Option<serde_json::Value>,
    #[serde(default)]
    payload: Option<EchoCommandPayload>,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
struct ExtensionResultBody {
    id: String,
    #[serde(default)]
    result: Option<Value>,
}

async fn capture_pair_handler(
    State(state): State<PairServerState>,
    Query(query): Query<CapturePairQuery>,
) -> impl IntoResponse {
    let node_id = match get_or_create_node_id(&state.app) {
        Ok(id) => id,
        Err(reason) => {
            return Html(format!(
                "<body style=\"background:#000;color:#888;font-family:monospace\">pair failed: {reason}</body>"
            ))
            .into_response();
        }
    };

    let result = complete_capture_pair(PairParams {
        mirage_host: query.mirage_host,
        mirage_http_port: query.mirage_http_port,
        pair_id: query.pair_id,
        pair_secret: query.pair_secret,
        node_id,
    })
    .await;

    if let Some(creds) = result.credentials.clone() {
        (state.on_paired)(creds);
        Html("<body style=\"background:#000\"></body>").into_response()
    } else {
        Html(format!(
            "<body style=\"background:#000;color:#888;font-family:monospace\">{}</body>",
            result.reason.unwrap_or_else(|| "pair failed".to_string())
        ))
        .into_response()
    }
}

async fn health_handler() -> impl IntoResponse {
    "ok"
}

async fn spy_status_handler(State(state): State<PairServerState>) -> impl IntoResponse {
    Json((state.build_spy_status)())
}

async fn echo_codes_get_handler() -> impl IntoResponse {
    match get_echo_survey_pairing_status() {
        Ok(status) => {
            let mut value = serde_json::to_value(status).unwrap_or(json!({}));
            if let Value::Object(ref mut map) = value {
                map.insert("ok".to_string(), json!(true));
                map.insert("source".to_string(), json!("echo-probe"));
            }
            (StatusCode::OK, Json(value))
        }
        Err(reason) => (
            StatusCode::INTERNAL_SERVER_ERROR,
            Json(json!({ "ok": false, "reason": reason })),
        ),
    }
}

async fn echo_codes_post_handler() -> impl IntoResponse {
    if let Err(reason) = refresh_echo_survey_pair_codes() {
        return (
            StatusCode::INTERNAL_SERVER_ERROR,
            Json(json!({ "ok": false, "reason": reason })),
        );
    }
    echo_codes_get_handler().await
}

async fn pair_enter_handler(Json(body): Json<SurveyPairEnterBody>) -> impl IntoResponse {
    let result = complete_survey_pair_enter_by_pin(SurveyPairEnterInput {
        pin: body.pin,
        role: body.role.unwrap_or_else(|| "mirage".to_string()),
        node_id: body.node_id,
        device_id: body.device_id,
    });
    let status = if result.ok {
        StatusCode::OK
    } else {
        StatusCode::FORBIDDEN
    };
    (status, Json(serde_json::to_value(result).unwrap_or(json!({ "ok": false }))))
}

async fn team_status_handler() -> impl IntoResponse {
    Json(json!({
        "ok": true,
        "connected": false,
        "members": [],
        "message": "Survey team hub is not yet wired on Echo Probe.",
    }))
}

async fn echo_command_handler(
    State(state): State<PairServerState>,
    Json(body): Json<EchoCommandBody>,
) -> impl IntoResponse {
    let tab_id = body.tab_id.and_then(|raw| match raw {
        serde_json::Value::Number(n) => n.as_i64(),
        serde_json::Value::String(s) => s.trim().parse::<i64>().ok(),
        _ => None,
    });
    let action = body.action.trim();
    let result = execute_echo_probe_command(action, &state.bridge, tab_id, body.payload).await;
    let status = if result.get("ok").and_then(|v| v.as_bool()) == Some(true) {
        StatusCode::OK
    } else {
        StatusCode::BAD_REQUEST
    };
    (status, Json(result))
}

async fn echo_listening_handler() -> impl IntoResponse {
    let mut state = read_echo_listening_state();
    if let Value::Object(ref mut map) = state {
        map.insert("ok".to_string(), json!(true));
    }
    Json(state)
}

async fn extension_poll_handler(State(state): State<PairServerState>) -> impl IntoResponse {
    Json(json!({
        "ok": true,
        "command": state.bridge.take_pending(),
        "bridge": state.bridge.status(),
    }))
}

async fn extension_result_handler(
    State(state): State<PairServerState>,
    Json(body): Json<ExtensionResultBody>,
) -> impl IntoResponse {
    let id = body.id.trim();
    if id.is_empty() {
        return (
            StatusCode::BAD_REQUEST,
            Json(json!({ "ok": false, "reason": "id is required." })),
        );
    }
    let result = state
        .bridge
        .complete(id, body.result.unwrap_or(json!({})));
    let ok = result.get("ok").and_then(|v| v.as_bool()) == Some(true);
    let status = if ok {
        StatusCode::OK
    } else {
        StatusCode::BAD_REQUEST
    };
    (status, Json(result))
}

async fn extension_status_handler(State(state): State<PairServerState>) -> impl IntoResponse {
    let mut payload = state.bridge.status();
    if let Value::Object(ref mut map) = payload {
        map.insert("ok".to_string(), json!(true));
    }
    Json(payload)
}

pub struct PairHttpServer {
    shutdown: tokio::sync::watch::Sender<bool>,
    join: Mutex<Option<tauri::async_runtime::JoinHandle<()>>>,
}

impl PairHttpServer {
    pub fn stop(&self) {
        let _ = self.shutdown.send(true);
        if let Some(handle) = self.join.lock().take() {
            handle.abort();
        }
    }
}

pub fn spawn_pair_http_server(
    app: AppHandle,
    port: u16,
    bridge: EchoExtensionBridge,
    on_paired: Arc<dyn Fn(SatelliteCredentials) + Send + Sync>,
    build_spy_status: Arc<dyn Fn() -> Value + Send + Sync>,
) -> PairHttpServer {
    let (shutdown_tx, mut shutdown_rx) = tokio::sync::watch::channel(false);
    let state = PairServerState {
        app,
        bridge,
        on_paired,
        build_spy_status,
    };

    let cors = CorsLayer::new()
        .allow_origin(Any)
        .allow_methods([Method::GET, Method::POST, Method::OPTIONS])
        .allow_headers(Any);

    let handle = tauri::async_runtime::spawn(async move {
        startup_log::log("pair-server: async task started, binding port");
        let router = Router::new()
            .route("/powerfist/capture-pair", get(capture_pair_handler))
            .route("/health", get(health_handler))
            .route("/spy/status", get(spy_status_handler))
            .route("/api/survey/echo/codes", get(echo_codes_get_handler).post(echo_codes_post_handler))
            .route("/api/survey/pair/enter", post(pair_enter_handler))
            .route("/api/survey/team/status", get(team_status_handler))
            .route("/api/survey/echo/command", post(echo_command_handler))
            .route("/api/survey/echo/listening", get(echo_listening_handler))
            .route("/api/survey/echo/extension/poll", get(extension_poll_handler))
            .route("/api/survey/echo/extension/result", post(extension_result_handler))
            .route("/api/survey/echo/extension/status", get(extension_status_handler))
            .layer(cors)
            .with_state(state);

        let addr = SocketAddr::from(([0, 0, 0, 0], port));
        let listener = match tokio::net::TcpListener::bind(addr).await {
            Ok(listener) => listener,
            Err(e) => {
                startup_log::log(format!("pair-server: FAILED bind {addr}: {e}"));
                return;
            }
        };

        startup_log::log(format!("pair-server: listening on {addr} (Survey HTTP parity)"));

        let server = axum::serve(listener, router).with_graceful_shutdown(async move {
            loop {
                if *shutdown_rx.borrow() {
                    break;
                }
                tokio::time::sleep(std::time::Duration::from_millis(200)).await;
            }
        });

        let _ = server.await;
    });

    PairHttpServer {
        shutdown: shutdown_tx,
        join: Mutex::new(Some(handle)),
    }
}

pub fn default_pair_port() -> u16 {
    DEFAULT_PAIR_HTTP_PORT
}
