/**
 * Resume Electron prepare after a successful Next standalone build
 * (skips clean + next build — use when only post-build steps failed).
 */
import { spawn } from 'node:child_process';
import { createRequire } from 'node:module';
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const requireFromRoot = createRequire(path.join(root, 'package.json'));
const standaloneDir = path.join(root, '.next', 'standalone');
const packagedDir = path.join(root, '.next', 'standalone-electron');

const STANDALONE_RUNTIME_MODULES = [
  'next',
  '@next/env',
  '@swc/helpers',
  'styled-jsx',
  'react',
  'react-dom',
  'just-bash',
  'sql.js',
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

async function ensureRuntimeModule(packagedDir, name) {
  const dest = moduleDestPath(packagedDir, name);
  const src = await resolveProjectModuleDir(name);
  if (!src) {
    throw new Error(`[electron:resume] missing project dependency "${name}"`);
  }
  console.log(`[electron:resume] copying standalone runtime dep: ${name}`);
  await fs.rm(dest, { recursive: true, force: true });
  await fs.mkdir(path.dirname(dest), { recursive: true });
  await fs.cp(src, dest, { recursive: true, force: true, dereference: true });
}

async function syncServerChunks(standaloneRoot) {
  const sourceChunks = path.join(root, '.next', 'server', 'chunks');
  const destChunks = path.join(standaloneRoot, '.next', 'server', 'chunks');
  if (!(await pathExists(sourceChunks))) {
    throw new Error(`[electron:resume] missing source chunks at ${sourceChunks}`);
  }
  console.log('[electron:resume] syncing .next/server/chunks…');
  await fs.mkdir(destChunks, { recursive: true });
  await fs.cp(sourceChunks, destChunks, { recursive: true, force: true, dereference: true });
}

function collectWebpackChunkIds(routeSource) {
  const ids = new Set();
  for (const match of routeSource.matchAll(/\.X\(\d+,\[([^\]]+)\]/g)) {
    for (const raw of match[1].split(',')) {
      const id = raw.trim();
      if (/^\d+$/.test(id)) ids.add(id);
    }
  }
  return [...ids];
}

async function verifyCyberdeckChatChunks(standaloneRoot) {
  const routeJs = path.join(
    standaloneRoot,
    '.next',
    'server',
    'app',
    'api',
    'cyberdeck-chat',
    'route.js',
  );
  if (!(await pathExists(routeJs))) {
    throw new Error(`[electron:resume] missing ${routeJs}`);
  }
  const source = await fs.readFile(routeJs, 'utf8');
  const chunkIds = collectWebpackChunkIds(source);
  const missing = [];
  for (const id of chunkIds) {
    const chunkPath = path.join(standaloneRoot, '.next', 'server', 'chunks', `${id}.js`);
    if (!(await pathExists(chunkPath))) missing.push(`${id}.js`);
  }
  if (missing.length > 0) {
    throw new Error(`[electron:resume] cyberdeck-chat missing chunks: ${missing.join(', ')}`);
  }
  console.log(
    `[electron:resume] cyberdeck-chat chunks ok (${chunkIds.map((id) => `${id}.js`).join(', ')})`,
  );
}

async function verifyStandaloneRuntime(packagedRoot) {
  console.log('[electron:resume] verifying packaged server can require next…');
  const verifyScriptPath = path.join(packagedRoot, '.verify-next-runtime.cjs');
  const script = `'use strict';
const fs = require('fs');
const path = require('path');
const Module = require('module');
const root = process.cwd();
const localModules = path.join(root, 'node_modules');
const nextPkg = path.join(localModules, 'next', 'package.json');
if (!fs.existsSync(nextPkg)) {
  console.error('[electron:resume] next package.json missing at', nextPkg);
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
console.log('[electron:resume] next module ok');
`;
  await fs.writeFile(verifyScriptPath, script, 'utf8');
  try {
    await new Promise((resolve, reject) => {
      const child = spawn(process.execPath, [verifyScriptPath], {
        cwd: packagedRoot,
        env: { ...process.env, ELECTRON_RUN_AS_NODE: '1', NODE_PATH: '' },
        stdio: 'inherit',
        shell: false,
      });
      child.on('error', reject);
      child.on('exit', (code) => {
        if (code === 0) resolve();
        else reject(new Error(`verify exited ${code}`));
      });
    });
  } finally {
    await fs.rm(verifyScriptPath, { force: true });
  }
}

async function main() {
  if (!(await pathExists(path.join(standaloneDir, 'server.js')))) {
    throw new Error('Missing .next/standalone — run full electron:prepare first.');
  }

  for (const name of STANDALONE_RUNTIME_MODULES) {
    await ensureRuntimeModule(standaloneDir, name);
  }
  await syncServerChunks(standaloneDir);
  await verifyCyberdeckChatChunks(standaloneDir);

  console.log('[electron:resume] materializing standalone-electron…');
  await fs.rm(packagedDir, { recursive: true, force: true });
  await fs.cp(standaloneDir, packagedDir, { recursive: true, force: true, dereference: true });

  for (const name of STANDALONE_RUNTIME_MODULES) {
    await ensureRuntimeModule(packagedDir, name);
  }
  await syncServerChunks(packagedDir);
  await verifyCyberdeckChatChunks(packagedDir);
  await verifyStandaloneRuntime(packagedDir);

  console.log('[electron:resume] writing desktop provider env…');
  await run('node', ['scripts/write-desktop-provider-env.mjs']);
  console.log('[electron:resume] ready — run electron-builder --win');
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
