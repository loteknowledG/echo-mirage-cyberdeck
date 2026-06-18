// SERVER ONLY — spawn, observe, and terminate cadre terminal hosts.

import { spawn, type ChildProcess } from "node:child_process";
import path from "node:path";
import {
  CADRE_RUNTIME_SLOTS,
  CADRE_TERMINAL_TYPES,
  cadreAdapterForType,
  cadreSlotForType,
  defaultCadreRuntime,
  toRegistryEntry,
  type CadreRuntime,
  type CadreRuntimeReadiness,
  type CadreRuntimeRegistryEntry,
  type CadreTerminalType,
} from "@/lib/cadre/runtime-registry";
import {
  killCodexRuntime,
  spawnCodexRuntime,
  waitForCodexExit,
  type CodexRuntimeHandle,
} from "@/lib/server/cadre/adapters/codex-runtime-adapter.server";
import {
  detectCodexReadiness,
  startingCodexReadiness,
  stoppedCodexReadiness,
} from "@/lib/server/cadre/codex-readiness-detector.server";
import { appendCadreEventLog } from "@/lib/server/cadre-event-log.server";
import { cadreStreamHub } from "@/lib/server/cadre-stream-hub.server";
import { runtimeIdToActor, type CadreEventSeverity } from "@/lib/cadre/cadre-events";

const OUTPUT_LINE_LIMIT = 500;
const STUB_SCRIPT = path.join(process.cwd(), "scripts", "cadre-runtime-host-stub.mjs");

type RuntimeProcess =
  | { kind: "child"; child: ChildProcess }
  | { kind: "codex"; handle: CodexRuntimeHandle };

type ManagedRuntime = CadreRuntime & {
  stdout: string[];
  stderr: string[];
  process: RuntimeProcess | null;
};

