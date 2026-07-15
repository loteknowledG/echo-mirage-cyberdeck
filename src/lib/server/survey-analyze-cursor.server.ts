// SERVER ONLY — Survey vision via Cursor Agent SDK (optional @cursor/sdk + CURSOR_API_KEY).

import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import type { SurveyAnalyzeResult } from "@/lib/server/survey-analyze.server";

const DEFAULT_CURSOR_MODEL = "composer-2.5";
const DEFAULT_TIMEOUT_MS = 180_000;

function resolveCursorApiKey(): string {
  return (
    process.env.CURSOR_API_KEY?.trim() ||
    process.env.SURVEY_CURSOR_API_KEY?.trim() ||
    ""
  );
}

function resolveCursorModel(): string {
  return (
    process.env.SURVEY_CURSOR_MODEL?.trim() ||
    process.env.CURSOR_MODEL?.trim() ||
    DEFAULT_CURSOR_MODEL
  );
}

export function isCursorSurveyFallbackConfigured(): boolean {
  return Boolean(resolveCursorApiKey());
}

async function loadCursorAgent(): Promise<
  | {
      ok: true;
      Agent: {
        prompt: (
          message: string,
          options: {
            apiKey: string;
            model: { id: string };
            local: { cwd: string };
          },
        ) => Promise<{ status?: string; result?: string }>;
      };
    }
  | { ok: false; error: string }
> {
  try {
    // Optional peer — not required for cyberdeck boot.
    const mod = (await import("@cursor/sdk")) as {
      Agent?: {
        prompt: (
          message: string,
          options: {
            apiKey: string;
            model: { id: string };
            local: { cwd: string };
          },
        ) => Promise<{ status?: string; result?: string }>;
      };
    };
    if (!mod.Agent?.prompt) {
      return { ok: false, error: "@cursor/sdk Agent.prompt unavailable." };
    }
    return { ok: true, Agent: mod.Agent };
  } catch {
    return {
      ok: false,
      error:
        "@cursor/sdk not installed. Add it (`pnpm add @cursor/sdk`) and set CURSOR_API_KEY for Cursor Survey fallback.",
    };
  }
}

function withTimeout<T>(promise: Promise<T>, timeoutMs: number, label: string): Promise<T> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      reject(new Error(`${label} timed out after ${Math.round(timeoutMs / 1000)}s.`));
    }, timeoutMs);
    promise.then(
      (value) => {
        clearTimeout(timer);
        resolve(value);
      },
      (error) => {
        clearTimeout(timer);
        reject(error);
      },
    );
  });
}

/** Cursor Agent reads the PNG(s) from disk and answers the Survey prompt. */
export async function analyzeSurveyCaptureViaCursor(input: {
  pngBase64: string;
  pngBase64List?: string[];
  prompt: string;
}): Promise<SurveyAnalyzeResult> {
  const apiKey = resolveCursorApiKey();
  if (!apiKey) {
    return {
      ok: false,
      error: "CURSOR_API_KEY not set — skip Cursor Survey fallback.",
    };
  }

  const loaded = await loadCursorAgent();
  if (!loaded.ok) return loaded;

  const list = (
    Array.isArray(input.pngBase64List) && input.pngBase64List.length > 0
      ? input.pngBase64List
      : [input.pngBase64]
  )
    .map((entry) => entry.trim())
    .filter(Boolean);

  if (list.length === 0) {
    return { ok: false, error: "pngBase64 is required." };
  }

  const prompt = input.prompt.trim();
  if (!prompt) {
    return { ok: false, error: "prompt is required." };
  }

  const model = resolveCursorModel();
  const tmpDir = await mkdtemp(join(tmpdir(), "survey-cursor-"));
  const imagePaths: string[] = [];

  try {
    for (const [index, png] of list.entries()) {
      const imagePath = join(tmpDir, `capture-${index + 1}.png`);
      await writeFile(imagePath, Buffer.from(png, "base64"));
      imagePaths.push(imagePath);
    }

    const pageLines = imagePaths
      .map((path, index) => `Page ${index + 1}: ${path}`)
      .join("\n");

    const message = [
      "You are helping Survey Mirage SOLVE screen capture(s).",
      list.length > 1
        ? "Open and inspect every screenshot page in order, then answer the operator prompt for the full multi-page question."
        : "Open and inspect the screenshot file at the path below, then answer the operator prompt.",
      "Return only the answer text — no preamble.",
      "",
      pageLines,
      "",
      `Operator prompt: ${prompt}`,
    ].join("\n");

    const timeoutMs = Number(process.env.SURVEY_CURSOR_TIMEOUT_MS) || DEFAULT_TIMEOUT_MS;
    const result = await withTimeout(
      loaded.Agent.prompt(message, {
        apiKey,
        model: { id: model },
        local: { cwd: tmpDir },
      }),
      timeoutMs,
      "Cursor Survey analyze",
    );

    const text = typeof result.result === "string" ? result.result.trim() : "";
    if (!text) {
      return {
        ok: false,
        error: `Cursor Agent returned empty text (status=${result.status ?? "unknown"}).`,
      };
    }

    return { ok: true, text, model, provider: "cursor" };
  } catch (error) {
    return {
      ok: false,
      error: error instanceof Error ? error.message : "Cursor Survey analyze failed.",
    };
  } finally {
    await rm(tmpDir, { recursive: true, force: true }).catch(() => {
      /* best effort */
    });
  }
}

export async function analyzeSurveyTextViaCursor(input: {
  prompt: string;
}): Promise<SurveyAnalyzeResult> {
  const apiKey = resolveCursorApiKey();
  if (!apiKey) {
    return {
      ok: false,
      error: "CURSOR_API_KEY not set — skip Cursor Survey fallback.",
    };
  }

  const loaded = await loadCursorAgent();
  if (!loaded.ok) return loaded;

  const prompt = input.prompt.trim();
  if (!prompt) {
    return { ok: false, error: "prompt is required." };
  }

  const model = resolveCursorModel();
  const tmpDir = await mkdtemp(join(tmpdir(), "survey-cursor-text-"));

  try {
    const timeoutMs = Number(process.env.SURVEY_CURSOR_TIMEOUT_MS) || DEFAULT_TIMEOUT_MS;
    const result = await withTimeout(
      loaded.Agent.prompt(
        [
          "You are helping Survey Mirage SOLVE selected text.",
          "Return only the answer text — no preamble.",
          "",
          prompt,
        ].join("\n"),
        {
          apiKey,
          model: { id: model },
          local: { cwd: tmpDir },
        },
      ),
      timeoutMs,
      "Cursor Survey text analyze",
    );

    const text = typeof result.result === "string" ? result.result.trim() : "";
    if (!text) {
      return {
        ok: false,
        error: `Cursor Agent returned empty text (status=${result.status ?? "unknown"}).`,
      };
    }

    return { ok: true, text, model, provider: "cursor" };
  } catch (error) {
    return {
      ok: false,
      error: error instanceof Error ? error.message : "Cursor Survey text analyze failed.",
    };
  } finally {
    await rm(tmpDir, { recursive: true, force: true }).catch(() => {
      /* best effort */
    });
  }
}
