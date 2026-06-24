import { resolveCalyxVaultName } from "./calyx-config.server";
import { getCalyxMcpClient } from "./calyx-mcp-client.server";

const ECHO_MIRAGE_INGEST_LENS = "echo_mirage_ingest";

export function getEchoMirageCalyxVaultName(): string {
  return resolveCalyxVaultName();
}

function panelHasIngestLens(panelPayload: unknown): boolean {
  const text = JSON.stringify(panelPayload);
  return text.includes(ECHO_MIRAGE_INGEST_LENS);
}

/** Calyx MCP create_vault does not commission lens runtimes — add one algorithmic text lens for ingest. */
async function ensureEchoMirageIngestLens(vault: string): Promise<void> {
  const client = getCalyxMcpClient();
  const panel = await client.callTool("calyx.list_panel", { vault });
  if (panelHasIngestLens(panel)) return;

  await client.callTool("calyx.add_lens", {
    vault,
    name: ECHO_MIRAGE_INGEST_LENS,
    runtime: "algorithmic",
    modality: "text",
  });
}

export async function ensureEchoMirageCalyxVault(): Promise<string> {
  const vault = getEchoMirageCalyxVaultName();
  const client = getCalyxMcpClient();
  try {
    await client.callTool("calyx.create_vault", {
      name: vault,
      panel_template: "civic-default",
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    if (!/exist|already|duplicate/i.test(message)) {
      throw error;
    }
  }

  await ensureEchoMirageIngestLens(vault);
  return vault;
}
