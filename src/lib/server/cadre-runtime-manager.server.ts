// SERVER ONLY — spawn, observe, and terminate cadre terminal hosts.

import { spawn, type ChildProcess } from "node:child_process";
import path from "node:path";
import {
  CADRE_RUNTIME_SLOTS,
  CADRE_TERMINAL_TYPES,
  cadreSlotForType,
  defaultCadreRuntime,
  toRegistryEntry,
  type CadreRuntime,
  type CadreRuntimeRegistryEntry,
  type CadreTerminalType,
} from "@/lib/cadre/runtime-registry";
import { cadreStreamHub } from "@/lib/server/cadre-stream-hub.server";

const OUTPUT_LINE_LIMIT = 500;
const STUB_SCRIPT = path.join(process.cwd(), "scripts", "cadre-runtime-host-stub.mjs");

type ManagedRuntime = CadreRuntime & {
  stdout: string[];
  stderr: string[];
  child: ChildProcess | null;
};

function createInitialState(): Map<CadreTerminalType, ManagedRuntime> {
  const map = new Map<CadreTerminalType, ManagedRuntime>();
  for (const type of CADRE_TERMINAL_TYPES) {
    const base = defaultCadreRuntime(type);
    map.set(type, { ...base, stdout: [], stderr: [], child: null });
  }
  return map;
}

class CadreRuntimeManager {
  private runtimes = createInitialState();

  listRuntimes(): CadreRuntime[] {
    return CADRE_TERMINAL_TYPES.map((type) => this.snapshot(type));
  }

  listRegistryEntries(): CadreRuntimeRegistryEntry[] {
    return this.listRuntimes().map(toRegistryEntry);
  }

  getRuntime(runtimeId: string): CadreRuntime | null {
    const type = this.resolveType(runtimeId);
    if (!type) return null;
    return this.snapshot(type);
  }

  getOutput(runtimeId: string): { stdout: string; stderr: string; status: CadreRuntime["status"] } | null {
    const type = this.resolveType(runtimeId);
    if (!type) return null;
    const entry = this.runtimes.get(type);
    if (!entry) return null;
    return {
      stdout: entry.stdout.join(""),
      stderr: entry.stderr.join(""),
      status: entry.status,
    };
  }

  async startRuntime(runtime: CadreTerminalType): Promise<CadreRuntime> {
    const slot = cadreSlotForType(runtime);
    const entry = this.runtimes.get(runtime);
    if (!entry) throw new Error(`Unknown runtime: ${runtime}`);

    if (entry.child && entry.status !== "stopped") {
      return this.snapshot(runtime);
    }

    entry.status = "starting";
    entry.startedAt = new Date().toISOString();
    entry.pid = null;
    this.publishStatus(runtime);

    const child = spawn(process.execPath, [STUB_SCRIPT, slot.name], {
      cwd: process.cwd(),
      env: {
        ...process.env,
        CADRE_STUB_INTERVAL_MS: process.env.CADRE_STUB_INTERVAL_MS ?? "4000",
      },
      stdio: ["ignore", "pipe", "pipe"],
      windowsHide: true,
    });

    entry.child = child;
    entry.pid = typeof child.pid === "number" ? child.pid : null;

    this.appendLine(runtime, "stdout", `[CADRE] spawning ${slot.name} host (pid ${entry.pid ?? "?"})`);
    this.attachChild(runtime, child);

    entry.status = "running";
    this.publishStatus(runtime);
    return this.snapshot(runtime);
  }

  async stopRuntime(runtimeId: string): Promise<CadreRuntime | null> {
    const type = this.resolveType(runtimeId);
    if (!type) return null;
    const entry = this.runtimes.get(type);
    if (!entry) return null;

    if (entry.child) {
      const child = entry.child;
      child.kill("SIGTERM");
      await this.waitForExit(child, 2500);
      if (child.exitCode === null) {
        try {
          child.kill("SIGKILL");
        } catch {
          /* already exited */
        }
      }
      entry.child = null;
    }

    entry.status = "stopped";
    entry.pid = null;
    this.appendLine(type, "stdout", `[CADRE] ${entry.name} stopped by operator`);
    this.publishStatus(type);
    return this.snapshot(type);
  }

