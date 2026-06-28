use crate::config::{get_or_create_node_id, DEFAULT_PAIR_HTTP_PORT, SatelliteCredentials};
use crate::pair::{complete_capture_pair, parse_capture_pair_url, PairParams};
use axum::{
    extract::{Query, State},
    response::{Html, IntoResponse},
    routing::get,
    Router,
};
use parking_lot::Mutex;
use serde::Deserialize;
use std::net::SocketAddr;
use std::sync::Arc;
use tauri::{AppHandle, Manager};

#[derive(Clone)]
pub struct PairServerState {
    pub app: AppHandle,
    pub on_paired: Arc<dyn Fn(SatelliteCredentials) + Send + Sync>,
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

async fn capture_pair_handler(
    State(state): State<PairServerState>,
    Query(query): Query<CapturePairQuery>,
) -> impl IntoResponse {
    let node_id = match get_or_create_node_id(&state.app) {
        Ok(id) => id,
        Err(reason) => {
            return Html(format!("<body style=\"background:#000;color:#888;font-family:monospace\">pair failed: {reason}</body>"))
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

pub struct PairHttpServer {
    shutdown: tokio::sync::watch::Sender<bool>,
    join: Mutex<Option<tokio::task::JoinHandle<()>>>,
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
    on_paired: Arc<dyn Fn(SatelliteCredentials) + Send + Sync>,
) -> PairHttpServer {
    let (shutdown_tx, mut shutdown_rx) = tokio::sync::watch::channel(false);
    let state = PairServerState { app, on_paired };

    let handle = tokio::spawn(async move {
        let router = Router::new()
            .route("/powerfist/capture-pair", get(capture_pair_handler))
            .route("/health", get(health_handler))
            .with_state(state);

        let addr = SocketAddr::from(([0, 0, 0, 0], port));
        let listener = match tokio::net::TcpListener::bind(addr).await {
            Ok(listener) => listener,
            Err(_) => return,
        };

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
