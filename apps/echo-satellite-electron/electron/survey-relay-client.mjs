import * as logger from "./logger.mjs";
import {
  DEFAULT_SURVEY_RELAY_BASE_URL,
  DEFAULT_SURVEY_RELAY_SECRET,
} from "./survey-relay-defaults.mjs";

const DEFAULT_CYBERDECK_ORIGIN =
  process.env.ECHO_MIRAGE_CYBERDECK_URL?.trim()?.replace(/\/cyberdeck\/?$/, "") ||
  DEFAULT_SURVEY_RELAY_BASE_URL;

function relaySecret() {
  return process.env.SURVEY_RELAY_SECRET?.trim() || DEFAULT_SURVEY_RELAY_SECRET || "";
}

function relayHeaders() {
  const headers = { "Content-Type": "application/json" };
  const secret = relaySecret();
  if (secret) {
    headers.Authorization = `Bearer ${secret}`;
  }
  return headers;
}

function cyberdeckOrigin() {
  return DEFAULT_CYBERDECK_ORIGIN.replace(/\/$/, "");
}

function relayBaseUrl() {
  const fromEnv = process.env.SURVEY_RELAY_BASE_URL?.trim();
  if (fromEnv) return fromEnv.replace(/\/$/, "");
  return cyberdeckOrigin() || DEFAULT_SURVEY_RELAY_BASE_URL;
}

/**
 * @param {object} status
 */
export async function pushSurveyRelayBundle(status) {
  const echoNodeId = status.echoNodeId?.trim();
  const miragePin = status.miragePin?.trim();
  if (!echoNodeId || !miragePin) {
    return { ok: false, reason: "echoNodeId and miragePin required for relay push." };
  }

  const url = `${relayBaseUrl()}/api/survey/relay/bundle`;
  try {
    const res = await fetch(url, {
      method: "POST",
      headers: relayHeaders(),
      body: JSON.stringify({
        echoNodeId,
        echoHost: status.echoHost,
        httpPort: status.httpPort ?? 3050,
        miragePin,
        powerfistPin: status.powerfistPin ?? null,
        sessionEpoch: status.sessionEpoch ?? 1,
        echoSurveyActive: status.echoSurveyActive !== false,
      }),
      signal: AbortSignal.timeout(12_000),
    });
    const payload = await res.json();
    if (!res.ok || !payload.ok) {
      logger.log(`survey-relay push failed — ${payload.reason ?? res.status}`);
      return { ok: false, reason: payload.reason ?? `HTTP ${res.status}` };
    }
    logger.log(`survey-relay bundle pushed · ${echoNodeId.slice(0, 8)}… · storage ${payload.storage}`);
    return { ok: true, ...payload };
  } catch (error) {
    const reason = error instanceof Error ? error.message : String(error);
    logger.log(`survey-relay push error — ${reason}`);
    return { ok: false, reason };
  }
}

/**
 * Echo pushes live listening / STT snapshot for Mirage to poll.
 * @param {object} event
 */
export async function pushListeningEvent(event) {
  const echoNodeId = event.echoNodeId?.trim();
  if (!echoNodeId) {
    return { ok: false, reason: "echoNodeId required for listening push." };
  }

  const url = `${relayBaseUrl()}/api/survey/relay/listening-event`;
  try {
    const res = await fetch(url, {
      method: "POST",
      headers: relayHeaders(),
      body: JSON.stringify({
        echoNodeId,
        kind: event.kind ?? "partial",
        listening: event.listening !== false,
        interim: event.interim ?? "",
        final: event.final ?? event.text ?? "",
        text: event.text ?? "",
        seq: typeof event.seq === "number" ? event.seq : 0,
        error: event.error ?? null,
        finals: Array.isArray(event.finals) ? event.finals : [],
        level: typeof event.level === "number" ? event.level : undefined,
        bands: Array.isArray(event.bands) ? event.bands : undefined,
      }),
      signal: AbortSignal.timeout(8_000),
    });
    const payload = await res.json();
    if (!res.ok || !payload.ok) {
      return { ok: false, reason: payload.reason ?? `HTTP ${res.status}` };
    }
    return { ok: true, ...payload };
  } catch (error) {
    const reason = error instanceof Error ? error.message : String(error);
    logger.log(`survey-relay listening push error — ${reason}`);
    return { ok: false, reason };
  }
}

/**
 * @param {string} echoNodeId
 * @param {(input: object) => Promise<object>} completePair
 */
