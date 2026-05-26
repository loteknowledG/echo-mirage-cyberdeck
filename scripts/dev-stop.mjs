/**
 * Stops stale echo-mirage dev listeners on :3050 (Next) and :3051 (readiness sidecar).
 */
import { execSync } from 'node:child_process';

const PORTS = [3050, 3051];

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
  process.stdout.write('[dev:stop] no listeners on :3050 or :3051\n');
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
