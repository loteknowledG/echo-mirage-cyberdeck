import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const statePath = path.join(root, '.tmp', 'dev-server.json');
const DEADLINE_MS = 300_000;
const RETRY_MS = 1_000;

async function readState() {
  const raw = await fs.readFile(statePath, 'utf8');
  const state = JSON.parse(raw);
  if (!state?.readyPort || !state?.appPort) {
    throw new Error('dev-server.json missing appPort or readyPort');
  }
  return state;
}

async function waitForDevServer() {
  const deadline = Date.now() + DEADLINE_MS;
  let lastMessage = 'waiting for dev-server.json';

  while (Date.now() < deadline) {
    try {
      const state = await readState();
      const healthUrl = `http://127.0.0.1:${state.readyPort}/health`;
      const res = await fetch(healthUrl);
      if (res.ok) {
        process.stdout.write(
          `[wait] dev server ready app=:${state.appPort} sidecar=:${state.readyPort}\n`,
        );
        return;
      }
      lastMessage = `${healthUrl} HTTP ${res.status}`;
    } catch (error) {
      lastMessage = error instanceof Error ? error.message : String(error);
    }

    await new Promise((resolve) => setTimeout(resolve, RETRY_MS));
  }

  process.stderr.write(`[wait] timed out: ${lastMessage}\n`);
  process.exit(1);
}

await waitForDevServer();
