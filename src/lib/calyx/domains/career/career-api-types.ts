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

export type CareerStatusPayload = {
  storageMode: "local" | "calyx";
  calyxStatus: string;
  calyxEnabled: boolean;
  repositoryAvailable: boolean;
};
