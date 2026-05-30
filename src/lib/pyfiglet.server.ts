import { spawn } from "child_process";
import fs from "fs";
import path from "path";

const BRIDGE_SCRIPT = path.join(process.cwd(), "scripts", "pyfiglet-bridge.py");
const PYTHON_CMD = process.env.GLYPH_PYTHON?.trim() || "python";

let pyfigletAvailable: boolean | null = null;
let cachedPyfigletFonts: string[] | null = null;

function runBridge(args: string[], stdin?: string): Promise<{ stdout: string; stderr: string; code: number }> {
  return new Promise((resolve, reject) => {
    if (!fs.existsSync(BRIDGE_SCRIPT)) {
      reject(new Error("pyfiglet bridge script missing"));
      return;
    }

    const child = spawn(PYTHON_CMD, [BRIDGE_SCRIPT, ...args], {
      stdio: ["pipe", "pipe", "pipe"],
      windowsHide: true,
    });

    let stdout = "";
    let stderr = "";
    child.stdout.on("data", (chunk: Buffer) => {
      stdout += chunk.toString("utf8");
    });
    child.stderr.on("data", (chunk: Buffer) => {
      stderr += chunk.toString("utf8");
    });
    child.on("error", reject);
    child.on("close", (code) => resolve({ stdout, stderr, code: code ?? 1 }));

    if (stdin) {
      child.stdin.write(stdin);
    }
    child.stdin.end();
  });
}

/** True when `python` + pyfiglet can run the bridge script. */
export async function isPyfigletAvailable(): Promise<boolean> {
  if (pyfigletAvailable != null) return pyfigletAvailable;
  try {
    const { stdout, code } = await runBridge(["list"]);
    if (code !== 0) {
      pyfigletAvailable = false;
      return false;
    }
    const payload = JSON.parse(stdout) as { ok?: boolean; fonts?: string[] };
    pyfigletAvailable = Boolean(payload.ok && Array.isArray(payload.fonts));
    if (pyfigletAvailable) {
      cachedPyfigletFonts = payload.fonts!.sort((a, b) =>
        a.localeCompare(b, undefined, { sensitivity: "base" }),
      );
    }
    return pyfigletAvailable;
  } catch {
    pyfigletAvailable = false;
    return false;
  }
}

/** Sorted pyfiglet font names (empty when unavailable). */
export async function listPyfigletFonts(): Promise<string[]> {
  if (!(await isPyfigletAvailable())) return [];
  return cachedPyfigletFonts ?? [];
}

/** Map figlet.js display names (e.g. "ASCII 9") to pyfiglet ids (e.g. "ascii9"). */
export async function resolvePyfigletFontName(displayName: string): Promise<string> {
  const fonts = await listPyfigletFonts();
  if (fonts.length === 0) return displayName;

  if (fonts.includes(displayName)) return displayName;

  const lower = displayName.toLowerCase();
  const caseInsensitive = fonts.find((name) => name.toLowerCase() === lower);
  if (caseInsensitive) return caseInsensitive;

  const underscored = lower.replace(/\s+/g, "_");
  const underscoreHit = fonts.find((name) => name.toLowerCase() === underscored);
  if (underscoreHit) return underscoreHit;

  const compact = lower.replace(/\s+/g, "");
  const compactHit = fonts.find((name) => name.toLowerCase() === compact);
  if (compactHit) return compactHit;

  return displayName;
}

export async function renderPyfigletText(text: string, font: string): Promise<string> {
  const pyfigletFont = await resolvePyfigletFontName(font);
  const { stdout, stderr, code } = await runBridge([
    "render",
    "--font",
    pyfigletFont,
    "--text",
    text,
  ]);
  if (code !== 0) {
    let message = stderr.trim();
    try {
      const errJson = JSON.parse(stderr) as { error?: string };
      if (errJson.error) message = errJson.error;
    } catch {
      /* use raw stderr */
    }
    throw new Error(message || `pyfiglet render failed (exit ${code})`);
  }

  const payload = JSON.parse(stdout) as { ok?: boolean; output?: string; error?: string };
  if (!payload.ok || typeof payload.output !== "string") {
    throw new Error(payload.error || "pyfiglet returned no output");
  }
  return payload.output.replace(/\r\n/g, "\n");
}
