import { resolveCalyxVaultName } from "./calyx-config.server";
import { getCalyxMcpClient } from "./calyx-mcp-client.server";

export function getEchoMirageCalyxVaultName(): string {
  return resolveCalyxVaultName();
}

export async function ensureEchoMirageCalyxVault(): Promise<string> {
  const vault = getEchoMirageCalyxVaultName();
  const client = getCalyxMcpClient();
  try {
    await client.callTool("calyx.create_vault", {
      name: vault,
      panel_template: "code-default",
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    if (!/exist|already|duplicate/i.test(message)) {
      throw error;
    }
  }
  return vault;
}
