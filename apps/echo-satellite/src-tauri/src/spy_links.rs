use crate::config::SpyMirageLink;
use reqwest::Client;
use serde::Deserialize;
use serde_json::Value;
use std::time::Duration;

#[derive(Debug, Clone, Default)]
pub struct SpyLinksSnapshot {
    pub reachable: bool,
    pub mirages: Vec<SpyMirageLink>,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
struct SpyCodesResponse {
    ok: Option<bool>,
    paired_mirages: Option<Vec<SpyMirageLink>>,
    paired_mirage: Option<SpyMirageLink>,
}

fn candidate_ports() -> Vec<u16> {
    let mut ports = vec![3000, 3001, 8080];
    if let Ok(raw) = std::env::var("ECHO_CYBERDECK_HTTP_PORT") {
        for part in raw.split(',') {
            if let Ok(port) = part.trim().parse::<u16>() {
                if port > 0 && !ports.contains(&port) {
                    ports.push(port);
                }
            }
        }
    }
    ports
}

fn extract_mirages(payload: &SpyCodesResponse) -> Vec<SpyMirageLink> {
    if let Some(mirages) = payload.paired_mirages.as_ref() {
        if !mirages.is_empty() {
            return mirages.clone();
        }
    }
    payload
        .paired_mirage
        .clone()
        .map(|mirage| vec![mirage])
        .unwrap_or_default()
}

fn extract_mirages_from_value(value: &Value) -> Vec<SpyMirageLink> {
    if let Ok(payload) = serde_json::from_value::<SpyCodesResponse>(value.clone()) {
        return extract_mirages(&payload);
    }
    Vec::new()
}

async fn read_state_file_mirages() -> Option<Vec<SpyMirageLink>> {
    let state_path = std::env::var("ECHO_MIRAGE_SPY_PAIRING_STATE_PATH")
        .ok()
        .filter(|value| !value.trim().is_empty())
        .unwrap_or_else(|| ".tmp/echo-spy-pairing.json".to_string());

    let raw = tokio::fs::read_to_string(state_path).await.ok()?;
    let value: Value = serde_json::from_str(&raw).ok()?;
    let mirages = extract_mirages_from_value(&value);
    Some(mirages)
}

pub async fn fetch_spy_mirage_links(client: &Client) -> SpyLinksSnapshot {
    for port in candidate_ports() {
        let url = format!("http://127.0.0.1:{port}/api/spy/echo/codes");
        let Ok(response) = client
            .get(url)
            .timeout(Duration::from_secs(2))
            .send()
            .await
        else {
            continue;
        };
        if !response.status().is_success() {
            continue;
        }
        let Ok(payload) = response.json::<SpyCodesResponse>().await else {
            continue;
        };
        if payload.ok.unwrap_or(false) {
            return SpyLinksSnapshot {
                reachable: true,
                mirages: extract_mirages(&payload),
            };
        }
    }

    if let Some(mirages) = read_state_file_mirages().await {
        return SpyLinksSnapshot {
            reachable: true,
            mirages,
        };
    }

    SpyLinksSnapshot::default()
}
