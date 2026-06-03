import { promises as fs } from "node:fs";
import path from "node:path";
import { MUTHUR_SCREENSHOT_DIR } from "./browser-paths.server";

export async function readScreenshotPng(
  name: string,
): Promise<{ ok: true; data: Buffer } | { ok: false; status: 400 | 404; error: string }> {
  const trimmed = name.trim();
  if (!trimmed || trimmed.includes("..") || trimmed.includes("/") || trimmed.includes("\\")) {
    return { ok: false, status: 400, error: "Invalid screenshot name." };
  }
  const fileName = path.basename(trimmed);
  const filePath = path.join(MUTHUR_SCREENSHOT_DIR, fileName);
  try {
    const data = await fs.readFile(filePath);
    return { ok: true, data };
  } catch {
    return { ok: false, status: 404, error: "Screenshot not found." };
  }
}
