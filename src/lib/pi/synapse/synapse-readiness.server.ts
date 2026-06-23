import {
  isSynapsePreferredOnWindows,
  readSynapseBearerToken,
  SYNAPSE_HEALTH_URL,
} from "./synapse-config.server";

type SynapseHealth = {
  ok?: boolean;
  tool_count?: number;
  version?: string;
};

type CachedReadiness = {
  checkedAtMs: number;
  ready: boolean;
  detail?: string;
};

const CACHE_TTL_MS = 5_000;
let cachedReadiness: CachedReadiness | null = null;

export async function probeSynapseDaemonHealth(): Promise<{
  ready: boolean;
  detail?: string;
}> {
  if (!isSynapsePreferredOnWindows()) {
    return { ready: false, detail: "synapse_not_preferred_on_this_platform" };
  }

  const token = readSynapseBearerToken();
  if (!token) {
    return { ready: false, detail: "synapse_bearer_token_missing" };
  }

  try {
    const response = await fetch(SYNAPSE_HEALTH_URL, {
      headers: { Authorization: `Bearer ${token}` },
      cache: "no-store",
    });
    if (!response.ok) {
      return {
        ready: false,
        detail: `synapse_health_http_${response.status}`,
      };
    }
    const health = (await response.json()) as SynapseHealth;
    if (!health.ok) {
      return { ready: false, detail: "synapse_health_not_ok" };
    }
    return {
      ready: true,
      detail: `synapse_ok tools=${health.tool_count ?? "?"} version=${health.version ?? "?"}`,
    };
  } catch (error) {
    return {
      ready: false,
      detail: error instanceof Error ? error.message : "synapse_health_fetch_failed",
    };
  }
}

export async function isSynapseReady(force = false): Promise<boolean> {
  const now = Date.now();
  if (
    !force &&
    cachedReadiness &&
    now - cachedReadiness.checkedAtMs < CACHE_TTL_MS
  ) {
    return cachedReadiness.ready;
  }

  const result = await probeSynapseDaemonHealth();
  cachedReadiness = {
    checkedAtMs: now,
    ready: result.ready,
    detail: result.detail,
  };
  return result.ready;
}

export function getCachedSynapseReadinessDetail(): string | undefined {
  return cachedReadiness?.detail;
}

export function clearSynapseReadinessCacheForTests(): void {
  cachedReadiness = null;
}
