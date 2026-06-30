import http from "node:http";
import { URL } from "node:url";
import { completeCapturePair } from "./pair.mjs";
import { DEFAULT_PAIR_HTTP_PORT } from "./config.mjs";
import * as logger from "./logger.mjs";

/**
 * @param {{
 *   port?: number,
 *   getNodeId: () => Promise<string>,
 *   onPaired: (creds: object) => void,
 *   spyPairing: ReturnType<import('./spy-pairing.mjs').createSpyPairing>,
 *   onSpyPaired?: () => void,
 * }} options
 */
export function startPairServer(options) {
  const port = options.port ?? DEFAULT_PAIR_HTTP_PORT;

  const server = http.createServer((req, res) => {
    void handleRequest(req, res);
  });

  async function readJsonBody(req) {
    const chunks = [];
    for await (const chunk of req) {
      chunks.push(chunk);
    }
    const raw = Buffer.concat(chunks).toString("utf8").trim();
    if (!raw) return {};
    return JSON.parse(raw);
  }

  function sendJson(res, status, payload) {
    res.writeHead(status, { "Content-Type": "application/json" });
    res.end(JSON.stringify(payload));
  }

  async function handleRequest(req, res) {
    try {
      const host = req.headers.host ?? `127.0.0.1:${port}`;
      const url = new URL(req.url ?? "/", `http://${host}`);
      const pathname = url.pathname;

      if (pathname === "/health") {
        res.writeHead(200, { "Content-Type": "text/plain" });
        res.end("ok");
        return;
      }

      if (pathname === "/api/spy/echo/codes" && req.method === "GET") {
        const status = await options.spyPairing.getEchoSpyPairingStatus();
        sendJson(res, 200, { ok: true, ...status });
        return;
      }

      if (pathname === "/api/spy/echo/codes" && req.method === "POST") {
        await options.spyPairing.refreshEchoSpyPairCodes();
        const status = await options.spyPairing.getEchoSpyPairingStatus();
        sendJson(res, 200, { ok: true, ...status });
        return;
      }

      if (pathname === "/api/spy/pair/enter" && req.method === "POST") {
        const body = await readJsonBody(req);
        const pin = typeof body.pin === "string" ? body.pin.trim() : "";
        const role = body.role;
        if (pin && (role === "mirage" || role === "powerfist")) {
          const result = await options.spyPairing.completeSpyPairEnterByPin({
            pin,
            role,
            nodeId: typeof body.nodeId === "string" ? body.nodeId : undefined,
            deviceId: typeof body.deviceId === "string" ? body.deviceId : undefined,
          });
          if (result.ok) options.onSpyPaired?.();
          sendJson(res, result.ok ? 200 : 403, result);
          return;
        }

        const pairId = typeof body.pairId === "string" ? body.pairId.trim() : "";
        const pairSecret = typeof body.pairSecret === "string" ? body.pairSecret.trim() : "";
        if (role === "mirage" || role === "powerfist") {
          if (!pairId || !pairSecret) {
            sendJson(res, 400, { ok: false, reason: "pin/role or pairId/pairSecret/role required." });
            return;
          }
          const result = await options.spyPairing.completeSpyPairEnter({
            pairId,
            pairSecret,
            role,
            nodeId: typeof body.nodeId === "string" ? body.nodeId : undefined,
            deviceId: typeof body.deviceId === "string" ? body.deviceId : undefined,
          });
          if (result.ok) options.onSpyPaired?.();
          sendJson(res, result.ok ? 200 : 403, result);
          return;
        }

        sendJson(res, 400, { ok: false, reason: "pin/role or pairId/pairSecret/role required." });
        return;
      }

      if (pathname === "/api/spy/pair/link-status" && req.method === "POST") {
        const body = await readJsonBody(req);
        const role = body.role;
        if (role !== "mirage" && role !== "powerfist") {
          sendJson(res, 400, { ok: false, reason: "role required." });
          return;
        }
        const result = await options.spyPairing.checkEchoSpyLinkStatus({
          echoNodeId: typeof body.echoNodeId === "string" ? body.echoNodeId : "",
          role,
          sessionEpoch: Number(body.sessionEpoch),
          nodeId: typeof body.nodeId === "string" ? body.nodeId : undefined,
          deviceId: typeof body.deviceId === "string" ? body.deviceId : undefined,
        });
        sendJson(res, 200, result);
        return;
      }

      if (pathname === "/powerfist/capture-pair" && req.method === "GET") {
        const pairId = url.searchParams.get("pairId")?.trim();
        const pairSecret = url.searchParams.get("pairSecret")?.trim();
        const mirageHost = url.searchParams.get("mirageHost")?.trim();
        const mirageHttpPort = Number(url.searchParams.get("mirageHttpPort"));
        const nodeId = await options.getNodeId();

        if (!pairId || !pairSecret || !mirageHost || !Number.isFinite(mirageHttpPort)) {
          res.writeHead(400, { "Content-Type": "text/html; charset=utf-8" });
          res.end('<body style="background:#000;color:#888;font-family:monospace">invalid pair query</body>');
          return;
        }

        logger.log("pair-server: capture QR hit — arming relay with Mirage");
        const result = await completeCapturePair({
          pairId,
          pairSecret,
          mirageHost,
          mirageHttpPort,
          nodeId,
        });

        if (!result.ok || !result.credentials) {
          res.writeHead(200, { "Content-Type": "text/html; charset=utf-8" });
          res.end(
            `<body style="background:#000;color:#888;font-family:monospace;padding:1rem">${result.reason ?? "pair failed"}</body>`,
          );
          return;
        }

        options.onPaired(result.credentials);
        res.writeHead(200, { "Content-Type": "text/html; charset=utf-8" });
        res.end(
          '<body style="background:#050505;color:#8fd88f;font-family:monospace;padding:1rem">Echo Satellite armed — you can close this tab.</body>',
        );
        return;
      }

      res.writeHead(404, { "Content-Type": "text/plain" });
      res.end("not found");
    } catch (error) {
      logger.log(`pair-server error: ${error instanceof Error ? error.message : String(error)}`);
      res.writeHead(500, { "Content-Type": "text/plain" });
      res.end("error");
    }
  }

  server.listen(port, "0.0.0.0", () => {
    logger.step(5, 8, `pair HTTP server listening on 0.0.0.0:${port}`);
  });

  return server;
}
