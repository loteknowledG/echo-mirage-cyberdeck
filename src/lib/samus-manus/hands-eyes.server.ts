import { spawnSync } from "node:child_process";
import path from "node:path";
import type { ToolResult } from "@/lib/muthur-core/types";
import {
  getHandsEyesSkillDir,
  getHandsPyPath,
  isSamusHandsEyesEnabled,
  resolveSamusPython,
} from "@/lib/samus-manus/samus-manus-config.server";

const EXEC_TIMEOUT_MS = 45_000;
const MAX_OUTPUT_CHARS = 8_000;

export const SAMUS_HANDS_EYES_ACTIONS = [
  "move",
  "click",
  "double_click",
  "type",
  "paste",
  "press",
  "hotkey",
  "scroll",
  "drag",
  "screenshot",
  "find_click",
  "find_on_screen",
  "focus_vscode",
  "open_paint",
  "focus_codex",
] as const;

export type SamusHandsEyesAction = (typeof SAMUS_HANDS_EYES_ACTIONS)[number];

function truncate(text: string): string {
  if (text.length <= MAX_OUTPUT_CHARS) return text;
  return `${text.slice(0, MAX_OUTPUT_CHARS)}\n…[truncated]`;
}

function runProcess(
  command: string,
  args: string[],
  options?: { timeoutMs?: number },
): ToolResult {
  const startedAt = Date.now();
  const timeoutMs = options?.timeoutMs ?? EXEC_TIMEOUT_MS;
  const result = spawnSync(command, args, {
    encoding: "utf-8",
    timeout: timeoutMs,
    windowsHide: true,
    cwd: getHandsEyesSkillDir(),
  });

  const stdout = truncate(String(result.stdout ?? "").trimEnd());
  const stderr = truncate(String(result.stderr ?? "").trimEnd());
  const exitCode = result.status ?? (result.error ? 1 : 0);
  const duration_ms = Date.now() - startedAt;

  const payload = {
    command: [command, ...args].join(" "),
    stdout,
    stderr,
    exitCode,
    duration_ms,
  };

  if (result.error) {
    return {
      ok: false,
      error: result.error.message,
      output: payload,
    };
  }

  if (exitCode !== 0) {
    return {
      ok: false,
      error: stderr || stdout || `Exit ${exitCode}`,
      output: payload,
    };
  }

  return { ok: true, output: payload };
}

