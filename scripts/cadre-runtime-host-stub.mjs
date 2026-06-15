/**
 * Phase-1 cadre terminal host stub — local stdout/stderr heartbeat only.
 * Spawned by cadre-runtime-manager.server.ts; no provider or network calls.
 */
const agent = (process.argv[2] ?? "CADRE").toUpperCase();
const intervalMs = Number(process.env.CADRE_STUB_INTERVAL_MS ?? 4000);

process.stdout.write(`[${agent}] CADRE HOST STUB ONLINE\n`);
process.stdout.write(`[${agent}] awaiting operator directives (observation only)\n`);

const timer = setInterval(() => {
  process.stdout.write(`[${agent}] heartbeat ${new Date().toISOString()}\n`);
}, intervalMs);

function shutdown(signal) {
  clearInterval(timer);
  process.stdout.write(`[${agent}] ${signal} received — terminal host stopping\n`);
  process.exit(0);
}

process.on("SIGTERM", () => shutdown("SIGTERM"));
process.on("SIGINT", () => shutdown("SIGINT"));
