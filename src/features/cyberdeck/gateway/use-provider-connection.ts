"use client";

import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type Dispatch,
  type MutableRefObject,
  type SetStateAction,
} from "react";
import { toast } from "sonner";
import type { ChatMessage } from "@/features/cyberdeck/muthur/muthur-chat-types";
import {
  gatewayKeySysMessage,
  isGatewayKeySysTip,
} from "@/features/cyberdeck/gateway/gateway-message-render";
import { ENABLE_MODEL_PROBE } from "@/lib/cyberdeck/automation-config";
import {
  PROVIDER_CLICK_ESCALATION_MS,
  PROVIDER_LINK_REFRESH_COOLDOWN_MS,
  loadProviderModelsCache,
  providerModelsCacheKey,
  saveProviderModelsCache,
  type ProviderModelRow,
} from "@/lib/cyberdeck/provider-connection";
import { appendMuthurDiagnosticEntry } from "@/lib/muthur-core/muthur-diagnostics-channel";
import type { MuthurDiagnosticsState } from "@/lib/muthur-core/muthur-diagnostics-channel";
import { probeCyberdeckModel } from "@/lib/muthur-core/muthur-chat-client";
import {
  CLIENT_BAKED_PROVIDER_KEYS,
  formatProviderReceiptDiagnostic,
  providerHasUsableCredentials,
  resolveOutboundProviderCredentials,
  resolveProviderConnectionLabel,
} from "@/lib/provider-credentials";
import {
  gatewayProviderToEnvKey,
  persistDesktopProviderEnv,
} from "@/lib/electron/desktop-provider-env.client";
import { playDeckSystemSound } from "@/features/cyberdeck/runtime/defer-deck-audio";

export const CYBERDECK_PROVIDER_IDS = ["opencode", "openrouter", "openai"] as const;

export type CyberdeckProviderId = (typeof CYBERDECK_PROVIDER_IDS)[number];

export const CYBERDECK_PROVIDER_LABELS: Record<CyberdeckProviderId, string> = {
  opencode: "OPENCODE ZEN",
  openrouter: "OPENROUTER",
  openai: "OPENAI",
};

export function cyberdeckProviderDisplayName(providerId: string): string {
  if ((CYBERDECK_PROVIDER_IDS as readonly string[]).includes(providerId)) {
    return CYBERDECK_PROVIDER_LABELS[providerId as CyberdeckProviderId];
  }
  return providerId.toUpperCase();
}

const DEFAULT_CLIENT_PROVIDER_KEYS = CLIENT_BAKED_PROVIDER_KEYS;
const MODEL_PROBE_MIN_INTERVAL_MS = 15_000;
const PROVIDER_RATE_LIMIT_COOLDOWN_MS = 90_000;

type ModelFetchStatus = "idle" | "retrieving" | "invalid-key" | "error" | "ready";

function providerHasClientKey(
  providerId: string,
  providerKeys: Record<string, string>,
  defaultKeyAvailableByProvider: Record<string, boolean>,
): boolean {
  return providerHasUsableCredentials(providerId, providerKeys, defaultKeyAvailableByProvider);
}

export function hasAnyProviderClientKey(
  providerKeys: Record<string, string>,
  defaultKeyAvailableByProvider: Record<string, boolean>,
): boolean {
  return CYBERDECK_PROVIDER_IDS.some((id) =>
    providerHasClientKey(id, providerKeys, defaultKeyAvailableByProvider),
  );
}

export type UseProviderConnectionOptions = {
  setMessages: (updater: SetStateAction<ChatMessage[]>) => void;
  setMuthurDiagnostics: Dispatch<SetStateAction<MuthurDiagnosticsState>>;
  playModelTestErrorSound: (line: string) => void;
};

