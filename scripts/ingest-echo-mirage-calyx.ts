import fs from "node:fs";
import path from "node:path";
import { resetCalyxMcpClientForTests } from "../src/lib/calyx/calyx-mcp-client.server";
import { resolveCalyxHome } from "../src/lib/calyx/calyx-config.server";
import { probeCalyxMcpReadiness } from "../src/lib/calyx/calyx-readiness.server";
import {
  ensureEchoMirageCalyxVault,
  getEchoMirageCalyxVaultName,
} from "../src/lib/calyx/calyx-vault.server";
import { getCalyxMcpClient } from "../src/lib/calyx/calyx-mcp-client.server";

const REPO_ROOT = process.cwd();
const ECHO_MIRAGE_VAULT_PANEL = "civic-default";
const MAX_CHUNK_CHARS = 24_000;
const INGEST_BATCH_SIZE = 4;

/** High-signal docs for MUTHUR / Pi / operator recall — no secrets (.env.local excluded). */
const CURATED_PATHS = [
  "L-ARCH-001.md",
  "docs/foundations/README.md",
  "docs/Echo Mirage Handoff.md",
  "docs/muthur-commands.md",
  "docs/mechanical-orchestration-manifesto.md",
  "docs/work-orders/L-MUTHUR-CONTROL-001-pi-control-lease.md",
  "docs/work-orders/L-UI-001-response-visibility.md",
  "docs/work-orders/L-CONN-001-provider-authentication.md",
  "docs/work-orders/L-FS-001-workspace-folder-creation.md",
  "docs/adr/ADR-FS-001.md",
  "docs/adr/ADR-CONN-001.md",
  "docs/muthur-verification-layer-testing.md",
  "docs/muthur-execution-loop-testing.md",
  "docs/muthur-browser-verification-testing.md",
  ".env.demo.example",
  "src/lib/pi/pi-computer-use-doctrine.ts",
  "src/lib/pi/pi-glyph-doctrine.ts",
  "src/lib/muthur-glyph-doctrine.ts",
  "src/lib/muthur/calyx/calyx-muthur-tools.server.ts",
];

function formatChunk(relativePath: string, content: string, part?: number, total?: number): string {
  const suffix = part && total && total > 1 ? ` (part ${part}/${total})` : "";
  return `# echo-mirage-cyberdeck — ${relativePath}${suffix}\n\n${content.trim()}\n`;
}

function chunkDocument(relativePath: string, content: string): string[] {
  const normalized = content.replace(/\r\n/g, "\n");
  if (normalized.length <= MAX_CHUNK_CHARS) {
    return [formatChunk(relativePath, normalized)];
  }

  const chunks: string[] = [];
  let start = 0;
  while (start < normalized.length) {
    chunks.push(normalized.slice(start, start + MAX_CHUNK_CHARS));
    start += MAX_CHUNK_CHARS;
  }
  return chunks.map((chunk, index) =>
    formatChunk(relativePath, chunk, index + 1, chunks.length),
  );
}

function resetEchoMirageVaultIfWrongTemplate(): void {
  const calyxHome = resolveCalyxHome();
  const indexPath = path.join(calyxHome, "vaults", "index.json");
  if (!fs.existsSync(indexPath)) return;

  const index = JSON.parse(fs.readFileSync(indexPath, "utf8")) as {
    vaults?: Array<{ name: string; path: string; panel_template?: string }>;
  };
  const vaultName = getEchoMirageCalyxVaultName();
  const existing = index.vaults?.find((entry) => entry.name === vaultName);
  if (!existing || existing.panel_template === ECHO_MIRAGE_VAULT_PANEL) return;

  console.warn(
    "[ingest] resetting vault — wrong panel template:",
    existing.panel_template ?? "unknown",
    `(need ${ECHO_MIRAGE_VAULT_PANEL})`,
  );
  const vaultPath = path.join(calyxHome, existing.path);
  if (fs.existsSync(vaultPath)) {
    fs.rmSync(vaultPath, { recursive: true, force: true });
  }
  index.vaults = index.vaults?.filter((entry) => entry.name !== vaultName) ?? [];
  fs.writeFileSync(indexPath, `${JSON.stringify(index, null, 2)}\n`);
}

async function main() {
  resetCalyxMcpClientForTests();
  resetEchoMirageVaultIfWrongTemplate();

  const readiness = await probeCalyxMcpReadiness();
  console.log("[ingest] readiness", readiness);
  if (!readiness.ok) {
    throw new Error(readiness.message ?? "Calyx readiness probe failed");
  }

  const vault = await ensureEchoMirageCalyxVault();
  console.log("[ingest] vault", vault);

  const chunks: string[] = [];
  let fileCount = 0;

  for (const relativePath of CURATED_PATHS) {
    const absolutePath = path.join(REPO_ROOT, relativePath);
    if (!fs.existsSync(absolutePath)) {
      console.warn("[ingest] skip missing", relativePath);
      continue;
    }
    const content = fs.readFileSync(absolutePath, "utf8");
    const docChunks = chunkDocument(relativePath, content);
    chunks.push(...docChunks);
    fileCount += 1;
    console.log("[ingest] queued", relativePath, `(${docChunks.length} chunk(s))`);
  }

  if (chunks.length === 0) {
    throw new Error("No documents found to ingest");
  }

  const client = getCalyxMcpClient();
  for (let i = 0; i < chunks.length; i += INGEST_BATCH_SIZE) {
    const batch = chunks.slice(i, i + INGEST_BATCH_SIZE);
    console.log(
      `[ingest] uploading batch ${Math.floor(i / INGEST_BATCH_SIZE) + 1}/${Math.ceil(chunks.length / INGEST_BATCH_SIZE)}`,
    );
    await client.callTool("calyx.ingest", { vault, batch });
  }

  const search = await client.callTool("calyx.search", {
    vault,
    query: "MUTHUR pi control lease glyph channel Calyx",
    k: 5,
  });
  console.log("[ingest] search sample", JSON.stringify(search).slice(0, 600));

  resetCalyxMcpClientForTests();
  console.log("[ingest] PASS", { vault, files: fileCount, chunks: chunks.length });
}

main().catch((error) => {
  console.error("ingest-echo-mirage-calyx: FAIL", error);
  process.exitCode = 1;
});
