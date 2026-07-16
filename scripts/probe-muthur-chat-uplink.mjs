import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");
const envPath = path.join(root, ".env.local");
const env = {};
for (const line of fs.readFileSync(envPath, "utf8").split(/\r?\n/)) {
  const m = line.match(/^(OPENROUTER_API_KEY|OPENCODE_ZEN_API_KEY|OPENAI_API_KEY)=(.*)$/);
  if (!m) continue;
  env[m[1]] = m[2].trim().replace(/^['"]|['"]$/g, "");
}

const origin = process.env.PROBE_ORIGIN?.trim() || "http://127.0.0.1:3050";

async function trial(label, body) {
  const t0 = Date.now();
  try {
    const res = await fetch(`${origin}/api/cyberdeck-chat`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(90_000),
    });
    const text = await res.text();
    console.log(
      JSON.stringify({
        label,
        status: res.status,
        ms: Date.now() - t0,
        preview: text.slice(0, 280).replace(/\s+/g, " "),
        ok: res.ok && text.trim().length > 0,
      }),
    );
  } catch (error) {
    console.log(
      JSON.stringify({
        label,
        error: error instanceof Error ? error.message : String(error),
        ms: Date.now() - t0,
      }),
    );
  }
}

await trial("openrouter-gpt4o-mini", {
  message: "Say hi in one short sentence.",
  provider: "openrouter",
  apiKey: env.OPENROUTER_API_KEY || undefined,
  model: "openai/gpt-4o-mini",
  posture: "plan",
});

await trial("opencode-default", {
  message: "Say hi in one short sentence.",
  provider: "opencode",
  apiKey: env.OPENCODE_ZEN_API_KEY || undefined,
  posture: "plan",
});
