import type { PowerFistToolOverride } from "@/lib/cyberdeck/powerfist-events";
import type {
  MuthurCodingVerifyReceipt,
  MuthurOperatorConversionRef,
  MuthurOperatorOpenFileRef,
} from "@/lib/muthur-core/types";
import type { OperatorEditorEdit } from "@/lib/operator-workbench";

export type PowerfistToolOverrideResult = {
  ok: boolean;
  text: string;
  error?: string;
  codingVerify?: MuthurCodingVerifyReceipt | null;
  operatorOpenFile?: MuthurOperatorOpenFileRef | null;
  operatorEdits?: OperatorEditorEdit[];
  operatorConversion?: MuthurOperatorConversionRef | null;
};

export function buildPowerfistToolArgs(
  override: PowerFistToolOverride,
  composerSupplement?: string,
): Record<string, unknown> {
  const args = { ...(override.args ?? {}) };
  const supplement = composerSupplement?.trim();
  if (override.composerArg && supplement) {
    args[override.composerArg] = supplement;
  }
  return args;
}

export async function runPowerfistToolOverride(
  override: PowerFistToolOverride,
  composerSupplement?: string,
): Promise<PowerfistToolOverrideResult> {
  const args = buildPowerfistToolArgs(override, composerSupplement);
  if (override.composerArg && !args[override.composerArg]) {
    return {
      ok: false,
      text: "",
      error: `Composer value required for ${override.composerArg}.`,
    };
  }

  const res = await fetch("/api/muthur-tool", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ toolName: override.name, args }),
  });
  const payload = (await res.json()) as PowerfistToolOverrideResult & { error?: string };
  if (!res.ok) {
    return {
      ok: false,
      text: payload.text || "",
      error: payload.error || `Tool request failed (${res.status}).`,
    };
  }
  return payload;
}
