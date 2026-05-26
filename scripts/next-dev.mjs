/**
 * Runs `next dev` and rewrites printed origin URLs so terminal links open /cyberdeck.
 * Exposes a zero-Next readiness probe on :3051 so wait-on/Electron do not compile routes.
 */
import { spawn } from 'node:child_process';
import http from 'node:http';
import path from 'node:path';
import readline from 'node:readline';
import { fileURLToPath } from 'node:url';

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const nextCli = path.join(root, 'node_modules', 'next', 'dist', 'bin', 'next');
const READY_PORT = 3051;
const HEAP_MB = 16384;

function devNodeEnv() {
  const env = { ...process.env };
  const heapFlag = `--max-old-space-size=${HEAP_MB}`;
  const existing = (env.NODE_OPTIONS || '').trim();
  const stripped = existing.replace(/--max-old-space-size=\S+/g, '').trim();
  env.NODE_OPTIONS = stripped ? `${stripped} ${heapFlag}` : heapFlag;
  return env;
}

let nextReady = false;

const useTurbopack =
  process.env.CYBERDECK_DEV_TURBOPACK === '1' ||
  process.argv.includes('--turbopack');
const useWebpack = process.argv.includes('--webpack');
const bundler = useWebpack ? 'webpack' : useTurbopack ? 'turbopack' : 'webpack';

const readyServer = http.createServer((req, res) => {
  const url = req.url?.split('?')[0] ?? '/';
  if (nextReady && (url === '/health' || url === '/')) {
    res.writeHead(200, { 'Content-Type': 'text/plain' });
    res.end('ok');
    return;
  }
  res.writeHead(503, { 'Content-Type': 'text/plain' });
  res.end('starting');
});

readyServer.on('error', (err) => {
  if (err && typeof err === 'object' && 'code' in err && err.code === 'EADDRINUSE') {
    process.stderr.write(
      `[dev] port ${READY_PORT} already in use — a previous dev session is still running.\n` +
        `[dev] run: pnpm dev:stop\n`,
    );
    process.exit(1);
  }
  throw err;
});

readyServer.listen(READY_PORT, '127.0.0.1', () => {
  if (bundler === 'turbopack') {
    process.stdout.write(
      '[dev] turbopack mode — if PostCSS panics on Windows, use: pnpm dev (webpack)\n',
    );
  }
  process.stdout.write(
    `[dev] sidecar :${READY_PORT}/health | node heap ${HEAP_MB}MB | bundler ${bundler}\n`,
  );
});

function shutdownReadyServer() {
  nextReady = false;
  readyServer.close();
}

const DELIM = String.raw`(?=[\s\u001b\)\],]|$)`;

/** @param {string} line */
function rewritePrintedUrls(line) {
  return line
    .replace(
      new RegExp(`http://([\\w.]+):3050/${DELIM}`, 'g'),
      'http://$1:3050/cyberdeck',
    )
    .replace(
      new RegExp(`http://([\\w.]+):3050${DELIM}`, 'g'),
      'http://$1:3050/cyberdeck',
    );
}

/** @param {string} line */
function noteNextReady(line) {
  if (nextReady) return;
  if (/\bReady in\b/.test(line) || /✓ Ready\b/.test(line)) {
    nextReady = true;
    process.stdout.write(`[dev] Next ready — sidecar :${READY_PORT}/health open\n`);
  }
}

const nextArgs = [
  `--max-old-space-size=${HEAP_MB}`,
  nextCli,
  'dev',
  '-p',
  '3050',
  ...(bundler === 'turbopack' ? [] : ['--webpack']),
];

const child = spawn(process.execPath, nextArgs, {
  cwd: root,
  stdio: ['inherit', 'pipe', 'pipe'],
  env: devNodeEnv(),
});

function pipeLines(stream, /** @type {NodeJS.WriteStream} */ out) {
  readline
    .createInterface({ input: stream, crlfDelay: Infinity })
    .on('line', (line) => {
      noteNextReady(line);
      out.write(rewritePrintedUrls(line) + '\n');
    });
}

pipeLines(child.stdout, process.stdout);
pipeLines(child.stderr, process.stderr);

for (const sig of ['SIGINT', 'SIGTERM']) {
  process.on(sig, () => {
    shutdownReadyServer();
    child.kill(sig);
  });
}

child.on('close', (code, signal) => {
  shutdownReadyServer();
  if (signal) process.kill(process.pid, signal);
  else process.exit(code ?? 0);
});
