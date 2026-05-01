import { readFile, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const vaultPath = path.join(os.homedir(), ".codex", "vault", "muthur-voice.lock.json");
const targetPath = path.join(repoRoot, "src", "voice", "muthurPreset.ts");

function formatTsValue(value, indentLevel = 0) {
  const indent = "  ".repeat(indentLevel);
  const nextIndent = "  ".repeat(indentLevel + 1);

  if (value === null) {
    return "null";
  }

  if (typeof value === "string") {
    return JSON.stringify(value);
  }

  if (typeof value === "number" || typeof value === "boolean") {
    return String(value);
  }

  if (Array.isArray(value)) {
    if (value.length === 0) {
      return "[]";
    }

    const items = value.map((item) => `${nextIndent}${formatTsValue(item, indentLevel + 1)}`);
    return `[\n${items.join(",\n")}\n${indent}]`;
  }

  if (typeof value === "object") {
    const entries = Object.entries(value);

    if (entries.length === 0) {
      return "{}";
    }

    const lines = entries.map(([key, nestedValue]) => {
      const rendered = formatTsValue(nestedValue, indentLevel + 1);
      return `${nextIndent}${key}: ${rendered},`;
    });

    return `{\n${lines.join("\n")}\n${indent}}`;
  }

  throw new Error(`Unsupported value type: ${typeof value}`);
}

function renderPresetFile(preset) {
  return [
    "export const MUTHUR_PRESET = Object.freeze(",
    `${formatTsValue(preset, 0)} as const`,
    ");",
    "",
  ].join("\n");
}

async function main() {
  const rawVault = await readFile(vaultPath, "utf8");
  const vault = JSON.parse(rawVault);
  const preset = vault?.preset;

  if (!preset || typeof preset !== "object") {
    throw new Error(`Vault snapshot at ${vaultPath} is missing a preset object.`);
  }

  const nextContents = renderPresetFile(preset);

  let previousContents = null;
  try {
    previousContents = await readFile(targetPath, "utf8");
  } catch {
    previousContents = null;
  }

  if (previousContents !== nextContents) {
    await writeFile(targetPath, nextContents, "utf8");
    console.log(`[muthur:restore] restored preset from ${vaultPath}`);
  } else {
    console.log(`[muthur:restore] preset already matches ${vaultPath}`);
  }
}

main().catch((error) => {
  console.error("[muthur:restore] failed", error);
  process.exitCode = 1;
});
