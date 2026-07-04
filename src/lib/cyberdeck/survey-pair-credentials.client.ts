const SURVEY_MIRAGE_PAIR_STORAGE_KEY = "echo-mirage-survey-mirage-pair";
const SURVEY_POWERFIST_PAIR_STORAGE_KEY = "echo-mirage-survey-powerfist-pair";
const POWERFIST_DEVICE_ID_KEY = "echo-mirage-powerfist-device-id";

export type SurveyMiragePairCredentials = {
  echoHost: string;
  httpPort: number;
  echoNodeId: string;
  mirageToken: string;
  nodeId: string;
  sessionEpoch: number;
  pairedAt: string;
};
/** @deprecated use SurveyMiragePairCredentials */
export type SpyMiragePairCredentials = SurveyMiragePairCredentials;

export type SurveyPowerfistPairCredentials = {
  echoHost: string;
  httpPort: number;
  echoNodeId: string;
  remoteToken: string;
  deviceId: string;
  sessionEpoch: number;
  pairedAt: string;
};
/** @deprecated use SurveyPowerfistPairCredentials */
export type SpyPowerfistPairCredentials = SurveyPowerfistPairCredentials;

export function getOrCreatePowerfistDeviceId(): string {
  if (typeof window === "undefined") return "";
  const existing = window.localStorage.getItem(POWERFIST_DEVICE_ID_KEY)?.trim();
  if (existing) return existing;
  const created = crypto.randomUUID();
  window.localStorage.setItem(POWERFIST_DEVICE_ID_KEY, created);
  return created;
}

export function saveSurveyMiragePairCredentials(creds: SurveyMiragePairCredentials): void {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(SURVEY_MIRAGE_PAIR_STORAGE_KEY, JSON.stringify(creds));
}

export function readSurveyMiragePairCredentials(): SurveyMiragePairCredentials | null {
  if (typeof window === "undefined") return null;
  const raw = window.localStorage.getItem(SURVEY_MIRAGE_PAIR_STORAGE_KEY)?.trim();
  if (!raw) return null;
  try {
    return JSON.parse(raw) as SurveyMiragePairCredentials;
  } catch {
    return null;
  }
}

export function saveSurveyPowerfistPairCredentials(creds: SurveyPowerfistPairCredentials): void {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(SURVEY_POWERFIST_PAIR_STORAGE_KEY, JSON.stringify(creds));
}

export function readSurveyPowerfistPairCredentials(): SurveyPowerfistPairCredentials | null {
  if (typeof window === "undefined") return null;
  const raw = window.localStorage.getItem(SURVEY_POWERFIST_PAIR_STORAGE_KEY)?.trim();
  if (!raw) return null;
  try {
    return JSON.parse(raw) as SurveyPowerfistPairCredentials;
  } catch {
    return null;
  }
}

export function clearSurveyMiragePairCredentials(): void {
  if (typeof window === "undefined") return;
  window.localStorage.removeItem(SURVEY_MIRAGE_PAIR_STORAGE_KEY);
}

export function clearSurveyPowerfistPairCredentials(): void {
  if (typeof window === "undefined") return;
  window.localStorage.removeItem(SURVEY_POWERFIST_PAIR_STORAGE_KEY);
}