export async function pollSurveyRelayPairRequests(echoNodeId, completePair) {
  const id = echoNodeId?.trim();
  if (!id) return { ok: false, reason: "echoNodeId required" };

  const url = `${relayBaseUrl()}/api/survey/relay/pair-request?echoNodeId=${encodeURIComponent(id)}`;
  try {
    const res = await fetch(url, {
      method: "GET",
      headers: relayHeaders(),
      signal: AbortSignal.timeout(12_000),
    });
    const payload = await res.json();
    if (!res.ok || !payload.ok) {
      return { ok: false, reason: payload.reason ?? `HTTP ${res.status}` };
    }

    const pending = Array.isArray(payload.pending) ? payload.pending : [];
    let completed = 0;
    for (const request of pending) {
      const result = await completePair({
        pin: request.pin,
        role: request.role,
        nodeId: request.nodeId,
        deviceId: request.deviceId,
      });

      const responseUrl = `${relayBaseUrl()}/api/survey/relay/pair-request`;
      await fetch(responseUrl, {
        method: "PUT",
        headers: relayHeaders(),
        body: JSON.stringify({
          requestId: request.requestId,
          echoNodeId: id,
          ok: result.ok === true,
          role: result.role,
          echoHost: result.echoHost,
          httpPort: result.httpPort,
          token: result.token,
          nodeId: result.nodeId,
          deviceId: result.deviceId,
          sessionEpoch: result.sessionEpoch,
          reason: result.reason,
        }),
        signal: AbortSignal.timeout(12_000),
      });
      completed += 1;
      logger.log(
        `survey-relay pair ${request.requestId.slice(0, 8)}… → ${result.ok ? "ok" : result.reason ?? "fail"}`,
      );
    }

    return { ok: true, completed };
  } catch (error) {
    const reason = error instanceof Error ? error.message : String(error);
    return { ok: false, reason };
  }
}

/**
 * Poll pending Mirage commands from the HTTPS middlebox, run them locally on Echo,
 * then PUT results (including screenshot PNG) back through the relay.
 *
 * @param {string} echoNodeId
 * @param {(action: string, extras?: { tabId?: number, payload?: object }) => Promise<object>} executeCommand
 */
export async function pollSurveyRelayCommandRequests(echoNodeId, executeCommand) {
  const id = echoNodeId?.trim();
  if (!id) return { ok: false, reason: "echoNodeId required" };

  const url = `${relayBaseUrl()}/api/survey/relay/command-request?echoNodeId=${encodeURIComponent(id)}`;
  try {
    const res = await fetch(url, {
      method: "GET",
      headers: relayHeaders(),
      signal: AbortSignal.timeout(12_000),
    });
    const payload = await res.json();
    if (!res.ok || !payload.ok) {
      if (res.status === 401) {
        logger.log(
          "survey-relay command poll unauthorized — middlebox expects a relay secret this build does not have",
        );
      }
      return { ok: false, reason: payload.reason ?? `HTTP ${res.status}` };
    }

    const pending = Array.isArray(payload.pending) ? payload.pending : [];
    let completed = 0;
    for (const request of pending) {
      const action = typeof request.action === "string" ? request.action : "";
      let result;
      try {
        result = await executeCommand(action, {
          tabId: Number.isFinite(request.tabId) ? request.tabId : undefined,
          payload: request.payload && typeof request.payload === "object" ? request.payload : undefined,
        });
      } catch (error) {
        result = {
          ok: false,
          reason: error instanceof Error ? error.message : String(error),
        };
      }

      const responseUrl = `${relayBaseUrl()}/api/survey/relay/command-request`;
      await fetch(responseUrl, {
        method: "PUT",
        headers: relayHeaders(),
        body: JSON.stringify({
          requestId: request.requestId,
          echoNodeId: id,
          ok: result?.ok === true,
          action,
          message: result?.message,
          reason: result?.reason,
          answerText: result?.answerText,
          provider: result?.provider,
          model: result?.model,
          pngBase64: result?.pngBase64,
          mimeType: result?.mimeType,
          clipboard: result?.clipboard,
          width: result?.width,
          height: result?.height,
        }),
        // Screenshots can be multi-MB base64 — allow a longer PUT.
        signal: AbortSignal.timeout(90_000),
      });
      completed += 1;
      logger.log(
        `survey-relay command ${request.requestId.slice(0, 8)}… · ${action} → ${result?.ok ? "ok" : result?.reason ?? "fail"}`,
      );
    }

    return { ok: true, completed };
  } catch (error) {
    const reason = error instanceof Error ? error.message : String(error);
    return { ok: false, reason };
  }
}
