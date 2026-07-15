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

  console.log(`[electron:afterPack] next package present at ${nextPkg}`);
};