export function useProviderConnection({
  setMessages,
  setMuthurDiagnostics,
  playModelTestErrorSound,
}: UseProviderConnectionOptions) {
  const [activeProvider, setActiveProvider] = useState<string>("opencode");
  const [providerKeys, setProviderKeys] = useState<Record<string, string>>({});
  const [didHydrateProviderState, setDidHydrateProviderState] = useState(false);
  const [providerConfigHydrated, setProviderConfigHydrated] = useState(false);
  const [defaultKeyAvailableByProvider, setDefaultKeyAvailableByProvider] = useState<Record<string, boolean>>({
    opencode: false,
    openrouter: false,
    openai: false,
  });
  const [modelList, setModelList] = useState<{ id: string }[]>([]);
  const [modelCacheByProvider, setModelCacheByProvider] = useState<Record<string, ProviderModelRow[]>>({});
  const [credentialReplaceProvider, setCredentialReplaceProvider] = useState<string | null>(null);
  const [gatewayKeyDraft, setGatewayKeyDraft] = useState("");
  const [modelByProvider, setModelByProvider] = useState<Record<string, string>>({});
  const [modelFetchStatusByProvider, setModelFetchStatusByProvider] = useState<Record<string, ModelFetchStatus>>({
    opencode: "idle",
    openrouter: "idle",
    openai: "idle",
  });
  const [rateLimitedProviders, setRateLimitedProviders] = useState<Set<string>>(new Set());
  const [modelHealthByProvider, setModelHealthByProvider] = useState<Record<string, Record<string, string>>>({
    opencode: {},
    openrouter: {},
    openai: {},
  });
  const [verifiedProviders, setVerifiedProviders] = useState<Record<string, boolean>>({
    opencode: false,
    openrouter: false,
    openai: false,
  });
  const [probeInFlightByProvider, setProbeInFlightByProvider] = useState<Record<string, string>>({
    opencode: "",
    openrouter: "",
    openai: "",
  });

  const modelProbeAbortRef = useRef<AbortController | null>(null);
  const modelProbeCacheRef = useRef<Record<string, { status: string; at: number }>>({});
  const modelProbeLastAtRef = useRef<Record<string, number>>({});
  const providerRateLimitUntilRef = useRef<Record<string, number>>({});
  const providerClickTrackerRef = useRef({ providerId: "", count: 0, lastClickAt: 0 });
  const providerRefreshAtRef = useRef<Record<string, number>>({});
  const providerBootstrapRef = useRef(false);

  const providers = useMemo(
    () =>
      [
        { id: "opencode" as const, name: CYBERDECK_PROVIDER_LABELS.opencode },
        { id: "openrouter" as const, name: CYBERDECK_PROVIDER_LABELS.openrouter },
        { id: "openai" as const, name: CYBERDECK_PROVIDER_LABELS.openai },
      ] as const,
    [],
  );

  const modelID = modelByProvider[activeProvider] || "";
  const providerModelFetchStatus = modelFetchStatusByProvider[activeProvider] || "idle";
  const scanActivityActive =
    Boolean(probeInFlightByProvider[activeProvider]) || providerModelFetchStatus === "retrieving";
  const hasProviderAuth = providerHasClientKey(activeProvider, providerKeys, defaultKeyAvailableByProvider);
  const providerLinkReady = providerModelFetchStatus === "ready";
  const isConnected = hasProviderAuth && providerLinkReady && Boolean(modelID);
  const connectionState: "offline" | "connecting" | "connected" = scanActivityActive
    ? "connecting"
    : isConnected
      ? "connected"
      : "offline";
  const providerConnectionLabel = resolveProviderConnectionLabel({
    hasAuth: hasProviderAuth,
    rateLimited: rateLimitedProviders.has(activeProvider),
    fetchStatus: providerModelFetchStatus,
  });

  const selectProvider = useCallback((id: string) => {
    setActiveProvider(id);
    try {
      localStorage.setItem("active_provider", id);
    } catch {
      /* ignore */
    }
    playDeckSystemSound("chirp", 0.05);
  }, []);

  const setModelHealth = useCallback((provider: string, model: string, status: string) => {
    setModelHealthByProvider((prev) => ({
      ...prev,
      [provider]: { ...(prev[provider] || {}), [model]: status },
    }));
  }, []);

  const probeSelectedModel = useCallback(
    async (provider: string, model: string, key: string) => {
      if (!provider || !model || !ENABLE_MODEL_PROBE) return;

      const cacheKey = `${provider}::${model}`;
      const cached = modelProbeCacheRef.current[cacheKey];
      if (cached && Date.now() - cached.at < 120_000) {
        setModelHealth(provider, model, cached.status);
        return;
      }

      const lastProbeAt = modelProbeLastAtRef.current[provider] || 0;
      if (Date.now() - lastProbeAt < MODEL_PROBE_MIN_INTERVAL_MS) {
        return;
      }
      modelProbeLastAtRef.current[provider] = Date.now();

      if (modelProbeAbortRef.current) {
        modelProbeAbortRef.current.abort();
      }
      const abortCtl = new AbortController();
      modelProbeAbortRef.current = abortCtl;

      setProbeInFlightByProvider((prev) => ({ ...prev, [provider]: model }));
      setModelHealth(provider, model, "testing");
      try {
        const probe = await probeCyberdeckModel({ provider, apiKey: key, model }, abortCtl.signal);
        const data = probe.data;
        const httpStatus = data.status ?? probe.status;
        const modelRateLimited = httpStatus === 429;

        if (!probe.ok || data.ok === false) {
          const failHealth = modelRateLimited ? "amber" : "grey";
          if (modelRateLimited) {
            providerRateLimitUntilRef.current[provider] = Date.now() + PROVIDER_RATE_LIMIT_COOLDOWN_MS;
          } else if (httpStatus === 502 || httpStatus === 503) {
            setRateLimitedProviders((prev) => new Set(prev).add(provider));
          }
          const line = `MODEL_TEST ${provider.toUpperCase()}/${model}: HTTP_${httpStatus}${
            modelRateLimited
              ? " // MODEL_RATE_LIMIT"
              : httpStatus === 502 || httpStatus === 503
                ? " // OPERATOR_ACTION_REQUIRED"
                : " // FAILURE"
          }`;
          playModelTestErrorSound(line);
          setModelHealth(provider, model, failHealth);
          modelProbeCacheRef.current[cacheKey] = { status: failHealth, at: Date.now() };
          if (!modelRateLimited) {
            setVerifiedProviders((prev) => ({ ...prev, [provider]: false }));
          }
          setMessages((prev) => [
            ...prev,
            {
              role: "system",
              text: line,
            },
          ]);
          return;
        }

        const valid = Boolean(data.valid);
        const health = valid ? "green" : "amber";
        setModelHealth(provider, model, health);
        modelProbeCacheRef.current[cacheKey] = { status: health, at: Date.now() };
        setRateLimitedProviders((prev) => {
          const next = new Set(prev);
          next.delete(provider);
          return next;
        });
        delete providerRateLimitUntilRef.current[provider];
        const isVerified = valid || provider === "opencode";
        setVerifiedProviders((prev) => ({ ...prev, [provider]: isVerified }));
        const line = valid
          ? `MODEL_TEST ${provider.toUpperCase()}/${model}: VALID_RESPONSE`
          : `MODEL_TEST ${provider.toUpperCase()}/${model}: EMPTY_PROBE // transport OK, content empty`;
        playModelTestErrorSound(line);
        setMessages((prev) => [
          ...prev,
          {
            role: "system",
            text: line,
          },
        ]);
      } catch (err) {
        if (abortCtl.signal.aborted) return;
        playModelTestErrorSound(`MODEL_TEST ${provider.toUpperCase()}/${model}: FAILURE`);
        setModelHealth(provider, model, "grey");
        setVerifiedProviders((prev) => ({ ...prev, [provider]: false }));
        setMessages((prev) => [
          ...prev,
          {
            role: "system",
            text: `MODEL_TEST ${provider.toUpperCase()}/${model}: ${String((err as Error)?.message || err)}`,
          },
        ]);
      } finally {
        if (modelProbeAbortRef.current === abortCtl) {
          modelProbeAbortRef.current = null;
        }
        setProbeInFlightByProvider((prev) => {
          if (prev[provider] !== model) return prev;
          return { ...prev, [provider]: "" };
        });
      }
    },
    [playModelTestErrorSound, setMessages, setModelHealth, setRateLimitedProviders, setVerifiedProviders],
  );

  const fetchModelsForProvider = useCallback(
    async (provider: string, options?: { force?: boolean }) => {
      const force = options?.force === true;
      if (rateLimitedProviders.has(provider)) return;
      const outbound = resolveOutboundProviderCredentials(provider, providerKeys);

      const cachedFromState = modelCacheByProvider[provider];
      const cached =
        cachedFromState && cachedFromState.length > 0
          ? cachedFromState
          : loadProviderModelsCache(provider);

      // Never treat a stale model cache as "CONNECTED" when we have no key.
      if (!outbound.apiKey && !defaultKeyAvailableByProvider[provider]) {
        setModelFetchStatusByProvider((prev) => ({ ...prev, [provider]: "idle" }));
        setVerifiedProviders((prev) => ({ ...prev, [provider]: false }));
        if (activeProvider === provider) {
          setModelList(cached.length > 0 ? cached : []);
        }
        return;
      }

      if (!force && cached.length > 0) {
        setModelCacheByProvider((prev) => ({ ...prev, [provider]: cached }));
        setModelFetchStatusByProvider((prev) => ({ ...prev, [provider]: "ready" }));
        setVerifiedProviders((prev) => ({ ...prev, [provider]: true }));
        setModelList((prevList) => (activeProvider === provider ? cached : prevList));
        return;
      }

      setModelFetchStatusByProvider((prev) => ({ ...prev, [provider]: "retrieving" }));

      try {
        const res = await fetch("/api/cyberdeck-models", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            provider,
            apiKey: outbound.apiKey || undefined,
          }),
        });
        const receiptHeader = res.headers.get("x-muthur-provider-receipt");
        if (receiptHeader) {
          try {
            const receipt = JSON.parse(receiptHeader) as {
              provider: string;
              credential_source: string;
              auth: string;
              reason?: string;
              model?: string;
            };
            setMuthurDiagnostics((current) =>
              appendMuthurDiagnosticEntry(current, formatProviderReceiptDiagnostic(receipt)),
            );
          } catch {
            /* ignore malformed receipt */
          }
        }
        if (!res.ok) {
          const errJson = (await res.json().catch(() => ({}))) as {
            authSource?: "user" | "default" | "none";
            credential_source?: string;
            code?: string;
            reason?: string;
          };
          if (
            errJson.credential_source === "none" ||
            errJson.authSource === "none" ||
            errJson.code === "NO_PROVIDER_KEY" ||
            errJson.reason === "no_key"
          ) {
            setDefaultKeyAvailableByProvider((prev) => ({ ...prev, [provider]: false }));
            setModelFetchStatusByProvider((prev) => ({ ...prev, [provider]: "idle" }));
            return;
          }
          if (res.status === 429 || res.status === 502 || res.status === 503) {
            if (res.status === 429) {
              providerRateLimitUntilRef.current[provider] = Date.now() + PROVIDER_RATE_LIMIT_COOLDOWN_MS;
            } else {
              setRateLimitedProviders((prev) => new Set(prev).add(provider));
            }
            setModelFetchStatusByProvider((prev) => ({ ...prev, [provider]: "error" }));
            setVerifiedProviders((prev) => ({ ...prev, [provider]: false }));
            setMessages((prev) => [
              ...prev,
              {
                role: "system",
                text: `UPLINK_HALTED // ${provider.toUpperCase()} // HTTP_${res.status} // OPERATOR_ACTION_REQUIRED`,
              },
            ]);
            return;
          }
          const invalid = res.status === 401 || res.status === 403;
          setModelFetchStatusByProvider((prev) => ({
            ...prev,
            [provider]: invalid ? "invalid-key" : "error",
          }));
          setVerifiedProviders((prev) => ({ ...prev, [provider]: false }));
          if (invalid && providerKeys[provider]) {
            setProviderKeys((prev) => {
              const next = { ...prev };
              delete next[provider];
              return next;
            });
            localStorage.removeItem(`key_${provider}`);
            setModelCacheByProvider((prev) => {
              const next = { ...prev };
              delete next[provider];
              return next;
            });
            localStorage.removeItem(providerModelsCacheKey(provider));
            setMessages((prev) => [
              ...prev,
              { role: "system", text: `INVALID_KEY // ${provider.toUpperCase()} AUTH_REJECTED` },
            ]);
          }
          return;
        }
        const json = (await res.json()) as {
          data?: { id: string }[];
          authSource?: "user" | "default";
          credential_source?: string;
        };
        const raw = Array.isArray(json.data) ? json.data : [];
        const credentialSource = json.credential_source ?? json.authSource;
        setDefaultKeyAvailableByProvider((prev) => ({
          ...prev,
          [provider]:
            credentialSource === "env" || credentialSource === "session_key" || credentialSource === "default",
        }));
        setModelCacheByProvider((prev) => ({ ...prev, [provider]: raw }));
        saveProviderModelsCache(provider, raw);
        setModelFetchStatusByProvider((prev) => ({ ...prev, [provider]: "ready" }));
        setVerifiedProviders((prev) => ({ ...prev, [provider]: true }));
        setModelList((prevList) => (activeProvider === provider ? raw : prevList));
        setModelByProvider((prev) => {
          const current = prev[provider] || "";
          const hasCurrent = current && raw.some((m) => m.id === current);
          const nextModel = hasCurrent ? current : raw[0]?.id || "";
          if (nextModel) {
            localStorage.setItem(`ascii_model_${provider}`, nextModel);
          }
          return { ...prev, [provider]: nextModel };
        });
      } catch {
        setModelFetchStatusByProvider((prev) => ({ ...prev, [provider]: "error" }));
        setVerifiedProviders((prev) => ({ ...prev, [provider]: false }));
        setModelList((prevList) => (activeProvider === provider ? [] : prevList));
      }
    },
    [
      activeProvider,
      defaultKeyAvailableByProvider,
      modelCacheByProvider,
      providerKeys,
      rateLimitedProviders,
      setMessages,
      setMuthurDiagnostics,
    ],
  );

  const providerHasKey = useCallback(
    (providerId: string) =>
      providerHasClientKey(providerId, providerKeys, defaultKeyAvailableByProvider),
    [defaultKeyAvailableByProvider, providerKeys],
  );

  const syncModelListFromCache = useCallback(
    (providerId: string) => {
      const cached =
        modelCacheByProvider[providerId]?.length
          ? modelCacheByProvider[providerId]
          : loadProviderModelsCache(providerId);
      if (cached.length > 0) {
        setModelList(cached);
        setModelCacheByProvider((prev) =>
          prev[providerId]?.length ? prev : { ...prev, [providerId]: cached },
        );
        return;
      }
      setModelList([]);
      if (!rateLimitedProviders.has(providerId)) {
        void fetchModelsForProvider(providerId);
      }
    },
    [fetchModelsForProvider, modelCacheByProvider, rateLimitedProviders],
  );

  const refreshProviderModelsDebounced = useCallback(
    (providerId: string) => {
      const now = Date.now();
      const last = providerRefreshAtRef.current[providerId] || 0;
      if (now - last < PROVIDER_LINK_REFRESH_COOLDOWN_MS) {
        toast.info("Refresh cooldown — wait before refreshing again.");
        return;
      }
      providerRefreshAtRef.current[providerId] = now;
      if (!providerHasKey(providerId)) return;
      void fetchModelsForProvider(providerId, { force: true });
    },
    [fetchModelsForProvider, providerHasKey],
  );

  const handleProviderClick = useCallback(
    (id: string) => {
      const now = Date.now();
      const tracker = providerClickTrackerRef.current;
      const sameBurst =
        tracker.providerId === id && now - tracker.lastClickAt < PROVIDER_CLICK_ESCALATION_MS;

      if (id !== activeProvider) {
        tracker.providerId = id;
        tracker.count = 1;
        tracker.lastClickAt = now;
        setCredentialReplaceProvider(null);
        selectProvider(id);
        syncModelListFromCache(id);
        return;
      }

      if (!sameBurst) {
        tracker.providerId = id;
        tracker.count = 1;
        tracker.lastClickAt = now;
        return;
      }

      tracker.count += 1;
      tracker.lastClickAt = now;

      if (tracker.count === 2) {
        refreshProviderModelsDebounced(id);
        return;
      }
      if (tracker.count >= 3) {
        setCredentialReplaceProvider(id);
        setGatewayKeyDraft("");
      }
    },
    [activeProvider, refreshProviderModelsDebounced, selectProvider, syncModelListFromCache],
  );

  const submitGatewayKey = useCallback(async () => {
    const trimmed = gatewayKeyDraft.trim();
    if (!trimmed) return;
    const provider = (credentialReplaceProvider ?? activeProvider) as CyberdeckProviderId;
    setProviderKeys((prev) => ({ ...prev, [provider]: trimmed }));
    try {
      localStorage.setItem(`key_${provider}`, trimmed);
    } catch {
      /* ignore */
    }
    if ((CYBERDECK_PROVIDER_IDS as readonly string[]).includes(provider)) {
      void persistDesktopProviderEnv({
        [gatewayProviderToEnvKey(provider)]: trimmed,
      });
    }
    setCredentialReplaceProvider(null);
    setGatewayKeyDraft("");
    setRateLimitedProviders((prev) => {
      if (!prev.has(provider)) return prev;
      const next = new Set(prev);
      next.delete(provider);
      return next;
    });
    await fetchModelsForProvider(provider, { force: true });
  }, [activeProvider, credentialReplaceProvider, fetchModelsForProvider, gatewayKeyDraft]);

  const activateModelById = useCallback(
    (modelId: string) => {
      const key = providerKeys[activeProvider];
      if (!modelId) return;
      setModelByProvider((prev) => ({ ...prev, [activeProvider]: modelId }));
      try {
        localStorage.setItem(`ascii_model_${activeProvider}`, modelId);
      } catch {
        /* ignore */
      }
      playDeckSystemSound("click", 0.02);
      if (ENABLE_MODEL_PROBE) {
        void probeSelectedModel(activeProvider, modelId, key || "");
      }
    },
    [activeProvider, probeSelectedModel, providerKeys],
  );

  useEffect(() => {
    const nextKeys: Record<string, string> = {};
    const caches: Record<string, ProviderModelRow[]> = {};
    const statusUpdates: Record<string, ModelFetchStatus> = {};
    const verifiedUpdates: Record<string, boolean> = {};
    for (const id of CYBERDECK_PROVIDER_IDS) {
      const stored = localStorage.getItem(`key_${id}`);
      const fallback = DEFAULT_CLIENT_PROVIDER_KEYS[id] || "";
      const value = (stored || fallback || "").trim();
      if (value) nextKeys[id] = value;
      const cached = loadProviderModelsCache(id);
      if (cached.length > 0) {
        caches[id] = cached;
        if (value) {
          statusUpdates[id] = "ready";
          verifiedUpdates[id] = true;
        }
      }
    }
    setProviderKeys(nextKeys);
    setModelCacheByProvider(caches);
    if (Object.keys(statusUpdates).length > 0) {
      setModelFetchStatusByProvider((prev) => ({ ...prev, ...statusUpdates }));
      setVerifiedProviders((prev) => ({ ...prev, ...verifiedUpdates }));
    }
    const ap = localStorage.getItem("active_provider");
    const resolvedActive =
      ap && (CYBERDECK_PROVIDER_IDS as readonly string[]).includes(ap) ? ap : "opencode";
    if (ap && (CYBERDECK_PROVIDER_IDS as readonly string[]).includes(ap)) setActiveProvider(ap);
    setModelByProvider((prev) => {
      const n = { ...prev };
      for (const id of CYBERDECK_PROVIDER_IDS) {
        const m = localStorage.getItem(`ascii_model_${id}`);
        if (m) n[id] = m;
      }
      return n;
    });
    const bootModels = caches[resolvedActive];
    if (bootModels?.length) setModelList(bootModels);

    const bakedAvailable: Partial<Record<(typeof CYBERDECK_PROVIDER_IDS)[number], boolean>> = {};
    for (const id of CYBERDECK_PROVIDER_IDS) {
      if (DEFAULT_CLIENT_PROVIDER_KEYS[id]) bakedAvailable[id] = true;
    }
    if (Object.keys(bakedAvailable).length > 0) {
      setDefaultKeyAvailableByProvider((prev) => ({ ...prev, ...bakedAvailable }));
    }

    void fetch("/api/provider-config")
      .then((res) => (res.ok ? res.json() : null))
      .then((data: { configured?: Record<string, boolean> } | null) => {
        if (!data?.configured) return;
        setDefaultKeyAvailableByProvider((prev) => {
          const next = { ...prev };
          for (const id of CYBERDECK_PROVIDER_IDS) {
            if (data.configured?.[id]) next[id] = true;
          }
          return next;
        });
      })
      .catch(() => {
        /* offline / dev without route */
      })
      .finally(() => {
        setProviderConfigHydrated(true);
      });

    setDidHydrateProviderState(true);
  }, []);

  useEffect(() => {
    if (!didHydrateProviderState || !providerConfigHydrated) return;
    if (providerHasClientKey(activeProvider, providerKeys, defaultKeyAvailableByProvider)) return;
    const tip = gatewayKeySysMessage(activeProvider);
    setMessages((prev) => {
      const last = prev[prev.length - 1];
      if (last?.role === "system" && last.text === tip) return prev;
      return [...prev, { role: "system", text: tip }];
    });
  }, [activeProvider, defaultKeyAvailableByProvider, didHydrateProviderState, providerConfigHydrated, providerKeys, setMessages]);

  useEffect(() => {
    if (!didHydrateProviderState || !hasProviderAuth) return;
    setMessages((prev) => {
      const next = prev.filter((m) => !(m.role === "system" && isGatewayKeySysTip(m.text)));
      return next.length === prev.length ? prev : next;
    });
  }, [didHydrateProviderState, hasProviderAuth, setMessages]);

  useEffect(() => {
    if (!didHydrateProviderState || providerBootstrapRef.current) return;
    providerBootstrapRef.current = true;
    const cached =
      modelCacheByProvider[activeProvider]?.length
        ? modelCacheByProvider[activeProvider]
        : loadProviderModelsCache(activeProvider);
    if (cached.length > 0) {
      setModelList(cached);
      return;
    }
    void fetchModelsForProvider(activeProvider);
  }, [activeProvider, didHydrateProviderState, fetchModelsForProvider, modelCacheByProvider]);

  return {
    activeProvider,
    providerKeys,
    setProviderKeys,
    modelID,
    modelList,
    providers,
    hasProviderAuth,
    isConnected,
    connectionState,
    providerConnectionLabel,
    providerModelFetchStatus,
    scanActivityActive,
    credentialReplaceProvider,
    setCredentialReplaceProvider,
    gatewayKeyDraft,
    setGatewayKeyDraft,
    modelFetchStatusByProvider,
    rateLimitedProviders,
    modelHealthByProvider,
    probeInFlightByProvider,
    defaultKeyAvailableByProvider,
    didHydrateProviderState,
    providerConfigHydrated,
    selectProvider,
    handleProviderClick,
    submitGatewayKey,
    activateModelById,
    fetchModelsForProvider,
    providerHasKey,
    setModelHealth,
    setVerifiedProviders,
    setModelFetchStatusByProvider,
    setRateLimitedProviders,
    providerRateLimitUntilRef: providerRateLimitUntilRef as MutableRefObject<Record<string, number>>,
  };
}
