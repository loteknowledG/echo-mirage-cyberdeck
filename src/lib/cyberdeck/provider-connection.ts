export const PROVIDER_LINK_REFRESH_COOLDOWN_MS = 4000;
export const PROVIDER_CLICK_ESCALATION_MS = 2500;

export type ProviderLinkStatus =
  | "idle"
  | "retrieving"
  | "ready"
  | "invalid-key"
  | "error";

export type ProviderVisualTone = "gray" | "green" | "amber" | "red";

export type ProviderModelRow = { id: string };

export function providerModelsCacheKey(providerId: string): string {
  return `provider_models_${providerId}`;
}

export function loadProviderModelsCache(providerId: string): ProviderModelRow[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(providerModelsCacheKey(providerId));
    if (!raw) return [];
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) return [];
    return parsed
      .map((entry) => ({ id: String((entry as { id?: string })?.id || "").trim() }))
      .filter((entry) => entry.id.length > 0);
  } catch {
    return [];
  }
}

export function saveProviderModelsCache(providerId: string, models: ProviderModelRow[]): void {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(providerModelsCacheKey(providerId), JSON.stringify(models));
  } catch {
    /* ignore quota */
  }
}

export function resolveProviderVisualTone(options: {
  hasKey: boolean;
  status: ProviderLinkStatus;
  rateLimited: boolean;
}): ProviderVisualTone {
  const { hasKey, status, rateLimited } = options;
  if (!hasKey) return "gray";
  if (status === "retrieving" || rateLimited) return "amber";
  if (status === "invalid-key" || status === "error") return "red";
  if (status === "ready") return "green";
  return "gray";
}

export function providerToneColors(tone: ProviderVisualTone): {
  color: string;
  shadow: string;
  hoverColor: string;
  hoverShadow: string;
} {
  switch (tone) {
    case "green":
      return {
        color: "#86efac",
        shadow: "0 0 8px rgba(134, 239, 172, 0.28)",
        hoverColor: "#a7f3c0",
        hoverShadow: "0 0 10px rgba(134, 239, 172, 0.35)",
      };
    case "amber":
      return {
        color: "#facc15",
        shadow: "0 0 8px rgba(250, 204, 21, 0.28)",
        hoverColor: "#fde047",
        hoverShadow: "0 0 10px rgba(250, 204, 21, 0.32)",
      };
    case "red":
      return {
        color: "#fb7185",
        shadow: "0 0 8px rgba(251, 113, 133, 0.3)",
        hoverColor: "#fda4af",
        hoverShadow: "0 0 10px rgba(251, 113, 133, 0.35)",
      };
    default:
      return {
        color: "#6a6a6a",
        shadow: "0 0 6px rgba(180, 180, 180, 0.14)",
        hoverColor: "#b0b0b0",
        hoverShadow: "0 0 6px rgba(180, 180, 180, 0.2)",
      };
  }
}
