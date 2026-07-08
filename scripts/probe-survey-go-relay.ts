/**
 * Probe Go survey-relay sidecar (localhost:8090 by default).
 *
 *   SURVEY_RELAY_BASE_URL=http://127.0.0.1:8090 pnpm probe:survey-go-relay
 */
import assert from "node:assert/strict";

const relayBase = (process.env.SURVEY_RELAY_BASE_URL ?? "http://127.0.0.1:8090").replace(/\/$/, "");
const echoNodeId = `probe-echo-${Date.now()}`;

async function relayFetch(path: string, init?: RequestInit) {
  const res = await fetch(`${relayBase}${path}`, init);
  const payload = (await res.json()) as Record<string, unknown>;
  return { res, payload };
}

async function main() {
  const health = await fetch(`${relayBase}/healthz`);
  assert.equal(health.status, 200, "relay healthz");

  const push = await relayFetch("/api/survey/relay/bundle", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      echoNodeId,
      echoHost: "127.0.0.1",
      httpPort: 3050,
      miragePin: "123456",
      powerfistPin: null,
      sessionEpoch: 1,
      echoSurveyActive: true,
    }),
  });
  assert.equal(push.res.status, 200);
  assert.equal(push.payload.ok, true);

  const pull = await relayFetch(`/api/survey/relay/bundle?echoNodeId=${encodeURIComponent(echoNodeId)}`);
  assert.equal(pull.res.status, 200);
  assert.equal(pull.payload.ok, true);
  const bundle = pull.payload.bundle as { miragePin?: string };
  assert.equal(bundle.miragePin, "123456");

  const pairReq = await relayFetch("/api/survey/relay/pair-request", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      echoNodeId,
      role: "mirage",
      pin: "654321",
      nodeId: "mirage-probe-node",
    }),
  });
  assert.equal(pairReq.res.status, 200);
  const requestId = String(pairReq.payload.requestId ?? "");
  assert.ok(requestId.length > 8);

  const complete = await relayFetch("/api/survey/relay/pair-request", {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      requestId,
      echoNodeId,
      ok: true,
      role: "mirage",
      echoHost: "127.0.0.1",
      httpPort: 3050,
      token: "probe-token",
      nodeId: "mirage-probe-node",
      sessionEpoch: 1,
    }),
  });
  assert.equal(complete.res.status, 200);
  assert.equal(complete.payload.ok, true);

  const poll = await relayFetch(
    `/api/survey/relay/pair-request?requestId=${encodeURIComponent(requestId)}`,
  );
  assert.equal(poll.res.status, 200);
  const result = poll.payload.result as { ok?: boolean; token?: string };
  assert.equal(result.ok, true);
  assert.equal(result.token, "probe-token");

  console.log("probe:survey-go-relay PASS");
}

main().catch((error) => {
  console.error("probe:survey-go-relay FAIL", error);
  process.exit(1);
});