function asString(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

function asNumber(value: unknown): number | undefined {
  return typeof value === "number" && Number.isFinite(value) ? value : undefined;
}

function asBool(value: unknown, fallback: boolean): boolean {
  return typeof value === "boolean" ? value : fallback;
}

function handsSubcommand(action: SamusHandsEyesAction): string {
  return action === "double_click" ? "double-click" : action.replace(/_/g, "-");
}

function buildHandsArgv(action: SamusHandsEyesAction, args: Record<string, unknown>): string[] {
  const silent = asBool(args.silent, true);
  const argv: string[] = [getHandsPyPath()];
  if (silent) argv.push("--silent");
  argv.push(handsSubcommand(action));

  switch (action) {
    case "move": {
      const x = asNumber(args.x);
      const y = asNumber(args.y);
      if (x == null || y == null) throw new Error("move requires x and y.");
      argv.push("--x", String(x), "--y", String(y));
      const dur = asNumber(args.dur);
      if (dur != null) argv.push("--dur", String(dur));
      break;
    }
    case "click": {
      const x = asNumber(args.x);
      const y = asNumber(args.y);
      if (x == null || y == null) throw new Error("click requires x and y.");
      argv.push("--x", String(x), "--y", String(y));
      const button = asString(args.button);
      if (button) argv.push("--button", button);
      break;
    }
    case "double_click": {
      const x = asNumber(args.x);
      const y = asNumber(args.y);
      if (x == null || y == null) throw new Error("double_click requires x and y.");
      argv.push("--x", String(x), "--y", String(y));
      break;
    }
    case "type": {
      const text = asString(args.text);
      if (!text) throw new Error("type requires text.");
      argv.push(text);
      const interval = asNumber(args.interval);
      if (interval != null) argv.push("--interval", String(interval));
      break;
    }
    case "paste": {
      const text = asString(args.text);
      if (!text) throw new Error("paste requires text.");
      argv.push(text);
      break;
    }
    case "press": {
      const key = asString(args.key);
      if (!key) throw new Error("press requires key.");
      argv.push(key);
      break;
    }
    case "hotkey": {
      const keys = Array.isArray(args.keys)
        ? args.keys.filter((k): k is string => typeof k === "string" && k.trim().length > 0)
        : [];
      if (keys.length === 0) throw new Error("hotkey requires keys array.");
      argv.push(...keys);
      break;
    }
    case "scroll": {
      const amount = asNumber(args.amount);
      if (amount == null) throw new Error("scroll requires amount.");
      argv.push("--amount", String(amount));
      break;
    }
    case "drag": {
      const x1 = asNumber(args.x1);
      const y1 = asNumber(args.y1);
      const x2 = asNumber(args.x2);
      const y2 = asNumber(args.y2);
      if (x1 == null || y1 == null || x2 == null || y2 == null) {
        throw new Error("drag requires x1, y1, x2, y2.");
      }
      argv.push("--x1", String(x1), "--y1", String(y1), "--x2", String(x2), "--y2", String(y2));
      const dur = asNumber(args.dur);
      if (dur != null) argv.push("--dur", String(dur));
      const button = asString(args.button);
      if (button) argv.push("--button", button);
      break;
    }
    case "screenshot": {
      const out = asString(args.out);
      if (!out) throw new Error("screenshot requires out (output image path).");
      argv.push("--out", out);
      break;
    }
    case "find_click": {
      const img = asString(args.img);
      if (!img) throw new Error("find_click requires img (template image path).");
      argv.push("--img", img);
      const confidence = asNumber(args.confidence);
      if (confidence != null) argv.push("--confidence", String(confidence));
      const timeout = asNumber(args.timeout);
      if (timeout != null) argv.push("--timeout", String(timeout));
      if (asBool(args.click, true)) argv.push("--click");
      break;
    }
    case "focus_vscode":
    case "open_paint": {
      if (action === "open_paint") {
        const wait = asNumber(args.wait);
        if (wait != null) argv.push("--wait", String(wait));
        if (asBool(args.return_to_vscode, false)) argv.push("--return-to-vscode");
      }
      break;
    }
    default:
      throw new Error(`Action ${action} is not routed through hands.py.`);
  }

  return argv;
}

function runFindOnScreen(args: Record<string, unknown>): ToolResult {
  const img = asString(args.img);
  if (!img) {
    return { ok: false, error: "find_on_screen requires img (template image path)." };
  }
  const confidence = asNumber(args.confidence) ?? 0.8;
  const timeout = asNumber(args.timeout) ?? 3;
  const skillDir = getHandsEyesSkillDir();
  const code = [
    "import json, sys",
    `sys.path.insert(0, ${JSON.stringify(skillDir)})`,
    "from eyes import find_on_screen",
    `pos = find_on_screen(${JSON.stringify(img)}, confidence=${confidence}, timeout=${timeout})`,
    "print(json.dumps({'found': pos is not None, 'position': pos}))",
  ].join("\n");

  return runProcess(resolveSamusPython(), ["-c", code], { timeoutMs: Math.ceil(timeout * 1000) + 5_000 });
}

function runFocusCodex(args: Record<string, unknown>): ToolResult {
  const script = path.join(getHandsEyesSkillDir(), "focus_codex.py");
  const argv = [script];
  const xRatio = asNumber(args.x_ratio);
  const yRatio = asNumber(args.y_ratio);
  const wait = asNumber(args.wait);
  if (xRatio != null) argv.push("--x-ratio", String(xRatio));
  if (yRatio != null) argv.push("--y-ratio", String(yRatio));
  if (wait != null) argv.push("--wait", String(wait));
  if (asBool(args.no_click, false)) argv.push("--no-click");
  return runProcess(resolveSamusPython(), argv);
}

export function runSamusHandsEyes(args: Record<string, unknown>): ToolResult {
  if (!isSamusHandsEyesEnabled()) {
    return {
      ok: false,
      error:
        "samus_hands_eyes requires local Windows with samus-manus at SAMUS_MANUS_ROOT (default C:\\dev\\samus-manus). " +
        "Set SAMUS_HANDS_EYES=1 to force enable or install pyautogui in that environment.",
    };
  }

  const actionRaw = asString(args.action);
  if (!actionRaw) {
    return { ok: false, error: "action is required for samus_hands_eyes." };
  }
  if (!SAMUS_HANDS_EYES_ACTIONS.includes(actionRaw as SamusHandsEyesAction)) {
    return { ok: false, error: `Unknown samus_hands_eyes action: ${actionRaw}` };
  }
  const action = actionRaw as SamusHandsEyesAction;

  try {
    if (action === "find_on_screen") {
      return runFindOnScreen(args);
    }
    if (action === "focus_codex") {
      return runFocusCodex(args);
    }

    const argv = buildHandsArgv(action, args);
    return runProcess(resolveSamusPython(), argv);
  } catch (error) {
    return {
      ok: false,
      error: error instanceof Error ? error.message : "samus_hands_eyes failed.",
    };
  }
}
