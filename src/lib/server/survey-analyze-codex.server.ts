// SERVER ONLY — Survey vision via logged-in Codex CLI (`codex exec -i …`).

import { spawn } from "node:child_process";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { isCodexCliAvailable } from "@/lib/server/cadre/adapters/codex-runtime-adapter.server";
import type { SurveyAnalyzeResult } from "@/lib/server/survey-analyze.server";

const DEFAULT_TIMEOUT_MS = 180_000;

function resolveCodexExecutable(): string {
  return (
    process.env.SURVEY_CODEX_COMMAND?.trim() ||
    process.env.CADRE_CODEX_COMMAND?.trim() ||
    "codex"
  );
}

function hasCodexCommandOverride(): boolean {
  return Boolean(
    process.env.SURVEY_CODEX_COMMAND?.trim() || process.env.CADRE_CODEX_COMMAND?.trim(),
  );
}

function spawnCodexExec(args: string[]) {
  const executable = resolveCodexExecutable();
  if (process.platform === "win32" && !hasCodexCommandOverride()) {
    return spawn("cmd.exe", ["/c", executable, ...args], {
      stdio: ["ignore", "pipe", "pipe"],
    });
  }
  return spawn(executable, args, { stdio: ["ignore", "pipe", "pipe"] });
}

function runCodexExec(args: string[], timeoutMs: number): Promise<number> {
  return new Promise((resolve, reject) => {
    const child = spawnCodexExec(args);
    const timer = setTimeout(() => {
      child.kill();
      reject(new Error(`Codex exec timed out after ${Math.round(timeoutMs / 1000)}s.`));
    }, timeoutMs);

    child.on("error", (error) => {
      clearTimeout(timer);
      reject(error);
    });
    child.on("close", (code) => {
      clearTimeout(timer);
      resolve(code ?? 1);
    });
  });
}

async function runCodexExecToOutput(input: {
  prompt: string;
  imagePath?: string;
}): Promise<SurveyAnalyzeResult> {
  if (!isCodexCliAvailable()) {
    return {
      ok: false,
      error:
        "Codex CLI not found. Install @openai/codex, run `codex login`, or set SURVEY_CODEX_COMMAND.",
    };
  }

  const prompt = input.prompt.trim();
  if (!prompt) {
    return { ok: false, error: "prompt is required." };
  }

  const tmpDir = await mkdtemp(join(tmpdir(), "survey-codex-"));
  const outputPath = join(tmpDir, "answer.txt");

  try {
    const execArgs = ["exec", "--skip-git-repo-check", "--ephemeral", "-o", outputPath];
    if (input.imagePath) {
      execArgs.push("-i", input.imagePath);
    }
    const model = process.env.SURVEY_CODEX_MODEL?.trim();
    if (model) {
      execArgs.push("-m", model);
    }
    execArgs.push(prompt);

    const timeoutMs = Number(process.env.SURVEY_CODEX_TIMEOUT_MS) || DEFAULT_TIMEOUT_MS;
    const exitCode = await runCodexExec(execArgs, timeoutMs);

    let text = "";
    try {
      text = (await readFile(outputPath, "utf8")).trim();
    } catch {
      text = "";
    }

    if (!text) {
      return {
        ok: false,
        error:
          exitCode === 0
            ? "Codex returned empty text."
            : `Codex exec failed (exit ${exitCode}). Run \`codex login\` and try again.`,
      };
    }

    return {
      ok: true,
      text,
      model: model || "codex-subscription",
      provider: "codex",
    };
  } catch (error) {
    return {
      ok: false,
      error: error instanceof Error ? error.message : "Codex exec failed.",
    };
  } finally {
    await rm(tmpDir, { recursive: true, force: true }).catch(() => {
      /* best effort */
    });
  }
}

export async function analyzeSurveyCaptureViaCodex(input: {
  pngBase64: string;
  prompt: string;
}): Promise<SurveyAnalyzeResult> {
  const pngBase64 = input.pngBase64.trim();
  if (!pngBase64) {
    return { ok: false, error: "pngBase64 is required." };
  }

  const tmpDir = await mkdtemp(join(tmpdir(), "survey-codex-"));
  const imagePath = join(tmpDir, "capture.png");

  try {
    await writeFile(imagePath, Buffer.from(pngBase64, "base64"));
    return await runCodexExecToOutput({
      prompt: input.prompt,
      imagePath,
    });
  } finally {
    await rm(tmpDir, { recursive: true, force: true }).catch(() => {
      /* best effort */
    });
  }
}

export async function analyzeSurveyTextViaCodex(input: {
  prompt: string;
}): Promise<SurveyAnalyzeResult> {
  return runCodexExecToOutput({ prompt: input.prompt });
}
