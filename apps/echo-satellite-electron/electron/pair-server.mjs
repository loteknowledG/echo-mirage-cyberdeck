import http from "node:http";
import { URL } from "node:url";
import { completeCapturePair } from "./pair.mjs";
import { DEFAULT_PAIR_HTTP_PORT } from "./config.mjs";
import {
  completeSurveyPairEnterByPin,
  getEchoSurveyPairingStatus,
  refreshEchoSurveyPairCodes,
} from "./spy-echo-pairing.mjs";
import * as logger from "./logger.mjs";
import { attachSurveyTeamHub } from "./survey-team-hub.mjs";
import { takeEchoExtensionPendingCommand, completeEchoExtensionCommand, getEchoExtensionBridgeStatus } from "./echo-extension-bridge.mjs";
import { executeEchoSatelliteCommand } from "./echo-commands.mjs";

function applyCors(res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
}

async function readJsonBody(req) {
  const chunks = [];
  for await (const chunk of req) {
    chunks.push(chunk);
  }
  if (chunks.length === 0) return {};
  return JSON.parse(Buffer.concat(chunks).toString("utf8"));
}

/**
 * @param {{ port?: number, getNodeId: () => Promise<string>, onPaired: (creds: object) => void, onSpyPaired?: (result: object) => void, getSpyStatus?: () => object, app?: import("electron").App }} options
 */
export function startPairServer(options) {
  const port = options.port ?? DEFAULT_PAIR_HTTP_PORT;

  const server = http.createServer((req, res) => {
    void handleRequest(req, res);
  });

  const surveyTeamHub = attachSurveyTeamHub(server);

  async function handleRequest(req, res) {
    try {
      applyCors(res);

      if (req.method === "OPTIONS") {
        res.writeHead(204);
        res.end();
        return;
      }

      const host = req.headers.host ?? `127.0.0.1:${port}`;
      const url = new URL(req.url ?? "/", `http://${host}`);

      if (url.pathname === "/health") {
        res.writeHead(200, { "Content-Type": "text/plain" });
        res.end("ok");
        return;
      }

      if (url.pathname === "/spy/status" && req.method === "GET") {
        const status = options.getSpyStatus?.() ?? { ok: false, reason: "status unavailable" };
        res.writeHead(200, { "Content-Type": "application/json" });
        res.end(JSON.stringify(status));
        return;
      }

      if (url.pathname === "/api/survey/echo/codes" && req.method === "GET") {
        const status = await getEchoSurveyPairingStatus();
        res.writeHead(200, { "Content-Type": "application/json" });
        res.end(JSON.stringify({ ok: true, source: "echo-satellite", ...status }));
        return;
      }

      if (url.pathname === "/api/survey/echo/codes" && req.method === "POST") {
        await refreshEchoSurveyPairCodes();
        const status = await getEchoSurveyPairingStatus();
        res.writeHead(200, { "Content-Type": "application/json" });
        res.end(JSON.stringify({ ok: true, source: "echo-satellite", ...status }));
        return;
      }

      if (url.pathname === "/api/survey/pair/enter" && req.method === "POST") {
        const body = await readJsonBody(req);
        logger.log("pair-server: Spy PIN enter");
        const result = await completeSurveyPairEnterByPin({
          pin: String(body.pin ?? ""),
          role: body.role === "powerfist" ? "powerfist" : "mirage",
          nodeId: typeof body.nodeId === "string" ? body.nodeId : undefined,
          deviceId: typeof body.deviceId === "string" ? body.deviceId : undefined,
        });
        if (result.ok) {
          options.onSpyPaired?.(result);
        }
        res.writeHead(result.ok ? 200 : 403, { "Content-Type": "application/json" });
        res.end(JSON.stringify(result));
        return;
      }

      if (url.pathname === "/api/survey/team/status" && req.method === "GET") {
        const status = surveyTeamHub.teamStatusPayload();
        res.writeHead(200, { "Content-Type": "application/json" });
        res.end(JSON.stringify({ ok: true, ...status }));
        return;
      }

      if (url.pathname === "/api/survey/echo/command" && req.method === "POST") {
        const body = await readJsonBody(req);
        const action = String(body.action ?? "").trim();
        const tabIdRaw = body.tabId;
        const tabId =
          typeof tabIdRaw === "number"
            ? tabIdRaw
            : typeof tabIdRaw === "string" && tabIdRaw.trim()
              ? Number(tabIdRaw)
              : undefined;
        logger.log(`pair-server: echo command ${action}`);
        const result = await executeEchoSatelliteCommand(action, {
          app: options.app,
          tabId: Number.isFinite(tabId) ? tabId : undefined,
        });
        res.writeHead(result.ok ? 200 : 400, { "Content-Type": "application/json" });
        res.end(JSON.stringify(result));
        return;
      }

      if (url.pathname === "/api/survey/echo/extension/poll" && req.method === "GET") {
        const command = takeEchoExtensionPendingCommand();
        res.writeHead(200, { "Content-Type": "application/json" });
        res.end(
          JSON.stringify({
            ok: true,
            command,
            bridge: getEchoExtensionBridgeStatus(),
          }),
        );
        return;
      }

      if (url.pathname === "/api/survey/echo/extension/result" && req.method === "POST") {
        const body = await readJsonBody(req);
        const id = String(body.id ?? "").trim();
        if (!id) {
          res.writeHead(400, { "Content-Type": "application/json" });
          res.end(JSON.stringify({ ok: false, reason: "id is required." }));
          return;
        }
        const result = completeEchoExtensionCommand(id, body.result ?? body);
        res.writeHead(result.ok ? 200 : 400, { "Content-Type": "application/json" });
        res.end(JSON.stringify(result));
        return;
      }

      if (url.pathname === "/api/survey/echo/extension/status" && req.method === "GET") {
        res.writeHead(200, { "Content-Type": "application/json" });
        res.end(JSON.stringify({ ok: true, ...getEchoExtensionBridgeStatus() }));
        return;
      }

      if (url.pathname === "/powerfist/capture-pair" && req.method === "GET") {
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

        logger.log("pair-server: QR hit — completing pair with Mirage");
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
            `<body style="background:#000;color:#888;font-family:monospace">${result.reason ?? "pair failed"}</body>`,
          );
          return;
        }

        options.onPaired(result.credentials);
        res.writeHead(200, { "Content-Type": "text/html; charset=utf-8" });
        res.end('<body style="background:#000"></body>');
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
    logger.step(5, 8, `pair HTTP + survey-team Socket.IO on 0.0.0.0:${port}`);
  });

  return { server, surveyTeamHub };
}
