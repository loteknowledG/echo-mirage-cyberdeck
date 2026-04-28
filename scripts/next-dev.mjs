/**
 * Runs `next dev` and rewrites printed origin URLs so terminal links open /cyberdeck.
 * Next only prints http://host:3050 (no path); we append /cyberdeck without touching real paths.
 */
import { spawn } from 'node:child_process';
import path from 'node:path';
import readline from 'node:readline';
import { fileURLToPath } from 'node:url';

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const nextCli = path.join(root, 'node_modules', 'next', 'dist', 'bin', 'next');

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

const child = spawn(process.execPath, [nextCli, 'dev', '-p', '3050'], {
  cwd: root,
  stdio: ['inherit', 'pipe', 'pipe'],
  env: process.env,
});

function pipeLines(stream, /** @type {NodeJS.WriteStream} */ out) {
  readline
    .createInterface({ input: stream, crlfDelay: Infinity })
    .on('line', (line) => {
      out.write(rewritePrintedUrls(line) + '\n');
    });
}

pipeLines(child.stdout, process.stdout);
pipeLines(child.stderr, process.stderr);

for (const sig of ['SIGINT', 'SIGTERM']) {
  process.on(sig, () => {
    child.kill(sig);
  });
}

child.on('close', (code, signal) => {
  if (signal) process.kill(process.pid, signal);
  else process.exit(code ?? 0);
});
