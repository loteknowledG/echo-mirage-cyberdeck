import { spawn } from 'node:child_process';
import { createRequire } from 'node:module';
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const requireFromRoot = createRequire(path.join(root, 'package.json'));
const standaloneDir = path.join(root, '.next', 'standalone');

/** Runtime modules server.js must resolve inside the packaged app directory. */
const STANDALONE_RUNTIME_MODULES = [
  'next',
  '@next/env',
  '@swc/helpers',
  'styled-jsx',
  'react',
  'react-dom',
];

function run(command, args, env = {}, cwd = root) {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, {
      cwd,
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
  await fs.cp(from, to, { recursive: true, force: true, dereference: true });
}

function moduleDestPath(baseDir, name) {
  if (name.startsWith('@')) {
    const [scope, pkg] = name.split('/');
    return path.join(baseDir, 'node_modules', scope, pkg);
  }
  return path.join(baseDir, 'node_modules', name);
}

async function resolveProjectModuleDir(name) {
  try {
    const pkgJson = requireFromRoot.resolve(`${name}/package.json`);
    return path.dirname(pkgJson);
  } catch {
    return null;
  }
}

/** Always refresh from the project install — never trust a stub/symlink leftover. */
async function ensureRuntimeModule(packagedDir, name) {
  const dest = moduleDestPath(packagedDir, name);
  const src = await resolveProjectModuleDir(name);
  if (!src) {
    throw new Error(
      `[electron:prepare] cannot patch standalone — missing project dependency "${name}". Run pnpm install.`,
    );
  }

  console.log(`[electron:prepare] copying standalone runtime dep: ${name}`);
  await fs.rm(dest, { recursive: true, force: true });
  await fs.mkdir(path.dirname(dest), { recursive: true });
  await fs.cp(src, dest, { recursive: true, force: true, dereference: true });

  if (!(await pathExists(path.join(dest, 'package.json')))) {
    throw new Error(`[electron:prepare] copy failed — missing ${path.join(dest, 'package.json')}`);
  }
}

async function ensureStandaloneRuntimeDeps(packagedDir) {
  for (const name of STANDALONE_RUNTIME_MODULES) {
    await ensureRuntimeModule(packagedDir, name);
  }
}

/**
 * Verify next resolves from the packaged tree only.
 * Plain `require('next')` from cwd walks up into the monorepo node_modules and
 * falsely passes even when packaged next is missing (the 0.1.6 installer bug).
 */
async function verifyStandaloneRuntime(packagedDir) {
  console.log('[electron:prepare] verifying packaged server can require next…');

  for (const name of STANDALONE_RUNTIME_MODULES) {
    const pkg = path.join(moduleDestPath(packagedDir, name), 'package.json');
    if (!(await pathExists(pkg))) {
      throw new Error(`[electron:prepare] missing packaged runtime dep: ${name} (${pkg})`);
    }
  }

  const script = `
const fs = require('fs');
const path = require('path');
const Module = require('module');
const root = process.cwd();
const localModules = path.join(root, 'node_modules');
const nextPkg = path.join(localModules, 'next', 'package.json');
if (!fs.existsSync(nextPkg)) {
  console.error('[electron:prepare] next package.json missing at', nextPkg);
  process.exit(1);
}
const originalNodeModulePaths = Module._nodeModulePaths;
Module._nodeModulePaths = function (from) {
  return originalNodeModulePaths(from).filter((candidate) => {
    const normalized = path.normalize(candidate);
    return normalized === localModules || normalized.startsWith(localModules + path.sep);
  });
};
require(path.join(localModules, 'next'));
console.log('[electron:prepare] next module ok');
`;

  await run(
    process.execPath,
    ['-e', script],
    { ELECTRON_RUN_AS_NODE: '1', NODE_PATH: '' },
    packagedDir,
  );
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

  await ensureStandaloneRuntimeDeps(standaloneDir);

  const packagedDir = path.join(root, '.next', 'standalone-electron');
  console.log('[electron:prepare] materializing standalone for electron (dereference symlinks)…');
  await fs.rm(packagedDir, { recursive: true, force: true });
  await fs.cp(standaloneDir, packagedDir, { recursive: true, force: true, dereference: true });

  const packagedServerJs = path.join(packagedDir, 'server.js');
  if (!(await pathExists(packagedServerJs))) {
    throw new Error(`Missing ${packagedServerJs} after materialize.`);
  }

  await ensureStandaloneRuntimeDeps(packagedDir);
  await verifyStandaloneRuntime(packagedDir);

  console.log('[electron:prepare] writing desktop provider env (when CI secrets present)…');
  await run('node', ['scripts/write-desktop-provider-env.mjs']);

  const buildIdPath = path.join(root, '.next', 'BUILD_ID');
  if (await pathExists(buildIdPath)) {
    const buildId = (await fs.readFile(buildIdPath, 'utf8')).trim();
    console.log(`[electron:prepare] standalone-electron ready (build ${buildId})`);
  } else {
    console.log('[electron:prepare] standalone-electron ready');
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
