import type { ToolCall, ToolResult } from "@/lib/muthur-core/types";
import { isCalyxIntegrationEnabled } from "@/lib/calyx/calyx-config.server";
import { getCalyxMcpClient } from "@/lib/calyx/calyx-mcp-client.server";
import { ensureEchoMirageCalyxVault, getEchoMirageCalyxVaultName } from "@/lib/calyx/calyx-vault.server";

function resolveVaultArg(args: Record<string, unknown>): string {
  const vault = typeof args.vault === "string" ? args.vault.trim() : "";
  return vault || getEchoMirageCalyxVaultName();
}

export function isCalyxMuthurToolsEnabled(): boolean {
  return isCalyxIntegrationEnabled();
}

export async function runCalyxSearch(call: ToolCall): Promise<ToolResult> {
  if (!isCalyxMuthurToolsEnabled()) {
    return { ok: false, error: "Calyx is not enabled — install calyx-mcp and set CALYX_ENABLED=1." };
  }

  const query = typeof call.args.query === "string" ? call.args.query.trim() : "";
  if (!query) {
    return { ok: false, error: "query is required for calyx_search" };
  }

  const vault = await ensureEchoMirageCalyxVault();
  const k = typeof call.args.k === "number" ? call.args.k : 8;
  const result = await getCalyxMcpClient().callTool("calyx.search", {
    vault: resolveVaultArg(call.args) || vault,
    query,
    k,
    guard: call.args.guard === "in_region" ? "in_region" : "off",
    explain: call.args.explain === true,
  });

  return { ok: true, output: result };
}

export async function runCalyxIngest(call: ToolCall): Promise<ToolResult> {
  if (!isCalyxMuthurToolsEnabled()) {
    return { ok: false, error: "Calyx is not enabled — install calyx-mcp and set CALYX_ENABLED=1." };
  }

  const input = typeof call.args.input === "string" ? call.args.input.trim() : "";
  const batch = Array.isArray(call.args.batch)
    ? call.args.batch.filter((entry): entry is string => typeof entry === "string" && entry.trim().length > 0)
    : [];

  if (!input && batch.length === 0) {
    return { ok: false, error: "input or batch is required for calyx_ingest" };
  }

  const vault = await ensureEchoMirageCalyxVault();
  const payload: Record<string, unknown> = {
    vault: resolveVaultArg(call.args) || vault,
  };
  if (input) payload.input = input;
  if (batch.length > 0) payload.batch = batch;

  const result = await getCalyxMcpClient().callTool("calyx.ingest", payload);
  return { ok: true, output: result };
}

export async function runCalyxKernelAnswer(call: ToolCall): Promise<ToolResult> {
  if (!isCalyxMuthurToolsEnabled()) {
    return { ok: false, error: "Calyx is not enabled — install calyx-mcp and set CALYX_ENABLED=1." };
  }

  const query = typeof call.args.query === "string" ? call.args.query.trim() : "";
  if (!query) {
    return { ok: false, error: "query is required for calyx_kernel_answer" };
  }

  const vault = await ensureEchoMirageCalyxVault();
  const result = await getCalyxMcpClient().callTool("calyx.kernel_answer", {
    vault: resolveVaultArg(call.args) || vault,
    query,
  });

  return { ok: true, output: result };
}