function createInitialState(): Map<CadreTerminalType, ManagedRuntime> {
  const map = new Map<CadreTerminalType, ManagedRuntime>();
  for (const type of CADRE_TERMINAL_TYPES) {
    const base = defaultCadreRuntime(type);
    map.set(type, { ...base, stdout: [], stderr: [], process: null });
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

    if (entry.process && entry.status !== "stopped") {
      return this.snapshot(runtime);
    }

    this.emitCadreEvent({
      type: "runtime_start_requested",
      actor: runtimeIdToActor(runtime),
      runtimeId: runtime,
      message: `${slot.name} runtime starting`,
      severity: "info",
      archive: false,
    });

    entry.status = "starting";
    entry.startedAt = new Date().toISOString();
    entry.pid = null;
    if (cadreAdapterForType(runtime) === "codex-cli") {
      this.applyReadiness(runtime, startingCodexReadiness());
    } else {
      this.applyReadiness(runtime, {
        readiness: "starting",
        readinessReason: "Spawning stub host",
        lastReadinessAt: new Date().toISOString(),
      });
    }
    this.publishStatus(runtime);

    const adapter = cadreAdapterForType(runtime);
    if (adapter === "codex-cli") {
      try {
        const handle = await spawnCodexRuntime(process.cwd());
        entry.process = { kind: "codex", handle };
        entry.pid = handle.pid;
        this.appendLine(runtime, "stdout", `[CADRE] spawning ${slot.name} via ${adapter} (pid ${entry.pid ?? "?"})`);
        this.attachCodex(runtime, handle);
      } catch (error) {
        entry.status = "stopped";
        entry.process = null;
        entry.pid = null;
        this.applyReadiness(runtime, {
          readiness: "errored",
          readinessReason: error instanceof Error ? error.message : "Codex failed to start",
          lastReadinessAt: new Date().toISOString(),
        });
        this.publishStatus(runtime);
        this.emitCadreEvent({
          type: "host_error",
          actor: runtimeIdToActor(runtime),
          runtimeId: runtime,
          message: error instanceof Error ? error.message : "Cadre host failed to start",
          severity: "error",
        });
        throw error;
      }
    } else {
      const child = spawn(process.execPath, [STUB_SCRIPT, slot.name], {
        cwd: process.cwd(),
        env: {
          ...process.env,
          CADRE_STUB_INTERVAL_MS: process.env.CADRE_STUB_INTERVAL_MS ?? "4000",
        },
        stdio: ["ignore", "pipe", "pipe"],
        windowsHide: true,
      });
      entry.process = { kind: "child", child };
      entry.pid = typeof child.pid === "number" ? child.pid : null;
      this.appendLine(runtime, "stdout", `[CADRE] spawning ${slot.name} host (pid ${entry.pid ?? "?"})`);
      this.attachChild(runtime, child);
    }

    entry.status = "running";
    this.refreshReadiness(runtime);
    this.publishStatus(runtime);
    this.emitCadreEvent({
      type: "runtime_started",
      actor: runtimeIdToActor(runtime),
      runtimeId: runtime,
      message: `${slot.name} runtime online`,
      severity: "success",
      meta: { pid: entry.pid },
    });
    return this.snapshot(runtime);
  }

  async stopRuntime(runtimeId: string): Promise<CadreRuntime | null> {
    const type = this.resolveType(runtimeId);
    if (!type) return null;
    const entry = this.runtimes.get(type);
    if (!entry) return null;

    this.emitCadreEvent({
      type: "runtime_stop_requested",
      actor: runtimeIdToActor(type),
      runtimeId: type,
      message: `${entry.name} runtime stopping`,
      severity: "info",
      archive: false,
    });

    if (entry.process?.kind === "codex") {
      const handle = entry.process.handle;
      killCodexRuntime(handle);
      await waitForCodexExit(handle, 2500);
      entry.process = null;
    } else if (entry.process?.kind === "child") {
      const child = entry.process.child;
      child.kill("SIGTERM");
      await this.waitForExit(child, 2500);
      if (child.exitCode === null) {
        try {
          child.kill("SIGKILL");
        } catch {
          /* already exited */
        }
      }
      entry.process = null;
    }

    entry.status = "stopped";
    entry.pid = null;
    this.applyReadiness(
      type,
      cadreAdapterForType(type) === "codex-cli"
        ? stoppedCodexReadiness()
        : {
            readiness: "stopped",
            readinessReason: "Stopped by operator",
            lastReadinessAt: new Date().toISOString(),
          },
    );
    this.appendLine(type, "stdout", `[CADRE] ${entry.name} stopped by operator`);
    this.publishStatus(type);
    this.emitCadreEvent({
      type: "runtime_stopped",
      actor: runtimeIdToActor(type),
      runtimeId: type,
      message: `${entry.name} runtime stopped`,
      severity: "info",
    });
    return this.snapshot(type);
  }

  async restartRuntime(runtimeId: string): Promise<CadreRuntime | null> {
    const type = this.resolveType(runtimeId);
    if (!type) return null;
    const entry = this.runtimes.get(type);
    this.emitCadreEvent({
      type: "runtime_restart_requested",
      actor: runtimeIdToActor(type),
      runtimeId: type,
      message: entry ? `${entry.name} runtime restart requested` : "Runtime restart requested",
      severity: "warning",
      archive: false,
    });
    await this.stopRuntime(runtimeId);
    const resolved = this.resolveType(runtimeId);
    if (!resolved) return null;
    return this.startRuntime(resolved);
  }

  resetForTests(): void {
    for (const type of CADRE_TERMINAL_TYPES) {
      const entry = this.runtimes.get(type);
      if (!entry) continue;
      if (entry.process?.kind === "codex") {
        try {
          killCodexRuntime(entry.process.handle);
        } catch {
          /* ignore */
        }
      } else if (entry.process?.kind === "child") {
        try {
          entry.process.child.kill("SIGKILL");
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
      adapter: cadreAdapterForType(type),
      readiness: entry.readiness,
      readinessReason: entry.readinessReason,
      lastReadinessAt: entry.lastReadinessAt,
    };
  }

  private applyReadiness(
    type: CadreTerminalType,
    snapshot: { readiness: CadreRuntimeReadiness; readinessReason: string; lastReadinessAt: string },
  ): void {
    const entry = this.runtimes.get(type);
    if (!entry) return;

    const previous = entry.readiness;
    entry.readiness = snapshot.readiness;
    entry.readinessReason = snapshot.readinessReason;
    entry.lastReadinessAt = snapshot.lastReadinessAt;

    if (previous === snapshot.readiness) return;

    const actor = runtimeIdToActor(type);
    let severity: CadreEventSeverity = "info";
    let verification: "pass" | "fail" | "pending" | undefined;
    if (snapshot.readiness === "ready") {
      severity = "success";
      verification = "pass";
    } else if (snapshot.readiness === "errored") {
      severity = "error";
      verification = "fail";
    } else if (
      snapshot.readiness === "blocked_auth" ||
      snapshot.readiness === "blocked_update_prompt"
    ) {
      severity = "warning";
    }

    this.emitCadreEvent({
      type:
        snapshot.readiness === "ready"
          ? "verification_pass"
          : snapshot.readiness === "errored"
            ? "verification_fail"
            : "readiness_changed",
      actor,
      runtimeId: type,
      message: `${entry.name} readiness: ${snapshot.readiness.replaceAll("_", " ")}`,
      severity,
      verification,
      meta: { readiness: snapshot.readiness, reason: snapshot.readinessReason },
    });
  }

  private emitCadreEvent(
    input: Parameters<typeof appendCadreEventLog>[0],
  ): ReturnType<typeof appendCadreEventLog> {
    const event = appendCadreEventLog(input);
    cadreStreamHub.publish({ type: "cadre_event", event });
    return event;
  }

  private refreshReadiness(type: CadreTerminalType): void {
    const entry = this.runtimes.get(type);
    if (!entry) return;

    if (cadreAdapterForType(type) === "codex-cli") {
      const detected = detectCodexReadiness({
        stdout: entry.stdout.join(""),
        stderr: entry.stderr.join(""),
        status: entry.status,
      });
      this.applyReadiness(type, detected);
      return;
    }

    if (entry.status === "stopped") {
      this.applyReadiness(type, {
        readiness: "stopped",
        readinessReason: "Not running",
        lastReadinessAt: new Date().toISOString(),
      });
      return;
    }

    if (entry.status === "starting") {
      this.applyReadiness(type, {
        readiness: "starting",
        readinessReason: "Spawning stub host",
        lastReadinessAt: new Date().toISOString(),
      });
      return;
    }

    this.applyReadiness(type, {
      readiness: "ready",
      readinessReason: "Stub host online",
      lastReadinessAt: new Date().toISOString(),
    });
  }

  private attachCodex(type: CadreTerminalType, handle: CodexRuntimeHandle): void {
    handle.pty.onData((chunk) => {
      for (const line of chunk.split(/\r?\n/)) {
        if (!line) continue;
        this.appendLine(type, "stdout", line, { refreshReadiness: false });
      }
      this.refreshReadiness(type);
      this.publishStatus(type);
    });

    handle.pty.onExit(({ exitCode, signal }) => {
      const entry = this.runtimes.get(type);
      if (!entry) return;
      entry.process = null;
      entry.pid = null;
      entry.status = "stopped";
      const reason = signal ? `signal ${signal}` : `code ${exitCode ?? 0}`;
      this.appendLine(type, "stdout", `[CADRE] ${entry.name} process exited (${reason})`, {
        refreshReadiness: false,
      });
      const detected = detectCodexReadiness({
        stdout: entry.stdout.join(""),
        stderr: entry.stderr.join(""),
        status: "stopped",
        exitCode,
        signal: signal != null ? String(signal) : null,
      });
      this.applyReadiness(type, detected);
      this.publishStatus(type);
      this.emitCadreEvent({
        type: "runtime_stopped",
        actor: runtimeIdToActor(type),
        runtimeId: type,
        message: `${entry.name} process exited (${reason})`,
        severity: exitCode && exitCode !== 0 ? "error" : "info",
      });
    });
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
      entry.process = null;
      entry.pid = null;
      entry.status = "stopped";
      const reason = signal ? `signal ${signal}` : `code ${code ?? 0}`;
      this.appendLine(type, "stdout", `[CADRE] ${entry.name} process exited (${reason})`);
      this.applyReadiness(type, {
        readiness: code && code !== 0 ? "errored" : "stopped",
        readinessReason:
          code && code !== 0 ? `Process exited with code ${code}` : "Process stopped",
        lastReadinessAt: new Date().toISOString(),
      });
      this.publishStatus(type);
      this.emitCadreEvent({
        type: "runtime_stopped",
        actor: runtimeIdToActor(type),
        runtimeId: type,
        message: `${entry.name} process exited (${reason})`,
        severity: code && code !== 0 ? "error" : "info",
      });
    });
  }

  private appendLine(
    type: CadreTerminalType,
    stream: "stdout" | "stderr",
    line: string,
    options?: { refreshReadiness?: boolean },
  ): void {
    const entry = this.runtimes.get(type);
    if (!entry) return;
    const bucket = stream === "stdout" ? entry.stdout : entry.stderr;
    bucket.push(`${line}\n`);
    if (bucket.length > OUTPUT_LINE_LIMIT) {
      bucket.splice(0, bucket.length - OUTPUT_LINE_LIMIT);
    }
    cadreStreamHub.publish({ type: "output", runtimeId: entry.id, stream, line });

    if (options?.refreshReadiness !== false && cadreAdapterForType(type) === "codex-cli") {
      this.refreshReadiness(type);
      this.publishStatus(type);
    }
  }

  private publishStatus(type: CadreTerminalType): void {
    const entry = this.runtimes.get(type);
    if (!entry) return;
    cadreStreamHub.publish({
      type: "status",
      runtimeId: entry.id,
      status: entry.status,
      pid: entry.pid,
      readiness: entry.readiness,
      readinessReason: entry.readinessReason,
      lastReadinessAt: entry.lastReadinessAt,
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
