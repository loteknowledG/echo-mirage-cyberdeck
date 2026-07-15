const fs = require("fs");
const path = require("path");

/**
 * Fail the desktop installer build if the packaged Next standalone is missing `next`.
 * Resources layout:
 * - Windows: <appOutDir>/resources/app
 * - macOS:   <appOutDir>/<Product>.app/Contents/Resources/app
 */
exports.default = async function electronAfterPack(context) {
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

  const nextPkg = path.join(appDir, "node_modules", "next", "package.json");
  if (!fs.existsSync(nextPkg)) {
    throw new Error(
      `[electron:afterPack] missing ${nextPkg}. Desktop installer would fail with Cannot find module 'next'.`,
    );
  }

  console.log(`[electron:afterPack] next package present at ${nextPkg}`);
};
