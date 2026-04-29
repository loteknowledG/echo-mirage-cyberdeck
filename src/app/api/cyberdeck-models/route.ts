import { NextResponse } from "next/server";

const MODEL_LIST_URL: Record<string, string> = {
  opencode: "https://opencode.ai/zen/v1/models",
  openai: "https://api.openai.com/v1/models",
  openrouter: "https://openrouter.ai/api/v1/models",
};

const DEFAULT_PROVIDER_KEY_ENV: Record<string, string | undefined> = {
  opencode: process.env.OPENCODE_API_KEY || process.env.ZEN_API_KEY || process.env.NEXT_PUBLIC_ZEN_API_KEY,
  openai: process.env.OPENAI_API_KEY,
  openrouter: process.env.OPENROUTER_API_KEY,
};

function resolveProviderApiKey(provider: string, suppliedApiKey: unknown): {
  apiKey: string;
  authSource: "user" | "default" | "none";
} {
  if (typeof suppliedApiKey === "string" && suppliedApiKey.trim()) {
    return { apiKey: suppliedApiKey.trim(), authSource: "user" };
  }
  const envKey = DEFAULT_PROVIDER_KEY_ENV[provider];
  if (typeof envKey === "string" && envKey.trim()) {
    return { apiKey: envKey.trim(), authSource: "default" };
  }
  return { apiKey: "", authSource: "none" };
}

export async function POST(request: Request) {
  try {
    const { provider, apiKey } = await request.json();
    const url = MODEL_LIST_URL[provider as string];
    if (!url) {
      return NextResponse.json({ error: "provider required" }, { status: 400 });
    }

    const { apiKey: resolvedApiKey, authSource } = resolveProviderApiKey(String(provider), apiKey);
    if (!resolvedApiKey) {
      return NextResponse.json(
        { error: "provider key unavailable", code: "NO_PROVIDER_KEY", authSource },
        { status: 400 },
      );
    }

    const upstream = await fetch(url, {
      method: "GET",
      headers: { Authorization: `Bearer ${resolvedApiKey}` },
    });

    if (!upstream.ok) {
      return NextResponse.json(
        { error: "upstream", status: upstream.status, authSource },
        { status: upstream.status === 401 || upstream.status === 403 ? 401 : 502 },
      );
    }

    const json = (await upstream.json()) as { data?: { id: string }[] };
    const raw = Array.isArray(json.data) ? json.data : [];
    const sorted = [...raw].sort((a, b) => {
      const af = String(a.id || "")
        .toLowerCase()
        .includes("free");
      const bf = String(b.id || "")
        .toLowerCase()
        .includes("free");
      if (af === bf) return 0;
      return af ? -1 : 1;
    });
    const data = sorted.slice(0, 50);

    return NextResponse.json({ data, authSource });
  } catch (err) {
    console.error("[api/cyberdeck-models]", err);
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
}
