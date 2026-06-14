/** Merge client IndexedDB memory with MUTHUR ship memory for chat prompts. */
export function buildMemoryPrompt(clientMemory: unknown, serverMemory: string): string {
  const client =
    typeof clientMemory === "string" && clientMemory.trim() ? clientMemory.trim() : "";
  const server = serverMemory.trim();
  const parts: string[] = [];
  if (client) {
    parts.push(`Session memory (browser):\n${client}`);
  }
  if (server) {
    parts.push(`Ship memory (atlas + SQLite):\n${server}`);
  }
  if (!parts.length) {
    return "";
  }
  return `\n\n${parts.join("\n\n")}`;
}
