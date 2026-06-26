import { spawn } from 'node:child_process';
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const standaloneDir = path.join(root, '.next', 'standalone');

function run(command, args, env = {}) {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, {
      cwd: root,
      env: { ...process.env, ...env },
      stdio: 'inherit',
      shell: process.platform === 'win32',
    });
    child.on('error', reject);
    child.on('exit', (code) => {
      if (code === 0) resolve();
      else reject(new Error(`${command} ${args.join(' ')} exited with code ${code}`));
    });
  });
}

async function pathExists(target) {
  try {
    await fs.access(target);
    return true;
  } catch {
    return false;
  }
}

async function copyRecursive(from, to) {
  await fs.mkdir(path.dirname(to), { recursive: true });
  await fs.cp(from, to, { recursive: true, force: true });
}

async function main() {
  console.log('[electron:prepare] clearing Windows build blockers…');
  await run('node', ['scripts/clean-windows-build-blockers.mjs']);

  console.log('[electron:prepare] building Next.js standalone bundle…');
  await run('pnpm', ['run', 'build'], {
    ECHO_MIRAGE_ELECTRON_BUILD: '1',
  });

  const serverJs = path.join(standaloneDir, 'server.js');
  if (!(await pathExists(serverJs))) {
    throw new Error(`Missing ${serverJs}. Standalone output was not produced.`);
  }

  console.log('[electron:prepare] copying public/, .next/static, and assets/…');
  await copyRecursive(path.join(root, 'public'), path.join(standaloneDir, 'public'));
  await copyRecursive(
    path.join(root, '.next', 'static'),
    path.join(standaloneDir, '.next', 'static'),
  );

  const assetsDir = path.join(root, 'assets');
  if (await pathExists(assetsDir)) {
    await copyRecursive(assetsDir, path.join(standaloneDir, 'assets'));
  }

  const buildIdPath = path.join(root, '.next', 'BUILD_ID');
  if (await pathExists(buildIdPath)) {
    const buildId = (await fs.readFile(buildIdPath, 'utf8')).trim();
    console.log(`[electron:prepare] standalone ready (build ${buildId})`);
  } else {
    console.log('[electron:prepare] standalone ready');
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
