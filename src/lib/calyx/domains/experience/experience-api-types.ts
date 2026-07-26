import type { ExperienceOperationalMetrics } from "./experience-types";

export type ApiResponse<T> =
  | { ok: true; data: T }
  | {
      ok: false;
      error: {
        code: string;
        message: string;
        details?: string[];
      };
    };

export type ExperienceStatusPayload = {
  storageMode: "local" | "calyx";
  calyxStatus: string;
  calyxEnabled: boolean;
  repositoryAvailable: boolean;
  ingestConfigured: boolean;
  traceContractVersion: string;
  metrics: ExperienceOperationalMetrics;
};
