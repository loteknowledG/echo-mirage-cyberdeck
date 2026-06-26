const { spawn } = require('child_process');
const fs = require('fs');
const http = require('http');
const net = require('net');
const path = require('path');

/** @type {import('child_process').ChildProcess | null} */
let serverProcess = null;
/** @type {string | null} */
let serverOrigin = null;

function getStandaloneDir() {
  const { app } = require('electron');
  if (app.isPackaged) {
    return path.join(process.resourcesPath, 'app');
  }
  return path.resolve(__dirname, '..', '.next', 'standalone');
}

function findFreePort() {
  return new Promise((resolve, reject) => {
    const probe = net.createServer();
    probe.once('error', reject);
    probe.listen(0, '127.0.0.1', () => {
      const address = probe.address();
      const port = typeof address === 'object' && address ? address.port : 0;
      probe.close((error) => {
        if (error) reject(error);
        else resolve(port);
      });
    });
  });
}

function waitForHttpOk(url, deadlineMs = 180_000) {
  const started = Date.now();
  return new Promise((resolve, reject) => {
    const attempt = () => {
      const request = http.get(url, (response) => {
        response.resume();
        if (response.statusCode && response.statusCode >= 200 && response.statusCode < 400) {
          resolve();
          return;
        }
        if (Date.now() - started > deadlineMs) {
          reject(new Error(`Timed out waiting for ${url} (HTTP ${response.statusCode ?? 'unknown'})`));
          return;
        }
        setTimeout(attempt, 750);
      });
      request.on('error', () => {
        if (Date.now() - started > deadlineMs) {
          reject(new Error(`Timed out waiting for ${url}`));
          return;
        }
        setTimeout(attempt, 750);
      });
    };
    attempt();
  });
}

async function startPackagedNextServer() {
  if (serverOrigin) return serverOrigin;

  const appDir = getStandaloneDir();
  const serverJs = path.join(appDir, 'server.js');
  if (!fs.existsSync(serverJs)) {
    throw new Error(
      `Packaged Next server not found at ${serverJs}. Run pnpm electron:pack after a successful standalone build.`,
    );
  }

  const port = await findFreePort();
  serverProcess = spawn(process.execPath, [serverJs], {
    cwd: appDir,
    env: {
      ...process.env,
      ELECTRON_RUN_AS_NODE: '1',
      NODE_ENV: 'production',
      PORT: String(port),
      HOSTNAME: '127.0.0.1',
    },
    stdio: ['ignore', 'pipe', 'pipe'],
    windowsHide: true,
  });

  serverProcess.stdout?.on('data', (chunk) => {
    process.stdout.write(`[echo-next] ${chunk}`);
  });
  serverProcess.stderr?.on('data', (chunk) => {
    process.stderr.write(`[echo-next] ${chunk}`);
  });
  serverProcess.on('exit', (code, signal) => {
    if (serverProcess) {
      process.stderr.write(`[echo-next] exited code=${code ?? 'null'} signal=${signal ?? 'null'}\n`);
    }
    serverProcess = null;
    serverOrigin = null;
  });

  serverOrigin = `http://127.0.0.1:${port}`;
  await waitForHttpOk(`${serverOrigin}/cyberdeck`);
  return serverOrigin;
}

function stopPackagedNextServer() {
  if (!serverProcess) return;
  try {
    serverProcess.kill();
  } catch {
    /* ignore */
  }
  serverProcess = null;
  serverOrigin = null;
}

module.exports = {
  startPackagedNextServer,
  stopPackagedNextServer,
};
