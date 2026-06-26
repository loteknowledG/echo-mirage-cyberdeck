import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";

/** Remove stale Jupyter server stubs that break Next.js webpack on Windows (EPERM readlink). */
async function main() {
  const runtime = path.join(
    process.env.APPDATA || path.join(os.homedir(), "AppData", "Roaming"),
    "jupyter",
    "runtime",
  );

  let removed = 0;
  try {
    const entries = await fs.readdir(runtime);
    for (const name of entries) {
      if (!/^jpserver-\d+-open\.html$/i.test(name)) continue;
      await fs.unlink(path.join(runtime, name));
      removed += 1;
      console.log(`[clean-windows-build-blockers] removed ${name}`);
    }
  } catch {
    /* no jupyter runtime directory */
  }

  if (removed === 0) {
    console.log("[clean-windows-build-blockers] nothing to clean");
  }
}

main().catch((error) => {
  console.warn(
    "[clean-windows-build-blockers]",
    error instanceof Error ? error.message : error,
  );
});
