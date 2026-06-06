/**
 * Stops stale echo-mirage dev listeners on fixed ports and the last recorded auto-port pair.
 */
import { execSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const devStatePath = path.join(root, '.tmp', 'dev-server.json');
const PORTS = new Set([3050, 3051]);
for (let port = 3052; port <= 3059; port += 1) PORTS.add(port);

try {
  const state = JSON.parse(fs.readFileSync(devStatePath, 'utf8'));
  if (Number.isFinite(Number(state.appPort))) PORTS.add(Number(state.appPort));
  if (Number.isFinite(Number(state.readyPort))) PORTS.add(Number(state.readyPort));
} catch {
  /* no recorded auto-port session */
}

/** @param {number} port */
function pidsOnPort(port) {
  try {
    const out = execSync(`netstat -ano | findstr :${port}`, { encoding: 'utf8' });
    const pids = new Set();
    for (const line of out.split(/\r?\n/)) {
      if (!line.includes('LISTENING')) continue;
      const parts = line.trim().split(/\s+/);
      const pid = Number(parts[parts.length - 1]);
      if (Number.isFinite(pid) && pid > 0) pids.add(pid);
    }
    return [...pids];
  } catch {
    return [];
  }
}

const targets = new Set();
for (const port of PORTS) {
  for (const pid of pidsOnPort(port)) targets.add(pid);
}

if (targets.size === 0) {
  process.stdout.write(`[dev:stop] no listeners on ${[...PORTS].map((port) => `:${port}`).join(', ')}\n`);
  process.exit(0);
}

for (const pid of targets) {
  try {
    execSync(`taskkill /PID ${pid} /F`, { stdio: 'ignore' });
    process.stdout.write(`[dev:stop] stopped PID ${pid}\n`);
  } catch {
    process.stderr.write(`[dev:stop] failed to stop PID ${pid}\n`);
  }
}
