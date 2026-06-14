/**
 * L-CONN-001 provider credential resolution probes.
 * Run: pnpm probe:provider-credentials
 */
import assert from "node:assert/strict";

import { resolveOutboundProviderCredentials } from "../src/lib/provider-credentials";
import {
  buildProviderReceipt,
  classifyProviderAuthFailure,
  formatProviderReceiptText,
  resolveServerProviderCredentials,
} from "../src/lib/server/provider-credentials.server";

function withEnv(
  vars: Record<string, string | undefined>,
  run: () => void,
): void {
  const prior: Record<string, string | undefined> = {};
  for (const [key, value] of Object.entries(vars)) {
    prior[key] = process.env[key];
    if (value === undefined) delete process.env[key];
    else process.env[key] = value;
  }
  try {
    run();
  } finally {
    for (const [key, value] of Object.entries(prior)) {
      if (value === undefined) delete process.env[key];
      else process.env[key] = value;
    }
  }
}

function testServerEnvFallback(): void {
  withEnv(
    {
      OPENROUTER_API_KEY: "sk-or-env-test",
      NEXT_PUBLIC_OPENROUTER_API_KEY: undefined,
    },
    () => {
      const resolved = resolveServerProviderCredentials("openrouter", "");
      assert.equal(resolved.apiKey, "sk-or-env-test");
      assert.equal(resolved.credentialSource, "env");
    },
  );
  console.log("  ok server env fallback");
}

function testServerPublicEnvFallback(): void {
  withEnv(
    {
      OPENROUTER_API_KEY: undefined,
      NEXT_PUBLIC_OPENROUTER_API_KEY: "sk-or-public-test",
    },
    () => {
      const resolved = resolveServerProviderCredentials("openrouter", "");
      assert.equal(resolved.apiKey, "sk-or-public-test");
      assert.equal(resolved.credentialSource, "session_key");
    },
  );
  console.log("  ok server public env fallback");
}

function testUiSavedKeyOverridesEnv(): void {
  withEnv({ OPENROUTER_API_KEY: "sk-or-env-test" }, () => {
    const resolved = resolveServerProviderCredentials("openrouter", "sk-or-user-test");
    assert.equal(resolved.apiKey, "sk-or-user-test");
    assert.equal(resolved.credentialSource, "ui_saved_key");
  });
  console.log("  ok ui_saved_key precedence");
}

function testClientOutboundMatchesServerEnvKey(): void {
  withEnv({ OPENROUTER_API_KEY: "sk-or-env-test" }, () => {
    const client = resolveOutboundProviderCredentials("openrouter", {});
    const server = resolveServerProviderCredentials("openrouter", client.apiKey);
    assert.equal(server.apiKey, "sk-or-env-test");
    assert.equal(server.credentialSource, "env");
  });
  console.log("  ok client/server credential path alignment");
}

function testNoKeyReceipt(): void {
  withEnv({ OPENROUTER_API_KEY: undefined, NEXT_PUBLIC_OPENROUTER_API_KEY: undefined }, () => {
    const resolved = resolveServerProviderCredentials("openrouter", "");
    assert.equal(resolved.credentialSource, "none");
    const receipt = buildProviderReceipt({
      provider: "openrouter",
      credentialSource: "none",
      auth: "failed",
      reason: "no_key",
    });
    assert.match(formatProviderReceiptText(receipt), /reason=no_key/);
  });
  console.log("  ok no_key receipt");
}

function testInvalidKeyClassification(): void {
  assert.equal(classifyProviderAuthFailure(401, "Invalid API key"), "invalid_api_key");
  assert.equal(classifyProviderAuthFailure(429, "rate limit"), "quota_exceeded");
  assert.equal(classifyProviderAuthFailure(503, ""), "provider_unavailable");
  console.log("  ok auth failure classification");
}

function testProviderIsolation(): void {
  withEnv(
    {
      OPENROUTER_API_KEY: "sk-or-only",
      OPENAI_API_KEY: "sk-openai-only",
      OPENCODE_API_KEY: "sk-opencode-only",
    },
    () => {
      assert.equal(resolveServerProviderCredentials("openrouter", "").apiKey, "sk-or-only");
      assert.equal(resolveServerProviderCredentials("openai", "").apiKey, "sk-openai-only");
      assert.equal(resolveServerProviderCredentials("opencode", "").apiKey, "sk-opencode-only");
    },
  );
  console.log("  ok provider credential isolation");
}

async function main(): Promise<void> {
  console.log("probe:provider-credentials");
  testServerEnvFallback();
  testServerPublicEnvFallback();
  testUiSavedKeyOverridesEnv();
  testClientOutboundMatchesServerEnvKey();
  testNoKeyReceipt();
  testInvalidKeyClassification();
  testProviderIsolation();
  console.log("probe:provider-credentials PASS");
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
