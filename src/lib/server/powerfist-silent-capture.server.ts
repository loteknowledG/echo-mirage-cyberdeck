// SERVER ONLY — silent desktop screenshot for PowerFist capture missions.

import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { captureNativeDesktopPng } from "@/lib/server/native-screen-capture.server";
import { runSamusHandsEyes } from "@/lib/samus-manus/hands-eyes.server";

export type SilentCaptureResult =
  | { ok: true; pngBase64: string; outPath: string }
  | { ok: false; error: string };

async function captureSamusSilentDesktopPng(outPath: string): Promise<SilentCaptureResult> {
  const result = runSamusHandsEyes({
    action: "screenshot",
    out: outPath,
    silent: true,
  });

  if (!result.ok) {
    return {
      ok: false,
      error: result.error || "Screenshot capture failed.",
    };
  }

  try {
    const bytes = await fs.readFile(outPath);
    await fs.unlink(outPath).catch(() => undefined);
    return {
      ok: true,
      pngBase64: bytes.toString("base64"),
      outPath,
    };
  } catch (error) {
    return {
      ok: false,
      error: error instanceof Error ? error.message : "Failed to read screenshot.",
    };
  }
}

export async function captureSilentDesktopPng(): Promise<SilentCaptureResult> {
  const native = await captureNativeDesktopPng();
  if (native.ok) {
    return { ok: true, pngBase64: native.pngBase64, outPath: "" };
  }

  const outPath = path.join(
    os.tmpdir(),
    `echo-mirage-powerfist-${Date.now()}.png`,
  );
  const samus = await captureSamusSilentDesktopPng(outPath);
  if (samus.ok) return samus;

  return {
    ok: false,
    error: `${native.error} ${samus.error}`.trim(),
  };
}
