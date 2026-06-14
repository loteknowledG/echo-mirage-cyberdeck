import { NextResponse } from "next/server";
import { fetchWithTimeout, MODEL_LIST_TIMEOUT_MS } from "@/lib/fetch-with-timeout";
import {
  buildProviderReceipt,
  classifyProviderAuthFailure,
  formatProviderReceiptHeader,
  MODEL_LIST_URL,
  resolveServerProviderCredentials,
} from "@/lib/server/provider-credentials.server";

export async function POST(request: Request) {
  let body: { provider?: unknown; apiKey?: unknown };
  try {
    const parsed = (await request.json()) as unknown;
    if (!parsed || typeof parsed !== "object") {
      return NextResponse.json({ error: "JSON body required" }, { status: 400 });
    }
    body = parsed as { provider?: unknown; apiKey?: unknown };
  } catch {
    return NextResponse.json({ error: "JSON body required" }, { status: 400 });
  }

  try {
    const { provider, apiKey } = body;
    const providerId = String(provider || "");
    const url = MODEL_LIST_URL[providerId];
    if (!url) {
      return NextResponse.json({ error: "provider required" }, { status: 400 });
    }

    const { apiKey: resolvedApiKey, credentialSource } = resolveServerProviderCredentials(
      providerId,
      apiKey,
    );

    if (!resolvedApiKey) {
      const receipt = buildProviderReceipt({
        provider: providerId,
        credentialSource: "none",
        auth: "failed",
        reason: "no_key",
      });
      return NextResponse.json(
        {
          error: "provider key unavailable",
          code: "NO_PROVIDER_KEY",
          credential_source: credentialSource,
          receipt,
        },
        {
          status: 400,
          headers: { "X-Muthur-Provider-Receipt": formatProviderReceiptHeader(receipt) },
        },
      );
    }

    const upstream = await fetchWithTimeout(
      url,
      {
        method: "GET",
        headers: { Authorization: `Bearer ${resolvedApiKey}` },
      },
      MODEL_LIST_TIMEOUT_MS,
    );

    if (!upstream.ok) {
      const reason = classifyProviderAuthFailure(upstream.status, await upstream.text().catch(() => ""));
      const receipt = buildProviderReceipt({
        provider: providerId,
        credentialSource,
        auth: "failed",
        reason,
      });
      return NextResponse.json(
        {
          error: "upstream",
          status: upstream.status,
          credential_source: credentialSource,
          reason,
          receipt,
        },
        {
          status: upstream.status === 401 || upstream.status === 403 ? 401 : 502,
          headers: { "X-Muthur-Provider-Receipt": formatProviderReceiptHeader(receipt) },
        },
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
    const receipt = buildProviderReceipt({
      provider: providerId,
      credentialSource,
      auth: "success",
      modelsAvailable: data.length,
    });

    return NextResponse.json(
      {
        data,
        credential_source: credentialSource,
        model_count: data.length,
        response_status: upstream.status,
        receipt,
      },
      { headers: { "X-Muthur-Provider-Receipt": formatProviderReceiptHeader(receipt) } },
    );
  } catch (err) {
    console.error("[api/cyberdeck-models]", err);
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
}
