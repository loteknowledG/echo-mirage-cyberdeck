import { NextRequest, NextResponse } from "next/server";
import { fetchWithTimeout, MODEL_LIST_TIMEOUT_MS } from "@/lib/fetch-with-timeout";
import {
  buildProviderReceipt,
  classifyProviderAuthFailure,
  formatProviderReceiptHeader,
  MODEL_LIST_URL,
  resolveServerProviderCredentials,
} from "@/lib/server/provider-credentials.server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const provider = req.nextUrl.searchParams.get("provider")?.trim() || "openrouter";
  const suppliedKey = req.nextUrl.searchParams.get("apiKey")?.trim() || "";

  const url = MODEL_LIST_URL[provider];
  if (!url) {
    return NextResponse.json({ error: "unsupported provider" }, { status: 400 });
  }

  const { apiKey, credentialSource } = resolveServerProviderCredentials(provider, suppliedKey);
  const configured = credentialSource !== "none";

  if (!apiKey) {
    const receipt = buildProviderReceipt({
      provider,
      credentialSource: "none",
      auth: "failed",
      reason: "no_key",
    });
    return NextResponse.json(
      {
        provider,
        configured: false,
        authenticated: false,
        models_available: 0,
        credential_source: "none",
        reason: "no_key",
        receipt,
      },
      { headers: { "X-Muthur-Provider-Receipt": formatProviderReceiptHeader(receipt) } },
    );
  }

  try {
    const upstream = await fetchWithTimeout(
      url,
      { method: "GET", headers: { Authorization: `Bearer ${apiKey}` } },
      MODEL_LIST_TIMEOUT_MS,
    );

    if (!upstream.ok) {
      const reason = classifyProviderAuthFailure(upstream.status, await upstream.text().catch(() => ""));
      const receipt = buildProviderReceipt({
        provider,
        credentialSource,
        auth: "failed",
        reason,
      });
      return NextResponse.json(
        {
          provider,
          configured,
          authenticated: false,
          models_available: 0,
          credential_source: credentialSource,
          reason,
          receipt,
        },
        { headers: { "X-Muthur-Provider-Receipt": formatProviderReceiptHeader(receipt) } },
      );
    }

    const json = (await upstream.json()) as { data?: unknown[] };
    const count = Array.isArray(json.data) ? json.data.length : 0;
    const receipt = buildProviderReceipt({
      provider,
      credentialSource,
      auth: "success",
      modelsAvailable: count,
    });

    return NextResponse.json(
      {
        provider,
        configured: true,
        authenticated: true,
        models_available: count,
        credential_source: credentialSource,
        receipt,
      },
      { headers: { "X-Muthur-Provider-Receipt": formatProviderReceiptHeader(receipt) } },
    );
  } catch {
    const receipt = buildProviderReceipt({
      provider,
      credentialSource,
      auth: "failed",
      reason: "provider_unavailable",
    });
    return NextResponse.json(
      {
        provider,
        configured,
        authenticated: false,
        models_available: 0,
        credential_source: credentialSource,
        reason: "provider_unavailable",
        receipt,
      },
      { headers: { "X-Muthur-Provider-Receipt": formatProviderReceiptHeader(receipt) } },
    );
  }
}
