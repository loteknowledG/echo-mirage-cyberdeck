const assert = require('node:assert/strict');
const path = require('node:path');
const os = require('node:os');
const fs = require('node:fs/promises');
const {
  initializeSilentMode,
  loadSilentModeState,
  getSilentMode,
  setSilentMode,
  shouldPreventWindowClose,
} = require('../electron/silent-mode');

async function withTempUserData(run: (userData: string) => Promise<void>) {
  const tempRoot = await fs.mkdtemp(path.join(os.tmpdir(), 'echo-silent-mode-'));
  const userData = path.join(tempRoot, 'user-data');
  await fs.mkdir(userData, { recursive: true });
  const fakeApp = { getPath: (key: string) => (key === 'userData' ? userData : tempRoot) };
  initializeSilentMode({ app: fakeApp, Tray: null, Menu: null, nativeImage: null });
  try {
    await run(userData);
  } finally {
    await fs.rm(tempRoot, { recursive: true, force: true });
  }
}

async function runProbe() {
  await withTempUserData(async (userData) => {
    assert.equal(getSilentMode(), false);
    assert.equal(shouldPreventWindowClose(), false);

    await setSilentMode(true);
    assert.equal(getSilentMode(), true);
    assert.equal(shouldPreventWindowClose(), true);

    const stored = JSON.parse(await fs.readFile(path.join(userData, 'echo-mirage-silent-mode.json'), 'utf8'));
    assert.equal(stored.enabled, true);

    await setSilentMode(false);
    assert.equal(getSilentMode(), false);

    await loadSilentModeState();
    assert.equal(getSilentMode(), false);
  });

  console.log('probe-silent-mode: PASS');
}

runProbe().catch((error) => {
  console.error(error);
  process.exit(1);
});
