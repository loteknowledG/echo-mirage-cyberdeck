const fs = require("fs");
const path = require("path");

/**
 * electron-builder FileMatcher always drops directories named `node_modules`
 * (even under extraResources). Restore the Next standalone node_modules after pack.
 *
 * Resources layout:
 * - Windows: <appOutDir>/resources/app
 * - macOS:   <appOutDir>/<Product>.app/Contents/Resources/app
 */
exports.default = async function electronAfterPack(context) {
  const projectDir = context.packager.projectDir;
  const sourceRoot = path.join(projectDir, ".next", "standalone-electron");
  const sourceModules = path.join(sourceRoot, "node_modules");
  const sourceNextPkg = path.join(sourceModules, "next", "package.json");

  if (!fs.existsSync(sourceNextPkg)) {
    throw new Error(
      `[electron:afterPack] source missing ${sourceNextPkg}. Run electron:prepare first.`,
    );
  }

  const appOutDir = context.appOutDir;
  const candidates = [
    path.join(appOutDir, "resources", "app"),
    ...fs
      .readdirSync(appOutDir, { withFileTypes: true })
      .filter((entry) => entry.isDirectory() && entry.name.endsWith(".app"))
      .map((entry) => path.join(appOutDir, entry.name, "Contents", "Resources", "app")),
  ];

  const appDir = candidates.find((candidate) => fs.existsSync(path.join(candidate, "server.js")));
  if (!appDir) {
    throw new Error(
      `[electron:afterPack] packaged Next server.js not found under ${appOutDir}`,
    );
  }

  const destModules = path.join(appDir, "node_modules");
  console.log(
    `[electron:afterPack] restoring standalone node_modules into ${destModules} (electron-builder strips node_modules from extraResources)`,
  );
  fs.rmSync(destModules, { recursive: true, force: true });
  fs.cpSync(sourceModules, destModules, { recursive: true, dereference: true });

  const nextPkg = path.join(destModules, "next", "package.json");
  if (!fs.existsSync(nextPkg)) {
    throw new Error(
      `[electron:afterPack] missing ${nextPkg} after restore. Desktop installer would fail with Cannot find module 'next'.`,
    );
  }

  // Re-copy server chunks — some packers/traces drop webpack deps that cyberdeck-chat needs.
  const sourceChunks = path.join(sourceRoot, ".next", "server", "chunks");
  const destChunks = path.join(appDir, ".next", "server", "chunks");
  if (!fs.existsSync(sourceChunks)) {
    throw new Error(`[electron:afterPack] missing source chunks at ${sourceChunks}`);
  }
  fs.mkdirSync(destChunks, { recursive: true });
  fs.cpSync(sourceChunks, destChunks, { recursive: true, dereference: true });

  const chatRoute = path.join(appDir, ".next", "server", "app", "api", "cyberdeck-chat", "route.js");
  if (!fs.existsSync(chatRoute)) {
    throw new Error(`[electron:afterPack] missing ${chatRoute}`);
  }
  const routeSource = fs.readFileSync(chatRoute, "utf8");
  const chunkIds = [];
  for (const match of routeSource.matchAll(/\.X\(\d+,\[([^\]]+)\]/g)) {
    for (const raw of match[1].split(",")) {
      const id = raw.trim();
      if (/^\d+$/.test(id)) chunkIds.push(id);
    }
  }
  const missing = chunkIds.filter(
    (id) => !fs.existsSync(path.join(destChunks, `${id}.js`)),
  );
  if (missing.length > 0) {
    throw new Error(
      `[electron:afterPack] cyberdeck-chat missing chunks: ${missing.map((id) => `${id}.js`).join(", ")}`,
    );
  }

  console.log(`[electron:afterPack] next package present at ${nextPkg}`);
  console.log(
    `[electron:afterPack] cyberdeck-chat chunks ok (${chunkIds.map((id) => `${id}.js`).join(", ") || "none"})`,
  );

  // serverExternalPackages are not always traced into standalone — force-copy from the project tree.
  const requiredExternals = ["just-bash", "sql.js"];
  for (const name of requiredExternals) {
    const src = path.join(projectDir, "node_modules", name);
    const dest = path.join(destModules, name);
    if (!fs.existsSync(path.join(src, "package.json"))) {
      throw new Error(`[electron:afterPack] missing project dependency ${name} at ${src}`);
    }
    fs.rmSync(dest, { recursive: true, force: true });
    fs.cpSync(src, dest, { recursive: true, dereference: true });
    console.log(`[electron:afterPack] forced ${name} into packaged node_modules`);
  }

  const sqlWasm = path.join(destModules, "sql.js", "dist", "sql-wasm.wasm");
  if (!fs.existsSync(sqlWasm)) {
    throw new Error(`[electron:afterPack] missing ${sqlWasm}`);
  }
  if (!fs.existsSync(path.join(destModules, "just-bash", "package.json"))) {
    throw new Error("[electron:afterPack] just-bash missing after force-copy");
  }
};
