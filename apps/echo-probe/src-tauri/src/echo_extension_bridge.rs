use parking_lot::Mutex;
use serde_json::{json, Value};
use std::collections::HashMap;
use std::sync::Arc;
use std::time::{Duration, Instant};

const DEFAULT_WAIT_MS: u64 = 12_000;
const POLL_STALE_MS: u64 = 45_000;

#[derive(Clone)]
pub struct EchoExtensionBridge {
    inner: Arc<BridgeInner>,
}

struct BridgeInner {
    pending: Mutex<HashMap<String, PendingCommand>>,
    last_poll_at: Mutex<Option<String>>,
}

struct PendingCommand {
    kind: String,
    tab_id: Option<i64>,
    created_at: Instant,
    result_tx: tokio::sync::oneshot::Sender<Value>,
}

impl EchoExtensionBridge {
    pub fn new() -> Self {
        Self {
            inner: Arc::new(BridgeInner {
                pending: Mutex::new(HashMap::new()),
                last_poll_at: Mutex::new(None),
            }),
        }
    }

    pub fn status(&self) -> Value {
        let last_poll_at = self.inner.last_poll_at.lock().clone();
        let connected = last_poll_at
            .as_ref()
            .and_then(|iso| chrono::DateTime::parse_from_rfc3339(iso).ok())
            .map(|dt| {
                chrono::Utc::now().signed_duration_since(dt.with_timezone(&chrono::Utc))
                    < chrono::Duration::milliseconds(POLL_STALE_MS as i64)
            })
            .unwrap_or(false);
        json!({
            "connected": connected,
            "pendingCount": self.inner.pending.lock().len(),
            "lastPollAt": last_poll_at,
        })
    }

    pub fn take_pending(&self) -> Option<Value> {
        *self.inner.last_poll_at.lock() = Some(chrono::Utc::now().to_rfc3339());
        let mut pending = self.inner.pending.lock();
        let next_id = pending
            .iter()
            .min_by_key(|(_, cmd)| cmd.created_at)
            .map(|(id, _)| id.clone());
        let id = next_id?;
        let cmd = pending.get(&id)?;
        Some(json!({
            "id": id,
            "kind": cmd.kind,
            "tabId": cmd.tab_id,
        }))
    }

    pub fn complete(&self, id: &str, result: Value) -> Value {
        let mut pending = self.inner.pending.lock();
        let Some(cmd) = pending.remove(id) else {
            return json!({ "ok": false, "reason": "Unknown or expired command id." });
        };
        let _ = cmd.result_tx.send(result);
        json!({ "ok": true })
    }

    pub async fn enqueue(&self, kind: &str, tab_id: Option<i64>) -> Result<Value, String> {
        let id = format!("ext-{}-{:x}", chrono::Utc::now().timestamp_millis(), rand::random::<u32>());
        let (tx, rx) = tokio::sync::oneshot::channel();
        {
            let mut pending = self.inner.pending.lock();
            pending.insert(
                id.clone(),
                PendingCommand {
                    kind: kind.to_string(),
                    tab_id,
                    created_at: Instant::now(),
                    result_tx: tx,
                },
            );
        }
        let wait = tokio::time::timeout(Duration::from_millis(DEFAULT_WAIT_MS), rx).await;
        match wait {
            Ok(Ok(result)) => Ok(result),
            Ok(Err(_)) => Err("echo-extension bridge channel closed.".to_string()),
            Err(_) => {
                self.inner.pending.lock().remove(&id);
                Err(
                    "echo-extension did not respond — is it loaded in Chrome and polling Echo Probe?"
                        .to_string(),
                )
            }
        }
    }
}
