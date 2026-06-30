import http from "node:http";
import { URL } from "node:url";
import { completeCapturePair } from "./pair.mjs";
import { DEFAULT_PAIR_HTTP_PORT } from "./config.mjs";
import * as logger from "./logger.mjs";

/**
 * @param {{ port?: number, getNodeId: () => Promise<string>, onPaired: (creds: object) => void }} options
 */
export function startPairServer(options) {
  const port = options.port ?? DEFAULT_PAIR_HTTP_PORT;

  const server = http.createServer((req, res) => {
    void handleRequest(req, res);
  });

  async function handleRequest(req, res) {
    try {
      const host = req.headers.host ?? `127.0.0.1:${port}`;
      const url = new URL(req.url ?? "/", `http://${host}`);

      if (url.pathname === "/health") {
        res.writeHead(200, { "Content-Type": "text/plain" });
        res.end("ok");
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
    logger.step(5, 8, `pair HTTP server listening on 0.0.0.0:${port}`);
  });

  return server;
}
