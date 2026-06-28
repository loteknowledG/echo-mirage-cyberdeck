use crate::config::SatelliteCredentials;
use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct MissionEnvelope {
    #[serde(rename = "type")]
    pub message_type: String,
    pub mission_id: String,
    pub kind: String,
    pub ingest_url: String,
    pub mission_secret: String,
    pub prompt: String,
}

#[derive(Debug, Deserialize)]
struct IngestResponse {
    ok: Option<bool>,
    reason: Option<String>,
}

pub async fn ingest_mission_png(
    envelope: &MissionEnvelope,
    png_base64: &str,
) -> Result<(), String> {
    let client = reqwest::Client::new();
    let body = serde_json::json!({
        "missionId": envelope.mission_id,
        "kind": envelope.kind,
        "missionSecret": envelope.mission_secret,
        "prompt": envelope.prompt,
        "pngBase64": png_base64,
    });

    let response = client
        .post(&envelope.ingest_url)
        .json(&body)
        .send()
        .await
        .map_err(|e| format!("Mirage ingest failed: {e}"))?;

    let payload: IngestResponse = response
        .json()
        .await
        .map_err(|e| format!("Invalid ingest response: {e}"))?;

    if payload.ok == Some(true) {
        Ok(())
    } else {
        Err(payload
            .reason
            .unwrap_or_else(|| "Mirage ingest rejected.".to_string()))
    }
}

pub fn build_capture_ws_url(creds: &SatelliteCredentials) -> String {
    format!(
        "ws://{}:{}?role=capture-deck&token={}&nodeId={}",
        creds.ws_host, creds.ws_port, creds.capture_token, creds.node_id
    )
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct TestCaptureResult {
    pub ok: bool,
    pub width: Option<u32>,
    pub height: Option<u32>,
    pub png_bytes: Option<usize>,
    pub error: Option<String>,
}
