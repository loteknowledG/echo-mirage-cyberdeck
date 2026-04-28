import { NextResponse } from "next/server";

const MODEL_LIST_URL: Record<string, string> = {
  opencode: "https://opencode.ai/zen/v1/models",
  openai: "https://api.openai.com/v1/models",
  openrouter: "https://openrouter.ai/api/v1/models",
};

export async function POST(request: Request) {
  try {
    const { provider, apiKey } = await request.json();
    const url = MODEL_LIST_URL[provider as string];
    if (!url || !apiKey || typeof apiKey !== "string") {
      return NextResponse.json({ error: "provider and apiKey required" }, { status: 400 });
    }

    const upstream = await fetch(url, {
      method: "GET",
      headers: { Authorization: `Bearer ${apiKey}` },
    });

    if (!upstream.ok) {
      return NextResponse.json(
        { error: "upstream", status: upstream.status },
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

    return NextResponse.json({ data });
  } catch (err) {
    console.error("[api/cyberdeck-models]", err);
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
}