  async restartRuntime(runtimeId: string): Promise<CadreRuntime | null> {
    await this.stopRuntime(runtimeId);
    const type = this.resolveType(runtimeId);
    if (!type) return null;
    return this.startRuntime(type);
  }

  resetForTests(): void {
    for (const type of CADRE_TERMINAL_TYPES) {
      const entry = this.runtimes.get(type);
      if (!entry) continue;
      if (entry.child) {
        try {
          entry.child.kill("SIGKILL");
        } catch {
          /* ignore */
        }
      }
    }
    this.runtimes = createInitialState();
  }

  private resolveType(runtimeId: string): CadreTerminalType | null {
    const normalized = runtimeId.trim().toLowerCase();
    return (CADRE_TERMINAL_TYPES as readonly string[]).includes(normalized)
      ? (normalized as CadreTerminalType)
      : null;
  }

  private snapshot(type: CadreTerminalType): CadreRuntime {
    const entry = this.runtimes.get(type);
    if (!entry) return defaultCadreRuntime(type);
    return {
      id: entry.id,
      name: entry.name,
      status: entry.status,
      terminalType: entry.terminalType,
      startedAt: entry.startedAt,
      pid: entry.pid,
    };
  }

  private attachChild(type: CadreTerminalType, child: ChildProcess): void {
    const onData =
      (stream: "stdout" | "stderr") =>
      (chunk: Buffer): void => {
        const text = chunk.toString("utf8");
        for (const line of text.split(/\r?\n/)) {
          if (!line) continue;
          this.appendLine(type, stream, line);
        }
      };

    child.stdout?.on("data", onData("stdout"));
    child.stderr?.on("data", onData("stderr"));

    child.on("exit", (code, signal) => {
      const entry = this.runtimes.get(type);
      if (!entry) return;
      entry.child = null;
      entry.pid = null;
      entry.status = "stopped";
      const reason = signal ? `signal ${signal}` : `code ${code ?? 0}`;
      this.appendLine(type, "stdout", `[CADRE] ${entry.name} process exited (${reason})`);
      this.publishStatus(type);
    });
  }

  private appendLine(type: CadreTerminalType, stream: "stdout" | "stderr", line: string): void {
    const entry = this.runtimes.get(type);
    if (!entry) return;
    const bucket = stream === "stdout" ? entry.stdout : entry.stderr;
    bucket.push(`${line}\n`);
    if (bucket.length > OUTPUT_LINE_LIMIT) {
      bucket.splice(0, bucket.length - OUTPUT_LINE_LIMIT);
    }
    cadreStreamHub.publish({ type: "output", runtimeId: entry.id, stream, line });
  }

  private publishStatus(type: CadreTerminalType): void {
    const entry = this.runtimes.get(type);
    if (!entry) return;
    cadreStreamHub.publish({
      type: "status",
      runtimeId: entry.id,
      status: entry.status,
      pid: entry.pid,
    });
  }

  private waitForExit(child: ChildProcess, timeoutMs: number): Promise<void> {
    if (child.exitCode !== null) return Promise.resolve();
    return new Promise((resolve) => {
      const timer = setTimeout(resolve, timeoutMs);
      child.once("exit", () => {
        clearTimeout(timer);
        resolve();
      });
    });
  }
}

let manager: CadreRuntimeManager | null = null;

export function getCadreRuntimeManager(): CadreRuntimeManager {
  if (!manager) manager = new CadreRuntimeManager();
  return manager;
}

export function resetCadreRuntimeManagerForTests(): void {
  manager?.resetForTests();
  manager = null;
}

export function cadreHostReadyMessage(): string {
  return "CADRE HOST READY";
}

export { CADRE_RUNTIME_SLOTS };
