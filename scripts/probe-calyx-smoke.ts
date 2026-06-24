import { resetCalyxMcpClientForTests } from "../src/lib/calyx/calyx-mcp-client.server";
import { probeCalyxMcpReadiness } from "../src/lib/calyx/calyx-readiness.server";
import { ensureEchoMirageCalyxVault } from "../src/lib/calyx/calyx-vault.server";
import { getCalyxMcpClient } from "../src/lib/calyx/calyx-mcp-client.server";

async function main() {
  resetCalyxMcpClientForTests();

  const readiness = await probeCalyxMcpReadiness();
  console.log("[smoke] calyx readiness", readiness);
  if (!readiness.ok) {
    throw new Error(readiness.message ?? "Calyx readiness probe failed");
  }

  const vault = await ensureEchoMirageCalyxVault();
  console.log("[smoke] vault", vault);

  const marker = `echo-mirage calyx smoke ${Date.now()}`;
  await getCalyxMcpClient().callTool("calyx.ingest", {
    vault,
    input: marker,
  });
  console.log("[smoke] ingest ok");

  const search = await getCalyxMcpClient().callTool("calyx.search", {
    vault,
    query: marker,
    k: 3,
  });
  console.log("[smoke] search", JSON.stringify(search).slice(0, 400));

  resetCalyxMcpClientForTests();
  console.log("[smoke] PASS");
}

main().catch((error) => {
  console.error("probe-calyx-smoke: FAIL", error);
  process.exitCode = 1;
});
