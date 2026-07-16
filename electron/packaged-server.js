const { spawn } = require('child_process');
const fs = require('fs');
const http = require('http');
const net = require('net');
const path = require('path');

const { loadDesktopProviderEnv } = require('./load-desktop-provider-env');

/** @type {import('child_process').ChildProcess | null} */
let serverProcess = null;
/** @type {string | null} */
let serverOrigin = null;
/** @type {string} */
let serverLogTail = '';

function getStandaloneDir() {
  const { app } = require('electron');
  if (app.isPackaged) {
    return path.join(process.resourcesPath, 'app');
  }
  const electronStandalone = path.resolve(__dirname, '..', '.next', 'standalone-electron');
  if (fs.existsSync(path.join(electronStandalone, 'server.js'))) {
    return electronStandalone;
  }
  return path.resolve(__dirname, '..', '.next', 'standalone');
}

function getProjectRoot() {
  return path.resolve(__dirname, '..');
}

function appendServerLog(text) {
  serverLogTail = `${serverLogTail}${text}`.slice(-8000);
  try {
    const { app } = require('electron');
    const logDir = path.join(app.getPath('userData'), 'logs');
    fs.mkdirSync(logDir, { recursive: true });
    fs.appendFileSync(path.join(logDir, 'next-server.log'), text);
  } catch {
    /* best-effort logging */
  }
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

function waitForHttpOk(url, childProcess, deadlineMs = 180_000) {
  const started = Date.now();
  return new Promise((resolve, reject) => {
    const attempt = () => {
      if (childProcess && childProcess.exitCode != null) {
        reject(
          new Error(
            `Next.js server exited before becoming ready (code ${childProcess.exitCode}). ${serverLogTail}`,
          ),
        );
        return;
      }

      const request = http.get(url, (response) => {
        response.resume();
        if (response.statusCode && response.statusCode >= 200 && response.statusCode < 400) {
          resolve();
          return;
        }
        if (Date.now() - started > deadlineMs) {
          reject(
            new Error(
              `Timed out waiting for ${url} (HTTP ${response.statusCode ?? 'unknown'}). ${serverLogTail}`,
            ),
          );
          return;
        }
        setTimeout(attempt, 750);
      });
      request.on('error', () => {
        if (Date.now() - started > deadlineMs) {
          reject(new Error(`Timed out waiting for ${url}. ${serverLogTail}`));
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
      `Packaged Next server not found at ${serverJs}. Reinstall Echo Mirage or rebuild with pnpm electron:pack.`,
    );
  }

  serverLogTail = '';
  const port = await findFreePort();
  const { app } = require('electron');
  const powerfistStatePath = path.join(app.getPath('userData'), 'powerfist-ws.json');
  const runtimeTmpDir = path.join(app.getPath('userData'), 'tmp');
  fs.mkdirSync(runtimeTmpDir, { recursive: true });

  // Installer bundle rarely has secrets. Prefer userData override, then project .env.local in unpackaged runs.
  const desktopProviderEnv = loadDesktopProviderEnv(appDir, {
    userDataDir: app.getPath('userData'),
    projectRoot: app.isPackaged ? undefined : getProjectRoot(),
  });
  const loadedKeys = Object.keys(desktopProviderEnv);
  if (loadedKeys.length > 0) {
    appendServerLog(`[echo-next] provider env loaded (${loadedKeys.join(', ')})\n`);
  } else {
    appendServerLog(
      '[echo-next] provider env empty — set keys in Settings / MAINNET-UPLINK, or place desktop-provider.env in userData\n',
    );
  }

  serverProcess = spawn(process.execPath, [serverJs], {
    cwd: appDir,
    env: {
      ...process.env,
      ...desktopProviderEnv,
      ELECTRON_RUN_AS_NODE: '1',
      NODE_ENV: 'production',
      PORT: String(port),
      HOSTNAME: '0.0.0.0',
      NEXT_TELEMETRY_DISABLED: '1',
      ECHO_MIRAGE_POWERFIST_STATE_PATH: powerfistStatePath,
      ECHO_MIRAGE_POWERFIST_WS_HOST: '0.0.0.0',
      ECHO_MIRAGE_DESKTOP_SHELL: '1',
      // Program Files install is read-only — keep Next state under userData.
      ECHO_MIRAGE_TMP_DIR: runtimeTmpDir,
      TMPDIR: runtimeTmpDir,
      TEMP: runtimeTmpDir,
      TMP: runtimeTmpDir,
    },
    stdio: ['ignore', 'pipe', 'pipe'],
    windowsHide: true,
    shell: false,
  });

  serverProcess.stdout?.on('data', (chunk) => {
    const text = chunk.toString();
    appendServerLog(text);
    process.stdout.write(`[echo-next] ${text}`);
  });
  serverProcess.stderr?.on('data', (chunk) => {
    const text = chunk.toString();
    appendServerLog(text);
    process.stderr.write(`[echo-next] ${text}`);
  });
  serverProcess.on('exit', (code, signal) => {
    if (serverProcess) {
      const line = `[echo-next] exited code=${code ?? 'null'} signal=${signal ?? 'null'}\n`;
      appendServerLog(line);
      process.stderr.write(line);
    }
    serverProcess = null;
    serverOrigin = null;
  });

  serverOrigin = `http://127.0.0.1:${port}`;
  await waitForHttpOk(`${serverOrigin}/cyberdeck`, serverProcess);
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
