import path from "node:path";
import type { MuthurToolExecutionContext } from "@/lib/muthur-core/types";

const MUTATING_LOCALFS = new Set(["write", "mkdir"]);

function normalizeTouchPath(raw: string): string {
  const trimmed = raw.trim();
  if (!trimmed) return "";
  return path.normalize(trimmed).replace(/\\/g, "/");
}

export function recordCodingTouch(
  ctx: MuthurToolExecutionContext | undefined,
  toolName: string,
  args: Record<string, unknown>,
  output: unknown,
): void {
  if (!ctx) return;

  if (toolName === "localfs") {
    const action = typeof args.action === "string" ? args.action.toLowerCase() : "";
    if (!MUTATING_LOCALFS.has(action)) return;
    const fromArgs = typeof args.path === "string" ? args.path : "";
    const fromOutput =
      output && typeof output === "object" && typeof (output as { path?: string }).path === "string"
        ? (output as { path: string }).path
        : "";
    const touch = normalizeTouchPath(fromOutput || fromArgs);
    if (touch) pushTouch(ctx, touch);
    return;
  }

}

function pushTouch(ctx: MuthurToolExecutionContext, touch: string): void {
  if (!ctx.codingTouches.includes(touch)) {
    ctx.codingTouches.push(touch);
  }
}
