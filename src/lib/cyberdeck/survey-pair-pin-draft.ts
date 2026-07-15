export type SurveyPairPinDraft = {
  echoHost: string;
  echoHttpPort: string;
  pin: string;
  echoNodeId: string;
};

const STORAGE_PREFIX = "echo-mirage-survey-pair-draft";

/** Same-tab signal when Mirage/PowerFist pair form updates the Echo endpoint draft. */
export const SURVEY_PAIR_PIN_DRAFT_EVENT = "echo-mirage-survey-pair-pin-draft";

function storageKey(role: "mirage" | "powerfist"): string {
  return `${STORAGE_PREFIX}:${role}`;
}

function notifyPairPinDraftChanged(role: "mirage" | "powerfist"): void {
  if (typeof window === "undefined") return;
  window.dispatchEvent(
    new CustomEvent(SURVEY_PAIR_PIN_DRAFT_EVENT, { detail: { role } }),
  );
}

export function readSurveyPairPinDraft(role: "mirage" | "powerfist"): SurveyPairPinDraft | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.sessionStorage.getItem(storageKey(role));
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<SurveyPairPinDraft>;
    if (typeof parsed !== "object" || parsed === null) return null;
    return {
      echoHost: typeof parsed.echoHost === "string" ? parsed.echoHost : "",
      echoHttpPort: typeof parsed.echoHttpPort === "string" ? parsed.echoHttpPort : "",
      pin: typeof parsed.pin === "string" ? parsed.pin : "",
      echoNodeId: typeof parsed.echoNodeId === "string" ? parsed.echoNodeId : "",
    };
  } catch {
    return null;
  }
}

export function writeSurveyPairPinDraft(
  role: "mirage" | "powerfist",
  draft: SurveyPairPinDraft,
): void {
  if (typeof window === "undefined") return;
  try {
    const hasContent =
      draft.echoHost.trim() ||
      draft.echoHttpPort.trim() ||
      draft.pin.trim() ||
      draft.echoNodeId.trim();
    if (!hasContent) {
      window.sessionStorage.removeItem(storageKey(role));
      notifyPairPinDraftChanged(role);
      return;
    }
    window.sessionStorage.setItem(storageKey(role), JSON.stringify(draft));
    notifyPairPinDraftChanged(role);
  } catch {
    /* ignore quota / private mode */
  }
}

export function clearSurveyPairPinDraft(role: "mirage" | "powerfist"): void {
  if (typeof window === "undefined") return;
  try {
    window.sessionStorage.removeItem(storageKey(role));
    notifyPairPinDraftChanged(role);
  } catch {
    /* ignore */
  }
}
