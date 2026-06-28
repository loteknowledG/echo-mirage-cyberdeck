use crate::config::{SatelliteCredentials, ECHO_NODE_LABEL};
use serde::{Deserialize, Serialize};

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
struct PairResponse {
    ok: bool,
    capture_token: Option<String>,
    node_id: Option<String>,
    ws_host: Option<String>,
    ws_port: Option<u16>,
    reason: Option<String>,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct PairResult {
    pub ok: bool,
    pub credentials: Option<SatelliteCredentials>,
    pub reason: Option<String>,
}

#[derive(Debug, Clone)]
pub struct PairParams {
    pub mirage_host: String,
    pub mirage_http_port: u16,
    pub pair_id: String,
    pub pair_secret: String,
    pub node_id: String,
}

pub async fn complete_capture_pair(params: PairParams) -> PairResult {
    let url = format!(
        "http://{}:{}/api/powerfist/pair/capture",
        params.mirage_host, params.mirage_http_port
    );

    let client = reqwest::Client::new();
    let body = serde_json::json!({
        "pairId": params.pair_id,
        "pairSecret": params.pair_secret,
        "nodeId": params.node_id,
        "label": ECHO_NODE_LABEL,
    });

    let response = match client.post(&url).json(&body).send().await {
        Ok(res) => res,
        Err(e) => {
            return PairResult {
                ok: false,
                credentials: None,
                reason: Some(format!("Pair request failed: {e}")),
            };
        }
    };

    let payload: PairResponse = match response.json().await {
        Ok(json) => json,
        Err(e) => {
            return PairResult {
                ok: false,
                credentials: None,
                reason: Some(format!("Invalid pair response: {e}")),
            };
        }
    };

    if !payload.ok {
        return PairResult {
            ok: false,
            credentials: None,
            reason: payload.reason.or(Some("Pair rejected.".to_string())),
        };
    }

    let capture_token = payload.capture_token.unwrap_or_default();
    let node_id = payload.node_id.unwrap_or(params.node_id);
    let ws_host = payload.ws_host.unwrap_or_else(|| params.mirage_host.clone());
    let ws_port = payload.ws_port.unwrap_or(0);

    if capture_token.is_empty() || ws_port == 0 {
        return PairResult {
            ok: false,
            credentials: None,
            reason: Some("Pair response missing capture token or ws port.".to_string()),
        };
    }

    PairResult {
        ok: true,
        credentials: Some(SatelliteCredentials {
            node_id,
            mirage_host: params.mirage_host,
            mirage_http_port: params.mirage_http_port,
            ws_host,
            ws_port,
            capture_token,
        }),
        reason: None,
    }
}

pub fn parse_capture_pair_url(raw_url: &str) -> Result<PairParams, String> {
    let parsed = url::Url::parse(raw_url.trim()).map_err(|e| format!("Invalid URL: {e}"))?;
    let pair_id = parsed
        .query_pairs()
        .find(|(k, _)| k == "pairId")
        .map(|(_, v)| v.to_string())
        .filter(|s| !s.is_empty())
        .ok_or_else(|| "Missing pairId in URL.".to_string())?;
    let pair_secret = parsed
        .query_pairs()
        .find(|(k, _)| k == "pairSecret")
        .map(|(_, v)| v.to_string())
        .filter(|s| !s.is_empty())
        .ok_or_else(|| "Missing pairSecret in URL.".to_string())?;
    let mirage_host = parsed
        .query_pairs()
        .find(|(k, _)| k == "mirageHost")
        .map(|(_, v)| v.to_string())
        .filter(|s| !s.is_empty())
        .ok_or_else(|| "Missing mirageHost in URL.".to_string())?;
    let mirage_http_port = parsed
        .query_pairs()
        .find(|(k, _)| k == "mirageHttpPort")
        .and_then(|(_, v)| v.parse::<u16>().ok())
        .filter(|p| *p > 0)
        .ok_or_else(|| "Missing mirageHttpPort in URL.".to_string())?;

    Ok(PairParams {
        mirage_host,
        mirage_http_port,
        pair_id,
        pair_secret,
        node_id: uuid::Uuid::new_v4().to_string(),
    })
}
