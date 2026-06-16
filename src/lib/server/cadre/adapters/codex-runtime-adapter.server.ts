// SERVER ONLY — Codex CLI terminal host adapter (PTY-backed, observation only).

import { execSync } from "node:child_process";
import type { IPty } from "node-pty";
import type { CadreTerminalType } from "@/lib/cadre/runtime-registry";

export const CODEX_ADAPTER_ID = "codex-cli" as const;
export const CODEX_STUB_MARKER = "CADRE HOST STUB ONLINE";

export type CodexRuntimeHandle = {
  adapter: typeof CODEX_ADAPTER_ID;
  terminalType: Extract<CadreTerminalType, "codex">;
  pid: number | null;
  pty: IPty;
};

export type CodexSpawnSpec = {
  file: string;
  args: string[];
  env: NodeJS.ProcessEnv;
};

function resolveCodexExecutable(): string {
  const override = process.env.CADRE_CODEX_COMMAND?.trim();
  if (override) return override;
  return "codex";
}

export function buildCodexSpawnSpec(cwd: string): CodexSpawnSpec {
  const executable = resolveCodexExecutable();
  const args = ["--no-alt-screen"];

  if (process.platform === "win32" && !process.env.CADRE_CODEX_COMMAND?.trim()) {
    return {
      file: "cmd.exe",
      args: ["/c", executable, ...args],
      env: {
        ...process.env,
        TERM: "xterm-256color",
        COLORTERM: "truecolor",
        CADRE_CODEX_HOST: "1",
        PWD: cwd,
      },
    };
  }

  return {
    file: executable,
    args,
    env: {
      ...process.env,
      TERM: process.env.TERM ?? "xterm-256color",
      COLORTERM: process.env.COLORTERM ?? "truecolor",
      CADRE_CODEX_HOST: "1",
      PWD: cwd,
    },
  };
}

export function isCodexCliAvailable(): boolean {
  if (process.env.CADRE_CODEX_COMMAND?.trim()) return true;
  try {
    const cmd = process.platform === "win32" ? "where codex" : "which codex";
    execSync(cmd, { stdio: "ignore" });
    return true;
  } catch {
    return false;
  }
}

export async function spawnCodexRuntime(cwd: string): Promise<CodexRuntimeHandle> {
  if (!isCodexCliAvailable()) {
    throw new Error(
      "Codex CLI not found on PATH. Install @openai/codex or set CADRE_CODEX_COMMAND.",
    );
  }

  const pty = await import("node-pty");
  const spec = buildCodexSpawnSpec(cwd);
  const shell = pty.spawn(spec.file, spec.args, {
    name: "xterm-256color",
    cols: 120,
    rows: 32,
    cwd,
    env: spec.env,
  });

  return {
    adapter: CODEX_ADAPTER_ID,
    terminalType: "codex",
    pid: typeof shell.pid === "number" ? shell.pid : null,
    pty: shell,
  };
}

export function killCodexRuntime(handle: CodexRuntimeHandle): void {
  try {
    handle.pty.kill();
  } catch {
    /* already exited */
  }
}

export function waitForCodexExit(handle: CodexRuntimeHandle, timeoutMs: number): Promise<void> {
  return new Promise((resolve) => {
    let settled = false;
    const done = () => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      resolve();
    };
    const timer = setTimeout(done, timeoutMs);
    handle.pty.onExit(done);
  });
}

export function isCodexAdapterOutput(text: string): boolean {
  if (text.includes(CODEX_STUB_MARKER)) return false;
  return /codex|Update available|Press enter to continue|›/i.test(text);
}
